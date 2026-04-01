import { desktop } from "./desktop.js";
import { StorageKeys } from "./settings.js";
import confetti from "canvas-confetti";
export const Achievements = {
  WelcomeAboard: "first_boot",
  MultiTasker: "window_manager",
  NoteTaker: "note_taker",
  ArchiveHandler: "archive_handler",
  PersonalSpace: "personal_space",
  DesktopStylist: "desktop_stylist",
  OrganizedDesktop: "organized_desktop",
  AppCollector: "app_collector",
  DeveloperMode: "developer_mode",
  DeveloperModeSuper: "developer_mode_super",
  TerminalUser: "terminal_user",
  TerminalUserSuper: "terminal_user_super",
  OfficeWorker: "office_worker",
  ModelViewer: "model_viewer",
  FirstGame: "first_game",
  GameHopper: "game_hopper",
  GameHopperMega: "game_hopper_mega",
  EmulatorFan: "emulator_fan",
  RetroPlayer: "retro_player",
  ChaosMode: "chaos_mode",
  FileHoarder: "file_hoarder",
  RegularUser: "regular_user",
  SystemVeteran: "system_veteran",
  Completionist: "completionist"
};

export class AchievementsApp {
  constructor(windowManager) {
    this.wm = windowManager;
    this.achievements = this._createAchievements();
    this.unlocked = new Set();
    this.s1 = new Audio("/static/audio/steam.mp3");
    this.s2 = new Audio("/static/audio/slime1.mp3");
    this.s3 = new Audio("/static/audio/slime2.mp3");
    window.achievements = this;
    this._thresholds = {
      openWindows: [
        { at: 5, key: Achievements.MultiTasker },
        { at: 10, key: Achievements.ChaosMode }
      ],
      appLaunched: [{ at: 15, key: Achievements.AppCollector }],
      terminalCmd: [
        { at: 5, key: Achievements.TerminalUser },
        { at: 50, key: Achievements.TerminalUserSuper }
      ],
      gameLaunched: [
        { at: 1, key: Achievements.FirstGame },
        { at: 10, key: Achievements.GameHopper },
        { at: 100, key: Achievements.GameHopperMega }
      ],
      wallpaper: [{ at: 5, key: Achievements.DesktopStylist }],
      desktopFile: [{ at: 15, key: Achievements.OrganizedDesktop }],
      fileUploaded: [{ at: 100, key: Achievements.FileHoarder }],
      session: [
        { at: 5, key: Achievements.RegularUser },
        { at: 20, key: Achievements.SystemVeteran }
      ],
      developerMode: [
        { at: 1, key: Achievements.DeveloperMode },
        { at: 10, key: Achievements.DeveloperModeSuper }
      ]
    };
    this._counters = {};
    this._achievementQueue = [];
    this._isShowingAchievement = false;
    this._loadFromStorage();
  }

