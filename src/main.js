import * as THREE from 'three';

const SAVE_KEY = 'orbital-haulers-pocket-v1';
const WORLD_SIZE = 18;
const PAD_POS = new THREE.Vector3(0, 0.03, 0);

const ui = {
  credits: document.querySelector('#credits'),
  cargo: document.querySelector('#cargo'),
  padLevel: document.querySelector('#padLevel'),
  loaderLevel: document.querySelector('#loaderLevel'),
  statusLine: document.querySelector('#statusLine'),
  upgradePadBtn: document.querySelector('#upgradePadBtn'),
  hireLoaderBtn: document.querySelector('#hireLoaderBtn'),
  expandYardBtn: document.querySelector('#expandYardBtn'),
  upgradePadCost: document.querySelector('#upgradePadCost'),
  hireLoaderCost: document.querySelector('#hireLoaderCost'),
  expandYardCost: document.querySelector('#expandYardCost'),
  resetBtn: document.querySelector('#resetBtn'),
  toast: document.querySelector('#toast')
};

const defaultState = {
  credits: 25,
  cargo: 0,
  padLevel: 1,
  loaderLevel: 0,
  yardLevel: 1,
  deliveredLoads: 0,
  nextHaulerAt: 4
};

let state = loadState();
let scene, camera, renderer, clock, raycaster;
let padMesh, warehouseSprite, officeSprite, yardGroup;
let activeHauler = null;
let cargoCrates = [];
let dustPuffs = [];
let pointerStart = null;
let cameraTarget = new THREE.Vector3(0, 0, 0);
let cameraDistance = 15;
let lastSave = 0;

init();
animate();

function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1b2430);
  scene.fog = new THREE.Fog(0x1b2430, 24, 44);

  clock = new THREE.Clock();
  raycaster = new THREE.Raycaster();

  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.querySelector('#game').appendChild(renderer.domElement);

  camera = new THREE.OrthographicCamera(-8, 8, 8, -8, 0.1, 100);
  camera.position.set(9, 13, 9);
  camera.lookAt(cameraTarget);

  const hemi = new THREE.HemisphereLight(0xfff3cf, 0x3d3c45, 2.4);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff1c4, 2.6);
  sun.position.set(8, 14, 5);
  scene.add(sun);

  buildWorld();
  bindInput();
  updateCamera();
  updateHud();
  resize();
  showToast('Tap cargo crates when haulers drop them');
}

function buildWorld() {
  yardGroup = new THREE.Group();
  scene.add(yardGroup);

  const desertTexture = makeDesertTexture();
  desertTexture.wrapS = desertTexture.wrapT = THREE.RepeatWrapping;
  desertTexture.repeat.set(8, 8);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 80),
    new THREE.MeshLambertMaterial({ map: desertTexture })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  scene.add(ground);

  addYardBase();
  addFence();
  addPad();
  addBuildings();
  addWorldDressing();
}

function addYardBase() {
  const yardTexture = makeYardTexture();
  const yard = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE),
    new THREE.MeshLambertMaterial({ map: yardTexture })
  );
  yard.rotation.x = -Math.PI / 2;
  yard.position.y = 0;
  yardGroup.add(yard);

  const grid = new THREE.GridHelper(WORLD_SIZE, WORLD_SIZE, 0x7b6c53, 0x4b4438);
  grid.position.y = 0.015;
  yardGroup.add(grid);
}

function addFence() {
  const fenceMat = new THREE.MeshLambertMaterial({ color: 0x615647 });
  const postMat = new THREE.MeshLambertMaterial({ color: 0x3d3730 });
  const half = WORLD_SIZE / 2;

  const rails = [
    [0, -half, WORLD_SIZE, 0.08],
    [0, half, WORLD_SIZE, 0.08],
    [-half, 0, 0.08, WORLD_SIZE],
    [half, 0, 0.08, WORLD_SIZE]
  ];

  for (const [x, z, sx, sz] of rails) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.18, sz), fenceMat);
    rail.position.set(x, 0.17, z);
    yardGroup.add(rail);
  }

  for (let i = -half; i <= half; i += 2) {
    for (const side of [-half, half]) {
      const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.6, 0.16), postMat);
      p1.position.set(i, 0.32, side);
      yardGroup.add(p1);
      const p2 = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.6, 0.16), postMat);
      p2.position.set(side, 0.32, i);
      yardGroup.add(p2);
    }
  }
}

