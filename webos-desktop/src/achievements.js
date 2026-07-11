import confetti from "canvas-confetti";
import { BusEvents } from "./core/EventBus.js";
import { resolveGhUrl } from "./shared/assetResolver.js";
import { audioMixer } from "./audioMixer.js";
import { $$ } from "./shared/domUtils.js";

import { BaseApp, StorageKeys, os } from "./framework.js";
export const Achievements = {
  WelcomeAboard: "first_boot",
  MultiTasker: "window_manager",
  NoteTaker: "note_taker",
  ArchiveHandler: "archive_handler",
  PersonalSpace: "personal_space",
  DesktopStylist: "desktop_stylist",
  AppCollector: "app_collector",
  Skid: "skid",
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
  Completionist: "completionist",
  SetupComplete: "setup_complete",
  FontCustomizer: "font_customizer",
  SnapHappy: "snap_happy",
  WorkspaceWanderer: "workspace_wanderer",
  WorkspaceArchitect: "workspace_architect",
  GitGuru: "git_guru",
  ScreenshotSavant: "screenshot_savant",
  MathWhiz: "math_whiz",
  NightPerson: "night_owl",
  PowerUser: "power_user",
  Customizer: "customizer",
  Flashback: "flashback",
  Converter: "converter"
};

export class AchievementsApp extends BaseApp {
  constructor(services) {
    super(services);
    this.achievements = this.createAchievements();
    this.unlocked = new Map();
    this.s1 = new Audio(resolveGhUrl("https://cdn.jsdelivr.net/gh/Reeyuki/yukios@main/static/audio/steam.opus"));

    this.initBusListeners();
    this.thresholds = {
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
      fileUploaded: [{ at: 100, key: Achievements.FileHoarder }],
      session: [
        { at: 5, key: Achievements.RegularUser },
        { at: 20, key: Achievements.SystemVeteran }
      ],
      windowSnapped: [{ at: 10, key: Achievements.SnapHappy }],
      workspaceSwitched: [{ at: 25, key: Achievements.WorkspaceWanderer }],
      workspaceAdded: [{ at: 3, key: Achievements.WorkspaceArchitect }],
      gitCommand: [{ at: 1, key: Achievements.GitGuru }],
      screenshotTaken: [{ at: 10, key: Achievements.ScreenshotSavant }],
      calculationDone: [{ at: 50, key: Achievements.MathWhiz }],
      powerProfileChange: [{ at: 5, key: Achievements.PowerUser }]
    };
    this.counters = {};
    this.achievementQueue = [];
    this.isShowingAchievement = false;
    this.loadFromStorage();
  }

