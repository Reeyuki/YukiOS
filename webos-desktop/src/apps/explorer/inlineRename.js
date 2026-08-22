import { resolveIconUrl } from "../../shared/assetResolver.js";
import { speak, ClippyAnimation } from "../../ai/clippy.js";
import { $, createElement } from "../../shared/domUtils.js";

export function createInlineInput(value) {
  const wrap = createElement("div");
  wrap.className = "inline-rename-wrap";

  const input = createElement("input");
  input.className = "inline-rename-input";
  input.type = "text";
  input.value = value;
  input.spellcheck = false;

  const errorTip = createElement("div");
  errorTip.className = "inline-rename-error";
  errorTip.style.display = "none";

  wrap.appendChild(input);
  wrap.appendChild(errorTip);
  return { wrap, input, errorTip };
}

function bindInlineInputEvents(input, commit, cancel, clearError) {
  input.onkeydown = (ev) => {
    ev.stopPropagation();
    if (ev.key === "Enter") {
      ev.preventDefault();
      commit();
    }
    if (ev.key === "Escape") {
      ev.preventDefault();
      cancel();
    }
  };
  input.oninput = () => clearError();
  input.onblur = () => setTimeout(() => commit(), 120);
  input.onclick = (ev) => ev.stopPropagation();
  input.ondblclick = (ev) => ev.stopPropagation();
}

export async function startInlineRename(explorer, itemEl, currentName, inst) {
  if (itemEl.classList.contains("is-renaming")) return;
  itemEl.classList.add("is-renaming");

  const spanEl = itemEl.querySelector("span");

  const { wrap, input, errorTip } = createInlineInput(currentName);
  itemEl.insertBefore(wrap, spanEl.nextSibling);

  const dotIdx = currentName.lastIndexOf(".");
  input.focus();
  if (dotIdx > 0) input.setSelectionRange(0, dotIdx);
  else input.select();

  const showError = (msg) => {
    errorTip.textContent = msg;
    errorTip.style.display = "block";
    input.classList.add("error");
  };
  const clearError = () => {
    errorTip.style.display = "none";
    input.classList.remove("error");
  };

  let committed = false;

  const cancel = () => {
    if (committed) return;
    committed = true;
    itemEl.classList.remove("is-renaming");
    wrap.remove();
  };

  const commit = async () => {
    if (committed) return;
    const newName = input.value.trim();
    if (!newName || newName === currentName) {
      cancel();
      return;
    }
    committed = true;
    try {
      await explorer.fs.renameItem(inst.currentPath, currentName, newName);
      await explorer.renderInstance(inst);
    } catch (err) {
      committed = false;
      showError(err.message || `"${newName}" already exists`);
      input.focus();
    }
  };

  bindInlineInputEvents(input, commit, cancel, clearError);
}

export async function spawnInlineItem(explorer, inst, isFile) {
  const win = $("#" + inst.winId);
  const view = win?.querySelector(`#${inst.winId}-view`);
  if (!view) return;

  const defaultName = isFile ? "New File.txt" : "New Folder";
  const iconClass = isFile ? "fas fa-file" : "fas fa-folder";

  const item = createElement("div");
  item.className = "file-item is-renaming";
  item.innerHTML = `<div style="width:64px;height:64px;display:flex;align-items:center;justify-content:center;font-size:32px;color:var(--brand);background:var(--surface-1);border:1px solid var(--glass-border);border-radius:8px;"><i class="${iconClass}"></i></div>`;

  const { wrap, input, errorTip } = createInlineInput(defaultName);
  item.appendChild(wrap);
  view.appendChild(item);
  item.scrollIntoView({ block: "nearest" });

  const dotIdx = defaultName.lastIndexOf(".");
  input.focus();
  if (isFile && dotIdx > 0) input.setSelectionRange(0, dotIdx);
  else input.select();

  const showError = (msg) => {
    errorTip.textContent = msg;
    errorTip.style.display = "block";
    input.classList.add("error");
  };
  const clearError = () => {
    errorTip.style.display = "none";
    input.classList.remove("error");
  };

  let committed = false;
  const cancel = () => {
    if (committed) return;
    committed = true;
    item.remove();
  };

  const commit = async () => {
    if (committed) return;
    const name = input.value.trim();
    if (!name) {
      cancel();
      return;
    }
    committed = true;
    try {
      if (isFile) {
        await explorer.fs.createFile(inst.currentPath, name);
        speak("New file created! Don't forget to name it something memorable.", ClippyAnimation.Greeting);
      } else {
        await explorer.fs.createFolder(inst.currentPath, name);
        speak("New folder created! Don't forget to name it something memorable.", ClippyAnimation.Greeting);
      }
      await explorer.renderInstance(inst);
    } catch (err) {
      committed = false;
      showError(err.message || "Could not create item.");
      input.focus();
    }
  };

  bindInlineInputEvents(input, commit, cancel, clearError);
}
