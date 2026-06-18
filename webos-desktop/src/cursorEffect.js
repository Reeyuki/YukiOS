import { StorageKeys } from "./StorageKeys.js";
import { os } from "./os/index.js";
import { BusEvents } from "./core/EventBusConstants.js";

let container = null;
let active = false;
let mouseX = 0;
let mouseY = 0;
let hideTimeout = null;
let triggerTime = 0;
const X_OFFSET = 35;
const Y_OFFSET = 55;
const FALLBACK_DELAY = 4000;
const MIN_VISIBLE = 600;
const DEFAULT_ICON = "fa-solid fa-cube";

function getEnabled() {
  return os.storage.get(StorageKeys.cursorEffectEnabled) !== "false";
}

function isFontAwesome(icon) {
  return /^(fa[sbordl]?|fa-)/.test(icon);
}

function applySettings() {
  const speed = 0.5;
  const amp = 0.4;
  const elasticity = 0.3;
  const dampening = 0.3;
  const squash = 0.8;
  const shake = 0;

  const dur = (1.4 - speed * 1.0).toFixed(2) + "s";
  const rise = -Math.round(12 + amp * 38) + "px";
  const rise2 = -Math.round((12 + amp * 38) * (0.3 + dampening * 0.4)) + "px";
  const overshoot = 0.9 + elasticity * 0.55;
  const sxUp = (1 - squash * 0.18).toFixed(3);
  const syUp = (1 + squash * 0.45 * overshoot).toFixed(3);
  const sxDn = (1 + squash * 0.14).toFixed(3);
  const syDn = (1 - squash * 0.28).toFixed(3);
  const sxUp2 = (1 - squash * 0.09).toFixed(3);
  const syUp2 = (1 + squash * 0.22 * overshoot).toFixed(3);
  const shakeAngle = (shake * 8).toFixed(1) + "deg";
  const easeStr = ".34," + (1 + elasticity * 0.6).toFixed(2) + ",.64,1";

  container.style.setProperty("--dur", dur);
  container.style.setProperty("--rise", rise);
  container.style.setProperty("--rise2", rise2);
  container.style.setProperty("--sx-up", sxUp);
  container.style.setProperty("--sy-up", syUp);
  container.style.setProperty("--sx-dn", sxDn);
  container.style.setProperty("--sy-dn", syDn);
  container.style.setProperty("--sx-up2", sxUp2);
  container.style.setProperty("--sy-up2", syUp2);
  container.style.setProperty("--shake", shakeAngle);
  container.style.setProperty("--ease", easeStr);
}

function createContainer() {
  if (container) return;
  container = document.createElement("div");
  container.id = "cursor-effect";
  document.body.appendChild(container);
  applySettings();
}

function handleWindowCreated() {
  if (!active) return;
  const elapsed = Date.now() - triggerTime;
  const remaining = Math.max(0, MIN_VISIBLE - elapsed);
  clearTimeout(hideTimeout);
  hideTimeout = setTimeout(hide, remaining);
}

export function init() {
  createContainer();
  document.addEventListener("mousemove", (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    if (active && container) {
      container.style.left = mouseX + X_OFFSET + "px";
      container.style.top = mouseY + Y_OFFSET + "px";
    }
  });
  os.events.on(BusEvents.WINDOW_CREATED, handleWindowCreated);
}

export function trigger(icon) {
  if (!getEnabled()) return;
  createContainer();
  active = true;
  triggerTime = Date.now();
  container.style.display = "";
  container.innerHTML = "";
  const iconClass = icon || DEFAULT_ICON;
  let el;
  if (isFontAwesome(iconClass)) {
    el = document.createElement("i");
    el.className = "effect-icon " + iconClass;
  } else {
    el = document.createElement("img");
    el.className = "effect-icon";
    el.src = iconClass;
    el.draggable = false;
  }
  container.appendChild(el);
  container.style.left = mouseX + X_OFFSET + "px";
  container.style.top = mouseY + Y_OFFSET + "px";
  clearTimeout(hideTimeout);
  hideTimeout = setTimeout(hide, FALLBACK_DELAY);
}

export function hide() {
  active = false;
  triggerTime = 0;
  if (container) {
    container.innerHTML = "";
    container.style.display = "none";
  }
  clearTimeout(hideTimeout);
}
