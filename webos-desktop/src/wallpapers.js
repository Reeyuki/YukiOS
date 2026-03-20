import { FileKind } from "./fs.js";
import { SystemUtilities } from "./system.js";

export const videos = [
  "https://motionbgs.com/media/8008/above-the-stormworld.3840x2160.mp4",
  "https://motionbgs.com/media/9251/giyu-tomioka-snow-blossoms.3840x2160.mp4",
  "https://motionbgs.com/media/9295/st-michaels-mount.3840x2160.mp4",
  "https://motionbgs.com/media/9147/yuji-itadori-city.3840x2160.mp4",
  "https://motionbgs.com/media/9275/reze-blue-butterfly.3840x2160.mp4",
  "https://motionbgs.com/media/9293/hunt-showdown-death-roots.3840x2160.mp4",
  "https://motionbgs.com/media/9136/mist-over-the-pines.3840x2160.mp4",
  "https://motionbgs.com/media/9289/megumi-fushiguro-jujutsu-kaisen.3840x2160.mp4",
  "https://motionbgs.com/media/9297/before-the-road.3840x2160.mp4",
  "https://motionbgs.com/media/9124/girl-bathed-in-blue-flowers.3840x2160.mp4",
  "https://motionbgs.com/media/9274/reze-midnight-reflection.3840x2160.mp4",
  "https://motionbgs.com/media/9265/minecraft-rainy-cabin.3840x2160.mp4",
  "https://motionbgs.com/media/9230/dark-queen.3840x2160.mp4",
  "https://motionbgs.com/media/9256/gabimaru-the-hollow-hells-paradise.3840x2160.mp4",
  "https://motionbgs.com/media/9253/izuku-midoriya-todoroki-lida.3840x2160.mp4",
  "https://motionbgs.com/media/9167/echoes-of-a-fallen-world.3840x2160.mp4",
  "https://motionbgs.com/media/9292/satoru-gojo-shattered-sky.3840x2160.mp4",
  "https://motionbgs.com/media/9271/hunt-showdown-skull-guns.3840x2160.mp4",
  "https://motionbgs.com/media/9278/starlit-reflections-snowbreak.3840x2160.mp4",
  "https://motionbgs.com/media/9207/batman-black-judgment.3840x2160.mp4",
  "https://motionbgs.com/media/9269/minecraft-falling-snow.3840x2160.mp4",
  "https://motionbgs.com/media/9287/nobara-kugisaki-jjk.3840x2160.mp4",
  "https://motionbgs.com/media/1194/vegeta-ultra-ego.1920x1080.mp4",
  "https://motionbgs.com/media/9217/evelyn.3840x2160.mp4",
  "https://motionbgs.com/media/1397/goku-ultra-instinct_2.1920x1080.mp4",
  "https://motionbgs.com/media/9206/eves-undersea-room.3840x2160.mp4",
  "https://motionbgs.com/media/128/itachi-uchiha.3840x2160.mp4",
  "https://motionbgs.com/media/9211/dream-chaser-white.3840x2160.mp4",
  "https://motionbgs.com/media/1057/itachi-shillouette-in-front-of-the-red-moon.1920x1080.mp4",
  "https://motionbgs.com/media/9199/beneath-falling-stars.3840x2160.mp4",
  "https://motionbgs.com/media/6839/black-haired-girl.1920x1080.mp4",
  "https://motionbgs.com/media/3984/zenitsu-agatsuma-holding-sword.1920x1080.mp4",
  "https://motionbgs.com/media/5535/itachi.1920x1080.mp4",
  "https://motionbgs.com/media/1864/gojo-six-eyes-jujutsu-kaisen.1920x1080.mp4",
  "https://motionbgs.com/media/3272/luffys-resolve-under-the-night-sky.1920x1080.mp4",
  "https://motionbgs.com/media/4068/silver-goku.1920x1080.mp4",
  "https://motionbgs.com/media/781/samurai-near-the-tree.1920x1080.mp4",
  "https://motionbgs.com/media/156/chainsaw-man-into-a-rage.1920x1080.mp4",
  "https://motionbgs.com/media/6158/ishtar-fate.1920x1080.mp4",
  "https://motionbgs.com/media/2706/sosuke-aizen-bleach.1920x1080.mp4",
  "https://motionbgs.com/media/2770/shadows-army-solo-leveling.1920x1080.mp4",
  "https://motionbgs.com/media/2185/levi-ackerman.1920x1080.mp4",
  "https://motionbgs.com/media/5511/isagi-yoichi-devil-eyes.1920x1080.mp4",
  "https://motionbgs.com/media/2365/izuku-midoriya-mha.1920x1080.mp4",
  "https://motionbgs.com/media/6436/nekomata-okayu-hololive.1920x1080.mp4",
  "https://motionbgs.com/media/4513/kaneki-ken.1920x1080.mp4",
  "https://motionbgs.com/media/2015/berserk.1920x1080.mp4",
  "https://motionbgs.com/media/3735/luffy-ace-and-sabo-in-childhood.1920x1080.mp4",
  "https://motionbgs.com/media/2766/dio-brando-jojo.1920x1080.mp4",
  "https://motionbgs.com/media/4426/thunder-gundam.1920x1080.mp4",
  "https://motionbgs.com/media/2806/cosmic-garou.1920x1080.mp4",
  "https://motionbgs.com/media/6768/frieren-the-slayer.1920x1080.mp4",
  "https://motionbgs.com/media/6968/hatsune-miku-night.1920x1080.mp4",
  "https://motionbgs.com/media/5138/killua-electrifying.1920x1080.mp4",
  "https://motionbgs.com/media/7700/kirito-asuna-sao.3840x2160.mp4",
  "https://motionbgs.com/media/5809/zero-two-and-bmw-f36.1920x1080.mp4",
  "https://motionbgs.com/media/1945/l-from-death-note.1920x1080.mp4",
  "https://motionbgs.com/media/2455/asta-black-clover.1920x1080.mp4",
  "https://motionbgs.com/media/2910/torii-gate.1920x1080.mp4",
  "https://motionbgs.com/media/4671/baki-hanma-fighting-pose.1920x1080.mp4",
  "https://motionbgs.com/media/6987/takakura-ken-dandadan.1920x1080.mp4",
  "https://motionbgs.com/media/5622/shigeo-mob.1920x1080.mp4",
  "https://motionbgs.com/media/1618/rem-with-blue-hair-and-maid-outfit-rezero.1920x1080.mp4",
  "https://motionbgs.com/media/9267/minecraft-relaxing-fireplace.3840x2160.mp4",
  "https://motionbgs.com/media/2404/house-on-island-spirited-away.1920x1080.mp4",
  "https://motionbgs.com/media/6242/roxy.1920x1080.mp4",
  "https://motionbgs.com/media/4136/yor-forger-in-spy-x-family.1920x1080.mp4",
  "https://motionbgs.com/media/4684/kazutora-tokyo-revengers.1920x1080.mp4",
  "https://motionbgs.com/media/3326/haikyuu.1920x1080.mp4",
  "https://motionbgs.com/media/2400/nature-in-made-in-abyss.1920x1080.mp4",
  "https://motionbgs.com/media/6226/sakura-wind-breaker.1920x1080.mp4",
  "https://motionbgs.com/media/1964/nature-in-minecraft.1920x1080.mp4",
  "https://motionbgs.com/media/9268/minecraft-snowy-campfire.3840x2160.mp4",
  "https://motionbgs.com/media/501/surviving-the-last-of-us.1920x1080.mp4",
  "https://motionbgs.com/media/2978/minecraft-sunset.1920x1080.mp4",
  "https://motionbgs.com/media/9266/minecraft-sunset-farm.3840x2160.mp4",
  "https://motionbgs.com/media/543/marvel-spiderman-miles-morales.1920x1080.mp4",
  "https://motionbgs.com/media/9213/flins-nightwatch.3840x2160.mp4",
  "https://motionbgs.com/media/7089/arcane-jinx.1920x1080.mp4",
  "https://motionbgs.com/media/1042/paimon-in-a-hot-pot-genshin-impact.1920x1080.mp4",
  "https://motionbgs.com/media/5706/astral-defender-acheron.1920x1080.mp4",
  "https://motionbgs.com/media/453/cozy-bedroom-at-night.1920x1080.mp4",
  "https://motionbgs.com/media/3160/jingliu-honkai-star-rail.1920x1080.mp4",
  "https://motionbgs.com/media/1102/nier-automata-vs-punishing-gray-raven.1920x1080.mp4",
  "https://motionbgs.com/media/129/sarkaz-arknights.3840x2160.mp4",
  "https://motionbgs.com/media/1039/rayquaza-flying-in-the-dark-sky.1920x1080.mp4",
  "https://motionbgs.com/media/4466/omen-valorant.1920x1080.mp4",
  "https://motionbgs.com/media/5910/genji-overwatch-rain.1920x1080.mp4",
  "https://motionbgs.com/media/2582/travis-scott-takes-on-fortnite.1920x1080.mp4",
  "https://motionbgs.com/media/6584/ellen-joe-and-bagboo.1920x1080.mp4",
  "https://motionbgs.com/media/8991/iku-and-tenshi-touhou.3840x2160.mp4",
  "https://motionbgs.com/media/4108/sunaookami-shiroko.1920x1080.mp4",
  "https://motionbgs.com/media/492/nier-automata.1920x1080.mp4",
  "https://motionbgs.com/media/596/soldier-from-call-of-duty.1920x1080.mp4",
  "https://motionbgs.com/media/317/bmw-m4-parked-on-a-wet-road-at-night_2.1920x1080.mp4",
  "https://motionbgs.com/media/490/alone-hollow-knight.1920x1080.mp4",
  "https://motionbgs.com/media/7245/spider-man-marvel-rivals.3840x2160.mp4",
  "https://motionbgs.com/media/6864/space-marine.1920x1080.mp4",
  "https://motionbgs.com/media/4017/ashenvale-wow.1920x1080.mp4",
  "https://motionbgs.com/media/1739/apex-legends-matrix.1920x1080.mp4",
  "https://motionbgs.com/media/505/the-witcher.1920x1080.mp4",
  "https://motionbgs.com/media/4353/makoto-yuki-persona-3-reload.1920x1080.mp4",
  "https://motionbgs.com/media/2219/azur-lane-shipgirl-party.1920x1080.mp4",
  "https://motionbgs.com/media/523/remake-final-fantasy-7.1920x1080.mp4",
  "https://motionbgs.com/media/6572/full-moon-elden-ring.1920x1080.mp4",
  "https://motionbgs.com/media/4150/zelda-forest-temple.1920x1080.mp4",
  "https://motionbgs.com/media/184/fenrir-ragnorak-from-god-of-war.1920x1080.mp4",
  "https://motionbgs.com/media/6029/fallout-power-armor.1920x1080.mp4",
  "https://motionbgs.com/media/558/meryl-from-tower-of-fantasy.1920x1080.mp4",
  "https://motionbgs.com/media/1205/leon-s-kennedy.1920x1080.mp4",
  "https://motionbgs.com/media/4002/gta-vi.1920x1080.mp4",
  "https://motionbgs.com/media/5980/assassins-creed-logo.1920x1080.mp4",
  "https://motionbgs.com/media/5993/shadow-fiend-dota-2.1920x1080.mp4",
  "https://motionbgs.com/media/2745/doomguy-doom-eternal.1920x1080.mp4",
  "https://motionbgs.com/media/703/roblox.1920x1080.mp4",
  "https://motionbgs.com/media/6470/black-myth-wukong.1920x1080.mp4",
  "https://motionbgs.com/media/2837/rdr-2-animated.1920x1080.mp4",
  "https://motionbgs.com/media/980/warframe-lotus-logo.1920x1080.mp4",
  "https://motionbgs.com/media/6090/raiden-mortal-kombat.1920x1080.mp4",
  "https://motionbgs.com/media/6377/helldivers-2-escalation-of-freedom.1920x1080.mp4",
  "https://motionbgs.com/media/1999/sonic.1920x1080.mp4",
  "https://motionbgs.com/media/180/skyrim-the-elder-scrolls-v.1920x1080.mp4",
  "https://motionbgs.com/media/6174/mecha-mortis-brawl-stars.1920x1080.mp4",
  "https://motionbgs.com/media/2855/pubg.1920x1080.mp4",
  "https://motionbgs.com/media/6920/battlefield-sekiro.1920x1080.mp4",
  "https://motionbgs.com/media/500/the-last-of-us-part-ii.1920x1080.mp4",
  "https://motionbgs.com/media/897/the-quest-for-the-sea-of-thieves-skull.1920x1080.mp4",
  "https://motionbgs.com/media/3647/csgo-legends.1920x1080.mp4",
  "https://motionbgs.com/media/8861/blonde-blazer-mecha-man.3840x2160.mp4",
  "https://motionbgs.com/media/5498/telltale-house.1920x1080.mp4",
  "https://motionbgs.com/media/3226/yongli-sword-ghost-of-tsushima.1920x1080.mp4",
  "https://motionbgs.com/media/8284/tokai-teio-umamusume.3840x2160.mp4",
  "https://motionbgs.com/media/3324/fnaf.1920x1080.mp4",
  "https://motionbgs.com/media/970/gaming-ruiner.1920x1080.mp4",
  "https://motionbgs.com/media/573/jack-cooper-bt-7274-titanfall-2.1920x1080.mp4",
  "https://motionbgs.com/media/644/bmw-m4-liberty.1920x1080.mp4",
  "https://motionbgs.com/media/1033/the-drive-on-the-road-at-sunset.1920x1080.mp4",
  "https://motionbgs.com/media/6200/white-toyota-drifting.1920x1080.mp4",
  "https://motionbgs.com/media/660/bmw-carros-driving.1920x1080.mp4",
  "https://motionbgs.com/media/1043/man-sitting-on-car-floating-in-the-ocean.1920x1080.mp4",
  "https://motionbgs.com/media/350/orange-nissan-skyline-gtr.1920x1080.mp4",
  "https://motionbgs.com/media/5317/nissan-gtr-r34-skyline.1920x1080.mp4",
  "https://motionbgs.com/media/626/audi-rs6-hazard.1920x1080.mp4",
  "https://motionbgs.com/media/5292/porsche-911-in-darkness.1920x1080.mp4",
  "https://motionbgs.com/media/7052/ducati-1199-panigale.1920x1080.mp4",
  "https://motionbgs.com/media/1301/supercar-mercedes-benz-c63-amg-at-night.1920x1080.mp4",
  "https://motionbgs.com/media/637/toyota-supra-at-neon-night-under-the-rain.1920x1080.mp4",
  "https://motionbgs.com/media/598/pink-lambo-aventador.1920x1080.mp4",
  "https://motionbgs.com/media/532/mclaren-570s-nfs.1920x1080.mp4",
  "https://motionbgs.com/media/345/mazda-rx7-parked-in-tokyo.1920x1080.mp4",
  "https://motionbgs.com/media/339/aesthetic-ferrari-f40-forza-horizon.1920x1080.mp4",
  "https://motionbgs.com/media/619/dodge-charger-under-the-rain.1920x1080.mp4",
  "https://motionbgs.com/media/618/ford-mustang-under-the-rain.1920x1080.mp4",
  "https://motionbgs.com/media/7704/honda-nsx-na1.3840x2160.mp4",
  "https://motionbgs.com/media/635/ford-mustang-gt-parked-under-the-rain.1920x1080.mp4",
  "https://motionbgs.com/media/8149/mitsubishi-lancer-evolution-turbo-nights.3840x2160.mp4",
  "https://motionbgs.com/media/602/subaru-brz-under-the-rain-nfs.1920x1080.mp4",
  "https://motionbgs.com/media/9277/chisato-nishikigi-lycoris-recoilnikke.3840x2160.mp4",
  "https://motionbgs.com/media/9252/shadowlands-lich-king.3840x2160.mp4",
  "https://motionbgs.com/media/9260/natsu-dragneel-fairy-tail.3840x2160.mp4",
  "https://motionbgs.com/media/9273/shimoe-koharu-blue-archive.3840x2160.mp4",
  "https://motionbgs.com/media/9270/hunt-showdown-dark-ambush.3840x2160.mp4",
  "https://motionbgs.com/media/9259/fairy-tail-symbol.3840x2160.mp4",
  "https://motionbgs.com/media/9255/gabimaru-burning-spirit.3840x2160.mp4",
  "https://motionbgs.com/media/9261/fairy-tail-magic-team.3840x2160.mp4",
  "https://motionbgs.com/media/7934/sword-art-online.3840x2160.mp4",
  "https://motionbgs.com/media/9249/arcane-elf-sorceress.3840x2160.mp4",
  "https://motionbgs.com/media/9263/aemeath-wuwa.3840x2160.mp4",
  "https://motionbgs.com/media/9257/gym-dark.3840x2160.mp4",
  "https://motionbgs.com/media/1953/monkey-d-luffy-straw-hat2.1920x1080.mp4",
  "https://motionbgs.com/media/4646/spider-man-2.1920x1080.mp4",
  "https://motionbgs.com/media/1926/moonlit-bloom-cherry.1920x1080.mp4",
  "https://motionbgs.com/media/4267/bart-simpsons-travel-van.1920x1080.mp4",
  "https://motionbgs.com/media/3759/a-painting-landscape.1920x1080.mp4",
  "https://motionbgs.com/media/7028/cat-cloud.1920x1080.mp4",
  "https://motionbgs.com/media/8626/celestial-veil.3840x2160.mp4",
  "https://motionbgs.com/media/53/black-hole.1920x1080.mp4",
  "https://motionbgs.com/media/4072/grim-reaper.1920x1080.mp4",
  "https://motionbgs.com/media/722/space-science-hud.1920x1080.mp4",
  "https://motionbgs.com/media/3151/cristiano-ronaldo.1920x1080.mp4",
  "https://motionbgs.com/media/3764/torii.1920x1080.mp4",
  "https://motionbgs.com/media/1732/flying-cinnamoroll-hello-kitty.1920x1080.mp4"
];

