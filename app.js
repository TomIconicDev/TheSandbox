import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// --- Core world settings ----------------------------------------------------
const WORLD_SIZE = 1000;
const CELL = 0.5;
const HALF_WORLD = WORLD_SIZE / 2;
const EPS = 0.001;

const canvas = document.getElementById('scene');
const statsEl = document.getElementById('stats');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101318);
scene.fog = new THREE.FogExp2(0x101318, 0.0022);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.05, 3500);
camera.position.set(8, 7, 9);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.screenSpacePanning = false;
controls.target.set(0, 0, 0);
controls.maxPolarAngle = Math.PI * 0.49;
controls.minDistance = 1.5;
controls.maxDistance = 900;
controls.touches = {
  ONE: THREE.TOUCH.ROTATE,
  TWO: THREE.TOUCH.DOLLY_PAN
};

// --- Lighting ---------------------------------------------------------------
scene.add(new THREE.HemisphereLight(0xcfe8ff, 0x26292f, 1.8));
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(25, 40, 15);
sun.castShadow = true;
sun.shadow.camera.left = -35;
sun.shadow.camera.right = 35;
sun.shadow.camera.top = 35;
sun.shadow.camera.bottom = -35;
scene.add(sun);

// --- Grid -------------------------------------------------------------------
const grid = new THREE.GridHelper(WORLD_SIZE, WORLD_SIZE / CELL, 0x344152, 0x202832);
grid.material.transparent = true;
grid.material.opacity = 0.55;
scene.add(grid);

const axes = new THREE.AxesHelper(5);
scene.add(axes);

const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

// --- Materials --------------------------------------------------------------
const cubeMaterial = new THREE.MeshStandardMaterial({
  color: 0x98c8ff,
  roughness: 0.74,
  metalness: 0.04
});
const selectedMaterial = new THREE.MeshStandardMaterial({
  color: 0xffd36a,
  roughness: 0.65,
  metalness: 0.04
});
const mergedMaterial = new THREE.MeshStandardMaterial({
  color: 0xa7d7b8,
  roughness: 0.78,
  metalness: 0.03,
  side: THREE.DoubleSide
});
const selectedMergedMaterial = new THREE.MeshStandardMaterial({
  color: 0xffd36a,
  roughness: 0.62,
  metalness: 0.04,
  side: THREE.DoubleSide
});
const ghostMaterial = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0.25,
  depthWrite: false
});

const cubeGeometry = new THREE.BoxGeometry(CELL, CELL, CELL);

// --- Data model -------------------------------------------------------------
// Occupancy is authoritative, even after visual meshes are merged.
const occupied = new Map(); // key -> entity
const entities = new Set(); // each entity can represent 1 cube or many voxels
const selected = new Set();

let entityId = 1;
let mode = 'place';

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const pointerDown = { x: 0, y: 0, t: 0 };

const ghost = new THREE.Mesh(cubeGeometry, ghostMaterial);
ghost.visible = false;
scene.add(ghost);

// --- UI ---------------------------------------------------------------------
const placeBtn = document.getElementById('placeBtn');
const selectBtn = document.getElementById('selectBtn');
const eraseBtn = document.getElementById('eraseBtn');
const mergeBtn = document.getElementById('mergeBtn');
const separateBtn = document.getElementById('separateBtn');
const deleteBtn = document.getElementById('deleteBtn');
const clearBtn = document.getElementById('clearBtn');
const ghostToggle = document.getElementById('ghostToggle');

placeBtn.addEventListener('click', () => setMode('place'));
selectBtn.addEventListener('click', () => setMode('select'));
eraseBtn.addEventListener('click', () => setMode('erase'));
mergeBtn.addEventListener('click', mergeSelected);
separateBtn.addEventListener('click', separateSelected);
deleteBtn.addEventListener('click', deleteSelected);
clearBtn.addEventListener('click', clearWorld);
ghostToggle.addEventListener('change', updateGhostFromPointer);

