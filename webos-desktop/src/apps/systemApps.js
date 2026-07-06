import "../styles/systemApps.css";
import { BaseApp, os } from "../framework.js";
import { DeclarativeApp } from "../runtime/DeclarativeApp.js";
import { PersistenceTypes } from "../AppSchema.js";
import { getAppRegistry } from "../appRegistry.js";

export class SystemAppsApp extends BaseApp {
  constructor(services) {
    super(services);
  }

  open(opts = {}) {
    const schema = this.getDeclarativeSchema(opts);
    if (!schema.actions) schema.actions = {};
    schema.actions.renderApps = (p, e, el, s, ae) => this.renderApps(p, e, el, s, ae);
    schema.actions._appInstance = this;
    const declarativeApp = new DeclarativeApp(schema, {
      wm: this.wm,
      fs: this.fs,
      bus: this.bus,
      notifications: this.notifications
    });
    return declarativeApp.open(opts);
  }

  getDeclarativeSchema() {
    return {
      id: "system-apps-win",
      name: "System Apps",
      icon: "fas fa-screwdriver-wrench",
      windows: [
        {
          id: "system-apps-win",
          title: "System Apps",
          size: ["800px", "600px"],
          icon: "fas fa-screwdriver-wrench",
          ui: `
             <div class="window-content system-apps-window">
               <div style="padding:16px;display:flex;flex-direction:column;gap:12px;height:100%;box-sizing:border-box;">
                 <input
                   type="text"
                   class="games-search-input"
                   id="system-apps-search"
                   placeholder="Search apps..."
                   autocomplete="off"
                 />
                  <div class="system-apps-section" id="system-apps-section-native">
                    <div class="system-apps-section-header">System Apps</div>
                    <div class="games-app-grid" id="system-apps-grid-native"></div>
                  </div>
                  <div class="system-apps-section" id="system-apps-section-web">
                    <div class="system-apps-section-header">Web Apps</div>
                    <div class="games-app-grid" id="system-apps-grid-web"></div>
                  </div>
                 <div class="games-no-results" id="system-apps-empty" style="display:none;">No system apps found</div>
               </div>
             </div>
           `
        }
      ],
      state: {
        initial: { apps: [], query: "" },
        persistence: PersistenceTypes.MEMORY
      },
      onMount: "renderApps"
    };
  }

  renderApps(payload, event, element, state, actionExecutor) {
    const appLauncher = this._services.appLauncher;
    if (!appLauncher) return;
    const appMap = appLauncher.appMap;
    if (!appMap) return;

    const appRegistry = getAppRegistry();
    appRegistry.refresh();

    const allApps = Object.entries(appMap)
      .filter(([id, data]) => {
        if (data.type !== "system" || !data.icon || !data.title) return false;
        if (appRegistry.isAppUninstalled(id) || appRegistry.isAppDisabled(id)) return false;
        return true;
      })
      .map(([id, data]) => ({ id, ...data }));

    const sortByIcon = (arr) => {
      const isFA = (icon) => typeof icon === "string" && /^fa[bsr]?\s/.test(icon);
      return [...arr.filter((a) => !isFA(a.icon)), ...arr.filter((a) => isFA(a.icon))];
    };

    const nativeApps = sortByIcon(allApps.filter((a) => !a.targetUrl || a.id === "discordApp"));
    const webApps = sortByIcon(allApps.filter((a) => a.targetUrl && a.id !== "discordApp"));

    this._nativeApps = nativeApps;
    this._webApps = webApps;
    this._renderGrid(state.query);

    const searchInput = document.querySelector("#system-apps-win #system-apps-search");
    if (searchInput && !searchInput._saBound) {
      searchInput._saBound = true;
      searchInput.addEventListener("input", (e) => {
        state.query = e.target.value;
        this._renderGrid(state.query);
      });
    }
  }

  _renderGrid(query) {
    const sectionNative = document.querySelector("#system-apps-section-native");
    const sectionWeb = document.querySelector("#system-apps-section-web");
    const containerNative = document.querySelector("#system-apps-win #system-apps-grid-native");
    const containerWeb = document.querySelector("#system-apps-win #system-apps-grid-web");
    const emptyEl = document.querySelector("#system-apps-win #system-apps-empty");
    if (!containerNative || !containerWeb) return;

    const q = (query || "").toLowerCase();
    const allApps = [...(this._nativeApps || []), ...(this._webApps || [])];
    const nativeFiltered = q
      ? allApps.filter((a) => a.title.toLowerCase().includes(q) && (!a.targetUrl || a.id === "discordApp"))
      : this._nativeApps;
    const webFiltered = q
      ? allApps.filter((a) => a.title.toLowerCase().includes(q) && a.targetUrl && a.id !== "discordApp")
      : this._webApps;

    const total = (nativeFiltered || []).length + (webFiltered || []).length;
    if (total === 0) {
      containerNative.innerHTML = "";
      containerWeb.innerHTML = "";
      if (sectionNative) sectionNative.style.display = "none";
      if (sectionWeb) sectionWeb.style.display = "none";
      if (emptyEl) emptyEl.style.display = "block";
      return;
    }

    if (emptyEl) emptyEl.style.display = "none";

    this._renderSection(containerNative, nativeFiltered, sectionNative);
    this._renderSection(containerWeb, webFiltered, sectionWeb);
  }

  _renderSection(container, items, sectionEl) {
    if (items.length === 0) {
      container.innerHTML = "";
      if (sectionEl) sectionEl.style.display = "none";
      return;
    }

    if (sectionEl) sectionEl.style.display = "";

    container.innerHTML = items
      .map((app) => {
        const icon = app.icon || "";
        const isFA = typeof icon === "string" && /^fa[bsr]?\s/.test(icon);
        const iconHtml = isFA
          ? `<i style="color:var(--brand);" class="icon ${icon}"></i>`
          : `<img src="${icon}" alt="${app.title}" loading="lazy" />`;
        return `
          <div class="games-app-card" data-app="${app.id}">
            <div class="games-app-card-img-wrap">${iconHtml}</div>
            <div class="games-app-card-title">${app.title}</div>
          </div>
        `;
      })
      .join("");

    container.querySelectorAll(".games-app-card").forEach((card) => {
      card.addEventListener("dblclick", () => {
        const appId = card.dataset.app;
        if (appId) os.app.launch(appId);
      });
    });
  }

  onClose(winId) {}
}
