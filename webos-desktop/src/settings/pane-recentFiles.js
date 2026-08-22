import { os, StorageKeys, $$, bindEvent } from "../framework.js";
import { openFileWith, resolveFileIcon } from "../fileDisplay.js";

export function renderRecentFilesPane() {
  return `
    <div id="pane-recent-files" class="settings-category-pane">
      <div class="settings-category-header">Recent Files</div>
      <div id="recent-files-content">
        <div class="settings-card">
          <div class="settings-row">
            <div class="settings-label-group">
              <span class="settings-label-title">Loading recent files...</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function readRecentFiles() {
  let recent = os.storage.get(StorageKeys.recentFiles);
  if (typeof recent === "string") {
    try {
      recent = JSON.parse(recent);
    } catch {
      recent = [];
    }
  }
  if (!Array.isArray(recent)) recent = [];
  return recent;
}

function formatTimestamp(ts) {
  if (!ts) return "";
  const date = new Date(ts);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleString();
}

function fileIconHtml(name) {
  const raw = resolveFileIcon(name);
  if (raw === "@content" || raw === "rom") {
    return `<i class="fas fa-file"></i>`;
  }
  if (raw.includes("fa-")) {
    return `<i class="${raw}"></i>`;
  }
  return `<img class="recent-file-icon-img" src="${raw}" alt="" />`;
}

export function bindRecentFiles(win) {
  const container = win.querySelector("#recent-files-content");
  if (!container) return;

  const renderList = () => {
    const recent = readRecentFiles();

    if (!recent.length) {
      container.innerHTML = `
        <div class="settings-card">
          <div class="settings-row">
            <div class="settings-label-group">
              <span class="settings-label-title">No recent files yet</span>
              <span class="settings-label-desc">Files you open in the Explorer will appear here</span>
            </div>
          </div>
        </div>
      `;
      return;
    }

    const rows = recent
      .map((f, index) => {
        const path = typeof f.path === "string" ? f.path : Array.isArray(f.path) ? f.path.join("/") : "";
        return `
          <div class="settings-row recent-file-row" data-index="${index}">
            <span class="recent-file-icon">${fileIconHtml(f.name)}</span>
            <div class="settings-label-group">
              <span class="settings-label-title">${f.name}</span>
              <span class="settings-label-desc">${path}${f.timestamp ? " · " + formatTimestamp(f.timestamp) : ""}</span>
            </div>
            <button class="settings-btn recent-file-open" data-index="${index}"><i class="fas fa-folder-open"></i> Open</button>
            <button class="settings-btn recent-file-remove" data-index="${index}"><i class="fas fa-xmark"></i> Remove</button>
          </div>
        `;
      })
      .join("");

    container.innerHTML = `
      <div class="settings-card">
        <div class="settings-card-header">
          <i class="fas fa-clock-rotate-left"></i> File History (${recent.length})
          <button class="settings-btn recent-file-clear" style="margin-left:auto;"><i class="fas fa-trash"></i> Clear all</button>
        </div>
        ${rows}
      </div>
    `;

    $$(".recent-file-open", container).forEach((btn) => {
      bindEvent(btn, "click", () => {
        const entry = readRecentFiles()[Number(btn.dataset.index)];
        if (!entry) return;
        const dir = typeof entry.path === "string" ? entry.path.split("/").filter(Boolean) : entry.path;
        openFileWith({ name: entry.name, path: dir });
      });
    });

    $$(".recent-file-remove", container).forEach((btn) => {
      bindEvent(btn, "click", async () => {
        const index = Number(btn.dataset.index);
        const entry = readRecentFiles()[index];
        if (!entry) return;
        const confirmed = await os.dialog.confirm(
          "Remove from History",
          `Remove "${entry.name}" from your recent files?`
        );
        if (!confirmed) return;
        const next = readRecentFiles().filter((_, i) => i !== index);
        os.storage.set(StorageKeys.recentFiles, next);
        renderList();
      });
    });

    const clearBtn = container.querySelector(".recent-file-clear");
    if (clearBtn) {
      bindEvent(clearBtn, "click", async () => {
        const confirmed = await os.dialog.confirm("Clear History", "Remove all recent files? This cannot be undone.");
        if (!confirmed) return;
        os.storage.set(StorageKeys.recentFiles, []);
        renderList();
      });
    }
  };

  renderList();
}
