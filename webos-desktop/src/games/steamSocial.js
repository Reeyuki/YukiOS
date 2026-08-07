import "../styles/steamCosmetics.css";
import "../styles/steamSocial.css";

import { fetchDiscover, minutesToLabel, formatRelativeTime, isUserOnline } from "../social/socialApi.js";
import { getLiveUserId, avatarUrlForIndex, getAccountStatus } from "../social/userIdentity.js";
import { ACCOUNT_DISCLAIMER, buildAccountBlockHtml, bindAccountBlock } from "../social/accountUI.js";
import { isSocialDisabled } from "../social/socialSettings.js";
import { resolveAppId, resolveAppName, resolveAppIcon, escapeHtml } from "../utils/utils.js";
import { resolveAvatarUrl } from "../social/avatarResolver.js";
import { getAchievementCatalog } from "../achievements.js";
import { computeUserLevel, buildBadgeList } from "./badgeEngine.js";
import { getCurrentUser } from "../desktopui/startMenu.js";
import { PREDEFINED_AVATARS } from "../utils/avatarData.js";
import { BusEvents } from "../core/EventBus.js";
import { os, StorageKeys } from "../framework.js";
import { $, $$, bindEvent, setText, setHTML, setStyle, createElement } from "../shared/domUtils.js";
import { getPresence, setPresence, getDnd, setDnd, PRESENCE } from "../social/presence.js";
import { showContextMenu } from "../shared/contextMenu.js";
import { callIfFunction, isFunction, hasMethod } from "../shared/functionUtils.js";
import { initSettingsToggles } from "./steam.js";
import { fetchFriends, getFriendRelation, sendFriendRequest, acceptFriendRequest, removeFriend, fetchConversations } from "../social/friendsApi.js";
import { fetchLeaderboard, fetchReactions, sendReaction, removeReaction, fetchSocialMe, fetchQuests, claimQuest, invalidateSocialMe } from "../social/socialMeApi.js";
import { fetchShopCatalog, purchaseItem } from "../social/shopApi.js";
import { fetchFeed } from "../social/feedApi.js";

const REACTION_OPTIONS = [
  { id: "heart", icon: "fa-heart", label: "Heart" },
  { id: "fire", icon: "fa-fire", label: "Fire" },
  { id: "gg", icon: "fa-hand-peace", label: "GG" },
  { id: "star", icon: "fa-star", label: "Star" },
  { id: "thumbs", icon: "fa-thumbs-up", label: "Thumbs" }
];
const LEADERBOARD_SORTS = [
  { id: "playtime", label: "Playtime" },
  { id: "level", label: "Level" },
  { id: "achievements", label: "Achievements" }
];

const COSMETIC_TYPES = ["banner", "frame", "name", "badge"];

function itemTypeFromId(itemId) {
  return String(itemId || "").split("_")[0];
}

function getEquippedMap(inventory, equippedPref) {
  const owned = Array.isArray(inventory) ? inventory : [];
  const pref = equippedPref && typeof equippedPref === "object" ? equippedPref : {};
  const map = {};
  for (const type of COSMETIC_TYPES) {
    const firstOwned = owned.find((id) => itemTypeFromId(id) === type);
    const prefPick =
      pref[type] && itemTypeFromId(pref[type]) === type && owned.includes(pref[type]) ? pref[type] : firstOwned;
    if (prefPick) map[type] = prefPick;
  }
  return map;
}

function buildStatusHtml(user) {
  if (user.userId === getLiveUserId()) {
    const presence = getPresence();
    if (presence === PRESENCE.ONLINE) {
      return '<span class="steam-social-status steam-social-status--online">Online</span>';
    }
    if (presence === PRESENCE.INVISIBLE) {
      return '<span class="steam-social-status steam-social-status--invisible">Invisible</span>';
    }
    if (presence === PRESENCE.OFFLINE) {
      return '<span class="steam-social-status steam-social-status--offline">Offline</span>';
    }
  }
  if (user.nowPlaying) {
    return `<span class="steam-social-status steam-social-status--playing">Playing ${escapeHtml(resolveAppName(user.nowPlaying.appId))}</span>`;
  }
  if (isUserOnline(user)) {
    return '<span class="steam-social-status steam-social-status--online">Online</span>';
  }
  return `<span class="steam-social-status">Last online ${formatRelativeTime(user.lastSeen)}</span>`;
}

export function openStatusPicker(event) {
  const current = getPresence();
  const items = [
    { id: "status-online", action: "status-online", label: "Online", icon: current === PRESENCE.ONLINE ? "fa-check" : "fa-circle" },
    { id: "status-invisible", action: "status-invisible", label: "Invisible", icon: current === PRESENCE.INVISIBLE ? "fa-check" : "fa-eye-slash" },
    { id: "status-offline", action: "status-offline", label: "Offline", icon: current === PRESENCE.OFFLINE ? "fa-check" : "fa-power-off" },
    "hr",
    { id: "status-dnd", action: "status-dnd", label: getDnd() ? "Do Not Disturb: On" : "Do Not Disturb: Off", icon: getDnd() ? "fa-check" : "fa-bell-slash" }
  ];
  const handlers = {
    "status-online": () => setPresence(PRESENCE.ONLINE),
    "status-invisible": () => setPresence(PRESENCE.INVISIBLE),
    "status-offline": () => setPresence(PRESENCE.OFFLINE),
    "status-dnd": () => setDnd(!getDnd())
  };
  showContextMenu(event, items, handlers);
}

function gameIconHtml(icon) {
  if (!icon) return '<i class="fas fa-gamepad"></i>';
  const value = String(icon);
  if (/^(https?:|data:|blob:|\.|\/)/i.test(value) || value.includes("/")) {
    return `<img src="${escapeHtml(value)}" loading="lazy" alt="" />`;
  }
  return `<i class="${escapeHtml(value)}"></i>`;
}

function presenceToneFor(user, isSelf) {
  if (isSelf) {
    const p = getPresence();
    if (p === PRESENCE.INVISIBLE) return "invisible";
    if (p === PRESENCE.OFFLINE) return "offline";
    return "online";
  }
  if (user.nowPlaying) return "playing";
  if (isUserOnline(user)) return "online";
  return "offline";
}

function presenceTitleFor(user, isSelf) {
  if (isSelf) {
    const p = getPresence();
    if (p === PRESENCE.INVISIBLE) return "Invisible";
    if (p === PRESENCE.OFFLINE) return "Offline";
    return "Online";
  }
  if (user.nowPlaying) return "Playing";
  if (isUserOnline(user)) return "Online";
  return "Offline";
}

function renderUserRow(user, options) {
    const row = createElement("div", { className: "steam-social-row" });
    if (user.userId === getLiveUserId()) row.classList.add("steam-social-row--self");

    const isSelf = user.userId === getLiveUserId();
    const avatarUrl = isSelf ? (options.localAvatar || null) : avatarUrlForIndex(user.avatarIndex);

    const avatarWrap = createElement("div", { className: "steam-social-avatar-wrap" });
    if (avatarUrl) {
      avatarWrap.appendChild(
        createElement("img", {
          className: "steam-social-avatar",
          attributes: { src: avatarUrl, loading: "lazy" }
        })
      );
    } else {
      avatarWrap.appendChild(
        createElement("div", {
          className: "steam-social-avatar steam-social-avatar--default",
          html: '<i class="fas fa-user"></i>'
        })
      );
    }
    avatarWrap.appendChild(
      createElement("span", {
        className: `steam-social-presence-dot steam-social-presence-dot--${presenceToneFor(user, isSelf)}`,
        attributes: { title: presenceTitleFor(user, isSelf) }
      })
    );
    row.appendChild(avatarWrap);

    const info = createElement("div", { className: "steam-social-info" });
    const nameLine = createElement("div", { className: "steam-social-name" });
    nameLine.appendChild(createElement("span", { className: "steam-social-name-text", text: user.username || "Unknown" }));
    if (isSelf) nameLine.appendChild(createElement("span", { className: "steam-social-you", text: "You" }));
    info.appendChild(nameLine);

    const statusRow = createElement("div", { className: "steam-social-status-row" });
    statusRow.appendChild(createElement("span", { html: buildStatusHtml(user) }));
    info.appendChild(statusRow);

    const meta = createElement("div", { className: "steam-social-meta" });
    meta.appendChild(createElement("span", { className: "steam-social-stat", html: `<i class="fas fa-trophy"></i> ${(user.achievements || []).length}` }));
    meta.appendChild(createElement("span", { className: "steam-social-stat-sep", html: "&middot;" }));
    meta.appendChild(createElement("span", { className: "steam-social-stat", html: `<i class="fas fa-clock"></i> ${formatPlaytime(user.totalMinutes)}` }));
    info.appendChild(meta);

    row.appendChild(info);

    const friendRelations = options.friendRelations;
    if (friendRelations && !isSelf) {
      const relation = friendRelations.get(user.userId) || "none";
      const actions = createElement("div", { className: "steam-social-friend-actions" });
      if (relation === "friend") {
        actions.appendChild(createElement("span", { className: "steam-friend-btn steam-friend-btn--active", html: '<i class="fas fa-user-check"></i> Friends' }));
        const removeBtn = createElement("button", { type: "button", className: "steam-friend-btn steam-friend-btn--remove", html: '<i class="fas fa-user-minus"></i>', attributes: { title: "Remove friend" } });
        bindEvent(removeBtn, "click", (e) => {
          e.stopPropagation();
          removeFriend(user.userId).then((res) => {
            if (res.success) callIfFunction(options.onFriendChange);
          });
        });
        actions.appendChild(removeBtn);
      } else if (relation === "incoming") {
        const acceptBtn = createElement("button", { type: "button", className: "steam-friend-btn steam-friend-btn--accept", html: '<i class="fas fa-check"></i> Accept' });
        const declineBtn = createElement("button", { type: "button", className: "steam-friend-btn steam-friend-btn--decline", html: '<i class="fas fa-times"></i> Decline' });
        bindEvent(acceptBtn, "click", (e) => {
          e.stopPropagation();
          acceptFriendRequest(user.userId).then((res) => {
            if (res.status) callIfFunction(options.onFriendChange);
          });
        });
        bindEvent(declineBtn, "click", (e) => {
          e.stopPropagation();
          removeFriend(user.userId).then((res) => {
            if (res.success) callIfFunction(options.onFriendChange);
          });
        });
        actions.appendChild(acceptBtn);
        actions.appendChild(declineBtn);
      } else if (relation === "outgoing") {
        actions.appendChild(createElement("span", { className: "steam-friend-btn steam-friend-btn--sent", html: '<i class="fas fa-clock"></i> Request sent' }));
      } else {
        const addBtn = createElement("button", { type: "button", className: "steam-friend-btn steam-friend-btn--add", html: '<i class="fas fa-user-plus"></i> Add friend' });
        bindEvent(addBtn, "click", (e) => {
          e.stopPropagation();
          addBtn.disabled = true;
          sendFriendRequest(user.userId).then((res) => {
            if (res.status) {
              os.notify.send("Friend Request Sent", `Request sent to ${user.username || "player"}.`);
              callIfFunction(options.onFriendChange);
            } else {
              addBtn.disabled = false;
              os.dialog.alert("Could Not Send Request", res.error || "The friend request could not be sent.");
            }
          });
        });
        actions.appendChild(addBtn);
      }
      row.appendChild(actions);
    }
    bindEvent(row, "click", () => {
      if (isSelf) {
        os.app.launch("steamApp", { steamPage: "user" });
      } else {
        os.app.launch("steamApp", { steamPage: "profile", steamUserId: user.userId });
      }
    });
    return row;
  }

function loadCatalog() {
  try {
    return getAchievementCatalog() || [];
  } catch {
    return [];
  }
}

function hoursHours(minutes) {
  return Math.floor((Number(minutes) || 0) / 60);
}

function formatPlaytime(minutes) {
  const m = Number(minutes) || 0;
  if (m <= 0) return "0 hrs";
  if (m < 60) return `${Math.max(1, Math.round(m))} min`;
  return `${hoursHours(m)} hrs`;
}

function hoursLabel(minutes) {
  return `${formatPlaytime(minutes)} on record`;
}

function lastPlayedLabel(iso) {
  if (!iso) return "";
  return `last played on ${new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" })}`;
}

