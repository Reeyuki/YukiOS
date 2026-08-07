import { createElement } from "./shared/domUtils.js";

const current = {
  id: "current",
  label: "Current",
  createExtra: () => null,
  setup: (els) => {
    const g = window.gsap;
    g.set(els.overlay, { opacity: 0 });
    g.set(els.logo, { opacity: 0, scale: 0.5 });
    g.set(els.letters, { opacity: 0, y: 16 });
    g.set(els.version, { opacity: 0 });
  },
  show: (tl, els) => {
    tl.to(els.overlay, { opacity: 1, duration: 0.3, ease: "power2.out" })
      .to(els.logo, { opacity: 1, scale: 1, duration: 0.6, ease: "back.out(1.4)" }, "-=0.1")
      .to(els.letters, { opacity: 1, y: 0, duration: 0.4, stagger: 0.07, ease: "power2.out" }, "-=0.3")
      .to(els.version, { opacity: 1, duration: 0.35, ease: "power2.out" }, "-=0.15");
  },
  hide: (tl, els) => {
    tl.to(els.letters, { opacity: 0, y: -12, duration: 0.15, stagger: 0.03, ease: "power2.in" })
      .to(els.logo, { opacity: 0, scale: 0.6, duration: 0.15, ease: "power2.in" }, "-=0.1")
      .to(els.overlay, { opacity: 0, scale: 1.04, duration: 0.35, ease: "power2.inOut" }, "-=0.1");
  }
};

const digitalScan = {
  id: "digitalScan",
  label: "Digital Scan",
  createExtra: (overlay) => {
    const sl = createElement("div");
    sl.className = "boot-scanline";
    overlay.appendChild(sl);
    return { scanline: sl };
  },
  setup: (els) => {
    const g = window.gsap;
    const { scanline } = els.extEls;
    g.set(els.overlay, { opacity: 0 });
    g.set(scanline, { top: "-3px", opacity: 1 });
    g.set(els.logo, { opacity: 0, y: -8, scale: 0.5 });
    g.set(els.letters, { opacity: 0 });
    g.set(els.version, { opacity: 0 });
  },
  show: (tl, els) => {
    const { scanline } = els.extEls;
    tl.to(els.overlay, { opacity: 1, duration: 0.2, ease: "power2.out" })
      .to(scanline, { top: "100%", duration: 0.9, ease: "power2.inOut" }, "-=0.1")
      .to(els.logo, { opacity: 1, y: 0, scale: 1, duration: 0.4, ease: "power2.out" }, "-=0.6")
      .to(els.letters, { opacity: 1, duration: 0.35, stagger: 0.06, ease: "power2.out" }, "-=0.3")
      .to(els.version, { opacity: 1, duration: 0.3 }, "-=0.1");
  },
  hide: (tl, els) => {
    const { scanline } = els.extEls;
    window.gsap.set(scanline, { top: "100%", opacity: 1 });
    tl.to(scanline, { top: "110%", duration: 0.15, ease: "power2.in" })
      .to(els.letters, { opacity: 0, duration: 0.1, stagger: 0.02, ease: "power2.in" }, "-=0.05")
      .to(els.logo, { opacity: 0, duration: 0.1, ease: "power2.in" }, "-=0.08")
      .to(els.overlay, { opacity: 0, duration: 0.3, ease: "power2.inOut" }, "-=0.15");
  }
};

