export function showConflictDialog(fileName) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "explorer-confirmation-overlay";

    const dialog = document.createElement("div");
    dialog.className = "overlay-dialog";

    const header = document.createElement("div");
    header.className = "conflict-header";

    const icon = document.createElement("i");
    icon.className = "fas fa-exclamation-triangle conflict-icon";

    const title = document.createElement("span");
    title.className = "conflict-title";
    title.textContent = "File already exists";

    header.appendChild(icon);
    header.appendChild(title);

    const message = document.createElement("div");
    message.className = "conflict-message";

    const fileSpan = document.createElement("span");
    fileSpan.className = "conflict-file";
    fileSpan.textContent = `"${fileName}"`;

    message.appendChild(fileSpan);
    message.appendChild(document.createTextNode(" already exists in this location.\nWhat would you like to do?"));

    const actions = document.createElement("div");
    actions.className = "conflict-actions";

    const replaceBtn = document.createElement("button");
    replaceBtn.className = "conflict-btn conflict-btn-replace";
    replaceBtn.dataset.action = "replace";

    const replaceIcon = document.createElement("i");
    replaceIcon.className = "fas fa-redo conflict-btn-icon";

    replaceBtn.appendChild(replaceIcon);
    replaceBtn.appendChild(document.createTextNode("Replace existing file"));

    const keepBtn = document.createElement("button");
    keepBtn.className = "conflict-btn conflict-btn-keep";
    keepBtn.dataset.action = "keep";

    const keepIcon = document.createElement("i");
    keepIcon.className = "fas fa-copy conflict-btn-icon";

    keepBtn.appendChild(keepIcon);
    keepBtn.appendChild(document.createTextNode("Keep both files"));

    const skipBtn = document.createElement("button");
    skipBtn.className = "conflict-btn conflict-btn-skip";
    skipBtn.dataset.action = "skip";

    const skipIcon = document.createElement("i");
    skipIcon.className = "fas fa-ban conflict-btn-icon";

    skipBtn.appendChild(skipIcon);
    skipBtn.appendChild(document.createTextNode("Skip this file"));

    actions.appendChild(replaceBtn);
    actions.appendChild(keepBtn);
    actions.appendChild(skipBtn);

    const footer = document.createElement("label");
    footer.className = "conflict-footer";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = "_conflict-apply-all";

    const footerText = document.createElement("span");
    footerText.textContent = "Apply this choice to all remaining conflicts";

    footer.appendChild(checkbox);
    footer.appendChild(footerText);

    dialog.appendChild(header);
    dialog.appendChild(message);
    dialog.appendChild(actions);
    dialog.appendChild(footer);

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    dialog.querySelectorAll("button[data-action]").forEach((btn) => {
      btn.addEventListener("mouseenter", () => (btn.style.background = "#45475a"));
      btn.addEventListener("mouseleave", () => (btn.style.background = "#313244"));
      btn.addEventListener("click", () => {
        const action = btn.dataset.action;
        const applyToAll = dialog.querySelector("#_conflict-apply-all").checked;
        overlay.remove();
        resolve({ action, applyToAll });
      });
    });
  });
}

export async function resolveConflicts(items, existsCheck, getKey, applyToAllInit = null) {
  let applyToAllAction = applyToAllInit;
  const results = [];

  for (const item of items) {
    const key = getKey(item);
    const exists = await existsCheck(item, key);

    if (!exists) {
      results.push({ item, action: "replace" });
      continue;
    }

    let action;
    if (applyToAllAction) {
      action = applyToAllAction;
    } else {
      const result = await showConflictDialog(key);
      if (result.applyToAll) applyToAllAction = result.action;
      action = result.action;
    }

    results.push({ item, action });
  }

  return results;
}
