import { os, StorageKeys } from "./framework.js";

const MODIFIER_ALIASES = {
  ctrl: ["ctrl", "control"],
  shift: ["shift"],
  alt: ["alt", "option"],
  meta: ["meta", "cmd", "command", "windows", "super"],
};

export const KEYBIND_DEFINITIONS = [
  {
    id: "global.run",
    defaultKeys: ["Ctrl", "Alt", "R"],
    desc: "Open Run dialog",
    cat: "global",
    icon: "papirus:apps/utilities-terminal",
  },
  {
    id: "global.runMeta",
    defaultKeys: ["Meta", "R"],
    desc: "Open Run dialog (Win+R)",
    cat: "global",
    icon: "papirus:apps/utilities-terminal",
  },
  {
    id: "global.commandPalette.k",
    defaultKeys: ["Ctrl", "K"],
    desc: "Open Unified Command Palette",
    cat: "global",
    icon: "papirus:actions/edit-find",
  },
  {
    id: "global.commandPalette.p",
    defaultKeys: ["Ctrl", "P"],
    desc: "Open Unified Command Palette",
    cat: "global",
    icon: "papirus:actions/edit-find",
  },
  {
    id: "global.commandPalette.f1",
    defaultKeys: ["F1"],
    desc: "Open Unified Command Palette",
    cat: "global",
    icon: "papirus:actions/edit-find",
  },
  {
    id: "global.showDesktop",
    defaultKeys: ["Ctrl", "D"],
    desc: "Show / Hide Desktop (Minimize or restore all windows)",
    cat: "global",
    icon: "papirus:devices/computer",
  },
  {
    id: "global.snapLeft",
    defaultKeys: ["Ctrl", "ArrowLeft"],
    desc: "Snap active window to the left half of the screen",
    cat: "global",
    icon: "papirus:actions/window-maximize",
  },
  {
    id: "global.snapRight",
    defaultKeys: ["Ctrl", "ArrowRight"],
    desc: "Snap active window to the right half of the screen",
    cat: "global",
    icon: "papirus:actions/window-maximize",
  },
  {
    id: "global.maximize",
    defaultKeys: ["Ctrl", "ArrowUp"],
    desc: "Maximize active window",
    cat: "global",
    icon: "papirus:actions/window-maximize",
  },
  {
    id: "global.startMenu.ctrl",
    defaultKeys: ["Control"],
    desc: "Toggle Start Menu (when desktop is focused)",
    cat: "global",
    icon: "papirus:actions/view-list",
    hidden: true,
  },
  {
    id: "chromeos.launcher",
    defaultKeys: ["Meta"],
    desc: "Toggle Chrome OS Launcher",
    cat: "global",
    icon: "papirus:actions/view-grid",
  },
  {
    id: "boot.skip",
    defaultKeys: ["Escape", "Enter", "Space"],
    desc: "Skip boot animation",
    cat: "global",
    icon: "papirus:actions/go-next",
  },
  {
    id: "global.windowSwitcher",
    defaultKeys: ["Alt", "Q"],
    desc: "Cycle forward through open windows",
    cat: "global",
    icon: "papirus:actions/swap-panels",
  },
  {
    id: "global.windowSwitcherReverse",
    defaultKeys: ["Shift", "Alt", "Q"],
    desc: "Cycle backward through open windows",
    cat: "global",
    icon: "papirus:actions/swap-panels",
  },
  {
    id: "global.screenshot.full",
    defaultKeys: ["Ctrl", "Shift", "S"],
    desc: "Capture full screen and auto-save to Pictures",
    cat: "global",
    icon: "papirus:apps/accessories-camera",
  },
  {
    id: "global.screenshot.area",
    defaultKeys: ["Ctrl", "Alt", "S"],
    desc: "Capture area screenshot and auto-save to Pictures",
    cat: "global",
    icon: "papirus:actions/transform-crop",
  },
  {
    id: "global.screenshot.record",
    defaultKeys: ["Ctrl", "Shift", "R"],
    desc: "Start / stop screen recording",
    cat: "global",
    icon: "papirus:devices/camera-video",
  },
  {
    id: "global.screenshot.deck",
    defaultKeys: ["F9"],
    desc: "Capture screenshot and auto-save (game-tagged on Steam Deck)",
    cat: "global",
    icon: "papirus:apps/accessories-camera",
  },
  {
    id: "global.colorPicker",
    defaultKeys: ["Alt", "H"],
    desc: "Open color picker and start picking",
    cat: "global",
    icon: "papirus:actions/color-select",
  },
  {
    id: "global.brightness.up",
    defaultKeys: ["Ctrl", "Alt", "ArrowUp"],
    desc: "Increase display brightness",
    cat: "global",
    icon: "papirus:status/weather-clear",
  },
  {
    id: "global.brightness.down",
    defaultKeys: ["Ctrl", "Alt", "ArrowDown"],
    desc: "Decrease display brightness",
    cat: "global",
    icon: "papirus:status/weather-clear",
  },
  {
    id: "global.temperature.left",
    defaultKeys: ["Ctrl", "Alt", "ArrowLeft"],
    desc: "Decrease color temperature (warmer)",
    cat: "global",
    icon: "papirus:status/weather-clear",
  },
  {
    id: "global.temperature.right",
    defaultKeys: ["Ctrl", "Alt", "ArrowRight"],
    desc: "Increase color temperature (cooler)",
    cat: "global",
    icon: "papirus:status/weather-clear",
  },
  {
    id: "global.closePalette",
    defaultKeys: ["Escape"],
    desc: "Close command palette",
    cat: "global",
    icon: "papirus:actions/window-close",
    hidden: true,
  },
  {
    id: "global.paletteUp",
    defaultKeys: ["ArrowUp"],
    desc: "Navigate up in command palette",
    cat: "global",
    icon: "papirus:actions/go-up",
    hidden: true,
  },
  {
    id: "global.paletteDown",
    defaultKeys: ["ArrowDown"],
    desc: "Navigate down in command palette",
    cat: "global",
    icon: "papirus:actions/go-down",
    hidden: true,
  },
  {
    id: "global.paletteEnter",
    defaultKeys: ["Enter"],
    desc: "Execute selected item in command palette",
    cat: "global",
    icon: "papirus:actions/object-select",
    hidden: true,
  },
  {
    id: "steam.overlay",
    defaultKeys: ["Shift", "Tab"],
    desc: "Open Yuki Steam overlay while in-game",
    cat: "games",
    icon: "papirus:apps/steam",
  },
  {
    id: "global.closeDialog",
    defaultKeys: ["Escape"],
    desc: "Close dialog",
    cat: "global",
    icon: "papirus:actions/window-close",
    hidden: true,
  },
  {
    id: "global.confirmDialog",
    defaultKeys: ["Enter"],
    desc: "Confirm dialog",
    cat: "global",
    icon: "papirus:actions/object-select",
    hidden: true,
  },
  {
    id: "global.resizeWindow",
    defaultKeys: ["Alt", "Right Click"],
    desc: "Resize window instead of drag",
    cat: "global",
    icon: "papirus:actions/view-fullscreen",
    hidden: true,
  },
  {
    id: "desktop.copy",
    defaultKeys: ["Ctrl", "C"],
    desc: "Copy selected files or folders",
    cat: "desktop",
    icon: "papirus:actions/edit-copy",
  },
  {
    id: "desktop.cut",
    defaultKeys: ["Ctrl", "X"],
    desc: "Cut selected files or folders",
    cat: "desktop",
    icon: "papirus:actions/edit-cut",
  },
  {
    id: "desktop.paste",
    defaultKeys: ["Ctrl", "V"],
    desc: "Paste copied or cut files/folders into desktop or explorer",
    cat: "desktop",
    icon: "papirus:actions/edit-paste",
  },
  {
    id: "desktop.delete",
    defaultKeys: ["Delete"],
    desc: "Delete selected icons/files on the desktop",
    cat: "desktop",
    icon: "papirus:actions/entry-delete",
    hidden: true,
  },
  {
    id: "desktop.rename",
    defaultKeys: ["F2"],
    desc: "Start inline renaming of selected file/folder",
    cat: "desktop",
    icon: "papirus:actions/edit",
  },
  {
    id: "notepad.open",
    defaultKeys: ["Ctrl", "O"],
    desc: "Open file inside Notepad",
    cat: "notepad",
    icon: "papirus:places/folder-blue-open",
  },
  {
    id: "notepad.save",
    defaultKeys: ["Ctrl", "S"],
    desc: "Save active file in Notepad",
    cat: "notepad",
    icon: "papirus:actions/document-save",
  },
  {
    id: "notepad.saveAs",
    defaultKeys: ["Ctrl", "Shift", "S"],
    desc: "Save active file as new file in Notepad",
    cat: "notepad",
    icon: "papirus:actions/document-new",
  },
  {
    id: "notepad.find",
    defaultKeys: ["Ctrl", "F"],
    desc: "Open Find Text search dialog in Notepad",
    cat: "notepad",
    icon: "papirus:actions/edit-find",
  },
  {
    id: "notepad.findNext",
    defaultKeys: ["F3"],
    desc: "Find next occurrence of matched text",
    cat: "notepad",
    icon: "papirus:actions/go-down",
    hidden: true,
  },
  {
    id: "notepad.findPrev",
    defaultKeys: ["Shift", "F3"],
    desc: "Find previous occurrence of matched text",
    cat: "notepad",
    icon: "papirus:actions/go-up",
    hidden: true,
  },
  {
    id: "notepad.replace",
    defaultKeys: ["Ctrl", "H"],
    desc: "Open Replace dialog in Notepad",
    cat: "notepad",
    icon: "papirus:actions/swap-panels",
  },
  {
    id: "notepad.goto",
    defaultKeys: ["Ctrl", "G"],
    desc: "Go to line dialog in Notepad",
    cat: "notepad",
    icon: "papirus:actions/tag",
  },
  {
    id: "notepad.zoomIn",
    defaultKeys: ["Ctrl", "="],
    desc: "Zoom in text editor",
    cat: "notepad",
    icon: "papirus:actions/zoom-in",
  },
  {
    id: "notepad.zoomOut",
    defaultKeys: ["Ctrl", "-"],
    desc: "Zoom out text editor",
    cat: "notepad",
    icon: "papirus:actions/zoom-out",
  },
  {
    id: "notepad.zoomReset",
    defaultKeys: ["Ctrl", "0"],
    desc: "Reset zoom factor to default in Notepad",
    cat: "notepad",
    icon: "papirus:actions/view-restore",
  },
  {
    id: "notepad.closeDialog",
    defaultKeys: ["Escape"],
    desc: "Close active Notepad dialogs / popups",
    cat: "notepad",
    icon: "papirus:actions/window-close",
    hidden: true,
  },
  {
    id: "browser.tab1",
    defaultKeys: ["Alt", "1"],
    desc: "Switch directly to browser Tab 1",
    cat: "browser",
    icon: "papirus:actions/window-restore",
  },
  {
    id: "browser.tab2",
    defaultKeys: ["Alt", "2"],
    desc: "Switch directly to browser Tab 2",
    cat: "browser",
    icon: "papirus:actions/window-restore",
  },
  {
    id: "browser.tab3",
    defaultKeys: ["Alt", "3"],
    desc: "Switch directly to browser Tab 3",
    cat: "browser",
    icon: "papirus:actions/window-restore",
  },
  {
    id: "browser.tab4",
    defaultKeys: ["Alt", "4"],
    desc: "Switch directly to browser Tab 4",
    cat: "browser",
    icon: "papirus:actions/window-restore",
  },
  {
    id: "browser.tab5",
    defaultKeys: ["Alt", "5"],
    desc: "Switch directly to browser Tab 5",
    cat: "browser",
    icon: "papirus:actions/window-restore",
  },
  {
    id: "browser.tab6",
    defaultKeys: ["Alt", "6"],
    desc: "Switch directly to browser Tab 6",
    cat: "browser",
    icon: "papirus:actions/window-restore",
  },
  {
    id: "browser.tab7",
    defaultKeys: ["Alt", "7"],
    desc: "Switch directly to browser Tab 7",
    cat: "browser",
    icon: "papirus:actions/window-restore",
  },
  {
    id: "browser.tab8",
    defaultKeys: ["Alt", "8"],
    desc: "Switch directly to browser Tab 8",
    cat: "browser",
    icon: "papirus:actions/window-restore",
  },
  {
    id: "browser.tab9",
    defaultKeys: ["Alt", "9"],
    desc: "Switch directly to browser Tab 9",
    cat: "browser",
    icon: "papirus:actions/window-restore",
  },
  {
    id: "browser.focusUrl",
    defaultKeys: ["Ctrl", "L"],
    desc: "Focus browser address/URL bar & select",
    cat: "browser",
    icon: "papirus:actions/edit-find",
  },
  {
    id: "browser.newTab",
    defaultKeys: ["Alt", "T"],
    desc: "Create new browser tab",
    cat: "browser",
    icon: "papirus:actions/list-add",
  },
  {
    id: "browser.closeTab",
    defaultKeys: ["Alt", "W"],
    desc: "Close active browser tab",
    cat: "browser",
    icon: "papirus:actions/list-remove",
  },
  {
    id: "browser.reloadPage",
    defaultKeys: ["Alt", "R"],
    desc: "Reload active browser page",
    cat: "browser",
    icon: "papirus:actions/window-restore",
  },
  {
    id: "browser.bookmarkPage",
    defaultKeys: ["Alt", "D"],
    desc: "Bookmark active browser page",
    cat: "browser",
    icon: "papirus:actions/list-add",
  },
  {
    id: "browser.reopenTab",
    defaultKeys: ["Ctrl", "Shift", "T"],
    desc: "Reopen last closed browser tab",
    cat: "browser",
    icon: "papirus:actions/document-open-recent",
  },
  {
    id: "browser.find",
    defaultKeys: ["Ctrl", "F"],
    desc: "Find in browser page",
    cat: "browser",
    icon: "papirus:actions/edit-find",
  },
  {
    id: "browser.history",
    defaultKeys: ["Ctrl", "H"],
    desc: "Open browser history",
    cat: "browser",
    icon: "papirus:actions/document-open-recent",
  },
  {
    id: "browser.downloads",
    defaultKeys: ["Ctrl", "J"],
    desc: "Open browser downloads",
    cat: "browser",
    icon: "papirus:actions/edit-download",
  },
  {
    id: "browser.toggleBookmarkBar",
    defaultKeys: ["Ctrl", "Shift", "B"],
    desc: "Toggle browser bookmark bar",
    cat: "browser",
    icon: "papirus:actions/bookmark-new",
  },
  {
    id: "browser.savePage",
    defaultKeys: ["Ctrl", "S"],
    desc: "Save current browser page",
    cat: "browser",
    icon: "papirus:actions/document-save",
  },
  {
    id: "browser.palette",
    defaultKeys: ["Ctrl", "Shift", "P"],
    desc: "Open command palette",
    cat: "browser",
    icon: "papirus:actions/configure",
  },
  {
    id: "browser.split",
    defaultKeys: ["Ctrl", "Shift", "S"],
    desc: "Toggle browser split view",
    cat: "browser",
    icon: "papirus:actions/swap-panels",
  },
  {
    id: "browser.toggleSidebar",
    defaultKeys: ["Ctrl", "Shift", "Y"],
    desc: "Toggle browser sidebar tabs",
    cat: "browser",
    icon: "papirus:actions/window-restore",
  },
  {
    id: "calc.paste",
    defaultKeys: ["Ctrl", "V"],
    desc: "Paste & evaluate math expression from clipboard",
    cat: "calc",
    icon: "papirus:actions/edit-paste",
  },
  {
    id: "calc.evaluate",
    defaultKeys: ["Enter"],
    desc: "Equals / Evaluate calculations",
    cat: "calc",
    icon: "papirus:apps/accessories-calculator",
    hidden: true,
  },
  {
    id: "calc.backspace",
    defaultKeys: ["Backspace"],
    desc: "Backspace / delete last digit in Calculator",
    cat: "calc",
    icon: "papirus:actions/edit-clear",
    hidden: true,
  },
  {
    id: "calc.clear",
    defaultKeys: ["Escape"],
    desc: "Clear calculator (AC button)",
    cat: "calc",
    icon: "papirus:actions/edit-clear",
    hidden: true,
  },
  {
    id: "calendar.close",
    defaultKeys: ["Escape"],
    desc: "Close calendar popup",
    cat: "calendar",
    icon: "papirus:actions/window-close",
    hidden: true,
  },
  {
    id: "calendar.prevMonth",
    defaultKeys: ["ArrowLeft"],
    desc: "Navigate previous month in Calendar",
    cat: "calendar",
    icon: "papirus:actions/go-previous",
    hidden: true,
  },
  {
    id: "calendar.nextMonth",
    defaultKeys: ["ArrowRight"],
    desc: "Navigate next month in Calendar",
    cat: "calendar",
    icon: "papirus:actions/go-next",
    hidden: true,
  },
  {
    id: "terminal.execute",
    defaultKeys: ["Enter"],
    desc: "Execute command in Terminal",
    cat: "terminal",
    icon: "papirus:apps/utilities-terminal",
    hidden: true,
  },
  {
    id: "terminal.historyUp",
    defaultKeys: ["ArrowUp"],
    desc: "Previous command in Terminal history",
    cat: "terminal",
    icon: "papirus:actions/go-up",
    hidden: true,
  },
  {
    id: "terminal.historyDown",
    defaultKeys: ["ArrowDown"],
    desc: "Next command in Terminal history",
    cat: "terminal",
    icon: "papirus:actions/go-down",
    hidden: true,
  },
  {
    id: "terminal.tabComplete",
    defaultKeys: ["Tab"],
    desc: "Tab completion in Terminal",
    cat: "terminal",
    icon: "papirus:devices/input-keyboard",
    hidden: true,
  },
  {
    id: "terminal.clear",
    defaultKeys: ["Ctrl", "L"],
    desc: "Clear Terminal screen",
    cat: "terminal",
    icon: "papirus:actions/edit-clear",
    hidden: true,
  },
  {
    id: "terminal.interrupt",
    defaultKeys: ["Ctrl", "C"],
    desc: "Interrupt command in Terminal",
    cat: "terminal",
    icon: "papirus:actions/media-playback-stop",
    hidden: true,
  },
  {
    id: "terminal.close",
    defaultKeys: ["Alt", "W"],
    desc: "Close Terminal window",
    cat: "terminal",
    icon: "papirus:actions/window-close",
    hidden: true,
  },
  {
    id: "office.new",
    defaultKeys: ["Ctrl", "N"],
    desc: "New document in Office",
    cat: "office",
    icon: "papirus:mimetypes/text-x-generic",
  },
  {
    id: "office.print",
    defaultKeys: ["Ctrl", "P"],
    desc: "Print in Office",
    cat: "office",
    icon: "papirus:actions/document-print",
  },
  {
    id: "office.undo",
    defaultKeys: ["Ctrl", "Z"],
    desc: "Undo in Office",
    cat: "office",
    icon: "papirus:actions/edit-undo",
  },
  {
    id: "office.redo",
    defaultKeys: ["Ctrl", "Y"],
    desc: "Redo in Office",
    cat: "office",
    icon: "papirus:actions/edit-redo",
  },
  {
    id: "office.cut",
    defaultKeys: ["Ctrl", "X"],
    desc: "Cut in Office",
    cat: "office",
    icon: "papirus:actions/edit-cut",
  },
  {
    id: "office.copy",
    defaultKeys: ["Ctrl", "C"],
    desc: "Copy in Office",
    cat: "office",
    icon: "papirus:actions/edit-copy",
  },
  {
    id: "office.selectAll",
    defaultKeys: ["Ctrl", "A"],
    desc: "Select all in Office",
    cat: "office",
    icon: "papirus:actions/object-group",
  },
  {
    id: "office.bold",
    defaultKeys: ["Ctrl", "B"],
    desc: "Bold text in Office",
    cat: "office",
    icon: "papirus:actions/format-text-bold",
  },
  {
    id: "office.italic",
    defaultKeys: ["Ctrl", "I"],
    desc: "Italic text in Office",
    cat: "office",
    icon: "papirus:actions/format-text-italic",
  },
  {
    id: "office.underline",
    defaultKeys: ["Ctrl", "U"],
    desc: "Underline text in Office",
    cat: "office",
    icon: "papirus:actions/format-text-underline",
  },
  {
    id: "office.insertLink",
    defaultKeys: ["Ctrl", "K"],
    desc: "Insert link in Office",
    cat: "office",
    icon: "papirus:actions/insert-link",
  },
  {
    id: "office.zoomIn",
    defaultKeys: ["Ctrl", "="],
    desc: "Zoom in in Office",
    cat: "office",
    icon: "papirus:actions/zoom-in",
  },
  {
    id: "office.zoomOut",
    defaultKeys: ["Ctrl", "-"],
    desc: "Zoom out in Office",
    cat: "office",
    icon: "papirus:actions/zoom-out",
  },
  {
    id: "office.zoomReset",
    defaultKeys: ["Ctrl", "0"],
    desc: "Reset zoom in Office",
    cat: "office",
    icon: "papirus:actions/view-restore",
  },
  {
    id: "office.find",
    defaultKeys: ["Ctrl", "F"],
    desc: "Find in Office",
    cat: "office",
    icon: "papirus:actions/edit-find",
  },
  {
    id: "office.replace",
    defaultKeys: ["Ctrl", "H"],
    desc: "Replace in Office",
    cat: "office",
    icon: "papirus:actions/swap-panels",
  },
  {
    id: "office.open",
    defaultKeys: ["Ctrl", "O"],
    desc: "Open document in Office",
    cat: "office",
    icon: "papirus:places/folder-blue-open",
  },
  {
    id: "office.fullscreen",
    defaultKeys: ["F11"],
    desc: "Toggle fullscreen in Office",
    cat: "office",
    icon: "papirus:actions/view-fullscreen",
  },
  {
    id: "games.search",
    defaultKeys: ["Ctrl", "F"],
    desc: "Search in games",
    cat: "games",
    icon: "papirus:actions/edit-find",
    hidden: true,
  },
  {
    id: "startMenu.arrowUp",
    defaultKeys: ["ArrowUp"],
    desc: "Navigate up in start menu",
    cat: "global",
    icon: "papirus:actions/go-up",
    hidden: true,
  },
  {
    id: "startMenu.arrowDown",
    defaultKeys: ["ArrowDown"],
    desc: "Navigate down in start menu",
    cat: "global",
    icon: "papirus:actions/go-down",
    hidden: true,
  },
  {
    id: "startMenu.arrowLeft",
    defaultKeys: ["ArrowLeft"],
    desc: "Switch to categories in start menu",
    cat: "global",
    icon: "papirus:actions/go-previous",
    hidden: true,
  },
  {
    id: "startMenu.arrowRight",
    defaultKeys: ["ArrowRight"],
    desc: "Switch to apps in start menu",
    cat: "global",
    icon: "papirus:actions/go-next",
    hidden: true,
  },
  {
    id: "startMenu.enter",
    defaultKeys: ["Enter"],
    desc: "Launch selected item in start menu",
    cat: "global",
    icon: "papirus:actions/object-select",
    hidden: true,
  },
  {
    id: "explorer.enter",
    defaultKeys: ["Enter"],
    desc: "Navigate to typed path / confirm save dialog",
    cat: "desktop",
    icon: "papirus:actions/object-select",
    hidden: true,
  },
  {
    id: "explorer.escape",
    defaultKeys: ["Escape"],
    desc: "Cancel / close dialog in Explorer",
    cat: "desktop",
    icon: "papirus:actions/window-close",
    hidden: true,
  },
  {
    id: "explorer.copy",
    defaultKeys: ["Ctrl", "C"],
    desc: "Copy selected files in Explorer",
    cat: "desktop",
    icon: "papirus:actions/edit-copy",
  },
  {
    id: "explorer.cut",
    defaultKeys: ["Ctrl", "X"],
    desc: "Cut selected files in Explorer",
    cat: "desktop",
    icon: "papirus:actions/edit-cut",
  },
  {
    id: "desktop.deleteSelected",
    defaultKeys: ["Delete"],
    desc: "Delete selected desktop item",
    cat: "desktop",
    icon: "papirus:actions/entry-delete",
    hidden: true,
  },
  {
    id: "global.temperature.warmer",
    defaultKeys: ["Ctrl", "Alt", "ArrowRight"],
    desc: "Increase color temperature",
    cat: "global",
    icon: "papirus:status/weather-clear",
  },
  {
    id: "global.temperature.cooler",
    defaultKeys: ["Ctrl", "Alt", "ArrowLeft"],
    desc: "Decrease color temperature",
    cat: "global",
    icon: "papirus:status/weather-clear",
  },
  {
    id: "monaco.toggleTerminal",
    defaultKeys: ["Ctrl", "`"],
    desc: "Toggle terminal panel in code editor",
    cat: "monaco",
    icon: "papirus:apps/utilities-terminal",
  },
  {
    id: "session.confirm",
    defaultKeys: ["Enter"],
    desc: "Confirm action in session / login screen",
    cat: "global",
    icon: "papirus:actions/object-select",
    hidden: true,
  },
  {
    id: "session.cancel",
    defaultKeys: ["Escape"],
    desc: "Cancel / close modal in session screen",
    cat: "global",
    icon: "papirus:actions/window-close",
    hidden: true,
  },
  {
    id: "session.navigateLeft",
    defaultKeys: ["ArrowLeft"],
    desc: "Navigate to previous user in session carousel",
    cat: "global",
    icon: "papirus:actions/go-previous",
    hidden: true,
  },
  {
    id: "session.navigateRight",
    defaultKeys: ["ArrowRight"],
    desc: "Navigate to next user in session carousel",
    cat: "global",
    icon: "papirus:actions/go-next",
    hidden: true,
  },
  {
    id: "taskbar.dismissMenu",
    defaultKeys: ["Escape"],
    desc: "Dismiss taskbar context menu",
    cat: "global",
    icon: "papirus:actions/window-close",
    hidden: true,
  },
  {
    id: "workspace.closeOverview",
    defaultKeys: ["Escape"],
    desc: "Close workspace overview",
    cat: "global",
    icon: "papirus:actions/window-close",
    hidden: true,
  },
  {
    id: "tiling.focusLeft",
    defaultKeys: ["Alt", "ArrowLeft"],
    desc: "Move tiling focus left",
    cat: "global",
    icon: "papirus:actions/go-previous",
  },
  {
    id: "tiling.focusRight",
    defaultKeys: ["Alt", "ArrowRight"],
    desc: "Move tiling focus right",
    cat: "global",
    icon: "papirus:actions/go-next",
  },
  {
    id: "tiling.focusUp",
    defaultKeys: ["Alt", "ArrowUp"],
    desc: "Move tiling focus up",
    cat: "global",
    icon: "papirus:actions/go-up",
  },
  {
    id: "tiling.focusDown",
    defaultKeys: ["Alt", "ArrowDown"],
    desc: "Move tiling focus down",
    cat: "global",
    icon: "papirus:actions/go-down",
  },
  {
    id: "tiling.fullscreen",
    defaultKeys: ["Alt", "Enter"],
    desc: "Toggle fullscreen on focused tiled window",
    cat: "global",
    icon: "papirus:actions/view-fullscreen",
  },
  {
    id: "tiling.floating",
    defaultKeys: ["Alt", "F"],
    desc: "Toggle floating on focused tiled window",
    cat: "global",
    icon: "papirus:actions/window-restore",
  },
  {
    id: "tiling.terminal",
    defaultKeys: ["Alt", "T"],
    desc: "Spawn a new terminal window",
    cat: "global",
    icon: "papirus:apps/utilities-terminal",
  },
  {
    id: "tiling.resizeLeft",
    defaultKeys: ["Ctrl", "Alt", "ArrowLeft"],
    desc: "Resize tiling split left",
    cat: "global",
    icon: "papirus:actions/resizerow",
  },
  {
    id: "tiling.resizeRight",
    defaultKeys: ["Ctrl", "Alt", "ArrowRight"],
    desc: "Resize tiling split right",
    cat: "global",
    icon: "papirus:actions/resizerow",
  },
  {
    id: "tiling.resizeUp",
    defaultKeys: ["Ctrl", "Alt", "ArrowUp"],
    desc: "Resize tiling split up",
    cat: "global",
    icon: "papirus:actions/resizecol",
  },
  {
    id: "tiling.resizeDown",
    defaultKeys: ["Ctrl", "Alt", "ArrowDown"],
    desc: "Resize tiling split down",
    cat: "global",
    icon: "papirus:actions/resizecol",
  },
  {
    id: "tiling.swapLeft",
    defaultKeys: ["Alt", "Shift", "ArrowLeft"],
    desc: "Swap tiled window with neighbor left",
    cat: "global",
    icon: "papirus:actions/swap-panels",
  },
  {
    id: "tiling.swapRight",
    defaultKeys: ["Alt", "Shift", "ArrowRight"],
    desc: "Swap tiled window with neighbor right",
    cat: "global",
    icon: "papirus:actions/swap-panels",
  },
  {
    id: "tiling.swapUp",
    defaultKeys: ["Alt", "Shift", "ArrowUp"],
    desc: "Swap tiled window with neighbor up",
    cat: "global",
    icon: "papirus:actions/swap-panels",
  },
  {
    id: "tiling.swapDown",
    defaultKeys: ["Alt", "Shift", "ArrowDown"],
    desc: "Swap tiled window with neighbor down",
    cat: "global",
    icon: "papirus:actions/swap-panels",
  },
  {
    id: "tiling.toggleMode",
    defaultKeys: ["Alt", "Space"],
    desc: "Toggle tiling mode on/off",
    cat: "global",
    icon: "papirus:actions/view-grid",
  },
  {
    id: "tiling.closeWindow",
    defaultKeys: ["Alt", "Q"],
    desc: "Close focused window",
    cat: "global",
    icon: "papirus:actions/window-close",
  },
  {
    id: "tiling.cycleNext",
    defaultKeys: ["Alt", "W"],
    desc: "Cycle focus to next tiled window",
    cat: "global",
    icon: "papirus:actions/go-next",
  },
  {
    id: "tiling.openRofi",
    defaultKeys: ["Alt", "D"],
    desc: "Open Rofi app launcher (tiling mode)",
    cat: "global",
    icon: "papirus:actions/edit-find",
  },
  {
    id: "tiling.cyclePrev",
    defaultKeys: ["Alt", "K"],
    desc: "Cycle focus to previous tiled window",
    cat: "global",
    icon: "papirus:actions/go-previous",
  },
  {
    id: "tiling.focusWorkspace1",
    defaultKeys: ["Alt", "1"],
    desc: "Switch to workspace 1",
    cat: "global",
    icon: "papirus:actions/view-grid",
  },
  {
    id: "tiling.focusWorkspace2",
    defaultKeys: ["Alt", "2"],
    desc: "Switch to workspace 2",
    cat: "global",
    icon: "papirus:actions/view-grid",
  },
  {
    id: "tiling.focusWorkspace3",
    defaultKeys: ["Alt", "3"],
    desc: "Switch to workspace 3",
    cat: "global",
    icon: "papirus:actions/view-grid",
  },
  {
    id: "tiling.focusWorkspace4",
    defaultKeys: ["Alt", "4"],
    desc: "Switch to workspace 4",
    cat: "global",
    icon: "papirus:actions/view-grid",
  },
  {
    id: "tiling.focusWorkspace5",
    defaultKeys: ["Alt", "5"],
    desc: "Switch to workspace 5",
    cat: "global",
    icon: "papirus:actions/view-grid",
  },
  {
    id: "tiling.focusWorkspace6",
    defaultKeys: ["Alt", "6"],
    desc: "Switch to workspace 6",
    cat: "global",
    icon: "papirus:actions/view-grid",
  },
  {
    id: "tiling.focusWorkspace7",
    defaultKeys: ["Alt", "7"],
    desc: "Switch to workspace 7",
    cat: "global",
    icon: "papirus:actions/view-grid",
  },
  {
    id: "tiling.focusWorkspace8",
    defaultKeys: ["Alt", "8"],
    desc: "Switch to workspace 8",
    cat: "global",
    icon: "papirus:actions/view-grid",
  },
  {
    id: "tiling.focusWorkspace9",
    defaultKeys: ["Alt", "9"],
    desc: "Switch to workspace 9",
    cat: "global",
    icon: "papirus:actions/view-grid",
  },
  {
    id: "global.nextWallpaper",
    defaultKeys: ["Alt", "N"],
    desc: "Cycle to next wallpaper",
    cat: "global",
    icon: "papirus:mimetypes/image-x-generic",
  },
  {
    id: "global.launchBrowser",
    defaultKeys: ["Alt", "F"],
    desc: "Open Yuki Browser",
    cat: "global",
    icon: "papirus:apps/internet-web-browser",
  },
  {
    id: "tiling.toggleFloatingAlt",
    defaultKeys: ["Alt", "V"],
    desc: "Toggle floating/tiled mode on focused window",
    cat: "global",
    icon: "papirus:actions/window-restore",
  },
  {
    id: "tiling.logout",
    defaultKeys: ["Alt", "M"],
    desc: "Log out of session",
    cat: "global",
    icon: "papirus:actions/window-close",
  },
  {
    id: "tiling.moveToWorkspace1",
    defaultKeys: ["Alt", "Shift", "1"],
    desc: "Move active window to workspace 1",
    cat: "global",
    icon: "papirus:actions/go-next",
  },
  {
    id: "tiling.moveToWorkspace2",
    defaultKeys: ["Alt", "Shift", "2"],
    desc: "Move active window to workspace 2",
    cat: "global",
    icon: "papirus:actions/go-next",
  },
  {
    id: "tiling.moveToWorkspace3",
    defaultKeys: ["Alt", "Shift", "3"],
    desc: "Move active window to workspace 3",
    cat: "global",
    icon: "papirus:actions/go-next",
  },
  {
    id: "tiling.moveToWorkspace4",
    defaultKeys: ["Alt", "Shift", "4"],
    desc: "Move active window to workspace 4",
    cat: "global",
    icon: "papirus:actions/go-next",
  },
  {
    id: "tiling.moveToWorkspace5",
    defaultKeys: ["Alt", "Shift", "5"],
    desc: "Move active window to workspace 5",
    cat: "global",
    icon: "papirus:actions/go-next",
  },
  {
    id: "tiling.moveToWorkspace6",
    defaultKeys: ["Alt", "Shift", "6"],
    desc: "Move active window to workspace 6",
    cat: "global",
    icon: "papirus:actions/go-next",
  },
  {
    id: "tiling.moveToWorkspace7",
    defaultKeys: ["Alt", "Shift", "7"],
    desc: "Move active window to workspace 7",
    cat: "global",
    icon: "papirus:actions/go-next",
  },
  {
    id: "tiling.moveToWorkspace8",
    defaultKeys: ["Alt", "Shift", "8"],
    desc: "Move active window to workspace 8",
    cat: "global",
    icon: "papirus:actions/go-next",
  },
  {
    id: "tiling.moveToWorkspace9",
    defaultKeys: ["Alt", "Shift", "9"],
    desc: "Move active window to workspace 9",
    cat: "global",
    icon: "papirus:actions/go-next",
  },
  {
    id: "explorer.refresh",
    defaultKeys: ["F5"],
    desc: "Refresh current directory in Explorer",
    cat: "desktop",
    icon: "papirus:actions/view-refresh",
  },
  {
    id: "explorer.search",
    defaultKeys: ["Ctrl", "F"],
    desc: "Focus search input in Explorer",
    cat: "desktop",
    icon: "papirus:actions/edit-find",
  },
  {
    id: "explorer.selectAll",
    defaultKeys: ["Ctrl", "A"],
    desc: "Select all items in Explorer",
    cat: "desktop",
    icon: "papirus:actions/object-group",
  },
  {
    id: "desktop.selectAll",
    defaultKeys: ["Ctrl", "A"],
    desc: "Select all icons on the desktop",
    cat: "desktop",
    icon: "papirus:actions/object-group",
  },
  {
    id: "desktop.physicsChaos",
    defaultKeys: ["Alt", "G"],
    desc: "Toggle desktop physics chaos",
    cat: "desktop",
    icon: "fa-burst",
  },
  {
    id: "explorer.navigateUp",
    defaultKeys: ["ArrowUp"],
    desc: "Navigate up in Explorer file list",
    cat: "desktop",
    icon: "papirus:actions/go-up",
    hidden: true,
  },
  {
    id: "explorer.navigateDown",
    defaultKeys: ["ArrowDown"],
    desc: "Navigate down in Explorer file list",
    cat: "desktop",
    icon: "papirus:actions/go-down",
    hidden: true,
  },
  {
    id: "explorer.deleteItem",
    defaultKeys: ["Delete"],
    desc: "Delete selected file in Explorer",
    cat: "desktop",
    icon: "papirus:actions/entry-delete",
    hidden: true,
  },
  {
    id: "explorer.rename",
    defaultKeys: ["F2"],
    desc: "Rename selected file in Explorer",
    cat: "desktop",
    icon: "papirus:actions/edit",
  },
  {
    id: "explorer.closeTab",
    defaultKeys: ["Alt", "W"],
    desc: "Close active tab in Explorer",
    cat: "desktop",
    icon: "fa-times",
  },
  {
    id: "explorer.toggleSplit",
    defaultKeys: ["Ctrl", "Shift", "D"],
    desc: "Toggle split view in Explorer",
    cat: "desktop",
    icon: "fa-columns",
  },
  {
    id: "explorer.tab1",
    defaultKeys: ["Alt", "1"],
    desc: "Switch to Explorer tab 1",
    cat: "desktop",
    icon: "fa-clone",
  },
  {
    id: "explorer.tab2",
    defaultKeys: ["Alt", "2"],
    desc: "Switch to Explorer tab 2",
    cat: "desktop",
    icon: "fa-clone",
  },
  {
    id: "explorer.tab3",
    defaultKeys: ["Alt", "3"],
    desc: "Switch to Explorer tab 3",
    cat: "desktop",
    icon: "fa-clone",
  },
  {
    id: "explorer.tab4",
    defaultKeys: ["Alt", "4"],
    desc: "Switch to Explorer tab 4",
    cat: "desktop",
    icon: "fa-clone",
  },
  {
    id: "explorer.tab5",
    defaultKeys: ["Alt", "5"],
    desc: "Switch to Explorer tab 5",
    cat: "desktop",
    icon: "fa-clone",
  },
  {
    id: "explorer.tab6",
    defaultKeys: ["Alt", "6"],
    desc: "Switch to Explorer tab 6",
    cat: "desktop",
    icon: "fa-clone",
  },
  {
    id: "explorer.tab7",
    defaultKeys: ["Alt", "7"],
    desc: "Switch to Explorer tab 7",
    cat: "desktop",
    icon: "fa-clone",
  },
  {
    id: "explorer.tab8",
    defaultKeys: ["Alt", "8"],
    desc: "Switch to Explorer tab 8",
    cat: "desktop",
    icon: "fa-clone",
  },
  {
    id: "explorer.tab9",
    defaultKeys: ["Alt", "9"],
    desc: "Switch to Explorer tab 9",
    cat: "desktop",
    icon: "fa-clone",
  },
  {
    id: "calendar.prevYear",
    defaultKeys: ["ArrowUp"],
    desc: "Navigate to previous year in Calendar",
    cat: "calendar",
    icon: "papirus:actions/go-up",
    hidden: true,
  },
  {
    id: "calendar.nextYear",
    defaultKeys: ["ArrowDown"],
    desc: "Navigate to next year in Calendar",
    cat: "calendar",
    icon: "papirus:actions/go-down",
    hidden: true,
  },
  {
    id: "selectMenu.close",
    defaultKeys: ["Escape"],
    desc: "Close select dropdown",
    cat: "global",
    icon: "papirus:actions/window-close",
    hidden: true,
  },
  {
    id: "selectMenu.navigateDown",
    defaultKeys: ["ArrowDown"],
    desc: "Navigate to next option in select dropdown",
    cat: "global",
    icon: "papirus:actions/go-down",
    hidden: true,
  },
  {
    id: "selectMenu.navigateUp",
    defaultKeys: ["ArrowUp"],
    desc: "Navigate to previous option in select dropdown",
    cat: "global",
    icon: "papirus:actions/go-up",
    hidden: true,
  },
  {
    id: "selectMenu.select",
    defaultKeys: ["Enter"],
    desc: "Select highlighted option in dropdown",
    cat: "global",
    icon: "papirus:actions/object-select",
    hidden: true,
  },
  {
    id: "rangeSlider.increment",
    defaultKeys: ["ArrowRight"],
    desc: "Increment range slider value",
    cat: "global",
    icon: "papirus:actions/list-add",
    hidden: true,
  },
  {
    id: "rangeSlider.decrement",
    defaultKeys: ["ArrowLeft"],
    desc: "Decrement range slider value",
    cat: "global",
    icon: "papirus:actions/list-remove",
    hidden: true,
  },
  {
    id: "rangeSlider.max",
    defaultKeys: ["End"],
    desc: "Set range slider to maximum value",
    cat: "global",
    icon: "papirus:actions/go-next",
    hidden: true,
  },
  {
    id: "rangeSlider.min",
    defaultKeys: ["Home"],
    desc: "Set range slider to minimum value",
    cat: "global",
    icon: "papirus:apps/application-default-icon",
    hidden: true,
  },

  {
    id: "global.launchpad",
    defaultKeys: ["F4"],
    desc: "Open Launchpad app grid",
    cat: "global",
    icon: "papirus:actions/view-grid",
  },
  {
    id: "mac.about",
    defaultKeys: ["Meta", ","],
    desc: "Open About YukiOS",
    cat: "mac",
    icon: "papirus:actions/help-about",
    hidden: true,
  },
  {
    id: "mac.settings",
    defaultKeys: ["Meta", "Shift", ","],
    desc: "Open Settings",
    cat: "mac",
    icon: "papirus:actions/configure",
    hidden: true,
  },
  {
    id: "mac.commandPalette",
    defaultKeys: ["Meta", "Shift", "P"],
    desc: "Open Command Palette",
    cat: "mac",
    icon: "papirus:actions/edit-find",
    hidden: true,
  },
  {
    id: "mac.hideOthers",
    defaultKeys: ["Alt", "Meta", "H"],
    desc: "Hide other windows",
    cat: "mac",
    icon: "papirus:actions/view-hidden",
    hidden: true,
  },
  {
    id: "mac.lock",
    defaultKeys: ["Meta", "Control", "Q"],
    desc: "Lock screen",
    cat: "mac",
    icon: "papirus:actions/object-locked",
    hidden: true,
  },
  {
    id: "mac.logout",
    defaultKeys: ["Meta", "Shift", "Q"],
    desc: "Log out",
    cat: "mac",
    icon: "papirus:actions/system-log-out",
    hidden: true,
  },
  {
    id: "mac.newWindow",
    defaultKeys: ["Meta", "N"],
    desc: "New window",
    cat: "mac",
    icon: "papirus:actions/list-add",
    hidden: true,
  },
  {
    id: "mac.closeWindow",
    defaultKeys: ["Meta", "W"],
    desc: "Close window",
    cat: "mac",
    icon: "papirus:actions/window-close",
    hidden: true,
  },
  {
    id: "mac.minimize",
    defaultKeys: ["Meta", "M"],
    desc: "Minimize window",
    cat: "mac",
    icon: "papirus:actions/window-minimize",
    hidden: true,
  },
  {
    id: "mac.fullscreen",
    defaultKeys: ["Meta", "Control", "F"],
    desc: "Toggle fullscreen",
    cat: "mac",
    icon: "papirus:actions/view-fullscreen",
    hidden: true,
  },
  {
    id: "mac.emoji",
    defaultKeys: ["Meta", "Control", "Space"],
    desc: "Open emoji picker",
    cat: "mac",
    icon: "papirus:emotes/face-smile",
    hidden: true,
  },
  {
    id: "mac.guide",
    defaultKeys: ["Meta", "Shift", "/"],
    desc: "Open YukiOS Guide",
    cat: "mac",
    icon: "papirus:apps/accessories-dictionary",
    hidden: true,
  },
  {
    id: "mac.shortcuts",
    defaultKeys: ["Meta", "Shift", "K"],
    desc: "Open Keyboard Shortcuts",
    cat: "mac",
    icon: "papirus:devices/input-keyboard",
    hidden: true,
  },
  {
    id: "mac.screenshot",
    defaultKeys: ["Meta", "Shift", "4"],
    desc: "Take screenshot",
    cat: "mac",
    icon: "papirus:apps/accessories-camera",
    hidden: true,
  },
  {
    id: "mac.goHome",
    defaultKeys: ["Meta", "Shift", "H"],
    desc: "Go to Home folder",
    cat: "mac",
    icon: "papirus:places/user-home",
    hidden: true,
  },
  {
    id: "mac.goDesktop",
    defaultKeys: ["Meta", "Shift", "D"],
    desc: "Go to Desktop",
    cat: "mac",
    icon: "papirus:devices/computer",
    hidden: true,
  },
  {
    id: "mac.goDocuments",
    defaultKeys: ["Meta", "Shift", "O"],
    desc: "Go to Documents",
    cat: "mac",
    icon: "papirus:mimetypes/text-x-generic",
    hidden: true,
  },
  {
    id: "mac.goDownloads",
    defaultKeys: ["Meta", "Shift", "L"],
    desc: "Go to Downloads",
    cat: "mac",
    icon: "papirus:actions/edit-download",
    hidden: true,
  },
  {
    id: "mac.goFolder",
    defaultKeys: ["Meta", "Shift", "G"],
    desc: "Go to Folder",
    cat: "mac",
    icon: "papirus:places/folder-blue",
    hidden: true,
  },
  {
    id: "dock.launch1",
    defaultKeys: ["Alt", "1"],
    desc: "Launch or focus dock item 1",
    cat: "dock",
    icon: "papirus:apps/rocketchat",
  },
  {
    id: "dock.launch2",
    defaultKeys: ["Alt", "2"],
    desc: "Launch or focus dock item 2",
    cat: "dock",
    icon: "papirus:apps/rocketchat",
  },
  {
    id: "dock.launch3",
    defaultKeys: ["Alt", "3"],
    desc: "Launch or focus dock item 3",
    cat: "dock",
    icon: "papirus:apps/rocketchat",
  },
  {
    id: "dock.launch4",
    defaultKeys: ["Alt", "4"],
    desc: "Launch or focus dock item 4",
    cat: "dock",
    icon: "papirus:apps/rocketchat",
  },
  {
    id: "dock.launch5",
    defaultKeys: ["Alt", "5"],
    desc: "Launch or focus dock item 5",
    cat: "dock",
    icon: "papirus:apps/rocketchat",
  },
  {
    id: "dock.launch6",
    defaultKeys: ["Alt", "6"],
    desc: "Launch or focus dock item 6",
    cat: "dock",
    icon: "papirus:apps/rocketchat",
  },
  {
    id: "dock.launch7",
    defaultKeys: ["Alt", "7"],
    desc: "Launch or focus dock item 7",
    cat: "dock",
    icon: "papirus:apps/rocketchat",
  },
  {
    id: "dock.launch8",
    defaultKeys: ["Alt", "8"],
    desc: "Launch or focus dock item 8",
    cat: "dock",
    icon: "papirus:apps/rocketchat",
  },
  {
    id: "dock.launch9",
    defaultKeys: ["Alt", "9"],
    desc: "Launch or focus dock item 9",
    cat: "dock",
    icon: "papirus:apps/rocketchat",
  },
  {
    id: "global.magnifier",
    defaultKeys: ["Ctrl", "M"],
    desc: "Toggle screen magnifier",
    cat: "global",
    icon: "papirus:actions/zoom-in",
  },
  {
    id: "dock.launch10",
    defaultKeys: ["Alt", "0"],
    desc: "Launch or focus dock item 10",
    cat: "dock",
    icon: "papirus:apps/rocketchat",
  },
  {
    id: "steamdeck.openQuickAccess",
    defaultKeys: ["Ctrl", "Shift", "Q"],
    desc: "Open Yuki Deck Quick Access panel",
    cat: "steamdeck",
    icon: "papirus:status/battery-020",
  },
  {
    id: "steamdeck.home",
    defaultKeys: ["Ctrl", "Shift", "H"],
    desc: "Return to Yuki Deck Home",
    cat: "steamdeck",
    icon: "papirus:actions/go-home",
  },
  {
    id: "steamdeck.moveUp",
    defaultKeys: ["ArrowUp"],
    desc: "Move focus up in Yuki Deck",
    cat: "steamdeck",
    icon: "papirus:actions/go-up",
  },
  {
    id: "steamdeck.moveDown",
    defaultKeys: ["ArrowDown"],
    desc: "Move focus down in Yuki Deck",
    cat: "steamdeck",
    icon: "papirus:actions/go-down",
  },
  {
    id: "steamdeck.moveLeft",
    defaultKeys: ["ArrowLeft"],
    desc: "Move focus left in Yuki Deck",
    cat: "steamdeck",
    icon: "papirus:actions/go-previous",
  },
  {
    id: "steamdeck.moveRight",
    defaultKeys: ["ArrowRight"],
    desc: "Move focus right in Yuki Deck",
    cat: "steamdeck",
    icon: "papirus:actions/go-next",
  },
  {
    id: "steamdeck.confirm",
    defaultKeys: ["Enter"],
    desc: "Confirm selection in Yuki Deck",
    cat: "steamdeck",
    icon: "papirus:actions/object-select",
  },
  {
    id: "steamdeck.back",
    defaultKeys: ["Escape"],
    desc: "Go back in Yuki Deck",
    cat: "steamdeck",
    icon: "papirus:actions/go-previous",
  },
];

