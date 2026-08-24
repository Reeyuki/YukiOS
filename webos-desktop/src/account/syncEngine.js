import { os } from "../framework.js";
import { StorageKeys } from "../StorageKeys.js";
import { isLoggedIn, request } from "./session.js";

const TOGGLES_KEY = StorageKeys.accountToggles;
const ENABLED_KEY = StorageKeys.accountSyncEnabledPref;

const componentDefs = [
  {
    id: "osSettings",
    label: "OS Settings & Preferences",
    description: "Theme, appearance, wallpaper choice, taskbar/dock, display, power, sound, keybinds, tiling.",
    icon: "fa-sliders",
    defaultOn: true,
    keys: [
      StorageKeys.theme,
      StorageKeys.customColors,
      StorageKeys.customThemes,
      StorageKeys.transparentUI,
      StorageKeys.transparency,
      StorageKeys.windowTransparency,
      StorageKeys.wallpaperKey,
      StorageKeys.wallpaperType,
      StorageKeys.wallpaperIndexKey,
      StorageKeys.cycleWallpaper,
      StorageKeys.macWallpaperInitialized,
      StorageKeys.cursorKey,
      StorageKeys.cursorSizeKey,
      StorageKeys.fontFamily,
      StorageKeys.customFont,
      StorageKeys.fontSize,
      StorageKeys.guiScale,
      StorageKeys.uiDensity,
      StorageKeys.brightness,
      StorageKeys.temperature,
      StorageKeys.nightModeEnabled,
      StorageKeys.powerMode,
      StorageKeys.batterySaverEnabled,
      StorageKeys.soundEnabled,
      StorageKeys.masterVolume,
      StorageKeys.systemAudioEnabled,
      StorageKeys.taskbarPosition,
      StorageKeys.taskbarAlignment,
      StorageKeys.taskbarScale,
      StorageKeys.taskbarShowLabels,
      StorageKeys.dockEnabled,
      StorageKeys.dockPosition,
      StorageKeys.dockAutoHide,
      StorageKeys.dockMagnification,
      StorageKeys.dockIconSize,
      StorageKeys.windowOpenAnimation,
      StorageKeys.windowCloseAnimation,
      StorageKeys.windowAnimationSpeed,
      StorageKeys.wobblyWindows,
      StorageKeys.windowSwitcherMode,
      StorageKeys.tilingEnabled,
      StorageKeys.tilingGaps,
      StorageKeys.tilingSplitRatio,
      StorageKeys.loginClock24h,
      StorageKeys.weather,
      StorageKeys.macOsControls,
      StorageKeys.windowHeaderStyle,
      StorageKeys.notificationsPosition,
      StorageKeys.notificationsEnabled
    ]
  },
  {
    id: "browser",
    label: "Browser data",
    description: "Bookmarks, homepage, dark mode, transport & proxy settings.",
    icon: "fa-globe",
    defaultOn: true,
    keys: [
      StorageKeys.browserBookmarks,
      StorageKeys.browserHomepage,
      StorageKeys.browserDarkMode,
      StorageKeys.browserDarkExclusions,
      StorageKeys.browserShowBookmarks,
      StorageKeys.browserZoom,
      StorageKeys.browserTransport,
      StorageKeys.wispServer
    ]
  },
  {
    id: "desktop",
    label: "Desktop icons & layout",
    description: "Desktop icon positions, deleted icons, sort mode, start menu size.",
    icon: "fa-desktop",
    defaultOn: true,
    keys: [
      StorageKeys.positionsKey,
      StorageKeys.deletedIconsKey,
      StorageKeys.favoritesKey,
      StorageKeys.desktopIconSize,
      StorageKeys.desktopIconAlignment,
      StorageKeys.desktopSortMode,
      StorageKeys.desktopAutoSort,
      StorageKeys.hideDesktopIcons,
      StorageKeys.startMenuWidth,
      StorageKeys.startMenuHeight,
      StorageKeys.startMenuCats,
      StorageKeys.startMenuGridItems
    ]
  },
  {
    id: "apps",
    label: "Apps & defaults",
    description: "Installed/renamed/uninstalled apps, default file handlers, quick access, startup apps.",
    icon: "fa-rocket",
    defaultOn: false,
    keys: [
      StorageKeys.appRegistryDisabled,
      StorageKeys.appRegistryRenamed,
      StorageKeys.appRegistryUninstalled,
      StorageKeys.defaultAppAssociations,
      StorageKeys.explorerQuickAccess,
      StorageKeys.explorerViewMode,
      StorageKeys.startupApps
    ]
  }
];

function normalize(defs) {
  return defs.map((d) => ({ ...d, keys: (d.keys || []).filter(Boolean) }));
}

export const SYNC_COMPONENTS = normalize(componentDefs);

export function isSyncEnabledPref() {
  return os.storage.get(ENABLED_KEY) === true;
}

export function setSyncEnabledPref(enabled) {
  os.storage.set(ENABLED_KEY, !!enabled);
}

