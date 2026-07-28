import { $, $$ } from "../shared/domUtils.js";
import { os } from "../framework.js";

class ProcessManager {
  constructor() {
    this.pidMap = new Map();
    this.nextPid = 1000;
    this.usageCache = new Map();
    this.windowBirthTimes = new Map();
    this.cleanupListener = null;
  }

  init() {
    if (this.cleanupListener) return;
    this.cleanupListener = () => this.cleanupPidMap();
    os.events.on("window:closed", this.cleanupListener);
  }

  destroy() {
    if (this.cleanupListener) {
      os.events.off("window:closed", this.cleanupListener);
      this.cleanupListener = null;
    }
  }

  cleanupPidMap() {
    const activeWinIds = new Set();
    os.app.getRunningApps().forEach((app) => activeWinIds.add(app.winId));
    const trayItems = os.tray.getTrayItems();
    const trayKeys =
      trayItems instanceof Map
        ? Array.from(trayItems.keys())
        : Array.isArray(trayItems)
          ? trayItems.map((t) => t.winId)
          : [];
    trayKeys.forEach((id) => activeWinIds.add(id));
    for (const [winId] of this.pidMap) {
      if (!activeWinIds.has(winId)) {
        this.pidMap.delete(winId);
        this.usageCache.delete(winId);
        this.windowBirthTimes.delete(winId);
      }
    }
  }

  getPid(winId) {
    if (!this.pidMap.has(winId)) {
      this.pidMap.set(winId, this.nextPid++);
    }
    return this.pidMap.get(winId);
  }

  winIdByPid(pid) {
    for (const [winId, p] of this.pidMap) {
      if (p === pid) return winId;
    }
    return null;
  }

  measureProcess(winId, win) {
    const now = performance.now();
    if (!this.windowBirthTimes.has(winId)) this.windowBirthTimes.set(winId, now);

    const isMinimized = win.style.display === "none";
    const iframeEl = $("iframe", win);
    const videoEl = $("video", win);
    const canvasEl = $("canvas", win);
    const hasIframe = !!iframeEl;
    const hasVideo = !!videoEl;
    const hasCanvas = !!canvasEl;
    const domNodes = win.querySelectorAll("*").length;
    const prev = this.usageCache.get(winId) || { cpu: 0, mem: 0, domNodes };
    const domDelta = Math.abs(domNodes - prev.domNodes);
    const uptimeMins = (now - this.windowBirthTimes.get(winId)) / 60000;

    let baseMem = 8 + domNodes * 0.04;
    if (hasIframe) baseMem += 35;
    if (hasVideo) baseMem += 18;
    if (hasCanvas) baseMem += 12;
    baseMem += Math.min(uptimeMins * 0.4, 20);
    baseMem += (Math.random() - 0.5) * 2;
    baseMem = Math.max(4, baseMem);

    if (performance.memory) {
      const totalHeapMB = performance.memory.usedJSHeapSize / 1048576;
      const allWins = $$(".window");
      const totalNodes = allWins.reduce((s, w) => s + w.querySelectorAll("*").length, 1);
      const share = domNodes / totalNodes;
      baseMem = Math.max(baseMem, totalHeapMB * share * 0.6);
    }

    const activityStress = Math.min(40, domDelta * 2);
    let cpuShare = isMinimized ? 0.05 : domNodes / Math.max(1, $$(".window *").length);
    if (hasIframe && !isMinimized) cpuShare *= 2.2;
    if (hasVideo && !isMinimized) cpuShare *= 1.8;
    if (hasCanvas && !isMinimized) cpuShare *= 1.5;

    let cpu = activityStress * cpuShare;
    cpu = prev.cpu * 0.55 + cpu * 0.45;
    cpu += (Math.random() - 0.5) * 1.2;
    cpu = Math.max(0.1, Math.min(99, isMinimized ? Math.min(cpu, 1.5) : cpu));

    const result = { cpu, mem: Math.round(baseMem * 10) / 10, domNodes };
    this.usageCache.set(winId, result);
    return result;
  }

