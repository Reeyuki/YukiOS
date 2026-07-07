import {
  windowMakeDraggable,
  _getSnapZone,
  _showSnapGhost,
  _hideSnapGhost,
  _applySnap,
  _unsnap
} from "./makeDraggable.js";

export class SnapSystem {
  constructor(manager) {
    this.manager = manager;
  }

  init() {
    this._initSnapGhost();
  }

  _initSnapGhost() {
    const ghost = document.createElement("div");
    ghost.id = "snap-ghost";
    document.getElementById("desktop").appendChild(ghost);
    this.manager._snapGhost = ghost;
  }

  makeDraggable(win) {
    windowMakeDraggable(win, this.manager);
  }

  _getSnapZone(x, y) {
    return _getSnapZone(this.manager, x, y);
  }

  _showSnapGhost(zone) {
    _showSnapGhost(this.manager, zone);
  }

  _hideSnapGhost() {
    _hideSnapGhost(this.manager);
  }

  _applySnap(win, zone, skipSavePreSnap = false) {
    _applySnap(this.manager, win, zone, skipSavePreSnap);
  }

  _unsnap(win) {
    _unsnap(this.manager, win);
  }
}
