import { createScramjetWebApp } from "../core/ScramjetWebAppFactory.js";

export const ChatgptApp = createScramjetWebApp({
  appId: "chatgptApp",
  appName: "ChatGPT",
  targetUrl: "https://chatgpt.com",
  appIcon: "fas fa-robot",
  windowSize: ["1280px", "800px"]
});
