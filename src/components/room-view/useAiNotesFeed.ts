import { useDataChannel } from "@fishjam-cloud/react-client";
import { useEffect, useRef, useState } from "react";

import { SCRIBE_SERVICE_URL } from "@/lib/consts";

import { type AiNoteItem } from "./types";

type ScribeNotePayload = {
  type?: "ai_note_text";
  roomId?: string;
  text?: string;
  timestamp?: string;
};

const MAX_AI_NOTES = 8;
const DATA_CHANNEL_OPTIONS = { reliable: true } as const;

type DataChannelNoteMessage = {
  type: "ai_note_text";
  roomId?: string;
  text: string;
  timestamp: string;
  source?: "scribe_ws" | "fishjam_data";
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const getNoteFingerprint = ({
  roomId,
  text,
  timestamp,
}: {
  roomId?: string;
  text: string;
  timestamp: string;
}): string => `${roomId ?? ""}|${timestamp}|${text}`;

const buildNotesWsUrl = (roomId: string | null): string => {
  const explicitUrl = import.meta.env.VITE_SCRIBE_NOTES_WS_URL;
  if (typeof explicitUrl === "string" && explicitUrl.trim().length > 0) {
    try {
      const parsed = new URL(explicitUrl.trim());
      if (roomId) {
        parsed.searchParams.set("roomId", roomId);
      } else {
        parsed.searchParams.delete("roomId");
      }
      return parsed.toString();
    } catch {
      return explicitUrl.trim();
    }
  }

  try {
    const serviceUrl = new URL(SCRIBE_SERVICE_URL);
    serviceUrl.protocol = serviceUrl.protocol === "https:" ? "wss:" : "ws:";
    serviceUrl.pathname = "/ws/notes";
    if (roomId) {
      serviceUrl.searchParams.set("roomId", roomId);
    } else {
      serviceUrl.search = "";
    }
    serviceUrl.hash = "";
    return serviceUrl.toString();
  } catch {
    return roomId
      ? `ws://localhost:8787/ws/notes?roomId=${encodeURIComponent(roomId)}`
      : "ws://localhost:8787/ws/notes";
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const parseScribeNotePayload = (value: unknown): ScribeNotePayload | null => {
  if (!isRecord(value)) return null;

  const type = value.type;
  const text = value.text;
  const roomId = value.roomId;
  const timestamp = value.timestamp;

  if (type !== "ai_note_text") return null;
  if (typeof text !== "string" || text.trim().length === 0) return null;

  return {
    type,
    text,
    roomId: typeof roomId === "string" ? roomId : undefined,
    timestamp: typeof timestamp === "string" ? timestamp : undefined,
  };
};

export const toTimeLabel = (isoDate: string): string => {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "just now";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

export const useAiNotesFeed = (roomId: string | null) => {
  const {
    initializeDataChannel,
    dataChannelReady,
    dataChannelLoading,
    subscribeData,
    publishData,
  } = useDataChannel();

  const [aiNotes, setAiNotes] = useState<AiNoteItem[]>([]);
  const [aiNotesStatus, setAiNotesStatus] = useState<
    "connecting" | "connected" | "disconnected"
  >("connecting");
  const seenNotesRef = useRef<Set<string>>(new Set());

  const addNote = ({ text, timestamp, roomId: messageRoomId }: { text: string; timestamp: string; roomId?: string }) => {
    const fingerprint = getNoteFingerprint({
      roomId: messageRoomId,
      text,
      timestamp,
    });

    if (seenNotesRef.current.has(fingerprint)) return;
    seenNotesRef.current.add(fingerprint);

    setAiNotes((current) => {
      const next = [
        {
          id: crypto.randomUUID(),
          text,
          timestamp,
        },
        ...current,
      ].slice(0, MAX_AI_NOTES);

      if (seenNotesRef.current.size > 200) {
        seenNotesRef.current = new Set(
          next.map((item) =>
            getNoteFingerprint({ roomId: messageRoomId, text: item.text, timestamp: item.timestamp }),
          ),
        );
      }

      return next;
    });
  };

  useEffect(() => {
    if (dataChannelReady || dataChannelLoading) return;
    initializeDataChannel();
  }, [dataChannelReady, dataChannelLoading, initializeDataChannel]);

  useEffect(() => {
    const unsubscribe = subscribeData((data) => {
      try {
        const payload = JSON.parse(textDecoder.decode(data)) as unknown;
        const note = parseScribeNotePayload(payload);

        if (!note) return;
        if (roomId && note.roomId && note.roomId !== roomId) return;

        const text = note.text?.trim();
        if (!text) return;

        const timestamp = note.timestamp ?? new Date().toISOString();
        addNote({ text, timestamp, roomId: note.roomId });
      } catch {
        // Ignore malformed data channel payloads.
      }
    }, DATA_CHANNEL_OPTIONS);

    return unsubscribe;
  }, [roomId, subscribeData]);

  useEffect(() => {
    let isDisposed = false;
    let isIntentionalClose = false;
    let socket: WebSocket | undefined;
    let reconnectTimer: number | undefined;
    let reconnectAttempt = 0;

    const connect = () => {
      if (isDisposed) return;

      isIntentionalClose = false;
      setAiNotesStatus("connecting");
      const notesWsUrl = buildNotesWsUrl(roomId);
      socket = new WebSocket(notesWsUrl);

      socket.onopen = () => {
        reconnectAttempt = 0;
        setAiNotesStatus("connected");
      };

      socket.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data as string) as unknown;
          const payload = parseScribeNotePayload(parsed);

          if (!payload) return;
          if (roomId && payload.roomId && payload.roomId !== roomId) return;

          const text = payload.text?.trim();
          if (!text) return;

          const timestamp = payload.timestamp ?? new Date().toISOString();
          addNote({ text, timestamp, roomId: payload.roomId });

          if (dataChannelReady) {
            const message: DataChannelNoteMessage = {
              type: "ai_note_text",
              roomId: payload.roomId,
              text,
              timestamp,
              source: "scribe_ws",
            };
            publishData(
              textEncoder.encode(JSON.stringify(message)),
              DATA_CHANNEL_OPTIONS,
            );
          }
        } catch {
          // Ignore malformed websocket payloads.
        }
      };

      socket.onerror = () => {
        if (isDisposed || isIntentionalClose) return;
        setAiNotesStatus("disconnected");
      };

      socket.onclose = () => {
        if (isDisposed || isIntentionalClose) return;

        setAiNotesStatus("disconnected");

        const reconnectDelayMs = reconnectAttempt === 0 ? 2_000 : 10_000;
        reconnectAttempt += 1;

        reconnectTimer = window.setTimeout(connect, reconnectDelayMs);
      };
    };

    connect();

    return () => {
      isDisposed = true;

      if (reconnectTimer !== undefined) {
        window.clearTimeout(reconnectTimer);
      }

      if (socket) {
        isIntentionalClose = true;
        socket.onopen = null;
        socket.onmessage = null;
        socket.onerror = null;
        socket.onclose = null;

        if (
          socket.readyState === WebSocket.CONNECTING ||
          socket.readyState === WebSocket.OPEN
        ) {
          socket.close(1000, "Room view unmounted");
        }
      }
    };
  }, [roomId, dataChannelReady, publishData]);

  return { aiNotes, aiNotesStatus };
};
