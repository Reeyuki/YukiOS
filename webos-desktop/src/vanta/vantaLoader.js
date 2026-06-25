let threeLoaded = false;

const EFFECT_LOADERS = {
  WAVES: () => import("vanta/dist/vanta.waves.min.js"),
  BIRDS: () => import("vanta/dist/vanta.birds.min.js"),
  NET: () => import("vanta/dist/vanta.net.min.js"),
  DOTS: () => import("vanta/dist/vanta.dots.min.js"),
  GLOBE: () => import("vanta/dist/vanta.globe.min.js"),
  HALO: () => import("vanta/dist/vanta.halo.min.js"),
  FOG: () => import("vanta/dist/vanta.fog.min.js"),
  CELLS: () => import("vanta/dist/vanta.cells.min.js")
};

export async function loadVantaEffect(effectName) {
  if (!threeLoaded) {
    const THREE = await import("three");
    window.THREE = window.THREE || THREE;
    threeLoaded = true;
  }
  const loader = EFFECT_LOADERS[effectName];
  if (!loader) throw new Error(`Unknown Vanta effect: ${effectName}`);
  await loader();
  return window.VANTA?.[effectName];
}