function setMode(next) {
  mode = next;
  placeBtn.classList.toggle('active', mode === 'place');
  selectBtn.classList.toggle('active', mode === 'select');
  eraseBtn.classList.toggle('active', mode === 'erase');
  ghost.visible = false;
}

// --- Pointer handling -------------------------------------------------------
canvas.addEventListener('pointerdown', (event) => {
  pointerDown.x = event.clientX;
  pointerDown.y = event.clientY;
  pointerDown.t = performance.now();
});

canvas.addEventListener('pointerup', (event) => {
  const dx = event.clientX - pointerDown.x;
  const dy = event.clientY - pointerDown.y;
  const dist = Math.hypot(dx, dy);
  const elapsed = performance.now() - pointerDown.t;

  // Treat short, still interactions as a tap. Drags remain OrbitControls.
  if (dist < 10 && elapsed < 550) {
    handleTap(event);
  }
});

canvas.addEventListener('pointermove', (event) => {
  lastPointerEvent = event;
  updateGhostFromPointer();
});

let lastPointerEvent = null;

function handleTap(event) {
  setPointer(event);
  const hit = raycastScene();

  if (mode === 'select') {
    if (hit?.object?.userData.entity) toggleSelected(hit.object.userData.entity);
    return;
  }

  if (mode === 'erase') {
    if (hit?.object?.userData.entity) removeEntity(hit.object.userData.entity);
    updateStats();
    return;
  }

  if (mode === 'place') {
    const cell = getPlacementCell(hit);
    if (!cell) return;
    addCubeAt(cell.x, cell.y, cell.z);
    updateStats();
  }
}

function setPointer(event) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
  raycaster.setFromCamera(pointer, camera);
}

function raycastScene() {
  const meshes = [...entities].map(e => e.mesh);
  const hits = raycaster.intersectObjects(meshes, false);
  return hits[0] ?? null;
}

function getPlacementCell(hit) {
  let p;

  if (hit) {
    const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
    p = hit.point.clone().addScaledVector(normal, EPS);
  } else {
    p = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(groundPlane, p)) return null;
  }

  const cell = worldToCell(p);
  cell.y = Math.max(0, cell.y);

  if (!insideWorld(cell.x, cell.z)) return null;
  if (occupied.has(key(cell.x, cell.y, cell.z))) return null;

  return cell;
}

function updateGhostFromPointer() {
  if (!lastPointerEvent || mode !== 'place' || !ghostToggle.checked) {
    ghost.visible = false;
    return;
  }

  setPointer(lastPointerEvent);
  const cell = getPlacementCell(raycastScene());
  if (!cell) {
    ghost.visible = false;
    return;
  }

  ghost.position.copy(cellToCenter(cell.x, cell.y, cell.z));
  ghost.visible = true;
}

// --- Voxel actions ----------------------------------------------------------
function addCubeAt(x, y, z) {
  const k = key(x, y, z);
  if (occupied.has(k)) return null;

  const mesh = new THREE.Mesh(cubeGeometry, cubeMaterial.clone());
  mesh.position.copy(cellToCenter(x, y, z));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);

  const entity = {
    id: entityId++,
    kind: 'cube',
    mesh,
    voxels: [{ x, y, z }],
    selected: false
  };
  mesh.userData.entity = entity;
  entities.add(entity);
  occupied.set(k, entity);
  return entity;
}

function toggleSelected(entity) {
  entity.selected = !entity.selected;
  if (entity.selected) selected.add(entity);
  else selected.delete(entity);
  applySelectionMaterial(entity);
  updateStats();
}

function applySelectionMaterial(entity) {
  if (entity.kind === 'merged') {
    entity.mesh.material = entity.selected ? selectedMergedMaterial : mergedMaterial;
  } else {
    entity.mesh.material = entity.selected ? selectedMaterial : cubeMaterial;
  }
}