function buildBioBlockHtml(user, editable) {
  if (!editable) {
    const hasBio = Boolean(user.bio);
    const cls = hasBio ? "steam-profile-bio" : "steam-profile-bio steam-profile-bio-empty";
    const text = hasBio ? escapeHtml(user.bio) : "No bio yet.";
    return `<div class="${cls}">${text}</div>`;
  }
  const hasBio = Boolean(user.bio);
  const lineCls = hasBio ? "steam-profile-bio" : "steam-profile-bio steam-profile-bio-empty";
  const lineText = hasBio ? escapeHtml(user.bio) : "Write something about yourself...";
  return `
    <div class="${lineCls}">${lineText}</div>
    <button type="button" class="steam-profile-edit-btn"><i class="fas fa-pen"></i> Edit Profile</button>
  `;
}

function buildNowPlayingCardHtml(user) {
  if (!user.nowPlaying) return "";
  const appId = user.nowPlaying.appId;
  const icon = resolveAppIcon(appId) || user.nowPlaying.gameIcon || "fas fa-gamepad";
  return `
    <div class="steam-profile-gamecard steam-profile-gamecard--ingame">
      <div class="steam-profile-gamecard-thumb">${gameIconHtml(icon)}</div>
      <div class="steam-profile-gamecard-info">
        <div class="steam-profile-gamecard-title">${escapeHtml(resolveAppName(appId))}</div>
        <div class="steam-profile-gamecard-ingame-label">In-Game</div>
      </div>
      <button type="button" class="steam-profile-play-btn">Play</button>
    </div>
  `;
}

function buildPlaytimeCardsHtml(user) {
  const playtime = user.playtime || [];
  if (playtime.length === 0) return "";
  const maxMinutes = playtime[0].minutes || 0;
  const cards = playtime
    .map((entry) => {
      const pct = maxMinutes > 0 ? Math.round((entry.minutes / maxMinutes) * 100) : 0;
      const icon = resolveAppIcon(entry.app) || "fas fa-gamepad";
      const last = lastPlayedLabel(entry.lastPlayed);
      return `
        <div class="steam-profile-gamecard">
          <div class="steam-profile-gamecard-thumb">${gameIconHtml(icon)}</div>
          <div class="steam-profile-gamecard-info">
            <div class="steam-profile-gamecard-title">${escapeHtml(resolveAppName(entry.app))}</div>
            <div class="steam-profile-gamecard-progress"><div class="steam-profile-gamecard-progress-fill" style="width:${pct}%"></div></div>
            <div class="steam-profile-gamecard-meta">${hoursLabel(entry.minutes)}${last ? ` \u00b7 ${last}` : ""}</div>
          </div>
        </div>
      `;
    })
    .join("");
  return cards;
}

function badgeTileHtml(badge) {
  const cls = badge.earned
    ? "steam-profile-badge"
    : "steam-profile-badge steam-profile-badge--locked";
  return `
    <div class="${cls}">
      <i class="fas ${escapeHtml(badge.icon)}"></i>
      <div class="steam-badge-tooltip">
        <span class="steam-badge-tooltip-label">${escapeHtml(badge.label)}</span>
        <span class="steam-badge-tooltip-desc">${escapeHtml(badge.desc)}</span>
      </div>
    </div>`;
}

function buildBadgesHtml(user, catalog) {
  const { earned, upcoming } = buildBadgeList(user, catalog);
  const tiles = earned.slice(0, 16).map(badgeTileHtml);
  if (earned.length > 16) {
    tiles.push(`<div class="steam-profile-badge steam-profile-badge--more">+${earned.length - 16}</div>`);
  }
  upcoming.slice(0, 6).forEach((badge) => tiles.push(badgeTileHtml(badge)));
  if (tiles.length === 0) return '<div class="steam-profile-empty">No badges yet.</div>';
  return tiles.join("");
}

function buildFriendActionHtml(relation) {
  if (relation === "friend") {
    return '<div class="steam-profile-friend-action"><span class="steam-friend-btn steam-friend-btn--active"><i class="fas fa-user-check"></i> Friends</span><button type="button" class="steam-friend-btn steam-friend-btn--remove" data-profile-friend-action="remove" title="Remove friend"><i class="fas fa-user-minus"></i></button></div>';
  }
  if (relation === "incoming") {
    return '<div class="steam-profile-friend-action"><button type="button" class="steam-friend-btn steam-friend-btn--accept" data-profile-friend-action="accept"><i class="fas fa-check"></i> Accept</button><button type="button" class="steam-friend-btn steam-friend-btn--decline" data-profile-friend-action="decline"><i class="fas fa-times"></i> Decline</button></div>';
  }
  if (relation === "outgoing") {
    return '<div class="steam-profile-friend-action"><span class="steam-friend-btn steam-friend-btn--sent"><i class="fas fa-clock"></i> Request sent</span></div>';
  }
  return '<div class="steam-profile-friend-action"><button type="button" class="steam-friend-btn steam-friend-btn--add" data-profile-friend-action="add"><i class="fas fa-user-plus"></i> Add friend</button></div>';
}

function buildReactionBarHtml(reactions) {
  const counts = (reactions && reactions.counts) || {};
  const mine = reactions ? reactions.mine : null;
  return `<div class="steam-reaction-bar">${REACTION_OPTIONS.map((r) => {
    const active = mine === r.id ? " steam-reaction-btn--active" : "";
    const count = counts[r.id] || 0;
    return `<button type="button" class="steam-reaction-btn${active}" data-reaction="${r.id}" title="${r.label}"><i class="fas ${r.icon}"></i><span class="steam-reaction-count">${count}</span></button>`;
  }).join("")}</div>`;
}

function buildProfileHtml(user, opts) {
  const catalog = opts.catalog || [];
  const editable = Boolean(opts.editable);
  const stats = computeUserLevel(user);
  const equippedMap = getEquippedMap(opts.inventory, opts.equipped);

  const avatarUrl = opts.localAvatar || avatarUrlForIndex(user.avatarIndex);
  const avatarHtml = avatarUrl
    ? `<img class="steam-profile-frame-img" src="${escapeHtml(avatarUrl)}" loading="lazy" />`
    : '<div class="steam-profile-frame-img steam-profile-frame-img--default"><i class="fas fa-user"></i></div>';

  let statusText;
  let presenceClass = "";
  if (editable) {
    const presence = getPresence();
    if (presence === PRESENCE.ONLINE) {
      statusText = "Online";
      presenceClass = " steam-profile-presence--online";
    } else if (presence === PRESENCE.INVISIBLE) {
      statusText = "Invisible";
      presenceClass = " steam-profile-presence--invisible";
    } else {
      statusText = "Offline";
      presenceClass = " steam-profile-presence--offline";
    }
  } else if (user.nowPlaying) {
    statusText = "Currently Playing";
    presenceClass = " steam-profile-presence--online";
  } else if (isUserOnline(user)) {
    statusText = "Currently Online";
    presenceClass = " steam-profile-presence--online";
  } else {
    statusText = "Currently Offline";
    presenceClass = " steam-profile-presence--offline";
  }

  const nowPlayingHtml = buildNowPlayingCardHtml(user);
  const cardsHtml = buildPlaytimeCardsHtml(user);
  const emptyBody = !nowPlayingHtml && !cardsHtml ? '<div class="steam-profile-empty">No games played yet.</div>' : "";

  const gamesRowCls =
    isFunction(opts.onShowGames)
      ? "steam-profile-stat-row steam-profile-stat-row--link"
      : "steam-profile-stat-row";
  const achievementsRowCls =
    isFunction(opts.onShowAchievements)
      ? "steam-profile-stat-row steam-profile-stat-row--link"
      : "steam-profile-stat-row";

  return `
    <div class="steam-profile">
      <div class="steam-profile-banner${equippedMap.banner ? ` steam-profile-banner--${equippedMap.banner}` : ""}"></div>
      <div class="steam-profile-hero">
        <div class="steam-profile-hero-left">
          <div class="steam-profile-frame${equippedMap.frame ? ` steam-profile-frame--${equippedMap.frame}` : ""}">${avatarHtml}${editable ? '<button type="button" class="steam-profile-frame-change" title="Change avatar"><i class="fas fa-camera"></i></button>' : ""}</div>
          <div class="steam-profile-identity">
            <div class="steam-profile-name${equippedMap.name ? ` steam-profile-name--${equippedMap.name}` : ""}"><span>${escapeHtml(user.username || "Unknown")}</span>${editable ? '<button type="button" class="steam-profile-name-edit-btn" title="Edit profile"><i class="fas fa-pen"></i></button>' : ""}</div>
            <div class="steam-profile-presence${presenceClass}">${statusText}${editable ? '<button type="button" class="steam-status-picker-btn steam-status-picker-btn--presence"><i class="fas fa-chevron-down"></i></button>' : ""}</div>
            ${editable ? `<div class="steam-profile-id-row"><span class="steam-profile-id-value" title="${escapeHtml(user.userId || "")}">${escapeHtml(user.userId || "")}</span><button type="button" class="steam-profile-copy-id-btn" title="Copy my player ID"><i class="fas fa-copy"></i></button></div>` : ""}
            ${buildBioBlockHtml(user, editable)}
            ${!editable ? buildFriendActionHtml(opts.friendRelation) : ""}
            ${!editable ? buildReactionBarHtml(opts.reactions) : ""}
          </div>
        </div>
        <div class="steam-profile-hero-right">
          <div class="steam-profile-level">
            <div class="steam-profile-level-label">Level</div>
            <div class="steam-profile-level-circle">${stats.level}</div>
            <div class="steam-profile-level-bar"><div class="steam-profile-level-bar-fill" style="width:${stats.xp % 100}%"></div></div>
            <div class="steam-profile-level-xp">${stats.xp} XP</div>
          </div>
          <div class="steam-profile-featured">
            <div class="steam-profile-featured-medal"><i class="fas fa-medal"></i></div>
            <div class="steam-profile-featured-text">
              <div class="steam-profile-featured-title">YukiOS Player</div>
              <div class="steam-profile-featured-xp">${stats.xp} XP</div>
            </div>
          </div>
        </div>
      </div>
      <div class="steam-profile-body">
        <div class="steam-profile-main">
          <div class="steam-profile-panel">
            <div class="steam-profile-panel-head">
              <div class="steam-profile-panel-head-group">
                <span class="steam-profile-panel-title">Recently Played</span>
                <span class="steam-profile-panel-sub">${hoursLabel(user.totalMinutes)}</span>
              </div>
              ${isFunction(opts.onShowGames) ? '<button type="button" class="steam-profile-games-btn">Games</button>' : ""}
            </div>
            ${nowPlayingHtml}
            ${cardsHtml}
            ${emptyBody}
          </div>
        </div>
        <div class="steam-profile-side">
          <div class="steam-profile-section">
            <div class="steam-profile-section-head"><span>Badges</span><span class="steam-profile-section-count">${stats.xp} XP</span></div>
            <div class="steam-profile-badges${equippedMap.badge ? ` steam-profile-badges--${equippedMap.badge}` : ""}">${buildBadgesHtml(user, catalog)}</div>
          </div>
          <div class="steam-profile-section">
            <div class="steam-profile-section-head"><span>Stats</span></div>
            <div class="steam-profile-stats">
              <div class="${gamesRowCls}" data-stat="games"><span>Games</span><strong>${stats.gamesPlayed}</strong></div>
              <div class="${achievementsRowCls}" data-stat="achievements"><span>Achievements</span><strong>${stats.achievements}</strong></div>
              <div class="steam-profile-stat-row"><span>Total Playtime</span><strong>${formatPlaytime(user.totalMinutes)}</strong></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function bindPlayButton(btn, user, opts) {
  bindEvent(btn, "click", () => {
    const appId = user.nowPlaying?.appId;
    if (!appId) return;
    if (isFunction(opts.onLaunch)) {
      callIfFunction(opts.onLaunch, appId);
      return;
    }
    const id = resolveAppId(appId);
    if (id) os.app.launch(id).catch(() => {});
  });
}

function bindProfileEvents(root, user, opts) {
  const editable = Boolean(opts.editable);
  $$(".steam-profile-play-btn", root).forEach((btn) => bindPlayButton(btn, user, opts));
  const gamesBtn = $(".steam-profile-games-btn", root);
  if (gamesBtn) {
    bindEvent(gamesBtn, "click", () => {
      callIfFunction(opts.onShowGames, user.userId);
    });
  }

  const gamesRow = $('.steam-profile-stat-row[data-stat="games"]', root);
  if (gamesRow && isFunction(opts.onShowGames)) {
    bindEvent(gamesRow, "click", () => opts.onShowGames(user.userId));
  }

  const achievementsRow = $('.steam-profile-stat-row[data-stat="achievements"]', root);
  if (achievementsRow && isFunction(opts.onShowAchievements)) {
    bindEvent(achievementsRow, "click", () => opts.onShowAchievements(user.userId));
  }

  const friendActionBtn = $("[data-profile-friend-action]", root);
  if (friendActionBtn) {
    bindEvent(friendActionBtn, "click", () => {
      const action = friendActionBtn.dataset.profileFriendAction;
      const run =
        action === "add"
          ? sendFriendRequest(user.userId)
          : action === "accept"
            ? acceptFriendRequest(user.userId)
            : action === "decline" || action === "remove"
              ? removeFriend(user.userId)
              : null;
      if (!run) return;
      run.then((res) => {
        if (res.status || res.success) callIfFunction(opts.onFriendChange);
      });
    });
  }
  if (!editable) {
    $$(".steam-reaction-btn", root).forEach((btn) => {
      bindEvent(btn, "click", () => {
        const reaction = btn.dataset.reaction;
        const mine = opts.reactions ? opts.reactions.mine : null;
        const run = mine === reaction ? removeReaction(user.userId) : sendReaction(user.userId, reaction);
        run.then((res) => {
          if (res.status === "ok" || res.ok) callIfFunction(opts.onFriendChange);
        });
      });
    });
  }

  if (!editable) return;

  const copyIdBtn = $(".steam-profile-copy-id-btn", root);
  if (copyIdBtn) {
    bindEvent(copyIdBtn, "click", async () => {
      const id = user.userId || getLiveUserId();
      if (!id) return;
      let copied = false;
      try {
        await navigator.clipboard.writeText(id);
        copied = true;
      } catch {}
      if (copied) {
        os.notify.send("ID Copied", "Your player ID is on the clipboard.");
      } else {
        os.dialog.alert("Copy Failed", "Couldn't access the clipboard.");
      }
    });
  }

  bindEvent(root, "click", (e) => {
    const presenceBtn = e.target.closest(".steam-status-picker-btn--presence");
    if (!presenceBtn) return;
    e.stopPropagation();
    openStatusPicker(e);
  });

  const questsBtn = $('[data-profile-action="quests"]', root);
  if (questsBtn && isFunction(opts.onShowQuests)) {
    bindEvent(questsBtn, "click", () => opts.onShowQuests());
  }

  const storeBtn = $('[data-profile-action="store"]', root);
  if (storeBtn && isFunction(opts.onShowStore)) {
    bindEvent(storeBtn, "click", () => opts.onShowStore());
  }

  const openEditPage = () => {
    os.app.launch("steamApp", { steamPage: "edit" });
  };

  const editBtn = $(".steam-profile-edit-btn", root);
  if (editBtn) bindEvent(editBtn, "click", openEditPage);
  const nameEditBtn = $(".steam-profile-name-edit-btn", root);
  if (nameEditBtn) bindEvent(nameEditBtn, "click", openEditPage);
  const frameChangeBtn = $(".steam-profile-frame-change", root);
  if (frameChangeBtn) bindEvent(frameChangeBtn, "click", openEditPage);
}

function applyProfileUpdate(user, name, bio, avatar) {
  const history = os.storage.get(StorageKeys.userHistory) || [];
  const currentUserId = os.storage.get(StorageKeys.userId);
  if (currentUserId) {
    const idx = history.findIndex((u) => u.userId === currentUserId);
    if (idx >= 0) {
      history[idx].name = name;
      history[idx].avatar = avatar;
      os.storage.set(StorageKeys.userHistory, history);
    }
  }
  os.storage.set(StorageKeys.username, name);
  if (avatar) os.storage.set(StorageKeys.profilePicture, avatar);
  os.storage.set(StorageKeys.liveBio, bio);
  user.username = name;
  user.bio = bio;
  os.events.emit(BusEvents.PROFILE_UPDATED, { userId: getLiveUserId(), name, avatar });
}

function openAvatarUpload(onSelected) {
  const input = createElement("input", {
    attributes: {
      type: "file",
      accept: "image/png,image/jpeg,image/gif,image/webp,.png,.jpg,.jpeg,.gif,.webp"
    },
    styles: { display: "none" }
  });
  document.body.appendChild(input);
  bindEvent(input, "change", async () => {
    const file = input.files && input.files[0];
    input.remove();
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      os.dialog.alert("Alert", "That image is too big. Keep it under 2MB.");
      return;
    }
    try {
      const currentUserId = os.storage.get(StorageKeys.userId) || "user";
      const rawExt = String(file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
      const safeExt = ["png", "jpg", "jpeg", "gif", "webp"].includes(rawExt) ? rawExt : "png";
      const fileName = `steam-avatar-${currentUserId}-${Date.now()}.${safeExt}`;
      await os.fs.writeBinaryFile(["Pictures"], fileName, file, "image", "static/icons/image.webp");
      const fileRef = `fs://Pictures/${fileName}`;
      const blob = await os.fs.readBinaryFile(["Pictures"], fileName);
      const objectUrl = blob ? URL.createObjectURL(blob) : fileRef;
      callIfFunction(onSelected, fileRef, objectUrl);
    } catch (e) {
      os.dialog.alert("Upload Failed", "Couldn't save that avatar. Try a smaller image.");
    }
  });
  input.click();
}

