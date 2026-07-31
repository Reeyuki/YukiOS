# YukiOS - Agent Reference

You are working under webos-desktop directory. when src is mentioned it means webos-desktop/

## Hard Rules

- Never commit or push (git commit, git push, git add) unless explicitly asked
- Never run `npm/pnpm format` or `npm/pnpm bf`
- Never add comments — anywhere. Not in JS, not in HTML, not in CSS. Not even section dividers like `/* ---- Nav ---- */`. The existing codebase may have them, but you must not add new ones. Zero exceptions. JSDoc-style doc comments are only allowed for complex functions with non-obvious signatures.
- Never spawn a browser for testing
- Before finalizing any code changes, run `pnpm build:dev` in `webos-desktop/`. A change that breaks the build is
  incomplete.
- Always use CSS variables from `src/styles/style.css`. Never hardcode colors.
- When making significant changes, new features, or new apps: you must register them in src/news.js with an icon, title,
  and a punchy, active-voice description under 15 words. Bad: 'First-time setup now includes a dedicated profile
  step...' Good: 'Choose your nickname and avatar during setup, with a quick final preview!'. it should not have
  punchlines or seperating sentences with "—" or "-"
- When adding a new app, add a `description` field to its manifest entry in `src/registry/AppManifest.js`
- Always use StorageKeys from `src/StorageKeys.js` for localStorage access. Never hardcode localStorage key strings.
- Always use `src/framework.js` barrel for app-level imports. When writing a new app, import
  `{ BaseApp, PersistenceTypes, os, StorageKeys, APP_MANIFESTS }` from `"../framework.js"` instead of separate modules.
  Import StorageKeys and use the defined constants. If a new key is needed, add it to StorageKeys.js first.
- Never use this.wm.\*, always use os.window module for window operations
- Always use `os.storage` API instead of bare `localStorage`; the storage module handles serialization/deserialization
  automatically.
- Never use browser native alerts, prompts, or confirms (alert(), prompt(), confirm()). Always use the OS-level dialog
  API (`os.dialog`) instead. Use `os.dialog.alert(title, message)`, `os.dialog.confirm(title, message)`, or
  `os.dialog.prompt(title, message, defaultValue?)`. For file selection, use `os.dialog.fileOpen()` or
  `os.dialog.fileSave()`.
- Never use `document.querySelector`, `document.querySelectorAll`, or direct DOM manipulation methods. Always use the
  utility functions from `src/shared/domUtils.js` instead. Import and use `$` (querySelector), `$$` (querySelectorAll),
  `bindEvent`, `toggleClass`, `setText`, `setHTML`, `createElement`, etc. For general utility functions, use
  `src/utils/utils.js` (e.g., `formatSize`, `isImageFile`, `isTextFile`, `pluralize`).
- Use os.notify.send() for discrete, user-facing application events that represent a state change or completion, and
  ensure notifications are not emitted from high-frequency, repeating, or continuously-updating processes.
- If a change introduces a new system, abstraction, manager, API surface, or reusable capability, create a new file and
  integrate it via imports. Only modify existing files if the change is a direct refinement of existing logic without
  introducing a new responsibility boundary.
- Always use `KeybindManager` from `src/keybindManager.js` for keyboard shortcuts instead of raw `keydown` listeners
  with hardcoded key checks. Use `KeybindManager.matches(event, id)` to check key combinations and register new keybinds
  in `KEYBIND_DEFINITIONS` inside that file. Never define key combos inline in event handlers.
- If user asks you to create a new app, read DEVELOPMENT.md to learn how to create a new app.
- Never use grep, instead always use rg (ripgrep)
- Never use variable or function names (or any naming convention) starting with `_` (underscore). All identifiers must
  use descriptive names without leading underscores.
- When applying changes to multiple files (2+ files), you MUST launch multiple concurrent Task sub-agents in a SINGLE
  message (one `task` tool call per sub-agent). Each sub-agent handles a SPECIFIC, NON-OVERLAPPING set of files. Never
  batch all files into one sub-agent. Never edit multiple files sequentially in your own context. Each sub-agent prompt
  must enumerate exactly which files it should edit and what changes to make. Group files by ownership/subsystem to
  avoid two agents editing the same file. Example: for a 12-file change, launch 4 sub-agents of 3 files each, not 1
  sub-agent with all 12 files.

---

## Code Quality Guidelines

Write modular, clean, and DRY code. Follow these principles:

- **Modularity**: Separate concerns into focused modules. Each file should have a single, clear responsibility. Avoid
  monolithic files that handle multiple unrelated concerns.
