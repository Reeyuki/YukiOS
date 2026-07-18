const MENU_ID = "context-menu";

function getMenu() {
  return document.getElementById(MENU_ID);
}

export function hideMenu() {
  if (dismissHandler) {
    document.removeEventListener("click", dismissHandler);
    dismissHandler = null;
  }
  const menu = getMenu();
  if (!menu) return;
  if (menu.classList.contains("closing")) return;
  menu.classList.add("closing");
  menu.style.display = "none";
}

export function positionMenu(menu, pageX, pageY) {
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

let dismissHandler = null;

export function bindDismissal() {
  if (dismissHandler) {
    document.removeEventListener("click", dismissHandler);
    dismissHandler = null;
  }

  const handler = (e) => {
    document.removeEventListener("click", handler);
    if (dismissHandler === handler) dismissHandler = null;
    hideMenu();
  };
  dismissHandler = handler;

  setTimeout(() => {
    document.addEventListener("click", handler);
  }, 0);
}

export function refreshIcons(node = document) {
  if (window.FontAwesome && window.FontAwesome.dom && window.FontAwesome.dom.i2svg) {
    window.FontAwesome.dom.i2svg({ node });
  }
}

export function showContextMenu(e, items, handlers) {
  const menu = getMenu();
  if (!menu) return;
  menu.classList.remove("closing");
  menu.style.display = "";
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
  setupKeyboardNav(menu);
  menu.focus({ preventScroll: true });
  bindDismissal();
}

function getNavItems(menuEl) {
  return Array.from(menuEl.children).filter((el) => el.tagName !== "HR" && el.style.display !== "none");
}

function focusItem(menuEl, idx) {
  const items = getNavItems(menuEl);
  if (!items.length) return;
  idx = Math.max(0, Math.min(idx, items.length - 1));
  items.forEach((el, i) => el.classList.toggle("cm-focused", i === idx));
  menuEl.dataset.cmIdx = String(idx);
  items[idx].scrollIntoView({ block: "nearest" });
}

function clearFocus(menuEl) {
  const items = getNavItems(menuEl);
  items.forEach((el) => el.classList.remove("cm-focused"));
  delete menuEl.dataset.cmIdx;
}

function setupKeyboardNav(menuEl) {
  if (menuEl.dataset.cmNav) return;
  menuEl.dataset.cmNav = "1";
  menuEl.setAttribute("tabindex", "-1");

  menuEl.addEventListener("mouseover", clearFocus.bind(null, menuEl), {
    passive: true
  });

  menuEl.addEventListener("keydown", (e) => {
    const items = getNavItems(menuEl);
    if (!items.length) return;

    let idx = parseInt(menuEl.dataset.cmIdx || "0");
    idx = Math.max(0, Math.min(idx, items.length - 1));

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        e.stopPropagation();
        if (idx < items.length - 1) idx++;
        focusItem(menuEl, idx);
        break;
      case "ArrowUp":
        e.preventDefault();
        e.stopPropagation();
        if (idx > 0) idx--;
        focusItem(menuEl, idx);
        break;
      case "ArrowRight": {
        const target = items[idx];
        if (target && target.classList.contains("has-submenu")) {
          e.preventDefault();
          e.stopPropagation();
          const trigger = target.querySelector(":scope > div");
          if (trigger) {
            trigger.click();
            const sub = target.querySelector(":scope > .context-menu");
            if (sub) {
              setTimeout(() => {
                sub.focus({ preventScroll: true });
                focusItem(sub, 0);
              }, 50);
            }
          }
        }
        break;
      }
      case "ArrowLeft":
      case "Escape": {
        const parentWrapper = menuEl.closest(".has-submenu");
        if (parentWrapper) {
          e.preventDefault();
          e.stopPropagation();
          menuEl.style.display = "none";
          clearFocus(menuEl);
          const parentMenu = parentWrapper.parentElement;
          if (parentMenu) {
            const parentItems = getNavItems(parentMenu);
            const parentIdx = parentItems.indexOf(parentWrapper);
            parentMenu.focus({ preventScroll: true });
            focusItem(parentMenu, Math.max(0, parentIdx));
          }
        } else if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          menuEl.querySelectorAll(".context-menu").forEach((s) => (s.style.display = "none"));
          hideMenu();
        }
        break;
      }
      case "Enter":
      case " ":
        e.preventDefault();
        e.stopPropagation();
        const item = items[idx];
        if (item.classList.contains("has-submenu")) {
          const trigger = item.querySelector(":scope > div");
          if (trigger) trigger.click();
        } else {
          item.click();
        }
        break;
    }
  });
}

