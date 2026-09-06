import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

const canvas = document.getElementById('game');
const hpEl = document.getElementById('hp');
const stEl = document.getElementById('stamina');
const enemyHudEl = document.getElementById('enemyHud');
const enemyHpEl = document.getElementById('enemyHp');
const messageEl = document.getElementById('message');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111318);
scene.fog = new THREE.Fog(0x111318, 18, 55);

const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 120);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.shadowMap.enabled = true;
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

scene.add(new THREE.HemisphereLight(0xddeeff, 0x26231d, 2.2));
const sun = new THREE.DirectionalLight(0xffffff, 2.7);
sun.position.set(6, 12, 4);
sun.castShadow = true;
scene.add(sun);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(70, 70),
  new THREE.MeshStandardMaterial({ color: 0x2a2d31, roughness: 0.95 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

for (const [x,z,s] of [[-6,-4,2],[7,-7,2.5],[-8,8,3],[9,6,2],[-1,10,1.6]]) {
  const rock = new THREE.Mesh(
    new THREE.DodecahedronGeometry(s, 0),
    new THREE.MeshStandardMaterial({ color: 0x3d4147, roughness: 1 })
  );
  rock.position.set(x, s * 0.55, z);
  rock.scale.y = 0.7;
  rock.castShadow = rock.receiveShadow = true;
  scene.add(rock);
}

function makeFighter(color) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.55, 1.2, 5, 10),
    new THREE.MeshStandardMaterial({ color, roughness: 0.7 })
  );
  body.position.y = 1.15;
  body.castShadow = true;
  group.add(body);

  const weapon = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.12, 1.5),
    new THREE.MeshStandardMaterial({ color: 0xc5c8ce, metalness: 0.6, roughness: 0.3 })
  );
  weapon.position.set(0.65, 1.1, -0.55);
  weapon.rotation.x = -0.4;
  weapon.castShadow = true;
  group.add(weapon);
  return group;
}

const playerMesh = makeFighter(0x4a78d8);
const enemyMesh = makeFighter(0xb54747);
scene.add(playerMesh, enemyMesh);

const state = {
  started: false,
  gameOver: false,
  victory: false,
  locked: true,
  player: { hp: 100, maxHp: 100, stamina: 100, maxStamina: 100, speed: 4.3, invuln: 0, attackCd: 0, dodgeTime: 0, facing: new THREE.Vector3(0,0,-1) },
  enemy: { hp: 180, maxHp: 180, attackCd: 0, stun: 0, speed: 2.1 }
};

const keys = new Set();
let last = performance.now();
let yaw = Math.PI;
let pitch = -0.28;
let dragging = false;

function resetGame() {
  state.gameOver = false;
  state.victory = false;
  state.player.hp = 100;
  state.player.stamina = 100;
  state.player.invuln = 0;
  state.player.attackCd = 0;
  state.player.dodgeTime = 0;
  state.enemy.hp = 180;
  state.enemy.attackCd = 0;
  state.enemy.stun = 0;
  playerMesh.position.set(0, 0, 7);
  enemyMesh.position.set(0, 0, -2);
  messageEl.textContent = state.started ? '敵を倒せ' : 'クリックで開始';
  updateHud();
}

function updateHud() {
  hpEl.style.width = `${Math.max(0, state.player.hp / state.player.maxHp * 100)}%`;
  stEl.style.width = `${Math.max(0, state.player.stamina / state.player.maxStamina * 100)}%`;
  enemyHpEl.style.width = `${Math.max(0, state.enemy.hp / state.enemy.maxHp * 100)}%`;
  enemyHudEl.style.display = state.started ? 'block' : 'none';
}

function flatDirectionFromCamera() {
  const f = new THREE.Vector3();
  camera.getWorldDirection(f);
  f.y = 0;
  if (f.lengthSq() < 0.001) f.set(0,0,-1);
  return f.normalize();
}

function doAttack() {
  const p = state.player;
  if (!state.started || state.gameOver || p.attackCd > 0 || p.dodgeTime > 0 || p.stamina < 22) return;
  p.stamina -= 22;
  p.attackCd = 0.48;

  const toEnemy = enemyMesh.position.clone().sub(playerMesh.position);
  const dist = toEnemy.length();
  toEnemy.y = 0;
  if (dist < 2.35 && p.facing.dot(toEnemy.normalize()) > 0.15 && state.enemy.stun <= 0) {
    state.enemy.hp -= 34;
    state.enemy.stun = 0.22;
    enemyMesh.position.add(toEnemy.multiplyScalar(0.35));
    if (state.enemy.hp <= 0) {
      state.enemy.hp = 0;
      state.gameOver = true;
      state.victory = true;
      messageEl.textContent = 'VICTORY - Rで再戦';
    }
  }
  updateHud();
}

function doDodge() {
  const p = state.player;
  if (!state.started || state.gameOver || p.dodgeTime > 0 || p.attackCd > 0 || p.stamina < 30) return;
  p.stamina -= 30;
  p.dodgeTime = 0.38;
  p.invuln = 0.34;
  updateHud();
}

function damagePlayer(amount) {
  const p = state.player;
  if (p.invuln > 0 || state.gameOver) return;
  p.hp -= amount;
  p.invuln = 0.65;
  if (p.hp <= 0) {
    p.hp = 0;
    state.gameOver = true;
    messageEl.textContent = 'YOU DIED - Rで再戦';
  }
  updateHud();
}

