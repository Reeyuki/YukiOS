import confetti from "canvas-confetti";
import { BusEvents } from "./core/EventBus.js";
import { resolveGhUrl } from "./shared/assetResolver.js";
import { audioMixer } from "./audioMixer.js";

import { BaseApp, PersistenceTypes, StorageKeys, os } from "./framework.js";
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
  Completionist: "completionist",
  SetupComplete: "setup_complete"
};

export class AchievementsApp extends BaseApp {
  constructor(services) {
    super(services);
    this.achievements = this._createAchievements();
    this.unlocked = new Set();
    this.s1 = new Audio(resolveGhUrl("https://cdn.jsdelivr.net/gh/Reeyuki/yukios@main/static/audio/steam.mp3"));
    this.s2 = new Audio(resolveGhUrl("https://cdn.jsdelivr.net/gh/Reeyuki/yukios@main/static/audio/slime1.mp3"));
    this.s3 = new Audio(resolveGhUrl("https://cdn.jsdelivr.net/gh/Reeyuki/yukios@main/static/audio/slime2.mp3"));

    this._initBusListeners();
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
    this.incrementSession();
  }

  getDeclarativeSchema(opts) {
    return {
      id: "achievements-yukios",
      name: "Achievements",
      icon: "fa fa-trophy",
      windows: [
        {
          id: "achievements-yukios",
          title: "Achievements",
          size: ["800px", "40em"],
          icon: "fa fa-trophy",
          style: { left: "200px", top: "30px" },
          ui: `<div class="window-content achievements-content">
        <div class="achievements-scroll">
          <div class="achievements-hero">
            <div class="achievements-hero__bg"></div>
            <div class="achievements-hero__content">
              <div class="achievements-hero__icon-wrapper">
                <i class="fas fa-trophy achievements-hero__icon"></i>
              </div>
              <h1 class="achievements-hero__title">Achievements</h1>
              <p class="achievements-hero__subtitle">Track your progress in Yuki OS</p>
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
                <div class="achievements-progress__fill" style="width: 0%">
                  <div class="achievements-progress__shine"></div>
                </div>
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
      </div>`,
          events: {
            ".achievements-toggle__btn": {
              click: {
                type: "custom:setFilter",
                stopPropagation: true
              }
            }
          }
        }
      ],
      state: {
        initial: {
          currentFilter: "all",
          unlocked: [],
          counters: {}
        },
        persistence: PersistenceTypes.LOCAL_STORAGE
      },
      actions: {
        setFilter: (payload, event, element, state) => {
          const filter = element.dataset.filter || "all";
          state.currentFilter = filter;
          this._currentFilter = filter;
          this.refresh();
        }
      },
      onMount: "initAchievements"
    };
  }

  initAchievements(payload, event, element, state) {
    this.refresh();
  }

  _initBusListeners() {
    os.events.on(BusEvents.WINDOW_CREATED, () => this.incrementWindowOpen());
    os.events.on(BusEvents.APP_LAUNCHED, () => this.incrementAppLaunched());
    os.events.on(BusEvents.TERMINAL_CMD_EXECUTED, () => this.triggerCommandExecution());
    os.events.on(BusEvents.WALLPAPER_CHANGED, () => this.incrementWallpaper());
    os.events.on(BusEvents.DESKTOP_ICON_ADDED, () => this.incrementDesktopFile());
    os.events.on(BusEvents.ACHIEVEMENT_TRIGGER, ({ key }) => this.trigger(key));
  }

  _createAchievements() {
    return [
      {
        id: Achievements.WelcomeAboard,
        title: "First Steps",
        desc: "Launch Yuki OS for the first time",
        icon: "fa-rocket",
        rarity: "common"
      },
      {
        id: Achievements.MultiTasker,
        title: "Multitasker",
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
        title: "Archive Handler",
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
        title: "Desktop Stylist",
        desc: "Change wallpaper 5 times",
        icon: "fa-paintbrush",
        rarity: "uncommon"
      },
      {
        id: Achievements.OrganizedDesktop,
        title: "Organized Desktop",
        desc: "Arrange 15 files on desktop",
        icon: "fa-th",
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
        id: Achievements.DeveloperMode,
        title: "Developer Mode",
        desc: "Use Terminal",
        icon: "fa-code",
        rarity: "common"
      },
      {
        id: Achievements.DeveloperModeSuper,
        title: "Super Developer Mode",
        desc: "Write neofetch on terminal",
        icon: "fa-laptop-code",
        rarity: "rare"
      },
      {
        id: Achievements.TerminalUser,
        title: "Terminal User",
        desc: "Execute 5 commands in terminal",
        icon: "fa-terminal",
        rarity: "uncommon"
      },
      {
        id: Achievements.TerminalUserSuper,
        title: "Terminal Pro",
        desc: "Execute 50 commands in terminal",
        icon: "fa-terminal",
        rarity: "epic"
      },
      {
        id: Achievements.OfficeWorker,
        title: "Office Worker",
        desc: "Create a document in office suite",
        icon: "fa-file-word",
        rarity: "common"
      },
      {
        id: Achievements.ModelViewer,
        title: "Model Viewer",
        desc: "View a 3D model",
        icon: "fa-cube",
        rarity: "uncommon"
      },
      {
        id: Achievements.FirstGame,
        title: "First Game",
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
        title: "Mega Game Hopper",
        desc: "Play 100 games",
        icon: "fa-crown",
        rarity: "legendary"
      },
      {
        id: Achievements.EmulatorFan,
        title: "Emulator Fan",
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
        title: "System Ready",
        desc: "Finish Yuki OS setup wizard",
        icon: "fa-flag-checkered",
        rarity: "uncommon"
      }
    ];
  }