async function renderUserList(host, users, options) {
  const opts = options || {};
  const friendRelations = new Map();
  const searchInput = createElement("input", {
    className: "steam-social-search",
    attributes: { type: "text", placeholder: "Search players by name or ID..." }
  });
  const list = createElement("div", { className: "steam-social-list" });
  setHTML(host, "");
  setStyle(host, { display: "flex", flexDirection: "column" });
  host.appendChild(searchInput);
  host.appendChild(list);

  const sortedUsers = [...users].sort((a, b) => {
    const aOnline = isUserOnline(a);
    const bOnline = isUserOnline(b);
    if (aOnline !== bOnline) return aOnline ? -1 : 1;
    const aLast = new Date(a.lastSeen || 0).getTime();
    const bLast = new Date(b.lastSeen || 0).getTime();
    return bLast - aLast;
  });

  const PAGE_SIZE = 24;
  let visibleCount = PAGE_SIZE;
  let lastQuery = "";

  const matchesQuery = (user, normalized) =>
    String(user.username || "").toLowerCase().includes(normalized) ||
    String(user.userId || "").toLowerCase().includes(normalized);

  const refreshRelations = async () => {
    const data = await fetchFriends({ refresh: true }).catch(() => null);
    friendRelations.clear();
    if (data) {
      for (const f of data.friends) friendRelations.set(f.userId, "friend");
      for (const r of data.requests) friendRelations.set(r.userId, "incoming");
      for (const s of data.sentRequests) friendRelations.set(s.userId, "outgoing");
    }
    renderList(searchInput.value);
  };

  const renderList = (query) => {
    const normalized = (query || "").toLowerCase().trim();
    if (normalized !== lastQuery) {
      lastQuery = normalized;
      visibleCount = PAGE_SIZE;
    }
    const filtered = normalized ? sortedUsers.filter((u) => matchesQuery(u, normalized)) : sortedUsers;
    setHTML(list, "");
    const renderOpts = { ...opts, friendRelations, onFriendChange: refreshRelations };
    filtered.slice(0, visibleCount).forEach((user) => {
      list.appendChild(renderUserRow(user, renderOpts));
    });
    if (filtered.length > visibleCount) {
      const moreBtn = createElement("button", {
        attributes: { type: "button" },
        className: "steam-social-more",
        text: `Show more (${filtered.length - visibleCount})`
      });
      bindEvent(moreBtn, "click", () => {
        visibleCount += PAGE_SIZE;
        renderList(searchInput.value);
      });
      list.appendChild(moreBtn);
    }
  };

  renderList("");
  bindEvent(searchInput, "input", () => renderList(searchInput.value));
  if (opts.friendActions) {
    const data = await fetchFriends().catch(() => null);
    if (data) {
      for (const f of data.friends) friendRelations.set(f.userId, "friend");
      for (const r of data.requests) friendRelations.set(r.userId, "incoming");
      for (const s of data.sentRequests) friendRelations.set(s.userId, "outgoing");
    }
    if (host.isConnected) renderList(searchInput.value);
  }
}

export async function renderDiscoverPanel(panel, options = {}) {
  if (!panel || !panel.isConnected) return;

  const opts = options || {};
  setHTML(panel, '<div class="steam-social-loading">Loading community...</div>');
  const users = await fetchDiscover();
  if (!panel.isConnected) return;

  if (users === null) {
    setHTML(panel, '<div class="steam-social-error">Could not load the community.</div>');
    return;
  }

  const localAvatar = await resolveAvatarUrl(getCurrentUser().avatar, "static/icons/guest.webp");
  await renderUserList(panel, users, { ...opts, localAvatar, friendActions: true });
}

function friendGroupFor(friend) {
  if (friend.nowPlaying) return "ingame";
  if (isUserOnline(friend)) return "online";
  return "offline";
}

function friendGameIconHtml(friend) {
  const playing = friend.nowPlaying;
  if (!playing) return "";
  const icon = resolveAppIcon(playing.appId) || playing.gameIcon || "";
  return `<div class="steam-friend-game-badge">${gameIconHtml(icon)}</div>`;
}

function buildFriendRow(friend, opts) {
  const row = createElement("div", {
    className: `steam-friend-row steam-friend-row--${friendGroupFor(friend)}`
  });
  const gameBadgeHtml = friendGameIconHtml(friend);
  if (gameBadgeHtml) {
    row.appendChild(createElement("div", { html: gameBadgeHtml }));
  }
  const avatarUrl = avatarUrlForIndex(friend.avatarIndex);
  const avatarHtml = avatarUrl
    ? `<img src="${avatarUrl}" class="steam-friend-avatar" loading="lazy" />`
    : '<div class="steam-friend-avatar steam-friend-avatar--default"><i class="fas fa-user"></i></div>';
  row.appendChild(createElement("div", { className: "steam-friend-avatar-frame", html: avatarHtml }));
  const info = createElement("div", { className: "steam-friend-info" });
  info.appendChild(createElement("div", { className: "steam-friend-name-line", text: friend.username || "Unknown" }));
  if (friend.nowPlaying) {
    const gameName = friend.nowPlaying.gameTitle || resolveAppName(friend.nowPlaying.appId);
    info.appendChild(createElement("div", { className: "steam-friend-game-title", text: gameName }));
  } else {
    info.appendChild(
      createElement("div", {
        className: "steam-friend-presence",
        text: friendGroupFor(friend) === "online" ? "Online" : `Last online ${formatRelativeTime(friend.lastSeen)}`
      })
    );
  }
  row.appendChild(info);
  if (friend.nowPlaying && isFunction(opts.onLaunch)) {
    const playBtn = createElement("button", {
      attributes: { type: "button" },
      className: "steam-profile-play-btn steam-friend-play-btn",
      html: '<i class="fas fa-play"></i> Play'
    });
    bindEvent(playBtn, "click", (e) => {
      e.stopPropagation();
      opts.onLaunch(friend.nowPlaying.appId);
    });
    row.appendChild(playBtn);
  }
  bindEvent(row, "click", () => {
    os.app.launch("steamApp", { steamPage: "profile", steamUserId: friend.userId });
  });
  bindEvent(row, "dblclick", () => {
    callIfFunction(opts.onOpenChat, friend);
  });
  bindEvent(row, "contextmenu", (e) => {
    e.preventDefault();
    e.stopPropagation();
    callIfFunction(opts.onOpenContextMenu, e, friend);
  });
  return row;
}

function buildFriendGroup(title, group, friends, opts) {
  const host = createElement("div", { className: `steam-friend-group steam-friend-group--${group} steam-friend-group--open` });
  const head = createElement("button", {
    type: "button",
    className: "steam-friend-group-head"
  });
  head.appendChild(createElement("span", { className: "steam-friend-group-chevron", html: '<i class="fas fa-chevron-right"></i>' }));
  head.appendChild(createElement("span", { className: "steam-friend-group-title", text: title }));
  head.appendChild(createElement("span", { className: "steam-friend-group-count", text: String(friends.length) }));
  host.appendChild(head);
  const body = createElement("div", { className: "steam-friend-group-body" });
  friends.forEach((friend) => body.appendChild(buildFriendRow(friend, opts)));
  host.appendChild(body);
  bindEvent(head, "click", () => host.classList.toggle("steam-friend-group--open"));
  return host;
}

