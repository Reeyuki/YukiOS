import { appMap } from "./gamesList.js";

import { camelize } from "./utils.js";
import { StorageKeys } from "./settings.js";
import { speak } from "./clippy.js";
import { isImageFile } from "./utils.js";
import { resolveIconUrl, resolveGhUrl } from "./shared/assetResolver.js";
import { showDynamicContextMenu, refreshIcons } from "./shared/contextMenu.js";
import { CDN_CONFIG } from "./shared/cdnConfig.js";
import { getAppRegistry } from "./appRegistry.js";

function getStartMenuEl() {
  return document.getElementById("start-menu") || document.querySelector(".start-menu");
}

export function isStartMenuOpen() {
  const el = getStartMenuEl();
  return !!el && el.style.display === "flex";
}

export function closeStartMenu() {
  const el = getStartMenuEl();
  if (!el) return;
  if (el.style.display !== "flex") return;

  el.classList.add("closing");
  el.addEventListener(
    "animationend",
    () => {
      el.classList.remove("closing");
      el.style.display = "none";
    },
    { once: true }
  );
}

export function applyStartMenuSettings(el) {
  if (!el) return;
  const width = localStorage.getItem(StorageKeys.startMenuWidth) || "650";
  const height = localStorage.getItem(StorageKeys.startMenuHeight) || "500";
  el.style.width = `${width}px`;
  el.style.height = `${height}px`;

  const catsData = localStorage.getItem(StorageKeys.startMenuCats);
  let cats = {};
  if (catsData) {
    try {
      cats = JSON.parse(catsData);
    } catch (e) {}
  }
  const catNames = ["menu", "games", "system", "favorites", "customize", "settingsApp"];
  catNames.forEach((catName) => {
    const isEnabled = cats[catName] !== false;
    const catEl = el.querySelector(`.start-cat[data-cat="${catName}"]`);
    if (catEl) {
      catEl.style.display = isEnabled ? "flex" : "none";
    }
  });
}

export function openStartMenu({ focusSearch = false, openDefaultPage = true } = {}) {
  const el = getStartMenuEl();
  if (!el) return;

  applyStartMenuSettings(el);

  el.classList.remove("closing");
  el.style.display = "flex";
  updateFavoritesUI();

  if (sharedAppLauncher) {
    populateStartMenu(sharedAppLauncher);
  }

  if (openDefaultPage) {
    const catsData = localStorage.getItem(StorageKeys.startMenuCats);
    let cats = {};
    if (catsData) {
      try {
        cats = JSON.parse(catsData);
      } catch (e) {}
    }
    let defaultCat = "menu";
    if (cats["menu"] === false) {
      const catNames = ["menu", "games", "system", "favorites", "customize", "settingsApp"];
      const firstEnabled = catNames.find((c) => cats[c] !== false);
      if (firstEnabled) defaultCat = firstEnabled;
    }
    el.querySelector(`.start-cat[data-cat="${defaultCat}"]`)?.click();
  }

  if (focusSearch) {
    document.getElementById("start-menu-search")?.focus?.();
  }
}

export function toggleStartMenu(opts) {
  if (isStartMenuOpen()) closeStartMenu();
  else openStartMenu(opts);
}

function getFavorites() {
  return JSON.parse(localStorage.getItem(StorageKeys.favoritesKey)) || [];
}

function saveFavorites(favorites) {
  localStorage.setItem(StorageKeys.favoritesKey, JSON.stringify(favorites));
}

function favoriteApp(appName) {
  let favorites = getFavorites();
  if (!favorites.includes(appName)) {
    favorites.push(appName);
    saveFavorites(favorites);
    updateFavoritesUI();
    updateStarState(appName, true);
    speak("Nice pick, I like that one too!", "Congratulate");
  }
}

function unfavoriteApp(appName) {
  let favorites = getFavorites();
  favorites = favorites.filter((name) => name !== appName);
  saveFavorites(favorites);
  updateFavoritesUI();
  updateStarState(appName, false);
}

function createStarButton(appName) {
  const btn = document.createElement("span");
  btn.textContent = "★";
  btn.className = "star";
  btn.style.color = getFavorites().includes(appName) ? "gold" : "#ccc";

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (getFavorites().includes(appName)) {
      unfavoriteApp(appName);
    } else {
      favoriteApp(appName);
    }
  });

  btn.dataset.app = appName;
  return btn;
}

