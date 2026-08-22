import "../styles/shortcuts.css";
import { Achievements } from "../achievements.js";
import { BusEvents, os, createElement } from "../framework.js";
import { KeybindManager } from "../keybindManager.js";
import { $, $$ } from "./domUtils.js";

const CATEGORY_LABELS = {
  all: "All Shortcuts",
  global: "Global & System",
  desktop: "Desktop & Files",
  notepad: "Notepad",
  browser: "Yuki Browser",
  calc: "Calculator",
  calendar: "Calendar",
  terminal: "Terminal",
  office: "Office",
  games: "Games",
  steamdeck: "Yuki Deck",
  custom: "Custom"
};

function getCategoryLabel(cat) {
  return CATEGORY_LABELS[cat] || "Shortcuts";
}

function getItemId(shortcut) {
  return `sc-item-${shortcut.id.replace(/\./g, "-")}`;
}

function formatKeys(keys) {
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

function getActionTypeLabel(type) {
  const labels = {
    launchApp: "Launch App",
    openUrl: "Open URL",
    runCode: "Run Code",
    notify: "Notify"
  };
  return labels[type] || type;
}

function getActionTypeIcon(type) {
  const icons = {
    launchApp: "fas fa-rocket",
    openUrl: "fas fa-link",
    runCode: "fas fa-code",
    notify: "fas fa-bell"
  };
  return icons[type] || "fas fa-star";
}

export function mountShortcutsPanel(container, options = {}) {
  const embedded = !!options.embedded;

  container.innerHTML = `
    <div class="sc-app-wrapper${embedded ? " embedded" : ""}">
      <div class="sc-sidebar">
        <div class="sc-search-wrap">
          <div class="sc-search-container">
            <i class="fas fa-search sc-search-icon"></i>
            <input type="text" class="sc-search-input" placeholder="Search shortcuts..." spellcheck="false">
          </div>
        </div>
        <div class="sc-nav">
          <div class="sc-nav-item active" data-cat="desktop"><i class="fas fa-desktop"></i>Desktop & Files</div>
          <div class="sc-nav-item" data-cat="all"><i class="fas fa-keyboard"></i>All Shortcuts</div>
          <div class="sc-nav-item" data-cat="global"><i class="fas fa-globe"></i>Global & System</div>
          <div class="sc-nav-item" data-cat="notepad"><i class="fas fa-file-alt"></i>Notepad</div>
          <div class="sc-nav-item" data-cat="browser"><i class="fas fa-compass"></i>Yuki Browser</div>
          <div class="sc-nav-item" data-cat="calc"><i class="fas fa-calculator"></i>Calculator</div>
          <div class="sc-nav-item" data-cat="calendar"><i class="fas fa-calendar-alt"></i>Calendar</div>
          <div class="sc-nav-item" data-cat="terminal"><i class="fas fa-terminal"></i>Terminal</div>
          <div class="sc-nav-item" data-cat="office"><i class="fas fa-file-word"></i>Office</div>
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
    </div>`;

  const listContainer = $("#sc-list-container", container);
  const searchInput = $(".sc-search-input", container);
  const navItems = $$(".sc-nav-item", container);
  const listTitle = $(".sc-list-title", container);
  const listCount = $(".sc-list-count", container);
  const resetAllBtn = $("#sc-reset-all", container);
  const createBtn = $("#sc-create-custom", container);
  const listeningOverlay = $("#sc-listening-overlay", container);
  const listeningCurrent = $("#sc-listening-current", container);
  const listeningPreview = $("#sc-listening-preview", container);
  const listeningCancel = $("#sc-listening-cancel", container);
  const listeningClear = $("#sc-listening-clear", container);

  const customOverlay = $("#sc-custom-overlay", container);
  const customTitle = $("#sc-custom-title", container);
  const customClose = $("#sc-custom-close", container);
  const customDesc = $("#sc-custom-desc", container);
  const customKeysEl = $("#sc-custom-keys", container);
  const customKeysPlaceholder = $("#sc-custom-keys-placeholder", container);
  const customActionTypes = $("#sc-custom-action-types", container);
  const customConfigFields = $("#sc-custom-config-fields", container);
  const customSave = $("#sc-custom-save", container);
  const customCancel = $("#sc-custom-cancel", container);

  let currentCategory = "desktop";
  let customRecordedKeys = [];
  let customEditingId = null;
  let documentKeyHandler = null;

  const showPreviewMessage = (className, html) => {
    listeningPreview.innerHTML = "";
    const el = createElement("div");
    el.className = className;
    el.innerHTML = html;
    listeningPreview.appendChild(el);
  };

  const stopCapture = () => {
    if (!documentKeyHandler) return;
    document.removeEventListener("keydown", documentKeyHandler, true);
    documentKeyHandler = null;
    listeningOverlay.style.display = "none";
  };

  const beginKeyCapture = ({ currentKeys, onValid, onReset }) => {
    stopCapture();
    listeningOverlay.style.display = "flex";
    listeningCurrent.textContent = currentKeys && currentKeys.length > 0 ? formatKeys(currentKeys) : "None";
    listeningPreview.innerHTML = "";
    listeningPreview.className = "sc-listening-preview";

    const handleKey = (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === "Escape") {
        stopCapture();
        return;
      }
      if (e.key === "Enter") return;
      if (e.key === "Tab") {
        e.preventDefault();
        return;
      }
      if (e.key === "Shift" || e.key === "Control" || e.key === "Alt" || e.key === "Meta") {
        showPreviewMessage("sc-listening-msg", "Press a non-modifier key...");
        return;
      }

      const recorded = [];
      if (e.ctrlKey) recorded.push("Ctrl");
      if (e.shiftKey) recorded.push("Shift");
      if (e.altKey) recorded.push("Alt");
      if (e.metaKey) recorded.push("Meta");
      recorded.push(e.key === " " ? "Space" : e.key);

      if (KeybindManager.isCustomizationValid(recorded)) {
        showPreviewMessage("sc-listening-ok", `<i class="fas fa-check"></i> Set to ${formatKeys(recorded)}`);
        onValid(recorded);
        stopCapture();
      } else {
        showPreviewMessage("sc-listening-err", "Invalid shortcut (must include exactly one non-modifier key)");
      }
    };

    documentKeyHandler = handleKey;
    document.addEventListener("keydown", handleKey, true);

    listeningCancel.onclick = () => stopCapture();
    listeningClear.onclick = () => {
      onReset();
      stopCapture();
    };
  };

  const renderConfigFields = (type, currentConfig) => {
    customConfigFields.innerHTML = "";

    if (type === "launchApp") {
      const appId = currentConfig?.appId || "";
      const label = createElement("label");
      label.className = "sc-custom-label";
      label.textContent = "App ID";
      const input = createElement("input");
      input.type = "text";
      input.className = "sc-custom-input sc-custom-config-input";
      input.placeholder = "e.g. terminal, calculator, notepad";
      input.value = appId;
      input.dataset.configKey = "appId";
      customConfigFields.appendChild(label);
      customConfigFields.appendChild(input);

      const hint = createElement("div");
      hint.className = "sc-custom-hint";
      hint.textContent = "TIP: Use os.app.getAllApps() to see all available app IDs";
      customConfigFields.appendChild(hint);

      const appList = createElement("div");
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
            const item = createElement("div");
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
      const label = createElement("label");
      label.className = "sc-custom-label";
      label.textContent = "URL";
      const input = createElement("input");
      input.type = "text";
      input.className = "sc-custom-input sc-custom-config-input";
      input.placeholder = "https://example.com";
      input.value = url;
      input.dataset.configKey = "url";
      customConfigFields.appendChild(label);
      customConfigFields.appendChild(input);
    } else if (type === "runCode") {
      const code = currentConfig?.code || "";
      const label = createElement("label");
      label.className = "sc-custom-label";
      label.textContent = "JavaScript Code";
      const warning = createElement("div");
      warning.className = "sc-custom-warning";
      warning.innerHTML =
        '<i class="fas fa-exclamation-triangle"></i> The <code>os</code> object is available. Be careful with eval-style execution.';
      customConfigFields.appendChild(warning);
      const textarea = createElement("textarea");
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
      const label1 = createElement("label");
      label1.className = "sc-custom-label";
      label1.textContent = "Notification Title";
      const input1 = createElement("input");
      input1.type = "text";
      input1.className = "sc-custom-input sc-custom-config-input";
      input1.placeholder = "Shortcut Triggered!";
      input1.value = title;
      input1.dataset.configKey = "title";
      customConfigFields.appendChild(label1);
      customConfigFields.appendChild(input1);
      const label2 = createElement("label");
      label2.className = "sc-custom-label";
      label2.textContent = "Message";
      const input2 = createElement("input");
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
      customRecordedKeys.length > 0 ? formatKeys(customRecordedKeys) : "Click to record...";

    const actionType = editData?.action?.type || "launchApp";
    const actionConfig = editData?.action?.config || {};

    $$(".sc-custom-action-type", customActionTypes).forEach((el) => {
      el.classList.toggle("active", el.dataset.type === actionType);
      $("input", el).checked = el.dataset.type === actionType;
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

    const activeType = $(".sc-custom-action-type.active", customActionTypes);
    const actionType = activeType ? activeType.dataset.type : "launchApp";

    const config = {};
    $$(".sc-custom-config-input", customConfigFields).forEach((el) => {
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
      icon: getActionTypeIcon(actionType),
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

    os.events.emit(BusEvents.ACHIEVEMENT_TRIGGER, { achievementId: Achievements.Customizer });
    os.events.emit(BusEvents.ACHIEVEMENT_TRIGGER, { achievementId: Achievements.MacroMaker });
    closeCustomModal();
    render();
  };

  customKeysEl.addEventListener("click", () => {
    beginKeyCapture({
      currentKeys: customRecordedKeys,
      onValid: (recorded) => {
        customRecordedKeys = recorded;
        customKeysPlaceholder.textContent = formatKeys(recorded);
      },
      onReset: () => {
        customRecordedKeys = [];
        customKeysPlaceholder.textContent = "Click to record...";
      }
    });
  });

  customActionTypes.addEventListener("change", (e) => {
    if (e.target.name === "actionType") {
      $$(".sc-custom-action-type", customActionTypes).forEach((el) => {
        el.classList.toggle("active", $("input", el).checked);
      });
      renderConfigFields(e.target.value, {});
    }
  });

  customActionTypes.addEventListener("click", (e) => {
    const typeEl = e.target.closest(".sc-custom-action-type");
    if (typeEl) {
      $("input", typeEl).checked = true;
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
          <div>No keyboard shortcuts found.</div>
          ${currentCategory === "custom" ? '<div class="sc-empty-hint">Click "Custom" button above to create your first custom shortcut.</div>' : ""}
        </div>
      `;
      return;
    }

    shortcuts.forEach((item) => {
      const card = createElement("div");
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
        .map((k) => `<kbd>${formatKeys([k])}</kbd>`)
        .join('<span class="sc-card-plus">+</span>');

      let actionBadge = "";
      if (isCustom && item.action) {
        actionBadge = `<span class="sc-card-action-badge"><i class="${getActionTypeIcon(item.action.type)}"></i> ${getActionTypeLabel(item.action.type)}</span>`;
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

      const keysArea = $(".sc-card-keys", card);
      keysArea.addEventListener("click", () => {
        beginKeyCapture({
          currentKeys: item.currentKeys,
          onValid: (recorded) => {
            KeybindManager.setKeys(item.id, recorded);
            render();
          },
          onReset: () => {
            KeybindManager.reset(item.id);
            render();
          }
        });
      });

      const resetBtn = $(".sc-card-reset", card);
      resetBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (isCustom) {
          if (await os.dialog.confirm("Delete this custom shortcut?")) {
            KeybindManager.deleteCustomAction(item.id);
            render();
          }
        } else if (KeybindManager.isCustomized(item.id)) {
          KeybindManager.reset(item.id);
          render();
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

  const destroy = () => {
    stopCapture();
  };

  return { destroy };
}
