# Yuki OS Architecture Guide
Never add comments or docstrings
Never spawn a browser for testing
## Overview

Yuki OS is a browser-based webOS-style desktop environment that emulates a complete operating system within the web browser. It provides a unified windowed interface for 30+ built-in applications, 100+ games, multiple emulators (DOS via JS-DOS, x86 via V86), productivity tools, and system utilities. Everything runs in a sandboxed environment with persistent file storage, notifications, settings, and a virtual filesystem.

**Key Capabilities:**
- Windowed desktop with drag, resize, snap, minimize/maximize
- Virtual filesystem (BrowserFS) with IndexedDB persistence
- Game/app support: Ruffle Flash, WebAssembly, native emulators
- Desktop notifications, user profiles, achievements, analytics
- Service-oriented architecture with dependency injection
- Single-file HTML deployment with PWA support

---

## Architecture Overview

Yuki OS uses a **service-oriented, event-driven architecture** with a central services container that all applications depend on.

**Core Pattern:**

```
main.js initializes services
    ↓
Services Container (WindowManager, FileSystemManager, NotificationCenter, EventBus)
    ↓
30+ Applications (all inherit BaseApp, receive injected services)
    ↓
Desktop UI renders windows, taskbar, start menu
```

Every application follows a consistent lifecycle:

1. **Instantiation** — App receives services: `new ExplorerApp(services)`
2. **Registration** — App attached to services object
3. **Launch** — User clicks app → AppLauncher dispatches
4. **Open** — App's `open()` creates window via WindowManager
5. **Running** — Window receives user input, lifecycle events
6. **Close** — `onClose(winId)` cleanup hook called

---

## Core Services

All applications receive these injected services in their constructor.

### WindowManager
**File:** `webos-desktop/src/windowManager.js`

Manages window lifecycle, z-ordering, dragging, resizing, snapping, and taskbar integration.

| Method | Purpose |
|--------|---------|
| `createWindow(id, title, width, height, isGame)` | Create styled window element |
| `mountWindow(win, winId, title, iconValue)` | Attach to desktop, make draggable/resizable, add taskbar |
| `bringToFront(win)` | Raise z-index, focus window |
| `closeWindow(win)` | Close window, cleanup, remove from taskbar |
| `minimizeWindow(win)` | Hide window, mark taskbar minimized |
| `maximizeWindow(win)` | Expand/restore window |

**Features:** Window snapping (Win+Arrow), workspace management, taskbar preview, Steam integration

---

### FileSystemManager
**File:** `webos-desktop/src/fs.js`

Virtual filesystem backed by BrowserFS with persistent storage via IndexedDB.

| Method | Purpose |
|--------|---------|
| `async readFile(path)` | Read file content |
| `async safeWriteFile(path, content)` | Write file (string/Uint8Array) |
| `async readdir(path)` | List directory contents |
| `async mkdir(path)` | Create directory |
| `async unlink(path)` | Delete file |
| `async stat(path)` | Get file metadata |
| `async copy(src, dst)` | Copy file/directory |

**Default Structure:**
```
/home/reeyuki/
├── Desktop/              (desktop icons)
├── Documents/INFO.txt
├── Pictures/Wallpapers/  (13 default + custom)
└── Apps/                 (user-created shortcuts)
```

**File Types (FileKind):**
- TEXT — .txt, .md, .json, .js, .css
- IMAGE — .png, .jpg, .webp, .gif
- VIDEO — .mp4, .webm, .mov, .avi
- AUDIO — .mp3, .wav, .ogg, .flac
- ROM — .bin, .gba, .nds, .snes (emulator files)
- OTHER — .zip, .exe, unknown types

---

### NotificationCenter
**File:** `webos-desktop/src/notificationCenter.js`

Desktop notifications with Do-Not-Disturb mode, toast popups, and persistent history.

| Method | Purpose |
|--------|---------|
| `notify(title, message, type, duration, icon)` | Show toast notification |
| `setDND(enabled)` | Toggle Do-Not-Disturb mode |
| `getNotifications()` | Get notification history |

---

### EventBus
**File:** `webos-desktop/src/core/EventBus.js`

