import { useEffect, useState } from "react";

type PhoenixMessage = [
  joinRef: string | null,
  ref: string,
  topic: string,
  event: string,
  payload: Record<string, unknown>
];

export const usePhoenixEvents = (wsUrl?: string, topic?: string) => {
  const [isConnected, setIsConnected] = useState(false);
  const [ws, setWs] = useState<WebSocket | null>(null);

  useEffect(() => {
    if (!wsUrl || !topic) return;

    let joinRef: string | null = null;
    let refCount = 0;
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      // Join the topic
      joinRef = `${Date.now()}-${refCount++}`;
      const joinMessage: PhoenixMessage = [
        joinRef,
        `${Date.now()}-${refCount++}`,
        topic,
        "phx_join",
        {},
      ];

      socket.send(JSON.stringify(joinMessage));
      setIsConnected(true);
      console.debug(`[Phoenix] Connected to ${topic}`);
    };

    socket.onmessage = (event) => {
      try {
        const message: PhoenixMessage = JSON.parse(event.data);
        const [_joinRef, _ref, _topic, eventType, payload] = message;

        // Broadcast Gemini responses to BroadcastChannel
        if (eventType === "gemini_response" || (payload && (payload as any).type === "gemini_response")) {
          const channel = new BroadcastChannel("gemini-responses");
          channel.postMessage({
            type: "gemini_response",
            ...payload,
          });
          channel.close();
          console.debug("[Phoenix] Received gemini_response event", payload);
        }

        // Also handle function call events (for note items)
        if (eventType === "save_note_item" || (payload && (payload as any).type === "save_note_item")) {
          const channel = new BroadcastChannel("note-items");
          channel.postMessage({
            type: "save_note_item",
            ...payload,
          });
          channel.close();
          console.debug("[Phoenix] Received save_note_item event", payload);
        }
      } catch (error) {
        console.error("[Phoenix] Failed to parse message", error);
      }
    };

    socket.onerror = (error) => {
      console.error("[Phoenix] WebSocket error", error);
      setIsConnected(false);
    };

    socket.onclose = () => {
      console.debug("[Phoenix] Disconnected");
      setIsConnected(false);
    };

    setWs(socket);

    return () => {
      socket.close();
    };
  }, [wsUrl, topic]);

  return { isConnected, ws };
};

