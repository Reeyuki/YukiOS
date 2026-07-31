import { APP_MANIFESTS } from "./registry/AppManifest.js";
import { StorageKeys } from "./StorageKeys.js";
import { os } from "./os/index.js";
import {
  getExt,
  IMAGE_EXTS,
  VIDEO_EXTS,
  AUDIO_EXTS,
  OFFICE_EXTS,
  TEXT_EXTS,
  CODE_EXTS,
  HTML_EXTS,
  MARKDOWN_EXTS,
  FONT_EXTS,
  SWF_EXTS,
  EXE_EXTS,
  MODEL3D_EXTS,
  DISK_EXTS
} from "./shared/fileKindDetector.js";
import { ROM_EXTS } from "./shared/coreMap.js";

export const FILE_ASSOCIATIONS_CHANGED = "fileAssociations:changed";

const BUILTIN_HANDLERS = {
  mediaViewer: {
    appId: "mediaViewer",
    title: "Media Viewer",
    icon: "fas fa-play-circle",
    extensions: [...IMAGE_EXTS, ...VIDEO_EXTS, ...AUDIO_EXTS]
  },
  fontViewer: {
    appId: "fontViewer",
    title: "Font Viewer",
    icon: "fas fa-font",
    extensions: [...FONT_EXTS]
  }
};

function getManifestHandlers() {
  const handlers = new Map();
  for (const manifest of APP_MANIFESTS) {
    const extensions = manifest.fileAssociations?.extensions;
    if (!manifest.serviceKey || !Array.isArray(extensions) || !extensions.length) continue;
    handlers.set(manifest.serviceKey, {
      appId: manifest.serviceKey,
      title: manifest.title,
      icon: manifest.icon,
      extensions: [...extensions]
    });
  }
  return handlers;
}

function getAllHandlers() {
  const handlers = new Map();
  for (const handler of Object.values(BUILTIN_HANDLERS)) handlers.set(handler.appId, handler);
  for (const [appId, handler] of getManifestHandlers()) handlers.set(appId, handler);
  return [...handlers.values()];
}

function getHandlerById(appId) {
  return (
    Object.values(BUILTIN_HANDLERS).find((handler) => handler.appId === appId) ||
    getManifestHandlers().get(appId) ||
    null
  );
}

function getAppDescriptor(appId) {
  const handler = getHandlerById(appId);
  if (handler) return handler;
  const info = os.app.getAppInfo(appId);
  if (info?.title) return { appId, title: info.title, icon: info.icon || "fas fa-th", extensions: [] };
  return null;
}

const DEFAULT_EXT_MAP = {};
{
  const assignDefaults = (appId, extensions) => {
    for (const ext of extensions) DEFAULT_EXT_MAP[ext] = appId;
  };
  assignDefaults("mediaViewer", [...IMAGE_EXTS, ...VIDEO_EXTS, ...AUDIO_EXTS]);
  assignDefaults("fontViewer", FONT_EXTS);
  assignDefaults("model3dApp", MODEL3D_EXTS);
  assignDefaults("emulatorApp", ROM_EXTS);
  assignDefaults("ruffleApp", SWF_EXTS);
  assignDefaults("jsDosApp", EXE_EXTS);
  assignDefaults("v86app", DISK_EXTS);
  assignDefaults("browserApp", HTML_EXTS);
  assignDefaults("notepadApp", [...TEXT_EXTS, ...CODE_EXTS]);
  assignDefaults("markdownApp", MARKDOWN_EXTS);
  assignDefaults("officeApp", OFFICE_EXTS);
}

function getOverrides() {
  return os.storage.get(StorageKeys.defaultAppAssociations) || {};
}

function saveOverrides(overrides, detail = {}) {
  os.storage.set(StorageKeys.defaultAppAssociations, overrides);
  os.events.emit(FILE_ASSOCIATIONS_CHANGED, detail);
}

export function getRegisteredExtensions() {
  const extensions = new Set();
  for (const handler of getAllHandlers()) {
    for (const ext of handler.extensions) extensions.add(ext);
  }
  return [...extensions].sort();
}

export function getExtensionsForApp(appId) {
  const handler = getHandlerById(appId);
  return handler ? [...handler.extensions] : [];
}

export function getDefaultAppForExt(ext) {
  const overrides = getOverrides();
  if (Object.prototype.hasOwnProperty.call(overrides, ext)) {
    const appId = overrides[ext];
    if (!appId) return null;
    return getAppDescriptor(appId);
  }
  const appId = DEFAULT_EXT_MAP[ext];
  if (!appId) return null;
  return getAppDescriptor(appId);
}

export function getDefaultApp(name) {
  return getDefaultAppForExt(getExt(name));
}

export function getAppsForExtension(ext) {
  const defaultAppId = getDefaultAppForExt(ext)?.appId;
  return getAllHandlers()
    .filter((handler) => handler.extensions.includes(ext))
    .sort((a, b) => {
      if (a.appId === defaultAppId) return -1;
      if (b.appId === defaultAppId) return 1;
      return a.title.localeCompare(b.title);
    });
}

export function getCompatibleApps(name) {
  return getAppsForExtension(getExt(name));
}

export function setDefaultApp(ext, appId) {
  if (!getHandlerById(appId) && !os.app.hasApp(appId)) return;
  const overrides = getOverrides();
  overrides[ext] = appId;
  saveOverrides(overrides, { ext, appId });
}

export function getAllPickableApps() {
  return getAllHandlers().sort((a, b) => a.title.localeCompare(b.title));
}

export function clearDefaultApp(ext) {
  const overrides = getOverrides();
  if (!(ext in overrides)) return;
  delete overrides[ext];
  saveOverrides(overrides, { ext });
}

export function isUnassociated(ext) {
  const overrides = getOverrides();
  return Object.prototype.hasOwnProperty.call(overrides, ext) && !overrides[ext];
}

export function unassociateExtension(ext) {
  const overrides = getOverrides();
  overrides[ext] = null;
  saveOverrides(overrides, { ext, appId: null });
}

export function resetAllDefaults() {
  saveOverrides({});
}
