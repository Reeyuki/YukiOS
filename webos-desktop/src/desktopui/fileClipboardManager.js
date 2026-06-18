import { showConflictDialog } from "../shared/conflictDialog.js";
import { os } from "../os/index.js";

export class ClipboardManager {
  constructor(fs, positionStore, deletedIconsStore, iconManager, iconDataHelper, explorerApp) {
    this.fs = fs;
    this.positionStore = positionStore;
    this.deletedIconsStore = deletedIconsStore;
    this.iconManager = iconManager;
    this.iconDataHelper = iconDataHelper;
    this.explorerApp = explorerApp;
    this.clipboard = null;
  }

  setClipboard(data) {
    this.clipboard = data;
  }

  getClipboard() {
    return this.clipboard;
  }

  _buildDesktopClipboard(action, icons) {
    return {
      source: "desktop",
      action,
      icons: icons.map((icon) => ({
        element: icon,
        data: {
          app: icon.dataset.app,
          name: icon.dataset.fileName || this.iconDataHelper.getIconName(icon),
          fileName: icon.dataset.fileName || null,
          folderName: icon.dataset.folderName || null,
          isDesktopFile: icon.classList.contains("desktop-file-icon"),
          isFolderIcon: icon.classList.contains("folder-icon"),
          innerHTML: icon.innerHTML
        }
      })),
      sourceInst: null
    };
  }

  async _pasteToDesktop() {
    if (!this.clipboard) return;
    const cb = this.clipboard;
    const action = cb.action;
    let pastedCount = 0;
    let applyToAllAction = null;

    if (cb.source === "explorer") {
      for (const iconData of cb.icons) {
        const name = iconData.data.name;
        const srcPath = iconData.data.path;
        const isFile = iconData.data.isFile !== false;

        try {
          if (isFile) {
            const content = await this.fs.getFileContent(srcPath, name);
            const kind = await this.fs.getFileKind(srcPath, name);
            const fileIcon = await this.fs.getFileIcon(srcPath, name);

            const destDir = this.fs.resolveUserPath(["Desktop"]);
            const destFilePath = this.fs.join(destDir, name);
            const destExists = await os.fs.exists(destFilePath);

            let resolvedAction = "replace";
            if (destExists) {
              if (applyToAllAction) {
                resolvedAction = applyToAllAction;
              } else {
                const result = await showConflictDialog(name);
                if (result.applyToAll) applyToAllAction = result.action;
                resolvedAction = result.action;
              }
            }

            if (resolvedAction === "skip") continue;

            let finalName = name;
            if (resolvedAction === "keep") {
              finalName = await this.fs.getUniqueFileName(["Desktop"], name);
            }

            if (resolvedAction === "replace") {
              await os.fs.delete(["Desktop"], name).catch(() => {});
              await os.fs.createFile(["Desktop"], name, content, kind, fileIcon);
            } else {
              await os.fs.createFile(["Desktop"], finalName, content, kind, fileIcon);
            }

            if (action === "cut") await os.fs.delete(srcPath, name);

            const existingIcon = document.querySelector(
              `.desktop-file-icon[data-file-name="${CSS.escape(finalName)}"]`
            );
            if (!existingIcon)
              await this.iconManager.createDesktopFileIcon(finalName, { content, kind, icon: fileIcon });
            pastedCount++;
          } else {
            await os.fs.mkdir(["Desktop", name]);
            const srcEntries = await os.fs.readdir([...srcPath, name]).catch(() => ({}));

            for (const [childName, childData] of Object.entries(srcEntries)) {
              if (childData?.type !== "file") continue;

              const childContent = await this.fs.getFileContent([...srcPath, name], childName);
              const childKind = await this.fs.getFileKind([...srcPath, name], childName);
              const childIcon = await this.fs.getFileIcon([...srcPath, name], childName);

              const destDir = this.fs.resolveUserPath(["Desktop", name]);
              const destFilePath = this.fs.join(destDir, childName);
              const childExists = await os.fs.exists(destFilePath);

              let resolvedAction = "replace";
              if (childExists) {
                if (applyToAllAction) {
                  resolvedAction = applyToAllAction;
                } else {
                  const result = await showConflictDialog(childName);
                  if (result.applyToAll) applyToAllAction = result.action;
                  resolvedAction = result.action;
                }
              }

              if (resolvedAction === "skip") continue;

              if (resolvedAction === "replace") {
                await this.fs.updateFile(["Desktop", name], childName, childContent);
                await this.fs.writeMeta(destDir, childName, { kind: childKind, icon: childIcon });
              } else {
                await this.fs.createFile(["Desktop", name], childName, childContent, childKind, childIcon);
              }
            }

            if (action === "cut") await os.fs.delete(srcPath, name);

            const existingFolder = document.querySelector(`.folder-icon[data-folder-name="${CSS.escape(name)}"]`);
            if (!existingFolder) await this.iconManager.createFolderIcon(name);
            pastedCount++;
          }
        } catch {
          os.notify.send(`Could not paste "${name}"`);
        }
      }

      if (action === "cut") {
        this.clipboard = null;
        if (cb.sourceInst) await this.explorerApp.renderInstance(cb.sourceInst);
      }
    } else if (cb.source === "desktop") {
      for (const iconData of cb.icons) {
        const { isDesktopFile, isFolderIcon, fileName, folderName, app, name, innerHTML } = iconData.data;
        const element = iconData.element;

        try {
          if (isDesktopFile) {
            const srcName = fileName;
            const content = await this.fs.getFileContent(["Desktop"], srcName);
            const kind = await this.fs.getFileKind(["Desktop"], srcName);
            const fileIcon = await this.fs.getFileIcon(["Desktop"], srcName);

            if (action === "copy") {
              const uniqueName = await this.fs.getUniqueFileName(["Desktop"], srcName);
              await this.fs.createFile(["Desktop"], uniqueName, content, kind, fileIcon);
              await this.iconManager.createDesktopFileIcon(uniqueName, { content, kind, icon: fileIcon });
            }
            pastedCount++;
          } else if (isFolderIcon) {
            const srcName = folderName;

            if (action === "copy") {
              let uniqueName = await this.fs.getUniqueFileName(["Desktop"], srcName);
              await os.fs.mkdir(["Desktop", uniqueName]);
              const srcEntries = await os.fs.readdir(["Desktop", srcName]).catch(() => ({}));

              for (const [childName, childData] of Object.entries(srcEntries)) {
                if (childData?.type !== "file") continue;
                const childContent = await this.fs.getFileContent(["Desktop", srcName], childName);
                const childKind = await this.fs.getFileKind(["Desktop", srcName], childName);
                const childIcon = await this.fs.getFileIcon(["Desktop", srcName], childName);
                await os.fs.createFile(["Desktop", uniqueName], childName, childContent, childKind, childIcon);
              }

              await this.iconManager.createFolderIcon(uniqueName);
            }
            pastedCount++;
          } else {
            const iconName = name || this.iconDataHelper.getIconName(element || { querySelector: () => null });
            const srcFileName = `${iconName}.desktop`;
            const content = await os.fs.read(["Desktop", srcFileName]);

            if (action === "copy") {
              const uniqueName = await this.fs.getUniqueFileName(["Desktop"], srcFileName);
              await os.fs.write(["Desktop"], uniqueName, content);
            }
            pastedCount++;
          }
        } catch {
          os.notify.send(`Could not paste item`);
        }
      }

      if (action === "cut") {
        this.clipboard = null;
      }
    }

    if (pastedCount > 0) {
      os.notify.send(`${pastedCount} item${pastedCount !== 1 ? "s" : ""} pasted`);
    }
  }