function addPad() {
  padMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(5.2, 5.2),
    new THREE.MeshBasicMaterial({ map: makePadTexture(), transparent: true })
  );
  padMesh.rotation.x = -Math.PI / 2;
  padMesh.position.copy(PAD_POS);
  padMesh.userData.kind = 'pad';
  yardGroup.add(padMesh);
}

function addBuildings() {
  warehouseSprite = makeSprite('warehouse');
  warehouseSprite.position.set(5.7, 1.55, -4.5);
  warehouseSprite.scale.set(4.4, 3.1, 1);
  yardGroup.add(warehouseSprite);

  officeSprite = makeSprite('office');
  officeSprite.position.set(-5.6, 1.15, -4.8);
  officeSprite.scale.set(3.2, 2.3, 1);
  yardGroup.add(officeSprite);
}

function addWorldDressing() {
  const mat = new THREE.MeshLambertMaterial({ color: 0x5c4f3e });
  for (let i = 0; i < 20; i++) {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(Math.random() * 0.18 + 0.08), mat);
    const angle = Math.random() * Math.PI * 2;
    const r = 12 + Math.random() * 20;
    rock.position.set(Math.cos(angle) * r, 0.08, Math.sin(angle) * r);
    rock.rotation.set(Math.random(), Math.random(), Math.random());
    scene.add(rock);
  }

  const tower = makeSprite('beacon');
  tower.position.set(7.3, 1.05, 6.8);
  tower.scale.set(1.4, 2.1, 1);
  yardGroup.add(tower);
}

function bindInput() {
  window.addEventListener('resize', resize);

  renderer.domElement.addEventListener('pointerdown', (event) => {
    pointerStart = { x: event.clientX, y: event.clientY, time: performance.now(), camera: cameraTarget.clone() };
    renderer.domElement.setPointerCapture(event.pointerId);
  });

  renderer.domElement.addEventListener('pointermove', (event) => {
    if (!pointerStart) return;
    const dx = event.clientX - pointerStart.x;
    const dy = event.clientY - pointerStart.y;
    if (Math.hypot(dx, dy) < 5) return;

    const scale = 0.018 * cameraDistance;
    const right = new THREE.Vector3(1, 0, -1).normalize();
    const forward = new THREE.Vector3(1, 0, 1).normalize();
    cameraTarget.copy(pointerStart.camera)
      .addScaledVector(right, -dx * scale)
      .addScaledVector(forward, -dy * scale);
    cameraTarget.x = THREE.MathUtils.clamp(cameraTarget.x, -7, 7);
    cameraTarget.z = THREE.MathUtils.clamp(cameraTarget.z, -7, 7);
    updateCamera();
  });

  renderer.domElement.addEventListener('pointerup', (event) => {
    if (!pointerStart) return;
    const moved = Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y);
    if (moved < 8) handleTap(event.clientX, event.clientY);
    pointerStart = null;
  });

  ui.upgradePadBtn.addEventListener('click', () => buyUpgrade('pad'));
  ui.hireLoaderBtn.addEventListener('click', () => buyUpgrade('loader'));
  ui.expandYardBtn.addEventListener('click', () => buyUpgrade('yard'));
  ui.resetBtn.addEventListener('click', resetGame);
}

function handleTap(clientX, clientY) {
  const pointer = new THREE.Vector2(
    (clientX / window.innerWidth) * 2 - 1,
    -(clientY / window.innerHeight) * 2 + 1
  );
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(cargoCrates, false)[0];

  if (hit) {
    collectCrate(hit.object);
  } else {
    const world = getGroundPoint(pointer);
    if (world) spawnDust(world.x, world.z, 'tap');
  }
}