  open(opts = {}) {
    const win = os.window.create("achievements-yukios", "Achievements", "800px", "40em", {
      icon: "fa fa-trophy",
      appId: "achievements-yukios"
    });

    win.innerHTML = `<div class="window-content achievements-content">
        <div class="achievements-scroll">
          <div class="achievements-hero">
            <div class="achievements-hero__bg"></div>
            <div class="achievements-hero__content">
              <div class="achievements-hero__icon-wrapper">
                <i class="fas fa-trophy achievements-hero__icon"></i>
              </div>
              <h1 class="achievements-hero__title">Achievements</h1>
              <p class="achievements-hero__subtitle">Track your progress in YukiOS</p>
            </div>
            <div class="achievements-hero__stats">
              <div class="achievements-hero__stat">
                <div class="achievements-hero__stat-value">0</div>
                <div class="achievements-hero__stat-label">Unlocked</div>
              </div>
              <div class="achievements-hero__stat">
                <div class="achievements-hero__stat-value">0%</div>
                <div class="achievements-hero__stat-label">Complete</div>
              </div>
              <div class="achievements-hero__stat">
                <div class="achievements-hero__stat-value">0</div>
                <div class="achievements-hero__stat-label">Remaining</div>
              </div>
            </div>
          </div>
          <div class="achievements-progress">
            <div class="achievements-progress__header">
              <span class="achievements-progress__label">Overall Progress</span>
              <span class="achievements-progress__counter">0 / 0</span>
            </div>
            <div class="achievements-progress__bar-wrapper">
              <div class="achievements-progress__bar">
                <div class="achievements-progress__fill" style="width: 0%"></div>
              </div>
              <span class="achievements-progress__percentage">0%</span>
            </div>
          </div>
          <div class="achievements-toggle">
            <button class="achievements-toggle__btn achievements-toggle__btn--active" data-filter="all">
              <i class="fas fa-list"></i>
              <span>All</span>
            </button>
            <button class="achievements-toggle__btn" data-filter="unlocked">
              <i class="fas fa-check-circle"></i>
              <span>Unlocked</span>
            </button>
            <button class="achievements-toggle__btn" data-filter="locked">
              <i class="fas fa-lock"></i>
              <span>Locked</span>
            </button>
          </div>
          <div class="achievements-grid" id="achievements-grid"></div>
        </div>
      </div>`;

    const scroll = win.querySelector(".achievements-scroll");
    scroll.addEventListener("click", (e) => {
      const btn = e.target.closest(".achievements-toggle__btn");
      if (!btn) return;
      const filter = btn.dataset.filter || "all";
      this.currentFilter = filter;
      this.refresh();
    });

    this.refresh();
  }

  initBusListeners() {
    os.events.on(BusEvents.WINDOW_CREATED, () => this.incrementWindowOpen());
    os.events.on(BusEvents.APP_LAUNCHED, () => this.incrementAppLaunched());
    os.events.on(BusEvents.TERMINAL_CMD_EXECUTED, (data) => this.triggerCommandExecution(data?.command));
    os.events.on(BusEvents.WALLPAPER_CHANGED, () => this.incrementWallpaper());
    os.events.on(BusEvents.ACHIEVEMENT_TRIGGER, ({ achievementId }) => this.trigger(achievementId));
    os.events.on(BusEvents.SESSION_INITIALIZED, () => this.incrementSession());
    os.events.on(BusEvents.WINDOW_SNAPPED, () => this.increment("windowSnapped"));
    os.events.on(BusEvents.WORKSPACE_SWITCHED, () => this.increment("workspaceSwitched"));
    os.events.on(BusEvents.WORKSPACE_ADDED, () => this.increment("workspaceAdded"));
  }