  async deleteSelectedIcons(selectedArray, selectionManager) {
    if (!selectedArray || selectedArray.length === 0) return;

    const saved = this.positionStore.load();
    const count = selectedArray.length;

    for (const icon of selectedArray) {
      const key = this.positionStore.getKey(icon);
      delete saved[key];

      const fileName = icon.dataset.fileName;
      const folderName = icon.dataset.folderName;

      try {
        if (fileName) {
          await os.fs.trashFile(["Desktop"], fileName);
        } else if (folderName) {
          await os.fs.trashFile(["Desktop"], folderName);
        } else if (icon.dataset.app) {
          this.deletedIconsStore.add(key);
        }
      } catch (err) {
        console.error("Failed to delete desktop item:", err);
      }

      selectionManager.remove(icon);
      icon.remove();
    }

    this.positionStore.save(saved);
    os.notify.send(`${count} item${count !== 1 ? "s" : ""} moved to trash`);
  }

  async moveSelectedIconsToTrash(selectedArray, selectionManager) {
    if (!selectedArray || selectedArray.length === 0) return;

    const saved = this.positionStore.load();
    const count = selectedArray.length;

    for (const icon of selectedArray) {
      const key = this.positionStore.getKey(icon);
      delete saved[key];

      const fileName = icon.dataset.fileName;
      const folderName = icon.dataset.folderName;

      try {
        if (fileName) {
          await os.fs.trashFile(["Desktop"], fileName);
        } else if (folderName) {
          await os.fs.trashFile(["Desktop"], folderName);
        } else if (icon.dataset.app) {
          this.deletedIconsStore.add(key);
        }
      } catch (err) {
        console.error("Failed to move desktop item to trash:", err);
      }

      selectionManager.remove(icon);
      icon.remove();
    }

    this.positionStore.save(saved);
    os.notify.send(`${count} item${count !== 1 ? "s" : ""} moved to trash`);
  }
}
