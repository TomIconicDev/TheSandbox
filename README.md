# iOS Three.js Voxel Builder

A GitHub Pages-ready three.js prototype for a Unity-like 1000 × 1000 world with 0.5-unit voxel snapping.

## Features

- 1000 × 1000 world grid
- 0.5 unit snapping
- Tap to place cube blocks
- Stack cubes by tapping existing cube faces
- Select multiple cube meshes
- Merge selected cubes into one mesh
- Greedy voxel meshing removes internal faces and combines coplanar exposed faces, acting like a limited dissolve for voxel cubes
- Separate merged meshes back into individual cubes
- Delete selected / clear world
- Mobile iOS controls: tap, orbit, pan, pinch zoom

## Deploy to GitHub Pages

1. Create a GitHub repo.
2. Upload `index.html`, `style.css`, and `app.js` to the repo root.
3. Go to **Settings → Pages**.
4. Set source to **Deploy from a branch**.
5. Choose `main` and `/root`, then save.
6. Open the Pages URL GitHub gives you.

## Notes

This is an early foundation for a House Flipper-style building tool. The current merge system is voxel-aware, not just a raw BufferGeometry merge. That means a 10 × 10 × 1 slab can become one clean mesh instead of 100 separate cube objects with hidden internal faces.