  _createAchievements() {
    return [
      {
        id: Achievements.WelcomeAboard,
        title: "Welcome Aboard",
        desc: "Launch Yuki OS for the first time",
        icon: "fa-power-off"
      },
      {
        id: Achievements.MultiTasker,
        title: "Multitasker",
        desc: "Run 5 apps simultaneously",
        icon: "fa-window-maximize"
      },
      {
        id: Achievements.ChaosMode,
        title: "Chaos Mode",
        desc: "Open 10 apps at once",
        icon: "fa-fire"
      },
      {
        id: Achievements.NoteTaker,
        title: "Note Taker",
        desc: "Create and save a document",
        icon: "fa-note-sticky"
      },
      {
        id: Achievements.ArchiveHandler,
        title: "Archive Handler",
        desc: "Extract a compressed archive",
        icon: "fa-file-zipper"
      },
      {
        id: Achievements.PersonalSpace,
        title: "Personal Space",
        desc: "Upload a custom wallpaper",
        icon: "fa-image"
      },
      {
        id: Achievements.DesktopStylist,
        title: "Desktop Stylist",
        desc: "Change wallpaper 5 times",
        icon: "fa-paintbrush"
      },
      {
        id: Achievements.OrganizedDesktop,
        title: "Organized Desktop",
        desc: "Arrange 15 files on desktop",
        icon: "fa-th"
      },
      {
        id: Achievements.AppCollector,
        title: "App Collector",
        desc: "Launch 15 different apps",
        icon: "fa-th-large"
      },
      {
        id: Achievements.DeveloperMode,
        title: "Developer Mode",
        desc: "Use Python or Node.js IDE or Terminal",
        icon: "fa-code"
      },
      {
        id: Achievements.DeveloperModeSuper,
        title: "Super Developer Mode",
        desc: "Write neofetch on terminal",
        icon: "fa-code"
      },
      {
        id: Achievements.TerminalUser,
        title: "Terminal User",
        desc: "Execute 5 commands in terminal",
        icon: "fa-terminal"
      },
      {
        id: Achievements.TerminalUserSuper,
        title: "Terminal Pro",
        desc: "Execute 50 commands in terminal",
        icon: "fa-terminal"
      },
      {
        id: Achievements.OfficeWorker,
        title: "Office Worker",
        desc: "Create a document in office suite",
        icon: "fa-file-word"
      },
      {
        id: Achievements.ModelViewer,
        title: "Model Viewer",
        desc: "View a 3D model",
        icon: "fa-cube"
      },
      {
        id: Achievements.FirstGame,
        title: "First Game",
        desc: "Launch any game",
        icon: "fa-gamepad"
      },
      {
        id: Achievements.GameHopper,
        title: "Game Hopper",
        desc: "Play 10 games",
        icon: "fa-dice"
      },
      {
        id: Achievements.GameHopperMega,
        title: "Mega Game Hopper",
        desc: "Play 100 games",
        icon: "fa-dice"
      },
      {
        id: Achievements.EmulatorFan,
        title: "Emulator Fan",
        desc: "Run a ROM",
        icon: "fa-microchip"
      },
      {
        id: Achievements.RetroPlayer,
        title: "Retro Player",
        desc: "Play a DOS game",
        icon: "fa-ghost"
      },
      {
        id: Achievements.FileHoarder,
        title: "File Hoarder",
        desc: "Upload 100 files",
        icon: "fa-box-archive"
      },
      {
        id: Achievements.RegularUser,
        title: "Regular User",
        desc: "Use the OS across 5 sessions",
        icon: "fa-user-clock"
      },
      {
        id: Achievements.SystemVeteran,
        title: "System Veteran",
        desc: "Use the OS across 20 sessions",
        icon: "fa-user-clock"
      },
      {
        id: Achievements.Completionist,
        title: "Completionist",
        desc: "Unlock all achievements",
        icon: "fa-trophy"
      }
    ];
  }

  _loadFromStorage() {
    try {
      const saved = localStorage.getItem(StorageKeys.achievements);
      if (saved) this.unlocked = new Set(JSON.parse(saved));
      const savedCounters = localStorage.getItem(StorageKeys.achievementCounters);
      if (savedCounters) this._counters = JSON.parse(savedCounters);
    } catch (e) {}
  }

  _saveToStorage() {
    try {
      localStorage.setItem(StorageKeys.achievements, JSON.stringify([...this.unlocked]));
      localStorage.setItem(StorageKeys.achievementCounters, JSON.stringify(this._counters));
    } catch (e) {}
  }

  _renderGrid(filter) {
    return this.achievements
      .filter((a) => {
        if (filter === "unlocked") return this.unlocked.has(a.id);
        if (filter === "locked") return !this.unlocked.has(a.id);
        return true;
      })
      .map((a) => {
        const on = this.unlocked.has(a.id);
        return `
          <div class="achievement-item ${on ? "achievement-item--unlocked" : ""}">
            <i class="fas ${a.icon} achievement-item__icon ${on ? "achievement-item__icon--unlocked" : ""}"></i>
            <div>
              <div class="achievement-item__title ${on ? "achievement-item__title--unlocked" : ""}">${a.title}</div>
              <div class="achievement-item__desc">${a.desc}</div>
            </div>
          </div>
        `;
      })
      .join("");
  }

