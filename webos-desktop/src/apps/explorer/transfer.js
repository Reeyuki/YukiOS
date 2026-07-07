import { os } from "../../framework.js";
import { FileKind } from "../../shared/fileKindDetector.js";

import { zipSync } from "fflate";
import { $, $$, setStyle } from "../../shared/domUtils.js";
import { pluralize } from "../../utils/utils.js";
import { showArchiveDialog } from "./dialogs.js";

export async function pasteToPath(explorer, destPath, inst) {
  const cb = explorer._getClipboard();
  if (!cb) return;

  const { action } = cb;
  let pastedCount = 0;
  let applyToAllAction = null;

  const copyFile = async (name, srcPath) => {
    const kind = await explorer.fs.getFileKind(srcPath, name);
    const fileIcon = await explorer.fs.getFileIcon(srcPath, name);

    const destDir = explorer.fs.resolveUserPath(destPath);
    const destFilePath = explorer.fs.join(destDir, name);
    const destExists = await os.fs.exists(destFilePath);

    let resolvedAction = "replace";
    if (destExists) {
      const result = await resolveConflictAction(name, applyToAllAction);
      if (result.applyToAll) applyToAllAction = result.action;
      resolvedAction = result.action;
    }

    if (resolvedAction === "skip") return null;

    let finalName = resolvedAction === "keep" ? await explorer.fs.getUniqueFileName(destPath, name) : name;

    const content = await explorer.fs.getFileContent(srcPath, name);
    if (resolvedAction === "replace") {
      await os.fs.delete(destPath, name).catch(() => {});
      await os.fs.createFile(destPath, name, content, kind, fileIcon);
    } else {
      await os.fs.createFile(destPath, finalName, content, kind, fileIcon);
    }

    return finalName;
  };

  const copyFolder = async (name, srcBasePath) => {
    const uniqueName = action === "copy" ? await explorer.fs.getUniqueFileName(destPath, name) : name;
    await os.fs.mkdir([...destPath, uniqueName]);
    const srcEntries = await os.fs.readdir([...srcBasePath, name]).catch(() => ({}));

    for (const [childName, childData] of Object.entries(srcEntries)) {
      if (childData?.type !== "file") continue;

      const childPath = [...srcBasePath, name];
      const childContent = await explorer.fs.getFileContent(childPath, childName);
      const childKind = await explorer.fs.getFileKind(childPath, childName);
      const childIcon = await explorer.fs.getFileIcon(childPath, childName);
      const destFolderPath = [...destPath, uniqueName];
      const destDir = explorer.fs.resolveUserPath(destFolderPath);
      const childExists = await os.fs.exists(explorer.fs.join(destDir, childName));

      let resolvedAction = "replace";
      if (childExists) {
        const result = await resolveConflictAction(childName, applyToAllAction);
        if (result.applyToAll) applyToAllAction = result.action;
        resolvedAction = result.action;
      }

      if (resolvedAction === "skip") continue;

      if (resolvedAction === "replace") {
        await explorer.fs.updateFile(destFolderPath, childName, childContent);
        await explorer.fs.writeMeta(destDir, childName, { kind: childKind, icon: childIcon });
      } else {
        await explorer.fs.createFile(destFolderPath, childName, childContent, childKind, childIcon);
      }
    }

    return uniqueName;
  };

  if (cb.source === "explorer") {
    for (const iconData of cb.icons) {
      const { name, path: srcPath, isFile } = iconData.data;
      try {
        if (isFile) {
          const result = await copyFile(name, srcPath);
          if (result !== null) {
            if (action === "cut") await os.fs.delete(srcPath, name);
            pastedCount++;
          }
        } else {
          await copyFolder(name, srcPath);
          if (action === "cut") await os.fs.delete(srcPath, name);
          pastedCount++;
        }
      } catch {
        os.notify.send(`Could not paste "${name}"`);
      }
    }

    if (action === "cut") {
      explorer._setClipboard(null);
      if (cb.sourceInst) await explorer.renderInstance(cb.sourceInst);
    }
  } else if (cb.source === "desktop") {
    for (const iconData of cb.icons) {
      const { isDesktopFile, isFolderIcon, fileName, folderName, app, name } = iconData.data;
      try {
        if (isDesktopFile) {
          const result = await copyFile(fileName, ["Desktop"]);
          if (result !== null) {
            if (action === "cut") {
              await os.fs.delete(["Desktop"], fileName);
              iconData.element?.remove();
            }
            pastedCount++;
          }
        } else if (isFolderIcon) {
          await copyFolder(folderName, ["Desktop"]);
          if (action === "cut") {
            await os.fs.delete(["Desktop"], folderName);
            iconData.element?.remove();
          }
          pastedCount++;
        } else {
          const srcFileName = `${name || app}.desktop`;
          const result = await copyFile(srcFileName, ["Desktop"]);
          if (result !== null) {
            if (action === "cut") iconData.element?.remove();
            pastedCount++;
          }
        }
      } catch {
        os.notify.send("Could not paste item");
      }
    }

    if (action === "cut") explorer._setClipboard(null);
  }

  if (pastedCount > 0) {
    os.notify.send(`${pastedCount} ${pluralize(pastedCount, "item")} pasted`);
    await explorer.renderInstance(inst);
  }
}

