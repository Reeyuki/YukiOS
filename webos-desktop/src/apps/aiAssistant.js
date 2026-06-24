import { AICore } from "./aiAssistant/aiCore.js";
import { ActionParser } from "./aiAssistant/actionParser.js";
import { OSBridge } from "./aiAssistant/osBridge.js";
import { AIMemory } from "./aiAssistant/memory.js";
import { $, $$, bindEvent, setText, setHTML, toggleClass } from "../shared/domUtils.js";
import "./aiAssistant/aiAssistant.css";

import { BaseApp, StorageKeys, os } from "../framework.js";
export class AIAssistantApp extends BaseApp {
  constructor(services) {
    super(services);
    this.aiCore = new AICore();
    this.actionParser = new ActionParser();
    this.osBridge = new OSBridge(services);
    this.memory = new AIMemory();
    this.windows = new Map();
    this.actionLog = [];
    this.automationMode = false;
    this.systemHandlersBound = false;
    this.windowFocusedHandler = null;
    this.windowClosedHandler = null;
    this.settingsChangedHandler = null;
    this.winId = "ai-assistant-window";
    this.enabled = os.storage.get(StorageKeys.aiAssistantEnabled) !== "false";
  }

  async open(opts = {}) {
    const winId = this.winId;
    if (await this._isSingletonOpen(winId)) return;

    if (this.enabled) {
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
      automationMode: false,
      showReasoning: false,
      chatHistory: [],
      actionHistory: [],
      engineInitialized: false,
      engineLoading: false,
      isGenerating: false,
      statusTone: "offline",
      statusText: "Offline",
      statusDetail: "Fire up a model to get started.",
      progress: 0,
      progressText: "",
      currentModelId: null,
      pendingMessageId: null
    };

    win.innerHTML = this._buildSetupUI(state);

    this._setupSetupEventListeners(win, state);
    this._subscribeToSystemEvents();

    win.dataset.appId = "aiAssistant";
  }

