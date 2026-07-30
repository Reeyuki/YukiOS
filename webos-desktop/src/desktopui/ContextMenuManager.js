import { $, $$, createElement } from "../shared/domUtils.js";
import { showContextMenu, showDynamicContextMenu, hideMenu } from "../shared/contextMenu.js";
import { sortDesktopIcons, relayoutDesktopIcons, changeDesktopIconSize } from "./desktopui.js";
import { os, StorageKeys } from "../framework.js";
import { ArchiveExtractor } from "../archiveExtractor.js";
import { AppSource } from "../AppSource.js";
import { showFileProperties, isImageFile } from "../fileDisplay.js";
import { FileKind } from "../shared/fileKindDetector.js";

import {
  buildCopyAction,
  buildCutAction,
  buildDeleteAction,
  buildRenameAction,
  buildPropertiesAction
} from "./contextActions.js";
import { openFileConverter } from "../utils/fileConverter.js";
import { SystemUtilities } from "../system.js";
import { videos } from "../wallpaperList.js";
import { vantaPresets } from "../vantaPresets.js";
import { downloadBlob } from "../settings/settingsData.js";

export class DesktopContextMenuManager {
  constructor(desktopUI, PositionStore, IconDataHelper, wm) {
    this.desktopUI = desktopUI;
    this.PositionStore = PositionStore;
    this.IconDataHelper = IconDataHelper;
    this.wm = wm;
    this.desktop = $("#desktop");
    this.archiveExtractor = new ArchiveExtractor(
      desktopUI.fs,
      (msg) => os.notify.send(msg),
      AppSource.ARCHIVE_EXTRACTOR
    );
    this.templates = {
      iconContextMenu: [
        { id: "ctx-open", label: "Open", action: "open", icon: "fa-external-link-alt" },
        "hr",
        { id: "ctx-copy", label: "Copy", action: "copy", icon: "fa-copy" },
        { id: "ctx-cut", label: "Cut", action: "cut", icon: "fa-cut" },
        "hr",
        {
          id: "ctx-paste-icon",
          label: "Paste",
          action: "paste",
          condition: () => !!this.desktopUI.getClipboard(),
          icon: "fa-paste"
        },
        "hr",
        { id: "ctx-delete", label: "Move to Trash", action: "delete", icon: "fa-trash-alt" },
        { id: "ctx-rename", label: "Rename", action: "rename", icon: "fa-edit" },
        { id: "ctx-properties", label: "Properties", action: "properties", icon: "fa-info-circle" }
      ],
      folderContextMenu: [
        { id: "ctx-open-folder", label: "Open", action: "openFolder", icon: "fa-folder-open" },
        "hr",
        { id: "ctx-add-archive-folder", label: "Add to archive", action: "addArchiveFolder", icon: "fa-file-archive" },
        { id: "ctx-download-folder", label: "Download", action: "downloadFolder", icon: "fa-download" },
        "hr",
        { id: "ctx-copy-folder", label: "Copy", action: "copyFolder", icon: "fa-copy" },
        { id: "ctx-cut-folder", label: "Cut", action: "cutFolder", icon: "fa-cut" },
        "hr",
        {
          id: "ctx-paste-folder",
          label: "Paste",
          action: "paste",
          condition: () => !!this.desktopUI.getClipboard(),
          icon: "fa-paste"
        },
        "hr",
        { id: "ctx-delete-folder", label: "Move to Trash", action: "deleteFolder", icon: "fa-trash-alt" },
        { id: "ctx-rename-folder", label: "Rename", action: "renameFolder", icon: "fa-edit" },
        "hr",
        { id: "ctx-properties-folder", label: "Properties", action: "propertiesFolder", icon: "fa-info-circle" }
      ],
      fileIconContextMenu: [
        { id: "ctx-open-file", label: "Open", action: "openFile", icon: "fa-file-alt" },
        "hr",
        { id: "ctx-add-archive-file", label: "Add to archive", action: "addArchiveFile", icon: "fa-file-archive" },
        { id: "ctx-download-file", label: "Download", action: "downloadFile", icon: "fa-download" },
        "hr",
        { id: "ctx-copy-file", label: "Copy", action: "copyFile", icon: "fa-copy" },
        { id: "ctx-cut-file", label: "Cut", action: "cutFile", icon: "fa-cut" },
        "hr",
        {
          id: "ctx-paste-file",
          label: "Paste",
          action: "paste",
          condition: () => !!this.desktopUI.getClipboard(),
          icon: "fa-paste"
        },
        "hr",
        { id: "ctx-delete-file", label: "Move to Trash", action: "deleteFile", icon: "fa-trash-alt" },
        { id: "ctx-rename-file", label: "Rename", action: "renameFile", icon: "fa-edit" },
        "hr",
        { id: "ctx-properties-file", label: "Properties", action: "propertiesFile", icon: "fa-info-circle" }
      ],
      desktopContextMenu: [
        { id: "ctx-new", label: "New", action: "new", icon: "fa-plus" },
        "hr",
        { id: "ctx-add-files", label: "Add file(s)", action: "addFiles", icon: "fa-file-upload" },
        { id: "ctx-open-explorer", label: "Open File Explorer", action: "openExplorer", icon: "fa-folder-open" },
        { id: "ctx-start-recording", label: "Start Recording", action: "startRecording", icon: "fa-circle" },
        { id: "ctx-set-wallpaper", label: "Customize", action: "setWallpaper", icon: "fa-paint-brush" },
        { id: "ctx-background", label: "Background", action: "background", icon: "fa-image" },
        { id: "ctx-open-terminal", label: "Open Terminal Here", action: "openTerminal", icon: "fa-terminal" },
        "hr",
        {
          id: "ctx-paste",
          label: "Paste",
          action: "paste",
          condition: () => !!this.desktopUI.getClipboard(),
          icon: "fa-paste"
        },
        "hr",
        { id: "ctx-view", label: "View", icon: "fa-eye", action: "view" },
        { id: "ctx-sort", label: "Sort icons", icon: "fa-sort", action: "sort" },
        "hr",
        { id: "ctx-widgets", label: "Widgets", action: "widgets", icon: "fa-puzzle-piece" },
        { id: "ctx-fullscreen", label: "Enter fullscreen", icon: "fa-expand", action: "fullscreen" },
        "hr",
        { id: "ctx-refresh", label: "Refresh", action: "refresh", icon: "fa-sync-alt" }
      ]
    };
  }

