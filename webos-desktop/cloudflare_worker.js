export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const clientIP = request.headers.get("CF-Connecting-IP");
    const blacklist = (env.BLACKLIST_IPS || "").split(",").map((ip) => ip.trim());
    const authSecret = env.KV_AUTH_SECRET;
    if (url.pathname === "/") {
      return new Response("Api is working!");
    }
    if (url.pathname.startsWith("/kv")) {
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

      const record = {
        data: payload,
        ip_address: clientIP,
        timestamp: new Date().toISOString()
      };

      await env.ASSETS_KV.put(`analytics:${crypto.randomUUID()}`, JSON.stringify(record));

      return new Response(JSON.stringify({ status: "ok" }), { status: 200, headers: corsHeaders() });
    }

    if (url.pathname === "/kv" && request.method === "GET") {
      const list = await env.ASSETS_KV.list({ prefix: "analytics:" });
      const values = await Promise.all(
        list.keys.map(async (item) => {
          const value = await env.ASSETS_KV.get(item.name);
          if (value) return { key: item.name, value: JSON.parse(value) };
          return null;
        })
      );
      const results = values.filter(Boolean);

      return new Response(JSON.stringify(results), { headers: corsHeaders() });
    }

    if (url.pathname === "/kv/delete-all" && request.method === "GET") {
      let cursor;
      let deleted = 0;

      do {
        const list = await env.ASSETS_KV.list({ cursor });
        cursor = list.cursor;

        for (const key of list.keys) {
          await env.ASSETS_KV.delete(key.name);
          deleted++;
        }
      } while (cursor);

      return new Response(JSON.stringify({ deleted }), { headers: corsHeaders() });
    }
    return new Response("Not Found", { status: 404 });
  }
};

function corsHeaders() {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS, HEAD",
    "Access-Control-Allow-Headers": "*"
  };
}
