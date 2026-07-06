export const WALLPAPER_STATIC_DIR = "/static/wallpapers/";

const WALLPAPERS = [
  { name: "Mint Theme", filename: "mint.webp" },
  { name: "Red Windows 10", filename: "redwin10.jpg" },
  { name: "Yuki Gradient 1", filename: "wallpaper1.webp" },
  { name: "Yuki Gradient 2", filename: "wallpaper2.webp" },
  { name: "Yuki Gradient 3", filename: "wallpaper3.webp" },
  { name: "Yuki Gradient 4", filename: "wallpaper4.webp" },
  { name: "Yuki Gradient 5", filename: "wallpaper5.webp" },
  { name: "Yuki Gradient 6", filename: "wallpaper6.webp" },
  { name: "Yuki Gradient 7", filename: "wallpaper7.webp" },
  { name: "Yuki Gradient 8", filename: "wallpaper8.webp" },
  { name: "Yuki Gradient 9", filename: "wallpaper9.webp" },
  { name: "Yuki Gradient 10", filename: "wallpaper10.webp" },
  { name: "Yuki Gradient 11", filename: "wallpaper11.webp" },
  { name: "Yuki Gradient 12", filename: "wallpaper12.png" },
  { name: "Yuki Gradient 13", filename: "wallpaper13.png" },
  { name: "Windows 7", filename: "win7.webp" },
  { name: "Windows 10", filename: "win10.webp" },
  { name: "Windows 11", filename: "win11.webp" },
  { name: "Windows 11 Dark", filename: "win11dark.webp" },
  { name: "Windows XP", filename: "xp.webp" }
];

export function getWallpaperFullPaths() {
  return WALLPAPERS.map((w) => `${WALLPAPER_STATIC_DIR}${w.filename}`);
}

export function getWallpaperFilenames() {
  return WALLPAPERS.map((w) => w.filename);
}

export function getWallpaperNameUrlPairs() {
  return WALLPAPERS.map((w) => ({
    name: w.name,
    url: `${WALLPAPER_STATIC_DIR}${w.filename}`
  }));
}

export const STATIC_FALLBACK_WALLPAPERS = getWallpaperFullPaths();
export const DEFAULT_WALLPAPER_FILES = getWallpaperFilenames();
export const WALLPAPER_NAME_URL_PAIRS = getWallpaperNameUrlPairs();
