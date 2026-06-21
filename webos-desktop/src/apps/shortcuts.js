import "../styles/shortcuts.css";
import { BaseApp, PersistenceTypes } from "../framework.js";
import { KeybindManager } from "../keybindManager.js";

const MODIFIER_KEY_MAP = {
  Control: "Ctrl",
  Shift: "Shift",
  Alt: "Alt",
  Meta: "Cmd"
};

export class ShortcutsApp extends BaseApp {
  constructor(services) {
    super(services);
    this.listeningId = null;
    this.listeningOverlay = null;
    this.editingCustomId = null;
  }

  getDeclarativeSchema(opts) {
    return {
      id: "shortcuts-app",
      name: "Keyboard Shortcuts",
      icon: "fa fa-keyboard",
      windows: [
        {
          id: "shortcuts-app",
          title: "Keyboard Shortcuts",
          size: ["820px", "620px"],
          icon: "fa fa-keyboard",
          ui: `
      <div class="sc-app-wrapper">
        <div class="sc-sidebar">
          <div class="sc-search-wrap">
            <div class="sc-search-container">
              <i class="fas fa-search sc-search-icon"></i>
              <input type="text" class="sc-search-input" placeholder="Search shortcuts..." spellcheck="false">
            </div>
          </div>
          <div class="sc-nav">
            <div class="sc-nav-item active" data-cat="all"><i class="fas fa-keyboard"></i>All Shortcuts</div>
            <div class="sc-nav-item" data-cat="global"><i class="fas fa-globe"></i>Global & System</div>
            <div class="sc-nav-item" data-cat="desktop"><i class="fas fa-desktop"></i>Desktop & Files</div>
            <div class="sc-nav-item" data-cat="notepad"><i class="fas fa-file-alt"></i>Notepad</div>
            <div class="sc-nav-item" data-cat="browser"><i class="fas fa-compass"></i>Yuki Browser</div>
            <div class="sc-nav-item" data-cat="calc"><i class="fas fa-calculator"></i>Calculator</div>
            <div class="sc-nav-item" data-cat="calendar"><i class="fas fa-calendar-alt"></i>Calendar</div>
            <div class="sc-nav-item" data-cat="terminal"><i class="fas fa-terminal"></i>Terminal</div>
            <div class="sc-nav-item" data-cat="office"><i class="fas fa-file-word"></i>Office</div>
            <div class="sc-nav-item" data-cat="model3d"><i class="fas fa-cube"></i>3D Model Editor</div>
            <div class="sc-nav-item" data-cat="games"><i class="fas fa-gamepad"></i>Games</div>
            <div class="sc-nav-item" data-cat="custom"><i class="fas fa-star"></i>Custom</div>
          </div>
        </div>
        <div class="sc-main">
          <div class="sc-list-header">
            <div class="sc-list-title">All Shortcuts</div>
            <div class="sc-list-actions">
              <span class="sc-list-count">No shortcuts</span>
              <button class="sc-create-btn" id="sc-create-custom" title="Create a custom shortcut">
                <i class="fas fa-plus"></i> Custom
              </button>
              <button class="sc-reset-all-btn" id="sc-reset-all" title="Reset all shortcuts to defaults">
                <i class="fas fa-undo-alt"></i> Reset All
              </button>
            </div>
          </div>
          <div class="sc-content-area">
            <div class="sc-grid" id="sc-list-container"></div>
          </div>
        </div>
      </div>
      <div class="sc-listening-overlay" id="sc-listening-overlay" style="display:none">
        <div class="sc-listening-modal">
          <div class="sc-listening-icon"><i class="fas fa-keyboard"></i></div>
          <div class="sc-listening-title">Press new shortcut key...</div>
          <div class="sc-listening-desc" id="sc-listening-desc">Currently: <span id="sc-listening-current"></span></div>
          <div class="sc-listening-preview" id="sc-listening-preview"></div>
          <div class="sc-listening-actions">
            <button class="sc-listening-cancel" id="sc-listening-cancel">Cancel</button>
            <button class="sc-listening-clear" id="sc-listening-clear">Clear & Reset</button>
          </div>
        </div>
      </div>
      <div class="sc-custom-overlay" id="sc-custom-overlay" style="display:none">
        <div class="sc-custom-modal">
          <div class="sc-custom-header">
            <div class="sc-custom-title" id="sc-custom-title">Create Custom Shortcut</div>
            <button class="sc-custom-close" id="sc-custom-close"><i class="fas fa-times"></i></button>
          </div>
          <div class="sc-custom-body">
            <div class="sc-custom-field">
              <label class="sc-custom-label">Shortcut Keys</label>
              <div class="sc-custom-keys" id="sc-custom-keys">
                <span class="sc-custom-keys-placeholder" id="sc-custom-keys-placeholder">Click to record...</span>
              </div>
            </div>
            <div class="sc-custom-field">
              <label class="sc-custom-label">Description</label>
              <input type="text" class="sc-custom-input" id="sc-custom-desc" placeholder="Describe what this shortcut does..." spellcheck="false">
            </div>
            <div class="sc-custom-field">
              <label class="sc-custom-label">Action Type</label>
              <div class="sc-custom-action-types" id="sc-custom-action-types">
                <label class="sc-custom-action-type active" data-type="launchApp">
                  <input type="radio" name="actionType" value="launchApp" checked hidden>
                  <i class="fas fa-rocket"></i>
                  <span>Launch App</span>
                </label>
                <label class="sc-custom-action-type" data-type="openUrl">
                  <input type="radio" name="actionType" value="openUrl" hidden>
                  <i class="fas fa-link"></i>
                  <span>Open URL</span>
                </label>
                <label class="sc-custom-action-type" data-type="runCode">
                  <input type="radio" name="actionType" value="runCode" hidden>
                  <i class="fas fa-code"></i>
                  <span>Run Code</span>
                </label>
                <label class="sc-custom-action-type" data-type="notify">
                  <input type="radio" name="actionType" value="notify" hidden>
                  <i class="fas fa-bell"></i>
                  <span>Notify</span>
                </label>
              </div>
            </div>
            <div class="sc-custom-config" id="sc-custom-config">
              <div class="sc-custom-config-fields" id="sc-custom-config-fields"></div>
            </div>
          </div>
          <div class="sc-custom-footer">
            <button class="sc-custom-btn sc-custom-btn-secondary" id="sc-custom-cancel">Cancel</button>
            <button class="sc-custom-btn sc-custom-btn-primary" id="sc-custom-save">
              <i class="fas fa-check"></i> Save
            </button>
          </div>
        </div>
      </div>`,
          events: {
            ".sc-search-input": {
              input: {
                type: "custom:filterShortcuts",
                stopPropagation: false
              }
            },
            ".sc-nav-item": {
              click: {
                type: "custom:changeCategory",
                stopPropagation: true
              }
            }
          }
        }
      ],
      state: {
        initial: {
          currentCategory: "all",
          searchQuery: ""
        },
        persistence: PersistenceTypes.NONE
      },
      actions: {
        initShortcuts: (payload, event, element, state) => {
          this.initShortcuts(payload, event, element, state);
        },
        filterShortcuts: (payload, event, element, state) => {
          state.searchQuery = event.target.value;
        },
        changeCategory: (payload, event, element, state) => {
          state.currentCategory = element.dataset.cat;
        }
      },
      onMount: "initShortcuts"
    };
  }

