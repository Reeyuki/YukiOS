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
      "fs_write",
      "emit_event",
      "set_theme",
      "toggle_setting"
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
              if (this._validateAction(action)) {
                actions.push(this._normalizeAction(action));
              }
            });
          } else if (this._validateAction(parsed)) {
            actions.push(this._normalizeAction(parsed));
          }
        } catch (e) {
          console.warn("[ActionParser] Failed to parse action JSON:", e);
        }
      });
    }

    return this._extractInlineActions(llmOutput, actions);
  }

  _validateAction(action) {
    if (!action || typeof action !== "object") return false;
    if (!action.action || !this.supportedActions.has(action.action)) return false;
    if (!action.target) return false;
    return true;
  }

  _normalizeAction(action) {
    const normalized = {
      action: action.action,
      target: action.target,
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

  _extractInlineActions(text, existingActions) {
    const patterns = [
      { regex: /open\s+(?:the\s+)?(\w+)/gi, action: "open_app" },
      { regex: /close\s+(?:the\s+)?(\w+)/gi, action: "close_app" },
      { regex: /switch\s+to\s+(\w+)/gi, action: "open_app" },
      { regex: /change\s+theme\s+to\s+(\w+)/gi, action: "set_theme" },
      { regex: /switch\s+workspace(?:\s+to\s+(\w+))?/gi, action: "switch_workspace" },
      { regex: /next\s+workspace/gi, action: "switch_workspace", target: "next" },
      { regex: /previous\s+workspace|prev\s+workspace/gi, action: "switch_workspace", target: "prev" }
    ];

    patterns.forEach(({ regex, action, target: staticTarget }) => {
      const matches = text.matchAll(regex);
      for (const match of matches) {
        const target = staticTarget || match[1] || (action === "switch_workspace" ? "next" : "");
        if (!target) continue;
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
      if (this._validateAction(action)) {
        valid.push({ ...this._normalizeAction(action), index });
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
