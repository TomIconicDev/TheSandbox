import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Sky } from 'three/addons/objects/Sky.js';

/*
  The SandBox
  Unity-style Three.js grid environment for GitHub Pages + iPhone.

  Scale:
  - 1 Three.js unit = 1 Unity-style metre.
  - Main grid is 100m x 100m.
  - Each normal grid square is 1m x 1m.

  Brick block size:
  - X length: 0.5m
  - Y height: 0.125m
  - Z depth:  0.25m

  This means one perfect 1m cube can be built from:
  - 2 bricks along X
  - 4 bricks along Z
  - 8 rows high
*/

const GRID_SIZE = 100;
const GRID_DIVISIONS = 100;
const CELL_SIZE = GRID_SIZE / GRID_DIVISIONS;
const HALF_GRID = GRID_SIZE / 2;

// 8 snap steps per metre gives a clean 0.125m vertical row height.
const SNAP_DIVISIONS_PER_CELL = 8;
const SNAP_SIZE = CELL_SIZE / SNAP_DIVISIONS_PER_CELL;

// Brick/block dimensions.
const BLOCK_UNITS_X = 4; // 4 × 0.125 = 0.5m
const BLOCK_UNITS_Y = 1; // 1 × 0.125 = 0.125m
const BLOCK_UNITS_Z = 2; // 2 × 0.125 = 0.25m

const BLOCK_SIZE_X = SNAP_SIZE * BLOCK_UNITS_X;
const BLOCK_SIZE_Y = SNAP_SIZE * BLOCK_UNITS_Y;
const BLOCK_SIZE_Z = SNAP_SIZE * BLOCK_UNITS_Z;

const ToolMode = {
  SELECT: 'select',
  BLOCK: 'block'
};

let currentTool = ToolMode.SELECT;

const app = document.querySelector('#app');
const activeSquareLabel = document.querySelector('#activeSquareLabel');
const toolStatusLabel = document.querySelector('#toolStatusLabel');

const toolsToggleBtn = document.querySelector('#toolsToggleBtn');
const toolsPanel = document.querySelector('#toolsPanel');
const closeToolsBtn = document.querySelector('#closeToolsBtn');
const blockToolBtn = document.querySelector('#blockToolBtn');
const cancelToolBtn = document.querySelector('#cancelToolBtn');
const clearBlocksBtn = document.querySelector('#clearBlocksBtn');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xbfd7ff);

// Camera.
const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(18, 14, 18);

// Renderer.
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance'
});

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.8;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

app.appendChild(renderer.domElement);

// Mobile-friendly orbit controls.
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.screenSpacePanning = false;
controls.minDistance = 4;
controls.maxDistance = 160;
controls.maxPolarAngle = Math.PI * 0.48;
controls.update();

// Unity-like grid.
const grid = new THREE.GridHelper(GRID_SIZE, GRID_DIVISIONS, 0x444444, 0x888888);
grid.position.y = 0.015;
scene.add(grid);

// Ground plane. Raycaster hits this when placing/selecting.
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(GRID_SIZE, GRID_SIZE),
  new THREE.MeshStandardMaterial({
    color: 0x3b3f46,
    roughness: 0.92,
    metalness: 0.0
  })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = 0;
ground.receiveShadow = true;
scene.add(ground);

// World axes marker.
const axes = new THREE.AxesHelper(5);
axes.position.y = 0.03;
scene.add(axes);

// Default sky.
const sky = new Sky();
sky.scale.setScalar(450000);
scene.add(sky);

const sun = new THREE.Vector3();

function setupSky() {
  const uniforms = sky.material.uniforms;

  uniforms.turbidity.value = 6;
  uniforms.rayleigh.value = 1.7;
  uniforms.mieCoefficient.value = 0.004;
  uniforms.mieDirectionalG.value = 0.86;

  const elevation = 35;
  const azimuth = 145;
  const phi = THREE.MathUtils.degToRad(90 - elevation);
  const theta = THREE.MathUtils.degToRad(azimuth);

  sun.setFromSphericalCoords(1, phi, theta);
  uniforms.sunPosition.value.copy(sun);
}

setupSky();

// Lighting.
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x5f6670, 1.45);
scene.add(hemiLight);

const sunLight = new THREE.DirectionalLight(0xffffff, 2.5);
sunLight.position.set(35, 55, 25);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
sunLight.shadow.camera.near = 1;
sunLight.shadow.camera.far = 160;
sunLight.shadow.camera.left = -70;
sunLight.shadow.camera.right = 70;
sunLight.shadow.camera.top = 70;
sunLight.shadow.camera.bottom = -70;
scene.add(sunLight);