  createAchievements() {
    return [
      {
        id: Achievements.WelcomeAboard,
        title: "First Steps",
        desc: "Launch YukiOS for the first time",
        icon: "fa-rocket",
        rarity: "common"
      },
      {
        id: Achievements.MultiTasker,
        title: "Juggler",
        desc: "Run 5 apps simultaneously",
        icon: "fa-window-maximize",
        rarity: "common"
      },
      {
        id: Achievements.ChaosMode,
        title: "Chaos Mode",
        desc: "Open 10 apps at once",
        icon: "fa-fire",
        rarity: "rare"
      },
      {
        id: Achievements.NoteTaker,
        title: "Note Taker",
        desc: "Create and save a document",
        icon: "fa-note-sticky",
        rarity: "common"
      },
      {
        id: Achievements.ArchiveHandler,
        title: "Unzipped",
        desc: "Extract a compressed archive",
        icon: "fa-file-zipper",
        rarity: "common"
      },
      {
        id: Achievements.PersonalSpace,
        title: "Personal Space",
        desc: "Upload a custom wallpaper",
        icon: "fa-image",
        rarity: "common"
      },
      {
        id: Achievements.DesktopStylist,
        title: "Curator",
        desc: "Change wallpaper 5 times",
        icon: "fa-paintbrush",
        rarity: "uncommon"
      },
      {
        id: Achievements.AppCollector,
        title: "App Collector",
        desc: "Launch 15 different apps",
        icon: "fa-th-large",
        rarity: "rare"
      },
      {
        id: Achievements.Skid,
        title: "SKID",
        desc: "Write neofetch on terminal",
        icon: "fa-laptop-code",
        rarity: "rare"
      },
      {
        id: Achievements.TerminalUser,
        title: "First Command",
        desc: "Execute 5 commands in terminal",
        icon: "fa-terminal",
        rarity: "uncommon"
      },
      {
        id: Achievements.TerminalUserSuper,
        title: "Terminal Velocity",
        desc: "Execute 50 commands in terminal",
        icon: "fa-terminal",
        rarity: "epic"
      },
      {
        id: Achievements.OfficeWorker,
        title: "Paper Trail",
        desc: "Create a document in office suite",
        icon: "fa-file-word",
        rarity: "common"
      },
      {
        id: Achievements.ModelViewer,
        title: "Depth Perception",
        desc: "View a 3D model",
        icon: "fa-cube",
        rarity: "uncommon"
      },
      {
        id: Achievements.FirstGame,
        title: "Insert Coin",
        desc: "Launch any game",
        icon: "fa-gamepad",
        rarity: "common"
      },
      {
        id: Achievements.GameHopper,
        title: "Game Hopper",
        desc: "Play 10 games",
        icon: "fa-dice",
        rarity: "rare"
      },
      {
        id: Achievements.GameHopperMega,
        title: "Grand Game Hopper",
        desc: "Play 100 games",
        icon: "fa-crown",
        rarity: "legendary"
      },
      {
        id: Achievements.EmulatorFan,
        title: "Emulated",
        desc: "Run a ROM",
        icon: "fa-microchip",
        rarity: "uncommon"
      },
      {
        id: Achievements.RetroPlayer,
        title: "Retro Player",
        desc: "Play a DOS game",
        icon: "fa-ghost",
        rarity: "uncommon"
      },
      {
        id: Achievements.FileHoarder,
        title: "File Hoarder",
        desc: "Upload 100 files",
        icon: "fa-box-archive",
        rarity: "epic"
      },
      {
        id: Achievements.RegularUser,
        title: "Regular User",
        desc: "Use the OS across 5 sessions",
        icon: "fa-user-clock",
        rarity: "uncommon"
      },
      {
        id: Achievements.SystemVeteran,
        title: "System Veteran",
        desc: "Use the OS across 20 sessions",
        icon: "fa-medal",
        rarity: "epic"
      },
      {
        id: Achievements.Completionist,
        title: "Completionist",
        desc: "Unlock all achievements",
        icon: "fa-trophy",
        rarity: "legendary"
      },
      {
        id: Achievements.SetupComplete,
        title: "Welcome Home",
        desc: "Finish YukiOS setup wizard",
        icon: "fa-flag-checkered",
        rarity: "uncommon"
      },
      {
        id: Achievements.FontCustomizer,
        title: "Font Customizer",
        desc: "Set a custom TTF font as system font",
        icon: "fa-font",
        rarity: "uncommon"
      },
      {
        id: Achievements.SnapHappy,
        title: "Snap Happy",
        desc: "Snap windows to screen edges 10 times",
        icon: "fa-arrows-left-right-to-line",
        rarity: "uncommon"
      },
      {
        id: Achievements.WorkspaceWanderer,
        title: "Workspace Wanderer",
        desc: "Switch workspaces 25 times",
        icon: "fa-layer-group",
        rarity: "uncommon"
      },
      {
        id: Achievements.WorkspaceArchitect,
        title: "Workspace Architect",
        desc: "Create 3 different workspaces",
        icon: "fa-plus",
        rarity: "uncommon"
      },
      {
        id: Achievements.GitGuru,
        title: "Git Guru",
        desc: "Execute a git command in the terminal",
        icon: "fa-code-branch",
        rarity: "common"
      },
      {
        id: Achievements.ScreenshotSavant,
        title: "Snip & Clip",
        desc: "Take 10 screenshots",
        icon: "fa-camera",
        rarity: "uncommon"
      },
      {
        id: Achievements.MathWhiz,
        title: "Crunch Time",
        desc: "Perform 50 calculations in the calculator",
        icon: "fa-calculator",
        rarity: "uncommon"
      },
      {
        id: Achievements.NightPerson,
        title: "Night Person",
        desc: "Enable night mode",
        icon: "fa-moon",
        rarity: "common"
      },
      {
        id: Achievements.PowerUser,
        title: "Power Cycle",
        desc: "Switch power profiles 5 times",
        icon: "fa-bolt",
        rarity: "uncommon"
      },
      {
        id: Achievements.Customizer,
        title: "Hotkeyed",
        desc: "Customize a keyboard shortcut",
        icon: "fa-keyboard",
        rarity: "uncommon"
      },
      {
        id: Achievements.Flashback,
        title: "Flashback",
        desc: "Play a Flash game",
        icon: "fa-film",
        rarity: "common"
      },
      {
        id: Achievements.Converter,
        title: "Converted",
        desc: "Convert a file",
        icon: "fa-exchange-alt",
        rarity: "common"
      }
    ];
  }

