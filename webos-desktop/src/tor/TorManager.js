import { resolveUrl } from "../shared/assetResolver.js";

export const DEFAULT_SNOWFLAKE_URL = "wss://snowflake.torproject.net/";

export class TorManager {
  static _instance = null;
  static _wasmInitialized = false;
  static _mod = null;

  static getInstance() {
    if (!TorManager._instance) {
      TorManager._instance = new TorManager();
    }
    return TorManager._instance;
  }

  _running = false;
  _client = null;
  _module = null;
  _onStatus = null;
  _bootstrapPhase = "idle";
  _logs = [];
  _eventListeners = [];
  _snowflakeUrl = DEFAULT_SNOWFLAKE_URL;
  _fetchCount = 0;
  _reconnectAttempts = 0;
  _activeClients = [];
  _nextClientId = 1;

  constructor() {
    if (TorManager._instance) return TorManager._instance;
  }

  getLogs() {
    return this._logs;
  }

  onEvent(cb) {
    this._eventListeners.push(cb);
    return () => {
      this._eventListeners = this._eventListeners.filter((l) => l !== cb);
    };
  }

  _emit(type, data) {
    this._eventListeners.forEach((cb) => {
      try {
        cb(type, data);
      } catch (e) {}
    });
  }

  onStatus(cb) {
    this._onStatus = cb;
  }

  _log(msg) {
    this._logs.push(msg);
    this._emit("log", msg);
    if (this._onStatus) this._onStatus(msg);
  }

  async _ensureWasm() {
    if (TorManager._mod && TorManager._wasmInitialized) return;

    if (!TorManager._mod) {
      this._log("Loading WebTor WASM module...");
      this._bootstrapPhase = "loading-wasm";
      const wasmUrl = await resolveUrl("/wasm/webtor/webtor_wasm.js");
      TorManager._mod = await import(/* @vite-ignore */ wasmUrl);
    }
    const mod = TorManager._mod;
    this._module = mod;

    if (!TorManager._wasmInitialized) {
      this._log("Initializing WASM runtime...");
      this._bootstrapPhase = "init-wasm";

      await mod.default();
      await mod.init();
      TorManager._wasmInitialized = true;
    }

    if (mod.setLogCallback) {
      mod.setLogCallback((level, target, msg) => {
        if (level === "INFO" || level === "WARN" || level === "ERROR") {
          this._log(`[${level}] ${msg}`);
        }
      });
    }
  }

  async _createTorClientWithOverride() {
    await this._ensureWasm();
    const mod = TorManager._mod;

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
      const opts = new mod.TorClientOptions(this._snowflakeUrl);
      const client = await new mod.TorClient(opts);
      return client;
    } finally {
      globalThis.fetch = originalFetch;
    }
  }

  async start(options = {}) {
    if (this._running) return;
    this._running = true;
    this._bootstrapPhase = "loading";

    try {
      await this._ensureWasm();

      this._log("Creating Tor client with Snowflake WebSocket...");
      this._bootstrapPhase = "connecting";

      const client = await this._createTorClientWithOverride();
      this._client = client;

      this._log("Building Tor circuit (this may take 30-60s)...");
      this._bootstrapPhase = "building-circuit";

      await client.waitForCircuit();

      this._bootstrapPhase = "ready";
      this._log("Tor connection established! You can now browse anonymously.");
      this._emit("status", this.getStatus());
    } catch (e) {
      this._running = false;
      this._bootstrapPhase = "error";
      this._log("Failed: " + (e.message || e));
      this._emit("status", this.getStatus());
      throw e;
    }
  }

  async createClient() {
    await this._ensureWasm();

    const client = await this._createTorClientWithOverride();
    await client.waitForCircuit();

    const id = this._nextClientId++;
    const wrapper = {
      id,
      _client: client,
      _fetchCount: 0,

      fetch: async (url) => {
        const resp = await client.fetch(url);
        wrapper._fetchCount++;
        return this._wrapResponse(resp);
      },

      post: async (url, body) => {
        const resp = await client.post(url, body);
        return this._wrapResponse(resp);
      },

      request: async (method, url, headers, body, timeoutMs) => {
        const resp = await client.request(method, url, headers || {}, body || null, timeoutMs || null);
        return this._wrapResponse(resp);
      },

      getFetchCount: () => wrapper._fetchCount,

      close: async () => {
        try {
          await client.close();
        } catch (e) {}
        this._activeClients = this._activeClients.filter((c) => c.id !== id);
      },

      waitForCircuit: async () => {
        await client.waitForCircuit();
      }
    };

    this._activeClients.push(wrapper);
    return wrapper;
  }

  async fetch(url) {
    if (!this._client) throw new Error("Tor not connected");
    try {
      const resp = await this._client.fetch(url);
      this._fetchCount++;
      return this._wrapResponse(resp);
    } catch (e) {
      this._log("Fetch failed: " + (e.message || e));
      this._emit("status", this.getStatus());
      throw e;
    }
  }

  async post(url, body) {
    if (!this._client) throw new Error("Tor not connected");
    const resp = await this._client.post(url, body);
    return this._wrapResponse(resp);
  }

  async request(method, url, headers, body, timeoutMs) {
    if (!this._client) throw new Error("Tor not connected");
    const resp = await this._client.request(method, url, headers || {}, body || null, timeoutMs || null);
    return this._wrapResponse(resp);
  }

  _wrapResponse(resp) {
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
    if (!this._client) throw new Error("Tor not connected");
    await this._client.waitForCircuit();
  }

  getStatus() {
    return {
      running: this._running,
      phase: this._bootstrapPhase,
      ready: this._bootstrapPhase === "ready",
      snowflakeUrl: this._snowflakeUrl
    };
  }

  async stop() {
    if (!this._running) return;
    this._running = false;
    this._bootstrapPhase = "stopped";
    if (this._client) {
      try {
        await this._client.close();
      } catch (e) {}
      this._client = null;
    }
    for (const c of this._activeClients) {
      try {
        await c.close();
      } catch (e) {}
    }
    this._activeClients = [];
    this._log("Tor connection stopped");
    this._emit("status", this.getStatus());
  }

  get snowflakeUrl() {
    return this._snowflakeUrl;
  }
  set snowflakeUrl(url) {
    if (url && typeof url === "string" && (url.startsWith("ws://") || url.startsWith("wss://"))) {
      this._snowflakeUrl = url;
    }
  }

  getFetchCount() {
    return this._fetchCount;
  }

  async reconnect() {
    this._log("Reconnecting Tor...");
    this._bootstrapPhase = "reconnecting";
    this._emit("status", this.getStatus());

    if (this._client) {
      try {
        await this._client.close();
      } catch (e) {}
      this._client = null;
    }
    this._running = false;
    this._fetchCount = 0;
    this._reconnectAttempts++;

    try {
      await this._ensureWasm();

      this._log("Creating fresh Tor client...");
      this._bootstrapPhase = "connecting";
      this._emit("status", this.getStatus());

      const client = await this._createTorClientWithOverride();
      this._client = client;
      this._running = true;

      this._log("Building new Tor circuit...");
      this._bootstrapPhase = "building-circuit";
      this._emit("status", this.getStatus());

      await client.waitForCircuit();

      this._bootstrapPhase = "ready";
      this._log("Tor reconnected successfully.");
      this._emit("status", this.getStatus());
    } catch (e) {
      this._running = false;
      this._client = null;
      this._bootstrapPhase = "error";
      this._log("Reconnect failed: " + (e.message || e));
      this._emit("status", this.getStatus());
      throw e;
    }
  }

  get running() {
    return this._running;
  }
  get client() {
    return this._client;
  }
}