export async function renderFriendsListPanel(panel, options = {}) {
  if (!panel || !panel.isConnected) return;
  const opts = options || {};
  setHTML(panel, '<div class="steam-social-loading">Loading friends...</div>');
  const data = await fetchFriends();
  if (!panel.isConnected) return;
  const friends = Array.isArray(data?.friends) ? data.friends : [];
  const query = typeof opts.query === "string" ? opts.query.trim().toLowerCase() : "";
  const filtered = query ? friends.filter((friend) => String(friend.username || "").toLowerCase().includes(query)) : friends;
  if (filtered.length === 0) {
    setHTML(
      panel,
      query
        ? '<div class="steam-social-empty">No friends match that name.</div>'
        : '<div class="steam-social-empty">No friends yet. Add people from the community.</div>'
    );
    return;
  }
  const grouped = {
    ingame: [],
    online: [],
    offline: []
  };
  filtered.forEach((friend) => grouped[friendGroupFor(friend)].push(friend));
  Object.keys(grouped).forEach((key) => {
    grouped[key].sort((a, b) => String(b.lastSeen || "").localeCompare(String(a.lastSeen || "")));
  });
  const list = createElement("div", { className: "steam-friend-list" });
  if (grouped.ingame.length) list.appendChild(buildFriendGroup("In Game", "ingame", grouped.ingame, opts));
  if (grouped.online.length) list.appendChild(buildFriendGroup("Online", "online", grouped.online, opts));
  if (grouped.offline.length) list.appendChild(buildFriendGroup("Offline", "offline", grouped.offline, opts));
  setHTML(panel, "");
  panel.appendChild(list);
}

export async function renderRequestsPanel(panel, options = {}) {
  if (!panel || !panel.isConnected) return;
  const opts = options || {};
  setHTML(panel, '<div class="steam-social-loading">Loading requests...</div>');
  const data = await fetchFriends({ refresh: true });
  if (!panel.isConnected) return;
  const requests = Array.isArray(data?.requests) ? data.requests : [];
  if (requests.length === 0) {
    setHTML(panel, '<div class="steam-social-empty">No pending friend requests.</div>');
    return;
  }
  const list = createElement("div", { className: "steam-social-list" });
  requests.forEach((request) => {
    const row = createElement("div", { className: "steam-friend-row steam-friend-request-row" });
    const frame = createElement("div", { className: "steam-friend-avatar-frame" });
    const avatarUrl = avatarUrlForIndex(request.avatarIndex);
    if (avatarUrl) {
      frame.appendChild(createElement("img", { className: "steam-friend-avatar", attributes: { src: avatarUrl, loading: "lazy" } }));
    } else {
      frame.appendChild(createElement("span", { className: "steam-friend-avatar steam-friend-avatar--default", html: '<i class="fas fa-user"></i>' }));
    }
    row.appendChild(frame);
    const info = createElement("div", { className: "steam-friend-info" });
    info.appendChild(createElement("div", { className: "steam-friend-name-line", text: request.username || "Unknown" }));
    row.appendChild(info);
    const actions = createElement("div", { className: "steam-friend-request-actions" });
    const acceptBtn = createElement("button", { type: "button", className: "steam-friend-request-btn steam-friend-request-btn--accept", html: '<i class="fas fa-check"></i>' });
    const declineBtn = createElement("button", { type: "button", className: "steam-friend-request-btn steam-friend-request-btn--decline", html: '<i class="fas fa-xmark"></i>' });
    bindEvent(acceptBtn, "click", (e) => {
      e.stopPropagation();
      acceptFriendRequest(request.userId).then((res) => {
        if (res.status) callIfFunction(opts.onChange);
      });
    });
    bindEvent(declineBtn, "click", (e) => {
      e.stopPropagation();
      removeFriend(request.userId).then((res) => {
        if (res.success) callIfFunction(opts.onChange);
      });
    });
    actions.appendChild(acceptBtn);
    actions.appendChild(declineBtn);
    row.appendChild(actions);
    bindEvent(row, "contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      callIfFunction(opts.onOpenContextMenu, e, request);
    });
    list.appendChild(row);
  });
  setHTML(panel, "");
  panel.appendChild(list);
}

export async function renderConversationsPanel(panel, options = {}) {
  if (!panel || !panel.isConnected) return;
  const opts = options || {};
  setHTML(panel, '<div class="steam-social-loading">Loading messages...</div>');
  const conversations = await fetchConversations({ refresh: true });
  if (!panel.isConnected) return;
  if (!conversations || conversations.length === 0) {
    setHTML(
      panel,
      '<div class="steam-social-empty">No conversations yet. Message a friend from this window.</div>'
    );
    return;
  }
  const list = createElement("div", { className: "steam-social-list" });
  conversations.forEach((conversation) => {
    const row = createElement("div", { className: "steam-social-row" });
    const avatarUrl = avatarUrlForIndex(conversation.avatarIndex);
    if (avatarUrl) {
      row.appendChild(createElement("img", { className: "steam-social-avatar", attributes: { src: avatarUrl, loading: "lazy" } }));
    } else {
      row.appendChild(createElement("div", { className: "steam-social-avatar steam-social-avatar--default", html: '<i class="fas fa-user"></i>' }));
    }
    const info = createElement("div", { className: "steam-social-info" });
    const nameLine = createElement("div", { className: "steam-social-name" });
    nameLine.appendChild(createElement("span", { className: "steam-social-name-text", text: conversation.username || "Unknown" }));
    const unread = Number(conversation.unreadCount || 0);
    if (unread > 0) {
      nameLine.appendChild(createElement("span", { className: "steam-conversation-unread", text: String(unread) }));
    }
    info.appendChild(nameLine);
    const lastText = conversation.lastMessage
      ? conversation.lastMessage.body
      : "Say hello to start a conversation";
    info.appendChild(
      createElement("div", {
        className: "steam-social-meta",
        text: `${conversation.lastMessage && conversation.lastMessage.fromMe ? "You: " : ""}${lastText}`
      })
    );
    row.appendChild(info);
    bindEvent(row, "click", () => {
      callIfFunction(opts.onOpenConversation, conversation);
    });
    list.appendChild(row);
  });
  setHTML(panel, "");
  panel.appendChild(list);
}

export async function renderFeedPanel(panel, options = {}) {
  if (!panel || !panel.isConnected) return;
  const opts = options || {};
  setHTML(panel, '<div class="steam-social-loading">Loading activity...</div>');
  const feed = await fetchFeed({ refresh: true });
  if (!panel.isConnected) return;
  if (!feed || feed.length === 0) {
    setHTML(
      panel,
      '<div class="steam-social-empty">No activity yet. Add friends to see what they are up to.</div>'
    );
    return;
  }
  const list = createElement("div", { className: "steam-feed-list" });
  feed.forEach((item) => {
    const row = createElement("div", { className: "steam-feed-item" });
    const actor = item.actor || {};
    const avatarUrl = avatarUrlForIndex(actor.avatarIndex);
    let metaHtml = "";
    let icon = "fa-info-circle";
    if (item.type === "friend") {
      metaHtml = `${escapeHtml(actor.username)} became friends with you`;
      icon = "fa-user-friends";
    } else if (item.type === "reaction") {
      const reactionId = item.data && item.data.reaction;
      const reaction = REACTION_OPTIONS.find((r) => r.id === reactionId) || REACTION_OPTIONS[0];
      metaHtml = `${escapeHtml(actor.username)} reacted to your profile with a ${reaction.label}`;
      icon = reaction.icon;
    } else if (item.type === "playing") {
      const gameName = (item.data && item.data.gameTitle) || resolveAppName(item.data && item.data.appId);
      metaHtml = `${escapeHtml(actor.username)} started playing ${escapeHtml(gameName)}`;
      icon = "fa-gamepad";
    } else if (item.type === "achievement") {
      metaHtml = `${escapeHtml(actor.username)} unlocked an achievement`;
      icon = "fa-trophy";
    } else {
      metaHtml = `${escapeHtml(actor.username)} did something new`;
    }
    const avatarHtml = avatarUrl
      ? `<img src="${avatarUrl}" class="steam-feed-avatar" loading="lazy" />`
      : `<div class="steam-feed-avatar steam-feed-avatar--default"><i class="fas fa-user"></i></div>`;
    row.innerHTML = `
      <div class="steam-feed-avatar-wrap">${avatarHtml}</div>
      <div class="steam-feed-body">
        <div class="steam-feed-meta"><i class="fas ${icon}"></i><span>${metaHtml}</span></div>
        <div class="steam-feed-time">${formatRelativeTime(item.createdAt)}</div>
      </div>
    `;
    if (isFunction(opts.onOpenProfile)) {
      bindEvent(row, "click", () => opts.onOpenProfile(actor.userId));
    }
    list.appendChild(row);
  });
  setHTML(panel, "");
  panel.appendChild(list);
}

export async function renderCommunityPage(pageEl, options = {}) {
  if (pageEl.dataset.steamCommunityRendered) return;
  pageEl.dataset.steamCommunityRendered = "1";

  const opts = options || {};
  setHTML(
    pageEl,
    `
    <div class="steam-community-head">
      <span class="steam-community-title">Community</span>
      <span class="steam-community-count"></span>
    </div>
    <div class="steam-community-nav">
      <button type="button" class="steam-community-nav-btn steam-community-nav-btn--active" data-community-nav="activity"><i class="fas fa-bolt"></i><span>Activity</span></button>
      <button type="button" class="steam-community-nav-btn" data-community-nav="players"><i class="fas fa-users"></i><span>Players</span></button>
    </div>
    <div class="steam-community-activity"></div>
    <div class="steam-community-body">
      <div class="steam-social-loading">Loading community...</div>
    </div>
    `
  );

  const countEl = $(".steam-community-count", pageEl);
  const activityEl = $(".steam-community-activity", pageEl);
  const body = $(".steam-community-body", pageEl);
  setStyle(body, { display: "none" });

  const navBtns = $$(".steam-community-nav-btn", pageEl);
  navBtns.forEach((btn) => {
    bindEvent(btn, "click", () => {
      navBtns.forEach((b) => b.classList.toggle("steam-community-nav-btn--active", b === btn));
      const isActivity = btn.dataset.communityNav === "activity";
      setStyle(activityEl, { display: isActivity ? "" : "none" });
      setStyle(body, { display: isActivity ? "none" : "" });
    });
  });

  renderFeedPanel(activityEl, {
    onOpenProfile: (userId) => {
      os.app.launch("steamApp", { steamPage: "profile", steamUserId: userId });
    }
  });

  const users = await fetchDiscover();
  if (!pageEl.isConnected) return;
  if (users === null) {
    setHTML(body, '<div class="steam-social-error">Could not load the community.</div>');
    return;
  }
  if (countEl) setText(countEl, `${users.length} players`);

  const localAvatar = await resolveAvatarUrl(getCurrentUser().avatar, "static/icons/guest.webp");
  if (!pageEl.isConnected) return;
  setHTML(body, "");
  const leaderboardEl = createElement("div", { className: "steam-community-leaderboard" });
  const listHost = createElement("div", { className: "steam-community-list" });
  body.appendChild(leaderboardEl);
  body.appendChild(listHost);
  renderCommunityLeaderboard(leaderboardEl, { onLaunch: opts.onLaunch });
  await renderUserList(listHost, users, { ...opts, localAvatar, friendActions: true });
}

