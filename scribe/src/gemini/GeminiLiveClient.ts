import { GoogleGenAI, Modality } from "@google/genai";
import type { GeminiFunctionCall } from "../types";

const PCM_CHUNK_BYTES = 3200;
const PCM_MIME_TYPE = "audio/pcm;rate=16000";

type GeminiLiveClientOptions = {
  apiKey: string;
  model: string;
  systemInstruction: string;
  onFunctionCall: (call: GeminiFunctionCall) => void;
  onModelText?: (text: string) => void;
  onModelAudioChunk?: (chunk: Buffer, mimeType: string) => void;
};

type GeminiServerMessage = {
  serverContent?: {
    modelTurn?: {
      parts?: Array<Record<string, unknown>>;
    };
    inputTranscription?: {
      text?: string;
      finished?: boolean;
    };
    outputTranscription?: {
      text?: string;
      finished?: boolean;
    };
    toolCall?: {
      functionCalls?: Array<{ id?: string; name?: string; args?: unknown }>;
      functionCall?: { id?: string; name?: string; args?: unknown };
    };
  };
  toolCall?: {
    functionCalls?: Array<{ id?: string; name?: string; args?: unknown }>;
    functionCall?: { id?: string; name?: string; args?: unknown };
  };
};

export class GeminiLiveClient {
  private session?: {
    sendRealtimeInput: (payload: {
      audio?: { mimeType: string; data: string };
      media?: { mimeType: string; data: string };
    }) => void;
    close: () => void;
  };
  private pendingResolve?: () => void;
  private pendingReject?: (error: unknown) => void;

  public constructor(private readonly options: GeminiLiveClientOptions) {}

  public async connect(): Promise<void> {
    const ai = new GoogleGenAI({ apiKey: this.options.apiKey });

    let settled = false;
    const connected = new Promise<void>((resolve, reject) => {
      this.pendingResolve = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      this.pendingReject = (error: unknown) => {
        if (settled) return;
        settled = true;
        reject(error);
      };
    });

    const session = await ai.live.connect({
      model: this.options.model,
      config: {
        responseModalities: [Modality.AUDIO],
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        systemInstruction: {
          role: "system",
          parts: [{ text: this.options.systemInstruction }],
        },
      },
      callbacks: {
        onopen: () => {
          console.debug("Gemini live session opened");
          this.pendingResolve?.();
        },
        onmessage: (message) => {
          this.handleMessage(message as GeminiServerMessage);
        },
        onerror: (error) => {
          this.pendingReject?.(error);
          console.error("Gemini live client error", error);
        },
        onclose: (event) => {
          console.warn(
            `Gemini websocket closed (${event.code ?? "unknown"}) ${event.reason ?? ""}`,
          );
        },
      },
    });

    this.session = session as typeof this.session;
    await connected;
  }

  public async streamPcm(source: AsyncIterable<Buffer>): Promise<void> {
    for await (const pcmBuffer of source) {
      const chunks = this.chunkPcm(pcmBuffer, PCM_CHUNK_BYTES);
      for (const chunk of chunks) {
        this.sendRealtimeAudioChunk(chunk);
      }
    }
  }

  public close(): void {
    this.session?.close();
  }

  private sendRealtimeAudioChunk(chunk: Buffer): void {
    this.session?.sendRealtimeInput({
      audio: { mimeType: PCM_MIME_TYPE, data: chunk.toString("base64") },
    });
  }

  private handleMessage(message: GeminiServerMessage): void {
    const outputTranscription = message.serverContent?.outputTranscription?.text;
    if (
      typeof outputTranscription === "string" &&
      outputTranscription.trim().length > 0
    ) {
      this.options.onModelText?.(outputTranscription);
    }

    const texts = this.extractModelTexts(message);
    for (const text of texts) {
      this.options.onModelText?.(text);
    }

    const audioChunks = this.extractModelAudioChunks(message);
    for (const audioChunk of audioChunks) {
      this.options.onModelAudioChunk?.(audioChunk.chunk, audioChunk.mimeType);
    }

    const functionCalls = this.extractFunctionCalls(message);
    for (const call of functionCalls) {
      if (call.name !== "save_note_item") continue;
      this.options.onFunctionCall(call);
    }
  }

  private extractModelTexts(message: GeminiServerMessage): string[] {
    const texts: string[] = [];
    const modelParts = message.serverContent?.modelTurn?.parts ?? [];

    for (const part of modelParts) {
      const maybeText = part.text;
      if (typeof maybeText === "string" && maybeText.trim().length > 0) {
        texts.push(maybeText);
      }
    }

    return texts;
  }

  private extractModelAudioChunks(
    message: GeminiServerMessage,
  ): Array<{ chunk: Buffer; mimeType: string }> {
    const chunks: Array<{ chunk: Buffer; mimeType: string }> = [];
    const modelParts = message.serverContent?.modelTurn?.parts ?? [];

    for (const part of modelParts) {
      const maybeInlineData = part.inlineData;
      if (!maybeInlineData || typeof maybeInlineData !== "object") continue;

      const inlineData = maybeInlineData as Record<string, unknown>;
      const mimeType = inlineData.mimeType;
      const data = inlineData.data;

      if (typeof mimeType !== "string" || typeof data !== "string") continue;
      if (!mimeType.startsWith("audio/")) continue;

      chunks.push({
        mimeType,
        chunk: Buffer.from(data, "base64"),
      });
    }

    return chunks;
  }

  private extractFunctionCalls(
    message: GeminiServerMessage,
  ): GeminiFunctionCall[] {
    const calls: GeminiFunctionCall[] = [];

    const fromTopLevel = message.toolCall;
    if (fromTopLevel?.functionCalls) {
      calls.push(
        ...fromTopLevel.functionCalls.filter(this.isGeminiFunctionCall),
      );
    }
    if (
      fromTopLevel?.functionCall &&
      this.isGeminiFunctionCall(fromTopLevel.functionCall)
    ) {
      calls.push(fromTopLevel.functionCall);
    }

    const fromServerContent = message.serverContent?.toolCall;
    if (fromServerContent?.functionCalls) {
      calls.push(
        ...fromServerContent.functionCalls.filter(this.isGeminiFunctionCall),
      );
    }
    if (
      fromServerContent?.functionCall &&
      this.isGeminiFunctionCall(fromServerContent.functionCall)
    ) {
      calls.push(fromServerContent.functionCall);
    }

    const modelParts = message.serverContent?.modelTurn?.parts ?? [];
    for (const part of modelParts) {
      const maybeCall = part.functionCall;
      if (this.isGeminiFunctionCall(maybeCall)) {
        calls.push(maybeCall);
      }
    }

    return calls;
  }

  private chunkPcm(buffer: Buffer, chunkBytes: number): Buffer[] {
    if (buffer.length <= chunkBytes) return [buffer];

    const chunks: Buffer[] = [];
    for (let offset = 0; offset < buffer.length; offset += chunkBytes) {
      const end = Math.min(offset + chunkBytes, buffer.length);
      chunks.push(buffer.subarray(offset, end));
    }
    return chunks;
  }

  private isGeminiFunctionCall(value: unknown): value is GeminiFunctionCall {
    if (!value || typeof value !== "object") return false;
    const maybeCall = value as Record<string, unknown>;
    return typeof maybeCall.name === "string";
  }
}
