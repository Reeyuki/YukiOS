export class EventBinder {
  constructor(stateManager, actionExecutor) {
    this.stateManager = stateManager;
    this.actionExecutor = actionExecutor;
    this.boundEvents = new Map();
    this.elementIds = new WeakMap();
    this.nextId = 0;
  }

  bind(element, eventConfig) {
    if (!element || !eventConfig) return;

    Object.entries(eventConfig).forEach(([eventType, handler]) => {
      this.bindSingleEvent(element, eventType, handler);
    });
  }

  getKey(element, eventType) {
    if (!this.elementIds.has(element)) {
      this.elementIds.set(element, `__eb_${this.nextId++}`);
    }
    return `${this.elementIds.get(element)}_${eventType}`;
  }

  bindSingleEvent(element, eventType, handler) {
    const key = this.getKey(element, eventType);

    if (this.boundEvents.has(key)) {
      const existing = this.boundEvents.get(key);
      existing.element.removeEventListener(existing.eventType, existing.handler);
      this.boundEvents.delete(key);
    }

    const wrappedHandler = (event) => {
      this.executeHandler(handler, event, element);
    };

    element.addEventListener(eventType, wrappedHandler);

    this.boundEvents.set(key, {
      element,
      eventType,
      handler: wrappedHandler
    });
  }

  executeHandler(handler, event, element) {
    if (typeof handler === "function") {
      handler(event, this.stateManager.state, element);
    } else if (typeof handler === "object") {
      this.executeActionHandler(handler, event, element);
    }
  }

  executeActionHandler(handler, event, element) {
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
    const key = this.getKey(element, eventType);
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