function updateStarState(appName, isFavorite) {
  document.querySelectorAll(`.start-item[data-app="${appName}"] span`).forEach((star) => {
    if (star.textContent === "★") {
      star.style.color = isFavorite ? "gold" : "#ccc";
    }
  });
  const item = document.querySelector(`.start-item[data-app="${appName}"]`);
  if (item) {
    item.style.background = isFavorite ? "rgba(255, 215, 0, 0.1)" : "transparent";
  }
}
let sharedAppLauncher;
export function updateFavoritesUI() {
  if (!sharedAppLauncher) {
    console.error("No app launcher");
    return;
  }

  const favoritesPage = document.querySelector('.start-page[data-page="favorites"]');
  favoritesPage.innerHTML = "";
  const favorites = getFavorites();

  if (favorites.length === 0) {
    const noFav = document.createElement("div");
    noFav.textContent = "No favorite apps";
    favoritesPage.appendChild(noFav);
    return;
  }

  favorites.forEach((appName) => {
    const appItem = document.querySelector(`.start-item[data-app="${appName}"]`);
    if (!appItem) return;

    const clone = appItem.cloneNode(true);
    clone.style.position = "relative";
    clone.style.background = "rgba(255, 215, 0, 0.1)";

    clone.onclick = () => sharedAppLauncher.launch(appName);

    const oldStar = clone.querySelector(".star");
    if (oldStar) oldStar.remove();

    clone.appendChild(createStarButton(appName));

    favoritesPage.appendChild(clone);
  });
}

function setupStars() {
  document.querySelectorAll(".start-page:not([data-page='favorites']) .start-item").forEach((item) => {
    const appName = item.dataset.app;
    item.style.position = "relative";
    const star = createStarButton(appName);
    star.style.opacity = "0";
    star.style.transition = "opacity 0.2s";
    item.appendChild(star);

    item.addEventListener("mouseenter", () => (star.style.opacity = "1"));
    item.addEventListener("mouseleave", () => (star.style.opacity = "0"));

    if (getFavorites().includes(appName)) {
      item.style.background = "rgba(255, 215, 0, 0.1)";
    }
  });
}

export function setupStartMenu(appLauncher, sessionManager) {
  sharedAppLauncher = appLauncher;
  const menuEl = document.getElementById("start-menu") || document.querySelector(".start-menu");
  if (menuEl) {
    applyStartMenuSettings(menuEl);
  }
  document.querySelector(".start-menu")?.addEventListener("contextmenu", (e) => e.preventDefault());

  document.getElementById("start-lock-btn")?.addEventListener("click", () => {
    closeStartMenu();
    sessionManager?.lockSession();
  });

  document.getElementById("start-signout-btn")?.addEventListener("click", () => {
    closeStartMenu();
    sessionManager?.lockToLoginScreen();
  });

  document.querySelectorAll(".start-cat").forEach((cat) => {
    if (cat.classList.contains("docked") || !cat.dataset.cat) {
      return;
    }

    cat.onclick = () => {
      if (cat.dataset.cat === "settingsApp") {
        appLauncher.launch("settingsApp");
        return;
      }
      if (cat.dataset.cat === "customize") {
        appLauncher.launch("profileCustomizer");
        return;
      }
      document.querySelectorAll(".start-cat").forEach((c) => c.classList.remove("active"));
      document.querySelectorAll(".start-page").forEach((p) => p.classList.remove("active"));
      cat.classList.add("active");

      const page = document.querySelector(`.start-page[data-page="${cat.dataset.cat}"]`);
      if (page) page.classList.add("active");

      if (cat.dataset.cat === "favorites") {
        speak("These are your favorites! Great taste.", "Pleased");
      }
      if (cat.dataset.cat === "customize") {
        speak("Let's make your profile look great!", "Congratulate");
      }
    };
  });

  const searchInput = document.getElementById("start-menu-search");

  searchInput.addEventListener("focus", () => {
    speak("Looking for an app? I know where everything is.", "Searching");
  });

  searchInput.addEventListener("input", (e) => {
    const q = e.target.value.toLowerCase();
    const appRegistry = getAppRegistry();
    document.querySelectorAll(".start-item").forEach((item) => {
      const appId = item.dataset.app;
      const isUninstalled = appRegistry.isAppUninstalled(appId);
      const isDisabled = appRegistry.isAppDisabled(appId);
      const matchesSearch = item.textContent.toLowerCase().includes(q);
      const isAvailable = !isUninstalled && !isDisabled;
      if (q === "") {
        item.style.display = isAvailable ? "" : "none";
      } else {
        item.style.display = matchesSearch && isAvailable ? "" : "none";
      }
    });
  });

  setupStars();
  setupStartUserHover();
}

