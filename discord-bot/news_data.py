import os
import json
import time

from _jstool import fetch_text, CACHE_DIR

NEWS_URL = "https://github.com/Reeyuki/YukiOS/raw/refs/heads/main/webos-desktop/src/news.json"
CACHE_FILE = os.path.join(CACHE_DIR, "news_data.json")
CACHE_TTL = 3600

NEWS_UPDATES = []
_loaded = False


def _load():
    global NEWS_UPDATES, _loaded

    if os.path.exists(CACHE_FILE):
        with open(CACHE_FILE, encoding="utf-8") as f:
            cached = json.load(f)
        if time.time() - cached.get("ts", 0) < CACHE_TTL:
            NEWS_UPDATES = cached.get("updates", [])
            _loaded = True
            return

    try:
        updates = json.loads(fetch_text(NEWS_URL))
        NEWS_UPDATES = updates

        os.makedirs(os.path.dirname(CACHE_FILE), exist_ok=True)
        with open(CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump({"updates": NEWS_UPDATES, "ts": time.time()}, f)
        _loaded = True
    except Exception as e:
        print(f"[news_data] Fetch failed: {e}")
        if NEWS_UPDATES:
            print("[news_data] Using stale cached data")
        else:
            print("[news_data] No data available")
        _loaded = True


def init():
    _load()


def get_latest_news():
    if not NEWS_UPDATES:
        return None
    return NEWS_UPDATES[0]


def get_news_by_date(date_str):
    for update in NEWS_UPDATES:
        if update["date"].lower() == date_str.lower():
            return update
    return None


def format_news_embed(update):
    lines = []
    for section in update.get("sections", []):
        lines.append(f"**{section['title']}**")
        for item in section.get("items", []):
            title = item[1] if len(item) > 1 else ""
            desc = item[2] if len(item) > 2 else ""
            if desc:
                lines.append(f"**{title}** — {desc}")
            else:
                lines.append(f"{title}")
        lines.append("")
    return "\n".join(lines).strip()


def format_news_compact(updates, max_count=5):
    lines = []
    for update in updates[:max_count]:
        lines.append(f"**{update['date']}**")
        all_items = []
        for section in update.get("sections", []):
            for item in section.get("items", []):
                all_items.append((section["title"], item))
        for section_title, item in all_items[:4]:
            title = item[1] if len(item) > 1 else ""
            desc = item[2] if len(item) > 2 else ""
            lines.append(f"  **{title}** — {desc[:120]}")
        if len(all_items) > 4:
            lines.append(f"  *+{len(all_items) - 4} more*")
        lines.append("")
    return "\n".join(lines).strip()


def news_count():
    return len(NEWS_UPDATES)


init()
