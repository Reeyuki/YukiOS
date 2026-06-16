import { HybridAdapter } from "./runtime/HybridAdapter.js";
import { TerminalApp } from "./apps/terminal.js";
import { CameraApp } from "./apps/camera.js";
import { AboutApp } from "./apps/about.js";
import { NewsApp } from "./apps/news.js";
import { CalculatorApp } from "./apps/calculator.js";
import { TaskManagerApp } from "./apps/taskManager.js";
import { WeatherApp } from "./apps/weather.js";
import { MarkdownApp } from "./apps/markdown.js";
import { ShittifyApp } from "./apps/shittify.js";
import { MonacoApp } from "./apps/monaco.js";
import { Model3DApp } from "./apps/model3d.js";
import { EmulatorApp } from "./apps/emulator.js";
import { AchievementsApp } from "./achievements.js";
import { RuffleApp } from "./apps/ruffle.js";
import { ShortcutsApp } from "./apps/shortcuts.js";
import { YukiConvertApp } from "./apps/yukiConvert.js";
import { SetupApp } from "./apps/setupApp.js";
import { DataEditorApp } from "./apps/dataEditor.js";
import { InstalledAppsApp } from "./apps/installedApps.js";
import { YukiOsGuideApp } from "./apps/yukiOsGuide.js";
import { ClipboardManagerApp } from "./apps/clipboardApp.js";
import { AIAssistantApp } from "./apps/aiAssistant.js";
import { DisplayPerformanceApp } from "./apps/displayPerformanceApp.js";
import { NetworkTrayApp } from "./tray/networkTray.js";
import { EmojiSelectorApp } from "./apps/emojiSelector.js";
import { SystemAppsApp } from "./apps/systemApps.js";
import { RhythmsApp } from "./apps/rhythms.js";
import { ScramjetApp } from "./apps/scramjet.js";
import { DiscordApp } from "./apps/discordApp.js";
import { YoutubeApp } from "./apps/youtube.js";
import { SpotifyApp } from "./apps/spotifyApp.js";
import { SlackApp } from "./apps/slackApp.js";
import { GmailApp } from "./apps/gmailApp.js";
import { OutlookApp } from "./apps/outlookApp.js";
import { ChatgptApp } from "./apps/chatgptApp.js";
import { DeepseekApp } from "./apps/deepseekApp.js";
import { TorrentClientApp } from "./apps/torrentClient.js";

const APP_DEFINITIONS = [
  { serviceKey: "terminalApp", AppClass: TerminalApp, enhanced: true },
  { serviceKey: "cameraApp", AppClass: CameraApp, enhanced: true },
  { serviceKey: "aboutApp", AppClass: AboutApp, enhanced: false },
  { serviceKey: "newsApp", AppClass: NewsApp, enhanced: true },
  { serviceKey: "calculatorApp", AppClass: CalculatorApp, enhanced: true },
  { serviceKey: "taskManagerApp", AppClass: TaskManagerApp, enhanced: false },
  { serviceKey: "weatherApp", AppClass: WeatherApp, enhanced: false },
  { serviceKey: "markdownApp", AppClass: MarkdownApp, enhanced: true },
  { serviceKey: "shittifyApp", AppClass: ShittifyApp, enhanced: false },
  { serviceKey: "monacoApp", AppClass: MonacoApp, enhanced: true },
  { serviceKey: "model3dApp", AppClass: Model3DApp, enhanced: false },
  { serviceKey: "emulatorApp", AppClass: EmulatorApp, enhanced: true },
  {
    serviceKey: "achievementsApp",
    AppClass: AchievementsApp,
    enhanced: true,
    onLoad: (inst) => {
      window.achievements = inst;
    }
  },
  { serviceKey: "ruffleApp", AppClass: RuffleApp, enhanced: true },
  { serviceKey: "shortcutsApp", AppClass: ShortcutsApp, enhanced: false },
  { serviceKey: "yukiConvertApp", AppClass: YukiConvertApp, enhanced: false },
  { serviceKey: "setupApp", AppClass: SetupApp, enhanced: false },
  { serviceKey: "dataEditorApp", AppClass: DataEditorApp, enhanced: true },
  { serviceKey: "installedAppsApp", AppClass: InstalledAppsApp, enhanced: false },
  { serviceKey: "yukiOsGuideApp", AppClass: YukiOsGuideApp, enhanced: true },
  { serviceKey: "clipboardManagerApp", AppClass: ClipboardManagerApp, enhanced: false },
  { serviceKey: "aiAssistantApp", AppClass: AIAssistantApp, enhanced: false },
  { serviceKey: "displayPerformanceApp", AppClass: DisplayPerformanceApp, enhanced: false },
  { serviceKey: "networkTrayApp", AppClass: NetworkTrayApp, enhanced: false },
  { serviceKey: "scramjetApp", AppClass: ScramjetApp, enhanced: true },
  { serviceKey: "discordApp", AppClass: DiscordApp, enhanced: true },
  { serviceKey: "youtubeApp", AppClass: YoutubeApp, enhanced: true },
  { serviceKey: "spotifyApp", AppClass: SpotifyApp, enhanced: true },
  { serviceKey: "slackApp", AppClass: SlackApp, enhanced: true },
  { serviceKey: "gmailApp", AppClass: GmailApp, enhanced: true },
  { serviceKey: "outlookApp", AppClass: OutlookApp, enhanced: true },
  { serviceKey: "chatgptApp", AppClass: ChatgptApp, enhanced: true },
  { serviceKey: "deepseekApp", AppClass: DeepseekApp, enhanced: true },
  { serviceKey: "emojiSelectorApp", AppClass: EmojiSelectorApp, enhanced: true },
  { serviceKey: "systemAppsApp", AppClass: SystemAppsApp, enhanced: false },
  { serviceKey: "rhythmsApp", AppClass: RhythmsApp, enhanced: true },
  { serviceKey: "torrentClientApp", AppClass: TorrentClientApp, enhanced: true }
];

export function loadApps(services) {
  for (const { serviceKey, AppClass, enhanced, onLoad } of APP_DEFINITIONS) {
    if (services[serviceKey]) continue;
    const Cls = enhanced ? HybridAdapter.enhanceBaseApp(AppClass) : AppClass;
    const instance = new Cls(services);
    services[serviceKey] = instance;
    if (onLoad) onLoad(instance, services);
  }
}
