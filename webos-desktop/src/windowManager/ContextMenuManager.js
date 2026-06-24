import { showStartStyleMenu, showContextMenu, showDynamicContextMenu, hideMenu } from "../shared/contextMenu.js";
import { os } from "../os/index.js";

export class ContextMenuManager {
  constructor(manager) {
    this.manager = manager;
  }

  _buildPropertiesWindow(winId) {
    const win = document.getElementById(winId);
    if (!win) return;

    const appInfo = this.manager.openWindows.get(winId);
    if (!appInfo) return;

    const content = win.querySelector(".window-content");
    if (!content) return;

    const existingOverlay = win.querySelector(":scope > .window-props-overlay");
    if (existingOverlay) {
      try {
        existingOverlay.remove();
      } finally {
        content.style.display = content.dataset.prevDisplay || "";
        delete content.dataset.prevDisplay;
      }
    }

    const dataset = win.dataset;
    const rect = win.getBoundingClientRect();

    const info = {
      identity: [
        ["Window ID", winId],
        ["Title", appInfo.title],
        ["Type", dataset.appType || "-"],
        ["App ID", dataset.appId || "-"],
        ["URL", dataset.externalUrl || "-"]
      ],
      geometry: [
        ["Width", `${Math.round(rect.width)}px`],
        ["Height", `${Math.round(rect.height)}px`],
        ["Left", `${Math.round(rect.left)}px`],
        ["Top", `${Math.round(rect.top)}px`]
      ],
      system: [
        ["Z-Index", win.style.zIndex || "-"],
        ["Fullscreen", dataset.fullscreen === "true" ? "Yes" : "No"],
        ["SWF", dataset.swf || "-"],
        ["ROM", dataset.rom || "-"],
        ["Core", dataset.core || "-"]
      ]
    };

    const buildSection = (title, rows) => `
    <div class="props-section">
      <div class="props-section-title">${title}</div>
      ${rows
        .map(
          ([k, v]) => `
        <div class="props-row">
          <div class="props-key">${k}</div>
          <div class="props-val">${v}</div>
        </div>
      `
        )
        .join("")}
    </div>
  `;

    const overlayHtml = `
    <div class="window-props-header">
      <div class="window-props-title">Properties</div>
      <button type="button" class="window-props-close">Close</button>
    </div>
    <div class="props-content">
      ${buildSection("Identity", info.identity)}
      ${buildSection("Geometry", info.geometry)}
      ${buildSection("System", info.system)}
    </div>
  `;

    const overlay = document.createElement("div");
    overlay.className = "window-props-overlay";
    overlay.innerHTML = overlayHtml;

    if (!content.dataset.prevDisplay) content.dataset.prevDisplay = content.style.display || "";
    content.style.display = "none";

    win.appendChild(overlay);
    overlay.querySelector(".window-props-close")?.addEventListener("click", () => {
      try {
        overlay.remove();
      } finally {
        content.style.display = content.dataset.prevDisplay || "";
        delete content.dataset.prevDisplay;
      }
    });
  }

