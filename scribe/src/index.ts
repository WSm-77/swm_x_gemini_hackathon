import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { loadConfig } from "./config";
import { FishjamAgentPcmSource } from "./fishjam/FishjamAgentPcmSource";
import { GeminiLiveClient } from "./gemini/GeminiLiveClient";
import { PhoenixChannelClient } from "./phoenix/PhoenixChannelClient";
import type { SaveNoteItemArgs, SaveNoteItemPayload } from "./types";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const parseSaveNoteItemArgs = (value: unknown): SaveNoteItemArgs | null => {
  if (!isRecord(value)) return null;

  const content = value.content;
  const type = value.type;
  const assignee = value.assignee;

  if (typeof content !== "string" || content.trim().length === 0) return null;
  if (
    type !== "action_item" &&
    type !== "decision" &&
    type !== "question" &&
    type !== "summary"
  ) {
    return null;
  }

  if (
    assignee !== undefined &&
    assignee !== null &&
    typeof assignee !== "string"
  ) {
    return null;
  }

  return {
    content,
    type,
    assignee: typeof assignee === "string" ? assignee : null,
  };
};

const run = async (): Promise<void> => {
  const config = loadConfig();
  const disablePcmStream = process.env.GEMINI_DISABLE_PCM_STREAM === "1";
  const modelAudioDumpPath = process.env.GEMINI_AUDIO_DUMP_PATH;
  const modelAudioDumpEnabled =
    typeof modelAudioDumpPath === "string" && modelAudioDumpPath.length > 0;

  if (modelAudioDumpEnabled) {
    const dumpDirectory = dirname(modelAudioDumpPath);
    if (!existsSync(dumpDirectory)) {
      mkdirSync(dumpDirectory, { recursive: true });
    }
  }

  const modelAudioDumpStream = modelAudioDumpEnabled
    ? createWriteStream(modelAudioDumpPath, { flags: "a" })
    : undefined;

  const fishjamAgent = new FishjamAgentPcmSource({
    fishjamId: config.fishjam.fishjamId,
    managementToken: config.fishjam.managementToken,
    roomId: config.fishjam.roomId,
    subscribeMode: config.fishjam.subscribeMode,
  });

  const phoenix = new PhoenixChannelClient({
    wsUrl: config.phoenix.wsUrl,
    topic: config.phoenix.topic,
  });

  const gemini = new GeminiLiveClient({
    apiKey: config.gemini.apiKey,
    model: config.gemini.model,
    onModelText: (text) => {
      console.log(`[Gemini text] ${text}`);
    },
    onModelAudioChunk: (chunk, mimeType) => {
      if (!modelAudioDumpStream) return;
      modelAudioDumpStream.write(chunk);
      console.debug(
        `[Gemini audio] ${chunk.length} bytes (${mimeType}) appended to ${modelAudioDumpPath}`,
      );
    },
    onFunctionCall: (call) => {
      const parsed = parseSaveNoteItemArgs(call.args);
      if (!parsed) {
        console.warn("Received invalid save_note_item args", call.args);
        return;
      }

      const payload: SaveNoteItemPayload = {
        ...parsed,
        source: "gemini_live",
        callId: call.id,
        roomId: config.fishjam.roomId,
        timestamp: new Date().toISOString(),
      };

      phoenix.broadcast(config.phoenix.event, payload);
      console.debug("Broadcasted note item", payload);
    },
  });

  await fishjamAgent.start();
  // await phoenix.connect();
  await gemini.connect();

  if (!disablePcmStream) {
    const pcmStream = fishjamAgent.createPcmStream();
    void gemini.streamPcm(pcmStream).catch((error) => {
      console.error("Gemini PCM stream failed", error);
    });
  } else {
    console.warn("Gemini PCM streaming is disabled by GEMINI_DISABLE_PCM_STREAM=1");
  }

  console.debug("Scribe service started");
  console.debug("Gemini response mode: audio + CLI transcription");
  if (modelAudioDumpEnabled) {
    console.debug(
      `Gemini audio dump enabled: ${modelAudioDumpPath} (16kHz PCM stream)`,
    );
  }

  const shutdown = async (): Promise<void> => {
    console.warn("Shutting down Scribe service");
    gemini.close();
    phoenix.close();
    await fishjamAgent.stop();
    modelAudioDumpStream?.end();
    process.exit(0);
  };

  process.once("SIGINT", () => {
    void shutdown();
  });
  process.once("SIGTERM", () => {
    void shutdown();
  });
};

void run().catch((error) => {
  console.error("Failed to start Scribe service", error);
  process.exit(1);
});
