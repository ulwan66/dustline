// Pedestrians: people walking the sidewalks, crossing at corners, fleeing from
// gunfire, sirens and speeding cars. They give the city life and give stealing a
// car in front of a crowd a cost.
import { WORLD, clamp, dist, roadCenters } from './config.js';
import { pick, range, rangeInt } from './random.js';

const SHIRTS = ['#e5534b', '#4fc3f7', '#f2c94c', '#7dd069', '#c084fc', '#f8fafc', '#fb923c', '#2dd4bf'];
const SKINS = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];

export function spawnPedestrian(state, random, near) {
  const centers = roadCenters();
  const road = pick(random, centers);
  const along = range(random, 100, WORLD.size - 100);
  const side = (random() < 0.5 ? -1 : 1) * (WORLD.roadWidth / 2 + 14);
  const onVertical = random() < 0.5;
  const x = onVertical ? road + side : along;
  const y = onVertical ? along : road + side;
  if (near && dist(x, y, near.x, near.y) < 320) return null;
  const ped = {
    x, y, angle: range(random, 0, Math.PI * 2), speed: range(random, 42, 78),
    shirt: pick(random, SHIRTS), skin: pick(random, SKINS),
    state: 'walk', targetX: x, targetY: y, wait: range(random, 0, 4),
    flee: 0, bob: random() * Math.PI * 2,
  };
  state.peds.push(ped);
  return ped;
}

function pickTarget(ped, random) {
  // Walk along the sidewalk to the next corner, then turn.
  const centers = roadCenters();
  const c = centers[Math.floor(random() * centers.length)];
  if (random() < 0.5) { ped.targetX = c; ped.targetY = ped.y + (random() < 0.5 ? -1 : 1) * range(random, 200, 700); }
  else { ped.targetY = c; ped.targetX = ped.x + (random() < 0.5 ? -1 : 1) * range(random, 200, 700); }
  ped.targetX = clamp(ped.targetX, 60, WORLD.size - 60);
  ped.targetY = clamp(ped.targetY, 60, WORLD.size - 60);
}

export function updatePedestrians(state, dt, random) {
  const p = state.player;
  let count = state.peds.length;
  if (count < 34 && state.time - (updatePedestrians.last || 0) > 0.5) {
    updatePedestrians.last = state.time;
    spawnPedestrian(state, random, p);
  }
  for (let i = state.peds.length - 1; i >= 0; i -= 1) {
    const ped = state.peds[i];
    if (dist(ped.x, ped.y, p.x, p.y) > 2200) { state.peds.splice(i, 1); continue; }
    // Flee: gunfire nearby, a cop chase passing, or a car about to hit them.
    let danger = null;
    if (state.bullets.length > 0) {
      for (const b of state.bullets) if (dist(b.x, b.y, ped.x, ped.y) < 260) { danger = b; break; }
    }
    if (!danger && p.wanted > 0) {
      for (const car of state.cars) {
        if (car.driver === 'cop' && dist(car.x, car.y, ped.x, ped.y) < 220) { danger = car; break; }
      }
    }
    if (!danger && p.car) {
      const car = p.car;
      if (dist(car.x, car.y, ped.x, ped.y) < 90 && Math.abs(car.speed) > 200) danger = car;
    }
    if (danger) { ped.state = 'flee'; ped.flee = 1.6; }
    if (ped.flee > 0) {
      ped.flee -= dt;
      const away = Math.atan2(ped.y - (danger ? danger.y : p.y), ped.x - (danger ? danger.x : p.x));
      ped.angle = away;
      ped.x += Math.cos(away) * 190 * dt;
      ped.y += Math.sin(away) * 190 * dt;
      if (ped.flee <= 0) ped.state = 'walk';
    } else {
      if (ped.wait > 0) { ped.wait -= dt; }
      else {
        const d = dist(ped.x, ped.y, ped.targetX, ped.targetY);
        if (d < 12) { pickTarget(ped, random); ped.wait = range(random, 0, 2.5); }
        else {
          ped.angle = Math.atan2(ped.targetY - ped.y, ped.targetX - ped.x);
          ped.x += Math.cos(ped.angle) * ped.speed * dt;
          ped.y += Math.sin(ped.angle) * ped.speed * dt;
        }
      }
    }
    ped.bob += dt * 9;
    ped.x = clamp(ped.x, 30, WORLD.size - 30);
    ped.y = clamp(ped.y, 30, WORLD.size - 30);
  }
}
