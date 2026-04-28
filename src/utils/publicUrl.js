/* global __REHAB_PUBLISHED_BASE__ */

/**
 * Absolute URLs for `public/` files on GitHub Pages (/RepoName/...).
 *
 * 1. __REHAB_PUBLISHED_BASE__ from vite.config define (homepage → /Repo/) — survives SES/import.meta quirks.
 * 2. Loading module `<script src=.../assets/...>`
 * 3. import.meta.url path
 * 4. import.meta.env.BASE_URL, inline script, location on github.io.
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

    const { hostname, pathname } = window.location;
    if (hostname.endsWith(".github.io") || hostname === "github.io") {
      const first = pathname.split("/").filter(Boolean)[0];
      if (first) return `/${first}/`;
    }
  }

  return raw === "./" ? "./" : "/";
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
