import { BusEvents } from "../core/EventBus.js";
import { showDynamicContextMenu, hideMenu } from "../shared/contextMenu.js";
import { getSetting } from "../shared/settingsUtils.js";
import { $, $$, bindEvent, addClass, removeClass, toggleClass, setText, createElement } from "../shared/domUtils.js";
import { DEFAULT_SYSTEM_MENUS, APP_MENU_OVERRIDES } from "./appMenus.js";
import { StorageKeys } from "../StorageKeys.js";

export class MenuBarManager {
  constructor(os) {
    this.os = os;
    this.activeAppId = null;
    this.activeAppName = null;
    this.appOverrides = new Map();
    this.currentMenus = DEFAULT_SYSTEM_MENUS;
    this.openMenuIndex = -1;
    this.boundClick = this.onDocClick.bind(this);
    this.boundFocus = this.onWindowFocused.bind(this);
    this.boundClosed = this.onWindowClosed.bind(this);
    this.boundKeydown = this.onKeydown.bind(this);
  }

  init() {
    if (!this.isEnabled()) return;

    this.renderMenuBar();
    this.wireMenuItems();
    this.wireAppleLogo();
    this.wireFinderItem();

    this.os.events.on(BusEvents.WINDOW_FOCUSED, this.boundFocus);
    this.os.events.on(BusEvents.WINDOW_CLOSED, this.boundClosed);
    bindEvent(document, "click", this.boundClick);
    bindEvent(document, "keydown", this.boundKeydown);

    this.os.kernel.menuBar = this;
  }

  wireAppleLogo() {
    const appleBtn = $("#mac-menu-bar .mac-menu-apple");
    if (appleBtn) {
      bindEvent(appleBtn, "click", (e) => {
        e.stopPropagation();
        import("../desktopui/startMenu.js").then((m) => m.toggleStartMenu());
      });
    }
  }

  wireFinderItem() {
    const finder = $("#mac-menu-bar .mac-menu-item[data-menu='Finder']");
    if (!finder) return;
    bindEvent(finder, "click", (e) => {
      e.stopPropagation();
      this.os.kernel?.commandPalette?.toggle();
    });
  }

  destroy() {
    this.os.events.off(BusEvents.WINDOW_FOCUSED, this.boundFocus);
    this.os.events.off(BusEvents.WINDOW_CLOSED, this.boundClosed);
    document.removeEventListener("click", this.boundClick);
    document.removeEventListener("keydown", this.boundKeydown);
    delete this.os.kernel.menuBar;
  }

  registerAppMenu(appId, menuDefs) {
    this.appOverrides.set(appId, menuDefs);
    if (this.activeAppId === appId) {
      this.applyAppMenus(appId);
    }
  }

  setActiveApp(appId, appName) {
    this.activeAppId = appId;
    this.activeAppName = appName;
    this.applyAppMenus(appId);
  }

  clearActiveApp() {
    this.activeAppId = null;
    this.activeAppName = null;
    this.currentMenus = DEFAULT_SYSTEM_MENUS;
    this.rebuildMenuItems();
  }

  showMenu(index) {
    if (this.openMenuIndex === index) {
      this.hideMenu();
      return;
    }
    this.hideMenu();
    this.openMenuIndex = index;

    const menuDef = this.currentMenus[index];
    if (!menuDef) return;

    const menuBarEl = $("#mac-menu-bar");
    if (!menuBarEl) return;

    const items = $$(".mac-menu-item:not(.mac-menu-apple)", menuBarEl);
    const targetItem = items[index];
    if (!targetItem) return;

    items.forEach((el) => removeClass(el, "active"));
    addClass(targetItem, "active");

    const rect = targetItem.getBoundingClientRect();
    const menuBarRect = menuBarEl.getBoundingClientRect();

    const e = {
      pageX: rect.left,
      pageY: menuBarRect.bottom,
      clientX: rect.left,
      clientY: menuBarRect.bottom,
      preventDefault: () => {},
      stopPropagation: () => {}
    };

    this.buildAndShowDropdown(e, menuDef.items);
  }