async function renderCommunityLeaderboard(host, options) {
  const opts = options || {};
  let currentSort = "playtime";
  setHTML(host, '<div class="steam-leaderboard-loading">Loading leaderboard...</div>');
  const build = async (sort) => {
    setHTML(
      host,
      `
      <div class="steam-leaderboard">
        <div class="steam-leaderboard-head">
          <span class="steam-leaderboard-title">Weekly Leaderboard</span>
        </div>
        <div class="steam-leaderboard-tabs">
          ${LEADERBOARD_SORTS.map((s) => `<button type="button" class="steam-leaderboard-tab${sort === s.id ? " steam-leaderboard-tab--active" : ""}" data-tab="${s.id}">${s.label}</button>`).join("")}
        </div>
        <div class="steam-leaderboard-rows">Loading...</div>
      </div>
      `
    );
    const rowsEl = $(".steam-leaderboard-rows", host);
    const board = await fetchLeaderboard(undefined, sort);
    if (!host.isConnected) return;
    if (!board || board.length === 0) {
      setHTML(rowsEl, '<div class="steam-leaderboard-empty">No data yet this week.</div>');
    } else {
      setHTML(rowsEl, "");
      board.forEach((entry, index) => {
        const value =
          sort === "playtime"
            ? `${hoursHours(entry.playtimeMinutes)}h`
            : sort === "level"
              ? `Level ${entry.level}`
              : `${entry.achievements} unlocked`;
        const row = createElement("div", { className: "steam-leaderboard-row" });
        row.appendChild(createElement("span", { className: "steam-leaderboard-rank", text: String(index + 1) }));
        const avatar = entry.avatarIndex >= 0 ? avatarUrlForIndex(entry.avatarIndex) : null;
        if (avatar) {
          row.appendChild(createElement("img", { className: "steam-leaderboard-avatar", attributes: { src: avatar, loading: "lazy" } }));
        } else {
          row.appendChild(createElement("div", { className: "steam-leaderboard-avatar steam-leaderboard-avatar--default", html: '<i class="fas fa-user"></i>' }));
        }
        row.appendChild(createElement("span", { className: "steam-leaderboard-name", text: entry.username || "Unknown" }));
        row.appendChild(createElement("span", { className: "steam-leaderboard-value", text: value }));
        bindEvent(row, "click", () => {
          if (entry.userId === getLiveUserId()) os.app.launch("steamApp", { steamPage: "user" });
          else os.app.launch("steamApp", { steamPage: "profile", steamUserId: entry.userId });
        });
        rowsEl.appendChild(row);
      });
    }
    $$(".steam-leaderboard-tab", host).forEach((tab) => {
      bindEvent(tab, "click", () => {
        if (tab.dataset.tab === currentSort) return;
        currentSort = tab.dataset.tab;
        build(currentSort);
      });
    });
  };
  await build(currentSort);
}

export async function renderQuestsPage(pageEl, options = {}) {
  if (!pageEl || !pageEl.isConnected) return;
  const opts = options || {};
  const userId = getLiveUserId();

  if (!userId) {
    setHTML(
      pageEl,
      `
      <div class="steam-quests-empty">
        <div class="steam-quests-empty-icon"><i class="fas fa-clipboard-list"></i></div>
        <p class="steam-quests-empty-title">Sign in to unlock daily quests</p>
        <p class="steam-quests-empty-sub">Complete quests every day to earn YukiCoins.</p>
        <button type="button" class="steam-quests-login-btn" data-quests-action="login"><i class="fas fa-sign-in-alt"></i> Sign In</button>
      </div>
      `
    );
    bindEvent(pageEl, "click", (e) => {
      const btn = e.target.closest("[data-quests-action='login']");
      if (!btn) return;
      callIfFunction(opts.onShowLogin);
    });
    return;
  }

  setHTML(pageEl, '<div class="steam-social-loading">Loading quests...</div>');

  const [quests, me] = await Promise.all([fetchQuests(), fetchSocialMe()]);
  if (!pageEl.isConnected) return;

  const coins = typeof me?.coins === "number" ? me.coins : 0;
  const walletHtml = `<span class="steam-quests-wallet"><i class="fas fa-coins"></i> <strong>${coins}</strong> YukiCoins</span>`;
  const headHtml = `
    <div class="steam-quests-head">
      <div>
        <h2 class="steam-quests-title">Daily Quests</h2>
        <p class="steam-quests-sub">Complete quests today to earn YukiCoins.</p>
      </div>
      ${walletHtml}
    </div>
  `;

  if (!quests || quests.length === 0) {
    setHTML(
      pageEl,
      `${headHtml}<div class="steam-quests-empty"><p class="steam-quests-empty-title">No quests today</p><p class="steam-quests-empty-sub">Check back tomorrow for a fresh set.</p></div>`
    );
    return;
  }

  const list = createElement("div", { className: "steam-quests-list" });
  quests.forEach((quest) => {
    const pct = quest.target > 0 ? Math.min(100, Math.round((quest.progress / quest.target) * 100)) : 0;
    const done = Boolean(quest.claimed);
    const ready = !done && quest.progress >= quest.target;
    const card = createElement("div", { className: `steam-quest${ready ? " steam-quest--ready" : ""}${done ? " steam-quest--done" : ""}` });
    card.appendChild(createElement("div", { className: "steam-quest-icon", html: `<i class="fas ${quest.icon}"></i>` }));
    const body = createElement("div", { className: "steam-quest-body" });
    body.appendChild(createElement("div", { className: "steam-quest-title", text: quest.title }));
    body.appendChild(createElement("div", { className: "steam-quest-desc", text: quest.desc }));
    const progressWrap = createElement("div", { className: "steam-quest-progress-wrap" });
    progressWrap.appendChild(createElement("div", { className: "steam-quest-progress", html: `<div class="steam-quest-progress-fill" style="width:${pct}%"></div>` }));
    progressWrap.appendChild(createElement("span", { className: "steam-quest-meta", text: `${quest.progress}/${quest.target}` }));
    body.appendChild(progressWrap);
    card.appendChild(body);
    card.appendChild(createElement("div", { className: "steam-quest-reward", html: `+${quest.rewardCoins} <i class="fas fa-coins"></i>` }));
    const claimBtn = createElement("button", {
      attributes: { type: "button" },
      className: `steam-quest-btn${ready ? " steam-quest-btn--claim" : ""}`,
      html: done ? '<i class="fas fa-check"></i> Claimed' : ready ? '<i class="fas fa-gift"></i> Claim' : '<i class="fas fa-lock"></i> Locked'
    });
    if (ready) {
      bindEvent(claimBtn, "click", async () => {
        claimBtn.disabled = true;
        const res = await claimQuest(quest.id);
        if (res.status === "ok") {
          invalidateSocialMe();
          renderQuestsPage(pageEl, opts);
          os.events.emit(BusEvents.PROFILE_UPDATED);
        } else {
          os.dialog.alert("Claim Failed", res.error || "Could not claim the quest.");
          claimBtn.disabled = false;
        }
      });
    } else {
      claimBtn.disabled = true;
    }
    card.appendChild(claimBtn);
    list.appendChild(card);
  });

  setHTML(pageEl, `${headHtml}<div class="steam-quests-list"></div>`);
  const listHost = $(".steam-quests-list", pageEl);
  if (listHost) listHost.replaceWith(list);
}

function buildItemPreview(item, avatarUrl = "", userName = "") {
  const type = item.type;
  if (type === "banner") {
    return `<div class="steam-store-preview-slot steam-store-preview--banner steam-profile-banner--${item.id}"></div>`;
  }
  if (type === "frame") {
    const inner = avatarUrl
      ? `<img class="steam-store-preview-avatar steam-profile-frame-img" src="${escapeHtml(avatarUrl)}" alt="" />`
      : '<div class="steam-store-preview-avatar steam-profile-frame-img"><i class="fas fa-user"></i></div>';
    return `<div class="steam-store-preview-slot steam-store-preview--frame steam-profile-frame--${item.id}">${inner}</div>`;
  }
  if (type === "name") {
    return `<div class="steam-store-preview-slot steam-store-preview--name steam-profile-name--${item.id}"><span>${escapeHtml(userName || "Preview")}</span></div>`;
  }
  if (type === "badge") {
    return `<div class="steam-store-preview-slot steam-store-preview--badges steam-profile-badges--${item.id}"><span class="steam-store-preview-badge steam-profile-badge"><i class="fas fa-award"></i></span></div>`;
  }
  return `<i class="fas ${item.icon}"></i>`;
}

function buildItemDetailPreview(item, avatarUrl, userName) {
  const frameCls = item.type === "frame" ? ` steam-profile-frame--${item.id}` : "";
  const nameCls = item.type === "name" ? ` steam-profile-name--${item.id}` : "";
  const bannerCls = item.type === "banner" ? ` steam-profile-banner--${item.id}` : "";
  const badgeCls = item.type === "badge" ? ` steam-profile-badges--${item.id}` : "";
  const avatarHtml = avatarUrl
    ? `<img class="steam-profile-frame-img" src="${escapeHtml(avatarUrl)}" alt="" />`
    : '<div class="steam-profile-frame-img steam-profile-frame-img--default"><i class="fas fa-user"></i></div>';
  return `
    <div class="steam-store-detail-banner${bannerCls}"></div>
    <div class="steam-store-detail-body">
      <div class="steam-store-detail-avatar">
        <div class="steam-profile-frame${frameCls}">${avatarHtml}</div>
      </div>
      <div class="steam-store-detail-identity">
        <div class="steam-profile-name${nameCls}"><span>${escapeHtml(userName || "Preview")}</span></div>
        <div class="steam-store-detail-badges${badgeCls}">
          <span class="steam-profile-badge"><i class="fas fa-award"></i></span>
          <span class="steam-profile-badge"><i class="fas fa-trophy"></i></span>
          <span class="steam-profile-badge"><i class="fas fa-star"></i></span>
        </div>
      </div>
    </div>
  `;
}

function appendStoreActionButton(host, ctx) {
  const { item, owned, equippedType, equipped, coins, onSuccess } = ctx;
  if (owned && !equippedType) {
    const equipBtn = createElement("button", {
      className: "steam-store-item-btn steam-store-item-btn--equip steam-store-modal-btn",
      attributes: { type: "button" },
      html: '<i class="fas fa-check"></i> Equip'
    });
    bindEvent(equipBtn, "click", () => {
      os.storage.set(StorageKeys.socialEquipped, { ...equipped, [item.type]: item.id });
      callIfFunction(onSuccess);
    });
    host.appendChild(equipBtn);
    return;
  }
  if (owned) {
    host.appendChild(
      createElement("button", {
        className: "steam-store-item-btn steam-store-item-btn--equipped steam-store-modal-btn",
        attributes: { type: "button", disabled: true },
        html: '<i class="fas fa-check"></i> Equipped'
      })
    );
    return;
  }
  const canBuy = coins >= item.priceCoins;
  const buyBtn = createElement("button", {
    className: `steam-store-item-btn steam-store-item-btn--buy steam-store-modal-btn${canBuy ? "" : " steam-store-item-btn--disabled"}`,
    attributes: { type: "button" },
    html: `<i class="fas fa-cart-plus"></i> Buy for ${item.priceCoins} <i class="fas fa-coins"></i>`
  });
  if (!canBuy) buyBtn.disabled = true;
  bindEvent(buyBtn, "click", async () => {
    buyBtn.disabled = true;
    const res = await purchaseItem(item.id);
    if (res.status === "ok") {
      invalidateSocialMe();
      os.notify.send("Purchased", `${item.name} added to your inventory.`);
      os.events.emit(BusEvents.PROFILE_UPDATED);
      callIfFunction(onSuccess);
    } else {
      os.dialog.alert("Purchase Failed", res.error || "Could not buy that item.");
      buyBtn.disabled = false;
    }
  });
  host.appendChild(buyBtn);
}

function openItemPreview(pageEl, item, state) {
  const { avatarUrl, userName, coins, inventory, equipped, opts } = state;
  if (!pageEl.isConnected) return;
  const owned = inventory.includes(item.id);
  const equippedType = equipped[item.type] === item.id;
  const prestige = item.rarity === "prestige";
  const limited = Boolean(item.endsAt);
  const priceHtml =
    item.priceCoins > 0 ? `${item.priceCoins} <i class="fas fa-coins"></i>` : "Free";

  const overlay = createElement("div", { className: "steam-store-overlay" });
  overlay.innerHTML = `
    <div class="steam-store-modal">
      <button type="button" class="steam-store-modal-close" title="Close"><i class="fas fa-xmark"></i></button>
      <div class="steam-store-modal-preview">${buildItemDetailPreview(item, avatarUrl, userName)}</div>
      <div class="steam-store-modal-head">
        <div class="steam-store-modal-title">${escapeHtml(item.name)}</div>
        ${prestige || limited ? `<span class="steam-store-tag${prestige ? " steam-store-tag--prestige" : ""}${limited ? " steam-store-tag--limited" : ""}">${prestige ? '<i class="fas fa-gem"></i> Legendary' : '<i class="fas fa-clock"></i> Limited'}</span>` : ""}
      </div>
      <div class="steam-store-modal-desc">${escapeHtml(item.description)}</div>
      <div class="steam-store-modal-price">${priceHtml}</div>
      <div class="steam-store-modal-actions"></div>
    </div>
  `;
  pageEl.appendChild(overlay);

  const close = () => overlay.remove();
  const closeBtn = $(".steam-store-modal-close", overlay);
  if (closeBtn) bindEvent(closeBtn, "click", close);
  bindEvent(overlay, "click", (e) => {
    if (e.target === overlay) close();
  });
  overlay.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });

  const actionsHost = $(".steam-store-modal-actions", overlay);
  if (actionsHost) {
    appendStoreActionButton(actionsHost, {
      item,
      owned,
      equippedType,
      equipped,
      coins,
      onSuccess: () => {
        close();
        renderStorePage(pageEl, opts);
      }
    });
  }
}

