# YukiOS Roadmap

Planned features and improvements for YukiOS.


## Legend

- ✅ **Implemented** — Complete and shipped
- 🚧 **In Progress** — Being actively worked on
- 📋 **Planned** — On the short-term roadmap
- 💡 **Future Idea** — Long-term or exploratory

## Desktop & Window Management

- [✅] Window snapping (half, quarter, fullscreen)
- [✅] Multiple workspaces with independent layouts
- [✅] Alt+Q window cycling and focus management
- [✅] Window context menus (snap, move, pin, workspace transfer)
- [✅] Window animation system with 35+ effects
- [✅] Wobble drag animations
- [✅] Cursor launch effects
- [✅] Desktop peek button with hover reveal
- [✅] Desktop icon auto-sort rules (name, type, recent use)
- [✅] Draggable desktop widgets (clock, weather, calendar)
- [✅] **Window centering** — Middle-click title bar to center window on screen
- [📋] **Keyboard-driven tiling** — Shortcut to auto-arrange all open windows into configurable grid layouts (2-column, 3-column, grid)
- [📋] **Window rules** — Define behaviors per app: always open on specific workspace, at a set size, or always-on-top
- [📋] **Per-workspace wallpapers** — Each workspace can have its own distinct wallpaper
- [📋] **Workspace-specific pinned apps** — Pin different apps to each workspace's taskbar
- [📋] **Multi-monitor simulation** — Split-screen mode simulating multiple displays
- [📋] **Picture-in-picture mode** — Detach any window into a floating always-on-top mini player, ideal for video
- [💡] **3D desktop mode** — Render windows as panels in a 3D room using Three.js, with camera navigation and spatial workspace switching
- [💡] **Tiling window manager mode** — Optional i3/sway-style keyboard-driven tiling WM
- [💡] **Window shake to minimize** — Shake a window to minimize all others (Windows 11 style)
- [💡] **Per-app remembered window positions** — Independent of session restore, remember position per app permanently

---

## File System

- [✅] File properties dialog with rename, dates, permissions, and hash display
- [✅] Archive support: extract ZIP/7z/TAR/GZ/BZ2/XZ/RAR, create with compression levels and password
- [✅] Font preview and "Set as System Font" for TTF/OTF
- [✅] Right-click file conversion (images, text, data formats, audio/video)
- [✅] Mount external folders as virtual drives
- [✅] Storage usage indicator and thumbnail cache
- [✅] Trash system with restore and permanent delete
- [✅] File format conversion context menus
- [📋] **Virtual drive mounting** — Open a ZIP or folder as a browsable drive in Explorer without extracting (maybe also add a WinRar/7z gui app)
- [📋] **File content search** — Search inside file contents, not just filenames
- [📋] **File tagging system** — Color-coded tags and labels for organization
- [📋] **ISO file read support** — Mount and browse ISO disc images directly in Explorer
- [💡] **Encrypted storage vaults** — Create password-protected, encrypted containers that mount/unmount in Explorer, similar to KDE Plasma Vaults
- [💡] **File indexing service** — Background indexer for instant search results (with explorer full search support)
- [💡] **File association system** — Default apps per file type with open-with fallback

---

## Terminal

- [✅] Unix-like shell with filesystem access (Python REPL via Pyodide, Node.js REPL via WebContainers)
- [✅] Full Git integration (clone, init, add, commit, push, pull, branch, stash, fetch, diff, remote, rm, checkout, log, status)
- [✅] Multiple independent tabs with Alt+T / Ctrl+Tab / Alt+1-9
- [✅] Commands: cat, cd, clear, cp, date, echo, exit, fetch, file, find, grep, history, js, kill, ls, mkdir, mount, mv, open, ps, pwd, rm, rmdir, sysinfo, time, touch, uname, uptime, wasm, whoami, neofetch
- [📋] **Split-pane terminal** — Divide the terminal into side-by-side or stacked panes
- [📋] **SSH client** — Connect to remote servers directly from the terminal (use webssh)
- [📋] **Script execution support** — Run shell scripts from the filesystem as commands
- [📋] **Custom shell prompt** — Configurable PS1-style prompt through settings UI (like bash, fish, zsh)
- [📋] **Add vim/nano text editors** — Terminal-based text editors for quick file editing
- [📋] **Tmux** — Terminal multiplexer with session attach/detach, pane splitting, and named sessions, with background run.
- [📋] **nslookup / dig support** — DNS resolution via Cloudflare DNS-over-HTTPS
- [💡] **FFmpeg and ImageMagick via WASM** — Media conversion and image processing directly in the terminal
- [💡] **BoxedWine** — Run 16/32-bit Windows executables inside the terminal

---

## New Applications

