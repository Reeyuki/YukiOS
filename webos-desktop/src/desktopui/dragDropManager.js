import { showConflictDialog } from "../shared/conflictDialog.js";
import { os, $, $$, BusEvents, setStyle } from "../framework.js";
import { FileKind } from "../shared/fileKindDetector.js";

export class DragDropManager {
  constructor(desktop, fs, positionHelper, positionStore, selectionManager, iconManager, iconDataHelper, explorerApp) {
    this.desktop = desktop;
    this.fs = fs;
    this.positionHelper = positionHelper;
    this.positionStore = positionStore;
    this.selectionManager = selectionManager;
    this.iconManager = iconManager;
    this.iconDataHelper = iconDataHelper;
    this.explorerApp = explorerApp;
    this.state = { dragTarget: null, explorerDragTarget: null, isUserDragging: false };
  }

  updateDragTarget(event) {
    let foundFolder = null;
    $$(".folder-icon").forEach((folder) => {
      if (this.selectionManager.has(folder)) return;
      const rect = folder.getBoundingClientRect();
      if (
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom
      )
        foundFolder = folder;
    });

    if (this.state.dragTarget) setStyle(this.state.dragTarget, { outline: "" });
    if (foundFolder && !this.selectionManager.has(foundFolder)) {
      setStyle(foundFolder, { outline: "2px solid var(--brand)" });
      this.state.dragTarget = foundFolder;
    } else {
      this.state.dragTarget = null;
    }

    let foundExplorer = null;
    if (!foundFolder) {
      $$("[id^='explorer-']").forEach((win) => {
        const view = win.querySelector("[id$='-view']");
        if (!view) return;
        const rect = view.getBoundingClientRect();
        if (
          event.clientX >= rect.left &&
          event.clientX <= rect.right &&
          event.clientY >= rect.top &&
          event.clientY <= rect.bottom
        )
          foundExplorer = win;
      });
    }

    if (this.state.explorerDragTarget && this.state.explorerDragTarget !== foundExplorer) {
      this.state.explorerDragTarget.querySelector("[id$='-view']")?.style.setProperty("outline", "");
    }
    if (foundExplorer) {
      foundExplorer.querySelector("[id$='-view']").style.outline = "2px solid rgba(79,158,255,0.8)";
      this.state.explorerDragTarget = foundExplorer;
    } else {
      this.state.explorerDragTarget = null;
    }
  }

  async moveIconsToFolder(icons, folderName) {
    const saved = this.positionStore.load();
    let moved = 0;
    for (const icon of icons) {
      if (icon.classList.contains("folder-icon")) continue;
      const name = icon.dataset.fileName || `${this.iconDataHelper.getIconName(icon)}.desktop`;
      const destDir = this.fs.resolveUserPath(["Desktop", folderName]);
      const destPath = this.fs.join(destDir, name);
      const destExists = await os.fs.exists(destPath);
      const finalName = destExists ? await this.fs.getUniqueFileName(["Desktop", folderName], name) : name;
      const fileContent = await os.fs.read(["Desktop", name]);
      await os.fs.write(["Desktop", folderName, finalName], fileContent);
      await os.fs.delete(["Desktop"], name);
      delete saved[this.positionStore.getKey(icon)];
      icon.remove();
      this.selectionManager.remove(icon);
      moved++;
    }
    this.positionStore.save(saved);
    this.selectionManager.clear();
    if (moved > 0) os.notify.send(`${moved} item${moved !== 1 ? "s" : ""} moved to "${folderName}"`);
  }

