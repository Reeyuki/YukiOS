import { fetchThroughWisp } from "../../shared/wispTransport.js";

export class AICore {
  static REMOTE_DEFAULT_ENDPOINT = "https://gpt.crax.lol";
  static REMOTE_DEFAULT_MODEL = "gpt-5-6-sol";

  constructor() {
    this.engine = null;
    this.model = null;
    this.selectedModel = "fast";
    this.webGPUEnabled = true;
    this.isInitialized = false;
    this.isLoading = false;
    this.initCallback = null;
    this.webLLMLoaded = false;
    this.webLLMModule = null;
    this.initPromise = null;
    this.remoteEndpoint = null;
    this.remoteApiKey = null;
    this.remoteModel = null;
    this.autoAppendV1 = true;
    this.forceProxy = false;
  }

  static MODEL_PROFILES = {
    low: ["Llama-3.2-1B-Instruct-q4f32_1-MLC", "Qwen2.5-0.5B-Instruct-q4f32_1-MLC"],
    fast: ["Llama-3.2-1B-Instruct-q4f32_1-MLC", "Qwen2.5-0.5B-Instruct-q4f32_1-MLC"],
    smart: ["Llama-3.1-8B-Instruct-q4f32_1-MLC", "Llama-3-8B-Instruct-q4f32_1-MLC"]
  };

  async loadWebLLM() {
    if (this.webLLMLoaded) return true;
    if (typeof window !== "undefined" && window.CreateMLCEngine) {
      this.webLLMLoaded = true;
      return true;
    }

    try {
      const webLLMModule = await import("https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.46/lib/index.js");
      if (webLLMModule && webLLMModule.CreateMLCEngine) {
        window.CreateMLCEngine = webLLMModule.CreateMLCEngine;
        this.webLLMModule = webLLMModule;
        this.webLLMLoaded = true;
        return true;
      }
      return false;
    } catch (error) {
      console.error("[AI Core] Failed to load WebLLM:", error);
      return false;
    }
  }

  getAvailableModelIds() {
    const modelList = this.webLLMModule?.prebuiltAppConfig?.model_list;
    if (!Array.isArray(modelList)) {
      return [];
    }
    return modelList.map((entry) => entry.model_id).filter(Boolean);
  }

  resolveModelCandidates(modelType) {
    const preferredModels = AICore.MODEL_PROFILES[modelType] || AICore.MODEL_PROFILES.fast;
    const availableModelIds = this.getAvailableModelIds();

    if (availableModelIds.length === 0) {
      return preferredModels;
    }

    const directMatches = preferredModels.filter((modelId) => availableModelIds.includes(modelId));
    if (directMatches.length > 0) {
      return directMatches;
    }

    if (modelType === "smart") {
      return availableModelIds
        .filter((modelId) => /(?:Llama|Qwen|Phi).*(?:7B|8B).*(?:Instruct).*q4f32_1-MLC/.test(modelId))
        .slice(0, 3);
    }

    return availableModelIds
      .filter((modelId) =>
        /(?:Llama|Qwen|Phi|Gemma).*(?:0\.5B|1B|1\.5B|2B|3B).*(?:Instruct).*q4f32_1-MLC/.test(modelId)
      )
      .slice(0, 4);
  }

  async initialize(modelType = "fast", webGPU = true, progressCallback = null, options = {}) {
    const force = Boolean(options.force);
    if (this.isLoading) return this.initPromise;
    if (this.isInitialized && !force) return true;

    this.initPromise = (async () => {
      if (force) {
        this.dispose();
      }

      this.selectedModel = modelType;
      this.webGPUEnabled = webGPU;
      this.isLoading = true;
      this.initCallback = progressCallback;

      const loaded = await this.loadWebLLM();
      if (!loaded) {
        this.isLoading = false;
        this.isInitialized = false;
        if (this.initCallback) {
          this.initCallback({ error: "WebLLM library failed to load" });
        }
        return false;
      }

      const originalConsoleError = console.error;
      console.error = (...args) => {
        if (typeof args[0] === "string" && args[0].includes("WebGPU error was not captured")) {
          return;
        }
        originalConsoleError.apply(console, args);
      };

      try {
        const modelCandidates = this.resolveModelCandidates(modelType);
        if (modelCandidates.length === 0) {
          throw new Error(`No compatible built-in WebLLM models found for profile "${modelType}"`);
        }

        const engineConfig = {
          useWebWorker: true,
          initProgressCallback: (report) => {
            if (this.initCallback) {
              this.initCallback(report);
            }
          }
        };

        let selectedModelId = null;
        let lastError = null;
        for (const modelId of modelCandidates) {
          try {
            this.engine = await window.CreateMLCEngine(modelId, engineConfig);
            selectedModelId = modelId;
            break;
          } catch (error) {
            lastError = error;
          }
        }

        if (!this.engine || !selectedModelId) {
          throw lastError || new Error("No compatible model was initialized");
        }

        this.model = selectedModelId;
        this.isInitialized = true;
        this.isLoading = false;
        console.error = originalConsoleError;
        return true;
      } catch (error) {
        console.error("[AI Core] Initialization failed:", error);
        this.isLoading = false;
        this.isInitialized = false;
        console.error = originalConsoleError;

        if (this.initCallback) {
          this.initCallback({ error: error.message });
        }

        return false;
      }
    })();

    return this.initPromise;
  }

