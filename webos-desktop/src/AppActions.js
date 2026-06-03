import { SYSTEM_APPS } from "./AppRegistryConfig.js";
import { openSteamWindow } from "./games/games.js";

export function createAppActions(appLauncher) {
  const actions = {};

  for (const [appId, metadata] of Object.entries(SYSTEM_APPS)) {
    const { launchType, source, title, launchMethod } = metadata;

    switch (launchType) {
      case "instance":
        actions[appId] = (extra) => {
          if (appId === "taskManagerApp") {
            const appInstance = appLauncher.taskManager;
            if (appInstance) {
              return appInstance.open(extra);
            }
            console.error(`No app instance found for ${appId}`);
            return;
          }
          const appInstance = appLauncher[appId] || appLauncher[appId + "App"];
          if (appInstance) {
            return appInstance.open(extra);
          }
          console.error(`No app instance found for ${appId}`);
        };
        break;

      case "method":
        actions[appId] = (extra) => {
          if (launchMethod && typeof appLauncher[launchMethod] === "function") {
            return appLauncher[launchMethod](extra);
          }
          console.error(`No launch method found for ${appId}`);
        };
        break;

      case "iframe":
        actions[appId] = () => {
          if (!source) {
            console.error(`No source URL defined for iframe app ${appId}`);
            return;
          }
          return appLauncher.openIframeApp({
            appId,
            type: "game",
            source,
            originalName: title
          });
        };
        break;

      case "steam":
        actions[appId] = (extra) => {
          return openSteamWindow(appLauncher, appLauncher.explorerApp.wm, null, extra?.steamGameId);
        };
        break;

      default:
        console.warn(`Unknown launchType "${launchType}" for app ${appId}`);
    }
  }

  return actions;
}
