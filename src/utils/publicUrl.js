/**
 * Paths under `public/` — honors Vite `base` (uses relative `./` so GitHub project Pages subpaths work).
 */
export function publicUrl(path) {
  const trimmed = path.replace(/^\/+/, "");
  let base = import.meta.env.BASE_URL;
  if (!base.endsWith("/")) base += "/";
  return `${base}${trimmed}`;
}
