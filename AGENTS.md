# Yuki OS — Agent Reference

## Hard Rules
- Never run `npm/pnpm format` or `npm/pnpm bf`
- Never add comments, docstrings, or `/* */` blocks in CSS, JS, or HTML
- Never spawn a browser for testing
- Before finalizing any code changes, run `pnpm build:dev` in `webos-desktop/`. A change that breaks the build is incomplete.
- Always use CSS variables from `src/styles/style.css`. Never hardcode colors.
- When making significant changes, new features, or new apps: register them in `src/news.js` under `NEWS_UPDATES` for the current day with an appropriate icon, title, and short user-facing description.
- Whenever you define a new app to appJauncher or gamesJist, define description for it on gameDescriptions.js

---

## Styling System

Yuki OS uses a dark glassmorphism theme. All rules below are non-negotiable.

- **CSS Variables**: Use `--brand` (accent), `--text-primary`, `--text-secondary`, `--bg-primary`, `--bg-secondary`, `--glass`, `--glass-border`, `--error`. Never introduce new hues or hardcoded values.
- **Color Hue**: All colors use unified hue 265 (purple). Never mix in gray or blue hues.
- **Glassmorphism**: `backdrop-filter: blur(32px+)`, semi-transparent `rgba` backgrounds (0.6–0.98 opacity), subtle borders (`rgba(255,255,255,0.08–0.12)`).
- **Depth**: Multi-layer box shadows — `0 24px 64px rgba(0,0,0,0.65)` + inset highlight.
- **Typography**: System fonts or JetBrains Mono for code. 13–16px base (minimum 12px for any readable text). Opacity 0.7–0.9 for secondary text. Never use font-size below 12px for user-facing content unless absolutely necessary (e.g., badges, timestamps).
- **Radius**: 6–14px depending on element size.
- **Transitions**: 0.1–0.2s for hover states.
- **Light Theme**: Override via `html[data-theme="light"]` with solid colors (`#fff`, `#f0f0f0`, `#111`, `#666`).
- **Scrollbars**: 8px width, `rgba(255,255,255,0.12)` thumb.
- **Checkboxes/Inputs**: Never use native browser checkboxes, plain inputs, or dropdowns. Always use `appearance: none`, `-webkit-appearance: none`, custom border/background, and `::after` pseudo-element for checkmarks via CSS variables.

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
1. **Instantiation** — `new MyApp(services)`
2. **Registration** — App attached to `services` object in `main.js`
3. **Launch** — `AppLauncher.launch(appId)` dispatches
4. **Open** — `app.open()` creates window via `WindowManager`
5. **Close** — `onClose(winId)` cleanup hook called

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

### WindowManager — `src/windowManager.js`

| Method | Purpose |
|--------|---------|
| `createWindow(id, title, width, height, isGame)` | Create styled window element |
| `mountWindow(win, winId, title, iconValue)` | Attach to desktop, enable drag/resize, add taskbar entry |
| `bringToFront(win)` | Raise z-index, focus window |
| `closeWindow(win)` | Close window, cleanup, remove taskbar entry |
| `minimizeWindow(win)` | Hide window, mark taskbar minimized |
| `maximizeWindow(win)` | Expand/restore window |

Features: window snapping (Win+Arrow), workspace management, taskbar preview.

---

### FileSystemManager — `src/fs.js`

Virtual filesystem backed by BrowserFS, persisted via IndexedDB.

| Method | Purpose |
|--------|---------|
| `async readFile(path)` | Read file content |
| `async safeWriteFile(path, content)` | Write file (string or Uint8Array) |
| `async readdir(path)` | List directory contents |
| `async mkdir(path)` | Create directory |
| `async unlink(path)` | Delete file |
| `async stat(path)` | Get file metadata |
| `async copy(src, dst)` | Copy file/directory |

**Default structure:**
```
/home/reeyuki/
├── Desktop/              (desktop icons)
├── Documents/INFO.txt
├── Pictures/Wallpapers/  (13 default + custom)
└── Apps/                 (user-created shortcuts)
```

