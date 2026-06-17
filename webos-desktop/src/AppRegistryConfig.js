import { APP_MANIFESTS } from "./registry/AppManifest.js";

const SYSTEM_APPS = APP_MANIFESTS.reduce((acc, manifest) => {
  const key = manifest.serviceKey || manifest.title.toLowerCase().replace(/\s+/g, "");
  acc[key] = {
    serviceKey: manifest.serviceKey,
    type: manifest.type,
    title: manifest.title,
    icon: manifest.icon,
    launchType: manifest.launchType,
    launchMethod: manifest.launchMethod,
    windowIdPatterns: manifest.windowIdPatterns,
    isHeavy: manifest.isHeavy,
    category: manifest.category,
    clippy: manifest.clippy,
    persistContentState: manifest.persistContentState,
    excludeFromInstalledApps: manifest.excludeFromInstalledApps,
    source: manifest.source
  };
  return acc;
}, {});

export { SYSTEM_APPS };
export const SYSTEM_APP_IDS = Object.keys(SYSTEM_APPS);