function getThumbnailUrl(src) {
  const match = src.match(/\/media\/(\d+)\/(.*?)(?:\.\d+x\d+)?\.mp4$/);
  if (match) return `https://motionbgs.com/i/c/364x205/media/${match[1]}/${match[2]}.jpg`;
  return null;
}

export async function renderWallpapersPage(explorerInstance, view) {
  const fs = explorerInstance.fs;
  const wm = explorerInstance.wm;

  view.innerHTML = "";
  view.classList.add("wallpapers-page");

  const header = document.createElement("div");
  header.className = "wp-header";
  header.innerHTML = `
    <div class="wp-title">Wallpapers</div>
    <button class="wp-random-btn" id="wp-try-random">
      <span class="wp-btn-icon">✦</span>
      Try Random Wallpaper
    </button>
  `;
  view.appendChild(header);

  const previewZone = document.createElement("div");
  previewZone.className = "wp-preview-zone";
  view.appendChild(previewZone);

  const grid = document.createElement("div");
  grid.className = "wp-grid";
  view.appendChild(grid);

  await refreshWallpaperGrid(fs, grid, wm, previewZone);

  header.querySelector("#wp-try-random").onclick = () => showRandomPreview(explorerInstance, previewZone, grid, fs, wm);
}

async function refreshWallpaperGrid(fs, grid, wm, previewZone) {
  grid.innerHTML = "";
  const folder = await fs.getFolder(["Pictures", "Wallpapers"]);

  for (const [name, data] of Object.entries(folder)) {
    if (data?.type !== "file") continue;
    const isVideo = data.kind === FileKind.VIDEO;
    const src = data.content;
    const thumbUrl = isVideo ? getThumbnailUrl(src) : null;

    const card = document.createElement("div");
    card.className = "wp-card";
    card.title = name;

    const thumbEl = document.createElement("div");
    thumbEl.className = "wp-thumb" + (isVideo ? " wp-thumb-video" : "");

    if (isVideo) {
      if (thumbUrl) {
        const img = document.createElement("img");
        img.className = "wp-thumb-img";
        img.src = thumbUrl;
        img.onerror = () => img.remove();
        thumbEl.appendChild(img);
      }
      const badge = document.createElement("div");
      badge.className = "wp-play-badge";
      badge.textContent = "▶";
      thumbEl.appendChild(badge);
    } else {
      thumbEl.style.backgroundImage = `url('${data.icon || data.content}')`;
    }

    const nameEl = document.createElement("div");
    nameEl.className = "wp-card-name";
    nameEl.textContent = name;

    const actions = document.createElement("div");
    actions.className = "wp-card-actions";

    const setBtn = document.createElement("button");
    setBtn.className = "wp-card-btn wp-set-btn";
    setBtn.textContent = "Set";
    setBtn.onclick = async (e) => {
      e.stopPropagation();
      const content = await fs.getFileContent(["Pictures", "Wallpapers"], name);
      SystemUtilities.setWallpaper(content);
      wm.showPopup(`Wallpaper set to "${name}"`);
    };

    actions.appendChild(setBtn);
    card.appendChild(thumbEl);
    card.appendChild(nameEl);
    card.appendChild(actions);

    card.addEventListener("click", (e) => {
      if (e.target === setBtn) return;
      showCardPreview(name, src, isVideo, previewZone, fs, wm);
    });

    grid.appendChild(card);
  }
}

