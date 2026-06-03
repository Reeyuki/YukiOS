import { BaseApp } from "../core/BaseApp.js";
import { WindowHelper } from "../utils/WindowHelper.js";
import { PersistenceTypes } from "../runtime/AppSchema.js";
import { os } from "../os/index.js";
import { $, $$, bindEvent, setText, setHTML, toggleClass } from "../shared/domUtils.js";

export class TaskManagerApp extends BaseApp {
  constructor(services) {
    super(services);
    this.windowHelper = new WindowHelper(this.wm);
    this.refreshInterval = null;
    this.sortKey = "title";
    this.sortAsc = true;
    this.filter = "";
    this.selectedIds = new Set();
    this.cpuHistory = Array(30).fill(0);
    this.memHistory = Array(30).fill(0);
    this.usageCache = new Map();
    this.windowBirthTimes = new Map();
    this.frameDropScore = 0;
    this.longTaskBudget = 0;
    this._startFrameMonitor();
    this._startLongTaskMonitor();
    this._declarativeApp = null;
  }

  _startFrameMonitor() {
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

  _startLongTaskMonitor() {
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

  _drainLongTaskBudget() {
    const v = Math.min(this.longTaskBudget, 2000);
    this.longTaskBudget = Math.max(0, this.longTaskBudget - v);
    return v;
  }

  getDeclarativeSchema(opts) {
    return {
      id: "taskmanager-app",
      name: "Task Manager",
      icon: "fa fa-tasks",
      windows: [
        {
          id: "taskmanager-app",
          title: "Task Manager",
          size: ["700px", "520px"],
          icon: "fa fa-tasks",
          ui: `<div id="tm-root">
        <div class="tm-tabs">
          <button id="tm-tab-proc" class="tm-tab tm-tab-active">Processes</button>
          <button id="tm-tab-perf" class="tm-tab">Turbo</button>
        </div>

        <div id="tm-panel-proc" class="tm-panel-proc">
          <div class="tm-toolbar">
            <span class="tm-search-icon">⌕</span>
            <input id="tm-filter" class="tm-filter-input" placeholder="Filter processes…"/>
            <span id="tm-count" class="tm-count"></span>
          </div>
          <div class="tm-table-wrap">
            <table id="tm-table" class="tm-table">
              <colgroup>
                <col style="width:40%">
                <col style="width:20%">
                <col style="width:20%">
                <col style="width:20%">
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
              <button id="tm-btn-select-all" class="tm-action-btn">☰ Select All</button>
              <button id="tm-btn-refresh" class="tm-action-btn">↺ Refresh</button>
              <button id="tm-btn-kill" class="tm-action-btn tm-kill-btn" disabled>✕ End Task</button>
            </div>
          </div>
        </div>

        <div id="tm-panel-perf" class="tm-panel-perf">
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
      </div>`,
          events: {
            "#tm-tab-proc": {
              click: {
                type: "custom:switchTab",
                stopPropagation: true
              }
            },
            "#tm-tab-perf": {
              click: {
                type: "custom:switchTab",
                stopPropagation: true
              }
            },
            "#tm-filter": {
              input: {
                type: "custom:filterProcesses",
                stopPropagation: false
              }
            },
            "#tm-btn-refresh": {
              click: {
                type: "custom:refresh",
                stopPropagation: true
              }
            },
            "#tm-btn-select-all": {
              click: {
                type: "custom:selectAll",
                stopPropagation: true
              }
            },
            "#tm-btn-kill": {
              click: {
                type: "custom:killProcess",
                stopPropagation: true
              }
            }
          }
        }
      ],
      state: {
        initial: {
          sortKey: "title",
          sortAsc: true,
          filter: "",
          selectedIds: [],
          cpuHistory: Array(30).fill(0),
          memHistory: Array(30).fill(0)
        },
        persistence: PersistenceTypes.MEMORY
      },
      actions: {
        switchTab: (payload, event, element, state) => {
          const tabProc = document.getElementById("tm-tab-proc");
          const tabPerf = document.getElementById("tm-tab-perf");
          const panelProc = document.getElementById("tm-panel-proc");
          const panelPerf = document.getElementById("tm-panel-perf");
          const tabId = element.dataset.tab;

          if (tabId === "proc") {
            tabProc.classList.add("tm-tab-active");
            tabPerf.classList.remove("tm-tab-active");
            panelProc.style.display = "flex";
            panelPerf.style.display = "none";
          } else if (tabId === "perf") {
            tabPerf.classList.add("tm-tab-active");
            tabProc.classList.remove("tm-tab-active");
            panelPerf.style.display = "flex";
            panelProc.style.display = "none";
          }
        },
        filterProcesses: (payload, event, element, state) => {
          state.filter = event.target.value.toLowerCase();
          this._renderProcesses(document.getElementById("taskmanager-app"));
        },
        refresh: (payload, event, element, state) => {
          this._renderProcesses(document.getElementById("taskmanager-app"));
          this._renderPerf(document.getElementById("taskmanager-app"));
        },
        selectAll: (payload, event, element, state) => {
          const win = document.getElementById("taskmanager-app");
          const tbody = $("#tm-proc-tbody", win);
          const visibleProcs = this._getProcesses().filter(
            (p) => !state.filter || p.title.toLowerCase().includes(state.filter)
          );
          const allSelected = visibleProcs.length > 0 && visibleProcs.every((p) => state.selectedIds.includes(p.winId));

          if (allSelected) {
            state.selectedIds = [];
          } else {
            state.selectedIds = visibleProcs.map((p) => p.winId);
          }

          tbody.querySelectorAll(".tm-row").forEach((r) => {
            r.classList.toggle("tm-row-selected", state.selectedIds.includes(r.dataset.id));
          });

          this._updateSelectionUI(win);
        },
        killProcess: (payload, event, element, state) => {
          const win = document.getElementById("taskmanager-app");
          const idsToKill = state.selectedIds.length > 0 ? Array.from(state.selectedIds) : [element.dataset.id];

          idsToKill.forEach((id) => {
            const w = document.getElementById(id);
            if (w) {
              const closeBtn = w.querySelector(".close-btn");
              if (closeBtn) closeBtn.click();
            }
          });

          state.selectedIds = [];
          this._updateSelectionUI(win);
          setTimeout(() => this._renderProcesses(win), 200);
        }
      },
      onMount: "initTaskManager"
    };
  }

  initTaskManager(payload, event, element, state) {}

  open() {
    const winId = "taskmanager-app";
    if (document.getElementById(winId)) {
      os.window.focus(document.getElementById(winId));
      return;
    }

    const content = `
      <div id="tm-root">
        <div class="tm-tabs">
          <button id="tm-tab-proc" class="tm-tab tm-tab-active">Processes</button>
          <button id="tm-tab-perf" class="tm-tab">Turbo</button>
        </div>

        <div id="tm-panel-proc" class="tm-panel-proc">
          <div class="tm-toolbar">
            <span class="tm-search-icon">⌕</span>
            <input id="tm-filter" class="tm-filter-input" placeholder="Filter processes…"/>
            <span id="tm-count" class="tm-count"></span>
          </div>
          <div class="tm-table-wrap">
            <table id="tm-table" class="tm-table">
              <colgroup>
                <col style="width:40%">
                <col style="width:20%">
                <col style="width:20%">
                <col style="width:20%">
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
              <button id="tm-btn-select-all" class="tm-action-btn">☰ Select All</button>
              <button id="tm-btn-refresh" class="tm-action-btn">↺ Refresh</button>
              <button id="tm-btn-kill" class="tm-action-btn tm-kill-btn" disabled>✕ End Task</button>
            </div>
          </div>
        </div>
        <div id="tm-panel-perf" class="tm-panel-perf">
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
    `;

    const win = this.windowHelper.createAndMountWindow(winId, "Task Manager", content, "700px", "520px", {
      icon: "fa fa-tasks",
      style: { left: "200px", top: "100px" }
    });

    this._bindEvents(win);
    this._startRefresh(win);

    $(".close-btn", win).addEventListener("click", () => {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    });
  }

  _measureWindow(winId, win) {
    const now = performance.now();
    if (!this.windowBirthTimes.has(winId)) this.windowBirthTimes.set(winId, now);

    const isMinimized = win.style.display === "none";
    const hasIframe = !!$("iframe", win);
    const hasVideo = !!$("video", win);
    const hasCanvas = !!$("canvas", win);
    const domNodes = $$("*", win).length;
    const uptimeMins = (now - this.windowBirthTimes.get(winId)) / 60000;
    const prev = this.usageCache.get(winId) || { cpu: 0, mem: 0, domNodes };
    const domDelta = Math.abs(domNodes - prev.domNodes);

    let baseMem = 8 + domNodes * 0.04;
    if (hasIframe) baseMem += 35;
    if (hasVideo) baseMem += 18;
    if (hasCanvas) baseMem += 12;
    baseMem += Math.min(uptimeMins * 0.4, 20);
    baseMem += (Math.random() - 0.5) * 2;
    baseMem = Math.max(4, baseMem);

    if (performance.memory) {
      const totalHeapMB = performance.memory.usedJSHeapSize / 1048576;
      const allWins = document.querySelectorAll(".window");
      const totalNodes = Array.from(allWins).reduce((s, w) => s + w.querySelectorAll("*").length, 1);
      const share = domNodes / totalNodes;
      baseMem = Math.max(baseMem, totalHeapMB * share * 0.6);
    }

    const frameStress = Math.min(100, this.frameDropScore * 1.8);
    const longTaskStress = Math.min(60, this._drainLongTaskBudget() / 10);
    const activityStress = Math.min(40, domDelta * 2);

    let cpuShare = isMinimized ? 0.05 : domNodes / Math.max(1, document.querySelectorAll(".window *").length);
    if (hasIframe && !isMinimized) cpuShare *= 2.2;
    if (hasVideo && !isMinimized) cpuShare *= 1.8;
    if (hasCanvas && !isMinimized) cpuShare *= 1.5;

    const systemCpuSignal = frameStress * 0.5 + longTaskStress * 0.5;
    let cpu = systemCpuSignal * cpuShare * 3 + activityStress * cpuShare;
    cpu = prev.cpu * 0.55 + cpu * 0.45;
    cpu += (Math.random() - 0.5) * 1.2;
    cpu = Math.max(0.1, Math.min(99, isMinimized ? Math.min(cpu, 1.5) : cpu));

    const result = { cpu, mem: Math.round(baseMem * 10) / 10, domNodes };
    this.usageCache.set(winId, result);
    return result;
  }

  _bindEvents(win) {
    const tabProc = $("#tm-tab-proc", win);
    const tabPerf = $("#tm-tab-perf", win);
    const panelProc = $("#tm-panel-proc", win);
    const panelPerf = $("#tm-panel-perf", win);

    tabProc.onclick = () => {
      tabProc.classList.add("tm-tab-active");
      tabPerf.classList.remove("tm-tab-active");
      panelProc.style.display = "flex";
      panelPerf.style.display = "none";
    };

    tabPerf.onclick = () => {
      tabPerf.classList.add("tm-tab-active");
      tabProc.classList.remove("tm-tab-active");
      panelPerf.style.display = "flex";
      panelProc.style.display = "none";
      this._renderSysInfo(win);
    };

    $("#tm-filter", win).oninput = (e) => {
      this.filter = e.target.value.toLowerCase();
      this._renderProcesses(win);
    };

    $("#tm-btn-refresh", win).onclick = () => this._renderProcesses(win);

    $("#tm-btn-select-all", win).onclick = () => {
      const procs = this._getProcesses().filter((p) => !this.filter || p.title.toLowerCase().includes(this.filter));
      const allSelected = procs.every((p) => this.selectedIds.has(p.winId));
      if (allSelected) {
        this.selectedIds.clear();
      } else {
        procs.forEach((p) => this.selectedIds.add(p.winId));
      }
      this._renderProcesses(win);
    };

    $("#tm-btn-kill", win).onclick = () => {
      if (this.selectedIds.size === 0) return;
      const ids = Array.from(this.selectedIds);
      const procs = this._getProcesses();
      ids.forEach((id) => {
        const w = document.getElementById(id);
        const proc = procs.find((p) => p.winId === id);
        const title = proc?.title || id;
        if (w) {
          const iframe = w.querySelector("iframe");
          if (iframe) iframe.src = "about:blank";
          w.style.animation = "popUp 0.5s ease forwards";
          setTimeout(() => w.remove(), 500);
        }
        os.window.removeFromTaskbar(id);
        os.notify.send("", `"${title}" ended`);
      });
      this.selectedIds.clear();
      this._renderProcesses(win);
    };

    $$(".tm-th", win).forEach((th) => {
      th.onclick = () => {
        const key = th.dataset.key;
        if (this.sortKey === key) this.sortAsc = !this.sortAsc;
        else {
          this.sortKey = key;
          this.sortAsc = true;
        }
        this._renderProcesses(win);
      };
    });
  }

  _getProcesses() {
    const procs = [];
    document.querySelectorAll(".taskbar-item").forEach((item) => {
      const winId = item.id.replace("taskbar-", "");
      const win = document.getElementById(winId);
      if (!win) return;

      const { cpu, mem } = this._measureWindow(winId, win);

      const iconEl = item.querySelector("img, i");
      let icon = null;
      if (iconEl?.tagName === "IMG") icon = iconEl.src;
      else if (iconEl?.className) icon = iconEl.className;

      const titleEl = $(".window-header span", win);
      const title = titleEl ? titleEl.textContent.trim() : winId;
      const visible = win.style.display !== "none";

      procs.push({ winId, title, icon, cpu, mem, status: visible ? "Running" : "Suspended" });
    });
    return procs;
  }

  _renderProcesses(win) {
    let procs = this._getProcesses();

    if (this.filter) {
      procs = procs.filter((p) => p.title.toLowerCase().includes(this.filter));
    }

    procs.sort((a, b) => {
      let va = a[this.sortKey],
        vb = b[this.sortKey];
      if (typeof va === "string") ((va = va.toLowerCase()), (vb = vb.toLowerCase()));
      return this.sortAsc ? (va > vb ? 1 : -1) : va < vb ? 1 : -1;
    });

    const tbody = $("#tm-tbody", win);
    const countEl = $("#tm-count", win);
    setText(countEl, `${procs.length} process${procs.length !== 1 ? "es" : ""}`);

    $$(".tm-th", win).forEach((th) => {
      const arrow = th.dataset.key === this.sortKey ? (this.sortAsc ? " ↑" : " ↓") : "";
      th.textContent = { title: "Name", cpu: "CPU", mem: "Memory", status: "Status" }[th.dataset.key] + arrow;
    });

    if (procs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="tm-empty-row">No processes running</td></tr>`;
      this._updateSelectionUI(win);
      return;
    }

    const maxCpu = Math.max(...procs.map((p) => p.cpu), 1);
    const maxMem = Math.max(...procs.map((p) => p.mem), 1);

    tbody.innerHTML = procs
      .map((p) => {
        const selected = this.selectedIds.has(p.winId) ? "tm-row-selected" : "";
        const cpuPct = (p.cpu / maxCpu) * 100;
        const memPct = (p.mem / maxMem) * 100;
        const cpuColor = p.cpu > 50 ? "#ef5350" : p.cpu > 20 ? "#ffa726" : "#4fc3f7";
        const statusColor = p.status === "Running" ? "#81c995" : "#888";

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
          <td class="tm-td tm-td-right tm-bar-cell tm-td-mem">
            <div class="tm-bar" style="width:${memPct}%; background:#81c995;"></div>
            <span class="tm-bar-content">${p.mem} MB</span>
          </td>
          <td class="tm-td tm-td-right" style="color:${statusColor};">${p.status}</td>
        </tr>`;
      })
      .join("");

    tbody.querySelectorAll(".tm-row").forEach((row) => {
      row.onclick = (e) => {
        const id = row.dataset.id;
        if (e.ctrlKey || e.metaKey) {
          if (this.selectedIds.has(id)) {
            this.selectedIds.delete(id);
          } else {
            this.selectedIds.add(id);
          }
        } else if (e.shiftKey && this.selectedIds.size > 0) {
          const rows = Array.from(tbody.querySelectorAll(".tm-row"));
          const ids = rows.map((r) => r.dataset.id);
          const lastSelected = Array.from(this.selectedIds).pop();
          const fromIdx = ids.indexOf(lastSelected);
          const toIdx = ids.indexOf(id);
          const [start, end] = fromIdx < toIdx ? [fromIdx, toIdx] : [toIdx, fromIdx];
          ids.slice(start, end + 1).forEach((sid) => this.selectedIds.add(sid));
        } else {
          if (this.selectedIds.size === 1 && this.selectedIds.has(id)) {
            this.selectedIds.clear();
          } else {
            this.selectedIds.clear();
            this.selectedIds.add(id);
          }
        }
        this._updateSelectionUI(win);
        tbody.querySelectorAll(".tm-row").forEach((r) => {
          r.classList.toggle("tm-row-selected", this.selectedIds.has(r.dataset.id));
        });
      };

      row.ondblclick = () => {
        const w = document.getElementById(row.dataset.id);
        if (w) {
          w.style.display = "block";
          os.window.focus(w);
        }
      };
    });

    this._updateSelectionUI(win);
  }

  _updateSelectionUI(win) {
    const label = $("#tm-selected-label", win);
    const killBtn = $("#tm-btn-kill", win);
    const selectAllBtn = $("#tm-btn-select-all", win);
    const count = this.selectedIds.size;

    if (count === 0) {
      label.textContent = "No process selected";
      label.classList.remove("tm-selected-label-active");
    } else if (count === 1) {
      const id = Array.from(this.selectedIds)[0];
      const proc = this._getProcesses().find((p) => p.winId === id);
      label.textContent = proc ? `Selected: ${proc.title}` : "1 selected";
      label.classList.add("tm-selected-label-active");
    } else {
      label.textContent = `${count} processes selected`;
      label.classList.add("tm-selected-label-active");
    }

    killBtn.disabled = count === 0;

    const visibleProcs = this._getProcesses().filter(
      (p) => !this.filter || p.title.toLowerCase().includes(this.filter)
    );
    const allSelected = visibleProcs.length > 0 && visibleProcs.every((p) => this.selectedIds.has(p.winId));
    selectAllBtn.textContent = allSelected ? "☐ Deselect All" : "☰ Select All";
  }

  _drawGraph(canvas, history, color) {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = "#1e1e1e";
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
    history.forEach((v, i) => {
      ctx.lineTo(i * step, h - (v / 100) * h);
    });
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

  _renderPerf(win) {
    const runningProcs = this._getProcesses();
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

    this._drawGraph($("#tm-cpu-graph", win), this.cpuHistory, "#4fc3f7");
    this._drawGraph($("#tm-mem-graph", win), this.memHistory, "#81c995");
  }

  _renderSysInfo(win) {
    const hasRealMem = !!performance.memory;
    const hasLongTask = !!window.TurboObserver;

    const heapUsed = hasRealMem ? `${(performance.memory.usedJSHeapSize / 1048576).toFixed(1)} MB` : "N/A";
    const heapTotal = hasRealMem ? `${(performance.memory.jsHeapSizeLimit / 1048576).toFixed(0)} MB` : "N/A";
    const frameMs = this.frameDropScore > 0 ? `${this.frameDropScore.toFixed(1)} ms lag` : "Smooth";

    const info = [
      ["Processes", document.querySelectorAll(".taskbar-item").length],
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

  _startRefresh(win) {
    this._renderProcesses(win);
    this.refreshInterval = setInterval(() => {
      const procPanel = $("#tm-panel-proc", win);
      const perfPanel = $("#tm-panel-perf", win);
      if (procPanel && procPanel.style.display !== "none") {
        this._renderProcesses(win);
      }
      if (perfPanel && perfPanel.style.display !== "none") {
        this._renderPerf(win);
      }
    }, 1500);
  }
}