Global pub-sub for cross-app communication without tight coupling.

| Method | Purpose |
|--------|---------|
| `on(eventType, handler)` | Register listener |
| `off(eventType, handler)` | Unregister listener |
| `emit(eventType, ...args)` | Fire event to all listeners |

**Standard Events:**
- `SETTINGS_CHANGED` — User changed a preference
- `WINDOW_CREATED`, `WINDOW_FOCUSED`, `WINDOW_CLOSED` — Window lifecycle
- `FILE_CHANGED` — Filesystem change detected

---

## Key Agents by Category

### Application Management

**AppLauncher** (`appLauncher.js`)
- Central dispatcher for all app launches
- Routes to app instance or creates iframe for games
- Handles analytics, achievements, Steam stats tracking
- Method: `launch(appId, swf, extra)` → main entry point

**gamesList** (`gamesList.js`)
- Registry of 100+ games/apps with metadata
- `appMap` object where each key is app ID with type, title, url, icon

**gameDescriptions** (`gameDescriptions.js`)
- Rich metadata: title, description, genre, year, developer

**appCreator** (`appCreator.js`)
- UI for creating custom app shortcuts to external URLs
- Auto-detects favicon, supports CORS proxy per app
- Saves to `/home/reeyuki/Apps/` filesystem

---

### File & Explorer System

**ExplorerApp** (`explorer.js`)
- File manager with directory navigation, thumbnails, drag-drop
- `open(path)`, `navigateTo(path)`, `deleteFile(path)`, `renameFile(old, new)`

**fileDisplay** (`fileDisplay.js`)
- Renders different file types: images, videos, PDFs, code, text, markdown

**archiveExtractor** (`archiveExtractor.js`)
- ZIP/7z extraction utility, list archive contents

---

### Productivity Apps

**NotepadApp** — Text editor, file save/load

**MarkdownApp** — Split-pane markdown editor with live preview

**YukiCode** (`monaco.js`) — Yuki Code is a remake of the open-source monaco editor that powers Visual Studio Code, and is integrated into Yuki OS

**CalculatorApp** — Scientific calculator with memory functions

**OfficeAppProxy** (`office.js`) — Office 365 viewer for .docx, .xlsx, .pptx

---

### Media & Emulators

**Camera** — Webcam access, photo capture

**Model3DApp** (`model3d.js`) — Three.js 3D viewer (OBJ, GLTF, GLB)

**YouTubeApp** — YouTube integration

**JsDosApp** (`jsdos.js`) — DOS game emulation with Ruffle Flash support

**V86App** (`v86.js`) — x86-64 full system emulation

---

### System Utilities

**TerminalApp** — CLI shell with commands: ls, cd, mkdir, rm, cp, mv, cat, pwd, etc.

**TaskManagerApp** — Window/process list, resource monitor, close apps

**SettingsApp** — User preferences: theme, wallpaper, taskbar position, sound, DND, transparency, language

**ProfileCustomizerApp** — Edit username, profile picture, desktop colors

**AchievementsApp** — Track apps launched, games played, playtime milestones

**AboutApp** — System info, version, credits

**newsApp** (`news.js`) — News aggregation with categories

**WeatherApp** (`weather.js`) — Current weather and forecast

**CategoriesApp** (`categories.js`) — Organize games by genre/tag

---

### System Services

**DesktopUI** (`desktopui.js`) — Desktop background, taskbar, start menu rendering

**startMenu** (`startMenu.js`) — Start menu and app grid UI

**system.js** — Wallpaper and theme management

**wallpapers.js** — Wallpaper store (13 default + user custom)

**settings.js** — Preference storage layer (localStorage wrapper)

**audioMixer.js** — Global audio control, per-app volume

**profileCustomizer.js** — User profile UI

**analytics.js** — Usage tracking (app launches, playtime, features)

**clippy.js** — Virtual assistant with contextual tips and animations

**BrowserApp** — Lightweight web browser with bookmarks

---

## How to Add a New Application

**Step 1:** Create app class inheriting BaseApp
```
Implement constructor(services) with injected services
Implement open(options) to create window
Implement onClose(winId) for cleanup
```

