/**
 * Absolute URLs under `public/` after deploy — never rely on BASE_URL alone
 * (CDN/cache can ship a bundle with import.meta.env.BASE_URL still "/").
 *
 * Priority:
 * 1. Path inferred from this module's bundled URL (.../Repo/assets/index-xxxx.js → /Repo/).
 * 2. import.meta.env.BASE_URL when not "/".
 * 3. Inline script (__REHAB_PUBLIC_BASE__) and *.github.io path fallbacks.
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
  const fromChunk = baseFromBundledModuleUrl();
  if (fromChunk) return fromChunk;

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

/** Production: this file is emitted as /RepoName/assets/<chunk>.js — infer /RepoName/ for public files. */
function baseFromBundledModuleUrl() {
  try {
    const pathname = new URL(import.meta.url).pathname;
    const m = pathname.match(/^\/([^/]+)\/assets\//);
    if (m && m[1] && m[1] !== "assets") return `/${m[1]}/`;
  } catch {
    /* non-browser or invalid */
  }
  return null;
}