function getGroundPoint(pointer) {
  raycaster.setFromCamera(pointer, camera);
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const point = new THREE.Vector3();
  return raycaster.ray.intersectPlane(plane, point) ? point : null;
}

function buyUpgrade(type) {
  const cost = getCost(type);
  if (state.credits < cost) {
    showToast(`Need £${cost - state.credits} more credits`);
    return;
  }

  state.credits -= cost;
  if (type === 'pad') {
    state.padLevel += 1;
    padMesh.scale.setScalar(1 + state.padLevel * 0.05);
    showToast(`Pad upgraded to level ${state.padLevel}`);
  }
  if (type === 'loader') {
    state.loaderLevel += 1;
    showToast(`Loader hired. Crates worth more.`);
  }
  if (type === 'yard') {
    state.yardLevel += 1;
    cameraDistance = Math.max(12, 15 - state.yardLevel * 0.4);
    showToast(`Yard expanded to level ${state.yardLevel}`);
  }
  saveState();
  updateHud();
}

function getCost(type) {
  if (type === 'pad') return 75 + (state.padLevel - 1) * 80;
  if (type === 'loader') return 60 + state.loaderLevel * 75;
  if (type === 'yard') return 120 + (state.yardLevel - 1) * 110;
  return 9999;
}

function spawnHauler() {
  const sprite = makeSprite('hauler');
  sprite.scale.set(2.7, 2.1, 1);

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(1.1, 30),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;

  const group = new THREE.Group();
  group.add(shadow, sprite);
  group.position.set(-13, 0, 5 - Math.random() * 10);
  scene.add(group);

  activeHauler = {
    group,
    sprite,
    shadow,
    from: group.position.clone(),
    to: new THREE.Vector3(PAD_POS.x, 0, PAD_POS.z),
    timer: 0,
    phase: 'inbound'
  };
  ui.statusLine.textContent = 'Hauler inbound...';
}

function updateHauler(dt) {
  if (!activeHauler) {
    state.nextHaulerAt -= dt;
    if (state.nextHaulerAt <= 0) spawnHauler();
    else ui.statusLine.textContent = `Next hauler in ${Math.ceil(state.nextHaulerAt)}s`;
    return;
  }

  const h = activeHauler;
  h.timer += dt;

  if (h.phase === 'inbound') {
    const t = easeOutCubic(Math.min(1, h.timer / 5));
    h.group.position.lerpVectors(h.from, h.to, t);
    h.sprite.position.y = 1.3 + Math.sin(h.timer * 8) * 0.06;
    h.shadow.scale.setScalar(0.8 + t * 0.25);
    spawnTrail(h.group.position.x, h.group.position.z);
    if (t >= 1) {
      h.phase = 'landed';
      h.timer = 0;
      ui.statusLine.textContent = 'Cargo unloading...';
      spawnDust(PAD_POS.x, PAD_POS.z, 'landing');
    }
    return;
  }

  if (h.phase === 'landed') {
    h.sprite.position.y = 1.05 + Math.sin(h.timer * 10) * 0.025;
    if (h.timer > 1.7) {
      dropCargo();
      h.phase = 'outbound';
      h.timer = 0;
      h.from = h.group.position.clone();
      h.to = new THREE.Vector3(13, 0, -4 + Math.random() * 8);
      ui.statusLine.textContent = 'Hauler departing...';
    }
    return;
  }

  if (h.phase === 'outbound') {
    const t = easeInCubic(Math.min(1, h.timer / 4.4));
    h.group.position.lerpVectors(h.from, h.to, t);
    h.sprite.position.y = 1.2 + t * 3;
    h.shadow.material.opacity = Math.max(0, 0.22 * (1 - t));
    spawnTrail(h.group.position.x, h.group.position.z);
    if (t >= 1) {
      scene.remove(h.group);
      activeHauler = null;
      state.deliveredLoads += 1;
      state.nextHaulerAt = Math.max(6, 18 - state.padLevel * 1.4 - state.loaderLevel * 0.7);
      saveState();
    }
  }
}

