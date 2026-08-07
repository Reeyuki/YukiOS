export const ACH_XP = 50;
export const PLAY_XP_PER_HOUR = 12;
export const XP_PER_LEVEL = 100;

const GAME_MILESTONES = [
  { threshold: 1, icon: "fa-gamepad", label: "First Steps", desc: "Play your first game." },
  { threshold: 5, icon: "fa-dice", label: "Game Enthusiast", desc: "Play 5 different games." },
  { threshold: 10, icon: "fa-layer-group", label: "Game Collector", desc: "Play 10 different games." },
  { threshold: 20, icon: "fa-rocket", label: "Dedicated Player", desc: "Play 20 different games." },
  { threshold: 40, icon: "fa-crown", label: "Veteran Gamer", desc: "Play 40 different games." }
];

const PLAY_MILESTONES = [
  { threshold: 1, icon: "fa-clock", label: "First Hour", desc: "Reach 1 hour of total playtime." },
  { threshold: 10, icon: "fa-hourglass-half", label: "Marathoner", desc: "Reach 10 hours of total playtime." },
  { threshold: 25, icon: "fa-meteor", label: "Time Well Spent", desc: "Reach 25 hours of total playtime." },
  { threshold: 50, icon: "fa-bolt", label: "Iron Will", desc: "Reach 50 hours of total playtime." },
  { threshold: 100, icon: "fa-star", label: "Century Mark", desc: "Reach 100 hours of total playtime." }
];

function pushBadge(list, badge, current) {
  const entry = { ...badge, earned: current >= badge.threshold };
  list.push(entry);
}

export function computeUserLevel(user) {
  const achievements = (user.achievements || []).length;
  const totalMinutes = Number(user.totalMinutes) || 0;
  const hours = Math.floor(totalMinutes / 60);
  const xp = achievements * ACH_XP + hours * PLAY_XP_PER_HOUR;
  return {
    level: Math.max(1, Math.floor(xp / XP_PER_LEVEL) + 1),
    xp,
    achievements,
    gamesPlayed: (user.playtime || []).length,
    hours
  };
}

export function buildBadgeList(user, catalog) {
  const gamesPlayed = (user.playtime || []).length;
  const hours = Math.floor((Number(user.totalMinutes) || 0) / 60);
  const earned = [];
  const upcoming = [];
  GAME_MILESTONES.forEach((m) => pushBadge(gamesPlayed >= m.threshold ? earned : upcoming, m, gamesPlayed));
  PLAY_MILESTONES.forEach((m) => pushBadge(hours >= m.threshold ? earned : upcoming, m, hours));
  const byId = new Map((catalog || []).map((item) => [item.id, item]));
  for (const ach of user.achievements || []) {
    const item = byId.get(ach.id) || {};
    earned.push({
      key: `ach-${ach.id}`,
      icon: item.icon || "fa-trophy",
      label: item.title || "Achievement",
      desc: item.desc || "Unlocked achievement.",
      kind: "achievement",
      earned: true
    });
  }
  return { earned, upcoming, count: earned.length, total: earned.length + upcoming.length };
}
