import { createElement } from "./domUtils.js";

export function showConflictDialog(fileName) {
  return new Promise((resolve) => {
    const overlay = createElement("div");
    overlay.className = "explorer-confirmation-overlay";

    const dialog = createElement("div");
    dialog.className = "overlay-dialog";

    const header = createElement("div");
    header.className = "conflict-header";

    const icon = createElement("i");
    icon.className = "fas fa-exclamation-triangle conflict-icon";

    const title = createElement("span");
    title.className = "conflict-title";
    title.textContent = "File already exists";

    header.appendChild(icon);
    header.appendChild(title);

    const message = createElement("div");
    message.className = "conflict-message";

    const fileSpan = createElement("span");
    fileSpan.className = "conflict-file";
    fileSpan.textContent = `"${fileName}"`;

    message.appendChild(fileSpan);
    message.appendChild(document.createTextNode(" already exists in this location.\nWhat would you like to do?"));

    const actions = createElement("div");
    actions.className = "conflict-actions";

    const replaceBtn = createElement("button");
    replaceBtn.className = "conflict-btn conflict-btn-replace";
    replaceBtn.dataset.action = "replace";

    const replaceIcon = createElement("i");
    replaceIcon.className = "fas fa-redo conflict-btn-icon";

    replaceBtn.appendChild(replaceIcon);
    replaceBtn.appendChild(document.createTextNode("Replace existing file"));

    const keepBtn = createElement("button");
    keepBtn.className = "conflict-btn conflict-btn-keep";
    keepBtn.dataset.action = "keep";

    const keepIcon = createElement("i");
    keepIcon.className = "fas fa-copy conflict-btn-icon";

    keepBtn.appendChild(keepIcon);
    keepBtn.appendChild(document.createTextNode("Keep both files"));

    const skipBtn = createElement("button");
    skipBtn.className = "conflict-btn conflict-btn-skip";
    skipBtn.dataset.action = "skip";

    const skipIcon = createElement("i");
    skipIcon.className = "fas fa-ban conflict-btn-icon";

    skipBtn.appendChild(skipIcon);
    skipBtn.appendChild(document.createTextNode("Skip this file"));

    actions.appendChild(replaceBtn);
    actions.appendChild(keepBtn);
    actions.appendChild(skipBtn);

    const footer = createElement("label");
    footer.className = "conflict-footer";

    const checkbox = createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = "conflict-apply-all";

    const footerText = createElement("span");
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
      btn.addEventListener("mouseenter", () => (btn.style.background = "var(--surface-hover)"));
      btn.addEventListener("mouseleave", () => (btn.style.background = "var(--surface-2)"));
      btn.addEventListener("click", () => {
        const action = btn.dataset.action;
        const applyToAll = dialog.querySelector("#conflict-apply-all").checked;
        overlay.remove();
        resolve({ action, applyToAll });
      });
    });
  });
}
