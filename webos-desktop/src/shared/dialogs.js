/**
 * Custom dialog functions that replace native browser dialogs
 */

import { audioMixer, SystemAudio } from "../audioMixer.js";

export function showAlert(title, message, buttonText = "OK") {
  return new Promise((resolve) => {
    audioMixer.playSystemSound(SystemAudio.ERROR);
    const overlay = document.createElement("div");
    overlay.className = "explorer-confirmation-overlay";
    overlay.innerHTML = `
      <div class="_fd-dialog">
        <div class="_fd-dialog-title">${title}</div>
        <div class="_fd-dialog-label" style="font-size:13px;color:#ccc;line-height:1.5;">${message}</div>
        <div class="_fd-dialog-actions">
          <button class="_fd-btn _fd-btn-confirm" style="background:#313244;">${buttonText}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const close = () => {
      overlay.remove();
      resolve();
    };

    const confirmBtn = overlay.querySelector("._fd-btn-confirm");
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
    const overlay = document.createElement("div");
    overlay.className = "explorer-confirmation-overlay";
    overlay.innerHTML = `
      <div class="_fd-dialog">
        <div class="_fd-dialog-title">${title}</div>
        <div class="_fd-dialog-label" style="font-size:13px;color:#ccc;line-height:1.5;">${message}</div>
        <input class="_fd-dialog-input" type="text" value="${defaultValue}" spellcheck="false">
        <div class="_fd-dialog-error" style="display:none;font-size:1.5em;color:#e06c75;margin-top:6px;"></div>
        <div class="_fd-dialog-actions">
          <button class="_fd-btn _fd-btn-cancel">Cancel</button>
          <button class="_fd-btn _fd-btn-confirm">${confirmText}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const input = overlay.querySelector("._fd-dialog-input");
    const confirmBtn = overlay.querySelector("._fd-btn-confirm");
    const cancelBtn = overlay.querySelector("._fd-btn-cancel");
    const errorEl = overlay.querySelector("._fd-dialog-error");

    input.select();
    input.focus();

    const close = () => {
      overlay.remove();
      resolve(null);
    };

    const showError = (msg) => {
      audioMixer.playSystemSound(SystemAudio.ERROR);
      errorEl.textContent = msg;
      errorEl.style.display = "block";
      input.style.borderColor = "#e06c75";
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
    const overlay = document.createElement("div");
    overlay.className = "explorer-confirmation-overlay";
    overlay.innerHTML = `
      <div class="_fd-dialog">
        <div class="_fd-dialog-title">${title}</div>
        <div class="_fd-dialog-label" style="font-size:13px;color:#ccc;line-height:1.5;">${message}</div>
        <div class="_fd-dialog-actions">
          <button class="_fd-btn _fd-btn-cancel">${cancelText}</button>
          <button class="_fd-btn _fd-btn-confirm" style="background:#b52a2a;">${confirmText}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const close = () => {
      overlay.remove();
      resolve(false);
    };

    const confirmBtn = overlay.querySelector("._fd-btn-confirm");
    const cancelBtn = overlay.querySelector("._fd-btn-cancel");

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
    audioMixer.playSystemSound(SystemAudio.ERROR);
    const overlay = document.createElement("div");
    overlay.className = "explorer-confirmation-overlay";
    const optionsHtml = mirrors
      .map((m) => `<option value="${m.id}" ${m.id === currentMirror ? "selected" : ""}>${m.name}</option>`)
      .join("");

    overlay.innerHTML = `
      <div class="_fd-dialog">
        <div class="_fd-dialog-title">Network Error</div>
        <div class="_fd-dialog-label" style="font-size:13px;color:#ccc;line-height:1.5;">
          Failed to load assets from the current CDN mirror. Your network might be blocking it. Please choose an alternative mirror:
        </div>
        <select class="_fd-dialog-input" id="cdn-picker" style="margin-top: 10px; background: rgba(0,0,0,0.3); color: white; border: 1px solid #555; padding: 5px; border-radius: 4px;">
          ${optionsHtml}
        </select>
        <div class="_fd-dialog-actions" style="margin-top: 15px;">
          <button class="_fd-btn _fd-btn-cancel" style="background:#45475a;">Ignore</button>
          <button class="_fd-btn _fd-btn-confirm" style="background:#313244;">Apply & Reload</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const select = overlay.querySelector("#cdn-picker");
    const confirmBtn = overlay.querySelector("._fd-btn-confirm");
    const cancelBtn = overlay.querySelector("._fd-btn-cancel");

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
