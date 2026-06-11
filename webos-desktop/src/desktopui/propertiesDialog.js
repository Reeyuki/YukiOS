import { os } from "../os/index.js";

export function showPropertiesDialog(icon, appLauncher, iconDataHelper, windowHelper) {
  const rect = icon.getBoundingClientRect();
  const appId = icon.dataset.app;
  const appInfo = appLauncher?.appMap?.[appId] ?? {};
  const name = iconDataHelper.getIconName(icon);
  const pathMap = iconDataHelper.getIconPathMap();
  const props = {
    Name: name,
    Type: appId || "Application",
    Path: pathMap[appId] || "static/icons/file.webp",
    "App Type": appInfo.type,
    "SWF Path": appInfo.swf,
    URL: appInfo.url,
    Width: `${Math.round(rect.width)}px`,
    Height: `${Math.round(rect.height)}px`,
    Left: `${Math.round(rect.left)}px`,
    Top: `${Math.round(rect.top)}px`,
    "Z-Index": icon.style.zIndex || "0"
  };
  const contentHtml = Object.entries(props)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `<div class="props-row">${k}: ${v}</div>`)
    .join("");
  const title = `Properties: ${name}`;
  const propsWin = os.window.create(`${icon.id || Date.now()}-props`, title, "300px", "auto");
  propsWin.innerHTML = `
    <div class="window-header"><span>${title}</span>
      ${os.window.getWindowControls()}
    </div>
    <div class="window-content" style="width:100%;height:100%;overflow:auto;user-select:text;padding:10px;">${contentHtml}</div>
  `;
  windowHelper.mountWindow(propsWin, propsWin.id, title);
}
