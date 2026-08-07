import "./styles/donationPopup.css";
import { StorageKeys, os, createElement } from "./framework.js";
import { $, bindEvent } from "./shared/domUtils.js";
import { parseBool } from "./utils/utils.js";

const MONERO_ADDRESS =
  "4B5RKGR4C5WDkHGKVemU4rDcnKDG5NbwBLogE1tnxAWJAqbLPpNiDNaVZC1jrfwSdB7Sh1ALQNe3TMMvhdEJTPRcAUJhyVm";
const DAY_MS = 86400000;
const SEVEN_DAYS = 7 * DAY_MS;

let overlay = null;

function getOverlayHTML() {
  return `
    <div class="donation-overlay" id="donation-overlay">
      <div class="donation-popup">
        <button class="donation-close" id="donation-close" title="Remind me later">
          <i class="fas fa-times"></i>
        </button>
        <div class="donation-heart">
          <i class="fas fa-heart"></i>
        </div>
        <div class="donation-title">Support YukiOS</div>
        <div class="donation-message">
          YukiOS is built and maintained by one person in their free time.
          Your support keeps development active and helps fund new features.
          <br><br>
          You can donate via Patreon or Monero. It takes less than a minute.
        </div>
        <div class="donation-buttons">
          <a href="https://www.patreon.com/Reeyuki" target="_blank" class="donation-btn donation-btn-patreon"><i class="fab fa-patreon"></i> Patreon</a>
          <button class="donation-btn donation-btn-monero" id="donation-show-monero">
            <i class="fab fa-monero"></i> Monero
          </button>
        </div>
        <div class="donation-monero-section" id="donation-monero-section" style="display:none;">
          <span class="donation-monero-address" id="donation-monero-address">${MONERO_ADDRESS}</span>
          <button class="donation-copy-btn" id="donation-copy-btn">
            <i class="fas fa-copy"></i> Copy
          </button>
        </div>
        <div class="donation-footer">
          <button class="donation-footer-btn donation-footer-btn--danger" id="donation-never">
            <i class="fas fa-ban"></i> Never
          </button>
        </div>
      </div>
    </div>
  `;
}

function showPopup() {
  if (overlay) return;

  const wrapper = createElement("div");
  wrapper.innerHTML = getOverlayHTML();
  overlay = wrapper.firstElementChild;

  const parent = $("#session-overlay") || document.body;
  parent.appendChild(overlay);

  requestAnimationFrame(() => {
    overlay.classList.add("donation-overlay--show");
  });

  bindEvent($("#donation-close", overlay), "click", dismissPopup);
  bindEvent($("#donation-never", overlay), "click", permanentDismiss);
  bindEvent($("#donation-show-monero", overlay), "click", () => {
    const section = $("#donation-monero-section", overlay);
    const btn = $("#donation-show-monero", overlay);
    if (section.style.display === "none") {
      section.style.display = "flex";
      btn.style.display = "none";
    }
  });
  bindEvent($("#donation-copy-btn", overlay), "click", copyAddress);
  bindEvent(overlay, "click", (e) => {
    if (e.target === overlay) dismissPopup();
  });
}

function hidePopup(callback) {
  if (!overlay) {
    if (callback) callback();
    return;
  }

  overlay.classList.remove("donation-overlay--show");
  overlay.classList.add("donation-overlay--hide");

  setTimeout(() => {
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
    overlay = null;
    if (callback) callback();
  }, 300);
}

function dismissPopup() {
  os.storage.set(StorageKeys.donationLastShown, Date.now().toString());
  hidePopup();
}

function permanentDismiss() {
  os.storage.set(StorageKeys.donationDismissed, "true");
  hidePopup();
}

async function copyAddress() {
  try {
    await navigator.clipboard.writeText(MONERO_ADDRESS);
    const btn = $("#donation-copy-btn", overlay);
    if (btn) {
      btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
      setTimeout(() => {
        btn.innerHTML = '<i class="fas fa-copy"></i> Copy';
      }, 2000);
    }
  } catch {
    os.dialog.alert("Copy Failed", "Could not copy to clipboard. Select the address manually.");
  }
}

export function checkAndShowDonationPopup() {
  if (!os.storage.get(StorageKeys.setupCompleted)) return;

  if (parseBool(os.storage.get(StorageKeys.donationDismissed))) return;
  if (parseBool(os.storage.get(StorageKeys.adsDisabled))) return;

  const firstLaunch = Number(os.storage.get(StorageKeys.firstLaunchTime));
  if (!firstLaunch || isNaN(firstLaunch)) return;
  if (Date.now() - firstLaunch < SEVEN_DAYS) return;

  const lastShown = Number(os.storage.get(StorageKeys.donationLastShown));
  if (lastShown && !isNaN(lastShown) && Date.now() - lastShown < SEVEN_DAYS) return;

  showPopup();
}

window.showDonationPopup = showPopup;

export function showDonationPopup() {
  showPopup();
}
