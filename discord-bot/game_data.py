import os
import json
import time
import random

from _jstool import fetch_text, extract_js_var, CACHE_DIR

GAMES_URL = "https://github.com/Reeyuki/YukiOS/raw/refs/heads/main/webos-desktop/src/games/gamesList.js"
DESC_URL = "https://github.com/Reeyuki/YukiOS/raw/refs/heads/main/webos-desktop/src/games/gameDescriptions.js"
CACHE_FILE = os.path.join(CACHE_DIR, "games_data.json")
CACHE_TTL = 3600

GAMES = {}
DESCRIPTIONS = {}
_loaded = False


def _load():
    global GAMES, DESCRIPTIONS, _loaded

    if os.path.exists(CACHE_FILE):
        with open(CACHE_FILE, encoding="utf-8") as f:
            cached = json.load(f)
        if time.time() - cached.get("ts", 0) < CACHE_TTL:
            GAMES = cached.get("games", {})
            DESCRIPTIONS = cached.get("descriptions", {})
            _loaded = True
            return

    try:
        games_js = fetch_text(GAMES_URL)
        desc_js = fetch_text(DESC_URL)

        GAMES = extract_js_var(games_js, "appMap")
        DESCRIPTIONS = extract_js_var(desc_js, "descriptionMap")

        os.makedirs(os.path.dirname(CACHE_FILE), exist_ok=True)
        with open(CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump({"games": GAMES, "descriptions": DESCRIPTIONS, "ts": time.time()}, f)
        _loaded = True
    except Exception as e:
        print(f"[game_data] Fetch failed: {e}")
        if GAMES or DESCRIPTIONS:
            print("[game_data] Using stale cached data")
        else:
            print("[game_data] No data available — bot may have limited functionality")
        _loaded = True


def init():
    _load()


def search_games(query):
    query = query.lower()
    results = []
    for gid, game in GAMES.items():
        if query in gid.lower() or query in game.get("title", "").lower():
            results.append((gid, game))
    return results


def get_random_game():
    if not GAMES:
        return None, None
    gid = random.choice(list(GAMES.keys()))
    return gid, GAMES[gid]


def get_description(game_id):
    return DESCRIPTIONS.get(game_id)


def count_by_type():
    counts = {}
    for game in GAMES.values():
        t = game.get("type", "unknown")
        counts[t] = counts.get(t, 0) + 1
    return counts


def has_url(game):
    return bool(game.get("url")) or bool(game.get("swf"))


def get_stats():
    total = len(GAMES)
    with_desc = sum(1 for gid in GAMES if gid in DESCRIPTIONS)
    with_url = sum(1 for game in GAMES.values() if has_url(game))
    swf_count = sum(1 for game in GAMES.values() if game.get("type") == "swf")
    online_count = sum(1 for game in GAMES.values() if has_url(game) and game.get("url", "").startswith("http"))
    type_counts = count_by_type()
    return {
        "total": total,
        "with_descriptions": with_desc,
        "with_url": with_url,
        "swf": swf_count,
        "online": online_count,
        "by_type": type_counts
    }


init()
