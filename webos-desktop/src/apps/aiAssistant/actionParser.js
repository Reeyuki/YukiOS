const REFUSAL_PATTERNS = [
  /\bcan'?t\b/i,
  /\bcannot\b/i,
  /\bwon'?t\b/i,
  /\bunable\b/i,
  /\bnot able to\b/i,
  /(?:don'?t|doesn'?t|do not|does not)\s+(?:have|has)\s+(?:access|the ability|permission)/i,
  /\bno access\b/i
];

const TARGETLESS_ACTIONS = new Set([
  "get_volume",
  "get_notifications",
  "get_modes",
  "lock_session",
  "show_desktop",
  "get_tray_items",
  "get_achievements",
  "list_themes",
  "list_apps",
  "list_games",
  "get_news",
  "clear_notifications",
  "toggle_dnd",
  "take_screenshot"
]);

export class ActionParser {
  constructor() {
    this.supportedActions = new Set([
      "open_app",
      "close_app",
      "focus_window",
      "move_window",
      "resize_window",
      "switch_workspace",
      "move_window_to_workspace",
      "fs_read",
      "fs_readdir",
      "fs_write",
      "emit_event",
      "set_theme",
      "toggle_setting",
      "set_volume",
      "get_volume",
      "set_wallpaper",
      "list_wallpapers",
      "send_notification",
      "clear_notifications",
      "get_notifications",
      "toggle_dnd",
      "take_screenshot",
      "switch_mode",
      "get_modes",
      "lock_session",
      "show_desktop",
      "get_tray_items",
      "get_achievements",
      "list_themes",
      "get_theme_details",
      "create_theme",
      "list_apps",
      "list_games",
      "get_news"
    ]);
  }

  parse(llmOutput) {
    const actions = [];
    const jsonMatches = llmOutput.match(/```json\n?([\s\S]*?)```/g);

    if (jsonMatches) {
      jsonMatches.forEach((match) => {
        try {
          const jsonStr = match.replace(/```json\n?/, "").replace(/```/, "");
          const parsed = JSON.parse(jsonStr);

          if (Array.isArray(parsed)) {
            parsed.forEach((action) => {
              if (this.validateAction(action)) {
                actions.push(this.normalizeAction(action));
              }
            });
          } else if (this.validateAction(parsed)) {
            actions.push(this.normalizeAction(parsed));
          }
        } catch (e) {
          console.warn("[ActionParser] Failed to parse action JSON:", e);
        }
      });
    }

    return this.extractInlineActions(llmOutput, actions);
  }

  validateAction(action) {
    if (!action || typeof action !== "object") return false;
    if (!action.action || !this.supportedActions.has(action.action)) return false;
    if (!TARGETLESS_ACTIONS.has(action.action)) {
      if (!action.target) return false;
    }
    return true;
  }

  normalizeAction(action) {
    let target = action.target;
    if (TARGETLESS_ACTIONS.has(action.action) && (target === undefined || target === null || target === "")) {
      if (action.action === "clear_notifications" || action.action === "list_apps") {
        target = "all";
      } else {
        target = "";
      }
    }

    const normalized = {
      action: action.action,
      target,
      params: action.params || {}
    };

    if (action.action === "move_window" || action.action === "resize_window") {
      if (!normalized.params.x) normalized.params.x = 0;
      if (!normalized.params.y) normalized.params.y = 0;
      if (!normalized.params.width) normalized.params.width = "800px";
      if (!normalized.params.height) normalized.params.height = "600px";
    }

    return normalized;
  }

