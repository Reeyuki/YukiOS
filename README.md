# Yuki OS — Browser-Based Desktop Environment

https://discord.gg/uFuGfseB9Z

> A webOS-style desktop environment running in the browser, featuring 30+ applications, 3700+ games, multiple emulators, and a service-oriented architecture for seamless multitasking.

Yuki OS is a fully-featured browser-based operating system that unifies games, emulators, productivity tools, and web applications into a single windowed desktop experience. Run Flash games, DOS emulation, modern web apps, and custom applications all side-by-side with a shared window manager, filesystem, and UI.

Its built entirely in pure, framework-free vanilla JS.

![yukios-1-os](.github/yukios-1-os.webp)
![notepadexplorerweather](.github/notepadexplorerweather.webp)
![browser](.github/browser.webp)
![achievements](.github/achievements.webp)

---

## ✨ Key Features

### Desktop Environment
- **Windowed multitasking** — Drag, resize, snap, minimize, maximize windows
- **Drag-to-snap** — Drag windows to edges (half screen) or corners (quarter screen)
- **Keyboard snapping** — Win+Left/Right (snap halves), Win+Up (maximize), Win+Down (restore/minimize)
- **Alt+Tab** — Switch between open windows
- **Win+D** — Show/hide desktop (minimize or restore all windows)
- **File drag-and-drop** — Drag files from host OS to desktop
- **Virtual filesystem** — BrowserFS-backed persistent storage (IndexedDB)
- **Start menu & taskbar** — Launch apps, view running windows, manage focus
- **Window preview on taskbar hover** — Tab peek-style window previews
- **Desktop icons** — Shortcut organization with auto-refresh
- **Wallpapers & themes** — 13 built-in + custom wallpaper support
- **User profiles** — Custom username, profile picture, desktop colors

### Application System
- **30+ built-in apps** — File explorer, terminal, editor, settings, media players, utilities
- **3700+ games** — Browser games, emulated classics, Flash content via Ruffle
- **AppLauncher** — Central dispatcher that routes app IDs to app instances or iframe games
- **gamesList.js** — Registry of all apps/games with metadata (title, icon, type, URL)
- **BaseApp inheritance** — All system apps extend BaseApp with open() and onClose() lifecycle

### Multi-Runtime Support
- **Ruffle Flash emulation** — Play .swf files
- **JS-DOS** — DOS games with full emulation
- **V86** — Full x86-64 system emulation (Linux, Windows, FreeBSD)
- **WebAssembly** — Native web apps
- **HTML5 games** — Canvas, WebGL content
- **iframes & sandboxing** — Secure app isolation

### System Features
- **Notifications** — Toast popups with Do-Not-Disturb mode
- **File operations** — Create, read, write, organize files and directories
- **Settings** — Persistent preferences (theme, wallpaper, volume)
- **Achievements** — Track app launches, playtime milestones
- **Analytics** — Usage statistics and event tracking
- **Audio mixer** — Per-app volume control with master volume
- **CORS proxy** — Access restricted content via proxy configuration
- **Command Palette** — Global launcher and system shell via Ctrl+K / F1
- **Session Persistence** — Restores windows, layout, and app state across reloads
- **Import / Export System** — Backup and migrate full system state and user configuration
- **Workspace System** — Multiple virtual desktops for organizing tasks and workflows
- **PWA & Offline Support** — Installable webOS with full offline capability via service worker
- **Turbo Mode** — Performance optimization for resource-intensive applications
- **Window Management Engine** — Advanced z-ordering, drag system, snapping, and lifecycle control
- **Unified System Ecosystem** — Core system apps interconnected through shared services for consistency
- **URL Parameters** — Direct launch via `?app=appId` or `?game=gameId`
- **Calendar System** — Calendar popup with event management and date tracking
- **Clippy Assistant** — Animated desktop helper with contextual tips
- **Global Keyboard Shortcuts** — Ctrl+D (show/hide desktop), Ctrl+arrows (window snapping), file operations shortcuts
- **Session Management** — Login screen with user sessions and 15-minute auto-login
- **Window Transparency** — Dynamic transparency that hides when games are running
- **Right-Click Context Menus** — Context menus for desktop, files, and apps
- **Taskbar Positioning** — Configurable taskbar position (bottom/top/left/right)
- **Window Snapping** — Keyboard-based window snapping to screen edges