function updatePlayer(dt) {
  const p = state.player;
  p.invuln = Math.max(0, p.invuln - dt);
  p.attackCd = Math.max(0, p.attackCd - dt);
  p.dodgeTime = Math.max(0, p.dodgeTime - dt);

  if (!state.gameOver) p.stamina = Math.min(p.maxStamina, p.stamina + 24 * dt);

  const forward = flatDirectionFromCamera();
  const right = new THREE.Vector3(forward.z, 0, -forward.x);
  const move = new THREE.Vector3();
  if (keys.has('KeyW')) move.add(forward);
  if (keys.has('KeyS')) move.sub(forward);
  if (keys.has('KeyD')) move.add(right);
  if (keys.has('KeyA')) move.sub(right);

  const sprinting = keys.has('ShiftLeft') || keys.has('ShiftRight');
  if (move.lengthSq() > 0 && !state.gameOver) {
    move.normalize();
    if (state.locked) {
      p.facing.copy(enemyMesh.position).sub(playerMesh.position).setY(0).normalize();
    } else {
      p.facing.copy(move);
    }
    const dodgeBoost = p.dodgeTime > 0 ? 2.4 : 1;
    const sprintBoost = sprinting && p.stamina > 0 && p.dodgeTime <= 0 ? 1.55 : 1;
    if (sprintBoost > 1) p.stamina = Math.max(0, p.stamina - 20 * dt);
    playerMesh.position.addScaledVector(move, p.speed * dodgeBoost * sprintBoost * dt);
  } else if (state.locked && !state.gameOver) {
    p.facing.copy(enemyMesh.position).sub(playerMesh.position).setY(0).normalize();
  }

  if (p.facing.lengthSq() > 0.1) playerMesh.rotation.y = Math.atan2(p.facing.x, p.facing.z);
  playerMesh.position.x = THREE.MathUtils.clamp(playerMesh.position.x, -27, 27);
  playerMesh.position.z = THREE.MathUtils.clamp(playerMesh.position.z, -27, 27);
  updateHud();
}

function updateEnemy(dt) {
  if (state.gameOver) return;
  const e = state.enemy;
  e.attackCd = Math.max(0, e.attackCd - dt);
  e.stun = Math.max(0, e.stun - dt);
  if (e.stun > 0) return;

  const toPlayer = playerMesh.position.clone().sub(enemyMesh.position);
  const dist = toPlayer.length();
  toPlayer.y = 0;
  if (toPlayer.lengthSq() > 0.01) {
    toPlayer.normalize();
    enemyMesh.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);
  }

  if (dist > 2.05) {
    enemyMesh.position.addScaledVector(toPlayer, e.speed * dt);
  } else if (e.attackCd <= 0) {
    e.attackCd = 1.2;
    damagePlayer(24);
  }
}

function updateCamera(dt) {
  let focus = playerMesh.position.clone().add(new THREE.Vector3(0, 1.25, 0));
  if (state.locked && !state.gameOver) {
    const midpoint = playerMesh.position.clone().lerp(enemyMesh.position, 0.28);
    focus = midpoint.add(new THREE.Vector3(0, 1.2, 0));
    const dir = playerMesh.position.clone().sub(enemyMesh.position).setY(0).normalize();
    const desired = playerMesh.position.clone().addScaledVector(dir, 6.4).add(new THREE.Vector3(0, 4.2, 0));
    camera.position.lerp(desired, 1 - Math.pow(0.001, dt));
  } else {
    const radius = 7;
    const cp = Math.cos(pitch);
    const desired = new THREE.Vector3(
      playerMesh.position.x + Math.sin(yaw) * cp * radius,
      playerMesh.position.y + 2.4 + Math.sin(-pitch) * radius,
      playerMesh.position.z + Math.cos(yaw) * cp * radius
    );
    camera.position.lerp(desired, 1 - Math.pow(0.001, dt));
  }
  camera.lookAt(focus);
}

function animateAttackVisual(now) {
  const t = state.player.attackCd;
  if (t > 0.18) playerMesh.rotation.z = -0.22;
  else playerMesh.rotation.z *= 0.82;
  if (state.player.invuln > 0 && Math.floor(now * 20) % 2 === 0) playerMesh.visible = false;
  else playerMesh.visible = true;
}

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

function frame(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  if (state.started) {
    updatePlayer(dt);
    updateEnemy(dt);
    updateCamera(dt);
    animateAttackVisual(now / 1000);
  } else {
    updateCamera(dt);
  }
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

window.addEventListener('resize', resize);
window.addEventListener('keydown', e => {
  keys.add(e.code);
  if (e.code === 'Space') { e.preventDefault(); doDodge(); }
  if (e.code === 'KeyQ') state.locked = !state.locked;
  if (e.code === 'KeyR') resetGame();
});
window.addEventListener('keyup', e => keys.delete(e.code));
window.addEventListener('mousedown', e => {
  if (!state.started) {
    state.started = true;
    messageEl.textContent = '敵を倒せ';
    canvas.requestPointerLock?.();
    updateHud();
    return;
  }
  if (e.button === 0) doAttack();
  if (e.button === 2) dragging = true;
});
window.addEventListener('mouseup', () => dragging = false);
window.addEventListener('contextmenu', e => e.preventDefault());
window.addEventListener('mousemove', e => {
  if (document.pointerLockElement === canvas || dragging) {
    if (!state.locked) {
      yaw -= e.movementX * 0.003;
      pitch = THREE.MathUtils.clamp(pitch - e.movementY * 0.0025, -0.75, 0.25);
    }
  }
});
window.addEventListener('blur', () => keys.clear());

resize();
resetGame();
requestAnimationFrame(frame);
