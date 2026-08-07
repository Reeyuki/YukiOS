import "./style.css";
import { TilingLayoutEngine as Engine } from "../../windowManager/TilingLayoutEngine.js";
import { MasterStackEngine } from "../../windowManager/MasterStackEngine.js";
import { bus, BusEvents } from "../../core/EventBus.js";
import { StorageKeys, os, $ } from "../../framework.js";
import { TilingBar } from "../../tiling/TilingBar.js";
import { modeManager, MODES } from "../../modeManager.js";

const CONFIG_PATH = ["Config", "yukiOs", "tiling.conf"];

export class TilingManager {
  constructor(windowManager) {
    this.wm = windowManager;
    this.enabled = false;
    this.config = null;
    this.trees = new Map();
    this.configString = null;
    this.pollTimer = null;
    this.lastMouseX = 0;
    this.lastMouseY = 0;
    this.tilingBar = new TilingBar(this);
  }

  getDefaultConfig() {
    return {
      enabled: false,
      gaps: { inner: 6, outer: 6, outerBottom: 0 },
      layout: "bsp",
      split_ratio: 0.5,
      border_width: 3,
      border_radius: 8,
      resize_delta: 0.05,
      animation_duration: 250,
      animation_easing: "cubic-bezier(0.16, 1, 0.3, 1)",
      mouse_resize: true,
      config_poll_interval: 3000,
      workspace_switch_delay: 320,
      resize_debounce: 150
    };
  }

  getEffectiveConfig() {
    const d = this.getDefaultConfig();
    const c = this.config || d;
    const g = c.gaps || {};
    return {
      enabled: c.enabled ?? d.enabled,
      gaps: {
        inner: g.inner ?? d.gaps.inner,
        outer: g.outer ?? d.gaps.outer
      },
      layout: c.layout ?? d.layout,
      split_ratio: c.split_ratio ?? d.split_ratio,
      border_width: c.border_width ?? d.border_width,
      border_radius: c.border_radius ?? d.border_radius,
      resize_delta: c.resize_delta ?? d.resize_delta,
      animation_duration: c.animation_duration ?? d.animation_duration,
      animation_easing: c.animation_easing ?? d.animation_easing,
      mouse_resize: c.mouse_resize ?? d.mouse_resize,
      config_poll_interval: c.config_poll_interval ?? d.config_poll_interval,
      workspace_switch_delay: c.workspace_switch_delay ?? d.workspace_switch_delay,
      resize_debounce: c.resize_debounce ?? d.resize_debounce
    };
  }

  getLayoutEngine() {
    return this.getEffectiveConfig().layout === "master-stack" ? MasterStackEngine : Engine;
  }

  getTransition() {
    const cfg = this.getEffectiveConfig();
    const dur = cfg.animation_duration;
    const ease = cfg.animation_easing;
    return `left ${dur}ms ${ease}, top ${dur}ms ${ease}, width ${dur}ms ${ease}, height ${dur}ms ${ease}`;
  }

  applyCssVars() {
    const cfg = this.getEffectiveConfig();
    document.documentElement.style.setProperty("--tiling-border-width", `${cfg.border_width}px`);
    document.documentElement.style.setProperty("--tiling-border-radius", `${cfg.border_radius}px`);
  }

