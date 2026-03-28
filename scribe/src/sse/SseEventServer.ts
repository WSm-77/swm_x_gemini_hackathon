import http from "node:http";

type Callback = (data: Record<string, unknown>) => void;

export class SseEventServer {
  private server?: http.Server;
  private clients: Set<http.ServerResponse> = new Set();
  private readonly port: number;

  constructor(port: number = 3001) {
    this.port = port;
  }

  public start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = http.createServer((req, res) => {
        // CORS headers
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");

        if (req.method === "OPTIONS") {
          res.writeHead(200);
          res.end();
          return;
        }

        if (req.url === "/events" && req.method === "GET") {
          res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          });

          // Send initial comment to let client know connection is open
          res.write(": connected\n\n");

          this.clients.add(res);
          console.debug(`[SSE] Client connected. Total clients: ${this.clients.size}`);

          res.on("close", () => {
            this.clients.delete(res);
            console.debug(`[SSE] Client disconnected. Total clients: ${this.clients.size}`);
          });

          res.on("error", (error) => {
            console.error("[SSE] Client error", error);
            this.clients.delete(res);
          });
        } else {
          res.writeHead(404);
          res.end("Not Found");
        }
      });

      this.server.listen(this.port, () => {
        console.debug(`[SSE] Event server listening on port ${this.port}`);
        resolve();
      });

      this.server.on("error", (error) => {
        console.error("[SSE] Server error", error);
      });
    });
  }

  public broadcast(event: string, data: Record<string, unknown>): void {
    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

    for (const client of this.clients) {
      try {
        client.write(message);
      } catch (error) {
        console.error("[SSE] Error sending message to client", error);
        this.clients.delete(client);
      }
    }
  }

  public close(): void {
    console.debug("[SSE] Closing event server");
    
    for (const client of this.clients) {
      client.end();
    }
    this.clients.clear();

    if (this.server) {
      this.server.close();
    }
  }

  public getClientCount(): number {
    return this.clients.size;
  }
}