  initShortcuts(payload, event, element, state) {
    this.setupAppLogic(element);
  }

  formatKeys(keys) {
    return keys
      .map((k) => {
        const lower = k.toLowerCase();
        if (lower === "ctrl" || lower === "control") return "Ctrl";
        if (lower === "shift") return "Shift";
        if (lower === "alt" || lower === "option") return "Alt";
        if (lower === "meta" || lower === "cmd" || lower === "command" || lower === "super") return "Cmd";
        if (k === "ArrowLeft") return "←";
        if (k === "ArrowRight") return "→";
        if (k === "ArrowUp") return "↑";
        if (k === "ArrowDown") return "↓";
        return k;
      })
      .join(" + ");
  }

  getActionTypeLabel(type) {
    const labels = {
      launchApp: "Launch App",
      openUrl: "Open URL",
      runCode: "Run Code",
      notify: "Notify"
    };
    return labels[type] || type;
  }

  getActionTypeIcon(type) {
    const icons = {
      launchApp: "fas fa-rocket",
      openUrl: "fas fa-link",
      runCode: "fas fa-code",
      notify: "fas fa-bell"
    };
    return icons[type] || "fas fa-star";
  }

  setupAppLogic(win) {
    const listContainer = win.querySelector("#sc-list-container");
    const searchInput = win.querySelector(".sc-search-input");
    const navItems = win.querySelectorAll(".sc-nav-item");
    const listTitle = win.querySelector(".sc-list-title");
    const listCount = win.querySelector(".sc-list-count");
    const resetAllBtn = win.querySelector("#sc-reset-all");
    const createBtn = win.querySelector("#sc-create-custom");
    const listeningOverlay = win.querySelector("#sc-listening-overlay");
    const listeningDesc = win.querySelector("#sc-listening-desc");
    const listeningCurrent = win.querySelector("#sc-listening-current");
    const listeningPreview = win.querySelector("#sc-listening-preview");
    const listeningCancel = win.querySelector("#sc-listening-cancel");
    const listeningClear = win.querySelector("#sc-listening-clear");

    const customOverlay = win.querySelector("#sc-custom-overlay");
    const customTitle = win.querySelector("#sc-custom-title");
    const customClose = win.querySelector("#sc-custom-close");
    const customDesc = win.querySelector("#sc-custom-desc");
    const customKeysEl = win.querySelector("#sc-custom-keys");
    const customKeysPlaceholder = win.querySelector("#sc-custom-keys-placeholder");
    const customActionTypes = win.querySelector("#sc-custom-action-types");
    const customConfigFields = win.querySelector("#sc-custom-config-fields");
    const customSave = win.querySelector("#sc-custom-save");
    const customCancel = win.querySelector("#sc-custom-cancel");

    let currentCategory = "all";
    let customRecordedKeys = [];
    let customEditingId = null;

    const getCategoryLabel = (cat) => {
      const labels = {
        all: "All Shortcuts",
        global: "Global & System",
        desktop: "Desktop & Files",
        notepad: "Notepad",
        browser: "Yuki Browser",
        calc: "Calculator",
        calendar: "Calendar",
        terminal: "Terminal",
        office: "Office",
        model3d: "3D Model Editor",
        games: "Games",
        custom: "Custom"
      };
      return labels[cat] || "Shortcuts";
    };

    const getItemId = (shortcut) => `sc-item-${shortcut.id.replace(/\./g, "-")}`;

    const startListening = (shortcut, keyDisplayEl) => {
      this.listeningId = shortcut.id;
      listeningOverlay.style.display = "flex";
      listeningCurrent.textContent = this.formatKeys(shortcut.currentKeys);
      listeningPreview.innerHTML = "";
      listeningPreview.className = "sc-listening-preview";

      const handleKey = (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (e.key === "Escape") {
          stopListening();
          return;
        }
        if (e.key === "Enter") return;
        if (e.key === "Tab") {
          e.preventDefault();
          return;
        }
        if (e.key === "Shift" || e.key === "Control" || e.key === "Alt" || e.key === "Meta") {
          listeningPreview.innerHTML = "";
          const msg = document.createElement("div");
          msg.className = "sc-listening-msg";
          msg.textContent = "Press a non-modifier key...";
          listeningPreview.appendChild(msg);
          return;
        }

        const recorded = [];
        if (e.ctrlKey) recorded.push("Ctrl");
        if (e.shiftKey) recorded.push("Shift");
        if (e.altKey) recorded.push("Alt");
        if (e.metaKey) recorded.push("Meta");
        recorded.push(e.key === " " ? "Space" : e.key);

        if (KeybindManager.isCustomizationValid(recorded)) {
          KeybindManager.setKeys(this.listeningId, recorded);
          listeningPreview.innerHTML = "";
          const ok = document.createElement("div");
          ok.className = "sc-listening-ok";
          ok.innerHTML = `<i class="fas fa-check"></i> Set to ${this.formatKeys(recorded)}`;
          listeningPreview.appendChild(ok);
          stopListening();
          render();
        } else {
          listeningPreview.innerHTML = "";
          const err = document.createElement("div");
          err.className = "sc-listening-err";
          err.textContent = "Invalid shortcut (must include exactly one non-modifier key)";
          listeningPreview.appendChild(err);
        }
      };

      const stopListening = () => {
        listeningOverlay.style.display = "none";
        this.listeningId = null;
        document.removeEventListener("keydown", handleKey, true);
      };

      document.addEventListener("keydown", handleKey, true);

      listeningCancel.onclick = () => stopListening();
      listeningClear.onclick = () => {
        KeybindManager.reset(this.listeningId);
        listeningPreview.innerHTML = "";
        const ok = document.createElement("div");
        ok.className = "sc-listening-ok";
        ok.innerHTML = `<i class="fas fa-undo"></i> Reset to default`;
        listeningPreview.appendChild(ok);
        stopListening();
        render();
      };
    };

    const renderConfigFields = (type, currentConfig) => {
      customConfigFields.innerHTML = "";

      if (type === "launchApp") {
        const appId = currentConfig?.appId || "";
        const label = document.createElement("label");
        label.className = "sc-custom-label";
        label.textContent = "App ID";
        const input = document.createElement("input");
        input.type = "text";
        input.className = "sc-custom-input sc-custom-config-input";
        input.placeholder = "e.g. terminal, calculator, notepad";
        input.value = appId;
        input.dataset.configKey = "appId";
        customConfigFields.appendChild(label);
        customConfigFields.appendChild(input);

        const hint = document.createElement("div");
        hint.className = "sc-custom-hint";
        hint.textContent = "TIP: Use os.app.getAllApps() to see all available app IDs";
        customConfigFields.appendChild(hint);

        const appList = document.createElement("div");
        appList.className = "sc-custom-app-list";
        appList.id = "sc-custom-app-list";
        customConfigFields.appendChild(appList);

        const renderAppSuggestions = (query) => {
          appList.innerHTML = "";
          try {
            const allApps = os.app.getAllApps();
            const entries = Object.entries(allApps)
              .filter(([id, info]) => {
                const q = query.toLowerCase();
                return !q || id.toLowerCase().includes(q) || (info.title || "").toLowerCase().includes(q);
              })
              .slice(0, 20);

            if (entries.length === 0) {
              appList.innerHTML = '<div class="sc-custom-app-empty">No matching apps</div>';
              return;
            }

            entries.forEach(([id, info]) => {
              const item = document.createElement("div");
              item.className = "sc-custom-app-item";
              const icon = info.icon || "fas fa-puzzle-piece";
              item.innerHTML = `<i class="${icon}"></i><span class="sc-custom-app-title">${info.title || id}</span><span class="sc-custom-app-id">${id}</span>`;
              item.addEventListener("click", () => {
                input.value = id;
                appList.innerHTML = "";
              });
              appList.appendChild(item);
            });
          } catch (e) {
            appList.innerHTML = '<div class="sc-custom-app-empty">Could not load app list</div>';
          }
        };

        input.addEventListener("input", () => renderAppSuggestions(input.value));
        input.addEventListener("focus", () => renderAppSuggestions(input.value));
      } else if (type === "openUrl") {
        const url = currentConfig?.url || "";
        const label = document.createElement("label");
        label.className = "sc-custom-label";
        label.textContent = "URL";
        const input = document.createElement("input");
        input.type = "text";
        input.className = "sc-custom-input sc-custom-config-input";
        input.placeholder = "https://example.com";
        input.value = url;
        input.dataset.configKey = "url";
        customConfigFields.appendChild(label);
        customConfigFields.appendChild(input);
      } else if (type === "runCode") {
        const code = currentConfig?.code || "";
        const label = document.createElement("label");
        label.className = "sc-custom-label";
        label.textContent = "JavaScript Code";
        const warning = document.createElement("div");
        warning.className = "sc-custom-warning";
        warning.innerHTML =
          '<i class="fas fa-exclamation-triangle"></i> The <code>os</code> object is available. Be careful with eval-style execution.';
        customConfigFields.appendChild(warning);
        const textarea = document.createElement("textarea");
        textarea.className = "sc-custom-textarea sc-custom-config-input";
        textarea.placeholder = `os.notify.send("Hello", "World");`;
        textarea.value = code;
        textarea.dataset.configKey = "code";
        textarea.rows = 6;
        customConfigFields.appendChild(label);
        customConfigFields.appendChild(textarea);
      } else if (type === "notify") {
        const title = currentConfig?.title || "";
        const message = currentConfig?.message || "";
        const label1 = document.createElement("label");
        label1.className = "sc-custom-label";
        label1.textContent = "Notification Title";
        const input1 = document.createElement("input");
        input1.type = "text";
        input1.className = "sc-custom-input sc-custom-config-input";
        input1.placeholder = "Shortcut Triggered!";
        input1.value = title;
        input1.dataset.configKey = "title";
        customConfigFields.appendChild(label1);
        customConfigFields.appendChild(input1);
        const label2 = document.createElement("label");
        label2.className = "sc-custom-label";
        label2.textContent = "Message";
        const input2 = document.createElement("input");
        input2.type = "text";
        input2.className = "sc-custom-input sc-custom-config-input";
        input2.placeholder = "Your custom shortcut was executed.";
        input2.value = message;
        input2.dataset.configKey = "message";
        customConfigFields.appendChild(label2);
        customConfigFields.appendChild(input2);
      }
    };

    const openCustomModal = (editData) => {
      customEditingId = editData ? editData.id : null;
      customTitle.textContent = editData ? "Edit Custom Shortcut" : "Create Custom Shortcut";
      customDesc.value = editData ? editData.desc : "";
      customRecordedKeys = editData ? [...editData.currentKeys] : [];
      customKeysPlaceholder.textContent =
        customRecordedKeys.length > 0 ? this.formatKeys(customRecordedKeys) : "Click to record...";

      const actionType = editData?.action?.type || "launchApp";
      const actionConfig = editData?.action?.config || {};

      customActionTypes.querySelectorAll(".sc-custom-action-type").forEach((el) => {
        el.classList.toggle("active", el.dataset.type === actionType);
        el.querySelector("input").checked = el.dataset.type === actionType;
      });

      renderConfigFields(actionType, actionConfig);
      customOverlay.style.display = "flex";
    };

    const closeCustomModal = () => {
      customOverlay.style.display = "none";
      customEditingId = null;
      customRecordedKeys = [];
    };

    const saveCustomAction = () => {
      const desc = customDesc.value.trim();
      if (!desc) {
        customDesc.focus();
        customDesc.style.borderColor = "var(--error)";
        setTimeout(() => {
          customDesc.style.borderColor = "";
        }, 2000);
        return;
      }
      if (customRecordedKeys.length === 0) {
        customKeysEl.style.borderColor = "var(--error)";
        setTimeout(() => {
          customKeysEl.style.borderColor = "";
        }, 2000);
        return;
      }

      const activeType = customActionTypes.querySelector(".sc-custom-action-type.active");
      const actionType = activeType ? activeType.dataset.type : "launchApp";

      const config = {};
      customConfigFields.querySelectorAll(".sc-custom-config-input").forEach((el) => {
        config[el.dataset.configKey] = el.value;
      });

      if (actionType === "launchApp" && !config.appId) return;
      if (actionType === "openUrl" && !config.url) return;
      if (actionType === "runCode" && !config.code) return;
      if (actionType === "notify" && !config.title) return;

      const definition = {
        id: customEditingId || undefined,
        defaultKeys: customRecordedKeys,
        desc: desc,
        icon: this.getActionTypeIcon(actionType),
        action: {
          type: actionType,
          config: config
        }
      };

      if (customEditingId) {
        definition.id = customEditingId;
        KeybindManager.saveCustomAction(definition);
      } else {
        const newId = KeybindManager.saveCustomAction(definition);
        KeybindManager.setKeys(newId, customRecordedKeys);
      }

      closeCustomModal();
      render();
    };

    customKeysEl.addEventListener("click", () => {
      const overlay = customOverlay;
      const origDisplay = listeningOverlay.style.display;
      listeningOverlay.style.display = "flex";
      listeningCurrent.textContent = customRecordedKeys.length > 0 ? this.formatKeys(customRecordedKeys) : "None";
      listeningPreview.innerHTML = "";
      listeningPreview.className = "sc-listening-preview";

      const handleKey = (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (e.key === "Escape") {
          stopListening();
          return;
        }
        if (e.key === "Enter") return;
        if (e.key === "Tab") {
          e.preventDefault();
          return;
        }
        if (e.key === "Shift" || e.key === "Control" || e.key === "Alt" || e.key === "Meta") {
          listeningPreview.innerHTML = "";
          const msg = document.createElement("div");
          msg.className = "sc-listening-msg";
          msg.textContent = "Press a non-modifier key...";
          listeningPreview.appendChild(msg);
          return;
        }

        const recorded = [];
        if (e.ctrlKey) recorded.push("Ctrl");
        if (e.shiftKey) recorded.push("Shift");
        if (e.altKey) recorded.push("Alt");
        if (e.metaKey) recorded.push("Meta");
        recorded.push(e.key === " " ? "Space" : e.key);

        if (KeybindManager.isCustomizationValid(recorded)) {
          customRecordedKeys = recorded;
          customKeysPlaceholder.textContent = this.formatKeys(recorded);
          listeningPreview.innerHTML = "";
          const ok = document.createElement("div");
          ok.className = "sc-listening-ok";
          ok.innerHTML = `<i class="fas fa-check"></i> Set to ${this.formatKeys(recorded)}`;
          listeningPreview.appendChild(ok);
          stopListening();
        } else {
          listeningPreview.innerHTML = "";
          const err = document.createElement("div");
          err.className = "sc-listening-err";
          err.textContent = "Invalid shortcut (must include exactly one non-modifier key)";
          listeningPreview.appendChild(err);
        }
      };

      const stopListening = () => {
        listeningOverlay.style.display = "none";
        document.removeEventListener("keydown", handleKey, true);
      };

      document.addEventListener("keydown", handleKey, true);
      listeningCancel.onclick = () => stopListening();
      listeningClear.onclick = () => {
        customRecordedKeys = [];
        customKeysPlaceholder.textContent = "Click to record...";
        stopListening();
      };
    });

    customActionTypes.addEventListener("change", (e) => {
      if (e.target.name === "actionType") {
        customActionTypes.querySelectorAll(".sc-custom-action-type").forEach((el) => {
          el.classList.toggle("active", el.querySelector("input").checked);
        });
        renderConfigFields(e.target.value, {});
      }
    });

    customActionTypes.addEventListener("click", (e) => {
      const typeEl = e.target.closest(".sc-custom-action-type");
      if (typeEl) {
        typeEl.querySelector("input").checked = true;
        typeEl.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });

    customSave.addEventListener("click", saveCustomAction);
    customCancel.addEventListener("click", closeCustomModal);
    customClose.addEventListener("click", closeCustomModal);
    customOverlay.addEventListener("click", (e) => {
      if (e.target === customOverlay) closeCustomModal();
    });

    const render = () => {
      const search = searchInput.value.trim().toLowerCase();
      listContainer.innerHTML = "";

      let shortcuts = KeybindManager.getAll();

      if (currentCategory !== "all") {
        shortcuts = shortcuts.filter((s) => s.cat === currentCategory);
      }

      if (search) {
        shortcuts = shortcuts.filter((s) => {
          const matchDesc = s.desc.toLowerCase().includes(search);
          const matchKeys = s.currentKeys.some((k) => k.toLowerCase().includes(search));
          const matchCat = getCategoryLabel(s.cat).toLowerCase().includes(search);
          return matchDesc || matchKeys || matchCat;
        });
      }

      listTitle.textContent = getCategoryLabel(currentCategory);
      const customized = shortcuts.filter((s) => KeybindManager.isCustomized(s.id)).length;
      const customCount = shortcuts.filter((s) => s.cat === "custom").length;
      listCount.textContent = `${shortcuts.length} item${shortcuts.length !== 1 ? "s" : ""}${customized > 0 ? ` (${customized} customized)` : ""}${customCount > 0 ? ` · ${customCount} custom` : ""}`;

      if (shortcuts.length === 0) {
        listContainer.innerHTML = `
          <div class="sc-empty-state">
            <i class="fas fa-keyboard"></i>
            <div>No matching keyboard shortcuts found.</div>
            ${currentCategory === "custom" ? '<div class="sc-empty-hint">Click "Custom" button above to create your first custom shortcut.</div>' : ""}
          </div>
        `;
        return;
      }

      shortcuts.forEach((item) => {
        const card = document.createElement("div");
        card.className = "sc-card";
        card.id = getItemId(item);
        if (KeybindManager.isCustomized(item.id)) {
          card.classList.add("sc-card-customized");
        }
        if (item.cat === "custom") {
          card.classList.add("sc-card-custom");
        }

        const isCustom = item.cat === "custom";
        const keysHtml = item.currentKeys
          .map((k) => `<kbd>${this.formatKeys([k])}</kbd>`)
          .join('<span class="sc-card-plus">+</span>');

        let actionBadge = "";
        if (isCustom && item.action) {
          actionBadge = `<span class="sc-card-action-badge"><i class="${this.getActionTypeIcon(item.action.type)}"></i> ${this.getActionTypeLabel(item.action.type)}</span>`;
        }

        card.innerHTML = `
          <div class="sc-card-left">
            <div class="sc-card-icon-wrap">
              <i class="${item.icon}"></i>
            </div>
            <div class="sc-card-info">
              <div class="sc-card-desc">${item.desc}</div>
              <div class="sc-card-id">${isCustom ? "Custom" : item.id}${actionBadge}</div>
            </div>
          </div>
          <div class="sc-card-right">
            <div class="sc-card-keys" data-shortcut-id="${item.id}">
              ${keysHtml}
              <span class="sc-card-rec-hint">Click to rebind</span>
            </div>
            <button class="sc-card-reset" data-shortcut-id="${item.id}" title="${isCustom ? "Delete" : "Reset to default"}">
              <i class="fas ${isCustom ? "fa-trash" : "fa-undo"}"></i>
            </button>
          </div>
        `;

        const keysArea = card.querySelector(".sc-card-keys");
        keysArea.addEventListener("click", () => {
          startListening(item, keysArea);
        });

        const resetBtn = card.querySelector(".sc-card-reset");
        resetBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          if (isCustom) {
            if (confirm("Delete this custom shortcut?")) {
              KeybindManager.deleteCustomAction(item.id);
              render();
            }
          } else {
            if (KeybindManager.isCustomized(item.id)) {
              KeybindManager.reset(item.id);
              render();
            }
          }
        });

        if (isCustom) {
          card.addEventListener("dblclick", () => {
            const action = KeybindManager.getCustomAction(item.id);
            if (action) openCustomModal(action);
          });
        }

        listContainer.appendChild(card);
      });
    };

    searchInput.addEventListener("input", () => render());

    navItems.forEach((nav) => {
      nav.addEventListener("click", () => {
        navItems.forEach((n) => n.classList.remove("active"));
        nav.classList.add("active");
        currentCategory = nav.dataset.cat;
        render();
      });
    });

    createBtn.addEventListener("click", () => {
      openCustomModal(null);
    });

    resetAllBtn.addEventListener("click", () => {
      if (KeybindManager.getCustomizedCount() > 0) {
        KeybindManager.resetAll();
        render();
      }
    });

    render();
  }

  onClose(winId) {
    if (this.listeningId) {
      this.listeningId = null;
    }
  }
}
