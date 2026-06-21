import { $, bindEvent } from "../shared/domUtils.js";

let openSelect = null;

function closeAll() {
  if (openSelect) {
    openSelect.classList.remove("select-menu--open");
    openSelect = null;
  }
}

export function renderSelectMenu(id, options, currentValue, extraClass = "") {
  const selected = options.find((o) => o.value === currentValue) || options[0];
  const opts = options
    .map(
      (o) =>
        `<div class="select-menu__option${o.value === currentValue ? " selected" : ""}" data-value="${o.value}">${o.label}</div>`
    )
    .join("");
  return `<div class="select-menu ${extraClass}" id="${id}" tabindex="0">
    <div class="select-menu__trigger">
      <span class="select-menu__label">${selected ? selected.label : ""}</span>
      <i class="fas fa-chevron-down select-menu__arrow"></i>
    </div>
    <div class="select-menu__dropdown">${opts}</div>
  </div>`;
}

export function getSelectMenuValue(id, root = document) {
  const el = $(`#${id}`, root);
  return el ? el.dataset.value : null;
}

export function setSelectMenuValue(id, value, root = document) {
  const el = $(`#${id}`, root);
  if (!el) return;
  el.dataset.value = value;
  const label = $(".select-menu__label", el);
  const option = el.querySelector(`.select-menu__option[data-value="${value}"]`);
  if (label && option) {
    label.textContent = option.textContent;
  }
  el.querySelectorAll(".select-menu__option").forEach((o) => o.classList.toggle("selected", o.dataset.value === value));
}

export function bindSelectMenu(root = document) {
  bindEvent(root, "click", (e) => {
    const trigger = e.target.closest(".select-menu__trigger");
    if (!trigger) return;
    const select = trigger.closest(".select-menu");
    if (!select) return;

    e.stopPropagation();
    if (select.classList.contains("select-menu--open")) {
      select.classList.remove("select-menu--open");
      openSelect = null;
    } else {
      closeAll();
      select.classList.add("select-menu--open");
      openSelect = select;
      select.focus();
    }
  });

  bindEvent(root, "click", (e) => {
    const option = e.target.closest(".select-menu__option");
    if (!option) return;
    const select = option.closest(".select-menu");
    if (!select) return;

    const value = option.dataset.value;
    select.dataset.value = value;
    const label = $(".select-menu__label", select);
    if (label) label.textContent = option.textContent;
    select
      .querySelectorAll(".select-menu__option")
      .forEach((o) => o.classList.toggle("selected", o.dataset.value === value));
    select.classList.remove("select-menu--open");
    openSelect = null;
    select.dispatchEvent(new CustomEvent("change", { bubbles: true }));
  });
}

bindEvent(document, "click", (e) => {
  if (!e.target.closest(".select-menu")) closeAll();
});

bindEvent(document, "keydown", (e) => {
  if (!openSelect) return;
  if (e.key === "Escape") {
    closeAll();
    e.preventDefault();
    return;
  }
  const options = Array.from(openSelect.querySelectorAll(".select-menu__option"));
  const currentIdx = options.findIndex((o) => o.classList.contains("selected"));
  let nextIdx = currentIdx;
  if (e.key === "ArrowDown") {
    nextIdx = Math.min(currentIdx + 1, options.length - 1);
    e.preventDefault();
  } else if (e.key === "ArrowUp") {
    nextIdx = Math.max(currentIdx - 1, 0);
    e.preventDefault();
  } else if (e.key === "Enter" && currentIdx >= 0) {
    options[currentIdx].click();
    e.preventDefault();
    return;
  }
  if (nextIdx !== currentIdx && options[nextIdx]) {
    options.forEach((o) => o.classList.remove("selected"));
    options[nextIdx].classList.add("selected");
    options[nextIdx].scrollIntoView({ block: "nearest" });
    const select = openSelect;
    select.dataset.value = options[nextIdx].dataset.value;
    const label = $(".select-menu__label", select);
    if (label) label.textContent = options[nextIdx].textContent;
  }
});
