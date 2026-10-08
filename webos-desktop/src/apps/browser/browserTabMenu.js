function callStore(store, name, ...args) {
  if (!store) return null;
  const fn = store[name];
  if (typeof fn !== "function") return null;
  return fn.apply(store, args);
}

function clampMenu(menu, x, y) {
  const rect = menu.getBoundingClientRect();
  let left = x;
  let top = y;
  if (left + rect.width > window.innerWidth - 4) {
    left = Math.max(4, window.innerWidth - rect.width - 4);
  }
  if (top + rect.height > window.innerHeight - 4) {
    top = Math.max(4, window.innerHeight - rect.height - 4);
  }
  if (left < 4) left = 4;
  if (top < 4) top = 4;
  menu.style.left = left + "px";
  menu.style.top = top + "px";
}

function watchDismissal(menu, onClose) {
  let released = false;
  function release() {
    if (released) return;
    released = true;
    document.removeEventListener("pointerdown", onPointer, true);
    document.removeEventListener("keydown", onKey, true);
    window.removeEventListener("blur", onBlur);
    window.removeEventListener("resize", onBlur);
  }
  function close() {
    release();
    if (menu.parentNode) menu.parentNode.removeChild(menu);
    if (typeof onClose === "function") onClose();
  }
  function onPointer(event) {
    if (!menu.contains(event.target)) close();
  }
  function onKey(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  }
  function onBlur() {
    close();
  }
  document.addEventListener("pointerdown", onPointer, true);
  document.addEventListener("keydown", onKey, true);
  window.addEventListener("blur", onBlur);
  window.addEventListener("resize", onBlur);
  return close;
}

function resolveHost() {
  return document.body;
}

function createMenuShell(x, y, extraClass) {
  const menu = document.createElement("div");
  menu.className = extraClass ? "ctx-menu " + extraClass : "ctx-menu";
  menu.style.position = "fixed";
  menu.style.zIndex = "99999";
  menu.style.left = x + "px";
  menu.style.top = y + "px";
  menu.setAttribute("role", "menu");
  resolveHost().appendChild(menu);
  clampMenu(menu, x, y);
  return menu;
}

function createItem(action, iconClass, label, onSelect) {
  const item = document.createElement("div");
  item.className = "ctx-menu-item";
  item.setAttribute("data-action", action);
  item.setAttribute("role", "menuitem");
  item.tabIndex = 0;
  const icon = document.createElement("i");
  icon.className = "fa-solid " + iconClass + " ci-icon";
  icon.setAttribute("aria-hidden", "true");
  const text = document.createElement("span");
  text.className = "ci-label";
  text.textContent = label;
  item.appendChild(icon);
  item.appendChild(text);
  item.addEventListener("click", () => onSelect());
  item.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect();
    }
  });
  return item;
}

function createSeparator() {
  const sep = document.createElement("div");
  sep.className = "ctx-menu-sep";
  return sep;
}

function resolveTabContext(store, tab) {
  const fallback = { all: [], index: -1 };
  if (!store || typeof store.getAll !== "function" || !tab) return fallback;
  let all = [];
  try {
    all = store.getAll() || [];
  } catch (err) {
    return fallback;
  }
  if (!Array.isArray(all)) return fallback;
  const index = all.findIndex((entry) => entry && entry.id === tab.id);
  return { all, index };
}

function safeClosedTabs(store) {
  if (!store || typeof store.getClosedTabs !== "function") return [];
  try {
    const list = store.getClosedTabs();
    return Array.isArray(list) ? list : [];
  } catch (err) {
    return [];
  }
}