  handleContextMenu(e) {
    if (e.target.closest(".desktop-file-icon")) {
      e.preventDefault();
      this.showFileIconContextMenu(e, e.target.closest(".desktop-file-icon"));
    } else if (e.target.classList.contains("folder-icon")) {
      e.preventDefault();
      this.showFolderContextMenu(e, e.target);
    } else if (e.target.classList.contains("selectable")) {
      e.preventDefault();
      this.showIconContextMenu(e, e.target);
    } else if (e.target === this.desktop) {
      e.preventDefault();
      this.showDesktopContextMenu(e);
    }
  }

  showFolderContextMenu(e, folderIcon) {
    if (!this.desktopUI.selectionManager.has(folderIcon)) {
      this.desktopUI.selectionManager.clear();
      this.desktopUI.selectionManager.add(folderIcon);
    }
    const selectedArray = this.desktopUI.selectionManager.toArray();
    const folderName = folderIcon.dataset.folderName;

    showContextMenu(e, this.templates.folderContextMenu, {
      openFolder: () => this.desktopUI.openFolder(folderName),
      addArchiveFolder: async () => {
        await this.addToArchive(["Desktop", folderName], folderName);
      },
      downloadFolder: async () => {
        await this.downloadItem(["Desktop", folderName], folderName, true);
      },
      propertiesFolder: buildPropertiesAction(folderIcon, this.desktopUI),
      copyFolder: buildCopyAction(selectedArray, this.desktopUI),
      cutFolder: buildCutAction(selectedArray, this.desktopUI),
      paste: async () => {
        await this.desktopUI.pasteToDesktop();
      },
      deleteFolder: buildDeleteAction(selectedArray, this.desktopUI),
      renameFolder: buildRenameAction(folderIcon, this.desktopUI, { PositionStore: this.PositionStore })
    });
  }

