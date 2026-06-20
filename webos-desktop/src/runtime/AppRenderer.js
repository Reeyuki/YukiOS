import { AppSchemaTypes } from "./AppSchema.js";
import { UIComponents } from "./UIComponents.js";

export class AppRenderer {
  constructor(windowHelper, stateManager, actionExecutor = null) {
    this.windowHelper = windowHelper;
    this.stateManager = stateManager;
    this.actionExecutor = actionExecutor;
    this.componentRegistry = new Map();
    this._registerBuiltInComponents();
  }

  _registerBuiltInComponents() {
    Object.entries(UIComponents).forEach(([name, component]) => {
      this.registerComponent(name, component);
    });
  }

  renderWindow(windowConfig, services) {
    const { id, title, size, icon, position, style, className, ui, events, actions, transparent, externalUrl } =
      windowConfig;

    const width = size?.[0] || "800px";
    const height = size?.[1] || "600px";

    const windowOptions = {
      icon,
      externalUrl,
      style: { ...style },
      ...(position && { left: position[0], top: position[1] }),
      ...(className && { className }),
      ...(transparent && { className: `${className || ""} transparent`.trim() })
    };

    const content = this.renderUI(ui, id);

    const win = this.windowHelper.createAndMountWindow(id, title, content, width, height, windowOptions);

    return win;
  }

  renderUI(uiSchema, windowId) {
    if (!uiSchema) {
      return document.createElement("div");
    }

    if (typeof uiSchema === "string") {
      return uiSchema;
    }

    if (Array.isArray(uiSchema)) {
      const fragment = document.createDocumentFragment();
      uiSchema.forEach((child) => {
        const rendered = this.renderUI(child, windowId);
        if (rendered instanceof Node) {
          fragment.appendChild(rendered);
        }
      });
      return fragment;
    }

    const { type, tag, props, children, events, ref, if: condition, text } = uiSchema;

    if (condition === false) {
      return document.createDocumentFragment();
    }

    if (type === AppSchemaTypes.TEXT) {
      return document.createTextNode(text || "");
    }

    if (type === AppSchemaTypes.FRAGMENT) {
      const fragment = document.createDocumentFragment();
      if (children) {
        const renderedChildren = this.renderUI(children, windowId);
        if (renderedChildren instanceof Node) {
          fragment.appendChild(renderedChildren);
        } else if (Array.isArray(renderedChildren)) {
          renderedChildren.forEach((child) => {
            if (child instanceof Node) {
              fragment.appendChild(child);
            }
          });
        }
      }
      return fragment;
    }

    if (type === AppSchemaTypes.COMPONENT) {
      const component = this.componentRegistry.get(tag);
      if (component) {
        return component({ props, children, state: this.stateManager.state, windowId });
      }
      console.warn(`Component not found: ${tag}`);
      return document.createElement("div");
    }

    const tagName = tag || "div";
    const element = document.createElement(tagName);

    if (props) {
      this._applyProps(element, props);
    }

    if (text) {
      element.textContent = text;
    } else if (children) {
      const renderedChildren = this.renderUI(children, windowId);
      if (renderedChildren instanceof Node) {
        element.appendChild(renderedChildren);
      } else if (Array.isArray(renderedChildren)) {
        renderedChildren.forEach((child) => {
          if (child instanceof Node) {
            element.appendChild(child);
          }
        });
      } else if (typeof renderedChildren === "string") {
        element.textContent = renderedChildren;
      }
    }

    if (ref) {
      if (typeof ref === "function") {
        ref(element);
      } else if (typeof ref === "string") {
        element.id = ref;
      }
    }

    if (events) {
      this._bindElementEvents(element, events);
    }

    return element;
  }

  _applyProps(element, props) {
    Object.entries(props).forEach(([key, value]) => {
      if (key === "className") {
        element.className = value;
      } else if (key === "style") {
        if (typeof value === "string") {
          element.style.cssText = value;
        } else if (typeof value === "object") {
          Object.assign(element.style, value);
        }
      } else if (key === "dataset") {
        Object.entries(value).forEach(([dataKey, dataValue]) => {
          element.dataset[dataKey] = dataValue;
        });
      } else if (key.startsWith("on")) {
        const eventType = key.substring(2).toLowerCase();
        if (typeof value === "function") {
          element.addEventListener(eventType, value);
        }
      } else if (key in element) {
        element[key] = value;
      } else {
        element.setAttribute(key, value);
      }
    });
  }

  registerComponent(name, component) {
    this.componentRegistry.set(name, component);
  }

  unregisterComponent(name) {
    this.componentRegistry.delete(name);
  }

  _bindElementEvents(element, events) {
    if (!this.actionExecutor) return;

    Object.entries(events).forEach(([eventType, handler]) => {
      const wrappedHandler = (event) => {
        if (typeof handler === "function") {
          handler(event, this.stateManager.state, element);
        } else if (typeof handler === "object") {
          const { type, payload, stopPropagation, preventDefault } = handler;
          if (stopPropagation) event.stopPropagation();
          if (preventDefault) event.preventDefault();
          this.actionExecutor.execute(type, payload, event, element);
        }
      };
      element.addEventListener(eventType, wrappedHandler);
    });
  }
}