  async moveIconsToExplorer(icons, explorerWinId) {
    if (!this.explorerApp) return;
    const inst = this.explorerApp.getInstance(explorerWinId);
    if (!inst) return;

    await os.fs.mkdir(["Desktop"]);
    await os.fs.mkdir(inst.currentPath.length ? inst.currentPath : []);

    const saved = this.positionStore.load();
    let moved = 0;
    let applyToAllAction = null;

    for (const icon of icons) {
      const isDesktopFile = icon.classList.contains("desktop-file-icon");
      const isFolderIcon = icon.classList.contains("folder-icon");

      try {
        if (isDesktopFile) {
          const fileName = icon.dataset.fileName;
          const content = await this.fs.getFileContent(["Desktop"], fileName);
          const kind = await this.fs.getFileKind(["Desktop"], fileName);
          const fileIcon = await this.fs.getFileIcon(["Desktop"], fileName);

          const destDir = this.fs.resolveUserPath(inst.currentPath);
          const destFilePath = this.fs.join(destDir, fileName);
          const destExists = await os.fs.exists(destFilePath);

          let action = "replace";
          if (destExists) {
            if (applyToAllAction) {
              action = applyToAllAction;
            } else {
              const result = await showConflictDialog(fileName);
              if (result.applyToAll) applyToAllAction = result.action;
              action = result.action;
            }
          }

          if (action === "skip") continue;

          if (action === "replace") {
            await this.fs.updateFile(inst.currentPath, fileName, content);
            await this.fs.writeMeta(destDir, fileName, { kind, icon: fileIcon });
          } else {
            await this.fs.createFile(inst.currentPath, fileName, content, kind, fileIcon);
          }

          await os.fs.delete(["Desktop"], fileName);
          delete saved[this.positionStore.getKey(icon)];
          icon.remove();
          this.selectionManager.remove(icon);
          moved++;
        } else if (isFolderIcon) {
          const folderName = icon.dataset.folderName;
          const destPath = inst.currentPath.length ? inst.currentPath : [];
          await os.fs.mkdir([...destPath, folderName]);
          const srcEntries = await os.fs.readdir(["Desktop", folderName]).catch(() => ({}));

          for (const [childName, childData] of Object.entries(srcEntries)) {
            if (childData?.type !== "file") continue;

            const childContent = await this.fs.getFileContent(["Desktop", folderName], childName);
            const childKind = await this.fs.getFileKind(["Desktop", folderName], childName);
            const childIcon = await this.fs.getFileIcon(["Desktop", folderName], childName);

            const destDir = this.fs.resolveUserPath([...destPath, folderName]);
            const destFilePath = this.fs.join(destDir, childName);
            const childExists = await os.fs.exists(destFilePath);

            let action = "replace";
            if (childExists) {
              if (applyToAllAction) {
                action = applyToAllAction;
              } else {
                const result = await showConflictDialog(childName);
                if (result.applyToAll) applyToAllAction = result.action;
                action = result.action;
              }
            }

            if (action === "skip") continue;

            if (action === "replace") {
              await this.fs.updateFile([...destPath, folderName], childName, childContent);
              await this.fs.writeMeta(destDir, childName, { kind: childKind, icon: childIcon });
            } else {
              await this.fs.createFile([...destPath, folderName], childName, childContent, childKind, childIcon);
            }
          }

          await os.fs.delete(["Desktop"], folderName);
          delete saved[this.positionStore.getKey(icon)];
          icon.remove();
          this.selectionManager.remove(icon);
          moved++;
        } else {
          const fileName = icon.dataset.fileName || `${this.iconDataHelper.getIconName(icon)}.desktop`;
          const content = await this.fs.getFileContent(["Desktop"], fileName);

          const destDir = this.fs.resolveUserPath(inst.currentPath);
          const destFilePath = this.fs.join(destDir, fileName);
          const destExists = await os.fs.exists(destFilePath);

          let action = "replace";
          if (destExists) {
            if (applyToAllAction) {
              action = applyToAllAction;
            } else {
              const result = await showConflictDialog(fileName);
              if (result.applyToAll) applyToAllAction = result.action;
              action = result.action;
            }
          }

          if (action === "skip") continue;

          if (action === "replace") {
            await this.fs.updateFile(inst.currentPath, fileName, content);
          } else {
            await this.fs.createFile(inst.currentPath, fileName, content, "text");
          }

          await os.fs.delete(["Desktop"], fileName);
          delete saved[this.positionStore.getKey(icon)];
          icon.remove();
          this.selectionManager.remove(icon);
          moved++;
        }
      } catch (err) {
        console.error("moveIconsToExplorer error for icon:", err);
      }
    }

    this.positionStore.save(saved);
    this.selectionManager.clear();
    if (moved > 0) {
      const pathLabel = inst.currentPath.length ? inst.currentPath.join("/") : "Home";
      os.notify.send(`${moved} item${moved !== 1 ? "s" : ""} moved to ${pathLabel}`);
      await this.explorerApp.renderInstance(inst);
    }
  }

