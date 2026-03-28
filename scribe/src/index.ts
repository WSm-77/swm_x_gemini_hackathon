import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createServer } from "node:http";
import { dirname } from "node:path";

import { FishjamClient } from "@fishjam-cloud/js-server-sdk";
import WebSocket, { WebSocketServer } from "ws";

import { loadConfig } from "./config";
import { FishjamAgentPcmSource } from "./fishjam/FishjamAgentPcmSource";
import { GeminiLiveClient } from "./gemini/GeminiLiveClient";
import type { SaveNoteItemArgs, SaveNoteItemPayload } from "./types";

type SessionStatus = {
  roomId: string;
  fishjamId: string;
};

type JoinFailure = {
  roomId: string;
  message: string;
};

const FAILED_ROOM_RETRY_MS = 60_000;

type NotesSocketMessage = {
  type: "ai_note_text";
  roomId: string;
  text: string;
  timestamp: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const describeJoinError = (error: unknown): string => {
  if (error instanceof Error) {
    const maybeError = error as Error & {
      statusCode?: number;
      details?: unknown;
    };

    const statusCode = maybeError.statusCode;
    const details = maybeError.details;

    const detailText =
      isRecord(details) && typeof details.detail === "string"
        ? details.detail
        : undefined;

    if (typeof statusCode === "number" && detailText) {
      return `${error.message} (status: ${statusCode}, detail: ${detailText})`;
    }

    if (typeof statusCode === "number") {
      return `${error.message} (status: ${statusCode})`;
    }

    return error.message;
  }

  return "Unknown room join failure";
};

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

const readJsonBody = async (request: IncomingMessage): Promise<unknown> => {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    if (typeof chunk === "string") {
      chunks.push(Buffer.from(chunk));
    } else {
      chunks.push(chunk);
    }
  }

  if (chunks.length === 0) return {};
  const rawBody = Buffer.concat(chunks).toString("utf8");
  return JSON.parse(rawBody);
};

const writeJson = (
  response: ServerResponse,
  statusCode: number,
  payload: Record<string, unknown>,
): void => {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.end(JSON.stringify(payload));
};

class NotesSocketHub {
  private readonly clients = new Set<WebSocket>();

  public addClient(client: WebSocket): void {
    this.clients.add(client);

    client.on("close", () => {
      this.clients.delete(client);
    });

    client.on("error", () => {
      this.clients.delete(client);
    });
  }

  public broadcast(message: NotesSocketMessage): void {
    const serialized = JSON.stringify(message);

    for (const client of this.clients) {
      console.log(
        `Broadcasting message to notes client: ${serialized}`,
        client.readyState  == WebSocket.OPEN ? "(open)" : "(not open)");
      if (client.readyState !== WebSocket.OPEN) continue;
      client.send(serialized);
    }
  }

  public closeAll(): void {
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.close(1000, "Scribe shutdown");
      }
    }
    this.clients.clear();
  }
}

class ScribeSession {
  private readonly fishjamAgent: FishjamAgentPcmSource;
  private readonly gemini: GeminiLiveClient;
  private streamTask?: Promise<void>;
  private isClosed = false;

  public constructor(
    private readonly options: {
      roomId: string;
      fishjamId: string;
      managementToken: string;
      subscribeMode: "auto" | "manual";
      geminiApiKey: string;
      geminiModel: string;
      disablePcmStream: boolean;
      modelAudioDumpPath?: string;
      modelAudioDumpStream?: NodeJS.WritableStream;
      notesHub: NotesSocketHub;
    },
  ) {
    this.fishjamAgent = new FishjamAgentPcmSource({
      fishjamId: options.fishjamId,
      managementToken: options.managementToken,
      roomId: options.roomId,
      subscribeMode: options.subscribeMode,
    });

    this.gemini = new GeminiLiveClient({
      apiKey: options.geminiApiKey,
      model: options.geminiModel,
      onModelText: (text) => {
        const trimmed = text.trim();
        if (trimmed.length === 0) return;

        console.log(`[Gemini text] ${text}`);
        options.notesHub.broadcast({
          type: "ai_note_text",
          roomId: options.roomId,
          text: trimmed,
          timestamp: new Date().toISOString(),
        });
      },
      onModelAudioChunk: (chunk, mimeType) => {
        if (!options.modelAudioDumpStream) return;
        options.modelAudioDumpStream.write(chunk);
        if (!options.modelAudioDumpPath) return;
        console.debug(
          `[Gemini audio] ${chunk.length} bytes (${mimeType}) appended to ${options.modelAudioDumpPath}`,
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
          roomId: options.roomId,
          timestamp: new Date().toISOString(),
        };

        // send to client
        console.debug("Broadcasted note item", payload);
      },
    });
  }

