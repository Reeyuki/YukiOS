import { createScramjetWebApp } from "../core/ScramjetWebAppFactory.js";

const WEB_APP_DEFINITIONS = [
  {
    appId: "chatgptApp",
    appName: "ChatGPT",
    targetUrl: "https://chatgpt.com",
    appIcon: "fas fa-robot",
    windowSize: ["90vw", "85vh"]
  },
  {
    appId: "spotifyApp",
    appName: "Spotify",
    targetUrl: "https://open.spotify.com",
    appIcon: "fab fa-spotify",
    windowSize: ["90vw", "85vh"]
  },
  {
    appId: "slackApp",
    appName: "Slack",
    targetUrl: "https://slack.com",
    appIcon: "fab fa-slack",
    windowSize: ["90vw", "85vh"]
  },
  {
    appId: "gmailApp",
    appName: "Gmail",
    targetUrl: "https://mail.google.com",
    appIcon: "fas fa-envelope",
    windowSize: ["90vw", "85vh"]
  },
  {
    appId: "outlookApp",
    appName: "Outlook",
    targetUrl: "https://outlook.live.com",
    appIcon: "fas fa-envelope-open",
    windowSize: ["90vw", "85vh"]
  },
  {
    appId: "deepseekApp",
    appName: "DeepSeek",
    targetUrl: "https://chat.deepseek.com/",
    appIcon: "fas fa-brain",
    windowSize: ["90vw", "85vh"]
  },
  {
    appId: "telegramApp",
    appName: "Telegram",
    targetUrl: "https://web.telegram.org",
    appIcon: "fab fa-telegram",
    windowSize: ["90vw", "85vh"]
  },
  {
    appId: "whatsappApp",
    appName: "WhatsApp",
    targetUrl: "https://web.whatsapp.com",
    appIcon: "fab fa-whatsapp",
    windowSize: ["90vw", "85vh"]
  },
  {
    appId: "teamsApp",
    appName: "Microsoft Teams",
    targetUrl: "https://teams.microsoft.com",
    appIcon: "fab fa-microsoft",
    windowSize: ["90vw", "85vh"]
  },
  {
    appId: "zoomApp",
    appName: "Zoom",
    targetUrl: "https://zoom.us",
    appIcon: "fas fa-video",
    windowSize: ["90vw", "85vh"]
  },
  {
    appId: "notionApp",
    appName: "Notion",
    targetUrl: "https://notion.so",
    appIcon: "fas fa-book",
    windowSize: ["90vw", "85vh"]
  },
  {
    appId: "figmaApp",
    appName: "Figma",
    targetUrl: "https://figma.com",
    appIcon: "fab fa-figma",
    windowSize: ["90vw", "85vh"]
  },
  {
    appId: "twitterApp",
    appName: "Twitter/X",
    targetUrl: "https://twitter.com",
    appIcon: "fab fa-x-twitter",
    windowSize: ["90vw", "85vh"]
  },
  {
    appId: "redditApp",
    appName: "Reddit",
    targetUrl: "https://reddit.com",
    appIcon: "fab fa-reddit",
    windowSize: ["90vw", "85vh"]
  },
  {
    appId: "instagramApp",
    appName: "Instagram",
    targetUrl: "https://instagram.com",
    appIcon: "fab fa-instagram",
    windowSize: ["90vw", "85vh"]
  },
  {
    appId: "linkedinApp",
    appName: "LinkedIn",
    targetUrl: "https://linkedin.com",
    appIcon: "fab fa-linkedin",
    windowSize: ["90vw", "85vh"]
  },
  {
    appId: "pinterestApp",
    appName: "Pinterest",
    targetUrl: "https://pinterest.com",
    appIcon: "fab fa-pinterest",
    windowSize: ["90vw", "85vh"]
  },
  {
    appId: "googleDocsApp",
    appName: "Google Docs",
    targetUrl: "https://docs.google.com",
    appIcon: "fas fa-file-word",
    windowSize: ["90vw", "85vh"]
  },
  {
    appId: "trelloApp",
    appName: "Trello",
    targetUrl: "https://trello.com",
    appIcon: "fab fa-trello",
    windowSize: ["90vw", "85vh"]
  },
  {
    appId: "canvaApp",
    appName: "Canva",
    targetUrl: "https://canva.com",
    appIcon: "fas fa-palette",
    windowSize: ["90vw", "85vh"]
  },
  {
    appId: "githubApp",
    appName: "GitHub",
    targetUrl: "https://github.com",
    appIcon: "fab fa-github",
    windowSize: ["90vw", "85vh"]
  },
  {
    appId: "gitlabApp",
    appName: "GitLab",
    targetUrl: "https://gitlab.com",
    appIcon: "fab fa-gitlab",
    windowSize: ["90vw", "85vh"]
  },
  {
    appId: "codepenApp",
    appName: "CodePen",
    targetUrl: "https://codepen.io",
    appIcon: "fab fa-codepen",
    windowSize: ["90vw", "85vh"]
  },
  {
    appId: "replitApp",
    appName: "Replit",
    targetUrl: "https://replit.com",
    appIcon: "fas fa-code",
    windowSize: ["90vw", "85vh"]
  },
  {
    appId: "twitchApp",
    appName: "Twitch",
    targetUrl: "https://twitch.tv",
    appIcon: "fab fa-twitch",
    windowSize: ["90vw", "85vh"]
  },
  {
    appId: "soundcloudApp",
    appName: "SoundCloud",
    targetUrl: "https://soundcloud.com",
    appIcon: "fab fa-soundcloud",
    windowSize: ["90vw", "85vh"]
  },
  {
    appId: "deezerApp",
    appName: "Deezer",
    targetUrl: "https://deezer.com",
    appIcon: "fab fa-deezer",
    windowSize: ["90vw", "85vh"]
  },
  {
    appId: "protonmailApp",
    appName: "ProtonMail",
    targetUrl: "https://proton.me",
    appIcon: "fas fa-shield",
    windowSize: ["90vw", "85vh"]
  },
  {
    appId: "yahooMailApp",
    appName: "Yahoo Mail",
    targetUrl: "https://mail.yahoo.com",
    appIcon: "fab fa-yahoo",
    windowSize: ["90vw", "85vh"]
  }
];

