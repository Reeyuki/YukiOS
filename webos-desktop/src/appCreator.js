import { BaseApp } from "./core/BaseApp.js";
import { isImageFile } from "./fileDisplay.js";
import { refreshIcons } from "./shared/contextMenu.js";
import { PROXIES, clampProxyIndex, buildProxyUrl } from "./proxies.js";
import { customConfirm } from "./shared/dialogs.js";
import { WindowHelper } from "./utils/WindowHelper.js";

const AC = {
  WIN_ID: "app-creator-win",
  FS_FOLDER: ["Apps"],
  APP_ID_PREFIX: "custom-",
  TASKBAR_ICON: "fas fa-cubes",
  FALLBACK_ICON: "fas fa-window-maximize",
  WIN_WIDTH: "560px",
  WIN_HEIGHT: "620px"
};

function resolvedIcon(iconUrl) {
  if (!iconUrl || iconUrl.trim() === "") return AC.FALLBACK_ICON;
  return iconUrl;
}

function isImageIcon(iconValue) {
  if (typeof iconValue !== "string") return false;
  return isImageFile(iconValue) || iconValue.startsWith("data:");
}

function buildAppMapEntry(name, url, icon, faviconUrl, proxyEnabled = false, proxyIndex = 0) {
  const iconValue = faviconUrl || icon;
  return { type: "game", title: name, url, icon, iconValue, faviconUrl, proxyEnabled, proxyIndex };
}

function buildAppMeta(appId, name, url, icon, faviconUrl, proxyEnabled = false, proxyIndex = 0) {
  return { appId, name, url, icon, faviconUrl, type: "game", proxyEnabled, proxyIndex };
}

function deriveFaviconUrl(appUrl) {
  try {
    const { origin } = new URL(appUrl);
    return `${origin}/favicon.ico`;
  } catch {
    return null;
  }
}

function parseFaviconFromHtml(html, baseUrl) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const selectors = [
    "link[rel~='icon']",
    "link[rel='shortcut icon']",
    "link[rel='apple-touch-icon']",
    "link[rel='apple-touch-icon-precomposed']"
  ];
  for (const sel of selectors) {
    const el = doc.querySelector(sel);
    if (el?.href) {
      try {
        return new URL(el.getAttribute("href"), baseUrl).href;
      } catch {
        continue;
      }
    }
  }
  return null;
}