  public getStatus(): SessionStatus {
    return {
      roomId: this.options.roomId,
      fishjamId: this.options.fishjamId,
    };
  }

  public async start(): Promise<void> {
    await this.fishjamAgent.start();
    await this.gemini.connect();

    if (this.options.disablePcmStream) {
      console.warn("Gemini PCM streaming is disabled by GEMINI_DISABLE_PCM_STREAM=1");
      return;
    }

    const pcmStream = this.fishjamAgent.createPcmStream();
    this.streamTask = this.gemini.streamPcm(pcmStream).catch((error) => {
      if (this.isClosed) return;
      console.error("Gemini PCM stream failed", error);
    });
  }

  public async stop(): Promise<void> {
    if (this.isClosed) return;
    this.isClosed = true;

    this.gemini.close();
    await this.fishjamAgent.stop();

    if (this.streamTask) {
      await this.streamTask;
    }
  }
}

class ScribeSessionManager {
  private readonly sessionsByRoomId = new Map<string, ScribeSession>();
  private readonly fishjamClientById = new Map<string, FishjamClient>();
  private readonly failedRoomsAt = new Map<string, number>();
  private lock = Promise.resolve();

  public constructor(
    private readonly options: {
      defaultFishjamId: string;
      managementToken: string;
      subscribeMode: "auto" | "manual";
      geminiApiKey: string;
      geminiModel: string;
      disablePcmStream: boolean;
      modelAudioDumpPath?: string;
      modelAudioDumpStream?: NodeJS.WritableStream;
      notesHub: NotesSocketHub;
    },
  ) {}

  public async joinSession(): Promise<{
    status: "started" | "already_active" | "partial_failure";
    joined: SessionStatus[];
    failed: JoinFailure[];
    active: SessionStatus[];
  }> {
    return this.runExclusive(async () => {
      const fishjamId = this.options.defaultFishjamId;
      const fishjamClient = this.getOrCreateFishjamClient(fishjamId);
      console.log(`Fetching rooms for Fishjam ${fishjamId}...`);
      const allRooms = await fishjamClient.getAllRooms();
      console.log(`Found ${allRooms.length} rooms on Fishjam ${fishjamId}`);
      const now = Date.now();

      const joined: SessionStatus[] = [];
      const failed: JoinFailure[] = [];

      for (const room of allRooms) {
        const roomId = room.id as unknown as string;
        if (typeof roomId !== "string" || roomId.trim().length === 0) {
          continue;
        }

        // Join only active rooms. This avoids stale empty rooms that often fail with 500.
        if (!Array.isArray(room.peers) || room.peers.length === 0) {
          continue;
        }

        if (this.sessionsByRoomId.has(roomId)) continue;

        const failedAt = this.failedRoomsAt.get(roomId);
        if (typeof failedAt === "number" && now - failedAt < FAILED_ROOM_RETRY_MS) {
          continue;
        }

        const nextSession = new ScribeSession({
          roomId,
          fishjamId,
          managementToken: this.options.managementToken,
          subscribeMode: this.options.subscribeMode,
          geminiApiKey: this.options.geminiApiKey,
          geminiModel: this.options.geminiModel,
          disablePcmStream: this.options.disablePcmStream,
          modelAudioDumpPath: this.options.modelAudioDumpPath,
          modelAudioDumpStream: this.options.modelAudioDumpStream,
          notesHub: this.options.notesHub,
        });

        try {
          await nextSession.start();
          this.sessionsByRoomId.set(roomId, nextSession);
          this.failedRoomsAt.delete(roomId);

          const activeSession = nextSession.getStatus();
          joined.push(activeSession);
          console.debug(
            `Scribe session active for room ${activeSession.roomId} on fishjam ${activeSession.fishjamId}`,
          );
        } catch (error) {
          const message = describeJoinError(error);

          failed.push({ roomId, message });
          this.failedRoomsAt.set(roomId, now);
          console.error(`Failed to join scribe room ${roomId}`, error);

          try {
            await nextSession.stop();
          } catch {
            // Ignore cleanup failures for sessions that did not start successfully.
          }
        }
      }

      const active = this.getActiveSessionStatus();

      const status: "started" | "already_active" | "partial_failure" =
        failed.length > 0 && joined.length > 0
          ? "partial_failure"
          : joined.length > 0
            ? "started"
            : "already_active";

      return {
        status,
        joined,
        failed,
        active,
      };
    });
  }

