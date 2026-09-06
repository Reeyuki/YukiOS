import { StorageKeys, os } from "../framework.js";

export const RUFFLE_DEFAULTS = {
  letterbox: "on",
  scale: "showAll",
  backgroundColor: "#000000",
  splashScreen: true,
  autoplay: "auto",
  unmuteOverlay: "visible",
  contextMenu: "on",
  allowScriptAccess: false,
  upgradeToHttps: true,
  showSwfDownload: false,
  maxExecutionDuration: 15,
  logLevel: "error",
  openUrlMode: "allow",
  warnOnUnsupportedContent: true
};

export function loadRuffleConfig() {
  try {
    const raw = os.storage.get(StorageKeys.ruffleConfig);
    if (!raw) return { ...RUFFLE_DEFAULTS };
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    const merged = { ...RUFFLE_DEFAULTS, ...parsed };
    if (merged.maxExecutionDuration && typeof merged.maxExecutionDuration === "object") {
      merged.maxExecutionDuration = Number(merged.maxExecutionDuration.secs) || 15;
    }
    return merged;
  } catch {
    return { ...RUFFLE_DEFAULTS };
  }
}

export function saveRuffleConfig(patch) {
  const next = { ...loadRuffleConfig(), ...patch };
  os.storage.set(StorageKeys.ruffleConfig, next);
  return next;
}

export function buildPlayerConfig(overrides = {}) {
  const cfg = { ...loadRuffleConfig(), ...overrides };
  const playerConfig = {
    letterbox: cfg.letterbox,
    scale: cfg.scale,
    backgroundColor: cfg.backgroundColor || null,
    splashScreen: cfg.splashScreen,
    autoplay: cfg.autoplay,
    unmuteOverlay: cfg.unmuteOverlay,
    contextMenu: cfg.contextMenu,
    allowScriptAccess: cfg.allowScriptAccess,
    upgradeToHttps: cfg.upgradeToHttps,
    showSwfDownload: cfg.showSwfDownload,
    maxExecutionDuration: Number(cfg.maxExecutionDuration) || 15,
    logLevel: cfg.logLevel,
    openUrlMode: cfg.openUrlMode,
    warnOnUnsupportedContent: cfg.warnOnUnsupportedContent
  };
  if (cfg.base) playerConfig.base = cfg.base;
  return playerConfig;
}

export function applyConfigToPlayer(player, overrides = {}) {
  if (!player) return;
  const cfg = buildPlayerConfig(overrides);
  try {
    player.config = { ...(player.config || {}), ...cfg };
  } catch {}
}