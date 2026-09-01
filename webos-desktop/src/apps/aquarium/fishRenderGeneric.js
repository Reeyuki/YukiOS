import { setColor as _setColor, sc as _sc } from "./fishRenderHelpers.js";
export function renderGeneric(ctx, f, wag, flash, t) {
  const s = f.size
  const c0 = f.fd.colors[0]
  const c1 = f.fd.colors[1]
  const bw = s * 0.36
  const bh = s * 0.18
  const wave = Math.sin(t * 5 + f.phase) * s * 0.006
  function setColor(r, g, b, a) { _setColor(ctx, r, g, b, a); }
  function sc(c, a) { _sc(ctx, c, a); }
  ctx.save()
  ctx.translate(-bw * 0.45, 0)
  ctx.rotate(wag * 0.9)
  sc(c1)
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(-s * 0.55, -bh * 0.95)
  ctx.lineTo(-s * 0.6, -bh * 0.2)
  ctx.lineTo(-s * 0.6, bh * 0.2)
  ctx.lineTo(-s * 0.55, bh * 0.95)
  ctx.closePath()
  ctx.fill()
  setColor(c1[0] * 0.55, c1[1] * 0.55, c1[2] * 0.55, 0.55)
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(-s * 0.45, -bh * 0.7)
  ctx.lineTo(-s * 0.5, -bh * 0.1)
  ctx.lineTo(-s * 0.5, bh * 0.1)
  ctx.lineTo(-s * 0.45, bh * 0.7)
  ctx.closePath()
  ctx.fill()
  sc(c1, 0.9)
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(-s * 0.5, -bh * 0.5)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(-s * 0.53, 0)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(-s * 0.5, bh * 0.5)
  ctx.stroke()
  setColor(1, 1, 1, 0.12)
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(-s * 0.3, -bh * 0.4)
  ctx.lineTo(-s * 0.32, -bh * 0.15)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
  const dfWave = Math.sin(t * 6 + f.phase) * s * 0.004
  sc(c0, 0.75)
  ctx.save()
  ctx.translate(wave * 0.1, -bh * 0.7 + dfWave)
  ctx.rotate(-0.15)
  ctx.beginPath()
  ctx.ellipse(0, 0, s * 0.11, s * 0.04, 0, 0, Math.PI * 2)
  ctx.fill()
  setColor(c1[0], c1[1], c1[2], 0.4)
  ctx.lineWidth = 1
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath()
    ctx.moveTo(i * s * 0.02, -s * 0.015)
    ctx.lineTo(i * s * 0.02, s * 0.03)
    ctx.stroke()
  }
  ctx.restore()
  sc(c0, 0.5)
  ctx.save()
  ctx.translate(wave * 0.05, bh * 0.65)
  ctx.rotate(0.2)
  ctx.beginPath()
  ctx.ellipse(0, 0, s * 0.06, s * 0.025, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
  const pf = Math.sin(t * 6 + f.phase) * 0.2
  sc(c0, 0.6)
  ctx.save()
  ctx.translate(bw * 0.1 + wave * 0.3, bh * 0.35)
  ctx.rotate(0.5 + pf)
  ctx.beginPath()
  ctx.ellipse(0, 0, s * 0.035, s * 0.075, 0, 0, Math.PI * 2)
  ctx.fill()
  setColor(c1[0], c1[1], c1[2], 0.3)
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, -s * 0.06)
  ctx.lineTo(0, s * 0.06)
  ctx.stroke()
  ctx.restore()
  if (flash) setColor(1, 1, 1, 0.9)
  else sc(c0)
  ctx.beginPath()
  ctx.ellipse(wave, 0, bw, bh, 0, 0, Math.PI * 2)
  ctx.fill()
  if (!flash) {
    setColor(c0[0] * 0.55, c0[1] * 0.55, c0[2] * 0.55, 0.3)
    ctx.beginPath()
    ctx.ellipse(wave * 0.3 + bw * 0.05, bh * 0.35, bw * 0.75, bh * 0.4, 0, 0, Math.PI * 2)
    ctx.fill()
    setColor(c0[0] * 1.35, c0[1] * 1.35, c0[2] * 1.35, 0.3)
    ctx.beginPath()
    ctx.ellipse(wave * 0.3 + bw * 0.05, -bh * 0.2, bw * 0.55, bh * 0.18, 0, 0, Math.PI * 2)
    ctx.fill()
    setColor(0.95, 0.97, 1, 0.1)
    ctx.beginPath()
    ctx.ellipse(wave * 0.2 + bw * 0.02, bh * 0.08, bw * 0.4, bh * 0.1, 0, 0, Math.PI * 2)
    ctx.fill()
    sc(c1, 0.35)
    ctx.lineWidth = 1
    for (let i = 1; i <= 4; i++) {
      const ax = -bw * 0.55 + i * bw * 0.32 + wave * 0.4
      ctx.beginPath()
      ctx.arc(ax, 0, bh * 0.85, Math.PI * 0.65, Math.PI * 1.35)
      ctx.stroke()
    }
    setColor(c1[0], c1[1], c1[2], 0.2)
    for (let gx = -3; gx <= 2; gx++) {
      for (let gy = -1; gy <= 1; gy++) {
        const px = gx * bw * 0.15 + wave * 0.4
        const py = gy * bh * 0.32
        if ((px / bw) ** 2 + (py / bh) ** 2 < 0.85) {
          ctx.beginPath()
          ctx.arc(px, py, s * 0.025, 0, Math.PI * 2)
          ctx.stroke()
        }
      }
    }
  }
  sc(c0, 0.85)
  ctx.beginPath()
  ctx.moveTo(bw * 0.75 + wave * 0.5, 0)
  ctx.arc(bw * 0.75 + wave * 0.5, 0, bh * 0.6, -0.5, 0.5)
  ctx.lineTo(bw * 0.75 + wave * 0.5, 0)
  ctx.closePath()
  ctx.fill()
  setColor(c1[0] * 0.7, c1[1] * 0.7, c1[2] * 0.7, 0.5)
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(bw * 0.7 + wave * 0.5, -bh * 0.3)
  ctx.lineTo(bw * 0.85 + wave * 0.5, 0)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(bw * 0.7 + wave * 0.5, bh * 0.3)
  ctx.lineTo(bw * 0.85 + wave * 0.5, 0)
  ctx.stroke()
  setColor(1, 1, 1, 0.35)
  for (let i = 0; i <= 3; i++) {
    const sx = -bw * 0.2 + i * bw * 0.2 + wave * 0.4
    const sy = -bh * 0.1 + (i % 2 - 0.5) * bh * 0.15
    const sparkle = 0.5 + Math.sin(t * 4 + f.phase + i * 1.7) * 0.3
    ctx.beginPath()
    ctx.arc(sx, sy, s * 0.02 * sparkle, 0, Math.PI * 2)
    ctx.fill()
  }
  const ex = bw * 0.52 + wave * 0.5
  const ey = -bh * 0.12
  setColor(c0[0] * 0.8, c0[1] * 0.8, c0[2] * 0.8, 0.6)
  ctx.beginPath()
  ctx.arc(ex, ey, s * 0.075, 0, Math.PI * 2)
  ctx.fill()
  setColor(1, 1, 1, 0.95)
  ctx.beginPath()
  ctx.arc(ex, ey, s * 0.06, 0, Math.PI * 2)
  ctx.fill()
  setColor(0.05, 0.05, 0.15, 1)
  ctx.beginPath()
  ctx.arc(ex + s * 0.008, ey, s * 0.034, 0, Math.PI * 2)
  ctx.fill()
  setColor(1, 1, 1, 0.85)
  ctx.beginPath()
  ctx.arc(ex - s * 0.01, ey - s * 0.015, s * 0.016, 0, Math.PI * 2)
  ctx.fill()
  setColor(0.15, 0.1, 0.05, 0.4)
  ctx.beginPath()
  ctx.arc(bw * 0.7 + wave * 0.5, bh * 0.02, s * 0.015, 0, Math.PI * 2)
  ctx.fill()
}
