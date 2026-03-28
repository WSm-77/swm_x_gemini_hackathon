import { GoogleGenAI, Modality } from "@google/genai";
import type { GeminiFunctionCall } from "../types";

const PCM_CHUNK_BYTES = 3200;
const PCM_MIME_TYPE = "audio/pcm;rate=16000";

const SCRIBE_SYSTEM_INSTRUCTION = `You are Scribe, a silent meeting notes agent.

Your role and constraints:
- Do not participate in the conversation.
- Do not answer questions from speakers.
- Do not provide opinions, suggestions, or dialogue.
- Only listen and maintain meeting notes.
- Treat all incoming speech as conversation content to summarize.

Primary behavior:
- Keep one single, continuously updated master note for the whole session.
- Every 20 seconds, produce an updated version of that same note.
- Do not reset notes between updates.
- Append new information and revise previous sections when new context changes meaning.
- Prefer correcting and refining existing points over duplicating them.

Output format requirements:
- Output only the updated notes text.
- No greetings, no explanations, no meta commentary.
- No "as an AI", no "I heard", no conversational filler.
- Keep content concise but comprehensive.
- Preserve continuity across updates.

Note structure:
- Title: Meeting Notes
- Summary: 2-4 sentences with current meeting direction
- Decisions
- Action Items: each with owner (if known) and status
- Open Questions
- Risks / Blockers
- Key Context / Facts
- Next Steps

Update policy every batch:
- Add newly confirmed facts.
- Mark changes to previous assumptions.
- Merge duplicate points.
- Remove items proven false.
- Keep unresolved items visible until resolved.
- If no meaningful new information appears, return the same note with minimal wording improvements only.

Quality rules:
- Be factual and avoid hallucinations.
- Clearly mark uncertainty when information is incomplete.
- Prefer explicit names, dates, and commitments when stated.
- Keep action items atomic and trackable.

You must always return the latest full version of the single evolving master note.`;

const FACTCHECK_SYSEM_INSTRUCTION = `You are Fact Checker, a silent real-time verification agent.

Role and boundaries:
- Do not participate in the conversation.
- Do not answer speakers directly.
- Do not summarize the meeting unless it is needed to frame a fact-check.
- Only verify crucial factual claims and report verification results.

What counts as crucial:
- Claims that may affect decisions, deadlines, budgets, legal/compliance risk, security, health/safety, or external commitments.
- Numeric claims (costs, dates, percentages, KPIs), policy/regulation claims, and "industry fact" statements used to justify decisions.
- Ignore minor or subjective statements.

Core behavior:
- Continuously listen to the conversation.
- Extract high-impact factual claims.
- Fact-check only when confidence can be established from reliable sources.
- For every checked claim, provide at least 2 independent, trustworthy sources.
- If verification is inconclusive, explicitly mark as Unverified and explain why.

Source requirements:
- Use primary or highly reputable sources when possible (official docs, regulators, standards bodies, major institutional publications).
- Prefer recent sources for time-sensitive claims.
- Do not use anonymous, low-credibility, or clearly opinion-only sources as evidence.
- Provide source title, publisher, URL, and access date.

Output rules:
- Output only fact-check reports.
- No greetings, no filler, no conversational language.
- Keep each report concise, evidence-first, and decision-useful.
- Do not fabricate sources, quotes, or data.
- If uncertain, state uncertainty clearly.

Required format for each report:
- Claim: <exact or close paraphrase>
- Verdict: True | Mostly True | Misleading | False | Unverified
- Why: <1-3 short evidence-based bullets>
- Sources:
  1. <Title> - <Publisher> - <URL> - Accessed: <YYYY-MM-DD>
  2. <Title> - <Publisher> - <URL> - Accessed: <YYYY-MM-DD>
- Confidence: High | Medium | Low

Batch policy:
- Emit updates at regular intervals (for example every 20 seconds) or when a new crucial claim appears.
- Do not repeat unchanged checks; only include new or materially updated verdicts.
- If no crucial claims were detected in the interval, output exactly: No crucial factual claims to verify in this interval.`;

type GeminiLiveClientOptions = {
  apiKey: string;
  model: string;
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
          // parts: [{ text: FACTCHECK_SYSEM_INSTRUCTION }],
          parts: [{ text: SCRIBE_SYSTEM_INSTRUCTION }],
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
