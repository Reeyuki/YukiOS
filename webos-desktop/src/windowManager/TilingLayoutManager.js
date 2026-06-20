import { StorageKeys, os } from "../framework.js";
const LayoutType = {
  DWINDLE: "dwindle",
  BSP: "bsp",
  MONOCLE: "monocle",
  FLOATING: "floating"
};

const SplitDirection = {
  HORIZONTAL: "horizontal",
  VERTICAL: "vertical"
};

class TilingNode {
  constructor(type = "window", data = null) {
    this.type = type;
    this.data = data;
    this.left = null;
    this.right = null;
    this.splitDirection = SplitDirection.HORIZONTAL;
    this.splitRatio = 0.5;
    this.rect = null;
  }

  isLeaf() {
    return this.type === "window";
  }

  isSplit() {
    return this.type === "split";
  }
}

export class TilingLayoutManager {
  constructor(manager) {
    this.manager = manager;
    this.enabled = false;
    this.layoutType = LayoutType.DWINDLE;
    this.workspaceStates = new Map();
    this.activeWorkspace = "default";
    this.floatingWindows = new Set();
    this.resizing = null;
    this.resizeHandle = null;
    this.resizeTimeout = null;

    this.gaps = {
      outer: 8,
      inner: 8
    };

    this.border = {
      width: 2,
      activeColor: "var(--brand)",
      inactiveColor: "rgba(255, 255, 255, 0.1)"
    };

    this._loadSettings();
    this._initKeyboardShortcuts();
    this._initResizeListener();
  }

  _loadSettings() {
    try {
      const savedGaps = os.storage.get(StorageKeys.tilingGaps);
      if (savedGaps) {
        this.gaps = { ...this.gaps, ...savedGaps };
      }

      const savedBorder = os.storage.get(StorageKeys.tilingBorder);
      if (savedBorder) {
        this.border = { ...this.border, ...savedBorder };
      }
    } catch (e) {}
  }

  _saveSettings() {
    try {
      os.storage.set(StorageKeys.tilingGaps, this.gaps);
      os.storage.set(StorageKeys.tilingBorder, this.border);
    } catch (e) {}
  }

  enable() {
    this.enabled = true;
    this._initializeWorkspace(this.activeWorkspace);
    this._applyLayout();
  }

  disable() {
    this.enabled = false;
    this._removeResizeHandles();
  }

  setLayoutType(type) {
    this.layoutType = type;
    this._applyLayout();
  }

  cycleLayout() {
    const types = Object.values(LayoutType);
    const currentIndex = types.indexOf(this.layoutType);
    this.layoutType = types[(currentIndex + 1) % types.length];
    this._applyLayout();
    return this.layoutType;
  }

  _initializeWorkspace(workspaceId) {
    if (!this.workspaceStates.has(workspaceId)) {
      this.workspaceStates.set(workspaceId, {
        root: null,
        floatingWindows: new Set(),
        windowList: [],
        layoutType: LayoutType.DWINDLE
      });
    }
  }

  _getWorkspaceState(workspaceId) {
    this._initializeWorkspace(workspaceId);
    return this.workspaceStates.get(workspaceId);
  }

  setActiveWorkspace(workspaceId) {
    this.activeWorkspace = workspaceId;
    this._initializeWorkspace(workspaceId);
    const state = this._getWorkspaceState(workspaceId);
    this.layoutType = state.layoutType;
    this._applyLayout();
  }

  addWindow(win) {
    if (!this.enabled) return;

    const winId = win.id;
    const state = this._getWorkspaceState(this.activeWorkspace);
    if (state.floatingWindows.has(winId)) {
      state.floatingWindows.delete(winId);
    }

    if (this.layoutType === LayoutType.FLOATING) {
      state.floatingWindows.add(winId);
      this._applyFloatingLayout(win);
      return;
    }

    if (this.layoutType === LayoutType.DWINDLE) {
      if (!state.windowList.includes(winId)) {
        state.windowList.push(winId);
      } else {
      }
    } else {
      if (!state.root) {
        state.root = new TilingNode("window", winId);
      } else {
        this._insertWindowIntoTree(state.root, winId);
      }
    }

    setTimeout(() => {
      this._applyLayout();
    }, 0);
  }