export async function renderStorePage(pageEl, options = {}) {
  if (!pageEl || !pageEl.isConnected) return;
  const opts = options || {};
  const userId = getLiveUserId();

  if (!userId) {
    setHTML(
      pageEl,
      `
      <div class="steam-store-empty">
        <div class="steam-store-empty-icon"><i class="fas fa-store"></i></div>
        <p class="steam-store-empty-title">Sign in to open the Profile Store</p>
        <p class="steam-store-empty-sub">Spend YukiCoins on cosmetics for your profile.</p>
        <button type="button" class="steam-store-login-btn" data-store-action="login"><i class="fas fa-sign-in-alt"></i> Sign In</button>
      </div>
      `
    );
    bindEvent(pageEl, "click", (e) => {
      const btn = e.target.closest("[data-store-action='login']");
      if (btn) callIfFunction(opts.onShowLogin);
    });
    return;
  }

  setHTML(pageEl, '<div class="steam-social-loading">Loading store...</div>');

  const [catalog, me] = await Promise.all([fetchShopCatalog(), fetchSocialMe()]);
  if (!pageEl.isConnected) return;

  const coins = typeof me?.coins === "number" ? me.coins : 0;
  const inventory = Array.isArray(me?.inventory) ? me.inventory : [];
  const equipped = os.storage.get(StorageKeys.socialEquipped) || {};
  const currentUser = getCurrentUser();
  const userName = currentUser.name || "Preview";
  const previewState = { coins, inventory, equipped, avatarUrl: "", userName, opts };
  previewState.avatarUrl = await resolveAvatarUrl(currentUser.avatar, "static/icons/guest.webp").catch(() => "");
  if (!pageEl.isConnected) return;

  const headHtml = `
    <div class="steam-store-head">
      <div>
        <h2 class="steam-store-title">Profile Store</h2>
        <p class="steam-store-sub">Dress up your profile with coins earned from play.</p>
      </div>
      <div class="steam-store-wallet"><i class="fas fa-coins"></i> <strong>${coins}</strong> YukiCoins</div>
    </div>
  `;

  if (!catalog || catalog.length === 0) {
    setHTML(
      pageEl,
      `${headHtml}<div class="steam-store-empty"><p class="steam-store-empty-title">Store unavailable</p><p class="steam-store-empty-sub">Could not load the catalog. Try again later.</p></div>`
    );
    return;
  }

  const grouped = {};
  for (const item of catalog) {
    (grouped[item.type] = grouped[item.type] || []).push(item);
  }
  const typeLabels = { banner: "Banners", frame: "Avatar Frames", name: "Name Tags", badge: "Badges" };

  const buildList = () => {
    const list = createElement("div", { className: "steam-store-list" });
    Object.entries(grouped).forEach(([type, items]) => {
      list.appendChild(
        createElement("div", { className: "steam-store-group-title", text: typeLabels[type] || type })
      );
      items.forEach((item) => {
        const owned = inventory.includes(item.id);
        const equippedType = equipped[type] === item.id;
        const prestige = item.rarity === "prestige";
        const limited = Boolean(item.endsAt);
        const card = createElement("div", {
          className: `steam-store-item${owned ? " steam-store-item--owned" : ""}${equippedType ? " steam-store-item--equipped" : ""}${prestige ? " steam-store-item--prestige" : ""}${limited ? " steam-store-item--limited" : ""}`
        });
        const iconWrap = createElement("div", { className: "steam-store-item-icon" });
        iconWrap.innerHTML = buildItemPreview(item, previewState.avatarUrl, userName);
        card.appendChild(iconWrap);
        const info = createElement("div", { className: "steam-store-item-info" });
        info.appendChild(createElement("div", { className: "steam-store-item-name", text: item.name }));
        if (prestige || limited) {
          info.appendChild(
            createElement("span", {
              className: `steam-store-tag${prestige ? " steam-store-tag--prestige" : ""}${limited ? " steam-store-tag--limited" : ""}`,
              html: prestige ? '<i class="fas fa-gem"></i> Legendary' : '<i class="fas fa-clock"></i> Limited'
            })
          );
        }
        info.appendChild(createElement("div", { className: "steam-store-item-desc", text: item.description }));
        if (item.endsAt) {
          info.appendChild(
            createElement("div", {
              className: "steam-store-item-ends",
              html: `<i class="fas fa-hourglass-half"></i> Ends ${new Date(item.endsAt).toLocaleDateString()}`
            })
          );
        }
        const priceHtml =
          item.priceCoins > 0
            ? `${item.priceCoins} <i class="fas fa-coins"></i>`
            : "Free";
        info.appendChild(createElement("div", { className: "steam-store-item-price", html: priceHtml }));
        card.appendChild(info);
        if (owned && !equippedType) {
          const equipBtn = createElement("button", {
            attributes: { type: "button" },
            className: "steam-store-item-btn steam-store-item-btn--equip",
            html: '<i class="fas fa-check"></i> Equip'
          });
          bindEvent(equipBtn, "click", () => {
            const next = { ...equipped, [type]: item.id };
            os.storage.set(StorageKeys.socialEquipped, next);
            renderStorePage(pageEl, opts);
          });
          card.appendChild(equipBtn);
        } else if (equippedType) {
          card.appendChild(
            createElement("button", {
              attributes: { type: "button", disabled: true },
              className: "steam-store-item-btn steam-store-item-btn--equipped",
              html: '<i class="fas fa-check"></i> Equipped'
            })
          );
        } else {
          const buyBtn = createElement("button", {
            attributes: { type: "button" },
            className: `steam-store-item-btn steam-store-item-btn--buy${coins < item.priceCoins ? " steam-store-item-btn--disabled" : ""}`,
            html: '<i class="fas fa-cart-plus"></i> Buy'
          });
          if (coins < item.priceCoins) buyBtn.disabled = true;
          bindEvent(buyBtn, "click", async () => {
            buyBtn.disabled = true;
            const res = await purchaseItem(item.id);
            if (res.status === "ok") {
              invalidateSocialMe();
              os.notify.send("Purchased", `${item.name} added to your inventory.`);
              renderStorePage(pageEl, opts);
              os.events.emit(BusEvents.PROFILE_UPDATED);
            } else {
              os.dialog.alert("Purchase Failed", res.error || "Could not buy that item.");
              buyBtn.disabled = false;
            }
          });
          card.appendChild(buyBtn);
        }
        bindEvent(card, "click", (e) => {
          if (e.target.closest(".steam-store-item-btn")) return;
          openItemPreview(pageEl, item, previewState);
        });
        list.appendChild(card);
      });
    });
    return list;
  };

  const list = buildList();

  setHTML(pageEl, `${headHtml}<div class="steam-store-grid"></div>`);
  const gridHost = $(".steam-store-grid", pageEl);
  if (gridHost) gridHost.replaceWith(list);
}

function ensureProfilePlaytime(user) {
  if (!user) return user;
  const isSelf = !user.userId || user.userId === "local" || user.userId === getLiveUserId();
  if (!isSelf) return user;

  const localStats = os.storage.get(StorageKeys.steamStats) || {};
  const recentGames = os.storage.get(StorageKeys.steamRecentGames) || [];
  const playtimeMap = new Map();

  for (const item of user.playtime || []) {
    if (item && item.app) {
      playtimeMap.set(item.app, {
        app: item.app,
        minutes: Number(item.minutes) || 0,
        lastPlayed: item.lastPlayed || null
      });
    }
  }

  for (const [appId, stat] of Object.entries(localStats)) {
    if (!appId) continue;
    const existing = playtimeMap.get(appId) || { app: appId, minutes: 0, lastPlayed: null };
    const localMin = Number(stat?.totalMin) || 0;
    const localLast = stat?.lastPlayed || null;
    existing.minutes = Math.max(existing.minutes, localMin);
    if (localLast && (!existing.lastPlayed || localLast > existing.lastPlayed)) {
      existing.lastPlayed = localLast;
    }
    playtimeMap.set(appId, existing);
  }

  for (const game of recentGames) {
    if (!game || !game.id) continue;
    const appId = game.id;
    const existing = playtimeMap.get(appId) || { app: appId, minutes: 0, lastPlayed: null };
    if (game.timestamp && (!existing.lastPlayed || game.timestamp > existing.lastPlayed)) {
      existing.lastPlayed = game.timestamp;
    }
    playtimeMap.set(appId, existing);
  }

  const merged = Array.from(playtimeMap.values()).sort(
    (a, b) => (b.minutes - a.minutes) || ((b.lastPlayed || 0) - (a.lastPlayed || 0))
  );
  user.playtime = merged;
  user.totalMinutes = merged.reduce((sum, item) => sum + (Number(item.minutes) || 0), 0);
  return user;
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    os.notify.send("Copied", "Your Friend ID was copied to the clipboard.");
  } catch {
    os.notify.send("Copy failed", "Could not reach the clipboard.");
  }
}

function makeSidebarItem(icon, label, active) {
  const item = createElement("button", {
    className: `steam-friends-sb-item${active ? " steam-friends-sb-item--active" : ""}`,
    attributes: { type: "button" }
  });
  item.appendChild(createElement("i", { className: `fas ${icon}` }));
  item.appendChild(createElement("span", { className: "steam-friends-sb-item-label", text: label }));
  return item;
}

export async function renderFriendsPage(pageEl, options = {}) {
  if (!pageEl || !pageEl.isConnected) return;
  const opts = options || {};
  const view = opts.view === "add" ? "add" : "list";
  const userId = getLiveUserId();

  setHTML(pageEl, '<div class="steam-social-loading">Loading friends...</div>');
  const data = await fetchFriends();
  if (!pageEl.isConnected) return;
  const friends = Array.isArray(data?.friends) ? data.friends : [];
  const requests = Array.isArray(data?.requests) ? data.requests : [];

  let pendingOpen = false;
  const root = createElement("div", { className: "steam-friends-layout" });

  const sidebar = createElement("aside", { className: "steam-friends-sidebar" });
  const sbGroup = createElement("div", { className: "steam-friends-sb-group" });
  sbGroup.appendChild(createElement("div", { className: "steam-friends-sb-title", text: "FRIENDS" }));

  const itemFriends = makeSidebarItem("fa-user-friends", "Your Friends", view === "list");
  const itemAdd = makeSidebarItem("fa-user-plus", "Add a Friend", view === "add");
  const itemPending = makeSidebarItem("fa-envelope", "Pending Requests", false);
  const pendingCount = createElement("span", { className: "steam-friends-sb-count", text: requests.length ? String(requests.length) : "" });
  itemPending.appendChild(pendingCount);
  if (friends.length) itemFriends.appendChild(createElement("span", { className: "steam-friends-sb-count", text: String(friends.length) }));

  bindEvent(itemFriends, "click", () => opts.onNavigate("friends"));
  bindEvent(itemAdd, "click", () => opts.onNavigate("friends-add"));

  sbGroup.appendChild(itemFriends);
  sbGroup.appendChild(itemAdd);
  sbGroup.appendChild(itemPending);
  sidebar.appendChild(sbGroup);
  root.appendChild(sidebar);

  const main = createElement("div", { className: "steam-friends-main" });
  const mainHost = createElement("div", { className: "steam-friends-main-inner" });
  main.appendChild(mainHost);
  root.appendChild(main);
  setHTML(pageEl, "");
  pageEl.appendChild(root);

  const refreshCounts = () => {
    const friendCountEl = itemFriends.querySelector(".steam-friends-sb-count");
    fetchFriends({ refresh: true }).then((d) => {
      if (!pendingCount.isConnected) return;
      const r = Array.isArray(d?.requests) ? d.requests.length : 0;
      const f = Array.isArray(d?.friends) ? d.friends.length : 0;
      setText(pendingCount, r ? String(r) : "");
      if (friendCountEl) setText(friendCountEl, String(f));
    }).catch(() => {});
  };

  if (view === "add") {
    await renderFriendsAddView(mainHost, { userId, onLaunch: opts.onLaunch, refreshCounts });
  } else {
    renderFriendsListView(mainHost, {
      friends,
      requests,
      userId,
      onLaunch: opts.onLaunch
    });
  }

  bindEvent(itemPending, "click", () => {
    if (view !== "list") {
      opts.onNavigate("friends");
      return;
    }
    const panel = mainHost.querySelector(".steam-friends-pending");
    if (panel) {
      pendingOpen = !pendingOpen;
      panel.classList.toggle("steam-friends-panel--open", pendingOpen);
    }
  });
}