// Active 1m grid-square highlight.
const activeSquare = new THREE.Mesh(
  new THREE.PlaneGeometry(CELL_SIZE, CELL_SIZE),
  new THREE.MeshBasicMaterial({
    color: 0xffd34d,
    transparent: true,
    opacity: 0.34,
    side: THREE.DoubleSide,
    depthWrite: false
  })
);
activeSquare.rotation.x = -Math.PI / 2;
activeSquare.position.y = 0.045;
activeSquare.visible = false;
scene.add(activeSquare);

const borderPoints = [
  new THREE.Vector3(-CELL_SIZE / 2, 0, -CELL_SIZE / 2),
  new THREE.Vector3(CELL_SIZE / 2, 0, -CELL_SIZE / 2),
  new THREE.Vector3(CELL_SIZE / 2, 0, CELL_SIZE / 2),
  new THREE.Vector3(-CELL_SIZE / 2, 0, CELL_SIZE / 2),
  new THREE.Vector3(-CELL_SIZE / 2, 0, -CELL_SIZE / 2)
];

const activeBorder = new THREE.Line(
  new THREE.BufferGeometry().setFromPoints(borderPoints),
  new THREE.LineBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.86
  })
);
activeBorder.position.y = 0.065;
activeBorder.visible = false;
scene.add(activeBorder);

// Origin marker ring.
const originRing = new THREE.Mesh(
  new THREE.RingGeometry(2.4, 2.5, 96),
  new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.34,
    side: THREE.DoubleSide
  })
);
originRing.rotation.x = -Math.PI / 2;
originRing.position.y = 0.025;
scene.add(originRing);

// Block builder data.
const placedBlocks = [];
const stackHeights = new Map();

const blockGeometry = new THREE.BoxGeometry(BLOCK_SIZE_X, BLOCK_SIZE_Y, BLOCK_SIZE_Z);
const blockMaterial = new THREE.MeshStandardMaterial({
  color: 0xc8ccd2,
  roughness: 0.72,
  metalness: 0.02
});

const ghostMaterial = new THREE.MeshStandardMaterial({
  color: 0xffd34d,
  roughness: 0.65,
  transparent: true,
  opacity: 0.45,
  depthWrite: false
});

const blockGhost = new THREE.Mesh(blockGeometry, ghostMaterial);
blockGhost.visible = false;
blockGhost.castShadow = false;
blockGhost.receiveShadow = false;
scene.add(blockGhost);

// Raycasting.
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

let pointerDown = null;
let activeCell = null;
let activeBrickSlot = null;

function getPointerNDC(event) {
  const rect = renderer.domElement.getBoundingClientRect();

  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  return pointer;
}

function worldPointToCell(point) {
  if (
    point.x < -HALF_GRID ||
    point.x >= HALF_GRID ||
    point.z < -HALF_GRID ||
    point.z >= HALF_GRID
  ) {
    return null;
  }

  const col = Math.floor((point.x + HALF_GRID) / CELL_SIZE);
  const row = Math.floor((point.z + HALF_GRID) / CELL_SIZE);

  const centerX = -HALF_GRID + col * CELL_SIZE + CELL_SIZE / 2;
  const centerZ = -HALF_GRID + row * CELL_SIZE + CELL_SIZE / 2;

  return {
    col,
    row,
    centerX,
    centerZ,
    worldX: point.x,
    worldZ: point.z
  };
}

function worldPointToBrickSlot(point) {
  if (
    point.x < -HALF_GRID ||
    point.x >= HALF_GRID ||
    point.z < -HALF_GRID ||
    point.z >= HALF_GRID
  ) {
    return null;
  }

  const relativeX = point.x + HALF_GRID;
  const relativeZ = point.z + HALF_GRID;

  // Non-overlapping brick slots:
  // 2 brick slots per 1m on X, 4 brick slots per 1m on Z.
  const brickSlotX = Math.floor(relativeX / BLOCK_SIZE_X);
  const brickSlotZ = Math.floor(relativeZ / BLOCK_SIZE_Z);

  const anchorX = brickSlotX * BLOCK_SIZE_X;
  const anchorZ = brickSlotZ * BLOCK_SIZE_Z;

  const centerX = -HALF_GRID + anchorX + BLOCK_SIZE_X / 2;
  const centerZ = -HALF_GRID + anchorZ + BLOCK_SIZE_Z / 2;

  const cellCol = Math.floor((centerX + HALF_GRID) / CELL_SIZE);
  const cellRow = Math.floor((centerZ + HALF_GRID) / CELL_SIZE);

  const slotInCellX = brickSlotX % 2;
  const slotInCellZ = brickSlotZ % 4;

  return {
    brickSlotX,
    brickSlotZ,
    centerX,
    centerZ,
    cellCol,
    cellRow,
    slotInCellX,
    slotInCellZ
  };
}