  showFileIconContextMenu(e, fileIcon) {
    if (!this.desktopUI.selectionManager.has(fileIcon)) {
      this.desktopUI.selectionManager.clear();
      this.desktopUI.selectionManager.add(fileIcon);
    }
    const selectedArray = this.desktopUI.selectionManager.toArray();
    const fileName = fileIcon.dataset.fileName;
    const filePath = fileIcon.dataset.filePath || "Desktop";

    showDynamicContextMenu(e, async (menu, item, hr) => {
      menu.appendChild(item("Open", () => this.desktopUI.openDesktopFile(fileName), "fa-file-alt"));
      menu.appendChild(
        item(
          "Add to archive",
          async () => {
            await this.addToArchive([filePath, fileName], fileName);
          },
          "fa-file-archive"
        )
      );
      menu.appendChild(
        item(
          "Download",
          async () => {
            await this.downloadItem([filePath, fileName], fileName, false);
          },
          "fa-download"
        )
      );
      menu.appendChild(hr());

      const convertableExtensions = [
        "png",
        "jpg",
        "jpeg",
        "webp",
        "bmp",
        "svg",
        "gif",
        "txt",
        "md",
        "html",
        "json",
        "log",
        "csv",
        "xml",
        "yaml",
        "yml",
        "js",
        "ts",
        "tsx",
        "jsx",
        "css",
        "scss",
        "py",
        "java",
        "cpp",
        "c",
        "h",
        "hpp",
        "go",
        "rs",
        "rb",
        "php",
        "swift",
        "kt",
        "scala",
        "lua",
        "dart",
        "sh",
        "bash",
        "zsh",
        "toml",
        "ini",
        "cfg",
        "conf",
        "env",
        "sql",
        "gradle",
        "makefile",
        "dockerfile"
      ];
      const ext = fileName.split(".").pop().toLowerCase();
      if (convertableExtensions.includes(ext)) {
        menu.appendChild(
          item(
            "Convert / Transform",
            async () => {
              openFileConverter(fileName, [filePath], os, this.desktopUI.appLauncher);
            },
            "fa-exchange-alt"
          )
        );
      }

      menu.appendChild(hr());

      const notEditable = ["mp4", "mp3", "png", "jpg", "gif", "webp", "zip", "exe"];
      const fileExt = fileName.split(".").pop().toLowerCase();
      if (!notEditable.includes(fileExt)) {
        menu.appendChild(
          item(
            "Edit with Notepad",
            async () => {
              await this.desktopUI.editDesktopFileWithNotepad(fileName);
            },
            "fa-pen"
          )
        );
      }

      menu.appendChild(
        item(
          "Edit with Notepad (force)",
          async () => {
            await this.desktopUI.editDesktopFileWithNotepad(fileName);
          },
          "fa-pen"
        )
      );

      if (isImageFile(fileName)) {
        const mimeMap = {
          png: "image/png",
          jpg: "image/jpeg",
          jpeg: "image/jpeg",
          gif: "image/gif",
          webp: "image/webp",
          bmp: "image/bmp",
          svg: "image/svg+xml",
          avif: "image/avif",
          ico: "image/x-icon",
          heic: "image/heic",
          heif: "image/heif",
          tiff: "image/tiff",
          tif: "image/tiff",
          raw: "image/x-raw"
        };
        const ext = fileName.split(".").pop().toLowerCase();
        const mime = mimeMap[ext] || "application/octet-stream";

        const readAsDataUrl = async () => {
          const blob = await os.fs.readBinaryFile(filePath, fileName);
          if (!blob) return null;
          return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        };

        menu.appendChild(
          item(
            "Set as Wallpaper",
            async () => {
              try {
                const dataUrl = await readAsDataUrl();
                await SystemUtilities.setWallpaper(dataUrl);
                os.notify.send(`Wallpaper set to "${fileName}"`);
              } catch (err) {
                console.error("Set wallpaper error:", err);
                os.dialog.alert("Error", "Could not set wallpaper");
              }
            },
            "fa-image"
          )
        );
        menu.appendChild(
          item(
            "Save as Wallpaper",
            async () => {
              try {
                const dataUrl = await readAsDataUrl();
                await this.desktopUI.saveToWallpapers(fileName, dataUrl, FileKind.IMAGE, "@content");
                os.notify.send(`"${fileName}" saved to wallpapers`);
              } catch (err) {
                console.error("Save wallpaper error:", err);
                os.dialog.alert("Error", "Could not save wallpaper");
              }
            },
            "fa-save"
          )
        );
      }

      menu.appendChild(hr());
      menu.appendChild(item("Copy", buildCopyAction(selectedArray, this.desktopUI), "fa-copy"));
      menu.appendChild(item("Cut", buildCutAction(selectedArray, this.desktopUI), "fa-cut"));
      if (this.desktopUI.getClipboard()) {
        menu.appendChild(
          item(
            "Paste",
            async () => {
              await this.desktopUI.pasteToDesktop();
            },
            "fa-paste"
          )
        );
      }
      menu.appendChild(hr());
      menu.appendChild(item("Move to Trash", buildDeleteAction(selectedArray, this.desktopUI), "fa-trash-alt"));
      menu.appendChild(item("Rename", () => this.startInlineDesktopRename(fileIcon), "fa-edit"));
      menu.appendChild(hr());
      menu.appendChild(item("Properties", buildPropertiesAction(fileIcon, this.desktopUI), "fa-info-circle"));
    });
  }

  showIconContextMenu(e, icon) {
    if (!this.desktopUI.selectionManager.has(icon)) {
      this.desktopUI.selectionManager.clear();
      this.desktopUI.selectionManager.add(icon);
    }
    const selectedArray = this.desktopUI.selectionManager.toArray();
    const last = selectedArray[selectedArray.length - 1];
    showContextMenu(e, this.templates.iconContextMenu, {
      open: () => os.app.launch(last.dataset.app),
      copy: buildCopyAction(selectedArray, this.desktopUI),
      cut: buildCutAction(selectedArray, this.desktopUI),
      paste: async () => {
        await this.desktopUI.pasteToDesktop();
      },
      delete: buildDeleteAction(selectedArray, this.desktopUI),
      rename: () => this.startInlineDesktopRename(last),
      properties: buildPropertiesAction(last, this.desktopUI)
    });
  }

