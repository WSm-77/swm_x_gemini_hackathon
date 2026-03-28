import { useEffect, useState } from "react";

export const useSseEvents = (sseUrl?: string) => {
  const [isConnected, setIsConnected] = useState(false);
  const [eventSource, setEventSource] = useState<EventSource | null>(null);

  useEffect(() => {
    if (!sseUrl) return;

    try {
      const es = new EventSource(sseUrl);

      es.onopen = () => {
        setIsConnected(true);
        console.debug(`[SSE] Connected to ${sseUrl}`);
      };

      es.addEventListener("gemini_response", (event) => {
        try {
          const payload = JSON.parse(event.data);
          const channel = new BroadcastChannel("gemini-responses");
          channel.postMessage({
            type: "gemini_response",
            ...payload,
          });
          channel.close();
          console.debug("[SSE] Received gemini_response event", payload);
        } catch (error) {
          console.error("[SSE] Failed to parse gemini_response", error);
        }
      });

      es.addEventListener("save_note_item", (event) => {
        try {
          const payload = JSON.parse(event.data);
          const channel = new BroadcastChannel("note-items");
          channel.postMessage({
            type: "save_note_item",
            ...payload,
          });
          channel.close();
          console.debug("[SSE] Received save_note_item event", payload);
        } catch (error) {
          console.error("[SSE] Failed to parse save_note_item", error);
        }
      });

      es.onerror = (error) => {
        console.error("[SSE] Connection error", error);
        setIsConnected(false);
        es.close();
      };

      setEventSource(es);

      return () => {
        es.close();
        setIsConnected(false);
      };
    } catch (error) {
      console.error("[SSE] Failed to create EventSource", error);
      setIsConnected(false);
    }
  }, [sseUrl]);

  return { isConnected, eventSource };
};
