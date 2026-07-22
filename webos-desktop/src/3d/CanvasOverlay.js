export class CanvasOverlay {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.buttons = [];
    this.mode = null;
    this.visible = false;
    this.parentEl = canvas.parentElement;
    this.onAction = opts.onAction || (() => {});
    this._mouseX = 0;
    this._mouseY = 0;

    this._resizeBound = () => {
      const w = this.parentEl.clientWidth;
      const h = this.parentEl.clientHeight;
      if (this.canvas.width !== w || this.canvas.height !== h) {
        this.canvas.width = w;
        this.canvas.height = h;
        if (this.visible) this.render();
      }
    };
    window.addEventListener('resize', this._resizeBound);
    this._resizeBound();

    this._onClickBound = (e) => {
      if (!this.visible) return;
      e.stopPropagation();
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const btn = this._hitTest(x, y);
      if (btn) this.onAction(btn);
    };
    this.canvas.addEventListener('click', this._onClickBound);

    this._onMouseMoveBound = (e) => {
      this._mouseX = e.clientX;
      this._mouseY = e.clientY;
    };
    document.addEventListener('mousemove', this._onMouseMoveBound);
  }

  show(mode) {
    this.mode = mode;
    this.visible = true;
    this.canvas.style.pointerEvents = 'auto';
    this._resizeBound();
    this.render();
  }

  hide() {
    this.visible = false;
    this.mode = null;
    this.canvas.style.pointerEvents = 'none';
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.buttons = [];
  }

  isVisible() { return this.visible; }

  getMode() { return this.mode; }

  handleEKey() {
    if (!this.visible) return null;
    const rect = this.canvas.getBoundingClientRect();
    const x = this._mouseX - rect.left;
    const y = this._mouseY - rect.top;
    return this._hitTest(x, y);
  }

  _hitTest(x, y) {
    for (const btn of this.buttons) {
      if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
        return btn;
      }
    }
    return null;
  }

  render() {
    const W = this.canvas.width;
    const H = this.canvas.height;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, W, H);
    if (!this.visible) return;
    if (this.mode === 'pause') this._drawPause(ctx, W, H);
    else if (this.mode === 'colors') this._drawColors(ctx, W, H);
  }

  _drawPause(ctx, W, H) {
    const pw = 320, ph = 300;
    const px = (W - pw) / 2, py = (H - ph) / 2;
    this.buttons = [];

    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, W, H);

    this._roundRect(ctx, px, py, pw, ph, 12);
    ctx.fillStyle = 'rgba(10, 5, 22, 0.92)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(136, 68, 255, 0.3)';
    ctx.lineWidth = 1.5;
    this._roundRect(ctx, px, py, pw, ph, 12);
    ctx.stroke();

    ctx.fillStyle = '#e8e0ff';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Paused', px + pw / 2, py + 50);

    const bw = 200, bh = 44;
    const items = [
      { label: 'Resume', id: 'resume' },
      { label: 'Room Colors', id: 'colors' },
      { label: 'Exit Room', id: 'exit' }
    ];

    const sy = py + 110;
    for (let i = 0; i < items.length; i++) {
      const by = sy + i * (bh + 12);
      const bx = px + (pw - bw) / 2;

      ctx.fillStyle = i === 2 ? 'rgba(255, 50, 50, 0.12)' : 'rgba(136, 68, 255, 0.12)';
      this._roundRect(ctx, bx, by, bw, bh, 8);
      ctx.fill();
      ctx.strokeStyle = i === 2 ? 'rgba(255, 50, 50, 0.25)' : 'rgba(136, 68, 255, 0.25)';
      ctx.lineWidth = 1;
      this._roundRect(ctx, bx, by, bw, bh, 8);
      ctx.stroke();

      ctx.fillStyle = i === 2 ? 'rgba(255, 150, 150, 0.7)' : 'rgba(200, 180, 255, 0.8)';
      ctx.font = '15px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(items[i].label, bx + bw / 2, by + bh / 2);

      this.buttons.push({ x: bx | 0, y: by | 0, w: bw | 0, h: bh | 0, id: items[i].id });
    }
  }

  _drawColors(ctx, W, H) {
    const pw = 360, ph = 320;
    const px = (W - pw) / 2, py = (H - ph) / 2;
    this.buttons = [];

    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, W, H);

    this._roundRect(ctx, px, py, pw, ph, 12);
    ctx.fillStyle = 'rgba(10, 5, 22, 0.92)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(136, 68, 255, 0.3)';
    ctx.lineWidth = 1.5;
    this._roundRect(ctx, px, py, pw, ph, 12);
    ctx.stroke();

    ctx.fillStyle = '#e8e0ff';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Room Colors', px + pw / 2, py + 36);

    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('Wall', px + 24, py + 70);

    const sw = 44, sh = 32, gap = 8;
    const addSwatches = (colors, y, prefix) => {
      for (let i = 0; i < colors.length; i++) {
        const cx = px + 24 + i * (sw + gap);
        this._roundRect(ctx, cx, y, sw, sh, 6);
        ctx.fillStyle = colors[i];
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.lineWidth = 1;
        this._roundRect(ctx, cx, y, sw, sh, 6);
        ctx.stroke();
        this.buttons.push({
          x: cx | 0, y: y | 0, w: sw | 0, h: sh | 0,
          id: prefix + '_' + i,
          type: prefix,
          hex: parseInt(colors[i].slice(1), 16)
        });
      }
    };

    addSwatches(['#3d2840', '#2a1a30', '#4a3060', '#553355', '#334455', '#554433'], py + 88, 'wall');

    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '13px sans-serif';
    ctx.fillText('Floor', px + 24, py + 140);

    addSwatches(['#1e1018', '#2a1820', '#1a1520', '#332233', '#2a2a30'], py + 158, 'floor');

    const bw = 110, bh = 34;
    const bx = px + (pw - bw) / 2;
    const by = py + ph - 44;
    ctx.fillStyle = 'rgba(136, 68, 255, 0.10)';
    this._roundRect(ctx, bx, by, bw, bh, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(136, 68, 255, 0.2)';
    ctx.lineWidth = 1;
    this._roundRect(ctx, bx, by, bw, bh, 8);
    ctx.stroke();
    ctx.fillStyle = 'rgba(200, 180, 255, 0.7)';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('← Back', bx + bw / 2, by + bh / 2);
    this.buttons.push({ x: bx | 0, y: by | 0, w: bw | 0, h: bh | 0, id: 'back' });
  }

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  destroy() {
    window.removeEventListener('resize', this._resizeBound);
    document.removeEventListener('mousemove', this._onMouseMoveBound);
    this.canvas.removeEventListener('click', this._onClickBound);
    if (this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas);
  }
}
