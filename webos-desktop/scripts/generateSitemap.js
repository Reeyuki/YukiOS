import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import https from "https";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const BASE = "https://yukios.netlify.app";

function extractApps() {
  const content = readFileSync(resolve(ROOT, "src/registry/AppManifest.js"), "utf-8");
  const APP_CDN = "https://cdn.jsdelivr.net/gh/Reeyuki/yukios@main";
  const entries = [];
  let depth = 0,
    current = "",
    inEntry = false;
  const arrayStart = content.indexOf("APP_MANIFESTS = [");
  if (arrayStart === -1) return entries;

  for (let i = arrayStart; i < content.length; i++) {
    const ch = content[i];
    if (ch === "{") {
      if (depth === 0) {
        current = "";
        inEntry = true;
      }
      depth++;
    }
    if (inEntry) current += ch;
    if (ch === "}") {
      depth--;
      if (depth === 0 && inEntry) {
        const svc = current.match(/serviceKey:\s*"([^"]+)"/);
        let key, title, description, icon;
        const titleM = current.match(/title:\s*"([^"]+)"/);
        if (titleM) title = titleM[1];
        if (svc) {
          key = svc[1];
        } else if (titleM) {
          key = titleM[1].toLowerCase().replace(/\s+/g, "");
        }
        const descM = current.match(/description:\s*"([^"]+)"/);
        if (descM) description = descM[1];
        const iconTL = current.match(/icon:\s*`\$\{CDN_BASE\}\/([^`]+)`/);
        const iconM = current.match(/icon:\s*"([^"]+)"/);
        if (iconTL) {
          icon = `${APP_CDN}/${iconTL[1]}`;
        } else if (iconM) {
          icon = iconM[1];
        } else {
          icon = "fas fa-star";
        }
        if (key && title) entries.push({ key, title, description: description || "", icon });
        inEntry = false;
        current = "";
      }
    }
  }
  return entries;
}

function extractGames(gameDescs) {
  const content = readFileSync(resolve(ROOT, "src/games/gamesList.js"), "utf-8");
  const seen = new Set();
  const entries = [];
  const keyRegex = /^\s\s(\w+):\s*\{/gm;
  let match;
  while ((match = keyRegex.exec(content)) !== null) {
    const key = match[1];
    if (seen.has(key)) continue;
    seen.add(key);
    const rest = content.slice(match.index + match[0].length, match.index + 2000);
    const titleM = rest.match(/title:\s*"([^"]+)"/);
    const urlM = rest.match(/url:\s*"([^"]+)"/);
    const swfM = rest.match(/swf:\s*"([^"]+)"/);
    const htmlM = rest.match(/html:\s*"([^"]+)"/);
    const typeM = rest.match(/type:\s*"([^"]+)"/);
    const iconM = rest.match(/icon:\s*"([^"]+)"/);
    let icon = iconM ? iconM[1] : "";
    if (icon && (icon.startsWith("/") || icon.startsWith("static/"))) {
      const clean = icon.startsWith("/") ? icon.slice(1) : icon;
      icon = `https://cdn.jsdelivr.net/gh/Reeyuki/yukios@main/${clean}`;
    }
    const title = titleM ? titleM[1] : key;
    const desc = (gameDescs && gameDescs[key]) || "";
    const type = typeM ? typeM[1] : "";
    let gameUrl = "";
    if (type === "swf" && swfM) {
      gameUrl = swfM[1];
    } else if (type === "html" && htmlM) {
      gameUrl = htmlM[1];
    } else if (urlM) {
      gameUrl = urlM[1];
    }
    entries.push({
      key,
      title,
      url: gameUrl,
      type,
      icon,
      genre: classifyGameGenre(title, desc)
    });
  }
  return entries;
}

function extractGameDescriptions() {
  const content = readFileSync(resolve(ROOT, "src/games/gameDescriptions.js"), "utf-8");
  const descs = {};
  const start = content.indexOf("descriptionMap = {");
  if (start === -1) return descs;
  const slice = content.slice(start);
  const regex = /(\w+):\s*"([^"]+)"/g;
  let m;
  while ((m = regex.exec(slice)) !== null) {
    if (m[0].includes("};")) break;
    descs[m[1]] = m[2];
  }
  return descs;
}

async function fetchArchiveGames() {
  const archiveBase =
    "https://cdn.jsdelivr.net/gh/Reeyuki/yukios-games@1a4843dd9c0eb267d802625234e54fd6f9a6c9b7/archive/";
  const url = `${archiveBase}games.json`;

  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            const games = Array.isArray(parsed) ? parsed : parsed?.games || [];
            const archiveGames = games.map((game) => {
              const name = game.name || "";
              const fullUrl = game.url?.startsWith("http") ? game.url : archiveBase + (game.url || "");
              const thumb = game.thumbnail
                ? game.thumbnail.startsWith("http")
                  ? game.thumbnail
                  : archiveBase.replace(/\/$/, "") + "/" + game.thumbnail.replace(/^\//, "")
                : "";
              const key = name.toLowerCase().replace(/[^a-z0-9]+/g, "");
              return {
                key,
                title: name,
                url: fullUrl,
                icon: thumb,
                genre: classifyGameGenre(name, ""),
                isArchive: true
              };
            });
            resolve(archiveGames);
          } catch (e) {
            console.error("Error parsing archive games:", e);
            resolve([]);
          }
        });
      })
      .on("error", (e) => {
        console.error("Error fetching archive games:", e);
        resolve([]);
      });
  });
}

const GENRE_KEYWORDS = {
  Action: [
    "action",
    "combat",
    "battle",
    "invasion",
    "attack",
    "war",
    "warfare",
    "berserk",
    "rage",
    "smash",
    "punch",
    "kick",
    "slap",
    "duel",
    "strike",
    "assault"
  ],
  Adventure: [
    "adventure",
    "explor",
    "quest",
    "journey",
    "odyssey",
    "story",
    "narrative",
    "dialogue",
    "mystery",
    "detective",
    "investigation"
  ],
  Strategy: [
    "strategy",
    "tactical",
    "tactics",
    "defense",
    "tower",
    "tycoon",
    "management",
    "planning",
    "formation",
    "chess",
    "simulation"
  ],
  Puzzle: [
    "puzzle",
    "logic",
    "brain",
    "match",
    "riddle",
    "sliding",
    "memory",
    "pattern",
    "clue",
    "cryptic",
    "maze",
    "sokoban",
    "block",
    "pair",
    "solitaire"
  ],
  Simulation: [
    "simulation",
    "simulator",
    "farming",
    "cooking",
    "life sim",
    "tycoon",
    "management",
    "builder",
    "creation"
  ],
  RPG: [
    "rpg",
    "role-playing",
    "monster-collecting",
    "pokemon",
    "leveling",
    "stats",
    "experience",
    "fantasy",
    "magic",
    "spell",
    "dungeon",
    "inventory",
    "character progression"
  ],
  Horror: [
    "horror",
    "scary",
    "creepy",
    "haunted",
    "escape",
    "nightmare",
    "dark",
    "blood",
    "gore",
    "terror",
    "disturbing",
    "fnaf",
    "five nights",
    "animatronic",
    "surreal",
    "chase"
  ],
  Platformer: ["platform", "jump", "run", "runner", "leap", "climb", "side-scroll"],
  Shooter: ["shooter", "fps", "gun", "shoot", "bullet", "weapon", "rifle", "pistol", "sniper", "shotgun", "projectile"],
  Sports: [
    "sports",
    "football",
    "soccer",
    "basketball",
    "baseball",
    "skateboard",
    "tennis",
    "golf",
    "bowling",
    "athlete"
  ],
  Racing: ["race", "racing", "drive", "drift", "speed", "car", "vehicle", "motor", "bike", "bicycle", "boat"],
  Fighting: ["fight", "fighting", "combat", "martial arts", "punch", "wrestl", "brawler", "duel"],
  Casual: ["casual", "relax", "simple", "fun", "family", "whimsical", "charming", "cute", "chill"],
  Sandbox: ["sandbox", "build", "creat", "open world", "block", "procedurally generated", "craft", "infinite"],
  Survival: ["survival", "survive", "resource", "gather", "shelter", "hunger", "thirst", "endure"],
  Roguelike: ["roguelike", "roguelite", "procedural", "permadeath", "deck-building", "run-based"],
  Card: ["card", "deck", "poker", "blackjack", "collectible card", "deck-building"],
  Arcade: ["arcade", "classic", "retro", "score", "high score", "coin-op", "timeless"],
  Educational: ["educational", "learn", "teach", "math", "spelling", "children", "education"],
  Idle: ["idle", "clicker", "passive", "incremental", "tap"],
  Rhythm: ["rhythm", "music", "dance", "beat", "song", "groove", "melody"],
  Multiplayer: ["multiplayer", "online", "multi-player", "co-op", "versus", "pvp", "io game"]
};

const TITLE_TEMPLATES = {
  Action: "${title} - Action Game - Play Free Online in Browser No Download | YukiOS",
  Adventure: "${title} - Free Adventure Game - Play Online in Browser | YukiOS",
  Strategy: "${title} - Strategy Game - Play Free Online Browser No Install | YukiOS",
  Puzzle: "${title} - Free Puzzle Game - Brain Teaser Online No Download | YukiOS",
  Simulation: "${title} - Simulation Game - Play Free Online in Your Browser | YukiOS",
  RPG: "${title} - Free RPG - Play Online in Browser No Install Required | YukiOS",
  Horror: "${title} - Scary Horror Game - Play Free Online in Browser | YukiOS",
  Platformer: "${title} - Free Platformer Game - Play Online in Browser | YukiOS",
  Shooter: "${title} - Shooter Game - Play Free Online Browser No Download | YukiOS",
  Sports: "${title} - Sports Game - Play Free Online in Browser | YukiOS",
  Racing: "${title} - Racing Game - Play Free Online in Browser | YukiOS",
  Fighting: "${title} - Fighting Game - Play Free Online Browser No Download | YukiOS",
  Casual: "${title} - Free Casual Game - Play Online Relax in Browser | YukiOS",
  Sandbox: "${title} - Free Sandbox Game - Play Online in Browser No Limits | YukiOS",
  Survival: "${title} - Survival Game - Play Free Online in Browser | YukiOS",
  Roguelike: "${title} - Free Roguelike Game - Play Online Browser Run | YukiOS",
  Card: "${title} - Card Game - Play Free Online Browser No Download | YukiOS",
  Arcade: "${title} - Retro Arcade Game - Play Free Online Unblocked | YukiOS",
  Educational: "${title} - Free Educational Game - Learn Online in Browser | YukiOS",
  Idle: "${title} - Idle Clicker Game - Play Free Online in Browser | YukiOS",
  Rhythm: "${title} - Music Rhythm Game - Play Free Online in Browser | YukiOS",
  Multiplayer: "${title} - Multiplayer IO Browser Game - Play Free Online | YukiOS"
};

const H1_TEMPLATES = {
  Action: "${title} - Free Action Game Online",
  Adventure: "${title} - Free Adventure Game Online",
  Strategy: "${title} - Free Strategy Game Online",
  Puzzle: "${title} - Free Puzzle Game Online",
  Simulation: "${title} - Free Simulation Game Online",
  RPG: "${title} - Free RPG Game Online",
  Horror: "${title} - Free Horror Game Online",
  Platformer: "${title} - Free Platformer Game Online",
  Shooter: "${title} - Free Shooter Game Online",
  Sports: "${title} - Free Sports Game Online",
  Racing: "${title} - Free Racing Game Online",
  Fighting: "${title} - Free Fighting Game Online",
  Casual: "${title} - Free Casual Game Online",
  Sandbox: "${title} - Free Sandbox Game Online",
  Survival: "${title} - Free Survival Game Online",
  Roguelike: "${title} - Free Roguelike Game Online",
  Card: "${title} - Free Card Game Online",
  Arcade: "${title} - Free Retro Arcade Game Online",
  Educational: "${title} - Free Educational Game Online",
  Idle: "${title} - Free Idle Game Online",
  Rhythm: "${title} - Free Rhythm Game Online",
  Multiplayer: "${title} - Free Multiplayer Game Online"
};

const DESC_SUFFIXES = {
  Action:
    " Fast-paced action gameplay with no downloads required. Plays smoothly on Chromebook, school computers, and mobile devices.",
  Adventure:
    " Embark on an adventure directly from your browser. No install needed. It works on any device with internet.",
  Strategy:
    " Think and plan your way to victory. Free online strategy game with no downloads or sign-ups. Perfect for school and work breaks.",
  Puzzle:
    " Train your brain with this free online puzzle game. No download needed. Works on Chromebook and school networks.",
  Simulation:
    " Immerse yourself in this free simulation game running directly in your browser. No install or setup required.",
  RPG: " Dive into this free RPG adventure in your browser. No download or install needed. Your progress saves automatically.",
  Horror:
    " Experience this free horror game in your browser. No downloads, just pure scares. Play with lights off for maximum effect.",
  Platformer:
    " Run, jump, and explore in this free platformer game. No download needed. It plays in any browser instantly.",
  Shooter:
    " Test your aim in this free shooter game for browsers. Zero downloads, zero lag. Works on school Chromebooks.",
  Sports: " Play this free sports game in your browser. No equipment, no downloads, just pure competitive fun.",
  Racing: " Hit the track in this free racing game. Play instantly in your browser with no downloads or installs.",
  Fighting: " Battle opponents in this free fighting game for browsers. No downloads required. Just pick up and play.",
  Casual: " Relax with this free casual browser game. No downloads, no stress, just fun. Perfect for quick breaks.",
  Sandbox: " Create and explore in this free sandbox browser game. No limits, no downloads, pure creativity online.",
  Survival: " Fight to survive in this free browser survival game. No download needed. How long can you last?",
  Roguelike: " Each run is different in this free roguelike game for browsers. No download, infinite replayability.",
  Card: " Play this free card game in your browser. No download, no sign-up, just deal and play instantly.",
  Arcade: " Classic retro arcade action in your browser. Free, unblocked, no download. Plays great on school networks.",
  Educational: " Learn while you play with this free educational browser game. Perfect for students and curious minds.",
  Idle: " Watch your progress grow in this free idle clicker game. Play in browser with no downloads needed.",
  Rhythm: " Feel the beat with this free music rhythm game in your browser. No download required. Just tap along.",
  Multiplayer: " Challenge players online in this free multiplayer browser game. No download, no sign-up, instant play."
};

