export function detectOS() {
  const platform = navigator.platform.toLowerCase();
  const ua = navigator.userAgent.toLowerCase();
  if (platform.includes("win")) return "windows";
  if (platform.includes("mac") || ua.includes("macintosh") || ua.includes("mac os")) return "mac";
  if (platform.includes("linux")) return "linux";
  if (/android|iphone|ipad|ipod/.test(ua)) return "mobile";
  return "windows";
}

export function isMobile() {
  return window.matchMedia("(max-width: 768px)").matches;
}

export function getBrowser() {
  const ua = navigator.userAgent;
  let name = "Unknown";
  if (ua.includes("Edg/")) {
    name = "Microsoft Edge";
  } else if (ua.includes("OPR/") || ua.includes("Opera")) {
    name = "Opera";
  } else if (ua.includes("Chrome/") && !ua.includes("Edg/")) {
    name = "Google Chrome";
  } else if (ua.includes("Safari/") && !ua.includes("Chrome/")) {
    name = "Safari";
  } else if (ua.includes("Firefox/")) {
    name = "Mozilla Firefox";
  }
  return name;
}
