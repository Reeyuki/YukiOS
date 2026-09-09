import { os } from "../framework.js";
import { buildFileIconHTML } from "../fileDisplay.js";
import { showFileProperties } from "../fileDisplay.js";

export function buildCopyAction(selectedArray, desktopUI) {
  return () => {
    desktopUI.setClipboard(desktopUI.buildDesktopClipboard("copy", selectedArray));
  };
}

export function buildCutAction(selectedArray, desktopUI) {
  return () => {
    desktopUI.setClipboard(desktopUI.buildDesktopClipboard("cut", selectedArray));
    selectedArray.forEach((i) => (i.style.opacity = "0.5"));
  };
}

export function buildDeleteAction(selectedArray, desktopUI) {
  return () => desktopUI.moveSelectedIconsToTrash(selectedArray);
}

export function buildRenameAction(icon, desktopUI, options = {}) {
  const { PositionStore } = options;
  return async () => {
    let currentName = "";
    if (icon.dataset.folderName !== undefined && icon.dataset.folderName !== "") {
      currentName = icon.dataset.folderName;
    } else if (icon.dataset.fileName !== undefined && icon.dataset.fileName !== "") {
      currentName = icon.dataset.fileName;
    } else {
      const labelEl = icon.querySelector("div:last-child");
      const labelText = labelEl?.textContent?.trim();
      if (labelText !== undefined && labelText !== null) {
        currentName = labelText;
      }
    }
    if (currentName.endsWith(".desktop")) {
      currentName = currentName.slice(0, -8);
    }
    const newNameRaw = await os.dialog.prompt("Prompt", "Enter new name:", currentName);
    if (!newNameRaw) return;
    const newName = newNameRaw.trim();
    if (!newName || newName === currentName) return;

    let displayName = newName;
    let targetName = newName;
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
        if (icon.dataset.fileName.endsWith(".desktop") && !newName.endsWith(".desktop")) {
          targetName += ".desktop";
        }
        await desktopUI.fs.renameItem(["Desktop"], icon.dataset.fileName, targetName, true);
        icon.dataset.fileName = targetName;
        displayName = targetName.endsWith(".desktop") ? targetName.slice(0, -8) : targetName;
      }
    }

    const label = icon.querySelector("div:last-child");
    if (label) {
      label.textContent = displayName;
      label.title = displayName;
    }
    const first = icon.firstElementChild;
    if (first && first !== label && !first.querySelector("i, img, svg") && first.textContent.trim()) {
      try {
        const iconHTML = buildFileIconHTML(targetName, { size: 64, radius: 12 });
        const tmp = document.createElement("div");
        tmp.innerHTML = iconHTML.trim();
        const fresh = tmp.firstElementChild;
        if (fresh) first.replaceWith(fresh);
      } catch {}
    }
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
