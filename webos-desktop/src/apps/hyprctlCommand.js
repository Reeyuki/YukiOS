import { os } from "../framework.js";

export function hyprctlHelpText() {
  return [
    "",
    "  hyprctl help                          Show this help",
    "",
    "  hyprctl dispatch <action> [args]      Run a window dispatcher",
    "    Actions: movefocus, swapwindow, resizeactive,",
    "             togglefloating, fullscreen, togglesplit,",
    "             cyclenext, killactive",
    "",
    "  hyprctl activewindow                  Show focused window info",
    "  hyprctl clients                       List all open windows",
    "  hyprctl workspaces                    List all workspaces",
    "",
    "  hyprctl getoption <name>              Get tiling config value",
    "    Names: enabled, gaps.inner, gaps.outer, split_ratio, border_width, border_radius, resize_delta, animation_duration, animation_easing, mouse_resize, config_poll_interval, workspace_switch_delay, resize_debounce",
    "",
    "  hyprctl keyword <name> <value>        Set a tiling config value",
    "    Example: hyprctl keyword gaps.outer 5",
    "",
    "  hyprctl notify <icon> <time> <msg>    Send a notification",
    "    icon: 0-3 (info/warn/error), time: ms, msg: text",
    ""
  ];
}

export async function cmdHyprctl(terminal, args) {
  if (!args.length) {
    for (const line of hyprctlHelpText()) await terminal.enqueuePrint(line);
    return;
  }

  const sub = args[0];
  const subArgs = args.slice(1);
  const wm = os.window.wm;
  const tm = wm?.tilingManager;

  switch (sub) {
    case "help": {
      for (const line of hyprctlHelpText()) await terminal.enqueuePrint(line);
      break;
    }

    case "dispatch": {
      if (!subArgs.length) {
        await terminal.enqueuePrint("usage: hyprctl dispatch <action> [args]");
        break;
      }
      const action = subArgs[0];
      const actionArgs = subArgs.slice(1);
      if (!tm) { await terminal.enqueuePrint("Tiling manager not available"); break; }
      if (!tm.enabled) { await terminal.enqueuePrint("Tiling mode is not active"); break; }

      switch (action) {
        case "movefocus": {
          const dir = actionArgs[0];
          const dirmap = { l: "left", r: "right", u: "up", d: "down" };
          if (!dir || !dirmap[dir]) { await terminal.enqueuePrint("usage: hyprctl dispatch movefocus <l|r|u|d>"); break; }
          tm.focusDirection(dirmap[dir]);
          break;
        }
        case "swapwindow": {
          const dir = actionArgs[0];
          const dirmap = { l: "left", r: "right", u: "up", d: "down" };
          if (!dir || !dirmap[dir]) { await terminal.enqueuePrint("usage: hyprctl dispatch swapwindow <l|r|u|d>"); break; }
          tm.swapDirection(dirmap[dir]);
          break;
        }
        case "resizeactive": {
          const dir = actionArgs[0];
          const dirmap = { l: "left", r: "right", u: "up", d: "down" };
          if (!dir || !dirmap[dir]) { await terminal.enqueuePrint("usage: hyprctl dispatch resizeactive <l|r|u|d>"); break; }
          tm.resizeDirection(dirmap[dir]);
          break;
        }
        case "togglefloating":
          tm.toggleFloating();
          break;
        case "fullscreen":
          tm.toggleFullscreenOnTiled();
          break;
        case "togglesplit":
          tm.toggleSplitType();
          break;
        case "cyclenext": {
          const forward = actionArgs[0] !== "prev";
          tm.cycleFocus(forward);
          break;
        }
        case "killactive":
          tm.closeFocusedWindow();
          break;
        default:
          await terminal.enqueuePrint(`hyprctl dispatch: unknown action '${action}'`);
      }
      break;
    }

    case "activewindow": {
      if (!wm) { await terminal.enqueuePrint("Window manager not available"); break; }
      const wins = Array.from(wm.openWindows.keys())
        .map((id) => document.getElementById(id))
        .filter(Boolean)
        .sort((a, b) => parseInt(b.style.zIndex) - parseInt(a.style.zIndex));
      const focused = wins[0];
      if (!focused) { await terminal.enqueuePrint("No active window"); break; }
      const entry = wm.openWindows.get(focused.id);
      await terminal.enqueuePrint(`Window ${focused.id}`);
      await terminal.enqueuePrint(`\ttitle: ${entry?.title || "unknown"}`);
      await terminal.enqueuePrint(`\tclass: ${focused.dataset.appId || "unknown"}`);
      await terminal.enqueuePrint(`\tat: ${parseInt(focused.style.left)}x${parseInt(focused.style.top)}`);
      await terminal.enqueuePrint(`\tsize: ${focused.offsetWidth}x${focused.offsetHeight}`);
      await terminal.enqueuePrint(`\tmapped: ${focused.style.display !== "none" ? 1 : 0}`);
      if (tm) await terminal.enqueuePrint(`\ttiling: ${entry?.record?.tiled ? 1 : 0}`);
      if (entry?.record?.workspaceId != null) await terminal.enqueuePrint(`\tworkspace: ${entry.record.workspaceId}`);
      break;
    }

    case "clients": {
      if (!wm) { await terminal.enqueuePrint("Window manager not available"); break; }
      const list = [];
      wm.openWindows.forEach((entry, winId) => {
        const win = document.getElementById(winId);
        if (!win) return;
        list.push({
          winId,
          title: entry?.title || "unknown",
          appId: win.dataset.appId || "unknown",
          x: parseInt(win.style.left) || 0,
          y: parseInt(win.style.top) || 0,
          w: win.offsetWidth,
          h: win.offsetHeight,
          tiled: entry?.record?.tiled ? 1 : 0,
          floating: entry?.record?.floating ? 1 : 0,
          workspace: entry?.record?.workspaceId ?? 0,
          mapped: win.style.display !== "none" ? 1 : 0
        });
      });
      if (!list.length) { await terminal.enqueuePrint("No windows"); break; }
      await terminal.enqueuePrint(`Windows (${list.length}):`);
      await terminal.enqueuePrint("  WINID              TITLE                     APP              TILED FLOAT  WORKSPACE");
      await terminal.enqueuePrint("  ─────────────────────────────────────────────────────────────────────────────────");
      for (const c of list) {
        const id = c.winId.padEnd(18).slice(0, 18);
        const title = (c.title.length > 24 ? c.title.slice(0, 21) + "..." : c.title).padEnd(24).slice(0, 24);
        const app = c.appId.padEnd(16).slice(0, 16);
        await terminal.enqueuePrint(`  ${id} ${title} ${app} ${c.tiled ? "Y" : "N"}    ${c.floating ? "Y" : "N"}    ${c.workspace}`);
      }
      break;
    }

    case "workspaces": {
      const ws = wm?.workspaceManager;
      if (!ws) { await terminal.enqueuePrint("Workspace manager not available"); break; }
      const active = ws.activeId ?? 0;
      const all = ws.workspaces || [];
      await terminal.enqueuePrint(`Workspaces (${all.length}):`);
      for (const w of all) {
        const marker = w.id === active ? ">" : " ";
        await terminal.enqueuePrint(`  ${marker} WS ${w.id}  ${w.name || `workspace ${w.id + 1}`}`);
      }
      break;
    }

    case "getoption": {
      if (!subArgs.length) { await terminal.enqueuePrint("usage: hyprctl getoption <name>"); break; }
      if (!tm || !tm.config) { await terminal.enqueuePrint("Tiling config not available"); break; }
      const name = subArgs[0];
      const value = name.split(".").reduce((obj, key) => obj?.[key], tm.config);
      if (value === undefined) {
        await terminal.enqueuePrint(`getoption: unknown option '${name}'`);
      } else {
        await terminal.enqueuePrint(`Config option '${name}' = ${JSON.stringify(value)}`);
      }
      break;
    }

    case "keyword": {
      if (subArgs.length < 2) {
        await terminal.enqueuePrint("usage: hyprctl keyword <name> <value>");
        break;
      }
      if (!tm || !tm.config) { await terminal.enqueuePrint("Tiling config not available"); break; }
      const name = subArgs[0];
      const valStr = subArgs.slice(1).join(" ");
      const keys = name.split(".");
      let target = tm.config;
      for (let i = 0; i < keys.length - 1; i++) {
        if (!(keys[i] in target)) target[keys[i]] = {};
        target = target[keys[i]];
      }
      const lastKey = keys[keys.length - 1];
      const prev = target[lastKey];
      const parsed = !isNaN(Number(valStr)) ? Number(valStr) : valStr === "true" ? true : valStr === "false" ? false : valStr;
      target[lastKey] = parsed;
      tm.configString = JSON.stringify(tm.config, null, 2);
      os.fs.write(["Config", "yukiOs", "tiling.conf"], tm.configString).catch(() => {});
      if (tm.enabled) {
        tm.rebuildTreeForCurrentWorkspace();
        tm.applyLayoutToAllWindows();
      }
      await terminal.enqueuePrint(`Set '${name}' = ${JSON.stringify(parsed)} (was ${JSON.stringify(prev)})`);
      break;
    }

    case "notify": {
      if (subArgs.length < 3) {
        await terminal.enqueuePrint("usage: hyprctl notify <icon> <time> <message>");
        break;
      }
      const iconNum = parseInt(subArgs[0]) || 0;
      const duration = parseInt(subArgs[1]) || 5000;
      const message = subArgs.slice(2).join(" ");
      const icons = ["info", "warning", "error", "hint"];
      const icon = icons[iconNum] || "info";
      os.notify.send("hyprctl", message, { type: icon, duration });
      break;
    }

    default:
      await terminal.enqueuePrint(`hyprctl: unknown subcommand '${sub}'. See 'hyprctl help'.`);
  }
}