  extractInlineActions(text, existingActions) {
    if (REFUSAL_PATTERNS.some((pattern) => pattern.test(text))) {
      return existingActions;
    }

    const patterns = [
      { regex: /(?:set\s+)?volume\s+(?:to\s+)?(up|down|mute|unmute|\d+)/gi, action: "set_volume" },
      { regex: /set\s+(?:the\s+)?wallpaper\s+(?:to\s+)?([\w\s\-\.]+)/gi, action: "set_wallpaper" },
      { regex: /change\s+wallpaper\s+to\s+([\w\s\-\.]+)/gi, action: "set_wallpaper" },
      { regex: /take\s+(?:a\s+)?screenshot/gi, action: "take_screenshot", target: "" },
      { regex: /lock\s+(?:the\s+)?(?:screen|session|system)/gi, action: "lock_session", target: "" },
      { regex: /show\s+(?:the\s+)?desktop/gi, action: "show_desktop", target: "" },
      { regex: /clear\s+(?:all\s+)?notifications/gi, action: "clear_notifications", target: "all" },
      { regex: /switch\s+(?:to\s+)?(mac|tiling|chrome\s*os|steamdeck|3d)\s*mode/gi, action: "switch_mode" },
      { regex: /do\s+not\s+disturb/gi, action: "toggle_dnd" },
      { regex: /list\s+(?:my\s+)?(?:installed\s+)?apps/gi, action: "list_apps", target: "all" },
      { regex: /list\s+games/gi, action: "list_games", target: "" },
      { regex: /list\s+themes/gi, action: "list_themes", target: "" },
      { regex: /whats?\s+new|latest\s+(?:yuki)?(?:os\s+)?news/gi, action: "get_news", target: "3" },
      { regex: /screenshot/gi, action: "take_screenshot", target: "" },
      { regex: /open\s+(?:the\s+)?(\w+)/gi, action: "open_app" },
      { regex: /close\s+(?:the\s+)?(\w+)/gi, action: "close_app" },
      { regex: /switch\s+to\s+(\w+)/gi, action: "open_app" },
      { regex: /change\s+theme\s+to\s+(\w+)/gi, action: "set_theme" },
      { regex: /switch\s+workspace(?:\s+to\s+(\w+))?/gi, action: "switch_workspace" },
      { regex: /next\s+workspace/gi, action: "switch_workspace", target: "next" },
      { regex: /previous\s+workspace|prev\s+workspace/gi, action: "switch_workspace", target: "prev" },
      { regex: /list\s+(?:files?\s+in|contents?\s+of)\s+(?:the\s+)?(?:my\s+)?(\w[\w\/]*)/gi, action: "fs_readdir" }
    ];

    patterns.forEach(({ regex, action, target: staticTarget }) => {
      const matches = text.matchAll(regex);
      for (const match of matches) {
        let target =
          staticTarget !== undefined ? staticTarget : match[1] || (action === "switch_workspace" ? "next" : "");
        if (action === "switch_mode") {
          target = String(target).replace(/\s+/g, "").toLowerCase();
        } else if (action === "toggle_dnd") {
          target = /disable\s+do\s+not\s+disturb/i.test(text) ? "off" : "on";
        }
        if (!target && !TARGETLESS_ACTIONS.has(action)) continue;
        const resolvedTarget = action === "switch_workspace" ? String(target).toLowerCase() : target;
        if (!existingActions.some((a) => a.action === action && a.target === resolvedTarget)) {
          existingActions.push({ action, target: resolvedTarget, params: {} });
        }
      }
    });

    return existingActions;
  }

  validateActionQueue(actions) {
    const valid = [];
    const invalid = [];

    actions.forEach((action, index) => {
      if (this.validateAction(action)) {
        valid.push({ ...this.normalizeAction(action), index });
      } else {
        invalid.push({ action, index, reason: "Invalid action structure" });
      }
    });

    return { valid, invalid };
  }

  buildActionPlan(actions) {
    const plan = {
      steps: [],
      dependencies: new Map(),
      estimatedTime: 0
    };

    actions.forEach((action, index) => {
      const step = {
        index,
        action: action.action,
        target: action.target,
        params: action.params,
        status: "pending"
      };
      plan.steps.push(step);

      if (action.action === "fs_write" && action.params.content) {
        plan.estimatedTime += 500;
      } else if (action.action === "open_app") {
        plan.estimatedTime += 1000;
      } else {
        plan.estimatedTime += 200;
      }
    });

    return plan;
  }
}
