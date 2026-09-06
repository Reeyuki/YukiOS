let parsedBlacklist = null;
let lastBlacklistRaw = null;
let cachedKey = null;
let cachedKeySecret = null;

const Caches = {
  sessions: { data: null, time: 0, promise: null },
  games: { data: null, time: 0, promise: null },
  topTime: { data: null, time: 0, promise: null },
  stats: {},
  peak: {},
  insights: {},
  live: { data: null, time: 0, promise: null },
  appList: { data: null, time: 0, promise: null },
  themes: {},
  adminThemes: {},
  social: {}
};

const CACHE_TTL = 5 * 60 * 1000;

let themesInitPromise = null;
let themeRateStore = new Map();
let socialInitPromise = null;

async function withCache(cacheObj, key, fetcher, ttl = CACHE_TTL) {
  const now = Date.now();
  let entry = key ? cacheObj[key] : cacheObj;
  if (!entry) {
    entry = { data: null, time: 0, promise: null };
    if (key) cacheObj[key] = entry;
  }

  if (entry.data && now - entry.time < ttl) {
    return entry.data;
  }

  if (!entry.promise) {
    entry.promise = fetcher()
      .then((data) => {
        entry.data = data;
        entry.time = Date.now();
        entry.promise = null;
        return data;
      })
      .catch((err) => {
        entry.promise = null;
        throw err;
      });
  }
  return entry.promise;
}

function invalidateThemeListCache() {
  Object.keys(Caches.themes).forEach((key) => {
    if (key.startsWith("list|")) delete Caches.themes[key];
  });
}

function ipBlocked(env, ip) {
  const raw = env.BLACKLIST_IPS || "";
  if (lastBlacklistRaw !== raw) {
    parsedBlacklist = raw
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    lastBlacklistRaw = raw;
  }
  for (const rule of parsedBlacklist) {
    if (rule === ip) return true;
    if (rule.includes("*")) {
      const prefix = rule.split("*")[0];
      if (ip.startsWith(prefix)) return true;
    }
  }
  return false;
}

async function deriveDailyId(env, ip) {
  const secret = env.FINGERPRINT_SECRET;
  if (!secret) return "no-secret-configured";

  if (!cachedKey || cachedKeySecret !== secret) {
    cachedKey = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    cachedKeySecret = secret;
  }

  const date = new Date().toISOString().slice(0, 10);
  const message = `${date}:${ip}`;
  const signature = await crypto.subtle.sign("HMAC", cachedKey, new TextEncoder().encode(message));
  const hex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hex.slice(0, 32);
}

async function sendReportEmbed(env, embed) {
  const webhook = env.DISCORD_REPORT_WEBHOOK_URL || env.DISCORD_WEBHOOK_URL;
  if (!webhook) return;
  await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ embeds: [embed] })
  });
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: corsHeaders() });
}

function normalizeApp(name) {
  if (!name) return "unknown";
  return name.toLowerCase().trim();
}

function isUrlPrefixed(value) {
  if (typeof value !== "string") return false;
  const v = value.trim().toLowerCase();
  return v.startsWith("http") || v.startsWith("://");
}

function escapeHtml(str) {
  if (typeof str !== "string") return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isAppAllowed(app, appList) {
  const normalized = normalizeApp(app);
  if (!appList || !appList.length) return /^[a-z0-9_.-]{1,64}$/.test(normalized);
  return appList.includes(normalized);
}

async function fetchAppList(env) {
  const url = env.APP_LIST_URL || "https://yukios.netlify.app/app-list.json";
  return withCache(
    Caches.appList,
    null,
    async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        try {
          const res = await fetch(url, { signal: controller.signal });
          if (!res.ok) return null;
          const data = await res.json();
          return Array.isArray(data) ? data : null;
        } finally {
          clearTimeout(timeoutId);
        }
      } catch {
        return null;
      }
    },
    10 * 60 * 1000
  );
}

function isTrustedIconUrl(url) {
  if (typeof url !== "string") return false;
  return (
    url.startsWith("https://cdn.jsdelivr.net/gh/Reeyuki/") ||
    url.startsWith("https://yukios.netlify.app/") ||
    url.startsWith("/")
  );
}

function checkAuth(env, req) {
  const authSecret = env.KV_AUTH_SECRET;
  const authHeader = req.headers.get("Authorization");
  return authHeader === `Bearer ${authSecret}`;
}

async function fetchStatsData(env, range) {
  let days = 30;
  if (range === "7d") days = 7;
  if (range === "90d") days = 90;
  if (range === "1y") days = 365;

  const daily = await env.DB.prepare(
    `SELECT
       date(timestamp)          AS day,
       COUNT(*)                 AS requests,
       COUNT(DISTINCT daily_id) AS unique_players
     FROM analytics
     WHERE timestamp >= datetime('now', '-' || ? || ' days')
     GROUP BY day
     ORDER BY day DESC`
  )
    .bind(days)
    .all();

  const topGames = await env.DB.prepare(
    `SELECT
       date(timestamp)                                          AS day,
       lower(trim(json_extract(data, '$.app')))                AS app,
       COUNT(*)                                                 AS count
     FROM analytics
     WHERE timestamp >= datetime('now', '-' || ? || ' days')
       AND json_extract(data, '$.event') = 'launch'
     GROUP BY day, app`
  )
    .bind(days)
    .all();

  const sessionsByDay = await env.DB.prepare(
    `WITH ordered AS (
       SELECT
         daily_id,
         timestamp,
         date(timestamp) AS day,
         LAG(timestamp) OVER (PARTITION BY daily_id ORDER BY timestamp) AS prev_ts
       FROM analytics
       WHERE timestamp >= datetime('now', '-' || ? || ' days')
     ),
     sessions AS (
       SELECT
         day,
         daily_id,
         SUM(CASE WHEN prev_ts IS NULL OR
           (julianday(timestamp) - julianday(prev_ts)) * 86400 > 1800
           THEN 1 ELSE 0 END) AS session_count
       FROM ordered
       GROUP BY day, daily_id
     )
     SELECT day, SUM(session_count) AS total_sessions
     FROM sessions
     GROUP BY day
     ORDER BY day DESC`
  )
    .bind(days)
    .all();

  const sessionMap = {};
  for (const row of sessionsByDay.results) {
    sessionMap[row.day] = row.total_sessions;
  }

  const gamesByDay = {};
  for (const row of topGames.results) {
    if (!gamesByDay[row.day]) gamesByDay[row.day] = [];
    gamesByDay[row.day].push({ app: row.app, count: row.count });
  }
  for (const day in gamesByDay) {
    gamesByDay[day].sort((a, b) => b.count - a.count);
  }

  const enrichedDaily = daily.results.map((d) => ({
    ...d,
    requests_per_user: d.unique_players > 0 ? Math.round((d.requests / d.unique_players) * 10) / 10 : 0,
    inferred_sessions: sessionMap[d.day] || 0
  }));

  return { daily: enrichedDaily, topGames: gamesByDay };
}

async function fetchGameCounts(env) {
  const result = await env.DB.prepare(
    `SELECT
       lower(trim(json_extract(data, '$.app'))) AS app,
       COUNT(*)                                  AS count
     FROM analytics
     WHERE json_extract(data, '$.event') = 'launch'
     GROUP BY app
     ORDER BY count DESC`
  ).all();
  return result.results;
}

async function fetchTopTime(env) {
  const result = await env.DB.prepare(
    `SELECT
       lower(trim(json_extract(data, '$.app')))                  AS app,
       COUNT(*)                                                   AS event_count,
       SUM(
         CASE
           WHEN json_extract(data, '$.durationMs') IS NOT NULL
           THEN CAST(json_extract(data, '$.durationMs') AS REAL)
           ELSE 0
         END
       )                                                          AS total_time_ms
     FROM analytics
     WHERE json_extract(data, '$.durationMs') IS NOT NULL
       AND json_extract(data, '$.app')        IS NOT NULL
     GROUP BY app
     ORDER BY total_time_ms DESC
     LIMIT 30`
  ).all();
  return result.results;
}

async function buildAggregatedData(env) {
  const SESSION_GAP_S = 1800;
  const BOUNCE_DURATION_MS = 20000;

  const sessionsRaw = await env.DB.prepare(
    `
    WITH ordered AS (
      SELECT
        daily_id,
        timestamp,
        lower(trim(json_extract(data, '$.event'))) AS event,
        lower(trim(json_extract(data, '$.app')))   AS app,
        LAG(timestamp) OVER (PARTITION BY daily_id ORDER BY timestamp) AS prev_ts
      FROM analytics
    ),
    session_starts AS (
      SELECT
        daily_id,
        timestamp,
        event,
        app,
        prev_ts,
        CASE
          WHEN prev_ts IS NULL
            OR (julianday(timestamp) - julianday(prev_ts)) * 86400 > ?
          THEN 1 ELSE 0
        END AS is_new_session
      FROM ordered
    ),
    with_session_id AS (
      SELECT
        daily_id,
        timestamp,
        event,
        app,
        SUM(is_new_session) OVER (PARTITION BY daily_id ORDER BY timestamp) AS session_num
      FROM session_starts
    ),
    session_bounds AS (
      SELECT
        daily_id,
        session_num,
        MIN(timestamp) AS session_start,
        MAX(timestamp) AS session_end,
        COUNT(*)       AS event_count,
        COUNT(CASE WHEN event = 'launch' THEN 1 END) AS launch_count,
        (julianday(MAX(timestamp)) - julianday(MIN(timestamp))) * 86400000 AS duration_ms,
        date(MIN(timestamp)) AS day
      FROM with_session_id
      GROUP BY daily_id, session_num
    )
    SELECT
      COUNT(*)                          AS total_sessions,
      AVG(duration_ms)                  AS avg_duration_ms,
      AVG(launch_count)                 AS avg_apps_per_session,
      MAX(duration_ms)                  AS longest_session_ms,
      MIN(duration_ms)                  AS shortest_session_ms,
      SUM(CASE WHEN event_count <= 1 OR duration_ms < ? THEN 1 ELSE 0 END) AS bounce_sessions
    FROM session_bounds
  `
  )
    .bind(SESSION_GAP_S, BOUNCE_DURATION_MS)
    .first();

  const powerUsersRaw = await env.DB.prepare(
    `
    WITH daily_counts AS (
      SELECT daily_id, date(timestamp) AS day, COUNT(*) AS event_count
      FROM analytics
      GROUP BY daily_id, day
    )
    SELECT COUNT(DISTINCT daily_id) AS power_users
    FROM daily_counts
    WHERE event_count >= 20
  `
  ).first();

  const flowsRaw = await env.DB.prepare(
    `
    WITH launches AS (
      SELECT
        daily_id,
        timestamp,
        lower(trim(json_extract(data, '$.app'))) AS app,
        LAG(timestamp) OVER (PARTITION BY daily_id ORDER BY timestamp) AS prev_ts,
        LAG(lower(trim(json_extract(data, '$.app')))) OVER (PARTITION BY daily_id ORDER BY timestamp) AS prev_app
      FROM analytics
      WHERE lower(trim(json_extract(data, '$.event'))) = 'launch'
    )
    SELECT prev_app AS source, app AS destination, COUNT(*) AS count
    FROM launches
    WHERE prev_app IS NOT NULL
      AND app IS NOT NULL
      AND prev_app != app
      AND (julianday(timestamp) - julianday(prev_ts)) * 86400 <= ?
    GROUP BY source, destination
    ORDER BY count DESC
    LIMIT 50
  `
  )
    .bind(SESSION_GAP_S)
    .all();

  const entryRaw = await env.DB.prepare(
    `
    WITH ordered_launches AS (
      SELECT
        daily_id,
        lower(trim(json_extract(data, '$.app'))) AS app,
        ROW_NUMBER() OVER (PARTITION BY daily_id ORDER BY timestamp ASC) AS rn
      FROM analytics
      WHERE lower(trim(json_extract(data, '$.event'))) = 'launch'
    )
    SELECT app, COUNT(*) AS count
    FROM ordered_launches
    WHERE rn = 1 AND app IS NOT NULL
    GROUP BY app
    ORDER BY count DESC
    LIMIT 10
  `
  ).all();

  const exitRaw = await env.DB.prepare(
    `
    WITH ordered_launches AS (
      SELECT
        daily_id,
        lower(trim(json_extract(data, '$.app'))) AS app,
        ROW_NUMBER() OVER (PARTITION BY daily_id ORDER BY timestamp DESC) AS rn
      FROM analytics
      WHERE lower(trim(json_extract(data, '$.event'))) = 'launch'
    )
    SELECT app, COUNT(*) AS count
    FROM ordered_launches
    WHERE rn = 1 AND app IS NOT NULL
    GROUP BY app
    ORDER BY count DESC
    LIMIT 10
  `
  ).all();

  const explorationRaw = await env.DB.prepare(
    `
    WITH session_apps AS (
      SELECT
        daily_id,
        SUM(CASE
          WHEN prev_ts IS NULL OR (julianday(timestamp) - julianday(prev_ts)) * 86400 > ?
          THEN 1 ELSE 0
        END) OVER (PARTITION BY daily_id ORDER BY timestamp) AS session_num,
        lower(trim(json_extract(data, '$.app'))) AS app
      FROM (
        SELECT
          daily_id,
          timestamp,
          LAG(timestamp) OVER (PARTITION BY daily_id ORDER BY timestamp) AS prev_ts,
          data
        FROM analytics
        WHERE lower(trim(json_extract(data, '$.event'))) = 'launch'
      )
    ),
    session_diversity AS (
      SELECT daily_id, session_num, COUNT(DISTINCT app) AS unique_apps
      FROM session_apps
      WHERE app IS NOT NULL
      GROUP BY daily_id, session_num
    ),
    user_exploration AS (
      SELECT daily_id, AVG(unique_apps) AS avg_unique
      FROM session_diversity
      GROUP BY daily_id
    )
    SELECT
      (SELECT AVG(unique_apps) FROM session_diversity) AS avg_unique_apps_per_session,
      daily_id,
      avg_unique
    FROM user_exploration
    ORDER BY avg_unique DESC
    LIMIT 5
  `
  )
    .bind(SESSION_GAP_S)
    .all();

  const avgUnique = explorationRaw.results[0]?.avg_unique_apps_per_session || 0;
  const topExplorers = explorationRaw.results.map((r) => ({
    user_id: r.daily_id.slice(0, 8) + "...",
    avg_unique: Math.round((r.avg_unique || 0) * 10) / 10
  }));

  return {
    sessionsResponse: {
      total_sessions: sessionsRaw?.total_sessions || 0,
      avg_duration_ms: Math.round(sessionsRaw?.avg_duration_ms || 0),
      avg_apps_per_session: Math.round((sessionsRaw?.avg_apps_per_session || 0) * 10) / 10,
      longest_session_ms: sessionsRaw?.longest_session_ms || 0,
      shortest_session_ms: sessionsRaw?.shortest_session_ms || 0,
      bounce_sessions: sessionsRaw?.bounce_sessions || 0,
      power_users: powerUsersRaw?.power_users || 0
    },
    flowsResponse: {
      flows: (flowsRaw.results || []).map((r) => ({
        source: r.source,
        destination: r.destination,
        count: r.count
      }))
    },
    entryExitResponse: {
      top_entry_apps: entryRaw.results || [],
      top_exit_apps: exitRaw.results || []
    },
    explorationResponse: {
      avg_unique_apps_per_session: Math.round((avgUnique || 0) * 10) / 10,
      top_explorers: topExplorers,
      top_diverse_sessions: []
    }
  };
}

async function fetchLive(env) {
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  const activeUsers = await env.DB.prepare(
    `SELECT COUNT(DISTINCT daily_id) AS count FROM analytics WHERE timestamp >= ?`
  )
    .bind(fiveMinAgo)
    .all();

  const topActive = await env.DB.prepare(
    `SELECT lower(trim(json_extract(data, '$.app'))) AS app, COUNT(*) AS count
     FROM analytics WHERE timestamp >= ? AND json_extract(data, '$.event') = 'launch'
     GROUP BY app ORDER BY count DESC LIMIT 5`
  )
    .bind(fiveMinAgo)
    .all();

  const appList = await fetchAppList(env);
  topActive.results = topActive.results.filter((row) => isAppAllowed(row.app, appList));

  const recentSessions = await env.DB.prepare(
    `SELECT daily_id, MIN(timestamp) AS first, MAX(timestamp) AS last
     FROM analytics WHERE timestamp >= ? GROUP BY daily_id`
  )
    .bind(fiveMinAgo)
    .all();

  const SESSION_GAP_MS = 30 * 60 * 1000;
  let activeSessions = 0;
  for (const row of recentSessions.results) {
    const diff = new Date(row.last).getTime() - new Date(row.first).getTime();
    if (diff < SESSION_GAP_MS) activeSessions++;
  }

  return {
    active_users_5min: activeUsers.results[0]?.count || 0,
    active_sessions: activeSessions,
    top_active_apps: topActive.results
  };
}

async function fetchPeakConcurrent(env, range) {
  let days = 30;
  if (range === "7d") days = 7;
  if (range === "90d") days = 90;
  if (range === "1y") days = 365;

  const result = await env.DB.prepare(
    `
    WITH per_minute AS (
      SELECT
        date(timestamp) AS day,
        strftime('%Y-%m-%d %H:%M', timestamp) AS minute,
        COUNT(DISTINCT daily_id) AS concurrent
      FROM analytics
      WHERE timestamp >= datetime('now', '-' || ? || ' days')
      GROUP BY day, minute
    ),
    daily_peak AS (
      SELECT day, MAX(concurrent) AS peak
      FROM per_minute
      GROUP BY day
    )
    SELECT dp.day, dp.peak,
      (SELECT MIN(pm.minute) FROM per_minute pm WHERE pm.day = dp.day AND pm.concurrent = dp.peak LIMIT 1) AS at_time
    FROM daily_peak dp
    ORDER BY dp.day DESC
  `
  )
    .bind(days)
    .all();

  const results = result.results || [];
  let overallPeak = 0;
  let overallTime = null;
  for (const row of results) {
    if (row.peak > overallPeak) {
      overallPeak = row.peak;
      overallTime = row.at_time;
    }
  }

  return {
    overall_peak: {
      concurrent: overallPeak,
      at_time: overallTime
    },
    daily: results
  };
}

async function fetchInsights(env, range) {
  let days = 30;
  if (range === "7d") days = 7;
  if (range === "90d") days = 90;
  if (range === "1y") days = 365;
  const G = 1800;

  const [eventTypes, newReturning, retention, hourly, userActivity, appUnique, appAvgTime, dauWauMau] =
    await Promise.all([
      env.DB.prepare(
        `SELECT COALESCE(lower(trim(json_extract(data,'$.event'))),'unknown') AS et,COUNT(*) AS c FROM analytics WHERE timestamp>=datetime('now',-?||' days') GROUP BY et ORDER BY c DESC`
      )
        .bind(days)
        .all(),
      env.DB.prepare(
        `WITH f AS(SELECT daily_id,MIN(date(timestamp)) AS fd FROM analytics GROUP BY daily_id),r AS(SELECT date(timestamp) AS d,daily_id FROM analytics WHERE timestamp>=datetime('now',-?||' days') GROUP BY d,daily_id)SELECT r.d,COUNT(DISTINCT r.daily_id) AS t,COUNT(DISTINCT CASE WHEN r.d=f.fd THEN r.daily_id END) AS n,COUNT(DISTINCT CASE WHEN r.d!=f.fd THEN r.daily_id END) AS rl FROM r JOIN f ON f.daily_id=r.daily_id GROUP BY r.d ORDER BY r.d`
      )
        .bind(days)
        .all(),
      env.DB.prepare(
        `WITH u AS(SELECT date(timestamp) AS d,daily_id FROM analytics WHERE timestamp>=datetime('now',-?||' days') GROUP BY d,daily_id)SELECT a.d AS d,COUNT(DISTINCT a.daily_id) AS dau,ROUND(COUNT(DISTINCT b.daily_id)*1.0/NULLIF(COUNT(DISTINCT a.daily_id),0),3) AS d1,ROUND(COUNT(DISTINCT c.daily_id)*1.0/NULLIF(COUNT(DISTINCT a.daily_id),0),3) AS d7 FROM u a LEFT JOIN u b ON a.daily_id=b.daily_id AND b.d=date(a.d,'+1 day') LEFT JOIN u c ON a.daily_id=c.daily_id AND c.d=date(a.d,'+7 days') GROUP BY a.d ORDER BY a.d`
      )
        .bind(days)
        .all(),
      env.DB.prepare(
        `SELECT CAST(strftime('%H',timestamp) AS INTEGER) AS h,COUNT(*) AS c FROM analytics WHERE timestamp>=datetime('now',-?||' days') GROUP BY h ORDER BY h`
      )
        .bind(days)
        .all(),
      env.DB.prepare(
        `SELECT CASE WHEN c<5 THEN '1-4' WHEN c<10 THEN '5-9' WHEN c<20 THEN '10-19' WHEN c<50 THEN '20-49' WHEN c<100 THEN '50-99' ELSE '100+' END AS b,COUNT(*) AS u FROM(SELECT daily_id,COUNT(*) AS c FROM analytics WHERE timestamp>=datetime('now',-?||' days') GROUP BY daily_id)GROUP BY b ORDER BY MIN(c)`
      )
        .bind(days)
        .all(),
      env.DB.prepare(
        `SELECT lower(trim(json_extract(data,'$.app'))) AS a,COUNT(DISTINCT daily_id) AS u,COUNT(*) AS l FROM analytics WHERE timestamp>=datetime('now',-?||' days') AND lower(trim(json_extract(data,'$.event')))='launch' GROUP BY a ORDER BY u DESC LIMIT 20`
      )
        .bind(days)
        .all(),
      env.DB.prepare(
        `SELECT lower(trim(json_extract(data,'$.app'))) AS a,AVG(CAST(json_extract(data,'$.durationMs') AS REAL)) AS d,COUNT(*) AS c FROM analytics WHERE timestamp>=datetime('now',-?||' days') AND lower(trim(json_extract(data,'$.event')))='usage' AND json_extract(data,'$.durationMs') IS NOT NULL GROUP BY a ORDER BY d DESC LIMIT 20`
      )
        .bind(days)
        .all(),
      env.DB.prepare(
        `WITH u AS(SELECT date(timestamp) AS d,daily_id FROM analytics WHERE timestamp>=datetime('now',-?||' days') GROUP BY d,daily_id),dd AS(SELECT DISTINCT d FROM u)SELECT d.d,(SELECT COUNT(DISTINCT daily_id) FROM u WHERE d.d=u.d) AS dau,(SELECT COUNT(DISTINCT daily_id) FROM u WHERE u.d>=date(d.d,'-6 days') AND u.d<=d.d) AS wau,(SELECT COUNT(DISTINCT daily_id) FROM u WHERE u.d>=date(d.d,'-29 days') AND u.d<=d.d) AS mau FROM dd d ORDER BY d.d`
      )
        .bind(days)
        .all()
    ]);

  const sdBuckets = await env.DB.prepare(
    `WITH o AS(SELECT daily_id,timestamp,LAG(timestamp)OVER(PARTITION BY daily_id ORDER BY timestamp) AS p FROM analytics WHERE timestamp>=datetime('now',-?||' days')),s AS(SELECT daily_id,timestamp,SUM(CASE WHEN p IS NULL OR(julianday(timestamp)-julianday(p))*86400>? THEN 1 ELSE 0 END)OVER(PARTITION BY daily_id ORDER BY timestamp) AS sn FROM o),b AS(SELECT daily_id,sn,MIN(timestamp) AS st,MAX(timestamp) AS en FROM s GROUP BY daily_id,sn),x AS(SELECT(julianday(en)-julianday(st))*86400000 AS du FROM b)SELECT COUNT(*) AS t,SUM(CASE WHEN du<60000 THEN 1 ELSE 0 END) AS a,SUM(CASE WHEN du>=60000 AND du<300000 THEN 1 ELSE 0 END) AS b,SUM(CASE WHEN du>=300000 AND du<900000 THEN 1 ELSE 0 END) AS c,SUM(CASE WHEN du>=900000 AND du<1800000 THEN 1 ELSE 0 END) AS d,SUM(CASE WHEN du>=1800000 AND du<3600000 THEN 1 ELSE 0 END) AS e,SUM(CASE WHEN du>=3600000 THEN 1 ELSE 0 END) AS f FROM x`
  )
    .bind(days, G)
    .first();

  return {
    event_types: eventTypes.results || [],
    new_returning: newReturning.results || [],
    retention: retention.results || [],
    hourly: hourly.results || [],
    user_activity: userActivity.results || [],
    app_unique_users: appUnique.results || [],
    app_avg_time: appAvgTime.results || [],
    dau_wau_mau: dauWauMau.results || [],
    session_durations: sdBuckets || { t: 0, a: 0, b: 0, c: 0, d: 0, e: 0, f: 0 }
  };
}

function ensureThemesSchema(env) {
  if (themesInitPromise) return themesInitPromise;
  const statements = [
    "CREATE TABLE IF NOT EXISTS themes (id TEXT PRIMARY KEY, author_id TEXT NOT NULL, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', author TEXT NOT NULL DEFAULT '', icon TEXT NOT NULL DEFAULT '', contract TEXT NOT NULL, colors TEXT NOT NULL DEFAULT '{}', effects TEXT NOT NULL DEFAULT '{}', config TEXT NOT NULL DEFAULT '{}', upvotes INTEGER NOT NULL DEFAULT 0, downvotes INTEGER NOT NULL DEFAULT 0, score INTEGER NOT NULL DEFAULT 0, installs INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'approved', created_at TEXT NOT NULL, updated_at TEXT NOT NULL)",
    "CREATE TABLE IF NOT EXISTS theme_ratings (theme_id TEXT NOT NULL, daily_id TEXT NOT NULL, vote INTEGER NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY (theme_id, daily_id))",
    "CREATE TABLE IF NOT EXISTS theme_installs (theme_id TEXT NOT NULL, daily_id TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY (theme_id, daily_id))",
    "CREATE INDEX IF NOT EXISTS idx_themes_status_score ON themes (status, score DESC)",
    "CREATE INDEX IF NOT EXISTS idx_themes_status_created ON themes (status, created_at DESC)"
  ];
  themesInitPromise = (async () => {
    await env.DB.batch(statements.map((sql) => env.DB.prepare(sql)));
    const tableInfo = await env.DB.prepare("PRAGMA table_info(themes)").all();
    const hasConfig = (tableInfo.results || []).some((column) => column.name === "config");
    if (!hasConfig) {
      await env.DB.prepare("ALTER TABLE themes ADD COLUMN config TEXT NOT NULL DEFAULT '{}'").run();
    }
  })().catch((e) => {
    themesInitPromise = null;
    throw e;
  });
  return themesInitPromise;
}

