export const vantaPresets = [
  {
    id: 0,
    name: "Waves - Blue",
    effect: "WAVES",
    options: {
      color: 0x1e1e1e,
      shininess: 50,
      waveHeight: 20,
      waveSpeed: 1,
      zoom: 0.75
    },
    previewStyle: {
      background: "linear-gradient(180deg, #1e1e1e 0%, #2a2a2a 50%, #1e1e1e 100%)",
      animation: "wavePreview 3s ease-in-out infinite"
    }
  },
  {
    id: 1,
    name: "Waves - Purple",
    effect: "WAVES",
    options: {
      color: 0x4a00e0,
      shininess: 50,
      waveHeight: 20,
      waveSpeed: 1,
      zoom: 0.75
    },
    previewStyle: {
      background: "linear-gradient(180deg, #4a00e0 0%, #6a20ff 50%, #4a00e0 100%)",
      animation: "wavePreview 3s ease-in-out infinite"
    }
  },
  {
    id: 2,
    name: "Net - Blue",
    effect: "NET",
    options: {
      color: 0x1e1e1e,
      backgroundColor: 0x0a0a0a,
      points: 10,
      distance: 18,
      spacing: 18
    },
    previewStyle: {
      background:
        "linear-gradient(45deg, #1e1e1e 25%, transparent 25%), linear-gradient(-45deg, #1e1e1e 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1e1e1e 75%), linear-gradient(-45deg, transparent 75%, #1e1e1e 75%)",
      backgroundSize: "20px 20px",
      backgroundColor: "#0a0a0a"
    }
  },
  {
    id: 3,
    name: "Net - Purple",
    effect: "NET",
    options: {
      color: 0x4a00e0,
      backgroundColor: 0x0a0a0a,
      points: 10,
      distance: 18,
      spacing: 18
    },
    previewStyle: {
      background:
        "linear-gradient(45deg, #4a00e0 25%, transparent 25%), linear-gradient(-45deg, #4a00e0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #4a00e0 75%), linear-gradient(-45deg, transparent 75%, #4a00e0 75%)",
      backgroundSize: "20px 20px",
      backgroundColor: "#0a0a0a"
    }
  },
  {
    id: 4,
    name: "Halo - Blue",
    effect: "HALO",
    options: {
      color: 0x1e1e1e,
      backgroundColor: 0x0a0a0a,
      size: 1.5
    },
    previewStyle: {
      background:
        "radial-gradient(circle at 50% 50%, transparent 30%, #1e1e1e 35%, transparent 40%, #1e1e1e 50%, transparent 55%, #1e1e1e 65%, transparent 70%)",
      backgroundColor: "#0a0a0a",
      animation: "haloPreview 3s ease-in-out infinite"
    }
  },
  {
    id: 5,
    name: "Halo - Purple",
    effect: "HALO",
    options: {
      color: 0x4a00e0,
      backgroundColor: 0x0a0a0a,
      size: 1.5
    },
    previewStyle: {
      background:
        "radial-gradient(circle at 50% 50%, transparent 30%, #4a00e0 35%, transparent 40%, #4a00e0 50%, transparent 55%, #4a00e0 65%, transparent 70%)",
      backgroundColor: "#0a0a0a",
      animation: "haloPreview 3s ease-in-out infinite"
    }
  },
  {
    id: 6,
    name: "Cells - Blue",
    effect: "CELLS",
    options: {
      color: 0x1e1e1e,
      color2: 0x4a00e0,
      size: 1.5,
      speed: 1
    },
    previewStyle: {
      background:
        "radial-gradient(circle at 50% 50%, #4a00e0 0%, transparent 50%), radial-gradient(circle at 0% 0%, #1e1e1e 0%, transparent 50%), radial-gradient(circle at 100% 0%, #1e1e1e 0%, transparent 50%), radial-gradient(circle at 0% 100%, #1e1e1e 0%, transparent 50%), radial-gradient(circle at 100% 100%, #1e1e1e 0%, transparent 50%)",
      backgroundSize: "50% 50%",
      backgroundColor: "#0a0a0a",
      animation: "cellsPreview 6s ease-in-out infinite"
    }
  },
  {
    id: 7,
    name: "Cells - Purple",
    effect: "CELLS",
    options: {
      color: 0x4a00e0,
      color2: 0x1e1e1e,
      size: 1.5,
      speed: 1
    },
    previewStyle: {
      background:
        "radial-gradient(circle at 50% 50%, #1e1e1e 0%, transparent 50%), radial-gradient(circle at 0% 0%, #4a00e0 0%, transparent 50%), radial-gradient(circle at 100% 0%, #4a00e0 0%, transparent 50%), radial-gradient(circle at 0% 100%, #4a00e0 0%, transparent 50%), radial-gradient(circle at 100% 100%, #4a00e0 0%, transparent 50%)",
      backgroundSize: "50% 50%",
      backgroundColor: "#0a0a0a",
      animation: "cellsPreview 6s ease-in-out infinite"
    }
  }
];

export function getVantaPresetById(id) {
  return vantaPresets.find((preset) => preset.id === id);
}