const orbitalConverge = {
  id: "orbitalConverge",
  label: "Orbital Converge",
  createExtra: (overlay) => {
    const wrap = overlay.querySelector(".boot-logo-wrap");
    const pc = createElement("div");
    pc.className = "boot-particles-container";
    wrap.prepend(pc);

    const count = 16;
    const particles = [];
    for (let i = 0; i < count; i++) {
      const el = createElement("div");
      el.className = "boot-particle";
      pc.appendChild(el);
      particles.push(el);
    }
    return { particlesContainer: pc, particles };
  },
  setup: (els) => {
    const g = window.gsap;
    const { particles } = els.extEls;
    const count = particles.length;
    g.set(els.overlay, { opacity: 0 });
    g.set(particles, {
      x: (i) => Math.cos((i / count) * Math.PI * 2) * 140,
      y: (i) => Math.sin((i / count) * Math.PI * 2) * 140,
      scale: 1,
      opacity: 0.9
    });
    g.set(els.logo, { opacity: 0, scale: 0.3 });
    g.set(els.letters, { opacity: 0, y: 20 });
    g.set(els.version, { opacity: 0 });
  },
  show: (tl, els) => {
    const { particles } = els.extEls;
    const count = particles.length;
    tl.to(els.overlay, { opacity: 1, duration: 0.3, ease: "power2.out" })
      .to(
        particles,
        {
          x: 0,
          y: 0,
          scale: 0,
          opacity: 0,
          duration: 1.1,
          stagger: 0.03,
          ease: "power4.in"
        },
        "-=0.1"
      )
      .to(
        els.logo,
        {
          opacity: 1,
          scale: 1,
          duration: 0.5,
          ease: "back.out(2.5)"
        },
        "-=0.4"
      )
      .to(els.letters, { opacity: 1, y: 0, duration: 0.35, stagger: 0.06, ease: "power2.out" }, "-=0.3")
      .to(els.version, { opacity: 1, duration: 0.3 }, "-=0.1");
  },
  hide: (tl, els) => {
    const { particles } = els.extEls;
    const count = particles.length;
    window.gsap.set(particles, { x: 0, y: 0, scale: 1, opacity: 1 });
    tl.to(els.letters, { opacity: 0, y: -15, duration: 0.15, stagger: 0.03, ease: "power2.in" })
      .to(els.logo, { opacity: 0, scale: 0.3, duration: 0.15, ease: "power2.in" }, "-=0.1")
      .to(
        particles,
        {
          x: (i) => Math.cos((i / count) * Math.PI * 2) * 200,
          y: (i) => Math.sin((i / count) * Math.PI * 2) * 200,
          scale: 0.3,
          opacity: 0,
          duration: 0.4,
          stagger: 0.02,
          ease: "power2.out"
        },
        "-=0.2"
      )
      .to(els.overlay, { opacity: 0, duration: 0.35 }, "-=0.3");
  }
};

const lightBeam = {
  id: "lightBeam",
  label: "Light Beam",
  createExtra: (overlay) => {
    const beam = createElement("div");
    beam.className = "boot-light-beam";
    overlay.appendChild(beam);
    return { beam };
  },
  setup: (els) => {
    const g = window.gsap;
    const { beam } = els.extEls;
    g.set(els.overlay, { opacity: 0 });
    g.set(beam, { left: "-80px", opacity: 1 });
    g.set(els.logo, { opacity: 0, scale: 0.5 });
    g.set(els.letters, { opacity: 0 });
    g.set(els.version, { opacity: 0 });
  },
  show: (tl, els) => {
    const { beam } = els.extEls;
    tl.to(els.overlay, { opacity: 1, duration: 0.3, ease: "power2.out" })
      .to(beam, { left: "100vw", duration: 0.7, ease: "power2.inOut" }, "-=0.1")
      .to(els.logo, { opacity: 1, scale: 1, duration: 0.3 }, "-=0.4")
      .to(els.letters, { opacity: 1, duration: 0.25, stagger: 0.05 }, "-=0.25")
      .to(els.version, { opacity: 1, duration: 0.25 }, "-=0.1")
      .to(beam, { opacity: 0, duration: 0.2 }, "-=0.1");
  },
  hide: (tl, els) => {
    const { beam } = els.extEls;
    tl.to(beam, { opacity: 1, duration: 0.05 })
      .to(beam, { left: "-80px", duration: 0.4, ease: "power2.in" })
      .to(els.letters, { opacity: 0, duration: 0.1, stagger: 0.02 }, "-=0.2")
      .to(els.logo, { opacity: 0, duration: 0.1 }, "-=0.1")
      .to(els.overlay, { opacity: 0, duration: 0.3 }, "-=0.15");
  }
};

const gravityDrop = {
  id: "gravityDrop",
  label: "Gravity Drop",
  createExtra: () => null,
  setup: (els) => {
    const g = window.gsap;
    g.set(els.overlay, { opacity: 0 });
    g.set(els.logo, { opacity: 0, y: -80, scale: 0.5 });
    g.set(els.letters, {
      opacity: 1,
      y: -120,
      rotation: (i) => (Math.random() - 0.5) * 30
    });
    g.set(els.version, { opacity: 0 });
  },
  show: (tl, els) => {
    tl.to(els.overlay, { opacity: 1, duration: 0.3, ease: "power2.out" })
      .to(
        els.letters,
        {
          y: 0,
          rotation: 0,
          duration: 0.8,
          stagger: 0.08,
          ease: "elastic.out(1, 0.4)"
        },
        "-=0.1"
      )
      .to(
        els.logo,
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.6,
          ease: "elastic.out(1, 0.35)"
        },
        "-=0.3"
      )
      .to(els.version, { opacity: 1, duration: 0.35 }, "-=0.15");
  },
  hide: (tl, els) => {
    tl.to(els.letters, {
      y: -60,
      opacity: 0,
      duration: 0.3,
      stagger: 0.03,
      ease: "power2.in"
    })
      .to(els.logo, { y: -40, opacity: 0, duration: 0.25 }, "-=0.2")
      .to(els.overlay, { opacity: 0, duration: 0.3 }, "-=0.2");
  }
};

