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
    name: "Birds - Dark",
    effect: "BIRDS",
    options: {
      color1: 0x1e1e1e,
      color2: 0x4a00e0,
      birdSize: 1,
      wingSpan: 20,
      speedLimit: 4,
      separation: 20,
      alignment: 20,
      cohesion: 20,
      quantity: 3
    },
    previewStyle: {
      background:
        "radial-gradient(circle at 30% 30%, #4a00e0 0%, transparent 20%), radial-gradient(circle at 70% 60%, #1e1e1e 0%, transparent 15%), radial-gradient(circle at 50% 80%, #4a00e0 0%, transparent 18%), #0a0a0a",
      animation: "birdsPreview 4s ease-in-out infinite"
    }
  },
  {
    id: 3,
    name: "Birds - Light",
    effect: "BIRDS",
    options: {
      color1: 0xffffff,
      color2: 0x4a00e0,
      birdSize: 1,
      wingSpan: 20,
      speedLimit: 4,
      separation: 20,
      alignment: 20,
      cohesion: 20,
      quantity: 3
    },
    previewStyle: {
      background:
        "radial-gradient(circle at 30% 30%, #ffffff 0%, transparent 20%), radial-gradient(circle at 70% 60%, #4a00e0 0%, transparent 15%), radial-gradient(circle at 50% 80%, #ffffff 0%, transparent 18%), #1a1a2e",
      animation: "birdsPreview 4s ease-in-out infinite"
    }
  },
  {
    id: 4,
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
    id: 5,
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
    id: 6,
    name: "Dots - Blue",
    effect: "DOTS",
    options: {
      color: 0x1e1e1e,
      color2: 0x4a00e0,
      size: 2.5,
      spacing: 40
    },
    previewStyle: {
      background:
        "radial-gradient(circle, #1e1e1e 2px, transparent 2px), radial-gradient(circle, #4a00e0 2px, transparent 2px)",
      backgroundSize: "20px 20px, 30px 30px",
      backgroundPosition: "0 0, 10px 10px",
      backgroundColor: "#0a0a0a",
      animation: "dotsPreview 2s ease-in-out infinite"
    }
  },
  {
    id: 7,
    name: "Dots - Purple",
    effect: "DOTS",
    options: {
      color: 0x4a00e0,
      color2: 0x1e1e1e,
      size: 2.5,
      spacing: 40
    },
    previewStyle: {
      background:
        "radial-gradient(circle, #4a00e0 2px, transparent 2px), radial-gradient(circle, #1e1e1e 2px, transparent 2px)",
      backgroundSize: "20px 20px, 30px 30px",
      backgroundPosition: "0 0, 10px 10px",
      backgroundColor: "#0a0a0a",
      animation: "dotsPreview 2s ease-in-out infinite"
    }
  },
  {
    id: 8,
    name: "Globe - Blue",
    effect: "GLOBE",
    options: {
      color: 0x1e1e1e,
      color2: 0x4a00e0,
      size: 1.2,
      deviation: 200
    },
    previewStyle: {
      background: "radial-gradient(circle at 50% 50%, #4a00e0 0%, #1e1e1e 40%, #0a0a0a 100%)",
      animation: "globePreview 5s linear infinite"
    }
  },
  {
    id: 9,
    name: "Globe - Purple",
    effect: "GLOBE",
    options: {
      color: 0x4a00e0,
      color2: 0x1e1e1e,
      size: 1.2,
      deviation: 200
    },
    previewStyle: {
      background: "radial-gradient(circle at 50% 50%, #1e1e1e 0%, #4a00e0 40%, #0a0a0a 100%)",
      animation: "globePreview 5s linear infinite"
    }
  },
  {
    id: 10,
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
    id: 11,
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
    id: 12,
    name: "Fog - Blue",
    effect: "FOG",
    options: {
      color: 0x1e1e1e,
      highlightColor: 0x4a00e0,
      midColor: 0x2a2a2a,
      lowColor: 0x0a0a0a,
      blurFactor: 0.05,
      speed: 1
    },
    previewStyle: {
      background: "linear-gradient(180deg, #0a0a0a 0%, #1e1e1e 30%, #4a00e0 50%, #2a2a2a 70%, #0a0a0a 100%)",
      animation: "fogPreview 8s ease-in-out infinite"
    }
  },
  {
    id: 13,
    name: "Fog - Purple",
    effect: "FOG",
    options: {
      color: 0x4a00e0,
      highlightColor: 0x1e1e1e,
      midColor: 0x2a2a2a,
      lowColor: 0x0a0a0a,
      blurFactor: 0.05,
      speed: 1
    },
    previewStyle: {
      background: "linear-gradient(180deg, #0a0a0a 0%, #4a00e0 30%, #1e1e1e 50%, #2a2a2a 70%, #0a0a0a 100%)",
      animation: "fogPreview 8s ease-in-out infinite"
    }
  },
  {
    id: 16,
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
    id: 17,
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