  showDesktopContextMenu(e) {
    const currentSort = this.currentSortMode();
    const currentAutoSort = os.storage.get(StorageKeys.desktopAutoSort) || false;

    showDynamicContextMenu(e, (menu, item, hr, submenu) => {
      menu.appendChild(
        submenu(
          "New",
          (sub, sItem, sHr) => {
            sub.appendChild(
              sItem(
                "Folder",
                async () => {
                  await this.spawnInlineDesktopItem(false);
                },
                "fa-folder"
              )
            );
            sub.appendChild(
              sItem(
                "Text",
                async () => {
                  await this.spawnInlineDesktopItem(true);
                },
                "fa-file-alt"
              )
            );
          },
          "fa-plus"
        )
      );

      menu.appendChild(hr());

      menu.appendChild(item("Add file(s)", () => this.desktopUI.addFiles(), "fa-file-upload"));
      menu.appendChild(item("Open File Explorer", () => this.desktopUI.explorerApp.open(), "fa-folder-open"));
      menu.appendChild(item("Start Recording", () => os.app.launch("cameraApp"), "fa-circle"));
      menu.appendChild(
        item(
          "Customize",
          () => {
            os.app.launch("settingsApp", { section: "pane-appearance" });
          },
          "fa-paint-brush"
        )
      );
      menu.appendChild(item("Background", () => this.showBackgroundContextMenu(e), "fa-image"));
      menu.appendChild(
        item(
          "Open Terminal Here",
          () => {
            const username = os.storage.get(StorageKeys.username) || "guest";
            os.app.launch("terminalApp", { initialPath: ["home", username, "Desktop"] });
          },
          "fa-terminal"
        )
      );

      menu.appendChild(hr());

      if (this.desktopUI.getClipboard()) {
        menu.appendChild(
          item(
            "Paste",
            async () => {
              await this.desktopUI.pasteToDesktop();
            },
            "fa-paste"
          )
        );
      }

      menu.appendChild(hr());

      menu.appendChild(
        submenu(
          "View",
          (sub, sItem, sHr) => {
            const currentSize = Number(os.storage.get(StorageKeys.desktopIconSize)) || 48;
            const sizes = [
              { size: 32, label: "Small icons", icon: "fa-th" },
              { size: 64, label: "Medium icons", icon: "fa-th-large" },
              { size: 96, label: "Large icons", icon: "fa-th-list" }
            ];
            sizes.forEach(({ size, label, icon: faIcon }) => {
              const el = sItem(label, () => changeDesktopIconSize(size), faIcon);
              if (currentSize === size) {
                el.style.fontWeight = "700";
                const check = createElement("i");
                check.className = "fas fa-check";
                check.style.marginLeft = "auto";
                check.style.fontSize = "10px";
                el.appendChild(check);
              }
              sub.appendChild(el);
            });

            sub.appendChild(sHr());

            const currentAlignment = os.storage.get(StorageKeys.desktopIconAlignment) || "horizontal";
            const alignLabel = currentAlignment === "vertical" ? "Align Horizontally" : "Align Vertically";
            const alignIcon = currentAlignment === "vertical" ? "fa-arrows-alt-h" : "fa-arrows-alt-v";
            sub.appendChild(
              sItem(
                alignLabel,
                () => {
                  const next = currentAlignment === "vertical" ? "horizontal" : "vertical";
                  os.storage.set(StorageKeys.desktopIconAlignment, next);
                  relayoutDesktopIcons();
                  os.notify.send(`Icons aligned ${next}ly`);
                },
                alignIcon
              )
            );

            sub.appendChild(sHr());

            const hideDesktopIcons = os.storage.get(StorageKeys.hideDesktopIcons) === "true";
            const hideLabel = hideDesktopIcons ? "Show desktop icons" : "Hide desktop icons";
            const hideIcon = hideDesktopIcons ? "fa-eye" : "fa-eye-slash";
            sub.appendChild(
              sItem(
                hideLabel,
                () => {
                  const next = !hideDesktopIcons;
                  os.storage.set(StorageKeys.hideDesktopIcons, String(next));
                  $$("#desktop > .icon").forEach((icon) => {
                    icon.style.display = next ? "none" : "";
                  });
                  os.notify.send(next ? "Desktop icons hidden" : "Desktop icons shown");
                },
                hideIcon
              )
            );
          },
          "fa-eye"
        )
      );

      menu.appendChild(
        submenu(
          "Sort icons",
          (sub, sItem, sHr) => {
            const sortItems = [
              { id: "name", label: "By Name", icon: "fa-sort-alpha-down" },
              { id: "type", label: "By Type", icon: "fa-sort-amount-down" },
              { id: "recent", label: "By Recent Use", icon: "fa-clock" }
            ];
            sortItems.forEach(({ id, label, icon: faIcon }) => {
              const el = sItem(label, () => sortDesktopIcons(id), faIcon);
              if (currentSort === id) {
                el.style.fontWeight = "700";
                const check = createElement("i");
                check.className = "fas fa-check";
                check.style.marginLeft = "auto";
                check.style.fontSize = "10px";
                el.appendChild(check);
              }
              sub.appendChild(el);
            });
            sub.appendChild(sHr());
            if (currentSort && currentSort !== "none") {
              sub.appendChild(sItem("Free Placement", () => sortDesktopIcons("none"), "fa-undo"));
            }
            sub.appendChild(sHr());
            const autoLabel = currentAutoSort ? "Auto Sort: On" : "Auto Sort: Off";
            const autoIcon = currentAutoSort ? "fa-toggle-on" : "fa-toggle-off";
            const autoEl = sItem(
              autoLabel,
              () => {
                const next = !currentAutoSort;
                os.storage.set(StorageKeys.desktopAutoSort, next);
                if (next && currentSort && currentSort !== "none") {
                  sortDesktopIcons(currentSort);
                }
                os.notify.send(`Auto sort ${next ? "enabled" : "disabled"}`);
              },
              autoIcon
            );
            if (currentAutoSort) autoEl.style.color = "var(--brand)";
            sub.appendChild(autoEl);
          },
          "fa-sort"
        )
      );

      menu.appendChild(hr());

      menu.appendChild(
        submenu(
          "Widgets",
          (sub, sItem, sHr) => {
            const wm = this.desktopUI.widgetManager;
            const existing = wm.getAllWidgets();
            const existingTypes = new Set(existing.map((w) => w.type));
            const widgetTypes = [
              { type: "clock", label: "Clock", icon: "fa-clock" },
              { type: "weather", label: "Weather", icon: "fa-cloud-sun" },
              { type: "notes", label: "Notes", icon: "fa-sticky-note" },
              { type: "calendar", label: "Calendar", icon: "fa-calendar-alt" },
              { type: "systemMonitor", label: "System Monitor", icon: "fa-desktop" },
              { type: "musicControl", label: "Music Control", icon: "fa-music" },
              { type: "todo", label: "To-Do", icon: "fa-check-square" },
              { type: "power", label: "Power", icon: "fa-power-off" },
              { type: "clipboard", label: "Clipboard", icon: "fa-clipboard" },
              { type: "photoFrame", label: "Photo Frame", icon: "fa-image" },
              { type: "timer", label: "Timer", icon: "fa-stopwatch" },
              { type: "youtube", label: "YouTube", icon: "fa-youtube" }
            ];
            widgetTypes.forEach((wt) => {
              const disabled = existingTypes.has(wt.type);
              const el = sItem(
                wt.label,
                disabled
                  ? null
                  : () => {
                      wm.addWidget(wt.type, wt.label);
                      os.notify.send(`${wt.label} widget added`);
                    },
                wt.icon
              );
              if (disabled) {
                el.style.opacity = "0.4";
                el.style.cursor = "default";
                const check = createElement("i");
                check.className = "fas fa-check";
                check.style.marginLeft = "auto";
                check.style.fontSize = "10px";
                check.style.color = "var(--brand)";
                el.appendChild(check);
              }
              sub.appendChild(el);
            });
            if (existing.length > 0) {
              sub.appendChild(sHr());
              const removeAll = sItem(
                "Remove All Widgets",
                () => {
                  existing.forEach((w) => wm.removeWidget(w.id));
                  os.notify.send("All widgets removed");
                },
                "fa-trash-alt"
              );
              removeAll.style.color = "var(--error)";
              sub.appendChild(removeAll);
            }
          },
          "fa-puzzle-piece"
        )
      );

      menu.appendChild(
        item(
          "Enter fullscreen",
          () => {
            if (document.fullscreenElement) {
              document.exitFullscreen();
            } else {
              document.documentElement.requestFullscreen();
            }
          },
          "fa-expand"
        )
      );

      menu.appendChild(hr());

      menu.appendChild(
        item(
          "Refresh",
          async () => {
            $$(".folder-icon, .desktop-file-icon").forEach((i) => i.remove());
            await this.desktopUI.loadDesktopItems();
            relayoutDesktopIcons();
            $$(".folder-icon, .desktop-file-icon").forEach((i) => {
              i.style.animation = "wa-scale-in 0.25s ease-out both";
            });
          },
          "fa-sync-alt"
        )
      );
    });
  }

