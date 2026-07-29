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
import { Model3DApp } from "./apps/blender.js";
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
import { LaunchpadApp } from "./apps/launchpad.js";
import { RhythmsApp } from "./apps/rhythms.js";
import { BrowserApp } from "./apps/browser.js";
import { YoutubeApp } from "./apps/youtube.js";
import { TorrentClientApp } from "./apps/torrentClient.js";
import { VirtualMachineManagerApp } from "./apps/virtualMachineManager.js";
import { ColorPickerApp } from "./apps/colorPicker.js";
import { ScreenshotApp } from "./apps/screenshot.js";
import { MapsApp } from "./apps/maps.js";
import { ErudaApp } from "./apps/eruda.js";
import { ClockApp } from "./apps/clock.js";
import { TorBrowserApp } from "./apps/torBrowser.js";
import { VNCApp } from "./apps/vncApp.js";
import { DiscordApp } from "./apps/discord.js";
import { RobloxApp } from "./apps/roblox.js";
import { WallpaperEngineApp } from "./apps/wallpaperEngine.js";
import { RunApp } from "./apps/run.js";
import { NotepadApp } from "./apps/notepad.js";
import { LavatApp } from "./apps/lavat.js";
import { BtopApp } from "./apps/btop.js";
import { CmatrixApp } from "./apps/cmatrix.js";
import { MagnifierApp } from "./apps/magnifier.js";

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
  launchpadApp: LaunchpadApp,
  rhythmsApp: RhythmsApp,
  browserApp: BrowserApp,
  youtubeApp: YoutubeApp,
  torrentClientApp: TorrentClientApp,
  virtualMachineManagerApp: VirtualMachineManagerApp,
  colorPickerApp: ColorPickerApp,
  screenshotApp: ScreenshotApp,
  mapsApp: MapsApp,
  erudaApp: ErudaApp,
  clockApp: ClockApp,
  torBrowserApp: TorBrowserApp,
  vncApp: VNCApp,
  discordApp: DiscordApp,
  robloxApp: RobloxApp,
  wallpaperEngineApp: WallpaperEngineApp,
  runApp: RunApp,
  notepadApp: NotepadApp,
  lavatApp: LavatApp,
  btopApp: BtopApp,
  cmatrixApp: CmatrixApp,
  magnifierApp: MagnifierApp
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
    AppClass
  };

  if (manifest.onLoad) {
    definition.onLoad = manifest.onLoad;
  }

  return definition;
}).filter(Boolean);

export function loadApps(os, preloaded = {}) {
  for (const { serviceKey, AppClass, onLoad } of APP_DEFINITIONS) {
    if (preloaded[serviceKey]) continue;
    const instance = new AppClass(os);
    preloaded[serviceKey] = instance;
    os.app.register(serviceKey, instance);
    if (onLoad) onLoad(instance, preloaded);
  }

  let room3dInst = null;
  const ensureRoom3D = async () => {
    if (!room3dInst) {
      const { Room3DApp } = await import("./apps/room3d.js");
      room3dInst = new Room3DApp(os);
    }
    return room3dInst;
  };
  const lazyRoom3D = {
    open: (...a) => ensureRoom3D().then((i) => i.open(...a)),
    launchSystemMode: (...a) => ensureRoom3D().then((i) => i.launchSystemMode(...a)),
    exitSystemMode: (...a) => ensureRoom3D().then((i) => i.exitSystemMode(...a)),
    closeRoom: (...a) => ensureRoom3D().then((i) => i.closeRoom(...a)),
    onClose: (...a) => ensureRoom3D().then((i) => i.onClose(...a))
  };
  preloaded.room3dApp = lazyRoom3D;
  os.app.register("room3dApp", lazyRoom3D);

  return preloaded;
}
