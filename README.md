# Orbital Haulers Pocket

A mobile-first Three.js starter game for GitHub Pages.

## What it does

- Runs from plain static files: no npm, no build step, no server.
- Uses Three.js via a CDN import map.
- Designed for iPhone / iOS Safari controls.
- Uses generated 2D canvas sprites for haulers, cargo, office, warehouse, dust and yard props.
- Saves progress to `localStorage`.

## Gameplay prototype

Haulers fly into your dusty orbital yard, land on the pad, drop cargo crates, then leave. Tap crates to collect credits. Spend credits on:

- **Upgrade Pad** — bigger loads and faster hauler rhythm.
- **Hire Loader** — makes each crate worth more.
- **Expand Yard** — early hook for adding more placement/build systems.

## GitHub Pages setup

1. Create a new GitHub repo, for example `orbital-haulers-pocket`.
2. Upload these files to the root of the repo:
   - `index.html`
   - `style.css`
   - `src/main.js`
   - `.nojekyll`
3. Go to **Settings > Pages**.
4. Set source to **Deploy from a branch**.
5. Pick `main` and `/root`, then save.
6. Visit the GitHub Pages URL when it finishes deploying.

## File structure

```txt
orbital-haulers-pocket/
├─ index.html
├─ style.css
├─ .nojekyll
├─ README.md
└─ src/
   └─ main.js
```

## Next upgrades to build

- Placeable buildings with a build mode.
- Real sprite sheets instead of generated placeholder sprites.
- Touch drag camera zoom and pinch controls.
- Mission board: collect X cargo, repair pad, expand fence.
- Import real 2D sprites from `/assets/sprites/`.
- PWA install support so it behaves more like a pocket app on iPhone.