  currentSortMode() {
    return os.storage.get(StorageKeys.desktopSortMode) || "none";
  }

  showSortContextMenu(e, currentSort) {
    const currentAutoSort = os.storage.get(StorageKeys.desktopAutoSort) || false;
    showDynamicContextMenu(e, (menu, item, hr) => {
      const sortItems = [
        { id: "name", label: "By Name", icon: "fa-sort-alpha-down" },
        { id: "type", label: "By Type", icon: "fa-sort-amount-down" },
        { id: "recent", label: "By Recent Use", icon: "fa-clock" }
      ];
      sortItems.forEach(({ id, label, icon: faIcon }) => {
        const el = item(label, () => sortDesktopIcons(id), faIcon);
        if (currentSort === id) {
          el.style.setProperty("--brand", "var(--brand)");
          el.style.fontWeight = "700";
          const check = createElement("i");
          check.className = "fas fa-check";
          check.style.marginLeft = "auto";
          check.style.fontSize = "10px";
          el.appendChild(check);
        }
        menu.appendChild(el);
      });
      menu.appendChild(hr());
      if (currentSort && currentSort !== "none") {
        menu.appendChild(item("Free Placement", () => sortDesktopIcons("none"), "fa-undo"));
      }
      menu.appendChild(hr());
      const autoLabel = currentAutoSort ? "Auto Sort: On" : "Auto Sort: Off";
      const autoIcon = currentAutoSort ? "fa-toggle-on" : "fa-toggle-off";
      const autoEl = item(
        autoLabel,
        () => {
          const next = !currentAutoSort;
          os.storage.set(StorageKeys.desktopAutoSort, next);
          if (next && currentSort && currentSort !== "none") {
            sortDesktopIcons(currentSort);
          }
          os.notify.send(`Auto sort ${next ? "enabled" : "disabled"}`);
        },
        autoIcon
      );
      if (currentAutoSort) {
        autoEl.style.color = "var(--brand)";
      }
      menu.appendChild(autoEl);
    });
  }