function showCardPreview(name, src, isVideo, previewZone, fs, wm) {
  previewZone.classList.add("wp-preview-active");
  previewZone.innerHTML = "";

  const inner = document.createElement("div");
  inner.className = "wp-preview-inner";

  const media = isVideo ? document.createElement("video") : document.createElement("img");
  media.className = "wp-preview-media";
  media.src = src;
  if (isVideo) {
    media.autoplay = true;
    media.loop = true;
    media.muted = true;
    media.playsInline = true;
  }

  const overlay = document.createElement("div");
  overlay.className = "wp-preview-overlay";
  overlay.innerHTML = `
    <div class="wp-preview-label">${name}</div>
    <div class="wp-preview-btns">
      <button class="wp-action-btn wp-discard-btn">✕ Close</button>
      <button class="wp-action-btn wp-save-btn">✔ Set Wallpaper</button>
    </div>
  `;

  overlay.querySelector(".wp-discard-btn").onclick = () => {
    previewZone.classList.remove("wp-preview-active");
    previewZone.innerHTML = "";
  };

  overlay.querySelector(".wp-save-btn").onclick = async () => {
    const content = await fs.getFileContent(["Pictures", "Wallpapers"], name);
    SystemUtilities.setWallpaper(content);
    wm.showPopup(`Wallpaper set to "${name}"`);
    previewZone.classList.remove("wp-preview-active");
    previewZone.innerHTML = "";
  };

  inner.appendChild(media);
  inner.appendChild(overlay);
  previewZone.appendChild(inner);
}

