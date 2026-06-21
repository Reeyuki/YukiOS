import os
import json
import asyncio
import time
import discord
from _jstool import CACHE_DIR
from game_data import GAMES, DESCRIPTIONS
from app_data import APPS, CATEGORY_EMOJIS
from news_data import NEWS_UPDATES

SYNC_FILE = os.path.join(CACHE_DIR, "sync_state.json")

FIRST_RUN_NEWS_MAX = 1

TYPE_EMOJIS = {
    "game": "🎮",
    "swf": "🕹️",
    "remote": "🌐",
    "megadrive": "🎮",
    "unknown": "❓"
}


def _load_state():
    if os.path.exists(SYNC_FILE):
        try:
            with open(SYNC_FILE, encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {}


def _save_state(state):
    os.makedirs(os.path.dirname(SYNC_FILE), exist_ok=True)
    with open(SYNC_FILE, "w", encoding="utf-8") as f:
        json.dump(state, f)


def _is_first_run(state):
    return not state.get("seen_game_ids") and not state.get("seen_app_titles")


def find_new_news(state):
    last_date = state.get("last_news_date", "")
    if not last_date:
        if not NEWS_UPDATES:
            return []
        state["last_news_date"] = NEWS_UPDATES[0]["date"]
        return NEWS_UPDATES[:FIRST_RUN_NEWS_MAX]
    if not NEWS_UPDATES:
        return []
    new_entries = []
    for update in NEWS_UPDATES:
        if update["date"] == last_date:
            break
        new_entries.append(update)
    if not new_entries:
        return []
    new_entries.reverse()
    state["last_news_date"] = NEWS_UPDATES[0]["date"]
    return new_entries


def find_new_games(state):
    seen = set(state.get("seen_game_ids", []))
    current = set(GAMES.keys())
    new_ids = current - seen
    if not new_ids:
        return []
    results = []
    for gid in sorted(new_ids):
        game = GAMES[gid]
        desc = DESCRIPTIONS.get(gid, "")
        results.append((gid, game, desc))
    return results


def find_new_apps(state):
    seen_titles = set(state.get("seen_app_titles", []))
    current_titles = set(a["title"] for a in APPS)
    new_titles = current_titles - seen_titles
    if not new_titles:
        return []
    return [a for a in APPS if a["title"] in new_titles]


def sync(state):
    new_news = find_new_news(state)
    if _is_first_run(state):
        state["seen_game_ids"] = list(GAMES.keys())
        state["seen_app_titles"] = [a["title"] for a in APPS]
        new_games = []
        new_apps = []
    else:
        new_games = find_new_games(state)
        new_apps = find_new_apps(state)
        if new_games:
            state["seen_game_ids"] = list(GAMES.keys())
        if new_apps:
            state["seen_app_titles"] = [a["title"] for a in APPS]
    _save_state(state)
    return new_news, new_games, new_apps


def build_news_embeds(updates):
    embeds = []
    for update in updates:
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
        content = "\n".join(lines).strip()
        embed = discord.Embed(
            title=f"📰 Yuki OS Update — {update['date']}",
            description=content[:4000],
            color=0x8b5cf6
        )
        embed.set_footer(text="Yuki OS Changelog")
        embeds.append(embed)
    return embeds


def build_game_embeds(games):
    embeds = []
    for gid, game, desc in games:
        emoji = TYPE_EMOJIS.get(game.get("type", "unknown"), "❓")
        embed = discord.Embed(
            title=f"{emoji} New Game: {game['title']}",
            color=0x8b5cf6
        )
        embed.add_field(name="Game ID", value=f"`{gid}`", inline=True)
        embed.add_field(name="Type", value=game.get("type", "unknown"), inline=True)
        if desc:
            embed.add_field(name="Description", value=desc[:1000], inline=False)
        embed.set_footer(text="Yuki OS Game Library")
        embeds.append(embed)
    return embeds


def build_app_embeds(apps):
    embeds = []
    for app in apps:
        emoji = CATEGORY_EMOJIS.get(app.get("category", ""), "📦")
        embed = discord.Embed(
            title=f"{emoji} New App: {app['title']}",
            color=0x8b5cf6
        )
        embed.add_field(name="Category", value=app.get("category", "other"), inline=True)
        embed.add_field(name="Launch Type", value=app.get("launchType", "instance"), inline=True)
        if app.get("description"):
            embed.add_field(name="Description", value=app["description"][:1000], inline=False)
        embed.set_footer(text="Yuki OS App Registry")
        embeds.append(embed)
    return embeds


async def run_sync(bot, channel_id):
    state = _load_state()
    new_news, new_games, new_apps = sync(state)

    channel = bot.get_channel(channel_id)
    if not channel:
        print(f"[sync] Channel {channel_id} not found")
        return

    for embed in build_news_embeds(new_news):
        try:
            await channel.send(embed=embed)
            await asyncio.sleep(1)
        except Exception as e:
            print(f"[sync] Failed to send news: {e}")

    for embed in build_game_embeds(new_games):
        try:
            await channel.send(embed=embed)
            await asyncio.sleep(1)
        except Exception as e:
            print(f"[sync] Failed to send game: {e}")

    for embed in build_app_embeds(new_apps):
        try:
            await channel.send(embed=embed)
            await asyncio.sleep(1)
        except Exception as e:
            print(f"[sync] Failed to send app: {e}")

    if new_news or new_games or new_apps:
        print(f"[sync] Synced {len(new_news)} news, {len(new_games)} games, {len(new_apps)} apps")
