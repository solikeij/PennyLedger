// Accept boolean flags and the numeric/string flags used by older API versions.
export function isArchived(value) {
  return value === true || value === 1 || value === "1" || value === "true";
}
