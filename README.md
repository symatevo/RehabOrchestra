# Rehab Orchestra (mirror-rehab-game)

Vite + React + React Three Fiber rehab game with camera / Mediapipe.

## Repository

<https://github.com/symatevo/RehabOrchestra>

## Live demo

**Required once (or deploy fails with “Ensure GitHub Pages has been enabled”):**

1. Open **[repo → Settings → Pages](https://github.com/symatevo/RehabOrchestra/settings/pages)**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions** (not “Deploy from a branch”).
3. Go to **Actions**, open the latest **Deploy to GitHub Pages** run, and click **Re-run all jobs** (or push any commit).

Then the app is served at:

**<https://symatevo.github.io/RehabOrchestra/>**

## Local development

```bash
yarn
yarn dev
```

After `yarn build`, open the preview at **`http://localhost:4173/RehabOrchestra/`** (the production build uses `/RehabOrchestra/` as in `package.json` **homepage**).

The app uses **`/RehabOrchestra/`** as the Vite production `base` so public assets and hashed JS/CSS match **https://symatevo.github.io/RehabOrchestra/**. If you rename the repo, update **homepage** in `package.json`, then rebuild.

## First-time push from this PC

If `git push` returns **403** or “permission denied”, Windows may be using another GitHub account (for example logged in as a different username than repo owner **[symatevo](https://github.com/symatevo)**):

1. **Control Panel → Credential Manager → Windows Credentials** → remove any `git:https://github.com` entries.
2. From the project folder run `git push -u origin main` again and sign in as **[symatevo](https://github.com/symatevo)** when prompted.

Alternatively use **GitHub → Settings → Developer settings → Personal access token** with `repo`, and push with:

```bash
git push https://YOUR_TOKEN@github.com/symatevo/RehabOrchestra.git main
```