---

## 🚀 Quick Start

### For Users

1. **Open in browser** — Single-file HTML deployment
2. **Explore apps** — Click Start Menu, browse 30+ applications
3. **Create shortcuts** — Use App Creator to add custom apps
4. **Manage files** — Use Explorer to organize filesystem
5. **Customize** — Change theme, wallpaper, and preferences in Settings

### For Developers

**Prerequisites:**
```bash
Node.js 16+ and npm/pnpm
```

**Setup:**
```bash
cd webos-desktop
npm install
npm run dev          # Start dev server with HMR
npm run build        # Compile to single HTML file
npm run preview      # Test production build
```

**Output:**
- Development: `http://localhost:5173`
- Production: `dist/index.html` (single file, all assets inlined)

## 🏗️ Architecture Overview

**main.js** initializes core services and app instances:

```
main.js
├── Services initialization
│   ├── WindowManager (windowManager.js)
│   ├── FileSystemManager (fs.js)
│   ├── NotificationCenter (notificationCenter.js)
│   └── EventBus (core/EventBus.js)
├── App instantiation
│   ├── System apps (Explorer, Terminal, Notepad, etc.)
│   ├── Emulators (JsDosApp, V86App, emulatorApp)
│   └── Utilities (Settings, TaskManager, Weather, etc.)
└── AppLauncher registration
    └── Routes app IDs to instances or iframe games
```

**App pattern:** System apps receive individual service references in constructor:

```javascript
class ExplorerApp extends BaseApp {
  constructor(wm, fs, bus, notifications) {
    super(wm, fs, bus, notifications);
    this.wm = wm;
    this.fs = fs;
    this.bus = bus;
    this.notifications = notifications;
  }

  open(path) {
    const win = this.wm.createWindow(...);
    // app logic
  }

  onClose(winId) {
    // cleanup
  }
}
```

**Games and external apps** are registered in `gamesList.js` with type (game/swf/html/remote/system) and launched via `AppLauncher.launch(appId)`.

---

## 🛠️ Adding a New Application

**For system apps (with custom UI):**

1. Create app class in `src/apps/` extending BaseApp
2. Implement `open()` method that creates window via `this.wm.createWindow()`
3. Implement `onClose(winId)` for cleanup
4. Add to AppLauncher constructor in `src/appLauncher.js`
5. Add entry to `localAppMap` in AppLauncher with title and action

**For external games/apps (iframe-based):**

1. Add entry to `appMap` in `src/gamesList.js`
2. Set type: `game` (HTML), `swf` (Flash), or `remote` (external link)
3. Provide URL and icon path
4. AppLauncher handles iframe creation automatically

