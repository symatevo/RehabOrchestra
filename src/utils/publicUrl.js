/**
 * URLs for files from `public/`. Honors Vite `base` (/RehabOrchestra/).
 * Fallback: derive /Repo/ on *.github.io when BASE_URL is wrong (cached bundle).
 */
export function publicUrl(path) {
  const trimmed = path.replace(/^\/+/, "");
  let base = effectiveAssetBasePrefix();
  if (base !== "./" && !base.endsWith("/")) base += "/";
  if (base === "./") return `./${trimmed}`;
  return `${base}${trimmed}`;
}

/** @returns {string} '/', '/Repo/', or './' */
function effectiveAssetBasePrefix() {
  const raw = typeof import.meta.env.BASE_URL === "string" ? import.meta.env.BASE_URL : "/";

  if (raw !== "/" && raw !== "./" && raw !== "") {
    return raw.endsWith("/") ? raw : `${raw}/`;
  }

  if (typeof window !== "undefined") {
    const { hostname, pathname } = window.location;
    if (hostname.endsWith(".github.io") && pathname.length > 1) {
      const first = pathname.split("/").filter(Boolean)[0];
      if (first) return `/${first}/`;
    }
  }

  return raw === "./" ? "./" : "/";
}
