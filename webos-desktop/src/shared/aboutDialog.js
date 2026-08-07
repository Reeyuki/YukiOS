import { makeDraggable } from "./dragUtils.js";
import { resolveIconUrl } from "./assetResolver.js";
import { createElement } from "./domUtils.js";

export function showAboutDialog(options) {
  const { title, version = "1.0.0", description, icon = null, iconType = "image" } = options;

  const dialog = createElement("div");
  dialog.className = "about-dialog-overlay";

  let iconHtml = "";
  if (icon) {
    if (iconType === "image") {
      iconHtml = `<div style="font-size:48px;margin-bottom:10px;"><img style="width:50px" src="${resolveIconUrl(icon)}"></div>`;
    } else if (iconType === "fontawesome") {
      iconHtml = `<div style="font-size:48px;margin-bottom:10px;color:var(--brand);"><i class="${icon}"></i></div>`;
    }
  }

  dialog.innerHTML = `
    <div class="about-dialog">
      <div class="about-dialog-header">
        <span class="about-dialog-title">${title}</span>
        <button class="about-dialog-close" id="about-dlg-close"><i class="fas fa-times"></i></button>
      </div>
      <div style="text-align:center;padding:20px;">
        ${iconHtml}
        <h2 style="margin:0 0 5px 0;font-weight:normal;color:var(--text-primary);">${title}</h2>
        <p style="color:var(--text-secondary);margin:5px 0;">Version ${version}</p>
        <p style="font-size:12px;color:var(--text-secondary);margin:15px 0;">${description}</p>
        <div class="about-dialog-buttons" style="justify-content:center;margin-top:20px;">
          <button class="about-dialog-btn about-dialog-btn--start" id="about-dlg-ok">Close</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(dialog);

  const dialogEl = dialog.querySelector(".about-dialog");
  const header = dialog.querySelector(".about-dialog-header");

  makeDraggable(
    header,
    {
      start(e, posX, posY) {
        const rect = dialogEl.getBoundingClientRect();
        dialogEl.dataset.offsetX = posX - rect.left;
        dialogEl.dataset.offsetY = posY - rect.top;
        dialogEl.dataset.startX = posX;
        dialogEl.dataset.startY = posY;
      },
      move(e, dx, dy, clientX, clientY) {
        const offsetX = parseFloat(dialogEl.dataset.offsetX);
        const offsetY = parseFloat(dialogEl.dataset.offsetY);
        dialogEl.style.left = `${clientX - offsetX}px`;
        dialogEl.style.top = `${clientY - offsetY}px`;
      },
      end() {
        delete dialogEl.dataset.offsetX;
        delete dialogEl.dataset.offsetY;
        delete dialogEl.dataset.startX;
        delete dialogEl.dataset.startY;
      }
    },
    {
      ignoreFrom: "button"
    }
  );

  const close = () => {
    if (dialog.parentNode) dialog.parentNode.removeChild(dialog);
  };

  dialog.addEventListener("click", (e) => {
    e.stopPropagation();
    if (e.target === dialog) close();
  });
  dialog.querySelector("#about-dlg-close").addEventListener("click", close);
  dialog.querySelector("#about-dlg-ok").addEventListener("click", close);
}
