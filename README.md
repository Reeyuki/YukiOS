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
emulators, and productivity tools. It includes support for Flash content, DOS programs, console emulation,
WebAssembly applications, and standard web applications running alongside each other.

It's built entirely in vanilla JavaScript without any frameworks.

## Screenshots

|                                                                                                             |                                                                                             |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| ![Mac Mode](https://raw.githubusercontent.com/Reeyuki/YukiOS/main/.github/mac.png)                          | ![YukiDeck](https://raw.githubusercontent.com/Reeyuki/YukiOS/main/.github/yuki-deck.png)     |
| ![ChromeOS Mode](https://raw.githubusercontent.com/Reeyuki/YukiOS/main/.github/chromeos.png)                | ![Start Menu](https://raw.githubusercontent.com/Reeyuki/YukiOS/main/.github/startmenu.png)  |
| ![Workspaces](https://raw.githubusercontent.com/Reeyuki/YukiOS/main/.github/workspaces.png)                 | ![Widgets](https://raw.githubusercontent.com/Reeyuki/YukiOS/main/.github/widgets.png)       |
| ![WASM Terminal Apps](https://raw.githubusercontent.com/Reeyuki/YukiOS/main/.github/btop-lavat-cmatrix.png) | ![3D Os Mode](https://raw.githubusercontent.com/Reeyuki/YukiOS/main/.github/3d.png)         |
| ![Remote Desktop](https://raw.githubusercontent.com/Reeyuki/YukiOS/main/.github/remote.png)                 | ![Steam](https://raw.githubusercontent.com/Reeyuki/YukiOS/main/.github/steam.png)           |
| ![Steam Overlay](https://raw.githubusercontent.com/Reeyuki/YukiOS/main/.github/overlay.png)                 | ![Tiling Mode](https://raw.githubusercontent.com/Reeyuki/YukiOS/main/.github/tiling.png)    |

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
- Animated fisheye dock where pinned apps scale and push neighbors on hover, open apps pin automatically, and items are
  draggable to reorder
- Control Center tray with brightness, volume, battery, power mode, dark mode, dock toggle, accent colors and lock
  screen
- macOS-style traffic light window buttons on all window headers
- Launchpad: fullscreen app grid with F4 keybind, glassmorphism backdrop, live search, slide-from-dock animation, and
  bigger icons on hover, pinned to the Dock in Mac Mode

# 🔲 Tiling Mode

Hyprland-inspired BSP tiling window manager switchable from the session picker, with per-workspace tree layouts and live
config editing.

- Alt+Space toggles tiling on and off; Alt+Arrow moves focus, Ctrl+Alt+Arrow resizes boundaries, Alt+Shift+Arrow swaps
  windows
- Alt+1-9 switches between 9 independent workspaces, each with its own BSP tree; Alt+Q closes the focused window,
  Alt+F toggles floating, Alt+T spawns a terminal
- Drag a tiled window onto another to swap them in the tree
- Gap, border width, and split ratio adjustable from Settings > Tiling or the config file at
  `Config/yukiOs/tiling.conf` (live-reload on save)
- hyprctl terminal command provides Hyprland-style CLI control
- Customizable: gaps (inner/outer), split ratio, border width/radius, resize step, animation duration/easing, mouse
  resize toggle, workspace switch delay, resize debounce

# 🎮 Yuki Deck Mode

A fullscreen, animated and full sfx featured game-console style mode you can pick at login, controlled with a gamepad or keyboard/mouse.

- Home feed: see what's new, your friends, and games
- Library: search your games, sort by name, mark favorites, and build collections
- Quick Actions Panel: Manage deck mode quick settings & friends

# 🧭 Navigation & UI

- Start menu with:
  - Fuzzy search across all apps and settings categories
  - Favorites system: star/unstar apps with gold-tinted highlights and dedicated favorites page
  - Customizable app grid: add/edit/remove items
  - Category management: rename, delete/hide, restore categories via right-click context menu
  - App grid organized into categories: Core, Web, Games, Files
  - Desktop icon toggles: show/hide Games and System Apps independently
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
- Run dialog (Ctrl+R): compact quick-launch window for opening apps, URLs, and terminal commands
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

# 📁 Files & Storage

- IndexedDB-backed explorer with grid/list views, sortable columns, image thumbnails, inline rename, file properties,
  trash, drag-select, storage usage indicator, and thumbnail cache
- Sidebar with persistent Quick Access pin/unpin
- Archive support: extract `.zip`/`.7z`/`.tar`/`.gz`/`.bz2`/`.xz`/`.rar`, create `.zip`/`.7z`/`.tar`/`.tar.gz`/`.bz2`
  with compression level and ZIP password support
- Font file preview and viewer for TTF/OTF fonts with live sample text rendering
- Right-click "Set as System Font" on TTF/OTF files.
- Right-click file conversion for common images (PNG, JPEG, WebP, SVG), structured data (JSON, CSV, XML, YAML), text
  formats (TXT, Markdown, HTML), and common audio/video files
- Mount external folders as virtual drives, set images as wallpaper, or open any folder in Terminal
- Save As and file/directory picker dialog
- File associations: Default Apps app to set, change, or remove the default app per file type
- "Open with" context menu on files lists every compatible app, plus an app picker dialog
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
- Custom font system: set any TTF/OTF file as system font
- Import/export system for backup and migration
- Transparent UI toggle with: glass effect on windows, taskbar, start menu.
- Live taskbar clock with calendar popup, monthly grid, and keyboard navigation

# 📦 Built-in Applications

80+ built-in applications and direct launch via URL parameters (`?app=`, `?game=`, and `?deck=1` for Yuki Deck Mode)

## 🧠 Productivity & Development

- Explorer
- Installed Apps (rename, disable, uninstall apps)
- Default Apps (set the default app for any file type)
- Terminal: Unix-like shell with filesystem access, Python/Node REPLs, and Git
  - Python and Node.js REPLs
  - Full Git integration (clone, init, add, commit, push, pull, branch, stash, fetch, diff, remote, rm, checkout, log,
    status)
  - Multiple independent tabs with Alt+T / Ctrl+Tab / Alt+1-9
  - `file` command with content-based magic byte detection for 10+ file formats
  - `neofetch` with GPU/RAM/browser/engine detection
  - Pipeline (`|`), redirects (`>`/`>>`), command chaining (`&&`/`||`/`;`), and Ctrl+R reverse search
  - `yuki` command for OS control: power mode, brightness, theme, wallpaper, workspaces, app management
    (list/uninstall/install/disable/enable), DND, notifications, storage report
  - **[lavat](https://github.com/Reeyuki/lavat-web)** -- lava lamp simulation with customizable metaballs and gravity;
    Emscripten WASM port (by Reeyuki) of the original C program, runs fully client-side
  - **[cmatrix](https://github.com/Reeyuki/cmatrix/)** -- Matrix rain animation with color, speed, and character modes;
    browser-native JS reimplementation (by Reeyuki)
  - **[btop](https://github.com/Reeyuki/btop-emscripten)** -- real-time resource monitor (CPU, memory, disks, network,
    processes); Emscripten WASM port (by Reeyuki) that feeds live host system data from yuki os into the emulated
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
- Magnifier
- YouTube Utilities
- Rhythms (Cavalier-like audio visualizer)
- Screenshot (page capture, area selection, screen recording)
- Color Picker (screen color sampling with magnified preview)
- Font Viewer for TTF/OTF files

## 🌐 Browser & Internet

- Yuki Browser with Sidebar Tabs mode, bookmarks, proxy, tor, history, dark mode, tab system, screenshot
- WebTorrent Client
- Tor Manager - tor browsing via WASM-based Tor client with Snowflake transport
- VNC Client using novnc
- Yuki Steam launcher

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
- Yuki Steam app

### Yuki Steam In-Game Overlay

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

# 🖥️ Electron Desktop App

A native Electron wrapper for an enhanced desktop experience:

- Native game windows that launch in their own OS-level window with auto-hide menu bar
- Remote host to stream your real desktop with mouse and keyboard control from any device
- Autostart YukiOS on system startup via a settings toggle
- Browse your real files with your home directory appearing as a drive in Explorer

The web-only version runs in any browser with all core features intact; the Electron app adds native OS integration on top.

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
- [T-Rex Runner](https://github.com/wayou/t-rex-runner)
- [webtor-rs](https://github.com/igor53627/webtor-rs) WASM Tor client (Arti + Snowflake)
- [isomorphic-git](https://github.com/isomorphic-git/isomorphic-git) (Git client via CORS proxy)
- Scramjet / BareMux / Epoxy Transport
- [Pyodide](https://github.com/pyodide/pyodide) (WASM Python runtime)
- [WebContainers](https://github.com/stackblitz/webcontainer-core) (WASM Node.js runtime)

## Build tooling

- Vite
- ESLint
- Prettier
- [vite-plugin-singlefile](https://github.com/richardtallent/vite-plugin-singlefile)

## License

YukiOS is licensed under the MIT License. It would be greatly appreciated to attribute if you use this project.