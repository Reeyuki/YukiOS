import { BaseApp } from "./core/BaseApp.js";
import { WindowHelper } from "./utils/WindowHelper.js";

export class ShortcutsApp extends BaseApp {
  constructor(services) {
    super(services);
    this.windowHelper = new WindowHelper(this.wm);
    this.shortcuts = [
      {
        keys: ["Ctrl", "K"],
        desc: "Open Unified Command Palette",
        cat: "global",
        icon: "fas fa-search"
      },
      {
        keys: ["Ctrl", "P"],
        desc: "Open Unified Command Palette",
        cat: "global",
        icon: "fas fa-search"
      },
      {
        keys: ["F1"],
        desc: "Open Unified Command Palette",
        cat: "global",
        icon: "fas fa-search"
      },
      {
        keys: ["Ctrl", "D"],
        desc: "Show / Hide Desktop (Minimize or restore all windows)",
        cat: "global",
        icon: "fas fa-desktop"
      },
      {
        keys: ["Ctrl", "←"],
        desc: "Snap active window to the left half of the screen",
        cat: "global",
        icon: "fas fa-window-maximize"
      },
      {
        keys: ["Ctrl", "→"],
        desc: "Snap active window to the right half of the screen",
        cat: "global",
        icon: "fas fa-window-maximize"
      },
      {
        keys: ["Ctrl", "↑"],
        desc: "Maximize active window",
        cat: "global",
        icon: "fas fa-window-maximize"
      },
      {
        keys: ["Control"],
        desc: "Toggle Start Menu (when desktop is focused)",
        cat: "global",
        icon: "fas fa-bars"
      },
      {
        keys: ["Tab"],
        desc: "Toggle Start Menu (when desktop is focused)",
        cat: "global",
        icon: "fas fa-bars"
      },
      {
        keys: ["Space"],
        desc: "Toggle Start Menu (when desktop is focused)",
        cat: "global",
        icon: "fas fa-bars"
      },
      {
        keys: ["Ctrl", "C"],
        desc: "Copy selected files or folders",
        cat: "desktop",
        icon: "fas fa-copy"
      },
      {
        keys: ["Ctrl", "X"],
        desc: "Cut selected files or folders",
        cat: "desktop",
        icon: "fas fa-cut"
      },
      {
        keys: ["Ctrl", "V"],
        desc: "Paste copied or cut files/folders into desktop or explorer",
        cat: "desktop",
        icon: "fas fa-paste"
      },
      {
        keys: ["Delete"],
        desc: "Delete selected icons/files on the desktop",
        cat: "desktop",
        icon: "fas fa-trash-alt"
      },
      {
        keys: ["F2"],
        desc: "Start inline renaming of selected file/folder",
        cat: "desktop",
        icon: "fas fa-edit"
      },
      {
        keys: ["Ctrl", "O"],
        desc: "Open file inside Notepad",
        cat: "notepad",
        icon: "fas fa-folder-open"
      },
      {
        keys: ["Ctrl", "S"],
        desc: "Save active file in Notepad",
        cat: "notepad",
        icon: "fas fa-save"
      },
      {
        keys: ["Ctrl", "Shift", "S"],
        desc: "Save active file as new file in Notepad",
        cat: "notepad",
        icon: "fas fa-file-medical"
      },
      {
        keys: ["Ctrl", "F"],
        desc: "Open Find Text search dialog in Notepad",
        cat: "notepad",
        icon: "fas fa-search"
      },
      {
        keys: ["F3"],
        desc: "Find next occurrence of matched text",
        cat: "notepad",
        icon: "fas fa-arrow-down"
      },
      {
        keys: ["Shift", "F3"],
        desc: "Find previous occurrence of matched text",
        cat: "notepad",
        icon: "fas fa-arrow-up"
      },
      {
        keys: ["Ctrl", "H"],
        desc: "Open Replace dialog in Notepad",
        cat: "notepad",
        icon: "fas fa-exchange-alt"
      },
      {
        keys: ["Ctrl", "G"],
        desc: "Go to line dialog in Notepad",
        cat: "notepad",
        icon: "fas fa-hashtag"
      },
      {
        keys: ["Ctrl", "+"],
        desc: "Zoom in text editor",
        cat: "notepad",
        icon: "fas fa-search-plus"
      },
      {
        keys: ["Ctrl", "-"],
        desc: "Zoom out text editor",
        cat: "notepad",
        icon: "fas fa-search-minus"
      },
      {
        keys: ["Ctrl", "0"],
        desc: "Reset zoom factor to default in Notepad",
        cat: "notepad",
        icon: "fas fa-compress-arrows-alt"
      },
      {
        keys: ["Escape"],
        desc: "Close active Notepad dialogs / popups",
        cat: "notepad",
        icon: "fas fa-times"
      },
      {
        keys: ["Alt", "1-9"],
        desc: "Switch directly to browser Tab 1-9",
        cat: "browser",
        icon: "fas fa-window-restore"
      },
      {
        keys: ["Ctrl", "L"],
        desc: "Focus browser address/URL bar & select",
        cat: "browser",
        icon: "fas fa-search"
      },
      {
        keys: ["Ctrl", "T"],
        desc: "Create new browser tab",
        cat: "browser",
        icon: "fas fa-plus"
      },
      {
        keys: ["Ctrl", "W"],
        desc: "Close active browser tab",
        cat: "browser",
        icon: "fas fa-minus"
      },
      {
        keys: ["Ctrl", "Shift", "T"],
        desc: "Reopen last closed browser tab",
        cat: "browser",
        icon: "fas fa-history"
      },
      {
        keys: ["Ctrl", "V"],
        desc: "Paste & evaluate math expression from clipboard",
        cat: "calc",
        icon: "fas fa-paste"
      },
      {
        keys: ["0 - 9"],
        desc: "Press calculator digit keys",
        cat: "calc",
        icon: "fas fa-keyboard"
      },
      {
        keys: ["."],
        desc: "Decimal points button",
        cat: "calc",
        icon: "fas fa-keyboard"
      },
      {
        keys: ["+", "-", "*", "/"],
        desc: "Press arithmetic operator buttons (+, −, ×, ÷)",
        cat: "calc",
        icon: "fas fa-plus-minus"
      },
      {
        keys: ["%"],
        desc: "Percent calculations button",
        cat: "calc",
        icon: "fas fa-percent"
      },
      {
        keys: ["Enter", "="],
        desc: "Equals / Evaluate calculations",
        cat: "calc",
        icon: "fas fa-equals"
      },
      {
        keys: ["Backspace"],
        desc: "Backspace / delete last digit in Calculator",
        cat: "calc",
        icon: "fas fa-backspace"
      },
      {
        keys: ["Escape", "Delete"],
        desc: "Clear calculator (AC button)",
        cat: "calc",
        icon: "fas fa-eraser"
      },
      {
        keys: ["Escape"],
        desc: "Close calendar popup",
        cat: "calendar",
        icon: "fas fa-times"
      },
      {
        keys: ["←", "→"],
        desc: "Navigate previous or next month in Calendar",
        cat: "calendar",
        icon: "fas fa-arrow-left"
      },
      {
        keys: ["↑", "↓"],
        desc: "Navigate previous or next year in Calendar",
        cat: "calendar",
        icon: "fas fa-arrow-up"
      }
    ];
  }

