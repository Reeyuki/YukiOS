import { modeManager, MODES } from "../modeManager.js";

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
}
