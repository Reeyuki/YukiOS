export class AICore {
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
    this._initPromise = null;
  }

  static MODEL_PROFILES = {
    low: ["Llama-3.2-1B-Instruct-q4f32_1-MLC", "Qwen2.5-0.5B-Instruct-q4f32_1-MLC"],
    fast: ["Llama-3.2-1B-Instruct-q4f32_1-MLC", "Qwen2.5-0.5B-Instruct-q4f32_1-MLC"],
    smart: ["Llama-3.1-8B-Instruct-q4f32_1-MLC", "Llama-3-8B-Instruct-q4f32_1-MLC"]
  };

  async _loadWebLLM() {
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

  _getAvailableModelIds() {
    const modelList = this.webLLMModule?.prebuiltAppConfig?.model_list;
    if (!Array.isArray(modelList)) {
      return [];
    }
    return modelList.map((entry) => entry.model_id).filter(Boolean);
  }

  _resolveModelCandidates(modelType) {
    const preferredModels = AICore.MODEL_PROFILES[modelType] || AICore.MODEL_PROFILES.fast;
    const availableModelIds = this._getAvailableModelIds();

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
    if (this.isLoading) return this._initPromise;
    if (this.isInitialized && !force) return true;

    this._initPromise = (async () => {
      if (force) {
        this.dispose();
      }

      this.selectedModel = modelType;
      this.webGPUEnabled = webGPU;
      this.isLoading = true;
      this.initCallback = progressCallback;

      const loaded = await this._loadWebLLM();
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
        const modelCandidates = this._resolveModelCandidates(modelType);
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

    return this._initPromise;
  }

  async generate(prompt, systemPrompt, chatHistory = []) {
    if (!this.isInitialized) {
      return this._fallbackResponse(prompt);
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
      return this._parseResponse(content);
    } catch (error) {
      console.error("[AI Core] Generation failed:", error);
      return this._fallbackResponse(prompt);
    }
  }

  _parseResponse(content) {
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

  _fallbackResponse(prompt) {
    const lowerPrompt = prompt.toLowerCase();
    const actions = [];

    if (lowerPrompt.includes("open") && lowerPrompt.includes("setting")) {
      actions.push({ action: "open_app", target: "settingsApp" });
    } else if (lowerPrompt.includes("open") && lowerPrompt.includes("terminal")) {
      actions.push({ action: "open_app", target: "terminal" });
    } else if (lowerPrompt.includes("list") && lowerPrompt.includes("file")) {
      actions.push({ action: "fs_read", target: "/home/reeyuki/Documents" });
    }

    return {
      text: "I'm currently running in fallback mode without WebLLM. I can still help with basic actions, but for full AI capabilities, please ensure WebGPU is available.",
      actions,
      reasoning: "WebLLM not initialized, using pattern matching",
      rawContent: ""
    };
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

  dispose() {
    this.engine = null;
    this.model = null;
    this.isInitialized = false;
    this.isLoading = false;
    this._initPromise = null;
  }
}
