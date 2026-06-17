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
import {
  ChatgptApp,
  SpotifyApp,
  SlackApp,
  GmailApp,
  OutlookApp,
  DeepseekApp,
  TelegramApp,
  WhatsappApp,
  TeamsApp,
  ZoomApp,
  NotionApp,
  FigmaApp,
  TwitterApp,
  RedditApp,
  InstagramApp,
  LinkedinApp,
  PinterestApp,
  GoogleDocsApp,
  TrelloApp,
  CanvaApp,
  AsanaApp,
  GithubApp,
  GitlabApp,
  CodepenApp,
  ReplitApp,
  TwitchApp,
  SoundcloudApp,
  DeezerApp,
  ProtonmailApp,
  YahooMailApp
} from "./apps/webApps.js";
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
  { serviceKey: "chatgptApp", AppClass: ChatgptApp, enhanced: true },
  { serviceKey: "spotifyApp", AppClass: SpotifyApp, enhanced: true },
  { serviceKey: "slackApp", AppClass: SlackApp, enhanced: true },
  { serviceKey: "gmailApp", AppClass: GmailApp, enhanced: true },
  { serviceKey: "outlookApp", AppClass: OutlookApp, enhanced: true },
  { serviceKey: "deepseekApp", AppClass: DeepseekApp, enhanced: true },
  { serviceKey: "telegramApp", AppClass: TelegramApp, enhanced: true },
  { serviceKey: "whatsappApp", AppClass: WhatsappApp, enhanced: true },
  { serviceKey: "teamsApp", AppClass: TeamsApp, enhanced: true },
  { serviceKey: "zoomApp", AppClass: ZoomApp, enhanced: true },
  { serviceKey: "notionApp", AppClass: NotionApp, enhanced: true },
  { serviceKey: "figmaApp", AppClass: FigmaApp, enhanced: true },
  { serviceKey: "twitterApp", AppClass: TwitterApp, enhanced: true },
  { serviceKey: "redditApp", AppClass: RedditApp, enhanced: true },
  { serviceKey: "instagramApp", AppClass: InstagramApp, enhanced: true },
  { serviceKey: "linkedinApp", AppClass: LinkedinApp, enhanced: true },
  { serviceKey: "pinterestApp", AppClass: PinterestApp, enhanced: true },
  { serviceKey: "googleDocsApp", AppClass: GoogleDocsApp, enhanced: true },
  { serviceKey: "trelloApp", AppClass: TrelloApp, enhanced: true },
  { serviceKey: "canvaApp", AppClass: CanvaApp, enhanced: true },
  { serviceKey: "asanaApp", AppClass: AsanaApp, enhanced: true },
  { serviceKey: "githubApp", AppClass: GithubApp, enhanced: true },
  { serviceKey: "gitlabApp", AppClass: GitlabApp, enhanced: true },
  { serviceKey: "codepenApp", AppClass: CodepenApp, enhanced: true },
  { serviceKey: "replitApp", AppClass: ReplitApp, enhanced: true },
  { serviceKey: "twitchApp", AppClass: TwitchApp, enhanced: true },
  { serviceKey: "soundcloudApp", AppClass: SoundcloudApp, enhanced: true },
  { serviceKey: "deezerApp", AppClass: DeezerApp, enhanced: true },
  { serviceKey: "protonmailApp", AppClass: ProtonmailApp, enhanced: true },
  { serviceKey: "yahooMailApp", AppClass: YahooMailApp, enhanced: true },
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