  loadFromStorage() {
    try {
      const saved = os.storage.get(StorageKeys.achievements);
      if (saved) {
        if (Array.isArray(saved)) {
          this.unlocked = new Map(saved.map((id) => [id, Date.now()]));
        } else {
          this.unlocked = new Map(Object.entries(saved));
        }
      }
      const savedCounters = os.storage.get(StorageKeys.achievementCounters);
      if (savedCounters) this.counters = savedCounters;
    } catch (e) {
      console.error("[Achievements]", e);
    }
  }

  saveToStorage() {
    try {
      const obj = {};
      for (const [id, ts] of this.unlocked) obj[id] = ts;
      os.storage.set(StorageKeys.achievements, obj);
      os.storage.set(StorageKeys.achievementCounters, this.counters);
    } catch (e) {
      console.error("[Achievements]", e);
    }
  }

  renderHero() {
    const stats = this.getStats();
    const disabled = os.storage.get(StorageKeys.achievementsDisabled) === "true";

    return `
    <div class="achievements-hero">
      <div class="achievements-hero__bg"></div>
      <div class="achievements-hero__content">
        <div class="achievements-hero__icon-wrapper">
          <i class="fas fa-trophy achievements-hero__icon"></i>
        </div>
        <h1 class="achievements-hero__title">Achievements</h1>
        <p class="achievements-hero__subtitle">Track your progress in YukiOS</p>
        ${
          disabled
            ? `
          <div class="achievements-disabled-banner">
            <i class="fas fa-ban"></i>
            Achievements are currently disabled in Settings
          </div>
        `
            : ""
        }
      </div>
      <div class="achievements-hero__stats">
        <div class="achievements-hero__stat">
          <div class="achievements-hero__stat-value">${stats.unlocked}</div>
          <div class="achievements-hero__stat-label">Unlocked</div>
        </div>
        <div class="achievements-hero__stat">
          <div class="achievements-hero__stat-value">${stats.percentage}%</div>
          <div class="achievements-hero__stat-label">Complete</div>
        </div>
        <div class="achievements-hero__stat">
          <div class="achievements-hero__stat-value">${stats.total - stats.unlocked}</div>
          <div class="achievements-hero__stat-label">Remaining</div>
        </div>
      </div>
    </div>
  `;
  }

