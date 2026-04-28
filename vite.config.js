import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { dirname } from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vite";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Relative base so deploy works under any path (dev, GitHub Pages /repo/) without env in CI. */
const base = "./";

export default defineConfig({
  /** Pin root so builds work on Windows with Unicode paths / SUBST mismatch. */
  root: __dirname,
  base,
  plugins: [react(), tailwindcss()],
});
