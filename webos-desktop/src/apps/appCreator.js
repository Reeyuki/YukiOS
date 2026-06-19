import "../styles/appCreator.css";
import { isImageFile } from "../fileDisplay.js";
import { refreshIcons } from "../shared/contextMenu.js";
import { PROXIES, clampProxyIndex, buildProxyUrl, fetchHtmlThroughProxy } from "../proxies.js";
import { AppSource } from "../AppSource.js";
import { PREDEFINED_AVATARS } from "./accountManager.js";
import { $, $$, bindEvent, setText, setHTML, toggleClass } from "../shared/domUtils.js";
import { createScramjetWebApp } from "../core/ScramjetWebAppFactory.js";

import { BaseApp, StorageKeys, os } from "../framework.js";
const AC = {
  WIN_ID: "app-creator-win",
  FS_FOLDER: ["Apps"],
  APP_ID_PREFIX: "custom-",
  TASKBAR_ICON: "fas fa-cubes",
  FALLBACK_ICON: "fas fa-window-maximize",
  WIN_WIDTH: "560px",
  WIN_HEIGHT: "520px"
};

function resolvedIcon(iconUrl) {
  if (!iconUrl || iconUrl.trim() === "") return AC.FALLBACK_ICON;
  return iconUrl;
}

function isImageIcon(iconValue) {
  if (typeof iconValue !== "string") return false;
  return isImageFile(iconValue) || iconValue.startsWith("data:");
}

function buildAppMapEntry(name, url, icon, faviconUrl, proxyEnabled = false, proxyIndex = 0, scramjetEnabled = false) {
  const iconValue = faviconUrl || icon;
  return { type: "game", title: name, url, icon, iconValue, faviconUrl, proxyEnabled, proxyIndex, scramjetEnabled };
}

function buildAppMeta(
  appId,
  name,
  url,
  icon,
  faviconUrl,
  proxyEnabled = false,
  proxyIndex = 0,
  scramjetEnabled = false
) {
  return { appId, name, url, icon, faviconUrl, type: "game", proxyEnabled, proxyIndex, scramjetEnabled };
}

function deriveFaviconUrl(appUrl) {
  try {
    const { origin } = new URL(appUrl);
    return `${origin}/favicon.ico`;
  } catch {
    return null;
  }
}

function ensureHttpsProtocol(url) {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) return url;
  if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(url)) return `https://${url}`;
  if (/^[a-z]+:/i.test(url)) return url;
  return `https://${url}`;
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

export class AppCreatorApp extends BaseApp {
  constructor(services) {
    super(services);
    this.appLauncher = services.appLauncher;
    this.desktopUI = services.desktopUI || null;
    this._declarativeApp = null;
    this._customScramjetApps = new Map();
  }

  _registerCustomScramjetApp(appId, name, url, icon) {
    if (this._customScramjetApps.has(appId)) {
      return this._customScramjetApps.get(appId);
    }

    const AppClass = createScramjetWebApp({
      appId,
      appName: name,
      targetUrl: url,
      appIcon: icon,
      windowSize: ["1280px", "800px"]
    });

    const appInstance = new AppClass(this._services);
    this.appLauncher.appRuntime.register(appId, appInstance);
    this._customScramjetApps.set(appId, appInstance);

    return appInstance;
  }

  initAppCreator(payload, event, element, state) {
    this.restoreInstalledApps();
  }

