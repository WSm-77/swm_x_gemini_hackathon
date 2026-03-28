import WebSocket from "ws";

const HEARTBEAT_INTERVAL_MS = 30_000;

type PhoenixMessage = [
  joinRef: string | null,
  ref: string,
  topic: string,
  event: string,
  payload: Record<string, unknown>,
];

type PhoenixChannelClientOptions = {
  wsUrl: string;
  topic: string;
};

export class PhoenixChannelClient {
  private ws?: WebSocket;
  private refCounter = 0;
  private joinRef: string | null = null;
  private heartbeatTimer?: NodeJS.Timeout;

  public constructor(private readonly options: PhoenixChannelClientOptions) {}

  public async connect(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(this.options.wsUrl);
      this.ws = ws;

      ws.on("open", () => {
        this.joinRef = this.nextRef();
        this.send(
          this.buildMessage(this.options.topic, "phx_join", {}, this.joinRef),
        );
        this.startHeartbeat();
        resolve();
      });

      ws.on("error", (error: Error) => {
        reject(error);
      });

      ws.on("close", () => {
        this.stopHeartbeat();
      });
    });
  }

  public broadcast(event: string, payload: Record<string, unknown>): void {
    this.send(this.buildMessage(this.options.topic, event, payload, null));
  }

  public close(): void {
    this.stopHeartbeat();
    this.ws?.close(1000, "Scribe shutdown");
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.send(this.buildMessage("phoenix", "heartbeat", {}, null));
    }, HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat(): void {
    if (!this.heartbeatTimer) return;
    clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = undefined;
  }

  private buildMessage(
    topic: string,
    event: string,
    payload: Record<string, unknown>,
    joinRef: string | null,
  ): PhoenixMessage {
    return [joinRef, this.nextRef(), topic, event, payload];
  }

  private send(message: PhoenixMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(message));
  }

  private nextRef(): string {
    this.refCounter += 1;
    return `${this.refCounter}`;
  }
}