- **Single Responsibility**: Functions and classes should do one thing well. If a function does more than one thing,
  split it into smaller, focused functions.
- **DRY (Don't Repeat Yourself)**: Never duplicate logic. Use shared utilities from `src/shared/` instead of
  reimplementing common functionality. If you find yourself writing the same code in multiple places, extract it into a
  reusable function.
- **Prefer Existing Utilities**: Before writing new utility functions, check `src/shared/` for existing helpers. Common
  patterns like dialogs, asset resolution, and platform detection already have implementations.
- **Clean Function Names**: Use descriptive, action-oriented function names. `installApp()` is better than `doIt()`.
  `validateUrl()` is better than `check()`.
- **Avoid Deep Nesting**: More than 3 levels of nesting indicates a need for refactoring. Use early returns and guard
  clauses to reduce nesting.
- **Keep Functions Small**: Functions should fit on a screen (typically < 50 lines). If a function is longer, consider
  splitting it into smaller helper functions.
- **Use Meaningful Variables**: Variable names should reveal intent. `userList` is better than `data`. `isValid` is
  better than `flag`.
- **Avoid Magic Numbers/Strings**: Extract constants to the top of the file or a constants file. Use CSS variables for
  styling values.
- **Consistent Patterns**: Follow existing patterns in the codebase. If similar apps use a certain structure, follow
  that structure for new apps.
- **Enforce KISS and YAGNI:** Write the absolute minimum code required to make current tests pass; do not build abstract
  factories, extra interfaces, or future-proof scaffolding for features that are not explicitly requested in the prompt.

---

## Styling System

YukiOS uses a dark glassmorphism theme with a comprehensive theming system. All rules below are non-negotiable.

- **CSS Variables**: Use `--brand` (accent), `--text-primary`, `--text-secondary`, `--bg-primary`, `--bg-secondary`,
  `--glass`, `--glass-border`, `--error`. Never introduce new hues or hardcoded values.
- **Color Hue**: All colors use unified hue 265 (purple). Never mix in gray or blue hues.
- **Glassmorphism**: `backdrop-filter: blur(32px+)`, semi-transparent `rgba` backgrounds (0.6–0.98 opacity), subtle
  borders (`rgba(255,255,255,0.08–0.12)`).
- **Depth**: Multi-layer box shadows - `0 24px 64px rgba(0,0,0,0.65)` + inset highlight.
- **Typography**: System fonts or JetBrains Mono for code. 13–16px base (minimum 12px for any readable text). Opacity
  0.7–0.9 for secondary text. Never use font-size below 12px for user-facing content unless absolutely necessary (e.g.,
  badges, timestamps).
- **Radius**: 6–14px depending on element size.
- **Transitions**: 0.1–0.2s for hover states.
- **Light Theme**: Override via `html[data-theme="light"]` with solid colors (`#fff`, `#f0f0f0`, `#111`, `#666`).
- **Scrollbars**: 8px width, `rgba(255,255,255,0.12)` thumb.
- **Checkboxes/Inputs**: Never use native browser checkboxes, plain inputs, or dropdowns. Always use `appearance: none`,
  @src/shared/selectMenu.js, and @src/shared/rangeSlider.js component. `-webkit-appearance: none`, custom
  border/background, and `::after` pseudo-element for checkmarks via CSS variables.
- **Theming System**: Comprehensive theme engine with 25+ built-in themes, transparent UI toggle, advanced brightness
  controls, and GUI scale options. Themes are managed via `settings.js` and applied through CSS variables.
- Never introduce new inline styles.
- Prefer CSS classes.
- Existing inline styles may be migrated to css classes when touched.
- New declarative UI definitions should use class names instead of style objects.

## File Size Guidelines

Target maximums:

- Utility modules: <300 lines
- Runtime modules: <500 lines
- Apps: <1000 lines

When a file exceeds these sizes:

- Prefer extracting focused modules.
- Prefer composition over adding more methods.
- New features should be added to extracted modules when possible.

## Do not increase file size when a clean extraction is feasible.

## Architecture

```
main.js initializes services
    ↓
Services Container (WindowManager, FileSystemManager, NotificationCenter, EventBus)
    ↓
40+ Applications (all inherit BaseApp, receive injected services)
    ↓
Desktop UI renders windows, taskbar, start menu
```

**App lifecycle:**

1. **Definition** - App class created in `src/apps/`
2. **Registration** - App added to `APP_DEFINITIONS` in `AppLoader.js` and metadata to `APP_MANIFESTS` in
   `src/registry/AppManifest.js`
3. **Instantiation** - `loadApps(services)` in `main.js` instantiates all registered apps and attaches to `services`
   object
4. **Launch** - `AppLauncher.launch(appId)` dispatches
5. **Open** - `app.open()` creates window via `WindowManager`
6. **Close** - `onClose(winId)` cleanup hook called

---

## OS Bridge API

The OS Bridge provides a unified API surface for applications to interact with system services. Instead of directly
accessing kernel services (WindowManager, FileSystemManager, NotificationCenter, EventBus, TrayManager, AppLauncher),
apps should use the `os.*` bridge.

**Import:**

```javascript
import { os } from "./os/index.js";
```

### Window API - `os.window`

| Method                                      | Purpose                                     |
| ------------------------------------------- | ------------------------------------------- |
| `create(id, title, width, height, options)` | Create styled window element                |
| `close(win)`                                | Close window, cleanup, remove taskbar entry |
| `focus(win)`                                | Raise z-index, focus window                 |
| `minimize(win)`                             | Hide window, mark taskbar minimized         |
| `maximize(win)`                             | Expand/restore window                       |
| `bringToFront(win)`                         | Raise z-index, focus window                 |
| `addToTaskbar(winId, title, icon, color)`   | Add window to taskbar                       |
| `removeFromTaskbar(winId)`                  | Remove window from taskbar                  |
| `getWindowControls(externalUrl)`            | Get window control buttons HTML             |

### Filesystem API - `os.fs`

| Method                                                | Purpose                                                |
| ----------------------------------------------------- | ------------------------------------------------------ |
| `read(path, options)`                                 | Read file content (options: { encoding: "binary" })    |
| `write(path, content, options)`                       | Write file content (options: { encoding, kind, icon }) |
| `readdir(path)`                                       | Get directory contents                                 |
| `mkdir(path)`                                         | Create directory recursively                           |
| `delete(path, name)`                                  | Delete file or directory                               |
| `exists(path)`                                        | Check if path exists                                   |
| `copy(source, destination)`                           | Copy file/directory                                    |
| `rename(oldPath, newPath)`                            | Rename file/directory                                  |
| `isFile(path)`                                        | Check if path is a file                                |
| `getFileKind(path)`                                   | Get file kind/metadata                                 |
| `getFileIcon(path)`                                   | Get file icon path                                     |
| `writeBinaryFile(path, name, blob, kind, icon)`       | Write binary file to blob storage                      |
| `readBinaryFile(path, name)`                          | Read binary file from blob storage                     |
| `deleteBinaryFile(path, name)`                        | Delete binary file from blob storage                   |
| `renameBinaryFile(path, oldName, newName)`            | Rename binary file in blob storage                     |
| `createFile(path, name, content, kind, icon, faIcon)` | Create file                                            |
| `createFolder(path, name)`                            | Create folder                                          |
| `deleteItem(path, name)`                              | Delete item (file or folder)                           |
| `renameItem(path, oldName, newName)`                  | Rename item                                            |
| `updateFile(path, name, content, meta)`               | Update file                                            |

**Note:** Binary file methods use blob storage and require separate `name` parameter.

### Notification API - `os.notify`

| Method                          | Purpose                                                                |
| ------------------------------- | ---------------------------------------------------------------------- |
| `send(title, message, options)` | Show toast notification (options: { type, duration, icon, appSource }) |
| `clear(id)`                     | Clear specific notification by ID                                      |
| `clearAll()`                    | Clear all notifications                                                |
| `getAll()`                      | Get all notifications                                                  |
| `getCount()`                    | Get notification count                                                 |
| `setDoNotDisturb(enabled)`      | Set do-not-disturb mode                                                |
| `getDoNotDisturb()`             | Get do-not-disturb status                                              |

### Tray API - `os.tray`

| Method                                  | Purpose                                 |
| --------------------------------------- | --------------------------------------- |
| `register(winId, icon, label, options)` | Register window to system tray          |
| `unregister(winId)`                     | Remove window from system tray          |
| `updateIcon(winId, newIcon)`            | Update tray icon                        |
| `updateLabel(winId, newLabel)`          | Update tray label                       |
| `updateContextMenuItems(winId, items)`  | Update context menu items               |
| `sendToTray(winId)`                     | Hide window + taskbar → tray            |
| `restoreFromTray(winId)`                | Restore window + taskbar from tray      |
| `getTrayItems()`                        | Get Map of all tray items (raw)         |
| `getAllItems()`                         | Get array of all tray items (formatted) |
| `updateItemVisibility(winId, visible)`  | Update item visibility                  |
| `isRegistered(winId)`                   | Check if window is registered           |

## Tray Register options:

- `resident: boolean` - App stays in tray permanently (cannot be restored to window)
- `showInTray: boolean` - App shows in tray icon area
- `onClick: function` - Callback when tray icon clicked
- `onQuit: function` - Callback when app is quit from tray
- `contextMenuItems: array` - Custom context menu items (objects with label, action, icon, type)
- `priority: number` - Sorting priority (higher = more prominent)

### App API - `os.app`

| Method                              | Purpose                      |
| ----------------------------------- | ---------------------------- |
| `launch(appId, options)`            | Launch app by ID             |
| `launchGame(appId, isSwf, options)` | Launch game with SWF support |
| `close(winId)`                      | Close app by window ID       |
| `getRunningApps()`                  | Get list of running apps     |
| `getAllApps()`                      | Get all registered apps      |
| `getAppInfo(appId)`                 | Get app metadata             |
| `hasApp(appId)`                     | Check if app is registered   |
| `searchApps(query)`                 | Search apps by title         |

### Events API - `os.events`

| Method                 | Purpose                                        |
| ---------------------- | ---------------------------------------------- |
| `on(event, handler)`   | Register listener                              |
| `off(event, handler)`  | Unregister listener                            |
| `emit(event, data)`    | Fire event to all listeners                    |
| `once(event, handler)` | Register one-time listener                     |
| `clear(event)`         | Clear all listeners for an event or all events |
| `listenerCount(event)` | Get listener count for an event                |

**Standard events:** `SETTINGS_CHANGED`, `WINDOW_CREATED`, `WINDOW_FOCUSED`, `WINDOW_CLOSED`, `FILE_CHANGED`,
`SESSION_INITIALIZED`, `AI_ACTION_EXECUTED`

### Storage API - `os.storage`

| Method            | Purpose                        |
| ----------------- | ------------------------------ |
| `get(key)`        | Get value from storage         |
| `set(key, value)` | Set value in storage           |
| `remove(key)`     | Remove value from storage      |
| `clear()`         | Clear all storage              |
| `has(key)`        | Check if key exists in storage |

### Dialog API - `os.dialog`

| Method                                  | Return                    |
| --------------------------------------- | ------------------------- |
| `alert(title, message)`                 | `Promise<void>`           |
| `confirm(title, message)`               | `Promise<boolean>`        |
| `prompt(title, message, defaultValue?)` | `Promise<string \| null>` |
| `fileOpen(options?)`                    | `Promise<string \| null>` |
| `fileSave(options?)`                    | `Promise<string \| null>` |
| `openDirectory(options?)`               | `Promise<string \| null>` |

`FileDialogOptions`: `{ defaultFileName?: string; initialPath?: string }`

**Never use browser native alerts, prompts, or confirms. Always use `os.dialog.*`.**

---

## Shared Utilities - `src/shared/`

Always prefer these over reimplementing logic.

### Dialog API - `os.dialog`

| Method                                  | Return                    |
| --------------------------------------- | ------------------------- |
| `alert(title, message)`                 | `Promise<void>`           |
| `confirm(title, message)`               | `Promise<boolean>`        |
| `prompt(title, message, defaultValue?)` | `Promise<string \| null>` |
| `fileOpen(options?)`                    | `Promise<string \| null>` |
| `fileSave(options?)`                    | `Promise<string \| null>` |
| `openDirectory(options?)`               | `Promise<string \| null>` |

`FileDialogOptions`: `{ defaultFileName?: string; initialPath?: string }`

**Never use browser native alerts, prompts, or confirms. Always use `os.dialog.*`.**

### `conflictDialog.js`

| Function                                                       | Return                                                              |
| -------------------------------------------------------------- | ------------------------------------------------------------------- |
| `showConflictDialog(fileName)`                                 | `Promise<{ action, applyToAll }>` - action: `replace`/`keep`/`skip` |
| `resolveConflicts(items, existsCheck, getKey, applyToAllInit)` | `Promise<Array<{ item, action }>>`                                  |

### Other shared helpers

| File               | Exports                                                                                         |
| ------------------ | ----------------------------------------------------------------------------------------------- |
| `contextMenu.js`   | `showContextMenu`, `showDynamicContextMenu`, `showStartStyleMenu`, `hideMenu`, `refreshIcons`   |
| `assetResolver.js` | `resolveUrl`, `resolveYukiAsset`, `fetchHtmlAsBlobUrl`, `resolveIconUrl`, `resolveWallpaperUrl` |
| `iframeUtils.js`   | `resolveUrl`, `fetchHtmlAsBlobUrl`, `looksLikeHtml`, `isCdnGhUrl`                               |
| `cdnConfig.js`     | `CDN_CONFIG`, `getLibraryUrl`, `getRepoUrl`                                                     |
| `iconUtils.js`     | `resolveDesktopIcon`                                                                            |
| `platformUtils.js` | `detectOS`, `isMobile`, `getBrowser`                                                            |
| `coreMap.js`       | `detectCore`, `coreLabel`, `ROM_EXTS`                                                           |
| `weatherCodes.js`  | `WEATHER_CODES`, `getWeatherIcon`, `getWeatherInfo`                                             |
| `iframeAttrs.js`   | `IFRAME_ATTRS`                                                                                  |

---

## App Registry

### AppLauncher - `appLauncher.js`

Central dispatcher. `launch(appId, swf, extra)` is the main entry point. Routes to app instance or creates sandboxed
iframe for games. Handles analytics, achievements, Steam stats. Integrates with installed apps registry for app
management.

### gamesList - `gamesList.js`

Registry of 2900+ games/apps. `appMap[appId]` contains `{ type, title, url, icon, action }`.

- Types: `"system"`, `"game"`, `"html"`, `"remote"`

### gameDescriptions - `gameDescriptions.js`

Rich metadata per app: title, description, genre, year, developer.

### appCreator - `appCreator.js`

UI to create custom shortcuts to external URLs. Auto-detects favicon, supports per-app CORS proxy. Saves to
`/home/reeyuki/Apps/`.

### installedApps - `installedApps.js`

App registry system for managing installed/uninstalled apps. Provides dynamic app metadata, disable/uninstall support,
and custom naming. Integrates with AppLauncher for app management.

---

## Application Catalog

### File & Explorer

| App              | File                  | Key Methods                                                                                                                                              |
| ---------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ExplorerApp      | `explorer.js`         | `open(path)`, `navigateTo(path)`, `deleteFile(path)`, `renameFile(old, new)`, `openSaveDialog(defaultFileName, onSave)`, `openDirectoryDialog(onSelect)` |
| fileDisplay      | `fileDisplay.js`      | Renders images, video, PDF, code, text, markdown                                                                                                         |
| archiveExtractor | `archiveExtractor.js` | ZIP/7z extraction, list archive contents                                                                                                                 |

---

## File/Directory Selection Dialogs

The Explorer app provides built-in dialog methods for file and directory selection. These should be used alongside
native browser dialogs.

### Explorer Dialog Methods

**Access Explorer app from services:**

```javascript
const explorerApp = this.services.explorerApp;
```

#### `openSaveDialog(defaultFileName, onSave)`

Opens a file save dialog with Explorer UI. User can navigate directories and enter a filename.

**Parameters:**

- `defaultFileName` (string): Suggested filename for the save dialog
- `onSave` (function): Callback that receives `(path, filename)` when user clicks Save

**Usage:**

```javascript
explorerApp.openSaveDialog("myfile.txt", (path, filename) => {
  const fullPath = path.join("/");
  const filePath = `${fullPath}/${filename}`;
  await os.fs.write(fullPath, filename, content);
});
```

#### `openDirectoryDialog(onSelect)`

Opens a directory selection dialog with Explorer UI. User can navigate and select a directory.

**Parameters:**

- `onSelect` (function): Callback that receives `path` (array) when user clicks Select

**Usage:**

```javascript
explorerApp.openDirectoryDialog((path) => {
  const pathStr = path.join("/");
  await os.fs.mkdir(pathStr);
});
```

#### `open(path, callback)`

Opens Explorer in file selection mode when a callback is provided.

**Parameters:**

- `path` (array|string): Initial path to navigate to
- `callback` (function): Callback that receives selected file path when user selects a file

**Usage:**

```javascript
explorerApp.open(["Documents"], (selectedPath) => {
  console.log("Selected file:", selectedPath);
});
```

### Best Practices

- **Always use Explorer dialogs** for file/directory selection instead of `showPrompt` for manual path input
- **Use `openDirectoryDialog`** when you need the user to select a directory (e.g., save location)
- **Use `openSaveDialog`** when saving a file with a user-specified name
- **Use `open` with callback** when you need the user to select an existing file
- **Handle null/undefined returns** - callbacks may not be called if user cancels the dialog

### Productivity

| App            | File        | Notes                                     |
| -------------- | ----------- | ----------------------------------------- |
| NotepadApp     | -           | Text editor, file save/load               |
| MarkdownApp    | -           | Split-pane editor with live preview       |
| YukiCode       | `monaco.js` | Monaco editor (VSCode engine) integration |
| CalculatorApp  | -           | Scientific calculator with memory         |
| OfficeAppProxy | `office.js` | Office 365 viewer for .docx/.xlsx/.pptx   |

### Media & Emulators

| App        | File         | Notes                              |
| ---------- | ------------ | ---------------------------------- |
| Camera     | -            | Webcam access, photo capture       |
| Model3DApp | `model3d.js` | Three.js viewer for OBJ, GLTF, GLB |
| YouTubeApp | -            | YouTube integration                |
| JsDosApp   | `jsdos.js`   | DOS emulation + Ruffle Flash       |
| V86App     | `v86.js`     | x86-64 full system emulation       |

### System Utilities

| App                  | File                  | Notes                                                                                |
| -------------------- | --------------------- | ------------------------------------------------------------------------------------ |
| TerminalApp          | -                     | CLI: ls, cd, mkdir, rm, cp, mv, cat, pwd, etc.                                       |
| TaskManagerApp       | -                     | Window/process list, close apps                                                      |
| SettingsApp          | -                     | Theme, wallpaper, taskbar, sound, DND, language, GUI scale, brightness, transparency |
| ProfileCustomizerApp | -                     | Username, profile picture, desktop colors                                            |
| AchievementsApp      | -                     | Tracks launches, playtime milestones, friend stats                                   |
| AboutApp             | -                     | System info, version, credits                                                        |
| newsApp              | `news.js`             | News aggregation with categories, unread bubble                                      |
| WeatherApp           | `weather.js`          | Current weather and forecast                                                         |
| CategoriesApp        | `categories.js`       | Organize games by genre/tag                                                          |
| GuideApp             | `yukiOsGuide.js`      | Interactive guide and tutorial system                                                |
| ClipboardManagerApp  | `clipboardManager.js` | Clipboard history and management                                                     |

### System Services

| Service       | File               | Role                                                        |
| ------------- | ------------------ | ----------------------------------------------------------- |
| DesktopUI     | `desktopui.js`     | Desktop background, taskbar, start menu                     |
| startMenu     | `startMenu.js`     | Start menu and app grid UI                                  |
| system.js     | -                  | Wallpaper and theme management                              |
| wallpapers.js | -                  | Wallpaper store (13 default + custom)                       |
| settings.js   | -                  | Preference storage (localStorage wrapper)                   |
| audioMixer.js | -                  | Global audio, per-app volume via `createAudioTrack(appId)`  |
| analytics.js  | -                  | Usage tracking (launches, playtime, features, friend stats) |
| clippy.js     | -                  | Virtual assistant with contextual tips                      |
| BrowserApp    | -                  | Lightweight web browser with bookmarks                      |
| installedApps | `installedApps.js` | App registry for installed/uninstalled apps management      |
| networkTray   | `networkTray.js`   | Network status display in system tray                       |
| powerTray     | `powerTray.js`     | Battery/power indicator in system tray                      |

---

## Adding a Web App (URL-based)

For simple web apps that just load a URL in scramjet, you can use the web app system instead of creating a full app
class. Web Apps use scramjet proxy underneath.

### Step 1: Add Entry to AppManifest.js

Add a manifest entry to `webos-desktop/src/registry/AppManifest.js` with `targetUrl` and `windowSize` fields:

```javascript
export const APP_MANIFESTS = [
  // ... existing entries
  {
    serviceKey: "myWebApp",
    enhanced: true,
    type: "system",
    title: "My Web App",
    icon: "fas fa-globe",
    launchType: "instance",
    windowIdPatterns: ["my-web-app"],
    category: "internet",
    persistContentState: false,
    clippy: { message: "Your app description here.", animation: ClippyAnimation.Show },
    description: "Brief description under 15 words for the app guide.",
    targetUrl: "https://example.com",
    windowSize: ["90vw", "85vh"]
  }
];
```

## Adding a New App

Follow these steps to create a new app. Apps extend `BaseApp` and build their UI imperatively in the `open()` method.

### 1. Create App File

Create `src/apps/myApp.js`:

```javascript
import "../styles/myApp.css";
import { BaseApp, os } from "../framework.js";

export class MyApp extends BaseApp {
  constructor(services) {
    super(services);
    this.openWindows = new Set();
  }

  open(opts = {}) {
    const winId = "my-app";
    if (this.openWindows.has(winId)) return;

    const win = os.window.create(winId, "My App", "500px", "400px", {
      icon: "fas fa-star"
    });

    win.innerHTML = `
      <div class="my-app-root">
        <p>Hello from My App!</p>
      </div>
    `;

    this.openWindows.add(winId);
    this.win = win;

    win.addEventListener("remove", () => {
      this.openWindows.delete(winId);
    });
  }

  onClose(winId) {
    this.openWindows.delete(winId);
  }
}
```

**Key patterns:**
- `open()` creates the window via `os.window.create()` — returns the window div
- Use `addEventListener()` for events, not declarative syntax
- Track open windows with `this.openWindows` (a Set) to prevent duplicates or manage instances
- The `remove` event on the window element is the cleanup hook for per-window state
- `onClose(winId)` is called by the system when a window closes

### 2. Add CSS Styling

Create `src/styles/myApp.css` with YukiOS styling:

```css
.my-app-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-secondary);
  padding: 16px;
  gap: 16px;
}
```

**Important:** Import the CSS at the top of your app file (as shown in step 1). Do not add `<link>` tags to `index.html`.

### 3. Add Entry to AppManifest.js

Add manifest entry to `src/registry/AppManifest.js`:

```javascript
export const APP_MANIFESTS = [
  // ... existing entries
  {
    serviceKey: "myApp",
    type: "system",
    title: "My App",
    icon: "fas fa-star",
    launchType: "instance",
    windowIdPatterns: ["my-app"],
    category: "office",
    description: "Brief description under 15 words for the app guide."
  }
];
```

**Manifest fields:**
- `serviceKey` — Maps to the key in `APP_CLASS_MAP` in AppLoader.js
- `type` — Always `"system"` for native apps
- `title` — Display name
- `icon` — Font Awesome class (e.g. `"fas fa-star"`) or CDN URL
- `launchType` — `"instance"` for native apps, `"iframe"`/`"remote"` for web apps, `"steam"` for games
- `windowIdPatterns` — Identifies window IDs for session restoration
- `category` — Grouping: `"system"`, `"office"`, `"internet"`, `"games"`, `"graphics"`, `"development"`, `"media"`, `"help"`, `"utilities"`
- `clippy` (optional) — `{ message, animation }` for Clippy assistant
- `description` (optional) — App description for the guide
- `isHeavy` (optional) — Mark as resource-intensive
- `targetUrl` (optional) — URL for web apps loaded in scramjet
- `trayOptions` (optional) — `{ contextMenuItems, onClick, onQuit }`
- `excludeFromInstalledApps` (optional) — Hide from Installed Apps list
- `persistContentState` (optional) — Enable session content persistence

### 4. Add to AppLoader.js

Add import and entry to `APP_CLASS_MAP` in `src/AppLoader.js`:

```javascript
import { MyApp } from "./apps/myApp.js";

const APP_CLASS_MAP = {
  // ... existing entries
  myApp: MyApp
};
```

### 5. Verify Build

Run build to verify:

```bash
cd webos-desktop && pnpm build:dev
```

---

## App Architecture

### BaseApp Interface

All apps extend `BaseApp` (`src/core/BaseApp.ts`). The base class provides:

| Method | Purpose |
|--------|---------|
| `open(opts?)` | Create the app window — **must override** (throws by default) |
| `onClose(winId)` | Lifecycle hook when a window closes |
| `isSingletonOpen(winId)` | Check if a window already exists and focus it |
| `notify(title, message, type?, duration?, icon?, appSource?)` | Send a notification scoped to this app |
| `registerTray(winId, icon, label, options)` | Register with system tray |
| `unregisterTray(winId)` | Remove from system tray |
| `sendToTray(winId)` | Hide window + taskbar to tray |
| `restoreFromTray(winId)` | Restore window from tray |
| `getSnapshot(winId)` | Return state for session persistence |
| `restoreSnapshot(winId, data)` | Restore state from session |

**Constructor receives:** The `os` bridge object (or services container). Apps store references to `this.wm` (WindowManager), `this.fs` (FileSystemManager), `this.bus` (EventBus), `this.notifications` (NotificationCenter) for direct use without `os.*` bridge.

### App Lifecycle

1. **Definition** — App class created in `src/apps/`
2. **Registration** — Class added to `APP_CLASS_MAP` in `AppLoader.js` and metadata to `APP_MANIFESTS` in `src/registry/AppManifest.js`
3. **Instantiation** — `loadApps(services)` in `AppLoader.js` creates one singleton instance per app class and registers it via `os.app.register(key, instance)`
4. **Launch** — `AppLauncher.launch(appId)` retrieves the singleton and calls `instance.open(appExtra)`
5. **Open** — `open()` creates a window via `os.window.create()`, builds UI, binds events
6. **Close** — `onClose(winId)` is called; the window element fires a `remove` event for cleanup

### Singleton Pattern

**Apps are singletons:** one instance per class, created at startup. The same instance's `open()` is called each time the user launches the app. Multi-window apps (like Notepad) generate unique window IDs per call. Single-window apps use `isSingletonOpen()` or a Set to prevent duplicates.

### Actual App Patterns

Three common patterns in the codebase:

**Singleton (one window at a time):**
```javascript
async open(opts) {
  if (await this.isSingletonOpen("my-app-win")) return;
  const win = os.window.create("my-app-win", "My App", "400px", "300px", { icon: "fas fa-star" });
  win.innerHTML = this.buildUI();
  // ... bind events
}
```

**Multi-instance (many windows):**
```javascript
open(opts = {}) {
  const winId = `myapp-${Date.now()}`;
  const win = os.window.create(winId, "My App", "500px", "400px", { icon: "fas fa-star" });
  this.instances.set(winId, { /* per-window state */ });
  win.addEventListener("remove", () => this.instances.delete(winId));
}
```

**Web app (URL-based):**
Add an entry to `APP_MANIFESTS` with `targetUrl`, `launchType: "instance"`, and `windowSize`. No class needed — the system creates a `ScramjetBaseApp` wrapper automatically.

---

## Keybind System

### KeybindManager (`src/keybindManager.js`)

Central registry of all keyboard shortcuts with customization and persistence. Always use instead of raw keydown
listeners.

| Method                         | Description                                                                    |
| ------------------------------ | ------------------------------------------------------------------------------ |
| `getAll()`                     | All keybinds with current (possibly customized) keys (includes custom actions) |
| `getById(id)`                  | Single keybind definition by ID (checks custom actions too)                    |
| `getCurrentKeys(id)`           | Current key combo for a given ID                                               |
| `setKeys(id, keys)`            | Customize a keybind (`keys` is array like `["Ctrl", "K"]`)                     |
| `reset(id)` / `resetAll()`     | Reset single or all keybinds to defaults                                       |
| `matches(event, id)`           | Check if a `KeyboardEvent` matches a keybind's current combo                   |
| `isCustomized(id)`             | Whether a keybind has been modified                                            |
| `saveCustomAction(definition)` | Create/update a custom action; auto-assigns ID if missing; returns ID          |
| `deleteCustomAction(id)`       | Remove a custom action                                                         |
| `getAllCustomActions()`        | Get array of all custom action definitions                                     |
| `getCustomAction(id)`          | Get a single custom action by ID                                               |
| `executeCustomAction(id)`      | Execute a custom action by its ID                                              |

**Key Pattern:** `scope.action` - e.g. `global.showDesktop`, `notepad.save`, `browser.newTab`.

**Usage in handlers:**

```javascript
import { KeybindManager } from "../keybindManager.js";

// Instead of: if (e.ctrlKey && e.key === "s") { save(); }
if (KeybindManager.matches(e, "notepad.save")) {
  e.preventDefault();
  save();
}
```

**Adding new keybinds:** Add an entry to `KEYBIND_DEFINITIONS` in `keybindManager.js` with an `id`, `defaultKeys`
(array), `desc`, `cat`, and `icon`. Then use `KeybindManager.matches(event, id)` in your handler.

### Shortcuts App (`src/apps/shortcuts.js`)

Opened from Start Menu. Users can search, filter by category, click a key combo to rebind it, reset individual
shortcuts, or reset all. Customizations persist via `os.storage`.

### Custom Actions

Users can create custom keyboard shortcuts with custom actions. Custom actions support four types:

- **Launch App** - Launches any registered app by its ID (e.g. `terminal`, `calculator`)
- **Open URL** - Opens a URL in a new browser tab
- **Run Code** - Executes JavaScript code with the `os` object available (`new Function("os", code)(os)`)
- **Notify** - Sends a system notification with a title and message

Custom actions are defined in the Shortcuts app via the "Custom" button. Each custom action:

1. Gets a unique ID (prefixed `custom_`)
2. Stores its keybind + action definition in `os.storage`
3. Appears under the "Custom" category in the Shortcuts app sidebar
4. Is executed by a global `keydown` listener installed automatically on creation

**Definition schema:**

```javascript
{
  id: "custom_1719000000_abcd",       // auto-generated if omitted
  defaultKeys: ["Ctrl", "Shift", "A"], // the key combination
  desc: "My custom shortcut",          // user-facing description
  icon: "fas fa-rocket",               // auto-set based on action type
  cat: "custom",                       // always "custom"
  action: {
    type: "launchApp",                 // "launchApp" | "openUrl" | "runCode" | "notify"
    config: { appId: "terminal" }      // varies by type
  }
}
```
