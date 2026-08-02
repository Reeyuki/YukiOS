import { os } from "../framework.js";

export async function isAppOnDesktop(appId) {
  try {
    const desktopFolder = await os.fs.readdir(["Desktop"]);
    for (const [name, itemData] of Object.entries(desktopFolder)) {
      if (name.endsWith(".desktop") && itemData.type === "file") {
        try {
          const parsed = JSON.parse(await os.fs.read(["Desktop", name]));
          if (parsed && parsed.app === appId) return true;
        } catch (e) {}
      }
    }
  } catch (e) {}
  return false;
}

export async function addAppToDesktop(appId, appData) {
  const title = (appData && (appData.title || appData.displayName)) || appId;
  const fileContent = JSON.stringify({ app: appId, name: title, path: appData?.icon || "" });
  await os.fs.mkdir(["Desktop"]);
  const fileName = await os.fs.createFile(["Desktop"], `${title}.desktop`, fileContent, "text");
  try {
    await os.desktopUI?.iconManager?.createDesktopFileIcon(fileName);
  } catch (e) {}
  return fileName;
}

export function launchAppFromDesktop(appId) {
  os.app.launch(appId);
}