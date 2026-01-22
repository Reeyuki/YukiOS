export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const clientIP = request.headers.get("CF-Connecting-IP");
    const blacklist = (env.BLACKLIST_IPS || "").split(",").map((ip) => ip.trim());
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
      if (blacklist.includes(clientIP)) {
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

      return new Response(JSON.stringify({ ip, deleted: res.meta.changes }), { headers: corsHeaders() });
    }

    if (url.pathname === "/admin/delete-all" && request.method === "GET") {
      const res = await env.DB.prepare("DELETE FROM analytics").run();
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
.card{max-width:600px;margin:auto;background:#161616;padding:20px;border-radius:10px}
input,button{width:100%;padding:10px;margin-top:10px;border-radius:6px;border:none}
button{background:#4f46e5;color:white;font-weight:bold;cursor:pointer}
pre{background:#000;padding:10px;border-radius:6px;max-height:300px;overflow:auto}
</style>
</head>
<body>
<div class="card">
<h2>Admin Panel</h2>
<input id="token" placeholder="Auth Token">
<input id="ip" placeholder="IP address to delete">
<button onclick="deleteByIp()">Delete by IP</button>
<button onclick="deleteAll()">Delete All</button>
<button onclick="listData()">List Records</button>
<pre id="out"></pre>
</div>

<script>
let token = ""

function headers(){
  return { "Authorization":"Bearer " + token }
}

function log(x){
  document.getElementById("out").textContent = JSON.stringify(x,null,2)
}

function deleteByIp(){
  token = document.getElementById("token").value
  const ip = document.getElementById("ip").value
  fetch("/admin/delete-by-ip?ip="+encodeURIComponent(ip),{headers:headers()})
  .then(r=>r.json()).then(log)
}

function deleteAll(){
  token = document.getElementById("token").value
  fetch("/admin/delete-all",{headers:headers()})
  .then(r=>r.json()).then(log)
}

function listData(){
  token = document.getElementById("token").value
  fetch("/admin/list",{headers:headers()})
  .then(r=>r.json()).then(log)
}
</script>
</body>
</html>
`;
}
