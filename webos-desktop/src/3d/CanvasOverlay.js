export class CanvasOverlay {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.buttons = [];
    this.mode = null;
    this.visible = false;
    this.parentEl = canvas.parentElement;
    this.onAction = opts.onAction || (() => {});
    this.mouseX = 0;
    this.mouseY = 0;
    this.gameState = null;
    this.placementFeedback = null;
    this.feedbackTimer = 0;
    this.heldBookGenre = null;
    this.settings = null;
    this.hoverTitle = null;
    this.settingsScrollY = 0;
    this.achievementsData = null;
    this.achievementsScrollY = 0;
    this.toastQueue = [];
    this.toastActive = false;

    this.resizeBound = () => {
      const w = this.parentEl.clientWidth;
      const h = this.parentEl.clientHeight;
      if (this.canvas.width !== w || this.canvas.height !== h) {
        this.canvas.width = w;
        this.canvas.height = h;
        if (this.visible) this.render();
      }
    };
    window.addEventListener("resize", this.resizeBound);
    this.resizeBound();

    this.onClickBound = (e) => {
      if (!this.visible) return;
      e.stopPropagation();
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const btn = this.hitTest(x, y);
      if (btn) this.onAction(btn);
    };
    this.canvas.addEventListener("click", this.onClickBound);

    this.onMouseMoveBound = (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
    };

    this.onWheelBound = (e) => {
      if (this.mode === "settings") {
        e.preventDefault();
        const H = this.canvas.height;
        const scrollableBottom = H - 60;
        const contentEnd = this.settingsContentEnd || 0;
        const maxScroll = Math.max(0, contentEnd - scrollableBottom + 20);
        this.settingsScrollY += e.deltaY * 0.5;
        this.settingsScrollY = Math.max(0, Math.min(maxScroll, this.settingsScrollY));
        this.render();
      } else if (this.mode === "achievements") {
        e.preventDefault();
        const H = this.canvas.height;
        const scrollBottom = H - 70;
        const scrollTop = 114;
        const scrollHeight = scrollBottom - scrollTop;
        const contentEnd = this.achievementsContentEnd || 0;
        const maxScroll = Math.max(0, contentEnd - scrollTop - scrollHeight + 20);
        this.achievementsScrollY += e.deltaY * 0.5;
        this.achievementsScrollY = Math.max(0, Math.min(maxScroll, this.achievementsScrollY));
        this.render();
      }
    };
  }

  show(mode) {
    this.mode = mode;
    this.visible = true;
    this.canvas.style.pointerEvents = "auto";
    document.addEventListener("mousemove", this.onMouseMoveBound);
    if (mode === "settings") {
      this.settingsScrollY = 0;
      this.settingsCategory = null;
      this.canvas.addEventListener("wheel", this.onWheelBound, { passive: false });
    }
    if (mode === "achievements") {
      this.achievementsScrollY = 0;
      this.canvas.addEventListener("wheel", this.onWheelBound, { passive: false });
    }
    this.resizeBound();
    this.render();
  }

  hide() {
    document.removeEventListener("mousemove", this.onMouseMoveBound);
    this.canvas.removeEventListener("wheel", this.onWheelBound);
    this.visible = false;
    this.mode = null;
    this.canvas.style.pointerEvents = "none";
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.buttons = [];
  }

  isVisible() {
    return this.visible;
  }

  getMode() {
    return this.mode;
  }

  handleEKey() {
    if (!this.visible) return null;
    const rect = this.canvas.getBoundingClientRect();
    const x = this.mouseX - rect.left;
    const y = this.mouseY - rect.top;
    return this.hitTest(x, y);
  }

  hitTest(x, y) {
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
    if (this.hoverTitle) {
      this.drawWAILA(ctx, W, H);
    }
    if (!this.visible) return;
    if (this.mode === "pause") this.drawPause(ctx, W, H);
    else if (this.mode === "colors") this.drawColors(ctx, W, H);
    else if (this.mode === "gameHud") this.drawGameHud(ctx, W, H);
    else if (this.mode === "completion") this.drawCompletion(ctx, W, H);
    else if (this.mode === "settings") this.drawSettings(ctx, W, H);
    else if (this.mode === "achievements") this.drawAchievements(ctx, W, H);
  }

  drawPause(ctx, W, H) {
    this.buttons = [];

    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fillRect(0, 0, W, H);

    const panelWidth = Math.min(Math.max(Math.round(W * 0.38), 360), Math.round(W * 0.45));
    ctx.fillStyle = "rgba(12, 12, 16, 0.95)";
    ctx.fillRect(0, 0, panelWidth, H);
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(panelWidth, 0);
    ctx.lineTo(panelWidth, H);
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 28px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("PAUSED", panelWidth / 2, 44);

    const bw = 220,
      bh = 50;
    const items = [
      { label: "Resume", id: "resume" },
      { label: "Settings", id: "settings" },
      { label: "Achievements", id: "achievements" },
      { label: "Room Colors", id: "colors" },
      { label: "Exit Room", id: "exit" }
    ];
    if (!this.gameState || (!this.gameState.active && !this.gameState.completed)) {
      items.splice(3, 0, { label: "Start Sorting", id: "startGame" });
    }

    const totalH = items.length * bh + (items.length - 1) * 16;
    const sy = Math.max(90, (H - totalH) / 2 + 20);
    for (let i = 0; i < items.length; i++) {
      const by = sy + i * (bh + 16);
      const bx = (panelWidth - bw) / 2;

      ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
      this.roundRect(ctx, bx, by, bw, bh, 10);
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
      ctx.lineWidth = 1;
      this.roundRect(ctx, bx, by, bw, bh, 10);
      ctx.stroke();

      ctx.fillStyle = i === items.length - 1 ? "rgba(255, 200, 200, 0.65)" : "rgba(255, 255, 255, 0.75)";
      ctx.font = "16px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(items[i].label, bx + bw / 2, by + bh / 2);

      this.buttons.push({ x: bx | 0, y: by | 0, w: bw | 0, h: bh | 0, id: items[i].id });
    }
  }

  drawGameHud(ctx, W, H) {
    this.buttons = [];
    if (!this.gameState) return;

    const gs = this.gameState;
    const minutes = Math.floor(gs.elapsed / 60);
    const seconds = Math.floor(gs.elapsed % 60);
    const timeStr = `${minutes}:${String(seconds).padStart(2, "0")}`;
    const accuracy = gs.totalGameCases > 0 ? Math.round((gs.shelvedCorrect / gs.totalGameCases) * 100) : 0;

    ctx.fillStyle = "rgba(15, 15, 20, 0.93)";
    this.roundRect(ctx, 12, 12, 260, 80, 10);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 1;
    this.roundRect(ctx, 12, 12, 260, 80, 10);
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("Score", 24, 20);
    ctx.fillStyle = "#ffcc44";
    ctx.font = "bold 22px sans-serif";
    ctx.fillText(String(gs.score), 80, 18);

    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.font = "13px sans-serif";
    let hudX = 24;
    const showTimer = !this.settings || this.settings.gameplay.timer;
    if (showTimer) {
      ctx.fillText(timeStr, hudX, 50);
      hudX += 80;
    }
    ctx.fillText(`${gs.remaining} left`, hudX, 50);
    ctx.fillText(`${accuracy}%`, hudX + 80, 50);

    ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
    this.roundRect(ctx, 24, 68, 236, 4, 2);
    ctx.fill();
    const progress = gs.totalGameCases > 0 ? gs.shelvedCorrect / gs.totalGameCases : 0;
    ctx.fillStyle = "rgba(68, 255, 136, 0.6)";
    this.roundRect(ctx, 24, 68, 236 * progress, 4, 2);
    ctx.fill();

    if (this.placementFeedback) {
      const fb = this.placementFeedback;
      const fbAge = (performance.now() - fb.timestamp) / 1000;
      if (fbAge < 1.5) {
        const alpha = Math.max(0, 1 - fbAge / 1.5);
        ctx.fillStyle = fb.correct ? `rgba(68, 255, 136, ${alpha * 0.9})` : `rgba(255, 68, 68, ${alpha * 0.9})`;
        ctx.font = "bold 28px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(fb.correct ? "✓ Correct!" : "✗ Wrong shelf!", W / 2, H / 2 - 40);
      } else {
        this.placementFeedback = null;
      }
    }

    const showHints = !this.settings || this.settings.gameplay.genreHints;
    if (this.heldBookGenre && showHints) {
      const genreInfo = {
        horror: "Horror",
        strategy: "Strategy",
        casual: "Casual",
        puzzle: "Puzzle",
        action: "Action",
        adventure: "Adventure",
        simulation: "Simulation",
        rpg: "RPG"
      };
      const genreColors = {
        horror: "#ff4444",
        strategy: "#4488ff",
        casual: "#44cc88",
        puzzle: "#00ddff",
        action: "#ff8800",
        adventure: "#ffcc00",
        simulation: "#66cccc",
        rpg: "#ff44aa"
      };
      const label = genreInfo[this.heldBookGenre] || this.heldBookGenre;
      const color = genreColors[this.heldBookGenre] || "#ffffff";
      ctx.fillStyle = "rgba(10, 5, 22, 0.7)";
      this.roundRect(ctx, W / 2 - 50, H / 2 + 20, 100, 26, 6);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.font = "bold 13px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, W / 2, H / 2 + 33);
    }
  }

  drawCompletion(ctx, W, H) {
    this.buttons = [];
    if (!this.gameState) return;

    const results = this.gameState.getResults();

    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fillRect(0, 0, W, H);

    const panelWidth = Math.min(Math.max(Math.round(W * 0.38), 360), Math.round(W * 0.45));
    ctx.fillStyle = "rgba(12, 12, 16, 0.95)";
    ctx.fillRect(0, 0, panelWidth, H);
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(panelWidth, 0);
    ctx.lineTo(panelWidth, H);
    ctx.stroke();

    ctx.fillStyle = "#44ff88";
    ctx.font = "bold 28px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("LIBRARY COMPLETE!", panelWidth / 2, 48);

    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.font = "16px sans-serif";
    const lines = [
      `Score: ${results.score}`,
      `Time: ${results.time}`,
      `Accuracy: ${results.accuracy}%`,
      `Correct: ${results.correct} / ${results.total}`,
      `Wrong: ${results.wrong}`
    ];
    const statsY = Math.max(90, (H - lines.length * 34) / 2);
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], panelWidth / 2, statsY + i * 34);
    }

    const grade =
      results.accuracy >= 90
        ? "S"
        : results.accuracy >= 75
          ? "A"
          : results.accuracy >= 60
            ? "B"
            : results.accuracy >= 40
              ? "C"
              : "D";
    const gradeColor =
      grade === "S"
        ? "#ffcc00"
        : grade === "A"
          ? "#44ff88"
          : grade === "B"
            ? "#4488ff"
            : grade === "C"
              ? "#ff8844"
              : "#ff4444";
    ctx.fillStyle = gradeColor;
    ctx.font = "bold 72px sans-serif";
    ctx.fillText(grade, panelWidth / 2, statsY + lines.length * 34 + 50);

    const bw = 180,
      bh = 48;
    const bx = (panelWidth - bw) / 2;
    const by = H - 90;
    ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
    this.roundRect(ctx, bx, by, bw, bh, 10);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    ctx.lineWidth = 1;
    this.roundRect(ctx, bx, by, bw, bh, 10);
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
    ctx.font = "16px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Exit Room", bx + bw / 2, by + bh / 2);
    this.buttons.push({ x: bx | 0, y: by | 0, w: bw | 0, h: bh | 0, id: "exit" });
  }

  setGameState(gs) {
    this.gameState = gs;
  }

  setSettings(s) {
    this.settings = s;
  }

  showPlacementFeedback(correct) {
    this.placementFeedback = { correct, timestamp: performance.now() };
  }

  setHeldBookGenre(genre) {
    this.heldBookGenre = genre;
  }

  setHoverTitle(title) {
    this.hoverTitle = title;
    this.render();
  }

  setAchievementsData(items) {
    this.achievementsData = items;
  }

  showAchievementToast(title, desc, rarity) {
    this.toastQueue.push({ title, desc, rarity });
    if (!this.toastActive) this.processToastQueue();
  }

  processToastQueue() {
    if (this.toastQueue.length === 0) {
      this.toastActive = false;
      return;
    }
    this.toastActive = true;
    const { title, desc, rarity } = this.toastQueue.shift();

    const el = document.createElement("div");
    el.style.cssText =
      "position:fixed;top:20px;right:20px;z-index:1000000;background:rgba(12,12,16,0.96);border-left:4px solid var(--ach-color,#44ff88);border-radius:10px;padding:14px 18px;min-width:260px;max-width:340px;box-shadow:0 8px 32px rgba(0,0,0,0.6);opacity:0;transform:translateX(40px);transition:opacity 0.35s ease,transform 0.35s ease;pointer-events:auto;font-family:sans-serif";
    const rarityColors = {
      common: "#aaaaaa",
      uncommon: "#44cc88",
      rare: "#4488ff",
      epic: "#ff44aa",
      legendary: "#ffcc00"
    };
    const color = rarityColors[rarity] || "#aaaaaa";
    el.style.borderLeftColor = color;
    el.innerHTML =
      '<div style="display:flex;align-items:center;gap:10px">' +
      '<div style="width:32px;height:32px;border-radius:50%;background:' +
      color +
      "22;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:14px;color:" +
      color +
      ';font-weight:bold">&#9733;</div>' +
      '<div style="flex:1;min-width:0">' +
      '<div style="font-size:11px;color:' +
      color +
      ';text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px;font-weight:600">Achievement Unlocked</div>' +
      '<div style="font-size:15px;color:#fff;font-weight:bold;line-height:1.3">' +
      title +
      "</div>" +
      '<div style="font-size:12px;color:rgba(255,255,255,0.55);margin-top:2px">' +
      desc +
      "</div>" +
      "</div>" +
      '<div style="font-size:10px;color:' +
      color +
      ';text-transform:uppercase;font-weight:600;opacity:0.7">' +
      rarity +
      "</div>" +
      "</div>";

    document.body.appendChild(el);
    requestAnimationFrame(() => {
      el.style.opacity = "1";
      el.style.transform = "translateX(0)";
    });

    setTimeout(() => {
      el.style.opacity = "0";
      el.style.transform = "translateX(40px)";
      setTimeout(() => {
        if (el.parentNode) el.parentNode.removeChild(el);
        this.processToastQueue();
      }, 380);
    }, 4000);
  }

  drawAchievements(ctx, W, H) {
    this.buttons = [];

    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fillRect(0, 0, W, H);

    const panelWidth = Math.min(Math.max(Math.round(W * 0.38), 360), Math.round(W * 0.45));
    ctx.fillStyle = "rgba(12, 12, 16, 0.95)";
    ctx.fillRect(0, 0, panelWidth, H);
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(panelWidth, 0);
    ctx.lineTo(panelWidth, H);
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 28px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("ACHIEVEMENTS", panelWidth / 2, 44);

    const items = this.achievementsData;
    const padX = 28;
    const colLeft = padX;
    const colRight = panelWidth - padX;

    if (!items || items.length === 0) {
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.font = "15px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("No achievements data", panelWidth / 2, H / 2);
      return;
    }

    const stats = { total: items.length, unlocked: items.filter((a) => a.unlocked).length };
    stats.percentage = Math.round((stats.unlocked / stats.total) * 100);

    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "13px sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(stats.unlocked + " / " + stats.total + "  (" + stats.percentage + "%)", colLeft, 80);

    const barX = colLeft;
    const barY = 96;
    const barW = panelWidth - padX * 2;
    const barH = 4;
    ctx.fillStyle = "rgba(255,255,255,0.1)";
    this.roundRect(ctx, barX, barY, barW, barH, 2);
    ctx.fill();
    ctx.fillStyle = "rgba(68, 255, 136, 0.6)";
    this.roundRect(ctx, barX, barY, barW * (stats.unlocked / stats.total), barH, 2);
    ctx.fill();

    const scrollTop = 114;
    const scrollBottom = H - 70;
    const scrollHeight = scrollBottom - scrollTop;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, scrollTop, panelWidth, scrollHeight);
    ctx.clip();

    const rarityColors = {
      common: "#aaaaaa",
      uncommon: "#44cc88",
      rare: "#4488ff",
      epic: "#ff44aa",
      legendary: "#ffcc00"
    };
    const cardH = 70;
    const cardGap = 8;
    let y = scrollTop + 8 - this.achievementsScrollY;

    for (const item of items) {
      if (y + cardH < scrollTop) {
        y += cardH + cardGap;
        continue;
      }
      if (y > scrollBottom) break;

      const color = rarityColors[item.rarity] || "#aaaaaa";

      ctx.fillStyle = item.unlocked ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.03)";
      this.roundRect(ctx, colLeft, y, panelWidth - padX * 2, cardH, 8);
      ctx.fill();

      ctx.fillStyle = color;
      ctx.fillRect(colLeft, y, 3, cardH);

      const starX = colLeft + 16;
      ctx.fillStyle = item.unlocked ? color : "rgba(255,255,255,0.15)";
      ctx.font = "16px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("\u2605", starX, y + cardH / 2);

      const textX = colLeft + 40;
      ctx.fillStyle = item.unlocked ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.35)";
      ctx.font = "bold 14px sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(item.title, textX, y + 24);

      ctx.fillStyle = item.unlocked ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.2)";
      ctx.font = "12px sans-serif";
      ctx.fillText(item.desc, textX, y + 48);

      if (!item.unlocked) {
        ctx.fillStyle = "rgba(255,255,255,0.15)";
        ctx.font = "14px sans-serif";
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.fillText("\u{1F512}", colRight - 8, y + cardH / 2);
      } else {
        ctx.fillStyle = color;
        ctx.font = "11px sans-serif";
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        const date = new Date(item.unlockedAt).toLocaleDateString();
        ctx.fillText(date, colRight - 8, y + cardH - 12);
        ctx.fillStyle = color;
        ctx.font = "12px sans-serif";
        ctx.fillText("\u2713", colRight - 8, y + 18);
      }

      y += cardH + cardGap;
    }

    this.achievementsContentEnd = y + this.achievementsScrollY;

    ctx.restore();

    const by = H - 50;
    const bw = 140;
    const bh = 40;
    const bx = (panelWidth - bw) / 2;
    this.roundRect(ctx, bx, by, bw, bh, 10);
    ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    ctx.lineWidth = 1;
    this.roundRect(ctx, bx, by, bw, bh, 10);
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
    ctx.font = "16px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("\u2190 Back", bx + bw / 2, by + bh / 2);
    this.buttons.push({ x: bx | 0, y: by | 0, w: bw | 0, h: bh | 0, id: "achievements_back" });
  }

  destroy() {
    window.removeEventListener("resize", this.resizeBound);
    document.removeEventListener("mousemove", this.onMouseMoveBound);
    this.canvas.removeEventListener("click", this.onClickBound);
    if (this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas);
  }

  drawColors(ctx, W, H) {
    this.buttons = [];

    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fillRect(0, 0, W, H);

    const panelWidth = Math.min(Math.max(Math.round(W * 0.38), 360), Math.round(W * 0.45));
    ctx.fillStyle = "rgba(12, 12, 16, 0.95)";
    ctx.fillRect(0, 0, panelWidth, H);
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(panelWidth, 0);
    ctx.lineTo(panelWidth, H);
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 28px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("ROOM COLORS", panelWidth / 2, 44);

    const sw = 56,
      sh = 44,
      gap = 12;
    const startY = 100;

    const addSwatches = (colors, y, prefix) => {
      const totalW = colors.length * sw + (colors.length - 1) * gap;
      const sx = (panelWidth - totalW) / 2;
      for (let i = 0; i < colors.length; i++) {
        const cx = sx + i * (sw + gap);
        this.roundRect(ctx, cx, y, sw, sh, 10);
        ctx.fillStyle = colors[i];
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.12)";
        ctx.lineWidth = 1;
        this.roundRect(ctx, cx, y, sw, sh, 10);
        ctx.stroke();
        this.buttons.push({
          x: cx | 0,
          y: y | 0,
          w: sw | 0,
          h: sh | 0,
          id: prefix + "_" + i,
          type: prefix,
          hex: parseInt(colors[i].slice(1), 16)
        });
      }
    };

    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = "14px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Wall", panelWidth / 2, startY - 28);

    addSwatches(["#16162a", "#12122a", "#1a1a30", "#14142a", "#181830", "#1e1e32"], startY, "wall");

    const floorY = startY + 80;
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = "14px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Floor", panelWidth / 2, floorY - 28);

    addSwatches(["#0a0a18", "#0e0e1a", "#080814", "#0c0c1c", "#101020"], floorY, "floor");

    const bw = 130,
      bh = 42;
    const bx = (panelWidth - bw) / 2;
    const by = H - 80;
    ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
    this.roundRect(ctx, bx, by, bw, bh, 10);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    ctx.lineWidth = 1;
    this.roundRect(ctx, bx, by, bw, bh, 10);
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
    ctx.font = "16px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("← Back", bx + bw / 2, by + bh / 2);
    this.buttons.push({ x: bx | 0, y: by | 0, w: bw | 0, h: bh | 0, id: "back" });
  }

  drawSettings(ctx, W, H) {
    if (!this.settings) return;
    const s = this.settings;
    this.buttons = [];

    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fillRect(0, 0, W, H);

    const panelWidth = Math.min(Math.max(Math.round(W * 0.38), 360), Math.round(W * 0.45));
    ctx.fillStyle = "rgba(12, 12, 16, 0.95)";
    ctx.fillRect(0, 0, panelWidth, H);
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(panelWidth, 0);
    ctx.lineTo(panelWidth, H);
    ctx.stroke();

    const padX = 28;
    const colLeft = padX;
    const colRight = panelWidth - padX;
    const toggleW = 44,
      toggleH = 24;

    const drawToggle = (x, y, w, h, on) => {
      this.roundRect(ctx, x, y, w, h, 12);
      ctx.fillStyle = on ? "rgba(68, 255, 136, 0.4)" : "rgba(255, 255, 255, 0.1)";
      ctx.fill();
      ctx.strokeStyle = on ? "rgba(68, 255, 136, 0.6)" : "rgba(255, 255, 255, 0.15)";
      ctx.lineWidth = 1;
      this.roundRect(ctx, x, y, w, h, 12);
      ctx.stroke();
      const dotX = on ? x + w - 12 : x + 12;
      ctx.fillStyle = on ? "#44ff88" : "rgba(255,255,255,0.4)";
      ctx.beginPath();
      ctx.arc(dotX, y + h / 2, 7, 0, Math.PI * 2);
      ctx.fill();
    };

    const drawRow = (y, label, controlFn) => {
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.font = "15px sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(label, colLeft, y + 14);
      controlFn();
    };

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 28px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("SETTINGS", panelWidth / 2, 44);

    if (!this.settingsCategory) {
      this.drawSettingsCategoryList(ctx, W, H, panelWidth, colLeft, colRight);
      return;
    }

    const scrollTop = 70;
    const scrollBottom = H - 60;
    const scrollHeight = scrollBottom - scrollTop;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, scrollTop, panelWidth, scrollHeight);
    ctx.clip();

    let y = 90;
    const rowH = 32;

    if (this.settingsCategory === "visuals") {
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText("VISUALS", colLeft, y + 9);
      y += 26;
      drawRow(y, "Day/Night", () => {
        const tx = colRight - toggleW;
        drawToggle(tx, y + 4, toggleW, toggleH, s.visuals.dayNight);
        this.buttons.push({ x: tx, y: y + 4, w: toggleW, h: toggleH, id: "settings_visuals_dayNight" });
      });
      y += rowH;
      drawRow(y, "Lamp", () => {
        const tx = colRight - toggleW;
        drawToggle(tx, y + 4, toggleW, toggleH, s.visuals.lamp);
        this.buttons.push({ x: tx, y: y + 4, w: toggleW, h: toggleH, id: "settings_visuals_lamp" });
      });
      y += rowH;
    } else if (this.settingsCategory === "audio") {
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText("AUDIO", colLeft, y + 9);
      y += 26;
      drawRow(y, "Master Volume", () => {
        const btnW = 32,
          btnH = 28;
        const volText = String(s.audio.masterVolume.toFixed(2));
        const volTextWidth = ctx.measureText(volText).width;
        const plusX = colRight - btnW;
        const minusX = plusX - 10 - volTextWidth - 10 - btnW;
        this.roundRect(ctx, minusX, y + 3, btnW, btnH, 8);
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.12)";
        ctx.lineWidth = 1;
        this.roundRect(ctx, minusX, y + 3, btnW, btnH, 8);
        ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,0.8)";
        ctx.font = "18px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("-", minusX + btnW / 2, y + 19);
        this.buttons.push({ x: minusX, y: y + 3, w: btnW, h: btnH, id: "settings_audio_masterDown" });
        ctx.fillStyle = "rgba(255,255,255,0.6)";
        ctx.font = "bold 15px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(volText, (minusX + btnW + plusX) / 2, y + 19);
        this.roundRect(ctx, plusX, y + 3, btnW, btnH, 8);
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.12)";
        ctx.lineWidth = 1;
        this.roundRect(ctx, plusX, y + 3, btnW, btnH, 8);
        ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,0.8)";
        ctx.font = "18px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("+", plusX + btnW / 2, y + 19);
        this.buttons.push({ x: plusX, y: y + 3, w: btnW, h: btnH, id: "settings_audio_masterUp" });
      });
      y += rowH;
      drawRow(y, "UI Sounds", () => {
        const tx = colRight - toggleW;
        drawToggle(tx, y + 4, toggleW, toggleH, s.audio.ui);
        this.buttons.push({ x: tx, y: y + 4, w: toggleW, h: toggleH, id: "settings_audio_ui" });
      });
      y += rowH;
      drawRow(y, "Footstep Sounds", () => {
        const tx = colRight - toggleW;
        drawToggle(tx, y + 4, toggleW, toggleH, s.audio.footstep);
        this.buttons.push({ x: tx, y: y + 4, w: toggleW, h: toggleH, id: "settings_audio_footstep" });
      });
      y += rowH;
      drawRow(y, "Ambient Sounds", () => {
        const tx = colRight - toggleW;
        drawToggle(tx, y + 4, toggleW, toggleH, s.audio.ambient);
        this.buttons.push({ x: tx, y: y + 4, w: toggleW, h: toggleH, id: "settings_audio_ambient" });
      });
      y += rowH;
    } else if (this.settingsCategory === "gameplay") {
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText("GAMEPLAY", colLeft, y + 9);
      y += 26;
      drawRow(y, "Genre Hints", () => {
        const tx = colRight - toggleW;
        drawToggle(tx, y + 4, toggleW, toggleH, s.gameplay.genreHints);
        this.buttons.push({ x: tx, y: y + 4, w: toggleW, h: toggleH, id: "settings_gameplay_genreHints" });
      });
      y += rowH;
      drawRow(y, "Timer", () => {
        const tx = colRight - toggleW;
        drawToggle(tx, y + 4, toggleW, toggleH, s.gameplay.timer);
        this.buttons.push({ x: tx, y: y + 4, w: toggleW, h: toggleH, id: "settings_gameplay_timer" });
      });
      y += rowH;
    } else if (this.settingsCategory === "editor") {
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText("EDITOR", colLeft, y + 9);
      y += 26;
      drawRow(y, "Snap Toggle", () => {
        const tx = colRight - toggleW;
        drawToggle(tx, y + 4, toggleW, toggleH, s.editor.snap);
        this.buttons.push({ x: tx, y: y + 4, w: toggleW, h: toggleH, id: "settings_editor_snap" });
      });
      y += rowH;
      drawRow(y, "Snap Size", () => {
        const btnW = 32,
          btnH = 28;
        const snapText = String(s.editor.snapSize.toFixed(2));
        const snapTextWidth = ctx.measureText(snapText).width;
        const plusX = colRight - btnW;
        const minusX = plusX - 10 - snapTextWidth - 10 - btnW;
        this.roundRect(ctx, minusX, y + 3, btnW, btnH, 8);
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.12)";
        ctx.lineWidth = 1;
        this.roundRect(ctx, minusX, y + 3, btnW, btnH, 8);
        ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,0.8)";
        ctx.font = "18px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("-", minusX + btnW / 2, y + 19);
        this.buttons.push({ x: minusX, y: y + 3, w: btnW, h: btnH, id: "settings_editor_snapSizeDown" });
        ctx.fillStyle = "rgba(255,255,255,0.6)";
        ctx.font = "bold 15px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(snapText, (minusX + btnW + plusX) / 2, y + 19);
        this.roundRect(ctx, plusX, y + 3, btnW, btnH, 8);
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.12)";
        ctx.lineWidth = 1;
        this.roundRect(ctx, plusX, y + 3, btnW, btnH, 8);
        ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,0.8)";
        ctx.font = "18px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("+", plusX + btnW / 2, y + 19);
        this.buttons.push({ x: plusX, y: y + 3, w: btnW, h: btnH, id: "settings_editor_snapSizeUp" });
      });
      y += rowH;
    } else if (this.settingsCategory === "graphics") {
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText("GRAPHICS", colLeft, y + 9);
      y += 26;
      drawRow(y, "Quality", () => {
        const qBtnW = 80,
          qBtnH = 24;
        const qx = colRight - qBtnW;
        const qualityLabels = { low: "Low", medium: "Medium", high: "High", ultra: "Ultra (Demanding)" };
        const qText = qualityLabels[s.graphics.quality] || "Medium";
        this.roundRect(ctx, qx, y + 4, qBtnW, qBtnH, 8);
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.12)";
        ctx.lineWidth = 1;
        this.roundRect(ctx, qx, y + 4, qBtnW, qBtnH, 8);
        ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,0.75)";
        ctx.font = "13px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(qText, qx + qBtnW / 2, y + 4 + qBtnH / 2);
        this.buttons.push({ x: qx, y: y + 4, w: qBtnW, h: qBtnH, id: "settings_graphics_quality" });
      });
      y += rowH;
      drawRow(y, "Bloom", () => {
        const tx = colRight - toggleW;
        drawToggle(tx, y + 4, toggleW, toggleH, s.graphics.bloom);
        this.buttons.push({ x: tx, y: y + 4, w: toggleW, h: toggleH, id: "settings_graphics_bloom" });
      });
      y += rowH;
      drawRow(y, "Shadows", () => {
        const tx = colRight - toggleW;
        drawToggle(tx, y + 4, toggleW, toggleH, s.graphics.shadows);
        this.buttons.push({ x: tx, y: y + 4, w: toggleW, h: toggleH, id: "settings_graphics_shadows" });
      });
      y += rowH;
      drawRow(y, "Dust Particles", () => {
        const tx = colRight - toggleW;
        drawToggle(tx, y + 4, toggleW, toggleH, s.graphics.dust);
        this.buttons.push({ x: tx, y: y + 4, w: toggleW, h: toggleH, id: "settings_graphics_dust" });
      });
      y += rowH;
      drawRow(y, "Curtain Sway", () => {
        const tx = colRight - toggleW;
        drawToggle(tx, y + 4, toggleW, toggleH, s.graphics.curtainSway);
        this.buttons.push({ x: tx, y: y + 4, w: toggleW, h: toggleH, id: "settings_graphics_curtainSway" });
      });
      y += rowH;
    }

    this.settingsContentEnd = y;

    ctx.restore();

    const by = H - 50;
    const bw = 140,
      bh = 40;
    const bx = (panelWidth - bw) / 2;
    this.roundRect(ctx, bx, by, bw, bh, 10);
    ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    ctx.lineWidth = 1;
    this.roundRect(ctx, bx, by, bw, bh, 10);
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
    ctx.font = "16px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("← Back", bx + bw / 2, by + bh / 2);
    this.buttons.push({ x: bx | 0, y: by | 0, w: bw | 0, h: bh | 0, id: "settings_back" });
  }

  drawSettingsCategoryList(ctx, W, H, panelWidth, colLeft, colRight) {
    const categories = [
      { id: "graphics", label: "Graphics" },
      { id: "visuals", label: "Visuals" },
      { id: "audio", label: "Audio" },
      { id: "gameplay", label: "Gameplay" },
      { id: "editor", label: "Editor" }
    ];

    const btnW = panelWidth - colLeft * 2;
    const btnH = 44;
    const startY = 90;
    const gap = 10;

    for (let i = 0; i < categories.length; i++) {
      const by = startY + i * (btnH + gap);
      this.roundRect(ctx, colLeft, by, btnW, btnH, 10);
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.lineWidth = 1;
      this.roundRect(ctx, colLeft, by, btnW, btnH, 10);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.font = "16px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(categories[i].label, panelWidth / 2, by + btnH / 2);
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.font = "14px sans-serif";
      ctx.fillText("›", colRight - 16, by + btnH / 2);
      this.buttons.push({ x: colLeft, y: by, w: btnW, h: btnH, id: "settings_cat_" + categories[i].id });
    }

    const by = H - 50;
    const bw = 140,
      bh = 40;
    const bx = (panelWidth - bw) / 2;
    this.roundRect(ctx, bx, by, bw, bh, 10);
    ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    ctx.lineWidth = 1;
    this.roundRect(ctx, bx, by, bw, bh, 10);
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
    ctx.font = "16px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("← Back", bx + bw / 2, by + bh / 2);
    this.buttons.push({ x: bx | 0, y: by | 0, w: bw | 0, h: bh | 0, id: "back" });
  }

  drawWAILA(ctx, W, H) {
    const title = this.hoverTitle;
    if (!title) return;
    ctx.font = "bold 14px sans-serif";
    const textW = ctx.measureText(title).width;
    const padX = 16,
      padY = 8;
    const boxW = textW + padX * 2;
    const boxH = 30;
    const bx = 12;
    const by = 12;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    this.roundRect(ctx, bx, by, boxW, boxH, 6);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(title, bx + padX, by + boxH / 2);
  }

  roundRect(ctx, x, y, w, h, r) {
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
}