  async generate(prompt, systemPrompt, chatHistory = []) {
    if (!this.isInitialized) {
      throw new Error("Local model is not initialized");
    }

    try {
      const messages = [
        { role: "system", content: systemPrompt },
        ...chatHistory.slice(-10),
        { role: "user", content: prompt }
      ];

      const reply = await this.engine.chat.completions.create({
        messages,
        temperature: 0.7,
        max_tokens: 1024
      });

      const content = reply.choices[0].message.content;
      return this.parseResponse(content);
    } catch (error) {
      console.error("[AI Core] Generation failed:", error);
      throw error;
    }
  }

  parseResponse(content) {
    const actions = [];
    let reasoning = null;
    let text = content;

    const jsonMatch = content.match(/```json\n?([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        if (Array.isArray(parsed)) {
          actions.push(...parsed);
        }
        text = content.replace(jsonMatch[0], "").trim();
      } catch (error) {
        console.warn("[AI Core] Failed to parse JSON actions:", error);
      }
    }

    const reasoningMatch = content.match(/<reasoning>\n?([\s\S]*?)<\/reasoning>/);
    if (reasoningMatch) {
      reasoning = reasoningMatch[1].trim();
      text = text.replace(reasoningMatch[0], "").trim();
    }

    return { text, actions, reasoning, rawContent: content };
  }

  setWebGPUEnabled(enabled) {
    this.webGPUEnabled = enabled;
    if (this.isInitialized) {
      return this.initialize(this.selectedModel, enabled, this.initCallback, { force: true });
    }
    return Promise.resolve(true);
  }

  setModel(modelType) {
    this.selectedModel = modelType;
    if (this.isInitialized) {
      return this.initialize(modelType, this.webGPUEnabled, this.initCallback, { force: true });
    }
    return Promise.resolve(true);
  }

  setRemoteConfig(config = {}) {
    this.remoteEndpoint = config.endpoint || AICore.REMOTE_DEFAULT_ENDPOINT;
    this.remoteApiKey = config.apiKey || null;
    this.remoteModel = config.model || AICore.REMOTE_DEFAULT_MODEL;
    this.autoAppendV1 = config.autoAppendV1 !== false;
    this.forceProxy = Boolean(config.forceProxy);
  }

  buildEndpointUrl(base, autoAppendV1) {
    let url = String(base || "")
      .trim()
      .replace(/\/+$/, "");
    if (autoAppendV1 && !url.endsWith("/v1")) {
      url += "/v1";
    }
    return url;
  }

  async fetchWithProxy(url, options = {}) {
    if (this.forceProxy) {
      return fetchThroughWisp(url, options);
    }
    try {
      return await fetch(url, options);
    } catch (directError) {
      try {
        return await fetchThroughWisp(url, options);
      } catch (wispError) {
        console.error("[AI Core] Wisp request failed:", wispError);
        throw directError;
      }
    }
  }

  async listRemoteModels(config) {
    const endpoint = this.buildEndpointUrl(
      config?.endpoint || this.remoteEndpoint,
      config?.autoAppendV1 ?? this.autoAppendV1
    );
    if (!endpoint) throw new Error("Remote endpoint not configured");
    const headers = { "Content-Type": "application/json" };
    if (this.remoteApiKey) {
      headers.Authorization = `Bearer ${this.remoteApiKey}`;
    }
    const res = await this.fetchWithProxy(`${endpoint}/models`, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status} listing models`);
    const data = await res.json();
    return (data.data || []).map((m) => m.id).filter(Boolean);
  }

  async generateRemote(prompt, systemPrompt, chatHistory = [], config) {
    const endpoint = this.buildEndpointUrl(
      config?.endpoint || this.remoteEndpoint,
      config?.autoAppendV1 ?? this.autoAppendV1
    );
    const model = config?.model || this.remoteModel;
    if (!endpoint || !model) throw new Error("Remote endpoint or model is not configured");
    const messages = [
      { role: "system", content: systemPrompt },
      ...chatHistory.slice(-10),
      { role: "user", content: prompt }
    ];
    const headers = { "Content-Type": "application/json" };
    if (this.remoteApiKey) {
      headers.Authorization = `Bearer ${this.remoteApiKey}`;
    }
    try {
      const res = await this.fetchWithProxy(`${endpoint}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify({ model, messages, temperature: 0.7, max_tokens: 1024, stream: false })
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
      }
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error("Empty response from remote backend");
      return this.parseResponse(content);
    } catch (error) {
      console.error("[AI Core] Remote generation failed:", error);
      throw error;
    }
  }

  dispose() {
    this.engine = null;
    this.model = null;
    this.isInitialized = false;
    this.isLoading = false;
    this.initPromise = null;
  }
}
