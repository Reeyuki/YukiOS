import { os } from "../../framework.js";
import { $, $$, setHTML, addClass, removeClass, createElement } from "../../shared/domUtils.js";
import { showDynamicContextMenu } from "../../shared/contextMenu.js";
import { buildFileIconHTML } from "../../fileDisplay.js";
import { formatSize } from "../../utils/utils.js";

export async function showTrashView(explorer, inst) {
  inst._isTrashView = true;
  inst.currentPath = [];
  inst.selectedFile = null;
  inst.selectedItems = new Set();
  const win = $(`#${inst.winId}`);
  if (!win) return;
  const view = $(`#${inst.winId}-view`, win);
  const pathDisplay = $(`#${inst.winId}-path`, win);
  if (!view) return;
  if (pathDisplay) pathDisplay.value = "/Trash";
  await renderTrashView(explorer, inst, view, win);
}

export async function renderTrashView(explorer, inst, view, win) {
  view.innerHTML = "";
  removeClass(view, "games-page");
  addClass(view, "explorer-trash-view");
  explorer._ensureSelBox(view);

  const items = await os.fs.getTrashItems();
  inst._cachedFolder = {};
  inst._cachedTrashItems = items;

  const banner = createElement("div", { className: "explorer-trash-banner" });
  const count = items.length;
  setHTML(
    banner,
    `
    <div class="explorer-trash-banner-left">
      <i class="fas fa-trash" style="font-size:20px;color:var(--brand);opacity:0.7"></i>
      <span style="font-weight:600">Trash</span>
      <span style="opacity:0.6;font-size:11px">${count} ${count === 1 ? "item" : "items"}</span>
    </div>
    <div class="explorer-trash-banner-actions">
      <button class="explorer-trash-action-btn trash-restore-all" ${count === 0 ? "disabled" : ""}>
        <i class="fas fa-undo"></i> Restore All
      </button>
      <button class="explorer-trash-action-btn trash-empty-all" ${count === 0 ? "disabled" : ""}>
        <i class="fas fa-trash-alt"></i> Empty Trash
      </button>
    </div>
  `
  );
  view.appendChild(banner);

  const restoreAllBtn = banner.querySelector(".trash-restore-all");
  const emptyAllBtn = banner.querySelector(".trash-empty-all");

  if (restoreAllBtn) {
    restoreAllBtn.onclick = async () => {
      const confirmed = await os.dialog.confirm(
        "Restore All",
        "Restore all items in trash to their original locations?"
      );
      if (!confirmed) return;
      restoreAllBtn.disabled = true;
      await os.fs.restoreAllTrashItems();
      await renderTrashView(explorer, inst, view, win);
      os.notify.send("All items restored from trash");
    };
  }

  if (emptyAllBtn) {
    emptyAllBtn.onclick = async () => {
      const confirmed = await os.dialog.confirm("Empty Trash", "Empty the trash for good? You can't undo this.");
      if (!confirmed) return;
      emptyAllBtn.disabled = true;
      await os.fs.emptyTrash();
      await renderTrashView(explorer, inst, view, win);
      os.notify.send("Trash emptied");
    };
  }

  if (count === 0) {
    const empty = createElement("div", { className: "explorer-trash-empty" });
    setHTML(
      empty,
      `
      <i class="fas fa-trash" style="font-size:48px;opacity:0.15;margin-bottom:12px"></i>
      <div style="opacity:0.4;font-size:13px">Trash is empty</div>
    `
    );
    view.appendChild(empty);
    return;
  }

  for (const entry of items) {
    const item = createElement("div", { className: "file-item" });
    item.dataset.trashId = entry.id;
    item.dataset.trashType = entry.type;
    item.dataset.isFile = entry.type === "file" ? "true" : "false";

    const iconName = entry.originalName;
    const iconHtml = buildFileIconHTML(iconName, {});
    setHTML(item, `${iconHtml}<span>${entry.originalName}</span>`);
    bindTrashItemInteractions(explorer, item, entry, inst, win);
    view.appendChild(item);
  }

  inst._isTrashView = true;
  await explorer._updateStorageIndicator(win);
  const itemsEl = win.querySelector(`#${inst.winId}-status-items`);
  const selectedEl = win.querySelector(`#${inst.winId}-status-selected`);
  if (itemsEl) itemsEl.textContent = `${count} ${count === 1 ? "item" : "items"}`;
  if (selectedEl) selectedEl.textContent = "";
}

