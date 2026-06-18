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
    if (style) Object.assign(button.style, style);
    if (disabled) button.disabled = true;
    if (onClick) button.addEventListener("click", onClick);
    return button;
  },

  Input(props) {
    const { type = "text", placeholder, value, onChange, className, style, disabled } = props;
    const input = document.createElement("input");
    input.type = type;
    input.placeholder = placeholder || "";
    input.value = value || "";
    if (className) input.className = className;
    if (style) Object.assign(input.style, style);
    if (disabled) input.disabled = true;
    if (onChange) input.addEventListener("input", onChange);
    return input;
  },

  Select(props) {
    const { options, value, onChange, className, style, disabled } = props;
    const select = document.createElement("select");
    if (className) select.className = className;
    if (style) Object.assign(select.style, style);
    if (disabled) select.disabled = true;
    if (options) {
      options.forEach((opt) => {
        const option = document.createElement("option");
        option.value = opt.value;
        option.textContent = opt.label;
        if (opt.value === value) option.selected = true;
        select.appendChild(option);
      });
    }
    if (onChange) select.addEventListener("change", onChange);
    return select;
  }
};