function showRandomPreview(explorerInstance, previewZone, grid, fs, wm) {
  const src = videos[Math.floor(Math.random() * videos.length)];
  const isVideo = src.endsWith(".mp4");

  previewZone.classList.add("wp-preview-active");
  previewZone.innerHTML = "";

  const inner = document.createElement("div");
  inner.className = "wp-preview-inner";

  const media = isVideo ? document.createElement("video") : document.createElement("img");
  media.className = "wp-preview-media";
  media.src = src;
  if (isVideo) {
    media.autoplay = true;
    media.loop = true;
    media.muted = true;
    media.playsInline = true;
  }

  const overlay = document.createElement("div");
  overlay.className = "wp-preview-overlay";
  overlay.innerHTML = `
    <div class="wp-preview-label">Random Wallpaper Preview</div>
    <div class="wp-preview-btns">
      <button class="wp-action-btn wp-discard-btn">✕ Discard</button>
      <button class="wp-action-btn wp-another-btn">↻ Another</button>
      <button class="wp-action-btn wp-save-btn">✔ Set Wallpaper</button>
    </div>
  `;

  overlay.querySelector(".wp-discard-btn").onclick = () => {
    previewZone.classList.remove("wp-preview-active");
    previewZone.innerHTML = "";
  };

  overlay.querySelector(".wp-another-btn").onclick = () =>
    showRandomPreview(explorerInstance, previewZone, grid, fs, wm);

  overlay.querySelector(".wp-save-btn").onclick = async () => {
    SystemUtilities.setWallpaper(src);

    const urlParts = src.split("/");
    const rawName = urlParts[urlParts.length - 1]
      .replace(/\.\d+x\d+\.mp4$/, "")
      .replace(/\.mp4$/, "")
      .replace(/-/g, " ")
      .slice(0, 32)
      .trim();
    const ext = isVideo ? ".mp4" : ".webp";
    const fileName = rawName + ext;

    await fs.ensureFolder(["Pictures", "Wallpapers"]);
    await fs.createFile(
      ["Pictures", "Wallpapers"],
      fileName,
      src,
      isVideo ? FileKind.VIDEO : FileKind.IMAGE,
      isVideo ? "/static/icons/file.webp" : src
    );

    wm.showPopup(`Saved as "${fileName}"`);
    previewZone.classList.remove("wp-preview-active");
    previewZone.innerHTML = "";
    await refreshWallpaperGrid(fs, grid, wm, previewZone);
  };

  inner.appendChild(media);
  inner.appendChild(overlay);
  previewZone.appendChild(inner);
}
