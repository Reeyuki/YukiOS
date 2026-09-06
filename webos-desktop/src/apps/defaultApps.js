import "../styles/defaultApps.css";
import { BaseApp, os } from "../framework.js";
import { $, $$, bindEvent } from "../shared/domUtils.js";
import {
  FILE_ASSOCIATIONS_CHANGED,
  getDefaultAppForExt,
  getExtensionsForApp,
  getAllPickableApps,
  getRegisteredExtensions,
  resetAllDefaults,
  setDefaultApp,
  unassociateExtension
} from "../fileAssociations.js";
import { showChooseAppDialog } from "../shared/chooseAppDialog.js";

export class DefaultAppsApp extends BaseApp {
  singletonWindowIds = ["default-apps"];

  constructor(services) {
    super(services);
    this.view = "apps";
    this.selectedAppId = null;
    this.searchQuery = "";
    this.onAssociationsChanged = null;
  }

  async open(opts = {}) {
    const win = os.window.create("default-apps", "Default Apps", "720px", "560px", { icon: "fas fa-th-large" });

    this.mountInto(win);

    win.addEventListener("remove", () => {
      if (this.host === win) {
        os.events.off(FILE_ASSOCIATIONS_CHANGED, this.onAssociationsChanged);
        this.onAssociationsChanged = null;
        this.host = null;
      }
    });
  }

  buildShell() {
    return `
      <div class="da-root">
        <div class="da-topbar">
          <div class="da-title-row">
            <button class="da-back" title="Back" hidden><i class="fas fa-arrow-left"></i></button>
            <span class="da-title">Default apps</span>
          </div>
          <div class="da-toolbar">
            <div class="da-segmented">
              <button class="da-seg-btn active" data-view="apps">Apps</button>
              <button class="da-seg-btn" data-view="filetypes">File types</button>
            </div>
            <input class="da-search" type="text" placeholder="Search apps and file types" />
            <button class="da-reset" title="Reset all defaults"><i class="fas fa-undo"></i></button>
          </div>
        </div>
        <div class="da-content"></div>
      </div>
    `;
  }

  mountInto(host) {
    this.view = "apps";
    this.selectedAppId = null;
    this.searchQuery = "";
    host.innerHTML = this.buildShell();
    this.bindHandlers(host);
    this.render(host);
    this.host = host;

    if (!this.onAssociationsChanged) {
      this.onAssociationsChanged = () => {
        if (this.host && this.host.isConnected) this.render(this.host);
      };
      os.events.on(FILE_ASSOCIATIONS_CHANGED, this.onAssociationsChanged);
      const cleanup = () => {
        if (this.host === host) {
          os.events.off(FILE_ASSOCIATIONS_CHANGED, this.onAssociationsChanged);
          this.onAssociationsChanged = null;
          this.host = null;
        }
        host.removeEventListener("remove", cleanup);
      };
      host.addEventListener("remove", cleanup);
    }
  }

  bindHandlers(host) {
    bindEvent($(".da-back", host), "click", () => {
      this.selectedAppId = null;
      this.render(host);
    });

    $$(".da-seg-btn", host).forEach((btn) => {
      bindEvent(btn, "click", () => {
        if (btn.classList.contains("active")) return;
        this.view = btn.dataset.view;
        this.selectedAppId = null;
        this.searchQuery = "";
        const search = $(".da-search", host);
        if (search) search.value = "";
        this.render(host);
      });
    });

    bindEvent($(".da-search", host), "input", (e) => {
      this.searchQuery = e.target.value;
      this.render(host);
    });

    bindEvent($(".da-reset", host), "click", async () => {
      const confirmed = await os.dialog.confirm(
        "Reset Defaults",
        "Reset every file type to the system default app? This cannot be undone."
      );
      if (!confirmed) return;
      resetAllDefaults();
      os.notify.send("Default Apps", "All file type defaults have been reset.");
    });
  }