**Step 2:** Register in `main.js`
```
const myApp = new MyApp(services);
services.myApp = myApp;
Pass to AppLauncher constructor and then update appLauncher.js code
```

**Step 3:** Add metadata to `gamesList.js`
```
appMap.myAppId = {
  type: "system" | "game" | "html" | "remote",
  title: "My App",
  url: "optional/path",
  icon: "fa-star",
  action: () => appLauncher.myApp.open()
}
```

**Step 4:** Implement lifecycle hooks
```
open(options = {}) {
  const winId = "myapp-window";
  const win = this.services.windowManager.createWindow(winId, "Title");
  win.innerHTML = "...ui...";
  document.body.appendChild(win);
  this.services.windowManager.mountWindow(win, winId, "Title", "icon");
  this.openWindows.add(winId);
}

onClose(winId) {
  this.openWindows.delete(winId);
}
```

**Step 5:** Use services
```
File I/O: this.services.fileSystem.readFile(path)
Notifications: this.services.notificationCenter.notify(title, msg)
Events: this.services.eventBus.on("SETTINGS_CHANGED", handler)
Launch apps: this.services.appLauncher.launch("appId")
```

---

## Quick Reference

### Services Injection Pattern

All apps receive services in constructor:
```
constructor(services) {
  this.services = services;
  this.services.windowManager      // Window lifecycle
  this.services.fileSystem          // File operations
  this.services.notificationCenter  // Notifications
  this.services.eventBus            // Event pub-sub
  this.services.appLauncher         // App dispatcher
}
```

### Storage Keys (Settings)

| Key | Type | Default |
|-----|------|---------|
| theme | "light"\|"dark"\|"auto" | "auto" |
| wallpaper | string | "wallpaper1.webp" |
| taskbarPosition | "top"\|"bottom" | "bottom" |
| soundEnabled | boolean | true |
| dnd | boolean | false |
| windowTransparency | 0-1 | 1 |
| language | string | "en" |

### Content Delivery

**CDN Bases:**
- Main: `https://cdn.statically.io/gh/reeyuki/yukios@a3efea2218a5d717290e72ea41cd341d14689ce5`
- Games: `https://cdn.statically.io/gh/reeyuki/yukios-games@main`

**CORS Proxy:** Apps can enable proxy via appCreator for blocked URLs

**HTML Sandboxing:** `fetchHtmlAsBlobUrl()` converts HTML to blob:// for secure execution

---

## Troubleshooting

**App not in start menu?** → Check gamesList.js registration and AppLauncher constructor

**Window won't close?** → Verify onClose() implementation and cleanup of event listeners

**File not displaying?** → Check FileKind detection or set manually in file object

**CORS errors?** → Use proxy system or fetchHtmlAsBlobUrl() for sandboxing

**Audio conflicts?** → Use audioMixer.createAudioTrack(appId) for per-app volume control

---

## Key Interaction Flows

**App Launch:**
User clicks → AppLauncher.launch(appId) → Routes to app.open() → WindowManager.createWindow() → Window displayed with taskbar button

**File Operations:**
App writes to fileSystem → BrowserFS saves to IndexedDB → If Desktop path, notify DesktopUI → Desktop icons refresh

**Settings Change:**
SettingsApp.setSetting(key, value) → localStorage updated → EventBus.emit(SETTINGS_CHANGED) → Listening apps react

**Game Launch:**
AppLauncher checks game type → openIframeApp() → Resolves CDN URLs → Creates sandboxed iframe → Emulator/renderer loads

---

## Build & Deployment

**Tech Stack:** Vite 7.3.1, single-file HTML bundle with viteSingleFile plugin

**Build Scripts:**
```
npm run dev      — Dev server with HMR
npm run build    — Compile to dist/index.html (single file)
npm run preview  — Preview production build
npm run format   — Prettier formatting
npm run lint     — ESLint auto-fix
```

**Output:** Single HTML file with all assets inlined (CSS, images as base64, JS minified)

**Deployment:** Serves from root or `/desktop/` path, no external dependencies except CDN game content

---

**For detailed integration examples, architecture diagrams, API reference, and troubleshooting, see the source files directly. Each agent is self-contained and documented in its respective file.**