  hideMenu() {
    this.openMenuIndex = -1;
    hideMenu();
    const items = $$("#mac-menu-bar .mac-menu-item.active");
    items.forEach((el) => removeClass(el, "active"));
  }

  executeAction(actionId) {
    this.hideMenu();

    if (actionId.startsWith("window:focus:")) {
      const winId = actionId.replace("window:focus:", "");
      this.focusWindow(winId);
      return;
    }

    if (actionId.startsWith("launch:")) {
      const appId = actionId.replace("launch:", "");
      this.os.app.launch(appId).catch(() => {});
      return;
    }

    if (actionId.startsWith("settings:cat:")) {
      const cat = actionId.replace("settings:cat:", "");
      this.os.app.launch("settingsApp", { category: cat }).catch(() => {});
      return;
    }

    const fn = ACTION_MAP[actionId];
    if (fn) {
      fn(this.os, this.activeAppId);
    }
  }

  isEnabled() {
    return getSetting("macOsControls", false) === true;
  }

  renderMenuBar() {
    const menuBar = $("#mac-menu-bar");
    if (!menuBar) return;

    const existingItems = $$(".mac-menu-item:not(.mac-menu-apple)", menuBar);
    existingItems.forEach((el) => el.remove());

    this.currentMenus.forEach((menuDef) => {
      const span = createElement("span", {
        className: "mac-menu-item",
        attributes: { "data-menu": menuDef.label },
        text: menuDef.label
      });
      menuBar.appendChild(span);
    });
  }

  wireMenuItems() {
    const menuBar = $("#mac-menu-bar");
    if (!menuBar) return;

    $$(".mac-menu-item:not(.mac-menu-apple)", menuBar).forEach((item, index) => {
      bindEvent(item, "mousedown", (e) => {
        e.stopPropagation();
        this.showMenu(index);
      });
      bindEvent(item, "click", (e) => {
        e.stopPropagation();
      });
      bindEvent(item, "mouseenter", () => {
        if (this.openMenuIndex >= 0 && this.openMenuIndex !== index) {
          this.showMenu(index);
        }
      });
    });
  }

rebuildMenuItems() {
    const menuBar = $("#mac-menu-bar");
    if (!menuBar) return;

    const existingItems = $$(".mac-menu-item:not(.mac-menu-apple)", menuBar);

    if (existingItems.length !== this.currentMenus.length) {
      this.renderMenuBar();
      this.wireMenuItems();
      return;
    }

    existingItems.forEach((el, index) => {
      const menuDef = this.currentMenus[index];
      if (menuDef) {
        setText(el, menuDef.label);
      }
    });
}

  applyAppMenus(appId) {
    const override = APP_MENU_OVERRIDES[appId] || this.appOverrides.get(appId);
    if (!override) {
      this.currentMenus = DEFAULT_SYSTEM_MENUS;
      this.rebuildMenuItems();
      return;
    }

    const overrides = override.menus.overrides || {};

    this.currentMenus = DEFAULT_SYSTEM_MENUS.map((baseMenu) => {
      const overrideItems = overrides[baseMenu.label];
      if (overrideItems) {
        return { ...baseMenu, items: overrideItems.items || overrideItems };
      }
      return { ...baseMenu };
    });

    this.rebuildMenuItems();
  }

  onWindowFocused({ winId }) {
    if (!winId) return;
    const win = $(`#${winId}`);
    if (!win) return;
    const appId = win.dataset.appId || null;

    if (appId) {
      const appInfo = this.os.app.getAppInfo(appId);
      const appName = appInfo ? appInfo.title : appId;
      this.setActiveApp(appId, appName);
    } else {
      this.clearActiveApp();
    }
  }

