export const RESOLUTION_PRESETS = [
  { value: "native", label: "Native (Use Actual Display)" },
  { value: "640x480", label: "640 × 480 (4:3)" },
  { value: "800x600", label: "800 × 600 (4:3)" },
  { value: "1024x768", label: "1024 × 768 (4:3)" },
  { value: "1280x720", label: "1280 × 720 (16:9)" },
  { value: "1280x800", label: "1280 × 800 (16:10)" },
  { value: "1280x1024", label: "1280 × 1024 (5:4)" },
  { value: "1360x768", label: "1360 × 768 (16:9)" },
  { value: "1366x768", label: "1366 × 768 (16:9)" },
  { value: "1440x900", label: "1440 × 900 (16:10)" },
  { value: "1536x864", label: "1536 × 864 (16:9)" },
  { value: "1600x900", label: "1600 × 900 (16:9)" },
  { value: "1680x1050", label: "1680 × 1050 (16:10)" },
  { value: "1920x1080", label: "1920 × 1080 (16:9)" },
  { value: "1920x1200", label: "1920 × 1200 (16:10)" },
  { value: "2048x1152", label: "2048 × 1152 (16:9)" },
  { value: "2560x1080", label: "2560 × 1080 (21:9)" },
  { value: "2560x1440", label: "2560 × 1440 (16:9)" },
  { value: "2560x1600", label: "2560 × 1600 (16:10)" },
  { value: "3440x1440", label: "3440 × 1440 (21:9)" },
  { value: "3840x2160", label: "3840 × 2160 (16:9)" }
];

export function getResolutionLabel(value) {
  const preset = RESOLUTION_PRESETS.find(p => p.value === value);
  return preset ? preset.label : "Native (Use Actual Display)";
}

function parseResolution(value) {
  if (value === "native" || !value) return null;
  const parts = value.split("x");
  const w = parseInt(parts[0]);
  const h = parseInt(parts[1]);
  if (isNaN(w) || isNaN(h)) return null;
  return { width: w, height: h };
}

export function getViewportLabel() {
  return `${window.innerWidth} × ${window.innerHeight}`;
}

export function applyResolution(value, guiScale) {
  const parsed = parseResolution(value);
  const guiFactor = (guiScale || 100) / 100;

  let totalScale;
  if (parsed) {
    const scaleX = window.innerWidth / parsed.width;
    const scaleY = window.innerHeight / parsed.height;
    const resScale = Math.min(scaleX, scaleY);
    totalScale = resScale * guiFactor;
  } else {
    totalScale = guiFactor;
  }

  document.documentElement.style.setProperty("--gui-scale", String(totalScale));
  document.documentElement.style.transform = `scale(${totalScale})`;
  document.documentElement.style.transformOrigin = "top left";
  document.documentElement.style.width = `${100 / totalScale}%`;
  document.documentElement.style.height = `${100 / totalScale}%`;

  fixWallpaperLayer(totalScale);
}

function fixWallpaperLayer(totalScale) {
  const styleId = "yukios-resolution-wallpaper-fix";
  const existing = document.getElementById(styleId);
  if (totalScale === 1) {
    existing?.remove();
    return;
  }
  const inv = 1 / totalScale;
  const css = `
#wallpaper-img, #wallpaper-video, #vanta-container {
  top: 0 !important;
  left: 0 !important;
  width: 100vw !important;
  height: 100vh !important;
  transform: scale(${inv}) !important;
  transform-origin: 0 0 !important;
}
  `;
  if (existing) {
    existing.textContent = css;
  } else {
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = css;
    document.head.appendChild(style);
  }
}
