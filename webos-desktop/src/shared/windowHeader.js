import { os } from "../os/index.js";
import { resolveIconUrl } from "./assetResolver.js";
import { isImageFile } from "./fileKindDetector.js";

export function buildWindowIconHtml(iconValue, color = null) {
  if (!iconValue) return "";
  const resolved = resolveIconUrl(iconValue);
  const isDataUrl = typeof resolved === "string" && resolved.startsWith("data:");
  const isHttpUrl = typeof resolved === "string" && /^https?:\/\//.test(resolved);
  const isImage = isImageFile(resolved) || isHttpUrl;
  if (isImage || isDataUrl) {
    return `<img src="${resolved}" style="width:25px;height:25px;margin-right:6px;vertical-align:middle;object-fit:contain;" />`;
  }
  if (typeof resolved === "string" && resolved.length > 0) {
    const cls = resolved.startsWith("fa") ? resolved : `fa ${resolved}`;
    const clr = color ?? "white";
    return `<i class="${cls}" style="color:${clr};margin-right:6px;font-size:25px;vertical-align:middle;"></i>`;
  }
  return "";
}

export function buildWindowHeader(title, iconValue = null, color = null, externalUrl = null) {
  const iconHtml = buildWindowIconHtml(iconValue, color);
  const controlsHtml = os.window.getWindowControls(externalUrl);
  return `<div class="window-header"><span>${iconHtml}${title}</span>${controlsHtml}</div>`;
}
