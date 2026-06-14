import { createScramjetWebApp } from "../core/ScramjetWebAppFactory.js";

export const DeepseekApp = createScramjetWebApp({
  appId: "deepseekApp",
  appName: "DeepSeek",
  targetUrl: "https://chat.deepseek.com/",
  appIcon: "fas fa-brain",
  windowSize: ["1280px", "800px"]
});
