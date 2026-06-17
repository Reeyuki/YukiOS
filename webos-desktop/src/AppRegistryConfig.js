import { ClippyAnimation } from "./ai/clippy.js";
import { APP_DESCRIPTIONS } from "./games/gameDescriptions.js";

const CDN_BASE = "https://cdn.jsdelivr.net/gh/Reeyuki/yukios@main";

export const SYSTEM_APPS = {
  browserApp: {
    serviceKey: "browserApp",
    type: "system",
    title: "Yuki Browser",
    icon: "fas fa-snowflake",
    launchType: "instance",
    windowIdPatterns: ["browser"],
    isHeavy: true,
    category: "internet",
    clippy: { message: "Your bookmarks and tabs are ready when you are.", animation: ClippyAnimation.Wave }
  },
  yukiDevTools: {
    serviceKey: "yukiDevToolsApp",
    type: "system",
    title: "Yuki Dev Tools",
    icon: "fas fa-code",
    launchType: "method",
    launchMethod: "openYukiDevToolsApp",
    windowIdPatterns: ["yukidevtools", "yuki-dev-tools"],
    category: "development",
    clippy: {
      message: "Open IT Tools with Yuki styling and a live iframe bridge.",
      animation: ClippyAnimation.GetWizardy
    }
  },
  explorer: {
    serviceKey: "explorerApp",
    type: "system",
    title: "Explorer",
    icon: `${CDN_BASE}/static/icons/file.webp`,
    launchType: "instance",
    windowIdPatterns: ["explorer"],
    category: "system",
    clippy: {
      message: "Move files around and keep your folders under control.",
      animation: ClippyAnimation.Searching
    }
  },
  yukiConvert: {
    serviceKey: "yukiConvertApp",
    type: "system",
    title: "Yuki Convert",
    icon: "fas fa-exchange-alt",
    launchType: "instance",
    windowIdPatterns: ["yuki-convert"],
    category: "office",
    clippy: {
      message: "Drop in a file and I'll turn it into the format you need.",
      animation: ClippyAnimation.GetWizardy
    }
  },
  dataEditor: {
    serviceKey: "dataEditorApp",
    type: "system",
    title: "Storage Editor",
    icon: "fas fa-database",
    launchType: "instance",
    windowIdPatterns: ["data-editor"],
    category: "development",
    clippy: { message: "Edit stored values carefully and keep the system tidy.", animation: ClippyAnimation.Show }
  },
  terminal: {
    serviceKey: "terminalApp",
    type: "system",
    title: "Terminal",
    icon: `${CDN_BASE}/static/icons/terminal.webp`,
    launchType: "instance",
    windowIdPatterns: ["terminal"],
    category: "development",
    clippy: { message: "Run commands here and keep the basics in reach.", animation: ClippyAnimation.Show }
  },
  notepad: {
    serviceKey: "notepadApp",
    type: "system",
    title: "Notepad",
    icon: `${CDN_BASE}/static/icons/notepad.webp`,
    launchType: "instance",
    windowIdPatterns: ["notepad"],
    category: "office",
    clippy: { message: "Start a quick note or draft without overthinking it.", animation: ClippyAnimation.Writing }
  },
  markdown: {
    serviceKey: "markdownApp",
    type: "system",
    title: "Markdown",
    icon: "fab fa-markdown",
    launchType: "instance",
    windowIdPatterns: ["markdown"],
    category: "office",
    clippy: { message: "Write in Markdown and keep the structure clean.", animation: ClippyAnimation.Writing }
  },
  emulatorApp: {
    serviceKey: "emulatorApp",
    type: "system",
    title: "Yuki Emulator",
    icon: `${CDN_BASE}/static/icons/emulator.webp`,
    launchType: "instance",
    windowIdPatterns: ["emulator"],
    isHeavy: true,
    category: "games",
    clippy: { message: "Launch old software here and keep the nostalgia alive.", animation: ClippyAnimation.Show }
  },
  ruffleApp: {
    serviceKey: "ruffleApp",
    type: "system",
    title: "Ruffle",
    icon: `${CDN_BASE}/static/icons/ruffle.webp`,
    launchType: "instance",
    windowIdPatterns: ["ruffle"],
    isHeavy: true,
    category: "games",
    clippy: { message: "Load Flash content here without the usual hassle.", animation: ClippyAnimation.Show }
  },
  monaco: {
    serviceKey: "monacoApp",
    type: "system",
    title: "Yuki Code",
    icon: "fas fa-code",
    launchType: "instance",
    windowIdPatterns: ["monaco"],
    category: "development",
    clippy: { message: "Open a new tab and get your code moving.", animation: ClippyAnimation.GetWizardy }
  },
  cameraApp: {
    serviceKey: "cameraApp",
    type: "system",
    title: "Camera App",
    icon: "fas fa-camera",
    launchType: "instance",
    windowIdPatterns: ["camera"],
    category: "graphics",
    clippy: { message: "Take a shot and capture the moment cleanly.", animation: ClippyAnimation.Show }
  },
  settingsApp: {
    serviceKey: "settingsApp",
    type: "system",
    title: "Settings",
    icon: "fa fa-cog",
    launchType: "instance",
    windowIdPatterns: ["settings"],
    category: "system",
    clippy: { message: "Tune the system here and make it work your way.", animation: ClippyAnimation.Show }
  },
  calculatorApp: {
    serviceKey: "calculatorApp",
    type: "system",
    title: "Calculator",
    icon: "fa fa-calculator",
    launchType: "instance",
    windowIdPatterns: ["calculator"],
    category: "office",
    clippy: { message: "Punch in numbers and I'll handle the quick arithmetic.", animation: ClippyAnimation.Show }
  },
  aboutApp: {
    serviceKey: "aboutApp",
    type: "system",
    title: "About",
    icon: "fa fa-circle-info",
    launchType: "instance",
    windowIdPatterns: ["about"],
    category: "help",
    clippy: {
      message: "Check the build details and see what this system is running.",
      animation: ClippyAnimation.Show
    }
  },
  shortcutsApp: {
    serviceKey: "shortcutsApp",
    type: "system",
    title: "Shortcuts",
    icon: "fa fa-keyboard",
    launchType: "instance",
    windowIdPatterns: ["shortcuts"],
    category: "system",
    clippy: { message: "Open shortcuts and keep the keyboard within reach.", animation: ClippyAnimation.Show }
  },
  newsApp: {
    serviceKey: "newsApp",
    type: "system",
    title: "What's New",
    icon: "fa fa-newspaper",
    launchType: "instance",
    windowIdPatterns: ["news"],
    category: "help",
    clippy: { message: "Catch up on the latest changes and see what shipped.", animation: ClippyAnimation.Show }
  },
  model3dApp: {
    serviceKey: "model3dApp",
    type: "system",
    title: "Yuki Blender",
    icon: `${CDN_BASE}/static/icons/3dmodel.webp`,
    launchType: "instance",
    windowIdPatterns: ["model3d"],
    category: "graphics",
    clippy: {
      message: "Inspect models here and spin them from every angle.",
      animation: ClippyAnimation.LookDownLeft
    }
  },
  steamApp: {
    serviceKey: "steamApp",
    type: "system",
    title: "Steam",
    icon: `${CDN_BASE}/static/icons/steam.webp`,
    launchType: "steam",
    windowIdPatterns: ["games-app"],
    category: "games",
    clippy: {
      message: "Browse game picks here and find something worth launching.",
      animation: ClippyAnimation.Wave
    }
  },
  systemApps: {
    serviceKey: "systemAppsApp",
    type: "system",
    title: "System Apps",
    icon: "fas fa-screwdriver-wrench",
    launchType: "instance",
    windowIdPatterns: ["system-apps"],
    category: "system",
    clippy: { message: "Browse the built-in tools and jump to the one you need.", animation: ClippyAnimation.Show }
  },
  taskManagerApp: {
    serviceKey: "taskManagerApp",
    type: "system",
    title: "Task Manager",
    icon: "fa fa-list-check",
    launchType: "instance",
    windowIdPatterns: ["taskmanager", "task-manager"],
    category: "system",
    clippy: {
      message: "Spot heavy apps fast and shut down the real troublemakers.",
      animation: ClippyAnimation.CheckingSomething
    }
  },
  weatherApp: {
    serviceKey: "weatherApp",
    type: "system",
    title: "Weather",
    icon: "fa fa-cloud",
    launchType: "instance",
    windowIdPatterns: ["weather"],
    category: "internet",
    clippy: { message: "Check the forecast before you head out.", animation: ClippyAnimation.Show }
  },
  appCreatorApp: {
    serviceKey: "appCreatorApp",
    type: "system",
    title: "App Creator",
    icon: "fas fa-cubes",
    launchType: "instance",
    windowIdPatterns: ["app-creator"],
    category: "development",
    clippy: {
      message: "Build a custom shortcut and point it straight at your target url.",
      animation: ClippyAnimation.GetWizardy
    }
  },
  officeApp: {
    serviceKey: "officeApp",
    type: "system",
    title: "Office",
    icon: `${CDN_BASE}/static/icons/office.webp`,
    launchType: "instance",
    windowIdPatterns: ["office"],
    isHeavy: true,
    category: "office",
    clippy: {
      message: "Open office files here and keep the document flow moving.",
      animation: ClippyAnimation.Show
    }
  },
  shittify: {
    serviceKey: "shittifyApp",
    type: "system",
    title: "Evil Spotify",
    icon: `${CDN_BASE}/static/icons/shittify.webp`,
    launchType: "instance",
    windowIdPatterns: ["shittify"],
    category: "media",
    clippy: {
      message: "Queue a track and remix the mood without leaving the desktop.",
      animation: ClippyAnimation.Wave
    }
  },
  jsDosApp: {
    serviceKey: "jsDosApp",
    type: "system",
    title: "JsDos",
    icon: `${CDN_BASE}/static/icons/jsdos.webp`,
    launchType: "instance",
    windowIdPatterns: ["jsdos"],
    isHeavy: true,
    category: "games",
    clippy: { message: "Boot old DOS software and keep classic tools alive.", animation: ClippyAnimation.Show }
  },
  v86app: {
    serviceKey: "v86app",
    type: "system",
    title: "Virtual 86",
    icon: `${CDN_BASE}/static/icons/v86.webp`,
    launchType: "instance",
    windowIdPatterns: ["v86"],
    isHeavy: true,
    category: "system",
    clippy: {
      message: "Start a full machine and let the virtual hardware do the work.",
      animation: ClippyAnimation.Show
    }
  },
  achievementsApp: {
    serviceKey: "achievementsApp",
    type: "system",
    title: "Achievements",
    icon: "fas fa-trophy",
    launchType: "instance",
    windowIdPatterns: ["achievements"],
    category: "system",
    clippy: { message: "Track progress here and see what you've unlocked.", animation: ClippyAnimation.GetArtsy }
  },
  accountManager: {
    serviceKey: "accountManagerApp",
    type: "system",
    title: "Accounts",
    icon: "fas fa-users",
    launchType: "instance",
    windowIdPatterns: ["account-manager"],
    category: "system",
    clippy: {
      message: "Manage your user accounts and switch between profiles.",
      animation: ClippyAnimation.GetArtsy
    }
  },
  youtubeUtils: {
    serviceKey: "youtubeUtilsApp",
    type: "system",
    title: "YouTube Utilities",
    icon: `${CDN_BASE}/static/icons/youtube.webp`,
    launchType: "instance",
    windowIdPatterns: ["youtube"],
    isHeavy: true,
    category: "internet",
    clippy: { message: "Paste a video link and I'll slot it into a player.", animation: ClippyAnimation.Show }
  },
  libreSprite: {
    type: "system",
    title: "LibreSprite",
    source: "https://yukios.netlify.app/static/apps/libresprite/index.html",
    icon: `${CDN_BASE}/static/icons/libresprite.webp`,
    launchType: "iframe",
    windowIdPatterns: ["libresprite"],
    category: "graphics",
    clippy: { message: "Open LibreSprite and sketch directly in the browser.", animation: ClippyAnimation.GetArtsy }
  },
  kiwiIRC: {
    type: "system",
    title: "kiwiIRC",
    source: "/static/apps/kiwiirc/index.html",
    icon: `${CDN_BASE}/static/icons/kiwiirc.webp`,
    launchType: "iframe",
    windowIdPatterns: ["kiwiirc"],
    category: "internet",
    clippy: { message: "Jump into chat and keep your conversations in one place.", animation: ClippyAnimation.Show }
  },
  azahar: {
    type: "system",
    title: "Azahar (3DS Emulator)",
    source: "/static/apps/azahar/index.html",
    icon: `${CDN_BASE}/static/icons/azahar.webp`,
    launchType: "iframe",
    windowIdPatterns: ["azahar"],
    category: "games",
    clippy: {
      message: "Launch 3DS software here and keep handheld games on the desktop.",
      animation: ClippyAnimation.Show
    }
  },
  setupApp: {
    serviceKey: "setupApp",
    type: "system",
    title: "Setup Wizard",
    icon: "fas fa-rocket",
    launchType: "instance",
    windowIdPatterns: ["setup", "setup-wizard"],
    category: "help",
    clippy: {
      message: "Walk through setup and get the basics out of the way.",
      animation: ClippyAnimation.Greeting
    }
  },
  installedApps: {
    serviceKey: "installedAppsApp",
    type: "system",
    title: "Installed Apps",
    icon: "fas fa-th-list",
    launchType: "instance",
    windowIdPatterns: ["installed-apps"],
    category: "system",
    clippy: {
      message: "Review installed apps and keep the registry tidy.",
      animation: ClippyAnimation.CheckingSomething
    },
    excludeFromInstalledApps: true
  },
  yukiOsGuide: {
    serviceKey: "yukiOsGuideApp",
    type: "system",
    title: "Yuki OS Guide",
    icon: "fas fa-book-open",
    launchType: "instance",
    windowIdPatterns: ["yuki-os-guide", "yukios-guide"],
    category: "help",
    clippy: { message: "Open the guide and learn the parts that matter fastest.", animation: ClippyAnimation.Show }
  },
  clipboardManagerApp: {
    serviceKey: "clipboardManagerApp",
    type: "system",
    title: "Clipboard Manager",
    icon: "fas fa-paste",
    launchType: "instance",
    windowIdPatterns: ["clipboard"],
    category: "system",
    clippy: {
      message: "Browse clipboard history and grab the last thing you copied.",
      animation: ClippyAnimation.Searching
    }
  },
  aiAssistant: {
    serviceKey: "aiAssistantApp",
    type: "system",
    title: "Yuki AI Assistant",
    icon: "fas fa-robot",
    launchType: "instance",
    windowIdPatterns: ["ai-assistant"],
    category: "help",
    clippy: { message: "Ask a question and let me help with the next step.", animation: ClippyAnimation.GetWizardy }
  },
  emojiSelector: {
    serviceKey: "emojiSelectorApp",
    type: "system",
    title: "Emoji Selector",
    icon: "fas fa-face-smile",
    launchType: "instance",
    windowIdPatterns: ["emoji"],
    category: "graphics",
    clippy: { message: "Pick the right emoji and keep the reaction simple.", animation: ClippyAnimation.GetArtsy }
  },
  rhythms: {
    serviceKey: "rhythmsApp",
    type: "system",
    title: "Rhythms",
    icon: "fas fa-wave-square",
    launchType: "instance",
    launchMethod: "declarative",
    windowIdPatterns: ["rhythms"],
    category: "media",
    clippy: { message: "Visualize audio beats and watch the rhythm come alive.", animation: ClippyAnimation.GetArtsy }
  },
  paint: {
    type: "system",
    title: "Paint",
    source: "https://jspaint.app",
    icon: `${CDN_BASE}/static/icons/paint.webp`,
    launchType: "iframe",
    windowIdPatterns: ["paint"],
    category: "graphics"
  },
  photopea: {
    type: "system",
    title: "Photopea",
    source: "https://www.photopea.com/",
    icon: `${CDN_BASE}/static/icons/photopea.webp`,
    launchType: "iframe",
    windowIdPatterns: ["photopea"],
    category: "graphics"
  },
  vscode: {
    type: "system",
    title: "Vs Code",
    source: "https://emupedia.net/emupedia-app-vscode",
    icon: `${CDN_BASE}/static/icons/vscode.webp`,
    launchType: "iframe",
    windowIdPatterns: ["vscode"],
    category: "development"
  },
  miniPaint: {
    type: "system",
    title: "Mini Paint",
    source: "https://viliusle.github.io/miniPaint/",
    icon: "fas fa-paint-brush",
    launchType: "iframe",
    windowIdPatterns: ["minipaint"],
    category: "graphics"
  },
  scramjet: {
    serviceKey: "scramjetApp",
    type: "system",
    title: "Scramjet Proxy",
    icon: "fas fa-globe",
    launchType: "instance",
    windowIdPatterns: ["scramjet"],
    category: "internet",
    persistContentState: false,
    clippy: { message: "Browse web with scramjet proxy", animation: ClippyAnimation.GetArtsy }
  },
  discordApp: {
    serviceKey: "discordApp",
    type: "system",
    title: "Discord",
    icon: "fab fa-discord",
    launchType: "instance",
    windowIdPatterns: ["discord"],
    category: "internet",
    persistContentState: false,
    clippy: { message: "Chat with friends on Discord", animation: ClippyAnimation.Wave }
  },
  youtubeApp: {
    serviceKey: "youtubeApp",
    type: "system",
    title: "Youtube",
    icon: `${CDN_BASE}/static/icons/youtube.webp`,
    launchType: "instance",
    windowIdPatterns: ["youtube"],
    category: "internet",
    persistContentState: false,
    clippy: { message: "Watch videos on Youtube", animation: ClippyAnimation.Show }
  },
  spotifyApp: {
    serviceKey: "spotifyApp",
    type: "system",
    title: "Spotify",
    icon: "fab fa-spotify",
    launchType: "instance",
    windowIdPatterns: ["spotify"],
    category: "media",
    persistContentState: false,
    clippy: { message: "Listen to music on Spotify", animation: ClippyAnimation.GetArtsy }
  },
  slackApp: {
    serviceKey: "slackApp",
    type: "system",
    title: "Slack",
    icon: "fab fa-slack",
    launchType: "instance",
    windowIdPatterns: ["slack"],
    category: "internet",
    persistContentState: false,
    clippy: { message: "Collaborate on Slack", animation: ClippyAnimation.Wave }
  },
  gmailApp: {
    serviceKey: "gmailApp",
    type: "system",
    title: "Gmail",
    icon: "fas fa-envelope",
    launchType: "instance",
    windowIdPatterns: ["gmail"],
    category: "internet",
    persistContentState: false,
    clippy: { message: "Check your Gmail", animation: ClippyAnimation.GetTechy }
  },
  outlookApp: {
    serviceKey: "outlookApp",
    type: "system",
    title: "Outlook",
    icon: "fas fa-envelope-open",
    launchType: "instance",
    windowIdPatterns: ["outlook"],
    category: "internet",
    persistContentState: false,
    clippy: { message: "Check your Outlook", animation: ClippyAnimation.GetTechy }
  },
  chatgptApp: {
    serviceKey: "chatgptApp",
    type: "system",
    title: "ChatGPT",
    icon: "fas fa-robot",
    launchType: "instance",
    windowIdPatterns: ["chatgpt"],
    category: "internet",
    persistContentState: false,
    clippy: { message: "Chat with AI on ChatGPT", animation: ClippyAnimation.GetTechy }
  },
  deepseekApp: {
    serviceKey: "deepseekApp",
    type: "system",
    title: "DeepSeek",
    icon: "fas fa-brain",
    launchType: "instance",
    windowIdPatterns: ["deepseek"],
    category: "internet",
    persistContentState: false,
    clippy: { message: "Chat with AI on DeepSeek", animation: ClippyAnimation.GetTechy }
  },
  telegramApp: {
    serviceKey: "telegramApp",
    type: "system",
    title: "Telegram",
    icon: "fab fa-telegram",
    launchType: "instance",
    windowIdPatterns: ["telegram"],
    category: "internet",
    persistContentState: false,
    clippy: { message: "Chat on Telegram", animation: ClippyAnimation.Wave }
  },
  whatsappApp: {
    serviceKey: "whatsappApp",
    type: "system",
    title: "WhatsApp",
    icon: "fab fa-whatsapp",
    launchType: "instance",
    windowIdPatterns: ["whatsapp"],
    category: "internet",
    persistContentState: false,
    clippy: { message: "Chat on WhatsApp", animation: ClippyAnimation.Wave }
  },
  teamsApp: {
    serviceKey: "teamsApp",
    type: "system",
    title: "Microsoft Teams",
    icon: "fab fa-microsoft",
    launchType: "instance",
    windowIdPatterns: ["teams"],
    category: "internet",
    persistContentState: false,
    clippy: { message: "Collaborate on Teams", animation: ClippyAnimation.Wave }
  },
  zoomApp: {
    serviceKey: "zoomApp",
    type: "system",
    title: "Zoom",
    icon: "fas fa-video",
    launchType: "instance",
    windowIdPatterns: ["zoom"],
    category: "internet",
    persistContentState: false,
    clippy: { message: "Join meetings on Zoom", animation: ClippyAnimation.Show }
  },
  notionApp: {
    serviceKey: "notionApp",
    type: "system",
    title: "Notion",
    icon: "fas fa-book",
    launchType: "instance",
    windowIdPatterns: ["notion"],
    category: "office",
    persistContentState: false,
    clippy: { message: "Organize with Notion", animation: ClippyAnimation.Show }
  },
  figmaApp: {
    serviceKey: "figmaApp",
    type: "system",
    title: "Figma",
    icon: "fab fa-figma",
    launchType: "instance",
    windowIdPatterns: ["figma"],
    category: "graphics",
    persistContentState: false,
    clippy: { message: "Design in Figma", animation: ClippyAnimation.GetArtsy }
  },
  twitterApp: {
    serviceKey: "twitterApp",
    type: "system",
    title: "Twitter/X",
    icon: "fab fa-x-twitter",
    launchType: "instance",
    windowIdPatterns: ["twitter"],
    category: "internet",
    persistContentState: false,
    clippy: { message: "Browse Twitter", animation: ClippyAnimation.Show }
  },
  redditApp: {
    serviceKey: "redditApp",
    type: "system",
    title: "Reddit",
    icon: "fab fa-reddit",
    launchType: "instance",
    windowIdPatterns: ["reddit"],
    category: "internet",
    persistContentState: false,
    clippy: { message: "Browse Reddit", animation: ClippyAnimation.Show }
  },
  instagramApp: {
    serviceKey: "instagramApp",
    type: "system",
    title: "Instagram",
    icon: "fab fa-instagram",
    launchType: "instance",
    windowIdPatterns: ["instagram"],
    category: "internet",
    persistContentState: false,
    clippy: { message: "Browse Instagram", animation: ClippyAnimation.GetArtsy }
  },
  linkedinApp: {
    serviceKey: "linkedinApp",
    type: "system",
    title: "LinkedIn",
    icon: "fab fa-linkedin",
    launchType: "instance",
    windowIdPatterns: ["linkedin"],
    category: "internet",
    persistContentState: false,
    clippy: { message: "Network on LinkedIn", animation: ClippyAnimation.Show }
  },
  pinterestApp: {
    serviceKey: "pinterestApp",
    type: "system",
    title: "Pinterest",
    icon: "fab fa-pinterest",
    launchType: "instance",
    windowIdPatterns: ["pinterest"],
    category: "internet",
    persistContentState: false,
    clippy: { message: "Discover on Pinterest", animation: ClippyAnimation.GetArtsy }
  },
  googleDocsApp: {
    serviceKey: "googleDocsApp",
    type: "system",
    title: "Google Docs",
    icon: "fas fa-file-word",
    launchType: "instance",
    windowIdPatterns: ["google-docs"],
    category: "office",
    persistContentState: false,
    clippy: { message: "Edit documents in Google Docs", animation: ClippyAnimation.Writing }
  },
  trelloApp: {
    serviceKey: "trelloApp",
    type: "system",
    title: "Trello",
    icon: "fab fa-trello",
    launchType: "instance",
    windowIdPatterns: ["trello"],
    category: "office",
    persistContentState: false,
    clippy: { message: "Manage projects in Trello", animation: ClippyAnimation.Show }
  },
  canvaApp: {
    serviceKey: "canvaApp",
    type: "system",
    title: "Canva",
    icon: "fas fa-palette",
    launchType: "instance",
    windowIdPatterns: ["canva"],
    category: "graphics",
    persistContentState: false,
    clippy: { message: "Design in Canva", animation: ClippyAnimation.GetArtsy }
  },
  asanaApp: {
    serviceKey: "asanaApp",
    type: "system",
    title: "Asana",
    icon: "fab fa-asana",
    launchType: "instance",
    windowIdPatterns: ["asana"],
    category: "office",
    persistContentState: false,
    clippy: { message: "Manage tasks in Asana", animation: ClippyAnimation.Show }
  },
  githubApp: {
    serviceKey: "githubApp",
    type: "system",
    title: "GitHub",
    icon: "fab fa-github",
    launchType: "instance",
    windowIdPatterns: ["github"],
    category: "development",
    persistContentState: false,
    clippy: { message: "Code on GitHub", animation: ClippyAnimation.GetTechy }
  },
  gitlabApp: {
    serviceKey: "gitlabApp",
    type: "system",
    title: "GitLab",
    icon: "fab fa-gitlab",
    launchType: "instance",
    windowIdPatterns: ["gitlab"],
    category: "development",
    persistContentState: false,
    clippy: { message: "Code on GitLab", animation: ClippyAnimation.GetTechy }
  },
  codepenApp: {
    serviceKey: "codepenApp",
    type: "system",
    title: "CodePen",
    icon: "fab fa-codepen",
    launchType: "instance",
    windowIdPatterns: ["codepen"],
    category: "development",
    persistContentState: false,
    clippy: { message: "Code on CodePen", animation: ClippyAnimation.GetTechy }
  },
  replitApp: {
    serviceKey: "replitApp",
    type: "system",
    title: "Replit",
    icon: "fas fa-code",
    launchType: "instance",
    windowIdPatterns: ["replit"],
    category: "development",
    persistContentState: false,
    clippy: { message: "Code on Replit", animation: ClippyAnimation.GetTechy }
  },
  twitchApp: {
    serviceKey: "twitchApp",
    type: "system",
    title: "Twitch",
    icon: "fab fa-twitch",
    launchType: "instance",
    windowIdPatterns: ["twitch"],
    category: "media",
    persistContentState: false,
    clippy: { message: "Watch streams on Twitch", animation: ClippyAnimation.Show }
  },
  soundcloudApp: {
    serviceKey: "soundcloudApp",
    type: "system",
    title: "SoundCloud",
    icon: "fab fa-soundcloud",
    launchType: "instance",
    windowIdPatterns: ["soundcloud"],
    category: "media",
    persistContentState: false,
    clippy: { message: "Listen on SoundCloud", animation: ClippyAnimation.GetArtsy }
  },
  deezerApp: {
    serviceKey: "deezerApp",
    type: "system",
    title: "Deezer",
    icon: "fab fa-deezer",
    launchType: "instance",
    windowIdPatterns: ["deezer"],
    category: "media",
    persistContentState: false,
    clippy: { message: "Listen on Deezer", animation: ClippyAnimation.GetArtsy }
  },
  protonmailApp: {
    serviceKey: "protonmailApp",
    type: "system",
    title: "ProtonMail",
    icon: "fas fa-shield",
    launchType: "instance",
    windowIdPatterns: ["protonmail"],
    category: "internet",
    persistContentState: false,
    clippy: { message: "Secure email with ProtonMail", animation: ClippyAnimation.GetTechy }
  },
  yahooMailApp: {
    serviceKey: "yahooMailApp",
    type: "system",
    title: "Yahoo Mail",
    icon: "fab fa-yahoo",
    launchType: "instance",
    windowIdPatterns: ["yahoo-mail"],
    category: "internet",
    persistContentState: false,
    clippy: { message: "Check Yahoo Mail", animation: ClippyAnimation.GetTechy }
  },
  torrentClient: {
    serviceKey: "torrentClientApp",
    type: "system",
    title: "Torrent Client",
    icon: "fas fa-download",
    launchType: "instance",
    windowIdPatterns: ["torrent-client"],
    category: "internet",
    clippy: { message: "Download and manage torrents with WebTorrent", animation: ClippyAnimation.Show }
  }
};

export const SYSTEM_APP_IDS = Object.keys(SYSTEM_APPS);

setTimeout(() => {
  const missing = [];

  for (const [id, app] of Object.entries(SYSTEM_APPS)) {
    const direct = APP_DESCRIPTIONS[id];
    const viaService = app.serviceKey ? APP_DESCRIPTIONS[app.serviceKey] : undefined;

    if (!direct && !viaService) {
      missing.push(id);
    }
  }

  console.log(missing);
}, 5000);
