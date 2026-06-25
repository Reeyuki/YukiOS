import { os } from "../os/index.js";
import { resolveIconUrl } from "./assetResolver.js";

export async function resolveAvatarUrl(avatar, fallback = "static/icons/guest.webp") {
  if (!avatar) return resolveIconUrl(fallback);
  if (avatar.startsWith("fs://")) {
    const filePath = avatar.replace("fs://", "");
    const parts = filePath.split("/");
    const name = parts.pop();
    const path = parts;
    try {
      const blob = await os.fs.readBinaryFile(path, name);
      if (blob) {
        return URL.createObjectURL(blob);
      }
    } catch (e) {
      console.warn("Failed to load avatar from filesystem:", e);
    }
    return resolveIconUrl(fallback);
  }
  if (!/^https?:\/\//.test(avatar) && !avatar.startsWith("blob:") && !avatar.startsWith("data:")) {
    return resolveIconUrl(avatar);
  }
  return avatar;
}
