import os
import json
import time

from _jstool import fetch_text, extract_js_var, extract_js_string_var, CACHE_DIR

MANIFEST_URL = "https://github.com/Reeyuki/YukiOS/raw/refs/heads/main/webos-desktop/src/registry/AppManifest.js"
CACHE_FILE = os.path.join(CACHE_DIR, "app_data.json")
CACHE_TTL = 3600

APPS = []
_loaded = False


def _load():
    global APPS, _loaded

    if os.path.exists(CACHE_FILE):
        with open(CACHE_FILE, encoding="utf-8") as f:
            cached = json.load(f)
        if time.time() - cached.get("ts", 0) < CACHE_TTL:
            APPS = cached.get("apps", [])
            _loaded = True
            return

    try:
        manifest_js = fetch_text(MANIFEST_URL)
        cdn_base = extract_js_string_var(manifest_js, "CDN_BASE") or ""
        apps = extract_js_var(manifest_js, "APP_MANIFESTS", {"CDN_BASE": cdn_base})
        APPS = apps

        os.makedirs(os.path.dirname(CACHE_FILE), exist_ok=True)
        with open(CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump({"apps": APPS, "ts": time.time()}, f)
        _loaded = True
    except Exception as e:
        print(f"[app_data] Fetch failed: {e}")
        if APPS:
            print("[app_data] Using stale cached data")
        else:
            print("[app_data] No data available")
        _loaded = True


def init():
    _load()


def search_apps(query):
    query = query.lower()
    results = []
    for app in APPS:
        title = app.get("title", "")
        sid = app.get("serviceKey", "")
        if query in title.lower() or query in sid.lower():
            results.append(app)
    return results


def get_app_by_key(service_key):
    for app in APPS:
        if app.get("serviceKey") == service_key:
            return app
    for app in APPS:
        for pat in app.get("windowIdPatterns", []):
            if service_key.lower() in pat.lower():
                return app
    return None


def get_app_by_index(idx):
    if 0 <= idx < len(APPS):
        return APPS[idx]
    return None


def get_app_stats():
    total = len(APPS)
    by_category = {}
    by_launch_type = {}
    web_apps = 0
    native_apps = 0
    for app in APPS:
        cat = app.get("category", "uncategorized")
        by_category[cat] = by_category.get(cat, 0) + 1
        lt = app.get("launchType", "instance")
        by_launch_type[lt] = by_launch_type.get(lt, 0) + 1
        if app.get("targetUrl") or app.get("source"):
            web_apps += 1
        else:
            native_apps += 1
    return {
        "total": total,
        "by_category": by_category,
        "by_launch_type": by_launch_type,
        "web_apps": web_apps,
        "native_apps": native_apps
    }


def get_category_counts(category):
    return [a for a in APPS if a.get("category", "").lower() == category.lower()]


CATEGORY_EMOJIS = {
    "system": "⚙️",
    "development": "💻",
    "graphics": "🎨",
    "games": "🎮",
    "help": "📖",
    "internet": "🌐",
    "media": "🎵",
    "office": "📝"
}


init()
