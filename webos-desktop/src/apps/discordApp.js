import { createScramjetWebApp } from "../core/ScramjetWebAppFactory.js";

export const DiscordApp = createScramjetWebApp({
  appId: "discordApp",
  appName: "Discord",
  targetUrl: "https://discord.com/app",
  appIcon: "fab fa-discord",
  windowSize: ["1280px", "600px"],
  trayOptions: {
    contextMenuItems: [
      {
        label: "Mute",
        action: () => {
          console.log("Discord: Mute");
        },
        icon: "fa-microphone-slash"
      },
      {
        label: "Deafen",
        action: () => {
          console.log("Discord: Deafen");
        },
        icon: "fa-volume-off"
      },
      {
        type: "divider"
      },
      {
        label: "Status: Online",
        action: () => {
          console.log("Discord: Set status to Online");
        },
        icon: "fa-circle"
      },
      {
        label: "Status: Idle",
        action: () => {
          console.log("Discord: Set status to Idle");
        },
        icon: "fa-moon"
      },
      {
        label: "Status: DND",
        action: () => {
          console.log("Discord: Set status to DND");
        },
        icon: "fa-ban"
      },
      {
        label: "Status: Invisible",
        action: () => {
          console.log("Discord: Set status to Invisible");
        },
        icon: "fa-eye-slash"
      }
    ]
  }
});
