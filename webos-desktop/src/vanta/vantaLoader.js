import { createElement } from "../shared/domUtils.js";

const CDN_THREE = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.min.js";
const CDN_VANTA = "https://cdn.jsdelivr.net/npm/vanta@0.5.24/dist/vanta";

const EFFECT_FILES = {
  WAVES: "waves",
  BIRDS: "birds",
  NET: "net",
  DOTS: "dots",
  GLOBE: "globe",
  HALO: "halo",
  FOG: "fog",
  CELLS: "cells"
};

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

export async function loadVantaEffect(effectName) {
  const effectFile = EFFECT_FILES[effectName];
  if (!effectFile) throw new Error(`Unknown Vanta effect: ${effectName}`);

  if (!window.THREE) {
    await loadScript(CDN_THREE);
  }
  await loadScript(`${CDN_VANTA}.${effectFile}.min.js`);
  return window.VANTA?.[effectName];
}
