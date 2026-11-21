// Dustline's state and city: the grid of roads and blocks, the buildings, palms and
// lamps inside each block, the player on foot, pickups and particles. No drawing and
// no sound here — step() advances the player and the ambient world one fixed step
// and returns what happened as bit flags, so the caller can react.
import { CAR, MISSIONS, PALETTE, PLAYER, STEP, WORLD, clamp, dist, nearestRoadCoord, onRoad, roadCenters } from './config.js';
import { pick, range, rangeInt } from './random.js';

export const EVENT_PICKUP = 1;
export const EVENT_HURT = 2;
export const EVENT_BUSTED = 4;
export const EVENT_DEAD = 8;
export const EVENT_MISSION = 16;

const BLOCK_NAMES = ['Dustline Motors', 'Rooftop Motel', 'Cactus Jack Diner', 'Old Mill', 'Neon Row', 'Sunset Mall', 'Palm Court', 'The Foundry', 'Mirage Hotel', 'Coyote Gas', 'Lucky 7 Casino', 'Desert Clinic'];

function buildCity(random) {
  const buildings = [];
  const palms = [];
  const lamps = [];
  const centers = roadCenters();
  let nameIndex = 0;
  for (let bx = 0; bx < WORLD.roads - 1; bx += 1) {
    for (let by = 0; by < WORLD.roads - 1; by += 1) {
      const x0 = centers[bx] + WORLD.roadWidth / 2 + 14;
      const y0 = centers[by] + WORLD.roadWidth / 2 + 14;
      const block = WORLD.roadSpacing - WORLD.roadWidth - 28;
      const downtown = bx >= 2 && bx <= 4 && by >= 2 && by <= 4;
      // One or two buildings per block, with a yard, a palm or two and a lamp.
      const count = random() < 0.45 ? 2 : 1;
      for (let k = 0; k < count; k += 1) {
        const w = count === 1 ? block * (0.55 + random() * 0.3) : block * 0.42;
        const h = count === 1 ? block * (0.5 + random() * 0.3) : block * 0.42;
        const x = x0 + (count === 1 ? (block - w) / 2 : (k === 0 ? 6 : block - w - 6));
        const y = y0 + (count === 1 ? (block - h) / 2 : (k === 0 ? 6 : block - h - 6));
        const ci = Math.floor(random() * PALETTE.building.length);
        buildings.push({
          x, y, w, h, color: PALETTE.building[ci], roof: PALETTE.roof[ci],
          neon: downtown && random() < 0.6 ? pick(random, PALETTE.neon) : null,
          name: nameIndex < BLOCK_NAMES.length ? BLOCK_NAMES[nameIndex] : null,
          tall: downtown && random() < 0.5,
        });
        if (buildings[buildings.length - 1].name) nameIndex += 1;
      }
      if (random() < 0.7) palms.push({ x: x0 + 20 + random() * (block - 40), y: y0 + 20 + random() * (block - 40) });
      if (random() < 0.5) palms.push({ x: x0 + 20 + random() * (block - 40), y: y0 + 20 + random() * (block - 40) });
      lamps.push({ x: centers[bx] + WORLD.roadWidth / 2 + 4, y: centers[by] + 8 });
      lamps.push({ x: centers[bx] + 8, y: centers[by] + WORLD.roadWidth / 2 + 4 });
    }
  }
  return { buildings, palms, lamps };
}

