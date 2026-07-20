import { os } from "../framework.js";
import { $ } from "../shared/domUtils.js";

function findAppEntry(winId) {
  const win = $(`#${winId}`);
  if (!win) return null;
  return win.dataset.appId || null;
}

function launch(appId) {
  os.app.launch(appId).catch(() => {});
}

function toggleSetting(key) {
  const current = os.storage.get(key);
  os.storage.set(key, current === "true" ? "false" : "true");
}

function closeFocusedWindow() {
  const focused = $(".window[style*='z-index']");
  if (focused) {
    os.app.close(focused.id);
  }
}

function getRunningWindowsList() {
  const windows = os.window.getOpenWindows();
  if (!windows) return [];
  const items = [];
  windows.forEach((entry, winId) => {
    const win = $(`#${winId}`);
    if (win) {
      items.push({ winId, title: entry.title || winId, icon: entry.iconValue });
    }
  });
  return items;
}

export const DEFAULT_SYSTEM_MENUS = [
  {
    label: "Finder",
    items: [
      { label: "About YukiOS", action: "about:open" },
      { type: "separator" },
      { label: "Settings", action: "settings:open" },
      { label: "Command Palette", action: "palette:open" },
      { label: "Clippy Assistant", action: "clippy:toggle" },
      { type: "separator" },
      { label: "Hide Others", action: "window:hideOthers" },
      { label: "Show All", action: "window:showAll" },
      { type: "separator" },
      { label: "Lock Screen", action: "session:lock" },
      { label: "Log Out YukiOS", action: "session:logout" }
    ]
  },
  {
    label: "File",
    items: [
      { label: "New Window", action: "explorer:newWindow" },
      { label: "New Folder", action: "desktop:newFolder" },
      { label: "New File", action: "notepad:new" },
      { type: "separator" },
      { label: "Open", action: "explorer:open" },
      { label: "Close Window", action: "window:close" },
      { label: "Close All", action: "window:closeAll" },
      { type: "separator" }
    ]
  },
  {
    label: "Edit",
    items: [
      { label: "Undo", action: "edit:undo" },
      { label: "Redo", action: "edit:redo" },
      { type: "separator" },
      { label: "Cut", action: "edit:cut" },
      { label: "Copy", action: "edit:copy" },
      { label: "Paste", action: "edit:paste" },
      { label: "Paste Style", action: "edit:pastePlain" },
      { type: "separator" },
      { label: "Select All", action: "edit:selectAll" },
      { type: "separator" },
      { label: "Emoji & Symbols", action: "emoji:open" },
      { label: "Clipboard History", action: "clipboard:open" }
    ]
  },
  {
    label: "View",
    items: [
      { label: "Desktop Icons", type: "checkbox", checked: true, action: "view:desktopIcons" },
      { label: "Show Widgets", type: "checkbox", checked: true, action: "view:widgets" },
      { label: "Show Taskbar", type: "checkbox", checked: true, action: "view:taskbar" },
      { type: "separator" },
      { label: "Enter Full Screen", action: "window:fullscreen" },
      { label: "Always on Top", type: "checkbox", checked: false, action: "window:alwaysOnTop" },
      { type: "separator" },
      { label: "Transparent UI", type: "checkbox", checked: false, action: "view:transparentUI" },
      { label: "Workspace Overview", action: "workspace:overview" }
    ]
  },
  {
    label: "Go",
    items: [
      { label: "Home", action: "go:home" },
      { label: "Desktop", action: "go:desktop" },
      { label: "Documents", action: "go:documents" },
      { label: "Downloads", action: "go:downloads" },
      { type: "separator" },
      { label: "Recents", action: "go:recents" },
      { label: "Computer", action: "go:computer" },
      { type: "separator" },
      { label: "Go to Folder", action: "go:folder" }
    ]
  },
  {
    label: "Window",
    items: [
      { label: "Minimize", action: "window:minimize" },
      { label: "Zoom", action: "window:maximize" },
      { label: "Enter Full Screen", action: "window:fullscreen" },
      { type: "separator" },
      { label: "Tile Left", action: "window:snapLeft" },
      { label: "Tile Right", action: "window:snapRight" },
      { type: "separator" },
      { label: "Bring All to Front", action: "window:bringAllToFront" },
      { type: "separator" },
      { label: "Close All Windows", action: "window:closeAll" }
    ]
  },
  {
    label: "Help",
    items: [
      { label: "YukiOS Guide", action: "guide:open" },
      { label: "What\u2019s New", action: "news:open" },
      { type: "separator" },
      { label: "Keyboard Shortcuts", action: "shortcuts:open" },
      { label: "Command Palette", action: "palette:open" },
      { type: "separator" },
      { label: "Report Issue", action: "help:report" },
      { label: "Achievements", action: "achievements:open" },
      { label: "About YukiOS", action: "about:open" }
    ]
  }
];

