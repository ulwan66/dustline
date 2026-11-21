// Traffic AI: civilian cars that cruise the road grid in lanes, stop at red lights,
// slow for the car ahead, and wrap around the map edge. Each car owns one road and
// one direction, so the flow reads like a real city from above.
import { CAR, PALETTE, WORLD, clamp, dist, roadCenters } from './config.js';
import { pick, range, rangeInt } from './random.js';

const KINDS = [
  { kind: 'sedan', w: 52, h: 25, max: 300 },
  { kind: 'sedan', w: 52, h: 25, max: 320 },
  { kind: 'taxi', w: 52, h: 25, max: 340 },
  { kind: 'truck', w: 64, h: 28, max: 230 },
  { kind: 'sport', w: 54, h: 24, max: 420 },
];

export function spawnTrafficCar(state, random, near) {
  const centers = roadCenters();
  const axis = random() < 0.5 ? 'x' : 'y';
  const road = pick(random, centers);
  const dir = random() < 0.5 ? 1 : -1;
  const lane = (random() < 0.5 ? -1 : 1) * 22;
  let x; let y;
  if (axis === 'x') { x = range(random, 100, WORLD.size - 100); y = road + lane; }
  else { x = road + lane; y = range(random, 100, WORLD.size - 100); }
  if (near && dist(x, y, near.x, near.y) < 500) return null;
  const spec = pick(random, KINDS);
  const car = {
    id: state.cars.length + Math.floor(random() * 100000), x, y,
    angle: axis === 'x' ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2),
    speed: spec.max * 0.7, maxSpeed: spec.max, w: spec.w, h: spec.h,
    color: spec.kind === 'taxi' ? '#facc15' : pick(random, PALETTE.traffic),
    kind: spec.kind, driver: 'traffic', axis, dir, road, lane,
    brakeLight: false, honk: 0,
  };
  state.cars.push(car);
  return car;
}

function lightIsRed(state, axis, coord) {
  // Lights flip every 7 seconds; north-south and east-west take turns.
  const phase = Math.floor(state.trafficLight / 7) % 2;
  return (axis === 'x' ? phase === 0 : phase === 1);
}

function carAhead(state, car) {
  let best = null;
  let bestD = 130;
  for (const other of state.cars) {
    if (other === car || other.driver === 'player') continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const forward = Math.cos(car.angle) * dx + Math.sin(car.angle) * dy;
    const side = Math.abs(-Math.sin(car.angle) * dx + Math.cos(car.angle) * dy);
    if (forward > 0 && forward < bestD && side < 30) { best = other; bestD = forward; }
  }
  return best;
}

export function updateTraffic(state, dt, random) {
  // Keep the streets full: top up to 24 civilian cars, cull the far ones.
  let civ = 0;
  for (const c of state.cars) if (c.driver === 'traffic') civ += 1;
  if (civ < 24 && state.time - (updateTraffic.last || 0) > 0.8) {
    updateTraffic.last = state.time;
    spawnTrafficCar(state, random, state.player);
  }
  const p = state.player;
  for (let i = state.cars.length - 1; i >= 0; i -= 1) {
    const car = state.cars[i];
    if (car.driver !== 'traffic') continue;
    // Cull cars a long way from the player so the pool stays near the action.
    if (dist(car.x, car.y, p.x, p.y) > 2600) { state.cars.splice(i, 1); continue; }
    let target = car.maxSpeed;
    // Red light: stop before the next intersection.
    const ahead = carAhead(state, car);
    if (ahead) target = Math.min(target, 0);
    const centers = roadCenters();
    let nextCross = Infinity;
    for (const c of centers) {
      const along = car.axis === 'x' ? (c - car.x) * car.dir : (c - car.y) * car.dir;
      if (along > 20 && along < nextCross) nextCross = along;
    }
    if (nextCross < 90 && lightIsRed(state, car.axis, 0)) target = 0;
    car.speed += clamp(target - car.speed, -500 * dt, 240 * dt);
    if (car.speed < 4) car.speed = 0;
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    // Wrap around the map edge and re-enter on the same road.
    if (car.x < -80) car.x = WORLD.size + 70;
    if (car.x > WORLD.size + 80) car.x = -70;
    if (car.y < -80) car.y = WORLD.size + 70;
    if (car.y > WORLD.size + 80) car.y = -70;
    // A scared driver swerves a little when the player barrels past.
    if (p.car && dist(car.x, car.y, p.car.x, p.car.y) < 70 && Math.abs(car.speed) > 60) {
      car.speed *= 0.985;
    }
  }
}

// A parked car the player can steal: placed on a road shoulder near a point.
export function spawnParkedCar(state, random, x, y, kind) {
  const spec = KINDS.find((k) => k.kind === kind) || KINDS[0];
  const car = {
    id: state.cars.length + Math.floor(random() * 100000), x, y,
    angle: random() < 0.5 ? 0 : Math.PI / 2,
    speed: 0, maxSpeed: kind === 'sport' ? CAR.sportMax : kind === 'truck' ? CAR.truckMax : CAR.maxSpeed,
    w: spec.w, h: spec.h, color: kind === 'sport' ? '#e11d48' : pick(random, PALETTE.traffic),
    kind, driver: 'parked', axis: 'x', dir: 1, road: y, lane: 0, brakeLight: false, honk: 0,
  };
  state.cars.push(car);
  return car;
}