export function setupStartUserHover() {
  const startUser = document.querySelector(".start-user");
  if (!startUser) return;

  let tooltip = null;

  startUser.addEventListener("mouseenter", () => {
    const currentName = localStorage.getItem(StorageKeys.username) || "Reeyuki";

    tooltip = document.createElement("div");
    tooltip.className = "user-tooltip";
    tooltip.textContent = currentName;
    document.body.appendChild(tooltip);

    const rect = startUser.getBoundingClientRect();
    tooltip.style.left = `${rect.right + 10}px`;
    tooltip.style.top = `${rect.top + rect.height / 2}px`;
  });

  startUser.addEventListener("mouseleave", () => {
    if (tooltip) {
      tooltip.remove();
      tooltip = null;
    }
  });
}

export function tryGetIcon(id) {
  id = camelize(id);

  if (id === "explorer") {
    return resolveIconUrl("static/icons/file.webp");
  }
  if (id === "appCreatorApp") {
    return "fa fa-cubes";
  }
  if (id === "kiwiIRC") {
    return resolveIconUrl("static/icons/kiwiirc.webp");
  }
  if (id === "youtube") {
    return "fab fa-youtube";
  }
  try {
    if (sharedAppLauncher?.appMap) {
      if (sharedAppLauncher.appMap[id] && sharedAppLauncher.appMap[id].icon) {
        return sharedAppLauncher.appMap[id].icon;
      }
      const camel = camelize(id);
      if (sharedAppLauncher.appMap[camel] && sharedAppLauncher.appMap[camel].icon) {
        return sharedAppLauncher.appMap[camel].icon;
      }
      const found = Object.entries(sharedAppLauncher.appMap).find(
        ([key]) =>
          key === id ||
          key.startsWith(id) ||
          id.startsWith(key) ||
          key === camel ||
          key.startsWith(camel) ||
          camel.startsWith(key)
      );
      if (found && found[1].icon) {
        return found[1].icon;
      }
    }

    if (appMap[id] && appMap[id].icon) {
      return appMap[id].icon;
    }

    const foundEntry = Object.entries(appMap).find(([key]) => key === id || key.startsWith(id) || id.startsWith(key));

    if (foundEntry && foundEntry[1].icon) {
      return foundEntry[1].icon;
    }

    const div = document.querySelector(`#desktop div[data-app="${id}"]`);
    const imgSrc = div?.querySelector("img")?.src || div?.querySelector("svg");
    return imgSrc;
  } catch (e) {
    console.error("Error occurred while getting icon:", e);
    return null;
  }
}

function getGridItems() {
  const saved = localStorage.getItem(StorageKeys.startMenuGridItems);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
  }
  return [
    { app: "browserApp", title: "Yuki Browser", icon: "fas fa-globe" },
    { app: "explorer", title: "Files", icon: "fas fa-folder" },
    { app: "settingsApp", title: "Settings", icon: "fas fa-cog" },
    { app: "aiAssistant", title: "Yuki AI Assistant", icon: "fas fa-robot" },
    { app: "notepad", title: "Notepad", icon: "fas fa-edit" },
    { app: "calculatorApp", title: "Calculator", icon: "fas fa-calculator" },
    { app: "shortcutsApp", title: "Shortcuts", icon: "fas fa-keyboard" },
    { app: "yukiConvert", title: "Yuki Convert", icon: "fas fa-exchange-alt" },
    { app: "cameraApp", title: "Camera", icon: "fas fa-camera" },
    { app: "officeApp", title: "Office", icon: "fas fa-file-word" },
    { app: "installedApps", title: "Installed Apps", icon: "fas fa-th-list" },
    { app: "clipboardManager", title: "Clipboard Manager", icon: "fas fa-paste" },
    { app: "weatherApp", title: "Weather", icon: "fas fa-cloud" },
    { app: "yukiOsGuide", title: "Yuki OS Guide", icon: "fas fa-book-open" },
    { app: "steamApp", title: "Steam", icon: "fab fa-steam" },
    { app: "paint", title: "Paint", icon: "fas fa-paint-brush" },
    { app: "newsApp", title: "What's New", icon: "fas fa-newspaper" },
    { app: "shittify", title: "Music", icon: "fas fa-music" },
    { app: "appCreatorApp", title: "AppCreator", icon: "fas fa-cubes" },
    { app: "systemApps", title: "System Apps", icon: "fas fa-screwdriver-wrench" },
    { app: "taskManagerApp", title: "Task Manager", icon: "fas fa-list-check" },
    { app: "terminal", title: "Terminal", icon: "fas fa-terminal" },
    { app: "aboutApp", title: "About YukiOS", icon: "fas fa-info-circle" },
    { app: "achievementsApp", title: "Achievements", icon: "fas fa-trophy" }
  ];
}

