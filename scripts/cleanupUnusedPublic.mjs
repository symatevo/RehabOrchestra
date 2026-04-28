/**
 * One-off cleanup: removes public assets not referenced at runtime.
 * Run: node scripts/cleanupUnusedPublic.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const pub = path.join(root, "public");

function rm(abs) {
  if (!fs.existsSync(abs)) return;
  const st = fs.statSync(abs);
  if (st.isDirectory()) fs.rmSync(abs, { recursive: true, force: true });
  else fs.unlinkSync(abs);
}

function rmRel(...parts) {
  rm(path.join(pub, ...parts));
}

// All Orchestra zip source bundles
const orch = path.join(pub, "models", "Orchestra");
if (fs.existsSync(orch)) {
  for (const name of fs.readdirSync(orch)) {
    if (name.endsWith(".zip")) rm(path.join(orch, name));
  }
}

// Orchestra root junk / design exports
const orchJunkNames = new Set([
  "02283e45-32dc-4637-976a-3bf325ce4ff9.png",
  "Cello 2nd components.png",
  "Cello 2nd.png",
  "Cello 3rd components.png",
  "Cello components.png",
  "Cello.png",
  "Spritesheet.png",
  "Screenshot 2026-04-23 160307.png",
  "ChatGPT_Image_Apr_23__2026__02_37_44_PM-removebg-preview.png",
]);
if (fs.existsSync(orch)) {
  for (const name of fs.readdirSync(orch)) {
    if (orchJunkNames.has(name)) rm(path.join(orch, name));
    if (name.startsWith("ChatGPT Image")) rm(path.join(orch, name));
  }
}

// Unused sprite trees (cello2 uses cello3 sheets in code; viola onfire not wired)
for (const dir of [
  "cello-sprite",
  "cello2-normal-sprite",
  "cello2-onfire-sprite",
  "cello2-onfire2-sprite",
  "cello2-short-sprite",
  "viola1-onfire-sprite",
  "viola3-onfire-sprite",
  "viola4-onfire-sprite",
]) {
  rmRel("models", "Orchestra", dir);
}

// spritesheet.css not loaded (only .png URLs in React)
function walkCss(dir) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    const abs = path.join(dir, name);
    const st = fs.statSync(abs);
    if (st.isDirectory()) walkCss(abs);
    else if (name === "spritesheet.css") rm(abs);
  }
}
walkCss(orch);

// Lobby folder unused (LobbyEnvironment uses models/Overall design)
rmRel("models", "lobby");

// UI never referenced in src
rmRel("ui");

// Unused music (keep game.mp3, samples, song/Midi for package.json converters)
rmRel("music", "orchestra-bed.mp3");
const songDir = path.join(pub, "music", "song");
if (fs.existsSync(songDir)) {
  for (const name of fs.readdirSync(songDir)) {
    const low = name.toLowerCase();
    if (low.endsWith(".m4a") || low.endsWith(".mp4")) rm(path.join(songDir, name));
  }
}

// Overall design: only assets used in LobbyEnvironment.jsx
const od = path.join(pub, "models", "Overall design");
const odKeep = new Set([
  "animated_grass.glb",
  "simple_bush.glb",
  "sky.png",
  "floor.png",
  "grass.png",
]);
if (fs.existsSync(od)) {
  for (const name of fs.readdirSync(od)) {
    if (!odKeep.has(name)) rm(path.join(od, name));
  }
}

console.log("cleanupUnusedPublic: done");
