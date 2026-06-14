import { createScramjetWebApp } from "../core/ScramjetWebAppFactory.js";

export const OutlookApp = createScramjetWebApp({
  appId: "outlookApp",
  appName: "Outlook",
  targetUrl: "https://outlook.live.com",
  appIcon: "fas fa-envelope-open",
  windowSize: ["1280px", "800px"]
});