function saveGridItems(items) {
  localStorage.setItem(StorageKeys.startMenuGridItems, JSON.stringify(items));
}

function showStartItemEditor(appLauncher, currentItem) {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const overlay = document.createElement("div");
    overlay.className = "explorer-confirmation-overlay";
    overlay.style.zIndex = "20002";

    const apps = Object.entries(appLauncher.appMap)
      .map(([id, data]) => ({
        id,
        title: data.title || id,
        icon: data.icon || ""
      }))
      .sort((a, b) => a.title.localeCompare(b.title));

    const tApps = performance.now();

    const selectOptions = apps
      .map(
        (app) =>
          `<option value="${app.id}" ${currentItem && currentItem.app === app.id ? "selected" : ""}>${app.title} (${app.id})</option>`
      )
      .join("");

    const isCdnOrUrl = (str) =>
      typeof str === "string" && (str.startsWith("http") || str.includes("/") || str.includes("."));

    const getCleanIcon = (appId, explicitIcon) => {
      if (explicitIcon && !isCdnOrUrl(explicitIcon)) return explicitIcon;
      const app = apps.find((a) => a.id === appId);
      if (app && app.icon && !isCdnOrUrl(app.icon)) return app.icon;
      return "fas fa-star";
    };

    const dialogTitle = currentItem ? "Edit Start Menu Item" : "Add Start Menu Item";
    const titleVal = currentItem ? currentItem.title : apps[0]?.title || "";
    const iconVal = getCleanIcon(currentItem ? currentItem.app : apps[0]?.id, currentItem?.icon);

    let uploadedIconDataUrl = null;
    if (currentItem && currentItem.icon && isCdnOrUrl(currentItem.icon)) {
      uploadedIconDataUrl = currentItem.icon;
    }

    overlay.innerHTML = `
      <div class="_fd-dialog" style="max-width:450px;overflow:visible;">
        <div class="_fd-dialog-title">${dialogTitle}</div>
        <div style="margin-bottom:12px;position:relative;">
          <label style="display:block;font-size:11px;color:#aaa;margin-bottom:4px;">Select Application</label>
          <select id="editor-app-select" style="display:none;">
            ${selectOptions}
          </select>
          <div id="custom-app-select" style="background:#2a2a2a;color:#fff;border:1px solid rgba(255,255,255,0.15);width:100%;padding:7px;border-radius:5px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;box-sizing:border-box;font-size:12px;height:34px;">
            <span id="custom-app-select-label">Select Application...</span>
            <span style="font-size:10px;color:#aaa;margin-left:8px;">▼</span>
          </div>
          <div id="custom-app-dropdown-list" style="display:none;position:absolute;top:100%;left:0;right:0;background:#1e1e1e;border:1px solid rgba(255,255,255,0.15);border-top:none;border-radius:0 0 5px 5px;max-height:180px;overflow-y:auto;z-index:20003;box-shadow:0 4px 12px rgba(0,0,0,0.5);margin-top:2px;">
            <div style="padding:6px;border-bottom:1px solid rgba(255,255,255,0.1);position:sticky;top:0;background:#1e1e1e;z-index:2;">
              <input id="custom-app-search" type="text" placeholder="Search application..." style="width:100%;background:#2a2a2a;border:1px solid rgba(255,255,255,0.15);border-radius:3px;padding:5px 7px;color:#fff;font-size:12px;box-sizing:border-box;outline:none;">
            </div>
            <div id="custom-app-options-container"></div>
          </div>
        </div>
        <div style="margin-bottom:12px;">
          <label style="display:block;font-size:11px;color:#aaa;margin-bottom:4px;">Display Title</label>
          <input id="editor-title-input" class="_fd-dialog-input" type="text" value="${titleVal}" style="width:100%;">
        </div>
        <div style="margin-bottom:12px;">
          <label style="display:block;font-size:11px;color:#aaa;margin-bottom:4px;">FontAwesome Icon Class</label>
          <input id="editor-icon-input" class="_fd-dialog-input" type="text" value="${iconVal}" style="width:100%;">
          <div id="editor-icon-error" style="color:#ff6b6b;font-size:10px;margin-top:4px;display:none;">Must start with 'fa' (e.g. 'fas fa-star')</div>
        </div>
        <div style="margin-bottom:16px;">
          <label style="display:block;font-size:11px;color:#aaa;margin-bottom:4px;">Or Upload Custom Image Icon</label>
          <div style="display:flex;align-items:center;gap:10px;">
            <input id="editor-icon-file" type="file" accept="image/*" style="display:none;">
            <button id="editor-upload-btn" class="_fd-btn" style="background:#2a2a2a;color:#fff;border:1px solid rgba(255,255,255,0.15);padding:6px 12px;border-radius:4px;cursor:pointer;font-size:12px;height:32px;">Choose Image...</button>
            <div id="editor-image-preview" style="width:32px;height:32px;border-radius:4px;background:#1e1e1e;border:1px solid rgba(255,255,255,0.15);display:flex;align-items:center;justify-content:center;overflow:hidden;">
              <span id="editor-preview-placeholder" style="font-size:10px;color:#666;">None</span>
            </div>
            <button id="editor-clear-upload-btn" class="_fd-btn" style="background:#ff6b6b;color:#fff;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:12px;display:none;height:32px;">Clear</button>
          </div>
        </div>
        <div class="_fd-dialog-actions">
          <button class="_fd-btn _fd-btn-cancel">Cancel</button>
          <button class="_fd-btn _fd-btn-confirm" style="background:var(--brand,#4a90d9);color:#fff;">Save</button>
        </div>
      </div>
    `;

    const tHtml = performance.now();

    const selectEl = overlay.querySelector("#editor-app-select");
    const customSelect = overlay.querySelector("#custom-app-select");
    const customSelectLabel = overlay.querySelector("#custom-app-select-label");
    const dropdownList = overlay.querySelector("#custom-app-dropdown-list");
    const searchInput = overlay.querySelector("#custom-app-search");
    const optionsContainer = overlay.querySelector("#custom-app-options-container");
    const titleInput = overlay.querySelector("#editor-title-input");
    const iconInput = overlay.querySelector("#editor-icon-input");
    const confirmBtn = overlay.querySelector("._fd-btn-confirm");
    const cancelBtn = overlay.querySelector("._fd-btn-cancel");
    const uploadBtn = overlay.querySelector("#editor-upload-btn");
    const fileInput = overlay.querySelector("#editor-icon-file");
    const imagePreview = overlay.querySelector("#editor-image-preview");
    const clearBtn = overlay.querySelector("#editor-clear-upload-btn");

    const optionItems = apps.map((app) => {
      const opt = document.createElement("div");
      opt.style.padding = "8px 12px";
      opt.style.cursor = "pointer";
      opt.style.fontSize = "12px";
      opt.style.display = "flex";
      opt.style.alignItems = "center";
      opt.style.gap = "8px";
      opt.style.color = "#fff";
      opt.style.transition = "background 0.15s";

      opt.addEventListener("mouseenter", () => {
        if (selectEl.value !== app.id) {
          opt.style.background = "rgba(255,255,255,0.08)";
        }
      });
      opt.addEventListener("mouseleave", () => {
        if (selectEl.value !== app.id) {
          opt.style.background = "";
        }
      });

      let iconHtml = "";
      const cleanIcon = app.icon && !isCdnOrUrl(app.icon) ? app.icon : null;
      if (cleanIcon) {
        iconHtml = `<i class="${cleanIcon}" style="width:14px;text-align:center;color:#aaa;"></i>`;
      } else {
        const appData = appLauncher.appMap[app.id];
        const iconVal = appData?.icon || "";
        const isImage =
          isImageFile(iconVal) ||
          iconVal.startsWith("http") ||
          iconVal.startsWith("data:") ||
          iconVal.startsWith("blob:") ||
          iconVal.startsWith("/");
        if (isImage) {
          let iconSrc = iconVal;
          if (iconVal.startsWith("static/") || iconVal.startsWith("/static/")) {
            const cleanPath = iconVal.startsWith("/") ? iconVal.substring(1) : iconVal;
            iconSrc = `${CDN_CONFIG.repos.main.base}/${cleanPath}`;
          } else {
            iconSrc = resolveIconUrl(iconVal);
          }
          iconHtml = `<img src="${iconSrc}" style="width:14px;height:14px;object-fit:contain;" alt="">`;
        } else {
          iconHtml = `<i class="fas fa-star" style="width:14px;text-align:center;color:#aaa;"></i>`;
        }
      }

      opt.innerHTML = `
        ${iconHtml}
        <div style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
          ${app.title} <span style="font-size:10px;color:#888;">(${app.id})</span>
        </div>
      `;

      opt.addEventListener("click", (e) => {
        e.stopPropagation();
        selectEl.value = app.id;
        updateSelectedLabel();
        updateSelectedStyles();
        dropdownList.style.display = "none";
        selectEl.dispatchEvent(new Event("change"));
      });

      optionsContainer.appendChild(opt);

      return {
        element: opt,
        id: app.id,
        title: app.title.toLowerCase(),
        idLower: app.id.toLowerCase()
      };
    });

    const tOptions = performance.now();

    document.body.appendChild(overlay);

    const tMount = performance.now();

    const updateSelectedStyles = () => {
      optionItems.forEach((item) => {
        if (item.id === selectEl.value) {
          item.element.style.background = "var(--brand, #4a90d9)";
        } else {
          item.element.style.background = "";
        }
      });
    };

    const updateSelectedLabel = () => {
      const selectedId = selectEl.value;
      const selectedApp = apps.find((a) => a.id === selectedId);
      if (selectedApp) {
        customSelectLabel.textContent = `${selectedApp.title} (${selectedApp.id})`;
      } else {
        customSelectLabel.textContent = "Select Application...";
      }
    };

    const filterOptions = (filterText = "") => {
      const query = filterText.toLowerCase().trim();
      let hasResults = false;
      optionItems.forEach((item) => {
        const matches = item.title.includes(query) || item.idLower.includes(query);
        item.element.style.display = matches ? "flex" : "none";
        if (matches) hasResults = true;
      });

      let noResultEl = optionsContainer.querySelector("#custom-select-no-result");
      if (!hasResults) {
        if (!noResultEl) {
          noResultEl = document.createElement("div");
          noResultEl.id = "custom-select-no-result";
          noResultEl.style.padding = "8px 12px";
          noResultEl.style.color = "#888";
          noResultEl.style.fontSize = "12px";
          noResultEl.textContent = "No applications found";
          optionsContainer.appendChild(noResultEl);
        }
      } else if (noResultEl) {
        noResultEl.remove();
      }
    };

    updateSelectedLabel();
    updateSelectedStyles();

    customSelect.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = dropdownList.style.display === "block";
      if (isOpen) {
        dropdownList.style.display = "none";
      } else {
        dropdownList.style.display = "block";
        filterOptions(searchInput.value);
        searchInput.focus();
      }
    });

    searchInput.addEventListener("input", () => {
      filterOptions(searchInput.value);
    });

    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        const firstOpt = optionItems.find((item) => item.element.style.display !== "none");
        if (firstOpt) {
          firstOpt.element.click();
        }
      }
    });

    overlay.addEventListener("click", (e) => {
      if (!customSelect.contains(e.target) && !dropdownList.contains(e.target)) {
        dropdownList.style.display = "none";
      }
    });

    const validate = () => {
      if (uploadedIconDataUrl) {
        confirmBtn.disabled = false;
        confirmBtn.style.opacity = "1";
        return;
      }
      const val = iconInput.value.trim();
      const isValid = val.startsWith("fa");
      if (isValid) {
        iconInput.style.borderColor = "";
        overlay.querySelector("#editor-icon-error").style.display = "none";
        confirmBtn.disabled = false;
        confirmBtn.style.opacity = "1";
      } else {
        iconInput.style.borderColor = "#ff6b6b";
        overlay.querySelector("#editor-icon-error").style.display = "block";
        confirmBtn.disabled = true;
        confirmBtn.style.opacity = "0.5";
      }
    };

    const updatePreview = () => {
      if (uploadedIconDataUrl) {
        imagePreview.innerHTML = `<img src="${uploadedIconDataUrl}" style="width:100%;height:100%;object-fit:contain;" />`;
        clearBtn.style.display = "block";
        iconInput.disabled = true;
        iconInput.style.opacity = "0.5";
        iconInput.style.borderColor = "";
        overlay.querySelector("#editor-icon-error").style.display = "none";
        confirmBtn.disabled = false;
        confirmBtn.style.opacity = "1";
      } else {
        imagePreview.innerHTML = `<span id="editor-preview-placeholder" style="font-size:10px;color:#666;">None</span>`;
        clearBtn.style.display = "none";
        iconInput.disabled = false;
        iconInput.style.opacity = "1";
        validate();
      }
    };

    updatePreview();
    iconInput.addEventListener("input", validate);

    uploadBtn.addEventListener("click", () => {
      fileInput.click();
    });

    fileInput.addEventListener("change", () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        uploadedIconDataUrl = e.target.result;
        updatePreview();
      };
      reader.readAsDataURL(file);
    });

    clearBtn.addEventListener("click", () => {
      uploadedIconDataUrl = null;
      fileInput.value = "";
      updatePreview();
    });

    if (!currentItem) {
      selectEl.addEventListener("change", () => {
        const selectedId = selectEl.value;
        const selectedApp = apps.find((a) => a.id === selectedId);
        if (selectedApp) {
          titleInput.value = selectedApp.title;
          iconInput.value = getCleanIcon(selectedId);
          validate();
        }
      });
    }

    const close = () => {
      overlay.remove();
      resolve(null);
    };

    confirmBtn.onclick = () => {
      const app = selectEl.value;
      const title = titleInput.value.trim();
      const icon = uploadedIconDataUrl || iconInput.value.trim();
      if (!app || !title) return;
      if (!uploadedIconDataUrl && !icon.startsWith("fa")) return;
      overlay.remove();
      resolve({ app, title, icon });
    };

    cancelBtn.onclick = close;
    overlay.addEventListener("click", (ev) => {
      ev.stopPropagation();
      if (ev.target === overlay) close();
    });
    overlay.addEventListener("mousedown", (ev) => {
      ev.stopPropagation();
    });
    overlay.onkeydown = (ev) => {
      if (ev.key === "Escape") close();
      if (ev.key === "Enter" && ev.target !== selectEl && ev.target !== searchInput) {
        confirmBtn.click();
      }
    };
  });
}

