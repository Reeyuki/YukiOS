import { ClippyAnimation } from "./ai/clippy.js";

const CDN_BASE = "https://cdn.jsdelivr.net/gh/Reeyuki/yukios@main";

export const SYSTEM_APPS = {
  browserApp: {
    type: "system",
    title: "Yuki Browser",
    icon: "fas fa-snowflake",
    launchType: "instance",
    clippy: { message: "Your bookmarks and tabs are ready when you are.", animation: ClippyAnimation.Wave }
  },
  yukiDevTools: {
    type: "system",
    title: "Yuki Dev Tools",
    icon: "fas fa-code",
    launchType: "method",
    launchMethod: "openYukiDevToolsApp",
    clippy: {
      message: "Open IT Tools with Yuki styling and a live iframe bridge.",
      animation: ClippyAnimation.GetWizardy
    }
  },
  explorer: {
    type: "system",
    title: "Explorer",
    icon: `${CDN_BASE}/static/icons/file.webp`,
    launchType: "instance",
    clippy: {
      message: "Move files around and keep your folders under control.",
      animation: ClippyAnimation.Searching
    }
  },
  yukiConvert: {
    type: "system",
    title: "Yuki Convert",
    icon: "fas fa-exchange-alt",
    launchType: "instance",
    clippy: {
      message: "Drop in a file and I'll turn it into the format you need.",
      animation: ClippyAnimation.GetWizardy
    }
  },
  dataEditor: {
    type: "system",
    title: "Storage Editor",
    icon: "fas fa-database",
    launchType: "instance",
    clippy: { message: "Edit stored values carefully and keep the system tidy.", animation: ClippyAnimation.Show }
  },
  terminal: {
    type: "system",
    title: "Terminal",
    icon: `${CDN_BASE}/static/icons/terminal.webp`,
    launchType: "instance",
    clippy: { message: "Run commands here and keep the basics in reach.", animation: ClippyAnimation.Show }
  },
  notepad: {
    type: "system",
    title: "Notepad",
    icon: `${CDN_BASE}/static/icons/notepad.webp`,
    launchType: "instance",
    clippy: { message: "Start a quick note or draft without overthinking it.", animation: ClippyAnimation.Writing }
  },
  markdown: {
    type: "system",
    title: "Markdown",
    icon: "fab fa-markdown",
    launchType: "instance",
    clippy: { message: "Write in Markdown and keep the structure clean.", animation: ClippyAnimation.Writing }
  },
  emulatorApp: {
    type: "system",
    title: "Yuki Emulator",
    icon: `${CDN_BASE}/static/icons/emulator.webp`,
    launchType: "instance",
    clippy: { message: "Launch old software here and keep the nostalgia alive.", animation: ClippyAnimation.Show }
  },
  ruffleApp: {
    type: "system",
    title: "Ruffle",
    icon: `${CDN_BASE}/static/icons/ruffle.webp`,
    launchType: "instance",
    clippy: { message: "Load Flash content here without the usual hassle.", animation: ClippyAnimation.Show }
  },
  monaco: {
    type: "system",
    title: "Yuki Code",
    icon: "fas fa-code",
    launchType: "instance",
    clippy: { message: "Open a new tab and get your code moving.", animation: ClippyAnimation.GetWizardy }
  },
  cameraApp: {
    type: "system",
    title: "Camera App",
    icon: "fas fa-camera",
    launchType: "instance",
    clippy: { message: "Take a shot and capture the moment cleanly.", animation: ClippyAnimation.Show }
  },
  settingsApp: {
    type: "system",
    title: "Settings",
    icon: "fa fa-cog",
    launchType: "instance",
    clippy: { message: "Tune the system here and make it work your way.", animation: ClippyAnimation.Show }
  },
  calculatorApp: {
    type: "system",
    title: "Calculator",
    icon: "fa fa-calculator",
    launchType: "instance",
    clippy: { message: "Punch in numbers and I'll handle the quick arithmetic.", animation: ClippyAnimation.Show }
  },
  aboutApp: {
    type: "system",
    title: "About",
    icon: "fa fa-circle-info",
    launchType: "instance",
    clippy: {
      message: "Check the build details and see what this system is running.",
      animation: ClippyAnimation.Show
    }
  },
  shortcutsApp: {
    type: "system",
    title: "Shortcuts",
    icon: "fa fa-keyboard",
    launchType: "instance",
    clippy: { message: "Open shortcuts and keep the keyboard within reach.", animation: ClippyAnimation.Show }
  },
  newsApp: {
    type: "system",
    title: "What's New",
    icon: "fa fa-newspaper",
    launchType: "instance",
    clippy: { message: "Catch up on the latest changes and see what shipped.", animation: ClippyAnimation.Show }
  },
  model3dApp: {
    type: "system",
    title: "Yuki Blender",
    icon: `${CDN_BASE}/static/icons/3dmodel.webp`,
    launchType: "instance",
    clippy: {
      message: "Inspect models here and spin them from every angle.",
      animation: ClippyAnimation.LookDownLeft
    }
  },
  steamApp: {
    type: "system",
    title: "Steam",
    icon: `${CDN_BASE}/static/icons/steam.webp`,
    launchType: "steam",
    clippy: {
      message: "Browse game picks here and find something worth launching.",
      animation: ClippyAnimation.Wave
    }
  },
  systemApps: {
    type: "system",
    title: "System Apps",
    icon: "fas fa-screwdriver-wrench",
    launchType: "instance",
    clippy: { message: "Browse the built-in tools and jump to the one you need.", animation: ClippyAnimation.Show }
  },
  taskManagerApp: {
    type: "system",
    title: "Task Manager",
    icon: "fa fa-list-check",
    launchType: "instance",
    clippy: {
      message: "Spot heavy apps fast and shut down the real troublemakers.",
      animation: ClippyAnimation.CheckingSomething
    }
  },
  weatherApp: {
    type: "system",
    title: "Weather",
    icon: "fa fa-cloud",
    launchType: "instance",
    clippy: { message: "Check the forecast before you head out.", animation: ClippyAnimation.Show }
  },
  appCreatorApp: {
    type: "system",
    title: "App Creator",
    icon: "fas fa-cubes",
    launchType: "instance",
    clippy: {
      message: "Build a custom shortcut and point it straight at your target url.",
      animation: ClippyAnimation.GetWizardy
    }
  },
  officeApp: {
    type: "system",
    title: "Office",
    icon: `${CDN_BASE}/static/icons/office.webp`,
    launchType: "instance",
    clippy: {
      message: "Open office files here and keep the document flow moving.",
      animation: ClippyAnimation.Show
    }
  },
  shittify: {
    type: "system",
    title: "Evil Spotify",
    icon: `${CDN_BASE}/static/icons/shittify.webp`,
    launchType: "instance",
    clippy: {
      message: "Queue a track and remix the mood without leaving the desktop.",
      animation: ClippyAnimation.Wave
    }
  },
  jsDosApp: {
    type: "system",
    title: "JsDos",
    icon: `${CDN_BASE}/static/icons/jsdos.webp`,
    launchType: "instance",
    clippy: { message: "Boot old DOS software and keep classic tools alive.", animation: ClippyAnimation.Show }
  },
  v86app: {
    type: "system",
    title: "Virtual 86",
    icon: `${CDN_BASE}/static/icons/v86.webp`,
    launchType: "instance",
    clippy: {
      message: "Start a full machine and let the virtual hardware do the work.",
      animation: ClippyAnimation.Show
    }
  },
  achievementsApp: {
    type: "system",
    title: "Achievements",
    icon: "fas fa-trophy",
    launchType: "instance",
    clippy: { message: "Track progress here and see what you've unlocked.", animation: ClippyAnimation.GetArtsy }
  },
  profileCustomizer: {
    type: "system",
    title: "Customize Profile",
    icon: "fas fa-circle-user",
    launchType: "instance",
    clippy: {
      message: "Update your profile and make the desktop feel like yours.",
      animation: ClippyAnimation.GetArtsy
    }
  },
  youtube: {
    type: "system",
    title: "YouTube Utilities",
    icon: `${CDN_BASE}/static/icons/youtube.webp`,
    launchType: "instance",
    clippy: { message: "Paste a video link and I'll slot it into a player.", animation: ClippyAnimation.Show }
  },
  libreSprite: {
    type: "system",
    title: "LibreSprite",
    source: "https://yukios.netlify.app/static/apps/libresprite/index.html",
    icon: `${CDN_BASE}/static/icons/libresprite.webp`,
    launchType: "iframe",
    clippy: { message: "Open LibreSprite and sketch directly in the browser.", animation: ClippyAnimation.GetArtsy }
  },
  kiwiIRC: {
    type: "system",
    title: "kiwiIRC",
    source: "/static/apps/kiwiirc/index.html",
    icon: `${CDN_BASE}/static/icons/kiwiirc.webp`,
    launchType: "iframe",
    clippy: { message: "Jump into chat and keep your conversations in one place.", animation: ClippyAnimation.Show }
  },
  azahar: {
    type: "system",
    title: "Azahar (3DS Emulator)",
    source: "/static/apps/azahar/index.html",
    icon: `${CDN_BASE}/static/icons/azahar.webp`,
    launchType: "iframe",
    clippy: {
      message: "Launch 3DS software here and keep handheld games on the desktop.",
      animation: ClippyAnimation.Show
    }
  },
  setupApp: {
    type: "system",
    title: "Setup Wizard",
    icon: "fas fa-rocket",
    launchType: "instance",
    clippy: {
      message: "Walk through setup and get the basics out of the way.",
      animation: ClippyAnimation.Greeting
    }
  },
  installedApps: {
    type: "system",
    title: "Installed Apps",
    icon: "fas fa-th-list",
    launchType: "instance",
    clippy: {
      message: "Review installed apps and keep the registry tidy.",
      animation: ClippyAnimation.CheckingSomething
    },
    excludeFromInstalledApps: true
  },
  yukiOsGuide: {
    type: "system",
    title: "Yuki OS Guide",
    icon: "fas fa-book-open",
    launchType: "instance",
    clippy: { message: "Open the guide and learn the parts that matter fastest.", animation: ClippyAnimation.Show }
  },
  clipboardManager: {
    type: "system",
    title: "Clipboard Manager",
    icon: "fas fa-paste",
    launchType: "instance",
    clippy: {
      message: "Browse clipboard history and grab the last thing you copied.",
      animation: ClippyAnimation.Searching
    }
  },
  aiAssistant: {
    type: "system",
    title: "Yuki AI Assistant",
    icon: "fas fa-robot",
    launchType: "instance",
    clippy: { message: "Ask a question and let me help with the next step.", animation: ClippyAnimation.GetWizardy }
  },
  emojiSelector: {
    type: "system",
    title: "Emoji Selector",
    icon: "fas fa-face-smile",
    launchType: "instance",
    clippy: { message: "Pick the right emoji and keep the reaction simple.", animation: ClippyAnimation.GetArtsy }
  },
  paint: {
    type: "system",
    title: "Paint",
    source: "https://jspaint.app",
    icon: `${CDN_BASE}/static/icons/paint.webp`,
    launchType: "iframe"
  },
  photopea: {
    type: "system",
    title: "Photopea",
    source: "https://www.photopea.com/",
    icon: `${CDN_BASE}/static/icons/photopea.webp`,
    launchType: "iframe"
  },
  vscode: {
    type: "system",
    title: "Vs Code",
    source: "https://emupedia.net/emupedia-app-vscode",
    icon: `${CDN_BASE}/static/icons/vscode.webp`,
    launchType: "iframe"
  },
  miniPaint: {
    type: "system",
    title: "Mini Paint",
    source: "https://viliusle.github.io/miniPaint/",
    icon: "fas fa-paint-brush",
    launchType: "iframe"
  }
};

export const SYSTEM_APP_IDS = Object.keys(SYSTEM_APPS);
