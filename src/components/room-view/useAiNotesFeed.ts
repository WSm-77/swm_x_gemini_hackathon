import { useEffect, useState } from "react";

import { SCRIBE_SERVICE_URL } from "@/lib/consts";

import { type AiNoteItem } from "./types";

type ScribeNotePayload = {
  type?: "ai_note_text";
  roomId?: string;
  text?: string;
  timestamp?: string;
};

const MAX_AI_NOTES = 8;

const buildNotesWsUrl = (): string => {
  const explicitUrl = import.meta.env.VITE_SCRIBE_NOTES_WS_URL;
  if (typeof explicitUrl === "string" && explicitUrl.trim().length > 0) {
    return explicitUrl.trim();
  }

  try {
    const serviceUrl = new URL(SCRIBE_SERVICE_URL);
    serviceUrl.protocol = serviceUrl.protocol === "https:" ? "wss:" : "ws:";
    serviceUrl.pathname = "/ws/notes";
    serviceUrl.search = "";
    serviceUrl.hash = "";
    return serviceUrl.toString();
  } catch {
    return "ws://localhost:8787/ws/notes";
  }
};

const NOTES_WS_URL = buildNotesWsUrl();

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
  const [aiNotes, setAiNotes] = useState<AiNoteItem[]>([]);
  const [aiNotesStatus, setAiNotesStatus] = useState<
    "connecting" | "connected" | "disconnected"
  >("connecting");

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
      socket = new WebSocket(NOTES_WS_URL);

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
          const nextItem: AiNoteItem = {
            id: crypto.randomUUID(),
            text,
            timestamp,
          };

          setAiNotes((current) => [nextItem, ...current].slice(0, MAX_AI_NOTES));
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
  }, [roomId]);

  return { aiNotes, aiNotesStatus };
};
