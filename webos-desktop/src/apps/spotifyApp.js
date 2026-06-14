import { createScramjetWebApp } from "../core/ScramjetWebAppFactory.js";

export const SpotifyApp = createScramjetWebApp({
  appId: "spotifyApp",
  appName: "Spotify",
  targetUrl: "https://open.spotify.com",
  appIcon: "fab fa-spotify",
  windowSize: ["1280px", "800px"]
});
