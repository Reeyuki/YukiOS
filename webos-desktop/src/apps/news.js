import "../styles/news.css";

import { $, setStyle } from "../shared/domUtils.js";
import { APP_MANIFESTS, BaseApp, StorageKeys, os } from "../framework.js";
const appNewsEntries = APP_MANIFESTS.filter((manifest) => manifest.news).map((manifest) => manifest.news);

const EXISTING_NEWS_UPDATES = [
  {
    date: "July 31, 2026",
    sections: [
      {
        icon: "fa-th-large",
        title: "File Associations",
        items: [
          ["fa-th-large", "Default Apps", "Set and manage the default program for every file type from one app."],
          ["fa-share-alt", "Open With", "Right-click any file to launch it with any compatible app from a picker."]
        ]
      }
    ]
  },
  {
    date: "July 31, 2026",
    sections: [
      {
        icon: "fa-cube",
        title: "Blender",
        items: [
          [
            "fa-cube",
            "Blender Web Editor",
            "Model 3D objects right in your browser with a full Blender-like editor compiled to wasm by puter labs."
          ]
        ]
      }
    ]
  },
  {
    date: "July 30, 2026",
    sections: [
      {
        icon: "fa-desktop",
        title: "Electron Desktop App",
        items: [
          [
            "fa-window-restore",
            "Native Game Windows",
            "Games launch in their own native OS window with menu bar hidden and dark background."
          ]
        ]
      },
      {
        icon: "fa-display",
        title: "Browser Screen Sharing/Control",
        items: [
          [
            "fa-share",
            "Share Your Desktop from Any Browser with controlling",
            "Share your screen directly from the browser or electron app with high resolution, and control it"
          ]
        ]
      }
    ]
  },
  {
    date: "July 29, 2026",
    sections: [
      {
        icon: "fa-laptop",
        title: "Chrome OS Mode",
        items: [
          [
            "fa-desktop",
            "Chrome OS Desktop Mode",
            "Switch to a Chromebook-style desktop with shelf, app launcher, and transparent glass effects."
          ],
          [
            "fa-image",
            "17 Chrome OS Wallpapers",
            "A full set of Chromebook-inspired wallpapers to complete the Chrome OS look."
          ]
        ]
      },
      {
        icon: "fa-volume-high",
        title: "Audio Indicators",
        items: [
          [
            "fa-volume-high",
            "Speaker Icons on Taskbar",
            "Apps playing audio now show a dynamic speaker icon on their taskbar item for quick muting."
          ],
          [
            "fa-circle",
            "Active App Indicators",
            "Currently active apps glow with a subtle indicator so you always know which window is focused."
          ]
        ]
      }
    ]
  },
  {
    date: "July 28, 2026",
    sections: [
      {
        icon: "fa-terminal",
        title: "Terminal Expansion",
        items: [
          [
            "fa-terminal",
            "New Commands",
            "lolcat, cowsay, fortune, pipes, snow, watch, banner, rev, and more added to the terminal."
          ],
          [
            "fa-bars",
            "Tab Context Menus",
            "Right-click terminal tabs for quick actions like close, duplicate, and rename."
          ]
        ]
      },
      {
        icon: "fa-mouse-pointer",
        title: "Desktop & Performance",
        items: [
          [
            "fa-bars",
            "Expanded Context Menu",
            "Desktop right-click menu now has more options for quick access to system actions."
          ],
          [
            "fa-bolt",
            "Performance Optimizations",
            "Faster loading, CSS streamlining, runtime optimizations, and start menu search caching."
          ]
        ]
      }
    ]
  },
  {
    date: "July 27, 2026",
    sections: [
      {
        icon: "fa-play",
        title: "Boot Animations",
        items: [
          [
            "fa-play",
            "Boot Animation System",
            "Choose from 7 boot animations with random play, selection, and skip keybinds."
          ],
          [
            "fa-user-check",
            "Remember Me Login",
            "Auto-login with a saved profile to skip the login screen on return visits."
          ]
        ]
      },
      {
        icon: "fa-bars",
        title: "Taskbar",
        items: [
          [
            "fa-tag",
            "Taskbar Labels",
            "Opened app icons now show text labels for clearer identification at a glance, toggleable from settings"
          ]
        ]
      }
    ]
  },
  {
    date: "July 26, 2026",
    sections: [
      {
        icon: "fa-cube",
        title: "3D Room Enhancements",
        items: [
          [
            "fa-gem",
            "Ultra Graphics Preset",
            "Crank up the 3D room visuals with an ultra quality preset for sharper textures and lighting."
          ],
          [
            "fa-hand",
            "F Key to Launch Games",
            "Grab a game case and press F to launch it with a satisfying minimize-and-hold animation."
          ],
          [
            "fa-person",
            "Improved Player Body",
            "Smoother player animations and better body movement for a more immersive experience."
          ]
        ]
      },
      {
        icon: "fa-layer-group",
        title: "Tiling & Steam",
        items: [
          [
            "fa-layer-group",
            "Master Stack Engine",
            "New tiling layout mode with a master stack that keeps the focused app prominent."
          ],
          [
            "fa-newspaper",
            "Steam News System",
            "Real news and updates feed inside the Steam app so you never miss a game announcement."
          ]
        ]
      }
    ]
  },
  {
    date: "July 29, 2026",
    sections: [
      {
        icon: "fa-desktop",
        title: "Yuki Remote Desktop",
        items: [
          [
            "fa-share",
            "Share Your Desktop",
            "Stream your full PC desktop to any browser with real-time mouse and keyboard control."
          ],
          [
            "fa-qrcode",
            "Easy Pairing",
            "Generate a secure 6-character code and scan QR to connect instantly from any device."
          ],
          [
            "fa-rocket",
            "Electron App",
            "Download the native YukiOS desktop app for persistent storage, system tray, and remote host."
          ]
        ]
      },
      {
        icon: "fa-wand-magic-sparkles",
        title: "New App",
        items: [
          [
            "fa-search-plus",
            "Magnifier App",
            "Zoom in on any screen area with a lens-style magnifier that follows your cursor with zoom."
          ]
        ]
      }
    ]
  },
  {
    date: "July 26, 2026",
    sections: [
      {
        icon: "fa-cube",
        title: "3D Room",
        items: [
          [
            "fa-hand",
            "Grab and Move Objects",
            "Pick up game cases, furniture, and the rainbow ball by clicking or pressing E. Throw them, shelve them, or toss them in the bin."
          ],
          ["fa-chair", "Sit Anywhere", "Walk up to any chair and press E to sit down with a smooth camera transition."],
          [
            "fa-list",
            "Book-Shelving Minigame",
            "Sort game cases by genre on the correct shelves for points, combos, and a live score overlay."
          ],
          [
            "fa-pencil",
            "In-Room Editor",
            "Place and arrange furniture with undo/redo support using the built-in editor mode."
          ],
          [
            "fa-volume-high",
            "Ambient Sounds",
            "Footsteps, grab and release noises, shelving thuds, and chair creaks make the room feel alive."
          ]
        ]
      }
    ]
  },
  {
    date: "July 23, 2026",
    sections: [
      {
        icon: "fa-magnifying-glass",
        title: "Rofi Launcher Overhaul",
        items: [
          [
            "fa-th-large",
            "Four Modes",
            "Switch between Apps, Run, Windows, and Calc modes with Tab. Each mode has its own search and behavior."
          ],
          [
            "fa-terminal",
            "Run Commands",
            "Execute terminal commands, launch apps, or open URLs directly from the rofi overlay with persistent history."
          ],
          [
            "fa-window-restore",
            "Window Switcher",
            "Browse and focus any open window with fuzzy search, including minimized windows."
          ]
        ]
      }
    ]
  },
  {
    date: "July 23, 2026",
    sections: [
      {
        icon: "fa-terminal",
        title: "Terminal Apps",
        items: [
          ["fa-fire", "Lavat", "Watch colorful metaballs dance in a lava lamp simulation right inside the terminal."],
          [
            "fa-chart-simple",
            "btop",
            "Monitor system performance with a real-time terminal process viewer, featuring CPU, memory, and process data."
          ],
          [
            "fa-code",
            "Cmatrix",
            "Watch the Matrix rain fall in your terminal with customizable colors, speed, and visual modes."
          ]
        ]
      }
    ]
  },
  {
    date: "July 21, 2026",
    sections: [
      {
        icon: "fa-user-friends",
        title: "Live Activity",
        items: [
          [
            "fa-bell",
            "Now Playing Popups",
            "When someone starts a game, a sleek popup appears with their name and game. Click it to jump in yourself."
          ]
        ]
      }
    ]
  },
  {
    date: "July 20, 2026",
    sections: [
      {
        icon: "fa-th-large",
        title: "Tiling Mode",
        items: [
          [
            "fa-th-large",
            "Hyprland-Inspired Tiling",
            "Press Alt+Space to toggle BSP tiling. Navigate with Alt+Arrow, resize with Ctrl+Alt+Arrow, swap with Alt+Shift+Arrow."
          ],
          ["fa-sliders-h", "Live Config Editing", "Edit Config/yukiOs/tiling.conf to tweak gaps, borders."],
          ["fa-keyboard", "Alt+Q to Close Windows", "Close the focused window instantly with Alt+Q in any mode."],
          [
            "fa-arrows-alt",
            "Drag to Swap Windows",
            "Drag any tiled window onto another to swap their positions in the layout instantly."
          ]
        ]
      },
      {
        icon: "fa-window-maximize",
        title: "Tiling Bar & Rofi Launcher",
        items: [
          [
            "fa-window-maximize",
            "Tiling Top Bar",
            "A dedicated top bar appears in tiling mode with workspace dots, focused window title, clock, and tray icons fully customizable in Settings."
          ],
          [
            "fa-search",
            "Rofi-Style App Launcher",
            "Press Super+D or click the search icon in the tiling bar to open a rofi-like overlay with fuzzy search, recent apps, and keyboard navigation."
          ],
          [
            "fa-sliders-h",
            "Full Tiling Settings Panel",
            "Tweak every tiling setting from Settings → Tiling: gaps, borders, animations, bar elements, rofi width, and more with no manual config editing needed."
          ]
        ]
      },
      {
        icon: "fa-star",
        title: "Features & Improvements",
        items: [
          [
            "fa-layer-group",
            "Auto-Clean Empty Workspaces",
            "Workspaces with no windows vanish automatically when you switch away."
          ],
          [
            "fa-arrows-alt",
            "Position-Aware Snap Zones",
            "Window snapping accounts for taskbar position on left, right, top, or bottom."
          ],
          [
            "fa-keyboard",
            "Global Keybinds",
            "Press Ctrl+Shift+W to cycle wallpapers and Ctrl+Shift+B to launch the browser from anywhere."
          ]
        ]
      }
    ]
  },
  {
    date: "July 19, 2026",
    sections: [
      {
        icon: "fab fa-apple",
        title: "Dock Customization",
        items: [
          [
            "fab fa-apple",
            "Dock Settings Panel",
            "Customize your Mac dock with position, auto-hide, magnification amount and range, icon size, scale, and animation speed, all from Settings."
          ],
          [
            "fa-arrows-alt",
            "Dock Position & Auto-Hide",
            "Move the dock to bottom, left, or right edge, and enable auto-hide for a cleaner desktop."
          ],
          [
            "fa-search-plus",
            "Adjustable Magnification",
            "Control how much icons scale up on hover and how many adjacent icons are affected."
          ]
        ]
      },
      {
        icon: "fa-th",
        title: "Launchpad",
        items: [
          [
            "fa-th",
            "macOS Launchpad in Mac Mode",
            "Browse every installed app in a fullscreen glass grid with instant search pinned to the Dock in Mac Mode."
          ]
        ]
      }
    ]
  },
  {
    date: "July 18, 2026",
    sections: [
      {
        icon: "fa-apple-whole",
        title: "Mac Mode",
        items: [
          [
            "fa-apple-whole",
            "Mac Desktop Mode",
            "Switch to a macOS-style desktop with a top menu bar, animated fisheye dock, and Control Center tray."
          ],
          [
            "fa-sliders-h",
            "Control Center",
            "Replace cluttered tray icons with a single popup for brightness, volume, battery, power mode, dark mode, DND, and 6 accent colors."
          ],
          [
            "fa-star",
            "Mac Dock Improvements",
            "Fisheye hover animation with smooth scale and push, right-click context menus, drag-to-reorder pinned items, and Audio Mixer dock item."
          ]
        ]
      }
    ]
  },
  {
    date: "July 15, 2026",
    sections: [
      {
        icon: "fa-shield-halved",
        title: "Ad Blocking",
        items: [
          [
            "fa-shield-halved",
            "Built-in Ad Blocker for browser",
            "Blocks analytics, ads, and tracking scripts across all websites in browser app."
          ]
        ]
      },
      {
        icon: "fa-display",
        title: "Display",
        items: [
          [
            "fa-display",
            "Display Resolution",
            "Switch between 20+ display resolutions with a 4-second countdown confirmation dialog."
          ]
        ]
      }
    ]
  },
  {
    date: "July 14, 2026",
    sections: [
      {
        icon: "fa-terminal",
        title: "Run Dialog",
        items: [
          [
            "fa-terminal",
            "Run Dialog",
            "Press Ctrl+R to quickly launch apps, open URLs, or run commands from a single dialog."
          ]
        ]
      }
    ]
  },
  {
    date: "July 10, 2026",
    sections: [
      {
        icon: "fa-code-branch",
        title: "Git Integration",
        items: [
          [
            "fa-code-branch",
            "Full Git in Terminal",
            "Clone, init, add, commit, push, pull, branch, stash and more inside the Terminal."
          ]
        ]
      }
    ]
  },
  {
    date: "July 9, 2026",
    sections: [
      {
        icon: "fa-hdd",
        title: "Directory Mounting",
        items: [
          [
            "fa-hdd",
            "Mount Real Folders",
            "Mount real local directories into the YukiOS filesystem via the File System Access API with full read/write support."
          ]
        ]
      }
    ]
  },
  {
    date: "July 7, 2026",
    sections: [
      {
        icon: "fa-download",
        title: "Version Checker",
        items: [
          [
            "fa-cloud-arrow-down",
            "Automatic Update Detection",
            "YukiOS now checks for new versions automatically and shows a tray icon when an update is available."
          ]
        ]
      },
      {
        icon: "fa-puzzle-piece",
        title: "Widget System",
        items: [
          [
            "fa-puzzle-piece",
            "Desktop Widgets",
            "Add useful widgets to your desktop: Clock, Weather, Notes, Calendar, System Monitor, Music Control, and more, each with drag-to-move and resize."
          ]
        ]
      },
      {
        icon: "fa-sort",
        title: "Desktop Sorting",
        items: [["fa-sort-amount-down-alt", "Auto-Sort Toggle", "Right-click the desktop for sorting desktop items"]]
      }
    ]
  },
  {
    date: "June 26, 2026",
    sections: [
      {
        icon: "fa-wand-magic-sparkles",
        title: "Accounts",
        items: [
          [
            "fa-users",
            "Accounts in Settings",
            "Accounts moved into Settings with inline editing, no more modal popups."
          ]
        ]
      }
    ]
  },
  {
    date: "June 25, 2026",
    sections: [
      {
        icon: "fa-globe",
        title: "Browser",
        items: [
          [
            "fa-message",
            "Merged features of browser into scramjet and made scramjet the default browser",
            "Now it has animations, history, bookmarks,drag to reorder, settings, rich context menu, tooltips, screenshot, dev tools, scroll click keybind to close tabs & more."
          ]
        ]
      },
      {
        icon: "fa-mouse-pointer",
        title: "File Explorer",
        items: [
          [
            "fa-message",
            "File Information Tooltips",
            "Hover over any file in Explorer or desktop to see type, size, and date modified in a glass tooltip."
          ]
        ]
      },
      {
        icon: "fa-bars",
        title: "Desktop Context Menu Rework",
        items: [
          [
            "fa-sitemap",
            "Nested Submenus",
            "Desktop context menus now support hover-expandable submenus for background and new-item actions with keyboard navigation."
          ]
        ]
      }
    ]
  },
  {
    date: "June 24, 2026",
    sections: [
      {
        icon: "fa-wand-magic-sparkles",
        title: "Features & Improvements",
        items: [
          [
            "fa-arrows-up-down-left-right",
            "Alt+Left-Click Window Drag",
            "Hold Alt and left-click anywhere on a window to drag it."
          ]
        ]
      }
    ]
  },
  {
    date: "June 23, 2026",
    sections: [
      {
        icon: "fa-shield-halved",
        title: "New Apps",
        items: [
          [
            "fa-display",
            "VNC Client",
            "Connect to remote desktops via VNC with saved profiles, fullscreen mode, clipboard sync, and WebSocket support."
          ]
        ]
      },
      {
        icon: "fa-snowflake",
        title: "Anonymous Browsing",
        items: [
          [
            "fa-shield-halved",
            "Tor via Snowflake",
            "Browse anonymously through a WASM Tor client (Arti) with Snowflake bridge .Per-tab isolated circuits, auto-reconnect, and a dedicated Tor Connection Manager app."
          ]
        ]
      }
    ]
  },
  {
    date: "June 22, 2026",
    sections: [
      {
        icon: "fa-layer-group",
        title: "New Feature",
        items: [
          [
            "fa-layer-group",
            "Steam Overlay",
            "Press Shift+Tab in any game to open the Steam overlay with playtime, achievements, friends, notes, and a built-in browser."
          ]
        ]
      },
      {
        icon: "fa-clock",
        title: "New Apps",
        items: [
          ["fa-clock", "Clock", "Digital and analog clocks with alarms, stopwatch, timer, and customizable settings."]
        ]
      }
    ]
  },
  {
    date: "June 22, 2026",
    sections: [
      {
        icon: "fa-code",
        title: "New App",
        items: [
          ["fa-code", "Dev Tools (Eruda)", "Launch Eruda debugging tool for console, network, and element inspection."]
        ]
      }
    ]
  },
  {
    date: "June 21, 2026",
    sections: [
      {
        icon: "fa-keyboard",
        title: "Updated",
        items: [
          [
            "fa-keyboard",
            "Keyboard Shortcuts",
            "Rebind every system shortcut in the Shortcuts app with per-key reset and a global reset all button."
          ]
        ]
      },
      {
        icon: "fa-icons",
        title: "Customization",
        items: [
          ["fa-icons", "Desktop Icon Size", "Resize desktop icons from 32px to 128px with a new slider in Settings."],
          ["fa-expand", "Taskbar Scaling", "Scale the entire taskbar from 50% to 200% in Desktop settings."]
        ]
      }
    ]
  },
  {
    date: "June 21, 2026",
    sections: [
      {
        icon: "star",
        title: "Better animations",
        items: [
          [
            "fa-star",
            "Better Animations",
            "Added animations to start menu, on wallpaper switch, audio mixer, context menu"
          ]
        ]
      }
    ]
  },
  {
    date: "June 20, 2026",
    sections: [
      {
        icon: "fa-map",
        title: "New App",
        items: [
          [
            "fa-map",
            "Maps",
            "Explore the world with OpenStreetMap, or switch to Google Maps with configurable tile layers and settings."
          ]
        ]
      },
      {
        icon: "fa-screwdriver-wrench",
        title: "Updated",
        items: [
          [
            "fa-screwdriver-wrench",
            "System Apps",
            "Browses built-in tools with a cleaner glassmorphism grid and instant search."
          ]
        ]
      }
    ]
  },
  {
    date: "June 19, 2026",
    sections: [
      {
        icon: "fa-camera",
        title: "New App",
        items: [
          [
            "fa-camera",
            "Screenshot",
            "Capture fullscreen, select areas, or record video with three instant shortcuts."
          ],
          [
            "fa-eye-dropper",
            "Color Picker",
            "Sample colors from anywhere on screen with Alt+H and a magnified pixel preview."
          ]
        ]
      }
    ]
  },
  {
    date: "June 18, 2026",
    sections: [
      {
        icon: "fa-server",
        title: "Virtual Machine Manager",
        items: [
          [
            "fa-server",
            "Virtual Machine Manager",
            "Boot simulated OS environments like Windows 93, 96, XP, 10, 11, and Mac OS right in your browser."
          ]
        ]
      },
      {
        icon: "fa-star",
        title: "Jump Effect",
        items: [["fa-star", "Cursor Jump Effect", "Added icon jump effect for app launches"]]
      },
      {
        icon: "fa-star",
        title: "Fixed Games",
        items: [["fa-star", "Fixed Games", "Fixed Terraria, GtaVC, Kindergarten"]]
      },
      {
        icon: "fa-database",
        title: "File Explorer",
        items: [
          ["fa-database", "Storage Indicator", "Shows total used space in Explorer sidebar."],
          [
            "fa-object-group",
            "Selection Box",
            "Drag-select multiple files in Explorer with a visible selection rectangle."
          ],
          [
            "fa-image",
            "Desktop Thumbnails",
            "Desktop icons now show actual image previews instead of generic file icons."
          ]
        ]
      },
      {
        icon: "fa-times",
        title: "Taskbar",
        items: [
          [
            "fa-times",
            "Close Button on Preview",
            "Hover a taskbar item and click the close button on its preview to close the app."
          ]
        ]
      },
      {
        icon: "fa-trash",
        title: "Trash",
        items: [
          [
            "fa-trash",
            "Trash Bin",
            "Deleted files now go to Trash instead of being permanently removed. Restore or permanently delete from the new Trash view in Explorer sidebar."
          ]
        ]
      }
    ]
  },
  {
    date: "June 17, 2026",
    sections: [
      {
        icon: "fa-terminal",
        title: "Terminal",
        items: [["fa-terminal", "Improved terminal color and commands", "Improved terminal color and commands"]]
      },
      {
        icon: "fa-wand-magic-sparkles",
        title: "New Apps",
        items: [
          ["fa-cube", "50 More Apps", "Added 50 more web apps."],
          ["fa-image", "Pixlr", "Photo editing and design tool."],
          ["fa-brain", "Grok", "AI-powered conversations and assistance."],
          ["fa-play-circle", "Aniwatch", "Stream anime content."],
          ["fa-tiktok", "TikTok", "Short-form video content."],
          ["fa-video", "Senshi", "Streaming animes."]
        ]
      }
    ]
  },
  {
    date: "June 15, 2026",
    sections: [
      {
        icon: "fa-download",
        title: "New App",
        items: [
          [
            "fa-download",
            "Torrent Client",
            "Download and manage torrents with WebTorrent support for magnet links and torrent files."
          ]
        ]
      },
      {
        icon: "fa-wand-magic-sparkles",
        title: "Taskbar Improvements",
        items: [
          [
            "fa-mouse-pointer",
            "Click to Minimize/Restore",
            "Click taskbar items to minimize active windows, click again to restore."
          ],
          ["fa-arrows-alt", "Drag to Reorder", "Drag taskbar items to rearrange them however you want."],
          [
            "fa-window-restore",
            "New Window Option",
            "Right-click taskbar items for 'New Window' option to launch app instances."
          ]
        ]
      },
      {
        icon: "fa-wand-magic-sparkles",
        title: "Bug Fixes",
        items: [
          ["fa-wand-magic-sparkles", "Window Display Fix", "Fixed height scaling issues when minimizing windows."],
          [
            "fa-wand-magic-sparkles",
            "Preview Fixes",
            "Fixed taskbar preview appearing during context menu and drag operations."
          ]
        ]
      }
    ]
  },
  {
    date: "June 12, 2026",
    sections: [
      {
        icon: "fa-wand-magic-sparkles",
        title: "Start Menu Rework",
        items: [
          [
            "fa-wand-magic-sparkles",
            "Unified Redesign",
            "Start menu rebuilt with keyboard navigation (arrow keys + Enter), alphabetical app grouping with section headers, improved search UI."
          ]
        ]
      },
      {
        icon: "fa-wand-magic-sparkles",
        title: "Bug Fixes",
        items: [
          [
            "fa-wand-magic-sparkles",
            "Bug fixes",
            "Bug fixes for: task manager, app restoration, setup app, start menu, clipboard, weather, customize app, calculator / Add keybind for enter to login."
          ]
        ]
      }
    ]
  },
  {
    date: "June 11, 2026",
    sections: [
      {
        icon: "fa-wand-magic-sparkles",
        title: "New Features",
        items: [["fa-user", "Enchance login ui", "Redesigned login / lockscreen ui."]]
      },
      {
        icon: "fa-wand-magic-sparkles",
        title: "New App",
        items: [
          ["fa-users", "Accounts", "Manage multiple user accounts with create, edit, delete, and switch functionality."]
        ]
      }
    ]
  },
  {
    date: "June 9, 2026",
    sections: [
      {
        icon: "fa-wand-magic-sparkles",
        title: "Add Cat Goes Fishing",
        items: [["fa-star", "Add Cat Goes Fishing", "Added Cat Goes Fishing"]]
      }
    ]
  },
  {
    date: "June 6, 2026",
    sections: [
      {
        icon: "fa-wand-magic-sparkles",
        title: "New App",
        items: [["fa-globe", "Scramjet Browser", "Browse the web with built-in proxy support and tab management."]]
      }
    ]
  },
  {
    date: "June 4, 2026",
    sections: [
      {
        icon: "fa-window-restore",
        title: "Workspace System",
        items: [
          [
            "fa-layer-group",
            "Virtual Workspaces",
            "Added virtual desktops with fast switching, smooth animations, and an overview for managing and moving windows between workspaces."
          ]
        ]
      },
      {
        icon: "fa-wand-magic-sparkles",
        title: "New App",
        items: [
          [
            "fa-wave-square",
            "Rhythms",
            "Audio visualizer with 4 display modes, customizable bar count and color options."
          ]
        ]
      },
      {
        icon: "fa-volume-high",
        title: "Audio Mixer",
        items: [
          [
            "fa-sliders",
            "Audio Visualizer",
            "Visualize live audio volume directly inside Audio Mixer sliders with dynamic amplitude tracking."
          ]
        ]
      },
      {
        icon: "fa-music",
        title: "Evil Spotify",
        items: [
          [
            "fa-clock-rotate-left",
            "Restore Playback",
            "Automatically resume your last played song and position when opening Evil Spotify."
          ]
        ]
      }
    ]
  },
  {
    date: "June 3, 2026",
    sections: [
      {
        icon: "fa-palette",
        title: "Theming System",
        items: [["fa-save", "Custom Theme Saving", "Save and name your own themes with live color preview."]]
      }
    ]
  },
  {
    date: "June 2, 2026",
    sections: [
      {
        icon: "fa-wand-magic-sparkles",
        title: "New App",
        items: [["fa-code", "Yuki Dev Tools", "Run IT Tools that look nice with yukios themes."]]
      },
      {
        icon: "fa-palette",
        title: "Theming System",
        items: [
          [
            "fa-font",
            "New Font Options",
            "Added many new fonts including Monocraft (Minecraft theme), Inter, Rubik, Sora, and JetBrains Mono."
          ]
        ]
      }
    ]
  },
  {
    date: "May 31, 2026",
    sections: [
      {
        icon: "fa-wand-magic-sparkles",
        title: "New App",
        items: [
          ["fa-face-smile", "Emoji Selector", "Browse and copy every emoji with category organization and search."]
        ]
      },
      {
        icon: "fa-wand-magic-sparkles",
        title: "Features & Improvements",
        items: [
          [
            "fa-sliders-h",
            "Display & Performance Merged",
            "Power mode and brightness controls unified into single tray app."
          ]
        ]
      }
    ]
  },
  {
    date: "May 30, 2026",
    sections: [
      {
        icon: "fa-wand-magic-sparkles",
        title: "Features & Improvements",
        items: [
          [
            "fa-window-restore",
            "Alt + Q Window Switching",
            "Added Alt + Q behaviour for switching focused windows like alt+tab behaviour of desktops."
          ],
          ["fa-gear", "Settings Reorganized", "Settings sections are now grouped more clearly for easier navigation."],
          ["fa-robot", "Clippy Fixed", "Fixed Clippy assistant so it works reliably again."],
          ["fa-sun", "Light Theme Text Colors", "Improved text contrast and readability across all light themes."],
          [
            "fa-arrow-pointer",
            "Miku Cursor Toggle",
            "Toggle the Hatsune Miku cursor on or off from Settings → Appearance → Custom Cursor."
          ]
        ]
      }
    ]
  },
  {
    date: "May 29, 2026",
    sections: [
      {
        icon: "fa-wand-magic-sparkles",
        title: "New Audio System",
        items: [
          [
            "fa-volume-high",
            "System Sounds",
            "New audio system with dedicated system audio controls and interaction noises."
          ]
        ]
      },
      {
        icon: "fa-wand-magic-sparkles",
        title: "New App",
        items: [
          [
            "fa-bolt",
            "Power Indicator",
            "New tray app for power management. Switch between Turbo, Balanced, and Quality modes with a single click."
          ]
        ]
      },
      {
        icon: "fa-wand-magic-sparkles",
        title: "Features & Improvements",
        items: [
          [
            "fa-sun",
            "Brightness App",
            "Quick controls for brightness and temperature, advanced toggle for contrast, gamma, and night mode."
          ],
          [
            "fa-arrows-alt",
            "Notification Position",
            "Choose where notifications appear: Bottom Right (default), Bottom Left, Top Right, or Top Left. Smart notification suppression for default position."
          ],
          [
            "fa-mouse-pointer",
            "Tray Context Menus",
            "Right-click tray icons for quick actions. Power modes, brightness presets,network settings, clipboard app, Steam library/store, and recent games."
          ],
          [
            "fa-user-friends",
            "Live Friends Stats",
            "Track active users and trending OS apps inside your Steam Friends List."
          ],
          ["fa-mask", "Incognito mode", "Add incognito mode in browser"]
        ]
      },
      {
        icon: "fa-wand-magic-sparkles",
        title: "New App",
        items: [
          [
            "fa-bolt",
            "Power Indicator",
            "New tray app for power management. Switch between Turbo, Balanced, and Quality modes with a single click."
          ]
        ]
      },
      {
        icon: "fa-wand-magic-sparkles",
        title: "Features & Improvements",
        items: [
          [
            "fa-arrows-alt",
            "Notification Position",
            "Choose where notifications appear: Bottom Right (default), Bottom Left, Top Right, or Top Left. Smart notification suppression for default position."
          ]
        ]
      }
    ]
  },
  {
    date: "May 26, 2026",
    sections: [
      {
        icon: "fa-wand-magic-sparkles",
        title: "New App",
        items: [
          [
            "fa-robot",
            "Yuki AI Assistant",
            "Local AI assistant that runs in your browser - launch apps, manage files, and chat without sending data anywhere."
          ],
          [
            "fa-user-gear",
            "Setup Profile Step",
            "You can now choose your nickname and avatar during your first-time setup, with a final preview of your profile before you finish."
          ],
          [
            "fa-book-open",
            "YukiOS Guide",
            "A built-in guide that walks you through apps, features, and how everything fits together."
          ],
          [
            "fa-th-list",
            "Installed Apps",
            "Manage all your apps in one place. Rename, enable/disable, and uninstall apps with bulk selection support."
          ],
          [
            "fa-clipboard",
            "Clipboard Manager",
            "Keeps everything you copy - access your full clipboard history from the tray icon."
          ]
        ]
      },
      {
        icon: "fa-wand-magic-sparkles",
        title: "Features & Improvements",
        items: [
          [
            "fa-eye-slash",
            "Transparent UI Toggle",
            "Make your taskbar and start menu fully transparent with the new Transparent UI setting in the appearance options."
          ],
          ["fa-bell", "Smart Notification Icons", "Notifications now automatically use app icons."],
          ["fa-maximize", "GUI Scaling", "Adjust the scale of your user interface."],
          ["fa-cubes", "App Creator Improvements", "Fixed URL validation to auto-add https://, improved proxy."]
        ]
      }
    ]
  },
  {
    date: "May 25, 2026",
    sections: [
      {
        icon: "fa-palette",
        title: "Theming System",
        items: [
          [
            "fa-swatchbook",
            "Theme Presets & Custom Themes",
            "Expanded theming system with improved consistency across all themes and better custom theme support."
          ]
        ]
      },
      {
        icon: "fa-wand-magic-sparkles",
        title: "Features & Improvements",
        items: [
          [
            "fa-up-right-and-down-left-from-center",
            "Alt+Right-Click Window Resize",
            "Hold Alt or Super key and right-click drag anywhere on a window to resize it quickly."
          ]
        ]
      }
    ]
  },
  {
    date: "May 24, 2026",
    sections: [
      {
        icon: "fa-wand-magic-sparkles",
        title: "Features & Improvements",
        items: [
          [
            "fa-rocket",
            "Setup Wizard Enhancement",
            "Enhanced setup wizard with keyboard shortcuts reference, filesystem introduction, turbo mode selection, start menu pinning, and transparency level options."
          ]
        ]
      }
    ]
  },
  {
    date: "May 23, 2026",
    sections: [
      {
        icon: "fa-wand-magic-sparkles",
        title: "Features & Improvements",
        items: [
          ["fa-cube", "Yuki Blender", "Added new blender app with enchanced 3d functionality."],
          ["fa-database", "Storage Editor", "Added new Storage Editor app."],
          [
            "fa-film",
            "Window Animation System",
            "Added 35-effect window animation engine: customize open, close, and minimize animations plus click bubble feedback."
          ],
          ["fa-window-maximize", "Improve taskbar previews", "Improved taskbar window previews."]
        ]
      }
    ]
  },
  {
    date: "May 22, 2026",
    sections: [
      {
        icon: "fa-wand-magic-sparkles",
        title: "Features & Improvements",
        items: [
          ["fa-gamepad", "Azahar Emulator", "Add azahar emulator with 3ds support"],
          ["fa-rocket", "Setup Wizard", "Introduced first-time setup wizard for system personalization."],
          ["fa-gamepad", "LuminSDK Catalog", "Added LuminSDK with 1000+ games catalog to steam app."],
          ["fa-video", "Yuki Convert Upgrade", "Added video and audio format support for file conversion."],
          ["fa-window-maximize", "Context Menu Fixes", "Fixed desktop context menu overflow issues."]
        ]
      }
    ]
  },
  {
    date: "May 21, 2026",
    sections: [
      {
        icon: "fa-wand-magic-sparkles",
        title: "Features & Improvements",
        items: [
          ["fa-thumbtack", "Taskbar Pinning Behaviour Improvement", "Improved taskbar pinning behaviour."],
          ["fa-trophy", "Improve achievements app ui", "Improved achievements app styling."]
        ]
      }
    ]
  },
  {
    date: "May 19, 2026",
    sections: [
      {
        icon: "fa-wand-magic-sparkles",
        title: "Features & Improvements",
        items: [
          ["fa-window-maximize", "Add Tray Bar", "Added a new tray bar managing background applications."],
          [
            "fa-table-cells-large",
            "Start Menu Customization",
            "Add option to customize start menu categories and items."
          ],
          ["fa-rocket", "Turbo Mode", "Added turbo mode to os."],
          ["fa-gear", "Settings App", "Reworked settings app interface and navigation."],
          ["fa-minimize", "Window Animations", "Added smooth window drag animations."]
        ]
      }
    ]
  },
  {
    date: "May 18, 2026",
    sections: [
      {
        icon: "fa-wand-magic-sparkles",
        title: "Features & Improvements",
        items: [["fa-star", "Angry Birds 2", "Added angry birds 2 / Lobotomy Corp."]]
      }
    ]
  },
  {
    date: "May 17, 2026",
    sections: [
      {
        icon: "fa-wand-magic-sparkles",
        title: "Features & Improvements",
        items: [
          [
            "fa-user-circle",
            "New Login Screen",
            "Added nickname and profile selection on startup to initialize your session."
          ],
          [
            "fa-lock",
            "Desktop Lock Screen",
            "Lock your session quickly to prevent unauthorized access while keeping your workspace running."
          ],
          [
            "fa-terminal",
            "Unified Command Palette",
            "Launch apps, open files, apply themes, or run system commands globally via Ctrl+K or F1."
          ],
          [
            "fa-keyboard",
            "Keyboard Shortcuts App",
            "Explore all global hotkeys and built-in application shortcuts in one central utility."
          ],
          [
            "fa-window-restore",
            "Window Session Persistence",
            "Automatically saves and restores open window states, layout, and positioning across reloads."
          ]
        ]
      }
    ]
  },
  {
    date: "May 15, 2026",
    sections: [
      {
        icon: "fa-wand-magic-sparkles",
        title: "Features & Improvements",
        items: [
          ["fa-wifi", "CDN Mirror Selection", "Added CDN Mirror Selection option."],
          ["fa-gear", "Settings & UI Improvement", "Added setting categories and Theme Selection"]
        ]
      }
    ]
  },
  {
    date: "May 14, 2026",
    sections: [
      {
        icon: "fa-wand-magic-sparkles",
        title: "Features & Improvements",
        items: [
          ["fa-star", "Steam Improvement", "Improved steam ui and added settings."],
          ["fa-film", "Ruffle App", "Added ruffle."],
          ["fa-star", "Slime Rancher and TABS", "Added Slime Rancher and TABS."]
        ]
      }
    ]
  },
  {
    date: "May 9, 2026",
    sections: [
      {
        icon: "fa-wand-magic-sparkles",
        title: "Features & Improvements",
        items: [
          ["fa-steam-symbol", "Steam Improvement", "Improved steam ui and added settings."],
          ["fa-film", "Ruffle App", "Added ruffle."],
          ["fa-mobile-screen", "PWA Support", "Added progressive web app support for YukiOS."],
          ["fa-sliders", "Taskbar Customization support", "Added taskbar alignment options."],
          ["fa-user", "Profile Customization support", "Added Customize Profile app."],
          ["fa-brands fa-steam", "Steam Improvement", "Added data pack install option steam and optimize load speed"],
          ["fa-arrow-pointer", "Cursor Support", "Added custom cursor support"],
          ["fa-route", "Add proxy support for custom apps", "Added proxy support for created web apps"],
          ["fa-wrench", "App Creator Improvements", "Improved the App Creator workflow and usability."],
          [
            "fa-gamepad",
            "New Games: Happy Room, Fez, TABS, Slime Rancher",
            "Added Happy Room, Fez,TABS,Slime Rancher to the games collection."
          ],
          [
            "fa-gamepad",
            "New Games: My Rusty Submarine, Upstream",
            "Added My Rusty Submarine and Upstream to the games collection."
          ],
          ["fa-rectangle-ad", "Ads", "Added ads integration."],
          ["fa-chart-line", "Analytics Toggle", "Added a settings toggle to enable or disable analytics."],
          ["fa-brands fa-youtube", "YouTube Utility App", "Added a YouTube utility app."],
          ["fa-brands fa-spotify", "Spotify Utility App", "Added a Spotify utility app."],
          ["fa-id-card", "Properties Page Improvements", "Improved the file/app properties page."],
          [
            "fa-up-down-left-right",
            "Desktop Stretch Scroll",
            "Added a Settings toggle to prevent desktop page stretch/scroll when dragging windows out of bounds"
          ]
        ]
      }
    ]
  },
  {
    date: "May 5, 2026",
    sections: [
      {
        icon: "fa-wand-magic-sparkles",
        title: "Features & Improvements",
        items: [
          ["fa-keyboard", "Start Menu Keybinds", "Open the start menu faster with Space, Tab, or Ctrl."],
          ["fa-trophy", "Achievements Toggle", "Quickly enable or disable achievements from settings."]
        ]
      }
    ]
  },
  {
    date: "May 4, 2026",
    sections: [
      {
        icon: "fa-wand-magic-sparkles",
        title: "Features & Improvements",
        items: [
          ["fa-right-left", "Import / Export", "Back up or migrate your setup with the new data import/export system."],
          ["fa-trophy", "Achievements UI Refresh", "Reworked the achievements interface for a cleaner experience."],
          ["fa-house", "Steam Home Button", "Added a add to home button in the Steam app."],
          ["fa-ellipsis", "Menus & Explorer Polish", "Improved context menus and refined explorer styling."]
        ]
      }
    ]
  },
  {
    date: "May 2, 2026",
    sections: [
      {
        icon: "fa-rocket",
        title: "Improvements",
        items: [
          [
            "fa-magnifying-glass",
            "Steam Launch from Search",
            "Launch Steam apps directly from the search/query experience."
          ],
          ["fa-book-open", "Game Descriptions", "Added game descriptions for better discovery."]
        ]
      }
    ]
  },
  {
    date: "April 2026",
    sections: [
      {
        icon: "fa-wand-magic-sparkles",
        title: "Features & Improvements",
        items: [
          [
            "fa-trophy",
            "Achievements System",
            "A new achievements system has been added to track your milestones and progress across the OS."
          ],
          [
            "fa-gamepad",
            "JsDos gui support",
            "You can now upload jsdos files directly at jsdos app and play featured jsdos games."
          ],
          [
            "fa-layer-group",
            "Virtual Workspaces",
            "Split your work across multiple desktops and switch between them without the clutter."
          ],
          [
            "fa-microsoft",
            "Window Snapping and Edge Tiling",
            "Organize your workspace by dragging windows to screen edges or using Super+Arrow keys to tile windows into halves or quarters."
          ],
          [
            "fa-sliders",
            "Audio Mixer",
            "Turn down that one noisy app - per-app volume controls live in the audio mixer."
          ]
        ]
      }
    ]
  },
  {
    date: "March 2026",
    sections: [
      {
        icon: "fa-rocket",
        title: "New Apps",
        items: [
          ["fa-code", "Yuki Code", "A full code editor powered by VS Code, built right into your desktop."],
          ["fa-file-lines", "Markdown Viewer", "Open and read Markdown files directly in the system."],
          ["fa-cube", "3D Model Viewer", "View 3D models without any external software."],
          ["fa-file-word", "Full Office Suite", "Create and edit office documents right in your workspace."],
          ["fa-calendar-days", "Events in Clock", "Track dates and events from the Clock app's Events tab."],
          [
            "fa-note-sticky",
            "Notepad Enhancements",
            "Notepad now handles large files gracefully with a prompt before opening heavy content."
          ],
          ["fa-paintbrush", "LibreSprite", "Pixel art editor is now included."],
          ["fa-comments", "Kivi IRC", "IRC client added for real-time chat."]
        ]
      },
      {
        icon: "fa-gamepad",
        title: "New Games",
        items: [
          [
            "fa-car",
            "New Titles",
            "Added gnmath game category and several new games including Earn to Die, Rotate, Slither/Yorg io, Angry Birds Series,Solar Smash, Trollface Quest, and more."
          ],
          ["fa-floppy-disk", "Classic DOS Games", "Classic DOS games are now playable through jsdos integration."]
        ]
      },
      {
        icon: "fa-wand-magic-sparkles",
        title: "Features & Improvements",
        items: [
          ["fa-bell", "Notification Center", "A centralized place to view system notifications."],
          ["fa-music", "Audio Playback", "You can now play audio files directly."],
          ["fa-globe", "HTML File Support", "HTML files can now be opened and rendered."],
          [
            "fa-file-zipper",
            "Archive Support",
            "Extract 7z and .tar.xz archives, in addition to zip files now available via right-click context menu."
          ],
          ["fa-bolt", "File Download", "You can now download files from explorer right clicking to files."],
          ["fa-image", "Dynamic Favicon", "The browser tab icon now updates to reflect what you're doing."],
          ["fa-video", "Yuki Convert", "Convert any file to other formats fuly locally without uploading to a server."],
          ["fa-window-restore", "Window Icons", "App windows now display their respective icons in the title bar."],
          ["fa-bars", "Window Header Menu", "Right-click on a window header for quick actions."],
          ["fa-i-cursor", "F2 Rename in Explorer", "Press F2 to rename files quickly, just like a native OS."],
          ["fa-hand", "Drag to Desktop", "Drag files from apps directly to the desktop to save them."],
          [
            "fa-arrows-rotate",
            "Desktop Auto-Refresh",
            "The desktop now automatically reflects file changes without a manual refresh."
          ],
          ["fa-film", "Video Turbo", "Smoother video playback across the system."],
          [
            "fa-star",
            "Custom Shortcuts",
            "Create your own keyboard shortcuts with custom actions like launching apps or running code."
          ]
        ]
      }
    ]
  }
];

