import { createElement, $ } from "../../shared/domUtils.js";

export function showDeckDialog(options) {
  const {
    title,
    message,
    type = "default",
    confirmText = "Confirm",
    cancelText = "Cancel",
    onConfirm,
    onCancel,
    inputValue,
    container
  } = options;

  const dialog = createElement("div", { className: "deck-carousel-dialog" });
  const isDanger = type === "danger";
  const hasInput = type === "input";

  let html = `
    <div class="deck-carousel-dialog-content ${isDanger ? "deck-carousel-dialog-danger" : ""}">
      <div class="deck-carousel-dialog-title">${title}</div>
  `;

  if (message) {
    html += `<div class="deck-carousel-dialog-message">${message}</div>`;
  }

  if (hasInput) {
    html += `<input type="text" class="deck-carousel-dialog-input" value="${inputValue || ""}">`;
  }

  html += `
      <div class="deck-carousel-dialog-buttons">
        ${cancelText ? `<button class="deck-carousel-dialog-btn deck-carousel-dialog-cancel">${cancelText}</button>` : ""}
        <button class="deck-carousel-dialog-btn deck-carousel-dialog-confirm">${confirmText}</button>
      </div>
    </div>
  `;

  dialog.innerHTML = html;
  container.appendChild(dialog);

  const input = hasInput ? $("input", dialog) : null;
  const cancelBtn = $(".deck-carousel-dialog-cancel", dialog);
  const confirmBtn = $(".deck-carousel-dialog-confirm", dialog);

  if (hasInput && input) {
    input.focus();
    input.select();
  }

  const close = () => {
    dialog.remove();
    if (onCancel) onCancel(false);
  };

  if (cancelBtn) {
    cancelBtn.addEventListener("click", close);
  }

  confirmBtn.addEventListener("click", () => {
    const result = hasInput ? input.value.trim() : true;
    if (onConfirm) onConfirm(result);
    if (!hasInput || result) close();
  });

  if (hasInput && input) {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") confirmBtn.click();
      if (e.key === "Escape") close();
    });
  }

  return { close, dialog };
}

export function showDeckConfirm(container, title, message, onConfirm) {
  return showDeckDialog({
    container,
    title,
    message,
    type: "danger",
    confirmText: "Confirm",
    cancelText: "Cancel",
    onConfirm
  });
}

export function showDeckPrompt(container, title, inputValue, onConfirm) {
  return showDeckDialog({
    container,
    title,
    type: "input",
    inputValue,
    confirmText: "Confirm",
    cancelText: "Cancel",
    onConfirm
  });
}