function dropCargo() {
  const amount = THREE.MathUtils.clamp(2 + state.padLevel, 3, 8);
  for (let i = 0; i < amount; i++) {
    const crate = makeSprite('crate');
    const angle = (i / amount) * Math.PI * 2 + Math.random() * 0.45;
    const r = 1.25 + Math.random() * 1.3;
    crate.position.set(Math.cos(angle) * r, 0.55, Math.sin(angle) * r);
    crate.scale.set(0.85, 0.85, 1);
    crate.userData.kind = 'crate';
    crate.userData.value = 8 + state.padLevel * 3 + state.loaderLevel * 4;
    crate.userData.life = 0;
    cargoCrates.push(crate);
    scene.add(crate);
  }
  showToast(`${amount} cargo crates dropped`);
}

function collectCrate(crate) {
  const value = crate.userData.value || 10;
  state.credits += value;
  state.cargo += 1;
  cargoCrates = cargoCrates.filter((c) => c !== crate);
  scene.remove(crate);
  spawnDust(crate.position.x, crate.position.z, 'collect');
  showToast(`+£${value} cargo collected`);
  saveState();
  updateHud();
}

function updateCrates(dt) {
  for (const crate of cargoCrates) {
    crate.userData.life += dt;
    crate.position.y = 0.52 + Math.sin(crate.userData.life * 4) * 0.04;
    crate.material.opacity = 0.92 + Math.sin(crate.userData.life * 7) * 0.08;
  }
}

function spawnDust(x, z, kind = 'tap') {
  const count = kind === 'landing' ? 18 : kind === 'collect' ? 9 : 4;
  for (let i = 0; i < count; i++) {
    const puff = makeSprite('dust');
    puff.position.set(x + (Math.random() - 0.5) * 0.8, 0.2, z + (Math.random() - 0.5) * 0.8);
    const s = Math.random() * 0.55 + 0.25;
    puff.scale.set(s, s, 1);
    puff.userData.life = 0;
    puff.userData.maxLife = Math.random() * 0.7 + 0.5;
    puff.userData.velocity = new THREE.Vector3((Math.random() - 0.5) * 0.7, Math.random() * 0.2, (Math.random() - 0.5) * 0.7);
    dustPuffs.push(puff);
    scene.add(puff);
  }
}

function spawnTrail(x, z) {
  if (Math.random() > 0.18) return;
  const puff = makeSprite('dust');
  puff.position.set(x + (Math.random() - 0.5) * 0.6, 0.15, z + (Math.random() - 0.5) * 0.6);
  const s = Math.random() * 0.35 + 0.2;
  puff.scale.set(s, s, 1);
  puff.userData.life = 0;
  puff.userData.maxLife = 0.55;
  puff.userData.velocity = new THREE.Vector3((Math.random() - 0.5) * 0.35, 0.08, (Math.random() - 0.5) * 0.35);
  dustPuffs.push(puff);
  scene.add(puff);
}

function updateDust(dt) {
  dustPuffs = dustPuffs.filter((puff) => {
    puff.userData.life += dt;
    const t = puff.userData.life / puff.userData.maxLife;
    puff.position.addScaledVector(puff.userData.velocity, dt);
    puff.scale.multiplyScalar(1 + dt * 0.7);
    puff.material.opacity = Math.max(0, 0.42 * (1 - t));
    if (t >= 1) {
      scene.remove(puff);
      return false;
    }
    return true;
  });
}

function updateCamera() {
  const offset = new THREE.Vector3(0.62, 0.9, 0.62).normalize().multiplyScalar(cameraDistance);
  camera.position.copy(cameraTarget).add(offset);
  camera.lookAt(cameraTarget.x, 0, cameraTarget.z);
}

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const aspect = w / h;
  const size = cameraDistance * 0.72;
  camera.left = -size * aspect;
  camera.right = size * aspect;
  camera.top = size;
  camera.bottom = -size;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  updateCamera();
}