function probeImageUrl(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(url);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

async function tryLoadFavicon(appUrl) {
  try {
    const response = await fetch(appUrl, { method: "GET", redirect: "follow" });
    if (response.ok) {
      const html = await response.text();
      const fromHtml = parseFaviconFromHtml(html, appUrl);
      if (fromHtml) {
        const verified = await probeImageUrl(fromHtml);
        if (verified) return verified;
      }
    }
  } catch {}

  const fallbackUrl = deriveFaviconUrl(appUrl);
  if (!fallbackUrl) return null;
  return probeImageUrl(fallbackUrl);
}

function makeDesktopIconElement(appId, name, iconUrl) {
  const icon = document.createElement("div");
  icon.className = "icon selectable";
  icon.dataset.app = appId;
  icon.style.position = "absolute";
  icon.style.cursor = "default";

  let media;
  if (isImageIcon(iconUrl)) {
    media = document.createElement("img");
    media.src = iconUrl;
    media.onerror = () => {
      const fallback = document.createElement("i");
      fallback.className = AC.FALLBACK_ICON;
      media.replaceWith(fallback);
    };
  } else {
    media = document.createElement("i");
    media.className = iconUrl || AC.FALLBACK_ICON;
    media.style.cssText = "font-size:48px;pointer-events:none;";
  }

  const label = document.createElement("div");
  label.textContent = name;

  icon.append(media, label);
  return icon;
}

export class AppCreatorApp extends BaseApp {
  constructor(services) {
    super(services);
    this.windowHelper = new WindowHelper(this.wm);
    this.appLauncher = services.appLauncher;
    this.desktopUI = services.desktopUI || null;
  }

  setDesktopUI(desktopUI) {
    this.desktopUI = desktopUI;
  }

  setAppLauncher(appLauncher) {
    this.appLauncher = appLauncher;
  }

  async restoreInstalledApps() {
    const apps = await this._loadAllCustomApps();
    for (const app of apps) {
      this.appLauncher.appMap[app.appId] = buildAppMapEntry(
        app.name,
        app.url,
        app.icon,
        app.faviconUrl,
        !!app.proxyEnabled,
        clampProxyIndex(app.proxyIndex, PROXIES)
      );
      this._addToDesktop(app.appId, app.name, app.icon, app.faviconUrl);
    }
  }

  open(editAppId = null) {
    const existing = document.getElementById(AC.WIN_ID);
    if (existing) {
      this.wm.bringToFront(existing);
      if (editAppId) this._enterEditMode(existing, editAppId);
      return;
    }

    const content = `
      <div class="window-content">
        <div class="ac-pane">
          <div id="app-creator-form">
            <div class="ac-section-title" id="ac-form-title">Install Custom App</div>

            <div class="ac-edit-banner" id="ac-edit-banner">
              <span id="ac-edit-label">Editing: </span>
              <button class="ac-btn ac-btn-secondary ac-cancel-edit-btn" id="ac-cancel-edit-btn">Cancel Edit</button>
            </div>

            <div>
              <label class="ac-label" for="ac-name">App Name</label>
              <input class="ac-input" id="ac-name" type="text" placeholder="My App" spellcheck="false" />
            </div>

            <div>
              <label class="ac-label" for="ac-url">App URL</label>
              <input class="ac-input" id="ac-url" type="url" placeholder="https://example.com" spellcheck="false" />
            </div>

            <div>
              <label class="ac-label">Proxy</label>
              <div class="ac-proxy-row">
                <label class="ac-checkbox">
                  <input type="checkbox" id="ac-proxy-enabled" />
                  <span>Use proxy for this app</span>
                </label>
                <select class="ac-input ac-proxy-select" id="ac-proxy-select">
                  ${PROXIES.map((p, i) => `<option value="${i}">${p.label}</option>`).join("")}
                </select>
              </div>
              <p class="ac-hint">If the app is blocked by CORS, try enabling a proxy.</p>
            </div>

            <div>
              <label class="ac-label">Icon</label>
              <div class="ac-icon-row">
                <div class="ac-icon-preview" id="ac-icon-preview"><span>📦</span></div>
                <input class="ac-input" id="ac-icon-url" type="url" placeholder="https://example.com/icon.png" spellcheck="false" />
              </div>
              <p class="ac-hint">Or upload a local icon file:</p>
              <input class="ac-icon-file-input" type="file" id="ac-icon-file" accept="image/*" />
            </div>

            <hr class="ac-divider" />
            <div id="ac-status" class="ac-status"></div>

            <div class="ac-btn-row">
              <button class="ac-btn ac-btn-secondary" id="ac-preview-btn">Preview</button>
              <button class="ac-btn ac-btn-primary" id="ac-install-btn">Install App</button>
            </div>
          </div>
        </div>

        <div class="ac-pane ac-installed-pane">
          <div class="ac-section-title ac-installed-title">Installed Custom Apps</div>
          <div class="ac-installed-list" id="ac-installed-list">
            <div class="ac-empty">Loading...</div>
          </div>
        </div>
      </div>
    `;

    const win = this.windowHelper.createAndMountWindow(AC.WIN_ID, "App Creator", content, AC.WIN_WIDTH, AC.WIN_HEIGHT, {
      icon: AC.TASKBAR_ICON
    });

    this._setupControls(win);
    this._refreshInstalledList(win);

    if (editAppId) this._enterEditMode(win, editAppId);
  }

  _setupControls(win) {
    const iconUrlInput = win.querySelector("#ac-icon-url");
    const iconFileInput = win.querySelector("#ac-icon-file");
    const iconPreview = win.querySelector("#ac-icon-preview");
    const installBtn = win.querySelector("#ac-install-btn");
    const previewBtn = win.querySelector("#ac-preview-btn");
    const cancelEditBtn = win.querySelector("#ac-cancel-edit-btn");
    const status = win.querySelector("#ac-status");
    const appUrlInput = win.querySelector("#ac-url");
    const proxyEnabledInput = win.querySelector("#ac-proxy-enabled");
    const proxySelect = win.querySelector("#ac-proxy-select");

    let resolvedIconDataUrl = null;
    let editingAppId = null;
    let faviconLoadedUrl = null;

    win._setEditingAppId = (id) => {
      editingAppId = id;
    };
    win._setResolvedIcon = (v) => {
      resolvedIconDataUrl = v;
    };

    const setPreviewImg = (src) => {
      if (isImageIcon(src)) {
        iconPreview.innerHTML = `<img src="${src}" onerror="this.parentElement.innerHTML='<span>📦</span>'" />`;
      } else {
        iconPreview.innerHTML = `<i class="${src}" style="font-size:22px;"></i>`;
      }
    };
    win._setPreviewImg = setPreviewImg;

    const resetForm = () => {
      editingAppId = null;
      resolvedIconDataUrl = null;
      faviconLoadedUrl = null;
      win.querySelector("#ac-name").value = "";
      appUrlInput.value = "";
      if (proxyEnabledInput) proxyEnabledInput.checked = false;
      if (proxySelect) proxySelect.value = "0";
      if (proxySelect) proxySelect.disabled = true;
      iconUrlInput.value = "";
      iconPreview.innerHTML = `<span>📦</span>`;
      win.querySelector("#ac-edit-banner").classList.remove("active");
      win.querySelector("#ac-form-title").textContent = "Install Custom App";
      installBtn.textContent = "Install App";
    };

    cancelEditBtn.addEventListener("click", resetForm);
    if (proxySelect) proxySelect.disabled = !proxyEnabledInput?.checked;
    if (proxyEnabledInput && proxySelect) {
      proxyEnabledInput.addEventListener("change", () => {
        proxySelect.disabled = !proxyEnabledInput.checked;
      });
    }

    let faviconDebounceTimer = null;
    appUrlInput.addEventListener("input", () => {
      clearTimeout(faviconDebounceTimer);
      const url = appUrlInput.value.trim();
      if (!url || iconUrlInput.value.trim() || resolvedIconDataUrl) return;

      faviconDebounceTimer = setTimeout(async () => {
        const loaded = await tryLoadFavicon(url);
        if (!loaded) return;
        if (iconUrlInput.value.trim() || resolvedIconDataUrl) return;
        faviconLoadedUrl = loaded;
        setPreviewImg(loaded);
      }, 600);
    });

    iconUrlInput.addEventListener("change", () => {
      const url = iconUrlInput.value.trim();
      if (url) {
        resolvedIconDataUrl = null;
        faviconLoadedUrl = null;
        setPreviewImg(url);
      }
    });

    iconFileInput.addEventListener("change", () => {
      const file = iconFileInput.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        resolvedIconDataUrl = e.target.result;
        faviconLoadedUrl = null;
        setPreviewImg(resolvedIconDataUrl);
      };
      reader.readAsDataURL(file);
    });

    previewBtn.addEventListener("click", () => {
      const url = appUrlInput.value.trim();
      const name = win.querySelector("#ac-name").value.trim() || "Preview";
      if (!url) {
        this._showStatus(status, "error", "Please enter a URL to preview.");
        return;
      }
      const useProxy = !!proxyEnabledInput?.checked;
      const proxyIndex = clampProxyIndex(parseInt(proxySelect?.value), PROXIES);
      const finalUrl = useProxy ? buildProxyUrl(url, proxyIndex, PROXIES) : url;
      this._openPreviewWindow(name, finalUrl);
    });

    installBtn.addEventListener("click", () => {
      const name = win.querySelector("#ac-name").value.trim();
      const url = appUrlInput.value.trim();
      const iconUrl = resolvedIcon(resolvedIconDataUrl || iconUrlInput.value.trim() || faviconLoadedUrl);
      const proxyEnabled = !!proxyEnabledInput?.checked;
      const proxyIndex = clampProxyIndex(parseInt(proxySelect?.value), PROXIES);

      if (!name) {
        this._showStatus(status, "error", "App name is required.");
        return;
      }
      if (!url) {
        this._showStatus(status, "error", "App URL is required.");
        return;
      }
      try {
        new URL(url);
      } catch {
        this._showStatus(status, "error", "Invalid URL format.");
        return;
      }

      const task = editingAppId
        ? this._saveEdit(editingAppId, name, url, iconUrl, proxyEnabled, proxyIndex, status, win)
        : this._installApp(name, url, iconUrl, proxyEnabled, proxyIndex, status, win);
      task.catch(console.error);
    });
  }

  async _refreshInstalledList(win) {
    const list = win.querySelector("#ac-installed-list");
    if (!list) return;

    const apps = await this._loadAllCustomApps();

    if (!apps.length) {
      list.innerHTML = `<div class="ac-empty">No custom apps installed yet.</div>`;
      return;
    }

    list.innerHTML = "";
    for (const app of apps) {
      list.append(this._buildAppRow(win, app));
    }
  }

  _buildAppRow(win, app) {
    const row = document.createElement("div");
    row.className = "ac-app-row";
    row.dataset.appId = app.appId;

    let iconEl;
    if (isImageIcon(app.icon)) {
      iconEl = document.createElement("img");
      iconEl.className = "ac-app-row-icon";
      iconEl.src = app.icon;
      iconEl.onerror = () => {
        const i = document.createElement("i");
        i.className = AC.FALLBACK_ICON;
        i.style.fontSize = "28px";
        iconEl.replaceWith(i);
      };
    } else {
      iconEl = document.createElement("i");
      iconEl.className = `ac-app-row-icon ${app.icon || AC.FALLBACK_ICON}`;
    }

    const info = document.createElement("div");
    info.className = "ac-app-row-info";

    const nameEl = document.createElement("div");
    nameEl.className = "ac-app-row-name";
    nameEl.textContent = app.name;

    const urlEl = document.createElement("div");
    urlEl.className = "ac-app-row-url";
    urlEl.textContent = app.url;

    info.append(nameEl, urlEl);

    const actions = document.createElement("div");
    actions.className = "ac-app-row-actions";

    const editBtn = document.createElement("button");
    editBtn.className = "ac-row-btn ac-row-btn-edit";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => this._enterEditMode(win, app.appId));

    const delBtn = document.createElement("button");
    delBtn.className = "ac-row-btn ac-row-btn-delete";
    delBtn.textContent = "Delete";
    delBtn.addEventListener("click", () => this._deleteApp(app.appId, win));

    actions.append(editBtn, delBtn);
    row.append(iconEl, info, actions);
    return row;
  }

  async _loadAllCustomApps() {
    const apps = [];
    try {
      const folder = await this.fs.getFolder(AC.FS_FOLDER);
      for (const [fileName] of Object.entries(folder)) {
        if (!fileName.endsWith(".json")) continue;
        try {
          const raw = await this.fs.readTextFile(AC.FS_FOLDER, fileName);
          if (!raw) continue;
          const meta = JSON.parse(raw);
          if (meta.appId?.startsWith(AC.APP_ID_PREFIX)) apps.push({ ...meta, _fileName: fileName });
        } catch {}
      }
    } catch {}
    return apps;
  }

  async _loadAppMeta(appId) {
    try {
      const folder = await this.fs.getFolder(AC.FS_FOLDER);
      for (const [fileName] of Object.entries(folder)) {
        if (!fileName.endsWith(".json")) continue;
        try {
          const raw = await this.fs.readTextFile(AC.FS_FOLDER, fileName);
          if (!raw) continue;
          const meta = JSON.parse(raw);
          if (meta.appId === appId) return { ...meta, _fileName: fileName };
        } catch {}
      }
    } catch {}
    return null;
  }

  async _enterEditMode(win, appId) {
    const meta = await this._loadAppMeta(appId);
    if (!meta) return;

    win.querySelector("#ac-name").value = meta.name || "";
    win.querySelector("#ac-url").value = meta.url || "";
    const proxyEnabledInput = win.querySelector("#ac-proxy-enabled");
    const proxySelect = win.querySelector("#ac-proxy-select");
    if (proxyEnabledInput) proxyEnabledInput.checked = !!meta.proxyEnabled;
    if (proxySelect) {
      proxySelect.value = String(clampProxyIndex(meta.proxyIndex, PROXIES));
      proxySelect.disabled = !proxyEnabledInput?.checked;
    }

    const iconIsData = meta.icon?.startsWith("data:");
    win.querySelector("#ac-icon-url").value = iconIsData ? "" : meta.icon || "";
    win._setResolvedIcon(iconIsData ? meta.icon : null);
    if (meta.icon) win._setPreviewImg(meta.icon);

    win.querySelector("#ac-edit-label").textContent = `Editing: ${meta.name}`;
    win.querySelector("#ac-edit-banner").classList.add("active");
    win.querySelector("#ac-form-title").textContent = "Edit Custom App";
    win.querySelector("#ac-install-btn").textContent = "Save Changes";
    win._setEditingAppId(appId);

    win.querySelector("#ac-name").focus();
    win.querySelector(".window-content").scrollTop = 0;
  }

  async _saveEdit(appId, name, url, iconUrl, proxyEnabled, proxyIndex, statusEl, win) {
    const meta = await this._loadAppMeta(appId);
    if (!meta) {
      this._showStatus(statusEl, "error", "Could not find app to edit.");
      this.wm.sendNotify(`Failed to update "${name}": app not found.`);
      return;
    }

    const faviconUrl = meta.faviconUrl || deriveFaviconUrl(url);
    const updated = buildAppMeta(
      appId,
      name,
      url,
      iconUrl,
      faviconUrl,
      !!proxyEnabled,
      clampProxyIndex(proxyIndex, PROXIES)
    );

    try {
      const dir = this.fs.resolveUserPath(AC.FS_FOLDER);
      const filePath = this.fs.join(dir, meta._fileName);
      await this.fs.p("writeFile", filePath, JSON.stringify(updated, null, 2));
    } catch (e) {
      console.warn("AppCreator: fs update failed", e);
      this.wm.sendNotify(`Failed to save "${name}" to filesystem.`);
    }

    if (this.appLauncher?.appMap?.[appId]) {
      this.appLauncher.appMap[appId] = buildAppMapEntry(
        name,
        url,
        iconUrl,
        faviconUrl,
        !!proxyEnabled,
        clampProxyIndex(proxyIndex, PROXIES)
      );
    }

    this._updateDesktopIcon(appId, name, iconUrl);

    win.querySelector("#ac-cancel-edit-btn").click();
    this._showStatus(statusEl, "success", `"${name}" updated successfully.`);
    this.wm.sendNotify(`"${name}" updated successfully.`);
    this._refreshInstalledList(win);
  }

  async _deleteApp(appId, win) {
    const meta = await this._loadAppMeta(appId);
    if (!meta) return;

    if (!(await customConfirm(`Delete "${meta.name}"? The desktop icon will also be removed.`))) return;

    try {
      await this.fs.deleteItem(AC.FS_FOLDER, meta._fileName);
    } catch (e) {
      console.warn("AppCreator: fs delete failed", e);
      this.wm.sendNotify(`Failed to delete "${meta.name}" from filesystem.`);
    }

    delete this.appLauncher?.appMap?.[appId];

    const desktopIcon = document.querySelector(`.icon.selectable[data-app="${appId}"]`);
    if (desktopIcon) desktopIcon.remove();

    this.wm.sendNotify(`"${meta.name}" has been uninstalled.`);

    if (win) this._refreshInstalledList(win);
  }

  _updateDesktopIcon(appId, name, iconUrl) {
    const desktopIcon = document.querySelector(`.icon.selectable[data-app="${appId}"]`);
    if (!desktopIcon) return;

    const label = desktopIcon.querySelector("div");
    if (label) label.textContent = name;

    const existingImg = desktopIcon.querySelector("img");
    const existingI = desktopIcon.querySelector("i");

    if (isImageIcon(iconUrl)) {
      if (existingImg) {
        existingImg.src = iconUrl;
        existingImg.onerror = () => {
          const i = document.createElement("i");
          i.className = `${AC.FALLBACK_ICON} desktop-icon__fallback`;
          existingImg.replaceWith(i);
        };
      } else if (existingI) {
        const img = document.createElement("img");
        img.src = iconUrl;
        img.onerror = () => {
          const i = document.createElement("i");
          i.className = `${AC.FALLBACK_ICON} desktop-icon__fallback`;
          img.replaceWith(i);
        };
        existingI.replaceWith(img);
      }
    } else {
      const cls = iconUrl || AC.FALLBACK_ICON;
      if (existingI) {
        existingI.className = cls;
        existingI.classList.add("desktop-icon__fallback");
      } else if (existingImg) {
        const i = document.createElement("i");
        i.className = `${cls} desktop-icon__fallback`;
        existingImg.replaceWith(i);
      }
    }
  }

  _showStatus(el, type, msg) {
    el.className = `ac-status ${type}`;
    el.textContent = msg;
    setTimeout(() => {
      el.style.display = "none";
      el.className = "ac-status";
    }, 4000);
  }

  _openPreviewWindow(name, url) {
    const winId = `app-creator-preview-${Date.now()}`;
    const win = this.wm.createWindow(winId, `${name} — Preview`, "80vw", "80vh", true);
    win.innerHTML = `
      <div class="window-header">
        <span>${name} — Preview</span>
        ${this.wm.getWindowControls()}

      </div>
      <div class="window-content">
        <iframe src="${url}" style="width:100%;height:100%;border:none;" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>
      </div>
    `;
    this.windowHelper.mountWindow(win, winId, `${name} — Preview`, AC.TASKBAR_ICON);
  }

  async _installApp(name, url, iconUrl, proxyEnabled, proxyIndex, statusEl, win) {
    const appId = `${AC.APP_ID_PREFIX}${name.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`;
    const fileName = `${appId}.json`;
    const faviconUrl = deriveFaviconUrl(url);
    const appMeta = buildAppMeta(
      appId,
      name,
      url,
      iconUrl,
      faviconUrl,
      !!proxyEnabled,
      clampProxyIndex(proxyIndex, PROXIES)
    );

    try {
      await this.fs.ensureFolder(AC.FS_FOLDER);
      const dir = this.fs.resolveUserPath(AC.FS_FOLDER);
      const filePath = this.fs.join(dir, fileName);
      await this.fs.p("writeFile", filePath, JSON.stringify(appMeta, null, 2));
      await this.fs.writeMeta(dir, fileName, { kind: "text", icon: AC.FALLBACK_ICON });
    } catch (e) {
      console.warn("AppCreator: could not persist app to filesystem", e);
      this.wm.sendNotify(`Failed to save "${name}" to filesystem.`);
    }

    this.appLauncher.appMap[appId] = buildAppMapEntry(
      name,
      url,
      iconUrl,
      faviconUrl,
      !!proxyEnabled,
      clampProxyIndex(proxyIndex, PROXIES)
    );
    this._addToDesktop(appId, name, iconUrl, faviconUrl);
    this._showStatus(statusEl, "success", `"${name}" installed!`);
    this.wm.sendNotify(`"${name}" installed and added to desktop.`);
    this._refreshInstalledList(win);
  }

  _addToDesktop(appId, name, iconUrl, faviconUrl) {
    if (this.desktopUI) {
      this._addViaDesktopUI(this.desktopUI, appId, name, iconUrl, faviconUrl);
    } else {
      console.warn("AppCreator: desktopUI not set, call setDesktopUI() after construction.");
    }
  }

  _addViaDesktopUI(desktopUI, appId, name, iconUrl, faviconUrl) {
    const icon = makeDesktopIconElement(appId, name, iconUrl);
    desktop.append(icon);

    desktopUI.makeIconInteractable(icon);
    desktopUI.positionHelper.snap(icon);

    icon.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this._showCustomAppContextMenu(e, icon, appId, desktopUI);
    });
  }

  _showCustomAppContextMenu(e, icon, appId, desktopUI) {
    desktopUI.selectionManager.clear();
    desktopUI.selectionManager.add(icon);

    const menu = document.getElementById("context-menu");
    const items = [
      { id: "ctx-ca-open", label: "Open", icon: "fa-external-link-alt" },
      { id: "ctx-ca-edit", label: "Edit App", icon: "fa-edit" },
      { id: "ctx-ca-cut", label: "Cut", icon: "fa-cut" },
      { id: "ctx-ca-copy", label: "Copy", icon: "fa-copy" },
      { id: "ctx-ca-delete", label: "Delete", icon: "fa-trash-alt" },
      { id: "ctx-ca-props", label: "Properties", icon: "fa-info-circle" }
    ];

    menu.innerHTML = items
      .map(
        (i) =>
          `<div id="${i.id}"><i class="fas ${i.icon}" style="width:16px;margin-right:8px;opacity:0.6;"></i><span>${i.label}</span></div>`
      )
      .join("");

    refreshIcons(menu);

    menu.style.left = `${e.pageX}px`;
    menu.style.top = `${e.pageY}px`;
    menu.style.display = "block";

    const hide = () => {
      menu.style.display = "none";
    };

    menu.querySelector("#ctx-ca-open").onclick = () => {
      hide();
      this.appLauncher.launch(appId);
    };
    menu.querySelector("#ctx-ca-edit").onclick = () => {
      hide();
      this.open(appId);
    };
    menu.querySelector("#ctx-ca-cut").onclick = () => {
      hide();
      desktopUI.cutSelectedIcons([icon]);
    };
    menu.querySelector("#ctx-ca-copy").onclick = () => {
      hide();
      desktopUI.copySelectedIcons([icon]);
    };
    menu.querySelector("#ctx-ca-delete").onclick = () => {
      hide();
      this._deleteApp(appId, document.getElementById(AC.WIN_ID));
    };
    menu.querySelector("#ctx-ca-props").onclick = () => {
      hide();
      desktopUI.showPropertiesDialog(icon);
    };
  }
}