export function getToggles() {
  const stored = os.storage.get(TOGGLES_KEY) || {};
  const out = {};
  SYNC_COMPONENTS.forEach((c) => {
    out[c.id] = typeof stored[c.id] === "boolean" ? stored[c.id] : c.defaultOn;
  });
  return out;
}

export function setToggle(id, value) {
  const toggles = getToggles();
  toggles[id] = !!value;
  os.storage.set(TOGGLES_KEY, toggles);
}

function toBytes(value) {
  if (value == null) return 0;
  if (typeof Blob !== "undefined" && value instanceof Blob) return value.size;
  if (typeof value === "string") return new TextEncoder().encode(value).length;
  if (typeof ArrayBuffer !== "undefined" && value instanceof ArrayBuffer) return value.byteLength;
  if (ArrayBuffer.isView(value)) return value.byteLength;
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

export function buildBundle() {
  if (!isLoggedIn()) return null;
  const toggles = getToggles();
  const bundle = { version: 1, components: {} };
  let totalBytes = 0;
  for (const c of SYNC_COMPONENTS) {
    if (!toggles[c.id]) continue;
    const data = {};
    let bytes = 0;
    for (const key of c.keys) {
      const value = os.storage.get(key);
      if (value !== null && value !== undefined) {
        data[key] = value;
        bytes += toBytes(value);
      }
    }
    bundle.components[c.id] = { data, bytes };
    totalBytes += bytes;
  }
  bundle.totalBytes = totalBytes;
  bundle.updatedAt = Date.now();
  return bundle;
}

export function componentSizes(bundle) {
  const sizes = {};
  if (!bundle || !bundle.components || typeof bundle.components !== "object") return sizes;
  Object.keys(bundle.components).forEach((id) => {
    const comp = bundle.components[id];
    sizes[id] = comp && typeof comp.bytes === "number" ? comp.bytes : 0;
  });
  return sizes;
}

export async function syncPush() {
  if (!isLoggedIn()) return { error: "Not signed in." };
  const bundle = buildBundle();
  if (!bundle) return { error: "Nothing to sync." };
  const res = await request("/live/sync/set", "POST", { data: bundle });
  if (!res.ok) {
    if (res.status === 413) {
      return { error: res.data.error || "Sync data exceeds your storage quota.", quota: res.data.quota };
    }
    if (res.status === 401) return { needsReauth: true, error: res.data.error || "Session expired." };
    return { error: res.data.error || "Sync failed." };
  }
  os.storage.set(StorageKeys.accountQuota, res.data.quota);
  return { ok: true, quota: res.data.quota };
}

function parseBundle(raw) {
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!raw || typeof raw !== "object" || !raw.components) return null;
  return raw;
}

export async function getCloudSummary() {
  if (!isLoggedIn()) return null;
  const res = await request("/live/sync/get");
  if (!res.ok) {
    if (res.status === 401) return { needsReauth: true, error: res.data.error || "Session expired." };
    return { error: res.data.error || "Could not fetch the cloud." };
  }
  let payload = res.data && res.data.payload;
  if (typeof payload === "string") {
    try {
      payload = JSON.parse(payload);
    } catch {
      payload = null;
    }
  }
  const components = [];
  let totalBytes = 0;
  if (payload && payload.components && typeof payload.components === "object") {
    for (const c of SYNC_COMPONENTS) {
      const comp = payload.components[c.id];
      if (!comp || typeof comp !== "object") continue;
      const data = comp && typeof comp.data === "object" && comp.data ? comp.data : comp;
      const bytes = comp && typeof comp.bytes === "number" ? comp.bytes : JSON.stringify(data).length;
      totalBytes += bytes;
      components.push({ id: c.id, label: c.label, icon: c.icon, bytes });
    }
  }
  return {
    updatedAt: res.data && res.data.updatedAt ? res.data.updatedAt : null,
    quota: res.data && res.data.quota ? res.data.quota : null,
    totalBytes,
    components
  };
}

export async function syncPull(remoteData) {
  if (!isLoggedIn()) return { error: "Not signed in." };
  let bundle = remoteData;
  if (bundle === undefined) {
    const res = await request("/live/sync/get");
    if (!res.ok) {
      if (res.status === 401) return { needsReauth: true, error: res.data.error || "Session expired." };
      return { error: res.data.error || "Could not pull the sync." };
    }
    bundle = parseBundle(res.data && res.data.payload);
    os.storage.set(StorageKeys.accountQuota, res.data.quota);
  }
  if (!bundle) return { error: "No synced data yet." };
  const toggles = getToggles();
  SYNC_COMPONENTS.forEach((c) => {
    if (!toggles[c.id]) return;
    const comp = bundle.components[c.id];
    if (!comp || typeof comp !== "object") return;
    const data = typeof comp.data === "object" && comp.data ? comp.data : comp;
    Object.keys(data).forEach((k) => {
      os.storage.set(k, data[k]);
    });
  });
  return { ok: true };
}
