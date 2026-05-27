Yuki OS - Browser-Based Desktop Environment

https://discord.gg/uFuGfseB9Z

> A desktop environment running entirely inside a single web page, featuring 30+ integrated applications, 3700+ games, emulators, persistent storage, workspaces, and a modular service-oriented architecture.


Yuki OS is a full browser-based operating system built entirely in vanilla JavaScript with no frontend frameworks. It transforms a browser tab into a persistent desktop environment with draggable windows, multitasking, emulators, productivity tools, filesystem APIs, custom applications, and runtime services.

Run Flash games, DOS applications, 3DS emulation, retro console games, office tools, coding environments, and browser apps side-by-side inside a unified desktop shell.

Its built entirely in vanilla JS.

![Steam interface](.github/steam.png)
![Setup](.github/setupsettings.png)
![Achievements](.github/browserachieve.png)
![Music player](.github/music.png)
![Applications](.github/apps.png)

---

✨ Key Features

Desktop Environment

Real multitasking desktop - Draggable, resizable, minimizable, maximizable windows

Advanced snapping system - Half-screen, quarter-screen, maximize, restore, keyboard snapping

Workspace system - Multiple virtual desktops with isolated layouts

Taskbar & start menu - Running app management, pinning, previews, tray integration

Traybar system - Apps can minimize to tray and continue running in background

Alt+Tab switching - Window cycling and focus management

Session persistence - Restore windows, layouts, settings, and workspace state after reload

Desktop icons - Persistent shortcuts with refresh and drag-drop support

Dynamic transparency - Adaptive transparency system that reacts to running apps/games

Window previews - Live taskbar previews similar to Aero Peek

Global command palette - Fast launcher and command system via Ctrl+K / F1

Right-click context menus - Desktop, file, taskbar, and app context systems

Advanced file menus - Convert/transform files, create archives, extract archives, bulk-download selections as ZIP, set/save wallpapers

Archive support - Extract: `.zip`, `.gz`, `.tar`, `.tar.gz`, `.tgz`, `.tar.xz`, `.7z`; Create: `.zip`, `.7z`, `.tar`, `.tar.gz`

Window action menus - Snap left/right/maximize, move windows between workspaces, open properties, pin/unpin taskbar apps

Start menu context editing - Add, edit, remove, and reorder custom Start grid shortcuts

Tray context controls - Open or quit background/resident tray applications

Steam library context actions - Favorites, hide/unhide, collection management, add game shortcut to desktop

Taskbar positioning - Bottom/top/left/right taskbar layouts

PWA support - Installable as a standalone offline-capable application

Single-file deployment - Entire OS bundled into one HTML file


Application System

30+ built-in applications

3700+ integrated games

App registry system - Dynamic app metadata, disable/uninstall support, custom naming

Sandboxed iframe apps - Secure isolation for external content

App Creator - Create persistent shortcuts to websites and external apps

URL launch support - Launch directly using ?app= and ?game= parameters

Multi-Runtime & Emulation

Ruffle - Flash emulation

JS-DOS - DOS runtime and DOS game emulation

V86 - Full x86 virtualization in browser

Azahar - Nintendo 3DS emulation

EmulatorJS integration - GBA, NDS, SNES, PSP, Sega, and more

WebAssembly application support

HTML5/WebGL runtime support


System Features

Virtual filesystem - IndexedDB-backed BrowserFS persistent storage

File explorer - Thumbnails, drag-drop, file operations, previews

Notifications - Toasts, notification center, Do-Not-Disturb mode

Audio mixer - Per-app audio routing and volume control

Analytics & achievements - Usage tracking, milestones, playtime systems

Import/export backups - Full system migration and restore

User profiles - Username, avatar, theme personalization

Setup wizard - First-run onboarding and configuration

Theme engine - Glassmorphism desktop styling with light/dark variants

Wallpaper system - Built-in and custom wallpapers

Calendar system - Events and date popup support

Clippy assistant - Animated contextual desktop assistant

Cross-app event system - EventBus-driven communication architecture

Offline support - Service worker caching and installability



---

🏗 Architecture

Yuki OS uses a modular service-oriented architecture centered around shared runtime services.

Core Runtime Services

WindowManager - Window lifecycle, snapping, z-ordering, drag/resize

FileSystemManager - Persistent BrowserFS virtual filesystem

NotificationCenter - Notifications and DND state

EventBus - Cross-application event system

AppLauncher - Centralized application dispatcher

DesktopUI - Desktop/taskbar/start menu renderer

Storage

IndexedDB persistence via BrowserFS

LocalStorage-backed preference layer

Persistent desktop/workspace/session state


For Building

Requirements

Node.js 18+
npm or pnpm

Setup

cd webos-desktop

npm install

npm run dev

npm run build:dev

npm run build


---

📦 Built-in Applications

Productivity & System

Explorer

Terminal

Notepad

Markdown Editor

Yuki Code

VS Code integration

Settings

Task Manager

Calculator

About

Shortcuts

Setup Wizard

What's New

Achievements

Profile Customizer

Yuki AI

Storage Editor

Yuki Convert

Clipboard Manager

Categories

Weather

News


Creative & Media

Paint

Photopea

LibreSprite

Camera

Office Viewer

Yuki Blender

YouTube Utilities


Browser & Internet

Yuki Browser

kiwiIRC

Steam integration

App Creator


Emulation & Games

EmulatorJS

Ruffle

JS-DOS

V86

Azahar


Tray API

Apps can:

minimize to tray

restore from tray

register tray icons

continue running in background



---

🔧 Build & Deployment

Build Commands

npm run dev

npm run build:dev

npm run build

npm run preview

---

🛠 Tech Stack

Vite

viteSingleFile

BrowserFS

IndexedDB

interactjs

Ruffle

EmulatorJS

Monaco Editor

Three.js

PDF.js

JSZip

fflate

7z-wasm

Handsontable

Mammoth.js

Font Awesome



---

🎮 Supported Content

Supported Application Types

Vanilla JS applications

WebAssembly apps

HTML5/WebGL games

Flash applications

DOS software

Emulator ROMs

Remote web apps


Supported File Types

Images

Audio

Video

PDFs

Markdown

Office documents

Archives

ROM files
