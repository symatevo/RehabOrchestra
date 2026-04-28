/* global __REHAB_PUBLISHED_BASE__ */

/**
 * Absolute URLs for `public/` files on GitHub Pages (/RepoName/...).
 *
 * 1. __REHAB_PUBLISHED_BASE__ (vite define from package.json homepage)
 * 2. window.location.pathname on *.github.io (first segment ≈ repo folder)
 * 3. DOM module script paths, import.meta.url, BASE_URL, __REHAB_PUBLIC_BASE__
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
  const hard = normalizeSlashBase(
    typeof __REHAB_PUBLISHED_BASE__ === "undefined"
      ? ""
      : __REHAB_PUBLISHED_BASE__,
  );
  if (hard) return hard;

  // Project Pages: app is at user.github.io/RepoName/ — read first path segment.
  // Runs before import.meta fallbacks (SES/cached bundles can make those unreliable).
  const ghPath = githubIoRepoBaseFromLocation();
  if (ghPath) return ghPath;

  const fromDom = baseFromDomModuleScripts();
  if (fromDom) return fromDom;

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
  }

  return raw === "./" ? "./" : "/";
}

/** user.github.io/Repo/... → /Repo/ (same idea as index.html inline script). */
function githubIoRepoBaseFromLocation() {
  if (typeof window === "undefined") return null;
  const { hostname, pathname } = window.location;
  if (!(hostname.endsWith(".github.io") || hostname === "github.io")) return null;
  const first = pathname.split("/").filter(Boolean)[0];
  if (!first) return null;
  return `/${first}/`;
}

function normalizeSlashBase(b) {
  if (!b || typeof b !== "string") return "";
  const t = b.trim();
  if (!t || t === "/" || t === "./") return "";
  return t.endsWith("/") ? t : `${t}/`;
}

function baseFromDomModuleScripts() {
  if (typeof document === "undefined") return null;
  const nodes = document.querySelectorAll(
    'script[type="module"][src*="assets/"]',
  );
  for (const el of nodes) {
    try {
      const src = el.getAttribute("src");
      if (!src) continue;
      const pathname = new URL(src, location.href).pathname;
      const m = pathname.match(/^\/([^/]+)\/assets\//);
      if (m?.[1] && m[1] !== "assets") return `/${m[1]}/`;
    } catch {
      /* noop */
    }
  }
  return null;
}

function baseFromBundledModuleUrl() {
  try {
    const pathname = new URL(import.meta.url).pathname;
    const m = pathname.match(/^\/([^/]+)\/assets\//);
    if (m && m[1] && m[1] !== "assets") return `/${m[1]}/`;
  } catch {
    /* noop */
  }
  return null;
}
