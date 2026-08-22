import newsUpdates from "../news.json";
import "../styles/news.css";
import { $, $$, bindEvent, setStyle, toggleClass } from "../shared/domUtils.js";
import { APP_MANIFESTS, BaseApp, StorageKeys, os } from "../framework.js";

const appNewsEntries = APP_MANIFESTS.filter((manifest) => manifest.news).map((manifest) => manifest.news);

const EXISTING_NEWS_UPDATES = newsUpdates;

const NEWS_UPDATES = [...appNewsEntries, ...EXISTING_NEWS_UPDATES];

const hashStringDjb2 = (text) => {
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 33) ^ text.charCodeAt(i);
  }
  return `djb2:${(hash >>> 0).toString(16)}`;
};

export const getNewsContentSignature = () => {
  const minimal = NEWS_UPDATES.map((u) => ({
    date: u.date,
    sections: (u.sections || []).map((s) => ({
      icon: s.icon,
      title: s.title,
      items: (s.items || []).map(([i, t, d]) => [i, t, d])
    }))
  }));
  return hashStringDjb2(JSON.stringify(minimal));
};

export const getRecentNews = (count = 3) => NEWS_UPDATES.slice(0, count);

export const updateNewsBadge = () => {
  const currentSignature = getNewsContentSignature();
  const storedSignature = os.storage.get(StorageKeys.newsReadSignatureKey);
  const hasUnreadNews = currentSignature !== storedSignature;

  const badge = $(".news-badge");
  if (badge) {
    setStyle(badge, { display: hasUnreadNews ? "flex" : "none" });
  }
};

export class NewsApp extends BaseApp {
  singletonWindowIds = ["news-yukios"];

  constructor(services) {
    super(services);
  }

  async open() {
    const updates = NEWS_UPDATES;

    const renderSections = (sections) =>
      sections
        .map(
          (section) => `
        <div class="news-section">
          <h2 class="news-section-title">
            <i class="fas ${section.icon}"></i>
            <span>${section.title}</span>
          </h2>
          <div class="news-items">
            ${section.items
              .map(
                ([icon, title, desc]) => `
              <div class="news-item">
                <div class="news-item-icon" aria-hidden="true">
                  <i class="fas ${icon}"></i>
                </div>
                <div class="news-item-body">
                  <div class="news-item-title">${title}</div>
                  <div class="news-item-desc">${desc}</div>
                </div>
              </div>
            `
              )
              .join("")}
          </div>
        </div>
      `
        )
        .join("");

    const updatesHtml = updates
      .map(
        (update) => `
      <div class="news-update">
        <div class="news-update-head">
          <div class="news-date">${update.date}</div>
          <div class="news-label">${update.label || "YukiOS Update"}</div>
        </div>
        ${renderSections(update.sections)}
      </div>
    `
      )
      .join("");

    const content = `
      <div class="window-content" style="padding:0; height: calc(100% - 40px); overflow: hidden;">
        <div class="news-root">
          <div class="news-hero">
            <div class="news-hero-left">
              <div class="news-hero-icon" aria-hidden="true">
                <i class="fas fa-newspaper"></i>
              </div>
              <div class="news-hero-title">
                <h1>What's New</h1>
                <p>The latest updates and fixes for YukiOS</p>
              </div>
            </div>
            <div class="news-hero-meta">
              <div class="news-pill" title="Latest update shown first">
                <i class="fas fa-clock"></i>
                <span>Latest: ${updates[0]?.date ?? "-"}</span>
              </div>
            </div>
          </div>

          ${updatesHtml}
        </div>
      </div>
    `;

    const win = os.window.create("news-yukios", "What's New", "720px", "520px", {
      icon: "fa fa-newspaper",
      appId: "newsApp"
    });
    win.innerHTML = content;
    this.initNews();
    return win;
  }

  initNews() {
    os.storage.set(StorageKeys.newsReadSignatureKey, getNewsContentSignature());
    os.storage.set(StorageKeys.newsSeenKey, "true");
    updateNewsBadge();
  }
}