function addGridItem(appLauncher) {
  showStartItemEditor(appLauncher).then((result) => {
    if (result) {
      const items = getGridItems();
      items.push(result);
      saveGridItems(items);
      initializeAppGrid(appLauncher);
    }
  });
}

function editGridItem(itemData, index, appLauncher) {
  showStartItemEditor(appLauncher, itemData).then((result) => {
    if (result) {
      const items = getGridItems();
      items[index] = result;
      saveGridItems(items);
      initializeAppGrid(appLauncher);
    }
  });
}

function removeGridItem(index, appLauncher) {
  const items = getGridItems();
  items.splice(index, 1);
  saveGridItems(items);
  initializeAppGrid(appLauncher);
}

function showStartMenuContext(e, itemData, index, appLauncher) {
  showDynamicContextMenu(e, (menu, item, hr) => {
    menu.appendChild(
      item(
        "Edit Item",
        () => {
          editGridItem(itemData, index, appLauncher);
        },
        "fas fa-edit"
      )
    );
    menu.appendChild(
      item(
        "Remove Item",
        () => {
          removeGridItem(index, appLauncher);
        },
        "fas fa-trash-alt"
      )
    );
    menu.appendChild(hr());
    menu.appendChild(
      item(
        "Add New Item",
        () => {
          addGridItem(appLauncher);
        },
        "fas fa-plus"
      )
    );
  });
}

