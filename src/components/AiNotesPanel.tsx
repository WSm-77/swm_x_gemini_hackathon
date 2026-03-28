import { Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { SCRIBE_SERVICE_URL } from "@/lib/consts";
import { getPersistedFormValues } from "@/lib/utils";

type ScribeNotePayload = {
  type?: "ai_note_text";
  roomId?: string;
  text?: string;
  timestamp?: string;
};

type AiNoteItem = {
  id: string;
  text: string;
  timestamp: string;
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

const toTimeLabel = (isoDate: string): string => {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "just now";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

export const AiNotesPanel = () => {
  const [aiNotes, setAiNotes] = useState<AiNoteItem[]>([]);
  const [aiNotesStatus, setAiNotesStatus] = useState<
    "connecting" | "connected" | "disconnected"
  >("connecting");
  const roomId = useMemo(() => getPersistedFormValues().roomName ?? "", []);

  useEffect(() => {
    let isDisposed = false;
    let isIntentionalClose = false;
    let socket: WebSocket | undefined;
    let reconnectTimer: number | undefined;
    let reconnectAttempt = 0;

    const connect = () => {
      if (isDisposed) return;

      isIntentionalClose = false;
      console.info(
        `[AI notes] Opening websocket connection to ${NOTES_WS_URL} (attempt ${reconnectAttempt + 1})`,
      );

      setAiNotesStatus("connecting");
      socket = new WebSocket(NOTES_WS_URL);

      socket.onopen = () => {
        reconnectAttempt = 0;
        setAiNotesStatus("connected");
        console.info("[AI notes] Websocket connected");
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
        console.warn(`[AI notes] Websocket error for ${NOTES_WS_URL}`);
      };

      socket.onclose = (event) => {
        if (isDisposed || isIntentionalClose) return;

        setAiNotesStatus("disconnected");
        console.warn(
          `[AI notes] Websocket closed (${event.code}) ${event.reason || ""}`,
        );

        const reconnectDelayMs = reconnectAttempt === 0 ? 2_000 : 10_000;
        reconnectAttempt += 1;

        console.info(
          `[AI notes] Reconnecting in ${reconnectDelayMs / 1000}s (retry ${reconnectAttempt})`,
        );

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

  return (
    <section className="rounded-3xl border border-[#48474c]/35 bg-[#19191e]/90 p-4 backdrop-blur-xl">
      <div className="mb-3 flex items-center gap-2 text-[#8ff5ff]">
        <Sparkles size={16} />
        <h2 className="font-headline text-base">AI notes</h2>
      </div>

      <div className="mb-3 text-xs text-[#8b8990]">
        {aiNotesStatus === "connected" && "Live sync enabled"}
        {aiNotesStatus === "connecting" && "Connecting to notes stream..."}
        {aiNotesStatus === "disconnected" && "Disconnected from notes stream"}
      </div>

      {aiNotes.length === 0 ? (
        <p className="font-body text-sm text-[#acaab0]">
          Waiting for AI notes from scribe...
        </p>
      ) : (
        <div className="space-y-2 text-sm">
          {aiNotes.map((note) => (
            <article key={note.id} className="rounded-xl bg-[#25252b] p-3">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="rounded-full bg-[#2c2d34] px-2 py-0.5 text-[11px] uppercase tracking-[0.08em] text-[#8ff5ff]">
                  AI update
                </span>
                <span className="text-[11px] text-[#8b8990]">
                  {toTimeLabel(note.timestamp)}
                </span>
              </div>

              <p className="font-body whitespace-pre-wrap text-[#d6d4db]">
                {note.text}
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
};
