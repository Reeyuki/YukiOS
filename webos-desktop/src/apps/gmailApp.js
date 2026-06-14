import { createScramjetWebApp } from "../core/ScramjetWebAppFactory.js";

export const GmailApp = createScramjetWebApp({
  appId: "gmailApp",
  appName: "Gmail",
  targetUrl: "https://mail.google.com",
  appIcon: "fas fa-envelope",
  windowSize: ["1280px", "800px"]
});
