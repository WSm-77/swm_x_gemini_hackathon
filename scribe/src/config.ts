const DEFAULT_GEMINI_MODEL = "gemini-3.1-flash-live-preview";
const DEFAULT_GEMINI_WS_URL =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent";

const readRequired = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

export type ScribeConfig = {
  gemini: {
    apiKey: string;
    model: string;
    wsUrl: string;
  };
  fishjam: {
    fishjamId: string;
    managementToken: string;
    roomId: string;
    subscribeMode: "auto" | "manual";
  };
  phoenix: {
    wsUrl: string;
    topic: string;
    event: string;
  };
};

export const loadConfig = (): ScribeConfig => {
  const geminiApiKey = readRequired("GEMINI_API_KEY");
  const phoenixWsUrl = readRequired("PHOENIX_WS_URL");
  const fishjamId = readRequired("FISHJAM_ID");
  const managementToken = readRequired("FISHJAM_MANAGEMENT_TOKEN");
  const roomId = readRequired("FISHJAM_ROOM_ID");

  const subscribeMode = process.env.FISHJAM_AGENT_SUBSCRIBE_MODE ?? "auto";
  if (subscribeMode !== "auto" && subscribeMode !== "manual") {
    throw new Error(
      "Environment variable FISHJAM_AGENT_SUBSCRIBE_MODE must be auto or manual",
    );
  }

  return {
    gemini: {
      apiKey: geminiApiKey,
      model: process.env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL,
      wsUrl: process.env.GEMINI_LIVE_WS_URL ?? DEFAULT_GEMINI_WS_URL,
    },
    fishjam: {
      fishjamId,
      managementToken,
      roomId,
      subscribeMode,
    },
    phoenix: {
      wsUrl: phoenixWsUrl,
      topic: process.env.PHOENIX_TOPIC ?? "scribe:global",
      event: process.env.PHOENIX_EVENT ?? "save_note_item",
    },
  };
};
