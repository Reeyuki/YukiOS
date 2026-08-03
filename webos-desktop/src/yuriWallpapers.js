const WEB_WALLPAPERS = [
  {
    name: "Sakura Trick - Umbrella",
    url: "https://w.wallhaven.cc/full/3l/wallhaven-3l56lv.png"
  },
  {
    name: "Bocchi - Train Kiss",
    url: "https://w.wallhaven.cc/full/1p/wallhaven-1pkggg.png"
  },
  {
    name: "Sakura Trick - Rain",
    url: "https://w.wallhaven.cc/full/4o/wallhaven-4oozll.jpg"
  },
  {
    name: "Yuri Wallpaper 1p7661",
    url: "https://w.wallhaven.cc/full/1p/wallhaven-1p7661.png"
  },
  {
    name: "Yuri Wallpaper vgox78",
    url: "https://w.wallhaven.cc/full/vg/wallhaven-vgox78.jpg"
  },
  {
    name: "Yuri Wallpaper 73825o",
    url: "https://w.wallhaven.cc/full/73/wallhaven-73825o.png"
  }
];

export function getYuriWallpapers() {
  return [...WEB_WALLPAPERS];
}

export function getYuriWallpaperUrls() {
  return getYuriWallpapers().map((w) => w.url);
}