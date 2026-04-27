import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Sky } from 'three/addons/objects/Sky.js';

/*
  Unity-style starter environment for GitHub Pages + iPhone.

  Scene scale:
  - 1 Three.js unit = 1 Unity-style metre.
  - Main grid is 100m x 100m.
  - Grid divisions are 1m each.
*/

const GRID_SIZE = 100;
const GRID_DIVISIONS = 100;

const app = document.querySelector('#app');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xbfd7ff);

// Camera: similar to opening a clean Unity scene and orbiting around the origin.
const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(18, 14, 18);

// Renderer
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
// iPhone gestures:
// - 1 finger = orbit
// - pinch = zoom
// - 2 fingers = pan
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.screenSpacePanning = false;
controls.minDistance = 4;
controls.maxDistance = 160;
controls.maxPolarAngle = Math.PI * 0.48;
controls.update();

// Unity-like grid
const grid = new THREE.GridHelper(GRID_SIZE, GRID_DIVISIONS, 0x444444, 0x888888);
grid.position.y = 0.01;
scene.add(grid);

// Slight ground plane below the grid so it feels like Unity's default workspace.
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

// World axes marker: red X, green Y, blue Z, like most game/editor spaces.
const axes = new THREE.AxesHelper(5);
axes.position.y = 0.03;
scene.add(axes);

// Default sky using Three.js Sky shader.
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

// Lighting
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

// A simple cube at origin, like Unity's starter test object.
// Delete this later when you start placing your own level pieces.
const starterCube = new THREE.Mesh(
  new THREE.BoxGeometry(2, 2, 2),
  new THREE.MeshStandardMaterial({
    color: 0xd9d9d9,
    roughness: 0.65
  })
);
starterCube.position.set(0, 1, 0);
starterCube.castShadow = true;
starterCube.receiveShadow = true;
scene.add(starterCube);

// Soft origin marker ring
const originRing = new THREE.Mesh(
  new THREE.RingGeometry(2.4, 2.5, 96),
  new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.42,
    side: THREE.DoubleSide
  })
);
originRing.rotation.x = -Math.PI / 2;
originRing.position.y = 0.025;
scene.add(originRing);

// UI buttons
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

// Animation loop
function animate() {
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

animate();
