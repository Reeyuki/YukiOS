import { createScramjetWebApp } from "../core/ScramjetWebAppFactory.js";

export const SlackApp = createScramjetWebApp({
  appId: "slackApp",
  appName: "Slack",
  targetUrl: "https://slack.com",
  appIcon: "fab fa-slack",
  windowSize: ["1280px", "800px"]
});