  removeWindow(winId) {
    if (!this.enabled) return;

    const state = this._getWorkspaceState(this.activeWorkspace);

    if (state.floatingWindows.has(winId)) {
      state.floatingWindows.delete(winId);
      return;
    }

    if (this.layoutType === LayoutType.DWINDLE) {
      const index = state.windowList.indexOf(winId);
      if (index > -1) {
        state.windowList.splice(index, 1);
      }
    } else {
      state.root = this._removeWindowFromTree(state.root, winId);
    }

    this._applyLayout();
  }

  _insertWindowIntoTree(node, winId) {
    if (node.isLeaf()) {
      const newSplit = new TilingNode("split");
      newSplit.splitDirection = SplitDirection.HORIZONTAL;
      newSplit.splitRatio = 0.5;

      const leftNode = new TilingNode("window", node.data);
      const rightNode = new TilingNode("window", winId);

      newSplit.left = leftNode;
      newSplit.right = rightNode;

      Object.assign(node, newSplit);
    } else {
      const leftLeafCount = this._countLeaves(node.left);
      const rightLeafCount = this._countLeaves(node.right);

      if (leftLeafCount <= rightLeafCount) {
        this._insertWindowIntoTree(node.left, winId);
      } else {
        this._insertWindowIntoTree(node.right, winId);
      }
    }
  }

  _removeWindowFromTree(node, winId) {
    if (!node) return null;

    if (node.isLeaf()) {
      return node.data === winId ? null : node;
    }

    node.left = this._removeWindowFromTree(node.left, winId);
    node.right = this._removeWindowFromTree(node.right, winId);

    if (!node.left && !node.right) {
      return null;
    }

    if (!node.left) {
      return node.right;
    }

    if (!node.right) {
      return node.left;
    }

    return node;
  }

  _countLeaves(node) {
    if (!node) return 0;
    if (node.isLeaf()) return 1;
    return this._countLeaves(node.left) + this._countLeaves(node.right);
  }

  toggleFloating(winId) {
    if (!this.enabled) return;

    const state = this._getWorkspaceState(this.activeWorkspace);

    if (state.floatingWindows.has(winId)) {
      state.floatingWindows.delete(winId);
      this.addWindow(document.getElementById(winId));
    } else {
      this.removeWindow(winId);
      state.floatingWindows.add(winId);
      this._applyFloatingLayout(document.getElementById(winId));
    }
  }

  isFloating(winId) {
    const state = this._getWorkspaceState(this.activeWorkspace);
    return state.floatingWindows.has(winId);
  }

  _applyLayout() {
    if (!this.enabled) return;

    const state = this._getWorkspaceState(this.activeWorkspace);

    if (this.layoutType === LayoutType.MONOCLE) {
      this._applyMonocleLayout(state);
    } else if (this.layoutType === LayoutType.FLOATING) {
      this._applyFloatingLayoutAll(state);
    } else if (this.layoutType === LayoutType.DWINDLE) {
      this._applyDwindleLayout(state);
    } else {
      this._applyBSPLayout(state);
    }

    this._updateResizeHandles();
  }

  _applyBSPLayout(state) {
    if (!state.root) return;

    const bounds = this._getScreenBounds();
    this._calculateNodeRect(state.root, bounds);
    this._applyNodeRects(state.root);
  }

