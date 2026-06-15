import { SYSTEM_APPS } from "../AppRegistryConfig.js";
import { resolveIconUrl } from "../shared/assetResolver.js";

export function resolveDesktopIcon(content, fileName = null) {
  let icon = null;

  if (content) {
    try {
      const parsed = typeof content === "string" ? JSON.parse(content) : content;
      if (parsed) {
        if (parsed.type === "youtube-embed") {
          icon = resolveIconUrl("static/icons/youtube.webp");
        } else {
          icon = parsed.icon || parsed.path || SYSTEM_APPS[parsed.app]?.icon;
        }
      }
    } catch (e) {}
  }

  if (!icon && fileName && typeof document !== "undefined") {
    const label = fileName.replace(".desktop", "");
    const desktopIcons = Array.from(document.querySelectorAll(".icon.selectable:not(.desktop-file-icon)"));
    const match = desktopIcons.find((i) => {
      const div = i.querySelector("div");
      return div && div.textContent.trim() === label;
    });

    if (match) {
      const img = match.querySelector("img");
      const fa = match.querySelector("i");
      if (img) icon = img.getAttribute("src");
      else if (fa) icon = Array.from(fa.classList).join(" ");
    }
  }

  if (!icon) {
    return resolveIconUrl("static/icons/file.webp");
  }

  if (
    typeof icon === "string" &&
    (icon.startsWith("fa") ||
      icon.includes(" fa-") ||
      icon.startsWith("fas ") ||
      icon.startsWith("fab ") ||
      icon.startsWith("far "))
  ) {
    return icon;
  }

  if (icon.startsWith("http") || icon.startsWith("static/") || icon.startsWith("/")) {
    return icon;
  }

  return resolveIconUrl(icon);
}
