import { HybridAdapter } from "./runtime/HybridAdapter.js";
import { APP_MANIFESTS } from "./registry/AppManifest.js";
import { getWebAppClass } from "./apps/webApps.js";
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
import { TorrentClientApp } from "./apps/torrentClient.js";

const APP_CLASS_MAP = {
  terminalApp: TerminalApp,
  cameraApp: CameraApp,
  aboutApp: AboutApp,
  newsApp: NewsApp,
  calculatorApp: CalculatorApp,
  taskManagerApp: TaskManagerApp,
  weatherApp: WeatherApp,
  markdownApp: MarkdownApp,
  shittifyApp: ShittifyApp,
  monacoApp: MonacoApp,
  model3dApp: Model3DApp,
  emulatorApp: EmulatorApp,
  achievementsApp: AchievementsApp,
  ruffleApp: RuffleApp,
  shortcutsApp: ShortcutsApp,
  yukiConvertApp: YukiConvertApp,
  setupApp: SetupApp,
  dataEditorApp: DataEditorApp,
  installedAppsApp: InstalledAppsApp,
  yukiOsGuideApp: YukiOsGuideApp,
  clipboardManagerApp: ClipboardManagerApp,
  aiAssistantApp: AIAssistantApp,
  displayPerformanceApp: DisplayPerformanceApp,
  networkTrayApp: NetworkTrayApp,
  emojiSelectorApp: EmojiSelectorApp,
  systemAppsApp: SystemAppsApp,
  rhythmsApp: RhythmsApp,
  scramjetApp: ScramjetApp,
  discordApp: DiscordApp,
  youtubeApp: YoutubeApp,
  torrentClientApp: TorrentClientApp
};

const APP_DEFINITIONS = APP_MANIFESTS.map((manifest) => {
  let AppClass;

  if (manifest.targetUrl) {
    AppClass = getWebAppClass(manifest.serviceKey);
  } else {
    AppClass = APP_CLASS_MAP[manifest.serviceKey];
  }

  if (!AppClass) return null;

  const definition = {
    serviceKey: manifest.serviceKey,
    AppClass,
    enhanced: manifest.enhanced
  };

  if (manifest.onLoad) {
    definition.onLoad = manifest.onLoad;
  }

  return definition;
}).filter(Boolean);

export function loadApps(services) {
  for (const { serviceKey, AppClass, enhanced, onLoad } of APP_DEFINITIONS) {
    if (services[serviceKey]) continue;
    const Cls = enhanced ? HybridAdapter.enhanceBaseApp(AppClass) : AppClass;
    const instance = new Cls(services);
    services[serviceKey] = instance;
    if (onLoad) onLoad(instance, services);
  }
}