  _applyDwindleLayout(state) {
    const windows = this._getAllWindows(state);

    if (windows.length === 0) return;

    const bounds = this._getScreenBounds();

    const rects = this._calculateDwindleRects(windows.length, bounds);

    windows.forEach((winId, index) => {
      const win = document.getElementById(winId);

      if (win && rects[index]) {
        const { left, top, width, height } = rects[index];
        win.style.setProperty("left", `${left}px`, "important");
        win.style.setProperty("top", `${top}px`, "important");
        win.style.setProperty("width", `${width}px`, "important");
        win.style.setProperty("height", `${height}px`, "important");
        win.style.setProperty("position", "absolute", "important");
        win.style.setProperty("display", "block", "important");
        win.style.setProperty("opacity", "1", "important");
        win.style.removeProperty("transform");
        win.style.removeProperty("margin");
        win.style.removeProperty("padding");
      }
    });
  }

  _calculateDwindleRects(count, bounds) {
    if (count === 0) return [];
    if (count === 1) return [bounds];

    const rects = [];
    const { left, top, width, height } = bounds;
    const gap = this.gaps.inner;

    let currentRects = [{ left, top, width, height }];

    for (let i = 1; i < count; i++) {
      const splitIndex = this._findSplitRect(currentRects);
      const splitRect = currentRects[splitIndex];

      const isHorizontal = i % 2 === 1;
      const splitRatio = 0.5;

      if (isHorizontal) {
        const halfWidth = (splitRect.width - gap) / 2;
        const newRect = {
          left: splitRect.left + halfWidth + gap,
          top: splitRect.top,
          width: halfWidth,
          height: splitRect.height
        };
        currentRects[splitIndex] = {
          left: splitRect.left,
          top: splitRect.top,
          width: halfWidth,
          height: splitRect.height
        };
        currentRects.push(newRect);
      } else {
        const halfHeight = (splitRect.height - gap) / 2;
        const newRect = {
          left: splitRect.left,
          top: splitRect.top + halfHeight + gap,
          width: splitRect.width,
          height: halfHeight
        };
        currentRects[splitIndex] = {
          left: splitRect.left,
          top: splitRect.top,
          width: splitRect.width,
          height: halfHeight
        };
        currentRects.push(newRect);
      }
    }

    return currentRects;
  }

  _findSplitRect(rects) {
    const mouseX = window.mouseX || window.innerWidth / 2;
    const mouseY = window.mouseY || window.innerHeight / 2;

    let bestIndex = 0;
    let bestScore = -1;

    rects.forEach((rect, index) => {
      if (
        mouseX >= rect.left &&
        mouseX <= rect.left + rect.width &&
        mouseY >= rect.top &&
        mouseY <= rect.top + rect.height
      ) {
        bestIndex = index;
        bestScore = Infinity;
      } else {
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const distance = Math.sqrt(Math.pow(mouseX - centerX, 2) + Math.pow(mouseY - centerY, 2));
        const area = rect.width * rect.height;
        const score = area / (distance + 1);

        if (score > bestScore) {
          bestScore = score;
          bestIndex = index;
        }
      }
    });

    return bestIndex;
  }

  _findLargestRect(rects) {
    let maxArea = 0;
    let maxIndex = 0;

    rects.forEach((rect, index) => {
      const area = rect.width * rect.height;
      if (area > maxArea) {
        maxArea = area;
        maxIndex = index;
      }
    });

    return maxIndex;
  }

  _calculateNodeRect(node, bounds) {
    node.rect = bounds;

    if (node.isSplit()) {
      const { left, top, width, height } = bounds;
      const gap = this.gaps.inner;

      if (node.splitDirection === SplitDirection.HORIZONTAL) {
        const leftWidth = (width - gap) * node.splitRatio;
        const rightWidth = width - gap - leftWidth;

        this._calculateNodeRect(node.left, {
          left,
          top,
          width: leftWidth,
          height
        });

        this._calculateNodeRect(node.right, {
          left: left + leftWidth + gap,
          top,
          width: rightWidth,
          height
        });
      } else {
        const topHeight = (height - gap) * node.splitRatio;
        const bottomHeight = height - gap - topHeight;

        this._calculateNodeRect(node.left, {
          left,
          top,
          width,
          height: topHeight
        });

        this._calculateNodeRect(node.right, {
          left,
          top: top + topHeight + gap,
          width,
          height: bottomHeight
        });
      }
    }
  }