const webApps = {};

WEB_APP_DEFINITIONS.forEach((definition) => {
  const className = definition.appName.replace(/[^a-zA-Z0-9]/g, "") + "App";
  webApps[className] = createScramjetWebApp(definition);
});

export const ChatgptApp = webApps.ChatGPTApp;
export const SpotifyApp = webApps.SpotifyApp;
export const SlackApp = webApps.SlackApp;
export const GmailApp = webApps.GmailApp;
export const OutlookApp = webApps.OutlookApp;
export const DeepseekApp = webApps.DeepSeekApp;
export const TelegramApp = webApps.TelegramApp;
export const WhatsappApp = webApps.WhatsAppApp;
export const TeamsApp = webApps.MicrosoftTeamsApp;
export const ZoomApp = webApps.ZoomApp;
export const NotionApp = webApps.NotionApp;
export const FigmaApp = webApps.FigmaApp;
export const TwitterApp = webApps.TwitterXApp;
export const RedditApp = webApps.RedditApp;
export const InstagramApp = webApps.InstagramApp;
export const LinkedinApp = webApps.LinkedInApp;
export const PinterestApp = webApps.PinterestApp;
export const GoogleDocsApp = webApps.GoogleDocsApp;
export const TrelloApp = webApps.TrelloApp;
export const CanvaApp = webApps.CanvaApp;
export const GithubApp = webApps.GitHubApp;
export const GitlabApp = webApps.GitLabApp;
export const CodepenApp = webApps.CodePenApp;
export const ReplitApp = webApps.ReplitApp;
export const TwitchApp = webApps.TwitchApp;
export const SoundcloudApp = webApps.SoundCloudApp;
export const DeezerApp = webApps.DeezerApp;
export const ProtonmailApp = webApps.ProtonMailApp;
export const YahooMailApp = webApps.YahooMailApp;

export const WEB_APP_DEFINITIONS_EXPORT = WEB_APP_DEFINITIONS;
