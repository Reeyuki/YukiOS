import { showConflictDialog } from "../shared/conflictDialog.js";
import { FileKind } from "../shared/fileKindDetector.js";
import { os, $ } from "../framework.js";

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

  buildDesktopClipboard(action, icons) {
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

  async pasteToDesktop() {
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
            const kind = await this.fs.getFileKind(srcPath, name);
            const isBinary = kind === FileKind.IMAGE || kind === FileKind.VIDEO || kind === FileKind.AUDIO;

            let content;
            if (isBinary) {
              content = await os.fs.readBinaryFile(srcPath, name);
            } else {
              content = await this.fs.getFileContent(srcPath, name);
            }

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
              if (isBinary) {
                await os.fs.writeBinaryFile(["Desktop"], name, content, kind, null);
              } else {
                await os.fs.createFile(["Desktop"], name, content, kind, null);
              }
            } else {
              if (isBinary) {
                await os.fs.writeBinaryFile(["Desktop"], finalName, content, kind, null);
              } else {
                await os.fs.createFile(["Desktop"], finalName, content, kind, null);
              }
            }

            if (action === "cut") await os.fs.delete(srcPath, name);

            const existingIcon = $(`.desktop-file-icon[data-file-name="${CSS.escape(finalName)}"]`);
            if (!existingIcon) await this.iconManager.createDesktopFileIcon(finalName, { content, kind });
            pastedCount++;
          } else {
            const destFolderPath = this.fs.join(this.fs.resolveUserPath(["Desktop"]), name);
            const destFolderExists = await os.fs.exists(destFolderPath);

            let finalFolderName = name;
            if (destFolderExists) {
              let resolvedAction = "replace";
              if (applyToAllAction) {
                resolvedAction = applyToAllAction;
              } else {
                const result = await showConflictDialog(name);
                if (result.applyToAll) applyToAllAction = result.action;
                resolvedAction = result.action;
              }
              if (resolvedAction === "skip") continue;
              if (resolvedAction === "keep") {
                finalFolderName = await this.fs.getUniqueFileName(["Desktop"], name);
              }
            }

            await os.fs.mkdir(["Desktop", finalFolderName]);
            const srcEntries = await os.fs.readdir([...srcPath, name]).catch(() => ({}));

            for (const [childName, childData] of Object.entries(srcEntries)) {
              if (childData?.type !== "file") continue;

              const childKind = await this.fs.getFileKind([...srcPath, name], childName);
              const isChildBinary =
                childKind === FileKind.IMAGE || childKind === FileKind.VIDEO || childKind === FileKind.AUDIO;

              let childContent;
              if (isChildBinary) {
                childContent = await os.fs.readBinaryFile([...srcPath, name], childName);
              } else {
                childContent = await this.fs.getFileContent([...srcPath, name], childName);
              }

              const childDestDir = this.fs.resolveUserPath(["Desktop", finalFolderName]);
              const childDestPath = this.fs.join(childDestDir, childName);
              const childExists = await os.fs.exists(childDestPath);

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
                await os.fs.delete(["Desktop", finalFolderName], childName).catch(() => {});
                if (isChildBinary) {
                  await os.fs.writeBinaryFile(["Desktop", finalFolderName], childName, childContent, childKind, null);
                } else {
                  await os.fs.createFile(["Desktop", finalFolderName], childName, childContent, childKind, null);
                }
              } else {
                if (isChildBinary) {
                  await os.fs.writeBinaryFile(["Desktop", finalFolderName], childName, childContent, childKind, null);
                } else {
                  await os.fs.createFile(["Desktop", finalFolderName], childName, childContent, childKind, null);
                }
              }
            }

            if (action === "cut") await os.fs.delete(srcPath, name);

            const existingFolder = $(`.folder-icon[data-folder-name="${CSS.escape(finalFolderName)}"]`);
            if (!existingFolder) await this.iconManager.createFolderIcon(finalFolderName);
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
