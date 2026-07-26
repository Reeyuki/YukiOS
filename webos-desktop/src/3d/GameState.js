export const GENRES = {
  strategy: { label: "Strategy", color: 0x4488ff },
  horror: { label: "Horror", color: 0xff4444 },
  puzzle: { label: "Puzzle", color: 0xdda050 },
  action: { label: "Action", color: 0xff8800 },
  casual: { label: "Casual", color: 0x44cc88 },
  adventure: { label: "Adventure", color: 0xffcc00 },
  platformer: { label: "Platformer", color: 0xff8844 },
  simulation: { label: "Simulation", color: 0x66cccc },
  rpg: { label: "RPG", color: 0xcc8844 }
};

export const GAME_GENRES = {
  tabs: "strategy",
  plagueIncEvolved: "strategy",
  seaSweeper: "casual",
  angryBirds2: "action",
  deltaruneCh5: "rpg",
  slimeRancher: "casual",
  lobotomyCorporation: "horror",
  catGoesFishing: "casual",
  fiveNightsAtFrickbears3: "horror",
  helltaker: "puzzle",
  daddy: "simulation",
  suicideGuy: "puzzle",
  inscryption: "puzzle",
  stardew: "simulation",
  inStarsAndTime: "adventure",
  ytlifeomg: "simulation",
  slenderina: "horror",
  baldiBalds: "horror",
  baldisBasicsTeachingOnTwos: "horror",
  playtimeHellBear5van: "horror"
};

export class GameState {
  constructor() {
    this.reset();
  }

  reset() {
    this.active = false;
    this.score = 0;
    this.wrongPlacements = 0;
    this.totalGameCases = 0;
    this.shelvedCorrect = 0;
    this.shelvedWrong = 0;
    this.remaining = 0;
    this.elapsed = 0;
    this.lastTimestamp = 0;
    this.completed = false;
    this.onUpdate = null;
    this.onCompletion = null;
    this.onPlacement = null;
    this.hintActive = false;
    this.scoredGameCases = new Set();
    this.wrongAttempted = new Set();
  }

  start(totalGameCases) {
    this.reset();
    this.active = true;
    this.totalGameCases = totalGameCases;
    this.remaining = totalGameCases;
    this.lastTimestamp = performance.now() / 1000;
  }

  update(timestamp) {
    if (!this.active || this.completed) return;
    const t = timestamp / 1000;
    const dt = t - this.lastTimestamp;
    this.lastTimestamp = t;
    this.elapsed += dt;
    if (this.onUpdate) this.onUpdate(this);
  }

  placeGameCaseCorrectly(gameId) {
    if (!this.active) return;
    if (this.scoredGameCases.has(gameId)) return;
    this.scoredGameCases.add(gameId);
    this.shelvedCorrect++;
    this.remaining--;
    this.score += 100 + Math.max(0, Math.floor((10 - this.elapsed) * 5));
    if (this.onPlacement) this.onPlacement(bookId, true);
    this.checkCompletion();
  }

  placeGameCaseWrongly(gameId) {
    if (!this.active) return;
    if (this.scoredGameCases.has(gameId) || this.wrongAttempted.has(gameId)) return;
    this.wrongAttempted.add(gameId);
    this.shelvedWrong++;
    this.wrongPlacements++;
    this.score = Math.max(0, this.score - 25);
    if (this.onPlacement) this.onPlacement(bookId, false);
  }

  checkCompletion() {
    if (this.remaining <= 0 && !this.completed) {
      this.completed = true;
      this.active = false;
      if (this.onCompletion) this.onCompletion(this.getResults());
    }
  }

  getResults() {
    const accuracy = this.totalGameCases > 0 ? Math.round((this.shelvedCorrect / this.totalGameCases) * 100) : 0;
    const minutes = Math.floor(this.elapsed / 60);
    const seconds = Math.floor(this.elapsed % 60);
    return {
      score: this.score,
      time: `${minutes}:${String(seconds).padStart(2, "0")}`,
      accuracy,
      correct: this.shelvedCorrect,
      wrong: this.shelvedWrong,
      total: this.totalGameCases
    };
  }

  toggleHint() {
    this.hintActive = !this.hintActive;
    return this.hintActive;
  }

  getGenreForGame(gameId) {
    return GAME_GENRES[gameId] || "casual";
  }
}