function renderFriendsListView(host, args) {
  const wrap = createElement("div", { className: "steam-friends-panel-list" });
  let pendingPanel = null;
  if (args.requests && args.requests.length) {
    pendingPanel = createElement("div", { className: "steam-friends-panel steam-friends-pending steam-friends-panel--open" });
    const head = createElement("div", { className: "steam-friends-panel-head" });
    head.appendChild(createElement("span", { className: "steam-friends-panel-title", text: `Pending Requests (${args.requests.length})` }));
    pendingPanel.appendChild(head);
    const body = createElement("div", { className: "steam-friends-panel-body" });
    pendingPanel.appendChild(body);
    wrap.appendChild(pendingPanel);
  }
  const list = createElement("div", {});
  wrap.appendChild(list);
  setHTML(host, "");
  host.appendChild(wrap);
  if (pendingPanel) {
    const body = pendingPanel.querySelector(".steam-friends-panel-body");
    renderRequestsPanel(body, { onChange: () => args.onUpdate && args.onUpdate() }).catch(() => {});
  }
  renderFriendsListPanel(list, { onLaunch: args.onLaunch || (() => {}) }).catch(() => {});
}

async function renderFriendsAddView(host, opts) {
  setHTML(host, "");

  const codePanel = createElement("div", { className: "steam-friends-panel" });
  const codeHead = createElement("div", { className: "steam-friends-panel-head" });
  codeHead.appendChild(createElement("span", { className: "steam-friends-panel-title", text: "Your Friend Code" }));
  codePanel.appendChild(codeHead);
  const codeBody = createElement("div", { className: "steam-friends-panel-body" });
  codeBody.appendChild(createElement("p", { className: "steam-friends-panel-desc", text: "Send your code so others can find you, or enter someone's code to invite them." }));
  const codeRow = createElement("div", { className: "steam-friends-code-row" });
  codeRow.appendChild(createElement("div", { className: "steam-friends-code-box", text: opts.userId || "no profile" }));
  const copyBtn = createElement("button", { className: "steam-friends-copy-btn", text: "COPY", attributes: { type: "button" } });
  bindEvent(copyBtn, "click", () => copyToClipboard(opts.userId || ""));
  codeRow.appendChild(copyBtn);
  codeBody.appendChild(codeRow);

  const inviteRow = createElement("div", { className: "steam-friends-invite-row" });
  const inviteInput = createElement("input", {
    className: "steam-friends-input",
    attributes: { type: "text", placeholder: "Enter a Friend ID" }
  });
  const inviteBtn = createElement("button", { className: "steam-friends-send-btn", text: "Send Request", attributes: { type: "button" } });
  const doInvite = async () => {
    const target = (inviteInput.value || "").trim();
    if (!target) return;
    const res = await sendFriendRequest(target);
    if (res && res.error) {
      os.notify.send("Invite failed", res.error, { type: "error" });
      return;
    }
    os.notify.send("Invite sent", "Your friend request was sent.");
    if (inviteInput) inviteInput.value = "";
    callIfFunction(opts.refreshCounts);
  };
  bindEvent(inviteBtn, "click", doInvite);
  bindEvent(inviteInput, "keydown", (e) => {
    if (e.key === "Enter") doInvite();
  });
  inviteRow.appendChild(inviteInput);
  inviteRow.appendChild(inviteBtn);
  codeBody.appendChild(inviteRow);
  codePanel.appendChild(codeBody);
  host.appendChild(codePanel);

  const searchPanel = createElement("div", { className: "steam-friends-panel" });
  const searchHead = createElement("div", { className: "steam-friends-panel-head" });
  searchHead.appendChild(createElement("span", { className: "steam-friends-panel-title", text: "Or try searching for your friend" }));
  searchPanel.appendChild(searchHead);
  const searchBody = createElement("div", { className: "steam-friends-panel-body" });
  searchBody.appendChild(createElement("p", { className: "steam-friends-panel-desc", text: "Find players by name and send a request straight from their profile." }));
  searchPanel.appendChild(searchBody);
  host.appendChild(searchPanel);

  renderUserList(searchBody, await fetchDiscover(), {
    friendActions: true,
    onLaunch: opts.onLaunch
  }).catch(() => {});
}

export async function renderSelfProfilePage(pageEl, options = {}) {
  if (!pageEl || !pageEl.isConnected) return;
  const opts = options || {};
  setHTML(pageEl, '<div class="steam-social-loading">Loading your profile...</div>');

  const users = await fetchDiscover();
  if (!pageEl.isConnected) return;

  let user = (users || []).find((u) => u.userId === getLiveUserId());
  const current = getCurrentUser();
  const localAvatar = await resolveAvatarUrl(current.avatar, "static/icons/guest.webp");

  if (!user) {
    user = {
      userId: getLiveUserId() || "local",
      username: current.name || "Anonymous",
      avatarIndex: -1,
      bio: "",
      achievements: [],
      playtime: [],
      totalMinutes: 0,
      nowPlaying: null
    };
  } else {
    user.username = current.name || user.username;
    user.bio = String(os.storage.get(StorageKeys.liveBio) || user.bio).slice(0, 300);
  }
  ensureProfilePlaytime(user);

  let coins = null;
  let streak = null;
  let inventory = null;
  if (getLiveUserId()) {
    const me = await fetchSocialMe();
    if (me) {
      coins = me.coins;
      streak = me.streak;
      inventory = Array.isArray(me.inventory) ? me.inventory : [];
    }
  }

  const catalog = loadCatalog();
  const renderOpts = {
    catalog,
    editable: true,
    onLaunch: opts.onLaunch,
    onShowGames: opts.onShowGames,
    onShowAchievements: opts.onShowAchievements,
    onShowQuests: opts.onShowQuests,
    onShowStore: opts.onShowStore,
    coins,
    streak,
    inventory,
    equipped: os.storage.get(StorageKeys.socialEquipped) || null,
    localAvatar
  };
  setHTML(pageEl, buildProfileHtml(user, renderOpts));
  bindProfileEvents(pageEl, user, renderOpts);
}

export async function renderProfilePage(pageEl, options = {}) {
  if (!pageEl || !pageEl.isConnected) return;
  const opts = options || {};
  setHTML(pageEl, '<div class="steam-social-loading">Loading profile...</div>');

  const users = await fetchDiscover();
  if (!pageEl.isConnected) return;

  const user = (users || []).find((u) => u.userId === opts.userId);
  if (!user) {
    setHTML(pageEl, '<div class="steam-social-error">Player not found.</div>');
    return;
  }

  const isSelf = user.userId === getLiveUserId();
  if (isSelf) ensureProfilePlaytime(user);
  let friendRelation = "none";
  let reactions = null;
  if (!isSelf && !isSocialDisabled()) {
    friendRelation = await getFriendRelation(user.userId);
    reactions = await fetchReactions(user.userId);
  }

  const catalog = loadCatalog();
  const localAvatar =
    user.userId === getLiveUserId()
      ? await resolveAvatarUrl(getCurrentUser().avatar, "static/icons/guest.webp")
      : null;
  const renderOpts = {
    catalog,
    editable: false,
    onLaunch: opts.onLaunch,
    onShowGames: opts.onShowGames,
    onShowAchievements: opts.onShowAchievements,
    inventory: Array.isArray(user.inventory) ? user.inventory : [],
    equipped: null,
    localAvatar,
    userId: user.userId,
    friendRelation,
    reactions,
    onFriendChange: () => { if (pageEl.isConnected && !isSocialDisabled()) renderProfilePage(pageEl, { userId: user.userId, onLaunch: opts.onLaunch, onShowGames: opts.onShowGames, onShowAchievements: opts.onShowAchievements }); }
  };
  setHTML(pageEl, buildProfileHtml(user, renderOpts));
  bindProfileEvents(pageEl, user, renderOpts);
}

export async function renderGamesPage(pageEl, options = {}) {
  if (!pageEl || !pageEl.isConnected) return;
  const opts = options || {};
  setHTML(pageEl, '<div class="steam-social-loading">Loading games...</div>');

  const users = await fetchDiscover();
  if (!pageEl.isConnected) return;

  let user = (users || []).find((u) => u.userId === opts.userId);
  const isSelf = !opts.userId || opts.userId === getLiveUserId() || opts.userId === "local";
  if (!user && isSelf) {
    const current = getCurrentUser();
    user = {
      userId: getLiveUserId() || "local",
      username: current.name || "Anonymous",
      avatarIndex: -1,
      bio: "",
      achievements: [],
      playtime: [],
      totalMinutes: 0,
      nowPlaying: null
    };
  }
  if (!user) {
    setHTML(pageEl, '<div class="steam-social-error">Player not found.</div>');
    return;
  }
  if (isSelf) ensureProfilePlaytime(user);

  const playtime = (user.playtime || []).slice().sort((a, b) => b.minutes - a.minutes);
  const gamesHtml = playtime
    .map((entry) => {
      const icon = resolveAppIcon(entry.app) || "fas fa-gamepad";
      const last = lastPlayedLabel(entry.lastPlayed);
      return `
        <div class="steam-games-grid-item" data-app="${escapeHtml(entry.app)}">
          <div class="steam-games-grid-thumb">${gameIconHtml(icon)}</div>
          <div class="steam-games-grid-title">${escapeHtml(resolveAppName(entry.app))}</div>
          <div class="steam-games-grid-meta">${hoursLabel(entry.minutes)}${last ? ` \u00b7 ${last}` : ""}</div>
        </div>`;
    })
    .join("");

  setHTML(
    pageEl,
    `
    <div class="steam-games-page-head">
      <span class="steam-games-title">${escapeHtml(user.username || "Unknown")} Games</span>
      <span class="steam-games-count">${playtime.length} games</span>
    </div>
    <div class="steam-games-grid">${gamesHtml || '<div class="steam-profile-empty">No games played yet.</div>'}</div>
    `
  );

  $$(".steam-games-grid-item", pageEl).forEach((item) => {
    bindEvent(item, "click", () => {
      const id = resolveAppId(item.dataset.app);
      if (!id) return;
      if (isFunction(opts.onLaunch)) callIfFunction(opts.onLaunch, id);
      else os.app.launch(id).catch(() => {});
    });
  });
}

