import { $ } from "../shared/domUtils.js";
import { os, StorageKeys } from "../framework.js";
import { resolveIconUrl } from "../shared/assetResolver.js";
import { escapeHtml } from "../utils/utils.js";

function fuzzyMatch(query, target) {
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length;
}

const MAX_RECENT = 8;
const MAX_RUN_HISTORY = 20;

const MODES = ["drun", "run", "window", "calc"];

const MODE_CONFIG = {
  drun: { icon: "fa-th-large", label: "Apps", placeholder: "Search apps..." },
  run: { icon: "fa-terminal", label: "Run", placeholder: "Type a command or app name..." },
  window: { icon: "fa-window-restore", label: "Windows", placeholder: "Search open windows..." },
  calc: { icon: "fa-calculator", label: "Calc", placeholder: "Type a math expression..." }
};

export class TilingRofi {
  constructor(bar) {
    this.bar = bar;
    this.isOpen = false;
    this.results = [];
    this.highlightIndex = -1;
    this.backdrop = null;
    this.overlay = null;
    this.inputEl = null;
    this.resultsEl = null;
    this.modeIndicator = null;
    this.calcPreview = null;
    this.mode = "drun";
  }

  init() {
    this.backdrop = document.createElement("div");
    this.backdrop.id = "tiling-rofi-backdrop";
    document.body.appendChild(this.backdrop);

    this.overlay = document.createElement("div");
    this.overlay.id = "tiling-rofi-overlay";
    this.overlay.innerHTML = `
      <div class="rofi-input-wrapper">
        <div class="rofi-mode-indicator" id="rofi-mode-indicator">
          <i class="fas fa-th-large"></i>
          <span>Apps</span>
        </div>
        <input type="text" id="rofi-search" placeholder="Search apps..." autocomplete="off" spellcheck="false">
      </div>
      <div class="rofi-calc-preview" id="rofi-calc-preview" style="display:none"></div>
      <div class="rofi-results" id="rofi-results"></div>
      <div class="rofi-footer" id="rofi-footer">
        <span id="rofi-footer-hints"><kbd>↑</kbd><kbd>↓</kbd> navigate <kbd>Enter</kbd> launch <kbd>Tab</kbd> mode</span>
      </div>
    `;
    document.body.appendChild(this.overlay);

    this.inputEl = this.overlay.querySelector("#rofi-search");
    this.resultsEl = this.overlay.querySelector("#rofi-results");
    this.modeIndicator = this.overlay.querySelector("#rofi-mode-indicator");
    this.calcPreview = this.overlay.querySelector("#rofi-calc-preview");
    this.footerHints = this.overlay.querySelector("#rofi-footer-hints");

    this.inputEl.addEventListener("input", () => this.onInput());
    this.inputEl.addEventListener("keydown", (e) => this.onKeydown(e));
    this.overlay.addEventListener("mousedown", (e) => e.stopPropagation());
    this.backdrop.addEventListener("mousedown", () => this.close());
  }

  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  }

  open() {
    const rofiEnabled = os.storage.get(StorageKeys.tilingRofiEnabled);
    if (rofiEnabled === "false") return;

    this.isOpen = true;
    this.mode = "drun";
    this.highlightIndex = -1;
    this.backdrop.classList.add("visible");

    const barPos = os.storage.get(StorageKeys.tilingBarPosition) || "top";
    this.overlay.classList.toggle("position-bottom", barPos === "bottom");
    const rofiWidth = os.storage.get(StorageKeys.tilingRofiWidth) || "65";
    this.overlay.style.setProperty("--tiling-rofi-width", `${rofiWidth}%`);

    this.overlay.classList.add("visible");
    this.updateModeUI();
    this.inputEl.value = "";
    this.calcPreview.style.display = "none";
    this.calcPreview.textContent = "";
    this.populateRecent();
    this.inputEl.focus();
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.overlay.classList.remove("visible");
    this.backdrop.classList.remove("visible");
    this.resultsEl.innerHTML = "";
    this.results = [];
    this.highlightIndex = -1;
    this.calcPreview.style.display = "none";
    this.calcPreview.textContent = "";
  }

  switchMode(nextMode) {
    this.mode = nextMode;
    this.highlightIndex = -1;
    this.inputEl.value = "";
    this.resultsEl.innerHTML = "";
    this.results = [];
    this.calcPreview.style.display = "none";
    this.calcPreview.textContent = "";
    this.updateModeUI();

    if (this.mode === "drun") {
      this.populateRecent();
    } else if (this.mode === "run") {
      this.populateRunHistory();
    } else if (this.mode === "window") {
      this.populateWindows();
    }

    this.inputEl.focus();
  }

  updateModeUI() {
    const cfg = MODE_CONFIG[this.mode];
    this.overlay.className = this.overlay.className.replace(/rofi-mode-\w+/g, "").trim() + ` rofi-mode-${this.mode}`;
    this.modeIndicator.innerHTML = `<i class="fas ${cfg.icon}"></i><span>${cfg.label}</span>`;
    this.inputEl.placeholder = cfg.placeholder;

    const footerMap = {
      drun: `<kbd>↑</kbd><kbd>↓</kbd> navigate <kbd>Enter</kbd> launch <kbd>Tab</kbd> mode`,
      run: `<kbd>↑</kbd><kbd>↓</kbd> history <kbd>Enter</kbd> execute <kbd>Tab</kbd> mode`,
      window: `<kbd>↑</kbd><kbd>↓</kbd> navigate <kbd>Enter</kbd> focus <kbd>Tab</kbd> mode`,
      calc: `<kbd>Enter</kbd> copy result <kbd>Tab</kbd> mode`
    };
    this.footerHints.innerHTML = footerMap[this.mode];
  }

  onInput() {
    const query = this.inputEl.value.trim();

    if (this.mode === "calc") {
      this.updateCalcPreview(query);
      return;
    }

    if (!query) {
      if (this.mode === "drun") this.populateRecent();
      else if (this.mode === "run") this.populateRunHistory();
      else if (this.mode === "window") this.populateWindows();
      return;
    }

    if (this.mode === "drun") this.populateAppResults(query);
    else if (this.mode === "run") this.populateRunResults(query);
    else if (this.mode === "window") this.populateWindowResults(query);
  }

  onKeydown(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      this.close();
      return;
    }

    if (e.key === "Tab") {
      e.preventDefault();
      const dir = e.shiftKey ? -1 : 1;
      const idx = MODES.indexOf(this.mode);
      const next = (idx + dir + MODES.length) % MODES.length;
      this.switchMode(MODES[next]);
      return;
    }

    if (this.mode === "calc") {
      if (e.key === "Enter") {
        e.preventDefault();
        this.copyCalcResult();
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = Math.min(this.highlightIndex + 1, this.results.length - 1);
      this.setHighlight(next);
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = Math.max(this.highlightIndex - 1, 0);
      this.setHighlight(prev);
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      const idx = this.highlightIndex >= 0 ? this.highlightIndex : 0;
      if (this.results[idx]) {
        this.activateItem(idx);
      }
      return;
    }
  }

  populateRecent() {
    const recent = this.getRecentApps();
    const allApps = os.app.getAllApps() || {};
    const items = [];
    for (const id of recent) {
      const app = allApps[id];
      if (app) items.push({ id, title: app.title || id, icon: app.icon, desc: "", type: "app" });
    }
    this.renderItems(items, "Recently Used");
  }

  populateAppResults(query) {
    const allApps = os.app.getAllApps() || {};
    const matched = [];
    const q = query.toLowerCase();
    for (const [id, app] of Object.entries(allApps)) {
      const title = app.title || id;
      if (fuzzyMatch(q, title)) {
        matched.push({ id, title, icon: app.icon, desc: app.description || "", type: "app" });
      }
    }
    matched.sort((a, b) => {
      const aIdx = a.title.toLowerCase().indexOf(q);
      const bIdx = b.title.toLowerCase().indexOf(q);
      if (aIdx !== bIdx) return aIdx - bIdx;
      return a.title.length - b.title.length;
    });
    const maxResults = Number(os.storage.get(StorageKeys.tilingRofiMaxResults)) || 10;
    const sliced = matched.slice(0, maxResults);
    this.renderItems(
      sliced,
      matched.length > maxResults ? `Apps (${matched.length} found, showing ${maxResults})` : "Apps"
    );
  }

  getRunHistory() {
    try {
      const raw = os.storage.get(StorageKeys.tilingRofiRunHistory);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  addRunHistory(cmd) {
    try {
      const history = this.getRunHistory();
      const filtered = history.filter((h) => h !== cmd);
      filtered.unshift(cmd);
      os.storage.set(StorageKeys.tilingRofiRunHistory, JSON.stringify(filtered.slice(0, MAX_RUN_HISTORY)));
    } catch {}
  }

  populateRunHistory() {
    const history = this.getRunHistory();
    const items = history.map((cmd) => ({
      id: cmd,
      title: cmd,
      icon: "fa-history",
      desc: "",
      type: "history"
    }));
    this.renderItems(items, items.length ? "Command History" : undefined);
  }

  populateRunResults(query) {
    const history = this.getRunHistory();
    const matched = history.filter((cmd) => cmd.toLowerCase().includes(query.toLowerCase()));
    const items = matched.map((cmd) => ({
      id: cmd,
      title: cmd,
      icon: "fa-terminal",
      desc: "",
      type: "history"
    }));
    if (items.length === 0) {
      this.resultsEl.innerHTML = `<div class="rofi-empty">Press Enter to run &ldquo;${escapeHtml(query)}&rdquo;</div>`;
      this.results = [];
      this.highlightIndex = -1;
      return;
    }
    this.renderItems(items, "Command History");
  }

  executeCommand(cmd) {
    if (!cmd.trim()) return;
    this.addRunHistory(cmd);

    const allApps = os.app.getAllApps() || {};
    if (allApps[cmd]) {
      this.trackRecent(cmd);
      this.close();
      os.app.launch(cmd);
      return;
    }

    if (cmd.startsWith("http://") || cmd.startsWith("https://")) {
      this.close();
      window.open(cmd, "_blank");
      return;
    }

    this.close();
    os.app.executeCommand(cmd);
  }

  populateWindows() {
    const running = os.app.getRunningApps() || [];
    const items = running.map((win) => ({
      id: win.winId,
      title: win.title || win.winId,
      icon: win.icon || "fa-window-restore",
      desc: win.status === "minimized" ? "Minimized" : "",
      type: "window",
      winId: win.winId,
      status: win.status
    }));
    this.renderItems(items, items.length ? "Open Windows" : undefined);
  }

  populateWindowResults(query) {
    const running = os.app.getRunningApps() || [];
    const q = query.toLowerCase();
    const matched = running.filter((win) => (win.title || win.winId).toLowerCase().includes(q));
    const items = matched.map((win) => ({
      id: win.winId,
      title: win.title || win.winId,
      icon: win.icon || "fa-window-restore",
      desc: win.status === "minimized" ? "Minimized" : "",
      type: "window",
      winId: win.winId,
      status: win.status
    }));
    this.renderItems(items, items.length ? `Open Windows (${items.length})` : undefined);
  }

  focusWindow(winId) {
    const el = $("#" + winId);
    if (el) {
      os.window.focus(el);
    }
    this.close();
  }

  updateCalcPreview(query) {
    if (!query) {
      this.calcPreview.style.display = "none";
      this.calcPreview.textContent = "";
      return;
    }

    const sanitized = query.replace(/[^0-9+\-*/.()%\s]/g, "");
    if (!sanitized || sanitized !== query) {
      this.calcPreview.style.display = "flex";
      this.calcPreview.innerHTML = `<span class="rofi-calc-error">Invalid characters</span>`;
      return;
    }

    try {
      const result = Function('"use strict"; return (' + sanitized + ")")();
      if (typeof result === "number" && !Number.isFinite(result)) {
        this.calcPreview.style.display = "flex";
        this.calcPreview.innerHTML = `<span class="rofi-calc-error">Error</span>`;
        return;
      }
      this.calcPreview.style.display = "flex";
      this.calcPreview.innerHTML = `<span class="rofi-calc-equals">=</span> <span class="rofi-calc-result">${result}</span>`;
    } catch {
      this.calcPreview.style.display = "flex";
      this.calcPreview.innerHTML = `<span class="rofi-calc-error">Invalid expression</span>`;
    }
  }

  copyCalcResult() {
    const query = this.inputEl.value.trim();
    if (!query) return;
    const sanitized = query.replace(/[^0-9+\-*/.()%\s]/g, "");
    if (!sanitized) return;
    try {
      const result = Function('"use strict"; return (' + sanitized + ")")();
      if (typeof result === "number" && Number.isFinite(result)) {
        navigator.clipboard.writeText(String(result)).catch(() => {});
        this.close();
        os.notify.send("Calculator", `Copied ${result} to clipboard`, {
          type: "info",
          duration: 2000,
          icon: "fa-calculator"
        });
      }
    } catch {}
  }

  renderItems(items, label) {
    this.resultsEl.innerHTML = "";
    this.results = items;
    this.highlightIndex = -1;

    if (items.length === 0) {
      this.resultsEl.innerHTML = `<div class="rofi-empty">No results found</div>`;
      return;
    }

    if (label) {
      const labelEl = document.createElement("div");
      labelEl.className = "rofi-section-label";
      labelEl.textContent = label;
      this.resultsEl.appendChild(labelEl);
    }

    items.forEach((item, idx) => {
      const el = document.createElement("div");
      el.className = "rofi-item";
      el.dataset.index = idx;

      const isUrl =
        typeof item.icon === "string" &&
        (item.icon.startsWith("http") ||
          item.icon.startsWith("data:") ||
          item.icon.startsWith("/") ||
          /\.(webp|png|jpg|jpeg|gif|svg)/.test(item.icon));
      const isFa =
        typeof item.icon === "string" &&
        (item.icon.startsWith("fa-") ||
          item.icon.startsWith("fas") ||
          item.icon.startsWith("fab") ||
          item.icon.startsWith("far"));

      if (isUrl) {
        const img = document.createElement("img");
        img.src = item.icon;
        img.alt = item.title;
        el.appendChild(img);
      } else if (isFa) {
        const i = document.createElement("i");
        i.className = item.icon;
        el.appendChild(i);
      } else {
        const i = document.createElement("i");
        i.className = "fas fa-cube";
        el.appendChild(i);
      }

      const info = document.createElement("div");
      info.className = "rofi-item-info";
      const titleEl = document.createElement("div");
      titleEl.className = "rofi-item-title";
      titleEl.textContent = item.title;
      info.appendChild(titleEl);
      if (item.desc) {
        const descEl = document.createElement("div");
        descEl.className = "rofi-item-desc";
        descEl.textContent = item.desc;
        info.appendChild(descEl);
      }
      el.appendChild(info);

      el.addEventListener("click", () => this.activateItem(idx));
      el.addEventListener("mousemove", () => this.setHighlight(idx));
      this.resultsEl.appendChild(el);
    });
  }

  setHighlight(idx) {
    if (this.highlightIndex === idx) return;
    const prev = this.resultsEl.querySelector(".rofi-item.highlighted");
    if (prev) prev.classList.remove("highlighted");
    this.highlightIndex = idx;
    const el = this.resultsEl.querySelector(`.rofi-item[data-index="${idx}"]`);
    if (el) {
      el.classList.add("highlighted");
      el.scrollIntoView({ block: "nearest" });
    }
  }

  activateItem(idx) {
    const item = this.results[idx];
    if (!item) return;

    if (this.mode === "drun") {
      this.trackRecent(item.id);
      this.close();
      os.app.launch(item.id);
    } else if (this.mode === "run") {
      this.executeCommand(item.id);
    } else if (this.mode === "window") {
      this.focusWindow(item.winId);
    }
  }

  trackRecent(appId) {
    try {
      const recent = this.getRecentApps();
      const filtered = recent.filter((id) => id !== appId);
      filtered.unshift(appId);
      os.storage.set(StorageKeys.tilingRofiRecentApps, JSON.stringify(filtered.slice(0, MAX_RECENT)));
    } catch {}
  }

  getRecentApps() {
    try {
      const raw = os.storage.get(StorageKeys.tilingRofiRecentApps);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }
}
