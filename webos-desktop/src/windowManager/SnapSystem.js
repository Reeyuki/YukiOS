import { windowMakeDraggable, getSnapZone, showSnapGhost, hideSnapGhost, applySnap, unsnap } from "./makeDraggable.js";
import { $, createElement } from "../shared/domUtils.js";

export class SnapSystem {
  constructor(manager) {
    this.manager = manager;
  }

  init() {
    this.initSnapGhost();
  }

  initSnapGhost() {
    const ghost = createElement("div");
    ghost.id = "snap-ghost";
    $("#desktop").appendChild(ghost);
    this.manager.snapGhost = ghost;
  }

  makeDraggable(win) {
    windowMakeDraggable(win, this.manager);
  }

  getSnapZone(x, y) {
    return getSnapZone(this.manager, x, y);
  }

  showSnapGhost(zone) {
    showSnapGhost(this.manager, zone);
  }

  hideSnapGhost() {
    hideSnapGhost(this.manager);
  }

  applySnap(win, zone, skipSavePreSnap = false) {
    applySnap(this.manager, win, zone, skipSavePreSnap);
  }

  unsnap(win) {
    unsnap(this.manager, win);
  }
}
