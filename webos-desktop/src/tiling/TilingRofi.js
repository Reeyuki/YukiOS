import { os, StorageKeys } from "../framework.js";
import { resolveIconUrl } from "../shared/assetResolver.js";

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
const RECENT_KEY = "yukiOS_recently_used_apps";

export class TilingRofi {
  constructor(bar) {
    this.bar = bar;
    this.isOpen = false;
    this.results = [];
    this.highlightIndex = -1;
    this.backdrop = null;
    this.overlay = null;
  }

  init() {
    this.backdrop = document.createElement("div");
    this.backdrop.id = "tiling-rofi-backdrop";
    document.body.appendChild(this.backdrop);

    this.overlay = document.createElement("div");
    this.overlay.id = "tiling-rofi-overlay";
    this.overlay.innerHTML = `
      <div class="rofi-input-wrapper">
        <i class="fas fa-search"></i>
        <input type="text" id="rofi-search" placeholder="Search apps, settings..." autocomplete="off" spellcheck="false">
      </div>
      <div class="rofi-results" id="rofi-results"></div>
      <div class="rofi-footer">
        <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
        <span><kbd>Enter</kbd> launch</span>
        <span><kbd>Esc</kbd> close</span>
      </div>
    `;
    document.body.appendChild(this.overlay);

    const input = this.overlay.querySelector("#rofi-search");
    const results = this.overlay.querySelector("#rofi-results");
    this.inputEl = input;
    this.resultsEl = results;

    input.addEventListener("input", () => this.onInput());
    input.addEventListener("keydown", (e) => this.onKeydown(e));
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
    this.highlightIndex = -1;
    this.backdrop.classList.add("visible");

    const barPos = os.storage.get(StorageKeys.tilingBarPosition) || "top";
    this.overlay.classList.toggle("position-bottom", barPos === "bottom");
    const rofiWidth = os.storage.get(StorageKeys.tilingRofiWidth) || "65";
    this.overlay.style.setProperty("--tiling-rofi-width", `${rofiWidth}%`);

    this.overlay.classList.add("visible");
    this.inputEl.value = "";
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
  }

  onInput() {
    const query = this.inputEl.value.trim();
    if (!query) {
      this.populateRecent();
      return;
    }
    this.populateResults(query);
  }

  populateRecent() {
    const recent = this.getRecentApps();
    const allApps = os.app.getAllApps() || {};
    const items = [];
    for (const id of recent) {
      const app = allApps[id];
      if (app) items.push({ id, title: app.title || id, icon: app.icon, desc: "" });
    }
    this.renderItems(items, "Recently Used");
  }

  populateResults(query) {
    const allApps = os.app.getAllApps() || {};
    const matched = [];
    const q = query.toLowerCase();
    for (const [id, app] of Object.entries(allApps)) {
      const title = app.title || id;
      if (fuzzyMatch(q, title)) {
        matched.push({ id, title, icon: app.icon, desc: app.description || "" });
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
    this.renderItems(sliced, matched.length > maxResults ? `Apps (${matched.length} found, showing ${maxResults})` : "Apps");
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

      const isUrl = typeof item.icon === "string" && (item.icon.startsWith("http") || item.icon.startsWith("data:") || item.icon.startsWith("/") || /\.(webp|png|jpg|jpeg|gif|svg)/.test(item.icon));
      const isFa = typeof item.icon === "string" && (item.icon.startsWith("fa-") || item.icon.startsWith("fas") || item.icon.startsWith("fab") || item.icon.startsWith("far"));

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

      el.addEventListener("click", () => this.launchItem(idx));
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

  onKeydown(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      this.close();
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
        this.launchItem(idx);
      }
      return;
    }
  }

  launchItem(idx) {
    const item = this.results[idx];
    if (!item) return;
    this.trackRecent(item.id);
    this.close();
    os.app.launch(item.id);
  }

  trackRecent(appId) {
    try {
      const recent = this.getRecentApps();
      const filtered = recent.filter((id) => id !== appId);
      filtered.unshift(appId);
      os.storage.set(RECENT_KEY, JSON.stringify(filtered.slice(0, MAX_RECENT)));
    } catch {}
  }

  getRecentApps() {
    try {
      const raw = os.storage.get(RECENT_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }
}