  _buildContextMenuItems(addMenuItem, addSeparator, win) {
    const winId = win.id;
    const isMinimized = win.style.display === "none";
    const isFullscreen = win.dataset.fullscreen === "true";
    const appId = win.dataset.appId || this.manager._guessAppIdFromWinId(winId);

    addMenuItem(
      isMinimized ? "Restore" : "Minimize",
      () => {
        if (isMinimized) win.style.display = "";
        else this.manager.minimizeWindow(win);
        this.manager.bringToFront(win);
      },
      isMinimized ? "fa-window-restore" : "fa-window-minimize"
    );

    addMenuItem(
      isFullscreen ? "Restore Size" : "Maximize",
      () => {
        this.manager.toggleFullscreen(win);
        this.manager.bringToFront(win);
      },
      isFullscreen ? "fa-compress" : "fa-window-maximize"
    );

    addMenuItem("Bring to Front", () => this.manager.bringToFront(win), "fa-layer-group");

    addSeparator();

    if (appId) {
      addMenuItem("New Window", () => os.app.launch(appId), "fa-plus-square");
      addSeparator();
    }

    addMenuItem("Snap Left", () => this.manager._applySnap(win, "left"), "fa-columns");
    addMenuItem("Snap Right", () => this.manager._applySnap(win, "right"), "fa-columns");
    addMenuItem("Snap Maximize", () => this.manager._applySnap(win, "maximize"), "fa-expand-arrows-alt");

    addSeparator();

    if (this.manager.workspaceManager && this.manager.workspaceManager.workspaces.length > 1) {
      this.manager.workspaceManager.workspaces.forEach((ws) => {
        if (ws.id !== this.manager.workspaceManager.activeId) {
          addMenuItem(
            `Move to ${ws.name}`,
            () => {
              this.manager.workspaceManager.moveWindowTo(winId, ws.id);
            },
            "fa-exchange-alt"
          );
        }
      });
      addSeparator();
    }

    addMenuItem("Properties", () => this._buildPropertiesWindow(winId), "fa-info-circle");

    addSeparator();

    const isPinned = this.manager._isWindowPinned(winId);
    addMenuItem(
      isPinned ? "Unpin from Taskbar" : "Pin to Taskbar",
      () => {
        if (isPinned) this.manager._unpinFromTaskbar(winId);
        else this.manager._pinToTaskbar(winId);
      },
      isPinned ? "fa-thumbtack" : "fa-thumbtack"
    );

    addSeparator();

    addMenuItem(
      "Close Window",
      () => {
        const winToClose = document.getElementById(winId);
        if (winToClose) {
          this.manager._silenceWindow(winToClose);
          this.manager.removeFromTaskbar(winId);
          this.manager._animateAndRemove(winToClose);
        }
      },
      "fa-times-circle"
    );
  }

  _showWindowContextMenu(e, win) {
    showStartStyleMenu(e, (addMenuItem, addSeparator) => this._buildContextMenuItems(addMenuItem, addSeparator, win));
  }
}

