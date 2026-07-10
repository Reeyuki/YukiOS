import discord
from discord import app_commands
from discord.ext import commands
import os
import asyncio
import random
import re
import subprocess
from dotenv import load_dotenv

from game_data import GAMES, DESCRIPTIONS, search_games, get_random_game, get_description, get_stats
from news_data import NEWS_UPDATES, get_latest_news, get_news_by_date, format_news_embed, format_news_compact, news_count
from app_data import APPS, search_apps, get_app_by_key, get_app_stats, CATEGORY_EMOJIS

load_dotenv()

TOKEN = os.getenv("DISCORD_TOKEN")
GUILD_ID = os.getenv("GUILD_ID")
SYNC_GUILD_ID = os.getenv("SYNC_GUILD_ID")

intents = discord.Intents.default()
intents.message_content = True
bot = commands.Bot(command_prefix="!", intents=intents)

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
CHANNEL_ID = int(os.getenv("COMMIT_CHANNEL_ID"))

TYPE_EMOJIS = {
    "game": "🎮",
    "swf": "🕹️",
    "remote": "🌐",
    "megadrive": "🎮",
    "unknown": "❓"
}

async def commit_sync():
    await bot.wait_until_ready()
    channel = bot.get_channel(CHANNEL_ID)
    if not channel:
        print(f"[commit-sync] Channel {CHANNEL_ID} not found")
        return

    print(f"[commit-sync] Scanning channel {CHANNEL_ID} for existing commit messages...")

    existing_shas = set()
    try:
        async for message in channel.history(limit=200):
            for embed in message.embeds:
                for field in embed.fields:
                    if field.name == "Commit":
                        match = re.search(r'`([a-f0-9]{7,40})`', field.value)
                        if match:
                            existing_shas.add(match.group(1))
    except Exception as e:
        print(f"[commit-sync] Failed to fetch messages: {e}")
        return

    print(f"[commit-sync] Found {len(existing_shas)} existing commit SHAs in channel")

    try:
        result = subprocess.run(
            ["git", "log", "--since=1 month ago", "--format=%H %s"],
            capture_output=True, text=True, cwd=REPO_ROOT
        )
    except Exception as e:
        print(f"[commit-sync] Failed to run git log: {e}")
        return

    unsent = []
    for line in result.stdout.strip().split("\n"):
        if not line:
            continue
        parts = line.split(" ", 1)
        sha = parts[0]
        msg = parts[1] if len(parts) > 1 else ""
        short_sha = sha[:7]
        if short_sha not in existing_shas:
            unsent.append((short_sha, msg))

    print(f"[commit-sync] Found {len(unsent)} unsent commits from last month, sending...")
    for short_sha, msg in unsent:
        embed = discord.Embed(
            title="🚀 New Commit",
            color=0x8b5cf6
        )
        embed.add_field(name="Commit", value=f"`{short_sha}` — {msg}", inline=False)
        embed.set_footer(text="YukiOS Changelog")
        try:
            await channel.send(embed=embed)
            await asyncio.sleep(1)
        except Exception as e:
            print(f"[commit-sync] Failed to send commit {short_sha}: {e}")

@bot.event
async def on_ready():
    await bot.tree.sync()
    print(f"YukiOS Bot ready as {bot.user}")
    asyncio.create_task(commit_sync())

game_group = app_commands.Group(name="game", description="YukiOS Game Library commands")

@game_group.command(name="search", description="Search games in the YukiOS library")
@app_commands.describe(query="Search term (game name or ID)")
async def game_search(interaction: discord.Interaction, query: str):
    await interaction.response.defer()
    results = search_games(query)
    if not results:
        await interaction.followup.send(f"No games found for `{query}`.", ephemeral=True)
        return
    results = results[:25]
    lines = []
    for gid, game in results:
        emoji = TYPE_EMOJIS.get(game.get("type", "unknown"), "❓")
        lines.append(f"{emoji} **{game['title']}** (`{gid}`)")
    embed = discord.Embed(
        title=f"Game Search: {query}",
        description="\n".join(lines),
        color=0x8b5cf6
    )
    embed.set_footer(text=f"{len(results)} result(s) | YukiOS Game Library")
    await interaction.followup.send(embed=embed)

