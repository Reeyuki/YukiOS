import { showContextMenu, showDynamicContextMenu, hideMenu } from "../shared/contextMenu.js";
import { sortDesktopIcons } from "./desktopui.js";
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

export class DesktopContextMenuManager {
  constructor(desktopUI, PositionStore, IconDataHelper, wm) {
    this.desktopUI = desktopUI;
    this.PositionStore = PositionStore;
    this.IconDataHelper = IconDataHelper;
    this.wm = wm;
    this.desktop = document.getElementById("desktop");
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
        { id: "ctx-sort", label: "Sort icons", icon: "fa-sort", action: "sort" },
        "hr",
        { id: "ctx-widgets", label: "Widgets", action: "widgets", icon: "fa-puzzle-piece" },
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
        await this._addToArchive(["Desktop", folderName], folderName);
      },
      downloadFolder: async () => {
        await this._downloadItem(["Desktop", folderName], folderName, true);
      },
      propertiesFolder: buildPropertiesAction(folderIcon, this.desktopUI),
      copyFolder: buildCopyAction(selectedArray, this.desktopUI),
      cutFolder: buildCutAction(selectedArray, this.desktopUI),
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
      menu.appendChild(item("Open", () => this.desktopUI._openDesktopFile(fileName), "fa-file-alt"));
      menu.appendChild(
        item(
          "Add to archive",
          async () => {
            await this._addToArchive([filePath, fileName], fileName);
          },
          "fa-file-archive"
        )
      );
      menu.appendChild(
        item(
          "Download",
          async () => {
            await this._downloadItem([filePath, fileName], fileName, false);
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
              const { openFileConverter } = await import("../utils/fileConverter.js");
              openFileConverter(fileName, [filePath, fileName], this.desktopUI.fs, this.desktopUI.appLauncher);
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
              await this.desktopUI._editDesktopFileWithNotepad(fileName);
            },
            "fa-pen"
          )
        );
      }

      menu.appendChild(
        item(
          "Edit with Notepad (force)",
          async () => {
            await this.desktopUI._editDesktopFileWithNotepad(fileName);
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
          const binary = await os.fs.read([filePath, fileName], { encoding: "binary" });
          const blob = new Blob([binary], { type: mime });
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
                const { SystemUtilities } = await import("../system.js");
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
      menu.appendChild(hr());
      menu.appendChild(item("Move to Trash", buildDeleteAction(selectedArray, this.desktopUI), "fa-trash-alt"));
      menu.appendChild(item("Rename", () => this._startInlineDesktopRename(fileIcon), "fa-edit"));
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
      delete: buildDeleteAction(selectedArray, this.desktopUI),
      rename: () => this._startInlineDesktopRename(last),
      properties: buildPropertiesAction(last, this.desktopUI)
    });
  }

  showDesktopContextMenu(e) {
    const currentSort = this._currentSortMode();
    showContextMenu(e, this.templates.desktopContextMenu, {
      new: () => this.showNewContextMenu(e),
      addFiles: () => this.desktopUI.addFiles(),
      openExplorer: () => this.desktopUI.explorerApp.open(),
      startRecording: () => {
        os.app.launch("cameraApp");
      },
      setWallpaper: () => {
        os.app.launch("settingsApp", {
          section: "pane-appearance",
          target: "settings-wallpaper-card"
        });
      },
      background: () => {
        this.showBackgroundContextMenu(e);
      },
      openTerminal: () => {
        const username = os.storage.get("username") || "guest";
        os.app.launch("terminalApp", { initialPath: ["home", username, "Desktop"] });
      },
      paste: async () => {
        await this.desktopUI._pasteToDesktop();
      },
      sort: () => this.showSortContextMenu(e, currentSort),
      widgets: () => this.showWidgetsMenu(e),
      refresh: async () => {
        document.querySelectorAll(".folder-icon, .desktop-file-icon").forEach((i) => i.remove());
        await this.desktopUI.loadDesktopItems();
      }
    });
  }

  _currentSortMode() {
    return os.storage.get("yukiOS_desktop_sort_mode") || "none";
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
          const check = document.createElement("i");
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

    import("../shared/contextMenu.js").then(({ showDynamicContextMenu }) => {
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
            const check = document.createElement("i");
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
    });
  }

  async showBackgroundContextMenu(e) {
    const { videos } = await import("../wallpaperList.js");
    const { vantaPresets } = await import("../vantaPresets.js");
    const { SystemUtilities } = await import("../system.js");

    showDynamicContextMenu(e, (menu, item, hr) => {
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
            await this._spawnInlineDesktopItem(false);
          },
          "fa-folder"
        )
      );
      menu.appendChild(
        item(
          "Text",
          async () => {
            await this._spawnInlineDesktopItem(true);
          },
          "fa-file-alt"
        )
      );
    });
  }

  async _spawnInlineDesktopItem(isFile) {
    const defaultName = isFile ? "New File.txt" : "New Folder";
    const iconSrc = isFile ? "static/icons/notepad.webp" : "static/icons/file.webp";

    const icon = document.createElement("div");
    icon.className = "icon selectable is-renaming";
    icon.innerHTML = `<img src="${iconSrc}"><div></div>`;
    this.desktopUI.positionHelper.snap(icon);
    this.desktopUI.desktop.appendChild(icon);

    const { wrap, input, errorTip } = this._createInlineInput(defaultName);
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

    this._bindInlineInputEvents(input, commit, cancel, clearError);
  }

  _createInlineInput(value) {
    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex;flex-direction:column;gap:4px;margin-top:4px;";

    const input = document.createElement("input");
    input.type = "text";
    input.value = value;
    input.style.cssText =
      "padding:4px 6px;border-radius:4px;border:1px solid var(--brand);background:rgba(0,0,0,0.6);color:inherit;font-size:13px;text-align:center;outline:none;width:100%;box-sizing:border-box;";
    wrap.appendChild(input);

    const errorTip = document.createElement("div");
    errorTip.style.cssText =
      "color:var(--error);font-size:11px;text-align:center;display:none;word-break:break-word;max-width:120px;";
    wrap.appendChild(errorTip);

    return { wrap, input, errorTip };
  }

  _bindInlineInputEvents(input, commit, cancel, clearError) {
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

  _startInlineDesktopRename(icon) {
    console.log("[Rename Debug] _startInlineDesktopRename called", icon, "classes:", icon.className);
    if (icon.classList.contains("is-renaming")) return;
    icon.classList.add("is-renaming");

    const labelDiv = icon.querySelector("div");
    let currentName;
    if (icon.dataset.app) {
      currentName = labelDiv ? labelDiv.textContent.trim() : icon.dataset.app;
    } else {
      currentName = icon.dataset.folderName || icon.dataset.fileName || (labelDiv ? labelDiv.textContent : "");
    }
    console.log(
      "[Rename Debug] currentName:",
      currentName,
      "labelDiv:",
      !!labelDiv,
      "label text:",
      labelDiv?.textContent
    );
    if (labelDiv) labelDiv.style.display = "none";

    const { wrap, input, errorTip } = this._createInlineInput(currentName);
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
      console.log("[Rename Debug] cancel called");
      if (committed) return;
      committed = true;
      icon.classList.remove("is-renaming");
      wrap.remove();
      if (labelDiv) labelDiv.style.display = "";
    };

    const commit = async () => {
      console.log("[Rename Debug] commit called");
      if (committed) return;
      let newName = input.value.trim();
      console.log("[Rename Debug] newName:", newName, "currentName:", currentName);
      if (!newName || newName === currentName) {
        console.log("[Rename Debug] no change, cancelling");
        cancel();
        return;
      }
      committed = true;
      console.log(
        "[Rename Debug] is folder-icon:",
        icon.classList.contains("folder-icon"),
        "is desktop-file-icon:",
        icon.classList.contains("desktop-file-icon"),
        "has data-app:",
        !!icon.dataset.app
      );
      try {
        if (icon.classList.contains("folder-icon")) {
          console.log("[Rename Debug] renaming folder:", currentName, "->", newName);
          await this.desktopUI.fs.renameItem("Desktop", currentName, newName, true);
          console.log("[Rename Debug] fs rename succeeded");
          icon.dataset.folderName = newName;
          if (labelDiv) labelDiv.textContent = newName;
          os.notify.send(`Folder renamed to "${newName}"`);
        } else if (icon.classList.contains("desktop-file-icon")) {
          console.log("[Rename Debug] renaming file:", currentName, "->", newName);
          if (currentName.endsWith(".desktop") && !newName.endsWith(".desktop")) {
            newName += ".desktop";
            console.log("[Rename Debug] appended .desktop, newName now:", newName);
          }
          await this.desktopUI.fs.renameItem("Desktop", currentName, newName, true);
          console.log("[Rename Debug] fs rename succeeded");
          icon.dataset.fileName = newName;
          const displayName = newName.endsWith(".desktop") ? newName.slice(0, -8) : newName;
          if (labelDiv) labelDiv.textContent = displayName;
          console.log(
            "[Rename Debug] DOM updated: dataset.fileName =",
            icon.dataset.fileName,
            "label text =",
            labelDiv?.textContent
          );
          os.notify.send(`File renamed to "${newName}"`);
        } else if (icon.dataset.app) {
          console.log("[Rename Debug] renaming app shortcut:", currentName, "->", newName);
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
        } else {
          console.log("[Rename Debug] UNKNOWN ICON TYPE - no rename performed");
        }
        icon.classList.remove("is-renaming");
        wrap.remove();
        if (labelDiv) labelDiv.style.display = "";
        console.log("[Rename Debug] rename complete");
      } catch (err) {
        console.log("[Rename Debug] ERROR:", err.message);
        committed = false;
        showError(err.message || `"${newName}" already exists`);
        input.focus();
      }
    };

    this._bindInlineInputEvents(input, commit, cancel, clearError);
  }

  async _addToArchive(path, name) {
    try {
      const isFolder = !name.includes(".") || (await this._isDirectory(path));

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

  async _downloadItem(path, name, isFolder) {
    try {
      const { downloadBlob } = await import("../settings/settingsData.js");

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

  async _isDirectory(path) {
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
