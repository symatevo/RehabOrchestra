/**
 * URLs for files from `public/`. Honors Vite base (e.g. /RehabOrchestra/).
 * If index.html sets window.__REHAB_PUBLIC_BASE__ (GitHub Pages), that wins so paths work
 * when the pathname is /Repo without a trailing slash.
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
  if (typeof window !== "undefined") {
    const injected = window.__REHAB_PUBLIC_BASE__;
    if (typeof injected === "string" && injected.length >= 3) {
      return injected.endsWith("/") ? injected : `${injected}/`;
    }

    const { hostname, pathname } = window.location;
    if (hostname.endsWith(".github.io") && pathname.length > 1) {
      const first = pathname.split("/").filter(Boolean)[0];
      if (first) return `/${first}/`;
    }
  }

  const raw = typeof import.meta.env.BASE_URL === "string" ? import.meta.env.BASE_URL : "/";
  if (raw !== "/" && raw !== "./" && raw !== "") {
    return raw.endsWith("/") ? raw : `${raw}/`;
  }

  return raw === "./" ? "./" : "/";
}
