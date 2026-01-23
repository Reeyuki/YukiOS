#!/usr/bin/env python3
import os
import subprocess
from pathlib import Path
from bs4 import BeautifulSoup
from urllib.parse import quote_plus
from datetime import datetime

SYSTEM_APPS = {"explorer", "computer", "terminal", "notepad", "browser", "cameraApp", "music"}
INDEX_FILE = Path("webos-desktop/dist/index.html")
DESKTOP_DIR = Path("desktop")
STATIC_DIR = Path("static")
SITEMAP_FILE = DESKTOP_DIR / "sitemap.xml"
ROBOTS_FILE = DESKTOP_DIR / "robots.txt"

def run(cmd, cwd=None):
    subprocess.run(cmd, shell=True, check=True, cwd=cwd)

def build_webos_desktop():
    run("pnpm install", cwd="webos-desktop")
    run("pnpm build", cwd="webos-desktop")

def prepare_desktop_folder():
    DESKTOP_DIR.mkdir(parents=True, exist_ok=True)

    run(f"cp -r webos-desktop/dist/* {DESKTOP_DIR}/")

    (DESKTOP_DIR / "static").mkdir(exist_ok=True)
    for item in STATIC_DIR.iterdir():
        if item.name == "gtavc":
            run(f"rsync -a --exclude='assets' {item}/ {DESKTOP_DIR}/static/gtavc/")
        else:
            run(f"cp -r {item} {DESKTOP_DIR}/static/")

    for f in ["favicon.ico"]:
        if Path(f).exists():
            run(f"cp {f} {DESKTOP_DIR}/")

    (DESKTOP_DIR / ".nojekyll").touch()
    (DESKTOP_DIR / "play").mkdir(parents=True, exist_ok=True)


def parse_games():
    with INDEX_FILE.open(encoding="utf-8") as f:
        soup = BeautifulSoup(f, "html.parser")
    games = []
    for div in soup.select("div.icon.selectable[data-app]"):
        app_id = div.get("data-app", "").strip()
        if not app_id or app_id in SYSTEM_APPS:
            continue
        name_divs = div.find_all("div")
        game_name = name_divs[-1].get_text(strip=True) if name_divs else app_id
        img_tag = div.find("img")
        img_src = img_tag["src"] if img_tag and img_tag.has_attr("src") else "/static/icons/default.webp"
        games.append({
            "app_id": app_id,
            "name": game_name,
            "img": img_src,
            "slug": quote_plus(app_id.lower())
        })
    return games

def create_play_pages(games):
    sitemap_entries = []
    now = datetime.utcnow().date().isoformat()

    for game in games:
        app_id = game["app_id"]
        game_name = game["name"]
        img_src = game["img"]
        slug = game["slug"]

        play_dir = DESKTOP_DIR / "play" / app_id
        play_dir.mkdir(parents=True, exist_ok=True)
        index_file = play_dir / "index.html"

        absolute_img = f"https://reeyuki.github.io{img_src}"
        page_url = f"https://reeyuki.github.io/play/{app_id}/"

        index_file.write_text(f"""<!DOCTYPE html>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<title>{game_name} – Play Online Free in Browser | Yuki OS</title>

<meta name="description" content="Play {game_name} online for free in your browser on Yuki OS. No downloads, no installs, instant launch, fast loading, and smooth gameplay.">

<meta name="keywords" content="{game_name} online, play {game_name} browser, {game_name} free, {game_name} no download, browser games, yuki os">

<link rel="canonical" href="{page_url}">

<meta property="og:type" content="website">
<meta property="og:title" content="{game_name} – Play Online Free in Browser | Yuki OS">
<meta property="og:description" content="Play {game_name} instantly online. No downloads. No installs. Free browser gaming on Yuki OS.">
<meta property="og:url" content="{page_url}">
<meta property="og:image" content="{absolute_img}">
<meta property="og:site_name" content="Yuki OS">
<meta property="og:locale" content="en_US">

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{game_name} – Play Online Free | Yuki OS">
<meta name="twitter:description" content="Play {game_name} online instantly in your browser. No downloads. Free gaming with Yuki OS.">
<meta name="twitter:image" content="{absolute_img}">

<script type="application/ld+json">
{{
  "@context": "https://schema.org",
  "@type": "VideoGame",
  "name": "{game_name}",
  "url": "{page_url}",
  "image": "{absolute_img}",
  "applicationCategory": "Game",
  "operatingSystem": "Web Browser",
  "publisher": {{
    "@type": "Organization",
    "name": "Yuki OS",
    "url": "https://reeyuki.github.io"
  }},
  "offers": {{
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD",
    "availability": "https://schema.org/InStock"
  }}
}}
</script>

<script>
setTimeout(function() {{
  window.location.replace("/index.html?game={app_id}");
}}, 30);
</script>

</head>
<body>
<main>
  <h1>Play {game_name} Online</h1>
  <p>Launching {game_name} on Yuki OS...</p>
  <p>Free browser game • No downloads • No installs • Instant play</p>
  <a href="/index.html?game={app_id}" aria-label="Play {game_name} now">Start Game</a>
</main>
</body>
</html>
""", encoding="utf-8")

        sitemap_entries.append(
            f"""  <url>
    <loc>{page_url}</loc>
    <lastmod>{now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>"""
        )

    return sitemap_entries

def write_sitemap(sitemap_entries):
    SITEMAP_FILE.write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        '  <url>\n'
        '    <loc>https://reeyuki.github.io/</loc>\n'
        f'    <lastmod>{datetime.utcnow().date().isoformat()}</lastmod>\n'
        '    <changefreq>daily</changefreq>\n'
        '    <priority>1.0</priority>\n'
        '  </url>\n'
        + "\n".join(sitemap_entries) +
        "\n</urlset>\n",
        encoding="utf-8"
    )

def write_robots():
    ROBOTS_FILE.write_text(
        "User-agent: *\n"
        "Allow: /\n\n"
        "Sitemap: https://reeyuki.github.io/sitemap.xml\n",
        encoding="utf-8"
    )

print("Step 1: Build webos-desktop")
build_webos_desktop()

print("Step 2: Prepare desktop folder")
prepare_desktop_folder()

print("Step 3: Parse games from index.html")
games = parse_games()
print(f"Found {len(games)} games.")

print("Step 4: Create SEO-optimized play pages")
sitemap_entries = create_play_pages(games)

print("Step 5: Write sitemap.xml")
write_sitemap(sitemap_entries)

print("Step 6: Write robots.txt")
write_robots()

print("Deployment preparation complete. SEO architecture optimized for indexing, crawling, and rich results.")
