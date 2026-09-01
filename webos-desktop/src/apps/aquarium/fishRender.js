import { renderClownfish, renderBluetang, renderParrotfish, renderButterflyfish, renderPufferfish, renderSeahorse, renderAngelfish, renderLionfish, renderNapoleon, renderMoorish, renderMandarin } from "./fishRenderSpecies.js";
import { renderMantaray, renderOctopus, renderOctopusEar, renderTurtle, renderCrab, renderSeastar, renderEel, renderSquid, renderJelly, renderJellyfish, renderIsopod, renderWhale, renderGreatWhiteShark, renderHammerheadShark, renderLanternShark } from "./fishRenderCreatures.js";
import { renderGeneric } from "./fishRenderGeneric.js";

function getDispatchId(f) {
  if (!f) return "";
  if (f.fd && f.fd.id) return f.fd.id;
  if (f.id) return f.id;
  if (f.type && f.type.name) return f.type.name;
  if (f.fd && f.fd.body) return f.fd.body;
  return "";
}

function getBody(f) {
  if (f.fd && f.fd.body) return f.fd.body;
  if (f.body) return f.body;
  return "";
}

export function drawSeaFish(ctx, f, wag, flash, t) {
  const id = getDispatchId(f);
  const body = getBody(f);
  const key = id.toLowerCase();
  if (key === "clownfish") return renderClownfish(ctx, f, wag, flash, t);
  if (key === "bluetang" || key === "blue tang") return renderBluetang(ctx, f, wag, flash, t);
  if (key === "parrotfish") return renderParrotfish(ctx, f, wag, flash, t);
  if (key === "butterfly" || key === "butterflyfish") return renderButterflyfish(ctx, f, wag, flash, t);
  if (key === "pufferfish" || key === "puffer" || key === "volcanic_puffer") return renderPufferfish(ctx, f, wag, flash, t);
  if (key === "seahorse" || key === "crystal_seahorse") return renderSeahorse(ctx, f, wag, flash, t);
  if (key === "angelfish") return renderAngelfish(ctx, f, wag, flash, t);
  if (key === "lionfish") return renderLionfish(ctx, f, wag, flash, t);
  if (key === "napoleon") return renderNapoleon(ctx, f, wag, flash, t);
  if (key === "moorish" || key === "moorish idol") return renderMoorish(ctx, f, wag, flash, t);
  if (key === "mandarin") return renderMandarin(ctx, f, wag, flash, t);
  if (body === "mantaray") return renderMantaray(ctx, f, wag, flash, t);
  if (body === "octopus") return renderOctopus(ctx, f, wag, flash, t);
  if (body === "octopus_ear") return renderOctopusEar(ctx, f, wag, flash, t);
  if (body === "turtle") return renderTurtle(ctx, f, wag, flash, t);
  if (body === "crab") return renderCrab(ctx, f, wag, flash, t);
  if (body === "seastar") return renderSeastar(ctx, f, wag, flash, t);
  if (body === "eel") return renderEel(ctx, f, wag, flash, t);
  if (body === "squid") return renderSquid(ctx, f, wag, flash, t);
  if (body === "jelly") return renderJelly(ctx, f, wag, flash, t);
  if (body === "jellyfish") return renderJellyfish(ctx, f, wag, flash, t);
  if (body === "isopod") return renderIsopod(ctx, f, wag, flash, t);
  if (body === "whale") return renderWhale(ctx, f, wag, flash, t);
  if (key === "great_white_shark") return renderGreatWhiteShark(ctx, f, wag, flash, t);
  if (key === "hammerhead_shark") return renderHammerheadShark(ctx, f, wag, flash, t);
  if (key === "lantern_shark") return renderLanternShark(ctx, f, wag, flash, t);
  return renderGeneric(ctx, f, wag, flash, t);
}

export function isSeaFishId(id) {
  const k = id.toLowerCase();
  return ["clownfish","bluetang","parrotfish","butterfly","butterflyfish","pufferfish","seahorse","angelfish","lionfish","napoleon","moorish","mandarin","mantaray","octopus","octopus_ear","turtle","crab","seastar","eel","squid","jelly","jellyfish","isopod","whale","great_white_shark","hammerhead_shark","lantern_shark"].includes(k);
}
