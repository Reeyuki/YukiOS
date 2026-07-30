import { DurableObject } from "cloudflare:workers";

export class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.host = null;
    this.client = null;
  }

  async fetch(request) {
    const url = new URL(request.url);
    const role = url.searchParams.get("role") || "";
    const roomParam = (url.searchParams.get("room") || "").slice(0, 6).toUpperCase();

    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("YukiOS Remote Desktop Signaling", { status: 200 });
    }

    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    server.accept();

    server.addEventListener("message", async (event) => {
      try {
        const msg = JSON.parse(event.data);
        await this.handleMessage(server, msg, roomParam);
      } catch (err) {
        server.send(JSON.stringify({ type: "error", message: "Invalid message" }));
      }
    });

    server.addEventListener("close", () => {
      this.handleClose(server);
    });

    server.addEventListener("error", () => {
      this.handleClose(server);
    });

    return new Response(null, { status: 101, webSocket: client });
  }

  async handleMessage(server, msg, roomParam) {
    switch (msg.type) {
      case "register-host":
        this.host = server;
        server.send(JSON.stringify({ type: "host-registered", room: roomParam }));
        break;

      case "join-as-client":
        if (!this.host) {
          server.send(JSON.stringify({ type: "error", message: "Host not ready" }));
          return;
        }
        this.client = server;
        this.host.send(JSON.stringify({ type: "client-joined" }));
        server.send(JSON.stringify({ type: "room-joined" }));
        break;

      case "offer":
        if (this.client) {
          this.client.send(JSON.stringify({ type: "offer", sdp: msg.sdp, codec: msg.codec }));
        }
        break;

      case "answer":
        if (this.host) {
          this.host.send(JSON.stringify({ type: "answer", sdp: msg.sdp }));
        }
        break;

      case "ice-candidate":
        const target = msg.from === "host" ? this.client : this.host;
        if (target) {
          target.send(JSON.stringify({ type: "ice-candidate", candidate: msg.candidate }));
        }
        break;

      case "input-event":
        if (this.host) {
          this.host.send(JSON.stringify({ type: "input-event", input: msg.input }));
        }
        break;
    }
  }

  handleClose(server) {
    if (this.host === server) {
      if (this.client) {
        this.client.send(JSON.stringify({ type: "host-disconnected" }));
      }
      this.host = null;
      this.client = null;
    } else if (this.client === server) {
      if (this.host) {
        this.host.send(JSON.stringify({ type: "client-disconnected" }));
      }
      this.client = null;
    }
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const roomCode = url.searchParams.get("room") || crypto.randomUUID();

    let roomId;
    if (url.searchParams.get("room")) {
      roomId = env.ROOMS.idFromName(url.searchParams.get("room"));
    } else {
      roomId = env.ROOMS.newUniqueId();
    }

    const stub = env.ROOMS.get(roomId);
    return stub.fetch(request);
  }
};