  async dropFromExplorer(name, isFile, sourcePath, clientX, clientY) {
    const rect = this.desktop.getBoundingClientRect();
    const leftPx = clientX - rect.left;
    const topPx = clientY - rect.top;

    if (isFile) {
      const existingIcon = $(`.desktop-file-icon[data-file-name="${CSS.escape(name)}"]`);
      if (existingIcon) {
        this.positionHelper.setPosition(existingIcon, leftPx - 40, topPx - 40);
        this.positionHelper.snap(existingIcon);
        return;
      }

      try {
        const kind = await os.fs.getFileKind([...sourcePath, name]);

        const destDir = this.fs.resolveUserPath(["Desktop"]);
        const destPath = this.fs.join(destDir, name);
        const destExists = await os.fs.exists(destPath);

        let action = "replace";
        if (destExists) {
          const result = await showConflictDialog(name);
          action = result.action;
        }

        if (action === "skip") return;

        let finalName = name;
        if (action === "keep") {
          finalName = await this.fs.getUniqueFileName(["Desktop"], name);
        }

        let content;
        if (kind === FileKind.IMAGE || kind === FileKind.VIDEO || kind === FileKind.AUDIO) {
          const blob = await os.fs.readBinaryFile([...sourcePath], name);
          content = blob;
          if (action === "replace") {
            await os.fs.writeBinaryFile(["Desktop"], name, blob, kind, null);
          } else {
            await os.fs.writeBinaryFile(["Desktop"], finalName, blob, kind, null);
          }
        } else {
          content = await os.fs.read([...sourcePath, name]);
          if (action === "replace") {
            await os.fs.write(["Desktop", name], content);
            await this.fs.writeMeta(destDir, name, { kind });
          } else {
            await os.fs.write(["Desktop", finalName], content);
            await this.fs.writeMeta(destDir, finalName, { kind });
          }
        }

        await os.fs.delete(sourcePath, name);

        const icon = await this.iconManager.createDesktopFileIcon(finalName, { content, kind });
        if (icon) {
          this.positionHelper.setPosition(icon, leftPx - 40, topPx - 40);
          this.positionHelper.snap(icon);
          const { col, row } = this.positionHelper.pixelsToCell(
            parseFloat(icon.style.left) || 0,
            parseFloat(icon.style.top) || 0
          );
          const saved = this.positionStore.load();
          saved[this.positionStore.getKey(icon)] = { col, row };
          this.positionStore.save(saved);
        }
        os.notify.send(`"${finalName}" moved to Desktop`);
      } catch {
        os.notify.send(`Could not move "${name}" to Desktop`);
      }
    } else {
      const existingIcon = $(`.folder-icon[data-folder-name="${CSS.escape(name)}"]`);
      if (existingIcon) {
        this.positionHelper.setPosition(existingIcon, leftPx - 40, topPx - 40);
        this.positionHelper.snap(existingIcon);
        return;
      }

      try {
        await os.fs.mkdir(["Desktop", name]);
        const srcEntries = await os.fs.readdir([...sourcePath, name]).catch(() => ({}));

        let applyToAllAction = null;

        for (const [childName, childData] of Object.entries(srcEntries)) {
          if (childData?.type !== "file") continue;

          const childContent = await this.fs.getFileContent([...sourcePath, name], childName);
          const childKind = await this.fs.getFileKind([...sourcePath, name], childName);

          const destDir = this.fs.resolveUserPath(["Desktop", name]);
          const destFilePath = this.fs.join(destDir, childName);
          const childExists = await os.fs.exists(destFilePath);

          let action = "replace";
          if (childExists) {
            if (applyToAllAction) {
              action = applyToAllAction;
            } else {
              const result = await showConflictDialog(childName);
              if (result.applyToAll) applyToAllAction = result.action;
              action = result.action;
            }
          }

          if (action === "skip") continue;

          if (action === "replace") {
            await this.fs.updateFile(["Desktop", name], childName, childContent);
            await this.fs.writeMeta(destDir, childName, { kind: childKind });
          } else {
            await this.fs.createFile(["Desktop", name], childName, childContent, childKind, null);
          }
        }

        await os.fs.delete(sourcePath, name);
        const icon = await this.iconManager.createFolderIcon(name);
        if (icon) {
          this.positionHelper.setPosition(icon, leftPx - 40, topPx - 40);
          this.positionHelper.snap(icon);
          const { col, row } = this.positionHelper.pixelsToCell(
            parseFloat(icon.style.left) || 0,
            parseFloat(icon.style.top) || 0
          );
          const saved = this.positionStore.load();
          saved[this.positionStore.getKey(icon)] = { col, row };
          this.positionStore.save(saved);
        }
        os.notify.send(`"${name}" folder moved to Desktop`);
      } catch {
        os.notify.send(`Could not move "${name}" to Desktop`);
      }
    }
  }