**FileKind values:** `TEXT` (.txt .md .json .js .css), `IMAGE` (.png .jpg .webp .gif), `VIDEO` (.mp4 .webm .mov .avi), `AUDIO` (.mp3 .wav .ogg .flac), `ROM` (.bin .gba .nds .snes), `OTHER` (.zip .exe, unknown)

---

### NotificationCenter — `src/notificationCenter.js`

| Method | Purpose |
|--------|---------|
| `notify(title, message, type, duration, icon)` | Show toast notification |
| `setDND(enabled)` | Toggle Do-Not-Disturb |
| `getNotifications()` | Get notification history |

---

### EventBus — `src/core/EventBus.js`

| Method | Purpose |
|--------|---------|
| `on(eventType, handler)` | Register listener |
| `off(eventType, handler)` | Unregister listener |
| `emit(eventType, ...args)` | Fire event to all listeners |

**Standard events:** `SETTINGS_CHANGED`, `WINDOW_CREATED`, `WINDOW_FOCUSED`, `WINDOW_CLOSED`, `FILE_CHANGED`

---

## Shared Utilities — `src/shared/`

Always prefer these over reimplementing logic.

### `dialogs.js`

| Function | Return |
|--------|---------|
| `showAlert(title, message, buttonText)` | `Promise<void>` |
| `showPrompt(title, message, defaultValue, confirmText)` | `Promise<string \| null>` |
| `showConfirm(title, message, confirmText, cancelText)` | `Promise<boolean>` |
| `customAlert(message, title)` | `Promise<void>` |
| `customPrompt(message, defaultValue, title)` | `Promise<string \| null>` |
| `customConfirm(message, title)` | `Promise<boolean>` |

### `conflictDialog.js`

| Function | Return |
|--------|---------|
| `showConflictDialog(fileName)` | `Promise<{ action, applyToAll }>` — action: `replace`/`keep`/`skip` |
| `resolveConflicts(items, existsCheck, getKey, applyToAllInit)` | `Promise<Array<{ item, action }>>` |

### Other shared helpers

| File | Exports |
|------|---------|
| `contextMenu.js` | `showContextMenu`, `showDynamicContextMenu`, `showStartStyleMenu`, `hideMenu`, `refreshIcons` |
| `assetResolver.js` | `resolveUrl`, `resolveYukiAsset`, `fetchHtmlAsBlobUrl`, `resolveIconUrl`, `resolveWallpaperUrl` |
| `iframeUtils.js` | `resolveUrl`, `fetchHtmlAsBlobUrl`, `looksLikeHtml`, `isCdnGhUrl` |
| `cdnConfig.js` | `CDN_CONFIG`, `getLibraryUrl`, `getRepoUrl` |
| `iconUtils.js` | `resolveDesktopIcon` |
| `platformUtils.js` | `detectOS`, `isMobile`, `getBrowser` |
| `coreMap.js` | `detectCore`, `coreLabel`, `ROM_EXTS` |
| `weatherCodes.js` | `WEATHER_CODES`, `getWeatherIcon`, `getWeatherInfo` |
| `iframeAttrs.js` | `IFRAME_ATTRS` |

---

## App Registry

### AppLauncher — `appLauncher.js`
Central dispatcher. `launch(appId, swf, extra)` is the main entry point. Routes to app instance or creates sandboxed iframe for games. Handles analytics, achievements, Steam stats.

### gamesList — `gamesList.js`
Registry of 3700+ games/apps. `appMap[appId]` contains `{ type, title, url, icon, action }`.
- Types: `"system"`, `"game"`, `"html"`, `"remote"`

### gameDescriptions — `gameDescriptions.js`
Rich metadata per app: title, description, genre, year, developer.

### appCreator — `appCreator.js`
UI to create custom shortcuts to external URLs. Auto-detects favicon, supports per-app CORS proxy. Saves to `/home/reeyuki/Apps/`.

---

## Application Catalog

