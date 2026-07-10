import { createElement, setHTML } from "../../shared/domUtils.js";
import { os } from "../../framework.js";
import { renderSelectMenu, getSelectMenuValue, bindSelectMenu } from "../../shared/selectMenu.js";

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
    <div class="fd-dialog">
      <div class="fd-dialog-title">${title}</div>
      <div class="fd-dialog-label" style="font-size:13px;color:#ccc;line-height:1.5;">${message}</div>
      <div class="fd-dialog-actions">
        <button class="fd-btn fd-btn-cancel">Cancel</button>
        <button class="fd-btn fd-btn-confirm" style="background:#b52a2a;">${confirmText}</button>
      </div>
    </div>
  `
  );
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.querySelector(".fd-btn-cancel").onclick = close;
  overlay.querySelector(".fd-btn-confirm").onclick = () => {
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
    <div class="fd-dialog">
      <div class="fd-dialog-title">${title}</div>
      <div class="fd-dialog-label">${label}</div>
      <input class="fd-dialog-input" type="text" value="${defaultValue}" spellcheck="false">
      <div class="fd-dialog-error" style="display:none;font-size:1.5em;color:#e06c75;margin-top:6px;"></div>
      <div class="fd-dialog-actions">
        <button class="fd-btn fd-btn-cancel">Cancel</button>
        <button class="fd-btn fd-btn-confirm">${confirmText}</button>
      </div>
    </div>
  `
  );
  document.body.appendChild(overlay);

  const input = overlay.querySelector(".fd-dialog-input");
  const confirmBtn = overlay.querySelector(".fd-btn-confirm");
  const cancelBtn = overlay.querySelector(".fd-btn-cancel");
  const errorEl = overlay.querySelector(".fd-dialog-error");

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
  const formatOptions = [
    { value: "zip", label: "ZIP (.zip)" },
    { value: "7z", label: "7z (.7z)" },
    { value: "tar", label: "TAR (.tar)" },
    { value: "tar.gz", label: "TAR.GZ (.tar.gz)" }
  ];
  overlay.innerHTML = `
    <div class="fd-dialog" style="width: 360px;">
      <div class="fd-dialog-title">${title}</div>
      <div class="fd-dialog-body">
        <div class="fd-field">
          <div class="fd-dialog-label">Archive Name</div>
          <input class="fd-dialog-input archive-name-input" type="text" value="${defaultValue}" spellcheck="false">
        </div>
        <div class="fd-field">
          <div class="fd-dialog-label">Archive Format</div>
          ${renderSelectMenu("archive-format-select", formatOptions, "zip", "archive-type-select-menu")}
        </div>
        <div class="archive-level-container">
          <div class="fd-level-header">
            <div class="fd-dialog-label">Compression Level</div>
            <span class="compression-level-value">Normal (6)</span>
          </div>
          <input class="archive-level-input" type="range" min="0" max="9" value="6">
        </div>
      </div>
      <div class="fd-dialog-error"></div>
      <div class="fd-dialog-actions">
        <button class="fd-btn fd-btn-cancel">Cancel</button>
        <button class="fd-btn fd-btn-confirm">Create</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  bindSelectMenu(overlay);

  const nameInput = overlay.querySelector(".archive-name-input");
  const levelContainer = overlay.querySelector(".archive-level-container");
  const levelInput = overlay.querySelector(".archive-level-input");
  const levelValEl = overlay.querySelector(".compression-level-value");
  const confirmBtn = overlay.querySelector(".fd-btn-confirm");
  const cancelBtn = overlay.querySelector(".fd-btn-cancel");
  const errorEl = overlay.querySelector(".fd-dialog-error");

  nameInput.select();
  nameInput.focus();

  const close = () => overlay.remove();

  levelInput.oninput = () => {
    levelValEl.textContent = LEVEL_TEXTS[levelInput.value];
  };

  const updateLevelState = () => {
    const val = getSelectMenuValue("archive-format-select", overlay);
    if (val === "tar") {
      levelContainer.style.opacity = "0.38";
      levelContainer.style.pointerEvents = "none";
    } else {
      levelContainer.style.opacity = "";
      levelContainer.style.pointerEvents = "";
    }
  };

  overlay.addEventListener("change", (e) => {
    if (e.target.id === "archive-format-select" || e.target.closest?.("#archive-format-select")) {
      updateLevelState();
    }
  });

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
    const type = getSelectMenuValue("archive-format-select", overlay) || "zip";
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

  updateLevelState();
}
