# Voxel Realms HD

A browser-based voxel sandbox prototype built for GitHub Pages with **Three.js**.

## Current prototype

- First-person 3D voxel world
- Procedural terrain and trees
- Grass, dirt, stone, sand, wood, leaves, planks and glass blocks
- Mine blocks with left mouse
- Place blocks with right mouse
- WASD movement + mouse look
- Jump and sprint
- Number-key hotbar
- Shadows, fog, ACES tone mapping and HDR-style exposure
- Responsive HUD and loading screen
- No build step required

## Run on GitHub Pages

1. Merge the `minecraft-hd` branch into `main`, or use that branch for Pages.
2. Open repository **Settings → Pages**.
3. Choose **Deploy from a branch**.
4. Select `main` and `/ (root)`.
5. Save.

The game is static and imports Three.js from jsDelivr, so there is no npm install or bundler required.

## Roadmap

This is the foundation rather than a claim of a full Minecraft clone. The next systems should be built in this order:

1. Chunk streaming + greedy meshing
2. Texture atlas with high-resolution physically based materials
3. Ambient occlusion and contact shadows
4. Water with reflections/refraction
5. Volumetric-looking fog, clouds and a day/night cycle
6. Caves, ores, biomes and structures
7. Collision against voxel terrain
8. Inventory/crafting UI
9. Health, hunger, tools and block hardness
10. Animals, hostile mobs and basic AI
11. Save/load worlds with IndexedDB
12. Web Worker terrain generation
13. WebGPU renderer path where supported
14. Multiplayer backend (GitHub Pages alone cannot provide authoritative multiplayer)

## Important

The goal is a **Minecraft-inspired voxel sandbox with original branding/assets**, not a redistribution of Mojang's copyrighted game assets, textures, sounds or code.