  _renderProgress() {
    const total = this.achievements.length;
    const done = this.unlocked.size;
    const pct = Math.round((done / total) * 100);
    return `
      <div class="achievements-progress">
        <div class="achievements-progress__label">
          <span>${done} / ${total} achievements</span>
          <span>${pct}%</span>
        </div>
        <div class="achievements-progress__track">
          <div class="achievements-progress__fill" style="width: ${pct}%"></div>
        </div>
      </div>
    `;
  }

  _renderToggle(current) {
    const opts = [
      { val: "all", label: "All" },
      { val: "unlocked", label: "Unlocked" },
      { val: "locked", label: "Locked" }
    ];
    return `
      <div class="achievements-toggle">
        ${opts
          .map(
            (o) => `
          <button
            class="achievements-toggle__btn ${current === o.val ? "achievements-toggle__btn--active" : ""}"
            onclick="window.achievements._setFilter('${o.val}')"
          >${o.label}</button>
        `
          )
          .join("")}
      </div>
    `;
  }

  _setFilter(filter) {
    this._currentFilter = filter;
    this.refresh();
  }

  open() {
    const winId = "achievements-yukios";
    const existing = document.getElementById(winId);
    if (existing) {
      this.wm.bringToFront(existing);
      return;
    }

    this._currentFilter = "all";

    const win = this.wm.createWindow(winId, "Achievements", "760px", "700px");
    Object.assign(win.style, { left: "200px", top: "90px" });

    win.innerHTML = `
      <div class="window-header">
        <span>Achievements</span>
        ${this.wm.getWindowControls()}
      </div>
      <div class="window-content achievements-content">
        <div class="achievements-scroll">
          <div class="achievements-hero">
            <i class="fas fa-star achievements-hero__icon"></i>
          </div>
          ${this._renderProgress()}
          ${this._renderToggle(this._currentFilter)}
          <div class="achievements-grid">
            ${this._renderGrid(this._currentFilter)}
          </div>
        </div>
      </div>
    `;

    desktop.appendChild(win);
    this.wm.makeDraggable(win);
    this.wm.makeResizable(win);
    this.wm.setupWindowControls(win);
    this.wm.addToTaskbar(win.id, "Achievements", "fa fa-trophy");
  }

  trigger(achievementKey) {
    if (!this.achievements.find((a) => a.id === achievementKey)) {
      return;
    }
    if (this.unlocked.has(achievementKey)) return;

    this.unlocked.add(achievementKey);
    this._saveToStorage();
    this._queueAchievement(achievementKey);
    this.refresh();

    if (this.unlocked.size === this.achievements.length && !this.unlocked.has(Achievements.Completionist)) {
      setTimeout(() => {
        this.trigger(Achievements.Completionist);
        const end = Date.now() + 30000;
        const colors = ["#a855f7", "#6366f1", "#22d3ee", "#f59e0b", "#10b981"];
        (function frame() {
          confetti({ particleCount: 6, angle: 60, spread: 55, origin: { x: 0 }, colors });
          confetti({ particleCount: 6, angle: 120, spread: 55, origin: { x: 1 }, colors });
          if (Date.now() < end) requestAnimationFrame(frame);
        })();
      }, 500);
    }
  }

  _queueAchievement(achievementKey) {
    this._achievementQueue.push(achievementKey);
    this._processQueue();
  }

  _processQueue() {
    if (this._isShowingAchievement || this._achievementQueue.length === 0) {
      return;
    }

    this._isShowingAchievement = true;
    const achievementKey = this._achievementQueue.shift();
    this._showAchievementPopup(achievementKey);
  }