  open() {
    const winId = "shortcuts-app";
    if (this._isSingletonOpen(winId)) return;

    const content = `
      <style>
        #shortcuts-app .sc-app-wrapper {
          display: flex;
          height: calc(100% - 40px);
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
          color: rgba(255, 255, 255, 0.9);
          background: linear-gradient(135deg, #0f0f14, #14141c);
          overflow: hidden;
        }

        #shortcuts-app .sc-sidebar {
          width: 220px;
          border-right: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.02);
          display: flex;
          flex-direction: column;
          flex-shrink: 0;
        }

        #shortcuts-app .sc-search-wrap {
          padding: 16px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        #shortcuts-app .sc-search-container {
          position: relative;
          display: flex;
          align-items: center;
        }

        #shortcuts-app .sc-search-icon {
          position: absolute;
          left: 10px;
          color: rgba(255, 255, 255, 0.4);
          font-size: 13px;
        }

        #shortcuts-app .sc-search-input {
          width: 100%;
          padding: 8px 10px 8px 30px;
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(0, 0, 0, 0.2);
          color: #fff;
          font-size: 13px;
          outline: none;
          font-family: inherit;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        #shortcuts-app .sc-search-input:focus {
          border-color: rgba(79, 158, 255, 0.5);
          box-shadow: 0 0 8px rgba(79, 158, 255, 0.2);
        }

        #shortcuts-app .sc-nav {
          padding: 10px 8px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          flex: 1;
          overflow-y: auto;
        }

        #shortcuts-app .sc-nav-item {
          padding: 10px 14px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 10px;
          color: rgba(255, 255, 255, 0.6);
          transition: all 0.2s ease;
        }

        #shortcuts-app .sc-nav-item i {
          width: 16px;
          text-align: center;
          font-size: 14px;
        }

        #shortcuts-app .sc-nav-item:hover {
          color: #fff;
          background: rgba(255, 255, 255, 0.04);
        }

        #shortcuts-app .sc-nav-item.active {
          color: #fff;
          background: rgba(79, 158, 255, 0.12);
          border-left: 3px solid #4f9eff;
          padding-left: 11px;
        }

        #shortcuts-app .sc-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          background: rgba(0, 0, 0, 0.1);
        }

        #shortcuts-app .sc-list-header {
          padding: 16px 24px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        #shortcuts-app .sc-list-title {
          font-size: 16px;
          font-weight: 700;
          letter-spacing: -0.2px;
          color: #fff;
        }

        #shortcuts-app .sc-list-count {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.4);
          background: rgba(255, 255, 255, 0.05);
          padding: 2px 8px;
          border-radius: 12px;
        }

        #shortcuts-app .sc-content-area {
          flex: 1;
          overflow-y: auto;
          padding: 16px 24px;
        }

        #shortcuts-app .sc-grid {
          display: flex;
          flex-direction: column;
          gap: 8px;
          max-width: 800px;
          margin: 0 auto;
        }

        #shortcuts-app .sc-card {
          padding: 12px 16px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.04);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          transition: all 0.2s ease;
        }

        #shortcuts-app .sc-card:hover {
          background: rgba(255, 255, 255, 0.04);
          border-color: rgba(255, 255, 255, 0.08);
          transform: translateY(-1px);
        }

        #shortcuts-app .sc-card-left {
          display: flex;
          align-items: center;
          gap: 14px;
          min-width: 0;
        }

        #shortcuts-app .sc-card-icon-wrap {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.04);
          display: flex;
          align-items: center;
          justify-content: center;
          color: rgba(255, 255, 255, 0.7);
          flex-shrink: 0;
          font-size: 13px;
        }

        #shortcuts-app .sc-card-desc {
          font-size: 13px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.85);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        #shortcuts-app .sc-card-keys {
          display: flex;
          align-items: center;
          gap: 4px;
          flex-shrink: 0;
        }

        #shortcuts-app kbd {
          font-family: inherit;
          font-size: 11px;
          font-weight: 600;
          padding: 3px 7px;
          background: linear-gradient(to bottom, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.06));
          border: 1px solid rgba(255, 255, 255, 0.16);
          border-bottom-color: rgba(255, 255, 255, 0.25);
          border-radius: 5px;
          color: #fff;
          box-shadow: 0 1px 1px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1);
          text-shadow: 0 1px 0 rgba(0, 0, 0, 0.4);
          letter-spacing: 0.5px;
        }

        #shortcuts-app .sc-card-plus {
          font-size: 10px;
          color: rgba(255, 255, 255, 0.3);
          font-weight: 700;
          padding: 0 2px;
        }

        #shortcuts-app .sc-empty-state {
          padding: 40px;
          text-align: center;
          color: rgba(255, 255, 255, 0.4);
          font-size: 14px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }

        #shortcuts-app .sc-empty-state i {
          font-size: 32px;
          color: rgba(255, 255, 255, 0.15);
        }
      </style>

      <div class="sc-app-wrapper">
        <div class="sc-sidebar">
          <div class="sc-search-wrap">
            <div class="sc-search-container">
              <i class="fas fa-search sc-search-icon"></i>
              <input type="text" class="sc-search-input" placeholder="Search shortcuts..." spellcheck="false">
            </div>
          </div>
          <div class="sc-nav">
            <div class="sc-nav-item active" data-cat="all"><i class="fas fa-keyboard"></i>All Shortcuts</div>
            <div class="sc-nav-item" data-cat="global"><i class="fas fa-globe"></i>Global & System</div>
            <div class="sc-nav-item" data-cat="desktop"><i class="fas fa-desktop"></i>Desktop & Files</div>
            <div class="sc-nav-item" data-cat="notepad"><i class="fas fa-file-alt"></i>Notepad</div>
            <div class="sc-nav-item" data-cat="browser"><i class="fas fa-compass"></i>Yuki Browser</div>
            <div class="sc-nav-item" data-cat="calc"><i class="fas fa-calculator"></i>Calculator</div>
            <div class="sc-nav-item" data-cat="calendar"><i class="fas fa-calendar-alt"></i>Calendar</div>
          </div>
        </div>
        <div class="sc-main">
          <div class="sc-list-header">
            <div class="sc-list-title">All Shortcuts</div>
            <div class="sc-list-count">0 items</div>
          </div>
          <div class="sc-content-area">
            <div class="sc-grid" id="sc-list-container"></div>
          </div>
        </div>
      </div>
    `;

    const win = this.windowHelper.createAndMountWindow(winId, "Keyboard Shortcuts", content, "750px", "520px", {
      icon: "fa fa-keyboard",
      iconColor: "#4f9eff"
    });

    this.setupAppLogic(win);
  }

