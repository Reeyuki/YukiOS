/**
 * Shared utilities for code editor apps (Python, Node).
 */

export function appendOutput(outputArea, text, type = "stdout") {
  const span = document.createElement("span");
  span.textContent = text;
  switch (type) {
    case "error":
      span.className = "out-error";
      break;
    case "stderr":
      span.className = "out-stderr";
      break;
    case "result":
      span.className = "out-result";
      break;
    case "info":
      span.className = "out-info";
      break;
    default:
      break;
  }
  outputArea.appendChild(span);
  outputArea.scrollTop = outputArea.scrollHeight;
}

/**
 * Prompt-based "Save As" for code editor files.
 * Used by both PythonEditorApp and NodeEditorApp.
 */
export function saveAs(fs, wm, fileName, content) {
  const pathString = prompt("Enter the folder path to save into:", "home/user/Projects");
  if (pathString === null) return;
  const path = pathString.split("/").filter(Boolean);
  try {
    fs.createFile(path, fileName, content);
    wm.showPopup(`Saved: ${fileName} → /${pathString}`);
  } catch (e) {
    wm.showPopup(`Save error: ${e.message}`);
  }
}

/**
 * Handle Tab key insertion in a code textarea.
 */
export function handleTabKey(e, textarea) {
  if (e.key === "Tab") {
    e.preventDefault();
    const s = textarea.selectionStart;
    const end = textarea.selectionEnd;
    textarea.value = textarea.value.slice(0, s) + "    " + textarea.value.slice(end);
    textarea.selectionStart = textarea.selectionEnd = s + 4;
  }
}

/**
 * Handle Ctrl+Enter to trigger run in a code editor.
 */
export function handleCtrlEnterRun(e, runBtn) {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    e.preventDefault();
    if (!runBtn.disabled) runBtn.click();
  }
}