function animate() {
  const dt = Math.min(0.05, clock.getDelta());
  updateHauler(dt);
  updateCrates(dt);
  updateDust(dt);

  padMesh.material.map.offset.x = (padMesh.material.map.offset.x + dt * 0.006) % 1;
  warehouseSprite.position.y = 1.55 + Math.sin(clock.elapsedTime * 1.2) * 0.01;
  officeSprite.position.y = 1.15 + Math.cos(clock.elapsedTime * 1.1) * 0.01;

  if (performance.now() - lastSave > 8000) saveState();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

function updateHud() {
  ui.credits.textContent = Math.floor(state.credits);
  ui.cargo.textContent = state.cargo;
  ui.padLevel.textContent = state.padLevel;
  ui.loaderLevel.textContent = state.loaderLevel;

  const padCost = getCost('pad');
  const loaderCost = getCost('loader');
  const yardCost = getCost('yard');
  ui.upgradePadCost.textContent = `£${padCost}`;
  ui.hireLoaderCost.textContent = `£${loaderCost}`;
  ui.expandYardCost.textContent = `£${yardCost}`;
  ui.upgradePadBtn.disabled = state.credits < padCost;
  ui.hireLoaderBtn.disabled = state.credits < loaderCost;
  ui.expandYardBtn.disabled = state.credits < yardCost;
}

function showToast(message) {
  ui.toast.textContent = message;
  ui.toast.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => { ui.toast.hidden = true; }, 1700);
}

function resetGame() {
  localStorage.removeItem(SAVE_KEY);
  location.reload();
}

function loadState() {
  try {
    return { ...defaultState, ...JSON.parse(localStorage.getItem(SAVE_KEY) || '{}') };
  } catch {
    return { ...defaultState };
  }
}

function saveState() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  lastSave = performance.now();
  updateHud();
}

function makeSprite(kind) {
  const texture = makeSpriteTexture(kind);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  if (kind === 'dust') material.opacity = 0.42;
  const sprite = new THREE.Sprite(material);
  sprite.userData.kind = kind;
  return sprite;
}

function makeCanvas(size = 128) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  return { canvas, ctx };
}

