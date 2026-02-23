function getAppMetadata() {
  const apps = {};
  const icons = document.querySelectorAll("#desktop .icon.selectable");
  icons.forEach((icon) => {
    const appKey = icon.dataset.app;
    const appName = icon.querySelector("div")?.textContent || "";
    let appIconEl = icon.querySelector("img") || icon.querySelector("fas");
    let appIcon = appIconEl ? appIconEl.src || appIconEl.className || "" : "";
    apps[appKey] = { name: appName, icon: appIcon };
  });
  return apps;
}
export const appMetadata = getAppMetadata();
