import { useEffect, useRef } from "react";

export type GeminiResponse = {
  text: string;
  timestamp: string;
  source: "gemini_live";
  roomId?: string;
};

export const useGeminiResponses = (
  onResponse: (response: GeminiResponse) => void
) => {
  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    // Listen for Gemini responses via BroadcastChannel
    // This allows communication between the backend (via worker/context) and frontend
    const channel = new BroadcastChannel("gemini-responses");
    channelRef.current = channel;

    const handleMessage = (event: MessageEvent) => {
      const data = event.data;

      if (data.type === "gemini_response" && data.text) {
        onResponse({
          text: data.text,
          timestamp: data.timestamp || new Date().toISOString(),
          source: "gemini_live",
          roomId: data.roomId,
        });
      }
    };

    channel.addEventListener("message", handleMessage);

    return () => {
      channel.removeEventListener("message", handleMessage);
      channel.close();
      channelRef.current = null;
    };
  }, [onResponse]);

  return {
    sendResponse: (response: GeminiResponse) => {
      if (channelRef.current) {
        channelRef.current.postMessage({
          type: "gemini_response",
          ...response,
        });
      }
    },
  };
};