  showWidgetsMenu(e) {
    const wm = this.desktopUI.widgetManager;
    const existing = wm.getAllWidgets();
    const existingTypes = new Set(existing.map((w) => w.type));

    showDynamicContextMenu(e, (menu, item, hr) => {
      const widgetTypes = [
        { type: "clock", label: "Clock", icon: "fa-clock" },
        { type: "weather", label: "Weather", icon: "fa-cloud-sun" },
        { type: "notes", label: "Notes", icon: "fa-sticky-note" },
        { type: "calendar", label: "Calendar", icon: "fa-calendar-alt" },
        { type: "systemMonitor", label: "System Monitor", icon: "fa-desktop" },
        { type: "musicControl", label: "Music Control", icon: "fa-music" },
        { type: "todo", label: "To-Do", icon: "fa-check-square" },
        { type: "power", label: "Power", icon: "fa-power-off" },
        { type: "clipboard", label: "Clipboard", icon: "fa-clipboard" },
        { type: "photoFrame", label: "Photo Frame", icon: "fa-image" },
        { type: "timer", label: "Timer", icon: "fa-stopwatch" },
        { type: "youtube", label: "YouTube", icon: "fa-youtube" }
      ];

      widgetTypes.forEach((wt) => {
        const disabled = existingTypes.has(wt.type);
        const el = item(
          wt.label,
          disabled
            ? null
            : () => {
                wm.addWidget(wt.type, wt.label);
                os.notify.send(`${wt.label} widget added`);
              },
          wt.icon
        );
        if (disabled) {
          el.style.opacity = "0.4";
          el.style.cursor = "default";
          const check = createElement("i");
          check.className = "fas fa-check";
          check.style.marginLeft = "auto";
          check.style.fontSize = "10px";
          check.style.color = "var(--brand)";
          el.appendChild(check);
        }
        menu.appendChild(el);
      });

      if (existing.length > 0) {
        menu.appendChild(hr());
        const removeAll = item(
          "Remove All Widgets",
          () => {
            existing.forEach((w) => wm.removeWidget(w.id));
            os.notify.send("All widgets removed");
          },
          "fa-trash-alt"
        );
        removeAll.style.color = "var(--error)";
        menu.appendChild(removeAll);
      }
    });
  }

