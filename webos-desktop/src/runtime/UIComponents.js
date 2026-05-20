import { AppSchemaTypes } from "./AppSchema.js";

export const UIComponents = {
  Button(props) {
    const { text, icon, onClick, className, style, disabled, variant = "primary" } = props;

    const button = document.createElement("button");
    button.className = `btn btn-${variant} ${className || ""}`;
    button.textContent = text;

    if (icon) {
      const iconSpan = document.createElement("i");
      iconSpan.className = icon;
      button.prepend(iconSpan);
      button.prepend(" ");
    }

    if (style) {
      Object.assign(button.style, style);
    }

    if (disabled) {
      button.disabled = true;
    }

    if (onClick) {
      button.addEventListener("click", onClick);
    }

    return button;
  },

  Input(props) {
    const { type = "text", placeholder, value, onChange, className, style, disabled } = props;

    const input = document.createElement("input");
    input.type = type;
    input.placeholder = placeholder || "";
    input.value = value || "";

    if (className) {
      input.className = className;
    }

    if (style) {
      Object.assign(input.style, style);
    }

    if (disabled) {
      input.disabled = true;
    }

    if (onChange) {
      input.addEventListener("input", onChange);
    }

    return input;
  },

  TextArea(props) {
    const { placeholder, value, onChange, className, style, disabled, rows = 4 } = props;

    const textarea = document.createElement("textarea");
    textarea.placeholder = placeholder || "";
    textarea.value = value || "";
    textarea.rows = rows;

    if (className) {
      textarea.className = className;
    }

    if (style) {
      Object.assign(textarea.style, style);
    }

    if (disabled) {
      textarea.disabled = true;
    }

    if (onChange) {
      textarea.addEventListener("input", onChange);
    }

    return textarea;
  },

  Select(props) {
    const { options, value, onChange, className, style, disabled } = props;

    const select = document.createElement("select");

    if (className) {
      select.className = className;
    }

    if (style) {
      Object.assign(select.style, style);
    }

    if (disabled) {
      select.disabled = true;
    }

    options.forEach((opt) => {
      const option = document.createElement("option");
      option.value = opt.value;
      option.textContent = opt.label;
      if (opt.value === value) {
        option.selected = true;
      }
      select.appendChild(option);
    });

    if (onChange) {
      select.addEventListener("change", onChange);
    }

    return select;
  },

  Checkbox(props) {
    const { label, checked, onChange, className, style, disabled } = props;

    const container = document.createElement("label");
    container.className = `checkbox-container ${className || ""}`;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = checked || false;

    if (disabled) {
      checkbox.disabled = true;
    }

    if (onChange) {
      checkbox.addEventListener("change", onChange);
    }

    const labelText = document.createElement("span");
    labelText.textContent = label || "";

    container.appendChild(checkbox);
    container.appendChild(labelText);

    if (style) {
      Object.assign(container.style, style);
    }

    return container;
  },

  Card(props) {
    const { title, children, className, style } = props;

    const card = document.createElement("div");
    card.className = `card ${className || ""}`;

    if (style) {
      Object.assign(card.style, style);
    }

    if (title) {
      const header = document.createElement("div");
      header.className = "card-header";
      header.textContent = title;
      card.appendChild(header);
    }

    const body = document.createElement("div");
    body.className = "card-body";

    if (typeof children === "string") {
      body.textContent = children;
    } else if (children instanceof Node) {
      body.appendChild(children);
    } else if (Array.isArray(children)) {
      children.forEach((child) => {
        if (child instanceof Node) {
          body.appendChild(child);
        }
      });
    }

    card.appendChild(body);

    return card;
  },

  Modal(props) {
    const { title, children, onClose, className, style } = props;

    const overlay = document.createElement("div");
    overlay.className = "explorer-confirmation-overlay";

    const modal = document.createElement("div");
    modal.className = `_fd-dialog ${className || ""}`;

    if (style) {
      Object.assign(modal.style, style);
    }

    if (title) {
      const header = document.createElement("div");
      header.className = "modal-header";
      header.textContent = title;
      modal.appendChild(header);
    }

    const body = document.createElement("div");
    body.className = "modal-body";

    if (typeof children === "string") {
      body.textContent = children;
    } else if (children instanceof Node) {
      body.appendChild(children);
    } else if (Array.isArray(children)) {
      children.forEach((child) => {
        if (child instanceof Node) {
          body.appendChild(child);
        }
      });
    }

    modal.appendChild(body);

    const closeBtn = document.createElement("button");
    closeBtn.className = "modal-close";
    closeBtn.textContent = "×";
    closeBtn.addEventListener("click", onClose);
    modal.appendChild(closeBtn);

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        onClose();
      }
    });

    overlay.appendChild(modal);

    return overlay;
  },

  List(props) {
    const { items, renderItem, className, style } = props;

    const list = document.createElement("ul");
    list.className = className || "";

    if (style) {
      Object.assign(list.style, style);
    }

    items.forEach((item, index) => {
      const li = document.createElement("li");
      const rendered = renderItem ? renderItem(item, index) : document.createTextNode(String(item));

      if (rendered instanceof Node) {
        li.appendChild(rendered);
      } else {
        li.textContent = String(rendered);
      }

      list.appendChild(li);
    });

    return list;
  },

  Icon(props) {
    const { name, className, style } = props;

    const icon = document.createElement("i");
    icon.className = `${name} ${className || ""}`;

    if (style) {
      Object.assign(icon.style, style);
    }

    return icon;
  },

  Container(props) {
    const { children, className, style } = props;

    const container = document.createElement("div");
    container.className = className || "";

    if (style) {
      Object.assign(container.style, style);
    }

    if (typeof children === "string") {
      container.textContent = children;
    } else if (children instanceof Node) {
      container.appendChild(children);
    } else if (Array.isArray(children)) {
      children.forEach((child) => {
        if (child instanceof Node) {
          container.appendChild(child);
        }
      });
    }

    return container;
  }
};
