/**
 * Custom dialog functions that replace native browser dialogs
 */

import { audioMixer, SystemAudio } from "../audioMixer.js";
import { createElement } from "./domUtils.js";

export function showAlert(title, message, buttonText = "OK") {
  return new Promise((resolve) => {
    audioMixer().playSystemSound(SystemAudio.ERROR);
    const overlay = createElement("div");
    overlay.className = "explorer-confirmation-overlay";
    overlay.innerHTML = `
      <div class="fd-dialog">
        <div class="fd-dialog-title">${title}</div>
        <div class="fd-dialog-label">${message}</div>
        <div class="fd-dialog-actions">
          <button class="fd-btn fd-btn-confirm">${buttonText}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const close = () => {
      overlay.remove();
      resolve();
    };

    const confirmBtn = overlay.querySelector(".fd-btn-confirm");
    confirmBtn.onclick = close;
    overlay.onclick = (ev) => {
      if (ev.target === overlay) close();
    };
    overlay.onkeydown = (ev) => {
      if (ev.key === "Escape" || ev.key === "Enter") close();
    };
    confirmBtn.focus();
  });
}

export function showPrompt(title, message, defaultValue = "", confirmText = "OK") {
  return new Promise((resolve) => {
    const overlay = createElement("div");
    overlay.className = "explorer-confirmation-overlay";
    overlay.innerHTML = `
      <div class="fd-dialog">
        <div class="fd-dialog-title">${title}</div>
        <div class="fd-dialog-label">${message}</div>
        <input class="fd-dialog-input" type="text" value="${defaultValue}" spellcheck="false">
        <div class="fd-dialog-error"></div>
        <div class="fd-dialog-actions">
          <button class="fd-btn fd-btn-cancel">Cancel</button>
          <button class="fd-btn fd-btn-confirm">${confirmText}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const input = overlay.querySelector(".fd-dialog-input");
    const confirmBtn = overlay.querySelector(".fd-btn-confirm");
    const cancelBtn = overlay.querySelector(".fd-btn-cancel");
    const errorEl = overlay.querySelector(".fd-dialog-error");

    input.select();
    input.focus();

    const close = () => {
      overlay.remove();
      resolve(null);
    };

    const showError = (msg) => {
      audioMixer().playSystemSound(SystemAudio.ERROR);
      errorEl.textContent = msg;
      errorEl.style.display = "block";
      input.style.borderColor = "var(--error)";
      confirmBtn.disabled = false;
    };

    const clearError = () => {
      errorEl.style.display = "none";
      input.style.borderColor = "";
    };

    const submit = () => {
      const val = input.value.trim();
      if (!val) return;
      overlay.remove();
      resolve(val);
    };

    confirmBtn.onclick = submit;
    cancelBtn.onclick = close;
    overlay.onclick = (ev) => {
      if (ev.target === overlay) close();
    };
    input.onkeydown = (ev) => {
      if (ev.key === "Enter") submit();
      if (ev.key === "Escape") close();
    };
    input.oninput = () => {
      clearError();
      confirmBtn.disabled = !input.value.trim();
    };
    confirmBtn.disabled = !input.value.trim();
  });
}

export function showConfirm(title, message, confirmText = "OK", cancelText = "Cancel") {
  return new Promise((resolve) => {
    const overlay = createElement("div");
    overlay.className = "explorer-confirmation-overlay";
    overlay.innerHTML = `
      <div class="fd-dialog">
        <div class="fd-dialog-title">${title}</div>
        <div class="fd-dialog-label">${message}</div>
        <div class="fd-dialog-actions">
          <button class="fd-btn fd-btn-cancel">${cancelText}</button>
          <button class="fd-btn fd-btn-confirm fd-btn-danger">${confirmText}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const close = () => {
      overlay.remove();
      resolve(false);
    };

    const confirmBtn = overlay.querySelector(".fd-btn-confirm");
    const cancelBtn = overlay.querySelector(".fd-btn-cancel");

    confirmBtn.onclick = () => {
      overlay.remove();
      resolve(true);
    };
    cancelBtn.onclick = close;
    overlay.onclick = (ev) => {
      if (ev.target === overlay) close();
    };
    overlay.onkeydown = (ev) => {
      if (ev.key === "Escape") close();
      if (ev.key === "Enter") {
        overlay.remove();
        resolve(true);
      }
    };
    confirmBtn.focus();
  });
}

export const customAlert = async (message, title = "Alert") => {
  await showAlert(title, message);
};

export const customPrompt = async (message, defaultValue = "", title = "Prompt") => {
  return await showPrompt(title, message, defaultValue);
};

export const customConfirm = async (message, title = "Confirm") => {
  return await showConfirm(title, message);
};

export function showCdnPrompt(mirrors, currentMirror) {
  return new Promise((resolve) => {
    audioMixer().playSystemSound(SystemAudio.ERROR);
    const overlay = createElement("div");
    overlay.className = "explorer-confirmation-overlay";
    const optionsHtml = mirrors
      .map((m) => `<option value="${m.id}" ${m.id === currentMirror ? "selected" : ""}>${m.name}</option>`)
      .join("");

    overlay.innerHTML = `
      <div class="fd-dialog">
        <div class="fd-dialog-title">Network Error</div>
        <div class="fd-dialog-label">
          Couldn't reach the CDN mirror. Your network might be blocking it. Pick another one:
        </div>
        <select class="fd-dialog-input fd-dialog-select" id="cdn-picker">
          ${optionsHtml}
        </select>
        <div class="fd-dialog-actions">
          <button class="fd-btn fd-btn-cancel">Ignore</button>
          <button class="fd-btn fd-btn-confirm">Apply & Reload</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const select = overlay.querySelector("#cdn-picker");
    const confirmBtn = overlay.querySelector(".fd-btn-confirm");
    const cancelBtn = overlay.querySelector(".fd-btn-cancel");

    const submit = () => {
      overlay.remove();
      resolve(select.value);
    };

    const close = () => {
      overlay.remove();
      resolve(null);
    };

    confirmBtn.onclick = submit;
    cancelBtn.onclick = close;

    overlay.onclick = (ev) => {
      if (ev.target === overlay) close();
    };

    overlay.onkeydown = (ev) => {
      if (ev.key === "Enter") submit();
      if (ev.key === "Escape") close();
    };
    confirmBtn.focus();
  });
}