async function resolveConflictAction(name, applyToAllAction) {
  if (applyToAllAction) return { action: applyToAllAction, applyToAll: false };
  const { showConflictDialog } = await import("../../shared/conflictDialog.js");
  return showConflictDialog(name);
}

export async function downloadItems(explorer, itemName, isFile, inst) {
  const effectiveItems =
    inst.selectedItems.size > 1 && inst.selectedItems.has(itemName) ? [...inst.selectedItems] : [itemName];

  if (effectiveItems.length === 1 && isFile) {
    const content = await os.fs.read([...inst.currentPath, itemName]);
    const data = content || (await explorer.fs.getFileContent(inst.currentPath, itemName)) || "";
    const src = URL.createObjectURL(new Blob([data]));
    const a = document.createElement("a");
    a.href = src;
    a.download = itemName;
    a.click();
    URL.revokeObjectURL(src);
    return;
  }

  const folder = inst._cachedFolder || (await os.fs.readdir(inst.currentPath));
  const zipEntries = {};

  for (const name of effectiveItems) {
    const entry = folder[name];
    if (!entry || entry.type !== "file") continue;
    const blob = await os.fs.read([...inst.currentPath, name]);
    if (blob) {
      zipEntries[name] = new Uint8Array(await blob.arrayBuffer());
    } else {
      const text = await explorer.fs.getFileContent(inst.currentPath, name);
      zipEntries[name] = new TextEncoder().encode(typeof text === "string" ? text : "");
    }
  }

  const zipped = zipSync(zipEntries);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([zipped], { type: "application/zip" }));
  a.download = "archive.zip";
  a.click();
  URL.revokeObjectURL(a.href);
}

export async function createArchiveFromItems(explorer, itemName, isFile, inst) {
  const effectiveItems =
    inst.selectedItems.size > 1 && inst.selectedItems.has(itemName) ? [...inst.selectedItems] : [itemName];

  let defaultName = "archive";
  if (effectiveItems.length === 1) {
    const singleItem = effectiveItems[0];
    const dotIndex = singleItem.lastIndexOf(".");
    defaultName = dotIndex > 0 ? singleItem.substring(0, dotIndex) : singleItem;
  }

  showArchiveDialog({
    title: "Create Archive",
    defaultValue: defaultName,
    onConfirm: async (archiveName, archiveType, compressionLevel) => {
      os.notify.send("Creating archive...");

      const folder = inst._cachedFolder || (await os.fs.readdir(inst.currentPath));
      const items = effectiveItems.map((item) => ({
        path: inst.currentPath,
        name: item,
        isFile: folder[item]?.type === "file"
      }));

      const result = await explorer._archiveExtractor.createArchive(items, {
        format: archiveType,
        compressionLevel,
        outputPath: inst.currentPath,
        archiveName
      });

      if (result.success) {
        await explorer.renderInstance(inst);
        os.notify.send(`Archive "${result.name}" created`);
      }
    }
  });
}