function ensureSocialSchema(env) {
  if (socialInitPromise) return socialInitPromise;
  const statements = [
    "CREATE TABLE IF NOT EXISTS live_users (user_id TEXT PRIMARY KEY, username TEXT NOT NULL DEFAULT 'Anonymous', avatar_index INTEGER NOT NULL DEFAULT -1, bio TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, last_seen TEXT)",
    "CREATE TABLE IF NOT EXISTS user_achievements (user_id TEXT NOT NULL, achievement_id TEXT NOT NULL, unlocked_at TEXT NOT NULL, PRIMARY KEY (user_id, achievement_id))",
    "CREATE TABLE IF NOT EXISTS user_playtime (user_id TEXT NOT NULL, app TEXT NOT NULL, minutes REAL NOT NULL DEFAULT 0, last_played TEXT, PRIMARY KEY (user_id, app))",
    "CREATE TABLE IF NOT EXISTS accounts (user_id TEXT PRIMARY KEY, nickname TEXT NOT NULL UNIQUE, email TEXT UNIQUE, pass_hash TEXT NOT NULL, salt TEXT NOT NULL, created_at TEXT NOT NULL)",
    "CREATE TABLE IF NOT EXISTS friendships (user_id TEXT NOT NULL, friend_id TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY (user_id, friend_id))",
    "CREATE TABLE IF NOT EXISTS reactions (target_id TEXT NOT NULL, reactor_id TEXT NOT NULL, reaction TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY (target_id, reactor_id))",
    "CREATE TABLE IF NOT EXISTS daily_streaks (user_id TEXT PRIMARY KEY, streak INTEGER NOT NULL DEFAULT 0, last_seen_day TEXT)",
    "CREATE TABLE IF NOT EXISTS currency (user_id TEXT PRIMARY KEY, bonus_coins INTEGER NOT NULL DEFAULT 0, spent_coins INTEGER NOT NULL DEFAULT 0)",
    "CREATE TABLE IF NOT EXISTS inventory (user_id TEXT NOT NULL, item_id TEXT NOT NULL, acquired_at TEXT NOT NULL, PRIMARY KEY (user_id, item_id))",
    "CREATE TABLE IF NOT EXISTS leaderboard_weekly (user_id TEXT NOT NULL, week TEXT NOT NULL, playtime_min INTEGER NOT NULL DEFAULT 0, reactions INTEGER NOT NULL DEFAULT 0, achievements INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (user_id, week))",
    "CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, from_id TEXT NOT NULL, to_id TEXT NOT NULL, body TEXT NOT NULL, sent_at TEXT NOT NULL, read_at TEXT)",
    "CREATE TABLE IF NOT EXISTS feed (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, actor_id TEXT NOT NULL, type TEXT NOT NULL, data TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL)",
    "CREATE TABLE IF NOT EXISTS quest_claims (user_id TEXT NOT NULL, quest_id TEXT NOT NULL, claim_day TEXT NOT NULL, claimed_at TEXT NOT NULL, PRIMARY KEY (user_id, quest_id, claim_day))",
    "CREATE TABLE IF NOT EXISTS supporter_redemptions (code TEXT PRIMARY KEY, user_id TEXT NOT NULL, redeemed_at TEXT NOT NULL)",
    "CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL)",
    "CREATE TABLE IF NOT EXISTS user_sync (user_id TEXT PRIMARY KEY, payload TEXT, updated_at TEXT)",
    "CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id)",
    "CREATE INDEX IF NOT EXISTS idx_friendships_friend ON friendships (friend_id, status)",
    "CREATE INDEX IF NOT EXISTS idx_messages_pair ON messages (from_id, to_id, sent_at)",
    "CREATE INDEX IF NOT EXISTS idx_feed_user ON feed (user_id, created_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_live_users_last_seen ON live_users (last_seen DESC)",
    "CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements (user_id)",
    "CREATE INDEX IF NOT EXISTS idx_user_playtime_user ON user_playtime (user_id)",
    "CREATE INDEX IF NOT EXISTS idx_accounts_nickname ON accounts (nickname)",
    "CREATE INDEX IF NOT EXISTS idx_accounts_email ON accounts (email)"
  ];
  socialInitPromise = (async () => {
    await env.DB.batch(statements.map((sql) => env.DB.prepare(sql)));
    const tableInfo = await env.DB.prepare("PRAGMA table_info(live_users)").all();
    const hasBio = (tableInfo.results || []).some((column) => column.name === "bio");
    if (!hasBio) {
      await env.DB.prepare("ALTER TABLE live_users ADD COLUMN bio TEXT NOT NULL DEFAULT ''").run();
    }
    const hasPresence = (tableInfo.results || []).some((column) => column.name === "presence");
    if (!hasPresence) {
      await env.DB.prepare("ALTER TABLE live_users ADD COLUMN presence TEXT NOT NULL DEFAULT 'online'").run();
    }
    const accountsInfo = await env.DB.prepare("PRAGMA table_info(accounts)").all();
    const hasSupporter = (accountsInfo.results || []).some((column) => column.name === "supporter");
    if (!hasSupporter) {
      await env.DB.prepare("ALTER TABLE accounts ADD COLUMN supporter INTEGER NOT NULL DEFAULT 0").run();
    }
    const hasSupporterSince = (accountsInfo.results || []).some((column) => column.name === "supporter_since");
    if (!hasSupporterSince) {
      await env.DB.prepare("ALTER TABLE accounts ADD COLUMN supporter_since TEXT").run();
    }
  })().catch((e) => {
    socialInitPromise = null;
    throw e;
  });
  return socialInitPromise;
}

function sanitizeName(value, fallback) {
  if (typeof value !== "string") return fallback || "Anonymous";
  const v = value.trim().slice(0, 32);
  if (!v || isUrlPrefixed(v) || v.includes("<") || v.includes(">")) return fallback || "Anonymous";
  return v;
}

function sanitizePresence(value) {
  return value === "online" || value === "invisible" || value === "offline" ? value : "online";
}

function validUserId(value) {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(value);
}

function randomHex(bytes) {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hashPassword(password, salt) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), { name: "PBKDF2" }, false, [
    "deriveBits"
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: new TextEncoder().encode(salt), iterations: 100000, hash: "SHA-256" },
    key,
    256
  );
  return Array.from(new Uint8Array(bits))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const SESSION_TTL_MS = 60 * 24 * 60 * 60 * 1000;
const FREE_SYNC_QUOTA_BYTES = 256 * 1024;
const SUPPORTER_SYNC_QUOTA_BYTES = 64 * 1024 * 1024;

async function createSession(env, userId) {
  const token = randomHex(32);
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  await env.DB.prepare("INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)")
    .bind(token, userId, now, expiresAt)
    .run();
  return token;
}

async function destroySession(env, token) {
  if (!token) return;
  await env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
}

async function authorizeSession(env, request) {
  const header = request.headers.get("Authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;
  const row = await env.DB.prepare("SELECT user_id, expires_at FROM sessions WHERE token = ?").bind(token).first();
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await destroySession(env, token);
    return null;
  }
  return { userId: row.user_id, token };
}

async function getAccountQuota(env, userId) {
  const account = await env.DB.prepare("SELECT supporter FROM accounts WHERE user_id = ?").bind(userId).first();
  const supporter = !!(account && account.supporter);
  const limit = supporter ? SUPPORTER_SYNC_QUOTA_BYTES : FREE_SYNC_QUOTA_BYTES;
  const sync = await env.DB.prepare("SELECT payload FROM user_sync WHERE user_id = ?").bind(userId).first();
  const used = sync && sync.payload ? new TextEncoder().encode(sync.payload).length : 0;
  return { limit, used, supporter };
}

function profileUpsertStatement(env, userId, username, avatarIndex, now) {
  const hasName = typeof username === "string" && username.length > 0;
  const insertName = hasName ? username : "Anonymous";
  const insertAvatar = typeof avatarIndex === "number" && avatarIndex >= 0 ? avatarIndex : -1;
  const updates = [
    hasName ? "username = excluded.username" : "",
    insertAvatar >= 0 ? "avatar_index = excluded.avatar_index" : "",
    "last_seen = CASE WHEN COALESCE(live_users.presence, 'online') = 'online' THEN excluded.last_seen ELSE live_users.last_seen END"
  ]
    .filter(Boolean)
    .join(", ");
  return env.DB.prepare(
    `INSERT INTO live_users (user_id, username, avatar_index, created_at, last_seen) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET ${updates}`
  ).bind(userId, insertName, insertAvatar, now, now);
}
const SHOP_CATALOG = [
  {
    id: "banner_amberdusk",
    type: "banner",
    name: "Amber Dusk",
    icon: "fa-sun",
    description: "Warm amber fading into deep plum twilight.",
    priceCoins: 40,
    supporterOnly: false,
    rarity: "common",
    availableFrom: null,
    availableTo: null
  },
  {
    id: "banner_harbormist",
    type: "banner",
    name: "Harbor Mist",
    icon: "fa-water",
    description: "Foggy teal harbor at first light.",
    priceCoins: 45,
    supporterOnly: false,
    rarity: "common",
    availableFrom: null,
    availableTo: null
  },
  {
    id: "banner_clayroute",
    type: "banner",
    name: "Clay Route",
    icon: "fa-mountain",
    description: "Sunbaked terracotta trail through the highlands.",
    priceCoins: 45,
    supporterOnly: false,
    rarity: "common",
    availableFrom: null,
    availableTo: null
  },
  {
    id: "banner_velvetstatic",
    type: "banner",
    name: "Velvet Static",
    icon: "fa-bolt",
    description: "Violet dusk with a soft charged highlight.",
    priceCoins: 85,
    supporterOnly: false,
    rarity: "rare",
    availableFrom: null,
    availableTo: null
  },
  {
    id: "banner_coralreef",
    type: "banner",
    name: "Coral Reef",
    icon: "fa-fish",
    description: "Sunlit reef water, coral to deep cyan.",
    priceCoins: 90,
    supporterOnly: false,
    rarity: "rare",
    availableFrom: null,
    availableTo: null
  },
  {
    id: "banner_ironbloom",
    type: "banner",
    name: "Iron Bloom",
    icon: "fa-industry",
    description: "Cold steel warmed by a crimson bloom.",
    priceCoins: 95,
    supporterOnly: false,
    rarity: "rare",
    availableFrom: null,
    availableTo: null
  },
  {
    id: "banner_solarflare",
    type: "banner",
    name: "Solar Flare",
    icon: "fa-fire-flame-curved",
    description: "A living flare with a slow light sweep.",
    priceCoins: 165,
    supporterOnly: false,
    rarity: "epic",
    availableFrom: null,
    availableTo: null
  },
  {
    id: "banner_tidalsurge",
    type: "banner",
    name: "Tidal Surge",
    icon: "fa-water",
    description: "Deep ocean surge catching a passing gleam.",
    priceCoins: 165,
    supporterOnly: false,
    rarity: "epic",
    availableFrom: null,
    availableTo: null
  },
  {
    id: "banner_ashenbloom",
    type: "banner",
    name: "Ashen Bloom",
    icon: "fa-wind",
    description: "Smoke-dark rose that catches passing light.",
    priceCoins: 170,
    supporterOnly: false,
    rarity: "epic",
    availableFrom: null,
    availableTo: "2026-10-10"
  },
  {
    id: "banner_wyrmglass",
    type: "banner",
    name: "Wyrmglass",
    icon: "fa-dragon",
    description: "Emerald dragon-glass with a foil-etched surface.",
    priceCoins: 260,
    supporterOnly: false,
    rarity: "prestige",
    availableFrom: null,
    availableTo: null
  },
  {
    id: "banner_cindermourn",
    type: "banner",
    name: "Cindermourn",
    icon: "fa-skull",
    description: "Molten obsidian, still smoldering under foil.",
    priceCoins: 265,
    supporterOnly: false,
    rarity: "prestige",
    availableFrom: null,
    availableTo: null
  },
  {
    id: "banner_starfallveil",
    type: "banner",
    name: "Starfall Veil",
    icon: "fa-meteor",
    description: "Limited indigo veil drifting with falling stars.",
    priceCoins: 280,
    supporterOnly: false,
    rarity: "prestige",
    availableFrom: null,
    availableTo: "2026-10-31"
  },
  {
    id: "banner_prismnova",
    type: "banner",
    name: "Prism Nova",
    icon: "fa-star-of-life",
    description: "Full-spectrum holographic burst, always shifting.",
    priceCoins: 380,
    supporterOnly: false,
    rarity: "mythic",
    availableFrom: null,
    availableTo: null
  },
  {
    id: "banner_voidglasseclipse",
    type: "banner",
    name: "Voidglass Eclipse",
    icon: "fa-circle-notch",
    description: "Limited holo eclipse, violet fire behind black glass.",
    priceCoins: 420,
    supporterOnly: false,
    rarity: "mythic",
    availableFrom: null,
    availableTo: "2026-11-15"
  },
  {
    id: "banner_aurumsovereign",
    type: "banner",
    name: "Aurum Sovereign",
    icon: "fa-crown",
    description: "Limited molten-gold holo, fit for a throne room.",
    priceCoins: 440,
    supporterOnly: false,
    rarity: "mythic",
    availableFrom: null,
    availableTo: "2026-11-30"
  },
  {
    id: "frame_ash",
    type: "frame",
    name: "Ash Frame",
    icon: "fa-circle",
    description: "Understated ash-grey avatar frame.",
    priceCoins: 30,
    supporterOnly: false,
    rarity: "common",
    availableFrom: null,
    availableTo: null
  },
  {
    id: "frame_cobalt",
    type: "frame",
    name: "Cobalt Frame",
    icon: "fa-circle",
    description: "Clean cobalt blue avatar frame.",
    priceCoins: 35,
    supporterOnly: false,
    rarity: "common",
    availableFrom: null,
    availableTo: null
  },
  {
    id: "frame_sable",
    type: "frame",
    name: "Sable Frame",
    icon: "fa-circle",
    description: "Deep sable brown avatar frame.",
    priceCoins: 30,
    supporterOnly: false,
    rarity: "common",
    availableFrom: null,
    availableTo: null
  },
  {
    id: "frame_pearl",
    type: "frame",
    name: "Pearl Frame",
    icon: "fa-circle-dot",
    description: "Soft luminous pearl avatar frame.",
    priceCoins: 80,
    supporterOnly: false,
    rarity: "rare",
    availableFrom: null,
    availableTo: null
  },
  {
    id: "frame_ember",
    type: "frame",
    name: "Ember Frame",
    icon: "fa-fire",
    description: "Glowing ember avatar frame with double halo.",
    priceCoins: 85,
    supporterOnly: false,
    rarity: "rare",
    availableFrom: null,
    availableTo: null
  },
  {
    id: "frame_glacier",
    type: "frame",
    name: "Glacier Frame",
    icon: "fa-icicles",
    description: "Icy blue avatar frame with a cold double glow.",
    priceCoins: 85,
    supporterOnly: false,
    rarity: "rare",
    availableFrom: null,
    availableTo: null
  },
  {
    id: "frame_wraith",
    type: "frame",
    name: "Wraith Frame",
    icon: "fa-ghost",
    description: "A restless violet gradient that never sits still.",
    priceCoins: 175,
    supporterOnly: false,
    rarity: "epic",
    availableFrom: null,
    availableTo: null
  },
  {
    id: "frame_solstice",
    type: "frame",
    name: "Solstice Frame",
    icon: "fa-sun",
    description: "Gold-to-ember gradient border that breathes with light.",
    priceCoins: 180,
    supporterOnly: false,
    rarity: "epic",
    availableFrom: null,
    availableTo: null
  },
  {
    id: "frame_tempest",
    type: "frame",
    name: "Tempest Frame",
    icon: "fa-cloud-bolt",
    description: "Limited storm-teal gradient with a pulsing charge.",
    priceCoins: 190,
    supporterOnly: false,
    rarity: "epic",
    availableFrom: null,
    availableTo: "2026-10-05"
  },
  {
    id: "frame_royal",
    type: "frame",
    name: "Royal Frame",
    icon: "fa-crown",
    description: "Legendary gold-and-crimson avatar frame.",
    priceCoins: 260,
    supporterOnly: false,
    rarity: "prestige",
    availableFrom: null,
    availableTo: null
  },
  {
    id: "frame_oracle",
    type: "frame",
    name: "Oracle Frame",
    icon: "fa-eye",
    description: "Mystic violet and cyan avatar frame.",
    priceCoins: 270,
    supporterOnly: false,
    rarity: "prestige",
    availableFrom: null,
    availableTo: null
  },
  {
    id: "frame_cosmic",
    type: "frame",
    name: "Cosmic Frame",
    icon: "fa-star",
    description: "Limited intergalactic avatar frame with inner glow.",
    priceCoins: 280,
    supporterOnly: false,
    rarity: "prestige",
    availableFrom: null,
    availableTo: "2026-10-20"
  },
  {
    id: "frame_prismatic",
    type: "frame",
    name: "Prismatic Frame",
    icon: "fa-gem",
    description: "Holographic prism border, endlessly cycling color.",
    priceCoins: 390,
    supporterOnly: false,
    rarity: "mythic",
    availableFrom: null,
    availableTo: null
  },
  {
    id: "frame_voidwalker",
    type: "frame",
    name: "Voidwalker Frame",
    icon: "fa-moon",
    description: "Limited black-violet-cyan holo border from beyond the veil.",
    priceCoins: 430,
    supporterOnly: false,
    rarity: "mythic",
    availableFrom: null,
    availableTo: "2026-11-10"
  },
  {
    id: "frame_solaris",
    type: "frame",
    name: "Solaris Frame",
    icon: "fa-sun",
    description: "Limited molten gold-white solar holo border.",
    priceCoins: 450,
    supporterOnly: false,
    rarity: "mythic",
    availableFrom: null,
    availableTo: "2026-11-25"
  },
  {
    id: "frame_gold",
    type: "frame",
    name: "Gold Frame",
    icon: "fa-award",
    description: "Exclusive animated gold frame for supporters.",
    priceCoins: 0,
    supporterOnly: true,
    rarity: "prestige",
    availableFrom: null,
    availableTo: null
  },
  {
    id: "name_slate",
    type: "name",
    name: "Slate Name",
    icon: "fa-font",
    description: "Cool grey-blue name tag.",
    priceCoins: 20,
    supporterOnly: false,
    rarity: "common",
    availableFrom: null,
    availableTo: null
  },
  {
    id: "name_blossom",
    type: "name",
    name: "Blossom Name",
    icon: "fa-seedling",
    description: "Soft pink blossom name tag.",
    priceCoins: 22,
    supporterOnly: false,
    rarity: "common",
    availableFrom: null,
    availableTo: null
  },
  {
    id: "name_verdant",
    type: "name",
    name: "Verdant Name",
    icon: "fa-leaf",
    description: "Fresh green verdant name tag.",
    priceCoins: 22,
    supporterOnly: false,
    rarity: "common",
    availableFrom: null,
    availableTo: null
  },
  {
    id: "name_gold",
    type: "name",
    name: "Gold Name",
    icon: "fa-coins",
    description: "Luxury gold name tag with a warm glow.",
    priceCoins: 55,
    supporterOnly: false,
    rarity: "rare",
    availableFrom: null,
    availableTo: null
  },
  {
    id: "name_ice",
    type: "name",
    name: "Ice Name",
    icon: "fa-snowflake",
    description: "Frosty ice name tag with a cold glow.",
    priceCoins: 55,
    supporterOnly: false,
    rarity: "rare",
    availableFrom: null,
    availableTo: null
  },
  {
    id: "name_amethyst",
    type: "name",
    name: "Amethyst Name",
    icon: "fa-gem",
    description: "Rich violet name tag with a soft glow.",
    priceCoins: 58,
    supporterOnly: false,
    rarity: "rare",
    availableFrom: null,
    availableTo: null
  },
  {
    id: "name_rainbow",
    type: "name",
    name: "Rainbow Name",
    icon: "fa-palette",
    description: "Full-spectrum animated name tag.",
    priceCoins: 130,
    supporterOnly: false,
    rarity: "epic",
    availableFrom: null,
    availableTo: null
  },
  {
    id: "name_fire",
    type: "name",
    name: "Fire Name",
    icon: "fa-fire-flame-curved",
    description: "Blazing fast-flickering fire name tag.",
    priceCoins: 135,
    supporterOnly: false,
    rarity: "epic",
    availableFrom: null,
    availableTo: null
  },
  {
    id: "name_toxic",
    type: "name",
    name: "Toxic Name",
    icon: "fa-flask",
    description: "Limited venom-green animated name tag.",
    priceCoins: 140,
    supporterOnly: false,
    rarity: "epic",
    availableFrom: null,
    availableTo: "2026-09-30"
  },
  {
    id: "name_chrome",
    type: "name",
    name: "Chrome Name",
    icon: "fa-brush",
    description: "Polished chrome name tag with a breathing shine.",
    priceCoins: 230,
    supporterOnly: false,
    rarity: "prestige",
    availableFrom: null,
    availableTo: null
  },
  {
    id: "name_bloodmoon",
    type: "name",
    name: "Bloodmoon Name",
    icon: "fa-circle-half-stroke",
    description: "Deep crimson name tag that pulses like an eclipse.",
    priceCoins: 235,
    supporterOnly: false,
    rarity: "prestige",
    availableFrom: null,
    availableTo: null
  },
  {
    id: "name_starlight",
    type: "name",
    name: "Starlight Name",
    icon: "fa-star",
    description: "Limited pale-blue name tag with a soft pulsing glow.",
    priceCoins: 240,
    supporterOnly: false,
    rarity: "prestige",
    availableFrom: null,
    availableTo: "2026-10-15"
  },
  {
    id: "name_supreme",
    type: "name",
    name: "Supreme Name",
    icon: "fa-gem",
    description: "Animated supreme name tag with a chromatic fringe.",
    priceCoins: 340,
    supporterOnly: false,
    rarity: "mythic",
    availableFrom: null,
    availableTo: null
  },
  {
    id: "name_prismera",
    type: "name",
    name: "Prismera Name",
    icon: "fa-rainbow",
    description: "Limited holographic name tag, fringed with chroma.",
    priceCoins: 370,
    supporterOnly: false,
    rarity: "mythic",
    availableFrom: null,
    availableTo: "2026-11-05"
  },
  {
    id: "name_eclipse",
    type: "name",
    name: "Eclipse Name",
    icon: "fa-moon",
    description: "Limited black-gold holo name tag with a violet fringe.",
    priceCoins: 380,
    supporterOnly: false,
    rarity: "mythic",
    availableFrom: null,
    availableTo: "2026-11-20"
  },
  {
    id: "badge_glow",
    type: "badge",
    name: "Glow Badge",
    icon: "fa-star",
    description: "Glowing violet badge background.",
    priceCoins: 25,
    supporterOnly: false,
    rarity: "common",
    availableFrom: null,
    availableTo: null
  },
  {
    id: "badge_slate",
    type: "badge",
    name: "Slate Badge",
    icon: "fa-shield",
    description: "Muted slate badge background.",
    priceCoins: 25,
    supporterOnly: false,
    rarity: "common",
    availableFrom: null,
    availableTo: null
  },
  {
    id: "badge_coral",
    type: "badge",
    name: "Coral Badge",
    icon: "fa-droplet",
    description: "Warm coral badge background.",
    priceCoins: 27,
    supporterOnly: false,
    rarity: "common",
    availableFrom: null,
    availableTo: null
  },
  {
    id: "badge_cyan",
    type: "badge",
    name: "Cyan Badge",
    icon: "fa-droplet",
    description: "Cool cyan badge background with layered glow.",
    priceCoins: 60,
    supporterOnly: false,
    rarity: "rare",
    availableFrom: null,
    availableTo: null
  },
  {
    id: "badge_mint",
    type: "badge",
    name: "Mint Badge",
    icon: "fa-leaf",
    description: "Fresh mint badge background with layered glow.",
    priceCoins: 60,
    supporterOnly: false,
    rarity: "rare",
    availableFrom: null,
    availableTo: null
  },
  {
    id: "badge_rose",
    type: "badge",
    name: "Rose Badge",
    icon: "fa-rose",
    description: "Soft rose badge background with layered glow.",
    priceCoins: 62,
    supporterOnly: false,
    rarity: "rare",
    availableFrom: null,
    availableTo: null
  },
  {
    id: "badge_ember",
    type: "badge",
    name: "Ember Badge",
    icon: "fa-fire",
    description: "Smoldering ember gradient badge.",
    priceCoins: 145,
    supporterOnly: false,
    rarity: "epic",
    availableFrom: null,
    availableTo: null
  },
  {
    id: "badge_frost",
    type: "badge",
    name: "Frost Badge",
    icon: "fa-snowflake",
    description: "Deep frost gradient badge.",
    priceCoins: 145,
    supporterOnly: false,
    rarity: "epic",
    availableFrom: null,
    availableTo: null
  },
  {
    id: "badge_venom",
    type: "badge",
    name: "Venom Badge",
    icon: "fa-skull-crossbones",
    description: "Limited toxic-green gradient badge.",
    priceCoins: 150,
    supporterOnly: false,
    rarity: "epic",
    availableFrom: null,
    availableTo: "2026-09-28"
  },
  {
    id: "badge_legend",
    type: "badge",
    name: "Legend Badge",
    icon: "fa-trophy",
    description: "Legendary trophy badge with a breathing glow.",
    priceCoins: 230,
    supporterOnly: false,
    rarity: "prestige",
    availableFrom: null,
    availableTo: null
  },
  {
    id: "badge_infinite",
    type: "badge",
    name: "Infinite Badge",
    icon: "fa-infinity",
    description: "Legendary infinite badge with a breathing glow.",
    priceCoins: 235,
    supporterOnly: false,
    rarity: "prestige",
    availableFrom: null,
    availableTo: null
  },
  {
    id: "badge_sovereign",
    type: "badge",
    name: "Sovereign Badge",
    icon: "fa-chess-king",
    description: "Limited gold-violet sovereign badge.",
    priceCoins: 245,
    supporterOnly: false,
    rarity: "prestige",
    availableFrom: null,
    availableTo: "2026-10-12"
  },
  {
    id: "badge_celestial",
    type: "badge",
    name: "Celestial Badge",
    icon: "fa-star-of-life",
    description: "Full-spectrum holographic badge, always shifting.",
    priceCoins: 350,
    supporterOnly: false,
    rarity: "mythic",
    availableFrom: null,
    availableTo: null
  },
  {
    id: "badge_voidheart",
    type: "badge",
    name: "Voidheart Badge",
    icon: "fa-circle-notch",
    description: "Limited black-violet-cyan holo badge.",
    priceCoins: 380,
    supporterOnly: false,
    rarity: "mythic",
    availableFrom: null,
    availableTo: "2026-11-08"
  },
  {
    id: "badge_radiant",
    type: "badge",
    name: "Radiant Badge",
    icon: "fa-sun",
    description: "Limited molten gold-white radiant holo badge.",
    priceCoins: 390,
    supporterOnly: false,
    rarity: "mythic",
    availableFrom: null,
    availableTo: "2026-11-22"
  },
  {
    id: "badge_supporter",
    type: "badge",
    name: "Supporter Badge",
    icon: "fa-crown",
    description: "Exclusive animated gold badge for supporters.",
    priceCoins: 0,
    supporterOnly: true,
    rarity: "prestige",
    availableFrom: null,
    availableTo: null
  }
];

