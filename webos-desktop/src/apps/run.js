import "../styles/run.css";
import { BaseApp, os, StorageKeys } from "../framework.js";
import { KeybindManager } from "../keybindManager.js";

export class RunApp extends BaseApp {
  constructor(services) {
    super(services);
    this.win = null;
    this.winId = "run-dialog";
    this.registerGlobalShortcut();
  }

  registerGlobalShortcut() {
    document.addEventListener("keydown", (e) => {
      if (KeybindManager.matches(e, "global.run")) {
        e.preventDefault();
        this.open();
      }
    });
  }

  open() {
    if (this.win && document.getElementById(this.winId)) {
      os.window.bringToFront(this.win);
      this.focusInput();
      return;
    }

    this.win = os.window.create(this.winId, "Run", "420px", "210px", {
      icon: "fas fa-terminal",
      appId: "runApp"
    });

    this.win.classList.add("run-window");
    this.win.innerHTML = this.buildUI();

    this.suggestionsEl = document.createElement("div");
    this.suggestionsEl.className = "run-suggestions";
    this.suggestionsEl.id = "run-suggestions";
    this.suggestionsEl.style.display = "none";
    document.body.appendChild(this.suggestionsEl);

    this.bindEvents();
    this.focusInput();

    this.win.addEventListener("remove", () => {
      if (this.suggestionsEl) {
        this.suggestionsEl.remove();
        this.suggestionsEl = null;
      }
      this.win = null;
    });
  }

  buildUI() {
    return `
      <div class="window-content run-root">
        <div class="run-description">Type the name of a program, URL, or command and YukiOS will open it for you.</div>
        <div class="run-input-group">
          <input type="text" class="run-input" id="run-input" placeholder="Open" autocomplete="off" spellcheck="false">
        </div>
        <div class="run-actions">
          <button class="run-btn run-btn-ok" id="run-btn-ok">OK</button>
          <button class="run-btn run-btn-cancel" id="run-btn-cancel">Cancel</button>
        </div>
      </div>
    `;
  }

  bindEvents() {
    const input = this.win.querySelector("#run-input");
    const suggestions = this.suggestionsEl;

    this.win.querySelector("#run-btn-cancel").addEventListener("click", () => this.close());
    this.win.querySelector("#run-btn-ok").addEventListener("click", () => this.execute());

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        this.execute();
      }
    });

    input.addEventListener("input", () => {
      this.updateSuggestions(input, suggestions);
    });

    input.addEventListener("focus", () => {
      this.updateSuggestions(input, suggestions);
    });
  }

  focusInput() {
    requestAnimationFrame(() => {
      const input = this.win?.querySelector("#run-input");
      if (input) input.focus();
    });
  }

  updateSuggestions(input, suggestions) {
    const query = input.value.trim();
    if (!query) {
      suggestions.style.display = "none";
      return;
    }

    const results = os.app.searchApps(query);
    const items = results.slice(0, 10);

    if (items.length === 0) {
      suggestions.style.display = "none";
      return;
    }

    suggestions.innerHTML = items
      .map((id) => {
        const info = os.app.getAppInfo(id);
        const title = info?.title || id;
        const icon = info?.icon || "fas fa-terminal";
        const iconClass =
          icon.startsWith("fas") || icon.startsWith("fab") || icon.startsWith("far") ? icon : "fas fa-terminal";
        return `<div class="run-suggestion-item" data-id="${id}"><i class="${iconClass}"></i><span>${title}</span></div>`;
      })
      .join("");

    suggestions.style.display = "block";

    const rect = input.getBoundingClientRect();
    suggestions.style.left = rect.left + "px";
    suggestions.style.width = rect.width + "px";
    suggestions.style.top = rect.bottom + 4 + "px";

    suggestions.querySelectorAll(".run-suggestion-item").forEach((el) => {
      el.addEventListener("click", () => {
        input.value = el.dataset.id;
        this.execute();
      });
    });
  }

  async execute() {
    const input = this.win?.querySelector("#run-input");
    if (!input) return;

    const value = input.value.trim();
    if (!value) return;

    this.addToHistory(value);
    this.close();

    if (os.app.hasApp(value)) {
      os.app.launch(value);
      return;
    }

    if (os.app.hasApp(value + "App")) {
      os.app.launch(value + "App");
      return;
    }

    if (value.includes("://")) {
      if (/^https?:\/\//i.test(value)) {
        os.app.launch("browserApp", { openUrl: value });
      } else {
        window.open(value, "_blank");
      }
      return;
    }

    if (value.includes(".") && !value.includes(" ")) {
      const url = /^https?:\/\//i.test(value) ? value : "https://" + value;
      os.app.launch("browserApp", { openUrl: url });
      return;
    }

    const results = os.app.searchApps(value);
    if (results.length > 0) {
      os.app.launch(results[0]);
      return;
    }

    os.app.launch("terminalApp");
  }

  close() {
    if (this.win) {
      os.window.close(this.win);
      this.win = null;
    }
  }

  addToHistory(cmd) {
    let history = this.getHistory();
    history = history.filter((h) => h !== cmd);
    history.unshift(cmd);
    if (history.length > 20) history = history.slice(0, 20);
    os.storage.set(StorageKeys.runHistory, JSON.stringify(history));
  }

  getHistory() {
    try {
      const data = os.storage.get(StorageKeys.runHistory);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  onClose(winId) {
    if (winId === this.winId) {
      this.win = null;
    }
  }
}
