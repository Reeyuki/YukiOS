import { os, StorageKeys } from "../framework.js";
import { $$, setHTML, setText } from "./domUtils.js";

export function loadStartupApps() {
  try {
    const v = os.storage.get(StorageKeys.startupApps);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function saveStartupApps(list) {
  os.storage.set(StorageKeys.startupApps, list);
}

export function toggleStartupApp(list, appId) {
  const idx = list.indexOf(appId);
  if (idx >= 0) list.splice(idx, 1);
  else list.push(appId);
  saveStartupApps(list);
  return list;
}

export function getSystemApps() {
  const all = os.app.getAllApps();
  return Object.entries(all)
    .filter(([, e]) => e && e.type === "system")
    .map(([id, e]) => ({ id, title: e.title, icon: e.icon }));
}

export function renderToggle(enabled, cbClass = "autostart-cb") {
  return `<label class="settings-toggle"><input type="checkbox" class="${cbClass}" ${
    enabled ? "checked" : ""
  }><span class="settings-track"><span class="settings-thumb"></span></span></label>`;
}

export function renderStartupAppList(container, state, opts = {}) {
  const cbClass = opts.cbClass || "autostart-cb";
  const rowClass = opts.rowClass || "settings-row autostart-row";
  const onClass = opts.onClass || "autostart-on";
  const imgClass = opts.imgClass || "settings-app-icon-img";
  const faClass = opts.faClass || "settings-app-icon-fa";
  const placeholderClass = opts.placeholderClass || "settings-app-icon-placeholder";
  const iconWrapClass = opts.iconWrapClass || "settings-app-icon";
  const emptyClass = opts.emptyClass || "settings-empty";

  const apps = getSystemApps();
  const filter = (state.filter || "").toLowerCase();
  const filtered = filter ? apps.filter((a) => a.title && a.title.toLowerCase().includes(filter)) : [...apps];

  filtered.sort((a, b) => {
    const aOn = state.list.includes(a.id);
    const bOn = state.list.includes(b.id);
    if (aOn && !bOn) return -1;
    if (!aOn && bOn) return 1;
    return (a.title || "").localeCompare(b.title || "");
  });

  if (opts.onChange) opts.onChange(state.list.length, apps.length);

  if (filtered.length === 0) {
    setHTML(container, `<div class="${emptyClass}">No apps found</div>`);
    return { refresh: () => renderStartupAppList(container, state, opts) };
  }

  setHTML(
    container,
    filtered
      .map((app) => {
        const enabled = state.list.includes(app.id);
        const icon = app.icon
          ? app.icon.startsWith("http") || app.icon.startsWith("/")
            ? `<img src="${app.icon}" class="${imgClass}">`
            : `<i class="${app.icon} ${faClass}"></i>`
          : `<span class="${placeholderClass}"></span>`;
        return `<div class="${rowClass} ${enabled ? onClass : ""}" data-app-id="${app.id}">
          <div class="settings-label-group">
            <span class="${iconWrapClass}">${icon}</span>
            <span class="settings-label-title">${app.title}</span>
          </div>
          ${renderToggle(enabled, cbClass)}
        </div>`;
      })
      .join("")
  );

  container.querySelectorAll("." + cbClass).forEach((cb) => {
    cb.addEventListener("change", () => {
      const row = cb.closest("." + rowClass.split(" ")[0]);
      const appId = row?.dataset.appId;
      if (!appId) return;
      if (cb.checked) {
        if (!state.list.includes(appId)) state.list.push(appId);
      } else {
        const i = state.list.indexOf(appId);
        if (i >= 0) state.list.splice(i, 1);
      }
      saveStartupApps(state.list);
      renderStartupAppList(container, state, opts);
    });
  });

  return { refresh: () => renderStartupAppList(container, state, opts) };
}