  open(editAppId = null) {
    const existing = document.getElementById(AC.WIN_ID);
    if (existing) {
      os.window.focus(existing);
      if (editAppId) this._enterEditMode(existing, editAppId);
      return;
    }

    const content = `
      <div class="window-header">
        <span><i class="fas fa-cubes" style="color: white;margin-right: 6px;font-size: 25px;vertical-align: middle;"></i>App Creator</span>
        ${os.window.getWindowControls()}
      </div>
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
              <label class="ac-checkbox">
                <input type="checkbox" id="ac-scramjet-enabled" />
                <span>Use Scramjet mode (Broken right now, will fix it soon. You can open scramjet app normally meanwhile.)</span>
              </label>
              <p class="ac-hint">Scramjet mode uses a proxy browser for better compatibility with web apps.</p>
            </div>

            <div class="ac-icon-section">
              <label class="ac-label">Icon</label>
              <div class="ac-icon-row">
                <div class="ac-icon-preview" id="ac-icon-preview"><i class="fas fa-window-maximize"></i></div>
                <div class="ac-icon-inputs">
                  <p class="ac-hint">Upload a local icon file:</p>
                  <input class="ac-icon-file-input" type="file" id="ac-icon-file" accept="image/*" />
                  <p class="ac-hint">Or choose from profile avatars:</p>
                  <button class="ac-avatar-toggle-btn" id="ac-avatar-toggle-btn">Choose Avatar</button>
                </div>
              </div>
            </div>

            <hr class="ac-divider" />
            <div id="ac-status" class="ac-status"></div>

            <div class="ac-btn-row">
              <button class="ac-btn ac-btn-secondary" id="ac-preview-btn">Preview</button>
              <button class="ac-btn ac-btn-primary" id="ac-install-btn">Install App</button>
            </div>

            <hr class="ac-divider" />
            <div class="ac-section-title">Installed Apps</div>
            <div class="ac-installed-list" id="ac-installed-list">
              <div class="ac-empty">Loading...</div>
            </div>
          </div>
        </div>
      </div>
    `;

    const win = os.window.create(AC.WIN_ID, "App Creator", AC.WIN_WIDTH, AC.WIN_HEIGHT, {
      icon: AC.TASKBAR_ICON
    });
    win.innerHTML = content;
    os.window.addToTaskbar(AC.WIN_ID, "App Creator", AC.TASKBAR_ICON);

    this._setupControls(win);
    this._refreshInstalledList(win);

    if (editAppId) this._enterEditMode(win, editAppId);
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
        clampProxyIndex(app.proxyIndex, PROXIES),
        !!app.scramjetEnabled
      );
      this._addToDesktop(app.appId, app.name, app.icon, app.faviconUrl);

