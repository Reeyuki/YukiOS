import { BaseApp } from "../core/BaseApp.js";
import { PersistenceTypes } from "../runtime/AppSchema.js";

export class ScramjetApp extends BaseApp {
  constructor(services) {
    super(services);
    this.iframe = null;
  }

  getDeclarativeSchema(opts) {
    return {
      id: "scramjet",
      name: "Scramjet Browser",
      icon: "fas fa-globe",
      windows: [
        {
          id: "scramjet-window",
          title: "Scramjet Browser",
          size: ["1024px", "768px"],
          icon: "fas fa-globe",
          ui: `
            <div class="scramjet-container" style="width:100%;height:100%;overflow:hidden;">
              <iframe
                id="scramjet-iframe"
                style="width:100%;height:100%;border:none;"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation-by-user-activation"
              ></iframe>
            </div>
          `
        }
      ],
      state: {
        initial: {},
        persistence: PersistenceTypes.NONE
      },
      onMount: "initScramjet",
      onClose: "cleanupScramjet"
    };
  }

  async initScramjet(payload, vt, element, state) {
    this.iframe = element.querySelector("#scramjet-iframe");

    const isIncognito = state.isIncognito || false;
    const incognitoParam = isIncognito ? "?incognito=true" : "";
    this.iframe.src = window.location.origin + "/scram/index.html" + incognitoParam;

    const header = element.querySelector(".window-header");
    if (header) {
      header.style.height = "0";
      header.style.overflow = "hidden";
      header.style.padding = "0";
    }

    this.wm.makeDraggable(element);
    this.wm.makeResizable(element);

    this.iframe.addEventListener("load", () => {
      console.log("Scramjet iframe loaded");
      const checkForControlsSlot = () => {
        try {
          const iframeDoc = this.iframe.contentDocument || this.iframe.contentWindow.document;
          const controlsSlot = iframeDoc.getElementById("controls-slot");
          console.log("Controls slot:", controlsSlot);
          if (controlsSlot) {
            const winId = element.id;
            console.log("Window ID:", winId);

            const controlsHTML = `<div class="window-controls">
              <button class="minimize-btn" title="Minimize"><svg viewBox="0 0 10 1" xmlns="http://www.w3.org/2000/svg"><path d="M0 0h10v1H0z"></path></svg></button>
              <button class="external-btn" title="Open in New Tab">↗</button>
              <button class="maximize-btn" title="Maximize"><svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg"><path d="M0 0v10h10V0H0zm1 1h8v8H1V1z"></path></svg></button>
              <button class="close-btn" title="Close"><svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg"><path d="M10.2.7L9.5 0 5.1 4.4.7 0 0 .7l4.4 4.4L0 9.5l.7.7 4.4-4.4 4.4 4.4.7-.7-4.4-4.4z"></path></svg></button>
            </div>`;

            console.log("Controls HTML:", controlsHTML);
            controlsSlot.innerHTML = controlsHTML;

            const closeBtn = controlsSlot.querySelector(".close-btn");
            const maxBtn = controlsSlot.querySelector(".maximize-btn");
            const minBtn = controlsSlot.querySelector(".minimize-btn");
            const externalBtn = controlsSlot.querySelector(".external-btn");
            console.log("Buttons found:", closeBtn, maxBtn, minBtn, externalBtn);

            if (closeBtn) {
              closeBtn.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.wm.closeWindow(element);
              });
            }
            if (maxBtn) {
              maxBtn.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (element.dataset.snapZone === "maximize") {
                  this.wm.toggleFullscreen(element);
                } else {
                  this.wm._applySnap(element, "maximize");
                }
              });
            }
            if (minBtn) {
              minBtn.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.wm.minimizeWindow(element);
              });
            }
            if (externalBtn) {
              externalBtn.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                window.open(window.location.origin + "/scram/index.html", "_blank");
              });
            }

            const tabStrip = iframeDoc.getElementById("tab-strip");
            const tabsContainer = iframeDoc.getElementById("tabs-container");
            if (tabStrip && tabsContainer) {
              tabsContainer.style.cursor = "move";

              tabsContainer.addEventListener("mousedown", (e) => {
                if (e.target.closest(".tab") || e.target.closest(".new-tab") || e.target.closest(".window-controls"))
                  return;
                if (e.button !== 0) return;

                e.preventDefault();
                this.wm.bringToFront(element);

                const wasSnapped = !!element.dataset.snapZone;
                if (wasSnapped) this.wm._unsnap(element);

                const winRect = element.getBoundingClientRect();
                const ox = e.clientX - winRect.left;
                const oy = e.clientY - winRect.top;

                this.wm.isDraggingWindow = true;
                document.body.classList.add("is-dragging");

                const onMouseMove = (moveEvent) => {
                  const newLeft = moveEvent.clientX - ox;
                  const newTop = moveEvent.clientY - oy;
                  element.style.left = `${newLeft}px`;
                  element.style.top = `${newTop}px`;

                  const entry = this.wm.openWindows.get(element.id);
                  if (entry?.record) {
                    entry.record.setGeometry(newLeft, newTop);
                  }

                  const zone = this.wm._getSnapZone(moveEvent.clientX, moveEvent.clientY);
                  this.wm._activeSnapZone = zone;

                  if (zone) this.wm._showSnapGhost(zone);
                  else this.wm._hideSnapGhost();
                };

                const onMouseUp = () => {
                  document.removeEventListener("mousemove", onMouseMove);
                  document.removeEventListener("mouseup", onMouseUp);

                  this.wm.isDraggingWindow = false;
                  document.body.classList.remove("is-dragging");

                  if (this.wm._activeSnapZone) {
                    this.wm._applySnap(element, this.wm._activeSnapZone);
                    this.wm._activeSnapZone = null;
                    this.wm._hideSnapGhost();
                  }
                  if (this.wm.triggerSessionSave) this.wm.triggerSessionSave();
                };

                document.addEventListener("mousemove", onMouseMove);
                document.addEventListener("mouseup", onMouseUp);
              });
            }
          } else {
            setTimeout(checkForControlsSlot, 100);
          }
        } catch (e) {
          console.error("Failed to inject window controls:", e);
        }
      };
      setTimeout(checkForControlsSlot, 500);
    });
  }

  cleanupScramjet() {
    this.iframe = null;
  }
}