export class KeybindManager {
  static customizations = null;

  static ensureLoaded() {
    if (this.customizations === null) {
      try {
        const saved = os.storage.get(StorageKeys.keybindCustomizations);
        this.customizations = saved ? JSON.parse(saved) : {};
      } catch {
        this.customizations = {};
      }
    }
  }

  static save() {
    os.storage.set(
      StorageKeys.keybindCustomizations,
      JSON.stringify(this.customizations),
    );
  }

  static getAll() {
    this.ensureLoaded();
    this.ensureCustomActionsLoaded();
    const builtin = KEYBIND_DEFINITIONS.filter((def) => !def.hidden).map(
      (def) => ({
        ...def,
        currentKeys: this.customizations[def.id] || def.defaultKeys,
      }),
    );
    const custom = Object.values(this.customActions).map((def) => ({
      ...def,
      cat: "custom",
      currentKeys: this.customizations[def.id] || def.defaultKeys,
    }));
    return [...builtin, ...custom];
  }

  static getById(id) {
    this.ensureLoaded();
    this.ensureCustomActionsLoaded();
    const def = KEYBIND_DEFINITIONS.find((d) => d.id === id);
    if (def) {
      return {
        ...def,
        currentKeys: this.customizations[id] || def.defaultKeys,
      };
    }
    const custom = this.customActions[id];
    if (custom) {
      return {
        ...custom,
        cat: "custom",
        currentKeys: this.customizations[id] || custom.defaultKeys,
      };
    }
    return null;
  }

