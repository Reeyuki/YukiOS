export const CORE_EXTENSIONS = {
  gba: ["gba", "gb", "gbc"],
  nds: ["nds"],
  nes: ["nes"],
  snes: ["smc", "sfc", "snes"],
  n64: ["n64", "z64", "v64"],
  psx: ["bin", "cue", "img", "pbp", "iso"],
  psp: ["iso", "cso"],
  segaMD: ["gen", "smd"],
  segaGG: ["gg"],
  segaMS: ["sms"]
};

export const EXT_TO_CORE = {};
for (const [core, exts] of Object.entries(CORE_EXTENSIONS)) {
  for (const ext of exts) {
    EXT_TO_CORE[ext] = core;
  }
}

export function detectCore(fileName) {
  const ext = fileName.split(".").pop().toLowerCase();
  return EXT_TO_CORE[ext] || "gba";
}

export function coreLabel(core) {
  const labels = {
    gba: "Game Boy Advance",
    nds: "Nintendo DS",
    nes: "NES",
    snes: "Super Nintendo",
    n64: "Nintendo 64",
    psx: "PlayStation",
    psp: "PSP",
    segaMD: "Sega Mega Drive",
    segaGG: "Game Gear",
    segaMS: "Master System"
  };
  return labels[core] || core.toUpperCase();
}

export const ROM_EXTS = Object.values(CORE_EXTENSIONS).flat();