function bindTrashItemInteractions(explorer, item, entry, inst, win) {
  item.oncontextmenu = (e) => showTrashContextMenu(explorer, e, entry, inst);

  item.onclick = (e) => {
    if (e.detail === 1) {
      const wasSelected = item.classList.contains("explorer-selected");
      if (!e.ctrlKey) {
        $$(".file-item.explorer-selected", win).forEach((el) => removeClass(el, "explorer-selected"));
        inst.selectedItems = new Set();
      }
      if (wasSelected && e.ctrlKey) {
        removeClass(item, "explorer-selected");
        inst.selectedItems.delete(entry.originalName);
      } else {
        addClass(item, "explorer-selected");
        inst.selectedItems.add(entry.originalName);
        inst.selectedFile = entry.originalName;
      }
    }
  };
}

function showTrashContextMenu(explorer, e, entry, inst) {
  e.preventDefault();
  e.stopPropagation();

  showDynamicContextMenu(e, (menu, item, hr) => {
    menu.appendChild(
      item(
        "Restore",
        async () => {
          await os.fs.restoreTrashItem(entry.id);
          const win = $(`#${inst.winId}`);
          const view = win && $(`#${inst.winId}-view`, win);
          if (view) await renderTrashView(explorer, inst, view, win);
          os.notify.send(`"${entry.originalName}" restored`);
        },
        "fa-undo"
      )
    );

    menu.appendChild(hr());

    menu.appendChild(
      item(
        "Delete Permanently",
        async () => {
          const confirmed = await os.dialog.confirm(
            "Delete Permanently",
            `Permanently delete "${entry.originalName}"? This cannot be undone.`
          );
          if (!confirmed) return;
          await os.fs.deleteTrashItem(entry.id);
          const win = $(`#${inst.winId}`);
          const view = win && $(`#${inst.winId}-view`, win);
          if (view) await renderTrashView(explorer, inst, view, win);
          os.notify.send(`"${entry.originalName}" permanently deleted`);
        },
        "fa-trash-alt"
      )
    );

    menu.appendChild(
      item(
        "Properties",
        async () => {
          await showTrashItemProperties(entry, inst);
        },
        "fa-info-circle"
      )
    );
  });
}

async function showTrashItemProperties(entry) {
  try {
    const iconSrc = entry.icon || "static/icons/file.webp";
    const size = entry.size ? formatSize(entry.size) : "Unknown";
    const type = entry.type || "Unknown";
    const location = entry.originalPath || "Unknown";
    const date = new Date(entry.deletedAt).toLocaleString();

    const title = `Properties: ${entry.originalName}`;
    const propsWin = os.window.create(`${Date.now()}-props`, title, "400px", "auto");

    propsWin.innerHTML = `
      <div class="window-header"><span>${title}</span>
        ${os.window.getWindowControls()}
      </div>
      <div class="window-content" style="padding:20px;">
        <div style="display:flex;align-items:center;gap:20px;margin-bottom:20px;">
          <img src="${iconSrc}" style="width:64px;height:64px;object-fit:cover;border-radius:8px;">
          <div style="flex:1;">
            <div style="font-size:18px;font-weight:600;margin-bottom:4px;">${entry.originalName}</div>
            <div style="opacity:0.7;font-size:13px;">${type}</div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:120px 1fr;gap:8px;margin-bottom:20px;font-size:13px;">
          <div style="opacity:0.7;">Type:</div><div>${type}</div>
          <div style="opacity:0.7;">Original Location:</div><div>${location}</div>
          <div style="opacity:0.7;">Size:</div><div>${size}</div>
          <div style="opacity:0.7;">Deleted:</div><div>${date}</div>
        </div>
      </div>
    `;
  } catch (err) {
    console.error("Properties error:", err);
    os.dialog.alert("Error", "Failed to show properties");
  }
}
