# Yuki OS - Agent Reference

## Hard Rules

- Never run `npm/pnpm format` or `npm/pnpm bf`
- Never add comments, docstrings, or `/* */` blocks in CSS, JS, or HTML
- Never spawn a browser for testing
- Before finalizing any code changes, run `pnpm build:dev` in `webos-desktop/`. A change that breaks the build is
  incomplete.
- Always use CSS variables from `src/styles/style.css`. Never hardcode colors.
- When making significant changes, new features, or new apps: register them in src/news.js with an icon, title, and a
  punchy, active-voice description under 15 words. Bad: 'First-time setup now includes a dedicated profile step...'
  Good: 'Choose your nickname and avatar during setup, with a quick final preview!'
- Whenever you define a new app to appJauncher or gamesJist, define description for it on gameDescriptions.js

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
- **Error Handling**: Use try-catch for async operations that can fail. Provide meaningful error messages. Don't
  silently swallow errors.
- **Type Safety**: Use JSDoc comments for complex function signatures to improve IDE support and catch bugs early.

---

## Styling System

Yuki OS uses a dark glassmorphism theme with a comprehensive theming system. All rules below are non-negotiable.

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
  `-webkit-appearance: none`, custom border/background, and `::after` pseudo-element for checkmarks via CSS variables.
- **Theming System**: Comprehensive theme engine with 25+ built-in themes, transparent UI toggle, advanced brightness
  controls, and GUI scale options. Themes are managed via `settings.js` and applied through CSS variables.

---

## Architecture

```
main.js initializes services
    ↓
Services Container (WindowManager, FileSystemManager, NotificationCenter, EventBus)
    ↓
30+ Applications (all inherit BaseApp, receive injected services)
    ↓
Desktop UI renders windows, taskbar, start menu
```

**App lifecycle:**

1. **Instantiation** - `new MyApp(services)`
2. **Registration** - App attached to `services` object in `main.js`
3. **Launch** - `AppLauncher.launch(appId)` dispatches
4. **Open** - `app.open()` creates window via `WindowManager`
5. **Close** - `onClose(winId)` cleanup hook called

---

## Services (injected into every app constructor)

```javascript
constructor(services) {
  this.services = services;
  this.services.windowManager       // Window lifecycle
  this.services.fileSystem           // File operations
  this.services.notificationCenter   // Notifications
  this.services.eventBus             // Event pub-sub
  this.services.appLauncher          // App dispatcher
}
```

### WindowManager - `src/windowManager.js`

| Method                                           | Purpose                                                  |
| ------------------------------------------------ | -------------------------------------------------------- |
| `createWindow(id, title, width, height, isGame)` | Create styled window element                             |
| `mountWindow(win, winId, title, iconValue)`      | Attach to desktop, enable drag/resize, add taskbar entry |
| `bringToFront(win)`                              | Raise z-index, focus window                              |
| `closeWindow(win)`                               | Close window, cleanup, remove taskbar entry              |
| `minimizeWindow(win)`                            | Hide window, mark taskbar minimized                      |
| `maximizeWindow(win)`                            | Expand/restore window                                    |

Features: window snapping (Win+Arrow), workspace management, taskbar preview.

---

### FileSystemManager - `src/fs.js`

Virtual filesystem backed by BrowserFS, persisted via IndexedDB.

| Method                               | Purpose                           |
| ------------------------------------ | --------------------------------- |
| `async readFile(path)`               | Read file content                 |
| `async safeWriteFile(path, content)` | Write file (string or Uint8Array) |
| `async readdir(path)`                | List directory contents           |
| `async mkdir(path)`                  | Create directory                  |
| `async unlink(path)`                 | Delete file                       |
| `async stat(path)`                   | Get file metadata                 |
| `async copy(src, dst)`               | Copy file/directory               |

**Default structure:**

```
/home/reeyuki/
├── Desktop/              (desktop icons)
├── Documents/INFO.txt
├── Pictures/Wallpapers/  (13 default + custom)
└── Apps/                 (user-created shortcuts)
```

**FileKind values:** `TEXT` (.txt .md .json .js .css), `IMAGE` (.png .jpg .webp .gif), `VIDEO` (.mp4 .webm .mov .avi),
`AUDIO` (.mp3 .wav .ogg .flac), `ROM` (.bin .gba .nds .snes), `OTHER` (.zip .exe, unknown)

---

### NotificationCenter - `src/notificationCenter.js`

| Method                                         | Purpose                  |
| ---------------------------------------------- | ------------------------ |
| `notify(title, message, type, duration, icon)` | Show toast notification  |
| `setDND(enabled)`                              | Toggle Do-Not-Disturb    |
| `getNotifications()`                           | Get notification history |

Features: notification positioning, slider controls, app icons on notifications.

---

### EventBus - `src/core/EventBus.js`

| Method                     | Purpose                     |
| -------------------------- | --------------------------- |
| `on(eventType, handler)`   | Register listener           |
| `off(eventType, handler)`  | Unregister listener         |
| `emit(eventType, ...args)` | Fire event to all listeners |

**Standard events:** `SETTINGS_CHANGED`, `WINDOW_CREATED`, `WINDOW_FOCUSED`, `WINDOW_CLOSED`, `FILE_CHANGED`

---

## Shared Utilities - `src/shared/`

Always prefer these over reimplementing logic.

### `dialogs.js`

