import { toggleStartMenu } from "../startMenu.js";

export class InputHandler {
  constructor(manager) {
    this.manager = manager;
  }

  init() {
    this._initStartMenuKeybinds();

    document.addEventListener("keydown", (e) => {
      if (
        e.key.toLowerCase() === "d" &&
        e.metaKey === false &&
        e.ctrlKey === false &&
        e.altKey === false &&
        e.shiftKey === false &&
        e.getModifierState("Meta") === false &&
        e.getModifierState("Control") === false &&
        e.getModifierState("Alt") === false &&
        e.getModifierState("Shift") === false &&
        e.getModifierState("OS")
      ) {
        return;
      }
      if (e.key.toLowerCase() === "d" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();

        const allWindows = Array.from(this.manager.openWindows.keys())
          .map((id) => document.getElementById(id))
          .filter(Boolean);

        const anyVisible = allWindows.some((w) => w.style.display !== "none");

        if (anyVisible) {
          allWindows.forEach((win) => this.manager.minimizeWindow(win));
        } else {
          allWindows.forEach((win) => {
            win.style.display = "block";
            const taskbarItem = document.getElementById(`taskbar-${win.id}`);
            if (taskbarItem) taskbarItem.classList.remove("minimized");
          });
        }
      }
    });

    document.addEventListener("keydown", (e) => {
      if (!e.metaKey && !e.ctrlKey) return;
      const focused = Array.from(this.manager.openWindows.keys())
        .map((id) => document.getElementById(id))
        .filter(Boolean)
        .sort((a, b) => parseInt(b.style.zIndex) - parseInt(a.style.zIndex))[0];
      if (!focused) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        this.manager._applySnap(focused, "left");
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        this.manager._applySnap(focused, "right");
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        this.manager._applySnap(focused, "maximize");
      }
    });
  }

  _initStartMenuKeybinds() {
    document.addEventListener(
      "pointerdown",
      (e) => {
        const target = e.target;
        if (target?.closest?.(".window")) this.manager._lastFocusZone = "window";
        else if (target?.closest?.("#start-menu")) this.manager._lastFocusZone = "start-menu";
        else this.manager._lastFocusZone = "desktop";

        if (this.manager._lastFocusZone === "desktop") {
          this.manager.openWindows.forEach(({ taskbarItem }) => taskbarItem?.classList?.remove("active"));
        }
      },
      { capture: true }
    );

    document.addEventListener("keydown", (e) => {
      if (!this._shouldOpenStartMenuFromKeyEvent(e)) return;
      e.preventDefault();
      toggleStartMenu({ focusSearch: true, openDefaultPage: true });
    });
  }

  _shouldOpenStartMenuFromKeyEvent(e) {
    const key = e.key;
    const isTrigger = key === "Control" || key === "Tab" || key === " " || key === "Spacebar";
    if (!isTrigger) return false;

    const otherMods = e.altKey || e.metaKey || e.shiftKey;
    if (otherMods) return false;

    if (key !== "Control" && e.ctrlKey) return false;

    const active = document.activeElement;
    if (active) {
      const tag = active.tagName;
      const isEditable = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || active.isContentEditable === true;
      if (isEditable) return false;
      if (tag === "IFRAME") return false;
      if (active.closest?.(".window")) return false;
      if (active.closest?.("#start-menu")) return false;
    }

    if (this.manager._lastFocusZone !== "desktop") return false;

    const anyWindowActive = Array.from(this.manager.openWindows.values()).some((v) =>
      v.taskbarItem?.classList?.contains("active")
    );
    if (anyWindowActive) return false;

    return true;
  }
}