const QUEST_POOL = [
  { id: "play_game", title: "Game Time", desc: "Play any game today", icon: "fa-gamepad", target: 1, rewardCoins: 10 },
  {
    id: "react_friend",
    title: "Show Some Love",
    desc: "React to a friend's profile",
    icon: "fa-heart",
    target: 1,
    rewardCoins: 10
  },
  {
    id: "send_message",
    title: "Say Hi",
    desc: "Send 3 messages to friends",
    icon: "fa-comment",
    target: 3,
    rewardCoins: 15
  },
  {
    id: "unlock_achievement",
    title: "On a Roll",
    desc: "Unlock an achievement today",
    icon: "fa-trophy",
    target: 1,
    rewardCoins: 15
  },
  {
    id: "add_friend",
    title: "Make a Friend",
    desc: "Add a friend today",
    icon: "fa-user-plus",
    target: 1,
    rewardCoins: 10
  },
  {
    id: "spend_coins",
    title: "Treat Yourself",
    desc: "Buy something from the store",
    icon: "fa-store",
    target: 1,
    rewardCoins: 10
  }
];

const ALLOWED_REACTIONS = new Set(["heart", "fire", "gg", "star", "thumbs"]);
const ACH_XP = 50;
const PLAY_XP_PER_HOUR = 12;
const XP_PER_LEVEL = 100;

function supporterCodes(env) {
  const raw = env.SUPPORTER_CODES;
  if (!raw) return new Set();
  return new Set(
    String(raw)
      .split(",")
      .map((code) => code.trim().toUpperCase())
      .filter(Boolean)
  );
}

