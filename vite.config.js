import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { dirname } from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vite";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** GitHub project Pages: https://symatevo.github.io/RehabOrchestra/ — CI sets GITHUB_PAGES_BASE. */
const base = process.env.GITHUB_PAGES_BASE || "/";

export default defineConfig({
  /** Pin root so builds work on Windows with Unicode paths / SUBST mismatch. */
  root: __dirname,
  base,
  plugins: [react(), tailwindcss()],
});