const SEO_PARAGRAPHS = {
  Action:
    "This free action game runs entirely in your browser with no downloads or installations. It loads fast on school Chromebooks, home PCs, and tablets alike. The controls are responsive and designed for quick play sessions during breaks. No sign-up forms, no waiting. Just click play and jump straight into the action. Bookmark this page to come back anytime.",
  Adventure:
    "This free browser adventure game requires no downloads or plug-ins. It works on every modern browser and operating system including Chrome OS, Windows, macOS, and Linux. The game saves your progress automatically so you can continue your journey across multiple sessions. Perfect for playing between classes or during downtime at home.",
  Strategy:
    "Sharpen your tactical skills with this free strategy game that runs directly in your browser. There is no software to download, no account to create, and nothing to install. The game is fully playable on school and work networks. Its turn-based or real-time mechanics adapt to your pace, making it ideal for both quick decisions and deep planning sessions.",
  Puzzle:
    "Challenge your mind with this free puzzle game that loads instantly in your browser with zero downloads. It works perfectly on Chromebooks, school computers, tablets, and phones. The difficulty scales naturally so both casual players and puzzle enthusiasts will find engaging content. No ads interrupt your flow. Just pure brain training.",
  Simulation:
    "This free simulation game brings realistic mechanics to your browser without any downloads or installs. Manage resources, make decisions, and watch your creation evolve. All through a web browser on any device. It is fully compatible with Chrome OS, making it a great choice for school and educational settings.",
  RPG: "Jump into this free RPG adventure that runs entirely in your browser. No downloads, no launchers, no installs. The game features automatic cloud saving so your party, items, and progress are always waiting for you. Works on any device with a modern browser including school computers and tablets.",
  Horror:
    "Experience spine-tingling terror with this free horror game designed for browsers. It requires zero downloads and runs on any device. The atmospheric audio and visuals are optimized for instant loading. Best played in full screen with headphones for maximum immersion. Works on school Chromebooks too.",
  Platformer:
    "This free platformer game runs natively in your browser with no downloads or installs. Tight controls, responsive physics, and smooth frame rates make it feel like a native game. It works on any device including school Chromebooks, home desktops, and tablets. Jump in instantly. No account required.",
  Shooter:
    "Test your reflexes with this free shooter game that runs entirely in your browser. Zero downloads, zero setup. Optimized for low latency on school and work networks. Mouse and keyboard controls are tight and responsive. Works on Chromebooks, Windows, macOS, and Linux.",
  Sports:
    "Compete in this free sports game without leaving your browser. No downloads, no installs, no equipment needed. The game is optimized for fast loading on school networks and works great on Chromebooks. Challenge yourself to beat the high score or go head-to-head with friends.",
  Racing:
    "Feel the speed with this free racing game that runs directly in your browser. No downloads required. Just click and drive. It works on any device from school Chromebooks to gaming PCs. Smooth frame rates and responsive controls give you a console-like experience for free.",
  Fighting:
    "Step into the arena with this free fighting game built for browsers. No downloads, no installs, no accounts. Combos and special moves are easy to execute with keyboard controls. Works on school networks and plays great on Chromebooks and desktops alike.",
  Casual:
    "Take a break with this free casual game that loads instantly in your browser. No downloads, no sign-ups, no stress. It is the perfect way to unwind between tasks at school or work. Plays on any device including Chromebooks, tablets, and phones.",
  Sandbox:
    "Unleash your creativity with this free sandbox game running in your browser. No downloads, no limits, no accounts. Build, explore, and experiment freely. The game saves your world automatically. Works on Chromebooks and school networks without any restrictions.",
  Survival:
    "Test your survival skills with this free browser survival game. No download, no install. Just you against the wilderness. Manage resources, craft tools, and build shelter all through your web browser. Works on school networks and Chromebooks for on-the-go survival action.",
  Roguelike:
    "Every run is unique in this free roguelike game for browsers. No downloads, no installs, infinite replayability. Procedural generation ensures no two playthroughs are the same. Perfect for short sessions or extended runs. Works on any device.",
  Card: "This free card game runs in your browser with zero downloads. Classic gameplay, crisp visuals, and instant loading. No account creation or sign-up needed. Works on school networks, Chromebooks, and all modern browsers. Just deal and play.",
  Arcade:
    "This free retro arcade game brings classic coin-op fun to your browser without any downloads. It is completely unblocked and works on school networks, Chromebooks, and all devices. Simple one-button or keyboard controls make it instantly accessible. High scores are saved automatically for bragging rights.",
  Educational:
    "Learn something new with this free educational game that runs in your browser. No downloads, no installs, no distraction. Just interactive learning. Designed for students and designed to work on school Chromebooks and networks. Knowledge checks are built right into the gameplay.",
  Idle: "Watch your progress unfold in this free idle clicker game for browsers. No downloads, no active grinding required. It runs in the background and saves automatically. Perfect for multitasking at school or work. Works on Chromebooks and all devices.",
  Rhythm:
    "Tap to the beat with this free music rhythm game in your browser. No downloads, no installs. The audio and visuals are optimized for instant play on any device. Works on school Chromebooks with great performance. Feel the rhythm anywhere.",
  Multiplayer:
    "Challenge real players online in this free multiplayer browser game. No downloads, no sign-up forms, just instant competitive fun. It works behind school firewalls and on Chromebooks. Quick matchmaking gets you into games fast. No account needed. Just click and play."
};

const GENRE_PAGE_CONFIG = {
  Action: {
    slug: "action",
    title: "Action Games - Play Free Online Browser Games No Download",
    h1: "Free Action Games Online",
    desc: "Play free action games in your browser with no downloads or sign-ups. Fast-paced combat, platformers, and shooters that run on any device including Chromebooks and school networks.",
    icon: "fas fa-crosshairs"
  },
  Adventure: {
    slug: "adventure",
    title: "Adventure Games - Free Online Browser Games No Install",
    h1: "Free Adventure Games Online",
    desc: "Play free adventure games online in your browser. No downloads required. Explore worlds, solve puzzles, and complete quests on any device including Chromebooks.",
    icon: "fas fa-compass"
  },
  Strategy: {
    slug: "strategy",
    title: "Strategy Games - Play Free Online Browser Games",
    h1: "Free Strategy Games Online",
    desc: "Play free strategy games in your browser with no downloads. Tactical battles, tower defense, and management sims that work on Chromebooks and school networks.",
    icon: "fas fa-chess"
  },
  Puzzle: {
    slug: "puzzle",
    title: "Puzzle Games - Free Online Brain Games No Download",
    h1: "Free Puzzle Games Online",
    desc: "Play free puzzle games online in your browser. Brain teasers, logic puzzles, and matching games that work on Chromebooks with no downloads needed.",
    icon: "fas fa-puzzle-piece"
  },
  Simulation: {
    slug: "simulation",
    title: "Simulation Games - Free Online Browser Simulators",
    h1: "Free Simulation Games Online",
    desc: "Play free simulation games in your browser. Life sims, farming, building, and management games that run on any device with no downloads.",
    icon: "fas fa-globe"
  },
  RPG: {
    slug: "rpg",
    title: "RPG Games - Free Online Browser Role-Playing Games",
    h1: "Free RPG Games Online",
    desc: "Play free RPGs in your browser with no downloads. Fantasy adventures, character progression, and immersive stories that save automatically.",
    icon: "fas fa-dragon"
  },
  Horror: {
    slug: "horror",
    title: "Horror Games - Free Scary Browser Games Online",
    h1: "Free Horror Games Online",
    desc: "Play free horror games in your browser. Scary experiences with atmospheric audio and visuals. No downloads needed. Works on school Chromebooks.",
    icon: "fas fa-ghost"
  },
  Platformer: {
    slug: "platformer",
    title: "Platformer Games - Free Online Browser Platform Games",
    h1: "Free Platformer Games Online",
    desc: "Play free platformer games online in your browser. Run, jump, and explore through levels designed for instant browser play on any device.",
    icon: "fas fa-shoe-prints"
  },
  Shooter: {
    slug: "shooter",
    title: "Shooter Games - Free Online Browser Shooting Games",
    h1: "Free Shooter Games Online",
    desc: "Play free shooter games in your browser with no downloads. FPS action, bullet hell, and aiming challenges that work on school Chromebooks.",
    icon: "fas fa-bullseye"
  },
  Sports: {
    slug: "sports",
    title: "Sports Games - Free Online Browser Sports Games",
    h1: "Free Sports Games Online",
    desc: "Play free sports games online in your browser. Football, basketball, soccer, and more. No downloads or equipment needed.",
    icon: "fas fa-futbol"
  },
  Racing: {
    slug: "racing",
    title: "Racing Games - Play Free Online Browser Racing Games",
    h1: "Free Racing Games Online",
    desc: "Play free racing games in your browser with no downloads. Drift, speed, and compete on any device including school Chromebooks.",
    icon: "fas fa-flag-checkered"
  },
  Fighting: {
    slug: "fighting",
    title: "Fighting Games - Free Online Browser Fighting Games",
    h1: "Free Fighting Games Online",
    desc: "Play free fighting games online in your browser. Battle opponents with combos and special moves. No downloads needed. Works on any device.",
    icon: "fas fa-hand-fist"
  },
  Casual: {
    slug: "casual",
    title: "Casual Games - Free Relaxing Browser Games Online",
    h1: "Free Casual Games Online",
    desc: "Play free casual games in your browser to relax and unwind. No downloads, no stress. Perfect for quick breaks on any device including Chromebooks.",
    icon: "fas fa-coffee"
  },
  Sandbox: {
    slug: "sandbox",
    title: "Sandbox Games - Free Creative Browser Games Online",
    h1: "Free Sandbox Games Online",
    desc: "Play free sandbox games in your browser. Build, create, and explore without limits. No downloads needed. Works on school Chromebooks.",
    icon: "fas fa-cubes"
  },
  Survival: {
    slug: "survival",
    title: "Survival Games - Free Online Browser Survival Games",
    h1: "Free Survival Games Online",
    desc: "Play free survival games in your browser. Gather resources, craft, and endure. No downloads. Works on Chromebooks and school networks.",
    icon: "fas fa-campground"
  },
  Roguelike: {
    slug: "roguelike",
    title: "Roguelike Games - Free Online Browser Roguelikes",
    h1: "Free Roguelike Games Online",
    desc: "Play free roguelike games in your browser. Procedural runs, permadeath, and infinite replayability. No downloads needed. Works on any device.",
    icon: "fas fa-dice"
  },
  Card: {
    slug: "card",
    title: "Card Games - Free Online Browser Card Games",
    h1: "Free Card Games Online",
    desc: "Play free card games online in your browser. Classic and modern card games with no downloads or sign-ups. Works on school networks.",
    icon: "fas fa-diamond"
  },
  Arcade: {
    slug: "arcade",
    title: "Retro Arcade Games - Play Free Unblocked Browser Games",
    h1: "Free Retro Arcade Games Online",
    desc: "Play free retro arcade games in your browser. Classic coin-op action, unblocked for school and work. No downloads. Works on Chromebooks and any device.",
    icon: "fas fa-gamepad"
  },
  Educational: {
    slug: "educational",
    title: "Educational Games - Free Learning Browser Games Online",
    h1: "Free Educational Games Online",
    desc: "Play free educational games in your browser. Learn math, science, and more through interactive gameplay. Perfect for students on Chromebooks.",
    icon: "fas fa-graduation-cap"
  },
  Idle: {
    slug: "idle",
    title: "Idle Clicker Games - Free Online Browser Idle Games",
    h1: "Free Idle Games Online",
    desc: "Play free idle clicker games in your browser. Watch your progress grow with zero downloads. Perfect for multitasking on school Chromebooks.",
    icon: "fas fa-clock"
  },
  Rhythm: {
    slug: "rhythm",
    title: "Rhythm Games - Free Online Music Browser Games",
    h1: "Free Rhythm Games Online",
    desc: "Play free music rhythm games online in your browser. Tap to the beat with no downloads needed. Works on Chromebooks and all devices.",
    icon: "fas fa-music"
  },
  Multiplayer: {
    slug: "multiplayer",
    title: "Multiplayer Games - Free Online IO Browser Games",
    h1: "Free Multiplayer Games Online",
    desc: "Play free multiplayer games online in your browser. Compete against real players with no downloads or sign-ups. Works on school networks and Chromebooks.",
    icon: "fas fa-users"
  }
};

function classifyGameGenre(title, description) {
  const text = `${title} ${description || ""}`.toLowerCase();
  const matched = [];
  for (const [genre, keywords] of Object.entries(GENRE_KEYWORDS)) {
    if (keywords.some((k) => text.includes(k))) {
      matched.push(genre);
    }
  }
  return matched.length ? matched : ["Casual"];
}

