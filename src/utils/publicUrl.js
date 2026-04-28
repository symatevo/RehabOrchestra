/**
 * URLs for files from `public/`. Uses Vite `import.meta.env.BASE_URL` first (/RehabOrchestra/),
 * then window.__REHAB_PUBLIC_BASE__ (index.html inline), then *.github.io path segment.
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
  const raw =
    typeof import.meta.env.BASE_URL === "string" ? import.meta.env.BASE_URL : "/";

  if (raw !== "/" && raw !== "./" && raw !== "") {
    return raw.endsWith("/") ? raw : `${raw}/`;
  }

  if (typeof window !== "undefined") {
    const injected = window.__REHAB_PUBLIC_BASE__;
    if (typeof injected === "string" && injected.length >= 3) {
      return injected.endsWith("/") ? injected : `${injected}/`;
    }

    const { hostname, pathname } = window.location;
    if (
      hostname.endsWith(".github.io") ||
      hostname === "github.io"
    ) {
      const first = pathname.split("/").filter(Boolean)[0];
      if (first) return `/${first}/`;
    }
  }

  return raw === "./" ? "./" : "/";
}
