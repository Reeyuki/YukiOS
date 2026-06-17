import { createScramjetWebApp } from "../core/ScramjetWebAppFactory.js";
import { APP_MANIFESTS } from "../registry/AppManifest.js";

const webApps = {};

APP_MANIFESTS.forEach((manifest) => {
  if (manifest.targetUrl) {
    const className = manifest.title.replace(/[^a-zA-Z0-9]/g, "") + "App";
    webApps[className] = createScramjetWebApp({
      appId: manifest.serviceKey,
      appName: manifest.title,
      targetUrl: manifest.targetUrl,
      appIcon: manifest.icon,
      windowSize: manifest.windowSize || ["90vw", "85vh"],
      trayOptions: manifest.trayOptions || null
    });
  }
});

export function getWebAppClass(serviceKey) {
  const manifest = APP_MANIFESTS.find((m) => m.serviceKey === serviceKey && m.targetUrl);
  if (!manifest) return null;
  const className = manifest.title.replace(/[^a-zA-Z0-9]/g, "") + "App";
  return webApps[className] || null;
}

export { webApps };