function weekStartIso() {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

async function getFriendshipStatus(env, userA, userB) {
  const row = await env.DB.prepare(
    "SELECT status FROM friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?) LIMIT 1"
  )
    .bind(userA, userB, userB, userA)
    .first();
  return row ? row.status : null;
}

async function getActiveFriendIds(env, userId) {
  const rows = await env.DB.prepare(
    "SELECT user_id, friend_id FROM friendships WHERE status = 'active' AND (user_id = ? OR friend_id = ?)"
  )
    .bind(userId, userId)
    .all();
  const ids = new Set();
  for (const row of rows.results) {
    ids.add(row.user_id === userId ? row.friend_id : row.user_id);
  }
  return [...ids];
}

async function insertFeedEvent(env, userId, actorId, type, data) {
  if (!validUserId(userId) || !validUserId(actorId)) return;
  const now = new Date().toISOString();
  try {
    await env.DB.prepare("INSERT INTO feed (user_id, actor_id, type, data, created_at) VALUES (?, ?, ?, ?, ?)")
      .bind(userId, actorId, type, JSON.stringify(data || {}), now)
      .run();
    await env.DB.prepare(
      "DELETE FROM feed WHERE user_id = ? AND id NOT IN (SELECT id FROM feed WHERE user_id = ? ORDER BY id DESC LIMIT 200)"
    )
      .bind(userId, userId)
      .run();
  } catch {}
}

async function fetchNowPlayingMap(env) {
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const rows = await env.DB.prepare(
    `SELECT data FROM analytics WHERE json_extract(data, '$.event') = 'activity_start' AND timestamp >= ? ORDER BY timestamp DESC`
  )
    .bind(fiveMinAgo)
    .all();
  const map = new Map();
  for (const row of rows.results) {
    try {
      const d = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
      const key = d.userId || d.name;
      if (!key || map.has(key)) continue;
      map.set(key, {
        appId: String(d.app || "").slice(0, 64),
        gameTitle: String(d.gameTitle || "").slice(0, 128),
        gameIcon: String(d.gameIcon || "").slice(0, 512),
        startedAt: d.timestamp
      });
    } catch {}
  }
  return map;
}

async function fetchCoinsForUser(env, userId) {
  const playtimeRow = await env.DB.prepare(
    "SELECT COALESCE(SUM(minutes), 0) AS total FROM user_playtime WHERE user_id = ?"
  )
    .bind(userId)
    .first();
  const playtimeMinutes = Math.round(Number(playtimeRow?.total) || 0);
  const achRow = await env.DB.prepare("SELECT COUNT(*) AS c FROM user_achievements WHERE user_id = ?")
    .bind(userId)
    .first();
  const achievementsCount = Number(achRow?.c) || 0;
  const streakRow = await env.DB.prepare("SELECT COALESCE(streak, 0) AS streak FROM daily_streaks WHERE user_id = ?")
    .bind(userId)
    .first();
  const streak = Number(streakRow?.streak) || 0;
  const currencyRow = await env.DB.prepare(
    "SELECT COALESCE(bonus_coins, 0) AS bonus, COALESCE(spent_coins, 0) AS spent FROM currency WHERE user_id = ?"
  )
    .bind(userId)
    .first();
  const bonus = Number(currencyRow?.bonus) || 0;
  const spent = Number(currencyRow?.spent) || 0;
  const derived = Math.floor(playtimeMinutes / 15) + achievementsCount * 25 + streak * 5;
  return { playtimeMinutes, achievementsCount, streak, coins: derived + bonus - spent, derived, bonus, spent };
}

async function computeQuestProgress(env, userId, questId) {
  const day = todayIso();
  if (questId === "play_game") {
    const row = await env.DB.prepare(
      "SELECT COUNT(*) AS c FROM analytics WHERE json_extract(data, '$.event') = 'activity_start' AND json_extract(data, '$.userId') = ? AND timestamp >= ?"
    )
      .bind(userId, day)
      .first();
    return Number(row?.c) || 0;
  }
  if (questId === "react_friend") {
    const row = await env.DB.prepare("SELECT COUNT(*) AS c FROM reactions WHERE reactor_id = ? AND created_at >= ?")
      .bind(userId, day)
      .first();
    return Number(row?.c) || 0;
  }
  if (questId === "send_message") {
    const row = await env.DB.prepare("SELECT COUNT(*) AS c FROM messages WHERE from_id = ? AND sent_at >= ?")
      .bind(userId, day)
      .first();
    return Number(row?.c) || 0;
  }
  if (questId === "unlock_achievement") {
    const row = await env.DB.prepare(
      "SELECT COUNT(*) AS c FROM user_achievements WHERE user_id = ? AND unlocked_at >= ?"
    )
      .bind(userId, day)
      .first();
    return Number(row?.c) || 0;
  }
  if (questId === "add_friend") {
    const row = await env.DB.prepare(
      "SELECT COUNT(*) AS c FROM friendships WHERE status = 'active' AND created_at >= ? AND (user_id = ? OR friend_id = ?)"
    )
      .bind(day, userId, userId)
      .first();
    return Number(row?.c) || 0;
  }
  if (questId === "spend_coins") {
    const row = await env.DB.prepare("SELECT COUNT(*) AS c FROM inventory WHERE user_id = ? AND acquired_at >= ?")
      .bind(userId, day)
      .first();
    return Number(row?.c) || 0;
  }
  return 0;
}

async function fetchDiscoverData(env) {
  const profiles = await env.DB.prepare(
    "SELECT user_id, username, avatar_index, bio, presence, created_at, last_seen FROM live_users ORDER BY last_seen DESC"
  ).all();

  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const activityRows = await env.DB.prepare(
    `SELECT data FROM analytics
     WHERE json_extract(data, '$.event') = 'activity_start'
       AND timestamp >= ?
     ORDER BY timestamp DESC`
  )
    .bind(fiveMinAgo)
    .all();

  const nowPlaying = new Map();
  for (const row of activityRows.results) {
    try {
      const d = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
      const key = d.userId || d.name;
      if (!key) continue;
      if (!nowPlaying.has(key)) {
        nowPlaying.set(key, {
          appId: String(d.app || "").slice(0, 64),
          gameTitle: String(d.gameTitle || "").slice(0, 128),
          gameIcon: String(d.gameIcon || "").slice(0, 512),
          startedAt: d.timestamp
        });
      }
    } catch {}
  }

  const achievementRows = await env.DB.prepare(
    "SELECT user_id, achievement_id, unlocked_at FROM user_achievements"
  ).all();
  const achievementsMap = new Map();
  for (const row of achievementRows.results) {
    if (!achievementsMap.has(row.user_id)) achievementsMap.set(row.user_id, []);
    achievementsMap.get(row.user_id).push({ id: row.achievement_id, unlockedAt: row.unlocked_at });
  }

  const playtimeRows = await env.DB.prepare("SELECT user_id, app, minutes, last_played FROM user_playtime").all();
  const playtimeMap = new Map();
  for (const row of playtimeRows.results) {
    if (!playtimeMap.has(row.user_id)) playtimeMap.set(row.user_id, []);
    playtimeMap.get(row.user_id).push({ app: row.app, minutes: row.minutes, lastPlayed: row.last_played });
  }

  const invRows = await env.DB.prepare("SELECT user_id, item_id FROM inventory").all();
  const inventoryMap = new Map();
  for (const row of invRows.results) {
    if (!inventoryMap.has(row.user_id)) inventoryMap.set(row.user_id, []);
    inventoryMap.get(row.user_id).push(row.item_id);
  }

  const supporterRows = await env.DB.prepare("SELECT user_id FROM accounts WHERE supporter = 1").all();
  const supporterSet = new Set(supporterRows.results.map((r) => r.user_id));

  const users = (profiles.results || []).map((p) => {
    const achievements = achievementsMap.get(p.user_id) || [];
    const playtime = playtimeMap.get(p.user_id) || [];
    const totalMinutes = playtime.reduce((sum, item) => sum + item.minutes, 0);
    return {
      userId: p.user_id,
      username: p.username,
      avatarIndex: typeof p.avatar_index === "number" ? p.avatar_index : -1,
      bio: p.bio || "",
      createdAt: p.created_at,
      lastSeen: p.last_seen,
      nowPlaying: p.presence !== "online" ? null : nowPlaying.get(p.user_id) || null,
      achievements,
      playtime: playtime.sort((a, b) => b.minutes - a.minutes),
      totalMinutes: Math.round(totalMinutes),
      inventory: inventoryMap.get(p.user_id) || [],
      supporter: supporterSet.has(p.user_id)
    };
  });

  return { users };
}

function themeRateLimit(env, ip, bucket) {
  const limits = {
    upload: [10, 15 * 60 * 1000],
    rate: [30, 60 * 1000],
    report: [5, 60 * 60 * 1000],
    delete: [5, 10 * 60 * 1000],
    register: [20, 10 * 60 * 1000],
    achievements: [50, 60 * 1000],
    login: [10, 60 * 1000],
    friends: [20, 10 * 60 * 1000],
    reactions: [30, 60 * 1000],
    messages: [30, 60 * 1000],
    purchase: [5, 60 * 1000],
    redeem: [3, 24 * 60 * 60 * 1000],
    quests: [10, 10 * 60 * 1000]
  };
  const config = limits[bucket];
  if (!config) return true;
  const [max, window] = config;
  const now = Date.now();
  let buckets = themeRateStore.get(ip);
  if (!buckets) {
    buckets = new Map();
    themeRateStore.set(ip, buckets);
  }
  let times = buckets.get(bucket) || [];
  times = times.filter((t) => now - t < window);
  if (times.length >= max) {
    buckets.set(bucket, times);
    return false;
  }
  times.push(now);
  buckets.set(bucket, times);
  if (themeRateStore.size > 10000) {
    for (const [key, value] of themeRateStore) {
      let empty = true;
      for (const [b, t] of value) {
        value.set(
          b,
          t.filter((x) => now - x < limits[b][1])
        );
        if (value.get(b).length > 0) empty = false;
      }
      if (empty) themeRateStore.delete(key);
    }
  }
  return true;
}

const THEME_COLOR_KEYS = [
  "brand",
  "brand-hover",
  "brand-dark",
  "brand-glow",
  "brand-dim",
  "bg-base",
  "bg-elev-1",
  "bg-elev-2",
  "bg-elev-3",
  "bg-primary",
  "bg-secondary",
  "surface-solid",
  "surface-hover",
  "glass",
  "glass-strong",
  "glass-border",
  "glass-hover",
  "text-primary",
  "text-secondary",
  "text-muted",
  "text-on-brand",
  "tx-on-brand",
  "border",
  "border-strong",
  "overlay-bg",
  "error",
  "error-bg",
  "error-border",
  "charging",
  "menu-bg",
  "window-bg",
  "shadow-color"
];

const THEME_EFFECT_OPTIONS = {
  open: [
    "instant",
    "fade",
    "scaleCenter",
    "scaleFromSource",
    "slideUp",
    "slideLeft",
    "slideRight",
    "glassBlurin",
    "elasticBounce",
    "blurReveal",
    "perspective3D",
    "cornerUnfold",
    "slideInGrowth"
  ],
  close: [
    "instant",
    "scaleDownCenter",
    "scaleToOrigin",
    "fadeOut",
    "slideDown",
    "burn",
    "shrinkToPoint",
    "dissolveBlur"
  ],
  minimize: ["instant", "taskbarShrink", "dockZoomShrink", "magicLamp", "fadeToTaskbar", "elasticStretch", "spiralDown"]
};

const THEME_CONFIG_FONTS = ["opensans", "inter", "rubik", "sora", "jetbrainsmono", "monocraft"];
const THEME_CONFIG_DENSITIES = ["compact", "comfortable", "spacious"];

function sanitizeColorValue(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const pattern =
    /^(#[0-9a-fA-F]{3,8}|rgba?\([^()]{1,80}\)|hsla?\([^()]{1,80}\)|oklch\([^()]{1,120}\)|var\(--[a-zA-Z0-9-]{1,64}\)|transparent|currentcolor|none|inherit)$/i;
  if (!pattern.test(trimmed)) return null;
  const lower = trimmed.toLowerCase();
  if (lower.includes("url(") || lower.includes("expression") || lower.includes("javascript")) return null;
  return trimmed;
}

function sanitizeBackground(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > 300) return null;
  const pattern = /^[a-zA-Z0-9#%(),.#\s\-/]+$/;
  if (!pattern.test(trimmed)) return null;
  const lower = trimmed.toLowerCase();
  if (lower.includes("url(") || lower.includes("expression") || lower.includes("javascript")) return null;
  return trimmed;
}

function sanitizeThemeContract(input) {
  if (!input || typeof input !== "object") return { ok: false, errors: ["invalid contract"] };
  const errors = [];
  if (input.schemaVersion !== 1 && input.schemaVersion !== 2) errors.push("invalid schemaVersion");
  if (input.type !== "yukios-theme") errors.push("invalid type");
  if (typeof input.name !== "string" || input.name.trim().length === 0 || input.name.trim().length > 48)
    errors.push("invalid name");
  const description = typeof input.description === "string" ? input.description.trim().slice(0, 200) : "";
  const author = typeof input.author === "string" ? input.author.trim().slice(0, 32) : "";
  const icon = typeof input.icon === "string" ? input.icon.trim().slice(0, 64) : "fas fa-palette";
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (errors.length > 0) return { ok: false, errors };

  let colors = {};
  if (input.colors && typeof input.colors === "object") {
    for (const key of Object.keys(input.colors)) {
      if (!THEME_COLOR_KEYS.includes(key)) continue;
      const sanitized = sanitizeColorValue(input.colors[key]);
      if (sanitized) colors[key] = sanitized;
    }
  }
  if (Object.keys(colors).length < 1) return { ok: false, errors: ["theme needs at least one color"] };

  let effects = {};
  if (input.effects && typeof input.effects === "object") {
    if (
      input.effects.windowAnimation === null ||
      input.effects.windowAnimation === undefined ||
      THEME_EFFECT_OPTIONS.open.includes(input.effects.windowAnimation)
    ) {
      effects.windowAnimation = input.effects.windowAnimation || null;
    }
    if (
      input.effects.closeAnimation === null ||
      input.effects.closeAnimation === undefined ||
      THEME_EFFECT_OPTIONS.close.includes(input.effects.closeAnimation)
    ) {
      effects.closeAnimation = input.effects.closeAnimation || null;
    }
    if (
      input.effects.minimizeAnimation === null ||
      input.effects.minimizeAnimation === undefined ||
      THEME_EFFECT_OPTIONS.minimize.includes(input.effects.minimizeAnimation)
    ) {
      effects.minimizeAnimation = input.effects.minimizeAnimation || null;
    }
    if (typeof input.effects.cursorOff === "boolean") effects.cursorOff = input.effects.cursorOff;
    if (input.effects.background !== undefined) {
      const bg = sanitizeBackground(input.effects.background);
      if (bg) effects.background = bg;
    }
  }

  const config = {};
  if (input.config && typeof input.config === "object") {
    if (THEME_CONFIG_FONTS.includes(input.config.fontFamily)) config.fontFamily = input.config.fontFamily;
    if (THEME_CONFIG_DENSITIES.includes(input.config.density)) config.density = input.config.density;
    if (typeof input.config.windowTransparency === "number" && Number.isFinite(input.config.windowTransparency)) {
      config.windowTransparency = Math.max(20, Math.min(100, Math.round(input.config.windowTransparency)));
    }
  }

  return {
    ok: true,
    contract: {
      schemaVersion: 2,
      type: "yukios-theme",
      name,
      description,
      author,
      icon,
      colors,
      effects,
      config
    },
    errors: []
  };
}

async function handleYukiRequest(request, env) {
  const url = new URL(request.url);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  const clientIP = request.headers.get("CF-Connecting-IP");

  if (!clientIP) {
    return new Response("Missing IP", { status: 400, headers: corsHeaders() });
  }

  if (url.pathname === "/") {
    return new Response("Api is working!", { headers: corsHeaders("text/plain") });
  }

  if (url.pathname === "/admin") {
    return new Response(adminHTML(), { headers: corsHeaders("text/html") });
  }

  if (url.pathname.startsWith("/admin/")) {
    if (!checkAuth(env, request)) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
  }

  if (url.pathname === "/api/report-broken" && request.method === "POST") {
    let payload;
    try {
      payload = await request.json();
    } catch {
      return jsonResponse({ error: "invalid json" }, 400);
    }
    const { appId, title, reason } = payload;
    if (!appId || !title) {
      return jsonResponse({ error: "missing appId or title" }, 400);
    }
    const ipHash = (await deriveDailyId(env, clientIP)).slice(0, 12);
    await sendReportEmbed(env, {
      title: "🚨 Broken Game Reported",
      color: 15158332,
      fields: [
        { name: "Game Title", value: title, inline: true },
        { name: "App ID", value: appId, inline: true },
        { name: "Reason", value: reason || "No reason provided", inline: false },
        { name: "Reporter ID", value: ipHash, inline: false },
        { name: "Timestamp", value: new Date().toISOString(), inline: false }
      ]
    });
    return jsonResponse({ success: true });
  }

  if (url.pathname === "/api/download" && request.method === "POST") {
    if (ipBlocked(env, clientIP)) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return jsonResponse({ error: "invalid json" }, 400);
    }

    const events = Array.isArray(payload) ? payload : [payload];
    const timestamp = new Date().toISOString();
    const dailyId = await deriveDailyId(env, clientIP);

    const inserts = events.map((event) => {
      const data = {
        event: "download",
        app: event.app ? normalizeApp(event.app) : "unknown",
        fileName: typeof event.fileName === "string" ? event.fileName.slice(0, 255) : "",
        fileSize: typeof event.fileSize === "number" ? event.fileSize : 0,
        fileType: typeof event.fileType === "string" ? event.fileType.slice(0, 64) : "",
        source: typeof event.source === "string" ? event.source.slice(0, 32) : "",
        timestamp: event.timestamp || Date.now()
      };
      const id = crypto.randomUUID();
      return env.DB.prepare("INSERT INTO analytics (id, daily_id, timestamp, data) VALUES (?, ?, ?, ?)").bind(
        id,
        dailyId,
        timestamp,
        JSON.stringify(data)
      );
    });

    if (inserts.length === 0) return jsonResponse({ status: "ok", count: 0 });
    await env.DB.batch(inserts);
    return jsonResponse({ status: "ok", count: events.length });
  }

  if (url.pathname === "/api/electron-usage" && request.method === "POST") {
    if (ipBlocked(env, clientIP)) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return jsonResponse({ error: "invalid json" }, 400);
    }

    const events = Array.isArray(payload) ? payload : [payload];
    const timestamp = new Date().toISOString();
    const dailyId = await deriveDailyId(env, clientIP);

    const inserts = events.map((event) => {
      const data = {
        event: "electron_usage",
        action: typeof event.action === "string" ? event.action.slice(0, 64) : "unknown",
        platform: typeof event.platform === "string" ? event.platform.slice(0, 32) : "",
        version: typeof event.version === "string" ? event.version.slice(0, 32) : "",
        details: typeof event.details === "string" ? event.details.slice(0, 512) : "",
        isDev: !!event.isDev,
        timestamp: event.timestamp || Date.now()
      };
      const id = crypto.randomUUID();
      return env.DB.prepare("INSERT INTO analytics (id, daily_id, timestamp, data) VALUES (?, ?, ?, ?)").bind(
        id,
        dailyId,
        timestamp,
        JSON.stringify(data)
      );
    });

    if (inserts.length === 0) return jsonResponse({ status: "ok", count: 0 });
    await env.DB.batch(inserts);
    return jsonResponse({ status: "ok", count: events.length });
  }

  if (url.pathname === "/live/activity" && request.method === "POST") {
    if (ipBlocked(env, clientIP)) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return jsonResponse({ error: "invalid json" }, 400);
    }

    await ensureSocialSchema(env);
    const now = new Date().toISOString();
    const events = Array.isArray(payload) ? payload : [payload];
    let cleanEvents = events.filter(
      (e) => !isUrlPrefixed(e.username) && !isUrlPrefixed(e.appId) && !isUrlPrefixed(e.gameTitle)
    );
    const timestamp = new Date().toISOString();
    const dailyId = await deriveDailyId(env, clientIP);

    cleanEvents = cleanEvents.filter((e) => {
      if (e.appId != null && e.appId !== "") {
        const app = normalizeApp(e.appId);
        if (app !== "unknown" && !/^[a-z0-9_.-]{1,64}$/.test(app)) return false;
      }
      if (
        (typeof e.username === "string" && (e.username.includes("<") || e.username.includes(">"))) ||
        (typeof e.gameTitle === "string" && (e.gameTitle.includes("<") || e.gameTitle.includes(">")))
      ) {
        return false;
      }
      return true;
    });

    const inserts = cleanEvents.map((event) => {
      const data = {
        app: event.appId ? normalizeApp(event.appId) : "unknown",
        event: "activity_" + (event.event === "stop" ? "stop" : "start"),
        name: typeof event.username === "string" ? event.username.slice(0, 32) : "Anonymous",
        userId: validUserId(event.userId) ? event.userId : null,
        gameTitle: typeof event.gameTitle === "string" ? event.gameTitle.slice(0, 128) : "",
        gameIcon: isTrustedIconUrl(event.gameIcon) ? event.gameIcon.slice(0, 512) : "",
        avatarIndex: typeof event.avatarIndex === "number" ? event.avatarIndex : -1,
        timestamp: event.timestamp || Date.now()
      };
      const id = crypto.randomUUID();
      return env.DB.prepare("INSERT INTO analytics (id, daily_id, timestamp, data) VALUES (?, ?, ?, ?)").bind(
        id,
        dailyId,
        timestamp,
        JSON.stringify(data)
      );
    });

    const socialStatements = [];
    const feedWrites = [];
    for (const event of cleanEvents) {
      if (!validUserId(event.userId)) continue;
      const username = sanitizeName(event.username, "");
      const avatarIndex = typeof event.avatarIndex === "number" ? event.avatarIndex : -1;
      socialStatements.push(profileUpsertStatement(env, event.userId, username, avatarIndex, now));
      if (event.event !== "stop") {
        feedWrites.push(
          insertFeedEvent(env, event.userId, event.userId, "playing", {
            appId: event.appId ? normalizeApp(event.appId) : "unknown",
            gameTitle: typeof event.gameTitle === "string" ? event.gameTitle.slice(0, 128) : "",
            gameIcon: isTrustedIconUrl(event.gameIcon) ? event.gameIcon.slice(0, 512) : ""
          })
        );
      }
    }

    const allStatements = inserts.concat(socialStatements);
    if (allStatements.length === 0) return jsonResponse({ status: "ok", count: 0 });
    await env.DB.batch(allStatements);
    await Promise.all(feedWrites);
    return jsonResponse({ status: "ok", count: cleanEvents.length });
  }

  if (url.pathname === "/live/now-playing" && request.method === "GET") {
    const users = await withCache(
      Caches.social,
      "now-playing",
      async () => {
        const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

        const result = await env.DB.prepare(
          `SELECT data FROM analytics
           WHERE json_extract(data, '$.event') = 'activity_start'
             AND timestamp >= ?
           ORDER BY timestamp DESC`
        )
          .bind(fiveMinAgo)
          .all();

        const usersMap = new Map();
        for (const row of result.results) {
          try {
            const d = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
            if (!d.name) continue;
            const key = d.userId || d.name;
            if (!usersMap.has(key)) {
              usersMap.set(key, {
                userId: d.userId || null,
                username: String(d.name).slice(0, 32),
                appId: String(d.app || "").slice(0, 64),
                gameTitle: String(d.gameTitle || "").slice(0, 128),
                gameIcon: String(d.gameIcon || "").slice(0, 512),
                avatarIndex: typeof d.avatarIndex === "number" ? d.avatarIndex : -1,
                startedAt: d.timestamp
              });
            }
          } catch {}
        }

        const presenceRows = await env.DB.prepare("SELECT user_id, presence FROM live_users").all();
        const presenceMap = new Map((presenceRows.results || []).map((r) => [r.user_id, r.presence]));

        return Array.from(usersMap.values()).filter(
          (u) => !(u.userId && presenceMap.get(u.userId) && presenceMap.get(u.userId) !== "online")
        );
      },
      5 * 1000
    );

    return jsonResponse({ users });
  }

  if (url.pathname === "/live/recent-players" && request.method === "GET") {
    const rawApp = url.searchParams.get("app") || "";
    const app = normalizeApp(rawApp);
    if (!app || app === "unknown" || !/^[a-z0-9_.-]{1,64}$/.test(app)) {
      return jsonResponse({ users: [] });
    }

    const users = await withCache(
      Caches.social,
      "recent-players-" + app,
      async () => {
        const result = await env.DB.prepare(
          `SELECT data FROM analytics
           WHERE json_extract(data, '$.event') = 'activity_start'
             AND json_extract(data, '$.app') = ?
           ORDER BY timestamp DESC
           LIMIT 200`
        )
          .bind(app)
          .all();

        const usersMap = new Map();
        for (const row of result.results) {
          try {
            const d = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
            if (!d.name) continue;
            const key = d.userId || d.name;
            if (!usersMap.has(key)) {
              usersMap.set(key, {
                userId: d.userId || null,
                username: String(d.name).slice(0, 32),
                appId: String(d.app || "").slice(0, 64),
                gameTitle: String(d.gameTitle || "").slice(0, 128),
                gameIcon: String(d.gameIcon || "").slice(0, 512),
                avatarIndex: typeof d.avatarIndex === "number" ? d.avatarIndex : -1,
                startedAt: d.timestamp
              });
            }
          } catch {}
        }
        return Array.from(usersMap.values());
      },
      60 * 1000
    );

    return jsonResponse({ users });
  }

  if (url.pathname === "/live/register" && request.method === "POST") {
    if (ipBlocked(env, clientIP)) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }
    if (!themeRateLimit(env, clientIP, "register")) {
      return jsonResponse({ error: "Rate limited" }, 429);
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return jsonResponse({ error: "invalid json" }, 400);
    }

    await ensureSocialSchema(env);
    const now = new Date().toISOString();
    const userId = validUserId(payload.userId) ? payload.userId : null;
    const username = sanitizeName(payload.username, "Anonymous");
    const avatarIndex =
      typeof payload.avatarIndex === "number" && Number.isInteger(payload.avatarIndex)
        ? Math.max(-1, Math.min(payload.avatarIndex, 1024))
        : -1;
    const created = !userId;
    const resolvedId = userId || crypto.randomUUID();
    const bio = typeof payload.bio === "string" ? payload.bio.trim().slice(0, 300) : "";
    const presenceProvided = payload.presence !== undefined;
    const presence = presenceProvided ? sanitizePresence(payload.presence) : null;
    let lastSeenValue = now;
    if (presenceProvided) {
      lastSeenValue = presence === "online" ? now : new Date(Date.now() - 10 * 60 * 1000).toISOString();
    }

    await env.DB.prepare(
      `INSERT INTO live_users (user_id, username, avatar_index, bio, presence, created_at, last_seen)
         VALUES (?, ?, ?, ?, COALESCE(?, 'online'), ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           username = excluded.username,
           avatar_index = CASE WHEN excluded.avatar_index >= 0 THEN excluded.avatar_index ELSE live_users.avatar_index END,
           bio = excluded.bio,
           presence = CASE WHEN excluded.presence IS NOT NULL THEN excluded.presence ELSE live_users.presence END,
           last_seen = CASE
             WHEN COALESCE(excluded.presence, live_users.presence, 'online') = 'online' THEN excluded.last_seen
             WHEN excluded.presence IS NOT NULL THEN excluded.last_seen
             ELSE live_users.last_seen END`
    )
      .bind(resolvedId, username, avatarIndex, bio, presence, now, lastSeenValue)
      .run();

    return jsonResponse({ userId: resolvedId, username, avatarIndex, bio, created });
  }

  if (url.pathname === "/live/account/register" && request.method === "POST") {
    if (ipBlocked(env, clientIP)) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }
    if (!themeRateLimit(env, clientIP, "register")) {
      return jsonResponse({ error: "Too many attempts. Try again later." }, 429);
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return jsonResponse({ error: "invalid json" }, 400);
    }

    const nickname = sanitizeName(payload.nickname, null);
    if (!nickname || nickname.length < 3 || nickname.length > 32) {
      return jsonResponse({ error: "Nickname must be 3-32 characters." }, 400);
    }
    const password = typeof payload.password === "string" ? payload.password : "";
    if (password.length < 6) {
      return jsonResponse({ error: "Password must be at least 6 characters." }, 400);
    }

    await ensureSocialSchema(env);

    const existing = await env.DB.prepare("SELECT user_id FROM accounts WHERE lower(nickname) = lower(?)")
      .bind(nickname)
      .first();
    if (existing) {
      return jsonResponse({ error: "That nickname is already taken." }, 409);
    }

    const userId = validUserId(payload.userId) ? payload.userId : crypto.randomUUID();
    const now = new Date().toISOString();
    const salt = randomHex(16);
    const passHash = await hashPassword(password, salt);

    await env.DB.prepare(
      `INSERT INTO live_users (user_id, username, avatar_index, bio, presence, created_at, last_seen)
         VALUES (?, ?, -1, '', 'online', ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET username = excluded.username, last_seen = excluded.last_seen`
    )
      .bind(userId, nickname, now, now)
      .run();

    await env.DB.prepare("INSERT INTO accounts (user_id, nickname, pass_hash, salt, created_at) VALUES (?, ?, ?, ?, ?)")
      .bind(userId, nickname, passHash, salt, now)
      .run();

    const token = await createSession(env, userId);
    return jsonResponse({ userId, nickname, token });
  }

  if (url.pathname === "/live/account/login" && request.method === "POST") {
    if (ipBlocked(env, clientIP)) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }
    if (!themeRateLimit(env, clientIP, "login")) {
      return jsonResponse({ error: "Too many attempts. Try again later." }, 429);
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return jsonResponse({ error: "invalid json" }, 400);
    }

    const identifier = typeof payload.identifier === "string" ? payload.identifier.trim() : "";
    const password = typeof payload.password === "string" ? payload.password : "";
    if (!identifier || !password) {
      return jsonResponse({ error: "Enter your nickname and password." }, 400);
    }

    await ensureSocialSchema(env);

    const row = await env.DB.prepare(
      "SELECT user_id, nickname, pass_hash, salt FROM accounts WHERE lower(nickname) = lower(?)"
    )
      .bind(identifier)
      .first();
    if (!row) {
      return jsonResponse({ error: "Invalid nickname or password." }, 401);
    }

    const candidate = await hashPassword(password, row.salt);
    if (candidate !== row.pass_hash) {
      return jsonResponse({ error: "Invalid nickname or password." }, 401);
    }

    const now = new Date().toISOString();
    await env.DB.prepare("UPDATE live_users SET last_seen = ? WHERE user_id = ?").bind(now, row.user_id).run();

    const token = await createSession(env, row.user_id);
    return jsonResponse({ userId: row.user_id, nickname: row.nickname, token });
  }

  if (url.pathname === "/live/account/me") {
    const session = await authorizeSession(env, request);
    if (!session) return jsonResponse({ error: "Unauthorized. Sign in again." }, 401);

    const user = await env.DB.prepare(
      "SELECT u.user_id, u.username, u.avatar_index, u.bio, COALESCE(a.supporter,0) AS supporter FROM live_users u LEFT JOIN accounts a ON a.user_id = u.user_id WHERE u.user_id = ?"
    )
      .bind(session.userId)
      .first();

    const quota = await getAccountQuota(env, session.userId);
    return jsonResponse({
      userId: session.userId,
      nickname: user ? user.username : null,
      avatarIndex: user ? user.avatar_index : -1,
      bio: user ? user.bio : "",
      supporter: !!(user && user.supporter),
      quota
    });
  }

  if (url.pathname === "/live/account/logout" && request.method === "POST") {
    const session = await authorizeSession(env, request);
    if (session) await destroySession(env, session.token);
    return jsonResponse({ ok: true });
  }

  if (url.pathname === "/live/account/update" && request.method === "POST") {
    if (ipBlocked(env, clientIP)) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }
    const session = await authorizeSession(env, request);
    if (!session) {
      return jsonResponse({ error: "Unauthorized. Sign in again." }, 401);
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return jsonResponse({ error: "invalid json" }, 400);
    }

    const now = new Date().toISOString();
    const updates = { username: null, avatarIndex: undefined, bio: null };
    if (payload.nickname !== undefined) updates.username = sanitizeName(payload.nickname, null);
    if (payload.avatarIndex !== undefined) updates.avatarIndex = Number(payload.avatarIndex);
    if (payload.bio !== undefined) updates.bio = String(payload.bio || "").slice(0, 300);

    if (updates.username) {
      const clash = await env.DB.prepare(
        "SELECT user_id FROM accounts WHERE lower(nickname) = lower(?) AND user_id <> ?"
      )
        .bind(updates.username, session.userId)
        .first();
      if (clash) {
        return jsonResponse({ error: "That nickname is already taken." }, 409);
      }
      await env.DB.prepare("UPDATE accounts SET nickname = ? WHERE user_id = ?")
        .bind(updates.username, session.userId)
        .run();
    }

    const setClauses = [];
    const params = [];
    if (updates.username) {
      setClauses.push("username = ?");
      params.push(updates.username);
    }
    if (Number.isInteger(updates.avatarIndex)) {
      setClauses.push("avatar_index = ?");
      params.push(updates.avatarIndex);
    }
    if (updates.bio !== null) {
      setClauses.push("bio = ?");
      params.push(updates.bio);
    }
    setClauses.push("last_seen = ?");
    params.push(now);
    params.push(session.userId);
    await env.DB.prepare(`UPDATE live_users SET ${setClauses.join(", ")} WHERE user_id = ?`)
      .bind(...params)
      .run();

    const updated = await env.DB.prepare("SELECT username, avatar_index, bio FROM live_users WHERE user_id = ?")
      .bind(session.userId)
      .first();

    return jsonResponse({
      nickname: updated ? updated.username : null,
      avatarIndex: updated ? updated.avatar_index : updates.avatarIndex,
      bio: updated ? updated.bio : updates.bio
    });
  }

  if (url.pathname === "/live/sync/get") {
    const session = await authorizeSession(env, request);
    if (!session) {
      return jsonResponse({ error: "Unauthorized. Sign in again." }, 401);
    }
    const row = await env.DB.prepare("SELECT payload, updated_at FROM user_sync WHERE user_id = ?")
      .bind(session.userId)
      .first();
    const quota = await getAccountQuota(env, session.userId);
    return jsonResponse({
      payload: row && row.payload ? JSON.parse(row.payload) : null,
      updatedAt: row ? row.updated_at : null,
      quota
    });
  }

  if (url.pathname === "/live/sync/set" && request.method === "POST") {
    if (ipBlocked(env, clientIP)) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }
    const session = await authorizeSession(env, request);
    if (!session) {
      return jsonResponse({ error: "Unauthorized. Sign in again." }, 401);
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return jsonResponse({ error: "invalid json" }, 400);
    }

    const blob = JSON.stringify(payload && payload.data !== undefined ? payload.data : payload);
    const byteSize = new TextEncoder().encode(blob).length;
    const quota = await getAccountQuota(env, session.userId);
    if (byteSize > quota.limit - quota.used) {
      return jsonResponse(
        {
          error: "Sync data exceeds your storage quota.",
          byteSize,
          quota: { limit: quota.limit, used: quota.used + byteSize }
        },
        413
      );
    }

    const now = new Date().toISOString();
    await env.DB.prepare(
      "INSERT INTO user_sync (user_id, payload, updated_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at"
    )
      .bind(session.userId, blob, now)
      .run();

    return jsonResponse({ ok: true, updatedAt: now, quota: { ...quota, used: byteSize } });
  }

  if (url.pathname === "/live/friends/request" && request.method === "POST") {
    if (ipBlocked(env, clientIP)) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }
    if (!themeRateLimit(env, clientIP, "friends")) {
      return jsonResponse({ error: "Rate limited" }, 429);
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return jsonResponse({ error: "invalid json" }, 400);
    }

    const userId = validUserId(payload.userId) ? payload.userId : null;
    const friendId = validUserId(payload.friendId) ? payload.friendId : null;
    if (!userId || !friendId || userId === friendId) {
      return jsonResponse({ error: "Invalid friends." }, 400);
    }

    await ensureSocialSchema(env);
    const now = new Date().toISOString();

    const existingStatus = await getFriendshipStatus(env, userId, friendId);
    if (existingStatus === "active") {
      return jsonResponse({ error: "Already friends." }, 409);
    }
    if (existingStatus) {
      return jsonResponse({ error: "Request already pending." }, 409);
    }

    await env.DB.prepare("INSERT INTO friendships (user_id, friend_id, status, created_at) VALUES (?, ?, 'pending', ?)")
      .bind(userId, friendId, now)
      .run();

    delete Caches.social["friends:" + userId];
    delete Caches.social["friends:" + friendId];

    return jsonResponse({ status: "pending" });
  }

  if (url.pathname === "/live/friends/accept" && request.method === "POST") {
    if (ipBlocked(env, clientIP)) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }
    if (!themeRateLimit(env, clientIP, "friends")) {
      return jsonResponse({ error: "Rate limited" }, 429);
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return jsonResponse({ error: "invalid json" }, 400);
    }

    const userId = validUserId(payload.userId) ? payload.userId : null;
    const friendId = validUserId(payload.friendId) ? payload.friendId : null;
    if (!userId || !friendId || userId === friendId) {
      return jsonResponse({ error: "Invalid friends." }, 400);
    }

    await ensureSocialSchema(env);
    const now = new Date().toISOString();

    const incoming = await env.DB.prepare(
      "SELECT user_id FROM friendships WHERE user_id = ? AND friend_id = ? AND status = 'pending'"
    )
      .bind(friendId, userId)
      .first();
    if (!incoming) {
      return jsonResponse({ error: "No pending request." }, 404);
    }

    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO friendships (user_id, friend_id, status, created_at) VALUES (?, ?, 'active', ?) ON CONFLICT(user_id, friend_id) DO UPDATE SET status = 'active'"
      ).bind(userId, friendId, now),
      env.DB.prepare(
        "INSERT INTO friendships (user_id, friend_id, status, created_at) VALUES (?, ?, 'active', ?) ON CONFLICT(user_id, friend_id) DO UPDATE SET status = 'active'"
      ).bind(friendId, userId, now)
    ]);

    delete Caches.social["friends:" + userId];
    delete Caches.social["friends:" + friendId];

    await insertFeedEvent(env, userId, friendId, "friend", {});
    await insertFeedEvent(env, friendId, userId, "friend", {});

    return jsonResponse({ status: "active" });
  }

  if (url.pathname === "/live/friends/remove" && request.method === "POST") {
    if (ipBlocked(env, clientIP)) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }
    if (!themeRateLimit(env, clientIP, "friends")) {
      return jsonResponse({ error: "Rate limited" }, 429);
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return jsonResponse({ error: "invalid json" }, 400);
    }

    const userId = validUserId(payload.userId) ? payload.userId : null;
    const friendId = validUserId(payload.friendId) ? payload.friendId : null;
    if (!userId || !friendId || userId === friendId) {
      return jsonResponse({ error: "Invalid friends." }, 400);
    }

    await ensureSocialSchema(env);

    await env.DB.prepare(
      "DELETE FROM friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)"
    )
      .bind(userId, friendId, friendId, userId)
      .run();

    delete Caches.social["friends:" + userId];
    delete Caches.social["friends:" + friendId];

    return jsonResponse({ success: true });
  }

  if (url.pathname === "/live/friends" && request.method === "GET") {
    if (ipBlocked(env, clientIP)) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }

    const userId = validUserId(url.searchParams.get("userId")) ? url.searchParams.get("userId") : null;
    if (!userId) return jsonResponse({ error: "invalid userId" }, 400);

    await ensureSocialSchema(env);
    const result = await withCache(
      Caches.social,
      "friends:" + userId,
      async () => {
        const rows = await env.DB.prepare(
          "SELECT user_id, friend_id, status, created_at FROM friendships WHERE user_id = ? OR friend_id = ?"
        )
          .bind(userId, userId)
          .all();

        const friendIds = new Set();
        const requests = [];
        const sentRequests = [];
        for (const row of rows.results) {
          if (row.status === "active") {
            friendIds.add(row.user_id === userId ? row.friend_id : row.user_id);
          } else if (row.status === "pending" && row.friend_id === userId) {
            requests.push(row.user_id);
          } else if (row.status === "pending" && row.user_id === userId) {
            sentRequests.push(row.friend_id);
          }
        }

        const ids = [...friendIds, ...requests, ...sentRequests];
        if (ids.length === 0) return { friends: [], requests: [], sentRequests: [] };

        const placeholders = ids.map(() => "?").join(", ");
        const profileRows = await env.DB.prepare(
          `SELECT user_id, username, avatar_index, presence, last_seen FROM live_users WHERE user_id IN (${placeholders})`
        )
          .bind(...ids)
          .all();
        const profileMap = new Map(profileRows.results.map((p) => [p.user_id, p]));
        const nowPlayingMap = await fetchNowPlayingMap(env);

        const enrich = (id) => {
          const p = profileMap.get(id);
          if (!p) return null;
          return {
            userId: p.user_id,
            username: p.username,
            avatarIndex: p.avatar_index,
            presence: p.presence,
            lastSeen: p.last_seen,
            nowPlaying: p.presence === "online" ? nowPlayingMap.get(id) || null : null
          };
        };

        return {
          friends: [...friendIds].map(enrich).filter(Boolean),
          requests: requests.map(enrich).filter(Boolean),
          sentRequests: sentRequests.map(enrich).filter(Boolean)
        };
      },
      10 * 1000
    );

    return jsonResponse(result);
  }

  if (url.pathname === "/live/reactions" && request.method === "GET") {
    if (ipBlocked(env, clientIP)) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }

    const targetId = validUserId(url.searchParams.get("targetId")) ? url.searchParams.get("targetId") : null;
    if (!targetId) return jsonResponse({ error: "invalid targetId" }, 400);
    const viewerId = validUserId(url.searchParams.get("userId")) ? url.searchParams.get("userId") : null;

    await ensureSocialSchema(env);
    const rows = await env.DB.prepare("SELECT reactor_id, reaction FROM reactions WHERE target_id = ?")
      .bind(targetId)
      .all();
    const counts = {};
    let mine = null;
    for (const row of rows.results) {
      counts[row.reaction] = (counts[row.reaction] || 0) + 1;
      if (viewerId && row.reactor_id === viewerId) mine = row.reaction;
    }
    return jsonResponse({ counts, mine });
  }

  if (url.pathname === "/live/reactions" && request.method === "POST") {
    if (ipBlocked(env, clientIP)) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }
    if (!themeRateLimit(env, clientIP, "reactions")) {
      return jsonResponse({ error: "Rate limited" }, 429);
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return jsonResponse({ error: "invalid json" }, 400);
    }

    const userId = validUserId(payload.userId) ? payload.userId : null;
    const targetId = validUserId(payload.targetId) ? payload.targetId : null;
    const reaction = typeof payload.reaction === "string" ? payload.reaction : "";
    if (!userId || !targetId || targetId === userId || !ALLOWED_REACTIONS.has(reaction)) {
      return jsonResponse({ error: "Invalid reaction." }, 400);
    }

    await ensureSocialSchema(env);
    const now = new Date().toISOString();

    await env.DB.prepare(
      "INSERT INTO reactions (target_id, reactor_id, reaction, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(target_id, reactor_id) DO UPDATE SET reaction = excluded.reaction, created_at = excluded.created_at"
    )
      .bind(targetId, userId, reaction, now)
      .run();

    await insertFeedEvent(env, targetId, userId, "reaction", { reaction });

    return jsonResponse({ status: "ok", reaction });
  }

  if (url.pathname === "/live/reactions" && request.method === "DELETE") {
    if (ipBlocked(env, clientIP)) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }
    if (!themeRateLimit(env, clientIP, "reactions")) {
      return jsonResponse({ error: "Rate limited" }, 429);
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return jsonResponse({ error: "invalid json" }, 400);
    }

    const userId = validUserId(payload.userId) ? payload.userId : null;
    const targetId = validUserId(payload.targetId) ? payload.targetId : null;
    if (!userId || !targetId || targetId === userId) {
      return jsonResponse({ error: "Invalid reaction." }, 400);
    }

    await ensureSocialSchema(env);
    await env.DB.prepare("DELETE FROM reactions WHERE target_id = ? AND reactor_id = ?").bind(targetId, userId).run();

    return jsonResponse({ status: "ok" });
  }

  if (url.pathname === "/live/social/me" && request.method === "GET") {
    if (ipBlocked(env, clientIP)) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }

    const userId = validUserId(url.searchParams.get("userId")) ? url.searchParams.get("userId") : null;
    if (!userId) return jsonResponse({ error: "invalid userId" }, 400);

    await ensureSocialSchema(env);

    const row = await env.DB.prepare(
      "SELECT user_id, username, avatar_index, bio, presence, created_at, last_seen FROM live_users WHERE user_id = ?"
    )
      .bind(userId)
      .first();
    if (!row) {
      return jsonResponse({ error: "Profile not found." }, 404);
    }

    const coinsData = await fetchCoinsForUser(env, userId);
    const invRows = await env.DB.prepare("SELECT item_id FROM inventory WHERE user_id = ?").bind(userId).all();
    const account = await env.DB.prepare("SELECT supporter, supporter_since FROM accounts WHERE user_id = ?")
      .bind(userId)
      .first();

    return jsonResponse({
      userId: row.user_id,
      username: row.username,
      avatarIndex: row.avatar_index,
      bio: row.bio || "",
      presence: row.presence,
      createdAt: row.created_at,
      lastSeen: row.last_seen,
      coins: coinsData.coins,
      inventory: invRows.results.map((r) => r.item_id),
      supporter: Number(account?.supporter) > 0,
      supporterSince: account?.supporter_since || null,
      streak: coinsData.streak,
      achievementsCount: coinsData.achievementsCount,
      playtimeMinutes: coinsData.playtimeMinutes
    });
  }

  if (url.pathname === "/live/leaderboard" && request.method === "GET") {
    if (ipBlocked(env, clientIP)) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }

    const weekParam = url.searchParams.get("week");
    const week = weekParam && /^\d{4}-\d{2}-\d{2}$/.test(weekParam) ? weekParam : weekStartIso();
    const sortParam = url.searchParams.get("sort");
    const sort =
      sortParam === "level" || sortParam === "reactions" || sortParam === "achievements" ? sortParam : "playtime";

    await ensureSocialSchema(env);
    const result = await withCache(
      Caches.social,
      "leaderboard:" + week + ":" + sort,
      async () => {
        const orderBy =
          sort === "level"
            ? "level"
            : sort === "reactions"
              ? "reactions"
              : sort === "achievements"
                ? "achievements"
                : "playtime_minutes";
        const sql = `SELECT u.user_id, u.username, u.avatar_index,
          COALESCE((SELECT SUM(minutes) FROM user_playtime p WHERE p.user_id = u.user_id), 0) AS playtime_minutes,
          (SELECT COUNT(*) FROM user_achievements a WHERE a.user_id = u.user_id) AS achievements,
          (SELECT COUNT(*) FROM reactions r WHERE r.target_id = u.user_id${sort === "reactions" ? " AND r.created_at >= ?" : ""}) AS reactions,
          (FLOOR((((SELECT COUNT(*) FROM user_achievements a WHERE a.user_id = u.user_id) * ${ACH_XP}) + ((COALESCE((SELECT SUM(minutes) FROM user_playtime p WHERE p.user_id = u.user_id), 0) / 60) * ${PLAY_XP_PER_HOUR})) / ${XP_PER_LEVEL}) + 1) AS level
          FROM live_users u
          ORDER BY ${orderBy} DESC
          LIMIT 10`;
        const stmt = sort === "reactions" ? env.DB.prepare(sql).bind(week) : env.DB.prepare(sql);
        const rows = await stmt.all();
        const board = rows.results.map((row) => ({
          userId: row.user_id,
          username: row.username,
          avatarIndex: row.avatar_index,
          playtimeMinutes: Math.round(Number(row.playtime_minutes) || 0),
          achievements: Number(row.achievements) || 0,
          reactions: Number(row.reactions) || 0,
          level: Math.max(1, Math.round(Number(row.level) || 1))
        }));
        return { week, sort, board };
      },
      30 * 1000
    );

    return jsonResponse(result);
  }

  if (url.pathname === "/live/shop/catalog" && request.method === "GET") {
    if (ipBlocked(env, clientIP)) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }
    const now = Date.now();
    const activeItems = SHOP_CATALOG.filter((it) => {
      if (it.availableFrom && now < new Date(it.availableFrom).getTime()) return false;
      if (it.availableTo && now > new Date(it.availableTo).getTime()) return false;
      return true;
    }).map((it) => ({ ...it, endsAt: it.availableTo || null }));
    return jsonResponse({ items: activeItems });
  }

  if (url.pathname === "/live/coins/purchase" && request.method === "POST") {
    if (ipBlocked(env, clientIP)) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }
    if (!themeRateLimit(env, clientIP, "purchase")) {
      return jsonResponse({ error: "Rate limited" }, 429);
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return jsonResponse({ error: "invalid json" }, 400);
    }

    const userId = validUserId(payload.userId) ? payload.userId : null;
    if (!userId) return jsonResponse({ error: "invalid userId" }, 400);

    const item = SHOP_CATALOG.find((i) => i.id === payload.itemId);
    if (!item) {
      return jsonResponse({ error: "Item not found." }, 404);
    }

    const purchaseTime = Date.now();
    if (
      (item.availableFrom && purchaseTime < new Date(item.availableFrom).getTime()) ||
      (item.availableTo && purchaseTime > new Date(item.availableTo).getTime())
    ) {
      return jsonResponse({ error: "This item is no longer available." }, 404);
    }

    await ensureSocialSchema(env);
    const now = new Date().toISOString();

    if (item.supporterOnly) {
      const account = await env.DB.prepare("SELECT supporter FROM accounts WHERE user_id = ?").bind(userId).first();
      if (!(Number(account?.supporter) > 0)) {
        return jsonResponse({ error: "This item is supporter-only." }, 403);
      }
    }

    const coinsData = await fetchCoinsForUser(env, userId);
    if (coinsData.coins < item.priceCoins) {
      return jsonResponse({ error: "Not enough coins." }, 400);
    }

    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO inventory (user_id, item_id, acquired_at) VALUES (?, ?, ?) ON CONFLICT(user_id, item_id) DO NOTHING"
      ).bind(userId, item.id, now),
      env.DB.prepare(
        "INSERT INTO currency (user_id, bonus_coins, spent_coins) VALUES (?, 0, ?) ON CONFLICT(user_id) DO UPDATE SET spent_coins = spent_coins + excluded.spent_coins"
      ).bind(userId, item.priceCoins)
    ]);

    return jsonResponse({ status: "ok", itemId: item.id, coins: coinsData.coins - item.priceCoins });
  }

  if (url.pathname === "/live/supporter/redeem" && request.method === "POST") {
    if (ipBlocked(env, clientIP)) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }
    if (!themeRateLimit(env, clientIP, "redeem")) {
      return jsonResponse({ error: "Rate limited" }, 429);
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return jsonResponse({ error: "invalid json" }, 400);
    }

    const userId = validUserId(payload.userId) ? payload.userId : null;
    if (!userId) return jsonResponse({ error: "invalid userId" }, 400);

    const code = String(payload.code || "")
      .trim()
      .toUpperCase();
    if (!code) {
      return jsonResponse({ error: "Enter a code." }, 400);
    }
    if (!supporterCodes(env).has(code)) {
      return jsonResponse({ error: "That code is invalid." }, 400);
    }

    await ensureSocialSchema(env);
    const now = new Date().toISOString();

    const account = await env.DB.prepare("SELECT user_id FROM accounts WHERE user_id = ?").bind(userId).first();
    if (!account) {
      return jsonResponse({ error: "Create an account first." }, 403);
    }

    const existing = await env.DB.prepare("SELECT user_id FROM supporter_redemptions WHERE code = ?")
      .bind(code)
      .first();
    if (existing) {
      return jsonResponse({ error: "Code already used." }, 409);
    }

    await env.DB.batch([
      env.DB.prepare("INSERT INTO supporter_redemptions (code, user_id, redeemed_at) VALUES (?, ?, ?)").bind(
        code,
        userId,
        now
      ),
      env.DB.prepare("UPDATE accounts SET supporter = 1, supporter_since = ? WHERE user_id = ?").bind(now, userId)
    ]);

    return jsonResponse({ status: "ok", supporter: true });
  }

  if (url.pathname === "/live/quests" && request.method === "GET") {
    if (ipBlocked(env, clientIP)) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }

    const userId = validUserId(url.searchParams.get("userId")) ? url.searchParams.get("userId") : null;
    if (!userId) return jsonResponse({ error: "invalid userId" }, 400);

    await ensureSocialSchema(env);

    const claimedRows = await env.DB.prepare("SELECT quest_id FROM quest_claims WHERE user_id = ? AND claim_day = ?")
      .bind(userId, todayIso())
      .all();
    const claimedSet = new Set(claimedRows.results.map((r) => r.quest_id));

    const quests = [];
    for (const item of QUEST_POOL) {
      const progress = await computeQuestProgress(env, userId, item.id);
      quests.push({
        id: item.id,
        title: item.title,
        desc: item.desc,
        icon: item.icon,
        target: item.target,
        rewardCoins: item.rewardCoins,
        progress,
        claimed: claimedSet.has(item.id)
      });
    }

    return jsonResponse({ day: todayIso(), quests });
  }

  if (url.pathname === "/live/quests/claim" && request.method === "POST") {
    if (ipBlocked(env, clientIP)) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }
    if (!themeRateLimit(env, clientIP, "quests")) {
      return jsonResponse({ error: "Rate limited" }, 429);
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return jsonResponse({ error: "invalid json" }, 400);
    }

    const userId = validUserId(payload.userId) ? payload.userId : null;
    if (!userId) return jsonResponse({ error: "invalid userId" }, 400);

    const quest = QUEST_POOL.find((q) => q.id === payload.questId);
    if (!quest) {
      return jsonResponse({ error: "Quest not found." }, 404);
    }

    await ensureSocialSchema(env);
    const now = new Date().toISOString();
    const day = todayIso();

    const existing = await env.DB.prepare(
      "SELECT quest_id FROM quest_claims WHERE user_id = ? AND quest_id = ? AND claim_day = ?"
    )
      .bind(userId, quest.id, day)
      .first();
    if (existing) {
      return jsonResponse({ error: "Already claimed." }, 409);
    }

    const progress = await computeQuestProgress(env, userId, quest.id);
    if (progress < quest.target) {
      return jsonResponse({ error: "Quest not completed." }, 400);
    }

    await env.DB.batch([
      env.DB.prepare("INSERT INTO quest_claims (user_id, quest_id, claim_day, claimed_at) VALUES (?, ?, ?, ?)").bind(
        userId,
        quest.id,
        day,
        now
      ),
      env.DB.prepare(
        "INSERT INTO currency (user_id, bonus_coins, spent_coins) VALUES (?, ?, 0) ON CONFLICT(user_id) DO UPDATE SET bonus_coins = bonus_coins + excluded.bonus_coins"
      ).bind(userId, quest.rewardCoins)
    ]);

    const me = await fetchCoinsForUser(env, userId);
    return jsonResponse({ status: "ok", rewardCoins: quest.rewardCoins, coins: me.coins });
  }

  if (url.pathname === "/live/messages" && request.method === "GET") {
    if (ipBlocked(env, clientIP)) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }

    const userId = validUserId(url.searchParams.get("userId")) ? url.searchParams.get("userId") : null;
    const friendId = validUserId(url.searchParams.get("friendId")) ? url.searchParams.get("friendId") : null;
    if (!userId || (friendId && userId === friendId)) {
      return jsonResponse({ error: "Invalid friends." }, 400);
    }

    await ensureSocialSchema(env);
    const now = new Date().toISOString();

    if (url.searchParams.get("conversations") === "1") {
      const friendIds = await getActiveFriendIds(env, userId);
      const conversations = [];
      for (const fid of friendIds) {
        const last = await env.DB.prepare(
          "SELECT id, from_id, body, sent_at FROM messages WHERE ((from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?)) ORDER BY id DESC LIMIT 1"
        )
          .bind(userId, fid, fid, userId)
          .first();
        const unreadRow = await env.DB.prepare(
          "SELECT COUNT(*) AS c FROM messages WHERE from_id = ? AND to_id = ? AND read_at IS NULL"
        )
          .bind(fid, userId)
          .first();
        const profile = await env.DB.prepare(
          "SELECT user_id, username, avatar_index, presence, last_seen FROM live_users WHERE user_id = ?"
        )
          .bind(fid)
          .first();
        conversations.push({
          friendId: fid,
          username: (profile && profile.username) || "Unknown",
          avatarIndex: typeof profile?.avatar_index === "number" ? profile.avatar_index : -1,
          presence: (profile && profile.presence) || "offline",
          lastSeen: (profile && profile.last_seen) || null,
          lastMessage: last ? { body: last.body, fromMe: last.from_id === userId, sentAt: last.sent_at } : null,
          unreadCount: Number(unreadRow?.c || 0)
        });
      }
      conversations.sort((a, b) => {
        const aTime = a.lastMessage ? new Date(a.lastMessage.sentAt).getTime() : 0;
        const bTime = b.lastMessage ? new Date(b.lastMessage.sentAt).getTime() : 0;
        if (aTime !== bTime) return bTime - aTime;
        return String(a.username).localeCompare(String(b.username));
      });
      return jsonResponse({ conversations });
    }

    if (!friendId) {
      return jsonResponse({ error: "Invalid friends." }, 400);
    }

    const status = await getFriendshipStatus(env, userId, friendId);
    if (status !== "active") {
      return jsonResponse({ error: "Not friends." }, 403);
    }

    const after = url.searchParams.get("after");
    const afterValue = after ? String(after) : "";

    const rows = await env.DB.prepare(
      "SELECT id, from_id, to_id, body, sent_at, read_at FROM messages WHERE ((from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?))" +
        (afterValue ? " AND sent_at > ?" : "") +
        " ORDER BY id DESC LIMIT 100"
    )
      .bind(userId, friendId, friendId, userId, ...(afterValue ? [afterValue] : []))
      .all();

    const messages = rows.results
      .map((row) => ({
        id: row.id,
        fromId: row.from_id,
        toId: row.to_id,
        body: row.body,
        sentAt: row.sent_at,
        readAt: row.read_at
      }))
      .reverse();

    await env.DB.prepare("UPDATE messages SET read_at = ? WHERE to_id = ? AND from_id = ? AND read_at IS NULL")
      .bind(now, userId, friendId)
      .run();

    return jsonResponse({ messages });
  }

  if (url.pathname === "/live/messages" && request.method === "POST") {
    if (ipBlocked(env, clientIP)) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }
    if (!themeRateLimit(env, clientIP, "messages")) {
      return jsonResponse({ error: "Rate limited" }, 429);
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return jsonResponse({ error: "invalid json" }, 400);
    }

    const userId = validUserId(payload.userId) ? payload.userId : null;
    const friendId = validUserId(payload.friendId) ? payload.friendId : null;
    if (!userId || !friendId || userId === friendId) {
      return jsonResponse({ error: "Invalid friends." }, 400);
    }

    await ensureSocialSchema(env);
    const now = new Date().toISOString();

    const status = await getFriendshipStatus(env, userId, friendId);
    if (status !== "active") {
      return jsonResponse({ error: "Not friends." }, 403);
    }

    const body = String(payload.body || "")
      .trim()
      .slice(0, 1000);
    if (!body) {
      return jsonResponse({ error: "Message is empty." }, 400);
    }
    if (body.includes("<") || body.includes(">")) {
      return jsonResponse({ error: "Invalid message." }, 400);
    }

    const result = await env.DB.prepare("INSERT INTO messages (from_id, to_id, body, sent_at) VALUES (?, ?, ?, ?)")
      .bind(userId, friendId, body, now)
      .run();

    return jsonResponse({ status: "ok", id: result.meta.last_rowid });
  }

  if (url.pathname === "/live/feed" && request.method === "GET") {
    if (ipBlocked(env, clientIP)) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }

    const userId = validUserId(url.searchParams.get("userId")) ? url.searchParams.get("userId") : null;
    if (!userId) return jsonResponse({ error: "invalid userId" }, 400);

    await ensureSocialSchema(env);
    const friendIds = await getActiveFriendIds(env, userId);
    const placeholders = [userId, ...friendIds].map(() => "?").join(", ");
    const rows = await env.DB.prepare(
      `SELECT id, user_id, actor_id, type, data, created_at FROM feed
       WHERE user_id IN (${placeholders})
       ORDER BY id DESC LIMIT 50`
    )
      .bind(...[userId, ...friendIds])
      .all();

    const actors = new Set(rows.results.map((row) => row.actor_id));
    const profiles = new Map();
    if (actors.size > 0) {
      const actorList = [...actors];
      const profileRows = await env.DB.prepare(
        `SELECT user_id, username, avatar_index FROM live_users WHERE user_id IN (${actorList.map(() => "?").join(", ")})`
      )
        .bind(...actorList)
        .all();
      for (const p of profileRows.results) profiles.set(p.user_id, p);
    }

    const items = rows.results.map((row) => {
      let data = {};
      try {
        data = typeof row.data === "string" ? JSON.parse(row.data) : row.data || {};
      } catch {}
      const profile = profiles.get(row.actor_id) || {};
      return {
        id: row.id,
        type: row.type,
        userId: row.user_id,
        actor: {
          userId: row.actor_id,
          username: profile.username || "Anonymous",
          avatarIndex: typeof profile.avatar_index === "number" ? profile.avatar_index : -1
        },
        data,
        createdAt: row.created_at
      };
    });

    return jsonResponse({ feed: items });
  }

  if (url.pathname === "/api/achievements" && request.method === "POST") {
    if (ipBlocked(env, clientIP)) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }
    if (!themeRateLimit(env, clientIP, "achievements")) {
      return jsonResponse({ error: "Rate limited" }, 429);
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return jsonResponse({ error: "invalid json" }, 400);
    }

    const userId = validUserId(payload.userId) ? payload.userId : null;
    if (!userId) return jsonResponse({ error: "invalid userId" }, 400);

    await ensureSocialSchema(env);
    const now = new Date().toISOString();
    const list = Array.isArray(payload.achievements) ? payload.achievements : [];
    const statements = [];
    let attempted = 0;
    for (const item of list) {
      if (!item || typeof item.id !== "string") continue;
      const achievementId = item.id.trim().slice(0, 64);
      if (!/^[a-z0-9_.-]{1,64}$/.test(achievementId)) continue;
      const unlockedAt =
        typeof item.unlockedAt === "number" && Number.isFinite(item.unlockedAt)
          ? new Date(item.unlockedAt).toISOString()
          : now;
      statements.push(
        env.DB.prepare(
          "INSERT OR IGNORE INTO user_achievements (user_id, achievement_id, unlocked_at) VALUES (?, ?, ?)"
        ).bind(userId, achievementId, unlockedAt)
      );
      attempted++;
    }
    statements.push(profileUpsertStatement(env, userId, "", -1, now));
    if (statements.length > 0) await env.DB.batch(statements);
    const feedWrites = [];
    for (const item of list) {
      if (!item || typeof item.id !== "string") continue;
      const achievementId = item.id.trim().slice(0, 64);
      if (!/^[a-z0-9_.-]{1,64}$/.test(achievementId)) continue;
      feedWrites.push(insertFeedEvent(env, userId, userId, "achievement", { achievementId }));
    }
    if (feedWrites.length > 8) feedWrites.length = 8;
    await Promise.all(feedWrites);
    return jsonResponse({ status: "ok", added: attempted });
  }

  if (url.pathname === "/api/discover" && request.method === "GET") {
    if (ipBlocked(env, clientIP)) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }
    await ensureSocialSchema(env);
    const result = await withCache(Caches.social, "discover", () => fetchDiscoverData(env), 30 * 1000);
    return jsonResponse(result);
  }

  if (url.pathname === "/analytics" && request.method === "POST") {
    if (ipBlocked(env, clientIP)) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return jsonResponse({ error: "invalid json" }, 400);
    }

    const events = Array.isArray(payload) ? payload : [payload];
    const timestamp = new Date().toISOString();
    const dailyId = await deriveDailyId(env, clientIP);

    await ensureSocialSchema(env);
    const now = new Date().toISOString();

    const cleanEvents = events.filter((event) => {
      if (event.app == null || event.app === "") return true;
      const app = normalizeApp(event.app);
      if (app === "unknown") return true;
      return /^[a-z0-9_.-]{1,64}$/.test(app);
    });

    const inserts = cleanEvents.map((event) => {
      if (event.app) event.app = normalizeApp(event.app);
      const id = crypto.randomUUID();
      return env.DB.prepare("INSERT INTO analytics (id, daily_id, timestamp, data) VALUES (?, ?, ?, ?)").bind(
        id,
        dailyId,
        timestamp,
        JSON.stringify(event)
      );
    });

    const socialStatements = [];
    for (const event of cleanEvents) {
      if (!validUserId(event.userId)) continue;
      socialStatements.push(profileUpsertStatement(env, event.userId, "", -1, now));
      if (
        event.event === "usage" &&
        typeof event.durationMs === "number" &&
        event.durationMs > 0 &&
        typeof event.app === "string" &&
        event.app
      ) {
        const minutes = event.durationMs / 60000;
        socialStatements.push(
          env.DB.prepare(
            `INSERT INTO user_playtime (user_id, app, minutes, last_played) VALUES (?, ?, ?, ?)
               ON CONFLICT(user_id, app) DO UPDATE SET
                 minutes = minutes + excluded.minutes,
                 last_played = excluded.last_played`
          ).bind(event.userId, normalizeApp(event.app), minutes, now)
        );
      }
    }

    const allStatements = inserts.concat(socialStatements);
    if (allStatements.length === 0) return jsonResponse({ status: "ok", count: 0 });
    await env.DB.batch(allStatements);
    return jsonResponse({ status: "ok", count: cleanEvents.length });
  }

  if (url.pathname === "/admin/stats" && request.method === "GET") {
    const range = url.searchParams.get("range") || "30d";
    const result = await withCache(Caches.stats, range, () => fetchStatsData(env, range));
    return jsonResponse(result);
  }

  if (url.pathname === "/admin/list" && request.method === "GET") {
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const result = await env.DB.prepare(
      `SELECT id, daily_id, timestamp, data
         FROM analytics
         ORDER BY timestamp DESC
         LIMIT ? OFFSET ?`
    )
      .bind(limit, offset)
      .all();
    return jsonResponse({ results: result.results });
  }

  if (url.pathname === "/admin/downloads" && request.method === "GET") {
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const result = await env.DB.prepare(
      `SELECT id, daily_id, timestamp, data
         FROM analytics
         WHERE json_extract(data, '$.event') = 'download'
         ORDER BY timestamp DESC
         LIMIT ? OFFSET ?`
    )
      .bind(limit, offset)
      .all();
    return jsonResponse({ results: result.results });
  }

  if (url.pathname === "/admin/downloads/stats" && request.method === "GET") {
    const range = url.searchParams.get("range") || "30d";
    let days = range === "7d" ? 7 : range === "90d" ? 90 : range === "1y" ? 365 : 30;

    const total = await env.DB.prepare(
      `SELECT COUNT(*) AS count,
                COUNT(DISTINCT daily_id) AS unique_users
         FROM analytics
         WHERE json_extract(data, '$.event') = 'download'
           AND timestamp >= datetime('now', '-' || ? || ' days')`
    )
      .bind(days)
      .first();

    const topFiles = await env.DB.prepare(
      `SELECT json_extract(data, '$.fileName') AS fileName,
                json_extract(data, '$.app') AS app,
                COUNT(*) AS count
         FROM analytics
         WHERE json_extract(data, '$.event') = 'download'
           AND timestamp >= datetime('now', '-' || ? || ' days')
         GROUP BY fileName, app
         ORDER BY count DESC
         LIMIT 20`
    )
      .bind(days)
      .all();

    const byDay = await env.DB.prepare(
      `SELECT date(timestamp) AS day, COUNT(*) AS count
         FROM analytics
         WHERE json_extract(data, '$.event') = 'download'
           AND timestamp >= datetime('now', '-' || ? || ' days')
         GROUP BY day
         ORDER BY day DESC`
    )
      .bind(days)
      .all();

    return jsonResponse({
      total: total?.count || 0,
      unique_users: total?.unique_users || 0,
      top_files: topFiles.results || [],
      by_day: byDay.results || []
    });
  }

  if (url.pathname === "/admin/electron-usage" && request.method === "GET") {
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const result = await env.DB.prepare(
      `SELECT id, daily_id, timestamp, data
         FROM analytics
         WHERE json_extract(data, '$.event') = 'electron_usage'
         ORDER BY timestamp DESC
         LIMIT ? OFFSET ?`
    )
      .bind(limit, offset)
      .all();
    return jsonResponse({ results: result.results });
  }

  if (url.pathname === "/api/game-play-counts" && request.method === "GET") {
    const results = await withCache(Caches.games, null, () => fetchGameCounts(env));
    const playCounts = {};
    for (const row of results) {
      if (row.app) {
        playCounts[row.app] = row.count;
      }
    }
    return jsonResponse(playCounts);
  }

  if (url.pathname === "/admin/games" && request.method === "GET") {
    const results = await withCache(Caches.games, null, () => fetchGameCounts(env));
    return jsonResponse({ results });
  }

  if (url.pathname === "/admin/top-played-time-games" && request.method === "GET") {
    const results = await withCache(Caches.topTime, null, () => fetchTopTime(env));
    return jsonResponse({ results });
  }

  if (url.pathname === "/admin/sessions" && request.method === "GET") {
    const data = await withCache(Caches.sessions, null, () => buildAggregatedData(env));
    return jsonResponse(data.sessionsResponse);
  }

  if (url.pathname === "/admin/flows" && request.method === "GET") {
    const data = await withCache(Caches.sessions, null, () => buildAggregatedData(env));
    return jsonResponse(data.flowsResponse);
  }

  if (url.pathname === "/admin/entry-exit" && request.method === "GET") {
    const data = await withCache(Caches.sessions, null, () => buildAggregatedData(env));
    return jsonResponse(data.entryExitResponse);
  }

  if (url.pathname === "/admin/exploration" && request.method === "GET") {
    const data = await withCache(Caches.sessions, null, () => buildAggregatedData(env));
    return jsonResponse(data.explorationResponse);
  }

  if ((url.pathname === "/live" || url.pathname === "/admin/live") && request.method === "GET") {
    const result = await withCache(Caches.live, null, () => fetchLive(env), 15000);
    return jsonResponse(result);
  }

  if (url.pathname === "/admin/peak-concurrent" && request.method === "GET") {
    const range = url.searchParams.get("range") || "30d";
    const result = await withCache(Caches.peak, "peak-" + range, () => fetchPeakConcurrent(env, range));
    return jsonResponse(result);
  }

  if (url.pathname === "/admin/insights" && request.method === "GET") {
    const range = url.searchParams.get("range") || "30d";
    const result = await withCache(Caches.insights, "insights-" + range, () => fetchInsights(env, range));
    return jsonResponse(result);
  }

  if (url.pathname === "/admin/export" && request.method === "GET") {
    const headers = {
      ...corsHeaders("application/json"),
      "Content-Disposition": `attachment; filename="yukios-analytics-${new Date().toISOString().slice(0, 10)}.json"`
    };

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          controller.enqueue(
            encoder.encode('{"version":"1.0","exported_at":"' + new Date().toISOString() + '","total_records":')
          );

          const countResult = await env.DB.prepare(`SELECT COUNT(*) as count FROM analytics`).first();
          controller.enqueue(encoder.encode(countResult.count.toString()));
          controller.enqueue(encoder.encode(',"records":['));

          let first = true;
          let offset = 0;
          const BATCH_SIZE = 500;

          while (true) {
            const batch = await env.DB.prepare(
              `SELECT id, daily_id, timestamp, data FROM analytics ORDER BY timestamp ASC LIMIT ? OFFSET ?`
            )
              .bind(BATCH_SIZE, offset)
              .all();

            if (batch.results.length === 0) break;

            for (const row of batch.results) {
              if (!first) {
                controller.enqueue(encoder.encode(","));
              }
              first = false;
              controller.enqueue(encoder.encode(JSON.stringify(row)));
            }

            offset += BATCH_SIZE;
          }

          controller.enqueue(encoder.encode("]}"));
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      }
    });

    return new Response(stream, { headers });
  }

  if (url.pathname === "/admin/import" && request.method === "POST") {
    let payload;
    try {
      payload = await request.json();
    } catch {
      return jsonResponse({ error: "invalid json" }, 400);
    }

    if (!payload.records || !Array.isArray(payload.records)) {
      return jsonResponse({ error: "missing records array" }, 400);
    }

    const records = payload.records;
    const BATCH_SIZE = 100;
    let imported = 0;
    let skipped = 0;
    let errors = [];

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      const statements = [];

      for (const record of batch) {
        if (!record.id || !record.daily_id || !record.timestamp || !record.data) {
          skipped++;
          continue;
        }

        statements.push(
          env.DB.prepare(`INSERT OR REPLACE INTO analytics (id, daily_id, timestamp, data) VALUES (?, ?, ?, ?)`).bind(
            record.id,
            record.daily_id,
            record.timestamp,
            record.data
          )
        );
      }

      if (statements.length === 0) continue;
      try {
        await env.DB.batch(statements);
        imported += statements.length;
      } catch (e) {
        errors.push(`Batch ${i / BATCH_SIZE}: ${e.message}`);
      }
    }

    Caches.sessions = { data: null, time: 0, promise: null };
    Caches.games = { data: null, time: 0, promise: null };
    Caches.topTime = { data: null, time: 0, promise: null };
    Caches.stats = {};
    Caches.peak = {};
    Caches.insights = {};
    Caches.live = { data: null, time: 0, promise: null };

    return jsonResponse({
      success: true,
      imported,
      skipped,
      errors: errors.length > 0 ? errors : undefined
    });
  }

  if (url.pathname === "/api/themes" && request.method === "POST") {
    if (!themeRateLimit(env, clientIP, "upload")) {
      return jsonResponse({ error: "Rate limited" }, 429);
    }
    try {
      await ensureThemesSchema(env);
    } catch {
      return jsonResponse({ error: "db not ready" }, 500);
    }
    let payload;
    try {
      payload = await request.json();
    } catch {
      return jsonResponse({ error: "invalid json" }, 400);
    }
    if (!payload.contract) return jsonResponse({ error: "missing contract" }, 400);
    if (JSON.stringify(payload.contract).length > 12000) {
      return jsonResponse({ error: "Theme too large" }, 413);
    }
    const validated = sanitizeThemeContract(payload.contract);
    if (!validated.ok) return jsonResponse({ error: validated.errors.join("; ") }, 400);
    const authorId = await deriveDailyId(env, clientIP);
    const id = "theme_" + crypto.randomUUID().replace(/-/g, "").slice(0, 14);
    const now = new Date().toISOString();
    try {
      await env.DB.prepare(
        `INSERT INTO themes (id, author_id, name, description, author, icon, contract, colors, effects, config, upvotes, downvotes, score, installs, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,0,0,0,0,'approved',?,?)`
      )
        .bind(
          id,
          authorId,
          validated.contract.name,
          validated.contract.description,
          validated.contract.author,
          validated.contract.icon,
          JSON.stringify(validated.contract),
          JSON.stringify(validated.contract.colors),
          JSON.stringify(validated.contract.effects),
          JSON.stringify(validated.contract.config || {}),
          now,
          now
        )
        .run();
    } catch {
      return jsonResponse({ error: "db error" }, 500);
    }
    invalidateThemeListCache();
    return jsonResponse(
      {
        id,
        name: validated.contract.name,
        description: validated.contract.description,
        author: validated.contract.author,
        icon: validated.contract.icon,
        colors: validated.contract.colors,
        effects: validated.contract.effects,
        config: validated.contract.config || {},
        upvotes: 0,
        downvotes: 0,
        score: 0,
        installs: 0,
        created_at: now
      },
      201
    );
  }

  if (url.pathname === "/api/themes" && request.method === "GET") {
    try {
      await ensureThemesSchema(env);
    } catch {
      return jsonResponse({ error: "db not ready" }, 500);
    }
    const rawPage = parseInt(url.searchParams.get("page") || "1");
    const page = Number.isFinite(rawPage) && rawPage >= 1 ? rawPage : 1;
    const rawPerPage = parseInt(url.searchParams.get("per_page") || "12");
    let perPage = Number.isFinite(rawPerPage) ? rawPerPage : 12;
    if (perPage < 1) perPage = 1;
    if (perPage > 48) perPage = 48;
    let sort = url.searchParams.get("sort") || "top";
    if (!["top", "newest", "installs"].includes(sort)) sort = "top";
    const search = (url.searchParams.get("search") || "").slice(0, 100);
    const author = (url.searchParams.get("author") || "").slice(0, 32);
    const result = await withCache(
      Caches.themes,
      "list|" + page + "|" + perPage + "|" + sort + "|" + search + "|" + author,
      async () => {
        const conditions = ["status = 'approved'"];
        const params = [];
        if (search) {
          conditions.push("(name LIKE ? OR description LIKE ? OR author LIKE ?)");
          const pattern = "%" + search + "%";
          params.push(pattern, pattern, pattern);
        }
        if (author) {
          conditions.push("author = ?");
          params.push(author);
        }
        const where = conditions.join(" AND ");
        const totalRow = await env.DB.prepare(`SELECT COUNT(*) AS count FROM themes WHERE ${where}`)
          .bind(...params)
          .first();
        let orderBy = "score DESC, installs DESC";
        if (sort === "newest") orderBy = "created_at DESC";
        if (sort === "installs") orderBy = "installs DESC";
        const offset = (page - 1) * perPage;
        const rows = await env.DB.prepare(
          `SELECT id, name, description, author, icon, colors, effects, config, upvotes, downvotes, score, installs, created_at FROM themes WHERE ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`
        )
          .bind(...params, perPage, offset)
          .all();
        const themes = rows.results.map((row) => {
          let colors = {};
          let effects = {};
          let config = {};
          try {
            colors = typeof row.colors === "string" ? JSON.parse(row.colors) : row.colors || {};
          } catch {}
          try {
            effects = typeof row.effects === "string" ? JSON.parse(row.effects) : row.effects || {};
          } catch {}
          try {
            config = typeof row.config === "string" ? JSON.parse(row.config) : row.config || {};
          } catch {}
          return { ...row, colors, effects, config };
        });
        const total = totalRow?.count || 0;
        const pages = Math.max(1, Math.ceil(total / perPage));
        return { themes, total, page, per_page: perPage, pages };
      },
      30000
    );
    return jsonResponse(result);
  }

  if (url.pathname.startsWith("/api/themes/") && request.method === "GET") {
    try {
      await ensureThemesSchema(env);
    } catch {
      return jsonResponse({ error: "db not ready" }, 500);
    }
    const id = url.pathname.split("/")[3];
    const row = await env.DB.prepare(
      `SELECT id, name, description, author, icon, colors, effects, config, upvotes, downvotes, score, installs, created_at FROM themes WHERE id = ? AND status = 'approved'`
    )
      .bind(id)
      .first();
    if (!row) return jsonResponse({ error: "Theme not found" }, 404);
    const viewerId = await deriveDailyId(env, clientIP);
    const ratingRow = await env.DB.prepare(`SELECT vote FROM theme_ratings WHERE theme_id = ? AND daily_id = ?`)
      .bind(id, viewerId)
      .first();
    let colors = {};
    let effects = {};
    let config = {};
    try {
      colors = typeof row.colors === "string" ? JSON.parse(row.colors) : row.colors || {};
    } catch {}
    try {
      effects = typeof row.effects === "string" ? JSON.parse(row.effects) : row.effects || {};
    } catch {}
    try {
      config = typeof row.config === "string" ? JSON.parse(row.config) : row.config || {};
    } catch {}
    return jsonResponse({ theme: { ...row, colors, effects, config }, myVote: ratingRow?.vote ?? null });
  }

  if (url.pathname.startsWith("/api/themes/") && url.pathname.endsWith("/rate") && request.method === "POST") {
    if (!themeRateLimit(env, clientIP, "rate")) {
      return jsonResponse({ error: "Rate limited" }, 429);
    }
    try {
      await ensureThemesSchema(env);
    } catch {
      return jsonResponse({ error: "db not ready" }, 500);
    }
    const id = url.pathname.split("/")[3];
    let payload;
    try {
      payload = await request.json();
    } catch {
      return jsonResponse({ error: "invalid json" }, 400);
    }
    const vote = payload.vote;
    if (vote !== 1 && vote !== -1 && vote !== 0) {
      return jsonResponse({ error: "invalid vote" }, 400);
    }
    const dailyId = await deriveDailyId(env, clientIP);
    const now = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO theme_ratings (theme_id, daily_id, vote, updated_at) VALUES (?,?,?,?) ON CONFLICT (theme_id, daily_id) DO UPDATE SET vote = excluded.vote, updated_at = excluded.updated_at`
    )
      .bind(id, dailyId, vote, now)
      .run();
    await env.DB.prepare(
      `UPDATE themes SET upvotes = (SELECT COUNT(*) FROM theme_ratings WHERE theme_id = ? AND vote = 1), downvotes = (SELECT COUNT(*) FROM theme_ratings WHERE theme_id = ? AND vote = -1), score = (SELECT COALESCE(SUM(vote), 0) FROM theme_ratings WHERE theme_id = ?), updated_at = ? WHERE id = ?`
    )
      .bind(id, id, id, now, id)
      .run();
    const updated = await env.DB.prepare(`SELECT upvotes, downvotes, score FROM themes WHERE id = ?`).bind(id).first();
    if (!updated) return jsonResponse({ error: "Theme not found" }, 404);
    return jsonResponse({
      id,
      upvotes: updated.upvotes,
      downvotes: updated.downvotes,
      score: updated.score,
      myVote: vote
    });
  }

  if (url.pathname.startsWith("/api/themes/") && url.pathname.endsWith("/install") && request.method === "POST") {
    try {
      await ensureThemesSchema(env);
    } catch {
      return jsonResponse({ error: "db not ready" }, 500);
    }
    const id = url.pathname.split("/")[3];
    const dailyId = await deriveDailyId(env, clientIP);
    const now = new Date().toISOString();
    await env.DB.prepare(`INSERT OR IGNORE INTO theme_installs (theme_id, daily_id, created_at) VALUES (?, ?, ?)`)
      .bind(id, dailyId, now)
      .run();
    await env.DB.prepare(
      `UPDATE themes SET installs = (SELECT COUNT(*) FROM theme_installs WHERE theme_id = ?) WHERE id = ?`
    )
      .bind(id, id)
      .run();
    const updated = await env.DB.prepare(`SELECT installs FROM themes WHERE id = ?`).bind(id).first();
    if (!updated) return jsonResponse({ error: "Theme not found" }, 404);
    return jsonResponse({ installs: updated.installs });
  }

  if (url.pathname.startsWith("/api/themes/") && url.pathname.endsWith("/report") && request.method === "POST") {
    if (!themeRateLimit(env, clientIP, "report")) {
      return jsonResponse({ error: "Rate limited" }, 429);
    }
    try {
      await ensureThemesSchema(env);
    } catch {
      return jsonResponse({ error: "db not ready" }, 500);
    }
    const id = url.pathname.split("/")[3];
    let payload;
    try {
      payload = await request.json();
    } catch {
      return jsonResponse({ error: "invalid json" }, 400);
    }
    const reason = typeof payload.reason === "string" ? payload.reason.slice(0, 200) : "No reason provided";
    const theme = await env.DB.prepare(`SELECT name FROM themes WHERE id = ?`).bind(id).first();
    if (!theme) return jsonResponse({ error: "Theme not found" }, 404);
    await sendReportEmbed(env, {
      title: "🚨 Theme Reported",
      color: 15158332,
      fields: [
        { name: "Theme", value: theme.name, inline: true },
        { name: "Theme ID", value: id, inline: true },
        { name: "Reason", value: reason, inline: false },
        { name: "Reporter ID", value: (await deriveDailyId(env, clientIP)).slice(0, 12), inline: false },
        { name: "Timestamp", value: new Date().toISOString(), inline: false }
      ]
    });
    return jsonResponse({ success: true });
  }

  if (url.pathname.startsWith("/api/themes/") && url.pathname.endsWith("/delete") && request.method === "POST") {
    if (!themeRateLimit(env, clientIP, "delete")) {
      return jsonResponse({ error: "Rate limited" }, 429);
    }
    try {
      await ensureThemesSchema(env);
    } catch {
      return jsonResponse({ error: "db not ready" }, 500);
    }
    const id = url.pathname.split("/")[3];
    const authorId = await deriveDailyId(env, clientIP);
    const now = new Date().toISOString();
    const result = await env.DB.prepare(
      `UPDATE themes SET status = 'deleted', updated_at = ? WHERE id = ? AND author_id = ?`
    )
      .bind(now, id, authorId)
      .run();
    if (result.meta.changes === 0) return jsonResponse({ error: "Theme not found or not yours" }, 404);
    return jsonResponse({ success: true });
  }

  if (url.pathname === "/admin/themes" && request.method === "GET") {
    try {
      await ensureThemesSchema(env);
    } catch {
      return jsonResponse({ error: "db not ready" }, 500);
    }
    const status = url.searchParams.get("status") || "all";
    const safeStatus = ["all", "approved", "flagged", "deleted"].includes(status) ? status : "all";
    const rawPage = parseInt(url.searchParams.get("page") || "1");
    const page = Number.isFinite(rawPage) && rawPage >= 1 ? rawPage : 1;
    const rawPerPage = parseInt(url.searchParams.get("per_page") || "25");
    let perPage = Number.isFinite(rawPerPage) ? rawPerPage : 25;
    if (perPage < 1) perPage = 1;
    if (perPage > 100) perPage = 100;
    const result = await withCache(
      Caches.adminThemes,
      "list|" + safeStatus + "|" + page + "|" + perPage,
      async () => {
        const where = safeStatus === "all" ? "" : "WHERE status = '" + safeStatus + "'";
        const totalRow = await env.DB.prepare(`SELECT COUNT(*) AS count FROM themes ${where}`).first();
        const offset = (page - 1) * perPage;
        const rows = await env.DB.prepare(
          `SELECT id, author_id, name, author, contract, status, score, installs, created_at FROM themes ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
        )
          .bind(perPage, offset)
          .all();
        const total = totalRow?.count || 0;
        const pages = Math.max(1, Math.ceil(total / perPage));
        return { themes: rows.results, total, page, per_page: perPage, pages };
      },
      15000
    );
    return jsonResponse(result);
  }

  if (url.pathname.startsWith("/admin/themes/") && url.pathname.endsWith("/approve") && request.method === "POST") {
    try {
      await ensureThemesSchema(env);
    } catch {
      return jsonResponse({ error: "db not ready" }, 500);
    }
    const id = url.pathname.split("/")[3];
    await env.DB.prepare(`UPDATE themes SET status = 'approved', updated_at = ? WHERE id = ?`)
      .bind(new Date().toISOString(), id)
      .run();
    return jsonResponse({ success: true });
  }

  if (url.pathname.startsWith("/admin/themes/") && url.pathname.endsWith("/flag") && request.method === "POST") {
    try {
      await ensureThemesSchema(env);
    } catch {
      return jsonResponse({ error: "db not ready" }, 500);
    }
    const id = url.pathname.split("/")[3];
    await env.DB.prepare(`UPDATE themes SET status = 'flagged', updated_at = ? WHERE id = ?`)
      .bind(new Date().toISOString(), id)
      .run();
    return jsonResponse({ success: true });
  }

  if (url.pathname.startsWith("/admin/themes/") && url.pathname.endsWith("/delete") && request.method === "POST") {
    try {
      await ensureThemesSchema(env);
    } catch {
      return jsonResponse({ error: "db not ready" }, 500);
    }
    const id = url.pathname.split("/")[3];
    await env.DB.prepare(`DELETE FROM theme_ratings WHERE theme_id = ?`).bind(id).run();
    await env.DB.prepare(`DELETE FROM theme_installs WHERE theme_id = ?`).bind(id).run();
    await env.DB.prepare(`DELETE FROM themes WHERE id = ?`).bind(id).run();
    return jsonResponse({ success: true });
  }

  return new Response("Not Found", { status: 404, headers: corsHeaders("text/plain") });
}