function stackKeyFromBrickSlot(slot) {
  return `${slot.brickSlotX}:${slot.brickSlotZ}`;
}

function selectCell(cell) {
  activeCell = cell;

  activeSquare.position.x = cell.centerX;
  activeSquare.position.z = cell.centerZ;
  activeSquare.visible = true;

  activeBorder.position.x = cell.centerX;
  activeBorder.position.z = cell.centerZ;
  activeBorder.visible = true;

  activeSquareLabel.textContent = `Active square: X ${cell.col}, Z ${cell.row}`;
}

function getSceneHitFromPointer(event) {
  getPointerNDC(event);
  raycaster.setFromCamera(pointer, camera);

  const targets = placedBlocks.length ? [...placedBlocks, ground] : [ground];
  const hits = raycaster.intersectObjects(targets, false);
  if (!hits.length) return null;

  const firstHit = hits[0];

  // If tapping a block, use its centre point so it stacks in that exact slot.
  if (firstHit.object.userData?.type === 'block') {
    return {
      point: new THREE.Vector3(
        firstHit.object.position.x,
        firstHit.point.y,
        firstHit.object.position.z
      ),
      object: firstHit.object
    };
  }

  return firstHit;
}

function selectGridSquareFromPointer(event) {
  const hit = getSceneHitFromPointer(event);
  if (!hit) return;

  const cell = worldPointToCell(hit.point);
  if (!cell) return;

  selectCell(cell);
}

function updateGhostFromPointer(event) {
  if (currentTool !== ToolMode.BLOCK) {
    blockGhost.visible = false;
    return;
  }

  const hit = getSceneHitFromPointer(event);
  if (!hit) {
    blockGhost.visible = false;
    return;
  }

  const slot = worldPointToBrickSlot(hit.point);
  if (!slot) {
    blockGhost.visible = false;
    return;
  }

  const key = stackKeyFromBrickSlot(slot);
  const stackHeight = stackHeights.get(key) ?? 0;

  blockGhost.position.set(
    slot.centerX,
    stackHeight * BLOCK_SIZE_Y + BLOCK_SIZE_Y / 2,
    slot.centerZ
  );
  blockGhost.visible = true;

  activeBrickSlot = slot;
}

function placeBlockFromPointer(event) {
  const hit = getSceneHitFromPointer(event);
  if (!hit) return;

  const slot = worldPointToBrickSlot(hit.point);
  if (!slot) return;

  const cell = {
    col: slot.cellCol,
    row: slot.cellRow,
    centerX: -HALF_GRID + slot.cellCol * CELL_SIZE + CELL_SIZE / 2,
    centerZ: -HALF_GRID + slot.cellRow * CELL_SIZE + CELL_SIZE / 2
  };

  selectCell(cell);

  const key = stackKeyFromBrickSlot(slot);
  const stackHeight = stackHeights.get(key) ?? 0;

  const block = new THREE.Mesh(blockGeometry, blockMaterial.clone());
  block.position.set(
    slot.centerX,
    stackHeight * BLOCK_SIZE_Y + BLOCK_SIZE_Y / 2,
    slot.centerZ
  );

  block.castShadow = true;
  block.receiveShadow = true;
  block.userData = {
    type: 'block',
    brickSlotX: slot.brickSlotX,
    brickSlotZ: slot.brickSlotZ,
    stackIndex: stackHeight,
    cellCol: slot.cellCol,
    cellRow: slot.cellRow,
    slotInCellX: slot.slotInCellX,
    slotInCellZ: slot.slotInCellZ,
    size: {
      x: BLOCK_SIZE_X,
      y: BLOCK_SIZE_Y,
      z: BLOCK_SIZE_Z
    }
  };

  scene.add(block);
  placedBlocks.push(block);

  stackHeights.set(key, stackHeight + 1);

  activeBrickSlot = slot;
  activeSquareLabel.textContent =
    `Brick placed: cell ${slot.cellCol}, ${slot.cellRow} · slot ${slot.slotInCellX + 1}/2, ${slot.slotInCellZ + 1}/4 · row ${stackHeight + 1}/8`;

  updateGhostFromPointer(event);
}

