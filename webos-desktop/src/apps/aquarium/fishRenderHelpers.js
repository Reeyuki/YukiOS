export function setColor(ctx, r, g, b, a = 1) {
  const v = `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)},${a})`;
  ctx.fillStyle = v;
  ctx.strokeStyle = v;
}
export function sc(ctx, c, a = 1) { setColor(ctx, c[0], c[1], c[2], a); }
export function poly(ctx, mode, pts) { ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); ctx.closePath(); if (mode === "fill") ctx.fill(); else ctx.stroke(); }
export function ell(ctx, mode, x, y, rx, ry) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); if (mode === "fill") ctx.fill(); else ctx.stroke(); }
export function circ(ctx, mode, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); if (mode === "fill") ctx.fill(); else ctx.stroke(); }
export function ln(ctx, pts) { ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); ctx.stroke(); }
export function arcOpen(ctx, x, y, r, a1, a2) { ctx.beginPath(); ctx.arc(x, y, r, a1, a2); ctx.stroke(); }
export function getColors(f) { if (f.fd && f.fd.colors) return f.fd.colors; if (f.colors) return f.colors; return [[1, 0.42, 0.21], [1, 1, 1]]; }
export function gt(t) { return t !== undefined ? t : (typeof performance !== "undefined" ? performance.now() / 1000 : Date.now() / 1000); }