function withCors(response) {
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "*");
  headers.set("Access-Control-Max-Age", "86400");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(request, env) {
    try {
      return withCors(await handleYukiRequest(request, env));
    } catch (error) {
      return withCors(new Response("Internal Error", { status: 500, headers: corsHeaders("text/plain") }));
    }
  }
};

function corsHeaders(type) {
  const base = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Max-Age": "86400"
  };
  if (type === "text/html") return { ...base, "Content-Type": "text/html" };
  if (type === "text/plain") return { ...base, "Content-Type": "text/plain" };
  return { ...base, "Content-Type": "application/json" };
}

function adminHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>YukiOS Analytics</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
<style>
*{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:oklch(10% 0.02 220);
  --surface:oklch(15% 0.025 220);
  --surface2:oklch(20% 0.03 220);
  --border:oklch(22% 0.03 220 / 0.7);
  --border2:oklch(28% 0.03 220 / 0.6);
  --accent:oklch(55% 0.14 220);
  --accent2:oklch(62% 0.14 220);
  --accent3:oklch(72% 0.12 220);
  --green:#22c55e;
  --red:#ef4444;
  --yellow:#f59e0b;
  --text:oklch(95% 0.01 220);
  --muted:oklch(48% 0.01 220);
  --muted2:oklch(62% 0.01 220);
  --glass:oklch(100% 0 0 / 0.04);
  --glass-border:oklch(100% 0 0 / 0.1);
  --shadow:0 24px 64px oklch(0% 0 0 / 0.65);
}
body{font-family:'Segoe UI',system-ui,Arial,sans-serif;background:var(--bg);color:var(--text);min-height:100vh;overflow-x:hidden}
a{color:inherit;text-decoration:none}
*::-webkit-scrollbar{width:8px;height:8px}
*::-webkit-scrollbar-track{background:transparent}
*::-webkit-scrollbar-thumb{background:oklch(100% 0 0 / 0.12);border-radius:4px}
*::-webkit-scrollbar-thumb:hover{background:oklch(100% 0 0 / 0.18)}