  static getCurrentKeys(id) {
    this.ensureLoaded();
    this.ensureCustomActionsLoaded();
    const def = KEYBIND_DEFINITIONS.find((d) => d.id === id);
    if (def) return this.customizations[id] || def.defaultKeys;
    const custom = this.customActions[id];
    if (custom) return this.customizations[id] || custom.defaultKeys;
    return null;
  }

  static setKeys(id, keys) {
    this.ensureLoaded();
    this.ensureCustomActionsLoaded();
    const def = KEYBIND_DEFINITIONS.find((d) => d.id === id);
    const custom = this.customActions[id];
    if (!def && !custom) return false;
    this.customizations[id] = keys;
    this.save();
    return true;
  }

  static reset(id) {
    this.ensureLoaded();
    delete this.customizations[id];
    this.save();
  }

  static resetAll() {
    this.ensureLoaded();
    this.customizations = {};
    this.save();
  }

  static deleteCustomAction(id) {
    this.ensureCustomActionsLoaded();
    if (!this.customActions[id]) return false;
    delete this.customActions[id];
    delete this.customizations[id];
    this.saveCustomActions();
    this.save();
    if (Object.keys(this.customActions).length === 0) {
      this.destroyCustomHandler();
    }
    return true;
  }

  static isCustomized(id) {
    this.ensureLoaded();
    return id in this.customizations;
  }