function makeTexture(draw, size = 128) {
  const { canvas, ctx } = makeCanvas(size);
  draw(ctx, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.LinearMipMapLinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function makeSpriteTexture(kind) {
  return makeTexture((ctx, s) => {
    const px = s / 128;
    const rect = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x * px, y * px, w * px, h * px); };
    const line = (x1, y1, x2, y2, c, w = 2) => { ctx.strokeStyle = c; ctx.lineWidth = w * px; ctx.beginPath(); ctx.moveTo(x1 * px, y1 * px); ctx.lineTo(x2 * px, y2 * px); ctx.stroke(); };

    if (kind === 'hauler') {
      ctx.shadowColor = 'rgba(0,0,0,.35)';
      ctx.shadowBlur = 8 * px;
      rect(45, 28, 38, 62, '#c9d2d8');
      rect(50, 18, 28, 15, '#f0f3f5');
      rect(36, 52, 56, 20, '#7f8b95');
      rect(31, 75, 18, 28, '#d77b45');
      rect(79, 75, 18, 28, '#d77b45');
      rect(55, 38, 18, 14, '#203448');
      rect(58, 92, 12, 15, '#ffcb57');
      line(46, 58, 82, 58, '#334555', 3);
      line(45, 72, 83, 72, '#334555', 3);
    }

    if (kind === 'crate') {
      rect(30, 34, 68, 62, '#9a663b');
      rect(35, 28, 58, 14, '#be8150');
      rect(30, 34, 8, 62, '#6e4729');
      rect(90, 34, 8, 62, '#6e4729');
      line(38, 45, 90, 88, '#f3bd45', 5);
      line(90, 45, 38, 88, '#f3bd45', 5);
      line(30, 60, 98, 60, '#5a361f', 3);
    }

    if (kind === 'warehouse') {
      rect(18, 42, 92, 52, '#78818a');
      rect(12, 31, 104, 18, '#454d56');
      rect(24, 50, 36, 44, '#303842');
      rect(68, 56, 30, 38, '#5f6870');
      rect(30, 57, 24, 6, '#f3bd45');
      rect(73, 63, 20, 4, '#28313a');
      line(14, 49, 114, 49, '#c0c8cc', 3);
      line(24, 75, 60, 75, '#1d252d', 3);
    }

    if (kind === 'office') {
      rect(20, 48, 88, 40, '#b86b45');
      rect(20, 39, 88, 11, '#d4d7d4');
      rect(28, 58, 20, 18, '#24394d');
      rect(58, 56, 26, 32, '#363c43');
      rect(88, 58, 12, 18, '#24394d');
      line(22, 88, 106, 88, '#2b2c2c', 4);
      rect(60, 61, 22, 4, '#f3bd45');
    }

    if (kind === 'beacon') {
      rect(58, 34, 12, 60, '#56616b');
      rect(48, 30, 32, 10, '#f3bd45');
      rect(52, 22, 24, 9, '#f07e51');
      line(64, 40, 43, 95, '#3c454c', 4);
      line(64, 40, 85, 95, '#3c454c', 4);
      rect(40, 94, 48, 7, '#30363c');
    }

    if (kind === 'dust') {
      const g = ctx.createRadialGradient(64 * px, 64 * px, 3 * px, 64 * px, 64 * px, 48 * px);
      g.addColorStop(0, 'rgba(210,181,122,.45)');
      g.addColorStop(0.55, 'rgba(181,139,84,.22)');
      g.addColorStop(1, 'rgba(181,139,84,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(64 * px, 64 * px, 48 * px, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

function makePadTexture() {
  return makeTexture((ctx, s) => {
    ctx.fillStyle = 'rgba(0,0,0,0)';
    ctx.clearRect(0, 0, s, s);
    ctx.fillStyle = '#35393d';
    rounded(ctx, 12, 12, s - 24, s - 24, 18);
    ctx.fill();
    ctx.strokeStyle = '#f3bd45';
    ctx.lineWidth = 10;
    rounded(ctx, 26, 26, s - 52, s - 52, 10);
    ctx.stroke();
    ctx.strokeStyle = '#dfe6df';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(s / 2, 44); ctx.lineTo(s / 2, s - 44);
    ctx.moveTo(44, s / 2); ctx.lineTo(s - 44, s / 2);
    ctx.stroke();
    ctx.fillStyle = '#202428';
    ctx.fillRect(s * 0.38, s * 0.38, s * 0.24, s * 0.24);
    ctx.strokeStyle = '#f3bd45';
    ctx.lineWidth = 5;
    for (let i = 0; i < 8; i++) {
      const x = 38 + i * 56;
      ctx.beginPath();
      ctx.moveTo(x, 20); ctx.lineTo(x + 26, 20);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, s - 20); ctx.lineTo(x + 26, s - 20);
      ctx.stroke();
    }
  }, 512);
}

function makeDesertTexture() {
  return makeTexture((ctx, s) => {
    ctx.fillStyle = '#b88d56';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 90; i++) {
      ctx.fillStyle = i % 2 ? 'rgba(86,60,34,.12)' : 'rgba(255,232,171,.12)';
      ctx.fillRect(Math.random() * s, Math.random() * s, Math.random() * 18 + 2, 1);
    }
  }, 256);
}

function makeYardTexture() {
  return makeTexture((ctx, s) => {
    ctx.fillStyle = '#77644a';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 70; i++) {
      ctx.fillStyle = 'rgba(40,34,27,.18)';
      ctx.fillRect(Math.random() * s, Math.random() * s, Math.random() * 28 + 4, 2);
    }
    ctx.strokeStyle = 'rgba(255,255,255,.08)';
    ctx.lineWidth = 1;
    for (let i = 0; i < s; i += 32) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(s, i); ctx.stroke();
    }
  }, 512);
}

function rounded(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
function easeInCubic(t) { return t * t * t; }
