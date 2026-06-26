import { resolveIconUrl } from "../shared/assetResolver.js";

export const PREDEFINED_AVATARS = [
  resolveIconUrl("static/icons/guest.webp"),
  resolveIconUrl("static/icons/helltaker.jpg"),
  resolveIconUrl("static/icons/stardew.webp"),
  resolveIconUrl("static/icons/hollowKnight.webp"),
  resolveIconUrl("static/icons/fancypants2.webp"),
  resolveIconUrl("static/icons/isaac.webp"),
  resolveIconUrl("static/icons/angryBirds.webp"),
  resolveIconUrl("static/icons/nso.webp"),
  resolveIconUrl("static/icons/alienHominid.webp"),
  resolveIconUrl("static/icons/celeste.webp"),
  resolveIconUrl("static/icons/undertale.webp"),
  resolveIconUrl("static/icons/omori.webp"),
  resolveIconUrl("static/icons/inscryption.webp"),
  resolveIconUrl("static/icons/minecraft.webp"),
  resolveIconUrl("static/icons/sonic.webp"),
  resolveIconUrl("static/icons/mario.webp"),
  resolveIconUrl("static/icons/pvz.webp"),
  resolveIconUrl("static/icons/cookie.webp"),
  resolveIconUrl("static/icons/slime.webp"),
  resolveIconUrl("static/icons/doodle.webp"),
  resolveIconUrl("static/icons/star.webp"),
  resolveIconUrl("static/icons/night.webp"),
  resolveIconUrl("static/icons/brotato.webp"),
  resolveIconUrl("static/icons/vampireSurvivors.webp"),
  resolveIconUrl("static/icons/ultrakill.webp"),
  resolveIconUrl("static/icons/fez.webp"),
  resolveIconUrl("static/icons/geometryDash.webp"),
  resolveIconUrl("static/icons/pac-man.webp"),
  resolveIconUrl("static/icons/pokemonred.webp"),
  resolveIconUrl("static/icons/fnaf1.webp"),
  resolveIconUrl("static/icons/ddlc.webp"),
  resolveIconUrl("static/icons/bendy.webp"),
  resolveIconUrl("static/icons/clusterRush.webp")
];

export function generateUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