const featurePages = [
  {
    key: "index",
    rootFile: "features.html",
    title: "YukiOS Features - Desktop Environment in Your Browser",
    description:
      "YukiOS is a full browser-based desktop environment with a tiling window manager, Mac desktop mode, 2900 free games, a terminal with Python and Git, retro emulators for DOS/Flash/x86/3DS, and 80+ built-in apps - all running directly in your browser with no installation."
  },
  {
    key: "tiling",
    title: "Tiling Window Manager",
    description:
      "Experience i3 and Hyprland-inspired tiling window management in your browser. Keyboard-driven BSP tiling with 9 workspaces, live config editing, gap control, split ratio, and floating window support - no downloads needed."
  },
  {
    key: "mac-mode",
    title: "Mac Desktop Mode",
    description:
      "Turn your browser into a macOS-style desktop environment. Full menu bar, animated Dock with fisheye effect, Control Center tray, Launchpad app grid, and traffic light window buttons - all running in the browser."
  },
  {
    key: "terminal",
    title: "Browser Terminal with Python, Node & Git",
    description:
      "Full Unix-like terminal in your browser with Python REPL via Pyodide, Node.js REPL via WebContainers, complete Git integration (clone, commit, push, pull), pipeline support, and 30+ built-in commands - no installation required."
  },
  {
    key: "emulators",
    title: "Browser Emulators - DOS, Flash, x86 & 3DS",
    description:
      "Play classic games in your browser with built-in emulators for DOS via JsDos, Flash via Ruffle, x86 via Virtual86, and 3DS via Azahar. Features a Steam-like launcher with overlay, achievements, and playtime tracking."
  },
  {
    key: "games",
    title: "2900 Free Online Games - Play in Your Browser",
    description:
      "Play 2900 free games instantly in your browser on YukiOS. From Minecraft and Geometry Dash to Balatro and Angry Birds - no downloads, no sign-ups, just click and play in a full desktop environment."
  },
  {
    key: "3d-room",
    title: "3D Room - Interactive Game Library",
    description:
      "Explore your game collection in a fully interactive first-person 3D room built with Three.js. Browse a holographic app launcher, arrange furniture in the editor, grab physics-based game cases off shelves, toggle day/night lighting, and launch any game directly from the room - all in the browser with WASD controls."
  },
  {
    key: "start-menu",
    title: "Start Menu & App Grid",
    description:
      "Fuzzy-search start menu with favorites, categories, recent apps, and customizable app grid. Navigate categories, star favorites, and launch anything with keyboard shortcuts - all with glassmorphism styling."
  },
  {
    key: "workspaces",
    title: "Multi-Workspace Desktop",
    description:
      "Manage up to 9 independent workspaces with per-workspace window layouts, independent BSP tiling trees, and seamless switching via keyboard or tray. Each workspace preserves window positions, states, and focus order."
  },
  {
    key: "widgets",
    title: "Desktop Widget System",
    description:
      "Interactive desktop widgets for clock, weather, notes, calendar, todo lists, music controls, system monitor, battery, clipboard, YouTube embed, photo frame slideshow, and timer/stopwatch - all draggable and customizable."
  },
  {
    key: "audio-mixer",
    title: "Audio Mixer & System Sounds",
    description:
      "Per-app volume control with live waveform visualizer, master volume and mute toggle, system sounds for common actions, and tray icon with scroll-to-adjust. Fine-tune every audio source independently."
  },
  {
    key: "user-accounts",
    title: "User Accounts & Multi-Profile",
    description:
      "Create multiple user profiles with custom nicknames, avatars, and desktop configurations. Lock screen with idle timeout, session switching, and per-profile wallpaper and theme persistence."
  }
];

const GH = "https://cdn.jsdelivr.net/gh/Reeyuki/YukiOS@main/.github";
const GAMES_CDN = "https://cdn.jsdelivr.net/gh/Reeyuki/yukios-games@main";

