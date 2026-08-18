# Development Guide - YukiOS

This guide covers how to create new applications, add functionalities, and contribute to YukiOS.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Creating a New App](#creating-a-new-app)
- [App Architecture](#app-architecture)
- [OS Bridge API](#os-bridge-api)
- [Styling Guidelines](#styling-guidelines)
- [Creating Themes](#creating-themes)
- [Testing](#testing)
- [Build & Deployment](#build--deployment)

---

## Prerequisites

- Node.js and pnpm installed
- Basic knowledge of JavaScript/ES6+
- Understanding of DOM manipulation
- Familiarity with CSS and theming

---

## Getting Started

1. **Clone the repository**

   ```bash
   git clone https://github.com/Reeyuki/YukiOS
   cd yukios
   ```

2. **Install dependencies**

   ```bash
   cd webos-desktop
   pnpm install
   ```

3. **Start development server**

   ```bash
   pnpm run dev
   ```

4. **Build for production**
   ```bash
   pnpm run build
   ```

5. **Build for single file**
   ```bash
   pnpm run build:single
   ```

---

## Creating a New App

YukiOS apps extend `BaseApp` and build their UI imperatively in the `open()` method. Follow these steps to create a new
application:

### Step 1: Create the App File

Create a new file in `webos-desktop/src/apps/` directory:

```javascript
// src/apps/myApp.js
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

**Important notes:**

- `open()` is the entry point — create the window via `os.window.create()`
- `os.window.create()` auto-mounts the window and adds it to the taskbar
- The window header is auto-generated; no need to manually include it
- Bind events with `addEventListener()` directly on elements
- Track open windows with `this.openWindows` (a Set) to prevent duplicates or manage instances
- The `remove` event on the window element is the cleanup hook for per-window state
- `onClose(winId)` is called by the system when a window closes

### Step 2: Add CSS Styling

Create `webos-desktop/src/styles/myApp.css`:

```css
.my-app-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-secondary);
  padding: 16px;
  gap: 16px;
}
```

**Important:** Import the CSS at the top of your app file (as shown in Step 1). Do not add `<link>` tags to
`index.html`.

### Step 3: Add Entry to AppManifest.js

Add a manifest entry to `webos-desktop/src/registry/AppManifest.js`:

```javascript
import { ClippyAnimation } from "../ai/clippy.js";

export const APP_MANIFESTS = [
  // ... existing entries
  {
    serviceKey: "myApp",
    enhanced: true,
    type: "system",
    title: "My App",
    icon: "fas fa-star",
    launchType: "instance",
    windowIdPatterns: ["my-app"],
    category: "office",
    clippy: { message: "Your app description here.", animation: ClippyAnimation.Show },
    description: "Brief description under 15 words for the app guide."
  }
];
```

**Manifest fields:**

- `serviceKey` - Unique identifier for the app (omitted for `source`-based entries)
- `enhanced` - Generic flag for enhanced app features
- `type` - App type (usually "system")
- `title` - Display name
- `icon` - Font Awesome icon class or CDN URL
- `launchType` - "instance", "steam", "iframe", "remote", or "method"
- `windowIdPatterns` - Array of window ID patterns
- `category` - App category (development, graphics, games, help, internet, media, office, system, utilities)
- `clippy` - Clippy message and animation
- `description` - App description for the guide
- `fileAssociations` (optional) - `{ extensions: [...] }` for default-app handling
- `launchMethod` (optional) - Custom launch method name for `launchType: "method"`
- `source` (optional) - URL for `iframe`/`remote` launch types
- `targetUrl` (optional) - URL for scramjet web apps (used with `windowSize`)
- `windowSize` (optional) - `["90vw", "85vh"]` size for web apps
- `trayOptions` (optional) - `{ contextMenuItems, onClick, onQuit }`
- `onLoad` (optional) - Callback when app loads
- `isHeavy` (optional) - Mark as resource-intensive
- `persistContentState` (optional) - Persist window content
- `excludeFromInstalledApps` (optional) - Exclude from Installed Apps

### Step 4: Register in AppLoader.js

Add import and entry to `APP_CLASS_MAP` in `webos-desktop/src/AppLoader.js`:

```javascript
import { MyApp } from "./apps/myApp.js";

const APP_CLASS_MAP = {
  // ... existing entries
  myApp: MyApp
};
```

### Step 5: Verify Build

Run the build to ensure everything works:

```bash
cd webos-desktop && pnpm build:dev
```

The build will automatically validate the registry via the prebuild script.

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

### Step 2: Verify Build

```bash
cd webos-desktop && pnpm build:dev
```

---

## App Architecture

### App Lifecycle

1. **Definition** — App class created in `src/apps/`
2. **Registration** — Class added to `APP_CLASS_MAP` in `AppLoader.js` and metadata to `APP_MANIFESTS` in
   `src/registry/AppManifest.js`
3. **Instantiation** — `loadApps(os, preloaded)` in `AppLoader.js` creates one singleton instance per manifest entry and
   registers it via `os.app.register(key, instance)`
4. **Launch** — `AppLauncher.launch(appId)` retrieves the singleton and calls `instance.open(appExtra)`
5. **Open** — `open()` creates a window via `os.window.create()`, builds UI, binds events
6. **Close** — `onClose(winId)` is called; the window element fires a `remove` event for cleanup

### BaseApp Interface

All apps extend `BaseApp` (`src/core/BaseApp.js`). The base class provides:

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

## OS Bridge API

The OS Bridge provides a unified API surface for applications to interact with system services. Apps should use the
`os.*` bridge.

**Import (preferred):**

```javascript
import { os } from "../framework.js";
```

### Window API - `os.window`

| Method                                          | Purpose                                                   |
| ----------------------------------------------- | --------------------------------------------------------- |
| `create(id, title, width, height, options)`     | Create styled window (auto-mounts, adds to taskbar)       |
| `close(win)`                                    | Close window (accepts element or id string)               |
| `closeAll()`                                    | Close all open windows                                    |
| `focus(win)` / `bringToFront(win)`              | Raise z-index, focus window                               |
| `minimize(win)`                                 | Hide window, mark taskbar minimized                       |
| `maximize(win)` / `toggleFullscreen(win)`       | Expand/restore window (fullscreen)                        |
| `setTitle(winId, title)` / `getTitle(winId)`    | Set / read window title                                   |
| `addToTaskbar(winId, title, icon, color)`       | Add window to taskbar                                     |
| `removeFromTaskbar(winId)`                      | Remove window from taskbar                                |
| `pinAppToTaskbar(appId, title, icon, color)`    | Pin an app to the taskbar                                 |
| `getWindowControls(externalUrl, showDownload)`  | Get window control buttons HTML                           |
| `applySnap(win, direction)` / `unsnap(win)`     | Snap / unsnap a window                                    |
| `getOpenWindows()`                              | Get the Map of open windows                               |
| `setupWindowControls(win)` / `makeDraggable(win)` / `makeResizable(win)` | Manual window setup helpers            |
| `notify(title, message, type, duration, icon, appSource)` | Send notification via window manager               |

**`create()` options:** `{ icon, iconColor, externalUrl, appId, isGame, autoMount, autoFocus, skipHeader, skipAutoSetup }`

### Filesystem API - `os.fs`

| Method                                                       | Purpose                                                  |
| ------------------------------------------------------------ | -------------------------------------------------------- |
| `read(path, options)`                                        | Read file content (options: `{ encoding: "binary" }`)    |
| `write(path, content, options)`                              | Write file content (options: `{ encoding, kind, icon }`) |
| `readdir(path)` / `getFolder(path)`                          | Get directory contents                                   |
| `mkdir(path)`                                                | Create directory recursively                             |
| `delete(path, name)`                                         | Delete file or directory                                 |
| `exists(path)`                                               | Check if path exists                                     |
| `copy(source, destination)`                                  | Copy file/directory                                      |
| `rename(oldPath, newPath)`                                   | Rename file/directory                                    |
| `isFile(path)`                                               | Check if path is a file                                  |
| `getFileKind(path)` / `getFileIcon(path)`                    | Get file kind / icon metadata                            |
| `getMetadata(path, name)` / `writeMeta(path, name, data)`    | Read / write item metadata                               |
| `createFile(path, name, content, kind, icon, faIcon)`        | Create file                                              |
| `createFolder(path, name)`                                   | Create folder                                            |
| `deleteItem(path, name)`                                     | Delete item (file or folder)                             |
| `renameItem(path, oldName, newName)`                         | Rename item                                              |
| `updateFile(path, name, content, meta)`                      | Update file (meta: `{ kind, icon }`)                     |
| `trashFile(path, name)`                                      | Move item to trash                                       |
| `getTrashItems()` / `restoreTrashItem(id)` / `restoreAllTrashItems()` / `deleteTrashItem(id)` / `emptyTrash()` / `getTrashCount()` | Trash management                    |
| `writeBinaryFile(path, name, blob, kind, icon)`              | Write binary file to blob storage                        |
| `readBinaryFile(path, name)` / `deleteBinaryFile(path, name)` / `renameBinaryFile(path, oldName, newName)` | Binary blob operations                 |
| `calcDirSize(path)`                                          | Recursively compute `{ size, files, dirs }`              |
| `getUniqueFileName(path, name)`                              | Generate a non-colliding file name                       |
| `dirname(path)` / `basename(path)` / `join(...parts)` / `resolveUserPath(path)` / `inferKind(filename)` | Path helpers                   |
| `pickDirectory()` / `registerMount(handle, label)` / `unmount(label)` / `getMounts()` | Native mount support          |
| `mountISO(path, name)` / `unmountISO(label)` / `getISOMounts()` | ISO image mounts                                   |
| `setSession(name)`                                           | Switch the active user session                           |
| `getFileContent(path, name)`                                 | Read file content (with kind)                            |

**Note:** Binary file methods use blob storage and require a separate `name` parameter.

### Notification API - `os.notify`

| Method                          | Purpose                                                                |
| ------------------------------- | ---------------------------------------------------------------------- |
| `send(title, message, options)` | Show toast notification (options: `{ type, duration, icon, appSource }`) |
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
| `getTrayItems()`                        | Get Map of all tray items               |
| `isRegistered(winId)`                   | Check if window is registered           |
| `isInTray(winId)`                       | Check if window is currently in tray    |
| `updateItemVisibility(winId, visible)`  | Update item visibility                  |

**Tray Register options:**

- `resident: boolean` - App stays in tray permanently
- `showInTray: boolean` - App shows in tray icon area
- `onClick: function` - Callback when tray icon clicked
- `onQuit: function` - Callback when app is quit from tray
- `contextMenuItems: array` - Custom context menu items
- `priority: number` - Sorting priority (higher = more prominent)

### App API - `os.app`

| Method                                          | Purpose                                     |
| ----------------------------------------------- | ------------------------------------------- |
| `launch(appId, options)`                        | Launch app by ID                            |
| `launchGame(appId, isSwf, options)`             | Launch game with SWF support                |
| `openIframeApp(options)`                        | Open an iframe-based web app                |
| `close(winId)`                                  | Close app by window ID                      |
| `getInstance(key)` / `register(key, instance)`  | Get / register app instance by service key  |
| `getRunningApps()`                              | Get list of running apps                    |
| `getAllApps()`                                  | Get all registered apps                     |
| `getAppInfo(appId)` / `hasApp(appId)`           | Get app metadata / existence check          |
| `searchApps(query)`                             | Search apps by title                        |
| `lockSession()` / `lockToLoginScreen()`         | Lock the current session                    |
| `triggerAchievement(id)`                        | Trigger an achievement                      |
| `executeCommand(cmd)`                           | Run a command in the terminal               |
| `setClipboardContent(value)`                    | Write to the clipboard manager              |
| `takeScreenshot(autoCapture)`                   | Open screenshot app / capture               |
| `registerCustomApp(appId, entry)` / `unregisterCustomApp(appId)` | Manage custom apps           |
| `registerAppRuntime(appId, instance)` / `unregisterAppRuntime(appId)` | Runtime registry       |
| `openFileInApp(name, path)`                     | Open a file in its default app              |

### Events API - `os.events`

| Method                 | Purpose              |
| ---------------------- | -------------------- |
| `on(event, handler)`   | Register listener    |
| `off(event, handler)`  | Unregister listener  |
| `emit(event, data)`    | Fire event           |
| `once(event, handler)` | Register one-time listener |

Use `BusEvents` constants from `src/core/EventBus.js` (re-exported by `framework.js`) instead of raw strings:
`WINDOW_CREATED`, `WINDOW_FOCUSED`, `WINDOW_MINIMIZED`, `WINDOW_CLOSED`, `WINDOW_FULLSCREEN`, `WINDOW_SNAPPED`,
`SETTINGS_CHANGED`, `APP_LAUNCHED`, `NOTIFY`, `ACHIEVEMENT_TRIGGER`, `TERMINAL_CMD_EXECUTED`, `WALLPAPER_CHANGED`,
`LOGIN_WALLPAPER_CHANGED`, `DESKTOP_ICON_ADDED`, `DESKTOP_ICON_REMOVED`, `WORKSPACE_SWITCHED`, `WORKSPACE_ADDED`,
`WORKSPACE_REMOVED`, `FILE_CHANGED`, `SESSION_INITIALIZED`, `SYSTEM_LOCKED`, `SYSTEM_UNLOCKED`, `CLIPBOARD_UPDATE`,
`CLIPBOARD_READ`, `CLIPBOARD_CLEAR`, `PROFILE_UPDATED`, `SOCIAL_PRESENCE_CHANGED`, `SOCIAL_DND_CHANGED`,
`TILING_MODE_CHANGED`, `TILING_LAYOUT_CHANGED`, `MODE_ENTERED`, `MODE_EXITED`

### Storage API - `os.storage` (synchronous)

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

### Ports API - `os.ports`

Named local ports for inter-app messaging (backed by `services/PortManager.js`):
`register(port, handler, root)`, `unregister(port)`, `get(port)`, `isRegistered(port)`, `list()`

### Tor API - `os.tor`

Anonymized networking through Tor (backed by `tor/TorManager.js`):
`isReady`, `running`, `fetch(url)`, `post(url, body)`, `request(method, url, headers, body, timeout)`,
`createClient()`, `getStatus()`, `start(options)`, `stop()`, `getLogs()`, `getSnowflakeUrl()`,
`setSnowflakeUrl(url)`, `getFetchCount()`, `reconnect()`

### Tiling API - `os.tiling`

Window tiling mode control (backed by `modes/tiling/TilingManager.js`):
`enabled`, `setEnabled(enabled)`, `getEffectiveConfig()`, `updateConfig(changes)`, `applyBarSettings()`,
`focusDirection(dir)`, `swapDirection(dir)`, `resizeDirection(dir)`, `cycleFocus(forward)`, `toggleFloating()`,
`toggleFullscreenOnTiled()`, `toggleSplitType()`, `closeFocusedWindow()`

### Modes API - `os.modes`

Session modes: `isActive(id)`, `getActiveModes()`, `enter(id)`, `exit(id)`, `exitAll()`.
`MODES` constant: `MODES.MAC`, `MODES.TILING`, `MODES.CHROME_OS`, `MODES.STEAMDECK`, `MODES["3D"]`

### Achievements API - `os.achievements`

`trigger(id)`, `unlock(key)`, `incrementAppLaunched()`, `incrementGameLaunched()`, `incrementScreenshotTaken()`,
`incrementCalculationDone()`, `incrementPowerProfileChange()`, `incrementSession()`, `incrementWallpaper()`,
`incrementTerminalCmd()`, `incrementFileUploaded()`, `triggerCommandExecution(command)`

### Account API - `os.account`

`client` (`signIn`, `signUp`, `signOut`, `getUser`), `signIn`, `signUp`, `signOut`, `isAccount()`, `isSynced()`,
`getInfo()`, `updateInfo(user)`, `reauth()`, `onAccountChange`, `getSession`, `formatSize`, and
`sync` (`enabled()`, `enable(on)`, `components()`, `toggleComponent(id, on)`, `getEnabledComponents()`,
`buildBundle()`, `push()`, `pull()`)

### Direct service references

`os.windowManager`, `os.fileSystemManager`, `os.clipboardManager`, `os.desktopUI` expose raw services for advanced
integrations.

---

## Styling Guidelines

YukiOS uses a dark glassmorphism theme with a comprehensive theming system.

### CSS Variables

Always use these CSS variables from `src/styles/style.css`:

- `--brand` (accent color)
- `--text-primary`
- `--text-secondary`
- `--bg-primary`
- `--bg-secondary`
- `--glass`
- `--glass-border`
- `--error`

**Never introduce new hues or hardcoded colors.**

### Color Hue

All colors use unified hue 265 (purple). Never mix in gray or blue hues.

### Glassmorphism

- `backdrop-filter: blur(32px+)`
- Semi-transparent `rgba` backgrounds (0.6–0.98 opacity)
- Subtle borders (`rgba(255,255,255,0.08–0.12)`)

### Depth

Multi-layer box shadows:

- `0 24px 64px rgba(0,0,0,0.65)` + inset highlight

### Typography

- System fonts or JetBrains Mono for code
- 13–16px base (minimum 12px for readable text)
- Opacity 0.7–0.9 for secondary text
- Never use font-size below 12px for user-facing content

### Radius

6–14px depending on element size.

### Light Theme

Override via `html[data-theme="light"]` with solid colors (`#fff`, `#f0f0f0`, `#111`, `#666`).

### Scrollbars

8px width, `rgba(255,255,255,0.12)` thumb.

### Checkboxes/Inputs

Never use native browser checkboxes, plain inputs, or dropdowns. Always use:

- `appearance: none`
- `-webkit-appearance: none`
- Custom border/background
- `::after` pseudo-element for checkmarks via CSS variables

### Best Practices

- Never introduce new inline styles
- Prefer CSS classes
- Existing inline styles may be migrated to CSS classes when touched
- New declarative UI definitions should use class names instead of style objects

---

## Creating Themes

YukiOS has a comprehensive theming system with 25+ built-in themes and support for custom themes. Themes are managed via
`src/shared/themeEngine.js`.

### Theme Structure

Each theme is defined as an object with the following properties:

```javascript
{
  value: "my-theme",           // Unique identifier (required)
  label: "My Theme",          // Display name (required)
  icon: "fas fa-palette",     // Font Awesome icon (optional, defaults to palette)
  category: "special",        // "basic", "special", or "custom"
  colors: {                   // CSS variable overrides (optional)
    "--brand": "#8b5cf6",
    "--bg-primary": "#1a1a2e",
    // ... more CSS variables
  }
}
```

### Adding Built-in Themes

To add a new built-in theme, modify the `BUILTIN_THEMES` array in `src/shared/themeEngine.js`:

```javascript
const BUILTIN_THEMES = [
  // ... existing themes
  {
    value: "my-new-theme",
    icon: "fas fa-star",
    label: "My New Theme",
    category: "special",
    colors: {
      "--brand": "#8b5cf6",
      "--bg-primary": "#1a1a2e",
      "--bg-secondary": "#16213e",
      "--text-primary": "#ffffff",
      "--text-secondary": "#a0a0a0",
      "--glass": "rgba(26, 26, 46, 0.8)",
      "--glass-border": "rgba(255, 255, 255, 0.1)"
    }
  }
];
```

### Theme Color Variables

Themes can override any CSS variable defined in `src/styles/style.css`. Common variables:

**Core Colors:**

- `--brand` - Accent/primary color
- `--text-primary` - Main text color
- `--text-secondary` - Secondary text color
- `--bg-primary` - Primary background
- `--bg-secondary` - Secondary background
- `--glass` - Glassmorphism background
- `--glass-border` - Glass border color
- `--error` - Error state color

**Additional Variables:**

- `--window-bg` - Window background
- `--taskbar-bg` - Taskbar background
- `--startmenu-bg` - Start menu background
- `--input-bg` - Input field background
- `--input-border` - Input field border

---

## Shared Utilities

Always prefer these shared utilities over reimplementing logic.

### Dialogs - `os.dialog`

Always use the OS-level dialog API instead of shared dialog utilities or browser native dialogs:

| Method                                            | Return                    |
| ------------------------------------------------- | ------------------------- |
| `os.dialog.alert(title, message)`                 | `Promise<void>`           |
| `os.dialog.confirm(title, message)`               | `Promise<boolean>`        |
| `os.dialog.prompt(title, message, defaultValue?)` | `Promise<string \| null>` |
| `os.dialog.fileOpen(options?)`                    | `Promise<string \| null>` |
| `os.dialog.fileSave(options?)`                    | `Promise<string \| null>` |
| `os.dialog.openDirectory(options?)`               | `Promise<string \| null>` |

`FileDialogOptions`: `{ defaultFileName?: string; initialPath?: string }`

**Never use browser native alerts, prompts, or confirms. Always use `os.dialog.*`.**

### DOM Utilities - `src/shared/domUtils.js`

Import and use these instead of direct DOM manipulation:

```javascript
import { $, $$, bindEvent, toggleClass, setText, setHTML, createElement } from "../shared/domUtils.js";
```

| Function                                      | Parameters                                                          | Purpose                                                                     |
| --------------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `$(selector, root)`                           | selector: string, root: Document = document                         | Query single element (querySelector)                                        |
| `$$(selector, root)`                          | selector: string, root: Document = document                         | Query all elements (querySelectorAll)                                       |
| `queryAll(selectors, root)`                   | selectors: string[], root: Document = document                      | Query multiple selectors, returns object mapping                            |
| `bindEvent(element, event, handler, options)` | element: Element, event: string, handler: Function, options: Object | Add single event listener                                                   |
| `bindEvents(element, events)`                 | element: Element, events: Object                                    | Add multiple event listeners                                                |
| `toggleClass(element, className, condition)`  | element: Element, className: string, condition: boolean             | Toggle class with optional condition                                        |
| `addClass(element, className)`                | element: Element, className: string                                 | Add class to element                                                        |
| `removeClass(element, className)`             | element: Element, className: string                                 | Remove class from element                                                   |
| `setClasses(element, classes)`                | element: Element, classes: string                                   | Set element className                                                       |
| `setStyle(element, styles)`                   | element: Element, styles: Object                                    | Apply multiple styles to element                                            |
| `setText(element, text)`                      | element: Element, text: string                                      | Set element textContent                                                     |
| `setHTML(element, html)`                      | element: Element, html: string                                      | Set element innerHTML                                                       |
| `createElement(tag, options)`                 | tag: string, options: Object                                        | Create element with options (className, id, text, html, attributes, styles) |

### General Utilities - `src/utils/utils.js`

Common utility functions like `formatSize`, `isImageFile`, `isTextFile`, `pluralize`.

### Other shared helpers

| File                  | Exports                                                                                             |
| --------------------- | --------------------------------------------------------------------------------------------------- |
| `contextMenu.js`      | `showContextMenu`, `showDynamicContextMenu`, `showStartStyleMenu`, `positionMenu`, `hideMenu`, `refreshIcons` |
| `assetResolver.js`    | `resolveUrl`, `resolveYukiAsset`, `fetchHtmlAsBlobUrl`, `resolveIconUrl`, `resolveWallpaperUrl`      |
| `fileKindDetector.js` | `FileKind`, `fileKindFromName`, `getExt`, plus extension arrays (`IMAGE_EXTS`, `CODE_EXTS`, ...)    |
| `cdnConfig.js`        | `CDN_CONFIG`, `getLibraryUrl`, `getRepoUrl`                                                         |
| `iconUtils.js`        | `isFontAwesomeIcon`, `resolveIconHtml`, `resolveDesktopIcon`                                        |
| `platformUtils.js`    | `isMobile`, `isTouchDevice`                                                                         |
| `coreMap.js`          | `CORE_EXTENSIONS`, `EXT_TO_CORE`, `ROM_EXTS`                                                        |
| `weatherCodes.js`     | `WEATHER_CODES`, `getWeatherIcon`, `getWeatherInfo`                                                 |
| `dialogs.js`          | `showAlert`, `showPrompt`, `showConfirm`, `customAlert`, `customPrompt`, `customConfirm`            |
| `selectMenu.js`       | `renderSelectMenu`, `getSelectMenuValue`, `setSelectMenuValue`, `bindSelectMenu`                    |
| `rangeSlider.js`      | `renderRangeSlider`, `getRangeSliderValue`, `setRangeSliderValue`, `bindRangeSlider`                |
| `themeEngine.js`      | `getAllThemes`, `getBasicThemes`, `getSpecialThemes`, `getThemeByValue`, `getThemeColors`, `addCustomTheme` |
| `dragUtils.js`        | `makeDraggable`, `makeResizable`                                                                    |

### Storage

Always use `os.storage` API instead of bare `localStorage`:

```javascript
import { StorageKeys, os } from "../framework.js";

// Read (os.storage is synchronous)
const value = os.storage.get(StorageKeys.MY_KEY);

// Write
os.storage.set(StorageKeys.MY_KEY, value);
```

Always use `src/framework.js` barrel for app-level imports. Import common dependencies
(`{ BaseApp, PersistenceTypes, os, StorageKeys, APP_MANIFESTS }`) from there instead of separate modules. Always use
StorageKeys from `src/StorageKeys.js` for localStorage access. Never hardcode localStorage key strings.

### File/Directory Selection Dialogs

Use Explorer app's built-in dialog methods:

```javascript
const explorerApp = this.services.explorerApp;

// Save dialog
explorerApp.openSaveDialog("myfile.txt", (path, filename) => {
  const fullPath = path.join("/");
  const filePath = `${fullPath}/${filename}`;
  await os.fs.write(fullPath, filename, content);
});

// Directory selection
explorerApp.openDirectoryDialog((path) => {
  const pathStr = path.join("/");
  await os.fs.mkdir(pathStr);
});

// File selection
explorerApp.open(["Documents"], (selectedPath) => {
  console.log("Selected file:", selectedPath);
});
```

---

## Build & Deployment

```bash
# Development server
pnpm run dev

# Development build (validates the app registry via prebuild)
pnpm run build:dev

# Production build
pnpm run build

# Single-file build
pnpm run build:single

# Preview production build
pnpm run preview

# Electron build
pnpm run build:electron

# Tests (Vitest)
pnpm run test
```

Single-file build output is supported for easy deployment.

## Electron Mode

When running as an Electron app, the virtual IndexedDB filesystem is replaced with the real local filesystem:

- **Root directory**: `<userData>/home/<sessionKey>/` where `userData` resolves to:
  - **Linux**: `~/.config/yukios-desktop/`
  - **macOS**: `~/Library/Application Support/yukios-desktop/`
  - **Windows**: `%APPDATA%\yukios-desktop\`
- Virtual paths like `/home/Guest/Desktop` map directly to real directories on disk
- Binary files are stored as regular files (no separate blob store)
- Metadata files (`.meta.json`) are real dotfiles in each directory
- The storage swap happens in `FileSystemManager` constructor in `src/fs.js` by detecting `window.electronAPI.electronFs`

```bash
# Run in Electron
pnpm electron:dev

# Build Electron distribution
pnpm electron:build
```

---

## Important Rules

- Never run `pnpm format`.
- Never add comments anywhere — not in JS, HTML, or CSS.
- Always use CSS variables defined at `:root` from `src/styles/style.css`. Never hardcode colors.
- Always use `src/framework.js` barrel for app-level imports (`{ BaseApp, PersistenceTypes, os, StorageKeys, MODES, APP_MANIFESTS, BusEvents }`).
- Whenever you define a new app in the manifest, define a `description` for it in the `APP_MANIFESTS` entry in `src/registry/AppManifest.js`.
- When making significant changes, new features, or new apps: add a news entry to `EXISTING_NEWS_UPDATES` in `src/apps/news.js` with a punchy, active-voice description under 15 words.
- Always use StorageKeys from `src/StorageKeys.js` for localStorage access.
- Always use `os.storage` API instead of bare `localStorage`.
- Never use browser native alerts, prompts, or confirms. Always use `os.dialog` API (`os.dialog.alert()`, `os.dialog.confirm()`, `os.dialog.prompt()`, `os.dialog.fileOpen()`, `os.dialog.fileSave()`, `os.dialog.openDirectory()`).
- Never use `document.querySelector`, `document.querySelectorAll`, or direct DOM manipulation methods. Always use utility functions from `src/shared/domUtils.js`.
- Never use `this.wm.*`; always use the `os.window` module for window operations.
- Always use `KeybindManager` from `src/keybindManager.js` for keyboard shortcuts instead of raw `keydown` listeners with hardcoded key checks.
- Use `os.notify.send()` for discrete, user-facing application events that represent a state change or completion. Never emit notifications from high-frequency or continuously-updating processes.
- When applying changes to multiple files (2+ files), launch multiple concurrent Task sub-agents in a single message — one sub-agent per non-overlapping set of files.

---

## Need Help?

- Join the [Discord](https://discord.gg/wufbWFwr4G) community
- Check the [AGENTS.md](AGENTS.md) for detailed technical reference
- Review existing apps in `webos-desktop/src/apps/` for examples