export function showTabMenu(opts) {
  const options = opts || {};
  const store = options.store;
  const tab = options.tab;
  const startX = Number(options.x) || 0;
  const startY = Number(options.y) || 0;
  const menu = createMenuShell(startX, startY, null);
  const closeMenu = watchDismissal(menu, null);
  function select(fn) {
    return () => {
      closeMenu();
      fn();
    };
  }
  menu.appendChild(
    createItem(
      "new-tab",
      "fa-plus",
      "New Tab",
      select(() => {
        callStore(store, "addTab");
      }),
    ),
  );
  menu.appendChild(
    createItem(
      "reload",
      "fa-rotate-right",
      "Reload",
      select(() => {
        if (tab) callStore(store, "navigateTab", tab.id, tab.url);
      }),
    ),
  );
  menu.appendChild(
    createItem(
      "duplicate",
      "fa-copy",
      "Duplicate Tab",
      select(() => {
        if (tab) callStore(store, "duplicateTab", tab.id);
      }),
    ),
  );
  menu.appendChild(createSeparator());
  const muted = Boolean(tab && tab.isMuted);
  menu.appendChild(
    createItem(
      "toggle-mute",
      muted ? "fa-volume-high" : "fa-volume-mute",
      muted ? "Unmute Tab" : "Mute Tab",
      select(() => {
        if (tab) callStore(store, "toggleMute", tab.id);
      }),
    ),
  );
  const pinned = Boolean(tab && tab.isPinned);
  menu.appendChild(
    createItem(
      "toggle-pin",
      "fa-thumbtack",
      pinned ? "Unpin Tab" : "Pin Tab",
      select(() => {
        if (tab) callStore(store, "togglePin", tab.id);
      }),
    ),
  );
  menu.appendChild(createSeparator());
  const context = resolveTabContext(store, tab);
  const hasTabs = context.all.length > 1 && context.index !== -1;
  const hasLeft = hasTabs && context.index > 0;
  const hasRight =
    hasTabs && context.index > -1 && context.index < context.all.length - 1;
  if (hasTabs) {
    menu.appendChild(
      createItem(
        "close-others",
        "fa-xmark",
        "Close Other Tabs",
        select(() => {
          if (tab) callStore(store, "closeOtherTabs", tab.id);
        }),
      ),
    );
  }
  if (hasLeft) {
    menu.appendChild(
      createItem(
        "close-left",
        "fa-xmark",
        "Close Tabs to Left",
        select(() => {
          if (tab) callStore(store, "closeLeftTabs", tab.id);
        }),
      ),
    );
  }
  if (hasRight) {
    menu.appendChild(
      createItem(
        "close-right",
        "fa-xmark",
        "Close Tabs to Right",
        select(() => {
          if (tab) callStore(store, "closeRightTabs", tab.id);
        }),
      ),
    );
  }
  menu.appendChild(
    createItem(
      "close-tab",
      "fa-xmark",
      "Close Tab",
      select(() => {
        if (tab) callStore(store, "closeTab", tab.id);
      }),
    ),
  );
  menu.appendChild(createSeparator());
  const closedCount = safeClosedTabs(store).length;
  menu.appendChild(
    createItem(
      "reopen-closed",
      "fa-undo",
      "Reopen Closed Tab (" + closedCount + ")",
      select(() => {
        callStore(store, "reopenClosedTab");
      }),
    ),
  );
  clampMenu(menu, startX, startY);
  return closeMenu;
}

export function showClosedTabsMenu(opts) {
  const options = opts || {};
  const store = options.store;
  const startX = Number(options.x) || 0;
  const startY = Number(options.y) || 0;
  const menu = createMenuShell(startX, startY, "closed-picker");
  const closeMenu = watchDismissal(menu, null);
  const closed = safeClosedTabs(store);
  if (closed.length === 0) {
    const empty = document.createElement("div");
    empty.className = "ctx-empty";
    empty.textContent = "No closed tabs";
    menu.appendChild(empty);
  } else {
    const list = document.createElement("div");
    list.className = "ctx-closed-list";
    for (
      let displayIndex = 0;
      displayIndex < closed.length;
      displayIndex += 1
    ) {
      const originalIndex = closed.length - 1 - displayIndex;
      const entry = closed[originalIndex];
      const row = document.createElement("div");
      row.className = "ctx-closed-row";
      row.setAttribute("role", "menuitem");
      row.tabIndex = 0;
      const icon = document.createElement("i");
      icon.className = "fa-solid fa-globe ci-icon";
      icon.setAttribute("aria-hidden", "true");
      const textWrap = document.createElement("div");
      textWrap.className = "ctx-closed-text";
      const title = document.createElement("div");
      title.className = "ctx-closed-title";
      title.textContent =
        (entry && entry.title) || (entry && entry.url) || "Untitled";
      const url = document.createElement("div");
      url.className = "ctx-closed-url";
      url.textContent = (entry && entry.url) || "";
      textWrap.appendChild(title);
      textWrap.appendChild(url);
      row.appendChild(icon);
      row.appendChild(textWrap);
      const restoreAt = originalIndex;
      const activate = () => {
        closeMenu();
        if (store && typeof store.reopenClosedTabAt === "function") {
          store.reopenClosedTabAt(restoreAt);
        } else {
          callStore(store, "reopenClosedTab");
        }
      };
      row.addEventListener("click", activate);
      row.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          activate();
        }
      });
      list.appendChild(row);
    }
    menu.appendChild(list);
    menu.appendChild(createSeparator());
    const clearButton = createItem(
      "clear-closed",
      "fa-trash",
      "Clear List",
      () => {
        closeMenu();
        callStore(store, "clearClosedTabs");
      },
    );
    clearButton.classList.add("ctx-closed-clear");
    menu.appendChild(clearButton);
  }
  clampMenu(menu, startX, startY);
  return closeMenu;
}