  async showBackgroundContextMenu(e) {
    showDynamicContextMenu(e, (menu, item, hr) => {
      menu.appendChild(item("Open Wallpaper Engine", () => os.app.launch("wallpaperEngineApp"), "fa-paint-roller"));
      menu.appendChild(hr());
      menu.appendChild(item("Vanta.js Wallpapers", null, "fa-magic"));
      menu.appendChild(hr());

      vantaPresets.forEach((preset) => {
        menu.appendChild(
          item(
            preset.name,
            async () => {
              await SystemUtilities.setWallpaper(`vanta:${preset.id}`);
              os.notify.send(`Desktop wallpaper set to "${preset.name}"`, { type: "info" });
            },
            "fa-palette"
          )
        );
      });

      menu.appendChild(hr());
      menu.appendChild(item("Video Wallpapers", null, "fa-video"));
      menu.appendChild(hr());

      videos.forEach((videoUrl) => {
        const name = videoUrl
          .split("/")
          .pop()
          .replace(/\.\d+x\d+\.mp4$/, "")
          .replace(/-/g, " ");
        menu.appendChild(
          item(
            name,
            async () => {
              await SystemUtilities.setWallpaper(videoUrl);
              os.notify.send(`Desktop wallpaper set to "${name}"`, { type: "info" });
            },
            "fa-film"
          )
        );
      });
    });
  }

  async showNewContextMenu(e) {
    showDynamicContextMenu(e, (menu, item, hr) => {
      menu.appendChild(
        item(
          "Folder",
          async () => {
            await this.spawnInlineDesktopItem(false);
          },
          "fa-folder"
        )
      );
      menu.appendChild(
        item(
          "Text",
          async () => {
            await this.spawnInlineDesktopItem(true);
          },
          "fa-file-alt"
        )
      );
    });
  }

  async spawnInlineDesktopItem(isFile) {
    const defaultName = isFile ? "New File.txt" : "New Folder";
    const iconSrc = isFile ? "static/icons/notepad.webp" : "static/icons/file.webp";

    const icon = createElement("div");
    icon.className = "icon selectable is-renaming";
    icon.innerHTML = `<img src="${iconSrc}"><div></div>`;
    this.desktopUI.positionHelper.snap(icon);
    this.desktopUI.desktop.appendChild(icon);

    const { wrap, input, errorTip } = this.createInlineInput(defaultName);
    icon.appendChild(wrap);

    const dotIdx = defaultName.lastIndexOf(".");
    input.focus();
    if (isFile && dotIdx > 0) input.setSelectionRange(0, dotIdx);
    else input.select();

    const showError = (msg) => {
      errorTip.textContent = msg;
      errorTip.style.display = "block";
      input.classList.add("error");
    };
    const clearError = () => {
      errorTip.style.display = "none";
      input.classList.remove("error");
    };

    let committed = false;
    const cancel = () => {
      if (committed) return;
      committed = true;
      icon.remove();
    };

    const commit = async () => {
      if (committed) return;
      const name = input.value.trim();
      if (!name) {
        cancel();
        return;
      }
      committed = true;
      try {
        if (isFile) {
          await os.fs.write(["Desktop", name], "");
          await this.desktopUI.createDesktopFileIcon(name);
          os.notify.send(`File "${name}" created`);
        } else {
          await os.fs.mkdir(["Desktop", name]);
          await this.desktopUI.createFolderIcon(name);
          os.notify.send(`Folder "${name}" created`);
        }
        icon.remove();
      } catch (err) {
        committed = false;
        showError(err.message || "Could not create item.");
        input.focus();
      }
    };

    this.bindInlineInputEvents(input, commit, cancel, clearError);
  }

  createInlineInput(value) {
    const wrap = createElement("div");
    wrap.style.cssText = "display:flex;flex-direction:column;gap:4px;margin-top:4px;";

    const input = createElement("input");
    input.type = "text";
    input.value = value;
    input.style.cssText =
      "padding:4px 6px;border-radius:4px;border:1px solid var(--brand);background:rgba(0,0,0,0.6);color:inherit;font-size:13px;text-align:center;outline:none;width:100%;box-sizing:border-box;";
    wrap.appendChild(input);

    const errorTip = createElement("div");
    errorTip.style.cssText =
      "color:var(--error);font-size:11px;text-align:center;display:none;word-break:break-word;max-width:120px;";
    wrap.appendChild(errorTip);

    return { wrap, input, errorTip };
  }