  renderGrid(filter) {
    const disabled = os.storage.get(StorageKeys.achievementsDisabled) === "true";

    return this.achievements
      .filter((a) => {
        if (filter === "unlocked") return this.unlocked.has(a.id);
        if (filter === "locked") return !this.unlocked.has(a.id);
        return true;
      })
      .map((a) => {
        const unlocked = this.unlocked.has(a.id);
        return `
        <div class="achievement-card ${unlocked ? "achievement-card--unlocked" : ""} ${disabled ? "achievement-card--disabled" : ""}" data-rarity="${a.rarity}">
          <div class="achievement-card__icon-wrapper">
            <div class="achievement-card__icon-bg"></div>
            <i class="fas ${a.icon} achievement-card__icon"></i>
            ${unlocked ? '<div class="achievement-card__checkmark"><i class="fas fa-check"></i></div>' : ""}
          </div>
          <div class="achievement-card__content">
            <div class="achievement-card__header">
              <h3 class="achievement-card__title">${a.title}</h3>
              <div class="achievement-card__badges">
                <span class="achievement-card__rarity achievement-card__rarity--${a.rarity}">${a.rarity}</span>
                ${!unlocked ? '<div class="achievement-card__lock"><i class="fas fa-lock"></i></div>' : ""}
              </div>
            </div>
            <p class="achievement-card__desc">${a.desc}</p>
            ${unlocked ? `<p class="achievement-card__date">Unlocked on ${new Date(this.unlocked.get(a.id)).toLocaleDateString()}</p>` : ""}
          </div>
        </div>
      `;
      })
      .join("");
  }
  renderProgress() {
    const total = this.achievements.length;
    const done = this.unlocked.size;
    const pct = Math.round((done / total) * 100);
    const disabled = os.storage.get(StorageKeys.achievementsDisabled) === "true";

    return `
    <div class="achievements-progress ${disabled ? "achievements-progress--disabled" : ""}">
      <div class="achievements-progress__header">
        <span class="achievements-progress__label">Overall Progress</span>
        <span class="achievements-progress__counter">${done} / ${total}</span>
      </div>
      <div class="achievements-progress__bar-wrapper">
        <div class="achievements-progress__bar">
          <div class="achievements-progress__fill" style="width: ${pct}%"></div>
        </div>
        <span class="achievements-progress__percentage">${pct}%</span>
      </div>
    </div>
  `;
  }

  renderToggle(current) {
    const opts = [
      { val: "all", label: "All", icon: "fa-list" },
      { val: "unlocked", label: "Unlocked", icon: "fa-check-circle" },
      { val: "locked", label: "Locked", icon: "fa-lock" }
    ];
    return `
      <div class="achievements-toggle">
        ${opts
          .map(
            (o) => `
          <button
            class="achievements-toggle__btn ${current === o.val ? "achievements-toggle__btn--active" : ""}"
            data-filter="${o.val}"
          >
            <i class="fas ${o.icon}"></i>
            <span>${o.label}</span>
          </button>
        `
          )
          .join("")}
      </div>
    `;
  }

  setFilter(filter) {
    this.currentFilter = filter;
    this.refresh();
  }

  trigger(achievementKey, skipSound = false) {
    if (os.storage.get(StorageKeys.achievementsDisabled) === "true") return;

    if (!this.achievements.find((a) => a.id === achievementKey)) return;
    if (this.unlocked.has(achievementKey)) return;

    this.unlocked.set(achievementKey, Date.now());
    this.saveToStorage();
    this.queueAchievement(achievementKey, skipSound);
    this.refresh();

    const nonCompletionist = this.achievements.filter((a) => a.id !== Achievements.Completionist);
    const allDone = nonCompletionist.every((a) => this.unlocked.has(a.id));

    if (allDone && !this.unlocked.has(Achievements.Completionist)) {
      setTimeout(() => {
        this.trigger(Achievements.Completionist);
      }, 500);
    }
  }

  queueAchievement(achievementKey, skipSound = false) {
    this.achievementQueue.push({
      achievementKey,
      skipSound
    });

    this.processQueue();
  }
  processQueue() {
    if (this.isShowingAchievement || this.achievementQueue.length === 0) {
      return;
    }

    this.isShowingAchievement = true;

    const { achievementKey, skipSound } = this.achievementQueue.shift();

    this.showAchievementPopup(achievementKey, skipSound);
  }

