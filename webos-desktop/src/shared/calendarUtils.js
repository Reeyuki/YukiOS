import { os, StorageKeys } from "../framework.js";

export function getDateKey(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseDateKey(key) {
  const parts = key.split("-").map(Number);
  return { year: parts[0], month: parts[1] - 1, day: parts[2] };
}

export function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

export function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

export function generateEventId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export const EVENT_COLORS = ["#7c5cfc", "#f59e0b", "#ef4444", "#22c55e", "#3b82f6", "#ec4899", "#14b8a6", "#f97316"];

export function loadEvents() {
  const saved = os.storage.get(StorageKeys.calendarAppEvents);
  if (Array.isArray(saved)) return saved;
  const old = os.storage.get(StorageKeys.calendarEvents);
  if (old && typeof old === "object" && !Array.isArray(old)) {
    const migrated = [];
    for (const [dateKey, text] of Object.entries(old)) {
      if (typeof text === "string" && text.trim()) {
        migrated.push({
          id: generateEventId(),
          title: text,
          date: dateKey,
          time: "",
          color: EVENT_COLORS[0],
          recurring: "",
          reminder: 0,
          notes: ""
        });
      }
    }
    if (migrated.length > 0) {
      os.storage.set(StorageKeys.calendarAppEvents, migrated);
    }
    os.storage.remove(StorageKeys.calendarEvents);
    return migrated;
  }
  return [];
}

export function saveEvents(events) {
  os.storage.set(StorageKeys.calendarAppEvents, events);
}

export function getEventsForDate(events, dateKey) {
  const results = [];
  for (const ev of events) {
    if (ev.date === dateKey) {
      results.push(ev);
    } else if (ev.recurring) {
      const evDate = parseDateKey(ev.date);
      const target = parseDateKey(dateKey);
      const evDt = new Date(evDate.year, evDate.month, evDate.day);
      const tDt = new Date(target.year, target.month, target.day);
      if (tDt < evDt) continue;
      if (ev.recurring === "daily") {
        results.push(ev);
      } else if (ev.recurring === "weekly") {
        if (evDt.getDay() === tDt.getDay()) results.push(ev);
      } else if (ev.recurring === "monthly") {
        if (evDate.day === target.day) results.push(ev);
      } else if (ev.recurring === "yearly") {
        if (evDate.month === target.month && evDate.day === target.day) results.push(ev);
      }
    }
  }
  return results.sort((a, b) => (a.time || "00:00").localeCompare(b.time || "00:00"));
}
