const MENU_ID = "context-menu";

function getMenu() {
  return document.getElementById(MENU_ID);
}

export function hideMenu() {
  const menu = getMenu();
  if (menu) menu.style.display = "none";
}

function positionMenu(menu, pageX, pageY) {
  Object.assign(menu.style, { left: `${pageX}px`, top: `${pageY}px`, display: "block" });
}

function bindDismissal() {
  document.addEventListener("click", () => hideMenu(), { once: true });
}

export function showContextMenu(e, items, handlers) {
  const menu = getMenu();
  if (!menu) return;

  menu.innerHTML = items
    .filter((item) => typeof item === "string" || !item.condition || item.condition())
    .map((item) => (item === "hr" ? "<hr>" : `<div id="${item.id}">${item.label}</div>`))
    .join("");

  items.forEach((item) => {
    if (typeof item === "string" || (item.condition && !item.condition())) return;
    const el = document.getElementById(item.id);
    if (el && handlers[item.action]) {
      el.onclick = () => {
        hideMenu();
        handlers[item.action]();
      };
    }
  });

  positionMenu(menu, e.pageX, e.pageY);
  bindDismissal();
}

export function showDynamicContextMenu(e, buildFn) {
  const menu = getMenu();
  if (!menu) return;

  menu.innerHTML = "";

  const item = (text, onclick) => {
    const el = document.createElement("div");
    el.textContent = text;
    el.onclick = () => {
      hideMenu();
      onclick();
    };
    return el;
  };

  const hr = () => document.createElement("hr");

  buildFn(menu, item, hr);

  positionMenu(menu, e.pageX, e.pageY);
  bindDismissal();
}

export function showStartStyleMenu(e, buildFn) {
  const menu = document.createElement("div");
  menu.id = "taskbar-context-menu";
  menu.className = "start-menu";

  const addMenuItem = (text, action) => {
    const menuItem = document.createElement("div");
    menuItem.textContent = text;
    menuItem.className = "start-item";
    menuItem.onclick = () => {
      action();
      menu.remove();
    };
    menu.appendChild(menuItem);
  };

  buildFn(addMenuItem);

  const existing = document.getElementById("taskbar-context-menu");
  if (existing) existing.remove();

  document.body.appendChild(menu);

  const rect = menu.getBoundingClientRect();
  let posX = e.pageX;
  let posBottom = window.innerHeight - e.pageY;

  if (posX + rect.width > window.innerWidth) posX = window.innerWidth - rect.width - 10;
  if (posBottom + rect.height > window.innerHeight) posBottom = 10;

  menu.style.setProperty("--ctx-left", `${posX}px`);
  menu.style.setProperty("--ctx-bottom", `${posBottom}px`);

  document.addEventListener("click", function removeMenu() {
    menu.remove();
    document.removeEventListener("click", removeMenu);
  });

  return menu;
}
