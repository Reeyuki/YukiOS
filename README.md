# YukiOS - Browser Desktop Environment

<div align="center">

[![License](https://img.shields.io/github/license/Reeyuki/yukios?style=for-the-badge&color=blue)](LICENSE)
[![Discord](https://img.shields.io/badge/Discord-Join-5865F2?style=for-the-badge&logo=discord)](https://discord.gg/wufbWFwr4G)

**Try it now:** [yukios.pages.dev](https://yukios.pages.dev) · [yukios.vercel.app](https://yukios.vercel.app) ·
[yukios.netlify.app](https://yukios.netlify.app) · [yukiwebos.github.io](https://yukiwebos.github.io)

</div>

> A browser-based desktop environment running in a single web page with window management, persistent storage,
> emulators, utilities, and web applications.

YukiOS provides a desktop-style interface inside a browser tab with draggable windows, multitasking, file handling,
emulators, productivity tools, and web applications. Core functionality runs in the browser using client-side storage
and session state.

It includes support for Flash content, DOS programs, console emulation, WebAssembly applications, and standard web
applications running alongside each other.

Its built entirely in vanilla javascript/typescript without any frameworks.

![Login page](https://raw.githubusercontent.com/Reeyuki/YukiOS/main/.github/login.png)
![Steam interface](https://raw.githubusercontent.com/Reeyuki/YukiOS/main/.github/steam.png)
![Start menu](https://raw.githubusercontent.com/Reeyuki/YukiOS/main/.github/startmenu.png)
![Mac OS mode](https://raw.githubusercontent.com/Reeyuki/YukiOS/main/.github/mac.png)
![Steam overlay](https://raw.githubusercontent.com/Reeyuki/YukiOS/main/.github/overlay.png)
![Discord](https://raw.githubusercontent.com/Reeyuki/YukiOS/main/.github/dc.png)
![Music1](https://raw.githubusercontent.com/Reeyuki/YukiOS/main/.github/audio1.png)
![Music2](https://raw.githubusercontent.com/Reeyuki/YukiOS/main/.github/audio2.png)
![Workspaces](https://raw.githubusercontent.com/Reeyuki/YukiOS/main/.github/workspaces.png)
![Widgets](https://raw.githubusercontent.com/Reeyuki/YukiOS/main/.github/widgets.png)
![Web Apps](https://raw.githubusercontent.com/Reeyuki/YukiOS/main/.github/webapps.png)

# Desktop Experience

- Draggable, resizable, minimizable, maximizable windows
- Window snapping (half screen, quarter screen, fullscreen)
- Multiple workspaces with independent layouts
- Window switching and focus cycling (with alt+Q)
- Window context menus (snap, move, pin, workspace transfer)
- Window header context menus
- Window icons in title bar (double-click to close the window)
- Taskbar positioned on any edge of the screen
- Taskbar drag to reorder and click to minimize/restore
- Live taskbar window preview on hover
- System tray with background-running apps
- Tray icon scroll actions for audio, brightness, and workspace switching
- Tray context menus with per-item quick actions
- Desktop icon system with persistent shortcuts and image thumbnails
- Desktop drag-and-drop from host OS and icon rearrangement
- Desktop stretch scroll prevention toggle
- Alt+Left-Click window drag / Alt+Right-Click window resize
- Window animation system with 35+ effects
- Kde inspired physics-based wobbly windows when dragging
- Desktop peek button in system tray with click to minimize/restore all windows, hover to temporarily reveal the desktop
- Cursor launch effect when applications start
- Desktop widget system: clock, weather, notes, calendar, todo, music controls, system monitor, battery, clipboard,
  YouTube embed, photo frame slideshow, timer/stopwatch
- Automatically saves and restores open apps, window positions and sizes, workspace assignments, scroll positions,
  window states (minimized, fullscreen, snapped), focus order

# 🍎 Mac Desktop Mode

Switchable macOS-style desktop from the session picker with a top menu bar, animated dock, and Control Center tray.

- Top menu bar opening Start Menu and Finder through Help items and macos categories
- Animated fisheye dock where pinned apps scale and push neighbors on hover, open apps pin automatically, and items are draggable to reorder
- Control Center tray with brightness, volume, battery, power mode, dark mode, dock toggle, accent colors and lock screen
- macOS-style traffic light window buttons on all window headers
- Launchpad: fullscreen app grid with F4 keybind, glassmorphism backdrop, live search, slide-from-dock animation, and bigger icons on hover, pinned to the Dock in Mac Mode

# 🧭 Navigation & UI

- Start menu with:
  - Fuzzy search (Levenshtein distance, word-boundary matching) across all apps and settings categories
  - Favorites system — star/unstar apps with gold-tinted highlights and dedicated favorites page
  - Customizable app grid — add/edit/remove items
  - Category management — rename, delete/hide, restore categories via right-click context menu
  - App grid organized into categories: Core, Web, Games, Files
  - Desktop icon toggles — show/hide Games and System Apps independently
  - User profile display with avatar, name, and hover tooltip
  - Description tooltips on hover for all items
  - Recent page tracking last-opened apps and files with clear button
  - Full keyboard navigation with arrow keys between search/categories/apps, Launch with Enter/Space
  - Clippy contextual tips on favorites and search events
  - Persistent settings for width, height, and category visibility

- Notification center with grouped messages
- Do Not Disturb mode
- Notification positioning controls
- Desktop and file context menus: New Folder / Text Document, Add file(s) from OS, Download, Add to archive, Extract
  here, Set as wallpaper, Open Terminal Here, Screen Capture, Copy/Cut/Paste, Rename, Properties, Convert/Transform,
  Refresh, Background submenu (Vanta.js presets / video wallpapers) with keyboard navigation (arrow keys, Enter, Escape,
  submenu traversal)
- Command palette (Ctrl+K/P/F1) for app, file, and command search with built-in calculator, terminal run support with >
  prefix, and unit converter
- Run dialog (Ctrl+R-Windows+R) — compact quick-launch window for opening apps, URLs, and terminal commands
- Clippy contextual assistant with per-app tips
- Animated UI components including start menu, wallpaper switcher, audio mixer, context menus, and notifications
- Keyboard shortcuts app for customizing global hotkeys

**Key Global Shortcuts:**

- Ctrl+K / Ctrl+P / F1 - Open command palette
- Ctrl+R - Open Run dialog
- Ctrl+D - Show/hide desktop
- Alt+Q - Cycle through windows
- Ctrl+Shift+S - Full screenshot
- Ctrl+Alt+S - Area screenshot
- Ctrl+Shift+R - Screen recording
- Ctrl+Arrow keys - Snap window to half/quarter screen
- Ctrl+Alt+ArrowUp/Down - Adjust brightness
- Ctrl+Alt+ArrowLeft/Right - Adjust color temperature
- Alt+H - Open color picker

**Command Palette Features:**

- Search apps, files, and system commands
- Quick actions: wallpaper, themes, DND, mute, workspace switching, logout & more
- Terminal commands (prefix with `>`)
- Built-in calculator and unit converter
- Screenshot and screen recording controls
- Dynamic favicon updates based on current app

# 📁 Files & Storage

- IndexedDB-backed explorer with grid/list views, sortable columns, image thumbnails, inline rename, file properties,
  trash, and drag-select
- Sidebar with persistent Quick Access pin/unpin
- Archive support: extract `.zip`/`.7z`/`.tar`/`.gz`/`.bz2`/`.xz`/`.rar`, create `.zip`/`.7z`/`.tar`/`.tar.gz`/`.bz2`
  with compression level and ZIP password support
- Font file preview and viewer for TTF/OTF fonts with live sample text rendering
- Right-click "Set as System Font" on TTF/OTF files.
- Right-click file conversion for common images (PNG, JPEG, WebP, SVG), structured data (JSON, CSV, XML, YAML), text
  formats (TXT, Markdown, HTML), and common audio/video files
- Mount external folders as virtual drives, set images as wallpaper, or open any folder in Terminal
- Save As and file/directory picker dialog
- storage usage indicator, thumbnail cache
- Explorer keyboard shortcuts: Ctrl+C copy, Ctrl+X cut, Ctrl+V paste Ctrl+F search, Ctrl+A select all, arrow keys
  navigate, Enter open, F5 refresh, F2 rename, Delete trash

# ⚙️ System Features

- Notification system with app icons and actions
- Audio mixer with per-app volume sliders, live waveform intensity visualizer, master/system volume, mute toggle, and
  tray icon with scroll-to-adjust
- System sounds with interaction noises for common actions
- Achievement tracking and usage milestones
- Theme system with 40 presets and custom theme support, light/dark and transparency modes.
- Wallpaper customization with 400 animated wallpapers and customizable Vanta.js support in wallpaper engine app
- PWA install and offline caching support
- User accounts with multi-profile support
- Lock screen, session management, and idle timeout
- Power profiles (Turbo, Balanced, Quality) with tray controls
- Brightness, contrast, gamma, and color temperature sliders
- Custom cursor support (with miku by default)
- Custom font system — set any TTF/OTF file as system font
- Import/export system for backup and migration
- Transparent UI toggle with: glass effect on windows, taskbar, start menu.
- Clock system using OffscreenCanvas rendering and lightweight NTP offset sync with js worker
- Calendar popup from taskbar clock with monthly grid, keyboard navigation, and today button
- Events ("Plans") system with title, date/time, repeat (daily/weekly/monthly/yearly), reminders, notes, and color
  coding
- Agenda view showing today's plans and upcoming events, plus next alarm info

# 📦 Built-in Applications

80+ built-in applications and direct launch via URL parameters (`?app=` and `?game=`)

## 🧠 Productivity & Development

- Explorer
- Installed Apps (rename, disable, uninstall apps)
- Terminal: Unix-like shell with filesystem access, Python/Node REPLs, and Git
  - Python REPL (Pyodide WASM), Node.js REPL (WebContainers)
  - Full Git integration (clone, init, add, commit, push, pull, branch, stash, fetch, diff, remote, rm, checkout, log,
    status)
  - Multiple independent tabs with Alt+T / Ctrl+Tab / Alt+1-9
  - `file` command with content-based magic byte detection for 10+ file formats
  - `neofetch` with GPU/RAM/browser/engine detection
  - Pipeline (`|`), redirects (`>`/`>>`), command chaining (`&&`/`||`/`;`), Ctrl+R reverse search, and `file` with magic-byte content detection
  - `yuki` command for OS control: power mode, brightness, theme, wallpaper, workspaces, app management (list/uninstall/install/disable/enable), DND, notifications, storage report
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
- Yuki AI Assistant
- Storage Editor
- Yuki Convert
- Clipboard Manager
- Emoji Selector
- YukiDevTools (IT - TOOLS)
- Dev Tools (Eruda)
- Weather
- News
- YukiOS Guide
- Display Performance
- Virtual Machine Manager

## 🎨 Media & Creative Tools

- Paint
- Mini Paint
- Photopea
- LibreSprite
- Pixlr
- Camera App
- Media Viewer
- Office Viewer
- Evil Spotify
- Yuki Blender
- YouTube Utilities
- Rhythms (Cavalier-like audio visualizer)
- Screenshot (page capture, area selection, screen recording)
- Color Picker (screen color sampling with magnified preview)
- Font Viewer for TTF/OTF files

## 🌐 Browser & Internet

- Yuki Browser with bookmarks, proxy, tor, history, dark mode, tab system,screenshot
- WebTorrent Client
- Tor Manager - tor browsing via WASM-based Tor client with Snowflake transport
- VNC Client using novnc
- Steam-like game launcher

## Web Apps

- Discord
- Spotify
- ChatGPT
- Email providers (Gmail, Outlook, ProtonMail)
- kiwiIRC
- GeForce Now
- Scramjet Browser

## 🎮 Games & Emulation

- Yuki Emulator (EmulatorJS)
- Ruffle (Flash)
- JsDos (DOS)
- Virtual 86 (x86)
- Azahar (3DS Emulator)
- Flashpoint Database
- Steam app

### Steam-like In-Game Overlay

Shift+Tab overlay with draggable, resizable panels for any running game:

- Playtime overview (total, 2-week, and current session)
- Achievement browser with All/Unlocked/Locked filters
- Friends panel with live active user stats and persistent per-game sticky notes
- In-overlay web browser and Scramjet proxy panel
- Screenshot capture, gallery view, and video recording
- Performance monitor for fps/frame
- Overlay settings (toggle, perf monitor, rebindable shortcut key)

# 🔌 Extensibility

Custom App Creator for adding web shortcuts with auto-detected favicons and per-app CORS proxy.

# 🛠 Build & Deployment

```bash
pnpm run dev
pnpm run build:dev
pnpm run build
pnpm run preview
```

# 🤝 Contributing

See the [Development Guide](DEVELOPMENT.md).

# 🛠 Tech Stack

## Libraries

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
- [webtor-rs](https://github.com/igor53627/webtor-rs) WASM Tor client (Arti + Snowflake)
- [isomorphic-git](https://github.com/isomorphic-git/isomorphic-git) (Git client via CORS proxy)
- Scramjet / BareMux / Epoxy Transport
- [Pyodide](https://github.com/pyodide/pyodide) (WASM Python runtime)
- [WebContainers](https://github.com/stackblitz/webcontainer-core) (WASM Node.js runtime)

## Build tooling

- Vite
- TypeScript
- ESLint
- Prettier
- [vite-plugin-singlefile](https://github.com/richardtallent/vite-plugin-singlefile)
