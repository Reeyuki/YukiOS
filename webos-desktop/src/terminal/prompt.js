export function renderPrompt(env, format) {
  if (!format) {
    format = "\\u@\\h:\\w\\$ ";
  }
  const user = env.get("USER") || "user";
  const home = env.get("HOME") || "/home/user";
  let cwd = env.get("PWD") || home;
  const shell = env.get("SHELL") || "sh";

  let result = format;
  result = result.replace(/\\u/g, user);
  result = result.replace(/\\h/g, env.get("HOSTNAME") || "yuki-os");
  result = result.replace(/\\H/g, env.get("HOSTNAME") || "yuki-os");
  result = result.replace(/\\w/g, () => {
    if (cwd === home) return "~";
    if (cwd.startsWith(home)) return "~" + cwd.slice(home.length);
    return cwd;
  });
  result = result.replace(/\\W/g, () => {
    const parts = cwd.split("/").filter(Boolean);
    return parts.length ? parts[parts.length - 1] : "/";
  });
  result = result.replace(/\\$/g, (env.get("UID") === "0" || env.get("EUID") === "0") ? "#" : "$");
  result = result.replace(/\\n/g, "\n");
  result = result.replace(/\\t/g, () => {
    const now = new Date();
    return now.toTimeString().slice(0, 8);
  });
  result = result.replace(/\\d/g, () => {
    return new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  });
  result = result.replace(/\\s/g, shell);
  result = result.replace(/\\v/g, "1.0");
  result = result.replace(/\\V/g, "1.0.0");
  result = result.replace(/\\!/g, String(env.get("HISTCMD") || 0));
  result = result.replace(/\\#/g, String(env.get("HISTCMD") || 0));
  return result;
}

export function renderPromptHtml(env, format) {
  const text = renderPrompt(env, format);
  const parts = text.split(/(\\e\[[0-9;]*m)/g);
  let html = "";
  for (const part of parts) {
    if (part.startsWith("\\e[")) {
      html += `<span class="ansi-escape">${escapeHtml(part)}</span>`;
    } else {
      html += escapeHtml(part);
    }
  }
  return html;
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
