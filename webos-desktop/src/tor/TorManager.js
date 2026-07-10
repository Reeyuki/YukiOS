import { resolveUrl } from "../shared/assetResolver.js";

export const DEFAULT_SNOWFLAKE_URL = "wss://snowflake.torproject.net/";

export class TorManager {
  static instance = null;
  static wasmInitialized = false;
  static mod = null;

  static getInstance() {
    if (!TorManager.instance) {
      TorManager.instance = new TorManager();
    }
    return TorManager.instance;
  }

  isRunning = false;
  torClient = null;
  module = null;
  statusCallback = null;
  bootstrapPhase = "idle";
  logs = [];
  eventListeners = [];
  torSnowflakeUrl = DEFAULT_SNOWFLAKE_URL;
  fetchCount = 0;
  reconnectAttempts = 0;
  activeClients = [];
  nextClientId = 1;

  constructor() {
    if (TorManager.instance) return TorManager.instance;
  }

  getLogs() {
    return this.logs;
  }

  onEvent(cb) {
    this.eventListeners.push(cb);
    return () => {
      this.eventListeners = this.eventListeners.filter((l) => l !== cb);
    };
  }

  emit(type, data) {
    this.eventListeners.forEach((cb) => {
      try {
        cb(type, data);
      } catch (e) {}
    });
  }

  onStatus(cb) {
    this.statusCallback = cb;
  }

  log(msg) {
    this.logs.push(msg);
    this.emit("log", msg);
    if (this.statusCallback) this.statusCallback(msg);
  }

  async ensureWasm() {
    if (TorManager.mod && TorManager.wasmInitialized) return;

    if (!TorManager.mod) {
      this.log("Loading WebTor WASM module...");
      this.bootstrapPhase = "loading-wasm";
      const wasmUrl = await resolveUrl("/wasm/webtor/webtor_wasm.js");
      TorManager.mod = await import(/* @vite-ignore */ wasmUrl);
    }
    const mod = TorManager.mod;
    this.module = mod;

    if (!TorManager.wasmInitialized) {
      this.log("Initializing WASM runtime...");
      this.bootstrapPhase = "init-wasm";

      await mod.default();
      await mod.init();
      TorManager.wasmInitialized = true;
    }

    if (mod.setLogCallback) {
      mod.setLogCallback((level, target, msg) => {
        if (level === "INFO" || level === "WARN" || level === "ERROR") {
          this.log(`[${level}] ${msg}`);
        }
      });
    }
  }

  async createTorClientWithOverride() {
    await this.ensureWasm();
    const mod = TorManager.mod;

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
      const url = (typeof input === "string" ? input : input?.url || "").toString();
      if (url.includes("igor53627.github.io/webtor-rs")) {
        const filename = url.split("/").pop();
        const localUrl = await resolveUrl("/wasm/webtor/" + filename);
        return originalFetch(localUrl, init);
      }
      return originalFetch(input, init);
    };

