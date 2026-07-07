export class EventBinder {
  constructor(stateManager, actionExecutor) {
    this.stateManager = stateManager;
    this.actionExecutor = actionExecutor;
    this.boundEvents = new Map();
    this._elementIds = new WeakMap();
    this._nextId = 0;
  }

  bind(element, eventConfig) {
    if (!element || !eventConfig) return;

    Object.entries(eventConfig).forEach(([eventType, handler]) => {
      this._bindSingleEvent(element, eventType, handler);
    });
  }

  _getKey(element, eventType) {
    if (!this._elementIds.has(element)) {
      this._elementIds.set(element, `__eb_${this._nextId++}`);
    }
    return `${this._elementIds.get(element)}_${eventType}`;
  }

  _bindSingleEvent(element, eventType, handler) {
    const key = this._getKey(element, eventType);

    if (this.boundEvents.has(key)) {
      const existing = this.boundEvents.get(key);
      existing.element.removeEventListener(existing.eventType, existing.handler);
      this.boundEvents.delete(key);
    }

    const wrappedHandler = (event) => {
      this._executeHandler(handler, event, element);
    };

    element.addEventListener(eventType, wrappedHandler);

    this.boundEvents.set(key, {
      element,
      eventType,
      handler: wrappedHandler
    });
  }

  _executeHandler(handler, event, element) {
    if (typeof handler === "function") {
      handler(event, this.stateManager.state, element);
    } else if (typeof handler === "object") {
      this._executeActionHandler(handler, event, element);
    }
  }

  _executeActionHandler(handler, event, element) {
    const { type, payload, stopPropagation, preventDefault } = handler;

    if (stopPropagation) {
      event.stopPropagation();
    }

    if (preventDefault) {
      event.preventDefault();
    }

    if (this.actionExecutor) {
      this.actionExecutor.execute(type, payload, event, element);
    }
  }

  unbind(element, eventType) {
    const key = this._getKey(element, eventType);
    const bound = this.boundEvents.get(key);

    if (bound) {
      bound.element.removeEventListener(bound.eventType, bound.handler);
      this.boundEvents.delete(key);
    }
  }

  unbindAll(element) {
    if (!element) return;

    for (const [key, bound] of this.boundEvents.entries()) {
      if (element.contains(bound.element)) {
        bound.element.removeEventListener(bound.eventType, bound.handler);
        this.boundEvents.delete(key);
      }
    }
  }

  clear(windowElement = null) {
    for (const [key, bound] of this.boundEvents.entries()) {
      if (!windowElement || windowElement.contains(bound.element)) {
        bound.element.removeEventListener(bound.eventType, bound.handler);
        this.boundEvents.delete(key);
      }
    }
  }
}