  static getCustomizedCount() {
    this.ensureLoaded();
    return Object.keys(this.customizations).length;
  }

  static customActions = null;
  static customHandlerInstalled = false;
  static customHandlerFn = null;

  static ensureCustomActionsLoaded() {
    if (this.customActions === null) {
      try {
        const saved = os.storage.get(StorageKeys.keybindCustomActions);
        this.customActions = saved || {};
      } catch {
        this.customActions = {};
      }
    }
  }

  static saveCustomActions() {
    os.storage.set(StorageKeys.keybindCustomActions, this.customActions);
  }

  static getAllCustomActions() {
    this.ensureCustomActionsLoaded();
    return Object.values(this.customActions);
  }

  static getCustomAction(id) {
    this.ensureCustomActionsLoaded();
    return this.customActions[id] || null;
  }

  static saveCustomAction(definition) {
    this.ensureCustomActionsLoaded();
    if (!definition.id) {
      definition.id =
        "custom_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);
    }
    definition.cat = "custom";
    if (!definition.icon) definition.icon = "papirus:actions/bookmark-new";
    if (!definition.defaultKeys) definition.defaultKeys = [];
    this.customActions[definition.id] = definition;
    this.saveCustomActions();
    this.installCustomHandler();
    return definition.id;
  }

  static executeCustomAction(id) {
    this.ensureCustomActionsLoaded();
    const action = this.customActions[id];
    if (!action || !action.action) return;

    const { type, config } = action.action;
    if (!type || !config) return;

    try {
      switch (type) {
        case "launchApp":
          if (config.appId) {
            os.app.launch(config.appId).catch(() => {});
          }
          break;
        case "openUrl":
          if (config.url) {
            window.open(config.url, "blank");
          }
          break;
        case "runCode":
          if (config.code) {
            const fn = new Function("os", config.code);
            fn(os);
          }
          break;
        case "notify":
          if (config.title) {
            os.notify.send(config.title, config.message || "", {
              icon: action.icon || "papirus:actions/bookmark-new",
            });
          }
          break;
      }
    } catch (e) {
      console.error("[KeybindManager] Custom action error:", e);
    }
  }

