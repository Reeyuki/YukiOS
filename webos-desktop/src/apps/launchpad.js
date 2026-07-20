import "../styles/launchpad.css";
import { BaseApp } from "../framework.js";
import { getAppRegistry } from "../appRegistry.js";
import { KeybindManager } from "../keybindManager.js";

export class LaunchpadApp extends BaseApp {
  constructor(services) {
    super(services);
    this.overlay = null;
    this._boundKeydown = this.handleKeydown.bind(this);
    this._boundGlobalKeydown = this.handleGlobalKeydown.bind(this);
    document.addEventListener("keydown", this._boundGlobalKeydown);
  }

  handleGlobalKeydown(e) {
    if (KeybindManager.matches(e, "global.launchpad")) {
      e.preventDefault();
      this.open();
    }
  }

  open() {
    if (this.overlay) {
      if (!this.overlay.classList.contains("launchpad-closing")) this.close();
      return;
    }
    this.overlay = document.createElement("div");
    this.overlay.className = "launchpad-overlay";
    this.overlay.innerHTML = `
      <div class="launchpad-inner">
        <div class="launchpad-search-wrap">
          <i class="fas fa-search launchpad-search-icon"></i>
          <input type="text" class="launchpad-search" placeholder="Search apps…" autocomplete="off" spellcheck="false">
        </div>
        <div class="launchpad-grid" id="launchpad-grid"></div>
        <div class="launchpad-empty" id="launchpad-empty" style="display:none">No apps found</div>
      </div>
    `;

    this.overlay.addEventListener("click", (e) => {
      if (e.target === this.overlay) this.close();
    });

    document.body.appendChild(this.overlay);
    document.addEventListener("keydown", this._boundKeydown);

    this.renderGrid();

    requestAnimationFrame(() => {
      const input = this.overlay.querySelector(".launchpad-search");
      if (input) input.focus();
    });
  }

  close() {
    if (!this.overlay) return;
    if (!this.overlay.classList.contains("launchpad-closing")) {
      this.overlay.classList.add("launchpad-closing");
      this.overlay.addEventListener(
        "animationend",
        () => {
          if (!this.overlay) return;
          this.overlay.remove();
          this.overlay = null;
        },
        { once: true }
      );
    }
    document.removeEventListener("keydown", this._boundKeydown);
  }

  handleKeydown(e) {
    if (e.key === "Escape") {
      this.close();
      return;
    }
    const input = this.overlay?.querySelector(".launchpad-search");
    if (document.activeElement !== input && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (input) {
        input.focus();
        input.value = e.key;
        input.dispatchEvent(new Event("input"));
        e.preventDefault();
      }
    }
  }

  renderGrid() {
    const appMap = this.os.app.getAllApps();
    if (!appMap || Object.keys(appMap).length === 0) return;

    const appRegistry = getAppRegistry();
    appRegistry.refresh();

    const allApps = Object.entries(appMap)
      .filter(([, data]) => {
        if (data.type !== "system" || !data.icon || !data.title) return false;
        if (appRegistry.isAppUninstalled(data.id) || appRegistry.isAppDisabled(data.id)) return false;
        return true;
      })
      .map(([id, data]) => {
        const manifest = appMap[id];
        return { id, title: data.title, icon: data.icon, targetUrl: data.targetUrl };
      });

    allApps.sort((a, b) => a.title.localeCompare(b.title));

    this.allApps = allApps;
    this._query = "";
    this.renderGridItems();

    const input = this.overlay.querySelector(".launchpad-search");
    if (input && !input._lb) {
      input._lb = true;
      input.addEventListener("input", (e) => {
        this._query = e.target.value;
        this.renderGridItems();
      });
    }
  }

  renderGridItems() {
    const grid = this.overlay.querySelector("#launchpad-grid");
    const empty = this.overlay.querySelector("#launchpad-empty");
    if (!grid) return;

    const q = (this._query || "").toLowerCase();
    const filtered = q ? this.allApps.filter((a) => a.title.toLowerCase().includes(q)) : this.allApps;

    if (filtered.length === 0) {
      grid.innerHTML = "";
      empty.style.display = "block";
      return;
    }

    empty.style.display = "none";
    grid.innerHTML = filtered
      .map((app) => {
        const isFA = typeof app.icon === "string" && /^fa[bsr]?\s/.test(app.icon);
        const iconHtml = isFA
          ? `<i class="launchpad-item-icon ${app.icon}"></i>`
          : `<img class="launchpad-item-icon" src="${app.icon}" alt="${app.title}" loading="lazy" />`;
        return `
          <div class="launchpad-item" data-app="${app.id}">
            <div class="launchpad-item-icon-wrap">${iconHtml}</div>
            <span class="launchpad-item-label">${app.title}</span>
          </div>
        `;
      })
      .join("");

    grid.querySelectorAll(".launchpad-item").forEach((item) => {
      item.addEventListener("click", () => {
        const appId = item.dataset.app;
        this.close();
        if (appId) this.os.app.launch(appId).catch(() => {});
      });
    });
  }

  onClose(winId) {}
}
