export class EventHelper {
  constructor() {
    this.eventListeners = new Map();
  }

  addClickHandler(element, handler, options = {}) {
    if (!element) return;

    element.addEventListener("click", handler, options);

    if (options.track !== false) {
      const key = this._getElementKey(element);
      if (!this.eventListeners.has(key)) {
        this.eventListeners.set(key, []);
      }
      this.eventListeners.get(key).push({ type: "click", handler, element });
    }
  }

  addClickHandlers(selector, handler, options = {}) {
    const elements = document.querySelectorAll(selector);
    elements.forEach((element) => this.addClickHandler(element, handler, options));
  }

  addDelayedClickHandler(element, handler, delay = 0) {
    setTimeout(() => {
      this.addClickHandler(element, handler);
    }, delay);
  }

  addDocumentClickHandler(handler, options = {}) {
    document.addEventListener("click", handler, options);

    if (options.track !== false) {
      const key = "document";
      if (!this.eventListeners.has(key)) {
        this.eventListeners.set(key, []);
      }
      this.eventListeners.get(key).push({ type: "click", handler, element: document });
    }
  }

  addContextMenuHandler(element, handler, options = {}) {
    if (!element) return;

    element.addEventListener("contextmenu", handler, options);

    if (options.track !== false) {
      const key = this._getElementKey(element);
      if (!this.eventListeners.has(key)) {
        this.eventListeners.set(key, []);
      }
      this.eventListeners.get(key).push({ type: "contextmenu", handler, element });
    }
  }

  addDoubleClickHandler(element, handler, options = {}) {
    if (!element) return;

    element.addEventListener("dblclick", handler, options);

    if (options.track !== false) {
      const key = this._getElementKey(element);
      if (!this.eventListeners.has(key)) {
        this.eventListeners.set(key, []);
      }
      this.eventListeners.get(key).push({ type: "dblclick", handler, element });
    }
  }

  removeEventListeners(element) {
    const key = this._getElementKey(element);
    const listeners = this.eventListeners.get(key);

    if (listeners) {
      listeners.forEach(({ type, handler, element: el }) => {
        el.removeEventListener(type, handler);
      });
      this.eventListeners.delete(key);
    }
  }

  removeAllListeners() {
    this.eventListeners.forEach((listeners) => {
      listeners.forEach(({ type, handler, element: el }) => {
        el.removeEventListener(type, handler);
      });
    });
    this.eventListeners.clear();
  }

  createClickOutsideHandler(element, callback) {
    const handler = (e) => {
      if (!element.contains(e.target)) {
        callback(e);
      }
    };

    this.addDocumentClickHandler(handler);

    return () => {
      document.removeEventListener("click", handler);
    };
  }

  createAutoCloseHandler(element, closeCallback) {
    return this.createClickOutsideHandler(element, (e) => {
      if (e.target === element) {
        closeCallback();
      }
    });
  }

  _getElementKey(element) {
    if (element === document) return "document";
    if (element === window) return "window";
    if (element.id) return `#${element.id}`;
    if (element.className) return `.${element.className.split(" ").join(".")}`;
    return element.tagName.toLowerCase();
  }
}