  onWindowClosed() {
    setTimeout(() => {
      const hasOpenWindows = this.os.kernel?.windowManager?.openWindows?.size > 0;
      if (!hasOpenWindows) {
        this.clearActiveApp();
      }
    }, 50);
  }

  onDocClick(e) {
    const menuBar = $("#mac-menu-bar");
    if (!menuBar) return;
    if (menuBar.contains(e.target)) return;

    this.hideMenu();
  }

  onKeydown(e) {
    if (this.openMenuIndex >= 0) {
      if (e.key === "Escape") {
        this.hideMenu();
        e.preventDefault();
        return;
      }

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        const newIndex = (this.openMenuIndex - 1 + this.currentMenus.length) % this.currentMenus.length;
        this.showMenu(newIndex);
        return;
      }

      if (e.key === "ArrowRight") {
        e.preventDefault();
        const newIndex = (this.openMenuIndex + 1) % this.currentMenus.length;
        this.showMenu(newIndex);
        return;
      }
    }

    if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
      const index = this.currentMenus.findIndex(
        (m) => m.label[0].toLowerCase() === e.key.toLowerCase()
      );
      if (index >= 0 && (e.key === " " || e.key.length === 1)) {
        if (this.getFocusedAppMenubar()) return;
        e.preventDefault();
        this.showMenu(index);
      }
    }
  }

  getFocusedAppMenubar() {
    return $(".window:focus .app-menubar, .window[style*='z-index'] .app-menubar");
  }

  buildAndShowDropdown(e, items) {
    const processed = this.processMenuItems(items);

    showDynamicContextMenu(e, (menu, item, hr, submenu) => {
      this.buildMenuItems(menu, item, hr, submenu, processed);
    });
  }

  processMenuItems(items) {
    const result = [];
    for (const entry of items) {
      if (entry.type === "separator") {
        result.push({ type: "separator" });
        continue;
      }

      if (entry.type === "dynamic") {
        if (entry.build) {
          const dynamicItems = entry.build();
          if (dynamicItems.length === 0) continue;
          result.push(...dynamicItems.map((di) => ({
            type: "item",
            label: di.label,
            action: di.action
          })));
        }
        continue;
      }

      result.push({
        type: "item",
        label: entry.label,
        action: entry.action,
        checked: entry.checked,
        disabled: entry.disabled
      });
    }

    const filtered = result.filter((r, i) => {
      if (r.type === "separator" && i === 0) return false;
      if (r.type === "separator" && i === result.length - 1) return false;
      return true;
    });

    return filtered.filter((r, i) => !(r.type === "separator" && filtered[i - 1]?.type === "separator"));
  }

  buildMenuItems(menu, createItemFn, hr, submenuFn, items) {
    for (const entry of items) {
      if (entry.type === "separator") {
        menu.appendChild(hr());
        continue;
      }

      const el = createItemFn(entry.label, () => this.executeAction(entry.action));
      el.className = "context-menu-item";

      if (entry.checked) {
        el.dataset.checked = "true";
        addClass(el, "menu-checked");
      }

      if (entry.disabled) {
        addClass(el, "menu-disabled");
        el.style.opacity = "0.4";
        el.style.pointerEvents = "none";
      }

      menu.appendChild(el);
    }
  }

  focusWindow(winId) {
    const win = $(`#${winId}`);
    if (win && this.os.kernel?.windowManager) {
      this.os.kernel.windowManager.bringToFront(win);
    }
  }
}