export async function renderAchievementsPage(pageEl, options = {}) {
  if (!pageEl || !pageEl.isConnected) return;
  const opts = options || {};
  setHTML(pageEl, '<div class="steam-social-loading">Loading achievements...</div>');

  const users = await fetchDiscover();
  if (!pageEl.isConnected) return;

  const user = (users || []).find((u) => u.userId === opts.userId);
  if (!user) {
    setHTML(pageEl, '<div class="steam-social-error">Player not found.</div>');
    return;
  }

  const catalog = loadCatalog();
  const unlockedMap = new Map((user.achievements || []).map((a) => [a.id, a.unlockedAt]));
  const total = catalog.length;
  const done = unlockedMap.size;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  setHTML(
    pageEl,
    `
    <div class="steam-achievements-head">
      <span class="steam-achievements-title">${escapeHtml(user.username || "Unknown")} Achievements</span>
      <span class="steam-achievements-count">${done} / ${total}</span>
    </div>
    <div class="achievements-progress">
      <div class="achievements-progress__header">
        <span class="achievements-progress__label">Overall Progress</span>
        <span class="achievements-progress__counter">${done} / ${total}</span>
      </div>
      <div class="achievements-progress__bar-wrapper">
        <div class="achievements-progress__bar">
          <div class="achievements-progress__fill" style="width: ${pct}%"></div>
        </div>
        <span class="achievements-progress__percentage">${pct}%</span>
      </div>
    </div>
    <div class="achievements-toggle">
      <button type="button" class="achievements-toggle__btn achievements-toggle__btn--active" data-filter="all"><i class="fas fa-list"></i><span>All</span></button>
      <button type="button" class="achievements-toggle__btn" data-filter="unlocked"><i class="fas fa-check-circle"></i><span>Unlocked</span></button>
      <button type="button" class="achievements-toggle__btn" data-filter="locked"><i class="fas fa-lock"></i><span>Locked</span></button>
    </div>
    <div class="steam-achievements-grid"></div>
    `
  );

  const grid = $(".steam-achievements-grid", pageEl);

  const renderGrid = (filter) => {
    const filtered = catalog.filter((a) => {
      if (filter === "unlocked") return unlockedMap.has(a.id);
      if (filter === "locked") return !unlockedMap.has(a.id);
      return true;
    });
    const cards = filtered
      .map((a) => {
        const unlocked = unlockedMap.has(a.id);
        const date = unlocked ? unlockedMap.get(a.id) : null;
        const dateLabel = date ? `Unlocked on ${new Date(date).toLocaleDateString()}` : "";
        return `
          <div class="achievement-card ${unlocked ? "achievement-card--unlocked" : ""}" data-rarity="${escapeHtml(a.rarity || "common")}">
            <div class="achievement-card__icon-wrapper">
              <div class="achievement-card__icon-bg"></div>
              <i class="fas ${escapeHtml(a.icon || "fa-trophy")} achievement-card__icon"></i>
              ${unlocked ? '<div class="achievement-card__checkmark"><i class="fas fa-check"></i></div>' : ""}
            </div>
            <div class="achievement-card__content">
              <div class="achievement-card__header">
                <h3 class="achievement-card__title">${escapeHtml(a.title || "Achievement")}</h3>
                <div class="achievement-card__badges">
                  <span class="achievement-card__rarity achievement-card__rarity--${escapeHtml(a.rarity || "common")}">${escapeHtml(a.rarity || "common")}</span>
                  ${!unlocked ? '<div class="achievement-card__lock"><i class="fas fa-lock"></i></div>' : ""}
                </div>
              </div>
              <p class="achievement-card__desc">${escapeHtml(a.desc || "")}</p>
              ${dateLabel ? `<p class="achievement-card__date">${escapeHtml(dateLabel)}</p>` : ""}
            </div>
          </div>`;
      })
      .join("");
    setHTML(grid, cards || '<div class="steam-profile-empty">No achievements here.</div>');
  };

  renderGrid("all");

  $$(".achievements-toggle__btn", pageEl).forEach((btn) => {
    bindEvent(btn, "click", () => {
      $$(".achievements-toggle__btn", pageEl).forEach((b) => b.classList.remove("achievements-toggle__btn--active"));
      btn.classList.add("achievements-toggle__btn--active");
      renderGrid(btn.dataset.filter || "all");
    });
  });
}

export async function renderEditProfilePage(pageEl, options = {}) {
  if (!pageEl || !pageEl.isConnected) return;
  setHTML(pageEl, '<div class="steam-social-loading">Loading edit profile...</div>');

  const users = await fetchDiscover();
  if (!pageEl.isConnected) return;

  const current = getCurrentUser();
  const liveUserId = getLiveUserId();
  const localAvatar = await resolveAvatarUrl(current.avatar, "static/icons/guest.webp");

  let user = (users || []).find((u) => u.userId === liveUserId);
  if (!user) {
    user = {
      userId: liveUserId || "local",
      username: current.name || "Anonymous",
      avatarIndex: -1,
      bio: "",
      achievements: [],
      playtime: [],
      totalMinutes: 0,
      nowPlaying: null
    };
  } else {
    user.username = current.name || user.username;
    user.bio = String(os.storage.get(StorageKeys.liveBio) || user.bio).slice(0, 300);
  }

  const avatarUrl = localAvatar || avatarUrlForIndex(user.avatarIndex);
  const avatarPreviewHtml = avatarUrl
    ? `<img class="steam-profile-avatar-preview-img" src="${escapeHtml(avatarUrl)}" alt="" />`
    : '<div class="steam-profile-avatar-preview-img steam-profile-avatar-preview-img--default"><i class="fas fa-user"></i></div>';
  const predefinedAvatarsHtml = PREDEFINED_AVATARS.map(
    (src, index) => `
    <button type="button" class="steam-profile-avatar-option" data-avatar-src="${escapeHtml(src)}" data-avatar-index="${index}">
      <img src="${escapeHtml(src)}" alt="" />
    </button>`
  ).join("");

  setHTML(
    pageEl,
    `
    <div class="steam-edit-page">
      <div class="steam-edit-header">
        <button type="button" class="steam-edit-back-btn"><i class="fas fa-arrow-left"></i> Back</button>
        <h2 class="steam-edit-title">Edit Profile</h2>
      </div>
      <div class="steam-edit-body">
        <div class="steam-edit-section">
          <h3 class="steam-edit-section-title"><i class="fas fa-user"></i> Profile</h3>
          <div class="steam-profile-edit-panel">
            <label class="steam-profile-edit-label">Nickname</label>
            <input type="text" class="steam-profile-name-input" maxlength="24" value="${escapeHtml(user.username || "")}" placeholder="Enter nickname" />
            <label class="steam-profile-edit-label">Bio</label>
            <textarea class="steam-profile-bio-input" maxlength="300" placeholder="Write something about yourself...">${escapeHtml(user.bio || "")}</textarea>
            <div class="steam-profile-avatar-row">
              <div class="steam-profile-avatar-preview">${avatarPreviewHtml}</div>
              <button type="button" class="steam-profile-avatar-toggle-btn"><i class="fas fa-images"></i> Change Avatar</button>
            </div>
            <div class="steam-profile-avatar-grid hidden">
              ${predefinedAvatarsHtml}
              <button type="button" class="steam-profile-avatar-upload-btn"><i class="fas fa-upload"></i> Upload Custom</button>
            </div>
            <div class="steam-profile-bio-error hidden">Could not save your profile. Try again.</div>
          </div>
        </div>
        <div class="steam-edit-section">
          <h3 class="steam-edit-section-title"><i class="fas fa-bell"></i> Notifications</h3>
          <div class="steam-edit-settings">
            <div class="settings-section">
              <div class="settings-item">
                <div class="settings-item-label">
                  <div class="settings-item-title">Currently Playing Popups</div>
                  <div class="settings-item-description">Show popups when friends start playing a game</div>
                </div>
                <div class="settings-toggle" data-setting="currentlyPlayingPopups">
                  <div class="settings-toggle-slider"></div>
                </div>
              </div>
              <div class="settings-item">
                <div class="settings-item-label">
                  <div class="settings-item-title">Do Not Disturb</div>
                  <div class="settings-item-description">Mute activity popups from friends</div>
                </div>
                <div class="settings-toggle" data-setting="dnd">
                  <div class="settings-toggle-slider"></div>
                </div>
              </div>
              <div class="settings-item">
                <div class="settings-item-label">
                  <div class="settings-item-title">Share My Activity</div>
                  <div class="settings-item-description">Send what you're playing and load friends' live activity</div>
                </div>
                <div class="settings-toggle" data-setting="shareLiveActivity">
                  <div class="settings-toggle-slider"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="steam-edit-actions">
          <button type="button" class="steam-profile-edit-save-btn"><i class="fas fa-check"></i> Save Changes</button>
          <button type="button" class="steam-profile-edit-cancel-btn"><i class="fas fa-times"></i> Cancel</button>
        </div>
      </div>
    </div>
    `
  );

  initSettingsToggles(pageEl);
  bindEditProfileEvents(pageEl, user, avatarUrl);
}

export async function renderLoginPage(pageEl, options = {}) {
  if (!pageEl || !pageEl.isConnected) return;
  const account = getAccountStatus();
  const localName = String(os.storage.get(StorageKeys.username) || "").slice(0, 32);
  setHTML(
    pageEl,
    `
    <div class="steam-login-card">
      <div class="steam-login-brand">
        <div class="steam-login-brand-icon"><i class="fas fa-snowflake"></i></div>
        <div>
          <h2 class="steam-login-title">Sign in to YukiOS</h2>
          <p class="steam-login-subtitle">Keep your profile, achievements and playtime across devices. No email needed.</p>
        </div>
      </div>
      <div class="yukios-account-host">
        ${buildAccountBlockHtml(account ? undefined : "register", {
          socialDisabled: isSocialDisabled(),
          prefillNickname: account ? undefined : localName,
          anonymousNote: account ? undefined : "Prefer to stay anonymous? That's fine, your local profile stays on this device until you register."
        })}
      </div>
      <p class="yukios-account-disclaimer">${escapeHtml(ACCOUNT_DISCLAIMER)}</p>
      <div class="steam-login-actions">
        <button type="button" class="steam-login-back-btn" data-login-action="back"><i class="fas fa-arrow-left"></i> Back to Profile</button>
      </div>
    </div>
    `
  );
  bindAccountBlock($(".yukios-account-host", pageEl), {
    onChange: () => os.app.launch("steamApp", { steamPage: "user" }),
    onEnableSocial: () => os.app.launch("steamApp", { steamPage: "settings" })
  });
  const backBtn = $("[data-login-action='back']", pageEl);
  if (backBtn) bindEvent(backBtn, "click", () => os.app.launch("steamApp", { steamPage: "user" }));
}

export function renderSocialDisabledPage(pageEl) {
  if (!pageEl || !pageEl.isConnected) return;
  setHTML(
    pageEl,
    `
    <div class="steam-social-disabled">
      <i class="fas fa-user-slash"></i>
      <div class="steam-social-disabled-title">Social features are disabled</div>
      <div class="steam-social-disabled-desc">Friends, community, live activity and account sign-in are turned off.</div>
      <button type="button" class="steam-login-back-btn" data-social-enable="1"><i class="fas fa-toggle-on"></i> Enable in Settings</button>
    </div>
    `
  );
  const btn = $("[data-social-enable]", pageEl);
  if (btn) bindEvent(btn, "click", () => os.app.launch("steamApp", { steamPage: "settings" }));
}

function bindEditProfileEvents(root, user, avatarUrl) {
  const nameInput = $(".steam-profile-name-input", root);
  const textarea = $(".steam-profile-bio-input", root);
  const avatarToggle = $(".steam-profile-avatar-toggle-btn", root);
  const avatarGrid = $(".steam-profile-avatar-grid", root);
  const avatarPreview = $(".steam-profile-avatar-preview-img", root);
  const uploadBtn = $(".steam-profile-avatar-upload-btn", root);
  const saveBtn = $(".steam-profile-edit-save-btn", root);
  const cancelBtn = $(".steam-profile-edit-cancel-btn", root);
  const backBtn = $(".steam-edit-back-btn", root);
  const bioError = $(".steam-profile-bio-error", root);

  let pendingAvatar = avatarUrl;

  const highlightSelectedAvatar = () => {
    $$(".steam-profile-avatar-option", root).forEach((opt) => {
      opt.classList.toggle("steam-profile-avatar-option--selected", opt.dataset.avatarSrc === pendingAvatar);
    });
  };
  highlightSelectedAvatar();

  if (avatarToggle) {
    bindEvent(avatarToggle, "click", () => {
      if (avatarGrid) avatarGrid.classList.toggle("hidden");
    });
  }

  $$(".steam-profile-avatar-option", root).forEach((opt) => {
    bindEvent(opt, "click", () => {
      pendingAvatar = opt.dataset.avatarSrc;
      if (avatarPreview) {
        avatarPreview.src = pendingAvatar;
        avatarPreview.classList.remove("steam-profile-avatar-preview-img--default");
      }
      highlightSelectedAvatar();
    });
  });

  if (uploadBtn) {
    bindEvent(uploadBtn, "click", () => {
      openAvatarUpload((fileRef, objectUrl) => {
        pendingAvatar = fileRef;
        if (avatarPreview) avatarPreview.src = objectUrl;
        highlightSelectedAvatar();
      });
    });
  }

  const goBack = () => {
    os.app.launch("steamApp", { steamPage: "user" });
  };

  if (cancelBtn) bindEvent(cancelBtn, "click", goBack);
  if (backBtn) bindEvent(backBtn, "click", goBack);

  if (saveBtn) {
    bindEvent(saveBtn, "click", () => {
      const name = (nameInput ? nameInput.value : "").trim().slice(0, 24);
      const bio = (textarea ? textarea.value : "").trim().slice(0, 300);
      if (!name) {
        if (bioError) bioError.classList.remove("hidden");
        return;
      }
      const avatar = pendingAvatar || avatarUrl;
      applyProfileUpdate(user, name, bio, avatar);
      goBack();
    });
  }
}

