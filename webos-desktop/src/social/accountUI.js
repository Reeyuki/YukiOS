import { loginWithAccount, registerAccount, getAccountStatus, signOutAccount } from "./userIdentity.js";
import { $, $$, bindEvent, setText } from "../shared/domUtils.js";
import { escapeHtml } from "../utils/utils.js";
import { callIfFunction } from "../shared/functionUtils.js";

export const ACCOUNT_DISCLAIMER = "This is a YukiOS login. YukiOS is not affiliated with Steam or Valve.";

export function buildAccountStatusHtml() {
  const account = getAccountStatus();
  if (account) {
    return `
      <div class="yukios-account-meta">Signed in as <strong>${escapeHtml(account.nickname)}</strong></div>
      <div class="yukios-account-actions">
        <button type="button" class="yukios-account-btn" data-account-action="signout"><i class="fas fa-sign-out-alt"></i> Sign Out</button>
      </div>
    `;
  }
  return `
    <p class="yukios-account-note">Sign in or convert your local account to a cloud account to keep your profile, achievements and playtime across devices. No email needed.</p>
    <div class="yukios-account-actions">
      <button type="button" class="yukios-account-btn" data-account-action="signin"><i class="fas fa-sign-in-alt"></i> Sign In</button>
      <button type="button" class="yukios-account-btn yukios-account-btn--primary" data-account-action="register"><i class="fa-solid fa-cloud-arrow-up"></i> Sync with Cloud</button>
    </div>
  `;
}

export function buildAccountBlockHtml(startView, options = {}) {
  if (options.socialDisabled) {
    return `
      <div class="yukios-account-body">
        <p class="yukios-account-note"><i class="fas fa-user-slash"></i> Social features are disabled.</p>
        <div class="yukios-account-actions">
          <button type="button" class="yukios-account-btn" data-account-action="enable-social"><i class="fas fa-toggle-on"></i> Enable in Settings</button>
        </div>
      </div>
    `;
  }
  const start = startView === "signin" || startView === "register" ? startView : null;
  const signinHidden = start === "signin" ? "" : " hidden";
  const registerHidden = start === "register" ? "" : " hidden";
  const nicknameValue = options.prefillNickname ? ` value="${escapeHtml(options.prefillNickname)}"` : "";
  const anonymousNote = options.anonymousNote
    ? `<p class="yukios-account-note">${escapeHtml(options.anonymousNote)}</p>`
    : "";
  const conversionNote = options.prefillNickname
    ? '<p class="yukios-account-note">Creating an account turns your current local profile into a registered account. Your games, achievements and playtime stay linked.</p>'
    : "";
  return `
    <div class="yukios-account-body${start ? " hidden" : ""}">
      ${buildAccountStatusHtml()}
      ${anonymousNote}
    </div>
    <div class="yukios-account-form yukios-account-form--signin${signinHidden}">
      <label class="yukios-account-label">Nickname</label>
      <input type="text" class="yukios-account-input yukios-account-input--identifier" placeholder="Nickname" autocomplete="username" />
      <label class="yukios-account-label">Password</label>
      <input type="password" class="yukios-account-input yukios-account-input--signin-pass" placeholder="Password" autocomplete="current-password" />
      <div class="yukios-account-error hidden"></div>
      <div class="yukios-account-actions">
        <button type="button" class="yukios-account-btn yukios-account-btn--primary" data-account-action="signin-submit"><i class="fas fa-sign-in-alt"></i> Sign In</button>
        <button type="button" class="yukios-account-btn" data-account-action="switch-register"><i class="fas fa-user-plus"></i> Sync with Cloud</button>
      </div>
    </div>
    <div class="yukios-account-form yukios-account-form--register${registerHidden}">
      ${conversionNote}
      <label class="yukios-account-label">Nickname</label>
      <input type="text" class="yukios-account-input yukios-account-input--nickname" maxlength="32" placeholder="Nickname (3+ characters)" autocomplete="nickname"${nicknameValue} />
      <label class="yukios-account-label">Password</label>
      <input type="password" class="yukios-account-input yukios-account-input--register-pass" placeholder="Password (6+ characters)" autocomplete="new-password" />
      <div class="yukios-account-error hidden"></div>
      <div class="yukios-account-actions">
        <button type="button" class="yukios-account-btn yukios-account-btn--primary" data-account-action="register-submit"><i class="fa-solid fa-cloud-arrow-up"></i> Sync with Cloud</button>
        <button type="button" class="yukios-account-btn" data-account-action="switch-login"><i class="fas fa-sign-in-alt"></i> Switch to Login</button>
      </div>
    </div>
  `;
}

export function bindAccountBlock(root, { onChange, onEnableSocial } = {}) {
  const body = $(".yukios-account-body", root);
  const signinForm = $(".yukios-account-form--signin", root);
  const registerForm = $(".yukios-account-form--register", root);
  const errorEls = $$(".yukios-account-error", root);

  const setErrorsHidden = () => errorEls.forEach((el) => el.classList.add("hidden"));

  const show = (view) => {
    if (body) body.classList.toggle("hidden", view !== "body");
    if (signinForm) signinForm.classList.toggle("hidden", view !== "signin");
    if (registerForm) registerForm.classList.toggle("hidden", view !== "register");
    setErrorsHidden();
  };

  const setError = (index, message) => {
    if (errorEls[index]) {
      setText(errorEls[index], message);
      errorEls[index].classList.remove("hidden");
    }
  };

  const refresh = () => {
    callIfFunction(onChange);
  };

  bindEvent(root, "click", async (e) => {
    const btn = e.target.closest("[data-account-action]");
    if (!btn) return;
    const action = btn.dataset.accountAction;
    if (action === "signin") {
      show("signin");
      return;
    }
    if (action === "register") {
      show("register");
      return;
    }
    if (action === "switch-register") {
      show("register");
      return;
    }
    if (action === "switch-login") {
      show("signin");
      return;
    }
    if (action === "signout") {
      signOutAccount();
      refresh();
      return;
    }
    if (action === "enable-social") {
      callIfFunction(onEnableSocial);
      return;
    }
    if (action !== "signin-submit" && action !== "register-submit") return;

    btn.disabled = true;
    try {
      let result;
      if (action === "signin-submit") {
        const identifier = $(".yukios-account-input--identifier", root);
        const password = $(".yukios-account-input--signin-pass", root);
        const idValue = identifier ? identifier.value.trim() : "";
        const passValue = password ? password.value : "";
        if (!idValue || !passValue) {
          setError(0, "Enter your nickname and password.");
          return;
        }
        result = await loginWithAccount(idValue, passValue);
      } else {
        const nickname = $(".yukios-account-input--nickname", root);
        const password = $(".yukios-account-input--register-pass", root);
        const nickValue = nickname ? nickname.value.trim() : "";
        const passValue = password ? password.value : "";
        if (nickValue.length < 3 || nickValue.length > 32) {
          setError(1, "Nickname must be 3-32 characters.");
          return;
        }
        if (passValue.length < 6) {
          setError(1, "Password must be at least 6 characters.");
          return;
        }
        result = await registerAccount({ nickname: nickValue, password: passValue });
      }
      if (result && result.error) {
        setError(action === "signin-submit" ? 0 : 1, result.error);
        return;
      }
      refresh();
    } finally {
      btn.disabled = false;
    }
  });
}