const ACTION_MAP = {
  "about:open": (os) => os.app.launch("aboutApp").catch(() => {}),
  "settings:open": (os) => os.app.launch("settingsApp").catch(() => {}),
  "palette:open": (os) => os.kernel?.commandPalette?.open(),
  "clippy:toggle": (os) => {
    const current = os.storage.get(StorageKeys.clippy);
    os.storage.set(StorageKeys.clippy, current === "true" ? "false" : "true");
  },
  "ai:open": (os) => os.app.launch("aiAssistantApp").catch(() => {}),
  "screenshot:capture": (os) => os.app.launch("screenshotApp").catch(() => {}),
  "screenshot:record": () => {},
  "colorpicker:open": (os) => os.app.launch("colorPickerApp").catch(() => {}),
  "emoji:open": (os) => os.app.launch("emojiSelectorApp").catch(() => {}),
  "window:hideOthers": (os) => {
    const wm = os.kernel?.windowManager;
    if (!wm) return;
    const topWin = $(".window[style*='z-index']");
    if (!topWin) return;
    wm.openWindows.forEach((entry, id) => {
      const w = $(`#${id}`);
      if (w && w !== topWin) {
        w.style.display = "none";
      }
    });
  },
  "window:showAll": (os) => {
    const wm = os.kernel?.windowManager;
    if (!wm) return;
    wm.openWindows.forEach((entry, id) => {
      const w = $(`#${id}`);
      if (w) {
        if (w.style.display === "none") w.style.display = "";
        os.kernel?.windowManager?.bringToFront?.(w);
      }
    });
  },
  "session:lock": () => {
    const bus = window.os?.events;
    if (bus) bus.emit("system:locked");
  },
  "session:logout": () => {
    window.location.reload();
  },
  "explorer:newWindow": (os) => os.app.launch("explorerApp").catch(() => {}),
  "desktop:newFolder": (os) => {
    const desktopUI = os.kernel?.desktopUI;
    if (desktopUI) desktopUI.createNewFolder();
  },
  "notepad:new": (os) => os.app.launch("notepadApp").catch(() => {}),
  "explorer:open": (os) => os.app.launch("explorerApp").catch(() => {}),
  "recent:clear": (os) => os.storage.set(StorageKeys.recentFiles, "[]"),
  "window:close": (os) => {
    const focused = $(".window[style*='z-index']");
    if (focused) os.app.close(focused.id);
  },
  "window:closeAll": (os) => {
    os.window.closeAll();
  },
  "app:close": (os) => {
    const focused = $(".window[style*='z-index']");
    if (focused) os.app.close(focused.id);
  },
  "edit:undo": () => document.execCommand("undo"),
  "edit:redo": () => document.execCommand("redo"),
  "edit:cut": () => document.execCommand("cut"),
  "edit:copy": () => document.execCommand("copy"),
  "edit:paste": () => document.execCommand("paste"),
  "edit:pastePlain": () => {
    navigator.clipboard.readText().then((text) => {
      const active = document.activeElement;
      if (active) {
        const start = active.selectionStart;
        const end = active.selectionEnd;
        if (start !== undefined) {
          active.value = active.value.substring(0, start) + text + active.value.substring(end);
        }
      }
    });
  },
  "edit:selectAll": () => document.execCommand("selectAll"),
  "view:desktopIcons": (os) => {
    const desktop = $("#desktop");
    if (desktop) toggleClass(desktop, "hide-icons");
  },
  "view:widgets": () => {
    const widgets = $("#widget-container");
    if (widgets) widgets.style.display = widgets.style.display === "none" ? "" : "none";
  },
  "view:taskbar": () => {
    const taskbar = $("#taskbar");
    if (taskbar) taskbar.style.display = taskbar.style.display === "none" ? "" : "none";
  },
  "window:fullscreen": () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  },
  "window:maximize": (os) => {
    const focused = $(".window[style*='z-index']");
    if (focused && os.kernel?.windowManager) {
      os.kernel.windowManager.toggleFullscreen(focused);
    }
  },
  "window:minimize": (os) => {
    const focused = $(".window[style*='z-index']");
    if (focused && os.kernel?.windowManager) {
      os.kernel.windowManager.minimizeWindow(focused);
    }
  },
  "window:alwaysOnTop": (os) => {
    const focused = $(".window[style*='z-index']");
    if (focused && os.kernel?.windowManager) {
      const isAlwaysOnTop = focused.classList.contains("always-on-top");
      if (isAlwaysOnTop) {
        focused.classList.remove("always-on-top");
        focused.style.zIndex = "";
      } else {
        focused.classList.add("always-on-top");
        focused.style.zIndex = "999999";
      }
    }
  },
  "view:transparentUI": (os) => {
    const current = os.storage.get(StorageKeys.transparentUI);
    os.storage.set(StorageKeys.transparentUI, current === "true" ? "false" : "true");
  },
  "scale:75": (os) => os.storage.set(StorageKeys.guiScale, "75"),
  "scale:100": (os) => os.storage.set(StorageKeys.guiScale, "100"),
  "scale:125": (os) => os.storage.set(StorageKeys.guiScale, "125"),
  "scale:150": (os) => os.storage.set(StorageKeys.guiScale, "150"),
  "theme:dark": (os) => os.storage.set(StorageKeys.theme, "dark"),
  "theme:light": (os) => os.storage.set(StorageKeys.theme, "light"),
  "settings:themes": (os) => os.app.launch("settingsApp", { category: "appearance" }).catch(() => {}),
  "workspace:overview": (os) => {
    const wm = os.kernel?.windowManager;
    if (wm?.workspaceManager) wm.workspaceManager.toggleOverview?.();
  },
  "go:home": (os) => os.app.launch("explorerApp", { path: [] }).catch(() => {}),
  "go:desktop": (os) => os.app.launch("explorerApp", { path: ["Desktop"] }).catch(() => {}),
  "go:documents": (os) => os.app.launch("explorerApp", { path: ["Documents"] }).catch(() => {}),
  "go:downloads": (os) => os.app.launch("explorerApp", { path: ["Downloads"] }).catch(() => {}),
  "go:recents": (os) => os.app.launch("explorerApp", { path: ["Recents"] }).catch(() => {}),
  "go:computer": (os) => os.app.launch("explorerApp", { path: [] }).catch(() => {}),
  "go:folder": async (os) => {
    const path = await os.dialog.prompt("Go to Folder", "Enter folder path:");
    if (path) os.app.launch("explorerApp", { path }).catch(() => {});
  },
  "window:snapLeft": (os) => {
    const focused = $(".window[style*='z-index']");
    if (focused && os.kernel?.windowManager) {
      os.kernel.windowManager.applySnap?.(focused, "left");
    }
  },
  "window:snapRight": (os) => {
    const focused = $(".window[style*='z-index']");
    if (focused && os.kernel?.windowManager) {
      os.kernel.windowManager.applySnap?.(focused, "right");
    }
  },
  "workspace:new": (os) => {
    const wm = os.kernel?.windowManager;
    if (wm?.workspaceManager) wm.workspaceManager.addWorkspace?.();
  },
  "window:bringAllToFront": (os) => {
    const wm = os.kernel?.windowManager;
    if (!wm) return;
    wm.openWindows.forEach((entry, id) => {
      const win = $(`#${id}`);
      if (win) {
        win.style.display = "";
        wm.bringToFront(win);
      }
    });
  },
  "guide:open": (os) => os.app.launch("yukiOsGuideApp").catch(() => {}),
  "news:open": (os) => os.app.launch("newsApp").catch(() => {}),
  "shortcuts:open": (os) => os.app.launch("shortcutsApp").catch(() => {}),
  "help:report": () => window.open("https://github.com/Reeyuki/yukios/issues", "_blank"),
  "achievements:open": (os) => os.app.launch("achievementsApp").catch(() => {}),
  "browser:reload": () => {
    const iframe = $(".window[style*='z-index'] iframe");
    if (iframe) iframe.contentWindow?.location.reload();
  },
  "browser:devtools": () => {
    const iframe = $(".window[style*='z-index'] iframe");
    if (iframe) {
      try { iframe.contentWindow?.openDevTools?.(); } catch {}
    }
  },
  "format:bold": () => document.execCommand("bold"),
  "format:italic": () => document.execCommand("italic"),
  "format:underline": () => document.execCommand("underline"),
};
