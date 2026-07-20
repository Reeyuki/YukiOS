export class WindowRecord {
  constructor(id, title, opts = {}) {
    this.id = id;
    this.title = title;
    this.x = opts.x ?? 0;
    this.y = opts.y ?? 0;
    this.width = opts.width ?? 800;
    this.height = opts.height ?? 600;
    this.zIndex = opts.zIndex ?? 1000;
    this.minimized = opts.minimized ?? false;
    this.fullscreen = opts.fullscreen ?? false;
    this.snapZone = opts.snapZone ?? null;
    this.preSnapGeometry = opts.preSnapGeometry ?? null;
    this.workspaceId = opts.workspaceId ?? 0;
    this.appId = opts.appId ?? null;
    this.appType = opts.appType ?? null;
    this.isGame = opts.isGame ?? false;
    this.iconValue = opts.iconValue ?? "";
    this.color = opts.color ?? null;
    this.appStateSnapshot = opts.appStateSnapshot ?? null;
    this.scrollPosition = opts.scrollPosition ?? { x: 0, y: 0 };
    this.focused = opts.focused ?? false;
    this.tiled = opts.tiled ?? false;
    this.floating = opts.floating ?? false;
    this.tileNodeId = opts.tileNodeId ?? null;
    this.tileGeometry = opts.tileGeometry ?? null;
  }

  setGeometry(x, y, w, h) {
    if (x !== undefined) this.x = x;
    if (y !== undefined) this.y = y;
    if (w !== undefined) this.width = w;
    if (h !== undefined) this.height = h;
  }

  savePreSnapGeometry() {
    this.preSnapGeometry = {
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height
    };
  }

  restorePreSnapGeometry() {
    if (!this.preSnapGeometry) return;
    this.x = this.preSnapGeometry.x;
    this.y = this.preSnapGeometry.y;
    this.width = this.preSnapGeometry.width;
    this.height = this.preSnapGeometry.height;
    this.preSnapGeometry = null;
    this.snapZone = null;
  }

  toJSON() {
    return {
      id: this.id,
      title: this.title,
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height,
      zIndex: this.zIndex,
      minimized: this.minimized,
      fullscreen: this.fullscreen,
      snapZone: this.snapZone,
      preSnapGeometry: this.preSnapGeometry,
      workspaceId: this.workspaceId,
      appId: this.appId,
      appType: this.appType,
      isGame: this.isGame,
      iconValue: this.iconValue,
      color: this.color,
      appStateSnapshot: this.appStateSnapshot,
      scrollPosition: this.scrollPosition,
      focused: this.focused,
      tiled: this.tiled,
      floating: this.floating,
      tileNodeId: this.tileNodeId,
      tileGeometry: this.tileGeometry
    };
  }
}
