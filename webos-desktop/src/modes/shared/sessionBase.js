import { modeManager, MODES } from "../../modeManager.js";
import { BusEvents } from "../../core/EventBus.js";
import { os } from "../../framework.js";

export class SessionMode {
  constructor(modeId) {
    this.modeId = modeId;
  }

  enter() {
    modeManager.enter(this.modeId);
    os.events.emit(BusEvents.SETTINGS_CHANGED, {});
  }

  exit() {
    modeManager.exit(this.modeId);
  }
}