  _buildSetupUI(state) {
    return `
      <div class="window-header">
        <span>Yuki AI Assistant</span>
        ${os.window.getWindowControls()}
      </div>
      <div class="ai-assistant-container">
        <div class="ai-setup-screen">
          <div class="ai-setup-content">
            <div class="ai-setup-icon">
              <i class="fas fa-robot"></i>
            </div>
            <h2>Yuki AI Assistant</h2>
            <p class="ai-setup-description">
              Runs locally in your browser. your data never leaves your machine.
            </p>

            <div class="ai-system-requirements">
              <h3><i class="fas fa-exclamation-triangle"></i> Before You Start</h3>
              <ul>
                <li>You'll need a browser with WebGPU (Chrome 113+ or Edge 113+)</li>
                <li>About 4GB free RAM for the lighter model, more for the big one</li>
                <li>A dedicated GPU helps things run smoother</li>
              </ul>
            </div>

            <div class="ai-setup-options">
              <div class="ai-setup-option">
                <label>
                  <input type="radio" name="ai-model" value="fast" checked />
                  <span>Low Quality 1B-1.5B (~600MB-1.2GB)</span>
                </label>
                <small>Recommended for fast startup and lower memory use</small>
              </div>
              <div class="ai-setup-option">
                <label>
                  <input type="radio" name="ai-model" value="smart" />
                  <span>High Quality 8B (~4GB)</span>
                </label>
                <small>Better reasoning quality with higher resource usage</small>
              </div>
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

  _buildUI(state) {
    return `
      <div class="window-header">
        <span>Yuki AI Assistant</span>
        ${os.window.getWindowControls()}
      </div>
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
            <button id="ai-automation-toggle" class="ai-toggle ${state.automationMode ? "active" : ""}">
              <i class="fas fa-magic"></i> Auto
            </button>
            <button id="ai-reasoning-toggle" class="ai-toggle ${state.showReasoning ? "active" : ""}">
              <i class="fas fa-brain"></i> Reasoning
            </button>
          </div>
        </div>

        <div class="ai-main">
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
              ${this._buildQuickActionsMarkup()}
            </div>

            <div class="ai-action-log">
              <h3>Action Log</h3>
              <div id="ai-action-log" class="ai-log-list"></div>
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

  _setupSetupEventListeners(win, state) {
    const initBtn = $("#ai-init-btn", win);
    const modelRadios = $$('input[name="ai-model"]', win);
    const initStatus = $("#ai-init-status", win);
    const initProgress = $("#ai-init-progress", win);
    const progressBar = $(".ai-progress-fill", win);
    const progressText = $(".ai-progress-text", win);

    modelRadios.forEach((radio) => {
      radio.addEventListener("change", (e) => {
        state.selectedModel = e.target.value;
      });
    });

    initBtn.addEventListener("click", async () => {
      if (state.engineLoading) return;

      state.engineLoading = true;
      this._setRuntimeState(state, {
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
          this._setRuntimeState(state, {
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
          this._setRuntimeState(state, {
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
        this._setRuntimeState(state, {
          statusTone: "ready",
          statusText: "Ready",
          statusDetail: this._describeLoadedModel(this.aiCore.model),
          progress: 100,
          progressText: "Ready"
        });
        initStatus.textContent = "Engine initialized successfully!";
        initStatus.className = "ai-init-status success";

        setTimeout(() => {
          this._transitionToMainUI(win, state);
        }, 500);
      } else {
        state.engineLoading = false;
        initBtn.disabled = false;
        initBtn.innerHTML = '<i class="fas fa-play"></i> Initialize AI Engine';
        initStatus.textContent = "Failed to initialize. WebGPU may not be available or browser not supported.";
        initStatus.className = "ai-init-status error";
        this._setRuntimeState(state, {
          statusTone: "error",
          statusText: "Load failed",
          statusDetail: "WebGPU may not be available or the selected model is incompatible.",
          progress: 0,
          progressText: ""
        });
      }
    });
  }

  async _transitionToMainUI(win, state) {
    const prefs = await this.memory.loadPreferences();
    state.selectedModel = prefs.selectedModel || "fast";
    state.webGPUEnabled = prefs.webGPUEnabled !== false;
    state.automationMode = prefs.automationMode || false;
    state.showReasoning = prefs.showReasoning || false;

    const chatHistory = await this.memory.loadChatHistory();
    state.chatHistory = chatHistory;
    state.engineInitialized = this.aiCore.isInitialized;
    state.currentModelId = this.aiCore.model;

    if (state.engineInitialized) {
      this._setRuntimeState(state, {
        statusTone: "ready",
        statusText: "Ready",
        statusDetail: this._describeLoadedModel(state.currentModelId),
        progress: 0,
        progressText: ""
      });
    }

    win.innerHTML = this._buildUI(state);
    this._setupEventListeners(win, state);
    this._renderChatHistory(state, win);
    this._renderRuntimeUI(win, state);
  }

  _setupEventListeners(win, state) {
    const webgpuToggle = $("#ai-webgpu-toggle", win);
    const automationToggle = $("#ai-automation-toggle", win);
    const reasoningToggle = $("#ai-reasoning-toggle", win);
    const input = $("#ai-input", win);
    const sendBtn = $("#ai-send", win);
    const quickBtns = $$(".ai-quick-btn", win);
    const quickFilter = $("#ai-quick-filter", win);

    webgpuToggle.addEventListener("click", async () => {
      state.webGPUEnabled = !state.webGPUEnabled;
      webgpuToggle.classList.toggle("active", state.webGPUEnabled);
      this.memory.setPreference("webGPUEnabled", state.webGPUEnabled);
      await this._reloadEngine(
        win,
        state,
        state.webGPUEnabled
          ? "WebGPU enabled. Reinitializing local model."
          : "WebGPU disabled. Reinitializing local model."
      );
    });

    automationToggle.addEventListener("click", () => {
      state.automationMode = !state.automationMode;
      automationToggle.classList.toggle("active", state.automationMode);
      this.memory.setPreference("automationMode", state.automationMode);
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
      await this._processMessage(message, state, win);
    };

    sendBtn.addEventListener("click", sendMessage);
    input.addEventListener("keypress", (e) => {
      if (e.key === "Enter") sendMessage();
    });

    quickBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const action = btn.dataset.action;
        input.value = this._getActionPrompt(action);
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

  _subscribeToSystemEvents() {
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

  async _processMessage(message, state, win) {
    this._addMessageToChat("user", message, state, win);
    state.chatHistory.push({ role: "user", content: message });

    const osContext = this._getOSContext();
    const systemPrompt = this._buildSystemPrompt(osContext);

    try {
      state.isGenerating = true;
      state.pendingMessageId = this._appendPendingAssistantMessage(win, "Generating response...");
      this._setRuntimeState(state, {
        statusTone: "busy",
        statusText: "Generating",
        statusDetail: `Running ${this._getModelProfileLabel(state.selectedModel)} model locally.`,
        progress: 0,
        progressText: ""
      });
      this._renderRuntimeUI(win, state);
      const response = await this.aiCore.generate(message, systemPrompt, state.chatHistory);
      this._removePendingAssistantMessage(win, state);
      this._addMessageToChat("assistant", response.text, state, win);
      state.chatHistory.push({ role: "assistant", content: response.text });
      this._setRuntimeState(state, {
        statusTone: "ready",
        statusText: "Ready",
        statusDetail: this._describeLoadedModel(this.aiCore.model),
        progress: 0,
        progressText: ""
      });

      if (response.reasoning && state.showReasoning) {
        this._renderReasoning(response.reasoning, win);
      }

      const resolvedActions = this._resolveActions(response);
      if (resolvedActions.length > 0) {
        if (state.automationMode) {
          await this._executeActions(resolvedActions, win);
        } else {
          this._showPendingActions(resolvedActions, win);
        }
      }

      await this.memory.saveChatHistory(state.chatHistory);
    } catch (error) {
      this._removePendingAssistantMessage(win, state);
      this._addMessageToChat("system", `Error: ${error.message}`, state, win);
      this._setRuntimeState(state, {
        statusTone: "error",
        statusText: "Generation failed",
        statusDetail: error.message,
        progress: 0,
        progressText: ""
      });
    } finally {
      state.isGenerating = false;
      this._renderRuntimeUI(win, state);
    }
  }

  async _reloadEngine(win, state, detailText) {
    if (state.engineLoading) return;

    state.engineLoading = true;
    state.engineInitialized = false;
    this._setRuntimeState(state, {
      statusTone: "loading",
      statusText: "Reloading engine",
      statusDetail: detailText,
      progress: 0,
      progressText: ""
    });
    this._renderRuntimeUI(win, state);

    const success = await this.aiCore.initialize(
      state.selectedModel,
      state.webGPUEnabled,
      (report) => {
        if (typeof report.progress === "number") {
          this._setRuntimeState(state, {
            statusTone: "loading",
            statusText: "Reloading engine",
            statusDetail: report.text || detailText,
            progress: Math.round(report.progress * 100),
            progressText: report.text || ""
          });
          this._renderRuntimeUI(win, state);
        }
        if (report.error) {
          this._setRuntimeState(state, {
            statusTone: "error",
            statusText: "Reload failed",
            statusDetail: report.error,
            progress: 0,
            progressText: ""
          });
          this._renderRuntimeUI(win, state);
        }
      },
      { force: true }
    );

    state.engineLoading = false;

    if (success) {
      state.engineInitialized = true;
      state.currentModelId = this.aiCore.model;
      this._setRuntimeState(state, {
        statusTone: "ready",
        statusText: "Ready",
        statusDetail: this._describeLoadedModel(this.aiCore.model),
        progress: 0,
        progressText: ""
      });
    }

    this._renderRuntimeUI(win, state);
  }

  _getOSContext() {
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

  _buildSystemPrompt(context) {
    return `You are Yuki AI Assistant, built into YukiOS. Help users with tasks and run system actions when asked.

Current OS Context:
- Active Window: ${context.activeWindow || "None"}
- Running Apps: ${context.runningApps?.join(", ") || "None"}
- Workspace: ${context.workspace || "Default"}
- Windows: ${context.windows?.map((w) => `${w.title}(${w.id})`).join(", ") || "None"}

When the user requests actions, respond naturally first, then include a JSON block with structured actions:
\`\`\`json
[
  {"action": "action_type", "target": "target_value", "params": {}}
]
\`\`\`

Supported actions:
- open_app: Open an application (target: app_id)
- close_app: Close an application (target: app_id or window_id)
- focus_window: Focus a specific window (target: window_id)
- switch_workspace: Switch workspace (target: next/prev/workspace-id/workspace-name)
- move_window_to_workspace: Move a window to workspace (target: window_id, params: {workspaceId})
- fs_read: Read a file (target: file_path)
- fs_write: Write to a file (target: file_path, params: {content})
- set_theme: Change theme (target: theme_name)
- toggle_setting: Toggle a setting (target: setting_key)

Say what you're about to do before running an action. If it could be destructive, ask first.`;
  }

  _resolveActions(response) {
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

  async _executeActions(actions, win) {
    for (const action of actions) {
      try {
        const approved = await this._confirmActionIfNeeded(action);
        if (!approved) {
          this._logAction(action, { error: "Cancelled by user" }, win);
          continue;
        }
        if (this._requiresConfirmation(action)) {
          this.osBridge.grantPermission(action.action, action.target);
        }
        const result = await this.osBridge.execute(action);
        if (this._requiresConfirmation(action)) {
          this.osBridge.revokePermission(action.action, action.target);
        }
        this._logAction(action, result, win);
        os.events.emit("AI_ACTION_EXECUTED", { action, result });
      } catch (error) {
        if (this._requiresConfirmation(action)) {
          this.osBridge.revokePermission(action.action, action.target);
        }
        this._logAction(action, { error: error.message }, win);
      }
    }
  }

  _showPendingActions(actions, win) {
    const logContainer = $("#ai-action-log", win);
    actions.forEach((action) => {
      const item = document.createElement("div");
      item.className = "ai-log-item pending";
      item.innerHTML = `
        <span class="ai-log-action">${action.action}</span>
        <span class="ai-log-target">${action.target}</span>
        <button class="ai-log-execute" data-action='${JSON.stringify(action)}'>Execute</button>
      `;
      logContainer.appendChild(item);
    });

    logContainer.querySelectorAll(".ai-log-execute").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const action = JSON.parse(btn.dataset.action);
        btn.disabled = true;
        try {
          const approved = await this._confirmActionIfNeeded(action);
          if (!approved) {
            btn.parentElement.classList.add("error");
            return;
          }
          if (this._requiresConfirmation(action)) {
            this.osBridge.grantPermission(action.action, action.target);
          }
          const result = await this.osBridge.execute(action);
          if (this._requiresConfirmation(action)) {
            this.osBridge.revokePermission(action.action, action.target);
          }
          btn.parentElement.classList.remove("pending");
          btn.parentElement.classList.add("success");
          os.events.emit("AI_ACTION_EXECUTED", { action, result });
        } catch (error) {
          if (this._requiresConfirmation(action)) {
            this.osBridge.revokePermission(action.action, action.target);
          }
          btn.parentElement.classList.add("error");
        }
      });
    });
  }

  _logAction(action, result, win) {
    const logContainer = $("#ai-action-log", win);
    const item = document.createElement("div");
    item.className = `ai-log-item ${result.error ? "error" : "success"}`;
    item.innerHTML = `
      <span class="ai-log-action">${action.action}</span>
      <span class="ai-log-target">${action.target}</span>
      <span class="ai-log-result">${result.error ? result.error : "Success"}</span>
    `;
    logContainer.appendChild(item);
    this.actionLog.push({ action, result, timestamp: Date.now() });
  }

  _addMessageToChat(role, content, state, win) {
    const historyContainer = win?.querySelector("#ai-chat-history") || document.querySelector("#ai-chat-history");
    if (!historyContainer) return;

    const msgDiv = document.createElement("div");
    msgDiv.className = `ai-message ai-message-${role}`;
    msgDiv.innerHTML = `
      <div class="ai-message-role">${role === "user" ? "You" : "Assistant"}</div>
      <div class="ai-message-content">${this._formatMessage(content)}</div>
    `;
    historyContainer.appendChild(msgDiv);
    historyContainer.scrollTop = historyContainer.scrollHeight;
  }

  _appendPendingAssistantMessage(win, text) {
    const historyContainer = $("#ai-chat-history", win);
    if (!historyContainer) return null;

    const pendingId = `ai-pending-${Date.now()}`;
    const msgDiv = document.createElement("div");
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

  _removePendingAssistantMessage(win, state) {
    if (!state.pendingMessageId) return;
    const pendingMessage = $(`[data-pending-id="${state.pendingMessageId}"]`, win);
    pendingMessage?.remove();
    state.pendingMessageId = null;
  }

  _renderChatHistory(state, win) {
    const historyContainer = $("#ai-chat-history", win) || $("#ai-chat-history");
    if (!historyContainer) return;
    setHTML(historyContainer, "");
    state.chatHistory.forEach((msg) => {
      this._addMessageToChat(msg.role, msg.content, state, win);
    });
  }

  _renderReasoning(reasoning, win) {
    const reasoningContent = $("#ai-reasoning-content", win);
    if (reasoningContent) {
      setText(reasoningContent, reasoning);
    }
  }

  _formatMessage(content) {
    return content.replace(/\n/g, "<br>").replace(/```json\n?([\s\S]*?)```/g, '<pre class="ai-json-block">$1</pre>');
  }

  _getActionPrompt(action) {
    const prompts = {
      open_settings: "Open the Settings app",
      list_files: "List files in my Documents folder",
      open_terminal: "Open the Terminal app",
      switch_workspace: "Switch to the next workspace",
      open_explorer: "Open the Explorer app",
      open_browser: "Open the Yuki Browser app",
      open_news: "Open What's New app",
      open_weather: "Open the Weather app",
      open_task_manager: "Open the Task Manager app",
      open_notepad: "Open the Notepad app",
      read_info_file: "Read /home/reeyuki/Documents/INFO.txt",
      show_windows: "Show me my running windows and suggest workspace organization",
      set_dark_theme: "Change theme to dark",
      set_light_theme: "Change theme to light",
      toggle_dnd: "Toggle Do Not Disturb setting"
    };
    return prompts[action] || "";
  }

  _buildQuickActionsMarkup() {
    const sections = [
      {
        title: "Apps",
        items: [
          ["open_settings", "Open Settings", "Change theme and system preferences.", "fas fa-cog"],
          ["open_terminal", "Open Terminal", "Launch command line tools.", "fas fa-terminal"],
          ["open_explorer", "Open Explorer", "Browse and manage files.", "fas fa-folder-open"],
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
          ["toggle_dnd", "Toggle DND", "Enable or disable notifications.", "fas fa-bell-slash"]
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
          ["open_weather", "Open Weather", "Check current forecast.", "fas fa-cloud-sun"]
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

  _requiresConfirmation(action) {
    return action.action === "fs_write" || action.action === "close_app";
  }

  async _confirmActionIfNeeded(action) {
    if (!this._requiresConfirmation(action)) {
      return true;
    }
    if (action.action === "fs_write") {
      return os.dialog.confirm(
        "Confirm File Write",
        `Allow AI to write to "${action.target}"?`,
        "Allow Write",
        "Cancel"
      );
    }
    if (action.action === "close_app") {
      return os.dialog.confirm("Confirm App Close", `Allow AI to close "${action.target}"?`, "Close App", "Cancel");
    }
    return true;
  }

  _setRuntimeState(state, updates) {
    Object.assign(state, updates);
  }

  _describeLoadedModel(modelId) {
    if (!modelId) {
      return "No local model loaded.";
    }
    return `Loaded: ${modelId.replace(/-MLC$/, "")}`;
  }

  _getModelProfileLabel(modelType) {
    const labels = {
      low: "Low Quality",
      fast: "Low Quality",
      smart: "High Quality"
    };
    return labels[modelType] || "Custom";
  }

  _renderRuntimeUI(win, state) {
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
    }
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