.app-shell{display:flex;min-height:100vh}

.sidebar{width:220px;min-height:100vh;background:var(--surface);border-right:1px solid var(--border);display:flex;flex-direction:column;position:fixed;top:0;left:0;z-index:100;box-shadow:4px 0 24px oklch(0% 0 0 / 0.4)}
.sidebar-logo{padding:24px 20px 18px;border-bottom:1px solid var(--border)}
.sidebar-logo .logo-text{font-size:18px;font-weight:800;background:linear-gradient(135deg,var(--accent3),var(--accent));-webkit-background-clip:text;-webkit-text-fill-color:transparent;letter-spacing:.5px}
.sidebar-logo .logo-sub{font-size:10px;color:var(--muted);margin-top:3px;letter-spacing:.5px;text-transform:uppercase}
.sidebar-nav{flex:1;padding:16px 0}
.nav-section-label{font-size:9px;text-transform:uppercase;letter-spacing:1px;color:var(--muted);padding:12px 20px 6px;font-weight:600}
.nav-item{display:flex;align-items:center;gap:12px;padding:10px 20px;font-size:13px;color:var(--muted2);cursor:pointer;transition:all .15s;border-left:2px solid transparent;user-select:none}
.nav-item i{width:16px;text-align:center;font-size:14px}
.nav-item:hover{color:var(--text);background:var(--surface2)}
.nav-item.active{color:var(--accent3);background:oklch(55% 0.14 220 / 0.08);border-left-color:var(--accent)}
.sidebar-footer{padding:16px 20px;border-top:1px solid var(--border)}
.live-badge{display:flex;align-items:center;gap:8px;font-size:11px;color:var(--green);font-weight:600}
.live-dot{width:7px;height:7px;border-radius:50%;background:var(--green);animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1;box-shadow:0 0 0 0 rgba(34,197,94,.4)}50%{opacity:.7;box-shadow:0 0 0 6px rgba(34,197,94,0)}}

.main{margin-left:220px;flex:1;display:flex;flex-direction:column;min-height:100vh}
.topbar{display:flex;align-items:center;justify-content:space-between;padding:16px 28px;background:var(--surface);border-bottom:1px solid var(--border);position:sticky;top:0;z-index:50;box-shadow:0 4px 24px oklch(0% 0 0 / 0.3);backdrop-filter:blur(20px)}
.topbar-left{display:flex;align-items:center;gap:14px}
.topbar-title{font-size:18px;font-weight:700;color:var(--text)}
.topbar-right{display:flex;align-items:center;gap:10px}
.auth-input{padding:8px 14px;border-radius:8px;border:1px solid var(--border2);background:var(--surface2);color:var(--text);font-size:13px;width:200px;outline:none;transition:border-color .15s;-webkit-appearance:none;appearance:none}
.auth-input:focus{border-color:var(--accent)}
.range-select{padding:8px 12px;border-radius:8px;border:1px solid var(--border2);background:var(--surface2);color:var(--text);font-size:13px;outline:none;cursor:pointer;transition:border-color .15s;-webkit-appearance:none;appearance:none}
.range-select:focus{border-color:var(--accent)}
.btn-load{padding:8px 20px;border-radius:8px;border:none;background:linear-gradient(135deg,var(--accent),var(--accent2));color:#fff;font-weight:700;font-size:13px;cursor:pointer;transition:opacity .15s,transform .1s;display:flex;align-items:center;gap:8px;box-shadow:0 4px 16px oklch(55% 0.14 220 / 0.35)}
.btn-load:hover{opacity:.88;transform:translateY(-1px)}
.btn-load:active{transform:translateY(0)}
.last-refresh{font-size:11px;color:var(--muted);margin-left:4px;transition:color .2s}

.content{padding:28px;flex:1}
.panel{display:none}
.panel.active{display:block}

.kpi-row{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:16px;margin-bottom:28px}
.kpi{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:18px 20px;position:relative;overflow:hidden;transition:border-color .2s,transform .15s,box-shadow .2s;box-shadow:0 8px 32px oklch(0% 0 0 / 0.3)}
.kpi:hover{border-color:var(--border2);transform:translateY(-2px);box-shadow:0 16px 48px oklch(0% 0 0 / 0.4)}
.kpi::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,var(--accent),var(--accent2))}
.kpi-icon{width:36px;height:36px;border-radius:10px;background:oklch(55% 0.14 220 / 0.12);display:flex;align-items:center;justify-content:center;color:var(--accent2);font-size:16px;margin-bottom:12px}
.kpi-val{font-size:28px;font-weight:800;color:var(--text);line-height:1}
.kpi-label{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-top:6px;font-weight:600}
.kpi-sub{font-size:11px;color:var(--muted);margin-top:4px}

.section-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px}
.section-title{font-size:15px;font-weight:700;color:var(--accent3);display:flex;align-items:center;gap:10px}
.section-title i{font-size:16px;color:var(--accent)}

.sort-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.sort-btn{padding:5px 12px;border-radius:6px;border:1px solid var(--border2);background:var(--surface2);color:var(--muted2);font-size:11px;cursor:pointer;transition:all .15s;font-weight:600;display:flex;align-items:center;gap:5px}
.sort-btn:hover{border-color:var(--accent);color:var(--accent3)}
.sort-btn.active{background:oklch(55% 0.14 220 / 0.14);border-color:var(--accent);color:var(--accent3)}
.filter-input{padding:5px 12px;border-radius:6px;border:1px solid var(--border2);background:var(--surface2);color:var(--text);font-size:11px;outline:none;width:160px;transition:border-color .15s;-webkit-appearance:none;appearance:none}
.filter-input:focus{border-color:var(--accent)}

.chart-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px;margin-bottom:28px}
.chart-card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:20px;box-shadow:0 8px 32px oklch(0% 0 0 / 0.25)}
.chart-card-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);margin-bottom:16px;display:flex;align-items:center;gap:8px}
.chart-card-title i{color:var(--accent)}

.canvas-wrap{height:160px;position:relative}
canvas{width:100%!important;height:100%!important}

.days-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:14px}
.day-card{background:var(--surface);border:1px solid var(--border);border-radius:14px;overflow:hidden;transition:border-color .2s,box-shadow .2s}
.day-card:hover{border-color:var(--border2);box-shadow:0 8px 32px oklch(0% 0 0 / 0.35)}
.day-card-header{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;cursor:pointer;user-select:none}
.day-card-date{font-size:14px;font-weight:700;color:var(--text)}
.day-card-quick{display:flex;gap:16px}
.day-card-quick-stat{text-align:center}
.day-card-quick-stat .qv{font-size:16px;font-weight:700;color:var(--accent3)}
.day-card-quick-stat .ql{font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.4px}
.day-expand-icon{color:var(--muted);font-size:12px;transition:transform .2s}
.day-card.open .day-expand-icon{transform:rotate(180deg)}
.day-card-body{display:none;padding:0 16px 16px;border-top:1px solid var(--border)}
.day-card.open .day-card-body{display:block}
.day-stats-row{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:12px 0}
.day-stat-box{background:var(--surface2);border-radius:8px;padding:10px;text-align:center}
.day-stat-box .dsv{font-size:18px;font-weight:700;color:var(--text)}
.day-stat-box .dsl{font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;margin-top:3px}
.games-section-label{font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);font-weight:600;margin-bottom:8px;margin-top:4px}
.game-item{display:flex;align-items:center;gap:10px;margin-top:6px}
.game-rank{font-size:10px;font-weight:700;color:var(--muted);width:16px;text-align:right}
.game-name{font-size:12px;color:var(--text);font-weight:600;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.game-count{font-size:11px;color:var(--muted2);min-width:28px;text-align:right;font-weight:700}
.game-bar-wrap{width:80px;height:4px;background:var(--border);border-radius:2px;overflow:hidden}
.game-bar-fill{height:100%;background:linear-gradient(90deg,var(--accent),var(--accent2));border-radius:2px;transition:width .3s}

.cards-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:14px}
.stat-card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:18px 20px;transition:border-color .2s,transform .15s,box-shadow .2s;box-shadow:0 4px 20px oklch(0% 0 0 / 0.2)}
.stat-card:hover{border-color:var(--border2);transform:translateY(-2px);box-shadow:0 12px 40px oklch(0% 0 0 / 0.35)}
.stat-card .sc-label{font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);font-weight:600;margin-bottom:8px}
.stat-card .sc-val{font-size:26px;font-weight:800;color:var(--accent3);line-height:1}
.stat-card .sc-sub{font-size:11px;color:var(--muted);margin-top:5px}

.time-list{display:flex;flex-direction:column;gap:10px}
.time-item{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px 16px;display:flex;align-items:center;gap:14px;transition:border-color .2s,box-shadow .2s}
.time-item:hover{border-color:var(--border2);box-shadow:0 6px 24px oklch(0% 0 0 / 0.3)}
.time-rank-badge{width:32px;height:32px;border-radius:8px;background:oklch(55% 0.14 220 / 0.12);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:var(--accent2);flex-shrink:0}
.time-info{flex:1;min-width:0}
.time-app{font-size:13px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.time-bar-track{height:4px;background:var(--border);border-radius:2px;margin-top:5px;overflow:hidden}
.time-bar-fill{height:100%;background:linear-gradient(90deg,var(--accent),var(--accent2));border-radius:2px;transition:width .4s}
.time-stats{display:flex;flex-direction:column;align-items:flex-end;gap:2px;flex-shrink:0}
.time-duration{font-size:14px;font-weight:700;color:var(--text)}
.time-sessions{font-size:10px;color:var(--muted)}

.flow-wrap{background:var(--surface);border:1px solid var(--border);border-radius:14px;overflow:hidden;box-shadow:0 8px 32px oklch(0% 0 0 / 0.25)}
.flow-table{width:100%;border-collapse:collapse;font-size:13px}
.flow-table th{padding:11px 16px;color:var(--muted);font-weight:700;font-size:10px;text-transform:uppercase;letter-spacing:.5px;background:var(--surface2);text-align:left;border-bottom:1px solid var(--border)}
.flow-table td{padding:11px 16px;border-bottom:1px solid var(--border);vertical-align:middle}
.flow-table tr:last-child td{border-bottom:none}
.flow-table tr:hover td{background:var(--surface2)}
.flow-from{color:var(--accent2);font-weight:700}
.flow-to{color:var(--accent3)}
.flow-arrow{color:var(--muted);font-size:11px;padding:0 4px}
.flow-bar-cell{display:flex;align-items:center;gap:8px}
.flow-count{font-weight:700;color:var(--text);min-width:32px}
.flow-bar{height:6px;background:var(--border);border-radius:3px;flex:1;overflow:hidden;max-width:120px}
.flow-bar-inner{height:100%;background:linear-gradient(90deg,var(--accent),var(--accent2));border-radius:3px}

.entry-exit-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
@media(max-width:700px){.entry-exit-grid{grid-template-columns:1fr}}
.entry-exit-card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:18px 20px;box-shadow:0 6px 24px oklch(0% 0 0 / 0.2)}
.entry-exit-card-title{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:14px;display:flex;align-items:center;gap:8px}
.entry-exit-card-title.entry{color:var(--green)}
.entry-exit-card-title.exit{color:var(--red)}
.ee-item{display:flex;align-items:center;gap:10px;margin-top:10px}
.ee-name{font-size:12px;color:var(--text);font-weight:600;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ee-count{font-size:11px;color:var(--muted2);font-weight:700;min-width:28px;text-align:right}
.ee-bar-wrap{width:72px;height:4px;background:var(--border);border-radius:2px;overflow:hidden}
.ee-bar-entry{height:100%;background:var(--green);border-radius:2px}
.ee-bar-exit{height:100%;background:var(--red);border-radius:2px}

.explore-grid{display:grid;grid-template-columns:1fr 2fr 2fr;gap:14px}
@media(max-width:900px){.explore-grid{grid-template-columns:1fr}}
.explore-card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:18px 20px;box-shadow:0 6px 24px oklch(0% 0 0 / 0.2)}
.explore-card-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);margin-bottom:12px}
.explore-big{font-size:40px;font-weight:800;color:var(--accent3)}
.explore-sub{font-size:11px;color:var(--muted);margin-top:6px}
.user-row{display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--border);font-size:12px}
.user-row:last-child{border-bottom:none}
.user-id{color:var(--accent2);font-family:monospace;font-weight:600}
.user-val{color:var(--text);font-weight:700}

.live-strip{display:grid;grid-template-columns:auto auto 1fr;gap:24px;align-items:center;background:rgba(34,197,94,.04);border:1px solid rgba(34,197,94,.15);border-radius:14px;padding:16px 22px;margin-bottom:28px}
.live-strip-stat .lsv{font-size:32px;font-weight:800;color:var(--text)}
.live-strip-stat .lsl{font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);font-weight:600;margin-top:2px}
.live-divider{width:1px;height:40px;background:var(--border)}
.live-apps-label{font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);margin-bottom:6px;font-weight:600}
.live-app-chips{display:flex;flex-wrap:wrap;gap:6px}
.live-chip{padding:4px 10px;border-radius:20px;background:oklch(55% 0.14 220 / 0.12);border:1px solid oklch(55% 0.14 220 / 0.25);font-size:11px;color:var(--accent3);font-weight:600}

.empty-state{padding:40px;text-align:center;color:var(--muted);font-size:13px}
.empty-state i{font-size:28px;margin-bottom:10px;display:block;opacity:.4}
.error-msg{color:var(--red);font-size:13px;padding:12px}

