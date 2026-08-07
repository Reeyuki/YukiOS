import "../styles/chooseAppDialog.css";
import { os, createElement } from "../framework.js";
import { getAllPickableApps, getAppsForExtension, getDefaultAppForExt, setDefaultApp } from "../fileAssociations.js";
import { openFileWithApp } from "../fileDisplay.js";
import { animateWindowClose } from "../windowManager/AnimationSystem.js";

export function showChooseAppDialog({ ext, name, path, setOnly = false }) {
  return new Promise((resolve) => {
    const recommended = getAppsForExtension(ext);
    const allApps = getAllPickableApps().filter((app) => !recommended.some((rec) => rec.appId === app.appId));
    const defaultApp = getDefaultAppForExt(ext);
    const knownApps = new Map();
    for (const app of [...recommended, ...allApps]) knownApps.set(app.appId, app);

    let selectedAppId =
      (defaultApp && knownApps.has(defaultApp.appId) ? defaultApp.appId : recommended[0]?.appId) || null;
    let closing = false;

    const overlay = createElement("div");
    overlay.className = "open-with-root";

    const dialog = createElement("div");
    dialog.className = "open-with-dialog";

    const header = createElement("header");
    header.className = "open-with-header";

    const title = createElement("h2");
    title.className = "open-with-title";
    title.textContent = "How do you want to open this file?";

    const subtitle = createElement("p");
    subtitle.className = "open-with-subtitle";
    subtitle.textContent = name || `.${ext} files`;

    header.appendChild(title);
    header.appendChild(subtitle);

    const content = createElement("div");
    content.className = "open-with-body";

    function buildSection(label) {
      const section = createElement("section");
      section.className = "open-with-section";
      const heading = createElement("h3");
      heading.className = "open-with-section-title";
      heading.textContent = label;
      const grid = createElement("div");
      grid.className = "open-with-grid";
      section.appendChild(heading);
      section.appendChild(grid);
      return section;
    }

    function buildTile(app) {
      const tile = createElement("button");
      tile.type = "button";
      tile.className = "open-with-tile";
      tile.dataset.appId = app.appId;

      let iconEl;
      if (typeof app.icon === "string" && app.icon.startsWith("http")) {
        iconEl = createElement("img");
        iconEl.src = app.icon;
        iconEl.alt = app.title;
        iconEl.className = "open-with-tile-icon";
      } else {
        iconEl = createElement("span");
        iconEl.className = `open-with-tile-icon ${app.icon}`;
      }

      const caption = createElement("span");
      caption.className = "open-with-tile-caption";
      caption.textContent = app.title;

      tile.appendChild(iconEl);
      tile.appendChild(caption);
      tile.addEventListener("click", () => {
        selectedAppId = app.appId;
        refreshSelection();
      });
      tile.addEventListener("dblclick", () => {
        selectedAppId = app.appId;
        confirm();
      });
      return tile;
    }

    function refreshSelection() {
      dialog.querySelectorAll(".open-with-tile").forEach((tile) => {
        tile.classList.toggle("selected", tile.dataset.appId === selectedAppId);
      });
    }

    function confirm() {
      if (!selectedAppId) return close();
      const app = knownApps.get(selectedAppId);
      if (!app) return close();
      if (alwaysCheckbox.checked) {
        setDefaultApp(ext, app.appId);
        os.notify.send("Default Apps", `${app.title} is now the default for .${ext} files.`);
      }
      if (!setOnly) openFileWithApp(app.appId, { name, path });
      close(app.appId);
    }

    function close(result = null) {
      if (closing) return;
      closing = true;
      document.removeEventListener("keydown", onKey);
      animateWindowClose(dialog, () => {
        overlay.remove();
        resolve(result);
      });
    }

    if (defaultApp && knownApps.has(defaultApp.appId)) {
      const keepSection = buildSection("Keep using this app");
      const keepGrid = keepSection.querySelector(".open-with-grid");
      keepGrid.appendChild(buildTile(defaultApp));
      content.appendChild(keepSection);
    }

    const otherSection = buildSection("Other options");
    const otherGrid = otherSection.querySelector(".open-with-grid");
    recommended.forEach((app) => {
      if (app.appId !== defaultApp?.appId) otherGrid.appendChild(buildTile(app));
    });
    allApps.forEach((app) => otherGrid.appendChild(buildTile(app)));
    content.appendChild(otherSection);

    const footer = createElement("footer");
    footer.className = "open-with-footer";

    const always = createElement("label");
    always.className = "open-with-always";

    const toggle = createElement("span");
    toggle.className = "open-with-toggle";
    const alwaysCheckbox = createElement("input");
    alwaysCheckbox.type = "checkbox";
    alwaysCheckbox.checked = true;
    const track = createElement("span");
    track.className = "open-with-track";
    const thumb = createElement("span");
    thumb.className = "open-with-thumb";
    track.appendChild(thumb);
    toggle.appendChild(alwaysCheckbox);
    toggle.appendChild(track);

    const alwaysText = createElement("span");
    alwaysText.textContent = `Always use this app to open .${ext} files`;
    always.appendChild(toggle);
    always.appendChild(alwaysText);

    const okBtn = createElement("button");
    okBtn.className = "open-with-ok";
    okBtn.textContent = "OK";
    okBtn.addEventListener("click", confirm);

    footer.appendChild(always);
    footer.appendChild(okBtn);

    dialog.appendChild(header);
    dialog.appendChild(content);
    dialog.appendChild(footer);
    overlay.appendChild(dialog);

    const onKey = (ev) => {
      if (ev.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);

    overlay.addEventListener("mousedown", (ev) => {
      if (ev.target === overlay) close();
    });

    document.body.appendChild(overlay);
    refreshSelection();
  });
}
