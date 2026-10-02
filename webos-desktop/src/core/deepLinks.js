/**
 * Maps URL paths and query params to "what should the OS open on startup".
 * Kept free of DOM and OS imports so it can be unit-tested.
 *
 * Keep FEATURE_APP_MAP in sync with the copy in scripts/generateSitemap.js (the generated
 * /feature/*.html pages link back into the OS through these ids).
 */

export const FEATURE_APP_MAP = Object.freeze({
  terminal: "terminalApp",
  games: "steamApp",
  tiling: null,
  "mac-mode": null,
  emulators: null,
  "3d-room": "room3dApp",
  "start-menu": null,
  workspaces: null,
  widgets: null,
  "audio-mixer": null,
  "user-accounts": null
});

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * @param {{ pathname: string, search: string }} location
 * @param {{ parseBool?: (value: string | null) => boolean }} [options]
 * @returns {{ action: "launch", id: string, swf?: boolean } | { action: "steam" } | null}
 */
export function resolveDeepLink({ pathname, search }, { parseBool = (v) => v === "true" || v === "1" } = {}) {
  // /app/<id>.html and /game/<id>.html (the static SEO pages)
  const pageMatch = pathname.match(/^\/(app|game)\/(.+)\.html$/);
  if (pageMatch) return { action: "launch", id: safeDecode(pageMatch[2]) };

  // /feature/<slug>.html
  const featureMatch = pathname.match(/^\/feature\/(.+)\.html$/);
  if (featureMatch) {
    const slug = safeDecode(featureMatch[1]);
    const appId = Object.hasOwn(FEATURE_APP_MAP, slug) ? FEATURE_APP_MAP[slug] : null;
    return appId ? { action: "launch", id: appId } : null;
  }

  if (pathname === "/features.html") return null;

  const params = new URLSearchParams(search);
  if (params.get("steam")) return { action: "steam" };

  const app = params.get("app");
  if (app) return { action: "launch", id: app };

  const game = params.get("game");
  if (game) return { action: "launch", id: game, swf: parseBool(params.get("swf")) };

  return null;
}
