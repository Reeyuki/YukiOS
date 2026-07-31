export const $ = (selector, root = document) => {
  if (!root) return null;
  try {
    return root.querySelector(selector);
  } catch {
    if (typeof selector === "string" && selector.startsWith("#")) {
      const id = selector.slice(1);
      if (root.getElementById) return root.getElementById(id);
      return root.querySelector(`#${CSS.escape(id)}`);
    }
    return null;
  }
};

export const $$ = (selector, root = document) => {
  if (!root) return [];
  try {
    return Array.from(root.querySelectorAll(selector));
  } catch {
    if (typeof selector === "string" && selector.startsWith("#")) {
      const id = selector.slice(1);
      const el = root.getElementById ? root.getElementById(id) : root.querySelector(`#${CSS.escape(id)}`);
      return el ? [el] : [];
    }
    return [];
  }
};

export const queryAll = (selectors, root = document) => Object.fromEntries(selectors.map((s) => [s, $(s, root)]));

export const bindEvent = (element, event, handler, options) => {
  if (element) element.addEventListener(event, handler, options);
};

export const bindEvents = (element, events) => {
  if (!element) return;
  Object.entries(events).forEach(([event, handler]) => {
    element.addEventListener(event, handler);
  });
};

export const toggleClass = (element, className, condition) => {
  if (element) element.classList.toggle(className, condition);
};

export const addClass = (element, className) => {
  if (element) element.classList.add(className);
};

export const removeClass = (element, className) => {
  if (element) element.classList.remove(className);
};

export const setClasses = (element, classes) => {
  if (!element) return;
  element.className = classes;
};

export const setStyle = (element, styles) => {
  if (!element) return;
  Object.assign(element.style, styles);
};

export const setText = (element, text) => {
  if (element) element.textContent = text;
};

export const setHTML = (element, html) => {
  if (element) element.innerHTML = html;
};

export const createElement = (tag, options = {}) => {
  const el = document.createElement(tag);
  if (options.className) el.className = options.className;
  if (options.id) el.id = options.id;
  if (options.text) el.textContent = options.text;
  if (options.html) el.innerHTML = options.html;
  if (options.attributes) {
    Object.entries(options.attributes).forEach(([key, value]) => {
      el.setAttribute(key, value);
    });
  }
  if (options.styles) {
    Object.assign(el.style, options.styles);
  }
  return el;
};
