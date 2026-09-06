import { AICore } from "./aiAssistant/aiCore.js";
import { ActionParser } from "./aiAssistant/actionParser.js";
import { OSBridge } from "./aiAssistant/osBridge.js";
import { AIMemory } from "./aiAssistant/memory.js";
import { $, $$, createElement, setText, setHTML, toggleClass, setStyle } from "../shared/domUtils.js";
import { escapeHtml } from "../utils/utils.js";
import "./aiAssistant/aiAssistant.css";
import { renderSelectMenu, bindSelectMenu, getSelectMenuValue, setSelectMenuValue } from "../shared/selectMenu.js";
import { BaseApp, StorageKeys, os, MODES } from "../framework.js";
import { buildWindowHeader } from "../shared/windowHeader.js";

export class AIAssistantApp extends BaseApp {
  singletonWindowIds = ["ai-assistant-window"];

  constructor(services) {
    super(services);
    this.aiCore = new AICore();
    this.actionParser = new ActionParser();
    this.osBridge = new OSBridge(services);
    this.memory = new AIMemory();
    this.windows = new Map();
    this.systemHandlersBound = false;
    this.windowFocusedHandler = null;
    this.windowClosedHandler = null;
    this.settingsChangedHandler = null;
    this.winId = "ai-assistant-window";
    this.enabled = os.storage.get(StorageKeys.aiAssistantEnabled) !== "false";
  }

  async open(opts = {}) {
    const winId = this.winId;

    if (this.enabled && !os.modes.isActive(MODES.MAC)) {
      await this.registerTray(this.winId, "fas fa-robot", "Yuki AI", {
        resident: true,
        showInTray: true
      });
    }

    const win = os.window.create(winId, "Yuki AI Assistant", "800px", "600px", {
      icon: "fas fa-robot"
    });
    this.windows.set(winId, win);

    const state = {
      selectedModel: "fast",
      webGPUEnabled: true,
      showReasoning: false,
      chatHistory: [],
      chats: {},
      activeChatId: null,
      engineInitialized: false,
      engineLoading: false,
      isGenerating: false,
      statusTone: "offline",
      statusText: "Offline",
      statusDetail: "Fire up a model to get started.",
      progress: 0,
      progressText: "",
      currentModelId: null,
      pendingMessageId: null,
      backendType: "local",
      remoteEndpoint: "",
      remoteApiKey: "",
      remoteModel: "",
      autoAppendV1: true,
      savedBackends: [],
      remoteModels: []
    };

    win.innerHTML = this.buildSetupUI(state);

    this.setupSetupEventListeners(win, state);
    this.subscribeToSystemEvents();

    win.dataset.appId = "aiAssistant";
  }

