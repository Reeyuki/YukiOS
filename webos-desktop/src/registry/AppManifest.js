import { ClippyAnimation } from "../ai/clippy.js";

const CDN_BASE = "https://cdn.jsdelivr.net/gh/Reeyuki/yukios@main";

export const APP_MANIFESTS = [
  {
    serviceKey: "terminalApp",
    enhanced: true,
    type: "system",
    title: "Terminal",
    icon: `${CDN_BASE}/static/icons/terminal.webp`,
    launchType: "instance",
    windowIdPatterns: ["terminal"],
    category: "development",
    clippy: { message: "Run commands here and keep the basics in reach.", animation: ClippyAnimation.Show },
    description:
      "Command-line interface supporting ls, cd, mkdir, rm, cp, mv, cat, pwd, and more for system operations."
  },
  {
    serviceKey: "cameraApp",
    enhanced: true,
    type: "system",
    title: "Camera App",
    icon: "fas fa-camera",
    launchType: "instance",
    windowIdPatterns: ["camera"],
    category: "graphics",
    clippy: { message: "Take a shot and capture the moment cleanly.", animation: ClippyAnimation.Show },
    description: "Access webcam for photo capture with basic image controls and save to filesystem."
  },
  {
    serviceKey: "aboutApp",
    enhanced: false,
    type: "system",
    title: "About",
    icon: "fa fa-circle-info",
    launchType: "instance",
    windowIdPatterns: ["about"],
    category: "help",
    clippy: {
      message: "Check the build details and see what this system is running.",
      animation: ClippyAnimation.Show
    },
    description: "System information including version, capabilities, credits, and privacy policy."
  },
  {
    serviceKey: "newsApp",
    enhanced: true,
    type: "system",
    title: "What's New",
    icon: "fa fa-newspaper",
    launchType: "instance",
    windowIdPatterns: ["news"],
    category: "help",
    clippy: { message: "Catch up on the latest changes and see what shipped.", animation: ClippyAnimation.Show },
    description: "Displays system updates, release notes, and changelog entries for YukiOS features and improvements."
  },
  {
    serviceKey: "calculatorApp",
    enhanced: true,
    type: "system",
    title: "Calculator",
    icon: "fa fa-calculator",
    launchType: "instance",
    windowIdPatterns: ["calculator"],
    category: "office",
    clippy: { message: "Punch in numbers and I'll handle the quick arithmetic.", animation: ClippyAnimation.Show },
    description: "Scientific calculator with memory functions, trigonometry, and basic arithmetic operations."
  },
  {
    serviceKey: "taskManagerApp",
    enhanced: false,
    type: "system",
    title: "Task Manager",
    icon: "fa fa-list-check",
    launchType: "instance",
    windowIdPatterns: ["taskmanager", "task-manager"],
    category: "system",
    clippy: {
      message: "Spot heavy apps fast and shut down the real troublemakers.",
      animation: ClippyAnimation.CheckingSomething
    },
    description: "View and manage running applications, processes, and system resources with ability to close apps."
  },
  {
    serviceKey: "weatherApp",
    enhanced: false,
    type: "system",
    title: "Weather",
    icon: "fa fa-cloud",
    launchType: "instance",
    windowIdPatterns: ["weather"],
    category: "internet",
    clippy: { message: "Check the forecast before you head out.", animation: ClippyAnimation.Show },
    description: "Current weather conditions and forecast with location-based data."
  },
  {
    serviceKey: "markdownApp",
    enhanced: true,
    type: "system",
    title: "Markdown",
    icon: "fab fa-markdown",
    launchType: "instance",
    windowIdPatterns: ["markdown"],
    category: "office",
    clippy: { message: "Write in Markdown and keep the structure clean.", animation: ClippyAnimation.Writing },
    description: "Split-pane editor with live preview for writing and viewing Markdown documents."
  },
  {
    serviceKey: "shittifyApp",
    enhanced: false,
    type: "system",
    title: "Evil Spotify",
    icon: `${CDN_BASE}/static/icons/shittify.webp`,
    launchType: "instance",
    windowIdPatterns: ["shittify"],
    category: "media",
    clippy: {
      message: "Queue a track and remix the mood without leaving the desktop.",
      animation: ClippyAnimation.Wave
    },
    description: "A spotify alternative"
  },
  {
    serviceKey: "monacoApp",
    enhanced: true,
    type: "system",
    title: "Yuki Code",
    icon: "fas fa-code",
    launchType: "instance",
    windowIdPatterns: ["monaco"],
    category: "development",
    clippy: { message: "Open a new tab and get your code moving.", animation: ClippyAnimation.GetWizardy },
    description:
      "Full-featured code editor powered by VS Code engine with syntax highlighting, auto-completion, and multi-file support."
  },
  {
    serviceKey: "model3dApp",
    enhanced: false,
    type: "system",
    title: "Yuki Blender",
    icon: `${CDN_BASE}/static/icons/3dmodel.webp`,
    launchType: "instance",
    windowIdPatterns: ["model3d"],
    category: "graphics",
    clippy: { message: "Inspect models here and spin them from every angle.", animation: ClippyAnimation.LookDownLeft },
    description: "View OBJ, GLTF, and GLB 3D models using Three.js with rotation and zoom controls."
  },
  {
    serviceKey: "emulatorApp",
    enhanced: true,
    type: "system",
    title: "Yuki Emulator",
    icon: `${CDN_BASE}/static/icons/emulator.webp`,
    launchType: "instance",
    windowIdPatterns: ["emulator"],
    isHeavy: true,
    category: "games",
    clippy: { message: "Launch old software here and keep the nostalgia alive.", animation: ClippyAnimation.Show },
    description: "Multi-platform game emulator supporting various console systems."
  },
  {
    serviceKey: "achievementsApp",
    enhanced: true,
    onLoad: (inst) => {
      window.achievements = inst;
    },
    type: "system",
    title: "Achievements",
    icon: "fas fa-trophy",
    launchType: "instance",
    windowIdPatterns: ["achievements"],
    category: "system",
    clippy: { message: "Track progress here and see what you've unlocked.", animation: ClippyAnimation.GetArtsy },
    description: "Track playtime milestones and system usage achievements."
  },
  {
    serviceKey: "ruffleApp",
    enhanced: true,
    type: "system",
    title: "Ruffle",
    icon: `${CDN_BASE}/static/icons/ruffle.webp`,
    launchType: "instance",
    windowIdPatterns: ["ruffle"],
    isHeavy: true,
    category: "games",
    clippy: { message: "Load Flash content here without the usual hassle.", animation: ClippyAnimation.Show },
    description: "Flash game player using modern Ruffle engine for SWF content."
  },
  {
    serviceKey: "shortcutsApp",
    enhanced: false,
    type: "system",
    title: "Shortcuts",
    icon: "fa fa-keyboard",
    launchType: "instance",
    windowIdPatterns: ["shortcuts"],
    category: "system",
    clippy: { message: "Open shortcuts and keep the keyboard within reach.", animation: ClippyAnimation.Show },
    description: "View and manage keyboard shortcuts for system-wide commands."
  },
  {
    serviceKey: "yukiConvertApp",
    enhanced: false,
    type: "system",
    title: "Yuki Convert",
    icon: "fas fa-exchange-alt",
    launchType: "instance",
    windowIdPatterns: ["yuki-convert"],
    category: "office",
    clippy: {
      message: "Drop in a file and I'll turn it into the format you need.",
      animation: ClippyAnimation.GetWizardy
    },
    description: "Local File Converter with image, audio,video and documents."
  },
  {
    serviceKey: "setupApp",
    enhanced: false,
    type: "system",
    title: "Setup Wizard",
    icon: "fas fa-rocket",
    launchType: "instance",
    windowIdPatterns: ["setup", "setup-wizard"],
    category: "help",
    clippy: { message: "Walk through setup and get the basics out of the way.", animation: ClippyAnimation.Greeting },
    description: "Initial setup guide for new users to configure YukiOS preferences."
  },
  {
    serviceKey: "dataEditorApp",
    enhanced: true,
    type: "system",
    title: "Storage Editor",
    icon: "fas fa-database",
    launchType: "instance",
    windowIdPatterns: ["data-editor"],
    category: "development",
    clippy: { message: "Edit stored values carefully and keep the system tidy.", animation: ClippyAnimation.Show },
    description: "View and edit IndexedDB storage data for debugging and advanced users."
  },
  {
    serviceKey: "installedAppsApp",
    enhanced: false,
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
    excludeFromInstalledApps: true,
    description: "Manage installed applications with rename, disable, and uninstall options."
  },
  {
    serviceKey: "yukiOsGuideApp",
    enhanced: true,
    type: "system",
    title: "YukiOS Guide",
    icon: "fas fa-book-open",
    launchType: "instance",
    windowIdPatterns: ["yuki-os-guide", "yukios-guide"],
    category: "help",
    clippy: { message: "Open the guide and learn the parts that matter fastest.", animation: ClippyAnimation.Show },
    description: "Comprehensive documentation and feature discovery hub for YukiOS."
  },
  {
    serviceKey: "clipboardManagerApp",
    enhanced: false,
    type: "system",
    title: "Clipboard Manager",
    icon: "fas fa-paste",
    launchType: "instance",
    windowIdPatterns: ["clipboard"],
    category: "system",
    clippy: {
      message: "Browse clipboard history and grab the last thing you copied.",
      animation: ClippyAnimation.Searching
    },
    description: "Keep a history of everything you copy. Browse, search, and reuse old clipboard entries anytime."
  },
  {
    serviceKey: "aiAssistantApp",
    enhanced: false,
    type: "system",
    title: "Yuki AI Assistant",
    icon: "fas fa-robot",
    launchType: "instance",
    windowIdPatterns: ["ai-assistant"],
    category: "help",
    clippy: { message: "Ask a question and let me help with the next step.", animation: ClippyAnimation.GetWizardy },
    description:
      "Local AI assistant that runs in your browser. Launch apps, manage files, and get help with OS tasks, no data leaves your machine."
  },
  {
    serviceKey: "displayPerformanceApp",
    enhanced: false,
    type: "system",
    title: "Display Performance",
    icon: "fas fa-tachometer-alt",
    launchType: "instance",
    windowIdPatterns: ["display-performance"],
    category: "system",
    description: "Monitor display performance metrics and system resource usage."
  },
  {
    serviceKey: "networkTrayApp",
    enhanced: false,
    type: "system",
    title: "Network Tray",
    icon: "fas fa-wifi",
    launchType: "instance",
    windowIdPatterns: ["network-tray"],
    category: "system",
    description: "Network status and connectivity information in the system tray."
  },
  {
    serviceKey: "emojiSelectorApp",
    enhanced: true,
    type: "system",
    title: "Emoji Selector",
    icon: "fas fa-face-smile",
    launchType: "instance",
    windowIdPatterns: ["emoji"],
    category: "graphics",
    clippy: { message: "Pick the right emoji and keep the reaction simple.", animation: ClippyAnimation.GetArtsy },
    description: "Browse and copy every emoji with category organization and instant search."
  },
  {
    serviceKey: "systemAppsApp",
    enhanced: false,
    type: "system",
    title: "System Apps",
    icon: "fas fa-screwdriver-wrench",
    launchType: "instance",
    windowIdPatterns: ["system-apps"],
    category: "system",
    clippy: { message: "Browse the built-in tools and jump to the one you need.", animation: ClippyAnimation.Show },
    description: "Access and manage core system applications and utilities."
  },
  {
    serviceKey: "rhythmsApp",
    enhanced: true,
    type: "system",
    title: "Rhythms",
    icon: "fas fa-wave-square",
    launchType: "instance",
    launchMethod: "declarative",
    windowIdPatterns: ["rhythms"],
    category: "media",
    clippy: { message: "Visualize audio beats and watch the rhythm come alive.", animation: ClippyAnimation.GetArtsy },
    description:
      "Audio visualizer with Lines and Circle modes, customizable tile count, and smooth bouncy physics for system-wide audio."
  },
  {
    serviceKey: "browserApp",
    type: "system",
    title: "Yuki Browser",
    icon: "fas fa-snowflake",
    launchType: "instance",
    windowIdPatterns: ["browser"],
    isHeavy: true,
    category: "internet",
    clippy: {
      message: "Select Tor from the proxy dropdown to browse anonymously. I'll handle the setup.",
      animation: ClippyAnimation.Wave
    },
    description: "CORS proxy browser with bookmarks, history, tab management, and Tor anonymous browsing within YukiOS."
  },
  {
    serviceKey: "discordApp",
    enhanced: true,
    type: "system",
    title: "Discord",
    icon: "fab fa-discord",
    launchType: "instance",
    windowIdPatterns: ["discord"],
    category: "internet",
    persistContentState: false,
    clippy: { message: "Chat with friends on Discord", animation: ClippyAnimation.Wave },
    description: "Chat with friends, hop into voice, and keep up with your communities on Discord.",
    windowSize: ["90vw", "85vh"],
    trayOptions: {
      contextMenuItems: [
        {
          label: "Mute",
          action: () => {
            console.log("Discord: Mute");
          },
          icon: "fa-microphone-slash"
        },
        {
          label: "Deafen",
          action: () => {
            console.log("Discord: Deafen");
          },
          icon: "fa-volume-off"
        },
        {
          type: "divider"
        },
        {
          label: "Status: Online",
          action: () => {
            console.log("Discord: Set status to Online");
          },
          icon: "fa-circle"
        },
        {
          label: "Status: Idle",
          action: () => {
            console.log("Discord: Set status to Idle");
          },
          icon: "fa-moon"
        },
        {
          label: "Status: DND",
          action: () => {
            console.log("Discord: Set status to DND");
          },
          icon: "fa-ban"
        },
        {
          label: "Status: Invisible",
          action: () => {
            console.log("Discord: Set status to Invisible");
          },
          icon: "fa-eye-slash"
        }
      ]
    }
  },
  {
    serviceKey: "youtubeApp",
    enhanced: true,
    type: "system",
    title: "Youtube",
    icon: `${CDN_BASE}/static/icons/youtube.webp`,
    launchType: "instance",
    windowIdPatterns: ["youtube"],
    category: "internet",
    persistContentState: false,
    clippy: { message: "Watch videos on Youtube", animation: ClippyAnimation.Show },
    description: "Watch videos, browse channels, and catch what's trending on YouTube.",
    targetUrl: "https://youtube.com",
    windowSize: ["90vw", "85vh"]
  },
  {
    serviceKey: "chatgptApp",
    enhanced: true,
    type: "system",
    title: "ChatGPT",
    icon: "fas fa-robot",
    launchType: "instance",
    windowIdPatterns: ["chatgpt"],
    category: "internet",
    persistContentState: false,
    clippy: { message: "Chat with AI on ChatGPT", animation: ClippyAnimation.GetTechy },
    description: "Chat with AI, brainstorm ideas, and get quick answers through ChatGPT.",
    targetUrl: "https://chatgpt.com",
    windowSize: ["90vw", "85vh"]
  },
  {
    serviceKey: "spotifyApp",
    enhanced: true,
    type: "system",
    title: "Spotify",
    icon: "fab fa-spotify",
    launchType: "instance",
    windowIdPatterns: ["spotify"],
    category: "media",
    persistContentState: false,
    clippy: { message: "Listen to music on Spotify", animation: ClippyAnimation.GetArtsy },
    description: "Stream music, discover podcasts, and follow your favorite playlists on Spotify.",
    targetUrl: "https://open.spotify.com",
    windowSize: ["90vw", "85vh"]
  },
  {
    serviceKey: "slackApp",
    enhanced: true,
    type: "system",
    title: "Slack",
    icon: "fab fa-slack",
    launchType: "instance",
    windowIdPatterns: ["slack"],
    category: "internet",
    persistContentState: false,
    clippy: { message: "Collaborate on Slack", animation: ClippyAnimation.Wave },
    description: "Message your team, share files, and stay in the loop on Slack.",
    targetUrl: "https://slack.com",
    windowSize: ["90vw", "85vh"]
  },
  {
    serviceKey: "gmailApp",
    enhanced: true,
    type: "system",
    title: "Gmail",
    icon: "fas fa-envelope",
    launchType: "instance",
    windowIdPatterns: ["gmail"],
    category: "internet",
    persistContentState: false,
    clippy: { message: "Check your Gmail", animation: ClippyAnimation.GetTechy },
    description: "Read, send, and organize your email through Gmail.",
    targetUrl: "https://mail.google.com",
    windowSize: ["90vw", "85vh"]
  },
  {
    serviceKey: "outlookApp",
    enhanced: true,
    type: "system",
    title: "Outlook",
    icon: "fas fa-envelope-open",
    launchType: "instance",
    windowIdPatterns: ["outlook"],
    category: "internet",
    persistContentState: false,
    clippy: { message: "Check your Outlook", animation: ClippyAnimation.GetTechy },
    description: "Check email, manage your calendar, and stay organized with Outlook.",
    targetUrl: "https://outlook.live.com",
    windowSize: ["90vw", "85vh"]
  },
  {
    serviceKey: "deepseekApp",
    enhanced: true,
    type: "system",
    title: "DeepSeek",
    icon: "fas fa-brain",
    launchType: "instance",
    windowIdPatterns: ["deepseek"],
    category: "internet",
    persistContentState: false,
    clippy: { message: "Chat with AI on DeepSeek", animation: ClippyAnimation.GetTechy },
    description: "Chat with AI, ask deep questions, and get thoughtful answers on DeepSeek.",
    targetUrl: "https://chat.deepseek.com/",
    windowSize: ["90vw", "85vh"]
  },
  {
    serviceKey: "zoomApp",
    enhanced: true,
    type: "system",
    title: "Zoom",
    icon: "fas fa-video",
    launchType: "instance",
    windowIdPatterns: ["zoom"],
    category: "internet",
    persistContentState: false,
    clippy: { message: "Join meetings on Zoom", animation: ClippyAnimation.Show },
    description: "Join video calls, host meetings, and collaborate face-to-face on Zoom.",
    targetUrl: "https://zoom.us",
    windowSize: ["90vw", "85vh"]
  },
  {
    serviceKey: "notionApp",
    enhanced: true,
    type: "system",
    title: "Notion",
    icon: "fas fa-book",
    launchType: "instance",
    windowIdPatterns: ["notion"],
    category: "office",
    persistContentState: false,
    clippy: { message: "Organize with Notion", animation: ClippyAnimation.Show },
    description: "Take notes, manage projects, and organize everything in Notion.",
    targetUrl: "https://notion.so",
    windowSize: ["90vw", "85vh"]
  },
  {
    serviceKey: "figmaApp",
    enhanced: true,
    type: "system",
    title: "Figma",
    icon: "fab fa-figma",
    launchType: "instance",
    windowIdPatterns: ["figma"],
    category: "graphics",
    persistContentState: false,
    clippy: { message: "Design in Figma", animation: ClippyAnimation.GetArtsy },
    description: "Design interfaces, prototype interactions, and collaborate in real time on Figma.",
    targetUrl: "https://figma.com",
    windowSize: ["90vw", "85vh"]
  },
  {
    serviceKey: "twitterApp",
    enhanced: true,
    type: "system",
    title: "Twitter/X",
    icon: "fab fa-x-twitter",
    launchType: "instance",
    windowIdPatterns: ["twitter"],
    category: "internet",
    persistContentState: false,
    clippy: { message: "Browse Twitter", animation: ClippyAnimation.Show },
    description: "Scroll your timeline, post updates, and follow the conversation on X.",
    targetUrl: "https://twitter.com",
    windowSize: ["90vw", "85vh"]
  },
  {
    serviceKey: "instagramApp",
    enhanced: true,
    type: "system",
    title: "Instagram",
    icon: "fab fa-instagram",
    launchType: "instance",
    windowIdPatterns: ["instagram"],
    category: "internet",
    persistContentState: false,
    clippy: { message: "Browse Instagram", animation: ClippyAnimation.GetArtsy },
    description: "Browse photos, share stories, and connect with friends on Instagram.",
    targetUrl: "https://instagram.com",
    windowSize: ["90vw", "85vh"]
  },
  {
    serviceKey: "pinterestApp",
    enhanced: true,
    type: "system",
    title: "Pinterest",
    icon: "fab fa-pinterest",
    launchType: "instance",
    windowIdPatterns: ["pinterest"],
    category: "internet",
    persistContentState: false,
    clippy: { message: "Discover on Pinterest", animation: ClippyAnimation.GetArtsy },
    description: "Find ideas, save inspiration, and discover new things to make on Pinterest.",
    targetUrl: "https://pinterest.com",
    windowSize: ["90vw", "85vh"]
  },
  {
    serviceKey: "googleDocsApp",
    enhanced: true,
    type: "system",
    title: "Google Docs",
    icon: "fas fa-file-word",
    launchType: "instance",
    windowIdPatterns: ["google-docs"],
    category: "office",
    persistContentState: false,
    clippy: { message: "Edit documents in Google Docs", animation: ClippyAnimation.Writing },
    description: "Write documents, share drafts, and collaborate in real time with Google Docs.",
    targetUrl: "https://docs.google.com",
    windowSize: ["90vw", "85vh"]
  },
  {
    serviceKey: "canvaApp",
    enhanced: true,
    type: "system",
    title: "Canva",
    icon: "fas fa-palette",
    launchType: "instance",
    windowIdPatterns: ["canva"],
    category: "graphics",
    persistContentState: false,
    clippy: { message: "Design in Canva", animation: ClippyAnimation.GetArtsy },
    description: "Design graphics, make presentations, and create visuals quickly in Canva.",
    targetUrl: "https://canva.com",
    windowSize: ["90vw", "85vh"]
  },
  {
    serviceKey: "githubApp",
    enhanced: true,
    type: "system",
    title: "GitHub",
    icon: "fab fa-github",
    launchType: "instance",
    windowIdPatterns: ["github"],
    category: "development",
    persistContentState: false,
    clippy: { message: "Code on GitHub", animation: ClippyAnimation.GetTechy },
    description: "Host code, review pull requests, and collaborate on projects through GitHub.",
    targetUrl: "https://github.com",
    windowSize: ["90vw", "85vh"]
  },
  {
    serviceKey: "gitlabApp",
    enhanced: true,
    type: "system",
    title: "GitLab",
    icon: "fab fa-gitlab",
    launchType: "instance",
    windowIdPatterns: ["gitlab"],
    category: "development",
    persistContentState: false,
    clippy: { message: "Code on GitLab", animation: ClippyAnimation.GetTechy },
    description: "Manage repos, run CI/CD pipelines, and collaborate on code with GitLab.",
    targetUrl: "https://gitlab.com",
    windowSize: ["90vw", "85vh"]
  },
  {
    serviceKey: "codepenApp",
    enhanced: true,
    type: "system",
    title: "CodePen",
    icon: "fab fa-codepen",
    launchType: "instance",
    windowIdPatterns: ["codepen"],
    category: "development",
    persistContentState: false,
    clippy: { message: "Code on CodePen", animation: ClippyAnimation.GetTechy },
    description: "Write front-end code, test snippets, and share what you build on CodePen.",
    targetUrl: "https://codepen.io",
    windowSize: ["90vw", "85vh"]
  },
  {
    serviceKey: "replitApp",
    enhanced: true,
    type: "system",
    title: "Replit",
    icon: "fas fa-code",
    launchType: "instance",
    windowIdPatterns: ["replit"],
    category: "development",
    persistContentState: false,
    clippy: { message: "Code on Replit", animation: ClippyAnimation.GetTechy },
    description: "Code online, build projects, and collaborate with others in real time on Replit.",
    targetUrl: "https://replit.com",
    windowSize: ["90vw", "85vh"]
  },
  {
    serviceKey: "twitchApp",
    enhanced: true,
    type: "system",
    title: "Twitch",
    icon: "fab fa-twitch",
    launchType: "instance",
    windowIdPatterns: ["twitch"],
    category: "media",
    persistContentState: false,
    clippy: { message: "Watch streams on Twitch", animation: ClippyAnimation.Show },
    description: "Watch live streams, follow creators, and chat with the community on Twitch.",
    targetUrl: "https://twitch.tv",
    windowSize: ["90vw", "85vh"]
  },
  {
    serviceKey: "soundcloudApp",
    enhanced: true,
    type: "system",
    title: "SoundCloud",
    icon: "fab fa-soundcloud",
    launchType: "instance",
    windowIdPatterns: ["soundcloud"],
    category: "media",
    persistContentState: false,
    clippy: { message: "Listen on SoundCloud", animation: ClippyAnimation.GetArtsy },
    description: "Discover music, upload tracks, and follow artists you love on SoundCloud.",
    targetUrl: "https://soundcloud.com",
    windowSize: ["90vw", "85vh"]
  },
  {
    serviceKey: "deezerApp",
    enhanced: true,
    type: "system",
    title: "Deezer",
    icon: "fab fa-deezer",
    launchType: "instance",
    windowIdPatterns: ["deezer"],
    category: "media",
    persistContentState: false,
    clippy: { message: "Listen on Deezer", animation: ClippyAnimation.GetArtsy },
    description: "Stream music, explore curated playlists, and find your next favorite artist on Deezer.",
    targetUrl: "https://deezer.com",
    windowSize: ["90vw", "85vh"]
  },
  {
    serviceKey: "protonmailApp",
    enhanced: true,
    type: "system",
    title: "ProtonMail",
    icon: "fas fa-shield",
    launchType: "instance",
    windowIdPatterns: ["protonmail"],
    category: "internet",
    persistContentState: false,
    clippy: { message: "Secure email with ProtonMail", animation: ClippyAnimation.GetTechy },
    description: "Send encrypted email and keep your communications private with Proton Mail.",
    targetUrl: "https://proton.me",
    windowSize: ["90vw", "85vh"]
  },
  {
    serviceKey: "yahooMailApp",
    enhanced: true,
    type: "system",
    title: "Yahoo Mail",
    icon: "fab fa-yahoo",
    launchType: "instance",
    windowIdPatterns: ["yahoo-mail"],
    category: "internet",
    persistContentState: false,
    clippy: { message: "Check Yahoo Mail", animation: ClippyAnimation.GetTechy },
    description: "Read, send, and organize your inbox with Yahoo Mail.",
    targetUrl: "https://mail.yahoo.com",
    windowSize: ["90vw", "85vh"]
  },
  {
    serviceKey: "geforceNowApp",
    enhanced: true,
    type: "system",
    title: "GeForce Now",
    icon: "fas fa-gamepad",
    launchType: "instance",
    windowIdPatterns: ["geforce-now"],
    category: "games",
    persistContentState: false,
    clippy: { message: "Stream games with GeForce Now", animation: ClippyAnimation.GetArtsy },
    description: "Stream PC games from the cloud and play them right in your browser with GeForce Now.",
    targetUrl: "https://play.geforcenow.com/mall/",
    windowSize: ["90vw", "85vh"]
  },
  {
    serviceKey: "torrentClientApp",
    enhanced: true,
    type: "system",
    title: "Torrent Client",
    icon: "fas fa-download",
    launchType: "instance",
    windowIdPatterns: ["torrent-client"],
    category: "internet",
    clippy: { message: "Download and manage torrents with WebTorrent", animation: ClippyAnimation.Show },
    description:
      "BitTorrent client using WebTorrent for downloading and managing torrent files with magnet link support."
  },
  {
    serviceKey: "pixlrApp",
    enhanced: true,
    type: "system",
    title: "Pixlr",
    icon: "fas fa-image",
    launchType: "instance",
    windowIdPatterns: ["pixlr"],
    category: "graphics",
    persistContentState: false,
    clippy: { message: "Edit photos in Pixlr", animation: ClippyAnimation.GetArtsy },
    description: "Edit photos, apply effects, and design visuals right in your browser with Pixlr.",
    targetUrl: "https://pixlr.com",
    windowSize: ["90vw", "85vh"]
  },
  {
    serviceKey: "grokApp",
    enhanced: true,
    type: "system",
    title: "Grok",
    icon: "fas fa-brain",
    launchType: "instance",
    windowIdPatterns: ["grok"],
    category: "internet",
    persistContentState: false,
    clippy: { message: "Chat with AI on Grok", animation: ClippyAnimation.GetTechy },
    description: "Chat with AI, ask questions, and get real-time answers on Grok.",
    targetUrl: "https://grok.x.ai",
    windowSize: ["90vw", "85vh"]
  },
  {
    serviceKey: "aniwatchApp",
    enhanced: true,
    type: "system",
    title: "Aniwatch",
    icon: "fas fa-play-circle",
    launchType: "instance",
    windowIdPatterns: ["aniwatch"],
    category: "media",
    persistContentState: false,
    clippy: { message: "Watch anime on Aniwatch", animation: ClippyAnimation.Show },
    description: "Stream the latest anime episodes and watch seasonal shows on Aniwatch.",
    targetUrl: "https://aniwatch.co.at",
    windowSize: ["90vw", "85vh"]
  },
  {
    serviceKey: "tiktokApp",
    enhanced: true,
    type: "system",
    title: "TikTok",
    icon: "fab fa-tiktok",
    launchType: "instance",
    windowIdPatterns: ["tiktok"],
    category: "media",
    persistContentState: false,
    clippy: { message: "Browse TikTok", animation: ClippyAnimation.Show },
    description: "Scroll short videos, follow creators, and find your next obsession on TikTok.",
    targetUrl: "https://tiktok.com",
    windowSize: ["90vw", "85vh"]
  },
  {
    serviceKey: "flashpointDatabaseApp",
    enhanced: true,
    type: "system",
    title: "Flashpoint Database",
    icon: "fas fa-database",
    launchType: "instance",
    windowIdPatterns: ["flashpoint-database", "flashpoint"],
    category: "games",
    persistContentState: false,
    clippy: {
      message: "Browse Flashpoint's archive and keep old web games within reach.",
      animation: ClippyAnimation.Show
    },
    description: "Browse Flashpoint's game archive from a dedicated desktop window.",
    targetUrl: "https://flashpointproject.github.io/flashpoint-database/",
    windowSize: ["90vw", "85vh"]
  },
  {
    serviceKey: "senshiApp",
    enhanced: true,
    type: "system",
    title: "Senshi",
    icon: "fas fa-video",
    launchType: "iframe",
    windowIdPatterns: ["senshi"],
    category: "media",
    persistContentState: false,
    source: "https://senshi.live",
    clippy: { message: "Stream on Senshi", animation: ClippyAnimation.Show },
    description: "Stream anime shows and movies with a clean, simple interface on Senshi.",
    windowSize: ["90vw", "85vh"]
  },
  {
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
    },
    description: "IT Tools wrapped in a Yuki-themed iframe with live CSS bridging."
  },
  {
    serviceKey: "erudaApp",
    type: "system",
    title: "Dev Tools (Eruda)",
    icon: "fas fa-code",
    launchType: "instance",
    windowIdPatterns: ["eruda"],
    category: "development",
    clippy: {
      message: "Debug console, network, and elements inspection tool.",
      animation: ClippyAnimation.GetTechy
    },
    description: "Mobile web debugging tool for console, network, and element inspection."
  },
  {
    serviceKey: "explorerApp",
    type: "system",
    title: "Explorer",
    icon: `${CDN_BASE}/static/icons/file.webp`,
    launchType: "instance",
    windowIdPatterns: ["explorer"],
    category: "system",
    clippy: { message: "Move files around and keep your folders under control.", animation: ClippyAnimation.Searching },
    description:
      "Browse and manage the virtual filesystem at /home/reeyuki/ with support for file operations, archives, and drag-drop."
  },
  {
    serviceKey: "notepadApp",
    type: "system",
    title: "Notepad",
    icon: `${CDN_BASE}/static/icons/notepad.webp`,
    launchType: "instance",
    windowIdPatterns: ["notepad"],
    category: "office",
    clippy: { message: "Start a quick note or draft without overthinking it.", animation: ClippyAnimation.Writing },
    description: "Simple text editor for quick notes and plain text documents with save/load functionality."
  },
  {
    serviceKey: "settingsApp",
    type: "system",
    title: "Settings",
    icon: "fa fa-cog",
    launchType: "instance",
    windowIdPatterns: ["settings"],
    category: "system",
    clippy: { message: "Tune the system here and make it work your way.", animation: ClippyAnimation.Show },
    description:
      "Configure themes, wallpapers, window animations, taskbar behavior, sound, language, and system preferences."
  },
  {
    serviceKey: "wallpaperEngineApp",
    enhanced: false,
    type: "system",
    title: "Wallpaper Engine",
    icon: "fas fa-paint-roller",
    launchType: "instance",
    windowIdPatterns: ["wallpaper-engine"],
    category: "system",
    clippy: {
      message: "Browse your wallpapers, set favorites, and customize the desktop look.",
      animation: ClippyAnimation.Show
    },
    description:
      "Browse, preview, and manage all your wallpapers — static, video, animated, and custom uploads — in one place."
  },
  {
    serviceKey: "steamApp",
    type: "system",
    title: "Steam",
    icon: `${CDN_BASE}/static/icons/steam.webp`,
    launchType: "steam",
    windowIdPatterns: ["games-app"],
    category: "games",
    clippy: { message: "Browse game picks here and find something worth launching.", animation: ClippyAnimation.Wave },
    description:
      "Game storefront and launcher interface for browsing, managing, and launching games through Steam integration."
  },
  {
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
    },
    description: "Create custom shortcuts to external URLs with auto-detection of favicons and per-app CORS proxy."
  },
  {
    serviceKey: "officeApp",
    type: "system",
    title: "Office",
    icon: `${CDN_BASE}/static/icons/office.webp`,
    launchType: "instance",
    windowIdPatterns: ["office"],
    isHeavy: true,
    category: "office",
    clippy: { message: "Open office files here and keep the document flow moving.", animation: ClippyAnimation.Show },
    description: "View .docx, .xlsx, and .pptx documents using Office 365 integration."
  },
  {
    serviceKey: "jsDosApp",
    type: "system",
    title: "JsDos",
    icon: `${CDN_BASE}/static/icons/jsdos.webp`,
    launchType: "instance",
    windowIdPatterns: ["jsdos"],
    isHeavy: true,
    category: "games",
    clippy: { message: "Boot old DOS software and keep classic tools alive.", animation: ClippyAnimation.Show },
    description: "DOS emulator for running classic DOS games and applications."
  },
  {
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
    },
    description: "x86-64 full system emulator for running operating systems and legacy software."
  },
  {
    serviceKey: "youtubeUtilsApp",
    type: "system",
    title: "YouTube Utilities",
    icon: `${CDN_BASE}/static/icons/youtube.webp`,
    launchType: "instance",
    windowIdPatterns: ["youtube"],
    isHeavy: true,
    category: "internet",
    clippy: { message: "Paste a video link and I'll slot it into a player.", animation: ClippyAnimation.Show },
    description: "YouTube integration for watching videos within YukiOS."
  },
  {
    type: "system",
    title: "LibreSprite",
    source: "https://yukios.netlify.app/static/apps/libresprite/index.html",
    icon: `${CDN_BASE}/static/icons/libresprite.webp`,
    launchType: "remote",
    windowIdPatterns: ["libresprite"],
    category: "graphics",
    clippy: { message: "Open LibreSprite and sketch directly in the browser.", animation: ClippyAnimation.GetArtsy },
    description: "Pixel art editor with layers, animation, and export options."
  },
  {
    type: "system",
    title: "kiwiIRC",
    source: "/static/apps/kiwiirc/index.html",
    icon: `${CDN_BASE}/static/icons/kiwiirc.webp`,
    launchType: "iframe",
    windowIdPatterns: ["kiwiirc"],
    category: "internet",
    clippy: { message: "Jump into chat and keep your conversations in one place.", animation: ClippyAnimation.Show },
    description: "IRC client for connecting to IRC servers and chat rooms."
  },
  {
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
    },
    description: "Nintendo 3DS emulator for playing 3DS games in the browser."
  },
  {
    serviceKey: "clockApp",
    enhanced: true,
    type: "system",
    title: "Clock",
    icon: "fas fa-clock",
    launchType: "instance",
    windowIdPatterns: ["clock-app"],
    category: "office",
    clippy: { message: "Set alarms, run a timer, and keep the day on schedule.", animation: ClippyAnimation.Show },
    description: "Digital and analog clocks with alarms, stopwatch, timer, and customizable settings."
  },
  {
    type: "system",
    title: "Paint",
    source: "https://jspaint.app",
    icon: `${CDN_BASE}/static/icons/paint.webp`,
    launchType: "iframe",
    windowIdPatterns: ["paint"],
    category: "graphics",
    description: "Basic image editor with drawing tools, colors, and save functionality."
  },
  {
    type: "system",
    title: "Photopea",
    source: "https://www.photopea.com/",
    icon: `${CDN_BASE}/static/icons/photopea.webp`,
    launchType: "iframe",
    windowIdPatterns: ["photopea"],
    category: "graphics",
    description: "Advanced photo editor with layers, filters, and PSD support."
  },
  {
    type: "system",
    title: "Vs Code",
    source: "https://emupedia.net/emupedia-app-vscode",
    icon: `${CDN_BASE}/static/icons/vscode.webp`,
    launchType: "iframe",
    windowIdPatterns: ["vscode"],
    category: "development",
    description:
      "Web-based Visual Studio Code instance for full-featured software development with extensions and debugging tools."
  },
  {
    type: "system",
    title: "Mini Paint",
    source: "https://viliusle.github.io/miniPaint/",
    icon: "fas fa-paint-brush",
    launchType: "iframe",
    windowIdPatterns: ["minipaint"],
    category: "graphics",
    description:
      "Lightweight browser-based image editor with basic drawing tools, filters, and quick editing capabilities."
  },
  {
    serviceKey: "virtualMachineManagerApp",
    enhanced: true,
    type: "system",
    title: "Virtual Machine Manager",
    icon: "fas fa-server",
    launchType: "instance",
    windowIdPatterns: ["vm-app"],
    category: "development",
    clippy: { message: "Spin up a virtual machine right in your browser!", animation: ClippyAnimation.Show },
    description:
      "Boot simulated OS environments including Windows 93, 96, XP, 10, 11, Mac OS, and more in your browser."
  },
  {
    serviceKey: "screenshotApp",
    enhanced: true,
    type: "system",
    title: "Screenshot",
    icon: "fas fa-camera",
    launchType: "instance",
    windowIdPatterns: ["screenshot"],
    category: "graphics",
    description: "Capture fullscreen, area screenshots, and screen recordings with keyboard shortcuts."
  },
  {
    serviceKey: "colorPickerApp",
    enhanced: true,
    type: "system",
    title: "Color Picker",
    icon: "fas fa-eye-dropper",
    launchType: "instance",
    windowIdPatterns: ["color-picker"],
    category: "graphics",
    clippy: { message: "Pick any color from your screen with Alt+H.", animation: ClippyAnimation.Show },
    description: "Sample colors from anywhere on screen with a magnified preview and one-click copy."
  },
  {
    serviceKey: "mapsApp",
    enhanced: true,
    type: "system",
    title: "Maps",
    icon: "fas fa-map",
    launchType: "instance",
    windowIdPatterns: ["maps"],
    category: "internet",
    clippy: {
      message: "Explore the world with OpenStreetMap, or switch to Google Maps.",
      animation: ClippyAnimation.Show
    },
    description: "Interactive maps with OpenStreetMap and Google Maps support, plus configurable tile layers and zoom."
  },
  {
    serviceKey: "torBrowserApp",
    enhanced: true,
    type: "system",
    title: "Tor Connection Manager",
    icon: "fas fa-shield-halved",
    launchType: "instance",
    windowIdPatterns: ["tor-browser"],
    category: "internet",
    clippy: {
      message: "Connect to Tor via WebTor WASM with Snowflake WebRTC transport for anonymous browsing.",
      animation: ClippyAnimation.Show
    },
    description: "Connect to Tor via WebTor WASM with Snowflake WebRTC for anonymous browsing."
  },
  {
    serviceKey: "vncApp",
    enhanced: true,
    type: "system",
    title: "VNC Client",
    icon: "fas fa-display",
    launchType: "instance",
    windowIdPatterns: ["vnc-client"],
    category: "internet",
    clippy: {
      message: "Connect to remote desktops via VNC with saved profiles and clipboard sync.",
      animation: ClippyAnimation.Show
    },
    description:
      "Remote desktop client supporting VNC protocol with saved connection profiles, fullscreen mode, and clipboard integration."
  },
  {
    serviceKey: "robloxApp",
    enhanced: true,
    type: "system",
    title: "Roblox",
    icon: `${CDN_BASE}/static/icons/roblox.webp`,
    launchType: "instance",
    windowIdPatterns: ["roblox"],
    category: "games",
    clippy: {
      message: "Browse and play Roblox games in immersive desktop mode.",
      animation: ClippyAnimation.Show
    },
    description: "Browse and play Roblox games with full immersive desktop support."
  }
];
