# Yuki OS - Browser-Based Desktop Environment

[https://discord.gg/uFuGfseB9Z](https://discord.gg/uFuGfseB9Z)

> A desktop environment running entirely inside a single web page, featuring 30+ integrated applications, 3700+ games,
> emulators, persistent storage, workspaces, and a modular service-oriented architecture.

Yuki OS is a full browser-based operating system built entirely in vanilla JavaScript with no frontend frameworks. It
transforms a browser tab into a persistent desktop environment with draggable windows, multitasking, emulators,
productivity tools, filesystem APIs, custom applications, and runtime services.

Run Flash games, DOS applications, 3DS emulation, retro console games, office tools, coding environments, and browser
apps side-by-side inside a unified desktop shell.

Its built entirely in vanilla JS.

![Steam interface](.github/steam.png) ![Setup](.github/setupsettings.png) ![Achievements](.github/browserachieve.png)
![Music player](.github/music.png) ![Applications](.github/apps.png)

---

# ✨ Core Platform Capabilities

## 🖥 Desktop Experience & Window Management

* Real multitasking desktop - Draggable, resizable, minimizable, maximizable windows
* Advanced snapping system - Half-screen, quarter-screen, maximize, restore, keyboard snapping
* Workspace system - Multiple virtual desktops with isolated layouts
* Alt+Q switching - Window cycling and focus management
* Window previews - Live taskbar previews similar to Aero Peek
* Window action menus - Snap left/right/maximize, move windows between workspaces, open properties, pin/unpin taskbar apps
* Dynamic transparency - Adaptive transparency system that reacts to running apps/games

## 🧭 Taskbar, Start Menu & Navigation

* Taskbar & start menu - Running app management, pinning, previews, tray integration
* Taskbar positioning - Bottom/top/left/right taskbar layouts
* Traybar system - Apps can minimize to tray and continue running in background
* Tray context controls - Open or quit background/resident tray applications
* Tray context menus - Right-click tray icons for quick actions and controls
* Global command palette - Fast launcher and command system via Ctrl+K / F1
* Desktop icons - Persistent shortcuts with refresh and drag-drop support

## 📁 Filesystem & File Management

* Virtual filesystem - IndexedDB-backed BrowserFS persistent storage
* File explorer - Thumbnails, drag-drop, file operations, previews
* Advanced file menus - Convert/transform files, create archives, extract archives, bulk-download selections as ZIP, set/save wallpapers
* Archive support - Extract: `.zip`, `.gz`, `.tar`, `.tar.gz`, `.tgz`, `.tar.xz`, `.7z`; Create: `.zip`, `.7z`, `.tar`, `.tar.gz`

## 📦 Applications & App System

* 30+ built-in applications
* App registry system - Dynamic app metadata, disable/uninstall support, custom naming
* Sandboxed iframe apps - Secure isolation for external content
* App Creator - Create persistent shortcuts to websites and external apps
* URL launch support - Launch directly using `?app=` and `?game=` parameters

## 🎮 Emulation & Runtime Engines

* Ruffle - Flash emulation
* JS-DOS - DOS runtime and DOS game emulation
* V86 - Full x86 virtualization in browser
* Azahar - Nintendo 3DS emulation
* EmulatorJS integration - GBA, NDS, SNES, PSP, Sega, and more
* WebAssembly application support
* HTML5/WebGL runtime support

## ⚙️ System Services & UX Layer

* Notifications - Toasts, notification center, Do-Not-Disturb mode, notification positioning, app icons
* Audio mixer - Per-app audio routing and volume control, system audios
* Analytics & achievements - Usage tracking, milestones, playtime systems, friend stats
* Cross-app event system - EventBus-driven communication architecture
* Clippy assistant - Animated contextual desktop assistant
* Setup wizard - First-run onboarding and configuration
* Theme engine - Glassmorphism desktop styling with light/dark variants, transparent UI toggle, advanced brightness controls
* Wallpaper system - Built-in and custom wallpapers
* Calendar system - Events and date popup support
* PWA support - Installable as a standalone offline-capable application
* Single-file deployment - Entire OS bundled into one HTML file
* Offline support - Service worker caching and installability

## 💾 Storage & Persistence

* IndexedDB persistence via BrowserFS
* LocalStorage-backed preference layer
* Persistent desktop/workspace/session state
* Import/export backups - Full system migration and restore
* User profiles - Username, avatar, theme personalization, GUI scale option

---

# 🏗 Architecture Overview

Yuki OS uses a modular service-oriented architecture centered around shared runtime services.

## Core Runtime Services

* WindowManager - Window lifecycle, snapping, z-ordering, drag/resize
* FileSystemManager - Persistent BrowserFS virtual filesystem
* NotificationCenter - Notifications and DND state
* EventBus - Cross-application event system
* AppLauncher - Centralized application dispatcher
* DesktopUI - Desktop/taskbar/start menu renderer

## Storage Layer

* IndexedDB persistence via BrowserFS
* LocalStorage-backed preference layer
* Persistent desktop/workspace/session state

---

# 📦 Built-in Applications

## 🧠 Productivity & Development

* Explorer
* Terminal
* Notepad
* Markdown Editor
* Yuki Code
* VS Code integration
* Settings
* Task Manager
* Installed Apps
* Calculator
* About
* Shortcuts
* Setup Wizard
* What's New
* Achievements
* Profile Customizer
* Yuki AI
* Storage Editor
* Yuki Convert
* Clipboard Manager
* Categories
* Weather
* News
* Yuki OS Guide

## 🎨 Media & Creative Tools

* Paint
* Photopea
* LibreSprite
* Camera
* Office Viewer
* Evil Spotify
* Yuki Blender
* YouTube Utilities

## 🌐 Browser & Internet

* Yuki Browser
* kiwiIRC
* Steam integration
* App Creator

## 🎮 Games & Emulation Tools

* EmulatorJS
* Ruffle
* JS-DOS
* V86
* Azahar

## 🔌 Tray System API

Apps can:

* minimize to tray
* restore from tray
* register tray icons
* continue running in background

---

# 🔧 Build & Deployment

## Build Commands

```bash
npm run dev
npm run build:dev
npm run build
npm run preview
```

---

# 🛠 Tech Stack

* Vite
* viteSingleFile
* BrowserFS
* IndexedDB
* interactjs
* Ruffle
* EmulatorJS
* Monaco Editor
* Three.js
* PDF.js
* JSZip
* fflate
* 7z-wasm
* Handsontable
* Mammoth.js
* Font Awesome

---

# 🎮 Supported Content

## Application Types

* Vanilla JS applications
* WebAssembly apps
* HTML5/WebGL games
* Flash applications
* DOS software
* Emulator ROMs
* Remote web apps

## File Types

* Images
* Audio
* Video
* PDFs
* Markdown
* Office documents
* Archives
* ROM files
