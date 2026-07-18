import {
  isImageFile,
  buildFileIconHTML,
  openFileWith,
  readFileAsDataURL,
  generateThumbnail,
  resolveFileIcon
} from "../fileDisplay.js";
import { FileKind } from "../shared/fileKindDetector.js";

import { resolveIconUrl } from "../shared/assetResolver.js";
import { resolveDesktopIcon } from "../shared/iconUtils.js";
import { scheduleFileTooltip, scheduleAppTooltip, hideFileTooltip } from "../shared/fileTooltip.js";
import { BusEvents } from "../core/EventBus.js";
import { Achievements } from "../achievements.js";
import { makeDraggable } from "../shared/dragUtils.js";

import { $, $$, createElement, setHTML, setText, setStyle } from "../shared/domUtils.js";
import { StorageKeys, os } from "../framework.js";

const HARDCODED_DESKTOP_ICONS = [
  { app: "explorerApp", name: "Files", icon: "static/icons/file.webp" },
  { app: "steamApp", name: "Steam", icon: "static/icons/steam.webp" },
  { app: "seaSweeper", name: "Sea Sweeper: Idle Fisher", icon: "static/icons/seaSweeper.webp" },
  { app: "discordApp", name: "Discord", icon: "fab fa-discord", isFa: true },
  { app: "browserApp", name: "Browser", icon: resolveIconUrl("static/icons/firefox.webp") },
  { app: "systemAppsApp", name: "System Apps", icon: "fas fa-tools", isFa: true },
  { app: "notepadApp", name: "Notepad", icon: "static/icons/notepad.webp" },
  { app: "shittifyApp", name: "Evil Spotify", icon: "static/icons/shittify.webp" }
];

export class IconManager {
  constructor(
    desktop,
    fs,
    positionHelper,
    positionStore,
    selectionManager,
    notepadApp,
    explorerApp,
    appLauncher,
    jsDosApp,
    dragDropManager
  ) {
    this.desktop = desktop;
    this.fs = fs;
    this.positionHelper = positionHelper;
    this.positionStore = positionStore;
    this.selectionManager = selectionManager;
    this.notepadApp = notepadApp;
    this.explorerApp = explorerApp;
    this.appLauncher = appLauncher;
    this.jsDosApp = jsDosApp;
    this.dragDropManager = dragDropManager;
  }

  makeIconInteractable(icon, ignoreDrag = false) {
    icon.draggable = false;
    setStyle(icon, { userSelect: "none", webkitUserDrag: "none", cursor: "default" });
    if (!ignoreDrag) this.setupInteractDrag(icon);
    this.attachIconEvents(icon);
  }

