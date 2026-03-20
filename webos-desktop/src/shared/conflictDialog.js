export function showConflictDialog(fileName) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.style.cssText =
      "position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:99999;display:flex;align-items:center;justify-content:center;";

    const dialog = document.createElement("div");
    dialog.style.cssText =
      "background:#1e1e2e;border:1px solid rgba(255,255,255,0.12);border-radius:10px;padding:24px 28px;min-width:340px;max-width:420px;box-shadow:0 8px 40px rgba(0,0,0,0.6);font-family:inherit;color:#cdd6f4;";

    dialog.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
        <i class="fas fa-exclamation-triangle" style="color:#f9e2af;font-size:18px;"></i>
        <span style="font-size:14px;font-weight:600;color:#cdd6f4;">File already exists</span>
      </div>
      <div style="font-size:12.5px;color:#a6adc8;margin-bottom:18px;line-height:1.5;">
        <span style="color:#89b4fa;font-weight:500;">"${fileName}"</span> already exists in this location.<br>What would you like to do?
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:18px;">
        <button data-action="replace" style="background:#313244;border:1px solid rgba(255,255,255,0.1);border-radius:7px;color:#f38ba8;padding:9px 14px;cursor:pointer;font-size:12.5px;text-align:left;transition:background 0.15s;">
          <i class="fas fa-redo" style="width:16px;margin-right:8px;"></i>Replace existing file
        </button>
        <button data-action="keep" style="background:#313244;border:1px solid rgba(255,255,255,0.1);border-radius:7px;color:#a6e3a1;padding:9px 14px;cursor:pointer;font-size:12.5px;text-align:left;transition:background 0.15s;">
          <i class="fas fa-copy" style="width:16px;margin-right:8px;"></i>Keep both files
        </button>
        <button data-action="skip" style="background:#313244;border:1px solid rgba(255,255,255,0.1);border-radius:7px;color:#a6adc8;padding:9px 14px;cursor:pointer;font-size:12.5px;text-align:left;transition:background 0.15s;">
          <i class="fas fa-ban" style="width:16px;margin-right:8px;"></i>Skip this file
        </button>
      </div>
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;color:#6c7086;user-select:none;">
        <input type="checkbox" id="_conflict-apply-all" style="accent-color:#89b4fa;width:13px;height:13px;cursor:pointer;">
        Apply this choice to all remaining conflicts
      </label>
    `;

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