  _showAchievementPopup(achievementKey) {
    const achievement = this.achievements.find((a) => a.id === achievementKey);
    if (!achievement) {
      this._isShowingAchievement = false;
      this._processQueue();
      return;
    }

    try {
      const sounds = [this.s1, this.s2, this.s3];
      const pick = sounds[Math.floor(Math.random() * sounds.length)];
      pick.currentTime = 0;
      pick.play();
    } catch (e) {}

    const popup = document.createElement("div");
    popup.className = "achievement-popup";
    popup.innerHTML = `
    <div class="achievement-popup__icon">
      <i style="height:40px; width:40px;" class="fas ${achievement.icon}"></i>
    </div>
    <div class="achievement-popup__body">
      <div class="achievement-popup__label">${achievement.title}</div>
      <div class="achievement-popup__title">${achievement.desc}</div>
    </div>
  `;
    document.body.appendChild(popup);

    const displayDuration = 5000;
    const delayBetween = 500;

    setTimeout(() => {
      popup.classList.add("hide");
      popup.addEventListener("animationend", () => {
        popup.remove();
        setTimeout(() => {
          this._isShowingAchievement = false;
          this._processQueue();
        }, delayBetween);
      });
    }, displayDuration);
  }

  showAchievement(achievementKey) {
    this._queueAchievement(achievementKey);
  }

  unlock(achievementKey) {
    this.trigger(achievementKey);
  }

  isUnlocked(achievementKey) {
    return this.unlocked.has(achievementKey);
  }

  refresh() {
    const win = document.getElementById("achievements-yukios");
    if (!win) return;
    const scroll = win.querySelector(".achievements-scroll");
    if (!scroll) return;
    const filter = this._currentFilter || "all";
    scroll.innerHTML = `
      <div class="achievements-hero">
        <i class="fas fa-star achievements-hero__icon"></i>
      </div>
      ${this._renderProgress()}
      ${this._renderToggle(filter)}
      <div class="achievements-grid">
        ${this._renderGrid(filter)}
      </div>
    `;
  }

  increment(counterKey) {
    const steps = this._thresholds[counterKey];
    if (!steps) {
      this.trigger(counterKey);
      return;
    }
    this._counters[counterKey] = (this._counters[counterKey] || 0) + 1;
    const count = this._counters[counterKey];
    for (const step of steps) {
      if (count === step.at) this.trigger(step.key);
    }
    this._saveToStorage();
  }

  incrementWindowOpen() {
    const count = this.wm.getOpenWindowCount();

    if (count >= 5) {
      this.trigger(this._thresholds.openWindows[0].key);
    }

    if (count >= 10) {
      this.trigger(this._thresholds.openWindows[1].key);
    }
  }
  incrementAppLaunched() {
    this.increment("appLaunched");
  }
  incrementTerminalCmd() {
    this.increment("terminalCmd");
  }
  incrementGameLaunched() {
    this.increment("gameLaunched");
  }
  incrementWallpaper() {
    this.increment("wallpaper");
  }
  incrementDesktopFile() {
    this.increment("desktopFile");
  }
  incrementFileUploaded() {
    this.increment("fileUploaded");
  }
  incrementSession() {
    this.trigger(Achievements.WelcomeAboard);
    this.increment("session");
  }
  incrementDeveloperMode() {
    this.increment("developerMode");
  }

  triggerCommandExecution() {
    this.incrementTerminalCmd();
  }

  resetAll() {
    this.unlocked.clear();
    this._counters = {};
    this._achievementQueue = [];
    this._isShowingAchievement = false;
    this._saveToStorage();
    this.refresh();
  }

  getStats() {
    return {
      total: this.achievements.length,
      unlocked: this.unlocked.size,
      percentage: Math.round((this.unlocked.size / this.achievements.length) * 100)
    };
  }
}