@game_group.command(name="info", description="Get detailed info about a specific game")
@app_commands.describe(game_id="Game ID (use /game search to find it)")
async def game_info(interaction: discord.Interaction, game_id: str):
    await interaction.response.defer()
    game = GAMES.get(game_id)
    if not game:
        await interaction.followup.send(f"Game `{game_id}` not found. Use `/game search` to find it.", ephemeral=True)
        return
    desc = get_description(game_id)
    emoji = TYPE_EMOJIS.get(game.get("type", "unknown"), "❓")
    embed = discord.Embed(title=f"{emoji} {game['title']}", color=0x8b5cf6)
    embed.add_field(name="Game ID", value=f"`{game_id}`", inline=True)
    embed.add_field(name="Type", value=game.get("type", "unknown"), inline=True)
    if "url" in game:
        embed.add_field(name="URL", value=game["url"][:100], inline=False)
    if "swf" in game:
        embed.add_field(name="SWF", value=game["swf"][:100], inline=False)
    if desc:
        embed.add_field(name="Description", value=desc[:1000], inline=False)
    embed.set_footer(text="YukiOS Game Library")
    await interaction.followup.send(embed=embed)

@game_group.command(name="random", description="Get a random game from the library")
async def game_random(interaction: discord.Interaction):
    await interaction.response.defer()
    gid, game = get_random_game()
    desc = get_description(gid)
    emoji = TYPE_EMOJIS.get(game.get("type", "unknown"), "❓")
    embed = discord.Embed(title=f"{emoji} Random Game: {game['title']}", color=0x8b5cf6)
    embed.add_field(name="Game ID", value=f"`{gid}`", inline=True)
    embed.add_field(name="Type", value=game.get("type", "unknown"), inline=True)
    if desc:
        embed.add_field(name="Description", value=desc[:1000], inline=False)
    embed.set_footer(text="YukiOS Game Library")
    await interaction.followup.send(embed=embed)

@game_group.command(name="stats", description="Show game library statistics")
async def game_stats(interaction: discord.Interaction):
    await interaction.response.defer()
    s = get_stats()
    lines = [
        f"**Total Games:** {s['total']}",
        f"**Playable:** {s['with_url']} ({s['online']} hosted online, {s['swf']} Flash)",
        f"**With Descriptions:** {s['with_descriptions']}",
        ""
    ]
    for t, c in sorted(s["by_type"].items(), key=lambda x: -x[1]):
        emoji = TYPE_EMOJIS.get(t, "❓")
        lines.append(f"{emoji} {t}: {c}")
    embed = discord.Embed(
        title="📊 YukiOS Game Library",
        description="\n".join(lines),
        color=0x8b5cf6
    )
    embed.set_footer(text=f"Sources: gamesList.js + gameDescriptions.js")
    await interaction.followup.send(embed=embed)

news_group = app_commands.Group(name="news", description="YukiOS Changelog & News commands")

@news_group.command(name="latest", description="Show the latest YukiOS update")
async def news_latest(interaction: discord.Interaction):
    await interaction.response.defer()
    latest = get_latest_news()
    if not latest:
        await interaction.followup.send("No news updates found.", ephemeral=True)
        return
    content = format_news_embed(latest)
    embed = discord.Embed(
        title=f"📰 YukiOS Update - {latest['date']}",
        description=content[:4000],
        color=0x8b5cf6
    )
    embed.set_footer(text=f"Update #{news_count()} | YukiOS Changelog")
    await interaction.followup.send(embed=embed)

@news_group.command(name="list", description="List recent YukiOS updates")
@app_commands.describe(count="Number of updates to show (default 3)")
async def news_list(interaction: discord.Interaction, count: int = 3):
    await interaction.response.defer()
    count = max(1, min(count, 5))
    content = format_news_compact(NEWS_UPDATES, count)
    embed = discord.Embed(
        title="📰 Recent YukiOS Changelog",
        description=content[:4000],
        color=0x8b5cf6
    )
    embed.set_footer(text=f"Use /news date <date> for a specific entry | Total: {news_count()} updates")
    await interaction.followup.send(embed=embed)

@news_group.command(name="date", description="Show news for a specific date")
@app_commands.describe(date="Date string (e.g. 'June 20, 2026' or 'March 2026')")
async def news_date(interaction: discord.Interaction, date: str):
    await interaction.response.defer()
    update = get_news_by_date(date)
    if not update:
        available = [u["date"] for u in NEWS_UPDATES[:10]]
        lines = "\n".join(f"• {d}" for d in available)
        await interaction.followup.send(
            f"No news found for `{date}`. Recent dates:\n{lines}",
            ephemeral=True
        )
        return
    content = format_news_embed(update)
    embed = discord.Embed(
        title=f"📰 YukiOS Update - {update['date']}",
        description=content[:4000],
        color=0x8b5cf6
    )
    embed.set_footer(text="YukiOS Changelog")
    await interaction.followup.send(embed=embed)