  attachIconEvents(icon) {
    icon.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      if (icon.classList.contains("folder-icon")) {
        this.openFolder(icon.dataset.folderName);
      } else if (icon.dataset.app) {
        os.storage.set(StorageKeys.launchTimePrefix + icon.dataset.app, Date.now());
        const extra = icon.dataset.steamGameId ? { steamGameId: icon.dataset.steamGameId } : null;
        os.app.launch(icon.dataset.app, false, extra);
      } else if (icon.dataset.fileName) {
        this.openDesktopFile(icon.dataset.fileName);
      }
    });
    icon.addEventListener("mousedown", (e) => this.handleIconSelection(icon, e.ctrlKey));
    icon.addEventListener("mouseenter", (e) => {
      const isFolder = icon.classList.contains("folder-icon");
      const dirPath = ["Desktop"];
      const name = isFolder ? icon.dataset.folderName : icon.dataset.fileName;
      if (name) {
        scheduleFileTooltip(e, dirPath, name, isFolder);
      } else if (icon.dataset.app) {
        const titleEl = icon.querySelector("div:last-child");
        const title = titleEl ? titleEl.textContent.trim() : icon.dataset.app;
        scheduleAppTooltip(e, title);
      }
    });
    icon.addEventListener("mouseleave", () => hideFileTooltip());
  }

  async openFolder(folderName) {
    this.explorerApp.open(["Desktop", folderName]);
  }

  handleIconSelection(icon, isCtrlKey) {
    if (!isCtrlKey) {
      if (!this.selectionManager.has(icon)) {
        this.selectionManager.clear();
        this.selectionManager.add(icon);
      }
    } else {
      this.selectionManager.toggle(icon);
    }
    if (
      this.dragDropManager &&
      this.dragDropManager.desktop &&
      this.dragDropManager.desktop.lastFocusedContext !== undefined
    ) {
      this.dragDropManager.desktop.lastFocusedContext = "desktop";
    }
    $$(".icon.selectable").forEach((i) => {
      if (!this.selectionManager.has(i)) {
        setStyle(i, { zIndex: "", opacity: "", cursor: "" });
      }
    });
  }

  setupInteractDrag(icon) {
    const restrictToDesktop = {
      top: 0,
      left: 0,
      bottom: 0,
      right: 0
    };

    if (!this.dragDropManager) {
      return makeDraggable(icon, {
        start: () => this.dragStart(),
        move: (e, dx, dy) => this.dragMove(dx, dy),
        end: () => this.dragEnd()
      });
    }
    return makeDraggable(icon, {
      start: (e) => {
        this.dragStartEvent = e;
        this.dragDropManager.onDragStart();
      },
      move: (e, dx, dy, clientX, clientY) => {
        this.dragDropManager.onDragMove({ dx, dy, clientX, clientY });
      },
      end: () => this.dragDropManager.onDragEnd()
    });
  }

  dragStart() {
    this.selectionManager.forEach((icon) => setStyle(icon, { opacity: "0.7", zIndex: "1200", cursor: "move" }));
  }

  dragMove(dx, dy) {
    this.selectionManager.forEach((icon) => {
      this.positionHelper.setPosition(
        icon,
        Math.max(0, (parseFloat(icon.style.left) || 0) + dx),
        Math.max(0, (parseFloat(icon.style.top) || 0) + dy)
      );
    });
  }

  dragEnd() {
    this.selectionManager.forEach((icon) => {
      this.positionHelper.snap(icon);
      setStyle(icon, { opacity: "1", zIndex: "1", cursor: "default" });
      const { col, row } = this.positionHelper.pixelsToCell(
        parseFloat(icon.style.left) || 0,
        parseFloat(icon.style.top) || 0
      );
      const saved = this.positionStore.load();
      saved[this.positionStore.getKey(icon)] = { col, row };
      this.positionStore.save(saved);
    });
  }

  async createFolderIcon(folderName) {
    if ($(`.folder-icon[data-folder-name="${CSS.escape(folderName)}"]`)) return;
    const folderIcon = createElement("div", { className: "icon selectable folder-icon" });
    folderIcon.dataset.folderName = folderName;
    setHTML(folderIcon, `<img src="${resolveIconUrl("static/icons/file.webp")}"><div>${folderName}</div>`);
    const saved = this.positionStore.load();
    const key = this.positionStore.getKey(folderIcon);
    if (saved[key]) this.positionHelper.placeAtCell(folderIcon, saved[key].col, saved[key].row, folderIcon);
    else this.positionHelper.snap(folderIcon);
    this.desktop.appendChild(folderIcon);
    this.makeIconInteractable(folderIcon);
    return folderIcon;
  }

  async createDesktopFileIcon(fileName, itemData = null) {
    if ($(`.desktop-file-icon[data-file-name="${CSS.escape(fileName)}"]`)) return;

    const displayName = fileName.endsWith(".desktop") ? fileName.slice(0, -8) : fileName;
    const placeholderIcon = resolveFileIcon(fileName);

    const iconHTML = buildFileIconHTML(fileName, {
      thumbnailSrc: placeholderIcon,
      size: 64,
      radius: 12,
      storedIcon: placeholderIcon
    });
    const icon = createElement("div", { className: "icon selectable desktop-file-icon" });
    icon.dataset.fileName = fileName;
    icon.dataset.filePath = "Desktop";
    setHTML(icon, `${iconHTML}<div>${displayName}</div>`);

    const saved = this.positionStore.load();
    const key = this.positionStore.getKey(icon);
    if (saved[key]) this.positionHelper.placeAtCell(icon, saved[key].col, saved[key].row, icon);
    else this.positionHelper.snap(icon);
    this.desktop.appendChild(icon);
    this.makeIconInteractable(icon);

    if (fileName.endsWith(".desktop")) {
      this.fs.getFileContent(["Desktop"], fileName).then((raw) => {
        try {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.app) icon.dataset.app = parsed.app;
          if (parsed && parsed.steamGameId) icon.dataset.steamGameId = parsed.steamGameId;
          const iconPath = resolveDesktopIcon(raw, fileName);
          if (iconPath && iconPath !== placeholderIcon) {
            const isFa = iconPath.startsWith("fa") || iconPath.includes(" fa-");
            if (isFa) {
              icon.firstElementChild?.replaceWith(
                (() => {
                  const el = createElement("div", {
                    className: "desktop-file-icon--fa-wrapper",
                    html: `<i class="${iconPath}"></i>`
                  });
                  return el;
                })()
              );
            } else {
              const imgElement = $("img", icon);
              if (imgElement) imgElement.src = iconPath;
            }
          }
        } catch (e) {}
      });
    } else {
      const loadThumbnail = async () => {
        let thumbnailSrc = itemData?.icon;
        if (isImageFile(fileName)) {
          try {
            const cacheKey = "Desktop/" + fileName;
            thumbnailSrc = this.thumbnailCache?.get(cacheKey);
            if (!thumbnailSrc) {
              const content = await this.fs.getFileContent(["Desktop"], fileName);
              const src = content instanceof Blob ? await readFileAsDataURL(content) : content;
              thumbnailSrc = await generateThumbnail(src);
              if (thumbnailSrc) {
                (this.thumbnailCache ??= new Map()).set(cacheKey, thumbnailSrc);
              }
            }
          } catch (e) {
            console.error("Failed to load image thumbnail:", e);
          }
        }
        if (thumbnailSrc && thumbnailSrc !== placeholderIcon) {
          const imgElement = $("img", icon);
          if (imgElement) imgElement.src = thumbnailSrc;
        }
      };
      loadThumbnail();
    }

    return icon;
  }

  async openDesktopFile(fileName) {
    if (fileName.endsWith(".desktop")) {
      try {
        const raw = await this.fs.getFileContent(["Desktop"], fileName);
        const content = JSON.parse(raw);
        if (content && content.app) {
          os.app.launch(content.app);
          return;
        } else if (content && content.type === "youtube-embed") {
          this.openYouTubeEmbedDesktop(content);
          return;
        }
      } catch (e) {
        console.error("Failed to parse desktop file JSON:", e);
      }
    }
    await openFileWith({
      name: fileName,
      path: ["Desktop"],
      fs: this.fs,
      notepadApp: this.notepadApp,
      browserApp: this.appLauncher.browserApp,
      windowManager: this.appLauncher.wm,
      officeApp: this.appLauncher.officeApp,
      markdownApp: this.appLauncher.markdownApp,
      jsDosApp: this.jsDosApp,
      appLauncher: this.appLauncher
    });
  }

  openYouTubeEmbedDesktop(content) {
    const winId = `yt-embed-${Date.now()}`;
    const win = os.window.create(winId, content.name || "YouTube Embed", "800px", "600px");

    const base = content.nocookie ? "https://www.youtube-nocookie.com" : "https://www.youtube.com";
    const params = new URLSearchParams();
    if (content.autoplay) params.set("autoplay", "1");
    if (!content.controls) params.set("controls", "0");
    if (content.mute && content.autoplay) params.set("mute", "1");
    if (content.startSeconds > 0) params.set("start", String(content.startSeconds));
    if (content.endSeconds > 0) params.set("end", String(content.endSeconds));
    if (content.loop) params.set("loop", "1");
    params.set("rel", "0");

    let embedUrl;
    if (content.kind === "playlist" && content.playlistId) {
      params.set("list", content.playlistId);
      embedUrl = `${base}/embed/videoseries?${params.toString()}`;
    } else if (content.kind === "video" && content.videoId) {
      if (content.loop) params.set("playlist", content.videoId);
      embedUrl = `${base}/embed/${encodeURIComponent(content.videoId)}?${params.toString()}`;
    } else {
      os.notify.send("Invalid YouTube embed data", "Missing videoId or playlistId");
      return;
    }

    win.innerHTML = `
      <div class="window-header">
        <span>${content.name || "YouTube Embed"}</span>
        ${os.window.getWindowControls()}
      </div>
      <div class="window-content" style="width:100%; height:100%; overflow:hidden; display:flex; align-items:center; justify-content:center; background:#000;">
        <iframe src="${embedUrl}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" style="width:100%; height:100%; border:none;"></iframe>
      </div>
    `;
  }

  async editDesktopFileWithNotepad(fileName) {
    try {
      const content = await this.fs.getFileContent(["Desktop"], fileName);
      this.notepadApp.open(fileName, content, ["Desktop"]);
    } catch (e) {
      console.error("Failed to open desktop file in Notepad:", e);
      os.notify.send(`Could not open "${fileName}"`);
    }
  }

  async saveToWallpapers(name, content, kind, icon) {
    os.events.emit(BusEvents.ACHIEVEMENT_TRIGGER, { achievementId: Achievements.PersonalSpace });

    const wallpapersPath = ["Pictures", "Wallpapers"];
    await os.fs.mkdir(wallpapersPath);
    const safeIcon = kind === FileKind.IMAGE ? "@content" : icon || resolveIconUrl("static/icons/file.webp");
    await os.fs.write([...wallpapersPath, name], content, { kind, icon: safeIcon });
  }

  addFiles() {
    const input = createElement("input", { attributes: { type: "file", multiple: "true" } });
    input.addEventListener("change", async () => {
      const files = Array.from(input.files);
      if (!files.length) return;
      await this.explorerApp.handleFileUpload(files, false, null, null);
      $$(".folder-icon, .desktop-file-icon").forEach((i) => i.remove());
      await this.loadDesktopItems();
    });
    input.click();
  }

  async initializeDesktopFiles(sharedAppLauncher, isRightAlignedSystemApp) {
    const hideDesktopIcons = os.storage.get(StorageKeys.hideDesktopIcons) === "true";
    if (hideDesktopIcons) return;

    await os.fs.mkdir(["Desktop"]);
    const saved = this.positionStore.load();

    const fragment = document.createDocumentFragment();
    const regularIcons = [];
    const systemIcons = [];
    const createdIcons = [];

    const isMacMode = os.storage.get(StorageKeys.macOsControls) === "true";

    for (const def of HARDCODED_DESKTOP_ICONS) {
      const icon = createElement("div", { className: "icon selectable" });
      icon.dataset.app = def.app;

      if (def.isFa) {
        const i = createElement("i", { className: def.icon });
        icon.appendChild(i);
      } else {
        const img = createElement("img", { attributes: { src: resolveIconUrl(def.icon) } });
        icon.appendChild(img);
      }

      const label = createElement("div", { text: def.name });
      icon.appendChild(label);

      const fileName = `${def.name}.desktop`;
      await os.fs.write(["Desktop", fileName], JSON.stringify({ app: def.app, name: def.name, path: def.icon }));
      icon.dataset.fileName = fileName;

      const key = this.positionStore.getKey(icon);
      if (saved[key]) {
        this.positionHelper.placeAtCell(icon, saved[key].col, saved[key].row, icon);
      } else if (isRightAlignedSystemApp(sharedAppLauncher.appMap, def.app)) {
        systemIcons.push(icon);
      } else {
        regularIcons.push(icon);
      }

      fragment.appendChild(icon);
      createdIcons.push(icon);
    }

    let occupied = null;
    if (regularIcons.length) {
      if (isMacMode) {
        occupied = this.positionHelper.layoutMacVerticalSync(regularIcons, occupied);
      } else {
        occupied = this.positionHelper.layoutSync(regularIcons, false, occupied);
      }
    }
    if (systemIcons.length) this.positionHelper.layoutRightSync(systemIcons, occupied);

    this.desktop.appendChild(fragment);
    createdIcons.forEach((icon) => this.makeIconInteractable(icon));

    await this.loadDesktopItems();
  }

  async loadDesktopItems() {
    const hideDesktopIcons = os.storage.get(StorageKeys.hideDesktopIcons) === "true";
    if (hideDesktopIcons) return;

    const desktopFolder = await os.fs.readdir(["Desktop"]);
    for (const [name, itemData] of Object.entries(desktopFolder)) {
      if (!itemData.type) {
        this.createFolderIcon(name);
      } else if (itemData.type === "file") {
        if (name.endsWith(".desktop")) {
          const label = name.replace(".desktop", "");
          const isHardcoded = $$(".icon.selectable:not(.desktop-file-icon)").some(
            (i) => $("div, span", i)?.textContent?.trim() === label
          );

          if (isHardcoded) continue;
        }
        this.createDesktopFileIcon(name, itemData);
      }
    }
  }
}
