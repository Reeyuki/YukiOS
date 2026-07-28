export function parseBool(val, defaultValue = false) {
  if (val === true || val === "true" || val === "1") return true;
  if (val === false || val === "false" || val === "0") return false;
  return defaultValue;
}
