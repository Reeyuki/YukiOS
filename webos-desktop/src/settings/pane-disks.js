import { os, StorageKeys, createElement } from "../framework.js";
import { formatSize } from "../utils/utils.js";

export function renderDisksPane() {
  return `
    <div id="pane-disks" class="settings-category-pane">
      <div class="settings-category-header">Disks</div>
      <div id="disks-content">
        <div class="settings-card">
          <div class="settings-row"><div class="settings-label-group"><span class="settings-label-title">Loading disk information...</span></div></div>
        </div>
      </div>
    </div>
  `;
}

async function calcDirSize(pathArray) {
  try {
    const { size } = await os.fs.calcDirSize(pathArray);
    return size;
  } catch {
    return 0;
  }
}

export async function bindDisks(win) {
  const container = win.querySelector("#disks-content");
  if (!container) return;
  try {
    let used = 0;
    let quota = 0;
    try {
      if (navigator.storage && navigator.storage.estimate) {
        const est = await navigator.storage.estimate();
        used = est.usage || 0;
        quota = est.quota || 0;
      }
    } catch {}
    const pct = quota > 0 ? Math.min((used / quota) * 100, 100) : 0;

    const mounts = (os.fs.getMounts && os.fs.getMounts()) || [];
    const driveCount = 1 + mounts.length;

    let mountRows = "";
    for (const m of mounts) {
      const mountUsed = await calcDirSize(m.mountPoint.split("/").filter(Boolean));
      const mPct = quota > 0 ? Math.min((mountUsed / quota) * 100, 100) : 0;
      mountRows += diskCard(m.label, mountUsed, mPct, "mount");
    }

    container.innerHTML = `
      <div class="settings-card">
        <div class="settings-card-header"><i class="fas fa-hdd"></i> Devices and drives (${driveCount})</div>
        ${diskCard("Local Disk (C:)", used, pct, "local")}
        ${mountRows}
      </div>
      <div class="settings-card" style="margin-top: 16px;">
        <div class="settings-card-header"><i class="fas fa-compass"></i> Explore Files</div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Open Explorer</span>
            <span class="settings-label-desc">Browse your virtual disks and mounted drives</span>
          </div>
          <button class="settings-btn" id="disksOpenExplorer"><i class="fas fa-folder-open"></i> Open</button>
        </div>
      </div>
    `;

    const openBtn = container.querySelector("#disksOpenExplorer");
    if (openBtn) {
      openBtn.addEventListener("click", () => {
        os.app.launch("explorerApp").catch(() => {});
      });
    }
  } catch (err) {
    if (container) {
      container.innerHTML = `
        <div class="settings-card">
          <div class="settings-card-header"><i class="fas fa-hdd"></i> Devices and drives</div>
          <div class="settings-row"><div class="settings-label-group"><span class="settings-label-title">Disk information unavailable</span></div></div>
        </div>
      `;
    }
  }
}

function diskCard(name, usedBytes, pct, kind) {
  return `
    <div class="settings-disk-row">
      <i class="fas fa-hard-drive settings-disk-icon"></i>
      <div class="settings-disk-body">
        <div class="settings-disk-name">${name}</div>
        <div class="settings-disk-info">${formatSize(usedBytes)} used${kind === "local" ? " of origin storage" : ""}</div>
        <div class="settings-disk-progress"><div class="settings-disk-progress-fill" style="width:${pct}%"></div></div>
      </div>
    </div>
  `;
}