export function createWorld(random) {
  const city = buildCity(random);
  const player = {
    x: 1200, y: 1200, angle: -Math.PI / 2, health: PLAYER.health, money: 250,
    speed: 0, onFoot: true, car: null, wanted: 0, heat: 0, seen: 0, hidden: 0,
    pistol: true, ammo: PLAYER.ammoMax, punchCd: 0, shootCd: 0, hurtCd: 0,
    lastHurt: -99, dead: false, moving: false,
  };
  const state = {
    time: 0, dayTime: 0.68, // golden late afternoon
    player, city,
    cars: [], peds: [], bullets: [], enemies: [], pickups: [], particles: [],
    mission: { index: 0, stage: 'brief', target: null, timer: 0, collected: 0, text: '' },
    camera: { x: player.x, y: player.y },
    stats: { earned: 0, carsStolen: 0, busted: 0, shotsFired: 0, missionsDone: 0 },
    message: { text: '', t: 0 },
    toast: '',
    trafficLight: 0,
    spawnTimer: 0,
  };

  function say(text) { state.message = { text, t: 3.2 }; }
  function burst(x, y, color, n, speed) {
    for (let i = 0; i < n; i += 1) {
      const a = random() * Math.PI * 2;
      const s = speed * (0.4 + random() * 0.8);
      state.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5 + random() * 0.5, max: 1, color, size: 2 + random() * 3 });
    }
  }
  function buildingAt(x, y, pad) {
    for (const b of city.buildings) {
      if (x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad) return b;
    }
    return null;
  }
  function collideBuildings(entity, radius) {
    const b = buildingAt(entity.x, entity.y, radius);
    if (!b) return;
    const left = entity.x - (b.x - radius);
    const right = (b.x + b.w + radius) - entity.x;
    const top = entity.y - (b.y - radius);
    const bottom = (b.y + b.h + radius) - entity.y;
    const m = Math.min(left, right, top, bottom);
    if (m === left) entity.x = b.x - radius;
    else if (m === right) entity.x = b.x + b.w + radius;
    else if (m === top) entity.y = b.y - radius;
    else entity.y = b.y + b.h + radius;
  }

  function reset() {
    player.x = 1200; player.y = 1200; player.angle = -Math.PI / 2;
    player.health = PLAYER.health; player.money = 250; player.onFoot = true; player.car = null;
    player.wanted = 0; player.heat = 0; player.seen = 0; player.hidden = 0;
    player.ammo = PLAYER.ammoMax; player.punchCd = 0; player.shootCd = 0; player.dead = false;
    state.time = 0; state.dayTime = 0.68;
    state.cars.length = 0; state.peds.length = 0; state.bullets.length = 0;
    state.enemies.length = 0; state.pickups.length = 0; state.particles.length = 0;
    state.mission = { index: 0, stage: 'brief', target: null, timer: 0, collected: 0, text: '' };
    state.stats = { earned: 0, carsStolen: 0, busted: 0, shotsFired: 0, missionsDone: 0 };
    state.message = { text: '', t: 0 };
    state.camera.x = player.x; state.camera.y = player.y;
  }

  // Move the player on foot: WASD, Shift to run, blocked by buildings and the map edge.
  function stepPlayer(dt, input) {
    if (!player.onFoot || player.dead) return;
    const mx = input.moveX();
    const my = input.moveY();
    const len = Math.hypot(mx, my);
    player.moving = len > 0;
    if (len > 0) {
      const speed = input.running() ? PLAYER.runSpeed : PLAYER.walkSpeed;
      player.angle = Math.atan2(my, mx);
      player.x += (mx / len) * speed * dt;
      player.y += (my / len) * speed * dt;
      player.speed = speed;
    } else player.speed = 0;
    player.x = clamp(player.x, 40, WORLD.size - 40);
    player.y = clamp(player.y, 40, WORLD.size - 40);
    collideBuildings(player, PLAYER.radius);
    if (player.punchCd > 0) player.punchCd -= dt;
    if (player.shootCd > 0) player.shootCd -= dt;
    if (player.hurtCd > 0) player.hurtCd -= dt;
    if (state.time - player.lastHurt > PLAYER.regenDelay && player.health < PLAYER.health) {
      player.health = Math.min(PLAYER.health, player.health + PLAYER.regenRate * dt);
    }
  }

  function hurtPlayer(amount, source) {
    if (player.hurtCd > 0 || player.dead) return 0;
    player.health -= amount;
    player.lastHurt = state.time;
    player.hurtCd = 0.35;
    burst(player.x, player.y, '#e5534b', 8, 120);
    if (player.health <= 0) {
      player.health = 0;
      player.dead = true;
      return EVENT_DEAD;
    }
    return EVENT_HURT;
  }

  function stepPickups(dt) {
    for (const p of state.pickups) {
      if (p.taken) continue;
      if (dist(player.x, player.y, p.x, p.y) < 34) {
        p.taken = true;
        if (p.kind === 'cash') { player.money += p.value; state.stats.earned += p.value; say(`+$${p.value}`); }
        else if (p.kind === 'health') { player.health = Math.min(PLAYER.health, player.health + 50); say('Health +50'); }
        else if (p.kind === 'ammo') { player.ammo = Math.min(PLAYER.ammoMax, player.ammo + 18); say('Ammo +18'); }
        else if (p.kind === 'stash') { state.mission.collected += 1; say(`Stash ${state.mission.collected}/3 secured`); }
        burst(p.x, p.y, '#f2c94c', 10, 140);
        return EVENT_PICKUP;
      }
    }
    return 0;
  }

  function stepParticles(dt) {
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const p = state.particles[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.96; p.vy *= 0.96; p.life -= dt;
      if (p.life <= 0) state.particles.splice(i, 1);
    }
    for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
      const b = state.bullets[i];
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (b.life <= 0 || b.x < 0 || b.y < 0 || b.x > WORLD.size || b.y > WORLD.size) state.bullets.splice(i, 1);
    }
    if (state.message.t > 0) state.message.t -= dt;
  }

  function stepCamera(dt) {
    const tx = player.onFoot || !player.car ? player.x : player.car.x;
    const ty = player.onFoot || !player.car ? player.y : player.car.y;
    const k = 1 - Math.pow(0.001, dt);
    state.camera.x += (tx - state.camera.x) * k;
    state.camera.y += (ty - state.camera.y) * k;
  }

  function step(dt, input) {
    let events = 0;
    state.time += dt;
    state.trafficLight += dt;
    state.dayTime = 0.68 + state.time * 0.00012;
    stepPlayer(dt, input);
    events |= stepPickups(dt);
    stepParticles(dt);
    stepCamera(dt);
    return events;
  }

  reset();
  return {
    state, reset, step, stepPlayer, hurtPlayer, say, burst, buildingAt,
    collideBuildings, onRoad, nearestRoadCoord,
    playerStart: { x: 1200, y: 1200 },
  };
}
