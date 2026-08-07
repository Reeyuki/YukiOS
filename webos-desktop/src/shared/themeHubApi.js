import { SOCIAL_BASE } from "../social/endpoints.js";

export const THEME_HUB_BASE = SOCIAL_BASE;

const REQUEST_TIMEOUT_MS = 8000;

function buildQuery(params) {
  return Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
}

async function request(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const init = {
    method: options.method || "GET",
    headers: { "Content-Type": "application/json" },
    signal: controller.signal
  };
  if (options.body !== undefined) {
    init.body = JSON.stringify(options.body);
  }
  try {
    const res = await fetch(THEME_HUB_BASE + path, init);
    if (!res.ok) {
      let message = "HTTP " + res.status;
      try {
        const data = await res.json();
        if (data && data.error) message = data.error;
      } catch (e) {}
      throw new Error(message);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function listThemes({ page = 1, perPage = 12, sort = "top", search = "", author = "" } = {}) {
  try {
    const query = buildQuery({ page, per_page: perPage, sort, search, author });
    return await request(`/api/themes?${query}`);
  } catch (e) {
    return null;
  }
}

export async function getTheme(id) {
  try {
    return await request(`/api/themes/${id}`);
  } catch (e) {
    return null;
  }
}

export async function publishTheme(contract) {
  try {
    return await request("/api/themes", { method: "POST", body: { contract } });
  } catch (e) {
    return null;
  }
}

export async function voteTheme(id, vote) {
  try {
    return await request(`/api/themes/${id}/rate`, { method: "POST", body: { vote } });
  } catch (e) {
    return null;
  }
}

export async function trackInstall(id) {
  try {
    return await request(`/api/themes/${id}/install`, { method: "POST" });
  } catch (e) {
    return null;
  }
}

export async function reportTheme(id, reason) {
  try {
    return await request(`/api/themes/${id}/report`, { method: "POST", body: { reason } });
  } catch (e) {
    return null;
  }
}

export async function unpublishTheme(id) {
  try {
    return await request(`/api/themes/${id}/delete`, { method: "POST" });
  } catch (e) {
    return null;
  }
}
