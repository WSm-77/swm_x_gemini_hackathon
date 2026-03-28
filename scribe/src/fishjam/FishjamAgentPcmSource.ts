import { EventEmitter, on } from "node:events";

import {
  type AgentCallbacks,
  FishjamClient,
  type PeerOptions,
} from "@fishjam-cloud/js-server-sdk";

type AgentPcmChunkEvent = {
  chunk: Buffer;
};

type FishjamAgentPcmSourceOptions = {
  fishjamId: string;
  managementToken: string;
  roomId: string;
  subscribeMode: "auto" | "manual";
};

type TrackDataPayload = {
  data: Uint8Array;
};

type FishjamAgent = {
  on: (
    event: "trackData",
    callback: (payload: TrackDataPayload) => void,
  ) => void;
  disconnect: () => Promise<void> | void;
};

export class FishjamAgentPcmSource {
  private readonly emitter = new EventEmitter();
  private readonly fishjamClient: FishjamClient;
  private agent?: FishjamAgent;

  public constructor(private readonly options: FishjamAgentPcmSourceOptions) {
    this.fishjamClient = new FishjamClient({
      fishjamId: this.options.fishjamId,
      managementToken: this.options.managementToken,
    });
  }

  public async start(): Promise<void> {
    const agentOptions = {
      subscribeMode: this.options.subscribeMode,
      output: {
        audioFormat: "pcm16",
        audioSampleRate: 16000,
      },
    } satisfies PeerOptions;

    const callbacks = {
      onError: (error) => {
        console.error("FishJam agent error", error);
      },
      onClose: (code, reason) => {
        console.warn(`FishJam agent closed (${code}) ${reason}`);
      },
    } satisfies AgentCallbacks;

    console.log("Connecting to FishJam...");

    const rooms = await this.fishjamClient.getAllRooms();
    const room = rooms[0];

    const { agent } = await this.fishjamClient.createAgent(
      room.id,
      agentOptions,
      callbacks,
    );

    console.log("Connected to FishJam, waiting for audio data...");

    this.agent = agent as FishjamAgent;

    this.agent.on("trackData", ({ data }) => {
      if (!data || data.byteLength === 0) return;
      this.emitter.emit("chunk", {
        chunk: Buffer.from(data),
      } satisfies AgentPcmChunkEvent);
    });

    console.debug(
      `FishJam agent connected to room ${this.options.roomId} with 16kHz PCM output`,
    );
  }

  public async *createPcmStream(): AsyncGenerator<Buffer> {
    for await (const [event] of on(this.emitter, "chunk")) {
      const payload = event as AgentPcmChunkEvent;
      yield payload.chunk;
    }
  }

  public async stop(): Promise<void> {
    await this.agent?.disconnect();
  }
}
