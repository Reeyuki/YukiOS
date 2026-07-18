export const WALLPAPER_STATIC_DIR = "/static/wallpapers/";
export const MAC_WALLPAPER_DIR = "/static/wallpapers/mac-wallpapers/";

const MAC_WALLPAPERS = [
  { name: "Adwaita Lock", filename: "adwaitalock.webp" },
  { name: "Amber Dark", filename: "amberd.webp" },
  { name: "Amber Light", filename: "amberl.webp" },
  { name: "Beach Rock", filename: "beachrockmacosmojavemountainskx.webp" },
  { name: "Blobs Dark", filename: "blobsd.webp" },
  { name: "Drool Dark", filename: "droold.webp" },
  { name: "El Capitan", filename: "elcapitanyosemitinationalparkmountainsosxelcapitanx.webp" },
  { name: "Grid Dark", filename: "gridd.webp" },
  { name: "Lib Adwaita Light", filename: "libadwaital.webp" },
  { name: "MacBook Pro Abstract", filename: "macbookpromapplemacbookprostockabstractbackgroundx.webp" },
  { name: "macOS Big Sur", filename: "macosbigsurapplelayersfluidiccolorfulwwdcstockx.webp" },
  { name: "macOS Mojave", filename: "macosmojavex.webp" },
  { name: "macOS Monterey Dark", filename: "macosmontereywwdcstockdarkmodekx.webp" },
  { name: "macOS Monterey", filename: "macosmontereywwdcstockkx.webp" },
  { name: "macOS Sequoia", filename: "macossequoiax.webp" },
  { name: "macOS Sierra", filename: "macossierramountainpeaksunseteveningstockkx.webp" },
  { name: "macOS Catalina", filename: "macossurrealdigitalcompositionmacoscatalinamacoshighx.webp" },
  { name: "macOS Tahoe", filename: "macostahoex.webp" },
  { name: "macOS Ventura Dark", filename: "macosventuramacosmacosstockdarkmodekretinax.webp" },
  { name: "Mountain Forest", filename: "macosxmountainsforesthillsfoggymorningstockkx.webp" },
  { name: "OS X Leopard Stock", filename: "osxleopardstockx.webp" },
  { name: "OS X Leopard", filename: "osxleopardx.webp" },
  { name: "OS X Lion Twilight", filename: "osxliontwilightx.webp" },
  { name: "OS X Yosemite", filename: "yosemite.webp" },
  { name: "Pills Dark", filename: "pillsd.webp" },
  { name: "Pixel Pusher Dark", filename: "pixelpusherd.webp" },
  { name: "Wallpaper", filename: "wp.webp" }
];

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

export const MAC_WALLPAPER_NAME_URL_PAIRS = MAC_WALLPAPERS.map((w) => ({
  name: w.name,
  url: `${MAC_WALLPAPER_DIR}${w.filename}`
}));