### File & Explorer
| App | File | Key Methods |
|-----|------|-------------|
| ExplorerApp | `explorer.js` | `open(path)`, `navigateTo(path)`, `deleteFile(path)`, `renameFile(old, new)` |
| fileDisplay | `fileDisplay.js` | Renders images, video, PDF, code, text, markdown |
| archiveExtractor | `archiveExtractor.js` | ZIP/7z extraction, list archive contents |

### Productivity
| App | File | Notes |
|-----|------|-------|
| NotepadApp | — | Text editor, file save/load |
| MarkdownApp | — | Split-pane editor with live preview |
| YukiCode | `monaco.js` | Monaco editor (VSCode engine) integration |
| CalculatorApp | — | Scientific calculator with memory |
| OfficeAppProxy | `office.js` | Office 365 viewer for .docx/.xlsx/.pptx |

### Media & Emulators
| App | File | Notes |
|-----|------|-------|
| Camera | — | Webcam access, photo capture |
| Model3DApp | `model3d.js` | Three.js viewer for OBJ, GLTF, GLB |
| YouTubeApp | — | YouTube integration |
| JsDosApp | `jsdos.js` | DOS emulation + Ruffle Flash |
| V86App | `v86.js` | x86-64 full system emulation |

### System Utilities
| App | File | Notes |
|-----|------|-------|
| TerminalApp | — | CLI: ls, cd, mkdir, rm, cp, mv, cat, pwd, etc. |
| TaskManagerApp | — | Window/process list, close apps |
| SettingsApp | — | Theme, wallpaper, taskbar, sound, DND, language |
| ProfileCustomizerApp | — | Username, profile picture, desktop colors |
| AchievementsApp | — | Tracks launches, playtime milestones |
| AboutApp | — | System info, version, credits |
| newsApp | `news.js` | News aggregation with categories |
| WeatherApp | `weather.js` | Current weather and forecast |
| CategoriesApp | `categories.js` | Organize games by genre/tag |

### System Services
| Service | File | Role |
|---------|------|------|
| DesktopUI | `desktopui.js` | Desktop background, taskbar, start menu |
| startMenu | `startMenu.js` | Start menu and app grid UI |
| system.js | — | Wallpaper and theme management |
| wallpapers.js | — | Wallpaper store (13 default + custom) |
| settings.js | — | Preference storage (localStorage wrapper) |
| audioMixer.js | — | Global audio, per-app volume via `createAudioTrack(appId)` |
| analytics.js | — | Usage tracking (launches, playtime, features) |
| clippy.js | — | Virtual assistant with contextual tips |
| BrowserApp | — | Lightweight web browser with bookmarks |

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
NEWS_UPDATES["2025-01-15"] = [
  { icon: "fa-star", title: "My App", description: "New app added." }
];
```

---

## System Tray API (via BaseApp)

| Method | Purpose |
|--------|---------|
| `registerTray(winId, icon, label)` | Register window to system tray |
| `unregisterTray(winId)` | Remove window from system tray |
| `sendToTray(winId)` | Hide window + taskbar item → tray |
| `restoreFromTray(winId)` | Restore window + taskbar item from tray |

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

**Runtime components:**
| File | Role |
|------|------|
| `runtime/StateManager.js` | Manages local app state, optional persistence |
| `runtime/AppRenderer.js` | Parses window configs, mounts into DOM via WindowHelper |
| `runtime/EventBinder.js` | Maps element events to actions |
| `runtime/ActionExecutor.js` | Dispatches actions, modifies state, runs system ops |

**HybridAdapter** (`runtime/HybridAdapter.js`) — `enhanceBaseApp(BaseAppClass)` wraps `open()` to check for a declarative schema first; falls back transparently to imperative `open()` if none found. Also translates legacy multi-parameter signatures (e.g. `open(title, content, filePath)`) into structured `opts` objects.

- **CORS Proxy**: Configurable per app via `appCreator`
- **HTML Sandboxing**: Use `fetchHtmlAsBlobUrl()` to convert HTML → `blob://` for secure execution