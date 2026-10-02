import { ServiceKeys } from "../ServiceKeys.js";

const REMOTE_POLL_MS = 5000;

const SESSION_MODE_IDS = { mac: "MAC", chromeos: "CHROME_OS", tiling: "TILING" };

/**
 * Connects the Electron system-tray menu to the OS (do-not-disturb, mute, power mode,
 * session mode, lock screen, remote desktop). No-op outside Electron.
 */
export async function initElectronTrayBridge(os) {
  const api = window.electronAPI;
  if (!api?.onTrayAction) return;

  const [{ audioMixer }, { performanceManager }, { modeManager, MODES }] = await Promise.all([
    import("../audioMixer.js"),
    import("../shared/performanceManager.js"),
    import("../modeManager.js")
  ]);

  const getRemoteState = () => {
    const remoteApp = os.app.getInstance(ServiceKeys.REMOTE_HOST);
    return {
      remoteDesktopActive: !!(remoteApp && remoteApp.hostStreaming),
      remoteDesktopCode: (remoteApp && remoteApp.hostRoomCode) || null
    };
  };

  const getSessionMode = () => {
    const active = modeManager.getActiveModes();
    if (active.length === 0) return "normal";
    const mode = active[0];
    if (mode === MODES.MAC) return "mac";
    if (mode === MODES.TILING) return "tiling";
    if (mode === MODES.CHROME_OS) return "chromeos";
    return mode;
  };

  const sendFullState = () => {
    const mixer = audioMixer();
    api.sendTrayState({
      dnd: os.notify.getDoNotDisturb(),
      muted: mixer ? mixer.muted : false,
      powerMode: performanceManager.getMode(),
      sessionMode: getSessionMode(),
      ...getRemoteState()
    });
  };

  api.onTrayAction(async ({ action, value }) => {
    switch (action) {
      case "toggle-dnd": {
        const next = !os.notify.getDoNotDisturb();
        os.notify.setDoNotDisturb(next);
        api.sendTrayState({ dnd: next });
        break;
      }
      case "toggle-mute": {
        const mixer = audioMixer();
        if (!mixer) break;
        mixer.muted = !mixer.muted;
        mixer.applyMasterToAll();
        mixer.save();
        api.sendTrayState({ muted: mixer.muted });
        break;
      }
      case "lock-screen":
        os.app.lockSession();
        break;
      case "set-power-mode":
        performanceManager.setMode(value);
        api.sendTrayState({ powerMode: value });
        break;
      case "set-session-mode": {
        modeManager.exitAll();
        const modeId = Object.hasOwn(SESSION_MODE_IDS, value) ? MODES[SESSION_MODE_IDS[value]] : null;
        if (modeId) modeManager.enter(modeId);
        api.sendTrayState({ sessionMode: value });
        break;
      }
      case "remote-stop":
        try {
          await api.stopRemoteHost();
        } catch (err) {
          console.warn("[tray] stopRemoteHost failed", err);
        }
        api.sendTrayState({ remoteDesktopActive: false, remoteDesktopCode: null });
        break;
    }
  });

  sendFullState();
  setInterval(() => api.sendTrayState(getRemoteState()), REMOTE_POLL_MS);
}