  _applyNodeRects(node) {
    if (!node) return;

    if (node.isLeaf() && node.data) {
      const win = document.getElementById(node.data);
      if (win) {
        const { left, top, width, height } = node.rect;
        win.style.setProperty("left", `${left}px`, "important");
        win.style.setProperty("top", `${top}px`, "important");
        win.style.setProperty("width", `${width}px`, "important");
        win.style.setProperty("height", `${height}px`, "important");
        win.style.setProperty("position", "absolute", "important");
        win.style.setProperty("display", "block", "important");
        win.style.setProperty("opacity", "1", "important");
        win.style.removeProperty("transform");
        win.style.removeProperty("margin");
        win.style.removeProperty("padding");
      }
    } else if (node.isSplit()) {
      this._applyNodeRects(node.left);
      this._applyNodeRects(node.right);
    }
  }

  _applyMonocleLayout(state) {
    const windows = this._getAllWindows(state);
    const bounds = this._getScreenBounds();

    windows.forEach((winId, index) => {
      const win = document.getElementById(winId);
      if (win) {
        if (index === windows.length - 1) {
          win.style.setProperty("left", `${bounds.left}px`, "important");
          win.style.setProperty("top", `${bounds.top}px`, "important");
          win.style.setProperty("width", `${bounds.width}px`, "important");
          win.style.setProperty("height", `${bounds.height}px`, "important");
          win.style.setProperty("display", "block", "important");
          win.style.setProperty("opacity", "1", "important");
        } else {
          win.style.setProperty("display", "none", "important");
        }
      }
    });
  }

  _applyFloatingLayout(win) {
    if (!win) return;

    const bounds = this._getScreenBounds();
    const savedPos = this._getSavedFloatingPosition(win.id);

    if (savedPos) {
      win.style.setProperty("left", `${savedPos.x}px`, "important");
      win.style.setProperty("top", `${savedPos.y}px`, "important");
      win.style.setProperty("width", `${savedPos.width}px`, "important");
      win.style.setProperty("height", `${savedPos.height}px`, "important");
    } else {
      win.style.setProperty("left", `${bounds.left + 50}px`, "important");
      win.style.setProperty("top", `${bounds.top + 50}px`, "important");
      win.style.setProperty("width", `${Math.min(800, bounds.width - 100)}px`, "important");
      win.style.setProperty("height", `${Math.min(600, bounds.height - 100)}px`, "important");
    }

    win.style.setProperty("position", "absolute", "important");
    win.style.setProperty("display", "block", "important");
    win.style.setProperty("opacity", "1", "important");
  }

  _applyFloatingLayoutAll(state) {
    state.floatingWindows.forEach((winId) => {
      const win = document.getElementById(winId);
      if (win) {
        this._applyFloatingLayout(win);
      }
    });
  }

  _getAllWindows(state) {
    if (this.layoutType === LayoutType.DWINDLE) {
      return [...state.windowList];
    }
    const windows = [];
    this._collectWindows(state.root, windows);
    return windows;
  }

  _collectWindows(node, windows) {
    if (!node) return;

    if (node.isLeaf() && node.data) {
      windows.push(node.data);
    } else if (node.isSplit()) {
      this._collectWindows(node.left, windows);
      this._collectWindows(node.right, windows);
    }
  }

  _getScreenBounds() {
    const taskbarHeight = this._getTaskbarHeight();
    const outerGap = this.gaps.outer;

    return {
      left: outerGap,
      top: outerGap,
      width: window.innerWidth - outerGap * 2,
      height: window.innerHeight - taskbarHeight - outerGap * 2
    };
  }

