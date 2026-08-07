import { $, bindEvent, toggleClass } from "../shared/domUtils.js";
import { KeybindManager } from "../keybindManager.js";

let activeSlider = null;

export function renderRangeSlider(id, min, max, step, value, disabled = false) {
  const pct = ((value - min) / (max - min)) * 100;
  return `<div class="range-slider${disabled ? " range-slider--disabled" : ""}" id="${id}" data-min="${min}" data-max="${max}" data-step="${step}" data-value="${value}" tabindex="0" role="slider" aria-valuemin="${min}" aria-valuemax="${max}" aria-valuenow="${value}">
    <div class="range-slider__track">
      <div class="range-slider__fill" style="width: ${pct}%"></div>
      <div class="range-slider__thumb" style="left: ${pct}%"></div>
    </div>
  </div>`;
}

export function getRangeSliderValue(id, root = document) {
  const el = $(`#${id}`, root);
  return el ? Number(el.dataset.value) : 0;
}

export function setRangeSliderValue(id, value, root = document) {
  const el = $(`#${id}`, root);
  if (!el) return;
  const min = Number(el.dataset.min);
  const max = Number(el.dataset.max);
  const step = Number(el.dataset.step);
  const clamped = clampValue(value, min, max, step);
  el.dataset.value = String(clamped);
  el.setAttribute("aria-valuenow", String(clamped));
  const pct = ((clamped - min) / (max - min)) * 100;
  const fill = $(".range-slider__fill", el);
  const thumb = $(".range-slider__thumb", el);
  if (fill) fill.style.width = `${pct}%`;
  if (thumb) thumb.style.left = `${pct}%`;
}

function clampValue(value, min, max, step) {
  let v = Number(value);
  if (isNaN(v)) v = min;
  v = Math.round((v - min) / step) * step + min;
  return Math.max(min, Math.min(max, v));
}

function sliderValueFromEvent(slider, clientX) {
  const track = $(".range-slider__track", slider);
  if (!track) return 0;
  const rect = track.getBoundingClientRect();
  const min = Number(slider.dataset.min);
  const max = Number(slider.dataset.max);
  const step = Number(slider.dataset.step);
  let pct = (clientX - rect.left) / rect.width;
  pct = Math.max(0, Math.min(1, pct));
  return clampValue(min + pct * (max - min), min, max, step);
}

function updateSliderValue(slider, value, dispatch = true) {
  const min = Number(slider.dataset.min);
  const max = Number(slider.dataset.max);
  const step = Number(slider.dataset.step);
  const clamped = clampValue(value, min, max, step);
  const prev = Number(slider.dataset.value);
  slider.dataset.value = String(clamped);
  slider.setAttribute("aria-valuenow", String(clamped));
  const pct = ((clamped - min) / (max - min)) * 100;
  const fill = $(".range-slider__fill", slider);
  const thumb = $(".range-slider__thumb", slider);
  if (fill) fill.style.width = `${pct}%`;
  if (thumb) thumb.style.left = `${pct}%`;
  if (dispatch && clamped !== prev) {
    slider.dispatchEvent(new CustomEvent("input", { bubbles: true }));
  }
}

export function bindRangeSlider(root = document) {
  bindEvent(root, "mousedown", (e) => {
    const slider = e.target.closest(".range-slider:not(.range-slider--disabled)");
    if (!slider) return;
    if (e.target.closest(".range-slider__thumb") || e.target.closest(".range-slider__track")) {
      activeSlider = slider;
      const value = sliderValueFromEvent(slider, e.clientX);
      updateSliderValue(slider, value, true);
      e.preventDefault();
    }
  });

  bindEvent(document, "mousemove", (e) => {
    if (!activeSlider) return;
    const value = sliderValueFromEvent(activeSlider, e.clientX);
    updateSliderValue(activeSlider, value, true);
  });

  bindEvent(document, "mouseup", () => {
    if (activeSlider) {
      activeSlider.dispatchEvent(new CustomEvent("change", { bubbles: true }));
      activeSlider = null;
    }
  });

  bindEvent(root, "keydown", (e) => {
    const slider = e.target.closest(".range-slider:not(.range-slider--disabled)");
    if (!slider) return;
    const min = Number(slider.dataset.min);
    const max = Number(slider.dataset.max);
    const step = Number(slider.dataset.step);
    const current = Number(slider.dataset.value);
    let newVal = current;
    if (KeybindManager.matches(e, "rangeSlider.increment") || e.key === "ArrowUp") {
      newVal = Math.min(max, current + step);
      e.preventDefault();
    } else if (KeybindManager.matches(e, "rangeSlider.decrement") || e.key === "ArrowDown") {
      newVal = Math.max(min, current - step);
      e.preventDefault();
    } else if (KeybindManager.matches(e, "rangeSlider.min")) {
      newVal = min;
      e.preventDefault();
    } else if (KeybindManager.matches(e, "rangeSlider.max")) {
      newVal = max;
      e.preventDefault();
    }
    if (newVal !== current) {
      updateSliderValue(slider, newVal, true);
      slider.dispatchEvent(new CustomEvent("change", { bubbles: true }));
    }
  });
}