  showAchievementPopup(achievementKey, skipSound = false) {
    const achievement = this.achievements.find((a) => a.id === achievementKey);

    if (!achievement) {
      this.isShowingAchievement = false;
      this.processQueue();
      return;
    }

    if (!skipSound) {
      try {
        const sounds = [this.s1];
        const pick = sounds[Math.floor(Math.random() * sounds.length)];
        pick.currentTime = 0;
        pick.volume = audioMixer().masterVolume * audioMixer().systemVolume;
        pick.play();
      } catch (e) {
        console.error("[Achievements]", e);
      }
    }

    const popup = document.createElement("div");
    popup.className = "achievement-popup";
    popup.setAttribute("data-rarity", achievement.rarity);

    popup.innerHTML = `
    <div class="achievement-popup__icon-wrapper">
      <div class="achievement-popup__icon-bg"></div>
      <i class="fas ${achievement.icon} achievement-popup__icon"></i>
    </div>
    <div class="achievement-popup__content">
      <div class="achievement-popup__badge">
        <i class="fas fa-trophy"></i>
        Achievement Unlocked
      </div>
      <div class="achievement-popup__title">${achievement.title}</div>
      <div class="achievement-popup__desc">${achievement.desc}</div>
    </div>
  `;

    document.body.appendChild(popup);

    popup.addEventListener("click", () => os.app.launch("achievementsApp"));

    setTimeout(() => popup.classList.add("achievement-popup--show"), 10);

    const displayDuration = 4000;
    const delayBetween = 500;

    setTimeout(() => {
      popup.classList.remove("achievement-popup--show");
      popup.classList.add("achievement-popup--hide");

      setTimeout(() => {
        popup.remove();

        setTimeout(() => {
          this.isShowingAchievement = false;
          this.processQueue();
        }, delayBetween);
      }, 600);
    }, displayDuration);
  }

  showAchievement(achievementKey) {
    this.queueAchievement(achievementKey);
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
    const filter = this.currentFilter || "all";
    scroll.innerHTML = `
      ${this.renderHero()}
      ${this.renderProgress()}
      ${this.renderToggle(filter)}
      <div class="achievements-grid">
        ${this.renderGrid(filter)}
      </div>
    `;
  }

  increment(counterKey) {
    const steps = this.thresholds[counterKey];
    if (!steps) {
      this.trigger(counterKey);
      return;
    }
    this.counters[counterKey] = (this.counters[counterKey] || 0) + 1;
    const count = this.counters[counterKey];
    for (const step of steps) {
      if (count === step.at) this.trigger(step.key);
    }
    this.saveToStorage();
  }

  incrementWindowOpen() {
    const count = $$(".window").length;
    if (count >= 5) this.trigger(this.thresholds.openWindows[0].key);
    if (count >= 10) this.trigger(this.thresholds.openWindows[1].key);
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
  incrementFileUploaded() {
    this.increment("fileUploaded");
  }
  incrementSession() {
    const isBootAchievement =
      !this.unlocked.has(Achievements.WelcomeAboard) ||
      !this.unlocked.has(Achievements.RegularUser) ||
      !this.unlocked.has(Achievements.SystemVeteran);

    this.trigger(Achievements.WelcomeAboard, isBootAchievement);

    this.increment("session");
  }
  incrementScreenshotTaken() {
    this.increment("screenshotTaken");
  }
  incrementCalculationDone() {
    this.increment("calculationDone");
  }
  incrementPowerProfileChange() {
    this.increment("powerProfileChange");
  }
  triggerCommandExecution(command) {
    this.incrementTerminalCmd();
    if (command && command.trim().startsWith("git ")) {
      this.increment("gitCommand");
    }
  }

  resetAll() {
    this.unlocked.clear();
    this.counters = {};
    this.achievementQueue = [];
    this.isShowingAchievement = false;
    this.saveToStorage();
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