app_group = app_commands.Group(name="app", description="YukiOS App Registry commands")

@app_group.command(name="list", description="List all registered apps")
@app_commands.describe(category="Filter by category (system, development, graphics, games, help, internet, media, office)")
async def app_list(interaction: discord.Interaction, category: str = None):
    await interaction.response.defer()
    apps = APPS
    if category:
        apps = [a for a in apps if a.get("category", "").lower() == category.lower()]
        if not apps:
            cats = sorted(set(a.get("category", "uncategorized") for a in APPS))
            await interaction.followup.send(f"No apps in category `{category}`. Available: {', '.join(cats)}", ephemeral=True)
            return
    lines = []
    for app in apps:
        emoji = CATEGORY_EMOJIS.get(app.get("category", ""), "📦")
        lines.append(f"{emoji} **{app['title']}** — {app.get('category', 'other')}")
    chunks = [lines[i:i+30] for i in range(0, len(lines), 30)]
    for i, chunk in enumerate(chunks):
        title = f"📱 YukiOS Apps ({category or 'all'})" if i == 0 else None
        desc = "\n".join(chunk)
        embed = discord.Embed(
            title=title,
            description=desc[:4000],
            color=0x8b5cf6
        )
        embed.set_footer(text=f"Page {i+1}/{len(chunks)} | {len(apps)} app(s)")
        await interaction.followup.send(embed=embed)

@app_group.command(name="info", description="Get details about a specific app")
@app_commands.describe(name="App name or service key to search")
async def app_info(interaction: discord.Interaction, name: str):
    await interaction.response.defer()
    app = get_app_by_key(name)
    if not app:
        results = search_apps(name)
        if not results:
            await interaction.followup.send(f"No app found for `{name}`.", ephemeral=True)
            return
        app = results[0]
        if len(results) > 1:
            matches = "\n".join(f"• {a['title']}" for a in results[:10])
            await interaction.followup.send(f"Multiple matches for `{name}`. Try:\n{matches}", ephemeral=True)
            return
    emoji = CATEGORY_EMOJIS.get(app.get("category", ""), "📦")
    embed = discord.Embed(title=f"{emoji} {app['title']}", color=0x8b5cf6)
    if app.get("serviceKey"):
        embed.add_field(name="Service Key", value=f"`{app['serviceKey']}`", inline=True)
    embed.add_field(name="Category", value=app.get("category", "other"), inline=True)
    embed.add_field(name="Launch Type", value=app.get("launchType", "instance"), inline=True)
    if app.get("targetUrl"):
        embed.add_field(name="URL", value=app["targetUrl"][:100], inline=False)
    if app.get("source"):
        embed.add_field(name="Source", value=app["source"][:100], inline=False)
    if app.get("description"):
        embed.add_field(name="Description", value=app["description"][:1000], inline=False)
    embed.set_footer(text="YukiOS App Registry")
    await interaction.followup.send(embed=embed)

@app_group.command(name="stats", description="Show app registry statistics")
async def app_stats(interaction: discord.Interaction):
    await interaction.response.defer()
    s = get_app_stats()
    lines = [
        f"**Total Apps:** {s['total']}",
        f"**Native Apps:** {s['native_apps']}",
        f"**Web Apps:** {s['web_apps']}",
        ""
    ]
    for cat, c in sorted(s["by_category"].items(), key=lambda x: -x[1]):
        emoji = CATEGORY_EMOJIS.get(cat, "📦")
        lines.append(f"{emoji} {cat.title()}: {c}")
    lines.append("")
    lines.append("**By Launch Type:**")
    for lt, c in sorted(s["by_launch_type"].items(), key=lambda x: -x[1]):
        lines.append(f"  • {lt}: {c}")
    embed = discord.Embed(
        title="📱 YukiOS App Registry",
        description="\n".join(lines),
        color=0x8b5cf6
    )
    embed.set_footer(text="Source: AppManifest.js")
    await interaction.followup.send(embed=embed)

bot.tree.add_command(game_group)
bot.tree.add_command(news_group)
bot.tree.add_command(app_group)

if __name__ == "__main__":
    if not TOKEN:
        print("Error: DISCORD_TOKEN not set in .env file")
        exit(1)
    bot.run(TOKEN)
