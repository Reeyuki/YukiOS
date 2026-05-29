import { BaseApp } from "./core/BaseApp.js";
import { WindowHelper } from "./utils/WindowHelper.js";
import { PersistenceTypes } from "./runtime/AppSchema.js";

const SHORTCUTS_DATA = [
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
  },
  {
    keys: ["Ctrl", "Alt", "↑"],
    desc: "Increase display brightness",
    cat: "global",
    icon: "fas fa-sun"
  },
  {
    keys: ["Ctrl", "Alt", "↓"],
    desc: "Decrease display brightness",
    cat: "global",
    icon: "fas fa-sun"
  },
  {
    keys: ["Ctrl", "Alt", "←"],
    desc: "Decrease color temperature (warmer)",
    cat: "global",
    icon: "fas fa-temperature-half"
  },
  {
    keys: ["Ctrl", "Alt", "→"],
    desc: "Increase color temperature (cooler)",
    cat: "global",
    icon: "fas fa-temperature-half"
  }
];

export class ShortcutsApp extends BaseApp {
  constructor(services) {
    super(services);
    this.windowHelper = new WindowHelper(this.wm);
    this.shortcuts = SHORTCUTS_DATA;
    this._declarativeApp = null;
  }

  getDeclarativeSchema(opts) {
    return {
      id: "shortcuts-app",
      name: "Keyboard Shortcuts",
      icon: "fa fa-keyboard",
      windows: [
        {
          id: "shortcuts-app",
          title: "Keyboard Shortcuts",
          size: ["750px", "520px"],
          icon: "fa fa-keyboard",
          ui: `
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
      </div>`,
          events: {
            ".sc-search-input": {
              input: {
                type: "custom:filterShortcuts",
                stopPropagation: false
              }
            },
            ".sc-nav-item": {
              click: {
                type: "custom:changeCategory",
                stopPropagation: true
              }
            }
          }
        }
      ],
      state: {
        initial: {
          currentCategory: "all",
          searchQuery: ""
        },
        persistence: PersistenceTypes.NONE
      },
      actions: {
        initShortcuts: (payload, event, element, state) => {
          this.initShortcuts(payload, event, element, state);
        },
        filterShortcuts: (payload, event, element, state) => {
          state.searchQuery = event.target.value;
        },
        changeCategory: (payload, event, element, state) => {
          state.currentCategory = element.dataset.cat;
        }
      },
      onMount: "initShortcuts"
    };
  }

  initShortcuts(payload, event, element, state) {
    this.setupAppLogic(element);
  }

  open() {
    const winId = "shortcuts-app";
    if (this._isSingletonOpen(winId)) return;
    return super.open();
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
