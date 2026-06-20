import { createScramjetWebApp } from "../core/ScramjetWebAppFactory.js";

export const YoutubeApp = createScramjetWebApp({
  appId: "youtubeApp",
  appName: "Youtube",
  targetUrl: "https://www.youtube.com",
  appIcon: "static/icons/youtube.webp",
  windowSize: ["1280px", "600px"],
  trayOptions: {}
});
