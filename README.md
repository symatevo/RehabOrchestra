# Rehab Orchestra (mirror-rehab-game)

Vite + React + React Three Fiber rehab game with camera / Mediapipe.

## Repository

<https://github.com/symatevo/RehabOrchestra>

## Live demo

After GitHub Actions completes, the game is served at:

**<https://symatevo.github.io/RehabOrchestra/>**

(Enable **Settings → Pages → Build and deployment: GitHub Actions** on first setup if the site does not appear.)

## Local development

```bash
yarn
yarn dev
```

## Production build

```bash
yarn build
yarn preview
```

For GitHub Pages the workflow sets `GITHUB_PAGES_BASE=/RehabOrchestra/`; locally, `vite.config.js` defaults to `/`.