  static installCustomHandler() {
    if (this.customHandlerInstalled) return;
    this.customHandlerInstalled = true;
    this.customHandlerFn = (e) => {
      if (!this.customActions) this.ensureCustomActionsLoaded();
      for (const id of Object.keys(this.customActions)) {
        if (this.matches(e, id)) {
          e.preventDefault();
          this.executeCustomAction(id);
          return;
        }
      }
    };
    document.addEventListener("keydown", this.customHandlerFn);
  }

  static destroyCustomHandler() {
    if (this.customHandlerFn) {
      document.removeEventListener("keydown", this.customHandlerFn);
    }
    this.customHandlerInstalled = false;
    this.customHandlerFn = null;
  }

  static matches(event, id) {
    const keys = this.getCurrentKeys(id);
    if (!keys) return false;
    return this.eventMatchesKeys(event, keys);
  }

  static eventMatchesKeys(event, keys) {
    const modifiers = { ctrl: false, shift: false, alt: false, meta: false };
    let targetKey = null;

    for (const k of keys) {
      const lower = k.toLowerCase();
      if (MODIFIER_ALIASES.ctrl.includes(lower)) {
        modifiers.ctrl = true;
      } else if (MODIFIER_ALIASES.shift.includes(lower)) {
        modifiers.shift = true;
      } else if (MODIFIER_ALIASES.alt.includes(lower)) {
        modifiers.alt = true;
      } else if (MODIFIER_ALIASES.meta.includes(lower)) {
        modifiers.meta = true;
      } else {
        targetKey = k;
      }
    }

    if (targetKey === "Right Click") return false;

    if (event.ctrlKey !== modifiers.ctrl) return false;
    if (event.shiftKey !== modifiers.shift) return false;
    if (event.altKey !== modifiers.alt) return false;
    if (event.metaKey !== modifiers.meta) return false;

    if (!targetKey) return false;

    const eventKey = event.key;
    const eventLower = eventKey.toLowerCase();
    const targetLower = targetKey.toLowerCase();

    if (eventLower === targetLower) return true;

    if (
      targetLower === "space" &&
      (eventKey === " " || eventLower === "spacebar")
    )
      return true;
    if (
      targetLower === "spacebar" &&
      (eventKey === " " || eventLower === "space")
    )
      return true;
    if (
      targetLower === "arrowleft" &&
      (eventKey === "ArrowLeft" || eventKey === "←")
    )
      return true;
    if (
      targetLower === "arrowright" &&
      (eventKey === "ArrowRight" || eventKey === "→")
    )
      return true;
    if (
      targetLower === "arrowup" &&
      (eventKey === "ArrowUp" || eventKey === "↑")
    )
      return true;
    if (
      targetLower === "arrowdown" &&
      (eventKey === "ArrowDown" || eventKey === "↓")
    )
      return true;

    return false;
  }

  static keysMatch(keysA, keysB) {
    if (keysA.length !== keysB.length) return false;
    const normalize = (k) => {
      const lower = k.toLowerCase().trim();
      if (MODIFIER_ALIASES.ctrl.includes(lower)) return "ctrl";
      if (MODIFIER_ALIASES.shift.includes(lower)) return "shift";
      if (MODIFIER_ALIASES.alt.includes(lower)) return "alt";
      if (MODIFIER_ALIASES.meta.includes(lower)) return "meta";
      return lower;
    };
    const aNorm = keysA.map(normalize).sort();
    const bNorm = keysB.map(normalize).sort();
    return aNorm.every((v, i) => v === bNorm[i]);
  }

  static isCustomizationValid(keys) {
    if (!keys || !Array.isArray(keys) || keys.length === 0) return false;
    const nonModifiers = keys.filter((k) => {
      const lower = k.toLowerCase();
      return (
        !MODIFIER_ALIASES.ctrl.includes(lower) &&
        !MODIFIER_ALIASES.shift.includes(lower) &&
        !MODIFIER_ALIASES.alt.includes(lower) &&
        !MODIFIER_ALIASES.meta.includes(lower)
      );
    });
    return nonModifiers.length === 1;
  }
}
