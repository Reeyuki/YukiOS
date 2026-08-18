export const ServiceKeys = {
  EXPLORER: "explorerApp",
  NOTEPAD: "notepadApp",
  MARKDOWN: "markdownApp",
  BROWSER: "browserApp",
  OFFICE: "officeApp",
  JSDOS: "jsDosApp",
  RUFFLE: "ruffleApp",
  EMULATOR: "emulatorApp",
  V86: "v86app",
  MONACO: "monacoApp",
  TERMINAL: "terminalApp",
  SCREENSHOT: "screenshotApp",
  ACHIEVEMENTS: "achievementsApp",
  COMMAND_PALETTE: "commandPalette",
  SESSION_MANAGER: "sessionManager",
  ROOM3D: "room3dApp",
  SETUP: "setupApp",
  REMOTE_HOST: "remoteHostApp",
  CLIPBOARD_MANAGER: "clipboardManagerApp",
  DESKTOP_UI: "desktopUI"
};

/**
 * @typedef {import("./apps/explorer.js").ExplorerApp} ExplorerApp
 * @typedef {import("./apps/notepad.js").NotepadApp} NotepadApp
 * @typedef {import("./apps/markdown.js").MarkdownApp} MarkdownApp
 * @typedef {import("./apps/browser.js").BrowserApp} BrowserApp
 * @typedef {import("./office/officeLoader.js").OfficeAppProxy} OfficeAppProxy
 * @typedef {import("./apps/jsdos.js").JsDosApp} JsDosApp
 * @typedef {import("./apps/ruffle.js").RuffleApp} RuffleApp
 * @typedef {import("./apps/emulator.js").EmulatorApp} EmulatorApp
 * @typedef {import("./apps/v86.js").V86App} V86App
 * @typedef {import("./apps/monaco.js").MonacoApp} MonacoApp
 * @typedef {import("./apps/terminal.js").TerminalApp} TerminalApp
 * @typedef {import("./apps/screenshot.js").ScreenshotApp} ScreenshotApp
 * @typedef {import("./achievements.js").AchievementsApp} AchievementsApp
 * @typedef {import("./commandPalette.js").CommandPalette} CommandPalette
 * @typedef {import("./SessionManager.js").SessionManager} SessionManager
 * @typedef {import("./apps/room3d.js").Room3DApp} Room3DApp
 * @typedef {import("./apps/setupApp.js").SetupApp} SetupApp
 * @typedef {import("./apps/RemoteHostApp.js").RemoteHostApp} RemoteHostApp
 * @typedef {import("./apps/clipboardApp.js").ClipboardManagerApp} ClipboardManagerApp
 * @typedef {import("./desktopui/desktopui.js").DesktopUI} DesktopUI
 */

/**
 * @typedef {Object} ServiceTypeMap
 * @property {ExplorerApp} explorerApp
 * @property {NotepadApp} notepadApp
 * @property {MarkdownApp} markdownApp
 * @property {BrowserApp} browserApp
 * @property {OfficeAppProxy} officeApp
 * @property {JsDosApp} jsDosApp
 * @property {RuffleApp} ruffleApp
 * @property {EmulatorApp} emulatorApp
 * @property {V86App} v86app
 * @property {MonacoApp} monacoApp
 * @property {TerminalApp} terminalApp
 * @property {ScreenshotApp} screenshotApp
 * @property {AchievementsApp} achievementsApp
 * @property {CommandPalette} commandPalette
 * @property {SessionManager} sessionManager
 * @property {Room3DApp} room3dApp
 * @property {SetupApp} setupApp
 * @property {RemoteHostApp} remoteHostApp
 * @property {ClipboardManagerApp} clipboardManagerApp
 * @property {DesktopUI} desktopUI
 */