@media(max-width:768px){
  .sidebar{transform:translateX(-100%)}
  .main{margin-left:0}
  .kpi-row{grid-template-columns:1fr 1fr}
  .day-stats-row{grid-template-columns:1fr 1fr}
  .explore-grid{grid-template-columns:1fr}
}
</style>
</head>
<body>
<div class="app-shell">
  <aside class="sidebar">
    <div class="sidebar-logo">
      <div class="logo-text">YukiOS</div>
      <div class="logo-sub">Analytics Dashboard</div>
    </div>
    <nav class="sidebar-nav">
      <div class="nav-section-label">Overview</div>
      <div class="nav-item active" data-panel="dashboard" onclick="switchPanel('dashboard',this)">
        <i class="fa-solid fa-gauge-high"></i>Dashboard
      </div>
      <div class="nav-item" data-panel="daily" onclick="switchPanel('daily',this)">
        <i class="fa-solid fa-calendar-days"></i>Daily Stats
      </div>
      <div class="nav-section-label">Deep Dive</div>
      <div class="nav-item" data-panel="playtime" onclick="switchPanel('playtime',this)">
        <i class="fa-solid fa-clock"></i>Play Time
      </div>
      <div class="nav-item" data-panel="sessions" onclick="switchPanel('sessions',this)">
        <i class="fa-solid fa-layer-group"></i>Sessions
      </div>
      <div class="nav-item" data-panel="flows" onclick="switchPanel('flows',this)">
        <i class="fa-solid fa-route"></i>Flows
      </div>
      <div class="nav-section-label">Behavior</div>
      <div class="nav-item" data-panel="entryexit" onclick="switchPanel('entryexit',this)">
        <i class="fa-solid fa-door-open"></i>Entry / Exit
      </div>
      <div class="nav-item" data-panel="exploration" onclick="switchPanel('exploration',this)">
        <i class="fa-solid fa-compass"></i>Exploration
      </div>
      <div class="nav-section-label">Analytics</div>
      <div class="nav-item" data-panel="insights" onclick="switchPanel('insights',this)">
        <i class="fa-solid fa-chart-pie"></i>Insights
      </div>
      <div class="nav-section-label">Admin</div>
      <div class="nav-item" data-panel="data" onclick="switchPanel('data',this)">
        <i class="fa-solid fa-database"></i>Data Management
      </div>
      <div class="nav-item" data-panel="downloadstelemetry" onclick="switchPanel('downloadstelemetry',this);loadDownloadsTelemetry()">
        <i class="fa-solid fa-download"></i>Downloads & Telemetry
      </div>
      <div class="nav-item" data-panel="themes" onclick="switchPanel('themes',this);loadAdminThemes()">
        <i class="fa-solid fa-palette"></i>Themes
      </div>

    </nav>
    <div class="sidebar-footer">
      <div class="live-badge"><span class="live-dot"></span>Live monitoring</div>
      <div id="lastRefresh" style="font-size:10px;color:var(--muted);margin-top:6px"></div>
    </div>
  </aside>

  <div class="main">
    <div class="topbar">
      <div class="topbar-left">
        <div class="topbar-title" id="panelTitle">Dashboard</div>
      </div>
      <div class="topbar-right">
        <input class="auth-input" id="token" type="password" placeholder="Auth token...">
        <select class="range-select" id="range">
          <option value="7d">7 days</option>
          <option value="30d" selected>30 days</option>
          <option value="90d">90 days</option>
          <option value="1y">1 year</option>
        </select>
        <button class="btn-load" onclick="loadAll()"><i class="fa-solid fa-bolt"></i>Load</button>
      </div>
    </div>

    <div class="content">

      <div id="panel-dashboard" class="panel active">
        <div id="liveStrip" style="display:none">
          <div class="live-strip">
            <div class="live-strip-stat">
              <div class="lsv" id="liveUsers">-</div>
              <div class="lsl"><i class="fa-solid fa-users" style="margin-right:4px"></i>Active Users</div>
            </div>
            <div class="live-divider"></div>
            <div class="live-strip-stat">
              <div class="lsv" id="liveSessions">-</div>
              <div class="lsl"><i class="fa-solid fa-layer-group" style="margin-right:4px"></i>Active Sessions</div>
            </div>
            <div>
              <div class="live-apps-label"><i class="fa-solid fa-fire" style="margin-right:4px"></i>Trending Now</div>
              <div class="live-app-chips" id="liveApps"></div>
            </div>
          </div>
        </div>

        <div class="kpi-row" id="kpiRow">
          <div class="kpi">
            <div class="kpi-icon"><i class="fa-solid fa-arrow-trend-up"></i></div>
            <div class="kpi-val" id="kTotal">-</div>
            <div class="kpi-label">Total Requests</div>
          </div>
          <div class="kpi">
            <div class="kpi-icon"><i class="fa-solid fa-users"></i></div>
            <div class="kpi-val" id="kUsers">-</div>
            <div class="kpi-label">Unique Users</div>
          </div>
          <div class="kpi">
            <div class="kpi-icon"><i class="fa-solid fa-layer-group"></i></div>
            <div class="kpi-val" id="kSessions">-</div>
            <div class="kpi-label">Total Sessions</div>
          </div>
          <div class="kpi">
            <div class="kpi-icon"><i class="fa-solid fa-clock"></i></div>
            <div class="kpi-val" id="kAvgDur">-</div>
            <div class="kpi-label">Avg Session</div>
          </div>
          <div class="kpi">
            <div class="kpi-icon"><i class="fa-solid fa-bolt"></i></div>
            <div class="kpi-val" id="kPower">-</div>
            <div class="kpi-label">Power Users</div>
          </div>
          <div class="kpi">
            <div class="kpi-icon"><i class="fa-solid fa-person-running"></i></div>
            <div class="kpi-val" id="kBounce">-</div>
            <div class="kpi-label">Bounce Sessions</div>
          </div>
          <div class="kpi">
            <div class="kpi-icon"><i class="fa-solid fa-people-group"></i></div>
            <div class="kpi-val" id="kPeak">-</div>
            <div class="kpi-label">Peak Concurrent</div>
            <div class="kpi-sub" id="kPeakTime"></div>
          </div>
        </div>

        <div class="chart-grid">
          <div class="chart-card">
            <div class="chart-card-title"><i class="fa-solid fa-chart-bar"></i>Requests / Day</div>
            <div class="canvas-wrap"><canvas id="chartReq"></canvas></div>
          </div>
          <div class="chart-card">
            <div class="chart-card-title"><i class="fa-solid fa-chart-line"></i>Sessions / Day</div>
            <div class="canvas-wrap"><canvas id="chartSess"></canvas></div>
          </div>
          <div class="chart-card">
            <div class="chart-card-title"><i class="fa-solid fa-people-group"></i>Peak Concurrent / Day</div>
            <div class="canvas-wrap"><canvas id="chartPeak"></canvas></div>
          </div>
        </div>
      </div>

      <div id="panel-daily" class="panel">
        <div class="section-header">
          <div class="section-title"><i class="fa-solid fa-calendar-days"></i>Daily Breakdown</div>
          <div class="sort-bar">
            <span style="font-size:11px;color:var(--muted);font-weight:600">Sort:</span>
            <button class="sort-btn active" id="sortDate" onclick="sortDays('date')"><i class="fa-solid fa-calendar"></i>Date</button>
            <button class="sort-btn" id="sortReq" onclick="sortDays('requests')"><i class="fa-solid fa-arrow-up"></i>Requests</button>
            <button class="sort-btn" id="sortUsers" onclick="sortDays('users')"><i class="fa-solid fa-users"></i>Users</button>
            <input class="filter-input" id="dayFilter" placeholder="Filter by date..." oninput="filterDays()">
          </div>
        </div>
        <div class="days-grid" id="daysGrid"><div class="empty-state"><i class="fa-solid fa-calendar-xmark"></i>Load data to see daily stats.</div></div>
      </div>

      <div id="panel-playtime" class="panel">
        <div class="section-header">
          <div class="section-title"><i class="fa-solid fa-clock"></i>Play Time Rankings</div>
          <div class="sort-bar">
            <input class="filter-input" id="timeFilter" placeholder="Filter app..." oninput="filterTime()">
          </div>
        </div>
        <div class="time-list" id="timeList"><div class="empty-state"><i class="fa-solid fa-clock"></i>Load data to see play time.</div></div>
      </div>

      <div id="panel-sessions" class="panel">
        <div class="section-header">
          <div class="section-title"><i class="fa-solid fa-layer-group"></i>Session Analytics</div>
        </div>
        <div class="cards-grid" id="sessionsGrid"><div class="empty-state"><i class="fa-solid fa-layer-group"></i>Load data to see session stats.</div></div>
      </div>

      <div id="panel-flows" class="panel">
        <div class="section-header">
          <div class="section-title"><i class="fa-solid fa-route"></i>Navigation Flows</div>
          <div class="sort-bar">
            <input class="filter-input" id="flowFilter" placeholder="Filter app..." oninput="filterFlows()">
          </div>
        </div>
        <div class="flow-wrap"><table class="flow-table">
          <thead><tr><th>From</th><th></th><th>To</th><th>Volume</th></tr></thead>
          <tbody id="flowBody"><tr><td colspan="4" class="empty-state">Load data to see flows.</td></tr></tbody>
        </table></div>
      </div>

      <div id="panel-entryexit" class="panel">
        <div class="section-header">
          <div class="section-title"><i class="fa-solid fa-door-open"></i>Entry &amp; Exit Apps</div>
        </div>
        <div class="entry-exit-grid" id="entryExitGrid"><div class="empty-state"><i class="fa-solid fa-door-open"></i>Load data to see entry/exit data.</div></div>
      </div>

      <div id="panel-exploration" class="panel">
        <div class="section-header">
          <div class="section-title"><i class="fa-solid fa-compass"></i>Exploration Stats</div>
        </div>
        <div class="explore-grid" id="exploreGrid"><div class="empty-state"><i class="fa-solid fa-compass"></i>Load data to see exploration stats.</div></div>
      </div>

      <div id="panel-insights" class="panel">
        <div id="insightsContent" style="display:flex;flex-direction:column;gap:4px">
          <div class="section-header"><div class="section-title"><i class="fa-solid fa-chart-pie"></i>Event Type Breakdown</div></div>
          <div class="chart-grid">
            <div class="chart-card"><div class="chart-card-title"><i class="fa-solid fa-chart-simple"></i>Events by Type</div><div class="canvas-wrap"><canvas id="chartET"></canvas></div></div>
            <div class="chart-card"><div class="chart-card-title"><i class="fa-solid fa-clock"></i>Activity by Hour of Day</div><div class="canvas-wrap"><canvas id="chartHourly"></canvas></div></div>
          </div>
          <div class="section-header"><div class="section-title"><i class="fa-solid fa-users-line"></i>User Growth</div></div>
          <div class="chart-grid">
            <div class="chart-card"><div class="chart-card-title"><i class="fa-solid fa-user-plus"></i>New vs Returning Users / Day</div><div class="canvas-wrap"><canvas id="chartNR"></canvas></div></div>
            <div class="chart-card"><div class="chart-card-title"><i class="fa-solid fa-chart-line"></i>DAU / WAU / MAU</div><div class="canvas-wrap"><canvas id="chartDWM"></canvas></div></div>
          </div>
          <div class="section-header"><div class="section-title"><i class="fa-solid fa-retweet"></i>Retention & Session Quality</div></div>
          <div class="chart-grid">
            <div class="chart-card"><div class="chart-card-title"><i class="fa-solid fa-percent"></i>Day-over-Day Retention (D1, D7)</div><div class="canvas-wrap"><canvas id="chartRet"></canvas></div></div>
            <div class="chart-card"><div class="chart-card-title"><i class="fa-solid fa-clock-rotate-left"></i>Session Duration Distribution</div><div class="canvas-wrap"><canvas id="chartSD"></canvas></div></div>
          </div>
          <div class="section-header"><div class="section-title"><i class="fa-solid fa-gauge-high"></i>User & App Depth</div></div>
          <div class="chart-grid">
            <div class="chart-card"><div class="chart-card-title"><i class="fa-solid fa-gauge"></i>User Activity Levels (events)</div><div class="canvas-wrap"><canvas id="chartUA"></canvas></div></div>
            <div class="chart-card"><div class="chart-card-title"><i class="fa-solid fa-users"></i>Apps by Unique Users</div><div class="canvas-wrap"><canvas id="chartAU"></canvas></div></div>
          </div>
          <div class="chart-grid">
            <div class="chart-card"><div class="chart-card-title"><i class="fa-solid fa-stopwatch"></i>Avg Time Spent per App</div><div class="canvas-wrap"><canvas id="chartAT"></canvas></div></div>
          </div>
        </div>
        <div id="insightsEmpty" class="empty-state" style="display:none"><i class="fa-solid fa-chart-pie"></i>Load data to see insights.</div>
      </div>

      <div id="panel-data" class="panel">
        <div class="section-header">
          <div class="section-title"><i class="fa-solid fa-database"></i>Data Management</div>
        </div>
        <div class="cards-grid">
          <div class="stat-card">
            <div class="sc-label"><i class="fa-solid fa-download" style="margin-right:6px;color:var(--accent)"></i>Export Data</div>
            <div class="sc-sub" style="margin-bottom:12px">Download all analytics data as JSON</div>
            <button class="btn-load" onclick="exportData()" style="width:100%;justify-content:center"><i class="fa-solid fa-download"></i>Export</button>
          </div>
          <div class="stat-card">
            <div class="sc-label"><i class="fa-solid fa-upload" style="margin-right:6px;color:var(--accent)"></i>Import Data</div>
            <div class="sc-sub" style="margin-bottom:12px">Restore analytics from JSON file</div>
            <input type="file" id="importFile" accept=".json" style="display:none" onchange="importData(this)">
            <button class="btn-load" onclick="document.getElementById('importFile').click()" style="width:100%;justify-content:center"><i class="fa-solid fa-upload"></i>Import</button>
          </div>
        </div>
        <div id="importStatus" style="margin-top:20px"></div>
      </div>

      <div id="panel-downloadstelemetry" class="panel">
        <div class="section-header">
          <div class="section-title"><i class="fa-solid fa-download"></i>Downloads & Telemetry</div>
          <div class="sort-bar">
            <button class="sort-btn active" id="dtTabDownloads" onclick="switchDTTab('downloads')"><i class="fa-solid fa-download"></i>Downloads</button>
            <button class="sort-btn" id="dtTabElectron" onclick="switchDTTab('electron')"><i class="fa-solid fa-microchip"></i>Electron Usage</button>
            <span style="font-size:11px;color:var(--muted);margin-left:4px">|</span>
            <button class="sort-btn" onclick="loadDownloadsTelemetry()"><i class="fa-solid fa-rotate"></i>Refresh</button>
          </div>
        </div>
        <div class="flow-wrap" id="dtTableWrap">
          <div id="dtEmpty" class="empty-state"><i class="fa-solid fa-download"></i>Loading data...</div>
          <table class="flow-table" id="dtTable" style="display:none">
            <thead id="dtThead"></thead>
            <tbody id="dtTbody"></tbody>
          </table>
        </div>
      </div>

      <div id="panel-themes" class="panel">
        <div class="section-header">
          <div class="section-title"><i class="fa-solid fa-palette"></i>Theme Management</div>
          <div class="sort-bar">
            <button class="sort-btn active" id="tsTabAll" onclick="loadAdminThemes('all')"><i class="fa-solid fa-circle-dot"></i>All</button>
            <button class="sort-btn" id="tsTabApproved" onclick="loadAdminThemes('approved')"><i class="fa-solid fa-check"></i>Approved</button>
            <button class="sort-btn" id="tsTabFlagged" onclick="loadAdminThemes('flagged')"><i class="fa-solid fa-flag"></i>Flagged</button>
            <button class="sort-btn" id="tsTabDeleted" onclick="loadAdminThemes('deleted')"><i class="fa-solid fa-trash"></i>Deleted</button>
            <button class="sort-btn" onclick="loadAdminThemes()"><i class="fa-solid fa-rotate"></i>Refresh</button>
          </div>
        </div>
        <div class="flow-wrap" id="themeTableWrap">
          <div id="themeEmpty" class="empty-state"><i class="fa-solid fa-palette"></i>Loading themes...</div>
          <table class="flow-table" id="themeTable" style="display:none">
            <thead id="themeThead"></thead>
            <tbody id="themeTbody"></tbody>
          </table>
        </div>
      </div>

    </div>
  </div>
</div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"></script>
<script>
var token="";
var refreshTimer=null;
var _statsData=null;
var _sessionsData=null;
var _timeData=null;
var _flowsData=null;
var _eeData=null;
var _exploreData=null;
var _daySort="date";
var _chartReq=null;
var _chartSess=null;
var _chartPeak=null;
var _peakData=null;
var _insightsData=null;
var _cET=null,_cH=null,_cNR=null,_cDWM=null,_cRet=null,_cSD=null,_cUA=null,_cAU=null,_cAT=null;

var panelTitles={
  dashboard:"Dashboard",
  daily:"Daily Stats",
  playtime:"Play Time",
  sessions:"Session Analytics",
  flows:"Navigation Flows",
  entryexit:"Entry / Exit Apps",
  exploration:"Exploration Stats",
  insights:"Insights",
  data:"Data Management",
  downloadstelemetry:"Downloads & Telemetry",
  themes:"Theme Management"
};

function escapeHtml(str){
  if(typeof str!=="string")return "";
  return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}

function switchPanel(id,el){
  document.querySelectorAll(".panel").forEach(function(p){p.classList.remove("active");});
  document.querySelectorAll(".nav-item").forEach(function(n){n.classList.remove("active");});
  document.getElementById("panel-"+id).classList.add("active");
  el.classList.add("active");
  document.getElementById("panelTitle").textContent=panelTitles[id]||id;
}

function getHeaders(){return{"Authorization":"Bearer "+token};}

function fmtMs(ms){
  if(!ms||ms<=0)return"0s";
  var s=Math.floor(ms/1000),m=Math.floor(s/60),h=Math.floor(m/60);
  if(h>0)return h+"h "+(m%60)+"m";
  if(m>0)return m+"m "+(s%60)+"s";
  return s+"s";
}

function displayApp(name){
  if(!name)return"Unknown";
  var s=name.trim();
  if(s.toLowerCase().endsWith("app")){
    s=s.slice(0,-3).trim();
    s=s.replace(/([a-z])([A-Z])/g,"$1 $2");
    s=s.charAt(0).toUpperCase()+s.slice(1);
    return escapeHtml(s+" App");
  }
  s=s.replace(/([a-z])([A-Z])/g,"$1 $2");
  return escapeHtml(s.charAt(0).toUpperCase()+s.slice(1));
}

function apiFetch(url, onSuccess, label) {
  fetch(url, { headers: getHeaders() })
    .then(function(r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(function(data) {
      onSuccess(data);
      var statusEl = document.getElementById("lastRefresh");
      if (statusEl) {
        statusEl.textContent = "Loaded " + new Date().toLocaleTimeString();
        statusEl.style.color = "var(--muted)";
      }
    })
    .catch(function(err) {
      console.error(err);
      var statusEl = document.getElementById("lastRefresh");
      if (statusEl) {
        statusEl.textContent = "Error " + label + ". Retrying...";
        statusEl.style.color = "var(--red)";
      }
      setTimeout(function() {
        if (document.getElementById("token").value.trim() === token) {
          apiFetch(url, onSuccess, label);
        }
      }, 5000);
    });
}

var _dtTab="downloads";
var _dtData={downloads:[],electron:[]};

function switchDTTab(tab){
  _dtTab=tab;
  document.querySelectorAll("#panel-downloadstelemetry .sort-btn[id^=dtTab]").forEach(function(b){b.classList.remove("active");});
  document.getElementById("dtTab"+(tab==="downloads"?"Downloads":"Electron")).classList.add("active");
  renderDTTable();
}

function loadDownloadsTelemetry(){
  apiFetch("/admin/downloads?limit=100",function(d){_dtData.downloads=d.results||[];if(_dtTab==="downloads")renderDTTable();},"Downloads");
  apiFetch("/admin/electron-usage?limit=100",function(d){_dtData.electron=d.results||[];if(_dtTab==="electron")renderDTTable();},"Electron");
}

function renderDTTable(){
  var rows=_dtData[_dtTab];
  var table=document.getElementById("dtTable");
  var empty=document.getElementById("dtEmpty");
  var thead=document.getElementById("dtThead");
  var tbody=document.getElementById("dtTbody");
  if(!rows||!rows.length){
    table.style.display="none";
    empty.style.display="block";
    empty.innerHTML='<i class="fa-solid fa-download"></i>No records found.';
    return;
  }
  table.style.display="";
  empty.style.display="none";
  if(_dtTab==="downloads"){
    thead.innerHTML='<tr><th>App</th><th>File Name</th><th>Size</th><th>Type</th><th>Source</th><th>Timestamp</th></tr>';
    tbody.innerHTML=rows.map(function(r){
      var d=typeof r.data==="string"?JSON.parse(r.data):r.data;
      var ts=r.timestamp?r.timestamp.slice(0,19).replace("T"," "):"-";
      var sz=typeof d.fileSize==="number"?(d.fileSize>1048576?(d.fileSize/1048576).toFixed(1)+" MB":(d.fileSize>1024?(d.fileSize/1024).toFixed(1)+" KB":d.fileSize+" B")):"-";
      return '<tr><td class="flow-from">'+displayApp(d.app||"-")+'</td><td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+(d.fileName||"-")+'</td><td>'+sz+'</td><td>'+(d.fileType||"-")+'</td><td>'+(d.source||"-")+'</td><td style="font-size:11px;color:var(--muted2)">'+ts+'</td></tr>';
    }).join("");
  } else {
    thead.innerHTML='<tr><th>Action</th><th>Platform</th><th>Version</th><th>Details</th><th>Dev</th><th>Timestamp</th></tr>';
    tbody.innerHTML=rows.map(function(r){
      var d=typeof r.data==="string"?JSON.parse(r.data):r.data;
      var ts=r.timestamp?r.timestamp.slice(0,19).replace("T"," "):"-";
      return '<tr><td class="flow-from">'+(d.action||"-")+'</td><td>'+(d.platform||"-")+'</td><td>'+(d.version||"-")+'</td><td style="max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+(d.details||"-")+'</td><td>'+(d.isDev?"<span style='color:var(--green)'>Yes</span>":"No")+'</td><td style="font-size:11px;color:var(--muted2)">'+ts+'</td></tr>';
    }).join("");
  }
}

function loadAll(){
  token=document.getElementById("token").value.trim();
  if(!token){alert("Enter auth token first");return;}
  localStorage.setItem("yukios_admin_token", token);
  loadStats();loadTopTime();loadSessions();loadFlows();loadEntryExit();loadExploration();loadLive();loadPeak();loadInsights();
  document.getElementById("lastRefresh").textContent="Loaded "+new Date().toLocaleTimeString();
  if(refreshTimer)clearInterval(refreshTimer);
  refreshTimer=setInterval(function(){
    loadStats();loadTopTime();loadSessions();loadFlows();loadEntryExit();loadExploration();loadLive();loadPeak();loadInsights();
    document.getElementById("lastRefresh").textContent="Loaded "+new Date().toLocaleTimeString();
  },60000);
}

function loadStats(){
  var range=document.getElementById("range").value;
  apiFetch("/admin/stats?range="+range, function(d){_statsData=d;renderDashboardCharts(d);renderDays(d);}, "Stats");
}

function loadTopTime(){
  apiFetch("/admin/top-played-time-games", function(d){_timeData=d;renderTime(d);}, "Playtime");
}

function loadSessions(){
  apiFetch("/admin/sessions", function(d){_sessionsData=d;renderSessions(d);updateKpiSessions(d);}, "Sessions");
}

function loadFlows(){
  apiFetch("/admin/flows", function(d){_flowsData=d;renderFlows(d);}, "Flows");
}

function loadEntryExit(){
  apiFetch("/admin/entry-exit", function(d){_eeData=d;renderEntryExit(d);}, "Navigation");
}

function loadExploration(){
  apiFetch("/admin/exploration", function(d){_exploreData=d;renderExploration(d);}, "Exploration");
}

function loadLive(){
  apiFetch("/admin/live", renderLive, "Live");
}

function loadPeak(){
  var range=document.getElementById("range").value;
  apiFetch("/admin/peak-concurrent?range="+range, function(d){_peakData=d;updateKpiPeak(d);renderPeakChart(d);}, "Peak");
}

function updateKpiPeak(data){
  document.getElementById("kPeak").textContent=data.overall_peak.concurrent||0;
  var t=data.overall_peak.at_time;
  document.getElementById("kPeakTime").textContent=t?"at "+t:"";
}

function renderPeakChart(data){
  if(!data.daily||!data.daily.length)return;
  var reversed=[].concat(data.daily).reverse();
  var labels=reversed.map(function(d){return d.day.slice(5);});
  var vals=reversed.map(function(d){return d.peak;});
  var cfg={type:"bar",options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:function(ctx){return" "+ctx.parsed.y.toLocaleString();}}}},scales:{x:{grid:{color:"rgba(255,255,255,.04)"},ticks:{color:"#64748b",font:{size:9}}},y:{grid:{color:"rgba(255,255,255,.04)"},ticks:{color:"#64748b",font:{size:9}}}}}};
  if(_chartPeak){_chartPeak.destroy();}
  var ctx=document.getElementById("chartPeak").getContext("2d");
  var grad=ctx.createLinearGradient(0,0,0,160);
  grad.addColorStop(0,"oklch(55% 0.14 220 / 0.9)");
  grad.addColorStop(1,"oklch(55% 0.14 220 / 0.15)");
  _chartPeak=new Chart(ctx,Object.assign({},cfg,{data:{labels:labels,datasets:[{data:vals,backgroundColor:grad,borderRadius:4,borderSkipped:false}]}}));
}

function bCfg(){return{type:"bar",options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:function(ctx){return" "+ctx.parsed.y.toLocaleString();}}}},scales:{x:{grid:{color:"rgba(255,255,255,.04)"},ticks:{color:"#64748b",font:{size:9}}},y:{beginAtZero:true,grid:{color:"rgba(255,255,255,.04)"},ticks:{color:"#64748b",font:{size:9}}}}}};}
function lCfg(multi){var c={type:"line",options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:"#94a3b8",font:{size:9},boxWidth:10,usePointStyle:true},display:!!multi,position:"bottom"},tooltip:{callbacks:{label:function(ctx){return" "+ctx.parsed.y.toLocaleString();}}}},scales:{x:{grid:{color:"rgba(255,255,255,.04)"},ticks:{color:"#64748b",font:{size:9}}},y:{beginAtZero:true,grid:{color:"rgba(255,255,255,.04)"},ticks:{color:"#64748b",font:{size:9}}}}}};return c;}
function hCfg(){var c=bCfg();c.options.indexAxis="y";c.options.plugins.legend.display=true;c.options.plugins.legend.labels={color:"#94a3b8",font:{size:8},boxWidth:10};return c;}
function destroyChart(arr){arr.forEach(function(c){if(c)c.destroy();});}
function grad(ctx,color){var g=ctx.createLinearGradient(0,0,0,160);g.addColorStop(0,"oklch("+color+" / 0.9)");g.addColorStop(1,"oklch("+color+" / 0.15)");return g;}
var COLORS=["#22c55e","#f59e0b","#ef4444","#3b82f6","#a855f7","#ec4899","#14b8a6","#f97316"];

function loadInsights(){
  var range=document.getElementById("range").value;
  apiFetch("/admin/insights?range="+range,function(d){_insightsData=d;renderInsights(d);},"Insights");
}

function renderInsights(d){
  if(!d.event_types||!d.event_types.length){
    document.getElementById("insightsContent").style.display="none";
    document.getElementById("insightsEmpty").style.display="block";
    return;
  }
  document.getElementById("insightsContent").style.display="flex";
  document.getElementById("insightsEmpty").style.display="none";
  renderET(d.event_types);renderHourly(d.hourly);renderNR(d.new_returning);renderDWM(d.dau_wau_mau);
  renderRet(d.retention);renderSD(d.session_durations);renderUA(d.user_activity);renderAU(d.app_unique_users);renderAT(d.app_avg_time);
}

function renderET(data){
  destroyChart([_cET]);
  var labels=data.map(function(r){return r.et||"unknown";});
  var vals=data.map(function(r){return r.c;});
  var colors=COLORS.slice(0,labels.length);
  var cfg=bCfg();cfg.options.plugins.legend.display=true;cfg.options.plugins.legend.labels={color:"#94a3b8",font:{size:9},boxWidth:10};
  var ctx=document.getElementById("chartET").getContext("2d");
  _cET=new Chart(ctx,Object.assign({},cfg,{data:{labels:labels,datasets:[{data:vals,backgroundColor:colors,borderRadius:4,borderSkipped:false}]}}));
}

