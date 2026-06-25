import interact from "interactjs";

export function makeResizable(win, wm, setHeightUnsetElement = null) {
  interact(win).resizable({
    edges: { top: true, left: true, bottom: true, right: true },
    modifiers: [interact.modifiers.restrictSize({ min: { width: 300, height: 300 } })],
    listeners: {
      start() {
        wm.isDraggingWindow = true;
        document.body.classList.add("is-resizing");
      },
      move(event) {
        const { target, rect } = event;
        target.style.width = `${rect.width}px`;
        target.style.height = `${rect.height}px`;
        target.style.top = `${rect.top}px`;
        target.style.left = `${rect.left}px`;

        const entry = wm.openWindows.get(target.id);
        if (entry?.record) {
          entry.record.setGeometry(rect.left, rect.top, rect.width, rect.height);
        }
        if (setHeightUnsetElement?.style) {
          setHeightUnsetElement.style.height = "unset";
        }
      },
      end() {
        wm.isDraggingWindow = false;
        document.body.classList.remove("is-resizing");
        if (wm.triggerSessionSave) wm.triggerSessionSave();
      }
    }
  });
}