| Function                                                | Return                    |
| ------------------------------------------------------- | ------------------------- |
| `showAlert(title, message, buttonText)`                 | `Promise<void>`           |
| `showPrompt(title, message, defaultValue, confirmText)` | `Promise<string \| null>` |
| `showConfirm(title, message, confirmText, cancelText)`  | `Promise<boolean>`        |
| `customAlert(message, title)`                           | `Promise<void>`           |
| `customPrompt(message, defaultValue, title)`            | `Promise<string \| null>` |
| `customConfirm(message, title)`                         | `Promise<boolean>`        |

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

Registry of 3700+ games/apps. `appMap[appId]` contains `{ type, title, url, icon, action }`.

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

| App              | File                  | Key Methods                                                                  |
| ---------------- | --------------------- | ---------------------------------------------------------------------------- |
| ExplorerApp      | `explorer.js`         | `open(path)`, `navigateTo(path)`, `deleteFile(path)`, `renameFile(old, new)` |
| fileDisplay      | `fileDisplay.js`      | Renders images, video, PDF, code, text, markdown                             |
| archiveExtractor | `archiveExtractor.js` | ZIP/7z extraction, list archive contents                                     |

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

## Adding a New Application

**1. Create app class**

```javascript
class MyApp extends BaseApp {
  constructor(services) {
    super(services);
    this.openWindows = new Set();
  }

  open(options = {}) {
    const winId = "myapp-window";
    const win = this.services.windowManager.createWindow(winId, "Title", 800, 600);
    win.innerHTML = `...ui...`;
    document.body.appendChild(win);
    this.services.windowManager.mountWindow(win, winId, "Title", "fa-star");
    this.openWindows.add(winId);
  }

  onClose(winId) {
    this.openWindows.delete(winId);
  }
}
```

**2. Register in `main.js`**

```javascript
const myApp = new MyApp(services);
services.myApp = myApp;
// Pass to AppLauncher constructor, then update appLauncher.js
```

**3. Add to `gamesList.js`**

```javascript
appMap.myAppId = {
  type: "system",
  title: "My App",
  icon: "fa-star",
  action: () => appLauncher.myApp.open()
};
```

**4. Register news update in `src/news.js`**

```javascript
NEWS_UPDATES["2025-01-15"] = [{ icon: "fa-star", title: "My App", description: "New app added." }];
```

---

## System Tray API

Accessed via `trayManager` singleton from `src/tray.js`.

| Method                                               | Purpose                                                                                                         |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `register(winId, icon, label, options = {})`         | Register window to system tray with options (resident, showInTray, onClick, onQuit, contextMenuItems, priority) |
| `unregister(winId)`                                  | Remove window from system tray                                                                                  |
| `sendToTray(winId)`                                  | Hide window + taskbar item → tray                                                                               |
| `restoreFromTray(winId)`                             | Restore window + taskbar item from tray                                                                         |
| `updateIcon(winId, newIcon)`                         | Update tray icon for registered item                                                                            |
| `updateLabel(winId, newLabel)`                       | Update tray label for registered item                                                                           |
| `updateContextMenuItems(winId, newContextMenuItems)` | Update context menu items for registered item                                                                   |
| `isRegistered(winId)`                                | Check if window is registered in tray                                                                           |
| `isInTray(winId)`                                    | Check if window is currently in tray                                                                            |
| `getTrayItems()`                                     | Get array of all tray items                                                                                     |
| `quitApp(winId)`                                     | Quit app and remove from tray                                                                                   |

**Register options:**

- `resident: boolean` - App stays in tray permanently (cannot be restored to window)
- `showInTray: boolean` - App shows in tray icon area
- `onClick: function` - Callback when tray icon clicked
- `onQuit: function` - Callback when app is quit from tray
- `contextMenuItems: array` - Custom context menu items (objects with label, action, icon, type)
- `priority: number` - Sorting priority (higher = more prominent)

---

## Declarative Apps Framework

Apps can define structure declaratively via `getDeclarativeSchema(opts)` instead of imperative code.

```javascript
getDeclarativeSchema(opts) {
  return {
    id: "my-app",
    name: "My App",
    icon: "fas fa-star",
    windows: [{
      id: "my-app",
      title: "My App",
      size: ["400px", "300px"],
      icon: "fas fa-star",
      iconColor: "#4f9eff",
      ui: "<div>App UI</div>",
      events: {
        "#my-button": {
          click: { type: "custom:myAction", stopPropagation: true }
        }
      }
    }],
    state: {
      initial: { value: 0 },
      persistence: "memory"
    },
    actions: {
      myAction: (payload, event, element, state) => {
        state.value += 1;
      }
    },
    onMount: "initMyApp"
  };
}
```

**Runtime components:** | File | Role | |------|------| | `runtime/StateManager.js` | Manages local app state, optional
persistence | | `runtime/AppRenderer.js` | Parses window configs, mounts into DOM via WindowHelper | |
`runtime/EventBinder.js` | Maps element events to actions | | `runtime/ActionExecutor.js` | Dispatches actions, modifies
state, runs system ops |

**HybridAdapter** (`runtime/HybridAdapter.js`) - `enhanceBaseApp(BaseAppClass)` wraps `open()` to check for a
declarative schema first; falls back transparently to imperative `open()` if none found. Also translates legacy
multi-parameter signatures (e.g. `open(title, content, filePath)`) into structured `opts` objects.

- **CORS Proxy**: Configurable per app via `appCreator`
- **HTML Sandboxing**: Use `fetchHtmlAsBlobUrl()` to convert HTML → `blob://` for secure execution