    try {
      const opts = new mod.TorClientOptions(this.torSnowflakeUrl);
      const client = await new mod.TorClient(opts);
      return client;
    } finally {
      globalThis.fetch = originalFetch;
    }
  }

  async start(options = {}) {
    if (this.isRunning) return;
    this.isRunning = true;
    this.bootstrapPhase = "loading";

    try {
      await this.ensureWasm();

      this.log("Creating Tor client with Snowflake WebSocket...");
      this.bootstrapPhase = "connecting";

      const client = await this.createTorClientWithOverride();
      this.torClient = client;

      this.log("Building Tor circuit (this may take 30-60s)...");
      this.bootstrapPhase = "building-circuit";

      await client.waitForCircuit();

      this.bootstrapPhase = "ready";
      this.log("Tor connection established! You can now browse anonymously.");
      this.emit("status", this.getStatus());
    } catch (e) {
      this.isRunning = false;
      this.bootstrapPhase = "error";
      this.log("Failed: " + (e.message || e));
      this.emit("status", this.getStatus());
      throw e;
    }
  }

  async createClient() {
    await this.ensureWasm();

    const client = await this.createTorClientWithOverride();
    await client.waitForCircuit();

    const id = this.nextClientId++;
    const wrapper = {
      id,
      client: client,
      fetchCount: 0,

      fetch: async (url) => {
        const resp = await client.fetch(url);
        wrapper.fetchCount++;
        return this.wrapResponse(resp);
      },

      post: async (url, body) => {
        const resp = await client.post(url, body);
        return this.wrapResponse(resp);
      },

      request: async (method, url, headers, body, timeoutMs) => {
        const resp = await client.request(method, url, headers || {}, body || null, timeoutMs || null);
        return this.wrapResponse(resp);
      },

      getFetchCount: () => wrapper.fetchCount,

      close: async () => {
        try {
          await client.close();
        } catch (e) {}
        this.activeClients = this.activeClients.filter((c) => c.id !== id);
      },

      waitForCircuit: async () => {
        await client.waitForCircuit();
      }
    };

    this.activeClients.push(wrapper);
    return wrapper;
  }

  async fetch(url) {
    if (!this.torClient) throw new Error("Tor not connected");
    try {
      const resp = await this.torClient.fetch(url);
      this.fetchCount++;
      return this.wrapResponse(resp);
    } catch (e) {
      this.log("Fetch failed: " + (e.message || e));
      this.emit("status", this.getStatus());
      throw e;
    }
  }

  async post(url, body) {
    if (!this.torClient) throw new Error("Tor not connected");
    const resp = await this.torClient.post(url, body);
    return this.wrapResponse(resp);
  }

  async request(method, url, headers, body, timeoutMs) {
    if (!this.torClient) throw new Error("Tor not connected");
    const resp = await this.torClient.request(method, url, headers || {}, body || null, timeoutMs || null);
    return this.wrapResponse(resp);
  }

  wrapResponse(resp) {
    const body = resp.body.slice();
    const textCache = new TextDecoder().decode(body);
    return {
      status: resp.status,
      headers: resp.headers,
      body,
      url: resp.url,
      text: () => textCache,
      json: () => JSON.parse(textCache)
    };
  }

  async waitForCircuit() {
    if (!this.torClient) throw new Error("Tor not connected");
    await this.torClient.waitForCircuit();
  }

  getStatus() {
    return {
      running: this.isRunning,
      phase: this.bootstrapPhase,
      ready: this.bootstrapPhase === "ready",
      snowflakeUrl: this.torSnowflakeUrl
    };
  }

  async stop() {
    if (!this.isRunning) return;
    this.isRunning = false;
    this.bootstrapPhase = "stopped";
    if (this.torClient) {
      try {
        await this.torClient.close();
      } catch (e) {}
      this.torClient = null;
    }
    for (const c of this.activeClients) {
      try {
        await c.close();
      } catch (e) {}
    }
    this.activeClients = [];
    this.log("Tor connection stopped");
    this.emit("status", this.getStatus());
  }

  get snowflakeUrl() {
    return this.torSnowflakeUrl;
  }
  set snowflakeUrl(url) {
    if (url && typeof url === "string" && (url.startsWith("ws://") || url.startsWith("wss://"))) {
      this.torSnowflakeUrl = url;
    }
  }

  getFetchCount() {
    return this.fetchCount;
  }

  async reconnect() {
    this.log("Reconnecting Tor...");
    this.bootstrapPhase = "reconnecting";
    this.emit("status", this.getStatus());

    if (this.torClient) {
      try {
        await this.torClient.close();
      } catch (e) {}
      this.torClient = null;
    }
    this.isRunning = false;
    this.fetchCount = 0;
    this.reconnectAttempts++;

    try {
      await this.ensureWasm();

      this.log("Creating fresh Tor client...");
      this.bootstrapPhase = "connecting";
      this.emit("status", this.getStatus());

      const client = await this.createTorClientWithOverride();
      this.torClient = client;
      this.isRunning = true;

      this.log("Building new Tor circuit...");
      this.bootstrapPhase = "building-circuit";
      this.emit("status", this.getStatus());

      await client.waitForCircuit();

      this.bootstrapPhase = "ready";
      this.log("Tor reconnected successfully.");
      this.emit("status", this.getStatus());
    } catch (e) {
      this.isRunning = false;
      this.torClient = null;
      this.bootstrapPhase = "error";
      this.log("Reconnect failed: " + (e.message || e));
      this.emit("status", this.getStatus());
      throw e;
    }
  }

  get running() {
    return this.isRunning;
  }
  get client() {
    return this.torClient;
  }
}