export class DesktopContextMenuManager {
  constructor(desktopUI, PositionStore, IconDataHelper) {
    this.desktopUI = desktopUI;
    this.PositionStore = PositionStore;
    this.IconDataHelper = IconDataHelper;
    this.desktop = document.getElementById("desktop");
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
        { id: "ctx-copy-folder", label: "Copy", action: "copyFolder", icon: "fa-copy" },
        { id: "ctx-cut-folder", label: "Cut", action: "cutFolder", icon: "fa-cut" },
        "hr",
        { id: "ctx-delete-folder", label: "Move to Trash", action: "deleteFolder", icon: "fa-trash-alt" },
        { id: "ctx-rename-folder", label: "Rename", action: "renameFolder", icon: "fa-edit" }
      ],
      fileIconContextMenu: [
        { id: "ctx-open-file", label: "Open", action: "openFile", icon: "fa-file-alt" },
        "hr",
        { id: "ctx-copy-file", label: "Copy", action: "copyFile", icon: "fa-copy" },
        { id: "ctx-cut-file", label: "Cut", action: "cutFile", icon: "fa-cut" },
        "hr",
        { id: "ctx-delete-file", label: "Move to Trash", action: "deleteFile", icon: "fa-trash-alt" },
        { id: "ctx-rename-file", label: "Rename", action: "renameFile", icon: "fa-edit" }
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
      copyFolder: () => {
        this.desktopUI.setClipboard(this.desktopUI._buildDesktopClipboard("copy", selectedArray));
        os.notify.send(`${selectedArray.length} item${selectedArray.length !== 1 ? "s" : ""} copied`);
      },
      cutFolder: () => {
        this.desktopUI.setClipboard(this.desktopUI._buildDesktopClipboard("cut", selectedArray));
        selectedArray.forEach((i) => (i.style.opacity = "0.5"));
        os.notify.send(`${selectedArray.length} item${selectedArray.length !== 1 ? "s" : ""} cut`);
      },
      deleteFolder: () => this.desktopUI.moveSelectedIconsToTrash(selectedArray),
      renameFolder: async () => {
        const newName = await os.dialog.prompt("Prompt", "Enter new folder name:", folderIcon.dataset.folderName);
        if (newName && newName !== folderIcon.dataset.folderName) {
          await this.desktopUI.fs.renameItem(["Desktop"], folderIcon.dataset.folderName, newName);
          const saved = this.PositionStore.load();
          const oldKey = this.PositionStore.getKey(folderIcon);
          folderIcon.dataset.folderName = newName;
          folderIcon.querySelector("span, div").textContent = newName;
          const newKey = this.PositionStore.getKey(folderIcon);
          if (saved[oldKey]) {
            saved[newKey] = saved[oldKey];
            delete saved[oldKey];
            this.PositionStore.save(saved);
          }
          os.notify.send(`Renamed to "${newName}"`);
        }
      }
    });
  }

  showFileIconContextMenu(e, fileIcon) {
    if (!this.desktopUI.selectionManager.has(fileIcon)) {
      this.desktopUI.selectionManager.clear();
      this.desktopUI.selectionManager.add(fileIcon);
    }
    const selectedArray = this.desktopUI.selectionManager.toArray();
    const fileName = fileIcon.dataset.fileName;

    showDynamicContextMenu(e, async (menu, item, hr) => {
      menu.appendChild(item("Open", () => this.desktopUI._openDesktopFile(fileName), "fa-file-alt"));

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
        "tsv"
      ];

      const isTextFile = (name) => {
        const ext = name.split(".").pop().toLowerCase();
        return ext === "desktop" || convertableExtensions.includes(ext);
      };

      let showNotepadOption = isTextFile(fileName);

      if (!showNotepadOption) {
        try {
          const { FileKind } = await import("../fs.js");
          const kind = await this.desktopUI.fs.getFileKind(["Desktop"], fileName);
          if (kind === FileKind.TEXT) {
            showNotepadOption = true;
          }
        } catch {}
      }

      if (showNotepadOption) {
        menu.appendChild(
          item("Edit with Notepad", () => this.desktopUI._editDesktopFileWithNotepad(fileName), "fa-edit")
        );
      }

      const effectiveFiles = selectedArray.map((el) => el.dataset.fileName);
      const convertableFiles = effectiveFiles.filter((name) => {
        const ext = name.split(".").pop().toLowerCase();
        return convertableExtensions.includes(ext);
      });

      if (convertableFiles.length > 0) {
        menu.appendChild(
          item(
            convertableFiles.length > 1 ? `Convert ${convertableFiles.length} items...` : "Convert / Transform...",
            async () => {
              const { openFileConverter } = await import("../utils/fileConverter.js");
              const services = {
                windowManager: this.desktopUI.appLauncher.wm,
                fileSystemManager: this.desktopUI.fs,
                notepadApp: this.desktopUI.appLauncher.notepadApp,
                browserApp: this.desktopUI.appLauncher.browserApp,
                officeApp: this.desktopUI.appLauncher.officeApp,
                markdownApp: this.desktopUI.appLauncher.markdownApp,
                jsDosApp: this.desktopUI.appLauncher.jsDosApp,
                appLauncher: this.desktopUI.appLauncher
              };
              convertableFiles.forEach((name) => {
                openFileConverter(name, ["Desktop"], services, () => {
                  document.querySelectorAll(".folder-icon, .desktop-file-icon").forEach((i) => i.remove());
                  this.desktopUI.loadDesktopItems();
                });
              });
            },
            "fa-exchange-alt"
          )
        );
      }

      menu.appendChild(hr());

      menu.appendChild(
        item(
          "Copy",
          () => {
            this.desktopUI.setClipboard(this.desktopUI._buildDesktopClipboard("copy", selectedArray));
            os.notify.send(`${selectedArray.length} item${selectedArray.length !== 1 ? "s" : ""} copied`);
          },
          "fa-copy"
        )
      );
      menu.appendChild(
        item(
          "Cut",
          () => {
            this.desktopUI.setClipboard(this.desktopUI._buildDesktopClipboard("cut", selectedArray));
            selectedArray.forEach((i) => (i.style.opacity = "0.5"));
            os.notify.send(`${selectedArray.length} item${selectedArray.length !== 1 ? "s" : ""} cut`);
          },
          "fa-cut"
        )
      );
      menu.appendChild(hr());

      menu.appendChild(
        item("Move to Trash", () => this.desktopUI.moveSelectedIconsToTrash(selectedArray), "fa-trash-alt")
      );
      menu.appendChild(
        item(
          "Rename",
          async () => {
            const newName = await os.dialog.prompt("Prompt", "Enter new name:", fileName);
            if (newName && newName !== fileName) {
              await this.desktopUI.fs.renameItem(["Desktop"], fileName, newName);
              fileIcon.dataset.fileName = newName;
              fileIcon.querySelector("span, div").textContent = newName;
              os.notify.send(`Renamed to "${newName}"`);
            }
          },
          "fa-edit"
        )
      );

      try {
        const { FileKind } = await import("../fs.js");
        const { SystemUtilities } = await import("../system.js");
        const kind = await this.desktopUI.fs.getFileKind(["Desktop"], fileName);
        if (kind === FileKind.IMAGE || kind === FileKind.VIDEO) {
          const content = await this.desktopUI.fs.getFileContent(["Desktop"], fileName);
          menu.appendChild(
            item(
              "Set Wallpaper",
              () => {
                SystemUtilities.setWallpaper(content);
                os.notify.send(`Wallpaper set to "${fileName}"`);
              },
              "fa-image"
            )
          );
          menu.appendChild(
            item(
              "Save as Wallpaper",
              async () => {
                await this.desktopUI.saveToWallpapers(
                  fileName,
                  content,
                  await this.desktopUI.fs.getFileKind(["Desktop"], fileName)
                );
                os.notify.send(`"${fileName}" saved to Wallpapers`);
              },
              "fa-save"
            )
          );
        }
      } catch {}
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
      copy: () => {
        this.desktopUI.setClipboard(this.desktopUI._buildDesktopClipboard("copy", selectedArray));
        os.notify.send(`${selectedArray.length} item${selectedArray.length !== 1 ? "s" : ""} copied`);
      },
      cut: () => {
        this.desktopUI.setClipboard(this.desktopUI._buildDesktopClipboard("cut", selectedArray));
        selectedArray.forEach((i) => (i.style.opacity = "0.5"));
        os.notify.send(`${selectedArray.length} item${selectedArray.length !== 1 ? "s" : ""} cut`);
      },
      delete: () => this.desktopUI.moveSelectedIconsToTrash(selectedArray),
      rename: async () => {
        const currentName = this.IconDataHelper.getIconName(last);
        const newName = await os.dialog.prompt("Prompt", "Enter new name:", currentName);
        if (newName && newName !== currentName) {
          if (last.dataset.fileName) {
            await this.desktopUI.fs.renameItem(["Desktop"], last.dataset.fileName, `${newName}.desktop`);
            last.dataset.fileName = `${newName}.desktop`;
          }
          last.querySelector("span, div").textContent = newName;
          os.notify.send(`Renamed to "${newName}"`);
        }
      },
      properties: () => this.desktopUI.showPropertiesDialog(last)
    });
  }

  showDesktopContextMenu(e) {
    showContextMenu(e, this.templates.desktopContextMenu, {
      addFiles: () => this.desktopUI.addFiles(),
      new: () => {
        this.showNewContextMenu(e);
      },
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
      refresh: async () => {
        document.querySelectorAll(".folder-icon, .desktop-file-icon").forEach((i) => i.remove());
        await this.desktopUI.loadDesktopItems();
      }
    });
  }

  async showBackgroundContextMenu(e) {
    const { videos } = await import("../wallpaperList.js");
    const { vantaPresets } = await import("../vantaPresets.js");
    const { SystemUtilities } = await import("../system.js");

    const menu = document.getElementById("context-menu");
    if (!menu) return;
    menu.classList.remove("closing");
    menu.style.display = "";
    menu.innerHTML = "";
    menu.classList.add("context-menu-glass");

    const item = (text, onclick, icon = null) => {
      const el = document.createElement("div");
      const iconVal = (icon || "fa-chevron-right").trim();
      const iconCls = iconVal.includes(" ") ? iconVal : `fas ${iconVal}`;
      const iconEl = document.createElement("i");
      iconEl.className = iconCls;
      iconEl.style.width = "16px";
      iconEl.style.textAlign = "center";
      iconEl.style.opacity = "0.7";
      el.appendChild(iconEl);
      const label = document.createElement("span");
      label.textContent = text;
      el.appendChild(label);
      el.onclick = (event) => {
        if (event) event.stopPropagation();
        hideMenu();
        onclick();
      };
      return el;
    };

    const hr = () => document.createElement("hr");

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

    const { positionMenu, refreshIcons, bindDismissal } = await import("../shared/contextMenu.js");
    positionMenu(menu, e.pageX, e.pageY);
    refreshIcons(menu);
    bindDismissal();
  }

  async showNewContextMenu(e) {
    const menu = document.getElementById("context-menu");
    if (!menu) return;
    menu.classList.remove("closing");
    menu.style.display = "";
    menu.innerHTML = "";
    menu.classList.add("context-menu-glass");

    const item = (text, onclick, icon = null) => {
      const el = document.createElement("div");
      const iconVal = (icon || "fa-chevron-right").trim();
      const iconCls = iconVal.includes(" ") ? iconVal : `fas ${iconVal}`;
      const iconEl = document.createElement("i");
      iconEl.className = iconCls;
      iconEl.style.width = "16px";
      iconEl.style.textAlign = "center";
      iconEl.style.opacity = "0.7";
      el.appendChild(iconEl);
      const label = document.createElement("span");
      label.textContent = text;
      el.appendChild(label);
      el.onclick = (event) => {
        if (event) event.stopPropagation();
        hideMenu();
        onclick();
      };
      return el;
    };

    const hr = () => document.createElement("hr");

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

    const { positionMenu, refreshIcons, bindDismissal } = await import("../shared/contextMenu.js");
    positionMenu(menu, e.pageX, e.pageY);
    refreshIcons(menu);
    bindDismissal();
  }

  async _spawnInlineDesktopItem(isFile) {
    const defaultName = isFile ? "New File.txt" : "New Folder";
    const iconSrc = isFile ? "static/icons/notepad.webp" : "static/icons/file.webp";

    const icon = document.createElement("div");
    icon.className = "icon selectable is-renaming";
    icon.innerHTML = `<img src="${iconSrc}"><div></div>`;
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
    wrap.className = "inline-rename-wrap";

    const input = document.createElement("input");
    input.className = "inline-rename-input";
    input.type = "text";
    input.value = value;
    input.spellcheck = false;

    const errorTip = document.createElement("div");
    errorTip.className = "inline-rename-error";
    errorTip.style.display = "none";

    wrap.appendChild(input);
    wrap.appendChild(errorTip);
    return { wrap, input, errorTip };
  }

  _bindInlineInputEvents(input, commit, cancel, clearError) {
    input.onkeydown = (ev) => {
      ev.stopPropagation();
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
    if (icon.classList.contains("is-renaming")) return;
    icon.classList.add("is-renaming");

    const labelDiv = icon.querySelector("div");
    const currentName = icon.dataset.folderName || icon.dataset.fileName || (labelDiv ? labelDiv.textContent : "");
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
      if (committed) return;
      committed = true;
      icon.classList.remove("is-renaming");
      wrap.remove();
      if (labelDiv) labelDiv.style.display = "";
    };

    const commit = async () => {
      if (committed) return;
      const newName = input.value.trim();
      if (!newName || newName === currentName) {
        cancel();
        return;
      }
      committed = true;
      try {
        if (icon.classList.contains("folder-icon")) {
          await os.fs.rename(["Desktop", currentName], ["Desktop", newName]);
          icon.dataset.folderName = newName;
          if (labelDiv) labelDiv.textContent = newName;
          os.notify.send(`Folder renamed to "${newName}"`);
        } else if (icon.classList.contains("desktop-file-icon")) {
          await os.fs.rename(["Desktop", currentName], ["Desktop", newName]);
          icon.dataset.fileName = newName;
          const displayName = newName.endsWith(".desktop") ? newName.slice(0, -8) : newName;
          if (labelDiv) labelDiv.textContent = displayName;
          os.notify.send(`File renamed to "${newName}"`);
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

    this._bindInlineInputEvents(input, commit, cancel, clearError);
  }
}
