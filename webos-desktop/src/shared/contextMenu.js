const MENU_ID = "context-menu";

function getMenu() {
  return document.getElementById(MENU_ID);
}

export function hideMenu() {
  const menu = getMenu();
  if (menu) menu.style.display = "none";
}

function positionMenu(menu, pageX, pageY) {
  menu.style.display = "block";
  menu.style.maxHeight = "";
  menu.style.overflowY = "";

  const rect = menu.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

  let left = pageX;
  let top = pageY;

  const spaceRight = viewportWidth - pageX;
  const spaceLeft = pageX;
  const spaceBelow = viewportHeight - pageY;
  const spaceAbove = pageY;

  if (rect.width > spaceRight && spaceLeft >= rect.width) {
    left = pageX - rect.width;
  } else if (rect.width > spaceRight && spaceLeft < rect.width) {
    left = Math.max(10, viewportWidth - rect.width - 10);
  } else if (left + rect.width > viewportWidth) {
    left = Math.max(10, viewportWidth - rect.width - 10);
  } else if (left < 0) {
    left = 10;
  }

  if (rect.height > spaceBelow && spaceAbove >= rect.height) {
    top = pageY - rect.height;
  } else if (rect.height > spaceBelow && spaceAbove < rect.height) {
    top = 10;
    menu.style.maxHeight = `${viewportHeight - 20}px`;
    menu.style.overflowY = "auto";
  } else if (top + rect.height > viewportHeight) {
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
  menu.classList.add("context-menu-glass");

  const filtered = items.filter((item) => typeof item === "string" || !item.condition || item.condition());
  const deduped = filtered.filter((item, i) => !(item === "hr" && filtered[i - 1] === "hr"));

  menu.innerHTML = deduped
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
  menu.classList.add("context-menu-glass");

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
  menu.classList.add("context-menu-glass");

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
  menu.style.maxHeight = "";
  menu.style.overflowY = "";

  const rect = menu.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  const spaceRight = viewportWidth - e.clientX;
  const spaceLeft = e.clientX;
  const spaceBelow = viewportHeight - e.clientY;
  const spaceAbove = e.clientY;

  let left = e.clientX;
  let top = e.clientY;

  if (rect.width > spaceRight && spaceLeft >= rect.width) {
    left = e.clientX - rect.width;
  } else if (rect.width > spaceRight && spaceLeft < rect.width) {
    left = Math.max(10, viewportWidth - rect.width - 10);
  } else if (left + rect.width > viewportWidth) {
    left = Math.max(10, viewportWidth - rect.width - 10);
  } else if (left < 0) {
    left = 10;
  }

  if (rect.height > spaceBelow && spaceAbove >= rect.height) {
    top = e.clientY - rect.height;
  } else if (rect.height > spaceBelow && spaceAbove < rect.height) {
    top = 10;
    menu.style.maxHeight = `${viewportHeight - 20}px`;
    menu.style.overflowY = "auto";
  } else if (top + rect.height > viewportHeight) {
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
