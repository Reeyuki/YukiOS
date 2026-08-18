export function isUrlIcon(icon) {
  return typeof icon === "string" &&
    (icon.startsWith("http") ||
     icon.startsWith("/") ||
     icon.startsWith("data:") ||
     /\.(webp|png|jpg|jpeg|gif|svg)$/.test(icon));
}