const NEWS_UPDATES = [...appNewsEntries, ...EXISTING_NEWS_UPDATES];

const hashStringDjb2 = (text) => {
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 33) ^ text.charCodeAt(i);
  }
  return `djb2:${(hash >>> 0).toString(16)}`;
};

export const getNewsContentSignature = () => {
  const minimal = NEWS_UPDATES.map((u) => ({
    date: u.date,
    sections: (u.sections || []).map((s) => ({
      icon: s.icon,
      title: s.title,
      items: (s.items || []).map(([i, t, d]) => [i, t, d])
    }))
  }));
  return hashStringDjb2(JSON.stringify(minimal));
};

export const updateNewsBadge = () => {
  const currentSignature = getNewsContentSignature();
  const storedSignature = os.storage.get(StorageKeys.newsReadSignatureKey);
  const hasUnreadNews = currentSignature !== storedSignature;

  const badge = $(".news-badge");
  if (badge) {
    setStyle(badge, { display: hasUnreadNews ? "flex" : "none" });
  }
};

export class NewsApp extends BaseApp {
  constructor(services) {
    super(services);
  }

  open() {
    const updates = NEWS_UPDATES;

    const renderSections = (sections) =>
      sections
        .map(
          (section) => `
        <div class="news-section">
          <h2 class="news-section-title">
            <i class="fas ${section.icon}"></i>
            <span>${section.title}</span>
          </h2>
          <div class="news-items">
            ${section.items
              .map(
                ([icon, title, desc]) => `
              <div class="news-item">
                <div class="news-item-icon" aria-hidden="true">
                  <i class="fas ${icon}"></i>
                </div>
                <div class="news-item-body">
                  <div class="news-item-title">${title}</div>
                  <div class="news-item-desc">${desc}</div>
                </div>
              </div>
            `
              )
              .join("")}
          </div>
        </div>
      `
        )
        .join("");

    const updatesHtml = updates
      .map(
        (update) => `
      <div class="news-update">
        <div class="news-update-head">
          <div class="news-date">${update.date}</div>
          <div class="news-label">${update.label || "YukiOS Update"}</div>
        </div>
        ${renderSections(update.sections)}
      </div>
    `
      )
      .join("");

    const content = `
      <div class="window-content" style="padding:0; height: calc(100% - 40px); overflow: hidden;">
        <div class="news-root">
          <div class="news-hero">
            <div class="news-hero-left">
              <div class="news-hero-icon" aria-hidden="true">
                <i class="fas fa-newspaper"></i>
              </div>
              <div class="news-hero-title">
                <h1>What's New</h1>
                <p>The latest updates and changes shipped to your desktop.</p>
              </div>
            </div>
            <div class="news-hero-meta">
              <div class="news-pill" title="Latest update shown first">
                <i class="fas fa-clock"></i>
                <span>Latest: ${updates[0]?.date ?? "-"}</span>
              </div>
            </div>
          </div>

          ${updatesHtml}
        </div>
      </div>
    `;

    const win = os.window.create("news-yukios", "What's New", "720px", "520px", {
      icon: "fa fa-newspaper",
      appId: "newsApp"
    });
    win.innerHTML = content;
    this.initNews();
    return win;
  }

  initNews() {
    os.storage.set(StorageKeys.newsReadSignatureKey, getNewsContentSignature());
    os.storage.set(StorageKeys.newsSeenKey, "true");
    window.newsApp = this;
    updateNewsBadge();
  }
}