  async init() {
    this.tilingBar.init();
    await this.loadConfig();
    this.watchConfig();
    document.addEventListener("mousemove", (e) => {
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
    });
    bus.on(BusEvents.WINDOW_CLOSED, ({ winId }) => this.onWindowClosed(winId));
    bus.on(BusEvents.WORKSPACE_SWITCHED, () => this.onWorkspaceSwitch());
    let resizeTimer;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (this.enabled) {
          this.applyLayoutToAllWindows();
        }
      }, this.getEffectiveConfig().resize_debounce);
    });
  }

  async loadConfig() {
    try {
      const content = await os.fs.read(CONFIG_PATH);
      if (content) {
        this.config = this.mergeDefaults(JSON.parse(content));
        this.configString = content;
      } else {
        this.config = this.getDefaultConfig();
        this.configString = JSON.stringify(this.config);
      }
      this.applyCssVars();
    } catch {
      this.config = this.getDefaultConfig();
      this.configString = JSON.stringify(this.config);
      this.applyCssVars();
    }
    const stored = os.storage.get(StorageKeys.tilingEnabled);
    if (stored === "true") {
      this.enabled = true;
      this.config.enabled = true;
      modeManager.enter(MODES.TILING);
      this.applyLayoutTypeClass();
      this.tilingBar.show();
    } else {
      this.enabled = this.config.enabled === true;
      if (this.enabled) {
        modeManager.enter(MODES.TILING);
        this.applyLayoutTypeClass();
        this.tilingBar.show();
      }
    }
  }

  mergeDefaults(parsed) {
    const d = this.getDefaultConfig();
    const merged = { ...d, ...parsed };
    merged.gaps = { ...d.gaps, ...(parsed.gaps || {}) };
    return merged;
  }

  watchConfig() {
    const poll = () => {
      const cfg = this.getEffectiveConfig();
      this.pollTimer = setTimeout(async () => {
        try {
          const content = await os.fs.read(CONFIG_PATH);
          if (content && content !== this.configString) {
            console.log("[Tiling] Config file changed externally, reloading");
            this.config = this.mergeDefaults(JSON.parse(content));
            this.configString = content;
            this.applyCssVars();
            const stored = os.storage.get(StorageKeys.tilingEnabled);
            const configEnabled = this.config.enabled === true;
            const desiredEnabled = stored !== null ? stored === "true" : configEnabled;
            const wasEnabled = this.enabled;
            this.enabled = desiredEnabled;
            this.config.enabled = desiredEnabled;
            if (wasEnabled !== this.enabled) {
              if (this.enabled) {
                modeManager.enter(MODES.TILING);
                this.applyLayoutToAllWindows();
              } else {
                modeManager.exit(MODES.TILING);
                this.restoreAllWindows();
              }
            } else if (this.enabled) {
              this.applyLayoutToAllWindows();
            }
            bus.emit(BusEvents.TILING_LAYOUT_CHANGED);
          }
        } catch {}
        poll();
      }, cfg.config_poll_interval);
    };
    poll();
  }

  toggleMode(forceState) {
    if (!this.config) {
      this.config = this.getDefaultConfig();
    }
    const newState = forceState !== undefined ? forceState : !this.enabled;
    if (newState === this.enabled) return;
    this.enabled = newState;
    this.config.enabled = this.enabled;

    if (this.enabled) {
      modeManager.enter(MODES.TILING);
      this.applyLayoutTypeClass();
      this.rebuildTreeForCurrentWorkspace();
      this.applyLayoutToAllWindows();
      this.tilingBar.show();
      os.notify.send("Tiling", "Tiling mode enabled", { icon: "fas fa-th-large" });
    } else {
      modeManager.exit(MODES.TILING);
      document.body.classList.remove("tiling-layout-master-stack");
      this.restoreAllWindows();
      this.trees.clear();
      this.tilingBar.hide();
      os.notify.send("Tiling", "Tiling mode disabled", { icon: "fas fa-th-large" });
    }

    bus.emit(BusEvents.TILING_MODE_CHANGED, { enabled: this.enabled });
  }

  getActiveWorkspaceId() {
    return this.wm.workspaceManager?.activeId ?? 0;
  }

  getTreeForWorkspace(wsId) {
    if (!this.trees.has(wsId)) {
      this.trees.set(wsId, null);
    }
    return this.trees.get(wsId);
  }

  setTreeForWorkspace(wsId, tree) {
    this.trees.set(wsId, tree);
  }

  rebuildTreeForCurrentWorkspace() {
    const wsId = this.getActiveWorkspaceId();
    this.rebuildTreeForWorkspace(wsId);
  }

  rebuildTreeForWorkspace(wsId) {
    const wins = this.getOpenWindowsForWorkspace(wsId);
    const engine = this.getLayoutEngine();
    let tree = engine.createState ? engine.createState() : null;

    console.log(`[Tiling] Rebuilding tree for workspace ${wsId} with ${wins.length} windows`);
    for (const winId of wins) {
      const win = $("#" + winId);
      if (!win) continue;
      const entry = this.wm.openWindows.get(winId);
      if (entry && entry.record && entry.record.floating) continue;
      tree = engine.insert(tree, winId, null);
    }

    this.setTreeForWorkspace(wsId, tree);
    return tree;
  }

  getOpenWindowsForCurrentWorkspace() {
    return this.getOpenWindowsForWorkspace(this.getActiveWorkspaceId());
  }

  getOpenWindowsForWorkspace(wsId) {
    const wins = [];
    this.wm.openWindows.forEach((entry, winId) => {
      if (entry.record && entry.record.workspaceId === wsId) {
        wins.push(winId);
      }
    });
    return wins;
  }

  getLayoutRect() {
    const taskbar = $("#taskbar");
    let left = 0,
      top = 0,
      right = 0,
      bottom = 0;
    if (taskbar) {
      const rect = taskbar.getBoundingClientRect();
      const pos = os.storage.get(StorageKeys.taskbarPosition) || "bottom";
      if (pos === "left") {
        left = rect.width;
      } else if (pos === "right") {
        right = rect.width;
      } else if (pos === "top") {
        top = rect.height;
      } else {
        bottom = rect.height;
      }
    }
    const barTopHeight = this.tilingBar.getHeight();
    top = Math.max(top, barTopHeight);
    return {
      x: left,
      y: top,
      w: window.innerWidth - left - right,
      h: window.innerHeight - top
    };
  }

  updateConfig(changes) {
    const oldLayout = this.getEffectiveConfig().layout;
    Object.assign(this.config, changes);
    if (changes.gaps) Object.assign(this.config.gaps, changes.gaps);
    this.applyCssVars();
    this.applyLayoutTypeClass();
    if (this.enabled) {
      const newLayout = this.getEffectiveConfig().layout;
      if (newLayout !== oldLayout) {
        this.trees.clear();
        this.rebuildTreeForCurrentWorkspace();
      }
      this.applyLayoutToAllWindows();
    }
    os.fs.write(CONFIG_PATH, JSON.stringify(this.config, null, 2)).catch(() => {});
    this.configString = JSON.stringify(this.config);
  }

  applyLayoutTypeClass() {
    const layout = this.getEffectiveConfig().layout;
    document.body.classList.toggle("tiling-layout-master-stack", layout === "master-stack");
  }

  applyLayoutToAllWindows() {
    const wsId = this.getActiveWorkspaceId();
    const tree = this.getTreeForWorkspace(wsId);
    if (!tree) return;

    const engine = this.getLayoutEngine();
    const wins = engine.getLeafWindows(tree);
    if (wins.length === 0) return;

    const { x, y, w, h } = this.getLayoutRect();
    const cfg = this.getEffectiveConfig();
    const gaps = cfg.gaps;
    const rects = engine.calculateLayout(tree, x, y, w, h, gaps);

    for (const rect of rects) {
      const win = $("#" + rect.winId);
      if (!win) continue;
      const entry = this.wm.openWindows.get(rect.winId);
      if (entry && entry.record && entry.record.floating) continue;

      const record = entry?.record;
      if (record) {
        if (!record.tiled) {
          record.tiled = true;
          record.tileGeometry = { x: record.x, y: record.y, width: record.width, height: record.height };
          record.tilePosition = win.style.position || getComputedStyle(win).position;
        }
        record.tileNodeId = rect.nodeId;
        record.x = rect.x;
        record.y = rect.y;
        record.width = rect.w;
        record.height = rect.h;
      }

      Object.assign(win.style, {
        left: `${rect.x}px`,
        top: `${rect.y}px`,
        width: `${rect.w}px`,
        height: `${rect.h}px`,
        position: "fixed",
        transition: this.getTransition(),
        transform: "",
        borderRadius: `${cfg.border_radius}px`
      });
      win.dataset.tiled = "true";
    }
  }

  applyWindowToTile(winId) {
    const wsId = this.getActiveWorkspaceId();
    const tree = this.getTreeForWorkspace(wsId);
    if (!tree) return;

    const engine = this.getLayoutEngine();
    const node = engine.findNodeByWinId(tree, winId);
    if (!node) return;

    const { x, y, w, h } = this.getLayoutRect();
    const cfg = this.getEffectiveConfig();
    const gaps = cfg.gaps;
    const rects = engine.calculateLayout(tree, x, y, w, h, gaps);

    const rect = rects.find((r) => r.winId === winId);
    if (!rect) return;

    const win = $("#" + winId);
    if (!win) return;

    Object.assign(win.style, {
      left: `${rect.x}px`,
      top: `${rect.y}px`,
      width: `${rect.w}px`,
      height: `${rect.h}px`,
      position: "fixed",
      transition: this.getTransition()
    });
    win.dataset.tiled = "true";
    win.style.borderRadius = `${cfg.border_radius}px`;

    const entry = this.wm.openWindows.get(winId);
    if (entry && entry.record) {
      if (!entry.record.tiled) {
        entry.record.tiled = true;
        entry.record.tileGeometry = {
          x: entry.record.x,
          y: entry.record.y,
          width: entry.record.width,
          height: entry.record.height
        };
        entry.record.tilePosition = win.style.position || getComputedStyle(win).position;
      }
      entry.record.x = rect.x;
      entry.record.y = rect.y;
      entry.record.width = rect.w;
      entry.record.height = rect.h;
      entry.record.tileNodeId = rect.nodeId;
    }
  }

  restoreAllWindows() {
    this.wm.openWindows.forEach((entry, winId) => {
      const win = $("#" + winId);
      if (!win) return;
      if (!entry.record || !entry.record.tiled) return;

      const geom = entry.record.tileGeometry;
      const origPos = entry.record.tilePosition;
      if (geom) {
        Object.assign(win.style, {
          left: `${geom.x}px`,
          top: `${geom.y}px`,
          width: `${geom.width}px`,
          height: `${geom.height}px`,
          transition: this.getTransition(),
          position: origPos || ""
        });
      }
      entry.record.tiled = false;
      entry.record.tileGeometry = null;
      entry.record.tileNodeId = null;
      delete win.dataset.tiled;
      win.style.borderRadius = "";
    });
  }

  onWindowCreated(winId) {
    if (!this.enabled) return;
    if (!winId) return;

    const entry = this.wm.openWindows.get(winId);
    if (!entry || !entry.record) return;
    if (entry.record.floating) return;

    const wsId = this.getActiveWorkspaceId();

    if (!entry.record.tiled) {
      entry.record.tileGeometry = {
        x: entry.record.x,
        y: entry.record.y,
        width: entry.record.width,
        height: entry.record.height
      };
      entry.record.tiled = true;
    }
    const win = $("#" + winId);
    if (win) {
      entry.record.tilePosition = win.style.position || getComputedStyle(win).position;
    }

    const engine = this.getLayoutEngine();
    let tree = this.getTreeForWorkspace(wsId);
    const alreadyInTree = tree && engine.findNodeByWinId(tree, winId);
    if (!alreadyInTree) {
      const cursorWinId = this.getWindowAtCursor();
      const focusedWinId = cursorWinId || this.getFocusedTiledWinId();
      tree = engine.insert(tree, winId, focusedWinId);
      this.setTreeForWorkspace(wsId, tree);
    }
    this.applyLayoutToAllWindows();
  }

  removeWindowFromTree(winId) {
    if (!this.enabled) return;
    const wsId = this.getActiveWorkspaceId();
    let tree = this.getTreeForWorkspace(wsId);
    if (!tree) return;

    const entry = this.wm.openWindows.get(winId);
    if (entry && entry.record) {
      entry.record.tiled = false;
    }

    const engine = this.getLayoutEngine();
    tree = engine.remove(tree, winId);
    this.setTreeForWorkspace(wsId, tree);
    this.applyLayoutToAllWindows();
  }

  swapWindowWithTarget(draggedWinId, targetWinId) {
    if (!this.enabled) return;
    if (draggedWinId === targetWinId) return;

    const wsId = this.getActiveWorkspaceId();
    let tree = this.getTreeForWorkspace(wsId);
    if (!tree) return;

    const entry = this.wm.openWindows.get(draggedWinId);
    if (entry && entry.record) {
      entry.record.tiled = true;
    }

    const engine = this.getLayoutEngine();
    engine.swapWindows(tree, draggedWinId, targetWinId);
    this.applyLayoutToAllWindows();
  }

  onWindowClosed(winId) {
    if (!this.enabled) return;
    const wsId = this.getActiveWorkspaceId();
    let tree = this.getTreeForWorkspace(wsId);
    if (!tree) return;

    const engine = this.getLayoutEngine();
    tree = engine.remove(tree, winId);
    this.setTreeForWorkspace(wsId, tree);

    const leafCount = tree ? engine.countLeaves(tree) : 0;
    if (leafCount === 0) {
      this.setTreeForWorkspace(wsId, null);
      return;
    }

    this.applyLayoutToAllWindows();
  }

  onWorkspaceSwitch() {
    if (!this.enabled) return;
    const wsId = this.getActiveWorkspaceId();
    const delay = this.getEffectiveConfig().workspace_switch_delay;
    setTimeout(() => {
      this.applyLayoutToAllWindows();
    }, delay);
  }

  focusDirection(direction) {
    if (!this.enabled) return;
    const wsId = this.getActiveWorkspaceId();
    const tree = this.getTreeForWorkspace(wsId);
    if (!tree) return;

    const focusedWin = this.wm.openWindows.get(
      Array.from(this.wm.openWindows.keys())
        .map((id) => $("#" + id))
        .filter(Boolean)
        .sort((a, b) => parseInt(b.style.zIndex) - parseInt(a.style.zIndex))[0]?.id
    );

    const focusedWinId = focusedWin?.record?.tiled ? focusedWin.record.id : null;
    if (!focusedWinId) return;

    const engine = this.getLayoutEngine();
    const neighbor = engine.getDirectionalNeighbor(tree, focusedWinId, direction);
    if (!neighbor || !neighbor.winId) return;

    const win = $("#" + neighbor.winId);
    if (win) {
      this.wm.bringToFront(win);
      win.focus();
    }
  }

  swapDirection(direction) {
    if (!this.enabled) return;
    const wsId = this.getActiveWorkspaceId();
    const tree = this.getTreeForWorkspace(wsId);
    if (!tree) return;

    const focusedWinId = this.getFocusedTiledWinId();
    if (!focusedWinId) return;

    const engine = this.getLayoutEngine();
    const neighbor = engine.getDirectionalNeighbor(tree, focusedWinId, direction);
    if (!neighbor || !neighbor.winId) return;

    engine.swapWindows(tree, focusedWinId, neighbor.winId);
    this.applyLayoutToAllWindows();
  }

  resizeDirection(direction) {
    if (!this.enabled) return;
    const wsId = this.getActiveWorkspaceId();
    const tree = this.getTreeForWorkspace(wsId);
    if (!tree) return;

    const focusedWinId = this.getFocusedTiledWinId();
    if (!focusedWinId) return;

    const engine = this.getLayoutEngine();
    engine.resizeSplit(tree, focusedWinId, direction, this.getEffectiveConfig().resize_delta);
    this.applyLayoutToAllWindows();
  }

  getFocusedTiledWinId() {
    const wins = Array.from(this.wm.openWindows.keys())
      .map((id) => $("#" + id))
      .filter(Boolean)
      .sort((a, b) => parseInt(b.style.zIndex) - parseInt(a.style.zIndex));

    for (const win of wins) {
      const entry = this.wm.openWindows.get(win.id);
      if (entry && entry.record && entry.record.tiled) {
        return win.id;
      }
    }
    return null;
  }

  getWindowAtCursor() {
    const wsId = this.getActiveWorkspaceId();
    const wins = this.getOpenWindowsForWorkspace(wsId);
    for (const winId of wins) {
      const win = $("#" + winId);
      if (!win) continue;
      const rect = win.getBoundingClientRect();
      if (
        this.lastMouseX >= rect.left &&
        this.lastMouseX <= rect.right &&
        this.lastMouseY >= rect.top &&
        this.lastMouseY <= rect.bottom
      ) {
        const entry = this.wm.openWindows.get(winId);
        if (entry && entry.record && entry.record.tiled) {
          return winId;
        }
      }
    }
    return null;
  }

  toggleFloating() {
    if (!this.enabled) return;
    const wsId = this.getActiveWorkspaceId();
    const tree = this.getTreeForWorkspace(wsId);
    if (!tree) return;

    const focusedWinId = this.getFocusedTiledWinId();
    if (!focusedWinId) return;

    const entry = this.wm.openWindows.get(focusedWinId);
    if (!entry || !entry.record) return;

    const win = $("#" + focusedWinId);
    if (!win) return;

    const engine = this.getLayoutEngine();
    if (entry.record.floating) {
      entry.record.floating = false;
      entry.record.tiled = true;
      let newTree = engine.insert(tree, focusedWinId, null);
      this.setTreeForWorkspace(wsId, newTree);
      this.applyLayoutToAllWindows();
      delete win.dataset.tiled;
    } else {
      entry.record.floating = true;
      entry.record.tiled = false;
      entry.record.tileGeometry = {
        x: entry.record.x,
        y: entry.record.y,
        width: entry.record.width,
        height: entry.record.height
      };

      let newTree = engine.remove(tree, focusedWinId);
      this.setTreeForWorkspace(wsId, newTree);

      const geom = entry.record.tileGeometry;
      const origPos = entry.record.tilePosition;
      Object.assign(win.style, {
        left: `${geom.x}px`,
        top: `${geom.y}px`,
        width: `${geom.width}px`,
        height: `${geom.height}px`,
        position: origPos || "",
        transition: this.getTransition()
      });
      delete win.dataset.tiled;
      win.style.borderRadius = "";

      this.applyLayoutToAllWindows();
    }
  }

  toggleFullscreenOnTiled() {
    if (!this.enabled) return;
    const focusedWinId = this.getFocusedTiledWinId();
    if (!focusedWinId) return;

    const win = $("#" + focusedWinId);
    if (!win) return;

    this.wm.toggleFullscreen(win);
  }

  spawnTerminal() {
    os.app.launch("terminalApp");
  }

  closeFocusedWindow() {
    const wins = Array.from(this.wm.openWindows.keys())
      .map((id) => $("#" + id))
      .filter(Boolean)
      .sort((a, b) => parseInt(b.style.zIndex) - parseInt(a.style.zIndex));

    const focused = wins[0];
    if (focused) {
      this.wm.closeWindow(focused);
    }
  }

  cycleFocus(forward) {
    if (!this.enabled) return;
    const wsId = this.getActiveWorkspaceId();
    const tree = this.getTreeForWorkspace(wsId);
    if (!tree) return;

    const engine = this.getLayoutEngine();
    const windows = engine.getLeafWindows(tree);
    if (windows.length < 2) return;

    const focusedWinId = this.getFocusedTiledWinId();
    let idx = focusedWinId ? windows.indexOf(focusedWinId) : -1;
    const direction = forward ? "next" : "prev";

    if (forward) {
      idx = (idx + 1) % windows.length;
    } else {
      idx = (idx - 1 + windows.length) % windows.length;
    }

    const target = $("#" + windows[idx]);
    if (target) {
      this.wm.bringToFront(target);
      target.focus();
    }
  }

  toggleSplitType() {
    if (!this.enabled) return;
    const wsId = this.getActiveWorkspaceId();
    const tree = this.getTreeForWorkspace(wsId);
    if (!tree) return;

    const focusedWinId = this.getFocusedTiledWinId();
    if (!focusedWinId) return;

    const engine = this.getLayoutEngine();
    if (tree.type === "master-stack") {
      tree.orientation = tree.orientation === "horizontal" ? "vertical" : "horizontal";
      this.applyLayoutToAllWindows();
      return;
    }

    const node = engine.findNodeByWinId(tree, focusedWinId);
    if (!node || !node.parent) return;

    const parent = node.parent;
    if (parent.type === "internal") {
      parent.split = parent.split === "h" ? "v" : "h";
      this.applyLayoutToAllWindows();
    }
  }

  switchToWorkspace(num) {
    const wm = this.wm.workspaceManager;
    if (!wm) return;
    const targetId = num - 1;
    let target = wm.workspaces.find((ws) => ws.id === targetId);
    if (!target) {
      while (!wm.workspaces.find((ws) => ws.id === targetId)) {
        wm.addWorkspace();
      }
      target = wm.workspaces.find((ws) => ws.id === targetId);
    }
    wm.switchTo(target.id);
  }

  moveWindowToWorkspace(num) {
    if (!this.enabled) return;
    const wsManager = this.wm.workspaceManager;
    if (!wsManager) return;

    const focusedWinId = this.getFocusedTiledWinId();
    if (!focusedWinId) return;

    const targetId = num - 1;
    let target = wsManager.workspaces.find((ws) => ws.id === targetId);
    if (!target) {
      while (!wsManager.workspaces.find((ws) => ws.id === targetId)) {
        wsManager.addWorkspace();
      }
      target = wsManager.workspaces.find((ws) => ws.id === targetId);
    }

    const engine = this.getLayoutEngine();
    const currentWsId = this.getActiveWorkspaceId();
    let currentTree = this.getTreeForWorkspace(currentWsId);
    if (currentTree) {
      currentTree = engine.remove(currentTree, focusedWinId);
      this.setTreeForWorkspace(currentWsId, currentTree);
    }

    let targetTree = this.getTreeForWorkspace(target.id);
    targetTree = engine.insert(targetTree, focusedWinId);
    this.setTreeForWorkspace(target.id, targetTree);

    wsManager.moveWindowTo(focusedWinId, target.id);
    this.applyLayoutToAllWindows();
  }
}