const pixelate = {
  id: "pixelate",
  label: "Pixelate",
  createExtra: (overlay) => {
    const wrap = overlay.querySelector(".boot-logo-wrap");
    const grid = createElement("div");
    grid.className = "boot-pixel-grid";
    wrap.prepend(grid);

    const cols = 5;
    const rows = 5;
    const blocks = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const block = createElement("div");
        block.className = "boot-pixel-block";
        block.style.left = `${(c / cols) * 100}%`;
        block.style.top = `${(r / rows) * 100}%`;
        block.style.width = `${100 / cols}%`;
        block.style.height = `${100 / rows}%`;
        grid.appendChild(block);
        blocks.push(block);
      }
    }
    return { pixelGrid: grid, blocks };
  },
  setup: (els) => {
    const g = window.gsap;
    const { blocks } = els.extEls;
    g.set(els.overlay, { opacity: 0 });
    g.set(blocks, { scale: 1, opacity: 1 });
    g.set(els.logo, { opacity: 0, scale: 0.5 });
    g.set(els.letters, { opacity: 0 });
    g.set(els.version, { opacity: 0 });
  },
  show: (tl, els) => {
    const { blocks } = els.extEls;
    tl.to(els.overlay, { opacity: 1, duration: 0.3, ease: "power2.out" })
      .to(blocks, {
        scale: 0,
        opacity: 0,
        duration: 0.6,
        stagger: 0.02,
        ease: "power2.inOut"
      })
      .to(els.logo, { opacity: 1, scale: 1, duration: 0.4 }, "-=0.15")
      .to(els.letters, { opacity: 1, duration: 0.3, stagger: 0.05 }, "-=0.15")
      .to(els.version, { opacity: 1, duration: 0.3 }, "-=0.1");
  },
  hide: (tl, els) => {
    tl.to(els.letters, { opacity: 0, duration: 0.1, stagger: 0.02 }, "-=0.2")
      .to(els.logo, { opacity: 0, duration: 0.1 }, "-=0.1")
      .to(els.overlay, { opacity: 0, duration: 0.3 }, "-=0.15");
  }
};

const typewriter = {
  id: "typewriter",
  label: "Typewriter",
  createExtra: (overlay) => {
    const brand = overlay.querySelector(".boot-brand");
    const cursor = createElement("span");
    cursor.className = "boot-cursor";
    brand.appendChild(cursor);
    return { cursor };
  },
  setup: (els) => {
    const g = window.gsap;
    g.set(els.overlay, { opacity: 0 });
    g.set(els.logo, { opacity: 0, scale: 0.5, y: 12 });
    g.set(els.letters, {
      opacity: 0,
      scale: 0.7,
      y: 10
    });
    g.set(els.extEls.cursor, { opacity: 1 });
    g.set(els.version, { opacity: 0 });
  },
  show: (tl, els) => {
    const { cursor } = els.extEls;
    tl.to(els.overlay, { opacity: 1, duration: 0.3, ease: "power2.out" })
      .to(
        els.letters,
        {
          opacity: 1,
          scale: 1,
          y: 0,
          duration: 0.35,
          stagger: 0.12,
          ease: "back.out(1.7)"
        },
        "-=0.1"
      )
      .to(cursor, { opacity: 0, duration: 0.1 }, "+=0.15")
      .to(
        els.logo,
        {
          opacity: 1,
          scale: 1,
          y: 0,
          duration: 0.4,
          ease: "back.out(1.3)"
        },
        "-=0.1"
      )
      .to(els.version, { opacity: 1, duration: 0.3 }, "-=0.1");
  },
  hide: (tl, els) => {
    const { cursor } = els.extEls;
    tl.to(els.letters, {
      opacity: 0,
      scale: 0.6,
      y: -6,
      duration: 0.15,
      stagger: 0.04,
      ease: "power2.in"
    })
      .to(cursor, { opacity: 1, duration: 0.1 }, "-=0.2")
      .to(els.logo, { opacity: 0, scale: 0.6, y: -8, duration: 0.1 }, "-=0.1")
      .to(els.overlay, { opacity: 0, duration: 0.3 }, "-=0.15");
  }
};

export const BOOT_ANIMATIONS = [current, digitalScan, orbitalConverge, lightBeam, gravityDrop, pixelate, typewriter];

export function pickAnimation(preferredId) {
  if (preferredId) {
    const found = BOOT_ANIMATIONS.find((a) => a.id === preferredId);
    if (found) return found;
  }
  return BOOT_ANIMATIONS[Math.floor(Math.random() * BOOT_ANIMATIONS.length)];
}