function showStartGridContext(e, appLauncher) {
  showDynamicContextMenu(e, (menu, item, hr) => {
    menu.appendChild(
      item(
        "Add New Item",
        () => {
          addGridItem(appLauncher);
        },
        "fas fa-plus"
      )
    );
  });
}

export function initializeAppGrid(appLauncher) {
  const grid = document.querySelector(".app-grid");
  if (!grid) return;
  grid.innerHTML = "";

  const items = getGridItems();
  items.forEach((itemData, index) => {
    const item = document.createElement("div");
    item.className = "start-menu-item";
    item.dataset.app = itemData.app;
    item.dataset.index = index;

    const iconVal = itemData.icon || "fas fa-star";
    let iconEl;
    const isImage =
      isImageFile(iconVal) ||
      iconVal.startsWith("http") ||
      iconVal.startsWith("data:") ||
      iconVal.startsWith("blob:") ||
      iconVal.startsWith("/");
    if (isImage) {
      iconEl = document.createElement("img");
      let iconSrc = iconVal;
      if (iconVal.startsWith("static/") || iconVal.startsWith("/static/")) {
        const cleanPath = iconVal.startsWith("/") ? iconVal.substring(1) : iconVal;
        iconSrc = `${CDN_CONFIG.repos.main.base}/${cleanPath}`;
      } else {
        iconSrc = resolveIconUrl(iconVal);
      }
      iconEl.src = iconSrc;
      iconEl.className = "start-item-icon";
      if (iconVal.startsWith("data:")) {
        iconEl.style.width = "80px";
        iconEl.style.height = "80px";
      } else {
        iconEl.style.width = "16px";
        iconEl.style.height = "16px";
      }
      iconEl.style.objectFit = "contain";
      iconEl.alt = "";
    } else {
      iconEl = document.createElement("i");
      iconEl.className = iconVal.startsWith("fa") ? iconVal : `fa ${iconVal}`;
    }
    item.appendChild(iconEl);

    const spanEl = document.createElement("span");
    spanEl.textContent = itemData.title;
    item.appendChild(spanEl);

    if (itemData.app === "newsApp") {
      const badge = document.createElement("span");
      badge.className = "news-badge";
      badge.style.display = "none";
      item.appendChild(badge);
    }

    item.draggable = true;

    item.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", index);
      e.dataTransfer.effectAllowed = "move";
      item.style.opacity = "0.4";
    });

    item.addEventListener("dragend", () => {
      item.style.opacity = "";
      item.style.transform = "";
      item.style.outline = "";
    });

    item.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    });

    item.addEventListener("dragenter", (e) => {
      e.preventDefault();
      item.style.transform = "scale(1.03)";
      item.style.outline = "2px dashed var(--brand)";
    });

    item.addEventListener("dragleave", () => {
      item.style.transform = "";
      item.style.outline = "";
    });

    item.addEventListener("drop", (e) => {
      e.preventDefault();
      item.style.transform = "";
      item.style.outline = "";
      const fromIndexStr = e.dataTransfer.getData("text/plain");
      if (fromIndexStr === "") return;
      const fromIndex = parseInt(fromIndexStr, 10);
      const toIndex = index;
      if (fromIndex !== toIndex) {
        const gridItems = getGridItems();
        const [moved] = gridItems.splice(fromIndex, 1);
        gridItems.splice(toIndex, 0, moved);
        saveGridItems(gridItems);
        initializeAppGrid(appLauncher);
      }
    });

    item.addEventListener("click", () => appLauncher.launch(itemData.app));

    item.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      showStartMenuContext(e, itemData, index, appLauncher);
    });

    grid.appendChild(item);
  });

  if (items.length === 0) {
    const placeholder = document.createElement("div");
    placeholder.className = "start-menu-item";
    placeholder.style.opacity = "0";
    placeholder.style.transition = "opacity 0.2s";
    placeholder.style.cursor = "pointer";

    const iconEl = document.createElement("i");
    iconEl.className = "fas fa-plus";
    placeholder.appendChild(iconEl);

    const spanEl = document.createElement("span");
    spanEl.textContent = "Add Item";
    placeholder.appendChild(spanEl);

    placeholder.addEventListener("click", () => addGridItem(appLauncher));

    grid.appendChild(placeholder);

    grid.onmouseenter = () => {
      placeholder.style.opacity = "1";
    };
    grid.onmouseleave = () => {
      placeholder.style.opacity = "0";
    };
  } else {
    grid.onmouseenter = null;
    grid.onmouseleave = null;
  }

  grid.addEventListener("contextmenu", (e) => {
    if (e.target === grid || items.length === 0) {
      e.preventDefault();
      e.stopPropagation();
      showStartGridContext(e, appLauncher);
    }
  });

  refreshIcons(grid);
}

