/* global __REHAB_PUBLISHED_BASE__ */

/**
 * Absolute URLs for `public/` files on GitHub Pages (/RepoName/...).
 *
 * Primary: resolve each path relative to `document.baseURI` (directory base).
 * That avoids path-absolute "/file" URLs — those resolve to `github.io/file`,
 * not `/Repo/file`, even when `index.html` is served under `/Repo/`.
 *
 * Fallback: define + pathname heuristics (workers / no document).
 */

export function publicUrl(path) {
  const trimmed = path.replace(/^\/+/, "");
  if (typeof document !== "undefined") {
    try {
      const base = directoryBaseHref(document.baseURI || window.location.href);
      const out = new URL(trimmed, base);
      return out.pathname + out.search + out.hash;
    } catch (_) {
      /* fall through */
    }
  }
  return publicUrlConcatFallback(trimmed);
}

/** Treat current document URL as a directory so `game-sky.png` → `/Repo/game-sky.png`. */
function directoryBaseHref(href) {
  try {
    const u = new URL(href);
    if (!u.pathname.endsWith("/")) {
      u.pathname += "/";
    }
    return u.href;
  } catch {
    return href;
  }
}

function publicUrlConcatFallback(trimmed) {
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

  const ghPath = githubIoRepoBaseFromLocation();
  if (ghPath) return ghPath;

  const fromDom = baseFromDomModuleScripts();
  if (fromDom) return fromDom;

  const fromChunk = baseFromBundledModuleUrl();
  if (fromChunk) return fromChunk;

  const raw =
    typeof import.meta.env.BASE_URL === "string"
      ? import.meta.env.BASE_URL
      : "/";

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

/** user.github.io/Repo/... → /Repo/ */
function githubIoRepoBaseFromLocation() {
  if (typeof window === "undefined") return null;
  const { hostname, pathname } = window.location;
  if (!(hostname.endsWith(".github.io") || hostname === "github.io"))
    return null;
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
