import { createScramjetWebApp } from "../core/ScramjetWebAppFactory.js";

export const YoutubeApp = createScramjetWebApp({
  appId: "youtubeApp",
  appName: "Youtube",
  targetUrl: "https://www.youtube.com",
  appIcon: "static/icons/youtube.webp",
  windowSize: ["1280px", "600px"],
  trayOptions: {
    contextMenuItems: [
      {
        label: "Play/Pause",
        action: () => {
          console.log("Youtube: Play/Pause");
        },
        icon: "fa-play"
      },
      {
        label: "Next Video",
        action: () => {
          console.log("Youtube: Next Video");
        },
        icon: "fa-forward"
      },
      {
        label: "Previous Video",
        action: () => {
          console.log("Youtube: Previous Video");
        },
        icon: "fa-backward"
      },
      {
        type: "divider"
      },
      {
        label: "Mute",
        action: () => {
          console.log("Youtube: Mute");
        },
        icon: "fa-volume-xmark"
      },
      {
        label: "Fullscreen",
        action: () => {
          console.log("Youtube: Fullscreen");
        },
        icon: "fa-expand"
      }
    ]
  }
});