function mergeSelected() {
  if (selected.size < 2) return;

  const voxels = [];
  for (const entity of selected) voxels.push(...entity.voxels);

  for (const entity of [...selected]) removeEntity(entity, false);
  selected.clear();

  createMergedEntity(voxels, true);
  updateStats();
}

function separateSelected() {
  if (selected.size === 0) return;

  const targets = [...selected];
  selected.clear();

  for (const entity of targets) {
    if (entity.kind !== 'merged') {
      entity.selected = false;
      applySelectionMaterial(entity);
      continue;
    }
    const voxels = [...entity.voxels];
    removeEntity(entity, false);
    for (const v of voxels) addCubeAt(v.x, v.y, v.z);
  }
  updateStats();
}

function deleteSelected() {
  for (const entity of [...selected]) removeEntity(entity, false);
  selected.clear();
  updateStats();
}

function clearWorld() {
  for (const entity of [...entities]) removeEntity(entity, false);
  selected.clear();
  updateStats();
}

function removeEntity(entity, update = true) {
  for (const v of entity.voxels) occupied.delete(key(v.x, v.y, v.z));
  selected.delete(entity);
  entities.delete(entity);
  scene.remove(entity.mesh);
  if (entity.kind === 'merged') entity.mesh.geometry?.dispose?.();
  // Cube geometry/materials are shared, so they are intentionally not disposed here.
  if (update) updateStats();
}

function createMergedEntity(voxels, markSelected = false) {
  const geometry = buildGreedyVoxelGeometry(voxels);
  geometry.computeBoundingSphere();

  const mesh = new THREE.Mesh(geometry, markSelected ? selectedMergedMaterial : mergedMaterial);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);

  const entity = {
    id: entityId++,
    kind: 'merged',
    mesh,
    voxels: uniqueVoxels(voxels),
    selected: markSelected
  };
  mesh.userData.entity = entity;
  entities.add(entity);
  for (const v of entity.voxels) occupied.set(key(v.x, v.y, v.z), entity);
  if (markSelected) selected.add(entity);
  return entity;
}

