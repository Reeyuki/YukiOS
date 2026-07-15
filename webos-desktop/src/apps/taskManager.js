import "../styles/taskManager.css";
import { $, $$, bindEvent, setText, setHTML, toggleClass } from "../shared/domUtils.js";
import { BusEvents } from "../core/EventBusConstants.js";

import { BaseApp, os } from "../framework.js";
import { processManager } from "../services/ProcessManager.js";
export class TaskManagerApp extends BaseApp {
  constructor(services) {
    super(services);
    this.refreshInterval = null;
    this.sortKey = "title";
    this.sortAsc = true;
    this.filter = "";
    this.selectedIds = new Set();
    this.appsFilter = "";
    this.appsSelectedIds = new Set();
    this.cpuHistory = Array(30).fill(0);
    this.memHistory = Array(30).fill(0);
    this.frameDropScore = 0;
    this.longTaskBudget = 0;
    this.startFrameMonitor();
    this.startLongTaskMonitor();
    processManager.init();
  }

  startFrameMonitor() {
    let last = performance.now();
    const tick = (now) => {
      const delta = now - last;
      last = now;
      const dropped = Math.max(0, delta - 16.67);
      this.frameDropScore = this.frameDropScore * 0.92 + dropped * 0.08;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  startLongTaskMonitor() {
    if (!window.TurboObserver) return;
    try {
      const obs = new TurboObserver((list) => {
        for (const entry of list.getEntries()) {
          this.longTaskBudget += entry.duration;
        }
      });
      obs.observe({ entryTypes: ["longtask"] });
    } catch {}
  }

  drainLongTaskBudget() {
    const v = Math.min(this.longTaskBudget, 2000);
    this.longTaskBudget = Math.max(0, this.longTaskBudget - v);
    return v;
  }

  killProcess(id) {
    processManager.killByWinId(id);
  }

  open(opts = {}) {
    const win = os.window.create("taskmanager-app", "Task Manager", "760px", "540px", {
      icon: "fa fa-tasks",
      appId: "taskmanager-app"
    });

    win.innerHTML = `<div id="tm-root">
        <div class="tm-sidebar">
          <div class="tm-sidebar-title">Task Manager</div>
          <button id="tm-tab-proc" data-tab="proc" class="tm-nav-item tm-nav-active">
            <i class="fa fa-microchip tm-nav-icon"></i>Processes
          </button>
          <button id="tm-tab-apps" data-tab="apps" class="tm-nav-item">
            <i class="fa fa-th-large tm-nav-icon"></i>Apps
          </button>
          <button id="tm-tab-perf" data-tab="perf" class="tm-nav-item">
            <i class="fa fa-area-chart tm-nav-icon"></i>Performance
          </button>
        </div>

        <div class="tm-content">
          <div id="tm-panel-proc" class="tm-panel-proc">
            <div class="tm-panel-header">
              <span class="tm-panel-title">Processes</span>
              <div class="tm-search-wrap">
                <span class="tm-search-icon"><i class="fa fa-search"></i></span>
                <input id="tm-filter" class="tm-filter-input" placeholder="Search processes…"/>
                <span id="tm-count" class="tm-count"></span>
              </div>
            </div>
            <div class="tm-table-wrap">
              <table id="tm-table" class="tm-table">
                <colgroup>
                  <col style="width:42%">
                  <col style="width:18%">
                  <col style="width:18%">
                  <col style="width:22%">
                </colgroup>
                <thead>
                  <tr class="tm-thead-row">
                    <th class="tm-th" data-key="title">Name</th>
                    <th class="tm-th tm-th-right" data-key="cpu">CPU</th>
                    <th class="tm-th tm-th-right" data-key="mem">Memory</th>
                    <th class="tm-th tm-th-right" data-key="status">Status</th>
                  </tr>
                </thead>
                <tbody id="tm-tbody"></tbody>
              </table>
            </div>
            <div class="tm-footer">
              <span id="tm-selected-label" class="tm-selected-label">No process selected</span>
              <div class="tm-footer-actions">
                <button id="tm-btn-select-all" class="tm-action-btn">Select All</button>
                <button id="tm-btn-refresh" class="tm-action-btn"><i class="fa fa-refresh"></i> Refresh</button>
                <button id="tm-btn-kill" class="tm-action-btn tm-kill-btn" disabled>End Task</button>
              </div>
            </div>
          </div>

          <div id="tm-panel-apps" class="tm-panel-proc" style="display:none">
            <div class="tm-panel-header">
              <span class="tm-panel-title">Apps</span>
              <div class="tm-search-wrap">
                <span class="tm-search-icon"><i class="fa fa-search"></i></span>
                <input id="tm-filter-apps" class="tm-filter-input" placeholder="Search apps…"/>
                <span id="tm-count-apps" class="tm-count"></span>
              </div>
            </div>
            <div class="tm-table-wrap">
              <table id="tm-table-apps" class="tm-table">
                <colgroup>
                  <col style="width:42%">
                  <col style="width:18%">
                  <col style="width:18%">
                  <col style="width:22%">
                </colgroup>
                <thead>
                  <tr class="tm-thead-row">
                    <th class="tm-th" data-key="title">Name</th>
                    <th class="tm-th tm-th-right" data-key="cpu">CPU</th>
                    <th class="tm-th tm-th-right" data-key="mem">Memory</th>
                    <th class="tm-th tm-th-right" data-key="status">Status</th>
                  </tr>
                </thead>
                <tbody id="tm-tbody-apps"></tbody>
              </table>
            </div>
            <div class="tm-footer">
              <span id="tm-selected-label-apps" class="tm-selected-label">No app selected</span>
              <div class="tm-footer-actions">
                <button id="tm-btn-select-all-apps" class="tm-action-btn">Select All</button>
                <button id="tm-btn-refresh-apps" class="tm-action-btn"><i class="fa fa-refresh"></i> Refresh</button>
                <button id="tm-btn-kill-apps" class="tm-action-btn tm-kill-btn" disabled>End Task</button>
              </div>
            </div>
          </div>

          <div id="tm-panel-perf" class="tm-panel-perf">
            <div class="tm-panel-header">
              <span class="tm-panel-title">Performance</span>
            </div>
            <div class="tm-perf-body">
              <div class="tm-perf-grid">
                <div class="tm-perf-card">
                  <div class="tm-perf-card-header">
                    <span class="tm-perf-label">CPU Usage</span>
                    <span id="tm-cpu-val" class="tm-perf-val tm-perf-val-cpu">0%</span>
                  </div>
                  <canvas id="tm-cpu-graph" width="280" height="80" class="tm-graph"></canvas>
                </div>
                <div class="tm-perf-card">
                  <div class="tm-perf-card-header">
                    <span class="tm-perf-label">Memory</span>
                    <span id="tm-mem-val" class="tm-perf-val tm-perf-val-mem">0%</span>
                  </div>
                  <canvas id="tm-mem-graph" width="280" height="80" class="tm-graph"></canvas>
                </div>
              </div>
              <div class="tm-perf-card">
                <div class="tm-perf-section-title">System Info</div>
                <div id="tm-sysinfo" class="tm-sysinfo-grid"></div>
              </div>
            </div>
          </div>
        </div>
      </div>`;

    this.bindEvents(win);
    this.renderProcesses(win, "proc");
    this.startRefresh(win);

    setTimeout(() => {
      const tabApps = document.getElementById("tm-tab-apps");
      if (tabApps) tabApps.click();
    }, 100);

    $(".close-btn", win).addEventListener("click", () => {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
      if (this.windowChangeHandlers) {
        os.events.off(BusEvents.WINDOW_CREATED, this.windowChangeHandlers);
        os.events.off(BusEvents.WINDOW_CLOSED, this.windowChangeHandlers);
        this.windowChangeHandlers = null;
      }
    });
  }

  bindEvents(win) {
    const tabProc = $("#tm-tab-proc", win);
    const tabApps = $("#tm-tab-apps", win);
    const tabPerf = $("#tm-tab-perf", win);
    const panelProc = $("#tm-panel-proc", win);
    const panelApps = $("#tm-panel-apps", win);
    const panelPerf = $("#tm-panel-perf", win);

    const switchTo = (tab, panel, type) => {
      [tabProc, tabApps, tabPerf].forEach((t) => t.classList.remove("tm-nav-active"));
      [panelProc, panelApps, panelPerf].forEach((p) => (p.style.display = "none"));
      tab.classList.add("tm-nav-active");
      panel.style.display = "flex";
      if (type === "perf") this.renderSysInfo(win);
      else this.renderProcesses(win, type);
    };

    tabProc.onclick = () => switchTo(tabProc, panelProc, "proc");
    tabApps.onclick = () => switchTo(tabApps, panelApps, "apps");
    tabPerf.onclick = () => switchTo(tabPerf, panelPerf, "perf");

    $("#tm-filter", win).oninput = (e) => {
      this.filter = e.target.value.toLowerCase();
      this.renderProcesses(win, "proc");
    };

    $("#tm-filter-apps", win).oninput = (e) => {
      this.appsFilter = e.target.value.toLowerCase();
      this.renderProcesses(win, "apps");
    };

    $("#tm-btn-refresh", win).onclick = () => this.renderProcesses(win, "proc");
    $("#tm-btn-refresh-apps", win).onclick = () => this.renderProcesses(win, "apps");

    $("#tm-btn-select-all", win).onclick = () => {
      const procs = this.getProcesses().filter((p) => !this.filter || p.title.toLowerCase().includes(this.filter));
      const allSelected = procs.every((p) => this.selectedIds.has(p.winId));
      if (allSelected) this.selectedIds.clear();
      else procs.forEach((p) => this.selectedIds.add(p.winId));
      this.renderProcesses(win, "proc");
    };

    $("#tm-btn-select-all-apps", win).onclick = () => {
      const procs = this.getProcesses()
        .filter((p) => !p.isTray)
        .filter((p) => !this.appsFilter || p.title.toLowerCase().includes(this.appsFilter));
      const allSelected = procs.every((p) => this.appsSelectedIds.has(p.winId));
      if (allSelected) this.appsSelectedIds.clear();
      else procs.forEach((p) => this.appsSelectedIds.add(p.winId));
      this.renderProcesses(win, "apps");
    };

    $("#tm-btn-kill", win).onclick = () => {
      if (this.selectedIds.size === 0) return;
      Array.from(this.selectedIds).forEach((id) => this.killProcess(id));
      this.selectedIds.clear();
      this.updateSelectionUI(win, "proc");
      setTimeout(() => this.renderProcesses(win, "proc"), 200);
    };

    $("#tm-btn-kill-apps", win).onclick = () => {
      if (this.appsSelectedIds.size === 0) return;
      Array.from(this.appsSelectedIds).forEach((id) => this.killProcess(id));
      this.appsSelectedIds.clear();
      this.updateSelectionUI(win, "apps");
      setTimeout(() => this.renderProcesses(win, "apps"), 200);
    };

    $$(".tm-th", win).forEach((th) => {
      th.onclick = () => {
        const key = th.dataset.key;
        if (this.sortKey === key) this.sortAsc = !this.sortAsc;
        else {
          this.sortKey = key;
          this.sortAsc = true;
        }
        this.renderProcesses(win);
      };
    });
  }

  getProcesses() {
    return processManager.getProcesses(this.frameDropScore, this.drainLongTaskBudget());
  }

  renderProcesses(win, tabType = "proc") {
    let procs = this.getProcesses();
    const isAppsTab = tabType === "apps";

    if (isAppsTab) procs = procs.filter((p) => !p.isTray);

    const filterValue = isAppsTab ? this.appsFilter : this.filter;
    if (filterValue) procs = procs.filter((p) => p.title.toLowerCase().includes(filterValue));

    procs.sort((a, b) => {
      let va = a[this.sortKey],
        vb = b[this.sortKey];
      if (typeof va === "string") {
        va = va.toLowerCase();
        vb = vb.toLowerCase();
      }
      return this.sortAsc ? (va > vb ? 1 : -1) : va < vb ? 1 : -1;
    });

    const tbodyId = isAppsTab ? "#tm-tbody-apps" : "#tm-tbody";
    const countId = isAppsTab ? "#tm-count-apps" : "#tm-count";
    const tbody = $(tbodyId, win);
    const countEl = $(countId, win);
    setText(countEl, `${procs.length} ${isAppsTab ? "app" : "process"}${procs.length !== 1 ? "es" : ""}`);

    $$(".tm-th", win).forEach((th) => {
      const arrow = th.dataset.key === this.sortKey ? (this.sortAsc ? " ↑" : " ↓") : "";
      th.textContent = { title: "Name", cpu: "CPU", mem: "Memory", status: "Status" }[th.dataset.key] + arrow;
    });

    if (procs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="tm-empty-row">No ${isAppsTab ? "apps" : "processes"} running</td></tr>`;
      this.updateSelectionUI(win, tabType);
      return;
    }

    const maxCpu = Math.max(...procs.map((p) => p.cpu), 1);
    const maxMem = Math.max(...procs.map((p) => p.mem), 1);

    tbody.innerHTML = procs
      .map((p) => {
        const selectedSet = isAppsTab ? this.appsSelectedIds : this.selectedIds;
        const selected = selectedSet.has(p.winId) ? "tm-row-selected" : "";
        const cpuPct = (p.cpu / maxCpu) * 100;
        const memPct = (p.mem / maxMem) * 100;
        const cpuColor = p.cpu > 50 ? "var(--error)" : p.cpu > 20 ? "var(--brand)" : "var(--brand)";

        const statusClass =
          p.status === "Running"
            ? "tm-status-running"
            : p.status === "Suspended"
              ? "tm-status-suspended"
              : "tm-status-tray";

        const iconHtml = p.icon
          ? p.icon.startsWith("http") || p.icon.startsWith("/")
            ? `<img src="${p.icon}" class="tm-proc-icon-img">`
            : `<i class="${p.icon} tm-proc-icon-fa"></i>`
          : `<span class="tm-proc-icon-placeholder"></span>`;

        return `<tr class="tm-row ${selected}" data-id="${p.winId}">
          <td class="tm-td tm-td-name tm-bar-cell">
            <div class="tm-bar" style="width:${cpuPct}%; background:${cpuColor};"></div>
            <span class="tm-bar-content">${iconHtml}${p.title}</span>
          </td>
          <td class="tm-td tm-td-right tm-bar-cell" style="color:${cpuColor};">
            <div class="tm-bar" style="width:${cpuPct}%; background:${cpuColor};"></div>
            <span class="tm-bar-content">${p.cpu.toFixed(1)}%</span>
          </td>
          <td class="tm-td tm-td-right tm-bar-cell">
            <div class="tm-bar" style="width:${memPct}%; background:#81c995;"></div>
            <span class="tm-bar-content">${p.mem} MB</span>
          </td>
          <td class="tm-td tm-td-right">
            <span class="tm-status-pill ${statusClass}">${p.status}</span>
          </td>
        </tr>`;
      })
      .join("");

    tbody.querySelectorAll(".tm-row").forEach((row) => {
      const selectedSet = isAppsTab ? this.appsSelectedIds : this.selectedIds;
      row.onclick = (e) => {
        const id = row.dataset.id;
        if (e.ctrlKey || e.metaKey) {
          if (selectedSet.has(id)) selectedSet.delete(id);
          else selectedSet.add(id);
        } else if (e.shiftKey && selectedSet.size > 0) {
          const rows = Array.from(tbody.querySelectorAll(".tm-row"));
          const ids = rows.map((r) => r.dataset.id);
          const lastSelected = Array.from(selectedSet).pop();
          const fromIdx = ids.indexOf(lastSelected);
          const toIdx = ids.indexOf(id);
          const [start, end] = fromIdx < toIdx ? [fromIdx, toIdx] : [toIdx, fromIdx];
          ids.slice(start, end + 1).forEach((sid) => selectedSet.add(sid));
        } else {
          if (selectedSet.size === 1 && selectedSet.has(id)) selectedSet.clear();
          else {
            selectedSet.clear();
            selectedSet.add(id);
          }
        }
        this.updateSelectionUI(win, tabType);
        tbody.querySelectorAll(".tm-row").forEach((r) => {
          r.classList.toggle("tm-row-selected", selectedSet.has(r.dataset.id));
        });
      };

      row.ondblclick = () => {
        const id = row.dataset.id;
        const proc = this.getProcesses().find((p) => p.winId === id);
        if (proc?.isTray) {
          os.tray.restoreFromTray(id);
        } else {
          const w = document.getElementById(id);
          if (w) {
            w.style.display = "block";
            os.window.focus(w);
          }
        }
      };
    });

    this.updateSelectionUI(win, tabType);
  }

  updateSelectionUI(win, tabType = "proc") {
    const isAppsTab = tabType === "apps";
    const labelId = isAppsTab ? "#tm-selected-label-apps" : "#tm-selected-label";
    const killBtnId = isAppsTab ? "#tm-btn-kill-apps" : "#tm-btn-kill";
    const selectAllBtnId = isAppsTab ? "#tm-btn-select-all-apps" : "#tm-btn-select-all";
    const selectedSet = isAppsTab ? this.appsSelectedIds : this.selectedIds;
    const filterValue = isAppsTab ? this.appsFilter : this.filter;

    const label = $(labelId, win);
    const killBtn = $(killBtnId, win);
    const selectAllBtn = $(selectAllBtnId, win);
    const count = selectedSet.size;

    if (count === 0) {
      label.textContent = isAppsTab ? "No app selected" : "No process selected";
      label.classList.remove("tm-selected-label-active");
    } else if (count === 1) {
      const id = Array.from(selectedSet)[0];
      const proc = this.getProcesses().find((p) => p.winId === id);
      label.textContent = proc ? `Selected: ${proc.title}` : "1 selected";
      label.classList.add("tm-selected-label-active");
    } else {
      label.textContent = `${count} ${isAppsTab ? "apps" : "processes"} selected`;
      label.classList.add("tm-selected-label-active");
    }

    killBtn.disabled = count === 0;

    const allProcs = this.getProcesses();
    const visibleProcs = isAppsTab
      ? allProcs.filter((p) => !p.isTray).filter((p) => !filterValue || p.title.toLowerCase().includes(filterValue))
      : allProcs.filter((p) => !filterValue || p.title.toLowerCase().includes(filterValue));
    const allSelected = visibleProcs.length > 0 && visibleProcs.every((p) => selectedSet.has(p.winId));
    selectAllBtn.textContent = allSelected ? "Deselect All" : "Select All";
  }

  drawGraph(canvas, history, color) {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = "var(--bg-primary)";
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = "var(--bg-primary)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = (h / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    const step = w / (history.length - 1);
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, color + "55");
    grad.addColorStop(1, color + "00");

    ctx.beginPath();
    ctx.moveTo(0, h);
    history.forEach((v, i) => ctx.lineTo(i * step, h - (v / 100) * h));
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    history.forEach((v, i) => {
      const x = i * step;
      const y = h - (v / 100) * h;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  renderPerf(win) {
    const runningProcs = this.getProcesses();
    const totalCpu = Math.min(
      99,
      runningProcs.reduce((s, p) => s + p.cpu, 0)
    );

    let totalMem;
    if (performance.memory) {
      totalMem = Math.min(99, (performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit) * 100);
    } else {
      const memBase = 35 + runningProcs.length * 3;
      totalMem = Math.min(99, memBase + (Math.random() - 0.5) * 2);
    }

    this.cpuHistory.push(totalCpu);
    this.cpuHistory.shift();
    this.memHistory.push(totalMem);
    this.memHistory.shift();

    const cpuVal = $("#tm-cpu-val", win);
    const memVal = $("#tm-mem-val", win);
    if (cpuVal) setText(cpuVal, `${totalCpu.toFixed(1)}%`);
    if (memVal) setText(memVal, `${totalMem.toFixed(1)}%`);

    this.drawGraph($("#tm-cpu-graph", win), this.cpuHistory, "var(--brand)");
    this.drawGraph($("#tm-mem-graph", win), this.memHistory, "var(--charging)");
  }

  renderSysInfo(win) {
    const hasRealMem = !!performance.memory;
    const hasLongTask = !!window.TurboObserver;

    const heapUsed = hasRealMem ? `${(performance.memory.usedJSHeapSize / 1048576).toFixed(1)} MB` : "N/A";
    const heapTotal = hasRealMem ? `${(performance.memory.jsHeapSizeLimit / 1048576).toFixed(0)} MB` : "N/A";
    const frameMs = this.frameDropScore > 0 ? `${this.frameDropScore.toFixed(1)} ms lag` : "Smooth";

    const info = [
      ["Processes", os.app.getRunningApps().length],
      ["JS Heap Used", heapUsed],
      ["JS Heap Limit", heapTotal],
      ["Frame Health", frameMs],
      ["Browser", navigator.userAgent.match(/(Chrome|Firefox|Safari|Edge)\/[\d.]+/)?.[0] || "Unknown"],
      ["Platform", navigator.platform || "Unknown"],
      ["Cores", navigator.hardwareConcurrency || "?"],
      ["Language", navigator.language || "?"],
      ["Online", navigator.onLine ? "Yes" : "No"],
      ["Device RAM", navigator.deviceMemory ? `${navigator.deviceMemory} GB` : "N/A"],
      ["Screen", `${screen.width}×${screen.height}`]
    ];

    const sourceNote =
      hasRealMem && hasLongTask
        ? "Real heap + long-task data"
        : hasRealMem
          ? "Real heap · no long-task API"
          : "Estimated (no memory API)";

    const el = $("#tm-sysinfo", win);
    if (el) {
      setHTML(
        el,
        info.map(([k, v]) => `<div class="tm-sysinfo-key">${k}</div><div class="tm-sysinfo-val">${v}</div>`).join("") +
          `<div class="tm-sysinfo-note">⬡ ${sourceNote}</div>`
      );
    }
  }

  startRefresh(win) {
    this.renderProcesses(win);
    this.refreshInterval = setInterval(() => {
      const procPanel = $("#tm-panel-proc", win);
      const perfPanel = $("#tm-panel-perf", win);
      if (procPanel && procPanel.style.display !== "none") this.renderProcesses(win);
      if (perfPanel && perfPanel.style.display !== "none") this.renderPerf(win);
    }, 1500);

    const handleWindowChange = () => {
      setTimeout(() => {
        const taskManagerWin = document.getElementById("taskmanager-app");
        if (!taskManagerWin) return;
        const procPanel = $("#tm-panel-proc", taskManagerWin);
        const appsPanel = $("#tm-panel-apps", taskManagerWin);
        this.renderProcesses(taskManagerWin, "proc");
        this.renderProcesses(taskManagerWin, "apps");
      }, 50);
    };

    os.events.on(BusEvents.WINDOW_CREATED, handleWindowChange);
    os.events.on(BusEvents.WINDOW_CLOSED, handleWindowChange);

    this.windowChangeHandlers = handleWindowChange;
  }

}