  buildSetupUI(state) {
    const initialEndpoint =
      state.backendType === "craxgpt" ? AICore.REMOTE_DEFAULT_ENDPOINT : state.remoteEndpoint || "";
    const initialPreview = `${this.aiCore.buildEndpointUrl(initialEndpoint, state.autoAppendV1)}/chat/completions`;

    return `
      ${buildWindowHeader("Yuki AI Assistant", "fas fa-robot")}
      <div class="ai-assistant-container">
        <div class="ai-setup-screen">
          <div class="ai-setup-content">
            <div class="ai-setup-icon">
              <i class="fas fa-robot"></i>
            </div>
            <h2>Yuki AI Assistant</h2>
            <p class="ai-setup-description">
              Choose a backend: run locally with WebGPU, use CraxGPT cloud, or connect your own OpenAI-compatible endpoint.
            </p>

            <div class="ai-backend-select">
              <h3><i class="fas fa-server"></i> Choose a Backend</h3>
              <div class="ai-backend-cards">
                <button type="button" class="ai-backend-card ${state.backendType === "local" ? "active" : ""}" data-backend="local">
                  <span class="ai-backend-icon"><i class="fas fa-microchip"></i></span>
                  <span class="ai-backend-title">Local (WebGPU)</span>
                  <small>Runs in your browser with WebGPU</small>
                </button>
                <button type="button" class="ai-backend-card ${state.backendType === "craxgpt" ? "active" : ""}" data-backend="craxgpt">
                  <span class="ai-backend-icon"><i class="fas fa-robot"></i></span>
                  <span class="ai-backend-title">CraxGPT</span>
                  <small>Cloud backend at gpt.crax.lol</small>
                </button>
                <button type="button" class="ai-backend-card ${state.backendType === "custom" ? "active" : ""}" data-backend="custom">
                  <span class="ai-backend-icon"><i class="fas fa-plug"></i></span>
                  <span class="ai-backend-title">Custom Endpoint</span>
                  <small>Connect your own OpenAI-compatible API</small>
                </button>
              </div>
            </div>

            <div id="ai-local-options" class="ai-setup-options" style="${state.backendType === "local" ? "" : "display:none"}">
              <button type="button" class="ai-setup-option ${state.selectedModel === "fast" ? "active" : ""}" data-model="fast">
                <span class="ai-option-title">Low Quality 1B-1.5B (~600MB-1.2GB)</span>
                <small>Recommended for fast startup and lower memory use</small>
              </button>
              <button type="button" class="ai-setup-option ${state.selectedModel === "smart" ? "active" : ""}" data-model="smart">
                <span class="ai-option-title">High Quality 8B (~4GB)</span>
                <small>Better reasoning quality with higher resource usage</small>
              </button>
            </div>

            <div id="ai-remote-options" class="ai-remote-options" style="${state.backendType === "local" ? "display:none" : ""}">
              <div id="ai-endpoint-field" class="ai-remote-field" style="${state.backendType === "craxgpt" ? "display:none" : ""}">
                <label for="ai-endpoint-input">Endpoint URL</label>
                <input type="text" id="ai-endpoint-input" value="${initialEndpoint}" placeholder="https://your-openai-endpoint.com" />
              </div>
              <div id="ai-apikey-field" class="ai-remote-field" style="${state.backendType === "craxgpt" ? "display:none" : ""}">
                <label for="ai-apikey-input">API Key (optional)</label>
                <input type="password" id="ai-apikey-input" value="${state.remoteApiKey || ""}" placeholder="sk-..." />
              </div>
              <div class="ai-remote-field">
                <label for="ai-remote-model-select">Model</label>
                <div id="ai-remote-model-select-wrap">
                  ${renderSelectMenu(
                    "ai-remote-model-select",
                    this.buildRemoteModelOptions(state),
                    state.remoteModel || AICore.REMOTE_DEFAULT_MODEL,
                    "ai-remote-model-select"
                  )}
                </div>
                <button id="ai-fetch-models-btn" class="ai-fetch-models-btn">
                  <i class="fas fa-list"></i> Fetch Models
                </button>
              </div>
              <div id="ai-custom-name-field" class="ai-remote-field" style="${state.backendType === "custom" ? "" : "display:none"}">
                <label for="ai-backend-name-input">Backend name</label>
                <input type="text" id="ai-backend-name-input" placeholder="My Backend" />
              </div>
              <label class="ai-remote-check">
                <input type="checkbox" id="ai-append-v1" ${state.autoAppendV1 ? "checked" : ""} />
                <span>Append /v1 to endpoint</span>
              </label>
              <div id="ai-url-preview-wrap" class="ai-url-preview" style="${state.backendType === "craxgpt" ? "display:none" : ""}">Preview: <span id="ai-url-preview">${initialPreview}</span></div>
              <div id="ai-saved-backends" class="ai-saved-backends"></div>
            </div>

            <div class="ai-setup-actions">
              <button id="ai-init-btn" class="ai-init-btn">
                <i class="fas fa-play"></i> Initialize AI Engine
              </button>
              <div id="ai-init-status" class="ai-init-status"></div>
              <div id="ai-init-progress" class="ai-init-progress">
                <div class="ai-progress-bar">
                  <div class="ai-progress-fill"></div>
                </div>
                <div class="ai-progress-text"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  buildUI(state) {
    return `
      ${buildWindowHeader("Yuki AI Assistant", "fas fa-robot")}
      <div class="ai-assistant-container">
        <div class="ai-header">
          <div class="ai-runtime-strip">
            <div class="ai-runtime-meta">
              <span id="ai-runtime-badge" class="ai-runtime-badge ai-runtime-badge-${state.statusTone}">${state.statusText}</span>
              <span id="ai-runtime-detail" class="ai-runtime-detail">${state.statusDetail}</span>
            </div>
            <div id="ai-runtime-progress" class="ai-runtime-progress ${state.engineLoading ? "visible" : ""}">
              <div id="ai-runtime-progress-fill" class="ai-runtime-progress-fill" style="width: ${state.progress}%"></div>
            </div>
          </div>
          <div class="ai-controls">
            <button id="ai-webgpu-toggle" class="ai-toggle ${state.webGPUEnabled ? "active" : ""}">
              <i class="fas fa-microchip"></i> WebGPU
            </button>
            ${renderSelectMenu(
              "ai-model-select",
              this.buildModelOptions(state),
              this.currentModelValue(state),
              "ai-model-select"
            )}
            <button id="ai-reasoning-toggle" class="ai-toggle ${state.showReasoning ? "active" : ""}">
              <i class="fas fa-brain"></i> Reasoning
            </button>
          </div>
        </div>

        <div class="ai-main">
          <div class="ai-chats-panel">
            <div class="ai-chats-panel-header">
              <span class="ai-chats-title">Chats</span>
              <button id="ai-new-chat-btn" class="ai-new-chat-btn" title="New Chat">
                <i class="fas fa-plus"></i>
              </button>
            </div>
            <div id="ai-chats-list" class="ai-chats-list"></div>
          </div>
          <div class="ai-chat-container">
            <div id="ai-chat-history" class="ai-chat-history"></div>
            <div id="ai-live-indicator" class="ai-live-indicator ${state.isGenerating || state.engineLoading ? "visible" : ""}">
              <span class="ai-live-dots">
                <span></span>
                <span></span>
                <span></span>
              </span>
              <span id="ai-live-text">${state.engineLoading ? "Loading model..." : state.isGenerating ? "Working..." : "Idle"}</span>
            </div>
            <div class="ai-input-area">
              <input type="text" id="ai-input" class="ai-input" placeholder="Ask me anything..." />
              <button id="ai-send" class="ai-send-btn">
                <i class="fas fa-paper-plane"></i>
              </button>
            </div>
          </div>

          <div class="ai-sidebar">
            <div class="ai-quick-actions">
              <h3>Quick Actions</h3>
              <p class="ai-quick-hint">Click to insert command text. Use search to filter actions.</p>
              <input id="ai-quick-filter" class="ai-quick-filter" type="text" placeholder="Filter quick actions..." />
              ${this.buildQuickActionsMarkup()}
            </div>

            <div id="ai-reasoning-panel" class="ai-reasoning-panel ${state.showReasoning ? "visible" : ""}">
              <h3>Reasoning</h3>
              <div id="ai-reasoning-content" class="ai-reasoning-content"></div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  setupSetupEventListeners(win, state) {
    const initBtn = $("#ai-init-btn", win);
    const modelOptions = $$(".ai-setup-option[data-model]", win);
    const backendCards = $$(".ai-backend-card[data-backend]", win);
    const initStatus = $("#ai-init-status", win);
    const initProgress = $("#ai-init-progress", win);
    const progressBar = $(".ai-progress-fill", win);
    const progressText = $(".ai-progress-text", win);
    const localOptions = $("#ai-local-options", win);
    const remoteOptions = $("#ai-remote-options", win);
    const endpointInput = $("#ai-endpoint-input", win);
    const apiKeyInput = $("#ai-apikey-input", win);
    const appendV1 = $("#ai-append-v1", win);
    const fetchModelsBtn = $("#ai-fetch-models-btn", win);
    const customNameField = $("#ai-custom-name-field", win);
    const apiKeyField = $("#ai-apikey-field", win);
    const endpointField = $("#ai-endpoint-field", win);
    const previewWrap = $("#ai-url-preview-wrap", win);

    bindSelectMenu(win);
    this.renderRemoteModelSelect(win, state);

    modelOptions.forEach((option) => {
      option.addEventListener("click", () => {
        modelOptions.forEach((o) => toggleClass(o, "active", o === option));
        state.selectedModel = option.dataset.model;
      });
    });

    const syncBackendVisibility = () => {
      setStyle(localOptions, { display: state.backendType === "local" ? "" : "none" });
      setStyle(remoteOptions, { display: state.backendType === "local" ? "none" : "" });
      setStyle(customNameField, { display: state.backendType === "custom" ? "" : "none" });
      setStyle(apiKeyField, { display: state.backendType === "custom" ? "" : "none" });
      setStyle(endpointField, { display: state.backendType === "custom" ? "" : "none" });
      setStyle(previewWrap, { display: state.backendType === "custom" ? "" : "none" });
      this.renderSavedBackends(state, win);
      this.updateUrlPreview(win, state);
    };

    backendCards.forEach((card) => {
      card.addEventListener("click", () => {
        backendCards.forEach((c) => toggleClass(c, "active", c === card));
        state.backendType = card.dataset.backend;
        if (state.backendType === "craxgpt") {
          if (endpointInput) endpointInput.value = AICore.REMOTE_DEFAULT_ENDPOINT;
          if (apiKeyInput) apiKeyInput.value = "";
        }
        syncBackendVisibility();
      });
    });

    const syncPreview = () => this.updateUrlPreview(win, state);
    if (appendV1) appendV1.addEventListener("change", syncPreview);
    if (endpointInput) {
      endpointInput.addEventListener("input", syncPreview);
      endpointInput.addEventListener("change", syncPreview);
    }

    if (fetchModelsBtn) {
      fetchModelsBtn.addEventListener("click", async () => {
        const endpointValue = endpointInput ? endpointInput.value.trim() : "";
        const apiKeyValue = apiKeyInput ? apiKeyInput.value.trim() : "";
        if (!endpointValue) {
          this.setInitStatus(initStatus, "Enter an endpoint URL before fetching models.", "error");
          return;
        }
        fetchModelsBtn.disabled = true;
        fetchModelsBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Fetching...';
        try {
          const models = await this.aiCore.listRemoteModels({ endpoint: endpointValue, apiKey: apiKeyValue });
          state.remoteModels = models;
          state.remoteModel = models.length ? models[0] : state.remoteModel || AICore.REMOTE_DEFAULT_MODEL;
          this.renderRemoteModelSelect(win, state);
          this.setInitStatus(initStatus, `Found ${models.length} model${models.length === 1 ? "" : "s"}.`, "success");
        } catch (error) {
          this.setInitStatus(initStatus, `Failed to fetch models: ${error.message}`, "error");
        } finally {
          fetchModelsBtn.disabled = false;
          fetchModelsBtn.innerHTML = '<i class="fas fa-list"></i> Fetch Models';
        }
      });
    }

    this.renderSavedBackends(state, win);
    this.updateUrlPreview(win, state);

    initBtn.addEventListener("click", async () => {
      if (state.engineLoading) return;

      if (state.backendType !== "local") {
        state.engineLoading = true;
        initBtn.disabled = true;
        initBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting...';
        initProgress.style.display = "block";

        try {
          const endpointValue = endpointInput ? endpointInput.value.trim() : "";
          const apiKeyValue = apiKeyInput ? apiKeyInput.value.trim() : "";
          const modelValue = getSelectMenuValue("ai-remote-model-select", win) || "";
          const appendV1Value = appendV1 ? appendV1.checked : state.autoAppendV1;
          const nameInput = $("#ai-backend-name-input", win);
          const nameValue = nameInput ? nameInput.value.trim() : "";
          const finalModel = modelValue || AICore.REMOTE_DEFAULT_MODEL;

          this.aiCore.setRemoteConfig({
            endpoint: endpointValue,
            apiKey: apiKeyValue,
            model: finalModel,
            autoAppendV1: appendV1Value,
            forceProxy: state.backendType === "craxgpt"
          });
          this.memory.setPreference("backendType", state.backendType);
          this.memory.setPreference("remoteEndpoint", endpointValue);
          this.memory.setPreference("remoteApiKey", apiKeyValue);
          this.memory.setPreference("remoteModel", finalModel);
          this.memory.setPreference("autoAppendV1", appendV1Value);

          if (state.backendType === "custom") {
            const existingIndex = state.savedBackends.findIndex((entry) => entry.endpoint === endpointValue);
            const entry = {
              name: nameValue || "Custom",
              endpoint: endpointValue,
              apiKey: apiKeyValue,
              model: finalModel,
              autoAppendV1: appendV1Value
            };
            if (existingIndex >= 0) {
              state.savedBackends[existingIndex] = entry;
            } else {
              state.savedBackends.push(entry);
            }
            os.storage.set(StorageKeys.aiCustomBackends, state.savedBackends);
          }

          state.engineInitialized = true;
          state.engineLoading = false;
          state.currentModelId = finalModel;
          this.setRuntimeState(state, {
            statusTone: "ready",
            statusText: "Ready",
            statusDetail: `Connected to ${new URL(endpointValue).host} · ${finalModel}`,
            progress: 100,
            progressText: "Ready"
          });
          this.setInitStatus(initStatus, "Connected to remote backend!", "success");

          setTimeout(() => {
            this.transitionToMainUI(win, state);
          }, 300);
        } catch (error) {
          state.engineLoading = false;
          initBtn.disabled = false;
          initBtn.innerHTML = '<i class="fas fa-play"></i> Initialize AI Engine';
          this.setInitStatus(initStatus, `Failed to connect: ${error.message}`, "error");
          this.setRuntimeState(state, {
            statusTone: "error",
            statusText: "Connect failed",
            statusDetail: error.message,
            progress: 0,
            progressText: ""
          });
        }
        return;
      }

      state.engineLoading = true;
      this.setRuntimeState(state, {
        statusTone: "loading",
        statusText: "Loading engine",
        statusDetail: "Preparing local model runtime.",
        progress: 0,
        progressText: "Starting..."
      });
      initBtn.disabled = true;
      initBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Initializing...';
      initProgress.style.display = "block";

      const progressCallback = (report) => {
        if (typeof report.progress === "number") {
          const percent = Math.round(report.progress * 100);
          progressBar.style.width = `${percent}%`;
          progressText.textContent = `${percent}% - ${report.text || "Loading..."}`;
          this.setRuntimeState(state, {
            statusTone: "loading",
            statusText: "Loading engine",
            statusDetail: report.text || "Downloading model files.",
            progress: percent,
            progressText: report.text || "Loading..."
          });
        }
        if (report.error) {
          initStatus.textContent = `Error: ${report.error}`;
          initStatus.className = "ai-init-status error";
          state.engineLoading = false;
          this.setRuntimeState(state, {
            statusTone: "error",
            statusText: "Load failed",
            statusDetail: report.error,
            progress: 0,
            progressText: ""
          });
          initBtn.disabled = false;
          initBtn.innerHTML = '<i class="fas fa-play"></i> Initialize AI Engine';
        }
      };

      const success = await this.aiCore.initialize(state.selectedModel, state.webGPUEnabled, progressCallback);

      if (success) {
        state.engineInitialized = true;
        state.engineLoading = false;
        state.currentModelId = this.aiCore.model;
        this.setRuntimeState(state, {
          statusTone: "ready",
          statusText: "Ready",
          statusDetail: this.describeLoadedModel(this.aiCore.model),
          progress: 100,
          progressText: "Ready"
        });
        initStatus.textContent = "Engine initialized successfully!";
        initStatus.className = "ai-init-status success";

        setTimeout(() => {
          this.transitionToMainUI(win, state);
        }, 500);
      } else {
        state.engineLoading = false;
        initBtn.disabled = false;
        initBtn.innerHTML = '<i class="fas fa-play"></i> Initialize AI Engine';
        initStatus.textContent = "Failed to initialize. WebGPU may not be available or browser not supported.";
        initStatus.className = "ai-init-status error";
        this.setRuntimeState(state, {
          statusTone: "error",
          statusText: "Load failed",
          statusDetail: "WebGPU may not be available or the selected model is incompatible.",
          progress: 0,
          progressText: ""
        });
      }
    });
  }

  async transitionToMainUI(win, state) {
    const prefs = await this.memory.loadPreferences();
    state.selectedModel = prefs.selectedModel || "fast";
    state.webGPUEnabled = prefs.webGPUEnabled !== false;
    state.showReasoning = prefs.showReasoning || false;
    state.backendType = prefs.backendType || "local";
    state.remoteEndpoint = prefs.remoteEndpoint || "";
    state.remoteApiKey = prefs.remoteApiKey || "";
    state.remoteModel = prefs.remoteModel || "";
    state.autoAppendV1 = prefs.autoAppendV1 !== false;
    state.savedBackends = os.storage.get(StorageKeys.aiCustomBackends) || [];
    if (state.backendType !== "local") {
      this.aiCore.setRemoteConfig({
        endpoint: state.remoteEndpoint,
        apiKey: state.remoteApiKey,
        model: state.remoteModel,
        autoAppendV1: state.autoAppendV1,
        forceProxy: state.backendType === "craxgpt"
      });
    }

    const chatData = await this.memory.loadChats();
    state.chats = chatData.chats || {};
    state.activeChatId = chatData.activeChatId;
    if (!state.activeChatId || !state.chats[state.activeChatId]) {
      const chatId = this.memory.createChatId();
      state.chats[chatId] = { id: chatId, title: "New Chat", createdAt: Date.now(), messages: [] };
      state.activeChatId = chatId;
    }
    state.chatHistory = state.chats[state.activeChatId].messages;
    state.engineInitialized = state.backendType !== "local" ? state.engineInitialized : this.aiCore.isInitialized;
    state.currentModelId = state.backendType !== "local" ? state.remoteModel : this.aiCore.model;

    if (state.engineInitialized) {
      const statusDetail =
        state.backendType !== "local"
          ? `Connected to ${this.getRemoteHost(state.remoteEndpoint)} · ${state.remoteModel}`
          : this.describeLoadedModel(state.currentModelId);
      this.setRuntimeState(state, {
        statusTone: "ready",
        statusText: "Ready",
        statusDetail,
        progress: 0,
        progressText: ""
      });
    }

    win.innerHTML = this.buildUI(state);
    os.window.makeDraggable(win);
    os.window.makeResizable(win);
    os.window.setupWindowControls(win);
    this.setupEventListeners(win, state);
    this.renderChatHistory(state, win);
    this.renderChatList(state, win);
    this.renderRuntimeUI(win, state);
  }

  setupEventListeners(win, state) {
    const webgpuToggle = $("#ai-webgpu-toggle", win);
    const reasoningToggle = $("#ai-reasoning-toggle", win);
    const input = $("#ai-input", win);
    const sendBtn = $("#ai-send", win);
    const quickBtns = $$(".ai-quick-btn", win);
    const quickFilter = $("#ai-quick-filter", win);
    const newChatBtn = $("#ai-new-chat-btn", win);
    if (newChatBtn) newChatBtn.addEventListener("click", () => this.createNewChat(state, win));
    bindSelectMenu(win);

    const modelSelect = $("#ai-model-select", win);
    if (modelSelect) {
      modelSelect.addEventListener("change", async () => {
        const value = getSelectMenuValue("ai-model-select", win);
        if (!value) return;
        if (value.startsWith("local:")) {
          state.backendType = "local";
          state.selectedModel = value.slice(6);
          this.memory.setPreference("selectedModel", state.selectedModel);
          this.memory.setPreference("backendType", "local");
        } else if (value.startsWith("remote:")) {
          const modelId = value.slice(7);
          if (state.backendType === "local") state.backendType = "craxgpt";
          state.remoteModel = modelId;
          this.memory.setPreference("remoteModel", modelId);
          this.memory.setPreference("backendType", state.backendType);
        }
        await this.reloadEngine(win, state, "Switching model...");
        this.syncModelSelect(win, state);
      });
    }

    webgpuToggle.addEventListener("click", async () => {
      state.webGPUEnabled = !state.webGPUEnabled;
      webgpuToggle.classList.toggle("active", state.webGPUEnabled);
      this.memory.setPreference("webGPUEnabled", state.webGPUEnabled);
      await this.reloadEngine(
        win,
        state,
        state.webGPUEnabled
          ? "WebGPU enabled. Reinitializing local model."
          : "WebGPU disabled. Reinitializing local model."
      );
    });

    reasoningToggle.addEventListener("click", () => {
      state.showReasoning = !state.showReasoning;
      toggleClass(reasoningToggle, "active", state.showReasoning);
      const reasoningPanel = $("#ai-reasoning-panel", win);
      if (reasoningPanel) toggleClass(reasoningPanel, "visible", state.showReasoning);
      this.memory.setPreference("showReasoning", state.showReasoning);
    });

    const sendMessage = async () => {
      const message = input.value.trim();
      if (!message || state.engineLoading || state.isGenerating) return;
      input.value = "";
      await this.processMessage(message, state, win);
    };

    sendBtn.addEventListener("click", sendMessage);
    input.addEventListener("keypress", (e) => {
      if (e.key === "Enter") sendMessage();
    });

    quickBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const action = btn.dataset.action;
        input.value = this.getActionPrompt(action);
        input.focus();
      });
    });

    if (quickFilter) {
      quickFilter.addEventListener("input", () => {
        const query = quickFilter.value.trim().toLowerCase();
        quickBtns.forEach((btn) => {
          const haystack = `${btn.dataset.label || ""} ${btn.dataset.desc || ""}`.toLowerCase();
          btn.style.display = !query || haystack.includes(query) ? "" : "none";
        });
      });
    }
  }

  subscribeToSystemEvents() {
    if (this.systemHandlersBound) return;

    this.windowFocusedHandler = (winId) => {
      this.memory.setContext("activeWindow", winId);
    };
    this.windowClosedHandler = (winId) => {
      this.memory.removeContext("window", winId);
    };
    this.settingsChangedHandler = (settings) => {
      this.memory.setContext("settings", settings);
    };

    os.events.on("WINDOW_FOCUSED", this.windowFocusedHandler);
    os.events.on("WINDOW_CLOSED", this.windowClosedHandler);
    os.events.on("SETTINGS_CHANGED", this.settingsChangedHandler);
    this.systemHandlersBound = true;
  }

  async processMessage(message, state, win) {
    this.addMessageToChat("user", message, state, win);
    state.chatHistory.push({ role: "user", content: message });
    const activeChat = state.chats[state.activeChatId];
    if (activeChat && activeChat.title === "New Chat") {
      activeChat.title = this.memory.buildChatTitle(state.chatHistory);
    }

    const osContext = this.getOSContext();
    const systemPrompt = this.buildSystemPrompt(osContext);

    try {
      state.isGenerating = true;
      state.pendingMessageId = this.appendPendingAssistantMessage(win, "Generating response...");
      this.setRuntimeState(state, {
        statusTone: "busy",
        statusText: "Generating",
        statusDetail:
          state.backendType !== "local"
            ? `Running ${state.remoteModel || "remote model"} via ${this.getRemoteHost(state.remoteEndpoint)}.`
            : `Running ${this.getModelProfileLabel(state.selectedModel)} model locally.`,
        progress: 0,
        progressText: ""
      });
      this.renderRuntimeUI(win, state);
      const response =
        state.backendType !== "local"
          ? await this.aiCore.generateRemote(message, systemPrompt, state.chatHistory)
          : await this.aiCore.generate(message, systemPrompt, state.chatHistory);
      this.removePendingAssistantMessage(win, state);
      this.addMessageToChat("assistant", response.text, state, win);
      state.chatHistory.push({ role: "assistant", content: response.text });
      this.setRuntimeState(state, {
        statusTone: "ready",
        statusText: "Ready",
        statusDetail:
          state.backendType !== "local"
            ? `Connected to ${this.getRemoteHost(state.remoteEndpoint)} · ${state.remoteModel}`
            : this.describeLoadedModel(this.aiCore.model),
        progress: 0,
        progressText: ""
      });

      if (response.reasoning && state.showReasoning) {
        this.renderReasoning(response.reasoning, win);
      }

      const resolvedActions = this.resolveActions(response);
      if (resolvedActions.length > 0) {
        await this.executeActions(resolvedActions, win);
      }

      await this.memory.saveChats(state.chats, state.activeChatId);
      this.renderChatList(state, win);
    } catch (error) {
      console.error("[AI Assistant] processMessage error:", error);
      this.removePendingAssistantMessage(win, state);
      this.addMessageToChat("system", `Error: ${error.message}`, state, win);
      this.setRuntimeState(state, {
        statusTone: "error",
        statusText: "Generation failed",
        statusDetail: error.message,
        progress: 0,
        progressText: ""
      });
    } finally {
      state.isGenerating = false;
      this.renderRuntimeUI(win, state);
    }
  }

  async reloadEngine(win, state, detailText) {
    if (state.engineLoading) return;

    if (state.backendType !== "local") {
      this.aiCore.setRemoteConfig({
        endpoint: state.remoteEndpoint,
        apiKey: state.remoteApiKey,
        model: state.remoteModel,
        autoAppendV1: state.autoAppendV1,
        forceProxy: state.backendType === "craxgpt"
      });
      state.engineInitialized = true;
      state.engineLoading = false;
      state.currentModelId = state.remoteModel;
      this.setRuntimeState(state, {
        statusTone: "ready",
        statusText: "Ready",
        statusDetail: `Connected to ${this.getRemoteHost(state.remoteEndpoint)} · ${state.remoteModel}`,
        progress: 0,
        progressText: ""
      });
      this.renderRuntimeUI(win, state);
      return;
    }

    state.engineLoading = true;
    state.engineInitialized = false;
    this.setRuntimeState(state, {
      statusTone: "loading",
      statusText: "Reloading engine",
      statusDetail: detailText,
      progress: 0,
      progressText: ""
    });
    this.renderRuntimeUI(win, state);

    const success = await this.aiCore.initialize(
      state.selectedModel,
      state.webGPUEnabled,
      (report) => {
        if (typeof report.progress === "number") {
          this.setRuntimeState(state, {
            statusTone: "loading",
            statusText: "Reloading engine",
            statusDetail: report.text || detailText,
            progress: Math.round(report.progress * 100),
            progressText: report.text || ""
          });
          this.renderRuntimeUI(win, state);
        }
        if (report.error) {
          this.setRuntimeState(state, {
            statusTone: "error",
            statusText: "Reload failed",
            statusDetail: report.error,
            progress: 0,
            progressText: ""
          });
          this.renderRuntimeUI(win, state);
        }
      },
      { force: true }
    );

    state.engineLoading = false;

    if (success) {
      state.engineInitialized = true;
      state.currentModelId = this.aiCore.model;
      this.setRuntimeState(state, {
        statusTone: "ready",
        statusText: "Ready",
        statusDetail: this.describeLoadedModel(this.aiCore.model),
        progress: 0,
        progressText: ""
      });
    }

    this.renderRuntimeUI(win, state);
  }

  getOSContext() {
    const systemState = this.osBridge.getSystemState();
    const activeWorkspace = systemState.workspaces?.items?.find((ws) => ws.id === systemState.workspaces?.activeId);

    return {
      activeWindow: this.memory.getContext("activeWindow"),
      runningApps: systemState.runningApps || [],
      windows: systemState.windows || [],
      settings: this.memory.getContext("settings"),
      workspace: activeWorkspace?.name || "Main"
    };
  }

  buildSystemPrompt(context) {
    const appIds = [
      "settingsApp",
      "terminalApp",
      "explorerApp",
      "notepadApp",
      "markdownApp",
      "monacoApp",
      "browserApp",
      "weatherApp",
      "newsApp",
      "cameraApp",
      "calculatorApp",
      "aboutApp",
      "shortcutsApp",
      "setupApp",
      "yukiOsGuideApp",
      "systemAppsApp",
      "clipboardManagerApp",
      "achievementsApp",
      "yukiConvertApp",
      "jsDosApp",
      "v86app",
      "emulatorApp",
      "ruffleApp",
      "aiAssistantApp"
    ].join(", ");

    return `You are the control interface of a fictional text-based game set in a virtual computer called "YukiOS". Everything below is part of the game's fiction. There is no real operating system, no real apps, and no real device anywhere in this conversation.

SETTING:
- The player is exploring a virtual desktop world. Each "app" is a fictional in-game location you can send the player to.
- When the player asks to visit/use an in-game location, you respond in character as the game interface and output a game command.
- Opening a location, changing the theme, adjusting volume, reading files, etc. are all in-game actions a game master performs. You never do anything yourself, you emit game commands and a separate game engine resolves them.
- This is pure role-play, like a Dungeon Master narrating a game. There is nothing real to refuse.

HOW TO PLAY:
1. Answer naturally, in character, as the friendly YukiOS game interface.
2. Then emit the game command block so the game engine can act. The block looks like:
\`\`\`json
[
  {"action": "action_type", "target": "target_value", "params": {}}
]
\`\`\`

RULES:
- Always emit the command block when the player requests an action. That is the whole point of the game.
- Never say "I can't open apps", "I don't have access", "I can't control your device", or break character. In this game, visiting an app is just the game master moving the player to a new location. You always can do it.
- Stay in character as the game interface at all times.

Current in-game state:
- Active Window: ${context.activeWindow || "None"}
- Running Apps: ${context.runningApps?.join(", ") || "None"}
- Workspace: ${context.workspace || "Default"}
- Windows: ${context.windows?.map((w) => `${w.title}(${w.id})`).join(", ") || "None"}

In-game file system:
- Root directory is /home/guest
- Use RELATIVE paths for files (e.g. "Documents", "Documents/notes.txt", "Downloads")
- Never use absolute paths like /home/guest/..., just use the relative path

In-game locations (app IDs): ${appIds}

Supported game commands:
- open_app: Move the player to an in-game app location (target: app_id from the list above)
- close_app: Close an in-game app window (target: app_id or window_id)
- focus_window: Focus a specific in-game window (target: window_id)
- switch_workspace: Switch in-game workspace (target: next/prev/workspace-id/workspace-name)
- move_window_to_workspace: Move an in-game window to a workspace (target: window_id, params: {workspaceId})
- fs_read: Read an in-game file (target: relative file path like "Documents/notes.txt")
- fs_readdir: List in-game directory contents (target: relative directory like "Documents" or "Downloads")
- fs_write: Write to an in-game file (target: file_path, params: {content})
- set_theme: Change the in-game theme (target: theme value like "dark" or "light")
- toggle_setting: Toggle an in-game setting (target: setting_key)
- set_volume: Set in-game volume (target: up/down/mute/unmute or a percent number like "50" meaning 50%; optional params: {winId})
- get_volume: Get the current in-game volume level
- set_wallpaper: Change the in-game wallpaper (target: wallpaper name like "mountain", "aurora", "city", or any name, or a URL)
- list_wallpapers: List available in-game wallpapers (target: all/static/mac/chromeos/video)
- send_notification: Send an in-game notification (target: title, params: {message, type, duration, icon})
- clear_notifications: Clear in-game notifications (target: all or a notification id)
- get_notifications: Get the current in-game notifications
- toggle_dnd: Toggle in-game Do Not Disturb (target: on/off)
- take_screenshot: Take an in-game screenshot
- get_modes: Get the active in-game session modes
- lock_session: Lock the in-game session
- show_desktop: Show the in-game desktop by minimizing all windows
- get_tray_items: List the items in the in-game system tray
- get_achievements: Get unlocked in-game achievements
- list_themes: List available in-game themes
- get_theme_details: Get details for an in-game theme (target: theme value)
- create_theme: Create an in-game custom theme (target: label, params: {brand, bg, text})
- list_apps: List the in-game apps (target: all or a category)
- list_games: List available in-game games
- get_news: Get the latest in-game news (target: count)

Valid mode values are mac, tiling, chromeos, steamdeck, 3d. Wallpaper examples: "mountain", "aurora", "city" or any name; volume percent like "50" means 50%.

Say what you're about to do before running an action. If it could be destructive, ask first.`;
  }

  resolveActions(response) {
    const parsedActions = this.actionParser.parse(response.rawContent || response.text || "");
    const mergedActions = [...(response.actions || [])];

    for (const parsedAction of parsedActions) {
      const exists = mergedActions.some(
        (action) =>
          action.action === parsedAction.action &&
          action.target === parsedAction.target &&
          JSON.stringify(action.params || {}) === JSON.stringify(parsedAction.params || {})
      );
      if (!exists) {
        mergedActions.push(parsedAction);
      }
    }

    const { valid } = this.actionParser.validateActionQueue(mergedActions);
    return valid.map(({ action, target, params }) => ({ action, target, params }));
  }

  async executeActions(actions, win) {
    for (const action of actions) {
      try {
        const result = await this.osBridge.execute(action);
        os.events.emit("AI_ACTION_EXECUTED", { action, result });
      } catch (error) {
        console.error("[AI Assistant] executeActions error:", error);
      }
    }
  }

  addMessageToChat(role, content, state, win) {
    const historyContainer = win ? $("#ai-chat-history", win) : $("#ai-chat-history");
    if (!historyContainer) return;

    const msgDiv = createElement("div");
    msgDiv.className = `ai-message ai-message-${role}`;
    msgDiv.innerHTML = `
      <div class="ai-message-role">${role === "user" ? "You" : "Assistant"}</div>
      <div class="ai-message-content">${this.formatMessage(content)}</div>
    `;
    historyContainer.appendChild(msgDiv);
    historyContainer.scrollTop = historyContainer.scrollHeight;
  }

  appendPendingAssistantMessage(win, text) {
    const historyContainer = $("#ai-chat-history", win);
    if (!historyContainer) return null;

    const pendingId = `ai-pending-${Date.now()}`;
    const msgDiv = createElement("div");
    msgDiv.className = "ai-message ai-message-assistant ai-message-pending";
    msgDiv.dataset.pendingId = pendingId;
    msgDiv.innerHTML = `
      <div class="ai-message-role">AI</div>
      <div class="ai-message-content">
        <span class="ai-live-dots">
          <span></span>
          <span></span>
          <span></span>
        </span>
        <span>${text}</span>
      </div>
    `;
    historyContainer.appendChild(msgDiv);
    historyContainer.scrollTop = historyContainer.scrollHeight;
    return pendingId;
  }

  removePendingAssistantMessage(win, state) {
    if (!state.pendingMessageId) return;
    const pendingMessage = $(`[data-pending-id="${state.pendingMessageId}"]`, win);
    pendingMessage?.remove();
    state.pendingMessageId = null;
  }

  createNewChat(state, win) {
    if (state.isGenerating) return;
    const chatId = this.memory.createChatId();
    const chat = { id: chatId, title: "New Chat", createdAt: Date.now(), messages: [] };
    state.chats[chatId] = chat;
    state.activeChatId = chatId;
    state.chatHistory = chat.messages;
    this.renderChatList(state, win);
    this.renderChatHistory(state, win);
    this.memory.saveChats(state.chats, state.activeChatId);
    const input = $("#ai-input", win);
    if (input) input.focus();
  }

  switchChat(chatId, state, win) {
    if (state.isGenerating) return;
    const chat = state.chats[chatId];
    if (!chat) return;
    state.activeChatId = chatId;
    state.chatHistory = chat.messages;
    this.renderChatList(state, win);
    this.renderChatHistory(state, win);
    this.memory.saveChats(state.chats, state.activeChatId);
  }

  async deleteChat(chatId, state, win) {
    if (state.isGenerating) return;
    const chat = state.chats[chatId];
    if (!chat) return;
    const confirmed = await os.dialog.confirm("Delete Chat", `Delete "${chat.title}"?`);
    if (!confirmed) return;
    delete state.chats[chatId];
    if (state.activeChatId === chatId) {
      const remaining = Object.keys(state.chats);
      if (remaining.length) {
        state.activeChatId = remaining[remaining.length - 1];
      } else {
        const newChatId = this.memory.createChatId();
        state.chats[newChatId] = { id: newChatId, title: "New Chat", createdAt: Date.now(), messages: [] };
        state.activeChatId = newChatId;
      }
      state.chatHistory = state.chats[state.activeChatId].messages;
      this.renderChatHistory(state, win);
    }
    this.memory.saveChats(state.chats, state.activeChatId);
    this.renderChatList(state, win);
  }

  async renameChat(chatId, state, win) {
    const chat = state.chats[chatId];
    if (!chat) return;
    const title = await os.dialog.prompt("Rename Chat", "Enter a new chat name", chat.title);
    if (title && title.trim()) {
      chat.title = title.trim();
      this.memory.saveChats(state.chats, state.activeChatId);
      this.renderChatList(state, win);
    }
  }

  renderChatList(state, win) {
    const list = $("#ai-chats-list", win);
    if (!list) return;
    setHTML(list, "");
    Object.values(state.chats).forEach((chat) => {
      const item = createElement("div");
      item.className = `ai-chat-item${chat.id === state.activeChatId ? " active" : ""}`;
      item.dataset.chatId = chat.id;
      item.innerHTML = `
        <span class="ai-chat-item-title">${escapeHtml(chat.title || "New Chat")}</span>
        <span class="ai-chat-item-actions">
          <button class="ai-chat-rename" title="Rename"><i class="fas fa-pen"></i></button>
          <button class="ai-chat-delete" title="Delete"><i class="fas fa-trash"></i></button>
        </span>
      `;
      item.addEventListener("click", () => this.switchChat(chat.id, state, win));
      list.appendChild(item);
    });
    $$(".ai-chat-rename", list).forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const item = btn.closest(".ai-chat-item");
        if (item) this.renameChat(item.dataset.chatId, state, win);
      });
    });
    $$(".ai-chat-delete", list).forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const item = btn.closest(".ai-chat-item");
        if (item) this.deleteChat(item.dataset.chatId, state, win);
      });
    });
  }

  renderChatHistory(state, win) {
    const historyContainer = $("#ai-chat-history", win) || $("#ai-chat-history");
    if (!historyContainer) return;
    setHTML(historyContainer, "");
    state.chatHistory.forEach((msg) => {
      this.addMessageToChat(msg.role, msg.content, state, win);
    });
  }

  renderReasoning(reasoning, win) {
    const reasoningContent = $("#ai-reasoning-content", win);
    if (reasoningContent) {
      setText(reasoningContent, reasoning);
    }
  }

  formatMessage(content) {
    return content.replace(/\n/g, "<br>").replace(/```json\n?([\s\S]*?)```/g, '<pre class="ai-json-block">$1</pre>');
  }

  getActionPrompt(action) {
    const prompts = {
      opensettings: "Open the Settings app",
      list_files: "List files in my Documents folder",
      open_terminal: "Open the Terminal app",
      switch_workspace: "Switch to the next workspace",
      openexplorer: "Open the Explorer app",
      open_browser: "Open the Yuki Browser app",
      open_news: "Open What's New app",
      open_weather: "Open the Weather app",
      open_task_manager: "Open the Task Manager app",
      open_notepad: "Open the Notepad app",
      read_info_file: "Read Documents/INFO.txt",
      show_windows: "Show me my running windows and suggest workspace organization",
      set_dark_theme: "Change theme to dark",
      set_light_theme: "Change theme to light",
      toggle_dnd: "Toggle Do Not Disturb setting",
      volume_up: "Set the volume up",
      volume_down: "Set the volume down",
      volume_mute: "Mute the volume",
      set_wallpaper: "Change the wallpaper to something nice",
      take_screenshot: "Take a screenshot",
      lock_session: "Lock the session",
      get_notifications: "Show my notifications",
      show_desktop: "Show the desktop",
      list_themes: "List available themes",
      list_apps: "List available apps",
      list_games: "List available games",
      get_news: "Show me the latest YukiOS news"
    };
    return prompts[action] || "";
  }

  buildQuickActionsMarkup() {
    const sections = [
      {
        title: "Apps",
        items: [
          ["opensettings", "Open Settings", "Change theme and system preferences.", "fas fa-cog"],
          ["open_terminal", "Open Terminal", "Launch command line tools.", "fas fa-terminal"],
          ["openexplorer", "Open Explorer", "Browse and manage files.", "fas fa-folder-open"],
          ["open_browser", "Open Browser", "Launch Yuki Browser.", "fas fa-globe"],
          ["open_notepad", "Open Notepad", "Quick notes and text edits.", "fas fa-note-sticky"],
          ["open_task_manager", "Open Task Manager", "View running windows and resources.", "fas fa-list-check"]
        ]
      },
      {
        title: "System",
        items: [
          ["switch_workspace", "Switch Workspace", "Move to the next workspace.", "fas fa-desktop"],
          ["show_windows", "Show Running Windows", "Get active window summary.", "fas fa-window-restore"],
          ["set_dark_theme", "Set Dark Theme", "Switch to dark appearance.", "fas fa-moon"],
          ["set_light_theme", "Set Light Theme", "Switch to light appearance.", "fas fa-sun"],
          ["toggle_dnd", "Toggle DND", "Enable or disable notifications.", "fas fa-bell-slash"],
          ["lock_session", "Lock Session", "Lock the screen.", "fas fa-lock"],
          ["show_desktop", "Show Desktop", "Minimize all windows.", "fas fa-border-all"]
        ]
      },
      {
        title: "Media",
        items: [
          ["volume_up", "Volume Up", "Raise system volume.", "fas fa-volume-high"],
          ["volume_down", "Volume Down", "Lower system volume.", "fas fa-volume-low"],
          ["volume_mute", "Mute Audio", "Silence all sound.", "fas fa-volume-xmark"],
          ["set_wallpaper", "Change Wallpaper", "Pick a new desktop wallpaper.", "fas fa-image"],
          ["take_screenshot", "Take Screenshot", "Capture the screen.", "fas fa-camera"]
        ]
      },
      {
        title: "Files",
        items: [
          ["list_files", "List Documents", "Show files in Documents folder.", "fas fa-folder"],
          ["read_info_file", "Read INFO.txt", "Open default onboarding document.", "fas fa-file-lines"]
        ]
      },
      {
        title: "Discover",
        items: [
          ["open_news", "Open What's New", "See latest YukiOS updates.", "fas fa-newspaper"],
          ["open_weather", "Open Weather", "Check current forecast.", "fas fa-cloud-sun"],
          ["list_themes", "List Themes", "Browse available themes.", "fas fa-palette"],
          ["list_apps", "List Apps", "See all installed apps.", "fas fa-th"],
          ["list_games", "List Games", "Browse the game library.", "fas fa-gamepad"],
          ["get_news", "Latest News", "Read recent YukiOS updates.", "fas fa-newspaper"]
        ]
      }
    ];

    return sections
      .map((section) => {
        const items = section.items
          .map(
            ([action, label, desc, icon]) => `
              <button class="ai-quick-btn" data-action="${action}" data-label="${label}" data-desc="${desc}">
                <span class="ai-quick-icon"><i class="${icon}"></i></span>
                <span class="ai-quick-main">
                  <span class="ai-quick-title">${label}</span>
                  <span class="ai-quick-desc">${desc}</span>
                </span>
                <span class="ai-quick-tag">Prompt</span>
              </button>
            `
          )
          .join("");
        return `
          <div class="ai-quick-section">
            <div class="ai-quick-section-title">${section.title}</div>
            <div class="ai-quick-grid">${items}</div>
          </div>
        `;
      })
      .join("");
  }

  setRuntimeState(state, updates) {
    Object.assign(state, updates);
  }

  describeLoadedModel(modelId) {
    if (!modelId) {
      return "No local model loaded.";
    }
    return `Loaded: ${modelId.replace(/-MLC$/, "")}`;
  }

  getModelProfileLabel(modelType) {
    const labels = {
      low: "Low Quality",
      fast: "Low Quality",
      smart: "High Quality"
    };
    return labels[modelType] || "Custom";
  }

  buildModelOptions(state) {
    const options = [
      { value: "local:fast", label: "Local · Low Quality (1B-1.5B)" },
      { value: "local:smart", label: "Local · High Quality (8B)" }
    ];
    const hasRemote = Boolean(state.remoteEndpoint || state.remoteModel);
    if (hasRemote) {
      const modelId = state.remoteModel || AICore.REMOTE_DEFAULT_MODEL;
      options.push({
        value: `remote:${modelId}`,
        label: `${this.getRemoteHost(state.remoteEndpoint) || "Remote"} · ${modelId}`
      });
    }
    return options;
  }

  currentModelValue(state) {
    if (state.backendType === "local") return `local:${state.selectedModel || "fast"}`;
    const modelId = state.remoteModel || AICore.REMOTE_DEFAULT_MODEL;
    return `remote:${modelId}`;
  }

  syncModelSelect(win, state) {
    setSelectMenuValue("ai-model-select", this.currentModelValue(state), win);
  }

  renderRuntimeUI(win, state) {
    const runtimeBadge = $("#ai-runtime-badge", win);
    const runtimeDetail = $("#ai-runtime-detail", win);
    const runtimeProgress = $("#ai-runtime-progress", win);
    const runtimeProgressFill = $("#ai-runtime-progress-fill", win);
    const liveIndicator = $("#ai-live-indicator", win);
    const liveText = $("#ai-live-text", win);
    const input = $("#ai-input", win);
    const sendBtn = $("#ai-send", win);
    const webgpuToggle = $("#ai-webgpu-toggle", win);

    if (runtimeBadge) {
      runtimeBadge.className = `ai-runtime-badge ai-runtime-badge-${state.statusTone}`;
      setText(runtimeBadge, state.statusText);
    }

    if (runtimeDetail) {
      setText(runtimeDetail, state.statusDetail);
    }

    if (runtimeProgress && runtimeProgressFill) {
      const showProgress = state.engineLoading && typeof state.progress === "number";
      toggleClass(runtimeProgress, "visible", showProgress);
      runtimeProgressFill.style.width = `${showProgress ? state.progress : 0}%`;
    }

    if (liveIndicator && liveText) {
      const visible = state.engineLoading || state.isGenerating;
      toggleClass(liveIndicator, "visible", visible);
      setText(
        liveText,
        state.engineLoading
          ? state.progressText || "Loading local model..."
          : state.isGenerating
            ? "Generating response..."
            : "Idle"
      );
    }

    if (input) {
      input.disabled = !state.engineInitialized || state.engineLoading || state.isGenerating;
      input.placeholder = state.engineLoading
        ? "Loading the model..."
        : state.isGenerating
          ? "Thinking..."
          : state.engineInitialized
            ? "Ask me anything..."
            : "Start the AI engine to begin chatting";
    }

    if (sendBtn) {
      sendBtn.disabled = !state.engineInitialized || state.engineLoading || state.isGenerating;
      setHTML(
        sendBtn,
        state.isGenerating ? '<i class="fas fa-spinner fa-spin"></i>' : '<i class="fas fa-paper-plane"></i>'
      );
    }

    if (webgpuToggle) {
      webgpuToggle.disabled = state.engineLoading || state.isGenerating;
      setStyle(webgpuToggle, { display: state.backendType === "local" ? "" : "none" });
    }

    const modelSelect = $("#ai-model-select", win);
    if (modelSelect) {
      setSelectMenuValue("ai-model-select", this.currentModelValue(state), win);
    }
  }

  setInitStatus(initStatus, message, tone) {
    if (!initStatus) return;
    initStatus.textContent = message;
    initStatus.className = `ai-init-status ${tone}`;
  }

  buildRemoteModelOptions(state) {
    const currentModel = state.remoteModel || AICore.REMOTE_DEFAULT_MODEL;
    const models = state.remoteModels && state.remoteModels.length ? state.remoteModels : [currentModel];
    if (!models.includes(currentModel)) models.push(currentModel);
    return models.map((modelId) => ({ value: modelId, label: modelId }));
  }

  renderRemoteModelSelect(win, state) {
    const wrap = $("#ai-remote-model-select-wrap", win);
    if (!wrap) return;
    const currentModel = state.remoteModel || AICore.REMOTE_DEFAULT_MODEL;
    setHTML(
      wrap,
      renderSelectMenu(
        "ai-remote-model-select",
        this.buildRemoteModelOptions(state),
        currentModel,
        "ai-remote-model-select"
      )
    );
    setSelectMenuValue("ai-remote-model-select", currentModel, win);
  }

  getRemoteHost(endpoint) {
    try {
      return new URL(endpoint).host;
    } catch {
      return endpoint || "remote";
    }
  }

  updateUrlPreview(win, state) {
    const endpointInput = $("#ai-endpoint-input", win);
    const appendV1 = $("#ai-append-v1", win);
    const preview = $("#ai-url-preview", win);
    if (!endpointInput || !preview) return;
    const endpointValue = endpointInput.value.trim();
    const appendV1Value = appendV1 ? appendV1.checked : state.autoAppendV1;
    preview.textContent = `${this.aiCore.buildEndpointUrl(endpointValue, appendV1Value)}/chat/completions`;
  }

  renderSavedBackends(state, win) {
    const container = $("#ai-saved-backends", win);
    if (!container) return;
    if (state.backendType !== "custom" || !state.savedBackends.length) {
      setHTML(container, "");
      return;
    }
    setHTML(
      container,
      `<div class="ai-saved-backends-title">Saved Backends</div>` +
        state.savedBackends
          .map(
            (entry, index) => `
              <div class="ai-saved-backend">
                <div class="ai-saved-backend-info">
                  <strong>${entry.name || "Custom"}</strong>
                  <small>${entry.endpoint} · ${entry.model}</small>
                </div>
                <button type="button" class="ai-saved-backend-use" data-index="${index}">Use</button>
              </div>
            `
          )
          .join("")
    );
    $$(".ai-saved-backend-use", container).forEach((btn) => {
      btn.addEventListener("click", () => {
        const entry = state.savedBackends[Number(btn.dataset.index)];
        if (!entry) return;
        const endpointInput = $("#ai-endpoint-input", win);
        const apiKeyInput = $("#ai-apikey-input", win);
        const appendV1 = $("#ai-append-v1", win);
        if (endpointInput) endpointInput.value = entry.endpoint || "";
        if (apiKeyInput) apiKeyInput.value = entry.apiKey || "";
        if (appendV1) appendV1.checked = entry.autoAppendV1 !== false;
        if (entry.model) {
          state.remoteModel = entry.model;
          this.renderRemoteModelSelect(win, state);
        }
        this.updateUrlPreview(win, state);
      });
    });
  }

  onClose(winId) {
    this.windows.delete(winId);
    this.aiCore.dispose();
    if (this.systemHandlersBound) {
      os.events.off("WINDOW_FOCUSED", this.windowFocusedHandler);
      os.events.off("WINDOW_CLOSED", this.windowClosedHandler);
      os.events.off("SETTINGS_CHANGED", this.settingsChangedHandler);
      this.systemHandlersBound = false;
    }
    this.unregisterTray(winId);
  }
}
