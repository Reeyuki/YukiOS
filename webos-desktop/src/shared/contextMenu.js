const MENU_ID = "context-menu";

function getMenu() {
  return document.getElementById(MENU_ID);
}

export function hideMenu() {
  const menu = getMenu();
  if (menu) menu.style.display = "none";
}

function positionMenu(menu, pageX, pageY) {
  const rect = menu.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let left = pageX;
  let top = pageY;

  if (left + rect.width > viewportWidth) {
    left = Math.max(10, viewportWidth - rect.width - 10);
  } else if (left < 0) {
    left = 10;
  }

  if (top + rect.height > viewportHeight) {
    top = Math.max(10, viewportHeight - rect.height - 10);
  } else if (top < 0) {
    top = 10;
  }

  Object.assign(menu.style, {
    left: `${left}px`,
    top: `${top}px`,
    display: "block"
  });
}

function bindDismissal() {
  document.addEventListener("click", () => hideMenu(), { once: true });
}
export function refreshIcons(node = document) {
  if (window.FontAwesome && window.FontAwesome.dom && window.FontAwesome.dom.i2svg) {
    window.FontAwesome.dom.i2svg({ node });
  }
}

export function showContextMenu(e, items, handlers) {
  const menu = getMenu();
  if (!menu) return;

  menu.innerHTML = items
    .filter((item) => typeof item === "string" || !item.condition || item.condition())
    .map((item) => {
      if (item === "hr") return "<hr>";
      const icon = (item.icon || "fa-chevron-right").trim();
      const iconCls = icon.includes(" ") ? icon : `fas ${icon}`;
      const iconHtml = `<i class="${iconCls}" style="width:16px;text-align:center;opacity:0.7;"></i>`;
      return `<div id="${item.id}">${iconHtml}<span>${item.label}</span></div>`;
    })
    .join("");

  refreshIcons(menu);

  items.forEach((item) => {
    if (typeof item === "string" || (item.condition && !item.condition())) return;
    const el = document.getElementById(item.id);
    if (el && handlers[item.action]) {
      el.onclick = (event) => {
        if (event) event.stopPropagation();
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

  const item = (text, onclick, icon = null) => {
    const el = document.createElement("div");
    const iconVal = (icon || "fa-chevron-right").trim();
    const iconCls = iconVal.includes(" ") ? iconVal : `fas ${iconVal}`;
    const iconEl = document.createElement("i");
    iconEl.className = iconCls;
    iconEl.style.width = "16px";
    iconEl.style.textAlign = "center";
    iconEl.style.opacity = "0.7";
    el.appendChild(iconEl);
    const label = document.createElement("span");
    label.textContent = text;
    el.appendChild(label);
    el.onclick = (event) => {
      if (event) event.stopPropagation();
      hideMenu();
      onclick();
    };
    return el;
  };

  const hr = () => document.createElement("hr");

  buildFn(menu, item, hr);

  positionMenu(menu, e.pageX, e.pageY);
  refreshIcons(menu);
  bindDismissal();
}
export function showStartStyleMenu(e, buildFn) {
  const existing = document.getElementById("taskbar-context-menu");
  if (existing) existing.remove();

  const menu = document.createElement("div");
  menu.id = "taskbar-context-menu";

  const addMenuItem = (text, action, icon = null) => {
    const menuItem = document.createElement("div");
    menuItem.className = "menu-item";

    const iconVal = (icon || "fa-chevron-right").trim();
    const iconCls = iconVal.includes(" ") ? iconVal : `fas ${iconVal}`;
    const iconEl = document.createElement("i");
    iconEl.className = iconCls;
    iconEl.style.width = "16px";
    iconEl.style.textAlign = "center";
    menuItem.appendChild(iconEl);

    const label = document.createElement("span");
    label.textContent = text;
    menuItem.appendChild(label);

    menuItem.onclick = () => {
      action();
      menu.remove();
    };
    menu.appendChild(menuItem);
  };

  const addSeparator = () => {
    const hr = document.createElement("hr");
    menu.appendChild(hr);
  };

  buildFn(addMenuItem, addSeparator);

  document.body.appendChild(menu);

  menu.style.display = "block";

  const rect = menu.getBoundingClientRect();

  let posX = e.clientX;
  let posY = e.clientY - rect.height;

  if (posX + rect.width > window.innerWidth) posX = window.innerWidth - rect.width - 10;
  if (posY < 0) posY = e.clientY;

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let left = e.clientX;
  let top = e.clientY;

  if (left + rect.width > viewportWidth) {
    left = Math.max(10, viewportWidth - rect.width - 10);
  } else if (left < 0) {
    left = 10;
  }

  if (top + rect.height > viewportHeight) {
    top = Math.max(10, viewportHeight - rect.height - 10);
  } else if (top < 0) {
    top = 10;
  }

  menu.style.setProperty("--ctx-left", `${left}px`);
  menu.style.setProperty("--ctx-bottom", `${viewportHeight - top - rect.height}px`);

  document.addEventListener("click", function removeMenu() {
    menu.remove();
    document.removeEventListener("click", removeMenu);
  });

  refreshIcons(menu);
  return menu;
}
