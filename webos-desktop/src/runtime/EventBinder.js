import { EventTypes } from "./AppSchema.js";

export class EventBinder {
  constructor(stateManager, actionExecutor) {
    this.stateManager = stateManager;
    this.actionExecutor = actionExecutor;
    this.boundEvents = new Map();
  }

  bind(element, eventConfig) {
    if (!element || !eventConfig) return;

    Object.entries(eventConfig).forEach(([eventType, handler]) => {
      this._bindSingleEvent(element, eventType, handler);
    });
  }

  _bindSingleEvent(element, eventType, handler) {
    const eventKey = this._getEventKey(element, eventType);

    if (this.boundEvents.has(eventKey)) {
      this.unbind(element, eventType);
    }

    const wrappedHandler = (event) => {
      this._executeHandler(handler, event, element);
    };

    element.addEventListener(eventType, wrappedHandler);

    this.boundEvents.set(eventKey, {
      element,
      eventType,
      handler: wrappedHandler
    });
  }

  _getEventKey(element, eventType) {
    const elementId = element.id || element.className || element.tagName;
    return `${elementId}_${eventType}`;
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
    const eventKey = this._getEventKey(element, eventType);
    const bound = this.boundEvents.get(eventKey);

    if (bound) {
      bound.element.removeEventListener(bound.eventType, bound.handler);
      this.boundEvents.delete(eventKey);
    }
  }

  unbindAll(element) {
    if (!element) return;

    const elementId = element.id || element.className || element.tagName;

    for (const [key, bound] of this.boundEvents.entries()) {
      if (key.startsWith(elementId)) {
        bound.element.removeEventListener(bound.eventType, bound.handler);
        this.boundEvents.delete(key);
      }
    }
  }

  unbindAllGlobal() {
    for (const [key, bound] of this.boundEvents.entries()) {
      bound.element.removeEventListener(bound.eventType, bound.handler);
    }
    this.boundEvents.clear();
  }
}
