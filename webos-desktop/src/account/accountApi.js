import { formatSize } from "../utils/utils.js";
import { isLoggedIn, accountLogin, accountRegister, accountSignOut, fetchAccountInfo, updateAccountInfo, onAccountChange, getSession } from "./session.js";
import { buildBundle, componentSizes, isSyncEnabledPref, setSyncEnabledPref, getToggles, setToggle, syncPush, syncPull } from "./syncEngine.js";

export class AccountAPI {
  constructor() {
this.client = {
      signIn: ({ email, password }) => accountLogin(email, password),
      signUp: ({ username, email, password }) => accountRegister({ nickname: username || email, password }),
      signOut: () => accountSignOut(),
      getUser: () => getSession()
    };
  }

  async signIn(identifier, password) {
    return accountLogin(identifier, password);
  }

  async signUp({ nickname, password }) {
    return accountRegister({ nickname, password });
  }

  async signOut() {
    return accountSignOut();
  }

  async isAccount() {
    return isLoggedIn();
  }

  async isSynced() {
    return isLoggedIn() && isSyncEnabledPref();
  }

  async getInfo(remote = true) {
    return fetchAccountInfo(remote);
  }

async updateInfo(user) {
    return updateAccountInfo({
      nickname: user?.name ?? user?.nickname ?? user?.username,
      avatarIndex: user?.avatarIndex ?? user?.avatar,
      bio: user?.bio
    });
  }

  async reauth() {
    return { needsSignIn: true };
  }

  sync = {
    isSyncing: false,
    enabled: () => isSyncEnabledPref(),
    enable: (on) => setSyncEnabledPref(on),
    components: () => getToggles(),
    toggleComponent: (id, on) => setToggle(id, on),
    getEnabledComponents: () => componentSizes(buildBundle()),
    buildBundle: () => buildBundle(),
    push: () => syncPush(),
    pull: (remoteData) => syncPull(remoteData)
  };

  onAccountChange = onAccountChange;
  getSession = getSession;
  formatSize = formatSize;

  get isConfigured() {
    return true;
  }
}