function renderHourly(data){
  destroyChart([_cH]);
  var labels=data.map(function(r){return r.h.toString().padStart(2,"0")+":00";});
  var vals=data.map(function(r){return r.c;});
  if(!labels.length)return;
  var ctx=document.getElementById("chartHourly").getContext("2d");
  var g=grad(ctx,"55% 0.14 220");
  _cH=new Chart(ctx,Object.assign({},bCfg(),{data:{labels:labels,datasets:[{data:vals,backgroundColor:g,borderRadius:2,borderSkipped:false}]}}));
}

function renderNR(data){
  destroyChart([_cNR]);
  if(!data||!data.length)return;
  var labels=data.map(function(r){return r.d.slice(5);});
  var newVals=data.map(function(r){return parseInt(r.n)||0;});
  var retVals=data.map(function(r){return parseInt(r.rl)||0;});
  var cfg=bCfg();cfg.options.scales.x.stacked=true;cfg.options.scales.y.stacked=true;
  cfg.options.plugins.legend.display=true;cfg.options.plugins.legend.labels={color:"#94a3b8",font:{size:9},boxWidth:10};
  var ctx=document.getElementById("chartNR").getContext("2d");
  _cNR=new Chart(ctx,Object.assign({},cfg,{data:{labels:labels,datasets:[
    {label:"New",data:newVals,backgroundColor:"#22c55e",borderRadius:0},
    {label:"Returning",data:retVals,backgroundColor:"#3b82f6",borderRadius:4}
  ]}}));
}

function renderDWM(data){
  destroyChart([_cDWM]);
  if(!data||!data.length)return;
  var labels=data.map(function(r){return r.d.slice(5);});
  var cfg=lCfg(true);
  var ctx=document.getElementById("chartDWM").getContext("2d");
  _cDWM=new Chart(ctx,Object.assign({},cfg,{data:{labels:labels,datasets:[
    {label:"DAU",data:data.map(function(r){return r.dau;}),borderColor:"#22c55e",backgroundColor:"rgba(34,197,94,0.1)",fill:true,tension:0.2,pointRadius:2},
    {label:"WAU",data:data.map(function(r){return r.wau;}),borderColor:"#f59e0b",backgroundColor:"rgba(245,158,11,0.1)",fill:true,tension:0.2,pointRadius:2},
    {label:"MAU",data:data.map(function(r){return r.mau;}),borderColor:"#a855f7",backgroundColor:"rgba(168,85,247,0.1)",fill:true,tension:0.2,pointRadius:2}
  ]}}));
}

function renderRet(data){
  destroyChart([_cRet]);
  if(!data||!data.length)return;
  var cutoff=new Date();cutoff.setDate(cutoff.getDate()-1);
  var filtered=data.filter(function(r){return r.d1!==null||r.d7!==null;});
  if(!filtered.length)return;
  var labels=filtered.map(function(r){return r.d.slice(5);});
  var d1=filtered.map(function(r){return r.d1?Math.round(r.d1*100):null;});
  var d7=filtered.map(function(r){return r.d7?Math.round(r.d7*100):null;});
  var cfg=bCfg();cfg.options.plugins.legend.display=true;cfg.options.plugins.legend.labels={color:"#94a3b8",font:{size:9},boxWidth:10};
  var ctx=document.getElementById("chartRet").getContext("2d");
  _cRet=new Chart(ctx,Object.assign({},cfg,{data:{labels:labels,datasets:[
    {label:"D1%",data:d1,backgroundColor:"#22c55e",borderRadius:2},
    {label:"D7%",data:d7,backgroundColor:"#3b82f6",borderRadius:2}
  ]}}));
}

function renderSD(data){
  destroyChart([_cSD]);
  if(!data||!data.t)return;
  var labels=["<1m","1-5m","5-15m","15-30m","30-60m","60m+"];
  var vals=[data.a||0,data.b||0,data.c||0,data.d||0,data.e||0,data.f||0];
  var colors=["#22c55e","#3b82f6","#f59e0b","#f97316","#ef4444","#a855f7"];
  var cfg=bCfg();
  var ctx=document.getElementById("chartSD").getContext("2d");
  _cSD=new Chart(ctx,Object.assign({},cfg,{data:{labels:labels,datasets:[{data:vals,backgroundColor:colors,borderRadius:4,borderSkipped:false}]}}));
}

function renderUA(data){
  destroyChart([_cUA]);
  if(!data||!data.length)return;
  var labels=data.map(function(r){return r.b;});
  var vals=data.map(function(r){return r.u;});
  var ctx=document.getElementById("chartUA").getContext("2d");
  var g=grad(ctx,"55% 0.14 220");
  _cUA=new Chart(ctx,Object.assign({},bCfg(),{data:{labels:labels,datasets:[{data:vals,backgroundColor:g,borderRadius:4,borderSkipped:false}]}}));
}

function renderAU(data){
  destroyChart([_cAU]);
  if(!data||!data.length)return;
  var reversed=[].concat(data).reverse();
  var labels=reversed.map(function(r){return r.a||"unknown";});
  var vals=reversed.map(function(r){return r.u;});
  var ctx=document.getElementById("chartAU").getContext("2d");
  _cAU=new Chart(ctx,Object.assign({},hCfg(),{
    data:{labels:labels,datasets:[{data:vals,backgroundColor:"#3b82f6",borderRadius:4,borderSkipped:false}]},
    options:Object.assign({},hCfg().options,{indexAxis:"y",scales:{x:{beginAtZero:true,grid:{color:"rgba(255,255,255,.04)"},ticks:{color:"#64748b",font:{size:8}}},y:{grid:{color:"rgba(255,255,255,.04)"},ticks:{color:"#64748b",font:{size:8}}}}})
  }));
}

function renderAT(data){
  destroyChart([_cAT]);
  if(!data||!data.length)return;
  var reversed=[].concat(data).reverse();
  var labels=reversed.map(function(r){return r.a||"unknown";});
  var vals=reversed.map(function(r){return Math.round((r.d||0)/1000);});
  var ctx=document.getElementById("chartAT").getContext("2d");
  _cAT=new Chart(ctx,Object.assign({},hCfg(),{
    data:{labels:labels,datasets:[{data:vals,backgroundColor:"#a855f7",borderRadius:4,borderSkipped:false}]},
    options:Object.assign({},hCfg().options,{indexAxis:"y",scales:{x:{beginAtZero:true,grid:{color:"rgba(255,255,255,.04)"},ticks:{color:"#64748b",font:{size:8},callback:function(v){return v+"s";}}},y:{grid:{color:"rgba(255,255,255,.04)"},ticks:{color:"#64748b",font:{size:8}}}}})
  }));
}

document.addEventListener("DOMContentLoaded", function() {
  var savedToken = localStorage.getItem("yukios_admin_token");
  if (savedToken) {
    document.getElementById("token").value = savedToken;
    loadAll();
  }
});

function renderLive(data){
  document.getElementById("liveStrip").style.display="block";
  document.getElementById("liveUsers").textContent=data.active_users_5min||0;
  document.getElementById("liveSessions").textContent=data.active_sessions||0;
  var chips=document.getElementById("liveApps");
  chips.innerHTML="";
  (data.top_active_apps||[]).forEach(function(a){
    var c=document.createElement("span");
    c.className="live-chip";
    c.textContent=displayApp(a.app)+" · "+a.count;
    chips.appendChild(c);
  });
  if(!chips.children.length)chips.innerHTML='<span style="color:var(--muted);font-size:11px">No active apps</span>';
}

function updateKpiSessions(d){
  document.getElementById("kSessions").textContent=(d.total_sessions||0).toLocaleString();
  document.getElementById("kAvgDur").textContent=fmtMs(d.avg_duration_ms);
  document.getElementById("kPower").textContent=(d.power_users||0).toLocaleString();
  document.getElementById("kBounce").textContent=(d.bounce_sessions||0).toLocaleString();
}

function renderDashboardCharts(data){
  if(!data.daily||!data.daily.length)return;
  var reversed=[].concat(data.daily).reverse();
  var labels=reversed.map(function(d){return d.day.slice(5);});
  var reqVals=reversed.map(function(d){return d.requests;});
  var sessVals=reversed.map(function(d){return d.inferred_sessions||0;});

  var totalReq=data.daily.reduce(function(s,d){return s+d.requests;},0);
  var totalUsers=new Set(data.daily.map(function(d){return d.unique_players;})).size;
  document.getElementById("kTotal").textContent=totalReq.toLocaleString();
  document.getElementById("kUsers").textContent=data.daily.reduce(function(s,d){return s+(d.unique_players||0);},0).toLocaleString();

  var cfg={type:"bar",options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:function(ctx){return" "+ctx.parsed.y.toLocaleString();}}}},scales:{x:{grid:{color:"rgba(255,255,255,.04)"},ticks:{color:"#64748b",font:{size:9}}},y:{grid:{color:"rgba(255,255,255,.04)"},ticks:{color:"#64748b",font:{size:9}}}}}};

  if(_chartReq){_chartReq.destroy();}
  var ctx1=document.getElementById("chartReq").getContext("2d");
  var grad1=ctx1.createLinearGradient(0,0,0,160);
  grad1.addColorStop(0,"oklch(55% 0.14 220 / 0.9)");
  grad1.addColorStop(1,"oklch(55% 0.14 220 / 0.15)");
  _chartReq=new Chart(ctx1,Object.assign({},cfg,{data:{labels:labels,datasets:[{data:reqVals,backgroundColor:grad1,borderRadius:4,borderSkipped:false}]}}));

  if(_chartSess){_chartSess.destroy();}
  var ctx2=document.getElementById("chartSess").getContext("2d");
  var grad2=ctx2.createLinearGradient(0,0,0,160);
  grad2.addColorStop(0,"oklch(72% 0.12 220 / 0.9)");
  grad2.addColorStop(1,"oklch(72% 0.12 220 / 0.15)");
  _chartSess=new Chart(ctx2,Object.assign({},cfg,{data:{labels:labels,datasets:[{data:sessVals,backgroundColor:grad2,borderRadius:4,borderSkipped:false}]}}));
}

function renderDays(data){
  if(!data.daily||!data.daily.length){
    document.getElementById("daysGrid").innerHTML='<div class="empty-state"><i class="fa-solid fa-calendar-xmark"></i>No daily data found.</div>';
    return;
  }
  _daySort=_daySort||"date";
  var days=[].concat(data.daily);
  sortAndRenderDays(days,data.topGames);
}

var _lastDays=null,_lastGames=null;
function sortAndRenderDays(days,games){
  _lastDays=days||_lastDays;
  _lastGames=games||_lastGames;
  if(!_lastDays)return;
  var filter=document.getElementById("dayFilter").value.toLowerCase().trim();
  var sorted=[].concat(_lastDays).filter(function(d){return!filter||d.day.includes(filter);});
  if(_daySort==="requests")sorted.sort(function(a,b){return b.requests-a.requests;});
  else if(_daySort==="users")sorted.sort(function(a,b){return b.unique_players-a.unique_players;});
  else sorted.sort(function(a,b){return b.day.localeCompare(a.day);});
  var grid=document.getElementById("daysGrid");
  grid.innerHTML="";
  sorted.forEach(function(day){
    var card=document.createElement("div");
    card.className="day-card";
    var list=(_lastGames&&_lastGames[day.day]||[]).slice(0,5);
    var maxC=list.length?list[0].count:1;
    var gamesHTML=list.length?list.map(function(g,i){
      var pct=maxC>0?Math.round((g.count/maxC)*100):0;
      return '<div class="game-item"><span class="game-rank">#'+(i+1)+'</span><span class="game-name">'+displayApp(g.app)+'</span><div class="game-bar-wrap"><div class="game-bar-fill" style="width:'+pct+'%"></div></div><span class="game-count">'+g.count+'</span></div>';
    }).join(""):'<div style="font-size:11px;color:var(--muted);padding:6px 0">No launches</div>';
    card.innerHTML=
      '<div class="day-card-header" onclick="toggleDay(this)">'
        +'<span class="day-card-date"><i class="fa-regular fa-calendar" style="margin-right:8px;color:var(--accent)"></i>'+day.day+'</span>'
        +'<div class="day-card-quick">'
          +'<div class="day-card-quick-stat"><div class="qv">'+day.requests+'</div><div class="ql">Req</div></div>'
          +'<div class="day-card-quick-stat"><div class="qv">'+day.unique_players+'</div><div class="ql">Users</div></div>'
          +'<div class="day-card-quick-stat"><div class="qv">'+(day.inferred_sessions||0)+'</div><div class="ql">Sess</div></div>'
        +'</div>'
        +'<i class="fa-solid fa-chevron-down day-expand-icon"></i>'
      +'</div>'
      +'<div class="day-card-body">'
        +'<div class="day-stats-row">'
          +'<div class="day-stat-box"><div class="dsv">'+day.requests+'</div><div class="dsl">Requests</div></div>'
          +'<div class="day-stat-box"><div class="dsv">'+day.unique_players+'</div><div class="dsl">Unique Users</div></div>'
          +'<div class="day-stat-box"><div class="dsv">'+(day.requests_per_user||0)+'</div><div class="dsl">Req / User</div></div>'
          +'<div class="day-stat-box"><div class="dsv">'+(day.inferred_sessions||0)+'</div><div class="dsl">Sessions</div></div>'
        +'</div>'
        +'<div class="games-section-label"><i class="fa-solid fa-gamepad" style="margin-right:6px;color:var(--accent)"></i>Top Launches</div>'
        +gamesHTML
      +'</div>';
    grid.appendChild(card);
  });
}

function toggleDay(header){
  var card=header.parentElement;
  card.classList.toggle("open");
}

function sortDays(by){
  _daySort=by;
  document.querySelectorAll(".sort-btn").forEach(function(b){b.classList.remove("active");});
  document.getElementById("sort"+by.charAt(0).toUpperCase()+by.slice(1)).classList.add("active");
  if(_lastDays)sortAndRenderDays();
}

function filterDays(){
  if(_lastDays)sortAndRenderDays();
}

function renderTime(data){
  var results=(data.results||[]);
  var list=document.getElementById("timeList");
  var filter=document.getElementById("timeFilter")&&document.getElementById("timeFilter").value.toLowerCase()||"";
  var filtered=filter?results.filter(function(r){return (r.app||"").toLowerCase().includes(filter);}):results;
  if(!filtered.length){list.innerHTML='<div class="empty-state"><i class="fa-solid fa-clock"></i>No playtime data found.</div>';return;}
  var max=filtered[0].total_time_ms||1;
  list.innerHTML="";
  filtered.forEach(function(r,i){
    var pct=max>0?Math.round(((r.total_time_ms||0)/max)*100):0;
    var item=document.createElement("div");
    item.className="time-item";
    item.innerHTML=
      '<div class="time-rank-badge">'+(i+1)+'</div>'
      +'<div class="time-info">'
        +'<div class="time-app">'+displayApp(r.app)+'</div>'
        +'<div class="time-bar-track"><div class="time-bar-fill" style="width:'+pct+'%"></div></div>'
      +'</div>'
      +'<div class="time-stats">'
        +'<div class="time-duration">'+fmtMs(r.total_time_ms)+'</div>'
        +'<div class="time-sessions"><i class="fa-solid fa-rotate" style="margin-right:3px"></i>'+(r.event_count||0)+' events</div>'
      +'</div>';
    list.appendChild(item);
  });
}

function filterTime(){
  if(_timeData)renderTime(_timeData);
}

function renderSessions(data){
  var grid=document.getElementById("sessionsGrid");
  var items=[
    {icon:"fa-layer-group",label:"Total Sessions",val:(data.total_sessions||0).toLocaleString(),sub:"inferred from event gaps"},
    {icon:"fa-stopwatch",label:"Avg Duration",val:fmtMs(data.avg_duration_ms),sub:"per session"},
    {icon:"fa-gamepad",label:"Avg Apps / Session",val:data.avg_apps_per_session,sub:"launches per session"},
    {icon:"fa-trophy",label:"Longest Session",val:fmtMs(data.longest_session_ms),sub:"single session"},
    {icon:"fa-hourglass-start",label:"Shortest Session",val:fmtMs(data.shortest_session_ms),sub:"single session"},
    {icon:"fa-person-running",label:"Bounce Sessions",val:(data.bounce_sessions||0).toLocaleString(),sub:"1 event or <20s"},
    {icon:"fa-bolt",label:"Power Users",val:(data.power_users||0).toLocaleString(),sub:"20+ events in one day"}
  ];
  grid.innerHTML="";
  items.forEach(function(item){
    var c=document.createElement("div");
    c.className="stat-card";
    c.innerHTML='<div class="sc-label"><i class="fa-solid '+item.icon+'" style="margin-right:6px;color:var(--accent)"></i>'+item.label+'</div><div class="sc-val">'+item.val+'</div><div class="sc-sub">'+item.sub+'</div>';
    grid.appendChild(c);
  });
}

var _allFlows=[];
function renderFlows(data){
  _allFlows=data.flows||[];
  buildFlowTable(_allFlows);
}

function buildFlowTable(flows){
  var filter=(document.getElementById("flowFilter").value||"").toLowerCase();
  var filtered=filter?flows.filter(function(f){return (f.source||"").includes(filter)||(f.destination||"").includes(filter);}):flows;
  var tbody=document.getElementById("flowBody");
  if(!filtered.length){tbody.innerHTML='<tr><td colspan="4" class="empty-state">No navigation flows found.</td></tr>';return;}
  var maxC=filtered[0].count||1;
  tbody.innerHTML="";
  filtered.slice(0,30).forEach(function(f){
    var pct=Math.round((f.count/maxC)*100);
    var tr=document.createElement("tr");
    tr.innerHTML=
      '<td class="flow-from">'+displayApp(f.source)+'</td>'
      +'<td class="flow-arrow"><i class="fa-solid fa-arrow-right"></i></td>'
      +'<td class="flow-to">'+displayApp(f.destination)+'</td>'
      +'<td><div class="flow-bar-cell"><span class="flow-count">'+f.count+'</span><div class="flow-bar"><div class="flow-bar-inner" style="width:'+pct+'%"></div></div></div></td>';
    tbody.appendChild(tr);
  });
}

function filterFlows(){buildFlowTable(_allFlows);}

function renderEntryExit(data){
  var grid=document.getElementById("entryExitGrid");
  grid.innerHTML="";
  function makeCard(title,cls,items,barClass){
    var card=document.createElement("div");
    card.className="entry-exit-card";
    var icon=cls==="entry"?'<i class="fa-solid fa-right-to-bracket"></i>':'<i class="fa-solid fa-right-from-bracket"></i>';
    card.innerHTML='<div class="entry-exit-card-title '+cls+'">'+icon+' '+title+'</div>';
    if(!items||!items.length){card.innerHTML+='<div class="empty-state" style="padding:16px">No data</div>';return card;}
    var maxC=items[0].count||1;
    items.forEach(function(item){
      var pct=Math.round((item.count/maxC)*100);
      var row=document.createElement("div");
      row.className="ee-item";
      row.innerHTML='<span class="ee-name">'+displayApp(item.app)+'</span><div class="ee-bar-wrap"><div class="'+barClass+'" style="width:'+pct+'%"></div></div><span class="ee-count">'+item.count+'</span>';
      card.appendChild(row);
    });
    return card;
  }
  grid.appendChild(makeCard("Top Entry Apps","entry",data.top_entry_apps,"ee-bar-entry"));
  grid.appendChild(makeCard("Top Exit Apps","exit",data.top_exit_apps,"ee-bar-exit"));
}

function renderExploration(data){
  var grid=document.getElementById("exploreGrid");
  grid.innerHTML="";
  var avg=document.createElement("div");
  avg.className="explore-card";
  avg.innerHTML='<div class="explore-card-title"><i class="fa-solid fa-compass" style="margin-right:6px;color:var(--accent)"></i>Avg Unique Apps / Session</div><div class="explore-big">'+data.avg_unique_apps_per_session+'</div><div class="explore-sub">app diversity per session</div>';
  grid.appendChild(avg);

  var explorers=document.createElement("div");
  explorers.className="explore-card";
  explorers.innerHTML='<div class="explore-card-title"><i class="fa-solid fa-ranking-star" style="margin-right:6px;color:var(--accent)"></i>Most Exploratory Users</div>';
  if(data.top_explorers&&data.top_explorers.length){
    data.top_explorers.forEach(function(u){
      explorers.innerHTML+='<div class="user-row"><span class="user-id">'+u.user_id+'</span><span class="user-val">'+u.avg_unique+' apps/sess</span></div>';
    });
  } else {explorers.innerHTML+='<div style="font-size:11px;color:var(--muted);margin-top:8px">No data</div>';}
  grid.appendChild(explorers);

  var diverse=document.createElement("div");
  diverse.className="explore-card";
  diverse.innerHTML='<div class="explore-card-title"><i class="fa-solid fa-shuffle" style="margin-right:6px;color:var(--accent)"></i>Most Diverse Sessions</div>';
  if(data.top_diverse_sessions&&data.top_diverse_sessions.length){
    data.top_diverse_sessions.forEach(function(s){
      diverse.innerHTML+='<div class="user-row"><span class="user-id">'+s.user_id+'</span><span class="user-val">'+s.unique_apps+' unique apps</span></div>';
    });
  } else {diverse.innerHTML+='<div style="font-size:11px;color:var(--muted);margin-top:8px">No data</div>';}
  grid.appendChild(diverse);
}

function exportData(){
  fetch("/admin/export",{headers:getHeaders()})
    .then(function(r){return r.blob();})
    .then(function(blob){
      var url=URL.createObjectURL(blob);
      var a=document.createElement("a");
      a.href=url;
      a.download="yukios-analytics-"+new Date().toISOString().slice(0,10)+".json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    })
    .catch(function(e){
      alert("Export failed: "+e.message);
    });
}

function importData(input){
  var file=input.files[0];
  if(!file){return;}
  var reader=new FileReader();
  reader.onload=function(e){
    try{
      var data=JSON.parse(e.target.result);
      if(!data.records||!Array.isArray(data.records)){
        alert("Invalid file format");
        return;
      }
      var statusDiv=document.getElementById("importStatus");
      statusDiv.innerHTML='<div style="color:var(--muted);font-size:13px">Importing '+data.records.length+' records...</div>';
      fetch("/admin/import",{method:"POST",headers:{"Authorization":"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify(data)})
        .then(function(r){return r.json();})
        .then(function(res){
          if(res.success){
            statusDiv.innerHTML='<div style="color:var(--green);font-size:13px;font-weight:700"><i class="fa-solid fa-check-circle"></i> Import complete: '+res.imported+' imported, '+res.skipped+' skipped</div>';
            if(res.errors&&res.errors.length){
              statusDiv.innerHTML+='<div style="color:var(--red);font-size:11px;margin-top:8px">Errors: '+res.errors.join(", ")+'</div>';
            }
          }else{
            statusDiv.innerHTML='<div style="color:var(--red);font-size:13px">Import failed</div>';
          }
        })
        .catch(function(err){
          statusDiv.innerHTML='<div style="color:var(--red);font-size:13px">Import failed: '+err.message+'</div>';
        });
    }catch(err){
      alert("Failed to parse file: "+err.message);
    }
  };
  reader.readAsText(file);
  input.value="";
}

var _themeStatus="all";
var _themeData=[];
function loadAdminThemes(status){
  if(status!==undefined)_themeStatus=status;
  document.querySelectorAll("#panel-themes .sort-btn[id^=tsTab]").forEach(function(b){b.classList.remove("active");});
  document.getElementById("tsTab"+(_themeStatus.charAt(0).toUpperCase()+_themeStatus.slice(1))).classList.add("active");
  var empty=document.getElementById("themeEmpty");
  var table=document.getElementById("themeTable");
  table.style.display="none";
  empty.style.display="block";
  empty.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Loading themes...';
  fetch("/admin/themes?status="+encodeURIComponent(_themeStatus),{headers:getHeaders()})
    .then(function(r){if(!r.ok)throw new Error("HTTP "+r.status);return r.json();})
    .then(function(data){_themeData=data.themes||[];renderAdminThemes();})
    .catch(function(e){empty.style.display="block";empty.innerHTML='<i class="fa-solid fa-circle-xmark"></i> Error loading themes.';});
}
function renderAdminThemes(){
  var table=document.getElementById("themeTable");
  var empty=document.getElementById("themeEmpty");
  if(!_themeData.length){table.style.display="none";empty.style.display="block";empty.innerHTML='<i class="fa-solid fa-circle-info"></i> No themes found for this filter.';return;}
  table.style.display="";
  empty.style.display="none";
  document.getElementById("themeThead").innerHTML="<tr><th>Name</th><th>Author</th><th>Status</th><th>Score</th><th>Installs</th><th>Created</th><th>Actions</th></tr>";
  document.getElementById("themeTbody").innerHTML=_themeData.map(function(t){
    var badge=themeStatusBadge(t.status);
    var date=new Date(t.created_at).toLocaleDateString();
    var shortId=(t.id||"").slice(-8);
    return "<tr>"+
      "<td style=\\"max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap\\">"+escapeHtml(t.name||"Untitled")+"</td>"+
      "<td>"+escapeHtml(t.author||t.author_id||"Unknown")+"</td>"+
      "<td>"+badge+"</td>"+
      "<td>"+t.score+"</td>"+
      "<td>"+t.installs+"</td>"+
      "<td>"+date+"</td>"+
      "<td style=\\"white-space:nowrap\\">"+
      "<button class=\\"sort-btn\\" title=\\"Approve\\" onclick=\\"adminThemeAction('"+t.id+"','approve')\\"><i class=\\"fa-solid fa-check\\"></i></button> "+
      "<button class=\\"sort-btn\\" title=\\"Flag\\" onclick=\\"adminThemeAction('"+t.id+"','flag')\\"><i class=\\"fa-solid fa-flag\\"></i></button> "+
      "<button class=\\"sort-btn\\" title=\\"Delete\\" onclick=\\"adminThemeAction('"+t.id+"','delete')\\" style=\\"color:var(--red)\\"><i class=\\"fa-solid fa-trash\\"></i></button>"+
      "<div style=\\"font-size:9px;color:var(--muted);margin-top:3px\\">"+shortId+"</div>"+
      "</td>"+
      "</tr>";
  }).join("");
}
function themeStatusBadge(s){
  var map={approved:'<span style="color:var(--green)">approved</span>',flagged:'<span style="color:var(--yellow)">flagged</span>',deleted:'<span style="color:var(--red)">deleted</span>'};
  return map[s]||escapeHtml(s||"unknown");
}
function adminThemeAction(id,action){
  if(action==="delete"&&!confirm("Permanently delete theme "+id+"? This removes it from the hub."))return;
  fetch("/admin/themes/"+id+"/"+action,{method:"POST",headers:getHeaders()})
    .then(function(r){if(!r.ok)throw new Error("HTTP "+r.status);return r.json();})
    .then(function(){loadAdminThemes();})
    .catch(function(e){alert("Action failed: "+e.message);});
}
<\/script>
</body>
</html>`;
}