      if (app.scramjetEnabled) {
        this._registerCustomScramjetApp(app.appId, app.name, app.url, app.icon);
      }
    }
  }

  _setupControls(win) {
    const iconFileInput = $("#ac-icon-file", win);
    const iconPreview = $("#ac-icon-preview", win);
    const installBtn = $("#ac-install-btn", win);
    const previewBtn = $("#ac-preview-btn", win);
    const cancelEditBtn = $("#ac-cancel-edit-btn", win);
    const status = $("#ac-status", win);
    const appUrlInput = $("#ac-url", win);
    const proxyEnabledInput = $("#ac-proxy-enabled", win);
    const proxySelect = $("#ac-proxy-select", win);
    const scramjetEnabledInput = $("#ac-scramjet-enabled", win);

    if (!installBtn) {
      console.error("AppCreator: installBtn not found in DOM");
      return;
    }

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
        const img = document.createElement("img");
        img.src = src;
        img.onerror = () => {
          iconPreview.innerHTML = `<i class="fas fa-window-maximize"></i>`;
        };
        iconPreview.innerHTML = "";
        iconPreview.appendChild(img);
      } else {
        iconPreview.innerHTML = `<i class="${src}" style="font-size:18px;"></i>`;
      }
    };
    win._setPreviewImg = setPreviewImg;

    const resetForm = () => {
      editingAppId = null;
      resolvedIconDataUrl = null;
      faviconLoadedUrl = null;
      $("#ac-name", win).value = "";
      appUrlInput.value = "";
      if (proxyEnabledInput) proxyEnabledInput.checked = false;
      if (proxySelect) proxySelect.value = "0";
      if (proxySelect) proxySelect.disabled = true;
      if (scramjetEnabledInput) scramjetEnabledInput.checked = false;
      setHTML(iconPreview, `<i class="fas fa-window-maximize"></i>`);
      const editBanner = $("#ac-edit-banner", win);
      if (editBanner) editBanner.classList.remove("active");
      const formTitle = $("#ac-form-title", win);
      if (formTitle) setText(formTitle, "Install Custom App");
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
      if (!url || resolvedIconDataUrl) return;

      faviconDebounceTimer = setTimeout(async () => {
        const loaded = await tryLoadFavicon(url);
        if (!loaded) return;
        if (resolvedIconDataUrl) return;
        faviconLoadedUrl = loaded;
        setPreviewImg(loaded);
      }, 600);
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

    const avatarToggleBtn = $("#ac-avatar-toggle-btn", win);
    if (avatarToggleBtn) {
      avatarToggleBtn.addEventListener("click", () => {
        this._openAvatarPickerWindow(win, setPreviewImg);
      });
    }

    previewBtn.addEventListener("click", async () => {
      const url = appUrlInput.value.trim();
      const name = $("#ac-name", win).value.trim() || "Preview";
      if (!url) {
        this._showStatus(status, "error", "Please enter a URL to preview.");
        return;
      }
      const useProxy = !!proxyEnabledInput?.checked;
      const proxyIndex = clampProxyIndex(parseInt(proxySelect?.value), PROXIES);
      const useScramjet = !!scramjetEnabledInput?.checked;
      await this._openPreviewWindow(name, url, useProxy, proxyIndex, useScramjet);
    });

    installBtn.addEventListener("click", () => {
      const name = $("#ac-name", win).value.trim();
      const url = appUrlInput.value.trim();
      const iconUrl = resolvedIcon(resolvedIconDataUrl || faviconLoadedUrl);
      const proxyEnabled = !!proxyEnabledInput?.checked;
      const proxyIndex = clampProxyIndex(parseInt(proxySelect?.value), PROXIES);
      const scramjetEnabled = !!scramjetEnabledInput?.checked;

      if (!name) {
        this._showStatus(status, "error", "App name is required.");
        return;
      }
      if (!url) {
        this._showStatus(status, "error", "App URL is required.");
        return;
      }
      const secureUrl = ensureHttpsProtocol(url);
      try {
        new URL(secureUrl);
      } catch {
        this._showStatus(status, "error", "Invalid URL format.");
        return;
      }

      const task = editingAppId
        ? this._saveEdit(editingAppId, name, secureUrl, iconUrl, proxyEnabled, proxyIndex, scramjetEnabled, status, win)
        : this._installApp(name, secureUrl, iconUrl, proxyEnabled, proxyIndex, scramjetEnabled, status, win);
      task.catch(console.error);
    });
  }

  async _refreshInstalledList(win) {
    const list = $("#ac-installed-list", win);
    if (!list) return;

    const apps = await this._loadAllCustomApps();

    if (!apps.length) {
      setHTML(list, `<div class="ac-empty">No custom apps yet</div>`);
      return;
    }

    setHTML(list, "");
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
      const desktopFolder = await os.fs.readdir(["Desktop"]);
      for (const [fileName] of Object.entries(desktopFolder)) {
        if (!fileName.endsWith(".desktop")) continue;
        try {
          const raw = await this.fs.readTextFile(["Desktop"], fileName);
          if (!raw) continue;
          const data = JSON.parse(raw);
          if (data.isCustomApp && data.app?.startsWith(AC.APP_ID_PREFIX)) {
            apps.push({
              appId: data.app,
              name: data.name,
              url: data.url,
              icon: data.icon,
              faviconUrl: data.faviconUrl,
              type: data.type || "game",
              proxyEnabled: data.proxyEnabled || false,
              proxyIndex: data.proxyIndex || 0,
              scramjetEnabled: data.scramjetEnabled || false,
              _fileName: fileName
            });
          }
        } catch {}
      }
    } catch {}

    return apps;
  }

  async _loadAppMeta(appId) {
    try {
      const desktopFolder = await os.fs.readdir(["Desktop"]);
      for (const [fileName] of Object.entries(desktopFolder)) {
        if (!fileName.endsWith(".desktop")) continue;
        try {
          const raw = await this.fs.readTextFile(["Desktop"], fileName);
          if (!raw) continue;
          const data = JSON.parse(raw);
          if (data.isCustomApp && data.app === appId) return { ...data, _fileName: fileName };
        } catch {}
      }
    } catch {}
    return null;
  }

  async _enterEditMode(win, appId) {
    const meta = await this._loadAppMeta(appId);
    if (!meta) return;

    $("#ac-name", win).value = meta.name || "";
    $("#ac-url", win).value = meta.url || "";
    const proxyEnabledInput = $("#ac-proxy-enabled", win);
    const proxySelect = $("#ac-proxy-select", win);
    const scramjetEnabledInput = $("#ac-scramjet-enabled", win);
    if (proxyEnabledInput) proxyEnabledInput.checked = !!meta.proxyEnabled;
    if (proxySelect) {
      proxySelect.value = String(clampProxyIndex(meta.proxyIndex, PROXIES));
      proxySelect.disabled = !proxyEnabledInput?.checked;
    }
    if (scramjetEnabledInput) scramjetEnabledInput.checked = !!meta.scramjetEnabled;

    const iconIsData = meta.icon?.startsWith("data:");
    win._setResolvedIcon(iconIsData ? meta.icon : null);
    if (meta.icon) win._setPreviewImg(meta.icon);

    const editLabel = $("#ac-edit-label", win);
    if (editLabel) setText(editLabel, `Editing: ${meta.name}`);
    const editBanner = $("#ac-edit-banner", win);
    if (editBanner) editBanner.classList.add("active");
    const formTitle = $("#ac-form-title", win);
    if (formTitle) setText(formTitle, "Edit Custom App");
    const installBtn = $("#ac-install-btn", win);
    if (installBtn) installBtn.textContent = "Save Changes";
    win._setEditingAppId(appId);

    $("#ac-name", win).focus();
    $(".window-content", win).scrollTop = 0;
  }

  async _saveEdit(appId, name, url, iconUrl, proxyEnabled, proxyIndex, scramjetEnabled, statusEl, win) {
    const meta = await this._loadAppMeta(appId);
    if (!meta) {
      this._showStatus(statusEl, "error", "Could not find app to edit.");
      os.notify.send("", `Failed to update "${name}": app not found.`, { appSource: AppSource.APP_CREATOR });
      return;
    }

    const faviconUrl = meta.faviconUrl || deriveFaviconUrl(url);
    const newFileName = `${name}.desktop`;
    const fileNameChanged = meta._fileName !== newFileName;

    const updated = {
      app: appId,
      name,
      url,
      icon: iconUrl,
      faviconUrl,
      type: "game",
      proxyEnabled,
      proxyIndex,
      scramjetEnabled,
      isCustomApp: true
    };

    try {
      if (fileNameChanged) {
        await os.fs.delete(["Desktop"], meta._fileName);
      }
      await os.fs.write(["Desktop", newFileName], JSON.stringify(updated, null, 2));
    } catch (e) {
      console.warn("AppCreator: fs update failed", e);
      os.notify.send("", `Failed to save "${name}" to filesystem.`);
    }

    if (this.appLauncher?.appMap?.[appId]) {
      this.appLauncher.appMap[appId] = buildAppMapEntry(
        name,
        url,
        iconUrl,
        faviconUrl,
        !!proxyEnabled,
        clampProxyIndex(proxyIndex, PROXIES),
        !!scramjetEnabled
      );
    }

    if (scramjetEnabled) {
      this._registerCustomScramjetApp(appId, name, url, iconUrl);
    } else {
      if (this._customScramjetApps.has(appId)) {
        this.appLauncher.appRuntime.unregister(appId);
        this._customScramjetApps.delete(appId);
      }
    }

    if (fileNameChanged) {
      const oldIcon = document.querySelector(`.desktop-file-icon[data-file-name="${CSS.escape(meta._fileName)}"]`);
      if (oldIcon) oldIcon.remove();
      await this.desktopUI.iconManager.createDesktopFileIcon(newFileName);
      const icon = document.querySelector(`.desktop-file-icon[data-file-name="${CSS.escape(newFileName)}"]`);
      if (icon) {
        icon.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          e.stopPropagation();
          this._showCustomAppContextMenu(e, icon, appId, this.desktopUI);
        });
      }
    } else {
      this._updateDesktopIcon(appId, name, iconUrl);
    }

    $("#ac-cancel-edit-btn", win).click();
    this._showStatus(statusEl, "success", `"${name}" updated successfully.`);
    os.notify.send(`"${name}" updated successfully.`);
    this._refreshInstalledList(win);
  }

  async _deleteApp(appId, win) {
    const meta = await this._loadAppMeta(appId);
    if (!meta) return;

    if (!(await os.dialog.confirm("Confirm", `Delete "${meta.name}"? The desktop icon will also be removed.`))) return;

    try {
      await os.fs.delete(["Desktop"], meta._fileName);
    } catch (e) {
      console.warn("AppCreator: fs delete failed", e);
      os.notify.send("", `Failed to delete "${meta.name}" from filesystem.`, { appSource: AppSource.APP_CREATOR });
    }

    delete this.appLauncher?.appMap?.[appId];

    const desktopIcon = document.querySelector(`.desktop-file-icon[data-file-name="${CSS.escape(meta._fileName)}"]`);
    if (desktopIcon) desktopIcon.remove();

    os.notify.send("", `"${meta.name}" has been uninstalled.`);

    if (win) this._refreshInstalledList(win);
  }

  async _updateDesktopIcon(appId, name, iconUrl) {
    const meta = await this._loadAppMeta(appId);
    if (!meta) return;

    const desktopIcon = document.querySelector(`.desktop-file-icon[data-file-name="${CSS.escape(meta._fileName)}"]`);
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

  async _openPreviewWindow(name, url, proxyEnabled = false, proxyIndex = 0, scramjetEnabled = false) {
    const secureUrl = ensureHttpsProtocol(url);
    let finalUrl = secureUrl;

    console.log(
      "[AppCreator Preview] URL:",
      secureUrl,
      "Proxy enabled:",
      proxyEnabled,
      "Proxy index:",
      proxyIndex,
      "Scramjet enabled:",
      scramjetEnabled
    );

    if (scramjetEnabled) {
      const wispUrl = os.storage.get(StorageKeys.wispServer) || "wss://hurt-agata-liventcord-api-7072e9a6.koyeb.app/";
      finalUrl = `/scramapps/scramjet-template.html?wisp=${encodeURIComponent(wispUrl)}&target=${encodeURIComponent(secureUrl)}`;
      console.log("[AppCreator Preview] Using scramjet template:", finalUrl);
    } else if (proxyEnabled && typeof secureUrl === "string" && /^https?:\/\//.test(secureUrl)) {
      try {
        console.log("[AppCreator Preview] Fetching through proxy...");
        finalUrl = await fetchHtmlThroughProxy(secureUrl, proxyIndex, PROXIES);
        console.log("[AppCreator Preview] Got blob URL:", finalUrl);
      } catch (e) {
        console.error("[AppCreator Preview] Failed to fetch through proxy:", e);
        console.log("[AppCreator Preview] Falling back to direct proxy URL");
        finalUrl = buildProxyUrl(secureUrl, proxyIndex, PROXIES);
        console.log("[AppCreator Preview] Fallback URL:", finalUrl);
      }
    }

    const winId = `app-creator-preview-${Date.now()}`;
    const win = os.window.create(winId, `${name} - Preview`, "80vw", "80vh", {
      icon: AC.TASKBAR_ICON
    });
    win.innerHTML = `
      <div class="window-content">
        <iframe src="${finalUrl}" style="width:100%;height:100%;border:none;" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>
      </div>
    `;
    os.window.addToTaskbar(winId, `${name} - Preview`, AC.TASKBAR_ICON);
  }

  async _installApp(name, url, iconUrl, proxyEnabled, proxyIndex, scramjetEnabled, statusEl, win) {
    const secureUrl = ensureHttpsProtocol(url);
    const appId = `${AC.APP_ID_PREFIX}${name.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`;
    const fileName = `${name}.desktop`;
    const faviconUrl = deriveFaviconUrl(secureUrl);
    const appMeta = buildAppMeta(
      appId,
      name,
      secureUrl,
      iconUrl,
      faviconUrl,
      !!proxyEnabled,
      clampProxyIndex(proxyIndex, PROXIES),
      !!scramjetEnabled
    );

    const desktopFileContent = JSON.stringify({
      app: appId,
      name,
      url: secureUrl,
      icon: iconUrl,
      faviconUrl,
      type: "game",
      proxyEnabled,
      proxyIndex,
      scramjetEnabled,
      isCustomApp: true
    });

    try {
      await os.fs.write(["Desktop", fileName], desktopFileContent);
    } catch (e) {
      console.warn("AppCreator: could not persist app to filesystem", e);
      os.notify.send("", `Failed to save "${name}" to filesystem.`);
    }

    this.appLauncher.appMap[appId] = buildAppMapEntry(
      name,
      url,
      iconUrl,
      faviconUrl,
      !!proxyEnabled,
      clampProxyIndex(proxyIndex, PROXIES),
      !!scramjetEnabled
    );
    this._addToDesktop(appId, name, iconUrl, faviconUrl);

    if (scramjetEnabled) {
      this._registerCustomScramjetApp(appId, name, secureUrl, iconUrl);
    }

    this._showStatus(statusEl, "success", `"${name}" installed!`);
    os.notify.send("", `"${name}" installed and added to desktop.`);
    this._refreshInstalledList(win);
  }

  async _addToDesktop(appId, name, iconUrl, faviconUrl) {
    if (this.desktopUI) {
      const fileName = `${name}.desktop`;
      await this.desktopUI.iconManager.createDesktopFileIcon(fileName);
      const icon = document.querySelector(`.desktop-file-icon[data-file-name="${CSS.escape(fileName)}"]`);
      if (icon) {
        icon.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          e.stopPropagation();
          this._showCustomAppContextMenu(e, icon, appId, this.desktopUI);
        });
      }
    } else {
      console.warn("AppCreator: desktopUI not set, call setDesktopUI() after construction.");
    }
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
      os.app.launch(appId);
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

  _openAvatarPickerWindow(parentWin, setPreviewImg) {
    const winId = "avatar-picker-win";
    const existing = document.getElementById(winId);
    if (existing) {
      os.window.focus(existing);
      return;
    }

    const content = `
      <div class="window-header">
        <span><i class="fas fa-images" style="color: white;margin-right: 6px;font-size: 20px;vertical-align: middle;"></i>Choose Avatar</span>
        ${os.window.getWindowControls()}
      </div>
      <div class="window-content" style="padding: 16px;">
        <div class="ac-avatar-grid-window" id="ac-avatar-grid-window">
          ${PREDEFINED_AVATARS.map(
            (avatar) => `
            <div class="ac-avatar-option-window" data-src="${avatar}">
              <img src="${avatar}" />
            </div>
          `
          ).join("")}
        </div>
      </div>
    `;

    const win = os.window.create(winId, "Choose Avatar", "320px", "336px", {
      icon: "fas fa-images"
    });
    win.innerHTML = content;
    os.window.addToTaskbar(winId, "Choose Avatar", "fas fa-images");

    const avatarOptions = win.querySelectorAll(".ac-avatar-option-window");
    avatarOptions.forEach((option) => {
      option.addEventListener("click", () => {
        const avatarUrl = option.dataset.src;
        if (!avatarUrl) return;
        setPreviewImg(avatarUrl);
        const iconPreview = $("#ac-icon-preview", parentWin);
        if (iconPreview) {
          parentWin._setResolvedIcon(avatarUrl);
          parentWin._setPreviewImg(avatarUrl);
        }
        os.window.close(win);
      });
    });
  }
}