For detailed steps, see [AGENTS.md — How to Add a New Application](AGENTS.md#how-to-add-a-new-application)

---

## 📦 Built-in Applications

### System Tools (20+)
- **Explorer** — File manager with thumbnails and drag-drop
- **Terminal** — CLI shell with commands (ls, cd, mkdir, rm, etc.)
- **Notepad** — Text editor with save/load
- **Markdown Editor** — Live preview markdown
- **Yuki Code (Monaco)** — VS Code-powered code editor
- **Calculator** — Scientific calculator
- **Settings** — User preferences and configuration
- **Task Manager** — Window monitoring and control
- **About** — System information
- **Shortcuts** — Keyboard shortcut management and command palette
- **Yuki Convert** — Unit converter and calculation tool
- **Storage Editor** — Direct filesystem and database editing
- **Setup Wizard** — Initial system configuration and onboarding
- **Customize Profile** — User profile and avatar customization
- **What's New** — System news and updates viewer
- **System Apps** — Central app organization and launcher

### Emulators & Games (15+)
- **Steam Game Launcher** — Browse 3700+ games with store pages
- **JS-DOS** — DOS game emulation with Ruffle Flash support
- **V86 (Virtual 86)** — Full x86-64 system emulation
- **Yuki Emulator** — Retro console emulation (GBA, NDS, SNES, PSP, Sega)
- **Ruffle** — Flash game and animation player
- **Azahar** — Nintendo 3DS emulator
- **Categories** — Game organization by genre and tag
- **Flash Games** — Classic Flash content via Ruffle

### Media & Utilities (15+)
- **Yuki Browser** — Lightweight web browser
- **Camera** — Webcam capture and photo taking
- **Yuki Blender (3D Viewer)** — Three.js for OBJ/GLTF/GLB models
- **YouTube Utilities** — Video embedding and playback
- **News** — News aggregation and categories
- **Weather** — Weather forecasting and current conditions
- **Office Viewer** — DOCX, XLSX, XLS, CSV, ODT, PDF, ODP, PPTX, PPT, TXT, HTML
- **Archive Extractor** — ZIP/7z extraction utility
- **App Creator** — Custom app shortcuts to external URLs
- **Paint** — Image editing and drawing tool
- **Photopea** — Advanced photo editing (PSD support)
- **LibreSprite** — Pixel art and sprite editor
- **kiwiIRC** — IRC chat client
- **Evil Spotify** — Music streaming interface

---

## 🔧 Build & Deployment

### Build Process

```bash
npm run build     # Single-file bundle
npm run format    # Prettier code formatting
npm run lint      # ESLint with auto-fix
```

### Output

Single HTML file with all assets inlined:
- JavaScript minified
- CSS inlined
- Images as base64
- No external dependencies (except CDN game content)

### Deployment

Serve `dist/index.html` from:
- Root: `https://example.com/`
- Subdirectory: `https://example.com/desktop/`

**Tech Stack:**

* **Vite** — Fast build tool
* **viteSingleFile** — Single-file bundling
* **BrowserFS** — Virtual filesystem
* **Font Awesome** — Icon Pack
* **IndexedDB** — Persistent storage
* **interactjs** — Window dragging/resizing
* **Ruffle** — Flash emulation
* **EmulatorJS** — Retro video game console emulation
* **Monaco** — Code editor
* **Three.js** — 3D rendering
* **PDF.js** — PDF rendering and viewing
* **Mammoth.js & docx** — Word document processing
* **SheetJS (xlsx) & Handsontable** — Spreadsheet data parsing and viewing grids
* **7z-wasm & JSZip & fflate** — High-performance archive extraction (7z, zip, deflate)
* **Clippy.js** — Interactive desktop assistant animations

---

## 📚 Documentation

- **[AGENTS.md](AGENTS.md)** — Complete architecture reference, all services and agents, integration guide

---

## 🎮 Playing Games

### Adding Custom Games
1. Open **App Creator**
2. Enter game URL
3. Optional: Configure CORS proxy
4. Save to Apps folder
5. Access from Explorer or Start Menu

### Supported Formats
- HTML5 games
- Flash games (via Ruffle)
- DOS games (via JS-DOS)
- GBA, NDS, SNES ROMs (via emulators)
- WebAssembly applications

## 🚦 Development Workflow

```bash
npm run dev        # Start dev server, watch for changes
                   # http://localhost:5173

npm run build      # Compile to production
                   # Output: dist/index.html

npm run preview    # Test production build locally

npm run format     # Format code with Prettier

npm run lint       # Check and fix ESLint issues
```
## 📜 License

Platform code is licensed under the project license.

External components remain under their respective licenses:
- Ruffle (Flash emulation)
- JS-DOS (DOS emulator)
- V86 (x86 emulation)
- Monaco (VS Code editor)
- Three.js (3D rendering)
- Game assets and ROMs (their original owners)

---

## 🌟 Highlights

- **Single-file deployment** — Vite bundles everything into `dist/index.html` (JS, CSS, assets inlined)
- **BrowserFS filesystem** — IndexedDB-backed virtual storage with directory structure
- **AppLauncher routing** — Single dispatcher handles system apps, iframe games, and external URLs
- **Window management** — Drag, resize, snap, minimize, maximize with z-ordering
- **Multi-runtime support** — Ruffle (Flash), JS-DOS (DOS), V86 (x86), EmulatorJS (consoles)
- **Setup wizard** — First-run configuration for theme, wallpaper, taskbar, and settings