  async onDragEnd() {
    if (!this.state.isUserDragging) return;
    this.state.isUserDragging = false;
    const addedIcons = this.selectionManager.toArray();
    addedIcons.forEach((icon) => {
      os.events.emit(BusEvents.DESKTOP_ICON_ADDED, { icon: icon.dataset.icon || icon.querySelector("img")?.src || "" });
    });

    if (this.state.explorerDragTarget) {
      const explorerWin = this.state.explorerDragTarget;
      explorerWin.querySelector("[id$='-view']")?.style.setProperty("outline", "");
      this.state.explorerDragTarget = null;
      this.selectionManager.forEach((icon) =>
        Object.assign(icon.style, { opacity: "1", zIndex: "1", cursor: "default" })
      );
      await this.moveIconsToExplorer(this.selectionManager.toArray(), explorerWin.id);
      return;
    }

    if (this.state.dragTarget) {
      this.selectionManager.forEach((icon) =>
        Object.assign(icon.style, { opacity: "1", zIndex: "1", cursor: "default" })
      );
      await this.moveIconsToFolder(this.selectionManager.toArray(), this.state.dragTarget.dataset.folderName);
      this.state.dragTarget.style.outline = "";
      this.state.dragTarget = null;
    } else {
      const saved = this.positionStore.load();
      this.selectionManager.forEach((icon) => {
        this.positionHelper.snap(icon);
        Object.assign(icon.style, { opacity: "1", zIndex: "1", cursor: "default" });
        const { col, row } = this.positionHelper.pixelsToCell(
          parseFloat(icon.style.left) || 0,
          parseFloat(icon.style.top) || 0
        );
        saved[this.positionStore.getKey(icon)] = { col, row };
      });
      this.positionStore.save(saved);
    }
  }

  onDragStart() {
    this.state.isUserDragging = true;
    this.selectionManager.forEach((icon) =>
      Object.assign(icon.style, { opacity: "0.7", zIndex: "1200", cursor: "move" })
    );
  }

  onDragMove(event) {
    const { dx, dy } = event;
    this.selectionManager.forEach((icon) => {
      this.positionHelper.setPosition(
        icon,
        Math.max(0, (parseFloat(icon.style.left) || 0) + dx),
        Math.max(0, (parseFloat(icon.style.top) || 0) + dy)
      );
    });
    this.updateDragTarget(event);
  }
}
