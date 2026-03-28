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

const readOptional = (name: string): string | undefined => {
  const value = process.env[name];
  if (!value) return undefined;
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
    defaultRoomId?: string;
    subscribeMode: "auto" | "manual";
  };
  control: {
    host: string;
    port: number;
  };
};

export const loadConfig = (): ScribeConfig => {
  const geminiApiKey = readRequired("GEMINI_API_KEY");
  const fishjamId = readRequired("FISHJAM_ID");
  const managementToken = readRequired("FISHJAM_MANAGEMENT_TOKEN");

  const subscribeMode = process.env.FISHJAM_AGENT_SUBSCRIBE_MODE ?? "auto";
  if (subscribeMode !== "auto" && subscribeMode !== "manual") {
    throw new Error(
      "Environment variable FISHJAM_AGENT_SUBSCRIBE_MODE must be auto or manual",
    );
  }

  const controlPortValue = process.env.SCRIBE_CONTROL_PORT ?? "8787";
  const parsedControlPort = Number.parseInt(controlPortValue, 10);
  if (Number.isNaN(parsedControlPort) || parsedControlPort <= 0) {
    throw new Error("Environment variable SCRIBE_CONTROL_PORT must be a positive integer");
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
      subscribeMode,
    },
    control: {
      host: process.env.SCRIBE_CONTROL_HOST ?? "0.0.0.0",
      port: parsedControlPort,
    },
  };
};
