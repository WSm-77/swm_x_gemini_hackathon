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

    const requestedRoomId = this.options.roomId.trim();
    const rooms = await this.fishjamClient.getAllRooms();
    const room = rooms.find((candidate) => candidate.id === requestedRoomId);

    let targetRoomId = room?.id;
    if (!targetRoomId && rooms.length > 0) {
      targetRoomId = rooms[0].id;
      console.warn(
        `FishJam room ${requestedRoomId} was not found or is not accessible; using accessible room ${targetRoomId}`,
      );
    }

    if (!targetRoomId) {
      const createdRoom = await this.fishjamClient.createRoom();
      targetRoomId = createdRoom.id;
      console.warn(
        `FishJam room ${requestedRoomId} was not found and no rooms were accessible; created room ${targetRoomId}`,
      );
    }

    const { agent } = await this.fishjamClient.createAgent(
      targetRoomId,
      agentOptions,
      callbacks,
    );

    this.agent = agent as FishjamAgent;

    this.agent.on("trackData", ({ data }) => {
      if (!data || data.byteLength === 0) return;
      this.emitter.emit("chunk", {
        chunk: Buffer.from(data),
      } satisfies AgentPcmChunkEvent);
    });

    console.debug(
      `FishJam agent connected to room ${targetRoomId} with 16kHz PCM output`,
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
