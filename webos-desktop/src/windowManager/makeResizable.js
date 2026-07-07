import { makeResizable } from "../shared/dragUtils.js";

export function windowMakeResizable(win, wm, setHeightUnsetElement = null) {
  makeResizable(
    win,
    {
      start() {
        wm.isDraggingWindow = true;
        document.body.classList.add("is-resizing");
      },
      move(e, rect) {
        win.style.width = `${rect.width}px`;
        win.style.height = `${rect.height}px`;
        win.style.top = `${rect.top}px`;
        win.style.left = `${rect.left}px`;

        const entry = wm.openWindows.get(win.id);
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
    },
    { minWidth: 300, minHeight: 300 }
  );
}
