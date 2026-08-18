import { modeManager, MODES, MODE_DEFS } from "../modeManager.js";

export { MODES };

export class ModeAPI {
  isActive(id) {
    return modeManager.isActive(id);
  }

  getActiveModes() {
    return modeManager.getActiveModes();
  }

  enter(id) {
    modeManager.enter(id);
  }

  exit(id) {
    modeManager.exit(id);
  }

  exitAll() {
    modeManager.exitAll();
  }

  getModeName(id) {
    const def = MODE_DEFS[id];
    return def && def.label ? def.label : null;
  }

  getActiveModeName() {
    for (const id of modeManager.getActiveModes()) {
      const label = this.getModeName(id);
      if (label) return label;
    }
    return "YukiOS";
  }
}
