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

## First-time push from this PC

If `git push` returns **403** or “permission denied”, Windows may be using another GitHub account (for example logged in as a different username than repo owner **[symatevo](https://github.com/symatevo)**):

1. **Control Panel → Credential Manager → Windows Credentials** → remove any `git:https://github.com` entries.
2. From the project folder run `git push -u origin main` again and sign in as **[symatevo](https://github.com/symatevo)** when prompted.

Alternatively use **GitHub → Settings → Developer settings → Personal access token** with `repo`, and push with:

```bash
git push https://YOUR_TOKEN@github.com/symatevo/RehabOrchestra.git main
```