- [✅] Notepad, Markdown Viewer, Yuki Code, Calculator, Clock, Weather, News, Paint, Camera, Media Viewer, Office Viewer
- [✅] Terminal, Explorer, Settings, Task Manager, Shortcuts, Achievements, Profile Customizer, Yuki AI Assistant
- [✅] Clipboard Manager, Emoji Selector, YukiDevTools, Dev Tools (Eruda), Storage Editor, Yuki Convert
- [✅] Browser, WebTorrent, Tor Manager, VNC Client, Steam-like launcher
- [💡] **Media tray app** — Replace the "now playing" indicator with a dedicated tray player showing album art, controls, and progress for any playing media
- [💡] **Control Center / storage dashboard** — Centralized system data overview with storage usage breakdown
- [💡] Add modern ms paint web recreation (not old version)

---

## System Features

- [✅] Notification center with grouped messages, DND mode, positioning controls
- [✅] Per-app audio mixer with waveform visualizer, master volume, mute toggle, tray scroll control
- [✅] Theme system with 40+ presets, custom themes, light/dark, transparency mode
- [✅] 400+ animated wallpapers with customizable Vanta.js support in wallpaper engine
- [✅] PWA install and offline caching
- [✅] User accounts with multi-profile support, lock screen, idle timeout
- [✅] Power profiles (Turbo, Balanced, Quality) with brightness/contrast/gamma/night mode
- [✅] Import/export for backup and migration
- [✅] Animated boot screen on first load
- [✅] Calendar popup from taskbar clock with events ("Plans") system
- [📋] **Sound themes** — System-wide audio feedback for login, window open/close, notifications, errors 
- [📋] **Startup app manager** — Choose which apps launch automatically on login
- [📋] **Album art wallpaper** — Extract album art from currently playing music and set it as desktop wallpaper
- [📋] **Battery-aware performance** — Reduce animation fidelity and background activity automatically on low battery when running on mobile
- [💡] **Mac dropdown entry** — Add Mac mode as a boot mode in login screen that automatically enables mac window header setting and changes taskbar
- [💡] Alt+Tab visual switcher with live thumbnails (replaces Alt+Q text cycling)
- [💡] Add bash command to terminal for sh script execution
- [💡] Smooth theme transition animation
- [💡] Window shake-to-minimize (Aero Shake)
---

## Security & Privacy

- [✅] Lock screen with session protection
- [✅] User profiles and multi-account support
- [📋] **Per-app permission system** — Camera, microphone, notifications, storage access with user prompts and persistent settings

---

## Developer Tools & Extensibility

- [✅] Command palette with app search, file search, calculator, terminal commands, system actions
- [✅] Custom App Creator with auto-detected favicons and per-app CORS proxy
- [✅] Eruda and YukiDevTools inspector
- [✅] Storage Editor for browsing IndexedDB
- [✅] **Visual theme editor** — Live-preview theme builder with color pickers and sliders
- [💡] **Multi-language IDE in YukiCode** — Plugable runtime system supporting Python (Pyodide), C/C++ (Emscripten), Lua (Fengari), and TypeScript compilation in a single editor
- [💡] **Live source overrides** — Browse, edit, and hot-reload Yuki OS source code without rebuilding via Yuki OS Studio


## Polish & UX Improvements

- [✅] Desktop peek button with minimize-all/hover-reveal
- [✅] Desktop icon/taskbar size slider
- [✅] Taskbar scaling and horizontal scroll
- [✅] Taskbar drag reorder and window preview on hover
- [✅] Alt+Left-Click drag / Alt+Right-Click resize
- [✅] Transparency setting for all panels — Extend transparency effects to all tray menus, context menus, and GUI panels consistently
- [✅] Achievement popup redesign — Replicate Steam achievement style with bottom-right corner popup
- [📋] Lock screen enrichment — Show time with seconds, weather, media controls, notification badges, and quick actions (WiFi, brightness, volume)
- [📋] Notification system depth — Grouping by app, history view, scheduled DND, per-app notification sounds, persistent notifications, snooze
- [💡] Apps playing audio should show a speaker icon on their taskbar entry; muted apps should show a muted speaker icon
- [💡] Currently active apps should show an indicator to show they are active
- [💡] Chrome OS theming
- [💡] Magnifier / zoom — Lens-style screen magnification like windows 7 magnify app
---

## Known Bugs to Fix

- [📋] Files saved in Pictures using upload to virtual fs, moved to desktop by dragging, then dragged back to explorer appear as 0 bytes

---

## Contributing

Want to help implement these features? Check out our [Contributing Guide](README.md#-contributing) and
[Development Guide](DEVELOPMENT.md).

---

**Last Updated:** July 2026