  _getTaskbarHeight() {
    const taskbar = document.getElementById("taskbar");
    if (!taskbar) return 0;

    const rect = taskbar.getBoundingClientRect();
    const taskbarPosition = os.storage.get(StorageKeys.taskbarPosition) || "bottom";

    return taskbarPosition === "bottom" ? rect.height : 0;
  }

  focusWindow(winId) {
    if (!this.enabled) return;

    const win = document.getElementById(winId);
    if (win) {
      this.manager.bringToFront(win);
    }
  }

  getFocusedWindow() {
    const windows = document.querySelectorAll(".window");
    let maxZ = 0;
    let focused = null;

    windows.forEach((win) => {
      const z = parseInt(win.style.zIndex) || 0;
      if (z > maxZ && win.style.display !== "none") {
        maxZ = z;
        focused = win;
      }
    });

    return focused;
  }

  getHoveredWindow() {
    const elements = document.elementsFromPoint(window.mouseX || 0, window.mouseY || 0);
    for (const el of elements) {
      const win = el.closest(".window");
      if (win && win.style.display !== "none") {
        return win;
      }
    }
    return null;
  }

  moveFocus(direction) {
    if (!this.enabled || this.layoutType === LayoutType.FLOATING) return;

    const focused = this.getFocusedWindow();
    if (!focused) return;

    const state = this._getWorkspaceState(this.activeWorkspace);
    const neighbor = this._findNeighbor(state.root, focused.id, direction);

    if (neighbor) {
      this.focusWindow(neighbor);
    }
  }

  _findNeighbor(node, winId, direction) {
    if (!node) return null;

    if (node.isLeaf()) {
      return node.data === winId ? null : node.data;
    }

    const leftWindows = this._getAllWindowsFromNode(node.left);
    const rightWindows = this._getAllWindowsFromNode(node.right);

    if (leftWindows.includes(winId)) {
      if (direction === "right" && rightWindows.length > 0) {
        return rightWindows[0];
      }
      return this._findNeighbor(node.left, winId, direction);
    }

    if (rightWindows.includes(winId)) {
      if (direction === "left" && leftWindows.length > 0) {
        return leftWindows[leftWindows.length - 1];
      }
      return this._findNeighbor(node.right, winId, direction);
    }

    return null;
  }

  _getAllWindowsFromNode(node) {
    const windows = [];
    this._collectWindows(node, windows);
    return windows;
  }

  swapWindows(direction) {
    if (!this.enabled || this.layoutType !== LayoutType.BSP) return;

    const focused = this.getFocusedWindow();
    if (!focused) return;

    const state = this._getWorkspaceState(this.activeWorkspace);
    const neighbor = this._findNeighbor(state.root, focused.id, direction);

    if (neighbor) {
      this._swapWindowData(state.root, focused.id, neighbor);
      this._applyLayout();
    }
  }

  _swapWindowData(node, winId1, winId2) {
    if (!node) return;

    if (node.isLeaf()) {
      if (node.data === winId1) {
        node.data = winId2;
      } else if (node.data === winId2) {
        node.data = winId1;
      }
    } else {
      this._swapWindowData(node.left, winId1, winId2);
      this._swapWindowData(node.right, winId1, winId2);
    }
  }

  resizeSplit(direction, delta) {
    if (!this.enabled || this.layoutType !== LayoutType.BSP) return;

    const focused = this.getFocusedWindow();
    if (!focused) return;

    const state = this._getWorkspaceState(this.activeWorkspace);
    const splitNode = this._findParentSplit(state.root, focused.id);

    if (splitNode) {
      const ratioDelta = delta / 100;
      splitNode.splitRatio = Math.max(0.1, Math.min(0.9, splitNode.splitRatio + ratioDelta));
      this._applyLayout();
    }
  }

