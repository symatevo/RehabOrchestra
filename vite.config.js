import tailwindcss from "@tailwindcss/vite";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const __dirname = dirname(fileURLToPath(import.meta.url));

const pkg = JSON.parse(readFileSync(join(__dirname, "package.json"), "utf8"));

const ghMatch =
  typeof pkg.homepage === "string"
    ? /github\.io\/([^/?#]+)/.exec(pkg.homepage)
    : null;
/** e.g. /RehabOrchestra/ — must match GitHub Pages project URL */
const ghPagesRepoBase = ghMatch ? `/${ghMatch[1]}/` : "/";

export default defineConfig(({ mode }) => ({
  root: __dirname,
  /** Dev uses /. Builds & preview use /RepoName/ so assets match *.github.io/Repo/. */
  base: mode === "development" ? "/" : ghPagesRepoBase,
  plugins: [react(), tailwindcss()],
}));
