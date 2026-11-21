// Police: the wanted system. Stars rise when crimes are seen, fall when the player
// stays out of sight. Patrol cars spawn at the map edge, chase, ram, and at four
// stars set roadblocks; on foot and cornered, the player gets busted.
import { COP, WANTED, WORLD, angleDiff, clamp, dist } from './config.js';
import { roadAngle } from './vehicles.js';
import { range } from './random.js';

export function addWanted(state, amount) {
  const p = state.player;
  p.wanted = clamp(p.wanted + amount, 0, WANTED.max);
  p.heat = 0;
  p.hidden = 0;
}

function spawnCop(state, random) {
  const p = state.player;
  const edge = Math.floor(random() * 4);
  let x; let y;
  if (edge === 0) { x = p.x - 900; y = p.y + range(random, -500, 500); }
  else if (edge === 1) { x = p.x + 900; y = p.y + range(random, -500, 500); }
  else if (edge === 2) { x = p.x + range(random, -500, 500); y = p.y - 900; }
  else { x = p.x + range(random, -500, 500); y = p.y + 900; }
  x = clamp(x, 60, WORLD.size - 60);
  y = clamp(y, 60, WORLD.size - 60);
  const car = {
    id: state.cars.length + Math.floor(random() * 100000), x, y,
    angle: Math.atan2(p.y - y, p.x - x), speed: 0, maxSpeed: COP.maxSpeed,
    w: 54, h: 26, color: '#1f2937', kind: 'cop', driver: 'cop',
    axis: 'x', dir: 1, road: y, lane: 0, brakeLight: false, honk: 0,
    siren: random() * Math.PI * 2, roadblock: false,
  };
  state.cars.push(car);
  return car;
}

function copSeesPlayer(state, car) {
  const p = state.player;
  return dist(car.x, car.y, p.x, p.y) < 620;
}

export function updatePolice(state, dt, random, world) {
  const p = state.player;
  // Wanted decay: hidden from every cop for a while, stars tick down.
  let anySees = false;
  for (const car of state.cars) if (car.driver === 'cop' && copSeesPlayer(state, car)) anySees = true;
  if (p.wanted > 0) {
    if (anySees) { p.seen += dt; p.hidden = 0; }
    else {
      p.hidden += dt;
      if (p.hidden > WANTED.decayHidden) { p.wanted -= 1; p.hidden = 0; p.heat = 0; }
    }
  }
  // Target number of patrol cars: one per star, plus one more at 4+ stars.
  const want = p.wanted > 0 ? p.wanted + (p.wanted >= 4 ? 1 : 0) : 0;
  let cops = 0;
  for (const car of state.cars) if (car.driver === 'cop') cops += 1;
  if (cops < want && state.time - (updatePolice.last || 0) > 1.4) {
    updatePolice.last = state.time;
    spawnCop(state, random);
  }
  // Roadblock at 4+ stars: park two cop cars across the road ahead of the player.
  if (p.wanted >= 4 && !updatePolice.blocked && p.car) {
    updatePolice.blocked = true;
    const ahead = 420;
    const ax = p.x + Math.cos(p.angle) * ahead;
    const ay = p.y + Math.sin(p.angle) * ahead;
    for (const off of [-46, 46]) {
      const car = spawnCop(state, random);
      car.x = clamp(ax + Math.cos(p.angle + Math.PI / 2) * off, 60, WORLD.size - 60);
      car.y = clamp(ay + Math.sin(p.angle + Math.PI / 2) * off, 60, WORLD.size - 60);
      car.angle = p.angle + Math.PI / 2;
      car.roadblock = true;
      car.speed = 0;
    }
  }
  if (p.wanted < 4) updatePolice.blocked = false;

  for (let i = state.cars.length - 1; i >= 0; i -= 1) {
    const car = state.cars[i];
    if (car.driver !== 'cop') continue;
    car.siren += dt * 6;
    if (car.roadblock) continue; // parked across the road, lights flashing
    if (p.wanted === 0) {
      // No heat: cruise away and leave.
      car.speed = Math.max(0, car.speed - 200 * dt);
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      if (dist(car.x, car.y, p.x, p.y) > 1600) state.cars.splice(i, 1);
      continue;
    }
    // Chase: steer toward the player along the road grid, faster than traffic,
    // ramming when close. Ease off while turning so the car makes the corner.
    const wantAngle = roadAngle(car.x, car.y, p.x, p.y);
    const turnDiff = Math.abs(angleDiff(car.angle, wantAngle));
    car.angle += clamp(angleDiff(car.angle, wantAngle), -2.4 * dt, 2.4 * dt);
    const d = dist(car.x, car.y, p.x, p.y);
    let targetSpeed = d > 260 ? COP.maxSpeed : COP.maxSpeed * 0.75;
    if (turnDiff > 0.5) targetSpeed *= 0.45;
    car.speed += clamp(targetSpeed - car.speed, -600 * dt, 420 * dt);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    car.x = clamp(car.x, 30, WORLD.size - 30);
    car.y = clamp(car.y, 30, WORLD.size - 30);
    // Ram the player's car, or bust the player on foot. Ramming has a cooldown
    // so a chase reads as a chase, not a parking lot.
    if (car.ramCd > 0) car.ramCd -= dt;
    if (p.car && d < 56 && Math.abs(car.speed) > 120 && car.ramCd <= 0) {
      car.ramCd = 0.6;
      p.car.speed *= 0.9;
      car.speed *= 0.7;
      world.burst(p.x, p.y, '#facc15', 6, 130);
      if (p.car && Math.abs(car.speed) > 200) p.health = Math.max(1, p.health - COP.ramDamage * dt * 4);
    }
    if (p.onFoot && d < COP.bustRange && !p.dead) {
      p.wanted = 0;
      p.money = Math.max(0, p.money - 200);
      state.stats.busted += 1;
      p.x = 1200; p.y = 1200;
      for (const c of state.cars) if (c.driver === 'cop') c.roadblock = false;
      state.cars = state.cars.filter((c) => c.driver !== 'cop');
      world.say('BUSTED! $200 fine — dropped at the clinic.');
      return 'busted';
    }
  }
  return null;
}