// --- Greedy meshing / limited dissolve approximation ------------------------
// This removes all hidden internal cube faces, then combines neighbouring
// coplanar exposed faces into larger quads. That gives a Blender-style
// limited-dissolve result for axis-aligned voxel cubes.
function buildGreedyVoxelGeometry(voxels) {
  const voxSet = new Set(uniqueVoxels(voxels).map(v => key(v.x, v.y, v.z)));
  const groups = new Map();

  const axes = [
    { axis: 0, u: 2, v: 1 }, // X face, rectangle uses Z/Y
    { axis: 1, u: 0, v: 2 }, // Y face, rectangle uses X/Z
    { axis: 2, u: 0, v: 1 }  // Z face, rectangle uses X/Y
  ];

  for (const voxel of uniqueVoxels(voxels)) {
    const arr = [voxel.x, voxel.y, voxel.z];

    for (const a of axes) {
      for (const sign of [-1, 1]) {
        const n = [0, 0, 0];
        n[a.axis] = sign;
        const neighbour = [arr[0] + n[0], arr[1] + n[1], arr[2] + n[2]];
        if (voxSet.has(key(neighbour[0], neighbour[1], neighbour[2]))) continue;

        const plane = arr[a.axis] + (sign > 0 ? 1 : 0);
        const u = arr[a.u];
        const v = arr[a.v];
        const gKey = `${a.axis}|${sign}|${plane}`;
        if (!groups.has(gKey)) groups.set(gKey, { ...a, sign, plane, cells: new Set() });
        groups.get(gKey).cells.add(`${u},${v}`);
      }
    }
  }

  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  for (const group of groups.values()) {
    greedyRectangles(group.cells, (u0, v0, w, h) => {
      pushQuad({ group, u0, v0, w, h, positions, normals, uvs, indices });
    });
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  return geometry;
}

function greedyRectangles(cellSet, emit) {
  const remaining = new Set(cellSet);

  while (remaining.size) {
    const first = remaining.values().next().value;
    const [u0, v0] = first.split(',').map(Number);

    let w = 1;
    while (remaining.has(`${u0 + w},${v0}`)) w++;

    let h = 1;
    outer: while (true) {
      for (let du = 0; du < w; du++) {
        if (!remaining.has(`${u0 + du},${v0 + h}`)) break outer;
      }
      h++;
    }

    for (let du = 0; du < w; du++) {
      for (let dv = 0; dv < h; dv++) {
        remaining.delete(`${u0 + du},${v0 + dv}`);
      }
    }

    emit(u0, v0, w, h);
  }
}

function pushQuad({ group, u0, v0, w, h, positions, normals, uvs, indices }) {
  const baseIndex = positions.length / 3;
  const normal = [0, 0, 0];
  normal[group.axis] = group.sign;

  const corners = [
    [group.plane, u0,     v0],
    [group.plane, u0 + w, v0],
    [group.plane, u0 + w, v0 + h],
    [group.plane, u0,     v0 + h]
  ];

  const ordered = group.sign > 0 ? corners : [corners[0], corners[3], corners[2], corners[1]];

  for (const c of ordered) {
    const posCells = [0, 0, 0];
    posCells[group.axis] = c[0];
    posCells[group.u] = c[1];
    posCells[group.v] = c[2];
    positions.push(posCells[0] * CELL, posCells[1] * CELL, posCells[2] * CELL);
    normals.push(normal[0], normal[1], normal[2]);
  }

  uvs.push(0, 0, w, 0, w, h, 0, h);
  indices.push(baseIndex, baseIndex + 1, baseIndex + 2, baseIndex, baseIndex + 2, baseIndex + 3);
}

// --- Helpers ----------------------------------------------------------------
function worldToCell(p) {
  return {
    x: Math.floor(p.x / CELL),
    y: Math.floor(p.y / CELL),
    z: Math.floor(p.z / CELL)
  };
}

function cellToCenter(x, y, z) {
  return new THREE.Vector3((x + 0.5) * CELL, (y + 0.5) * CELL, (z + 0.5) * CELL);
}

function key(x, y, z) {
  return `${x},${y},${z}`;
}

function uniqueVoxels(voxels) {
  const map = new Map();
  for (const v of voxels) map.set(key(v.x, v.y, v.z), { x: v.x, y: v.y, z: v.z });
  return [...map.values()];
}

function insideWorld(x, z) {
  const wx0 = x * CELL;
  const wz0 = z * CELL;
  return wx0 >= -HALF_WORLD && wx0 < HALF_WORLD && wz0 >= -HALF_WORLD && wz0 < HALF_WORLD;
}

function updateStats() {
  const blockCount = occupied.size;
  const entityCount = entities.size;
  const selectedBlocks = [...selected].reduce((sum, e) => sum + e.voxels.length, 0);
  const triangleCount = [...entities].reduce((sum, e) => {
    const index = e.mesh.geometry.index;
    return sum + (index ? index.count / 3 : e.mesh.geometry.attributes.position.count / 3);
  }, 0);

  statsEl.innerHTML = `
    Blocks: <b>${blockCount}</b><br />
    Mesh objects: <b>${entityCount}</b><br />
    Selected blocks: <b>${selectedBlocks}</b><br />
    Rendered triangles: <b>${triangleCount.toLocaleString()}</b>
  `;
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onResize);

// --- Demo starter shape -----------------------------------------------------
// Small starter pad so you can test select > merge instantly.
for (let x = -2; x <= 1; x++) {
  for (let z = -2; z <= 1; z++) {
    addCubeAt(x, 0, z);
  }
}
updateStats();

function animate() {
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();
