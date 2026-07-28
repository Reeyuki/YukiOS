const STORAGE_KEY = "rm3d_achievements";

export class RoomAchievements {
  constructor() {
    this.achievements = this.createDefinitions();
    this.unlocked = new Map();
    this.load();
  }

  createDefinitions() {
    return [
      { id: "room_explorer", title: "Step Inside", desc: "Enter the 3D room for the first time", rarity: "common" },
      {
        id: "game_master",
        title: "Game Master",
        desc: "Complete the sorting minigame for the first time",
        rarity: "common"
      },
      { id: "perfect_sort", title: "Perfect Sort", desc: "Complete the minigame with 100% accuracy", rarity: "rare" },
      { id: "speed_shelver", title: "Speed Shelver", desc: "Complete the minigame in under 2 minutes", rarity: "epic" },
      {
        id: "interior_designer",
        title: "Interior Designer",
        desc: "Enter the editor mode for the first time",
        rarity: "uncommon"
      }
    ];
  }

  get(id) {
    return this.achievements.find((a) => a.id === id) || null;
  }

  isUnlocked(id) {
    return this.unlocked.has(id);
  }

  getStats() {
    const total = this.achievements.length;
    const unlocked = this.unlocked.size;
    return { total, unlocked, percentage: Math.round((unlocked / total) * 100) };
  }

  trigger(id) {
    if (this.unlocked.has(id)) return false;
    const def = this.get(id);
    if (!def) return false;
    this.unlocked.set(id, Date.now());
    this.save();
    return def;
  }

  getAllWithStatus() {
    return this.achievements.map((a) => ({
      ...a,
      unlocked: this.unlocked.has(a.id),
      unlockedAt: this.unlocked.get(a.id) || null
    }));
  }

  resetAll() {
    this.unlocked.clear();
    this.save();
  }

  load() {
    try {
      // this module will use localStorage on purpose to be decoupled from main os
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      this.unlocked = new Map(Object.entries(data));
    } catch {
      this.unlocked = new Map();
    }
  }

  save() {
    try {
      // this module will use localStorage on purpose to be decoupled from main os
      const obj = {};
      for (const [id, ts] of this.unlocked) obj[id] = ts;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    } catch {}
  }
}
