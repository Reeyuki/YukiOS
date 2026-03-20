export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const clientIP = request.headers.get("CF-Connecting-IP");
    const rawBlacklist = (env.BLACKLIST_IPS || "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);

    function ipBlocked(ip) {
      for (const rule of rawBlacklist) {
        if (rule === ip) return true;
        if (rule.includes("*")) {
          const prefix = rule.split("*")[0];
          if (ip.startsWith(prefix)) return true;
        }
      }
      return false;
    }

    async function sendEmbed(embed) {
      if (!env.DISCORD_WEBHOOK_URL) return;
      await fetch(env.DISCORD_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ embeds: [embed] })
      });
    }

    const authSecret = env.KV_AUTH_SECRET;

    if (url.pathname === "/") {
      return new Response("Api is working!");
    }

    if (url.pathname === "/admin") {
      return new Response(adminHTML(), {
        headers: { "Content-Type": "text/html" }
      });
    }

    if (url.pathname.startsWith("/admin")) {
      const authHeader = request.headers.get("Authorization");
      if (authHeader !== `Bearer ${authSecret}`) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders() });
      }
    }

    if (url.pathname === "/analytics" && (request.method === "OPTIONS" || request.method === "HEAD")) {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    if (url.pathname === "/analytics" && request.method === "POST") {
      if (ipBlocked(clientIP)) {
        return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders() });
      }

      let payload;
      try {
        payload = await request.json();
      } catch {
        return new Response(JSON.stringify({ error: "invalid json" }), { status: 400, headers: corsHeaders() });
      }

      const id = crypto.randomUUID();
      const timestamp = new Date().toISOString();

      await env.DB.prepare("INSERT INTO analytics (id, ip, timestamp, data) VALUES (?, ?, ?, ?)")
        .bind(id, clientIP, timestamp, JSON.stringify(payload))
        .run();

      await sendEmbed({
        title: "New Analytics Event",
        color: 3066993,
        fields: [
          { name: "ID", value: id, inline: false },
          { name: "IP", value: clientIP, inline: false },
          { name: "Timestamp", value: timestamp, inline: false }
        ],
        description: "```json\n" + JSON.stringify(payload, null, 2) + "\n```",
        timestamp
      });

      return new Response(JSON.stringify({ status: "ok", id }), { status: 200, headers: corsHeaders() });
    }

    if (url.pathname === "/admin/list" && request.method === "GET") {
      const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);
      const offset = parseInt(url.searchParams.get("offset") || "0");

      const result = await env.DB.prepare(
        "SELECT id, ip, timestamp, data FROM analytics ORDER BY timestamp DESC LIMIT ? OFFSET ?"
      )
        .bind(limit, offset)
        .all();

      return new Response(JSON.stringify({ results: result.results }), { headers: corsHeaders() });
    }

    if (url.pathname === "/admin/delete-by-ip" && request.method === "GET") {
      const ip = url.searchParams.get("ip");
      if (!ip) {
        return new Response(JSON.stringify({ error: "ip required" }), { status: 400, headers: corsHeaders() });
      }

      const res = await env.DB.prepare("DELETE FROM analytics WHERE ip = ?").bind(ip).run();

      await sendEmbed({
        title: "Analytics Deleted by IP",
        color: 15844367,
        fields: [
          { name: "IP", value: ip, inline: false },
          { name: "Deleted Rows", value: String(res.meta.changes), inline: false }
        ],
        timestamp: new Date().toISOString()
      });

      return new Response(JSON.stringify({ ip, deleted: res.meta.changes }), { headers: corsHeaders() });
    }

    if (url.pathname === "/admin/delete-all" && request.method === "GET") {
      const res = await env.DB.prepare("DELETE FROM analytics").run();

      await sendEmbed({
        title: "All Analytics Deleted",
        color: 10038562,
        fields: [{ name: "Deleted Rows", value: String(res.meta.changes), inline: false }],
        timestamp: new Date().toISOString()
      });

      return new Response(JSON.stringify({ deleted: res.meta.changes }), { headers: corsHeaders() });
    }

    return new Response("Not Found", { status: 404 });
  }
};

function corsHeaders() {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS, HEAD, GET",
    "Access-Control-Allow-Headers": "*"
  };
}

