import { setColor, sc, poly, ell, circ, ln, arcOpen, getColors, gt } from "./fishRenderHelpers.js";
export function renderClownfish(ctx, f, wag, flash, t, s) {
  t = gt(t);
  s = s !== undefined ? s : f.size;
  const cols = getColors(f);
  const orange = cols[0];
  const white = cols[1];
  const bw = s * 0.32, bh = s * 0.32;
  const wave = Math.sin(t * 4 + f.phase) * s * 0.008;
  ctx.save(); ctx.translate(-bw * 0.6, 0); ctx.rotate(wag * 0.9);
  sc(ctx, orange);
  poly(ctx, "fill", [-s * 0.02, 0, -s * 0.24, -bh * 0.85, -s * 0.06, -bh * 0.15, -s * 0.06, bh * 0.15, -s * 0.24, bh * 0.85]);
  setColor(ctx, 0.05, 0.02, 0, 0.3); ctx.lineWidth = 1.2;
  poly(ctx, "line", [-s * 0.02, 0, -s * 0.24, -bh * 0.85, -s * 0.06, -bh * 0.15, -s * 0.06, bh * 0.15, -s * 0.24, bh * 0.85]);
  ctx.lineWidth = 1; ctx.restore();
  const dfWave = Math.sin(t * 5 + f.phase) * s * 0.004;
  sc(ctx, orange, 0.75); ctx.save(); ctx.translate(wave * 0.2, -bh * 0.78 + dfWave); ctx.rotate(-0.1);
  ell(ctx, "fill", 0, 0, s * 0.17, s * 0.065); ctx.restore();
  sc(ctx, orange, 0.6); ctx.save(); ctx.translate(wave * 0.1, bh * 0.75); ctx.rotate(0.1);
  ell(ctx, "fill", 0, 0, s * 0.1, s * 0.05); ctx.restore();
  const pf = Math.sin(t * 5 + f.phase) * 0.15;
  sc(ctx, orange, 0.7); ctx.save(); ctx.translate(bw * 0.02 + wave * 0.3, bh * 0.42); ctx.rotate(0.55 + pf);
  ell(ctx, "fill", 0, 0, s * 0.06, s * 0.11); ctx.restore();
  if (flash) setColor(ctx, 1, 1, 1, 0.9); else sc(ctx, orange);
  circ(ctx, "fill", wave, 0, bw);
  ell(ctx, "fill", wave * 0.6 + bw * 0.15, -bh * 0.35, bw * 0.62, bh * 0.55);
  const bandData = [{ x: bw * 0.42, wid: s * 0.06 }, { x: bw * 0.05, wid: s * 0.065 }, { x: -bw * 0.32, wid: s * 0.055 }];
  for (const bd of bandData) {
    const bx = bd.x + wave * 0.35;
    for (const sgn of [-1, 1]) {
      setColor(ctx, 0.05, 0.02, 0, 0.35);
      ell(ctx, "fill", bx + sgn * 1, 0, bd.wid, bh * 0.95);
    }
    sc(ctx, white);
    ell(ctx, "fill", bx, 0, bd.wid, bh * 0.88);
  }
  setColor(ctx, 1, 1, 1, 0.12);
  ell(ctx, "fill", wave * 0.4 + bw * 0.15, -bh * 0.4, bw * 0.35, bh * 0.22);
  const ex = bw * 0.5 + wave * 0.5, ey = -bh * 0.28;
  setColor(ctx, 0, 0, 0, 0.9); circ(ctx, "fill", ex, ey, s * 0.07);
  setColor(ctx, 1, 1, 1); circ(ctx, "fill", ex - s * 0.01, ey - s * 0.01, s * 0.033);
  setColor(ctx, 0, 0, 0); circ(ctx, "fill", ex - s * 0.01, ey - s * 0.01, s * 0.018);
  setColor(ctx, 1, 1, 1, 0.6); circ(ctx, "fill", ex - s * 0.026, ey - s * 0.026, s * 0.011);
  sc(ctx, orange, 0.4); ctx.lineWidth = 1; circ(ctx, "line", ex, ey, s * 0.07);
  setColor(ctx, 0.2, 0.08, 0.05, 0.5);
  arcOpen(ctx, bw * 0.75 + wave * 0.5, bh * 0.08, s * 0.028, 0.2, Math.PI - 0.2);
}
export function renderBluetang(ctx, f, wag, flash, t, s) {
  t = gt(t); s = s !== undefined ? s : f.size;
  const cols = getColors(f);
  const blue = cols[0], yellow = cols[1];
  const bw = s * 0.3, bh = s * 0.4;
  const wave = Math.sin(t * 4 + f.phase) * s * 0.008;
  ctx.save(); ctx.translate(-bw * 0.62, 0); ctx.rotate(wag * 0.9);
  sc(ctx, yellow);
  poly(ctx, "fill", [-s * 0.02, 0, -s * 0.3, -bh * 0.68, -s * 0.15, -bh * 0.1, -s * 0.15, bh * 0.1, -s * 0.3, bh * 0.68]);
  setColor(ctx, yellow[0] * 0.7, yellow[1] * 0.7, yellow[2] * 0.7, 0.4); ctx.lineWidth = 1.2;
  poly(ctx, "line", [-s * 0.02, 0, -s * 0.3, -bh * 0.68, -s * 0.15, -bh * 0.1, -s * 0.15, bh * 0.1, -s * 0.3, bh * 0.68]);
  ctx.lineWidth = 1; ctx.restore();
  const dfWave = Math.sin(t * 5 + f.phase) * s * 0.005;
  sc(ctx, blue, 0.8); ctx.save(); ctx.translate(wave * 0.15, -bh * 0.85 + dfWave); ctx.rotate(-0.08);
  ell(ctx, "fill", 0, 0, s * 0.2, s * 0.05); ctx.restore();
  sc(ctx, blue, 0.65); ctx.save(); ctx.translate(wave * 0.1, bh * 0.82); ctx.rotate(0.08);
  ell(ctx, "fill", 0, 0, s * 0.13, s * 0.04); ctx.restore();
  if (flash) setColor(ctx, 1, 1, 1, 0.9); else sc(ctx, blue);
  ell(ctx, "fill", wave, 0, bw, bh);
  setColor(ctx, 0.05, 0.05, 0.1, 0.65);
  poly(ctx, "fill", [-bw * 0.15 + wave * 0.2, -bh * 0.12, -bw * 0.62 + wave * 0.1, -bh * 0.62, -bw * 0.42 + wave * 0.1, 0, -bw * 0.62 + wave * 0.1, bh * 0.62, -bw * 0.15 + wave * 0.2, bh * 0.12]);
  setColor(ctx, 1, 1, 1, 0.14);
  ell(ctx, "fill", wave * 0.3 + bw * 0.1, -bh * 0.3, bw * 0.32, bh * 0.16);
  const pf = Math.sin(t * 4 + f.phase) * 0.2;
  sc(ctx, blue, 0.55); ctx.save(); ctx.translate(bw * 0.08 + wave * 0.3, bh * 0.4); ctx.rotate(0.3 + pf);
  ell(ctx, "fill", 0, 0, s * 0.05, s * 0.12); ctx.restore();
  const ex = bw * 0.5 + wave * 0.5, ey = -bh * 0.32;
  setColor(ctx, 0, 0, 0, 0.85); circ(ctx, "fill", ex, ey, s * 0.06);
  setColor(ctx, 1, 1, 1); circ(ctx, "fill", ex, ey, s * 0.032);
  setColor(ctx, 0.05, 0.05, 0.1); circ(ctx, "fill", ex + s * 0.01, ey, s * 0.018);
  setColor(ctx, 1, 1, 1, 0.7); circ(ctx, "fill", ex - s * 0.014, ey - s * 0.018, s * 0.009);
  sc(ctx, blue, 0.4); ctx.lineWidth = 1; circ(ctx, "line", ex, ey, s * 0.06);
  setColor(ctx, 0.1, 0.1, 0.2, 0.5); circ(ctx, "fill", bw * 0.72 + wave * 0.5, bh * 0.08, s * 0.018);
  sc(ctx, yellow, 0.6); circ(ctx, "fill", -bw * 0.4 + wave * 0.1, bh * 0.15, s * 0.018);
}
export function renderParrotfish(ctx, f, wag, flash, t, s) {
  t = gt(t); s = s !== undefined ? s : f.size;
  const cols = getColors(f);
  const c0 = cols[0], c1 = cols[1];
  const bw = s * 0.46, bh = s * 0.26;
  const wave = Math.sin(t * 3.5 + f.phase) * s * 0.007;
  ctx.save(); ctx.translate(-bw * 0.55, 0); ctx.rotate(wag * 0.75);
  sc(ctx, c0, 0.9);
  poly(ctx, "fill", [0, 0, -s * 0.24, -bh * 0.9, -s * 0.08, -bh * 0.2, -s * 0.08, bh * 0.2, -s * 0.24, bh * 0.9]); ctx.restore();
  const df = Math.sin(t * 6 + f.phase) * s * 0.006;
  sc(ctx, c0, 0.75);
  poly(ctx, "fill", [bw * 0.05 + df, -bh * 0.7 + wave, bw * 0.42, -bh * 1.05 + wave, bw * 0.2, -bh * 0.8 + wave, -bw * 0.2, -bh * 0.9 + wave, -bw * 0.38, -bh * 0.7 + wave]);
  sc(ctx, c0, 0.5); ell(ctx, "fill", 0 + wave, bh * 0.7, s * 0.09, s * 0.14);
  if (flash) setColor(ctx, 1, 1, 1, 0.9); else sc(ctx, c0);
  ell(ctx, "fill", wave, 0, bw, bh);
  sc(ctx, c1, 0.22);
  for (let row = 0; row < 4; row++) for (let col = 0; col < 7; col++) {
    const ox = (row % 2) * (bw * 0.12);
    const sx = -bw * 0.35 + col * bw * 0.12 + ox + wave * 0.15;
    const sy = -bh * 0.55 + row * bh * 0.38;
    ell(ctx, "fill", sx, sy, s * 0.038, s * 0.032);
  }
  if (flash) setColor(ctx, 1, 1, 1, 0.85); else sc(ctx, c0, 1.0);
  ell(ctx, "fill", bw * 0.72 + wave * 0.5, -bh * 0.1, bw * 0.42, bh * 0.42);
  sc(ctx, c1, 0.95);
  poly(ctx, "fill", [bw * 0.65 + wave * 0.5, -bh * 0.35, bw * 1.15 + wave * 0.5, -bh * 0.15, bw * 1.2 + wave * 0.5, bh * 0.05, bw * 0.9 + wave * 0.5, bh * 0.02, bw * 0.72 + wave * 0.5, -bh * 0.1]);
  setColor(ctx, c1[0] * 0.6, c1[1] * 0.6, c1[2] * 0.6, 0.8); ctx.lineWidth = 1.5;
  ln(ctx, [bw * 0.75 + wave * 0.5, -bh * 0.1, bw * 1.15 + wave * 0.5, -bh * 0.08]); ctx.lineWidth = 1;
  sc(ctx, c1, 0.85);
  poly(ctx, "fill", [bw * 0.65 + wave * 0.5, bh * 0.0, bw * 1.1 + wave * 0.5, bh * 0.12, bw * 1.1 + wave * 0.5, bh * 0.32, bw * 0.85 + wave * 0.5, bh * 0.28, bw * 0.68 + wave * 0.5, bh * 0.1]);
  setColor(ctx, c1[0] * 0.55, c1[1] * 0.55, c1[2] * 0.55, 0.85); ctx.lineWidth = 1.5;
  ln(ctx, [bw * 0.72 + wave * 0.5, bh * 0.05, bw * 1.05 + wave * 0.5, bh * 0.18]); ctx.lineWidth = 1;
  const pf = Math.sin(t * 4.5 + f.phase) * 0.25;
  sc(ctx, c0, 0.6); ctx.save(); ctx.translate(bw * 0.05 + wave * 0.3, bh * 0.4); ctx.rotate(0.5 + pf);
  ell(ctx, "fill", 0, 0, s * 0.075, s * 0.16); ctx.restore();
  setColor(ctx, 1, 1, 1, 0.12); ell(ctx, "fill", wave * 0.4 + bw * 0.06, -bh * 0.3, bw * 0.32, bh * 0.17);
  const ex = bw * 0.44 + wave * 0.5, ey = -bh * 0.3;
  setColor(ctx, 1, 0.8, 0.2, 0.9); circ(ctx, "fill", ex, ey, s * 0.07);
  setColor(ctx, 0.05, 0.05, 0.05); circ(ctx, "fill", ex + s * 0.01, ey, s * 0.038);
  setColor(ctx, 1, 1, 1, 0.8); circ(ctx, "fill", ex - s * 0.01, ey - s * 0.02, s * 0.013);
}
export function renderButterflyfish(ctx, f, wag, flash, t, s) {
  t = gt(t); s = s !== undefined ? s : f.size;
  const cols = getColors(f);
  const yellow = cols[0], black = cols[1];
  const bw = s * 0.24, bh = s * 0.36;
  const wave = Math.sin(t * 4 + f.phase) * s * 0.007;
  ctx.save(); ctx.translate(-bw * 0.55, 0); ctx.rotate(wag * 0.7);
  sc(ctx, yellow);
  poly(ctx, "fill", [0, 0, -s * 0.1, -bh * 0.35, -s * 0.04, -bh * 0.06, -s * 0.04, bh * 0.06, -s * 0.1, bh * 0.35]);
  setColor(ctx, 0.05, 0.05, 0.05, 0.3); ctx.lineWidth = 1.2;
  poly(ctx, "line", [0, 0, -s * 0.1, -bh * 0.35, -s * 0.04, -bh * 0.06, -s * 0.04, bh * 0.06, -s * 0.1, bh * 0.35]);
  ctx.lineWidth = 1; ctx.restore();
  const dfWave = Math.sin(t * 5 + f.phase) * s * 0.006;
  sc(ctx, yellow, 0.75); ctx.save(); ctx.translate(wave * 0.15, -bh * 0.72 + dfWave); ctx.rotate(-0.2);
  ell(ctx, "fill", 0, 0, s * 0.16, s * 0.04); ctx.restore();
  sc(ctx, yellow, 0.65); ctx.save(); ctx.translate(wave * 0.05, bh * 0.72); ctx.rotate(0.25);
  ell(ctx, "fill", 0, 0, s * 0.12, s * 0.035); ctx.restore();
  if (flash) setColor(ctx, 1, 1, 1, 0.9); else sc(ctx, yellow);
  ell(ctx, "fill", wave, 0, bw, bh);
  sc(ctx, black, 0.7); ell(ctx, "fill", -bw * 0.05 + wave * 0.3, 0, s * 0.035, bh * 0.82);
  sc(ctx, black, 0.6); circ(ctx, "fill", -bw * 0.35 + wave * 0.2, -bh * 0.08, s * 0.04);
  setColor(ctx, 1, 1, 1, 0.4); circ(ctx, "fill", -bw * 0.35 + wave * 0.2, -bh * 0.1, s * 0.015);
  sc(ctx, black, 0.75); ell(ctx, "fill", bw * 0.45 + wave * 0.5, 0, s * 0.025, bh * 0.9);
  const pf = Math.sin(t * 5 + f.phase) * 0.2;
  sc(ctx, yellow, 0.55); ctx.save(); ctx.translate(wave * 0.25, bh * 0.3); ctx.rotate(0.5 + pf);
  ell(ctx, "fill", 0, 0, s * 0.04, s * 0.08); ctx.restore();
  setColor(ctx, 1, 1, 1, 0.12); ell(ctx, "fill", wave * 0.25 + bw * 0.05, -bh * 0.3, bw * 0.22, bh * 0.18);
  const ex = bw * 0.38 + wave * 0.45, ey = -bh * 0.08;
  sc(ctx, black, 0.95); circ(ctx, "fill", ex, ey, s * 0.06);
  setColor(ctx, 0.05, 0.05, 0.05); circ(ctx, "fill", ex + s * 0.01, ey, s * 0.035);
  setColor(ctx, 1, 1, 1, 0.7); circ(ctx, "fill", ex - s * 0.01, ey - s * 0.025, s * 0.013);
  sc(ctx, black, 0.5);
  poly(ctx, "fill", [bw * 0.65 + wave * 0.5, -bh * 0.04, bw * 0.85 + wave * 0.55, 0, bw * 0.65 + wave * 0.5, bh * 0.04]);
  setColor(ctx, 0.1, 0.1, 0.1, 0.4); ctx.lineWidth = 1;
  ln(ctx, [bw * 0.7 + wave * 0.5, -bh * 0.01, bw * 0.85 + wave * 0.55, 0]); ctx.lineWidth = 1;
}
export function renderPufferfish(ctx, f, wag, flash, t, s) {
  t = gt(t); s = s !== undefined ? s : f.size;
  const cols = getColors(f);
  const c0 = cols[0], c1 = cols[1];
  const r = s * 0.3;
  const wave = Math.sin(t * 2 + f.phase) * s * 0.005;
  const puff = 1 + Math.sin(t * 1.5 + f.phase) * 0.03;
  ctx.save(); ctx.translate(-r * 1.05, 0); ctx.rotate(wag * 0.5);
  sc(ctx, c0, 0.8);
  poly(ctx, "fill", [0, 0, -s * 0.1, -r * 0.55, -s * 0.06, -r * 0.12, -s * 0.06, r * 0.12, -s * 0.1, r * 0.55]); ctx.restore();
  const spineCount = 30;
  for (let i = 0; i < spineCount; i++) {
    const a = i * Math.PI * 2 / spineCount;
    const spineLen = s * (0.07 + Math.sin(i * 2.3 + t * 0.5) * 0.025);
    const baseR = r * puff;
    const bx = Math.cos(a) * baseR + wave * Math.cos(a);
    const by = Math.sin(a) * baseR;
    const tx = Math.cos(a) * (baseR + spineLen) + wave * Math.cos(a);
    const ty = Math.sin(a) * (baseR + spineLen);
    setColor(ctx, c0[0] * 0.7, c0[1] * 0.7, c0[2] * 0.5, 0.8); ctx.lineWidth = 1.2;
    ln(ctx, [bx, by, tx, ty]);
  }
  ctx.lineWidth = 1;
  sc(ctx, c1, 0.6); ell(ctx, "fill", wave, r * 0.1, r * puff * 0.85, r * puff * 0.55);
  if (flash) setColor(ctx, 1, 1, 1, 0.9); else sc(ctx, c0);
  circ(ctx, "fill", wave, 0, r * puff);
  setColor(ctx, 0.4, 0.3, 0.1, 0.3);
  const spotPositions = [[0.1, -0.5], [0.4, -0.2], [0.5, 0.3], [0.1, 0.55], [-0.3, 0.4], [-0.5, 0.0], [-0.4, -0.4], [0.0, 0.0], [-0.1, -0.3]];
  for (const sp of spotPositions) circ(ctx, "fill", wave + sp[0] * r, sp[1] * r, s * 0.025);
  const pf = Math.sin(t * 6 + f.phase) * 0.3;
  sc(ctx, c0, 0.55); ctx.save(); ctx.translate(r * 0.2 + wave, r * 0.4); ctx.rotate(0.8 + pf);
  ell(ctx, "fill", 0, 0, s * 0.04, s * 0.07); ctx.restore();
  setColor(ctx, 1, 1, 1, 0.16); circ(ctx, "fill", wave - r * 0.2, -r * 0.32, r * 0.3);
  for (const side of [-1, 1]) {
    const ex = r * 0.72 + wave * 0.5, ey = side * r * 0.35;
    setColor(ctx, 1, 1, 1, 0.95); circ(ctx, "fill", ex, ey, s * 0.09);
    setColor(ctx, 0.9, 0.7, 0.1); circ(ctx, "fill", ex + s * 0.01, ey, s * 0.055);
    setColor(ctx, 0.05, 0.05, 0.05); circ(ctx, "fill", ex + s * 0.02, ey, s * 0.032);
    setColor(ctx, 1, 1, 1, 0.9); circ(ctx, "fill", ex + s * 0.005, ey - s * 0.025, s * 0.015);
  }
  setColor(ctx, 0.2, 0.1, 0.05, 0.5);
  arcOpen(ctx, r * 0.88 + wave, 0, s * 0.04, 0.3, Math.PI - 0.3);
}
export function renderSeahorse(ctx, f, wag, flash, t, s) {
  t = gt(t); s = s !== undefined ? s : f.size;
  const cols = getColors(f);
  const c0 = cols[0], c1 = cols[1];
  ctx.save(); ctx.rotate(-Math.PI * 0.5 + wag * 0.35);
  const bodyH = s * 0.52, bodyW = s * 0.15;
  sc(ctx, c0); ctx.lineWidth = s * 0.065;
  arcOpen(ctx, s * 0.06, bodyH * 0.52, s * 0.1, Math.PI * 0.2, Math.PI * 2.2); ctx.lineWidth = 1;
  const numSegs = 8;
  for (let i = 0; i < numSegs; i++) {
    const p = i / numSegs;
    const cy = bodyH * 0.45 - p * bodyH * 0.72;
    const hw = bodyW * (1 - p * 0.35) * (1 - Math.abs(p - 0.4) * 0.2);
    const hh = bodyH / numSegs * 0.65;
    if (flash) setColor(ctx, 1, 1, 1, 0.9);
    else if (i % 2 === 0) sc(ctx, c0); else setColor(ctx, c0[0] * 0.82, c0[1] * 0.82, c0[2] * 0.82);
    ell(ctx, "fill", Math.sin(t * 1.5 + i * 0.4 + f.phase) * s * 0.012, cy, hw, hh + 1);
    setColor(ctx, c1[0], c1[1], c1[2], 0.3); ctx.lineWidth = 0.8;
    ln(ctx, [-hw * 0.85, cy, hw * 0.85, cy]); ctx.lineWidth = 1;
  }
  sc(ctx, c0); ell(ctx, "fill", 0, -bodyH * 0.28, bodyW * 0.8, s * 0.065);
  if (flash) setColor(ctx, 1, 1, 1, 0.9); else sc(ctx, c0);
  const headY = -bodyH * 0.38;
  ell(ctx, "fill", 0, headY, bodyW * 0.75, bodyW * 0.9);
  sc(ctx, c1, 0.8);
  for (let i = 0; i < 5; i++) {
    const ca = (i / 4 - 0.5) * Math.PI * 0.8;
    const cx = Math.sin(ca) * bodyW * 0.6;
    const cy = headY - bodyW * 0.85;
    const tipY = cy - s * (0.04 + (i % 2) * 0.03);
    poly(ctx, "fill", [cx - s * 0.018, cy, cx, tipY, cx + s * 0.018, cy]);
  }
  sc(ctx, c1, 0.9);
  const snoutLen = s * 0.22;
  poly(ctx, "fill", [-bodyW * 0.3, headY - bodyW * 0.3, bodyW * 0.3, headY - bodyW * 0.3, bodyW * 0.18, headY - bodyW * 0.3 - snoutLen, -bodyW * 0.18, headY - bodyW * 0.3 - snoutLen]);
  const finFlutter = Math.sin(t * 8 + f.phase) * s * 0.015;
  sc(ctx, c1, 0.5);
  poly(ctx, "fill", [bodyW * 0.7, -bodyH * 0.1 + finFlutter, bodyW * 1.4, -bodyH * 0.22 + finFlutter, bodyW * 1.6, bodyH * 0.0 + finFlutter, bodyW * 1.4, bodyH * 0.1 + finFlutter, bodyW * 0.7, bodyH * 0.12 + finFlutter]);
  const ex = bodyW * 0.28, ey = headY - bodyW * 0.12;
  setColor(ctx, 1, 1, 1, 0.95); circ(ctx, "fill", ex, ey, s * 0.065);
  setColor(ctx, 0.05, 0.05, 0.1); circ(ctx, "fill", ex + s * 0.01, ey, s * 0.038);
  setColor(ctx, 1, 1, 1, 0.85); circ(ctx, "fill", ex - s * 0.01, ey - s * 0.025, s * 0.016);
  ctx.restore();
}
export function renderAngelfish(ctx, f, wag, flash, t, s) {
  t = gt(t); s = s !== undefined ? s : f.size;
  const cols = getColors(f);
  const red = cols[0], white = cols[1];
  const bw = s * 0.26, bh = s * 0.4;
  const wave = Math.sin(t * 3.5 + f.phase) * s * 0.008;
  ctx.save(); ctx.translate(-bw * 0.5, 0); ctx.rotate(wag * 0.7);
  sc(ctx, red);
  poly(ctx, "fill", [s * 0.02, 0, -s * 0.14, -bh * 0.5, -s * 0.05, -bh * 0.08, -s * 0.05, bh * 0.08, -s * 0.14, bh * 0.5]);
  sc(ctx, white, 0.25);
  poly(ctx, "fill", [s * 0.02, 0, -s * 0.14, -bh * 0.5, -s * 0.1, -bh * 0.3, -s * 0.1, bh * 0.3, -s * 0.14, bh * 0.5]); ctx.restore();
  const dfWave = Math.sin(t * 3 + f.phase) * s * 0.01;
  sc(ctx, red, 0.7); ctx.save(); ctx.translate(wave * 0.15, -bh * 0.72 + dfWave); ctx.rotate(-0.3);
  ell(ctx, "fill", 0, 0, s * 0.18, s * 0.035); ctx.restore();
  const afWave = Math.sin(t * 2.5 + f.phase + 1) * s * 0.012;
  sc(ctx, red, 0.6); ctx.save(); ctx.translate(wave * 0.05, bh * 0.72 + afWave); ctx.rotate(0.35);
  ell(ctx, "fill", 0, 0, s * 0.16, s * 0.03); ctx.restore();
  const pf = Math.sin(t * 5 + f.phase) * 0.2;
  sc(ctx, red, 0.5); ctx.save(); ctx.translate(bw * 0.05 + wave, bh * 0.3); ctx.rotate(0.45 + pf);
  ell(ctx, "fill", 0, 0, s * 0.05, s * 0.1); ctx.restore();
  if (flash) setColor(ctx, 1, 1, 1, 0.9); else sc(ctx, red);
  poly(ctx, "fill", [bw * 0.55 + wave, 0, bw * 0.4 + wave, -bh * 0.35, bw * 0.18 + wave, -bh * 0.62, -bw * 0.02, -bh * 0.78, -bw * 0.28, -bh * 0.7, -bw * 0.48, -bh * 0.4, -bw * 0.52, -bh * 0.12, -bw * 0.52, bh * 0.12, -bw * 0.48, bh * 0.4, -bw * 0.28, bh * 0.7, -bw * 0.02, bh * 0.78, bw * 0.18 + wave, bh * 0.62, bw * 0.4 + wave, bh * 0.35, bw * 0.55 + wave, 0]);
  const stripePositions = [bw * 0.3, bw * 0.0, -bw * 0.28];
  for (const bx of stripePositions) {
    const hw = s * 0.028;
    sc(ctx, white, 0.65); ell(ctx, "fill", bx + wave * 0.35, 0, hw, bh * 0.65);
    setColor(ctx, 0.05, 0.02, 0, 0.2); ctx.lineWidth = 1; ell(ctx, "line", bx + wave * 0.35, 0, hw, bh * 0.65); ctx.lineWidth = 1;
  }
  setColor(ctx, 1, 1, 1, 0.12); ell(ctx, "fill", wave * 0.3 + bw * 0.08, -bh * 0.28, bw * 0.22, bh * 0.18);
  const ex = bw * 0.42 + wave * 0.5, ey = -bh * 0.15;
  setColor(ctx, 0, 0, 0, 0.9); circ(ctx, "fill", ex, ey, s * 0.065);
  setColor(ctx, 1, 0.8, 0.2); circ(ctx, "fill", ex, ey, s * 0.038);
  setColor(ctx, 0.05, 0.05, 0.05); circ(ctx, "fill", ex + s * 0.01, ey, s * 0.022);
  setColor(ctx, 1, 1, 1, 0.8); circ(ctx, "fill", ex - s * 0.01, ey - s * 0.022, s * 0.012);
  sc(ctx, red, 0.3); ctx.lineWidth = 1; circ(ctx, "line", ex, ey, s * 0.065);
  setColor(ctx, 0.15, 0.05, 0.05, 0.5); arcOpen(ctx, bw * 0.72 + wave * 0.5, -bh * 0.02, s * 0.025, 0.15, Math.PI - 0.15);
}
export function renderLionfish(ctx, f, wag, flash, t, s) {
  t = gt(t); s = s !== undefined ? s : f.size;
  const cols = getColors(f);
  const c0 = cols[0], c1 = cols[1];
  const bw = s * 0.44, bh = s * 0.22;
  const wave = Math.sin(t * 3 + f.phase) * s * 0.007;
  ctx.save(); ctx.translate(-bw * 0.55, 0); ctx.rotate(wag * 0.7);
  sc(ctx, c1, 0.8);
  poly(ctx, "fill", [0, 0, -s * 0.2, -bh * 0.85, -s * 0.06, -bh * 0.15, -s * 0.06, bh * 0.15, -s * 0.2, bh * 0.85]); ctx.restore();
  const fanFlap = Math.sin(t * 2 + f.phase) * 0.18;
  sc(ctx, c1, 0.45); ctx.save(); ctx.translate(bw * 0.1 + wave, bh * 0.35); ctx.rotate(0.6 + fanFlap);
  for (let i = 0; i < 7; i++) {
    const ra = (i / 6) * Math.PI * 0.7 - Math.PI * 0.35 + Math.PI * 0.5;
    const len = s * (0.22 - Math.abs(i - 3) * 0.018);
    ctx.lineWidth = 2.5 - i * 0.15;
    setColor(ctx, c1[0], c1[1], c1[2], 0.5 - i * 0.04);
    ln(ctx, [0, 0, Math.cos(ra) * len, Math.sin(ra) * len]);
    if (i % 2 === 0) {
      setColor(ctx, c0[0], c0[1], c0[2], 0.3);
      ln(ctx, [Math.cos(ra) * len * 0.4, Math.sin(ra) * len * 0.4, Math.cos(ra) * len * 0.8, Math.sin(ra) * len * 0.8]);
    }
  }
  ctx.lineWidth = 1; ctx.restore();
  for (let i = 0; i < 12; i++) {
    const spineT = i / 11;
    const spx = bw * (0.42 - spineT * 0.75) + wave * 0.3;
    const spBaseY = -bh * (0.6 + Math.sin(spineT * Math.PI) * 0.1);
    const spLen = s * (0.18 + Math.sin(spineT * Math.PI) * 0.12);
    const spAngle = -Math.PI * 0.5 + (spineT - 0.5) * Math.PI * 0.4;
    if (i > 0) {
      const prevT = (i - 1) / 11;
      const pspx = bw * (0.42 - prevT * 0.75) + wave * 0.3;
      const pspBaseY = -bh * (0.6 + Math.sin(prevT * Math.PI) * 0.1);
      const pspLen = s * (0.18 + Math.sin(prevT * Math.PI) * 0.12);
      const pspAngle = -Math.PI * 0.5 + (prevT - 0.5) * Math.PI * 0.4;
      sc(ctx, c0, 0.2);
      poly(ctx, "fill", [pspx, pspBaseY, pspx + Math.cos(pspAngle) * pspLen, pspBaseY + Math.sin(pspAngle) * pspLen, spx + Math.cos(spAngle) * spLen, spBaseY + Math.sin(spAngle) * spLen, spx, spBaseY]);
    }
    sc(ctx, c1, 0.9); ctx.lineWidth = 1.5;
    ln(ctx, [spx, spBaseY, spx + Math.cos(spAngle) * spLen, spBaseY + Math.sin(spAngle) * spLen]); ctx.lineWidth = 1;
  }
  if (flash) setColor(ctx, 1, 1, 1, 0.9); else sc(ctx, c0);
  ell(ctx, "fill", wave, 0, bw, bh);
  for (let i = 0; i < 7; i++) {
    const sy = -bh * 0.75 + i * bh * 0.25;
    const stripeA = (i % 2 === 0) ? 0.35 : 0.25;
    setColor(ctx, c1[0], c1[1], c1[2], stripeA);
    ell(ctx, "fill", wave * 0.4, sy, bw * 0.82, bh * 0.1);
  }
  setColor(ctx, 1, 1, 1, 0.12); ell(ctx, "fill", wave * 0.4 + bw * 0.05, -bh * 0.3, bw * 0.3, bh * 0.16);
  const ex = bw * 0.55 + wave * 0.5, ey = -bh * 0.2;
  setColor(ctx, 0.8, 0.4, 0.1, 0.9); circ(ctx, "fill", ex, ey, s * 0.08);
  setColor(ctx, 0.05, 0.05, 0.1); circ(ctx, "fill", ex + s * 0.01, ey, s * 0.046);
  setColor(ctx, 1, 1, 1, 0.85); circ(ctx, "fill", ex - s * 0.012, ey - s * 0.028, s * 0.018);
  sc(ctx, c1, 0.7); ctx.lineWidth = 1.5;
  ln(ctx, [ex - s * 0.02, ey - s * 0.08, ex + s * 0.02, ey - s * 0.2]); ctx.lineWidth = 1;
  setColor(ctx, 0.2, 0.05, 0.05, 0.6); arcOpen(ctx, bw * 0.82 + wave * 0.5, 0, s * 0.05, 0.25, Math.PI - 0.25);
}
export function renderNapoleon(ctx, f, wag, flash, t, s) {
  t = gt(t); s = s !== undefined ? s : f.size;
  const cols = getColors(f);
  const c0 = cols[0], c1 = cols[1];
  const bw = s * 0.5, bh = s * 0.34;
  const wave = Math.sin(t * 3 + f.phase) * s * 0.007;
  ctx.save(); ctx.translate(-bw * 0.52, 0); ctx.rotate(wag * 0.55);
  sc(ctx, c0, 0.85);
  poly(ctx, "fill", [s * 0.04, 0, -s * 0.3, -bh * 0.85, -s * 0.08, -bh * 0.12, -s * 0.08, bh * 0.12, -s * 0.3, bh * 0.85]); ctx.restore();
  const df = Math.sin(t * 4 + f.phase) * s * 0.006;
  sc(ctx, c0, 0.8);
  poly(ctx, "fill", [bw * 0.4 + wave, -bh * 0.65 + df, bw * 0.55, -bh * 1.05 + df, bw * 0.22, -bh * 1.12 + df, -bw * 0.1, -bh * 1.05 + df, -bw * 0.4, -bh * 0.65]);
  if (flash) setColor(ctx, 1, 1, 1, 0.9); else sc(ctx, c0);
  ell(ctx, "fill", wave, 0, bw, bh);
  sc(ctx, c0); circ(ctx, "fill", bw * 0.5 + wave * 0.7, -bh * 0.7, bh * 0.55);
  circ(ctx, "fill", bw * 0.32 + wave * 0.6, -bh * 0.6, bh * 0.4);
  setColor(ctx, 1, 1, 1, 0.12); ell(ctx, "fill", bw * 0.42 + wave * 0.5, -bh * 0.85, bw * 0.14, bh * 0.18);
  setColor(ctx, c1[0], c1[1], c1[2], 0.28); ctx.lineWidth = 1.2;
  for (let row = -3; row <= 3; row++) {
    const ry = row * bh * 0.28;
    const hw = bw * Math.sqrt(Math.max(0, 1 - (ry / bh) ** 2)) * 0.88;
    ln(ctx, [-hw + wave * 0.2, ry, hw + wave * 0.2, ry]);
  }
  ctx.lineWidth = 1;
  sc(ctx, c1, 0.95); ell(ctx, "fill", bw * 0.9 + wave * 0.6, bh * 0.12, bw * 0.22, bh * 0.26);
  setColor(ctx, c1[0] * 0.6, c1[1] * 0.6, c1[2] * 0.6, 0.9); ell(ctx, "fill", bw * 0.9 + wave * 0.6, bh * 0.24, bw * 0.2, bh * 0.14);
  setColor(ctx, c0[0] * 0.7, c0[1] * 0.7, c0[2] * 0.7); ell(ctx, "fill", bw * 0.92 + wave * 0.6, bh * 0.1, bw * 0.1, bh * 0.14);
  setColor(ctx, 0.1, 0.08, 0.2, 0.5); ctx.lineWidth = 2;
  ln(ctx, [bw * 0.78 + wave * 0.5, bh * 0.1, bw * 1.08 + wave * 0.6, bh * 0.1]); ctx.lineWidth = 1;
  const pf = Math.sin(t * 3.5 + f.phase) * 0.2;
  sc(ctx, c0, 0.6); ctx.save(); ctx.translate(bw * 0.1 + wave, bh * 0.4); ctx.rotate(0.35 + pf);
  ell(ctx, "fill", 0, 0, s * 0.09, s * 0.2); ctx.restore();
  setColor(ctx, 1, 1, 1, 0.13); ell(ctx, "fill", wave * 0.3 + bw * 0.02, -bh * 0.35, bw * 0.24, bh * 0.16);
  const ex = bw * 0.5 + wave * 0.5, ey = -bh * 0.28;
  setColor(ctx, 0.9, 0.85, 0.4, 0.95); circ(ctx, "fill", ex, ey, s * 0.08);
  setColor(ctx, 0.05, 0.05, 0.1); circ(ctx, "fill", ex + s * 0.01, ey, s * 0.05);
  setColor(ctx, 1, 1, 1, 0.85); circ(ctx, "fill", ex - s * 0.015, ey - s * 0.03, s * 0.018);
  sc(ctx, c1, 0.4); ctx.lineWidth = 1.2; circ(ctx, "line", ex, ey, s * 0.08); ctx.lineWidth = 1;
}
export function renderMoorish(ctx, f, wag, flash, t, s) {
  t = gt(t); s = s !== undefined ? s : f.size;
  const cols = getColors(f);
  const c0 = cols[0], c1 = cols[1];
  const yellow = [1.0, 0.85, 0.1];
  const bw = s * 0.22, bh = s * 0.58;
  const wave = Math.sin(t * 3.5 + f.phase) * s * 0.009;
  ctx.save(); ctx.translate(-bw * 0.6, 0); ctx.rotate(wag * 0.75);
  sc(ctx, c1, 0.85);
  poly(ctx, "fill", [s * 0.02, 0, -s * 0.18, -bh * 0.55, -s * 0.05, -bh * 0.06, -s * 0.05, bh * 0.06, -s * 0.18, bh * 0.55]); ctx.restore();
  const streamerLen = bh * 1.6;
  const sw1 = Math.sin(t * 1.8 + f.phase) * s * 0.04;
  const sw2 = Math.sin(t * 2.3 + f.phase + 1) * s * 0.06;
  const sw3 = Math.sin(t * 1.5 + f.phase + 2) * s * 0.08;
  sc(ctx, c1, 0.55); ctx.lineWidth = 1.5;
  ln(ctx, [bw * 0.15 + wave, -bh * 0.82, bw * 0.05 + sw1, -bh * 1.1, -bw * 0.1 + sw2, -bh * 0.82 - streamerLen * 0.4, -bw * 0.3 + sw3, -bh * 0.82 - streamerLen * 0.7, -bw * 0.5 + sw3, -bh * 0.82 - streamerLen]); ctx.lineWidth = 1;
  sc(ctx, c1, 0.8);
  poly(ctx, "fill", [bw * 0.15 + wave, -bh * 0.78, bw * 0.5, -bh * 1.05 + wave, bw * 0.25, -bh * 0.92 + wave, -bw * 0.15, -bh * 1.0 + wave, -bw * 0.38, -bh * 0.78]);
  sc(ctx, c1, 0.65); poly(ctx, "fill", [bw * 0.0, bh * 0.78 + wave, bw * 0.3, bh * 1.0 + wave, -bw * 0.2, bh * 0.78]);
  sc(ctx, c1, 0.85); poly(ctx, "fill", [bw * 0.55 + wave * 0.6, -bh * 0.1, bw * 0.95 + wave * 0.7, 0, bw * 0.55 + wave * 0.6, bh * 0.1]);
  if (flash) setColor(ctx, 1, 1, 1, 0.9); else sc(ctx, c0);
  poly(ctx, "fill", [bw * 0.55 + wave, -bh * 0.12, bw * 0.45 + wave, -bh * 0.35, bw * 0.25 + wave, -bh * 0.6, -bw * 0.0, -bh * 0.8, -bw * 0.25, -bh * 0.75, -bw * 0.45, -bh * 0.45, -bw * 0.52, -bh * 0.15, -bw * 0.52, -bh * 0.0, bw * 0.55 + wave, -bh * 0.12]);
  if (flash) setColor(ctx, 1, 1, 1, 0.9); else sc(ctx, c1, 0.92);
  poly(ctx, "fill", [bw * 0.56 + wave, -bh * 0.1, bw * 0.56 + wave, bh * 0.22, -bw * 0.52, bh * 0.22, -bw * 0.52, -bh * 0.0, bw * 0.55 + wave, -bh * 0.12]);
  if (flash) setColor(ctx, 1, 1, 1, 0.7); else setColor(ctx, yellow[0], yellow[1], yellow[2]);
  poly(ctx, "fill", [bw * 0.52 + wave, bh * 0.22, bw * 0.52 + wave, bh * 0.55, bw * 0.2 + wave, bh * 0.8, -bw * 0.05, bh * 0.82, -bw * 0.3, bh * 0.72, -bw * 0.5, bh * 0.45, -bw * 0.52, bh * 0.22]);
  if (flash) setColor(ctx, 1, 1, 1, 0.8); else sc(ctx, c1, 0.9);
  poly(ctx, "fill", [bw * 0.3 + wave, bh * 0.55, bw * 0.15 + wave, bh * 0.82, -bw * 0.05, bh * 0.82, -bw * 0.3, bh * 0.72, -bw * 0.5, bh * 0.45, -bw * 0.52, bh * 0.22, bw * 0.52 + wave, bh * 0.22]);
  const pf = Math.sin(t * 5 + f.phase) * 0.18;
  sc(ctx, c1, 0.5); ctx.save(); ctx.translate(bw * 0.1 + wave, bh * 0.15); ctx.rotate(0.4 + pf);
  ell(ctx, "fill", 0, 0, s * 0.04, s * 0.12); ctx.restore();
  setColor(ctx, 1, 1, 1, 0.15); ell(ctx, "fill", wave * 0.3 + bw * 0.1, -bh * 0.5, bw * 0.18, bh * 0.25);
  const ex = bw * 0.42 + wave * 0.5, ey = -bh * 0.0;
  setColor(ctx, 1, 1, 1, 0.95); circ(ctx, "fill", ex, ey, s * 0.075);
  setColor(ctx, 0.05, 0.05, 0.1); circ(ctx, "fill", ex + s * 0.01, ey, s * 0.044);
  setColor(ctx, 1, 1, 1, 0.8); circ(ctx, "fill", ex - s * 0.012, ey - s * 0.03, s * 0.018);
}
export function renderMandarin(ctx, f, wag, flash, t, s) {
  t = gt(t); s = s !== undefined ? s : f.size;
  const cols = getColors(f);
  const c0 = cols[0], c1 = cols[1];
  const acc = [1.0, 0.55, 0.0];
  const bw = s * 0.3, bh = s * 0.22;
  const wave = Math.sin(t * 4 + f.phase) * s * 0.008;
  ctx.save(); ctx.translate(-bw * 0.58, 0); ctx.rotate(wag * 0.8);
  sc(ctx, c0);
  poly(ctx, "fill", [0, 0, -s * 0.18, -bh * 0.85, -s * 0.06, -bh * 0.12, -s * 0.06, bh * 0.12, -s * 0.18, bh * 0.85]);
  setColor(ctx, c1[0], c1[1], c1[2], 0.7);
  poly(ctx, "fill", [0, 0, -s * 0.18, -bh * 0.85, -s * 0.1, -bh * 0.5]); ctx.restore();
  const numRays = 8;
  for (let i = 0; i < numRays; i++) {
    const rt = i / numRays;
    const rx = bw * (0.42 - rt * 0.82) + wave * 0.3;
    const rBaseY = -bh * (0.62 + Math.sin(rt * Math.PI) * 0.08) + wave;
    const rLen = s * (0.15 + Math.sin(rt * Math.PI) * 0.12);
    const rAngle = -Math.PI * 0.5 + (rt - 0.5) * 0.4;
    if (i > 0) {
      const prt = (i - 1) / numRays;
      const prx = bw * (0.42 - prt * 0.82) + wave * 0.3;
      const prBaseY = -bh * (0.62 + Math.sin(prt * Math.PI) * 0.08) + wave;
      const prLen = s * (0.15 + Math.sin(prt * Math.PI) * 0.12);
      const prAngle = -Math.PI * 0.5 + (prt - 0.5) * 0.4;
      setColor(ctx, c0[0], c0[1], c0[2], 0.3 + rt * 0.2);
      poly(ctx, "fill", [prx, prBaseY, prx + Math.cos(prAngle) * prLen, prBaseY + Math.sin(prAngle) * prLen, rx + Math.cos(rAngle) * rLen, rBaseY + Math.sin(rAngle) * rLen, rx, rBaseY]);
    }
    const spinecol = i % 3 === 0 ? acc : (i % 3 === 1 ? c1 : c0);
    setColor(ctx, spinecol[0], spinecol[1], spinecol[2], 0.9); ctx.lineWidth = 1.5;
    ln(ctx, [rx, rBaseY, rx + Math.cos(rAngle) * rLen, rBaseY + Math.sin(rAngle) * rLen]); ctx.lineWidth = 1;
  }
  sc(ctx, c1, 0.5); poly(ctx, "fill", [bw * 0.0, bh * 0.65, bw * 0.22, bh * 0.9, -bw * 0.25, bh * 0.9, -bw * 0.35, bh * 0.65]);
  if (flash) setColor(ctx, 1, 1, 1, 0.9); else sc(ctx, c0);
  ell(ctx, "fill", wave, 0, bw, bh);
  for (let si = 0; si < 6; si++) {
    const st = si / 6;
    const baseX = -bw * 0.85 + st * bw * 1.7;
    const col = si % 3 === 0 ? c1 : (si % 3 === 1 ? acc : [0.1, 0.8, 0.5]);
    setColor(ctx, col[0], col[1], col[2], 0.38);
    for (let step = 0; step < 13; step++) {
      const p = step / 12;
      const wx = baseX + p * bw * 0.22;
      const wy = Math.sin(p * Math.PI * 2 + si * 1.1 + t * 0.8) * bh * 0.38 + wave;
      if (Math.abs(wx / bw) < 0.9 && Math.abs(wy / bh) < 0.9) ell(ctx, "fill", wx + wave * 0.2, wy, s * 0.025, s * 0.04);
    }
  }
  const spotData = [[0.3, -0.4], [0.6, -0.1], [0.5, 0.4], [0.1, 0.6], [-0.2, 0.5], [-0.5, 0.2], [-0.6, -0.3], [-0.3, -0.5], [0.0, -0.2], [0.2, 0.2], [-0.1, 0.1], [0.4, 0.3]];
  for (const sp of spotData) { setColor(ctx, acc[0], acc[1], acc[2], 0.55); circ(ctx, "fill", wave + sp[0] * bw, sp[1] * bh, s * 0.022); }
  const pf = Math.sin(t * 6 + f.phase) * 0.25;
  setColor(ctx, acc[0], acc[1], acc[2], 0.7); ctx.save(); ctx.translate(bw * 0.1 + wave, bh * 0.3); ctx.rotate(0.5 + pf);
  ell(ctx, "fill", 0, 0, s * 0.045, s * 0.095); ctx.restore();
  setColor(ctx, 1, 1, 1, 0.16); ell(ctx, "fill", wave * 0.3 + bw * 0.06, -bh * 0.32, bw * 0.22, bh * 0.18);
  const ex = bw * 0.6 + wave * 0.5, ey = -bh * 0.18;
  setColor(ctx, 1, 0.8, 0.0, 0.95); circ(ctx, "fill", ex, ey, s * 0.075);
  setColor(ctx, 0.05, 0.05, 0.05); circ(ctx, "fill", ex + s * 0.01, ey, s * 0.04);
  setColor(ctx, 1, 1, 1, 0.8); circ(ctx, "fill", ex - s * 0.012, ey - s * 0.028, s * 0.016);
  setColor(ctx, 0.8, 0.2, 0.1, 0.5); circ(ctx, "fill", bw * 0.84 + wave * 0.5, bh * 0.05, s * 0.02);
}
const speciesMap = { clownfish: renderClownfish, bluetang: renderBluetang, parrotfish: renderParrotfish, butterfly: renderButterflyfish, butterflyfish: renderButterflyfish, pufferfish: renderPufferfish, puffer: renderPufferfish, seahorse: renderSeahorse, angelfish: renderAngelfish, lionfish: renderLionfish, napoleon: renderNapoleon, moorish: renderMoorish, mandarin: renderMandarin };
export function renderSpecies(ctx, f, wag = 0, flash = false, t, s) {
  const id = (f.id || (f.fd && f.fd.id) || "").toLowerCase();
  const fn = speciesMap[id];
  if (fn) return fn(ctx, f, wag, flash, t, s);
  return renderClownfish(ctx, f, wag, flash, t, s);
}
export const FishRenderSpecies = speciesMap;
