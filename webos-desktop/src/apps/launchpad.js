import "../styles/launchpad.css";
import { BaseApp, createElement } from "../framework.js";
import { getAppRegistry } from "../appRegistry.js";
import { KeybindManager } from "../keybindManager.js";
import { isFontAwesomeIcon, resolveIconHtml } from "../shared/iconUtils.js";

export class LaunchpadApp extends BaseApp {
  constructor(services) {
    super(services);
    this.overlay = null;
    this.boundKeydown = this.handleKeydown.bind(this);
    this.boundGlobalKeydown = this.handleGlobalKeydown.bind(this);
    document.addEventListener("keydown", this.boundGlobalKeydown);
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
    this.overlay = createElement("div");
    this.overlay.className = "launchpad-overlay";
    this.overlay.innerHTML = `
      <button class="launchpad-close" type="button" aria-label="Close launchpad"><i class="fas fa-times"></i></button>
      <div class="launchpad-inner">
        <div class="launchpad-search-wrap">
          <i class="fas fa-search launchpad-search-icon"></i>
          <input type="text" class="launchpad-search" placeholder="Search apps…" autocomplete="off" spellcheck="false">
        </div>
        <div class="launchpad-grid" id="launchpad-grid"></div>
        <div class="launchpad-empty" id="launchpad-empty" style="display:none">No apps found</div>
      </div>
    `;

    this.overlay.querySelector(".launchpad-close").addEventListener("click", (e) => {
      e.stopPropagation();
      this.close();
    });

    this.overlay.addEventListener("click", (e) => {
      if (e.target === this.overlay) this.close();
    });

    document.body.appendChild(this.overlay);
    document.addEventListener("keydown", this.boundKeydown);

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
    document.removeEventListener("keydown", this.boundKeydown);
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
        return { id, title: data.title, icon: data.icon, targetUrl: data.targetUrl };
      });

    const sortByIcon = (arr) => {
      const image = arr.filter((a) => !isFontAwesomeIcon(a.icon)).sort((a, b) => a.title.localeCompare(b.title));
      const fa = arr.filter((a) => isFontAwesomeIcon(a.icon)).sort((a, b) => a.title.localeCompare(b.title));
      return [...image, ...fa];
    };

    this.allApps = allApps.sort((a, b) => a.title.localeCompare(b.title));
    this.nativeApps = sortByIcon(allApps.filter((a) => !a.targetUrl || a.id === "discordApp"));
    this.webApps = sortByIcon(allApps.filter((a) => a.targetUrl && a.id !== "discordApp"));
    this.sortByIcon = sortByIcon;
    this.query = "";
    this.renderGridItems();

    const input = this.overlay.querySelector(".launchpad-search");
    if (input && !input.lb) {
      input.lb = true;
      input.addEventListener("input", (e) => {
        this.query = e.target.value;
        this.renderGridItems();
      });
    }
  }

  renderGridItems() {
    const grid = this.overlay.querySelector("#launchpad-grid");
    const empty = this.overlay.querySelector("#launchpad-empty");
    if (!grid) return;

    const q = (this.query || "").toLowerCase();
    const isSearching = !!q;

    if (isSearching) {
      const filtered = this.allApps
        .filter((a) => a.title.toLowerCase().includes(q))
        .sort((a, b) => a.title.localeCompare(b.title));
      if (filtered.length === 0) {
        grid.innerHTML = "";
        empty.style.display = "block";
        return;
      }
      empty.style.display = "none";
      grid.innerHTML = filtered
        .map((app) => {
          const iconHtml = resolveIconHtml(app.icon, {
            faClass: "launchpad-item-icon",
            imgClass: "launchpad-item-icon",
            alt: app.title
          });
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
      return;
    }

    const native = this.nativeApps || [];
    const web = this.webApps || [];
    if (native.length === 0 && web.length === 0) {
      grid.innerHTML = "";
      empty.style.display = "block";
      return;
    }
    empty.style.display = "none";

    const renderItems = (apps) =>
      apps
        .map((app) => {
          const iconHtml = resolveIconHtml(app.icon, {
            faClass: "launchpad-item-icon",
            imgClass: "launchpad-item-icon",
            alt: app.title
          });
          return `
          <div class="launchpad-item" data-app="${app.id}">
            <div class="launchpad-item-icon-wrap">${iconHtml}</div>
            <span class="launchpad-item-label">${app.title}</span>
          </div>
        `;
        })
        .join("");

    let html = "";
    if (native.length > 0) {
      html += `<div class="launchpad-section-label">Apps</div>`;
      html += renderItems(native);
    }
    if (web.length > 0) {
      html += `<div class="launchpad-section-label">Web Apps</div>`;
      html += renderItems(web);
    }
    grid.innerHTML = html;

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