  _loadFromStorage() {
    try {
      const saved = os.storage.get(StorageKeys.achievements);
      if (saved) this.unlocked = new Set(saved);
      const savedCounters = os.storage.get(StorageKeys.achievementCounters);
      if (savedCounters) this._counters = savedCounters;
    } catch (e) {
      console.error("[Achievements]", e);
    }
  }

  _saveToStorage() {
    try {
      os.storage.set(StorageKeys.achievements, [...this.unlocked]);
      os.storage.set(StorageKeys.achievementCounters, this._counters);
    } catch (e) {
      console.error("[Achievements]", e);
    }
  }

  _renderHero() {
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
        <p class="achievements-hero__subtitle">Track your progress in Yuki OS</p>
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

  _renderGrid(filter) {
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
          <div class="achievement-card__glow"></div>
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
    const disabled = os.storage.get(StorageKeys.achievementsDisabled) === "true";

    return `
    <div class="achievements-progress ${disabled ? "achievements-progress--disabled" : ""}">
      <div class="achievements-progress__header">
        <span class="achievements-progress__label">Overall Progress</span>
        <span class="achievements-progress__counter">${done} / ${total}</span>
      </div>
      <div class="achievements-progress__bar-wrapper">
        <div class="achievements-progress__bar">
          <div class="achievements-progress__fill" style="width: ${pct}%">
            <div class="achievements-progress__shine"></div>
          </div>
        </div>
        <span class="achievements-progress__percentage">${pct}%</span>
      </div>
    </div>
  `;
  }

  _renderToggle(current) {
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
            onclick="window.achievements._setFilter('${o.val}')"
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

  _setFilter(filter) {
    this._currentFilter = filter;
    this.refresh();
  }

  trigger(achievementKey, skipSound = false) {
    if (os.storage.get(StorageKeys.achievementsDisabled) === "true") return;

    if (!this.achievements.find((a) => a.id === achievementKey)) return;
    if (this.unlocked.has(achievementKey)) return;

    this.unlocked.add(achievementKey);
    this._saveToStorage();
    this._queueAchievement(achievementKey, skipSound);
    this.refresh();

    const nonCompletionist = this.achievements.filter((a) => a.id !== Achievements.Completionist);
    const allDone = nonCompletionist.every((a) => this.unlocked.has(a.id));

    if (allDone && !this.unlocked.has(Achievements.Completionist)) {
      setTimeout(() => {
        this.trigger(Achievements.Completionist);
      }, 500);
    }
  }

  _queueAchievement(achievementKey, skipSound = false) {
    this._achievementQueue.push({
      achievementKey,
      skipSound
    });

    this._processQueue();
  }
  _processQueue() {
    if (this._isShowingAchievement || this._achievementQueue.length === 0) {
      return;
    }

    this._isShowingAchievement = true;

    const { achievementKey, skipSound } = this._achievementQueue.shift();

    this._showAchievementPopup(achievementKey, skipSound);
  }

  _showAchievementPopup(achievementKey, skipSound = false) {
    const achievement = this.achievements.find((a) => a.id === achievementKey);

    if (!achievement) {
      this._isShowingAchievement = false;
      this._processQueue();
      return;
    }

    if (!skipSound) {
      try {
        const sounds = [this.s1, this.s2, this.s3];
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
    <div class="achievement-popup__glow"></div>
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
      <div class="achievement-popup__rarity achievement-popup__rarity--${achievement.rarity}">
        ${achievement.rarity.toUpperCase()}
      </div>
    </div>
    <div class="achievement-popup__particles">
      ${Array.from({ length: 12 }, (_, i) => `<div class="achievement-popup__particle" style="--delay: ${i * 0.1}s; --angle: ${i * 30}deg"></div>`).join("")}
    </div>
  `;

    document.body.appendChild(popup);

    setTimeout(() => popup.classList.add("achievement-popup--show"), 10);

    const displayDuration = 4000;
    const delayBetween = 500;

    setTimeout(() => {
      popup.classList.remove("achievement-popup--show");
      popup.classList.add("achievement-popup--hide");

      setTimeout(() => {
        popup.remove();

        setTimeout(() => {
          this._isShowingAchievement = false;
          this._processQueue();
        }, delayBetween);
      }, 600);
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
      ${this._renderHero()}
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
    const count = document.querySelectorAll(".window").length;
    if (count >= 5) this.trigger(this._thresholds.openWindows[0].key);
    if (count >= 10) this.trigger(this._thresholds.openWindows[1].key);
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
    const isBootAchievement =
      !this.unlocked.has(Achievements.WelcomeAboard) ||
      !this.unlocked.has(Achievements.RegularUser) ||
      !this.unlocked.has(Achievements.SystemVeteran);

    this.trigger(Achievements.WelcomeAboard, isBootAchievement);

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