function setTool(tool) {
  currentTool = tool;

  const isBlock = currentTool === ToolMode.BLOCK;
  blockToolBtn.classList.toggle('active', isBlock);
  blockGhost.visible = false;

  toolStatusLabel.textContent = isBlock
    ? 'Tool: Add > Mesh > Block'
    : 'Tool: Select';
}

function clearBlocks() {
  for (const block of placedBlocks) {
    scene.remove(block);
    block.material.dispose();
  }

  placedBlocks.length = 0;
  stackHeights.clear();
  blockGhost.visible = false;
  activeSquareLabel.textContent = 'Blocks cleared';
}

// Canvas pointer events.
renderer.domElement.addEventListener('pointerdown', (event) => {
  pointerDown = {
    x: event.clientX,
    y: event.clientY,
    time: performance.now(),
    pointerId: event.pointerId
  };
});

renderer.domElement.addEventListener('pointermove', (event) => {
  updateGhostFromPointer(event);
});

renderer.domElement.addEventListener('pointerup', (event) => {
  if (!pointerDown || pointerDown.pointerId !== event.pointerId) return;

  const dx = event.clientX - pointerDown.x;
  const dy = event.clientY - pointerDown.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const elapsed = performance.now() - pointerDown.time;

  pointerDown = null;

  // Treat it as a tap only if the finger/mouse did not drag much.
  if (distance <= 8 && elapsed < 450) {
    if (currentTool === ToolMode.BLOCK) {
      placeBlockFromPointer(event);
    } else {
      selectGridSquareFromPointer(event);
    }
  }
});

// Tool panel.
function openTools() {
  toolsPanel.classList.add('open');
}

function closeTools() {
  toolsPanel.classList.remove('open');
}

toolsToggleBtn.addEventListener('click', openTools);
closeToolsBtn.addEventListener('click', closeTools);

blockToolBtn.addEventListener('click', () => {
  setTool(ToolMode.BLOCK);
  closeTools();
});

cancelToolBtn.addEventListener('click', () => {
  setTool(ToolMode.SELECT);
});

clearBlocksBtn.addEventListener('click', () => {
  clearBlocks();
});

// Stop UI taps from falling through to the Three.js canvas.
for (const element of [toolsToggleBtn, toolsPanel]) {
  element.addEventListener('pointerdown', (event) => event.stopPropagation());
  element.addEventListener('pointerup', (event) => event.stopPropagation());
  element.addEventListener('pointermove', (event) => event.stopPropagation());
}

// Top HUD buttons.
document.querySelector('#resetCameraBtn').addEventListener('click', () => {
  camera.position.set(18, 14, 18);
  controls.target.set(0, 0, 0);
  controls.update();
});

document.querySelector('#topViewBtn').addEventListener('click', () => {
  camera.position.set(0, 60, 0.001);
  controls.target.set(0, 0, 0);
  controls.update();
});

document.querySelector('#toggleGridBtn').addEventListener('click', () => {
  grid.visible = !grid.visible;
  axes.visible = grid.visible;
  originRing.visible = grid.visible;
  activeSquare.visible = grid.visible && activeCell !== null;
  activeBorder.visible = grid.visible && activeCell !== null;
});

// Resize handling for iPhone rotation / browser chrome changes.
function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
}

window.addEventListener('resize', resize);
window.addEventListener('orientationchange', resize);

// Expose a tiny debug API for later game/editor features.
window.theSandBox = {
  getActiveCell: () => activeCell,
  getActiveBrickSlot: () => activeBrickSlot,
  getBlockSize: () => ({
    x: BLOCK_SIZE_X,
    y: BLOCK_SIZE_Y,
    z: BLOCK_SIZE_Z
  }),
  getBlocks: () => placedBlocks.map((block) => ({
    position: block.position.toArray(),
    ...block.userData
  })),
  clearBlocks,
  setTool,
  selectCellByIndex: (col, row) => {
    if (
      col < 0 ||
      row < 0 ||
      col >= GRID_DIVISIONS ||
      row >= GRID_DIVISIONS
    ) {
      console.warn('Cell outside grid.');
      return;
    }

    selectCell({
      col,
      row,
      centerX: -HALF_GRID + col * CELL_SIZE + CELL_SIZE / 2,
      centerZ: -HALF_GRID + row * CELL_SIZE + CELL_SIZE / 2
    });
  }
};

// Animation loop.
function animate() {
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

setTool(ToolMode.SELECT);
animate();