function createItemElement(text, onclick, icon) {
  const el = document.createElement("div");
  if (icon) {
    const iconVal = icon.trim();
    const iconCls = iconVal.includes(" ") ? iconVal : `fas ${iconVal}`;
    const iconEl = document.createElement("i");
    iconEl.className = iconCls;
    iconEl.style.width = "16px";
    iconEl.style.textAlign = "center";
    iconEl.style.opacity = "0.7";
    el.appendChild(iconEl);
  }
  const label = document.createElement("span");
  label.textContent = text;
  el.appendChild(label);
  el.onclick = (event) => {
    if (event) event.stopPropagation();
    if (onclick) {
      hideMenu();
      onclick();
    }
  };
  return el;
}

export function showDynamicContextMenu(e, buildFn) {
  const menu = getMenu();
  if (!menu) return;

  menu.classList.remove("closing");
  menu.style.display = "";
  menu.innerHTML = "";
  menu.classList.add("context-menu-glass");

  const item = (text, onclick, icon = null) => createItemElement(text, onclick, icon);

  const hr = () => document.createElement("hr");

  const submenu = (label, buildSubFn, icon = null) => {
    const wrapper = document.createElement("div");
    wrapper.className = "context-menu-item has-submenu";

    const trigger = createItemElement(label, null, icon);
    const arrow = document.createElement("span");
    arrow.className = "submenu-arrow";
    arrow.textContent = "\u25b6";
    trigger.appendChild(arrow);
    wrapper.appendChild(trigger);

    const subMenuEl = document.createElement("div");
    subMenuEl.className = "context-menu context-menu-glass";
    subMenuEl.style.display = "none";
    subMenuEl.style.position = "fixed";
    wrapper.appendChild(subMenuEl);

    const subItem = (text, onclick, subIcon = null) => createItemElement(text, onclick, subIcon);
    const subHr = () => document.createElement("hr");
    buildSubFn(subMenuEl, subItem, subHr, submenu);
    setupKeyboardNav(subMenuEl);

    let hideTimeout = null;
    let showTimeout = null;

    wrapper.addEventListener("mouseenter", () => {
      clearTimeout(hideTimeout);
      clearTimeout(showTimeout);
      showTimeout = setTimeout(() => {
        const wrapperRect = wrapper.getBoundingClientRect();
        subMenuEl.style.display = "block";
        subMenuEl.style.top = "0";
        subMenuEl.style.left = wrapperRect.width + "px";

        const subRect = subMenuEl.getBoundingClientRect();
        if (subRect.right > window.innerWidth) {
          subMenuEl.style.left = "auto";
          subMenuEl.style.right = wrapperRect.width + "px";
        }
        if (subRect.bottom > window.innerHeight) {
          subMenuEl.style.top = Math.max(0, -(subRect.bottom - window.innerHeight) - 4) + "px";
        }
        refreshIcons(subMenuEl);
      }, 150);
    });

    wrapper.addEventListener("mouseleave", () => {
      clearTimeout(showTimeout);
      hideTimeout = setTimeout(() => {
        subMenuEl.style.display = "none";
      }, 300);
    });

    trigger.addEventListener("click", (event) => {
      event.stopPropagation();
      clearTimeout(hideTimeout);
      const isVisible = subMenuEl.style.display === "block";
      subMenuEl.style.display = isVisible ? "none" : "block";
      if (!isVisible) {
        const wrapperRect = wrapper.getBoundingClientRect();
        subMenuEl.style.top = "0";
        subMenuEl.style.left = wrapperRect.width + "px";
        refreshIcons(subMenuEl);
      }
    });

    return wrapper;
  };

  buildFn(menu, item, hr, submenu);

  positionMenu(menu, e.pageX, e.pageY);
  refreshIcons(menu);
  setupKeyboardNav(menu);
  menu.focus({ preventScroll: true });
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
      menu.classList.add("closing");
      menu.addEventListener("animationend", () => menu.remove(), { once: true });
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
    document.removeEventListener("click", removeMenu);
    menu.classList.add("closing");
    menu.addEventListener("animationend", () => menu.remove(), { once: true });
  });

  refreshIcons(menu);
  return menu;
}
