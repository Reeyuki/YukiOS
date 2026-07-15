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
- [📋] **Keyboard-driven tiling** — Shortcut to auto-arrange all open windows into configurable grid layouts (2-column, 3-column, grid)
- [📋] **Window rules** — Define behaviors per app: always open on specific workspace, at a set size, or always-on-top
- [📋] **Per-workspace wallpapers** — Each workspace can have its own distinct wallpaper
- [📋] **Workspace-specific pinned apps** — Pin different apps to each workspace's taskbar
- [📋] **Multi-monitor simulation** — Split-screen mode simulating multiple displays
- [📋] **Picture-in-picture mode** — Detach any window into a floating always-on-top mini player, ideal for video
- [💡] **3D desktop mode** — Render windows as panels in a 3D room using Three.js, with camera navigation and spatial workspace switching
- [💡] **Tiling window manager mode** — Optional i3/sway-style keyboard-driven tiling WM
- [💡] **Desktop folders** — Create folders directly on the desktop for file organization
- [💡] **Window shake to minimize** — Shake a window to minimize all others (Windows 11 style)
- [💡] **Per-app remembered window positions** — Independent of session restore, remember position per app permanently
- [💡] **Window centering** — Middle-click title bar to center window on screen

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
- [💡] Add modern ms paint web recreation (not old version)
- [📋] **Download Manager** — Unified queue-based download panel with pause/resume/priority, segmented parallel downloading, and auto-routing to filesystem folders
- [📋] **Yuki OS Studio** — Live source editor for modifying, overriding, and reloading Yuki OS source code at runtime without rebuilding
- [📋] **Habit tracker / journal app** — Persistent daily journal with streak tracking and calendar heatmap
- [📋] **Local database app** — Airtable-lite built on IndexedDB for structured data management
- [💡] **Media tray app** — Replace the "now playing" indicator with a dedicated tray player showing album art, controls, and progress for any playing media
- [💡] **Control Center / storage dashboard** — Centralized system data overview with storage usage breakdown

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
- [📋] **Dynamic themes** — Themes that auto-switch based on time of day (dark after sunset)
- [📋] **Album art wallpaper** — Extract album art from currently playing music and set it as desktop wallpaper
- [📋] **Battery-aware performance** — Reduce animation fidelity and background activity automatically on low battery when running on mobile
- [💡] **Mac dropdown entry** — Add Mac mode as a boot mode in login screen that automatically enables mac window header setting and changes taskbar
- [💡] Alt+Tab visual switcher with live thumbnails (replaces Alt+Q text cycling)
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
- [📋] **Visual theme editor** — Live-preview theme builder with color pickers and sliders
- [📋] **Multi-language IDE in YukiCode** — Plugable runtime system supporting Python (Pyodide), C/C++ (Emscripten), Lua (Fengari), and TypeScript compilation in a single editor
- [📋] **Live source overrides** — Browse, edit, and hot-reload Yuki OS source code without rebuilding via Yuki OS Studio
- [💡] **Runtime module loading** — Dynamic import-based plugin architecture for extending the OS at runtime

---

## Accessibility

- [✅] Custom cursor support
- [✅] GUI scaling options
- [📋] **Keyboard navigation completeness** — Ensure every UI element is reachable and operable via keyboard
- [📋] **High-contrast mode** — Theme variant with maximum contrast for readability
- [📋] **Reduced motion mode** — Disable or minimize animations for vestibular sensitivity
- [📋] **Screen reader support** — Proper ARIA labels and focus management for assistive technology
- [📋] **Focus indicators** — Visible, high-contrast focus outlines on all interactive elements
- [💡] **Text-to-speech** — Read selected text aloud
- [💡] **Speech-to-text / dictation** — Voice input for text fields
- [💡] **Magnifier / zoom** — Lens-style screen magnification

---

## Mobile & Cross-Device

- [📋] **Touch gesture support** — Swipe for workspace switching, pinch to zoom on images, long-press for context menus
- [📋] **Mobile layout mode** — Thumb-friendly taskbar, resized windows, adapted interaction patterns

---

## Polish & UX Improvements

- [✅] Desktop peek button with minimize-all/hover-reveal
- [✅] Desktop icon/taskbar size slider
- [✅] Taskbar scaling and horizontal scroll
- [✅] Taskbar drag reorder and window preview on hover
- [✅] Alt+Left-Click drag / Alt+Right-Click resize
- [📋] **Transparency setting for all panels** — Extend transparency effects to all tray menus, context menus, and GUI panels consistently
- [📋] **Achievement popup redesign** — Replicate Steam achievement style with bottom-right corner popup
- [📋] **First boot interactive tour** — Guided onboarding experience highlighting desktop, apps, files, windows, games, and customization
- [📋] **Lock screen enrichment** — Show time with seconds, weather, media controls, notification badges, and quick actions (WiFi, brightness, volume)
- [📋] **Context-aware context menus** — Right-click menus that adapt based on the target (desktop, file, window header, taskbar, URL)
- [📋] **Keyboard shortcut discoverability** — Tooltips on hover showing shortcuts, searchable shortcuts app, interactive tutorial
- [📋] **Notification system depth** — Grouping by app, history view, scheduled DND, per-app notification sounds, persistent notifications, snooze
- [📋] **System tray enhancement** — Each tray item shows detailed info on click (network stats, battery graph, volume output device, extended weather forecast, calendar month view)
- [📋] **System sounds customization** — Settings panel to assign custom audio files to system events (window open/close, notification, error, startup)
- [💡] **Desktop file drag-out** — Drag files from YukiOS onto the host OS desktop using File System Access API
- [💡] **Window compositor effects** — Live window reflections in taskbar, advanced compositor effects beyond CSS transitions
- [💡] **Network speed indicator in tray** — Real-time upload/download speed display
- [💡] Apps playing audio should show a speaker icon on their taskbar entry; muted apps should show a muted speaker icon

---

## Known Bugs to Fix

- [📋] Right-click "Edit with Notepad" on .md files throws `TypeError: content.startsWith is not a function`
- [📋] Files saved in Pictures, moved to desktop, then dragged back appear as 0 bytes

---

## Contributing

Want to help implement these features? Check out our [Contributing Guide](README.md#-contributing) and
[Development Guide](DEVELOPMENT.md).

---

**Last Updated:** July 2026
