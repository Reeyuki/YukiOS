# YukiOS: Multi-Environment Desktop Hypervisor for the Browser

<div align="center">

[![License](https://img.shields.io/github/license/Reeyuki/yukios?style=for-the-badge&color=blue)](LICENSE)
[![Discord](https://img.shields.io/badge/Discord-Join-5865F2?style=for-the-badge&logo=discord)](https://discord.gg/wufbWFwr4G)

**Try it now:** [yukios.pages.dev](https://yukios.pages.dev) · [yukios.vercel.app](https://yukios.vercel.app) ·
[yukios.netlify.app](https://yukios.netlify.app) · [yukiwebos.github.io](https://yukiwebos.github.io)

</div>

> A frameworkless, browser-native multi-environment desktop hypervisor. Switch seamlessly between floating desktops
> (macOS, ChromeOS), dynamic BSP tiling (Hyprland), game consoles (Yuki Deck), all running on a single persistent
> client-side core built entirely in vanilla JavaScript.

YukiOS is not just another web desktop. It is a single browser tab that rewrites its entire window management paradigm,
UI chrome, input model, and workspace semantics at runtime without destroying open applications, file system state, or
user context. One session, six distinct desktop environments, zero frameworks.

It runs Flash, DOS, and console emulators, WebAssembly runtimes, and standard web apps side by side on a persistent
client-side filesystem, and it is built entirely in vanilla JavaScript without any frameworks.

---

## Screenshots

|                                                                                                             |                                                                                            |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| ![Mac Mode](https://raw.githubusercontent.com/Reeyuki/YukiOS/main/.github/mac.png)                          | ![YukiDeck](https://raw.githubusercontent.com/Reeyuki/YukiOS/main/.github/yuki-deck.png)   |
| ![ChromeOS Mode](https://raw.githubusercontent.com/Reeyuki/YukiOS/main/.github/chromeos.png)                | ![Start Menu](https://raw.githubusercontent.com/Reeyuki/YukiOS/main/.github/startmenu.png) |
| ![Workspaces](https://raw.githubusercontent.com/Reeyuki/YukiOS/main/.github/workspaces.png)                 | ![Widgets](https://raw.githubusercontent.com/Reeyuki/YukiOS/main/.github/widgets.png)      |
| ![WASM Terminal Apps](https://raw.githubusercontent.com/Reeyuki/YukiOS/main/.github/btop-lavat-cmatrix.png) | ![3D Os Mode](https://raw.githubusercontent.com/Reeyuki/YukiOS/main/.github/3d.png)        |
| ![Remote Desktop](https://raw.githubusercontent.com/Reeyuki/YukiOS/main/.github/remote.png)                 | ![Steam](https://raw.githubusercontent.com/Reeyuki/YukiOS/main/.github/steam.png)          |
| ![Steam Overlay](https://raw.githubusercontent.com/Reeyuki/YukiOS/main/.github/overlay.png)                 | ![Tiling Mode](https://raw.githubusercontent.com/Reeyuki/YukiOS/main/.github/tiling.png)   |

---

# Desktop Environments

YukiOS ships six complete desktop paradigms, each a first-class environment, not a skin or theme swap. Pick any mode
from the session picker at login, or switch live. Every mode shares the same running applications, open files,
persistent settings, and IndexedDB-backed filesystem.

## 🍎 macOS Shell

A full macOS-inspired desktop with top menu bar, animated fisheye dock, Launchpad, and Control Center.

- **Top menu bar** with Start Menu and Finder access through macOS-style category menus
- **Animated fisheye dock** where pinned apps scale and push neighbors on hover, open apps auto-pin, and items are
  draggable to reorder
- **Control Center tray** with brightness, volume, battery, power mode, dark mode, dock toggle, accent colors, and lock
  screen
- **Traffic light window buttons** on all window headers
- **Launchpad** (F4) with a fullscreen app grid, glassmorphism backdrop, live search, slide-from-dock animation, bigger
  icons on hover, and hover-zoom, pinned to the Dock in Mac Mode

## 🎮 Yuki Deck Mode

A fullscreen, animated and full-sfx game-console-style environment you can pick at login, controlled with a gamepad or
keyboard/mouse, with home feed and library management.

- **Home feed** with new releases, friends activity, and recommended games
- **Game library** to search, sort by name, mark favorites, and build collections
- **Quick Actions Panel** to manage deck quick settings and friends list
- **In-game overlay** (Shift+Tab) with playtime tracking, friends panel, screenshot capture, performance monitor, and
  in-overlay web browser

## 🌐 ChromeOS Mode

A lightweight, tab-centric web-first environment with a dedicated shelf layout optimized for browser workflows.

- Shelf-style taskbar with pinned web apps and running indicators
- Tab-oriented windowing model for rapid web app switching
- Simplified system tray with essential controls
- Lightweight profile optimized for lower-resource machines

## 🔲 Hyprland BSP Tiling Mode

A keyboard-driven Binary Space Partitioning tiling window manager inspired by Hyprland, switchable from the session
picker, with per-workspace tree layouts and live config reloading.

- **Alt+Space** toggles tiling on/off; **Alt+Arrow** moves focus, **Ctrl+Alt+Arrow** resizes boundaries,
  **Alt+Shift+Arrow** swaps windows
- **9 independent workspaces** (Alt+1-9), each with its own BSP tree; **Alt+Q** closes focused window, **Alt+F** toggles
  floating, **Alt+T** spawns terminal
- **Drag-to-swap**: drag a tiled window onto another to swap positions in the tree
- **Live config**: gap, border width, and split ratio adjustable from Settings > Tiling or the config file at
  `Config/yukiOs/tiling.conf` (live-reload on save); customizable with gaps (inner/outer), split ratio, border
  width/radius, resize step, animation duration/easing, mouse resize toggle, workspace switch delay, and resize debounce
- **hyprctl** terminal command for Hyprland-style CLI control

## 🧊 3D OS Mode

A 3d fps game where player can walk around in a room and interact with computer monitor, grab and launch game cases that
hide game and open inside os page, or play sorting minigame

## ⚡ Yuki Native Session

The default hybrid desktop layout, a modern, high-density multitasking environment blending familiar desktop conventions
with YukiOS-specific innovations.

- Full floating window management with snapping, workspaces, and animations
- Desktop widgets, system tray, notification center
- Start menu with fuzzy search, favorites, and category management
- Configurable taskbar placement on any screen edge

---

## Architecture

YukiOS uses a shared-state architecture. Switching from Hyprland tiling to macOS shell does not destroy your open
applications, file system, or workspace context. The UI layout engine morphs around the running state.

```
                      ┌───────────────────────────────────────┐
                      │        YukiOS Central Core            │
                      │  (Global Process Map & App Layer)     │
                      └──────────────────┬────────────────────┘
                                         │
        ┌────────────────────────────────┼────────────────────────────────┐
        │                                │                                │
        ▼                                ▼                                ▼
┌─────────────────┐            ┌─────────────────┐            ┌─────────────────┐
│   macOS Shell   │            │ Hyprland Shell  │            │  ChromeOS       │
│ (Dock & TopBar) │            │ (BSP Tiling)    │            │  (Minimal shelf)│
└───────┬─────────┘            └────────┬────────┘            └────────┬────────┘
        │                               │                              │
        ├───────────────────────────────┼──────────────────────────────┤
        │                               │                              │
        ▼                               ▼                              ▼
┌─────────────────┐            ┌─────────────────┐            ┌─────────────────┐
│  Yuki Deck UI   │            │ GNOME Shell     │            │Windows(Upcoming)│
│ (Gamepad Focus) │            │   (Upcoming)    │            │ (XP/Win7/10/11) │
└───────┬─────────┘            └────────┬────────┘            └────────┬────────┘
        │                               │                              │
        └───────────────────────────────┼──────────────────────────────┘
                                        │
                                        ▼
                    ┌───────────────────────────────────────┐
                    │    Single DOM Window Orchestrator     │
                    │  (Mounted Apps · EventBus · VFS Layer)│
                    ├───────────────────────────────────────┤
                    │     BrowserFS / IndexedDB Persistence │
                    └───────────────────────────────────────┘
```

### Under the Hood

- **Persistent Runtime:** Open apps, files, and state survive desktop mode swaps—only the window manager and shell UI
  change.
- **Pure Vanilla JS:** Zero runtime UI framework overhead.
- **Custom BSP Engine:** Real-time binary tree tiling with live configuration updates and `hyprctl` CLI controls.
- **Full Session Survival:** Complete state serialization backed by IndexedDB.

---

<details>
<summary><strong>🖥 Desktop Window Management</strong></summary>

- Draggable, resizable, minimizable, maximizable windows
- Window snapping (half screen, quarter screen, fullscreen)
- Multiple workspaces with independent layouts
- Window switching and focus cycling (Alt+Q)
- Window context menus (snap, move, pin, workspace transfer)
- Window header context menus and title bar icons (double-click to close)
- Taskbar positioned on any screen edge
- Taskbar drag-to-reorder and click to minimize/restore
- Live taskbar window preview on hover
- System tray with background-running apps
- Tray icon scroll actions for audio, brightness, and workspace switching
- Tray context menus with per-item quick actions
- Desktop icon system with persistent shortcuts and image thumbnails
- Desktop drag-and-drop from host OS and icon rearrangement
- Alt+Left-Click window drag / Alt+Right-Click window resize
- Window animation system with 35+ effects
- KDE-inspired physics-based wobbly windows when dragging
- Desktop peek button (minimize/restore all windows, hover to reveal desktop)
- Cursor launch effect when applications start
- Desktop widgets: clock, weather, notes, calendar, todo, music controls, system monitor, battery, clipboard, YouTube
  embed, photo frame slideshow, timer/stopwatch

</details>

<details>
<summary><strong>🧭 Navigation & Input</strong></summary>

- Start menu with:
  - Fuzzy search across all apps and settings categories
  - Favorites system with gold-tinted highlights and a dedicated favorites page
  - Customizable app grid (add/edit/remove) and category management (rename, delete/hide, restore)
  - App grid organized into categories: Core, Web, Games, Files
  - Desktop icon toggles to show/hide Games and System Apps independently
  - User profile display with avatar, name, and hover tooltip
  - Description tooltips on hover for all items
  - Recent page tracking last-opened apps and files
  - Full keyboard navigation and persistent settings for width, height, and category visibility
  - Clippy contextual tips on favorites and search events
- Notification system with app icons and actions; notification center with grouped messages, Do Not Disturb mode, and
  notification positioning controls
- Animated UI components including start menu, wallpaper switcher, audio mixer, context menus, and notifications
- Desktop and file context menus: New Folder/Document, Add from OS, Download, Archive, Extract, Set as Wallpaper, Open
  Terminal Here, Screen Capture, Copy/Cut/Paste, Rename, Properties, Convert, Refresh, Background submenu
  (Vanta.js/video)
- Command palette (Ctrl+K / Ctrl+P / F1) for app, file, and command search with built-in calculator, terminal run (`>`
  prefix), and unit converter; quick actions for wallpaper, themes, DND, mute, workspace switching, and logout;
  screenshot and screen recording controls
- Run dialog (Ctrl+Shift+R) for compact quick-launch of apps, URLs, and terminal commands
- Clippy contextual assistant with per-app tips
- Keyboard shortcuts app for customizing all global hotkeys

**Key Global Shortcuts:**

| Shortcut                 | Action                   |
| ------------------------ | ------------------------ |
| Ctrl+K / Ctrl+P / F1     | Command palette          |
| Ctrl+Alt+R               | Run dialog               |
| Ctrl+D                   | Show/hide desktop        |
| Alt+Q                    | Cycle windows            |
| Ctrl+Shift+S             | Full screenshot          |
| Ctrl+Alt+S               | Area screenshot          |
| Ctrl+Shift+R             | Screen recording         |
| Ctrl+Arrow               | Snap window half/quarter |
| Ctrl+Alt+ArrowUp/Down    | Brightness               |
| Ctrl+Alt+ArrowLeft/Right | Color temperature        |
| Alt+H                    | Color picker             |

</details>

<details>
<summary><strong>📁 Files & Storage</strong></summary>

- IndexedDB-backed Explorer with grid/list views, sortable columns, image thumbnails, inline rename, file properties,
  trash, drag-select, storage usage indicator, and thumbnail cache
- Sidebar with persistent Quick Access pin/unpin
- Archive support: extract `.zip`/`.7z`/`.tar`/`.gz`/`.bz2`/`.xz`/`.rar`; create `.zip`/`.7z`/`.tar`/`.tar.gz`/`.bz2`
  with compression level and ZIP password
- Font file preview (TTF/OTF) with live sample text rendering and "Set as System Font"
- Right-click file conversion: images (PNG, JPEG, WebP, SVG), data (JSON, CSV, XML, YAML), text (TXT, Markdown, HTML),
  audio/video
- Mount external folders as virtual drives, set images as wallpaper, open folders in Terminal
- Save As and file/directory picker dialog
- File associations: Default Apps app to set, change, or remove the default app per file type
- "Open with" context menu lists every compatible app, plus app picker dialog
- Explorer keyboard shortcuts: Ctrl+C/X/V, Ctrl+F search, Ctrl+A select all, arrow keys navigate, Enter open, F5
  refresh, F2 rename, Delete trash

</details>

<details>
<summary><strong>⚙️ System Features</strong></summary>

- Audio mixer with per-app volume sliders, live waveform intensity visualizer, master/system volume, mute toggle, and
  tray scroll-to-adjust
- System sounds with interaction noises
- Achievement tracking and usage milestones
- Theme system: 40+ presets, custom theme support, light/dark and transparency modes
- Wallpaper engine: 400+ animated wallpapers and customizable Vanta.js support in the wallpaper engine app
- PWA install and offline caching
- User accounts with multi-profile support
- Lock screen, session management, and idle timeout
- Power profiles (Turbo, Balanced, Quality) with tray controls
- Brightness, contrast, gamma, and color temperature sliders
- Custom cursor support (Miku default)
- Custom font system to set any TTF/OTF as system font
- Import/export for backup and migration
- Transparent UI toggle with glass effect on windows, taskbar, and start menu
- Live taskbar clock with calendar popup and keyboard navigation

</details>

<details>
<summary><strong>🔌 Extensibility</strong></summary>

- Custom App Creator for adding web shortcuts with auto-detected favicons and per-app CORS proxy
- Scramjet/BareMux-based web app proxy for embedding third-party sites
- URL parameter launch: `?app=`, `?game=`, `?deck=1` for Yuki Deck Mode

</details>

---

# 📦 Built-in Applications

90+ built-in applications organized by category.

<details>
<summary><strong>🧠 Productivity & Development</strong></summary>

- Explorer
- Default Apps (set default per file type)
- Terminal, a Unix-like shell with filesystem access, Python/Node REPLs, and Git
  - Full Git integration (clone, init, add, commit, push, pull, branch, stash, fetch, diff, remote, rm, checkout, log,
    status)
  - Multiple independent tabs (Alt+T / Ctrl+Tab / Alt+1-9)
  - `file` command with content-based magic byte detection (10+ formats)
  - `neofetch` with GPU/RAM/browser/engine detection
  - Pipeline (`|`), redirects (`>`/`>>`), command chaining (`&&`/`||`/`;`), Ctrl+R reverse search
  - `yuki` command for OS control (power mode, brightness, themes, wallpaper, workspaces, app management, DND,
    notifications)
  - **[lavat](https://github.com/Reeyuki/lavat-web)**, a lava lamp simulation with customizable metaballs and gravity;
    Emscripten WASM port (by Reeyuki) of the original C program, runs fully client-side
  - **[cmatrix](https://github.com/Reeyuki/cmatrix/)**, a Matrix rain animation with color, speed, and character modes;
    browser-native JS reimplementation (by Reeyuki)
  - **[btop](https://github.com/Reeyuki/btop-emscripten)**, a real-time resource monitor (CPU, memory, disks, network,
    processes); Emscripten WASM port (by Reeyuki) that feeds live host system data from YukiOS into the emulated
    terminal
- Notepad
- Markdown Viewer
- Yuki Code
- VS Code
- Run (Ctrl+R quick-launch)
- Settings
- Task Manager with system diagnostics and startup app functionality
- Calculator
- Clock (alarms, stopwatch, timer)
- Shortcuts
- Setup Wizard
- Achievements
- Profile Customizer
- Yuki AI Assistant (WebLLM)
- Storage Editor
- Yuki Convert
- Clipboard Manager
- Emoji Selector
- Yuki Dev Tools (It Tools)
- Dev Tools (Eruda)
- Weather
- News
- YukiOS Guide
- Display Performance
- Virtual Machine Manager
- About (system information)
- Apps (all-apps launcher hub)
- Launchpad (fullscreen macOS-style app grid)
- Intro Tour (replayable desktop tour)
- Mode Switcher (switch desktop modes)
- Network Tray (tray network status)
- App Creator (custom iframe web-shortcut builder)

</details>

<details>
<summary><strong>🎨 Media & Creative Tools</strong></summary>

- Paint
- Mini Paint
- Photopea
- LibreSprite
- Pixlr
- Camera App
- Media Viewer
- Office Viewer
- Evil Spotify
- Blender
- Magnifier
- YouTube Utilities
- Rhythms (Cavalier-like audio visualizer)
- Screenshot (page capture, area selection, screen recording)
- Color Picker (screen color sampling with magnified preview)
- Font Viewer (TTF/OTF)
- Theme Hub (browse, rank, and install community themes with custom effects)
- Wallpaper Engine (browse, preview, and manage image, video, and animated wallpapers with custom uploads)

</details>

<details>
<summary><strong>🌐 Browser & Internet</strong></summary>

- Yuki Browser with Scramjet Proxy, Sidebar Tabs mode, bookmarks, proxy, Tor, history, dark mode, tab system, and
  screenshot
- WebTorrent Client
- Tor Manager, a WASM-based Tor client with Snowflake transport
- Yuki Steam launcher
- Maps (interactive maps with OpenStreetMap and Google Maps support)
- Yuki Remote Desktop (stream your full desktop to any browser via WebRTC with remote input control)

</details>

<details>
<summary><strong>📱 Web Apps</strong></summary>

- **Communication:** Discord, Slack, Zoom
- **AI:** ChatGPT, DeepSeek, Grok, CraxGPT
- **Email:** Gmail, Outlook, ProtonMail
- **Social:** Twitter/X, Instagram, TikTok
- **Dev & Creative:** GitHub, GitLab, CodePen, Figma, Google Docs, Canva
- **Media & Music:** Spotify, SoundCloud, Twitch, Anime
- **Games:** GeForce Now, Itch.io, CrazyGames, Newgrounds

</details>

<details>
<summary><strong>🎮 Games & Emulation</strong></summary>

- Yuki Emulator (EmulatorJS) for NES, SNES, GB, GBA, N64, PSX, and more
- Ruffle (Flash)
- JsDos (DOS)
- Virtual 86 (x86)
- Azahar (3DS Emulator)
- Flashpoint Database
- Yuki Steam storefront with friends, community, playtime tracking and collection system
- Roblox (browse and play Roblox games)
- 3D Room (first-person 3D room where your game library comes to life)

### Yuki Steam In-Game Overlay

Shift+Tab overlay with draggable, resizable panels for any running game:

- Playtime overview (total, 2-week, current session)
- Achievement browser (All/Unlocked/Locked)
- Friends panel with live active user stats and persistent per-game sticky notes
- In-overlay web browser and Scramjet proxy panel
- Screenshot capture, gallery view, and video recording
- Performance monitor for fps/frame
- Overlay settings (toggle, perf monitor, rebindable shortcut key)

</details>

---

# 🛠 Build & Deployment

```bash
pnpm run dev          # Development server
pnpm run build:dev    # Development build
pnpm run build        # Production build
pnpm run preview      # Preview production build
```

# 🤝 Contributing

See the [Development Guide](DEVELOPMENT.md).

# 🖥️ Electron Desktop App

A native Electron wrapper for enhanced desktop integration:

- Native game windows that launch in their own OS-level window with auto-hide menu bar
- Remote host to stream your real desktop with mouse/keyboard control from any device
- Autostart YukiOS on system startup
- Browse real files via home directory drive in Explorer

The web-only version runs in any browser with all core features intact; the Electron app adds native OS integration on
top.

## Libraries

<details>
<summary>Third-party dependencies</summary>

- [Ruffle](https://github.com/ruffle-rs/ruffle)
- [EmulatorJS](https://github.com/EmulatorJS/EmulatorJS)
- [Monaco Editor](https://github.com/microsoft/monaco-editor)
- [three.js](https://github.com/mrdoob/three.js)
- [PDF.js](https://github.com/mozilla/pdf.js)
- [JSZip](https://github.com/Stuk/jszip)
- [fflate](https://github.com/101arrowz/fflate)
- [archive-wasm (Spacedrive)](https://github.com/spacedriveapp/archive-wasm)
- [7z-wasm (use-strict)](https://github.com/use-strict/7z-wasm)
- [Handsontable](https://github.com/handsontable/handsontable)
- [Mammoth.js](https://github.com/mwilliamson/mammoth.js)
- [Font Awesome](https://github.com/FortAwesome/Font-Awesome)
- [emoji-mart](https://github.com/missive/emoji-mart)
- [Vanta.js](https://github.com/tengbao/vanta)
- [WebTorrent](https://github.com/webtorrent/webtorrent)
- [Eruda](https://github.com/liriliri/eruda)
- [Novnc](https://github.com/novnc/novnc)
- [T-Rex Runner](https://github.com/wayou/t-rex-runner)
- [webtor-rs](https://github.com/igor53627/webtor-rs) WASM Tor client (Arti + Snowflake)
- [isomorphic-git](https://github.com/isomorphic-git/isomorphic-git) (Git client via CORS proxy)
- Scramjet / BareMux / Epoxy Transport
- [Pyodide](https://github.com/pyodide/pyodide) (WASM Python runtime)
- [WebContainers](https://github.com/stackblitz/webcontainer-core) (WASM Node.js runtime)

</details>

## Build tooling

- Vite
- ESLint
- Prettier
- [vite-plugin-singlefile](https://github.com/richardtallent/vite-plugin-singlefile)

## License

YukiOS is licensed under the MIT License. It would be greatly appreciated to attribute if you use this project.