  _findParentSplit(node, winId, parent = null) {
    if (!node) return null;

    if (node.isLeaf()) {
      return node.data === winId ? parent : null;
    }

    const leftResult = this._findParentSplit(node.left, winId, node);
    if (leftResult) return leftResult;

    return this._findParentSplit(node.right, winId, node);
  }

  toggleFullscreen(winId) {
    const win = document.getElementById(winId);
    if (win) {
      this.manager.toggleFullscreen(win);
    }
  }

  _getSavedFloatingPosition(winId) {
    try {
      const positions = os.storage.get(StorageKeys.floatingWindowPositions) || {};
      return positions[winId] || null;
    } catch (e) {
      return null;
    }
  }

  _saveFloatingPosition(winId, x, y, width, height) {
    try {
      const positions = os.storage.get(StorageKeys.floatingWindowPositions) || {};
      positions[winId] = { x, y, width, height };
      os.storage.set(StorageKeys.floatingWindowPositions, positions);
    } catch (e) {}
  }

  _initKeyboardShortcuts() {
    document.addEventListener("keydown", (e) => {
      if (!this.enabled) return;

      if (e.altKey && !e.ctrlKey && !e.shiftKey && !e.metaKey) {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          this.moveFocus("left");
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          this.moveFocus("right");
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          this.moveFocus("up");
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          this.moveFocus("down");
        } else if (e.key === "Enter") {
          e.preventDefault();
          const focused = this.getFocusedWindow();
          if (focused) {
            this.toggleFullscreen(focused.id);
          }
        } else if (e.key === "f" || e.key === "F") {
          e.preventDefault();
          const focused = this.getFocusedWindow();
          if (focused) {
            this.toggleFloating(focused.id);
          }
        } else if (e.key === "t" || e.key === "T") {
          e.preventDefault();
          this._spawnTerminal();
        }
      }

      if (e.altKey && e.ctrlKey && !e.shiftKey && !e.metaKey) {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          this.resizeSplit("left", -0.05);
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          this.resizeSplit("right", 0.05);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          this.resizeSplit("up", -0.05);
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          this.resizeSplit("down", 0.05);
        }
      }

      if (e.altKey && e.shiftKey && !e.ctrlKey && !e.metaKey) {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          this.swapWindows("left");
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          this.swapWindows("right");
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          this.swapWindows("up");
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          this.swapWindows("down");
        }
      }
    });
  }

  _spawnTerminal() {
    if (this.manager.appLauncher && this.manager.appLauncher.terminalApp) {
      this.manager.appLauncher.terminalApp.open();
    }
  }

  _initResizeListener() {
    window.addEventListener("resize", () => {
      if (!this.enabled) return;

      if (this.resizeTimeout) {
        clearTimeout(this.resizeTimeout);
      }

      this.resizeTimeout = setTimeout(() => {
        this._applyLayout();
      }, 100);
    });
  }

  _updateResizeHandles() {
    this._removeResizeHandles();

    if (this.layoutType !== LayoutType.BSP || !this.enabled) return;

    const state = this._getWorkspaceState(this.activeWorkspace);
    this._addResizeHandles(state.root);
  }

  _addResizeHandles(node) {
    if (!node || node.isLeaf()) return;

    if (node.isSplit()) {
      this._addResizeHandle(node);
      this._addResizeHandles(node.left);
      this._addResizeHandles(node.right);
    }
  }

  _addResizeHandle(node) {
    if (!node.rect) return;

    const handle = document.createElement("div");
    handle.className = "tiling-resize-handle";
    handle.dataset.nodeId = JSON.stringify(node);

    const { left, top, width, height } = node.rect;
    const gap = this.gaps.inner;

    if (node.splitDirection === SplitDirection.HORIZONTAL) {
      const splitX = left + (width - gap) * node.splitRatio;
      handle.style.left = `${splitX}px`;
      handle.style.top = `${top}px`;
      handle.style.width = `${gap}px`;
      handle.style.height = `${height}px`;
      handle.style.cursor = "col-resize";
    } else {
      const splitY = top + (height - gap) * node.splitRatio;
      handle.style.left = `${left}px`;
      handle.style.top = `${splitY}px`;
      handle.style.width = `${width}px`;
      handle.style.height = `${gap}px`;
      handle.style.cursor = "row-resize";
    }

    handle.style.position = "absolute";
    handle.style.backgroundColor = "rgba(255, 255, 255, 0.05)";
    handle.style.zIndex = "9999";

    handle.addEventListener("mousedown", (e) => {
      e.preventDefault();
      this._startResize(node, e);
    });

    document.body.appendChild(handle);
  }

  _removeResizeHandles() {
    const handles = document.querySelectorAll(".tiling-resize-handle");
    handles.forEach((h) => h.remove());
  }

  _startResize(node, e) {
    this.resizing = {
      node,
      startX: e.clientX,
      startY: e.clientY,
      startRatio: node.splitRatio
    };

    document.addEventListener("mousemove", this._handleResize);
    document.addEventListener("mouseup", this._endResize);
  }

  _handleResize = (e) => {
    if (!this.resizing) return;

    const { node, startX, startY, startRatio } = this.resizing;

    if (node.splitDirection === SplitDirection.HORIZONTAL) {
      const deltaX = e.clientX - startX;
      const bounds = this._getScreenBounds();
      const deltaRatio = deltaX / bounds.width;
      node.splitRatio = Math.max(0.1, Math.min(0.9, startRatio + deltaRatio));
    } else {
      const deltaY = e.clientY - startY;
      const bounds = this._getScreenBounds();
      const deltaRatio = deltaY / bounds.height;
      node.splitRatio = Math.max(0.1, Math.min(0.9, startRatio + deltaRatio));
    }

    this._applyLayout();
  };

  _endResize = () => {
    this.resizing = null;
    document.removeEventListener("mousemove", this._handleResize);
    document.removeEventListener("mouseup", this._endResize);
  };

  saveState() {
    const state = {};

    this.workspaceStates.forEach((wsState, workspaceId) => {
      state[workspaceId] = {
        root: this._serializeNode(wsState.root),
        floatingWindows: Array.from(wsState.floatingWindows),
        layoutType: wsState.layoutType
      };
    });

    return state;
  }

  restoreState(state) {
    if (!state) return;

    Object.keys(state).forEach((workspaceId) => {
      const wsState = state[workspaceId];
      this.workspaceStates.set(workspaceId, {
        root: this._deserializeNode(wsState.root),
        floatingWindows: new Set(wsState.floatingWindows),
        layoutType: wsState.layoutType || LayoutType.BSP
      });
    });
  }

  _serializeNode(node) {
    if (!node) return null;

    if (node.isLeaf()) {
      return {
        type: "window",
        data: node.data
      };
    }

    return {
      type: "split",
      splitDirection: node.splitDirection,
      splitRatio: node.splitRatio,
      left: this._serializeNode(node.left),
      right: this._serializeNode(node.right)
    };
  }

  _deserializeNode(data) {
    if (!data) return null;

    if (data.type === "window") {
      return new TilingNode("window", data.data);
    }

    const node = new TilingNode("split");
    node.splitDirection = data.splitDirection;
    node.splitRatio = data.splitRatio;
    node.left = this._deserializeNode(data.left);
    node.right = this._deserializeNode(data.right);

    return node;
  }

  setGaps(outer, inner) {
    this.gaps.outer = outer;
    this.gaps.inner = inner;
    this._saveSettings();
    this._applyLayout();
  }

  setBorder(width, activeColor, inactiveColor) {
    this.border.width = width;
    this.border.activeColor = activeColor;
    this.border.inactiveColor = inactiveColor;
    this._saveSettings();
    this._applyLayout();
  }
}