  bindInlineInputEvents(input, commit, cancel, clearError) {
    input.onkeydown = (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        commit();
      }
      if (ev.key === "Escape") {
        ev.preventDefault();
        cancel();
      }
    };
    input.onblur = () => {
      setTimeout(() => {
        if (document.activeElement !== input) {
          commit();
        }
      }, 100);
    };
    input.oninput = clearError;
  }

  startInlineDesktopRename(icon) {
    if (icon.classList.contains("is-renaming")) return;
    icon.classList.add("is-renaming");

    const labelDiv = $("div", icon);
    let currentName;
    if (icon.dataset.app) {
      currentName = labelDiv ? labelDiv.textContent.trim() : icon.dataset.app;
    } else {
      currentName = icon.dataset.folderName || icon.dataset.fileName || (labelDiv ? labelDiv.textContent : "");
    }
    if (labelDiv) labelDiv.style.display = "none";

    const { wrap, input, errorTip } = this.createInlineInput(currentName);
    icon.appendChild(wrap);

    const dotIdx = currentName.lastIndexOf(".");
    input.focus();
    if (dotIdx > 0) input.setSelectionRange(0, dotIdx);
    else input.select();

    const showError = (msg) => {
      errorTip.textContent = msg;
      errorTip.style.display = "block";
      input.classList.add("error");
    };
    const clearError = () => {
      errorTip.style.display = "none";
      input.classList.remove("error");
    };

    let committed = false;

    const cancel = () => {
      if (committed) return;
      committed = true;
      icon.classList.remove("is-renaming");
      wrap.remove();
      if (labelDiv) labelDiv.style.display = "";
    };

    const commit = async () => {
      if (committed) return;
      let newName = input.value.trim();
      if (!newName || newName === currentName) {
        cancel();
        return;
      }
      committed = true;
      try {
        if (icon.classList.contains("folder-icon")) {
          await this.desktopUI.fs.renameItem("Desktop", currentName, newName, true);
          icon.dataset.folderName = newName;
          if (labelDiv) labelDiv.textContent = newName;
          os.notify.send(`Folder renamed to "${newName}"`);
        } else if (icon.classList.contains("desktop-file-icon")) {
          if (currentName.endsWith(".desktop") && !newName.endsWith(".desktop")) {
            newName += ".desktop";
          }
          await this.desktopUI.fs.renameItem("Desktop", currentName, newName, true);
          icon.dataset.fileName = newName;
          const displayName = newName.endsWith(".desktop") ? newName.slice(0, -8) : newName;
          if (labelDiv) labelDiv.textContent = displayName;
          os.notify.send(`File renamed to "${newName}"`);
        } else if (icon.dataset.app) {
          let newFile = newName;
          if (icon.dataset.fileName?.endsWith(".desktop") && !newFile.endsWith(".desktop")) {
            newFile += ".desktop";
          }
          if (icon.dataset.fileName) {
            await this.desktopUI.fs.renameItem("Desktop", icon.dataset.fileName, newFile, true);
            icon.dataset.fileName = newFile;
          }
          if (labelDiv) labelDiv.textContent = newName;
          os.notify.send(`Renamed to "${newName}"`);
        }
        icon.classList.remove("is-renaming");
        wrap.remove();
        if (labelDiv) labelDiv.style.display = "";
      } catch (err) {
        committed = false;
        showError(err.message || `"${newName}" already exists`);
        input.focus();
      }
    };

    this.bindInlineInputEvents(input, commit, cancel, clearError);
  }

  async addToArchive(path, name) {
    try {
      const isFolder = !name.includes(".") || (await this.isDirectory(path));

      const dirPath = path.length > 1 ? path.slice(0, -1) : ["Desktop"];
      const items = [{ name, path: dirPath, isFile: !isFolder }];

      const archiveName = name.endsWith(".zip") ? name.slice(0, -4) : name;

      const result = await this.archiveExtractor.createArchive(items, {
        format: "zip",
        compressionLevel: 6,
        outputPath: ["Desktop"],
        archiveName
      });

      if (result.success) {
        await this.desktopUI.createDesktopFileIcon(result.name);
        os.notify.send(`"${result.name}" created`);
      } else {
        throw new Error(result.error || "Failed to create archive");
      }
    } catch (err) {
      console.error("Archive error:", err);
      os.dialog.alert("Error", "Failed to create archive");
    }
  }

  async downloadItem(path, name, isFolder) {
    try {
      if (isFolder) {
        const items = [{ name, path: ["Desktop"], isFile: false }];

        const archiveName = name.endsWith(".zip") ? name.slice(0, -4) : name;

        const result = await this.archiveExtractor.createArchive(items, {
          format: "zip",
          compressionLevel: 6,
          outputPath: ["Desktop"],
          archiveName
        });

        if (result.success) {
          const content = await os.fs.read(["Desktop", result.name], { encoding: "binary" });
          const blob = new Blob([content], { type: "application/zip" });
          downloadBlob(blob, result.name);
          os.notify.send(`"${name}" downloaded as ZIP`);
          await os.fs.delete(["Desktop"], result.name);
        } else {
          throw new Error(result.error || "Failed to create archive");
        }
      } else {
        const content = await os.fs.read(path, { encoding: "binary" });
        const blob = new Blob([content], { type: "application/octet-stream" });
        downloadBlob(blob, name);
        os.notify.send(`"${name}" downloaded`);
      }
    } catch (err) {
      console.error("Download error:", err);
      os.dialog.alert("Error", "Failed to download item");
    }
  }

  async isDirectory(path) {
    try {
      const dirPath = path.slice(0, -1);
      const fileName = path[path.length - 1];
      const folder = await os.fs.readdir(dirPath);
      const item = folder[fileName];
      return item && !item.type;
    } catch {
      return false;
    }
  }
}
