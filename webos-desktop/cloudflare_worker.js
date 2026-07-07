let parsedBlacklist = null;
let lastBlacklistRaw = null;
let cachedKey = null;
let cachedKeySecret = null;

const Caches = {
  sessions: { data: null, time: 0, promise: null },
  games: { data: null, time: 0, promise: null },
  topTime: { data: null, time: 0, promise: null },
  stats: {},
  live: { data: null, time: 0, promise: null }
};

const CACHE_TTL = 5 * 60 * 1000;

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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const clientIP = request.headers.get("CF-Connecting-IP");

    if (!clientIP) {
      return new Response("Missing IP", { status: 400, headers: corsHeaders() });
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
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

      const inserts = events.map((event) => {
        if (event.app) event.app = normalizeApp(event.app);
        const id = crypto.randomUUID();
        return env.DB.prepare("INSERT INTO analytics (id, daily_id, timestamp, data) VALUES (?, ?, ?, ?)").bind(
          id,
          dailyId,
          timestamp,
          JSON.stringify(event)
        );
      });

      await env.DB.batch(inserts);
      return jsonResponse({ status: "ok", count: events.length });
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
      Caches.live = { data: null, time: 0, promise: null };

      return jsonResponse({
        success: true,
        imported,
        skipped,
        errors: errors.length > 0 ? errors : undefined
      });
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders("text/plain") });
  }
};

function corsHeaders(type) {
  const base = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "*"
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

.chart-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:28px}
@media(max-width:800px){.chart-grid{grid-template-columns:1fr}}
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
      <div class="nav-section-label">Admin</div>
      <div class="nav-item" data-panel="data" onclick="switchPanel('data',this)">
        <i class="fa-solid fa-database"></i>Data Management
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

var panelTitles={
  dashboard:"Dashboard",
  daily:"Daily Stats",
  playtime:"Play Time",
  sessions:"Session Analytics",
  flows:"Navigation Flows",
  entryexit:"Entry / Exit Apps",
  exploration:"Exploration Stats",
  data:"Data Management"
};

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
    return s+" App";
  }
  s=s.replace(/([a-z])([A-Z])/g,"$1 $2");
  return s.charAt(0).toUpperCase()+s.slice(1);
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

function loadAll(){
  token=document.getElementById("token").value.trim();
  if(!token){alert("Enter auth token first");return;}
  localStorage.setItem("yukios_admin_token", token);
  loadStats();loadTopTime();loadSessions();loadFlows();loadEntryExit();loadExploration();loadLive();
  document.getElementById("lastRefresh").textContent="Loaded "+new Date().toLocaleTimeString();
  if(refreshTimer)clearInterval(refreshTimer);
  refreshTimer=setInterval(function(){
    loadStats();loadTopTime();loadSessions();loadFlows();loadEntryExit();loadExploration();loadLive();
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
<\/script>
</body>
</html>`;
}
