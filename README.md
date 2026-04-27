# The SandBox

A Unity-style Three.js grid environment for GitHub Pages and iPhone.

## What it does

- Full-screen Three.js viewport
- 100m x 100m Unity-style grid
- 1 Three.js unit = 1 metre
- Default sky
- Sun + hemisphere lighting
- Shadows
- Tap a grid square to make it active
- Slide-out **Tools** sidebar
- **Add > Mesh > Block** tool
- Tap to place snap blocks
- Blocks stack upward
- Orbit / pinch / pan touch controls
- Reset, top view, and grid toggle buttons
- No build step needed

## Block snap system

The grid uses a simple Unity-style metre scale:

```text
1 normal grid square = 1m x 1m
1 square is split into 5 mini-slots per direction
1 snap step = 0.2m
1 block = 0.2m x 0.2m x 0.2m
```

That means:

```text
5 blocks wide = 1m
5 blocks deep = 1m
5 blocks high = 1m
```

So if you fill a 5 x 5 footprint and stack it 5 rows high, it forms one solid 1m cube.

## Files

```text
index.html
styles.css
main.js
README.md
```

## Upload to GitHub Pages

1. Create a new GitHub repo.
2. Upload these files to the repo root.
3. Go to **Settings > Pages**.
4. Set source to **Deploy from a branch**.
5. Select `main` branch and `/root`.
6. Open the GitHub Pages URL on your iPhone.

## Controls

- Tap: select/place
- 1 finger drag: orbit
- Pinch: zoom
- 2 finger drag: pan

## Tiny debug API

Open the browser console and use:

```js
theSandBox.getActiveCell()
theSandBox.getActiveSnap()
theSandBox.getBlocks()
theSandBox.clearBlocks()
theSandBox.setTool('block')
theSandBox.setTool('select')
theSandBox.selectCellByIndex(50, 50)
```

## Changing block size later

In `main.js`, the block size is controlled here:

```js
const SNAP_DIVISIONS_PER_CELL = 5;
const SNAP_SIZE = CELL_SIZE / SNAP_DIVISIONS_PER_CELL;

const BLOCK_SIZE_X = SNAP_SIZE;
const BLOCK_SIZE_Y = SNAP_SIZE;
const BLOCK_SIZE_Z = SNAP_SIZE;
```

For a brick shape like `0.4 x 0.2 x 0.2`, change:

```js
const BLOCK_SIZE_X = SNAP_SIZE * 2;
const BLOCK_SIZE_Y = SNAP_SIZE;
const BLOCK_SIZE_Z = SNAP_SIZE;
```