  getProcesses(frameDropScore, drainLongTaskBudget) {
    const procs = [];
    const runningApps = os.app.getRunningApps();
    runningApps.forEach((app) => {
      const win = $("#" + app.winId);
      if (!win) return;

      const { cpu, mem } = this.measureProcess(app.winId, win);

      let adjustedCpu = cpu;
      if (frameDropScore !== undefined && drainLongTaskBudget !== undefined) {
        const frameStress = Math.min(100, frameDropScore * 1.8);
        const longTaskStress = Math.min(60, drainLongTaskBudget / 10);
        const systemCpuSignal = frameStress * 0.5 + longTaskStress * 0.5;
        const isMinimized = win.style.display === "none";
        const domNodes = $$("*", win).length;
        const totalWindowNodes = $$(".window").reduce((s, w) => s + w.querySelectorAll("*").length, 0);
        let cpuShare = isMinimized ? 0.05 : domNodes / Math.max(1, totalWindowNodes);
        if (!!$("iframe", win) && !isMinimized) cpuShare *= 2.2;
        if (!!$("video", win) && !isMinimized) cpuShare *= 1.8;
        if (!!$("canvas", win) && !isMinimized) cpuShare *= 1.5;
        adjustedCpu = systemCpuSignal * cpuShare * 3;
        const prev = this.usageCache.get(app.winId) || { cpu: 0, mem: 0 };
        adjustedCpu = prev.cpu * 0.55 + adjustedCpu * 0.45;
        adjustedCpu += (Math.random() - 0.5) * 1.2;
        adjustedCpu = Math.max(0.1, Math.min(99, isMinimized ? Math.min(adjustedCpu, 1.5) : adjustedCpu));
      }

      procs.push({
        pid: this.getPid(app.winId),
        winId: app.winId,
        title: app.title,
        icon: app.icon,
        cpu: adjustedCpu,
        mem,
        status: app.status || "Running",
        isTray: false
      });
    });

    const trayItems = os.tray.getTrayItems();
    const trayArray =
      trayItems instanceof Map
        ? Array.from(trayItems.entries())
            .filter(([, item]) => item.inTray)
            .map(([winId, item]) => ({ winId, ...item }))
        : trayItems;
    trayArray.forEach((item) => {
      if (procs.find((p) => p.winId === item.winId)) return;
      const win = $("#" + item.winId);
      let cpu = 0,
        mem = 0;
      if (win) {
        const m = this.measureProcess(item.winId, win);
        cpu = m.cpu;
        mem = m.mem;
      }
      procs.push({
        pid: this.getPid(item.winId),
        winId: item.winId,
        title: item.label || item.winId,
        icon: item.icon,
        cpu,
        mem,
        status: "Tray",
        isTray: true
      });
    });

    return procs;
  }

  killByPid(pid) {
    const winId = this.winIdByPid(pid);
    if (!winId) return false;
    this.killByWinId(winId);
    return true;
  }

  killByWinId(id) {
    const winEl = $("#" + id);
    if (winEl) {
      const title = os.window.getTitle(winEl.id)?.trim() || id;
      try {
        os.app.close(id);
      } catch (_) {}
      if ($("#" + id)) winEl.remove();
      os.window.removeFromTaskbar(id);
      try {
        os.tray.unregister(id);
      } catch (_) {}
      try {
        os.notify.send("", `"${title}" ended`);
      } catch (_) {}
    } else {
      const trayItems = os.tray.getTrayItems();
      const trayArray =
        trayItems instanceof Map
          ? Array.from(trayItems.entries())
              .filter(([, item]) => item.inTray)
              .map(([winId, item]) => ({ winId, ...item }))
          : Array.isArray(trayItems)
            ? trayItems
            : [];
      const trayItem = trayArray.find((item) => item.winId === id);
      if (trayItem) {
        try {
          os.app.close(id);
        } catch (_) {}
        try {
          os.tray.unregister(id);
        } catch (_) {}
        os.window.removeFromTaskbar(id);
        const hiddenWin = $("#" + id);
        if (hiddenWin) hiddenWin.remove();
        try {
          os.notify.send("", `"${trayItem.label || id}" ended`);
        } catch (_) {}
      }
    }

    this.pidMap.delete(id);
    this.usageCache.delete(id);
    this.windowBirthTimes.delete(id);
  }
}

export const processManager = new ProcessManager();