function resolveGameUrl(url, type) {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  let clean = url.startsWith("/") ? url.slice(1) : url;
  clean = clean
    .replace(/^static\//, "")
    .replace(/^games\//, "")
    .replace(/^static\/games\//, "");

  if (type === "html") {
    return `${GAMES_CDN}/html/${clean}`;
  }

  return `${GAMES_CDN}/${clean}`;
}

const galleryImages = [
  { src: `${GH}/tiling.png`, featureKey: "tiling" },
  { src: `${GH}/tiling-2.png`, featureKey: "tiling" },
  { src: `${GH}/mac.png`, featureKey: "mac-mode" },
  { src: `${GH}/btop-lavat-cmatrix.png`, featureKey: "terminal" },
  { src: `${GH}/overlay.png`, featureKey: "emulators" },
  { src: `${GH}/steam.png`, featureKey: "games" },
  { src: `${GH}/3d.png`, featureKey: "3d-room" },
  { src: `${GH}/startmenu.png`, featureKey: "start-menu" },
  { src: `${GH}/workspaces.png`, featureKey: "workspaces" },
  { src: `${GH}/widgets.png`, featureKey: "widgets" },
  { src: `${GH}/audio1.png`, featureKey: "audio-mixer" },
  { src: `${GH}/login.png`, featureKey: "user-accounts" }
];

function buildSitemap(apps, games, gameDescs, featurePages) {
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const imgTag = (src) => `<image:image><image:loc>${esc(src)}</image:loc></image:image>`;
  const lastmod = new Date().toISOString().slice(0, 10);
  const entry = (loc, img, priority, changefreq) => {
    const out = ["  <url>"];
    out.push(`    <loc>${esc(loc)}</loc>`);
    out.push(`    <lastmod>${lastmod}</lastmod>`);
    out.push(`    <changefreq>${changefreq}</changefreq>`);
    out.push(`    <priority>${priority.toFixed(1)}</priority>`);
    if (img) out.push(`    ${imgTag(img)}`);
    out.push("  </url>");
    return out.join("\n");
  };
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>'];
  lines.push(
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">'
  );
  lines.push(entry(BASE, `${GH}/mac.png`, 1.0, "daily"));
  lines.push(entry(`${BASE}/apps.html`, `${GH}/mac.png`, 0.9, "weekly"));
  lines.push(entry(`${BASE}/games.html`, `${GH}/steam.png`, 0.9, "daily"));
  lines.push(entry(`${BASE}/features.html`, `${GH}/mac.png`, 0.8, "weekly"));
  const sitemapGenreMap = {};
  for (const g of games) {
    for (const gn of g.genre) {
      if (!sitemapGenreMap[gn]) sitemapGenreMap[gn] = true;
    }
  }
  for (const genre of Object.keys(sitemapGenreMap).sort()) {
    const cfg = GENRE_PAGE_CONFIG[genre];
    if (!cfg) continue;
    lines.push(entry(`${BASE}/games/${cfg.slug}.html`, `${GH}/steam.png`, 0.7, "weekly"));
  }
  if (featurePages) {
    for (const f of featurePages) {
      if (f.rootFile) continue;
      const img = galleryImages.find((i) => i.featureKey === f.key);
      lines.push(entry(`${BASE}/feature/${f.key}.html`, img ? img.src : `${GH}/mac.png`, 0.6, "monthly"));
    }
  }
  for (const a of apps) {
    lines.push(entry(`${BASE}/app/${a.key}.html`, `${GH}/mac.png`, 0.6, "monthly"));
  }
  for (const g of games) {
    lines.push(entry(`${BASE}/class/${g.key}.html`, `${GH}/steam.png`, 0.5, "monthly"));
  }
  lines.push("</urlset>");
  return lines.join("\n") + "\n";
}

const landingStyle = `<style>
*{margin:0;padding:0;box-sizing:border-box}
.seo-overlay{position:fixed;inset:0;z-index:999999;background:#0a0a14;overflow-y:auto;display:flex;flex-direction:column;transition:opacity .5s ease,visibility .5s ease;-webkit-font-smoothing:antialiased}
.seo-overlay.hidden{opacity:0;visibility:hidden;pointer-events:none}
.seo-header{display:flex;align-items:center;justify-content:space-between;padding:0 24px;height:56px;border-bottom:1px solid rgba(255,255,255,0.06);background:rgba(10,10,20,0.95);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);flex-shrink:0;position:sticky;top:0;z-index:10}
.seo-brand{color:#fff;font-size:1.15rem;font-weight:700;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;letter-spacing:-.01em;text-decoration:none}
.seo-brand em{font-style:normal;color:#d97706}
.seo-nav-links{display:flex;gap:20px}
.seo-nav-links a{color:#888;font-size:.9rem;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;transition:color .15s}
.seo-nav-links a:hover{color:#fff}
.seo-main{flex:1;display:flex;flex-direction:column;align-items:center;padding:60px 24px 80px;width:100%}
.seo-hero{text-align:center;max-width:800px;margin-bottom:48px;width:100%}
.seo-hero h1{color:#fff;font-size:clamp(2rem,5vw,3rem);margin:0 0 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-weight:800;line-height:1.15;letter-spacing:-.02em}
.seo-hero p{color:#999;font-size:clamp(1rem,2vw,1.2rem);line-height:1.7;margin:0 0 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
.seo-hero .launch-btn{padding:14px 44px;background:#d97706;color:#fff;border:none;border-radius:10px;font-size:1.1rem;cursor:pointer;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;transition:background .2s,transform .15s;font-weight:600;display:inline-block;user-select:none}
.seo-hero .launch-btn:hover{background:#b45309;transform:scale(1.03)}
.seo-hero .launch-btn:active{transform:scale(.97)}
.seo-screenshot{width:100%;max-width:900px;margin-bottom:48px;border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);box-shadow:0 24px 64px rgba(0,0,0,0.5)}
.slideshow-container{position:relative;width:100%;aspect-ratio:16/9;background:#000}
.slideshow-wrapper{position:relative;width:100%;height:100%}
.slideshow-wrapper img{width:100%;height:100%;object-fit:cover;display:block}
.slideshow-btn{position:absolute;top:50%;transform:translateY(-50%);width:48px;height:48px;background:rgba(0,0,0,0.6);border:1px solid rgba(255,255,255,0.2);border-radius:50%;color:#fff;font-size:1.2rem;cursor:pointer;transition:background .2s,border-color .2s;z-index:2;display:flex;align-items:center;justify-content:center}
.slideshow-btn:hover{background:rgba(217,119,6,0.8);border-color:#d97706}
.slideshow-btn-prev{left:12px}
.slideshow-btn-next{right:12px}
.slideshow-dots{position:absolute;bottom:16px;left:50%;transform:translateX(-50%);display:flex;gap:8px;z-index:2}
.slideshow-dot{width:10px;height:10px;border-radius:50%;background:rgba(255,255,255,0.4);cursor:pointer;transition:background .2s}
.slideshow-dot:hover{background:rgba(255,255,255,0.7)}
.slideshow-dot.active{background:#d97706}
.seo-content{width:100%;max-width:800px}
.seo-content h2{color:#ddd;font-size:1.3rem;margin:0 0 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-weight:600}
.seo-content ul{text-align:left;margin:0 0 24px;padding:0 0 0 20px;list-style:disc;color:#bbb;line-height:1.8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:1rem}
.seo-content ul li{margin-bottom:4px}
.seo-content .seo-cta{color:#aaa;font-size:1rem;margin:0 0 16px;line-height:1.6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
.seo-content .seo-more{color:#999;font-size:.95rem;margin:24px 0 0;line-height:1.8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
.seo-content .seo-more a{color:#d97706;text-decoration:none}
.seo-content .seo-more a:hover{text-decoration:underline}
.seo-footer{flex-shrink:0;border-top:1px solid rgba(255,255,255,0.06);padding:24px;text-align:center;background:rgba(10,10,20,0.8)}
.seo-footer p{color:#666;font-size:.9rem;margin:0 0 6px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
.seo-footer a{color:#888;font-size:.9rem;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;transition:color .15s}
.seo-footer a:hover{color:#d97706}
.seo-gallery{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;max-width:1100px;width:100%;margin:0 auto}
.seo-gallery .feature-card{position:relative;border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);transition:transform .2s,border-color .2s;aspect-ratio:16/11;text-decoration:none;display:block}
.seo-gallery .feature-card:hover{transform:scale(1.05);border-color:rgba(217,119,6,0.5);z-index:1}
.seo-gallery .feature-card img{width:100%;height:100%;object-fit:cover;display:block}
.seo-gallery .feature-card-label{position:absolute;bottom:0;left:0;right:0;padding:10px 12px;background:linear-gradient(transparent,rgba(0,0,0,.85));color:#fff;font-size:.9rem;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-weight:500;text-align:center;line-height:1.3}
.seo-stats{display:flex;justify-content:center;gap:48px;flex-wrap:wrap;margin:40px auto;max-width:900px;padding:0 24px}
.seo-stat{text-align:center}
.seo-stat-num{color:#d97706;font-size:2rem;font-weight:800;display:block;line-height:1.2}
.seo-stat-label{color:#888;font-size:.85rem;margin-top:4px;display:block}
.seo-features{max-width:1200px;margin:40px auto;padding:0 24px;width:100%}
.seo-feature-category{margin-bottom:48px}
.seo-category-title{color:#fff;font-size:1.8rem;font-weight:700;margin-bottom:24px;display:flex;align-items:center;gap:12px}
.seo-category-title i{color:#d97706}
.seo-feature-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px}
.seo-feature{display:flex;gap:16px;padding:20px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:12px;transition:background .2s,border-color .2s}
.seo-feature:hover{background:rgba(255,255,255,0.04);border-color:rgba(217,119,6,0.2)}
.seo-feature-icon{width:40px;height:40px;flex-shrink:0;background:rgba(217,119,6,0.12);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:1.2rem;color:#d97706}
.seo-feature-body{flex:1}
.seo-feature-body h3{color:#ddd;font-size:1rem;margin:0 0 6px;font-weight:600;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
.seo-feature-body p{color:#999;font-size:.9rem;line-height:1.5;margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
.seo-feature-body a{color:#d97706;text-decoration:none}
.seo-feature-body a:hover{text-decoration:underline}
.seo-cta-row{display:flex;justify-content:center;gap:16px;flex-wrap:wrap;margin:48px auto;max-width:800px;padding:0 24px}
.seo-cta-card{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:28px 32px;text-align:center;text-decoration:none;flex:1;min-width:200px;transition:background .2s,border-color .2s}
.seo-cta-card:hover{background:rgba(255,255,255,0.06);border-color:rgba(217,119,6,0.3)}
.seo-cta-card h3{color:#fff;font-size:1.1rem;margin:0 0 6px;font-weight:600;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
.seo-cta-card p{color:#999;font-size:.9rem;margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
.seo-cta-card .cta-count{color:#d97706;font-size:1.6rem;font-weight:800;display:block;margin-bottom:4px}
</style>`;

function makeStandalonePage(title, desc, jsonld, canonicalUrl, ogImage, extraContent, launchUrl) {
  const galleryImagesJson = JSON.stringify(galleryImages.map((g) => g.src));
  const screenshot = `
<section class="seo-screenshot">
  <div class="slideshow-container">
    <button class="slideshow-btn slideshow-btn-prev" onclick="changeSlide(-1)"><i class="fas fa-chevron-left"></i></button>
    <div class="slideshow-wrapper">
      <img id="slideshow-img" src="${galleryImages[0].src}" alt="YukiOS Screenshot" loading="lazy" />
      <div class="slideshow-dots" id="slideshow-dots"></div>
    </div>
    <button class="slideshow-btn slideshow-btn-next" onclick="changeSlide(1)"><i class="fas fa-chevron-right"></i></button>
  </div>
</section>
<script>
const slideshowImages = ${galleryImagesJson};
let currentSlide = 0;
let slideshowInterval;

function showSlide(index) {
  const img = document.getElementById('slideshow-img');
  if (!img) return;
  currentSlide = (index + slideshowImages.length) % slideshowImages.length;
  img.src = slideshowImages[currentSlide];
  updateDots();
}

function changeSlide(direction) {
  showSlide(currentSlide + direction);
  resetSlideshow();
}

function updateDots() {
  const dotsContainer = document.getElementById('slideshow-dots');
  if (!dotsContainer) return;
  dotsContainer.innerHTML = '';
  slideshowImages.forEach((_, index) => {
    const dot = document.createElement('span');
    dot.className = 'slideshow-dot' + (index === currentSlide ? ' active' : '');
    dot.onclick = () => { showSlide(index); resetSlideshow(); };
    dotsContainer.appendChild(dot);
  });
}

function startSlideshow() {
  slideshowInterval = setInterval(() => changeSlide(1), 5000);
}

function resetSlideshow() {
  clearInterval(slideshowInterval);
  startSlideshow();
}

document.addEventListener('DOMContentLoaded', () => {
  updateDots();
  startSlideshow();
});
</script>`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escHtml(title)} - YukiOS</title>
<meta name="description" content="${escHtml(desc)}" />
<meta property="og:title" content="${escHtml(title)} - YukiOS" />
<meta property="og:description" content="${escHtml(desc)}" />
<meta property="og:type" content="website" />
<meta property="og:image" content="${escHtml(ogImage)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escHtml(title)} - YukiOS" />
<meta name="twitter:description" content="${escHtml(desc)}" />
<meta name="twitter:image" content="${escHtml(ogImage)}" />
<link rel="canonical" href="${canonicalUrl}" />
<script type="application/ld+json">${jsonld}</script>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Barlow:wght@300;400;500;600&display=swap" />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Barlow:wght@300;400;500;600&display=swap" media="print" onload="this.media='all'" />
<link rel="icon" type="image/x-icon" href="/favicon.ico" />
${landingStyle}
</head>
<body>
<div class="seo-overlay" role="main">
  <header class="seo-header">
    <a href="/" class="seo-brand"><em>Y</em>ukiOS</a>
    <div class="seo-nav-links">
      <a href="/features.html">Features</a>
      <a href="/apps.html">Apps</a>
      <a href="/games.html">Games</a>
      <a href="https://github.com/Reeyuki/YukiOS">GitHub</a>
    </div>
  </header>
  <main class="seo-main">
    <section class="seo-hero">
      <h1>${title}</h1>
      <p>${desc}</p>
      <a class="launch-btn" href="${launchUrl}">Launch YukiOS</a>
    </section>
    ${screenshot}
    <section class="seo-content">
      ${extraContent || ""}
      <style>${AD_SLOT_STYLE}</style>
      ${adSlotHtml("landing-ad")}
    </section>
  </main>
  <footer class="seo-footer">
    <p>YukiOS - Free Browser-Based Desktop Environment</p>
    <div><a href="/features.html">Features</a> &middot; <a href="https://github.com/Reeyuki/YukiOS">GitHub</a> &middot; <a href="/">About</a></div>
  </footer>
</div>
${adSlotScript("landing-ad")}
</body>
</html>`;
}

function makeLanding(title, desc, extraContent, imageUrl) {
  const galleryImagesJson = JSON.stringify(galleryImages.map((g) => g.src));
  const screenshot = `
<section class="seo-screenshot">
  <div class="slideshow-container">
    <button class="slideshow-btn slideshow-btn-prev" onclick="changeSlide(-1)"><i class="fas fa-chevron-left"></i></button>
    <div class="slideshow-wrapper">
      <img id="slideshow-img" src="${galleryImages[0].src}" alt="YukiOS Screenshot" loading="lazy" />
      <div class="slideshow-dots" id="slideshow-dots"></div>
    </div>
    <button class="slideshow-btn slideshow-btn-next" onclick="changeSlide(1)"><i class="fas fa-chevron-right"></i></button>
  </div>
</section>
<script>
const slideshowImages = ${galleryImagesJson};
let currentSlide = 0;
let slideshowInterval;

function showSlide(index) {
  const img = document.getElementById('slideshow-img');
  if (!img) return;
  currentSlide = (index + slideshowImages.length) % slideshowImages.length;
  img.src = slideshowImages[currentSlide];
  updateDots();
}

function changeSlide(direction) {
  showSlide(currentSlide + direction);
  resetSlideshow();
}

function updateDots() {
  const dotsContainer = document.getElementById('slideshow-dots');
  if (!dotsContainer) return;
  dotsContainer.innerHTML = '';
  slideshowImages.forEach((_, index) => {
    const dot = document.createElement('span');
    dot.className = 'slideshow-dot' + (index === currentSlide ? ' active' : '');
    dot.onclick = () => { showSlide(index); resetSlideshow(); };
    dotsContainer.appendChild(dot);
  });
}

function startSlideshow() {
  slideshowInterval = setInterval(() => changeSlide(1), 5000);
}

function resetSlideshow() {
  clearInterval(slideshowInterval);
  startSlideshow();
}

document.addEventListener('DOMContentLoaded', () => {
  updateDots();
  startSlideshow();
});
</script>`;
  return `${landingStyle}
<div class="seo-overlay" id="seo-overlay" role="main">
  <header class="seo-header">
    <a href="/" class="seo-brand"><em>Y</em>ukiOS</a>
    <div class="seo-nav-links">
      <a href="/features.html">Features</a>
      <a href="/apps.html">Apps</a>
      <a href="/games.html">Games</a>
      <a href="https://github.com/Reeyuki/YukiOS">GitHub</a>
    </div>
  </header>
  <main class="seo-main">
    <section class="seo-hero">
      <h1>${title}</h1>
      <p>${desc}</p>
      <button class="launch-btn" onclick="document.getElementById('seo-overlay').classList.add('hidden')">Launch YukiOS</button>
    </section>
    ${screenshot}
    <section class="seo-content">
      ${extraContent || ""}
      <style>${AD_SLOT_STYLE}</style>
      ${adSlotHtml("landing-ad")}
    </section>
  </main>
  <footer class="seo-footer">
    <p>YukiOS - Free Browser-Based Desktop Environment</p>
    <div><a href="/features.html">Features</a> &middot; <a href="https://github.com/Reeyuki/YukiOS">GitHub</a> &middot; <a href="/">About</a></div>
  </footer>
</div>
${adSlotScript("landing-ad")}`;
}

function generateBullets(description, minBullets) {
  if (minBullets == null) minBullets = 3;
  const pts = description
    .split(/\.\s+/)
    .filter((s) => s.trim().length > 10)
    .map((s) => s.replace(/\.+$/, "").trim());
  const fallbacks = [
    "Available directly in your browser with no downloads or installation required",
    "Part of the YukiOS desktop environment with 80+ built-in applications and 2900 games",
    "Accessible from the Start Menu and compatible with the full YukiOS ecosystem"
  ];
  for (const fb of fallbacks) {
    if (pts.length >= minBullets) break;
    pts.push(fb);
  }
  return pts;
}

function escHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const AD_LDR_KEY = "28c33f91ee21bcf1063e489aae3024f8";
const AD_RECT_KEY = "914131b4a8e7414d1576d6d7c5a6c87f";
const STORE_AD_KEY_1 = "f88fd46583493c3820f283948e5e5391";
const STORE_AD_KEY_2 = "ee9dc67de90729e2804aa8aba6454ec8";

const AD_ENGINE_SCRIPT = `function injectAdsterraAd(id,key,w,h,delay,fmt){
  function doIt(){
    var slot=document.getElementById(id);
    if(!slot)return;
    var cfg=document.createElement('script');
    cfg.text="atOptions={'key':'"+key+"','format':'"+(fmt||'iframe')+"','height':"+h+",'width':"+w+",'params':{}};";
    slot.appendChild(cfg);
    var inv=document.createElement('script');
    inv.src="https://www.highperformanceformat.com/"+key+"/invoke.js";
    inv.async=true;
    slot.appendChild(inv);
  }
  if(delay>0)setTimeout(doIt,delay);else doIt();
}`;

const AD_SLOT_STYLE = `.yuki-ad-slot{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;margin:32px auto;width:100%}
.yuki-ad-slot span{color:#555;font-size:.7rem;text-transform:uppercase;letter-spacing:.08em;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
.yuki-ad-unit{min-height:160px;display:flex;align-items:center;justify-content:center;width:100%;max-width:600px;overflow:hidden}`;

function adSlotHtml(prefix) {
  return `<div class="yuki-ad-slot"><span>Advertisement</span><div class="yuki-ad-unit" id="${prefix}-1"></div></div>
<div class="yuki-ad-slot"><span>Advertisement</span><div class="yuki-ad-unit" id="${prefix}-2"></div></div>`;
}

function adSlotScript(prefix) {
  return `<script>
${AD_ENGINE_SCRIPT}
injectAdsterraAd("${prefix}-1","${STORE_AD_KEY_1}",300,160,0);
injectAdsterraAd("${prefix}-2","${STORE_AD_KEY_2}",600,160,1000);
</script>`;
}

function makeMinimalGamePage(
  title,
  desc,
  jsonld,
  canonicalUrl,
  gameUrl,
  extraContent,
  seoImage,
  gameIcon,
  seoTitle,
  seoDesc,
  gameType
) {
  const st = seoTitle || `${title} - Play Online Free on YukiOS`;
  const sd = seoDesc || desc;
  const isSubwaySurfers = title.toLowerCase().includes("subway surfers");
  let finalGameIcon = gameIcon;
  if (isSubwaySurfers) {
    const gameName = title
      .replace(/subway surfers/i, "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "");
    finalGameIcon = `https://cdn.jsdelivr.net/gh/Reeyuki/yukios@main/subwaySurfers/${gameName}.webp`;
  }

  let gamePlayerHtml = "";
  if (gameType === "swf") {
    gamePlayerHtml = `
<div id="player" style="width:100%;height:800px;background:black;"></div>
<script src="https://unpkg.com/@ruffle-rs/ruffle/ruffle.js"></script>
<script>
(function(){
  const ruffle = window.RufflePlayer.newest();
  const player = ruffle.createPlayer();

  player.style.width = "100%";
  player.style.height = "100%";
  player.style.display = "block";

  document.getElementById("player").appendChild(player);
  player.load("${escHtml(gameUrl)}");
})();
</script>`;
  } else if (["gba", "psp", "nds", "megadrive", "genesis"].includes(gameType)) {
    gamePlayerHtml = `<iframe id="game-iframe" src="${escHtml(gameUrl)}" allow="autoplay; fullscreen" sandbox="allow-forms allow-downloads allow-modals allow-pointer-lock allow-popups allow-same-origin allow-scripts" style="width:100%;height:100%;border:none;display:block;"></iframe>`;
  } else {
    gamePlayerHtml = `<iframe id="game-iframe" src="${escHtml(gameUrl)}" allow="autoplay; fullscreen; clipboard-write; encrypted-media; picture-in-picture" sandbox="allow-forms allow-downloads allow-modals allow-pointer-lock allow-popups allow-same-origin allow-scripts allow-top-navigation-by-user-activation" style="width:100%;height:100%;border:none;display:block;"></iframe>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escHtml(st)}</title>
<meta name="description" content="${escHtml(sd)}">
<meta property="og:title" content="${escHtml(st)}">
<meta property="og:description" content="${escHtml(sd)}">
<meta property="og:type" content="website">
<meta property="og:image" content="${escHtml(seoImage)}">
<meta property="og:url" content="${escHtml(canonicalUrl)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escHtml(st)}">
<meta name="twitter:description" content="${escHtml(sd)}">
<meta name="twitter:image" content="${escHtml(seoImage)}">
<link rel="canonical" href="${escHtml(canonicalUrl)}">
<script type="application/ld+json">${jsonld}</script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0a0a14;color:#ccc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;overflow:hidden;height:100vh}
#seo-content{position:fixed;inset:0;z-index:10;overflow-y:auto;background:#0a0a14}
#seo-content.hidden{display:none}
.seo-header{display:flex;align-items:center;justify-content:space-between;padding:0 24px;height:56px;border-bottom:1px solid rgba(255,255,255,0.06);background:rgba(10,10,20,0.95);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);position:sticky;top:0;z-index:10}
.seo-brand{color:#fff;font-size:1.15rem;font-weight:700;letter-spacing:-.01em;text-decoration:none}
.seo-brand em{font-style:normal;color:#d97706}
.seo-nav-links{display:flex;gap:16px}
.seo-nav-links a{color:#888;font-size:.9rem;text-decoration:none;transition:color .15s}
.seo-nav-links a:hover{color:#fff}
.game-hero{position:relative;min-height:300px;background:linear-gradient(180deg,rgba(10,10,20,0.5) 0%,rgba(10,10,20,0.95) 100%);display:flex;align-items:center;padding:32px 24px}
.game-hero-bg{position:absolute;inset:0;z-index:-1;background-size:cover;background-position:center;opacity:0.4;filter:blur(2px)}
.game-hero-content{position:relative;z-index:1;max-width:1400px;margin:0 auto;width:100%;display:grid;grid-template-columns:1fr 280px;gap:32px;align-items:center}
.game-main{max-width:800px}
.game-main h1{color:#fff;font-size:clamp(2rem,5vw,3.5rem);font-weight:800;margin-bottom:12px;line-height:1.1;letter-spacing:-.02em}
.game-main p{color:#aaa;font-size:1.1rem;line-height:1.6;margin-bottom:24px}
.game-main .play-btn{padding:16px 48px;background:#d97706;color:#fff;border:none;border-radius:12px;font-size:1.2rem;cursor:pointer;font-weight:700;transition:all .2s;display:inline-flex;align-items:center;gap:8px}
.game-main .play-btn:hover{background:#b45309;transform:translateY(-2px);box-shadow:0 8px 24px rgba(217,119,6,0.3)}
.game-sidebar{display:flex;flex-direction:column;gap:16px}
.game-card{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:20px}
.game-card h3{color:#fff;font-size:.85rem;text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px;font-weight:600}
.game-card-value{color:#ddd;font-size:1rem;line-height:1.5}
.game-icon-large{width:100%;aspect-ratio:1;border-radius:12px;object-fit:contain;border:1px solid rgba(255,255,255,0.1);background:#0a0a14}
.game-layout{max-width:1400px;margin:0 auto;padding:32px 24px;display:grid;grid-template-columns:1fr 280px;gap:32px}
.game-content-section{margin-bottom:48px}
.game-content-section h2{color:#fff;font-size:1.8rem;font-weight:700;margin-bottom:20px;display:flex;align-items:center;gap:12px}
.game-content-section h2::before{content:'';width:4px;height:28px;background:#d97706;border-radius:2px}
.game-content-section p{color:#bbb;font-size:1rem;line-height:1.8;margin-bottom:16px}
.game-content-section ul{margin:0 0 20px;padding:0 0 0 24px;color:#bbb;line-height:1.8}
.game-content-section li{margin-bottom:8px}
.game-screenshot{width:100%;border-radius:12px;border:1px solid rgba(255,255,255,0.08);box-shadow:0 24px 64px rgba(0,0,0,0.5);margin-bottom:24px}
.game-sidebar-sticky{position:sticky;top:80px}
.game-info-card{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:24px;margin-bottom:24px}
.game-info-card h3{color:#fff;font-size:1rem;font-weight:600;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid rgba(255,255,255,0.08)}
.game-info-row{display:flex;justify-content:space-between;padding:8px 0;font-size:.95rem}
.game-info-label{color:#666}
.game-info-value{color:#ddd;text-align:right}
.game-tags{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
.game-tag{background:rgba(217,119,6,0.15);color:#d97706;padding:4px 12px;border-radius:6px;font-size:.85rem;font-weight:500}
.fav-btn{background:none;border:none;color:#666;cursor:pointer;font-size:1.5rem;transition:color .2s;padding:8px}
.fav-btn:hover{color:#d97706}
.fav-btn.active{color:#d97706}
.game-iframe-container{width:100%;min-height:700px;background:#000;border-radius:12px;overflow:hidden;margin-bottom:32px;border:1px solid rgba(255,255,255,0.08);box-shadow:0 24px 64px rgba(0,0,0,0.5)}
.game-iframe-container iframe{width:100%;height:800px;border:none;display:block}
.recently-played{margin-top:24px}
.recently-played h3{color:#fff;font-size:.9rem;font-weight:600;margin-bottom:12px;text-transform:uppercase;letter-spacing:.05em}
.recently-played-item{display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.06)}
.recently-played-item:last-child{border-bottom:none}
.recently-played-icon{width:32px;height:32px;border-radius:6px;object-fit:cover}
.recently-played-link{color:#888;font-size:.85rem;text-decoration:none;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.recently-played-link:hover{color:#d97706}
.you-may-like{margin-top:48px}
.you-may-like h2{color:#fff;font-size:1.8rem;font-weight:700;margin-bottom:24px;display:flex;align-items:center;gap:12px}
.you-may-like h2::before{content:'';width:4px;height:28px;background:#d97706;border-radius:2px}
.you-may-like-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px}
.you-may-like-card{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:16px;transition:all .2s;text-decoration:none;display:block}
.you-may-like-card:hover{background:rgba(255,255,255,0.06);border-color:rgba(217,119,6,0.3);transform:translateY(-4px)}
.you-may-like-icon{width:48px;height:48px;border-radius:8px;object-fit:cover;margin-bottom:12px;background:rgba(255,255,255,0.05)}
.you-may-like-title{color:#fff;font-size:1rem;font-weight:600;margin-bottom:4px;line-height:1.3}
.you-may-like-genre{color:#666;font-size:.85rem}
.seo-footer{border-top:1px solid rgba(255,255,255,0.06);padding:32px 24px;text-align:center;background:rgba(10,10,20,0.8);margin-top:48px}
.seo-footer p{color:#666;font-size:.9rem;margin-bottom:8px}
.seo-footer a{color:#888;font-size:.9rem;text-decoration:none;transition:color .15s;margin:0 8px}
.seo-footer a:hover{color:#d97706}
.seo-body .seo-more{color:#999;font-size:.95rem;margin-top:16px;line-height:1.8}
.seo-body .seo-more a{color:#d97706;text-decoration:none}
.seo-body .seo-more a:hover{text-decoration:underline}
.seo-body .seo-cta{color:#aaa;font-size:1rem;margin-bottom:12px;line-height:1.6}
#game-player{display:none;flex-direction:column;height:100vh;width:100vw;position:fixed;inset:0;z-index:20;background:#000}
#game-player.active{display:flex}
.gp-header{display:flex;align-items:center;justify-content:space-between;padding:0 16px;height:48px;background:#1a1a2e;flex-shrink:0}
.gp-header button{background:none;border:none;color:#ccc;cursor:pointer;font-size:.9rem;padding:4px 12px;border-radius:6px;transition:background .15s;font-family:inherit}
.gp-header button:hover{background:rgba(255,255,255,0.1);color:#fff}
.gp-header .gp-title{color:#fff;font-size:.95rem;font-weight:600}
.gp-ad{flex-shrink:0;display:flex;justify-content:center;align-items:center;min-height:90px;background:#0a0a14}
.gp-ad--rect{min-height:250px}
.gp-frame{flex:1;position:relative}
.gp-frame iframe{width:100%;height:100%;border:none;display:block}
@media(max-width:900px){.game-hero-content{grid-template-columns:1fr}.game-sidebar{display:none}.game-layout{grid-template-columns:1fr}.game-sidebar-sticky{position:static}.game-iframe-container iframe{height:600px}}
</style>
</head>
<body>
<div id="seo-content">
  <header class="seo-header">
    <a href="/" class="seo-brand"><em>Y</em>ukiOS</a>
    <div class="seo-nav-links">
      <a href="/games.html">Games</a>
      <a href="/apps.html">Apps</a>
      <a href="/features.html">Features</a>
    </div>
  </header>
  <div class="game-hero">
    <div class="game-hero-bg" style="background-image:url('${escHtml(seoImage)}')"></div>
    <div class="game-hero-content">
      <div class="game-main">
        <h1>${escHtml(title)}</h1>
        <p>${escHtml(desc)}</p>
        <div style="display:flex;gap:12px;align-items:center">
          <button class="fav-btn" id="fav-btn" onclick="toggleFavorite()" title="Add to favorites">☆</button>
        </div>
      </div>
      <div class="game-sidebar">
        ${finalGameIcon ? `<img class="game-icon-large" src="${escHtml(finalGameIcon)}" alt="${escHtml(title)} icon" loading="lazy" />` : ""}
      </div>
    </div>
  </div>
  <div class="game-layout">
    <div class="game-main-content">
      <div class="game-iframe-container" id="game-container">
        ${gamePlayerHtml}
      </div>
      <div class="game-content-section seo-body">
        ${extraContent || ""}
      </div>
    </div>
    <aside class="game-sidebar-sticky">
      <div class="game-info-card">
        <h3>Game Info</h3>
        <div class="game-info-row">
          <span class="game-info-label">Platform</span>
          <span class="game-info-value">Browser</span>
        </div>
        <div class="game-info-row">
          <span class="game-info-label">Price</span>
          <span class="game-info-value">Free</span>
        </div>
        <div class="game-info-row">
          <span class="game-info-label">Install</span>
          <span class="game-info-value">No Download</span>
        </div>
      </div>
      <div class="game-info-card recently-played">
        <h3>Recently Played</h3>
        <div id="recently-played-list"></div>
      </div>
      <div class="game-info-card">
        <h3>Quick Links</h3>
        <a href="/games.html" style="color:#d97706;text-decoration:none;display:block;padding:8px 0;font-size:.95rem">→ Browse All Games</a>
        <a href="/features.html" style="color:#d97706;text-decoration:none;display:block;padding:8px 0;font-size:.95rem">→ YukiOS Features</a>
      </div>
      <style>${AD_SLOT_STYLE}</style>
      ${adSlotHtml("sidebar-ad")}
    </aside>
  </div>
  <footer class="seo-footer">
    <p>YukiOS - Free Browser-Based Desktop Environment</p>
    <div>
      <a href="/features.html">Features</a>
      <a href="/games.html">Games</a>
      <a href="/apps.html">Apps</a>
      <a href="https://github.com/Reeyuki/YukiOS">GitHub</a>
    </div>
  </footer>
</div>
<div id="game-player">
  <div class="gp-header">
    <button onclick="window.location.href='/'">Back to YukiOS</button>
    <span class="gp-title">${escHtml(title)}</span>
    <button onclick="toggleFS()">Fullscreen</button>
  </div>
  <div class="gp-ad" id="ad-leaderboard"></div>
  <div class="gp-frame">
    <iframe id="game-frame" src="about:blank" allow="autoplay; fullscreen; clipboard-write; encrypted-media; picture-in-picture" sandbox="allow-forms allow-downloads allow-modals allow-pointer-lock allow-popups allow-same-origin allow-scripts allow-top-navigation-by-user-activation" data-game-url="${escHtml(gameUrl)}"></iframe>
  </div>
  <div class="gp-ad gp-ad--rect" id="ad-rectangle"></div>
</div>
<script>
const CURRENT_GAME_KEY = "${escHtml(title)}";
const CURRENT_GAME_URL = "${escHtml(gameUrl)}";
const CURRENT_GAME_ICON = "${escHtml(finalGameIcon || "")}";
const CURRENT_GAME_TYPE = "${escHtml(gameType || "")}";

function loadGame() {
  if (CURRENT_GAME_TYPE === "swf") return;
  var container = document.getElementById('game-container');
  var iframe = document.getElementById('game-iframe');
  if (!container || !iframe) return;
  container.style.display = 'block';
  iframe.src = 'about:blank';
  fetchGameHtml(CURRENT_GAME_URL).then(function(blobUrl) {
    iframe.src = blobUrl;
    addToRecentlyPlayed();
    container.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

function fetchGameHtml(url){
  return fetch(url).then(function(r){if(!r.ok)throw new Error(r.status);return r.text()}).then(function(html){
    var dirBase=url.slice(0,url.lastIndexOf('/')+1);
    var parts=url.split('/');
    var rootBase=parts.slice(0,parts.indexOf('yukios-games@main')+1).join('/')+'/';
    var ignore=['angrybirds','subway','azahar','catgoesfishing','tabs','roblox','miside','BirthdayBash','boilNoodlesAtNight','cuphead','brotatoPawsNClaws','cheeseRolling','fez','theManFromTheWindow2','beatblock','happyRoom','agesOfConflict','whileTrueLearn','theAdventuresOfSirKicksalot','granny3','peakVeryWip','amongUs','gta3'].some(function(k){return url.toLowerCase().indexOf(k)!==-1});
    if(!ignore){
      html=html
        .replace(/\\b(src|poster|data)=(["'])\\//g,'$1=$2'+rootBase)
        .replace(/<(link|a|form)\\b([^>]*?)\\b(href|action)=(["'])\\//g,'<$1$2$3=$4'+rootBase)
        .replace(/\\burl\\(\\s*(["']?)\\//g,'url($1'+rootBase)
        .replace(/\\b(src|poster|data)=(["'])(?!https?:|data:|blob:|\\/\\/|#)/g,'$1=$2'+dirBase)
        .replace(/<(link|a|form)\\b([^>]*?)\\b(href|action)=(["'])(?!https?:|data:|blob:|\\/\\/|#)/g,'<$1$2$3=$4'+dirBase)
        .replace(/\\burl\\(\\s*(["']?)(?!https?:|data:|blob:|\\/\\/)/g,'url($1'+dirBase);
    }
    var inj='<base href="'+dirBase+'"><script>'+
      '(function(){function r(u){if(typeof u!="string"||!u)return u;'+
      'if(u.indexOf("blob:")===0||u.indexOf("data:")===0||u.indexOf("http://")===0||u.indexOf("https://")===0||u.indexOf("//")===0)return u;'+
      'var p=u;if(p[0]==="/"){p=p.slice(1);return"'+rootBase+'"+p}'+
      'return"'+dirBase+'"+u}'+
      'var ca=document.createElement.bind(document);document.createElement=function(t){var e=ca(t);var tn=t.toLowerCase();'+
      'if(tn==="script"||tn==="iframe"||tn==="frame"){var s="";Object.defineProperty(e,"src",{get:function(){return s},set:function(v){s=r(v)},configurable:true})}'+
      'return e};'+
      'var sa=Element.prototype.setAttribute;Element.prototype.setAttribute=function(n,v){'+
      'var tn=this.tagName.toLowerCase();var an=n.toLowerCase();'+
      'if((tn==="iframe"||tn==="frame"||tn==="script"||tn==="img")&&an==="src")v=r(v);'+
      'else if((tn==="link"||tn==="a")&&an==="href")v=r(v);'+
      'return sa.call(this,n,v)};'+
      'document.addEventListener("click",function(e){var a=e.target&&e.target.closest?e.target.closest("a[href]"):null;'+
      'if(!a)return;var h=a.getAttribute("href");if(!h||h[0]==="#"||/^javascript:/i.test(h))return;'+
      'if(h.indexOf("blob:")===0){e.preventDefault();try{parent.postMessage({__yukios:"navigate",url:h},"*")}catch{}}'+
      '},true);'+
      'document.addEventListener("submit",function(e){var f=e.target;if(!f||!f.getAttribute)return;'+
      'var a=f.getAttribute("action")||document.baseURI;var u=null;try{u=new URL(a,document.baseURI).href}catch(e){return}'+
      'if(u&&u.indexOf("blob:")===0){e.preventDefault();try{parent.postMessage({__yukios:"navigate",url:u},"*")}catch{}}'+
      '},true);'+
      '})()<\\/script>';
    if(ignore)return URL.createObjectURL(new Blob([html],{type:"text/html"}));
    var hasBase=/<base\\b/i.test(html);
    if(hasBase)html=html.replace(/<base\\b[^>]*>/i,function(m){return m+'\\n'+inj});
    else if(/<head\\b/i.test(html))html=html.replace(/<head\\b[^>]*>/i,function(m){return m+'\\n'+inj});
    else html=inj+'\\n'+html;
    return URL.createObjectURL(new Blob([html],{type:"text/html"}));
  });
}

function getFavorites() {
  try {
    return JSON.parse(localStorage.getItem('yukios_favorites') || '[]');
  } catch { return []; }
}

function saveFavorites(favs) {
  try {
    localStorage.setItem('yukios_favorites', JSON.stringify(favs));
  } catch {}
}

function toggleFavorite() {
  var favs = getFavorites();
  var idx = favs.findIndex(function(f) { return f.key === CURRENT_GAME_KEY; });
  var btn = document.getElementById('fav-btn');
  if (idx >= 0) {
    favs.splice(idx, 1);
    btn.classList.remove('active');
    btn.textContent = '☆';
  } else {
    favs.push({ key: CURRENT_GAME_KEY, title: CURRENT_GAME_KEY, icon: CURRENT_GAME_ICON, url: window.location.pathname });
    btn.classList.add('active');
    btn.textContent = '★';
  }
  saveFavorites(favs);
}

function updateFavoriteButton() {
  var favs = getFavorites();
  var isFav = favs.some(function(f) { return f.key === CURRENT_GAME_KEY; });
  var btn = document.getElementById('fav-btn');
  if (isFav) {
    btn.classList.add('active');
    btn.textContent = '★';
  }
}

function getRecentlyPlayed() {
  try {
    return JSON.parse(localStorage.getItem('yukios_recent') || '[]');
  } catch { return []; }
}

function saveRecentlyPlayed(recent) {
  try {
    localStorage.setItem('yukios_recent', JSON.stringify(recent));
  } catch {}
}

function addToRecentlyPlayed() {
  var recent = getRecentlyPlayed();
  var entry = { key: CURRENT_GAME_KEY, title: CURRENT_GAME_KEY, icon: CURRENT_GAME_ICON, url: window.location.pathname, time: Date.now() };
  recent = recent.filter(function(r) { return r.key !== CURRENT_GAME_KEY; });
  recent.unshift(entry);
  if (recent.length > 10) recent = recent.slice(0, 10);
  saveRecentlyPlayed(recent);
  renderRecentlyPlayed();
}

function renderRecentlyPlayed() {
  var recent = getRecentlyPlayed();
  var container = document.getElementById('recently-played-list');
  if (!container) return;
  if (recent.length === 0) {
    container.innerHTML = '<span style="color:#666;font-size:.85rem">No games played yet</span>';
    return;
  }
  container.innerHTML = recent.map(function(r) {
    var iconHtml = r.icon ? '<img class="recently-played-icon" src="' + r.icon + '" alt="" loading="lazy" />' : '<div class="recently-played-icon"></div>';
    return '<div class="recently-played-item">' + iconHtml + '<a href="' + r.url + '" class="recently-played-link">' + r.title + '</a></div>';
  }).join('');
}

updateFavoriteButton();
renderRecentlyPlayed();
loadGame();
function toggleFS(){if(!document.fullscreenElement){document.documentElement.requestFullscreen()}else{document.exitFullscreen()}}
</script>
${adSlotScript("sidebar-ad")}
</body>
</html>`;
}

function isFA(icon) {
  return /^fa[srlb]?\s/.test(icon) || icon.startsWith("fa-");
}

function makeCatalogPage(title, description, items, itemType, imageSize) {
  const esc = escHtml;
  const imgS = imageSize || 72;
  const link = (k) => `/${itemType === "game" ? "class" : itemType}/${k}.html`;
  const allGenres = itemType === "game" ? [...new Set(items.flatMap((i) => i.genre || []))].sort() : [];
  const cards = items
    .map((item) => {
      let iconHtml;
      if (isFA(item.icon)) {
        iconHtml = `<i class="${item.icon}" style="font-size:40px;color:#d97706"></i>`;
      } else if (item.icon) {
        iconHtml = `<img src="${item.icon}" alt="${esc(item.title)}" loading="lazy" style="width:${imgS}px;height:${imgS}px;object-fit:contain;border-radius:8px" />`;
      } else {
        iconHtml = `<i class="fas fa-star" style="font-size:40px;color:#d97706"></i>`;
      }
      const genreAttr = item.genre ? esc(item.genre.join(",")) : "";
      return `<a href="${link(item.key)}" class="cat-card" data-genre="${genreAttr}" data-title="${esc(item.title).toLowerCase()}">${iconHtml}<span class="cat-label">${esc(item.title)}</span></a>`;
    })
    .join("");

  let cardsWithAds = cards;
  if (itemType === "game") {
    const adSlot = `<div class="cat-ad">${adSlotHtml("catalog-ad")}</div>`;
    const cardArray = items.map((item) => {
      let iconHtml;
      if (isFA(item.icon)) {
        iconHtml = `<i class="${item.icon}" style="font-size:40px;color:#d97706"></i>`;
      } else if (item.icon) {
        iconHtml = `<img src="${item.icon}" alt="${esc(item.title)}" loading="lazy" style="width:${imgS}px;height:${imgS}px;object-fit:contain;border-radius:8px" />`;
      } else {
        iconHtml = `<i class="fas fa-star" style="font-size:40px;color:#d97706"></i>`;
      }
      const genreAttr = item.genre ? esc(item.genre.join(",")) : "";
      return `<a href="${link(item.key)}" class="cat-card" data-genre="${genreAttr}" data-title="${esc(item.title).toLowerCase()}">${iconHtml}<span class="cat-label">${esc(item.title)}</span></a>`;
    });

    const adPositions = [12, 50];
    for (const pos of adPositions) {
      if (pos < cardArray.length) {
        cardArray.splice(pos, 0, adSlot);
      }
    }
    cardsWithAds = cardArray.join("");
  }
  const total = items.length;
  const wideGrid = imgS >= 150;
  const gridMin = wideGrid ? 220 : 140;
  const hasFilters = allGenres.length > 0;
  const genreBtns = allGenres
    .map((g) => {
      const icon = GENRE_PAGE_CONFIG[g]?.icon || "fas fa-gamepad";
      return `<button class="flt-btn" data-genre="${esc(g)}" onclick="toggleGenre('${esc(g)}')"><i class="${icon}"></i><span>${esc(g)}</span></button>`;
    })
    .join("");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="website">
<meta property="og:image" content="https://cdn.jsdelivr.net/gh/Reeyuki/YukiOS@main/.github/mac.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="https://yukios.netlify.app/${itemType}s.html">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0a0a14;color:#ccc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;min-height:100vh}
.seo-header{display:flex;align-items:center;justify-content:space-between;padding:0 24px;height:56px;border-bottom:1px solid rgba(255,255,255,0.06);background:rgba(10,10,20,0.95);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);position:sticky;top:0;z-index:10}
.seo-brand{color:#fff;font-size:1.15rem;font-weight:700;letter-spacing:-.01em;text-decoration:none}
.seo-brand em{font-style:normal;color:#d97706}
.seo-hero{text-align:center;padding:48px 24px 16px;max-width:800px;margin:0 auto}
.seo-hero h1{color:#fff;font-size:clamp(1.5rem,4vw,2.5rem);font-weight:800;margin-bottom:8px}
.seo-hero p{color:#999;font-size:clamp(.95rem,2vw,1.1rem);line-height:1.6;margin-bottom:8px}
.seo-hero .count{color:#d97706;font-size:1rem;font-weight:600}
.cat-layout{display:flex;max-width:1400px;margin:0 auto;padding:0 24px 48px;gap:24px;position:relative}
.cat-sidebar{width:60px;flex-shrink:0;position:fixed;left:0;top:56px;height:calc(100vh - 56px);background:rgba(10,10,20,0.95);border-right:1px solid rgba(255,255,255,0.06);z-index:5;transition:width .3s ease;overflow:hidden}
.cat-sidebar.expanded{width:200px}
.cat-sidebar h3{color:#fff;font-size:.85rem;font-weight:600;margin-bottom:10px;text-transform:uppercase;letter-spacing:.05em;opacity:.7;padding:0 16px;white-space:nowrap}
.flt-btn{display:flex;align-items:center;gap:12px;width:100%;text-align:left;padding:12px 16px;margin-bottom:4px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:8px;color:#999;font-size:.85rem;cursor:pointer;transition:all .15s;font-family:inherit;white-space:nowrap}
.flt-btn:hover{background:rgba(217,119,6,0.1);border-color:rgba(217,119,6,0.3);color:#ccc}
.flt-btn.active{background:rgba(217,119,6,0.15);border-color:#d97706;color:#d97706;font-weight:600}
.flt-btn i{font-size:1.1rem;width:20px;text-align:center;flex-shrink:0}
.flt-btn span{opacity:1;transition:opacity .2s}
.cat-sidebar.collapsed .flt-btn span{opacity:0;width:0;overflow:hidden}
.cat-sidebar.collapsed .flt-btn{justify-content:center;padding:12px}
.cat-sidebar.collapsed h3{display:none}
.cat-main{flex:1;min-width:0;margin-left:60px;transition:margin-left .3s ease}
.cat-main.expanded{margin-left:200px}
.sidebar-toggle{position:fixed;left:60px;top:56px;width:32px;height:32px;background:rgba(217,119,6,0.8);border:1px solid rgba(255,255,255,0.2);border-radius:0 8px 8px 0;color:#fff;font-size:1rem;cursor:pointer;z-index:6;display:flex;align-items:center;justify-content:center;transition:left .3s ease}
.sidebar-toggle:hover{background:rgba(217,119,6,1)}
.sidebar-toggle.expanded{left:200px}
.search-bar{position:relative;margin-bottom:16px}
.search-bar input{width:100%;padding:10px 14px 10px 38px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:10px;color:#eee;font-size:.95rem;font-family:inherit;outline:none;transition:border-color .2s}
.search-bar input:focus{border-color:rgba(217,119,6,0.5)}
.search-bar input::placeholder{color:#666}
.search-bar i{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:#666;font-size:.9rem}
.cat-empty{display:none;text-align:center;padding:60px 20px;color:#666;font-size:1.05rem}
.cat-empty.show{display:block}
.cat-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(${gridMin}px,1fr));gap:12px}
.cat-card{display:flex;flex-direction:column;align-items:center;gap:${wideGrid ? 12 : 8}px;padding:${wideGrid ? 24 : 16}px ${wideGrid ? 16 : 8}px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;text-decoration:none;transition:background .2s,border-color .2s;opacity:1;transform:scale(1)}
.cat-card.hidden{display:none}
.cat-card:hover{background:rgba(217,119,6,0.1);border-color:rgba(217,119,6,0.3)}
.cat-label{color:#ccc;font-size:.95rem;text-align:center;line-height:1.3;font-weight:600}
.cat-ad{grid-column:1/-1;min-height:120px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.06);border-radius:12px;overflow:hidden;display:flex;align-items:center;justify-content:center}
.seo-footer{border-top:1px solid rgba(255,255,255,0.06);padding:24px;text-align:center;background:rgba(10,10,20,0.8);margin-top:24px}
.seo-footer p{color:#666;font-size:.9rem;margin-bottom:6px}
.seo-footer a{color:#888;font-size:.9rem;text-decoration:none}
.seo-footer a:hover{color:#d97706}
@media(max-width:900px){.cat-layout{flex-direction:column;padding:0 12px 32px;gap:12px}.cat-sidebar{width:100%;position:static;max-height:none;display:flex;flex-wrap:wrap;gap:6px;overflow-y:visible}.cat-sidebar h3{width:100%;margin-bottom:4px}.flt-btn{width:auto;padding:6px 12px;font-size:.8rem;margin-bottom:0}.cat-grid{grid-template-columns:repeat(${wideGrid ? 2 : 3},1fr);gap:8px}.cat-card{padding:${wideGrid ? 16 : 12}px 6px}.cat-label{font-size:.85rem}}
</style>
</head>
<body>
<header class="seo-header">
  <a href="/" class="seo-brand"><em>Y</em>ukiOS</a>
</header>
<main>
  <section class="seo-hero">
    <h1>${esc(title)}</h1>
    <p>${esc(description)}</p>
    <div class="count">${total} ${itemType}s</div>
  </section>
  <div class="cat-layout">
    <button class="sidebar-toggle" onclick="toggleSidebar()"><i class="fas fa-bars"></i></button>
    <aside class="cat-sidebar collapsed">
      <h3>Genres</h3>
      ${genreBtns}
    </aside>
    <div class="cat-main">
      <div class="search-bar">
        <i class="fas fa-search"></i>
        <input type="text" id="search-input" placeholder="Search ${itemType}s..." oninput="filterCards()" autocomplete="off">
      </div>
      <div class="cat-empty" id="cat-empty">No ${itemType}s found matching your filters.</div>
      <div class="cat-grid" id="cat-grid">${cardsWithAds}</div>
    </div>
  </div>
</main>
<footer class="seo-footer">
  <p>YukiOS - Free Browser-Based Desktop Environment</p>
  <div><a href="/features.html">Features</a> &middot; <a href="/">Home</a></div>
</footer>
${
  hasFilters
    ? `<script>
var activeGenre=null;
function toggleGenre(g){
  var btn=document.querySelector('.flt-btn[data-genre="'+g+'"]');
  if(activeGenre===g){
    activeGenre=null;
    btn.classList.remove('active')
  }else{
    if(activeGenre){
      var prevBtn=document.querySelector('.flt-btn[data-genre="'+activeGenre+'"]');
      if(prevBtn)prevBtn.classList.remove('active')
    }
    activeGenre=g;
    btn.classList.add('active')
  }
  filterCards()
}
function toggleSidebar(){
  var sidebar=document.querySelector('.cat-sidebar');
  var main=document.querySelector('.cat-main');
  var toggle=document.querySelector('.sidebar-toggle');
  sidebar.classList.toggle('collapsed');
  sidebar.classList.toggle('expanded');
  main.classList.toggle('expanded');
  toggle.classList.toggle('expanded');
}
function filterCards(){
  var q=document.getElementById('search-input').value.toLowerCase().trim();
  var cards=document.querySelectorAll('.cat-card');
  var empty=document.getElementById('cat-empty');
  var shown=0;
  cards.forEach(function(c){
    var title=c.getAttribute('data-title');
    var genres=c.getAttribute('data-genre');
    var match=true;
    if(q&&title.indexOf(q)===-1)match=false;
    if(match&&activeGenre){
      var cg=genres?genres.split(','):[];
      if(cg.indexOf(activeGenre)===-1)match=false;
    }
    if(match){c.classList.remove('hidden');shown++}
    else c.classList.add('hidden')
  });
  empty.classList.toggle('show',shown===0)
}
</script>`
    : ""
}
${adSlotScript("catalog-ad")}
</body>
</html>`;
}
function makeGenrePage(genre, genreGames, allGenreConfigs) {
  const config = GENRE_PAGE_CONFIG[genre];
  if (!config) return "";
  const esc = escHtml;
  const cards = genreGames
    .map((g) => {
      const iconHtml = g.icon
        ? `<img src="${esc(g.icon)}" alt="${esc(g.title)}" loading="lazy" class="gc-icon" />`
        : `<div class="gc-icon-placeholder"></div>`;
      return `<a href="/class/${g.key}.html" class="gc-card">
      ${iconHtml}
      <span class="gc-label">${esc(g.title)}</span>
      <span class="gc-genres">${g.genre.map((gg) => `<span class="gc-tag">${esc(gg)}</span>`).join("")}</span>
    </a>`;
    })
    .join("");
  const total = genreGames.length;
  const otherGenres = Object.values(allGenreConfigs).filter((c) => c.slug !== config.slug);
  const otherLinksHtml = otherGenres.length
    ? `<div class="gl-section"><h3>Browse More Game Genres</h3><div class="gl-links">${otherGenres.map((c) => `<a href="/games/${c.slug}.html">${esc(c.h1)}</a>`).join("\n      ")}</div></div>`
    : "";
  const jsonld = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: config.title,
    description: config.desc,
    numberOfItems: total,
    itemListElement: genreGames.map((g, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${BASE}/class/${g.key}.html`
    }))
  });
  const breadcrumb = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "YukiOS", item: BASE },
      { "@type": "ListItem", position: 2, name: "Games", item: `${BASE}/games.html` },
      { "@type": "ListItem", position: 3, name: config.h1, item: `${BASE}/games/${config.slug}.html` }
    ]
  });
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(config.title)}</title>
<meta name="description" content="${esc(config.desc)}">
<meta property="og:title" content="${esc(config.title)}">
<meta property="og:description" content="${esc(config.desc)}">
<meta property="og:type" content="website">
<meta property="og:image" content="${esc(GH)}/steam.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="${BASE}/games/${config.slug}.html">
<script type="application/ld+json">${jsonld}</script>
<script type="application/ld+json">${breadcrumb}</script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0a0a14;color:#ccc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;min-height:100vh;display:flex;flex-direction:column}
.gc-header{display:flex;align-items:center;justify-content:space-between;padding:0 24px;height:56px;border-bottom:1px solid rgba(255,255,255,0.06);background:rgba(10,10,20,0.95);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);position:sticky;top:0;z-index:10}
.gc-brand{color:#fff;font-size:1.15rem;font-weight:700;letter-spacing:-.01em;text-decoration:none}
.gc-brand em{font-style:normal;color:#d97706}
.gc-nav{display:flex;gap:16px}
.gc-nav a{color:#888;font-size:.9rem;text-decoration:none;transition:color .15s}
.gc-nav a:hover{color:#fff}
.gc-hero{text-align:center;padding:48px 24px 24px;max-width:800px;margin:0 auto}
.gc-hero h1{color:#fff;font-size:clamp(1.5rem,4vw,2.5rem);font-weight:800;margin-bottom:12px;line-height:1.15}
.gc-hero p{color:#999;font-size:clamp(1rem,2vw,1.1rem);line-height:1.7;margin-bottom:8px}
.gc-count{color:#666;font-size:.9rem;margin-top:8px}
.gc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px;max-width:1100px;margin:32px auto;padding:0 24px;width:100%;flex:1}
.gc-card{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:16px;text-decoration:none;display:flex;flex-direction:column;align-items:center;gap:8px;transition:background .15s,border-color .15s,transform .15s}
.gc-card:hover{background:rgba(255,255,255,0.06);border-color:rgba(217,119,6,0.3);transform:translateY(-2px)}
.gc-icon{width:80px;height:80px;object-fit:contain;border-radius:8px}
.gc-icon-placeholder{width:80px;height:80px;border-radius:8px;background:rgba(255,255,255,0.05)}
.gc-label{color:#ddd;font-size:.95rem;font-weight:600;text-align:center;line-height:1.3}
.gc-genres{display:flex;flex-wrap:wrap;gap:4px;justify-content:center}
.gc-tag{background:rgba(217,119,6,0.15);color:#d97706;font-size:.75rem;padding:2px 8px;border-radius:4px}
.gl-section{border-top:1px solid rgba(255,255,255,0.06);padding:32px 24px;text-align:center;max-width:800px;margin:0 auto;width:100%}
.gl-section h3{color:#ddd;font-size:1.1rem;margin-bottom:16px;font-weight:600}
.gl-links{display:flex;flex-wrap:wrap;gap:12px;justify-content:center}
.gl-links a{color:#d97706;text-decoration:none;font-size:.9rem;padding:6px 14px;border:1px solid rgba(217,119,6,0.2);border-radius:6px;transition:background .15s}
.gl-links a:hover{background:rgba(217,119,6,0.1)}
.gc-footer{border-top:1px solid rgba(255,255,255,0.06);padding:24px;text-align:center;background:rgba(10,10,20,0.8);margin-top:auto}
.gc-footer p{color:#666;font-size:.9rem;margin-bottom:6px}
.gc-footer a{color:#888;font-size:.9rem;text-decoration:none;transition:color .15s}
.gc-footer a:hover{color:#d97706}
</style>
</head>
<body>
<header class="gc-header">
  <a href="/" class="gc-brand"><em>Y</em>ukiOS</a>
  <div class="gc-nav">
    <a href="/features.html">Features</a>
    <a href="/games.html">All Games</a>
    <a href="https://github.com/Reeyuki/YukiOS">GitHub</a>
  </div>
</header>
<main>
  <section class="gc-hero">
    <h1>${esc(config.h1)}</h1>
    <p>${esc(config.desc)}</p>
    <p class="gc-count">${total} free games. No downloads, no sign-ups, play instantly in your browser.</p>
  </section>
  <style>${AD_SLOT_STYLE}</style>
  ${adSlotHtml("genre-ad")}
  <div class="gc-grid">${cards}</div>
  ${otherLinksHtml}
</main>
<footer class="gc-footer">
  <p>YukiOS - Free Browser-Based Desktop Environment</p>
  <div><a href="/features.html">Features</a> &middot; <a href="/games.html">All Games</a> &middot; <a href="https://github.com/Reeyuki/YukiOS">GitHub</a></div>
</footer>
${adSlotScript("genre-ad")}
</body>
</html>`;
}

function buildPages(apps, games, gameDescs, featurePages, indexHtml) {
  const outDir = resolve(ROOT, "dist");

  const appDir = resolve(outDir, "app");
  mkdirSync(appDir, { recursive: true });
  for (const a of apps) {
    const desc = a.description || `${a.title} - a built-in YukiOS app.`;
    const url = `${BASE}/app/${a.key}.html`;
    const jsonld = JSON.stringify([
      {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: `${a.title} - YukiOS`,
        url,
        description: desc,
        operatingSystem: "Web Browser",
        applicationCategory: "WebApplication",
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" }
      },
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "YukiOS", item: BASE },
          { "@type": "ListItem", position: 2, name: "Apps", item: `${BASE}/features.html` },
          { "@type": "ListItem", position: 3, name: a.title, item: url }
        ]
      }
    ]);
    const pts = generateBullets(a.description || "");
    const bullets = pts.length ? `<h2>Features</h2><ul>${pts.map((s) => `<li>${s}.</li>`).join("")}</ul>` : "";
    const appIdx = apps.indexOf(a);
    const nearby = [];
    for (let i = Math.max(0, appIdx - 2); i <= Math.min(apps.length - 1, appIdx + 2); i++) {
      if (i !== appIdx) nearby.push(apps[i]);
    }
    const relatedApps = nearby.length
      ? `<p class="seo-more">More YukiOS apps: ${nearby
          .slice(0, 4)
          .map((n) => `<a href="/app/${n.key}.html">${n.title}</a>`)
          .join(", ")}</p>`
      : "";
    const extra = `${bullets}<p class="seo-cta">${a.title} is part of YukiOS - a free browser-based desktop environment with 80+ apps, 2900 games, and no downloads or sign-ups required. Launch it directly from the Start Menu or bookmark this page for quick access.</p>${relatedApps}`;
    const html = makeStandalonePage(a.title, desc, jsonld, url, `${GH}/mac.png`, extra, `/?app=${a.key}`);
    writeFileSync(resolve(appDir, `${a.key}.html`), html, "utf-8");
  }

  const classDir = resolve(outDir, "class");
  mkdirSync(classDir, { recursive: true });
  for (const g of games) {
    const desc = gameDescs[g.key]
      ? `Play ${g.title} in your browser on YukiOS - ${gameDescs[g.key]}`
      : `Play ${g.title} in your browser on YukiOS`;
    const genre = (g.genre && g.genre[0]) || "Casual";
    const titleTmpl = TITLE_TEMPLATES[genre] || TITLE_TEMPLATES.Casual;
    const h1Tmpl = H1_TEMPLATES[genre] || H1_TEMPLATES.Casual;
    const seoTitle = titleTmpl.replace(/\$\{title\}/g, g.title);
    const h1 = h1Tmpl.replace(/\$\{title\}/g, g.title);
    const seoDesc = desc + (DESC_SUFFIXES[genre] || "");
    const url = `${BASE}/class/${g.key}.html`;
    const jsonld = JSON.stringify([
      {
        "@context": "https://schema.org",
        "@type": "VideoGame",
        name: seoTitle,
        url,
        description: seoDesc,
        operatingSystem: "Web Browser",
        applicationCategory: "Game",
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" }
      },
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "YukiOS", item: BASE },
          { "@type": "ListItem", position: 2, name: "Games", item: `${BASE}/games.html` },
          { "@type": "ListItem", position: 3, name: g.title, item: url }
        ]
      }
    ]);
    const raw = gameDescs[g.key] || `Play ${g.title} online for free in your browser.`;
    const pts = generateBullets(raw);
    const bullets = pts.length ? `<h2>Game Features</h2><ul>${pts.map((s) => `<li>${s}.</li>`).join("")}</ul>` : "";

    function calculateSimilarity(game1, game2) {
      let score = 0;
      const genre1 = game1.genre || [];
      const genre2 = game2.genre || [];
      const matchingGenres = genre1.filter((g) => genre2.includes(g)).length;
      score += matchingGenres * 10;

      const name1 = game1.title.toLowerCase();
      const name2 = game2.title.toLowerCase();
      const words1 = name1.split(/\s+/);
      const words2 = name2.split(/\s+/);
      const matchingWords = words1.filter((w) => w.length > 2 && words2.includes(w)).length;
      score += matchingWords * 3;

      const commonChars = name1.split("").filter((c) => name2.includes(c)).length;
      const maxLen = Math.max(name1.length, name2.length);
      score += (commonChars / maxLen) * 2;

      return score;
    }

    const scored = games
      .filter((other) => other.key !== g.key)
      .map((other) => ({
        game: other,
        score: calculateSimilarity(g, other)
      }))
      .sort((a, b) => b.score - a.score);

    const relatedGames = scored.length
      ? `
<div class="you-may-like">
  <h2>You May Also Like</h2>
  <div class="you-may-like-grid">
    ${scored
      .slice(0, 6)
      .map(
        (s) => `
      <a href="/class/${s.game.key}.html" class="you-may-like-card">
        ${s.game.icon ? `<img class="you-may-like-icon" src="${escHtml(s.game.icon)}" alt="${escHtml(s.game.title)} icon" loading="lazy" />` : `<div class="you-may-like-icon"></div>`}
        <div class="you-may-like-title">${escHtml(s.game.title)}</div>
        <div class="you-may-like-genre">${(s.game.genre && s.game.genre[0]) || "Casual"}</div>
      </a>
    `
      )
      .join("")}
  </div>
</div>`
      : "";
    const seoPara = SEO_PARAGRAPHS[genre] || SEO_PARAGRAPHS.Casual;
    const howToPlay = `<h2>How to Play</h2><ul><li>Press the Play button above to start playing ${g.title} instantly in full screen.</li><li>Use keyboard (WASD or arrow keys) and mouse for most games.</li><li>Your progress and high scores are saved automatically between sessions.</li></ul>`;
    const platformFeatures = `<h2>Platform Features</h2><ul><li>Zero downloads or installations needed.</li><li>Works on Chromebooks, tablets, and mobile devices.</li><li>Fast loading times with optimized delivery.</li><li>Open source project. View and contribute on GitHub.</li><li>Fullscreen mode for immersive gameplay.</li><li>Mobile friendly with touch controls.</li><li>Works behind school and corporate network filters.</li><li>Regularly updated game library.</li></ul>`;
    const extra = `<p class="seo-cta">Play ${g.title} online for free in your browser on YukiOS. No downloads, no sign-ups, no installation required.</p>${bullets}<h2>About This Game</h2><p>${seoPara}</p>${howToPlay}${platformFeatures}${relatedGames}`;
    const gameUrl = resolveGameUrl(g.url, g.type);
    const html = makeMinimalGamePage(
      g.title,
      desc,
      jsonld,
      url,
      gameUrl,
      extra,
      `${GH}/steam.png`,
      g.icon,
      seoTitle,
      seoDesc,
      g.type
    );
    writeFileSync(resolve(classDir, `${g.key}.html`), html, "utf-8");
  }

  const genreDir = resolve(outDir, "games");
  mkdirSync(genreDir, { recursive: true });
  const genreMap = {};
  for (const g of games) {
    for (const gn of g.genre) {
      if (!genreMap[gn]) genreMap[gn] = [];
      genreMap[gn].push(g);
    }
  }
  let genreCount = 0;
  for (const [genre, genreGames] of Object.entries(genreMap)) {
    if (!GENRE_PAGE_CONFIG[genre]) continue;
    const html = makeGenrePage(genre, genreGames, GENRE_PAGE_CONFIG);
    if (html) {
      const slug = GENRE_PAGE_CONFIG[genre].slug;
      writeFileSync(resolve(genreDir, `${slug}.html`), html, "utf-8");
      genreCount++;
    }
  }

  const featureDir = resolve(outDir, "feature");
  mkdirSync(featureDir, { recursive: true });
  for (const f of featurePages) {
    const filePath = f.rootFile ? f.rootFile : `feature/${f.key}.html`;
    const url = `${BASE}/${filePath}`;
    const pts = f.description
      .split(/\.\s+/)
      .filter((s) => s.trim().length > 10)
      .map((s) => s.replace(/\.+$/, "").trim());
    const bullets = pts.length
      ? `<h2>About This Feature</h2><ul>${pts.map((s) => `<li>${s}.</li>`).join("")}</ul>`
      : "";
    const related = featurePages.filter((p) => p.key !== "index" && p.key !== f.key).slice(0, 4);
    const relatedLinks = related.length
      ? `<p class="seo-more">Explore more: ${related.map((r) => `<a href="/feature/${r.key}.html">${r.title}</a>`).join(", ")}</p>`
      : "";
    const ogImage = (galleryImages.find((i) => i.featureKey === f.key) || {}).src || `${GH}/mac.png`;
    let extra;
    if (f.rootFile) {
      const featureTitleMap = Object.fromEntries(
        featurePages.filter((p) => p.key !== "index").map((p) => [p.key, p.title])
      );
      const cards = galleryImages
        .map((img) => {
          const title = featureTitleMap[img.featureKey];
          return `<a href="/feature/${img.featureKey}.html" class="feature-card"><img src="${img.src}" alt="${title}" loading="lazy"/><span class="feature-card-label">${title || img.featureKey}</span></a>`;
        })
        .join("");
      extra = `
<div class="seo-stats">
  <div class="seo-stat"><span class="seo-stat-num">80+</span><span class="seo-stat-label">Built-in Apps</span></div>
  <div class="seo-stat"><span class="seo-stat-num">3,700+</span><span class="seo-stat-label">Free Games</span></div>
  <div class="seo-stat"><span class="seo-stat-num">40+</span><span class="seo-stat-label">Themes</span></div>
  <div class="seo-stat"><span class="seo-stat-num">4</span><span class="seo-stat-label">Desktop Modes</span></div>
  <div class="seo-stat"><span class="seo-stat-num">6</span><span class="seo-stat-label">Emulators</span></div>
</div>
<div class="seo-features">
  <div class="seo-feature-category">
    <h2 class="seo-category-title"><i class="fas fa-desktop"></i> Desktop & Window Management</h2>
    <div class="seo-feature-grid">
      <div class="seo-feature">
        <div class="seo-feature-icon"><i class="fas fa-desktop"></i></div>
        <div class="seo-feature-body">
          <h3>Full Desktop Experience</h3>
          <p>Complete desktop environment with draggable resizable windows, window snapping, multiple workspaces, taskbar with live previews, system tray, and start menu.</p>
        </div>
      </div>
      <div class="seo-feature">
        <div class="seo-feature-icon"><i class="fab fa-apple"></i></div>
        <div class="seo-feature-body">
          <h3>Mac Desktop Mode</h3>
          <p>macOS-style desktop with top menu bar, animated fisheye dock, Control Center tray, Launchpad app grid, and traffic light window buttons.</p>
        </div>
      </div>
      <div class="seo-feature">
        <div class="seo-feature-icon"><i class="fas fa-border-all"></i></div>
        <div class="seo-feature-body">
          <h3>Tiling Window Manager</h3>
          <p>Hyprland-inspired BSP tiling with keyboard-driven layout management. 9 independent workspaces, live config editing, gap control, and floating window support.</p>
        </div>
      </div>
      <div class="seo-feature">
        <div class="seo-feature-icon"><i class="fas fa-cube"></i></div>
        <div class="seo-feature-body">
          <h3>3D Room Mode</h3>
          <p>Interactive first-person 3D room built with Three.js. Browse holographic app launcher, arrange furniture, grab physics-based game cases, and launch games directly from the room.</p>
        </div>
      </div>
    </div>
  </div>
  <div class="seo-feature-category">
    <h2 class="seo-category-title"><i class="fas fa-code"></i> Productivity & Development</h2>
    <div class="seo-feature-grid">
      <div class="seo-feature">
        <div class="seo-feature-icon"><i class="fas fa-terminal"></i></div>
        <div class="seo-feature-body">
          <h3>Browser Terminal</h3>
          <p>Unix-like shell with Python REPL, Node.js REPL, and complete Git integration. Multiple tabs, pipeline support, reverse search, and WASM terminal apps.</p>
        </div>
      </div>
      <div class="seo-feature">
        <div class="seo-feature-icon"><i class="fas fa-folder-open"></i></div>
        <div class="seo-feature-body">
          <h3>Persistent File System</h3>
          <p>IndexedDB-based file manager with drag-and-drop uploads, ZIP and 7z extraction, file previews for images video PDF code and markdown. Mount external folders and set wallpapers.</p>
        </div>
      </div>
      <div class="seo-feature">
        <div class="seo-feature-icon"><i class="fas fa-th-large"></i></div>
        <div class="seo-feature-body">
          <h3>80+ Built-in Applications</h3>
          <p>Terminal with Python REPL via Pyodide, Node.js REPL via WebContainers, and full Git integration. Code editor with Monaco/VS Code, media player, web browser with Tor, office viewer, weather, and system settings.</p>
        </div>
      </div>
      <div class="seo-feature">
        <div class="seo-feature-icon"><i class="fas fa-search"></i></div>
        <div class="seo-feature-body">
          <h3>Command Palette</h3>
          <p>Press Ctrl+K or F1 to search apps, files, and system commands. Quick actions for wallpaper, themes, DND, workspace switching, and more. Built-in calculator and unit converter.</p>
        </div>
      </div>
    </div>
  </div>
  <div class="seo-feature-category">
    <h2 class="seo-category-title"><i class="fas fa-gamepad"></i> Gaming & Emulation</h2>
    <div class="seo-feature-grid">
      <div class="seo-feature">
        <div class="seo-feature-icon"><i class="fas fa-gamepad"></i></div>
        <div class="seo-feature-body">
          <h3>3,700+ Free Games</h3>
          <p>Play thousands of browser games from every genre. Includes retro emulators for DOS via JsDos, Flash via Ruffle, x86 via Virtual86, and 3DS via Azahar. Steam-like launcher with overlay, achievements, and playtime tracking.</p>
        </div>
      </div>
    </div>
  </div>
  <div class="seo-feature-category">
    <h2 class="seo-category-title"><i class="fas fa-sliders-h"></i> System & Customization</h2>
    <div class="seo-feature-grid">
      <div class="seo-feature">
        <div class="seo-feature-icon"><i class="fas fa-sliders-h"></i></div>
        <div class="seo-feature-body">
          <h3>Audio Mixer & System Sounds</h3>
          <p>Per-app volume control with live waveform visualizer, master volume and mute toggle, system sounds for common actions, and tray icon with scroll-to-adjust.</p>
        </div>
      </div>
      <div class="seo-feature">
        <div class="seo-feature-icon"><i class="fas fa-users"></i></div>
        <div class="seo-feature-body">
          <h3>User Accounts & Multi-Profile</h3>
          <p>Create multiple user profiles with custom nicknames, avatars, and desktop configurations. Lock screen with idle timeout, session switching, and per-profile wallpaper and theme persistence.</p>
        </div>
      </div>
      <div class="seo-feature">
        <div class="seo-feature-icon"><i class="fas fa-palette"></i></div>
        <div class="seo-feature-body">
          <h3>Theme System</h3>
          <p>40+ theme presets with custom theme support, light and dark modes, and transparency toggle. 400+ animated wallpapers with customizable Vanta.js support in wallpaper engine.</p>
        </div>
      </div>
    </div>
  </div>
</div>
<div class="seo-cta-row">
  <a href="/apps.html" class="seo-cta-card">
    <span class="cta-count">80+</span>
    <h3>Browse Apps</h3>
    <p>Explore the full catalog of built-in applications</p>
  </a>
  <a href="/games.html" class="seo-cta-card">
    <span class="cta-count">3,700+</span>
    <h3>Browse Games</h3>
    <p>Discover free games across every genre</p>
  </a>
  <a href="/feature/tiling.html" class="seo-cta-card">
    <h3>Desktop Modes</h3>
    <p>Mac, Windows, Tiling, or Minimal , switch anytime</p>
  </a>
</div>
<div class="seo-gallery">${cards}</div>
<p style="color:#aaa;font-size:.85rem;text-align:center;margin-top:48px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">YukiOS is free, open-source, and runs entirely in your browser with no downloads, sign-ups, or installation required.</p>`;
    } else {
      extra = `${bullets}<p class="seo-cta">${f.title} is part of YukiOS - a free browser-based desktop environment that runs entirely in your browser with no downloads or sign-ups needed.</p>${relatedLinks}`;
    }
    let jsonld;
    const breadcrumbBase = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "YukiOS", item: BASE },
        { "@type": "ListItem", position: 2, name: "Features", item: `${BASE}/features.html` }
      ]
    };
    if (f.rootFile) {
      const items = featurePages
        .filter((p) => p.key !== "index")
        .map((p, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: p.title,
          url: `${BASE}/${p.rootFile ? p.rootFile : "feature/" + p.key + ".html"}`
        }));
      jsonld = JSON.stringify([
        {
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: `${f.title} - YukiOS`,
          url,
          description: f.description,
          about: { "@type": "SoftwareApplication", name: "YukiOS" }
        },
        { "@type": "ItemList", name: "YukiOS Features", numberOfItems: items.length, itemListElement: items },
        breadcrumbBase
      ]);
    } else {
      const breadcrumb = {
        ...breadcrumbBase,
        itemListElement: [
          ...breadcrumbBase.itemListElement,
          { "@type": "ListItem", position: 3, name: f.title, item: url }
        ]
      };
      jsonld = JSON.stringify([
        {
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: `${f.title} - YukiOS`,
          url,
          description: f.description,
          about: { "@type": "SoftwareApplication", name: "YukiOS" }
        },
        breadcrumb
      ]);
    }
    const FEATURE_APP_MAP = {
      terminal: "terminalApp",
      games: "steamApp",
      "3d-room": "room3dApp"
    };
    const featureAppId = FEATURE_APP_MAP[f.key];
    const launchUrl = featureAppId ? `/?app=${featureAppId}` : "/";
    const html = makeStandalonePage(f.title, f.description, jsonld, url, ogImage, extra, launchUrl);
    writeFileSync(resolve(f.rootFile ? outDir : featureDir, f.rootFile || `${f.key}.html`), html, "utf-8");
  }

  const notFoundHtml = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Page Not Found - YukiOS</title>
<meta name="robots" content="noindex">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0f0f1a;color:#ccc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:2rem}
h1{color:#fff;font-size:clamp(2.5rem,6vw,5rem);margin:0 0 .5rem}
p{max-width:500px;line-height:1.7;font-size:1.1rem;margin-bottom:2rem}
a{color:#d97706;text-decoration:none;font-size:1.1rem;font-weight:600;padding:12px 32px;border:2px solid #d97706;border-radius:10px;transition:background .2s}
a:hover{background:#d97706;color:#fff}
small{color:#666;margin-top:2rem;font-size:.85rem}
</style>
</head>
<body>
<h1>404</h1>
<p>The page you're looking for doesn't exist on YukiOS.</p>
<a href="/">Go to YukiOS Home</a>
<small>You will be redirected automatically in a few seconds.</small>
<script>setTimeout(function(){window.location.href="/"},5000)</script>
</body>
</html>`;
  writeFileSync(resolve(outDir, "404.html"), notFoundHtml, "utf-8");

  return { appCount: apps.length, gameCount: games.length, genreCount, featureCount: featurePages.length };
}

const apps = extractApps();
const gameDescs = extractGameDescriptions();
const games = extractGames(gameDescs);

console.log(
  `[generatePages] ${apps.length} apps, ${games.length} games, ${Object.keys(gameDescs).length} game descriptions, ${featurePages.length} feature pages`
);

async function main() {
  const archiveGames = await fetchArchiveGames();
  console.log(`[generatePages] Fetched ${archiveGames.length} archive games`);
  const allGames = [...games, ...archiveGames];

  const indexHtml = resolve(ROOT, "dist/index.html");
  try {
    const html = readFileSync(indexHtml, "utf-8");
    const { appCount, gameCount, genreCount, featureCount } = buildPages(apps, allGames, gameDescs, featurePages, html);
    console.log(
      `[generatePages] ${appCount} app pages, ${gameCount} game pages, ${genreCount} genre pages, ${featureCount} feature pages, 404 page written`
    );
    const outDir = resolve(ROOT, "dist");
    writeFileSync(resolve(outDir, "sitemap.xml"), buildSitemap(apps, allGames, gameDescs, featurePages), "utf-8");
    console.log("[generatePages] sitemap.xml written");
    writeFileSync(
      resolve(outDir, "apps.html"),
      makeCatalogPage(
        "All YukiOS Apps - Browser Desktop Applications",
        `Browse ${apps.length} built-in apps in the YukiOS browser desktop environment. From terminal and calculator to office and development tools, all free and no downloads needed.`,
        apps,
        "app"
      ),
      "utf-8"
    );
    writeFileSync(
      resolve(outDir, "games.html"),
      makeCatalogPage(
        "All YukiOS Games - Play Free Online Browser Games",
        `Browse ${allGames.length} free online games in the YukiOS browser desktop environment. Play instantly with no downloads or sign-ups.`,
        allGames,
        "game",
        200
      ),
      "utf-8"
    );
    console.log(`[generatePages] apps.html and games.html catalog pages written`);
  } catch {
    console.log("[generatePages] dist/index.html not found - skipping page generation");
  }
}

main();

export { apps, games, gameDescs, featurePages, buildPages, makeLanding };