  render(host) {
    const content = $(".da-content", host);
    const backBtn = $(".da-back", host);
    const title = $(".da-title", host);
    const isDetail = this.view === "apps" && this.selectedAppId;

    $$(".da-seg-btn", host).forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.view === this.view);
    });

    if (backBtn) backBtn.hidden = !isDetail;
    if (title) title.textContent = "Default apps";

    if (this.view === "apps" && this.selectedAppId) {
      content.innerHTML = this.buildAppDetail(this.selectedAppId);
      this.bindAppDetail(host, content);
      return;
    }

    if (this.view === "apps") {
      content.innerHTML = this.buildAppList();
      this.bindAppList(host, content);
      return;
    }

    content.innerHTML = this.buildFileTypeList();
    this.bindFileTypeList(host, content);
  }

  iconHtml(app, className) {
    if (typeof app.icon === "string" && app.icon.startsWith("http")) {
      return `<img class="${className}" src="${app.icon}" alt="" />`;
    }
    return `<i class="${className} ${app.icon}"></i>`;
  }

  buildAppList() {
    const apps = getAllPickableApps();
    const query = this.searchQuery.trim().toLowerCase();
    const filtered = query ? apps.filter((app) => app.title.toLowerCase().includes(query)) : apps;

    if (!filtered.length) {
      return `<div class="da-empty">No apps match your search</div>`;
    }

    return `
      <div class="da-list">
        ${filtered
          .map((app) => {
            const count = getExtensionsForApp(app.appId).length;
            return `
              <button class="da-app-row" data-app="${app.appId}">
                <span class="da-app-icobox">${this.iconHtml(app, "da-app-icobox-img")}</span>
                <span class="da-app-meta">
                  <span class="da-app-name">${app.title}</span>
                  <span class="da-app-sub">${count} file type${count === 1 ? "" : "s"}</span>
                </span>
                <span class="da-chevron"><i class="fas fa-chevron-right"></i></span>
              </button>
            `;
          })
          .join("")}
      </div>
    `;
  }

  bindAppList(win, content) {
    $$(".da-app-row", content).forEach((row) => {
      bindEvent(row, "click", () => {
        this.selectedAppId = row.dataset.app;
        this.render(win);
      });
    });
  }

  buildAppDetail(appId) {
    const app = getAllPickableApps().find((a) => a.appId === appId);
    if (!app) return `<div class="da-empty">App not found</div>`;

    const extensions = getExtensionsForApp(appId);
    const ownCount = extensions.filter((ext) => getDefaultAppForExt(ext)?.appId === appId).length;

    return `
      <div class="da-detail">
        <div class="da-detail-header">
          <span class="da-app-icobox large">${this.iconHtml(app, "da-app-icobox-img")}</span>
          <div class="da-detail-heading">
            <div class="da-detail-name">${app.title}</div>
            <div class="da-detail-sub">${ownCount} of ${extensions.length} file types set to this app</div>
          </div>
          <button class="da-set-default-btn" data-set-default="${appId}" data-app-name="${app.title}">Set default</button>
        </div>
        <div class="da-detail-section-title">File types</div>
        <div class="da-list">
          ${extensions
            .map((ext) => {
              const current = getDefaultAppForExt(ext);
              const isDefault = current?.appId === appId;
              return `
                <div class="da-file-row" data-ext="${ext}">
                  <span class="da-file-ext">.${ext}</span>
                  <span class="da-file-current">
                    ${
                      isDefault
                        ? `<span class="da-default-tag"><i class="fas fa-check"></i> Default</span>`
                        : current
                          ? current.title
                          : "No default"
                    }
                  </span>
                  <button class="da-change-btn" data-change="${ext}">Change</button>
                  ${current ? `<button class="da-remove-btn" data-remove="${ext}">Remove</button>` : ""}
                </div>
              `;
            })
            .join("")}
        </div>
      </div>
    `;
  }

  bindAppDetail(win, content) {
    bindEvent($(".da-set-default-btn", content), "click", (e) => {
      const appId = e.currentTarget.dataset.setDefault;
      for (const ext of getExtensionsForApp(appId)) {
        setDefaultApp(ext, appId);
      }
      os.notify.send("Default Apps", `${e.currentTarget.dataset.appName} is now the default for all its file types.`);
    });
    $$(".da-change-btn", content).forEach((btn) => {
      bindEvent(btn, "click", async () => {
        const ext = btn.dataset.change;
        await showChooseAppDialog({ ext, name: `file.${ext}`, path: [], setOnly: true });
      });
    });
    $$(".da-remove-btn", content).forEach((btn) => {
      bindEvent(btn, "click", async () => {
        const ext = btn.dataset.remove;
        const confirmed = await os.dialog.confirm(
          "Remove Association",
          `Stop opening .${ext} files automatically? You can pick an app next time you open one.`
        );
        if (!confirmed) return;
        unassociateExtension(ext);
        os.notify.send("Default Apps", `No default app for .${ext} files.`);
      });
    });
  }

  buildFileTypeList() {
    const registered = getRegisteredExtensions();
    const query = this.searchQuery.trim().toLowerCase();
    const filtered = query ? registered.filter((ext) => ext.toLowerCase().includes(query)) : registered;

    if (!filtered.length) {
      return `<div class="da-empty">No file types match your search</div>`;
    }

    return `
      <div class="da-list">
        ${filtered
          .map((ext) => {
            const current = getDefaultAppForExt(ext);
            return `
              <div class="da-file-row" data-ext="${ext}">
                <span class="da-file-ext">.${ext}</span>
                <span class="da-file-current">${current ? current.title : "No default"}</span>
                <button class="da-change-btn" data-change="${ext}">Change</button>
                ${current ? `<button class="da-remove-btn" data-remove="${ext}">Remove</button>` : ""}
              </div>
            `;
          })
          .join("")}
      </div>
    `;
  }

  bindFileTypeList(win, content) {
    $$(".da-change-btn", content).forEach((btn) => {
      bindEvent(btn, "click", async () => {
        const ext = btn.dataset.change;
        await showChooseAppDialog({ ext, name: `file.${ext}`, path: [], setOnly: true });
      });
    });
    $$(".da-remove-btn", content).forEach((btn) => {
      bindEvent(btn, "click", async () => {
        const ext = btn.dataset.remove;
        const confirmed = await os.dialog.confirm(
          "Remove Association",
          `Stop opening .${ext} files automatically? You can pick an app next time you open one.`
        );
        if (!confirmed) return;
        unassociateExtension(ext);
        os.notify.send("Default Apps", `No default app for .${ext} files.`);
      });
    });
  }
}
