function getAppMetadata() {
  const apps = {};
  const icons = document.querySelectorAll("#desktop .icon.selectable");
  icons.forEach((icon) => {
    const appKey = icon.dataset.app;
    const appName = icon.querySelector("div").textContent;
    const appIcon = icon.querySelector("img").src;
    apps[appKey] = { name: appName, icon: appIcon };
  });
  return apps;
}
export const appMetadata = getAppMetadata();
