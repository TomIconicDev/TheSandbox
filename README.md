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
- Brick-shaped block placement
- Tap the same brick slot to stack upward
- Orbit / pinch / pan touch controls
- Reset, top view, and grid toggle buttons
- No build step needed

## Brick block size

The block is now more like a brick instead of a mini cube:

```text
X length = 0.5m
Y height = 0.125m
Z depth  = 0.25m
```

That means one perfect 1m cube can be made from:

```text
2 bricks along X
4 bricks along Z
8 bricks high
```

So a 1m cube is:

```text
2 × 4 × 8 = 64 brick blocks
```

## Code values

In `main.js`:

```js
const SNAP_DIVISIONS_PER_CELL = 8;
const SNAP_SIZE = CELL_SIZE / SNAP_DIVISIONS_PER_CELL;

const BLOCK_UNITS_X = 4; // 0.5m
const BLOCK_UNITS_Y = 1; // 0.125m
const BLOCK_UNITS_Z = 2; // 0.25m

const BLOCK_SIZE_X = SNAP_SIZE * BLOCK_UNITS_X;
const BLOCK_SIZE_Y = SNAP_SIZE * BLOCK_UNITS_Y;
const BLOCK_SIZE_Z = SNAP_SIZE * BLOCK_UNITS_Z;
```

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
theSandBox.getActiveBrickSlot()
theSandBox.getBlockSize()
theSandBox.getBlocks()
theSandBox.clearBlocks()
theSandBox.setTool('block')
theSandBox.setTool('select')
theSandBox.selectCellByIndex(50, 50)
```