  setupAppLogic(win) {
    const listContainer = win.querySelector("#sc-list-container");
    const searchInput = win.querySelector(".sc-search-input");
    const navItems = win.querySelectorAll(".sc-nav-item");
    const listTitle = win.querySelector(".sc-list-title");
    const listCount = win.querySelector(".sc-list-count");

    let currentCategory = "all";

    const getCategoryLabel = (cat) => {
      const labels = {
        all: "All Shortcuts",
        global: "Global & System",
        desktop: "Desktop & Files",
        notepad: "Notepad",
        browser: "Yuki Browser",
        calc: "Calculator",
        calendar: "Calendar"
      };
      return labels[cat] || "Shortcuts";
    };

    const render = () => {
      const search = searchInput.value.trim().toLowerCase();
      listContainer.innerHTML = "";

      let filtered = this.shortcuts;

      if (currentCategory !== "all") {
        filtered = filtered.filter((s) => s.cat === currentCategory);
      }

      if (search) {
        filtered = filtered.filter((s) => {
          const matchDesc = s.desc.toLowerCase().includes(search);
          const matchKeys = s.keys.some((k) => k.toLowerCase().includes(search));
          const matchCat = getCategoryLabel(s.cat).toLowerCase().includes(search);
          return matchDesc || matchKeys || matchCat;
        });
      }

      listTitle.textContent = getCategoryLabel(currentCategory);
      listCount.textContent = `${filtered.length} item${filtered.length !== 1 ? "s" : ""}`;

      if (filtered.length === 0) {
        listContainer.innerHTML = `
          <div class="sc-empty-state">
            <i class="fas fa-keyboard"></i>
            <div>No matching keyboard shortcuts found.</div>
          </div>
        `;
        return;
      }

      filtered.forEach((item) => {
        const card = document.createElement("div");
        card.className = "sc-card";

        const keysHtml = item.keys.map((k) => `<kbd>${k}</kbd>`).join('<span class="sc-card-plus">+</span>');

        card.innerHTML = `
          <div class="sc-card-left">
            <div class="sc-card-icon-wrap">
              <i class="${item.icon}"></i>
            </div>
            <div class="sc-card-desc">${item.desc}</div>
          </div>
          <div class="sc-card-keys">
            ${keysHtml}
          </div>
        `;

        listContainer.appendChild(card);
      });
    };

    searchInput.addEventListener("input", () => render());

    navItems.forEach((nav) => {
      nav.addEventListener("click", () => {
        navItems.forEach((n) => n.classList.remove("active"));
        nav.classList.add("active");
        currentCategory = nav.dataset.cat;
        render();
      });
    });

    render();
  }
}
