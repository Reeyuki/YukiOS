import gameHtmlRaw from "./game.html?raw";
import runnerJsRaw from "./runner.js?raw";
import imgObstacleLarge1x from "./img/1x-obstacle-large.png?inline";
import imgObstacleSmall1x from "./img/1x-obstacle-small.png?inline";
import imgCloud1x from "./img/1x-cloud.png?inline";
import imgText1x from "./img/1x-text.png?inline";
import imgHorizon1x from "./img/1x-horizon.png?inline";
import imgTrex1x from "./img/1x-trex.png?inline";
import imgRestart1x from "./img/1x-restart.png?inline";
import imgObstacleLarge2x from "./img/2x-obstacle-large.png?inline";
import imgObstacleSmall2x from "./img/2x-obstacle-small.png?inline";
import imgCloud2x from "./img/2x-cloud.png?inline";
import imgText2x from "./img/2x-text.png?inline";
import imgHorizon2x from "./img/2x-horizon.png?inline";
import imgTrex2x from "./img/2x-trex.png?inline";
import imgRestart2x from "./img/2x-restart.png?inline";

const IMAGE_REPLACEMENTS = [
  ["img/1x-obstacle-large.png", imgObstacleLarge1x],
  ["img/1x-obstacle-small.png", imgObstacleSmall1x],
  ["img/1x-cloud.png", imgCloud1x],
  ["img/1x-text.png", imgText1x],
  ["img/1x-horizon.png", imgHorizon1x],
  ["img/1x-trex.png", imgTrex1x],
  ["img/1x-restart.png", imgRestart1x],
  ["img/2x-obstacle-large.png", imgObstacleLarge2x],
  ["img/2x-obstacle-small.png", imgObstacleSmall2x],
  ["img/2x-cloud.png", imgCloud2x],
  ["img/2x-text.png", imgText2x],
  ["img/2x-horizon.png", imgHorizon2x],
  ["img/2x-trex.png", imgTrex2x],
  ["img/2x-restart.png", imgRestart2x]
];

let cachedGameHtml = null;
let cachedEscapedHtml = null;

export function buildDinoGameHtml() {
  if (cachedGameHtml) return cachedGameHtml;
  let html = gameHtmlRaw;
  for (const [path, uri] of IMAGE_REPLACEMENTS) {
    html = html.split(path).join(uri);
  }
  html = html.replace('<script src="scripts/runner.js"></script>', "<script>" + runnerJsRaw + "</script>");
  cachedGameHtml = html;
  return cachedGameHtml;
}

export function escapeDinoGameAttr() {
  if (cachedEscapedHtml) return cachedEscapedHtml;
  cachedEscapedHtml = buildDinoGameHtml()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/'/g, "&#39;")
    .replace(/"/g, "&quot;");
  return cachedEscapedHtml;
}
