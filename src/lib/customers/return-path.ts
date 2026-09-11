export function safeReturnPath(value: unknown, fallback = "/account"): string {
  if (typeof value !== "string" || !value.startsWith("/")) return fallback;
  try {
    const decoded = decodeURIComponent(value);
    if (decoded.startsWith("//") || /[\\\s\x00-\x1f]/.test(decoded)) return fallback;
    const url = new URL(value, "https://local.invalid");
    if (url.origin !== "https://local.invalid" || /^\/(admin|api|auth)(\/|$)/.test(url.pathname)) return fallback;
    return url.pathname + url.search;
  } catch { return fallback; }
}
