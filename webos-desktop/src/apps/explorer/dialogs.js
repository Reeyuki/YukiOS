import { createElement, setHTML } from "../../shared/domUtils.js";
import { os } from "../../framework.js";

const LEVEL_TEXTS = {
  0: "Store (No Compression)",
  1: "Fastest (1)",
  2: "Fastest (2)",
  3: "Fast (3)",
  4: "Fast (4)",
  5: "Normal (5)",
  6: "Normal (6)",
  7: "High (7)",
  8: "High (8)",
  9: "Ultra (Maximum)"
};

export function showConfirmDialog({ title, message, confirmText = "OK", onConfirm }) {
  const overlay = createElement("div", { className: "explorer-confirmation-overlay" });
  setHTML(
    overlay,
    `
    <div class="_fd-dialog">
      <div class="_fd-dialog-title">${title}</div>
      <div class="_fd-dialog-label" style="font-size:13px;color:#ccc;line-height:1.5;">${message}</div>
      <div class="_fd-dialog-actions">
        <button class="_fd-btn _fd-btn-cancel">Cancel</button>
        <button class="_fd-btn _fd-btn-confirm" style="background:#b52a2a;">${confirmText}</button>
      </div>
    </div>
  `
  );
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.querySelector("._fd-btn-cancel").onclick = close;
  overlay.querySelector("._fd-btn-confirm").onclick = () => {
    close();
    onConfirm();
  };
  overlay.onclick = (ev) => {
    if (ev.target === overlay) close();
  };
  overlay.onkeydown = (ev) => {
    if (ev.key === "Escape") close();
  };
}

export function showInputDialog({ title, label, defaultValue, confirmText = "Create", onConfirm }) {
  const overlay = createElement("div", { className: "explorer-confirmation-overlay" });
  setHTML(
    overlay,
    `
    <div class="_fd-dialog">
      <div class="_fd-dialog-title">${title}</div>
      <div class="_fd-dialog-label">${label}</div>
      <input class="_fd-dialog-input" type="text" value="${defaultValue}" spellcheck="false">
      <div class="_fd-dialog-error" style="display:none;font-size:1.5em;color:#e06c75;margin-top:6px;"></div>
      <div class="_fd-dialog-actions">
        <button class="_fd-btn _fd-btn-cancel">Cancel</button>
        <button class="_fd-btn _fd-btn-confirm">${confirmText}</button>
      </div>
    </div>
  `
  );
  document.body.appendChild(overlay);

  const input = overlay.querySelector("._fd-dialog-input");
  const confirmBtn = overlay.querySelector("._fd-btn-confirm");
  const cancelBtn = overlay.querySelector("._fd-btn-cancel");
  const errorEl = overlay.querySelector("._fd-dialog-error");

  input.select();
  input.focus();

  const close = () => overlay.remove();
  const showError = (msg) => {
    errorEl.textContent = msg;
    errorEl.style.display = "block";
    input.style.borderColor = "#e06c75";
    confirmBtn.disabled = false;
  };
  const clearError = () => {
    errorEl.style.display = "none";
    input.style.borderColor = "";
  };

  const submit = async () => {
    const val = input.value.trim();
    if (!val) return;
    confirmBtn.disabled = true;
    try {
      const result = await onConfirm(val);
      if (typeof result === "string" && result) showError(result);
      else close();
    } catch (err) {
      showError(err.message || "An error occurred.");
    }
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
}

export function showArchiveDialog({ title, defaultValue, onConfirm }) {
  const overlay = document.createElement("div");
  overlay.className = "explorer-confirmation-overlay";
  overlay.innerHTML = `
    <div class="_fd-dialog" style="width: 360px;">
      <div class="_fd-dialog-title">${title}</div>
      <div style="display:flex; flex-direction:column; gap:12px; margin-top:8px;">
        <div>
          <div class="_fd-dialog-label">Archive Name</div>
          <input class="_fd-dialog-input archive-name-input" type="text" value="${defaultValue}" spellcheck="false" style="width:100%;">
        </div>
        <div>
          <div class="_fd-dialog-label">Archive Format</div>
          <select class="archive-type-select" style="
            width: 100%;
            padding: 8px 12px;
            border-radius: 6px;
            border: 1px solid rgba(255, 255, 255, 0.15);
            background: rgba(30, 30, 46, 0.9);
            color: #cdd6f4;
            font-family: inherit;
            font-size: 13px;
            outline: none;
          ">
            <option value="zip">ZIP (.zip)</option>
            <option value="7z">7z (.7z)</option>
            <option value="tar">TAR (.tar)</option>
            <option value="tar.gz">TAR.GZ (.tar.gz)</option>
          </select>
        </div>
        <div class="archive-level-container" style="transition: opacity 0.18s ease;">
          <div style="display:flex; justify-content:space-between;">
            <div class="_fd-dialog-label">Compression Level</div>
            <span class="compression-level-value" style="font-size:12px; color:#a6adc8; font-weight:bold;">Normal (6)</span>
          </div>
          <input class="archive-level-input" type="range" min="0" max="9" value="6" style="
            width: 100%;
            margin-top: 6px;
            background: rgba(255, 255, 255, 0.1);
            height: 4px;
            border-radius: 2px;
            outline: none;
            cursor: pointer;
          ">
        </div>
      </div>
      <div class="_fd-dialog-error" style="display:none;font-size:12px;color:#e06c75;margin-top:6px;"></div>
      <div class="_fd-dialog-actions" style="margin-top:16px;">
        <button class="_fd-btn _fd-btn-cancel">Cancel</button>
        <button class="_fd-btn _fd-btn-confirm">Create</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const nameInput = overlay.querySelector(".archive-name-input");
  const select = overlay.querySelector(".archive-type-select");
  const levelContainer = overlay.querySelector(".archive-level-container");
  const levelInput = overlay.querySelector(".archive-level-input");
  const levelValEl = overlay.querySelector(".compression-level-value");
  const confirmBtn = overlay.querySelector("._fd-btn-confirm");
  const cancelBtn = overlay.querySelector("._fd-btn-cancel");
  const errorEl = overlay.querySelector("._fd-dialog-error");

  nameInput.select();
  nameInput.focus();

  const close = () => overlay.remove();

  levelInput.oninput = () => {
    levelValEl.textContent = LEVEL_TEXTS[levelInput.value];
  };

  select.onchange = () => {
    if (select.value === "tar") {
      levelContainer.style.opacity = "0.38";
      levelContainer.style.pointerEvents = "none";
    } else {
      levelContainer.style.opacity = "";
      levelContainer.style.pointerEvents = "";
    }
  };

  cancelBtn.onclick = close;

  const showError = (msg) => {
    errorEl.textContent = msg;
    errorEl.style.display = "block";
    nameInput.style.borderColor = "#e06c75";
    confirmBtn.disabled = false;
  };

  confirmBtn.onclick = async () => {
    const archiveName = nameInput.value.trim();
    if (!archiveName) {
      nameInput.style.borderColor = "#e06c75";
      return;
    }
    confirmBtn.disabled = true;
    const type = select.value;
    const level = parseInt(levelInput.value);

    try {
      await onConfirm(archiveName, type, level);
      close();
    } catch (err) {
      showError(err.message || "Failed to create archive");
    }
  };

  overlay.onclick = (ev) => {
    if (ev.target === overlay) close();
  };

  overlay.onkeydown = (ev) => {
    if (ev.key === "Escape") close();
    if (ev.key === "Enter") confirmBtn.click();
  };
}