export function populateStartMenu(appLauncher) {
  const pageMap = {
    system: document.querySelector('.start-page[data-page="system"]'),
    apps: document.querySelector('.start-page[data-page="apps"]'),
    games: document.querySelector('.start-page[data-page="games"]'),
    favorites: document.querySelector('.start-page[data-page="favorites"]')
  };

  ["system", "apps", "games"].forEach((cat) => {
    if (pageMap[cat]) pageMap[cat].innerHTML = "";
  });

  const appRegistry = getAppRegistry();
  Object.entries(appLauncher.appMap).forEach(([appName, appData]) => {
    if (appRegistry.isAppUninstalled(appName) || appRegistry.isAppDisabled(appName)) return;

    const item = document.createElement("div");
    item.classList.add("start-item");
    item.dataset.app = appName;

    const iconValue = tryGetIcon(appName);

    let icon = null;

    const isImagePath = isImageFile(iconValue);
    if (isImagePath) {
      icon = document.createElement("img");
      icon.classList.add("start-item-icon");
      icon.src = resolveIconUrl(iconValue);
      icon.loading = "lazy";
      icon.alt = "";
    } else if (typeof iconValue === "string" && iconValue.trim().length > 0) {
      icon = document.createElement("i");
      icon.classList.add("start-item-icon");
      icon.loading = "lazy";
      icon.className += iconValue.startsWith("fa") ? ` ${iconValue}` : ` fa ${iconValue}`;
    }

    if (icon) {
      item.appendChild(icon);
    }

    const labelEl = document.createElement("span");
    labelEl.textContent = appData.title;

    item.appendChild(labelEl);

    item.addEventListener("click", () => appLauncher.launch(appName));

    if (appData.type === "system") {
      pageMap.system?.appendChild(item);
    } else {
      pageMap.games?.appendChild(item);
    }
  });
}
