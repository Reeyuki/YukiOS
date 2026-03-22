import { desktop } from "./desktop.js";

export class TaskManagerApp {
  constructor(windowManager) {
    this.wm = windowManager;
    this.refreshInterval = null;
    this.sortKey = "title";
    this.sortAsc = true;
    this.filter = "";
    this.selectedId = null;
    this.cpuHistory = Array(30).fill(0);
    this.memHistory = Array(30).fill(0);
    this.usageCache = new Map();
    this.windowBirthTimes = new Map();
    this.frameDropScore = 0;
    this.longTaskBudget = 0;
    this._startFrameMonitor();
    this._startLongTaskMonitor();
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
    if (!window.PerformanceObserver) return;
    try {
      const obs = new PerformanceObserver((list) => {
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

  _measureWindow(winId, win) {
    const now = performance.now();
    if (!this.windowBirthTimes.has(winId)) this.windowBirthTimes.set(winId, now);

    const isMinimized = win.style.display === "none";
    const hasIframe = !!win.querySelector("iframe");
    const hasVideo = !!win.querySelector("video");
    const hasCanvas = !!win.querySelector("canvas");
    const domNodes = win.querySelectorAll("*").length;
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

  open() {
    const winId = "taskmanager-app";
    if (document.getElementById(winId)) {
      this.wm.bringToFront(document.getElementById(winId));
      return;
    }

    const win = this.wm.createWindow(winId, "Task Manager", "700px", "520px");
    Object.assign(win.style, { left: "200px", top: "100px" });

    win.innerHTML = `
      <div class="window-header">
        <span>Task Manager</span>
        ${this.wm.getWindowControls()}
      </div>
      <div id="tm-root" style="
        display:flex; flex-direction:column; height:calc(100% - 32px);
        background:#0d0d0d; color:#c8c8c8; font-family:'Consolas','Courier New',monospace;
        font-size:12px; overflow:hidden;
      ">
        <div style="display:flex; gap:0; border-bottom:1px solid #222;">
          <button id="tm-tab-proc" class="tm-tab tm-tab-active">Processes</button>
          <button id="tm-tab-perf" class="tm-tab">Performance</button>
        </div>

        <div id="tm-panel-proc" style="display:flex; flex-direction:column; flex:1; overflow:hidden;">
          <div style="display:flex; align-items:center; gap:8px; padding:6px 10px; border-bottom:1px solid #1e1e1e; background:#111;">
            <span style="color:#555; font-size:11px;">⌕</span>
            <input id="tm-filter" placeholder="Filter processes…" style="
              background:transparent; border:none; outline:none; color:#c8c8c8;
              font-family:inherit; font-size:12px; flex:1;
            "/>
            <span id="tm-count" style="color:#444; font-size:11px;"></span>
          </div>
          <div style="overflow-y:auto; flex:1;">
            <table id="tm-table" style="width:100%; border-collapse:collapse; table-layout:fixed;">
              <colgroup>
                <col style="width:40%">
                <col style="width:20%">
                <col style="width:20%">
                <col style="width:20%">
              </colgroup>
              <thead>
                <tr style="background:#111; position:sticky; top:0; z-index:2;">
                  <th class="tm-th" data-key="title" style="text-align:left; padding:6px 10px; color:#888; font-weight:normal; border-bottom:1px solid #222; cursor:pointer;">Name</th>
                  <th class="tm-th" data-key="cpu" style="text-align:right; padding:6px 10px; color:#888; font-weight:normal; border-bottom:1px solid #222; cursor:pointer;">CPU</th>
                  <th class="tm-th" data-key="mem" style="text-align:right; padding:6px 10px; color:#888; font-weight:normal; border-bottom:1px solid #222; cursor:pointer;">Memory</th>
                  <th class="tm-th" data-key="status" style="text-align:right; padding:6px 10px; color:#888; font-weight:normal; border-bottom:1px solid #222; cursor:pointer;">Status</th>
                </tr>
              </thead>
              <tbody id="tm-tbody"></tbody>
            </table>
          </div>
          <div style="display:flex; align-items:center; justify-content:space-between; padding:8px 10px; border-top:1px solid #1e1e1e; background:#111;">
            <span id="tm-selected-label" style="color:#555; font-size:11px;">No process selected</span>
            <div style="display:flex; gap:6px;">
              <button id="tm-btn-refresh" class="tm-action-btn">↺ Refresh</button>
              <button id="tm-btn-kill" class="tm-action-btn tm-kill-btn" disabled>✕ End Task</button>
            </div>
          </div>
        </div>

        <div id="tm-panel-perf" style="display:none; flex:1; padding:16px; overflow-y:auto; gap:16px; flex-direction:column;">
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
            <div class="tm-perf-card">
              <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:8px;">
                <span style="color:#888; font-size:11px; letter-spacing:1px; text-transform:uppercase;">CPU Usage</span>
                <span id="tm-cpu-val" style="color:#4fc3f7; font-size:20px; font-weight:bold;">0%</span>
              </div>
              <canvas id="tm-cpu-graph" width="280" height="80" style="width:100%; height:80px; display:block;"></canvas>
            </div>
            <div class="tm-perf-card">
              <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:8px;">
                <span style="color:#888; font-size:11px; letter-spacing:1px; text-transform:uppercase;">Memory</span>
                <span id="tm-mem-val" style="color:#81c995; font-size:20px; font-weight:bold;">0%</span>
              </div>
              <canvas id="tm-mem-graph" width="280" height="80" style="width:100%; height:80px; display:block;"></canvas>
            </div>
          </div>
          <div class="tm-perf-card">
            <div style="color:#888; font-size:11px; letter-spacing:1px; text-transform:uppercase; margin-bottom:10px;">System Info</div>
            <div id="tm-sysinfo" style="display:grid; grid-template-columns:1fr 1fr; gap:6px 20px;"></div>
          </div>
        </div>
      </div>
    `;

    desktop.appendChild(win);
    this.wm.makeDraggable(win);
    this.wm.makeResizable(win);
    this.wm.setupWindowControls(win);
    this.wm.addToTaskbar(win.id, "Task Manager", "fa fa-tasks");

    this._bindEvents(win);
    this._startRefresh(win);

    win.querySelector(".close-btn").addEventListener("click", () => {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    });
  }

  _bindEvents(win) {
    const tabProc = win.querySelector("#tm-tab-proc");
    const tabPerf = win.querySelector("#tm-tab-perf");
    const panelProc = win.querySelector("#tm-panel-proc");
    const panelPerf = win.querySelector("#tm-panel-perf");

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

    win.querySelector("#tm-filter").oninput = (e) => {
      this.filter = e.target.value.toLowerCase();
      this._renderProcesses(win);
    };

    win.querySelector("#tm-btn-refresh").onclick = () => this._renderProcesses(win);

    win.querySelector("#tm-btn-kill").onclick = () => {
      if (!this.selectedId) return;
      const w = document.getElementById(this.selectedId);
      const proc = this._getProcesses().find((p) => p.winId === this.selectedId);
      const title = proc?.title || this.selectedId;
      if (w) {
        const iframe = w.querySelector("iframe");
        if (iframe) iframe.src = "about:blank";
        w.style.animation = "popUp 0.5s ease forwards";
        setTimeout(() => w.remove(), 500);
      }
      this.wm.removeFromTaskbar(this.selectedId);
      this.wm.showPopup(`"${title}" ended`);
      this.selectedId = null;
      this._renderProcesses(win);
    };

    win.querySelectorAll(".tm-th").forEach((th) => {
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

      const titleEl = win.querySelector(".window-header span");
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

    const tbody = win.querySelector("#tm-tbody");
    const countEl = win.querySelector("#tm-count");
    countEl.textContent = `${procs.length} process${procs.length !== 1 ? "es" : ""}`;

    win.querySelectorAll(".tm-th").forEach((th) => {
      const arrow = th.dataset.key === this.sortKey ? (this.sortAsc ? " ↑" : " ↓") : "";
      th.textContent = { title: "Name", cpu: "CPU", mem: "Memory", status: "Status" }[th.dataset.key] + arrow;
    });

    if (procs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#444; padding:30px;">No processes running</td></tr>`;
      return;
    }

    const maxCpu = Math.max(...procs.map((p) => p.cpu), 1);
    const maxMem = Math.max(...procs.map((p) => p.mem), 1);

    tbody.innerHTML = procs
      .map((p) => {
        const selected = p.winId === this.selectedId ? "tm-row-selected" : "";
        const cpuPct = (p.cpu / maxCpu) * 100;
        const memPct = (p.mem / maxMem) * 100;
        const cpuColor = p.cpu > 50 ? "#ef5350" : p.cpu > 20 ? "#ffa726" : "#4fc3f7";
        const statusColor = p.status === "Running" ? "#81c995" : "#888";

        const iconHtml = p.icon
          ? p.icon.startsWith("http") || p.icon.startsWith("/")
            ? `<img src="${p.icon}" style="width:14px;height:14px;margin-right:6px;vertical-align:middle;object-fit:contain;">`
            : `<i class="${p.icon}" style="font-size:12px;margin-right:6px;color:#888;vertical-align:middle;"></i>`
          : `<span style="display:inline-block;width:14px;margin-right:6px;"></span>`;

        return `<tr class="tm-row ${selected}" data-id="${p.winId}">
        <td style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; position:relative;">
          <div class="tm-bar" style="width:${cpuPct}%; background:${cpuColor};"></div>
          <span style="position:relative;">${iconHtml}${p.title}</span>
        </td>
        <td style="text-align:right; color:${cpuColor}; position:relative;">
          <div class="tm-bar" style="width:${cpuPct}%; background:${cpuColor};"></div>
          <span style="position:relative;">${p.cpu.toFixed(1)}%</span>
        </td>
        <td style="text-align:right; color:#81c995; position:relative;">
          <div class="tm-bar" style="width:${memPct}%; background:#81c995;"></div>
          <span style="position:relative;">${p.mem} MB</span>
        </td>
        <td style="text-align:right; color:${statusColor};">${p.status}</td>
      </tr>`;
      })
      .join("");

    tbody.querySelectorAll(".tm-row").forEach((row) => {
      row.onclick = () => {
        this.selectedId = row.dataset.id;
        tbody.querySelectorAll(".tm-row").forEach((r) => r.classList.remove("tm-row-selected"));
        row.classList.add("tm-row-selected");

        const proc = procs.find((p) => p.winId === this.selectedId);
        const label = win.querySelector("#tm-selected-label");
        label.textContent = proc ? `Selected: ${proc.title}` : "No process selected";
        label.style.color = "#aaa";

        const killBtn = win.querySelector("#tm-btn-kill");
        killBtn.disabled = !this.selectedId;
      };

      row.ondblclick = () => {
        const w = document.getElementById(row.dataset.id);
        if (w) {
          w.style.display = "block";
          this.wm.bringToFront(w);
        }
      };
    });
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

    const cpuVal = win.querySelector("#tm-cpu-val");
    const memVal = win.querySelector("#tm-mem-val");
    if (cpuVal) cpuVal.textContent = `${totalCpu.toFixed(1)}%`;
    if (memVal) memVal.textContent = `${totalMem.toFixed(1)}%`;

    this._drawGraph(win.querySelector("#tm-cpu-graph"), this.cpuHistory, "#4fc3f7");
    this._drawGraph(win.querySelector("#tm-mem-graph"), this.memHistory, "#81c995");
  }

  _renderSysInfo(win) {
    const hasRealMem = !!performance.memory;
    const hasLongTask = !!window.PerformanceObserver;

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

    const el = win.querySelector("#tm-sysinfo");
    if (el) {
      el.innerHTML =
        info
          .map(([k, v]) => `<div style="color:#555;font-size:11px;">${k}</div><div style="color:#aaa;">${v}</div>`)
          .join("") +
        `<div style="grid-column:span 2;margin-top:8px;color:#3a3a3a;font-size:10px;letter-spacing:0.04em;">⬡ ${sourceNote}</div>`;
    }
  }

  _startRefresh(win) {
    this._renderProcesses(win);
    this.refreshInterval = setInterval(() => {
      const procPanel = win.querySelector("#tm-panel-proc");
      const perfPanel = win.querySelector("#tm-panel-perf");
      if (procPanel && procPanel.style.display !== "none") {
        this._renderProcesses(win);
      }
      if (perfPanel && perfPanel.style.display !== "none") {
        this._renderPerf(win);
      }
    }, 1500);
  }
}