export const APP_MENU_OVERRIDES = {
  notepadApp: {
    menus: {
      label: "Notes",
      overrides: {
        File: {
          items: [
            { label: "New", action: "notepad:new" },
            { label: "Open", action: "notepad:open" },
            { label: "Close", action: "app:close" },
            { label: "Save", action: "notepad:save" },
            { label: "Save As", action: "notepad:saveAs" },
            { type: "separator" }
          ]
        },
        Edit: {
          items: [
            { label: "Undo", action: "edit:undo" },
            { label: "Redo", action: "edit:redo" },
            { type: "separator" },
            { label: "Cut", action: "edit:cut" },
            { label: "Copy", action: "edit:copy" },
            { label: "Paste", action: "edit:paste" },
            { label: "Paste and Match Style", action: "edit:pastePlain" },
            { type: "separator" },
            { label: "Select All", action: "edit:selectAll" }
          ]
        },
        View: {
          items: [
            { label: "Zoom In", action: "view:zoomIn" },
            { label: "Zoom Out", action: "view:zoomOut" },
            { label: "Actual Size", action: "view:zoomReset" }
          ]
        }
      }
    }
  },
  terminalApp: {
    menus: {
      label: "Terminal",
      overrides: {
        File: {
          items: [
            { label: "New Window", action: "terminal:newWindow" },
            { type: "separator" },
            { label: "Close Tab", action: "app:close" },
            { label: "Close Window", action: "window:close" }
          ]
        }
      }
    }
  },
  browserApp: {
    menus: {
      label: "Browser",
      overrides: {
        File: {
          items: [
            { label: "New Window", action: "browser:newWindow" },
            { type: "separator" },
            { label: "Close Tab", action: "app:close" }
          ]
        },
        View: {
          items: [
            { label: "Reload Page", action: "browser:reload" },
            { type: "separator" },
            { label: "Developer Tools", action: "browser:devtools" }
          ]
        }
      }
    }
  },
  explorerApp: {
    menus: {
      label: "Explorer",
      overrides: {
        File: {
          items: [{ label: "New Window", action: "explorer:newWindow" }]
        }
      }
    }
  },
  calculatorApp: {
    menus: {
      label: "Calculator",
      overrides: {
        Edit: {
          items: [{ label: "Paste", action: "edit:paste" }]
        }
      }
    }
  },
  settingsApp: {
    menus: {
      label: "Settings",
      overrides: {
        View: {
          items: [
            { label: "System", action: "settings:cat:system" },
            { label: "Desktop", action: "settings:cat:desktop" },
            { label: "Appearance", action: "settings:cat:appearance" },
            { label: "Network", action: "settings:cat:network" },
            { label: "Audio", action: "settings:cat:audio" },
            { label: "Accounts", action: "settings:cat:accounts" }
          ]
        }
      }
    }
  },
  markdownApp: {
    menus: {
      label: "Markdown",
      overrides: {
        File: {
          items: [
            { label: "New", action: "notepad:new" },
            { label: "Open", action: "notepad:open" },
            { type: "separator" },
            { label: "Save", action: "notepad:save" },
            { label: "Save As", action: "notepad:saveAs" }
          ]
        },
        Edit: {
          items: [
            { label: "Undo", action: "edit:undo" },
            { label: "Redo", action: "edit:redo" },
            { type: "separator" },
            { label: "Cut", action: "edit:cut" },
            { label: "Copy", action: "edit:copy" },
            { label: "Paste", action: "edit:paste" },
            { label: "Select All", action: "edit:selectAll" }
          ]
        }
      }
    }
  }
};
