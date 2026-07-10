import { os } from "../framework.js";
import { showFileProperties } from "../fileDisplay.js";

export function buildCopyAction(selectedArray, desktopUI) {
  return () => {
    desktopUI.setClipboard(desktopUI.buildDesktopClipboard("copy", selectedArray));
    os.notify.send(`${selectedArray.length} item${selectedArray.length !== 1 ? "s" : ""} copied`);
  };
}

export function buildCutAction(selectedArray, desktopUI) {
  return () => {
    desktopUI.setClipboard(desktopUI.buildDesktopClipboard("cut", selectedArray));
    selectedArray.forEach((i) => (i.style.opacity = "0.5"));
    os.notify.send(`${selectedArray.length} item${selectedArray.length !== 1 ? "s" : ""} cut`);
  };
}

export function buildDeleteAction(selectedArray, desktopUI) {
  return () => desktopUI.moveSelectedIconsToTrash(selectedArray);
}

export function buildRenameAction(icon, desktopUI, options = {}) {
  const { PositionStore, IconDataHelper } = options;
  return async () => {
    const currentName = IconDataHelper
      ? IconDataHelper.getIconName(icon)
      : icon.dataset.folderName || icon.dataset.fileName || "";
    const newName = await os.dialog.prompt("Prompt", "Enter new name:", currentName);
    if (!newName || newName === currentName) return;

    if (icon.classList.contains("folder-icon")) {
      await desktopUI.fs.renameItem(["Desktop"], currentName, newName, true);
      const saved = PositionStore ? PositionStore.load() : null;
      const oldKey = PositionStore ? PositionStore.getKey(icon) : null;
      icon.dataset.folderName = newName;
      if (saved && oldKey) {
        const newKey = PositionStore.getKey(icon);
        if (saved[oldKey]) {
          saved[newKey] = saved[oldKey];
          delete saved[oldKey];
          PositionStore.save(saved);
        }
      }
    } else {
      if (icon.dataset.fileName) {
        let targetName = newName;
        if (icon.dataset.fileName.endsWith(".desktop") && !newName.endsWith(".desktop")) {
          targetName += ".desktop";
        }
        await desktopUI.fs.renameItem(["Desktop"], icon.dataset.fileName, targetName, true);
        icon.dataset.fileName = targetName;
      }
    }

    icon.querySelector("span, div").textContent = newName;
    os.notify.send(`Renamed to "${newName}"`);
  };
}

export function buildPropertiesAction(icon, desktopUI) {
  return () => {
    if (icon.dataset.fileName) {
      showFileProperties(["Desktop", icon.dataset.fileName], icon.dataset.fileName, false);
    } else if (icon.dataset.folderName) {
      showFileProperties(["Desktop", icon.dataset.folderName], icon.dataset.folderName, true);
    } else {
      desktopUI.showPropertiesDialog(icon);
    }
  };
}