  public async stopActiveSession(): Promise<number> {
    return this.runExclusive(async () => {
      const allSessions = Array.from(this.sessionsByRoomId.values());

      for (const session of allSessions) {
        await session.stop();
      }

      this.sessionsByRoomId.clear();
      return allSessions.length;
    });
  }

  public getActiveSessionStatus(): SessionStatus[] {
    return Array.from(this.sessionsByRoomId.values()).map((session) =>
      session.getStatus(),
    );
  }

  private getOrCreateFishjamClient(fishjamId: string): FishjamClient {
    const existing = this.fishjamClientById.get(fishjamId);
    if (existing) return existing;

    const nextClient = new FishjamClient({
      fishjamId,
      managementToken: this.options.managementToken,
    });

    this.fishjamClientById.set(fishjamId, nextClient);
    return nextClient;
  }

  private async runExclusive<T>(operation: () => Promise<T>): Promise<T> {
    const previousLock = this.lock;
    let releaseLock: () => void = () => {};
    this.lock = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });

    await previousLock;

    try {
      return await operation();
    } finally {
      releaseLock();
    }
  }
}

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

  const notesHub = new NotesSocketHub();

  const sessionManager = new ScribeSessionManager({
    defaultFishjamId: config.fishjam.fishjamId,
    managementToken: config.fishjam.managementToken,
    subscribeMode: config.fishjam.subscribeMode,
    geminiApiKey: config.gemini.apiKey,
    geminiModel: config.gemini.model,
    disablePcmStream,
    modelAudioDumpPath,
    modelAudioDumpStream,
    notesHub,
  });

  const server = createServer((request, response) => {
    void (async () => {
      if (request.method === "OPTIONS") {
        writeJson(response, 204, {});
        return;
      }

      if (request.method === "GET" && request.url === "/health") {
        writeJson(response, 200, {
          ok: true,
          activeSession: sessionManager.getActiveSessionStatus(),
        });
        return;
      }

      if (request.method === "POST" && request.url === "/sessions/join") {
        try {
          await readJsonBody(request);
          console.log("Received request to join scribe session");
          const result = await sessionManager.joinSession();
          const hasNoActiveSessions = result.active.length === 0;
          const hasFailures = result.failed.length > 0;

          if (hasNoActiveSessions && hasFailures) {
            writeJson(response, 500, {
              ok: false,
              error: "Failed to join any FishJam room",
              ...result,
            });
            return;
          }

          writeJson(response, 200, {
            ok: true,
            ...result,
          });
          return;
        } catch (error) {
          console.error("Failed to join scribe session", error);
          writeJson(response, 500, {
            ok: false,
            error: "Failed to join scribe session",
          });
          return;
        }
      }

      if (request.method === "POST" && request.url === "/sessions/leave") {
        try {
          const stoppedCount = await sessionManager.stopActiveSession();
          writeJson(response, 200, {
            ok: true,
            stoppedCount,
            activeSession: sessionManager.getActiveSessionStatus(),
          });
          return;
        } catch (error) {
          console.error("Failed to stop scribe session", error);
          writeJson(response, 500, {
            ok: false,
            error: "Failed to stop scribe session",
          });
          return;
        }
      }

      writeJson(response, 404, {
        ok: false,
        error: "Not found",
      });
    })();
  });

  const notesWsServer = new WebSocketServer({
    server,
    path: "/ws/notes",
  });

  notesWsServer.on("connection", (socket) => {
    notesHub.addClient(socket);
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(config.control.port, config.control.host, () => {
      resolve();
    });
  });

  console.debug(
    `Scribe control server listening on http://${config.control.host}:${config.control.port}`,
  );
  console.debug(
    `Scribe notes websocket listening on ws://${config.control.host}:${config.control.port}/ws/notes`,
  );
  console.debug("Scribe service ready for per-meeting session joins");
  console.debug("Gemini response mode: audio + CLI transcription");
  if (modelAudioDumpEnabled) {
    console.debug(
      `Gemini audio dump enabled: ${modelAudioDumpPath} (16kHz PCM stream)`,
    );
  }

  const shutdown = async (): Promise<void> => {
    console.warn("Shutting down Scribe service");
    await sessionManager.stopActiveSession();

    notesHub.closeAll();
    await new Promise<void>((resolve) => {
      notesWsServer.close(() => resolve());
    });

    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });

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