function adminHTML() {
  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Admin Panel</title>
<style>
body{font-family:Arial;background:#0f0f0f;color:#fff;padding:30px}
.card{max-width:1000px;margin:auto;background:#161616;padding:20px;border-radius:10px}
input,button{width:100%;padding:10px;margin-top:10px;border-radius:6px;border:none}
button{background:#4f46e5;color:white;font-weight:bold;cursor:pointer}
pre{background:#000;padding:10px;border-radius:6px;max-height:400px;overflow:auto;font-size:13px}
.item{border:1px solid #2a2a2a;padding:10px;border-radius:8px;margin-top:10px}
.meta{font-size:12px;color:#aaa;margin-bottom:6px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;margin-top:15px}
.game{background:#0b0b0b;border:1px solid #2a2a2a;border-radius:8px;padding:12px;text-align:center}
.game h3{margin:0;font-size:14px;color:#c7d2fe}
.game p{margin:6px 0 0 0;font-size:22px;font-weight:bold}
.section{margin-top:25px;padding-top:15px;border-top:1px solid #2a2a2a}
</style>
</head>
<body>
<div class="card">
<h2>Admin Panel</h2>
<input id="token" placeholder="Auth Token">
<input id="ip" placeholder="IP address to delete">
<button onclick="deleteByIp()">Delete by IP</button>
<button onclick="listData()">List Raw Records</button>
<button onclick="listGames()">List Game Play Counts</button>

<div class="section">
<h3>Output</h3>
<div id="out"></div>
</div>

<div class="section">
<h3>Game Play Counts</h3>
<div id="games"></div>
</div>
</div>

<script>
let token = ""

function headers(){
  return { "Authorization":"Bearer " + token }
}

function deleteByIp(){
  const token = document.getElementById("token").value
  const ip = document.getElementById("ip").value
  if(!confirm("Are you sure you want to delete by this IP?")) return
  fetch("/admin/delete-by-ip?ip="+encodeURIComponent(ip),{headers:headers()})
    .then(r=>r.json())
    .then(renderRaw)
}

function listData(){
  token = document.getElementById("token").value
  fetch("/admin/list?limit=1000",{headers:headers()})
  .then(r=>r.json()).then(renderList)
}

function listGames(){
  token = document.getElementById("token").value
  fetch("/admin/list?limit=5000",{headers:headers()})
  .then(r=>r.json()).then(renderGames)
}

function renderRaw(data){
  document.getElementById("out").innerHTML = "<pre>"+JSON.stringify(data,null,2)+"</pre>"
}

function renderList(data){
  const root = document.getElementById("out")
  root.innerHTML = ""
  if(!data.results || !data.results.length){
    root.innerHTML = "<pre>No records</pre>"
    return
  }

  data.results.forEach(r=>{
    let parsed = null
    try{ parsed = JSON.parse(r.data) }catch{}

    const div = document.createElement("div")
    div.className = "item"

    const meta = document.createElement("div")
    meta.className = "meta"
    meta.textContent = "IP: " + r.ip + " | " + r.timestamp

    const pre = document.createElement("pre")
    pre.textContent = parsed ? JSON.stringify(parsed,null,2) : r.data

    div.appendChild(meta)
    div.appendChild(pre)
    root.appendChild(div)
  })
}

function renderGames(data){
  const root = document.getElementById("games")
  root.innerHTML = ""

  if(!data.results || !data.results.length){
    root.innerHTML = "<pre>No records</pre>"
    return
  }

  const counts = {}

  data.results.forEach(r=>{
    let parsed = null
    try{ parsed = JSON.parse(r.data) }catch{}
    if(!parsed) return
    if(parsed.event !== "launch") return
    if(!parsed.app) return
    counts[parsed.app] = (counts[parsed.app] || 0) + 1
  })

  const entries = Object.entries(counts).sort((a,b)=>b[1]-a[1])

  if(!entries.length){
    root.innerHTML = "<pre>No game launches found</pre>"
    return
  }

  const grid = document.createElement("div")
  grid.className = "grid"

  entries.forEach(([app,count])=>{
    const card = document.createElement("div")
    card.className = "game"
    const h = document.createElement("h3")
    h.textContent = app
    const p = document.createElement("p")
    p.textContent = count
    card.appendChild(h)
    card.appendChild(p)
    grid.appendChild(card)
  })

  root.appendChild(grid)
}
</script>
</body>
</html>
`;
}
