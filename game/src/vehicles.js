// Vehicles: getting in and out, stealing, and driving. The player's car has arcade
// physics — acceleration, braking and reversing, steering that bites harder at low
// speed, a handbrake for slides — plus collisions with buildings, traffic and
// pedestrians, which is where the wanted level comes from.
import { CAR, PLAYER, WORLD, angleDiff, clamp, dist, nearestRoadCoord } from './config.js';

// The angle to drive on the road grid toward a target: steer at the intersection
// on the car's own road, then down the target's road — a smooth waypoint turn
// that keeps the car on the asphalt instead of cutting through buildings.
export function roadAngle(x, y, tx, ty) {
  const rx = nearestRoadCoord(tx);
  const ry = nearestRoadCoord(ty);
  const cy = nearestRoadCoord(y);
  const cx = nearestRoadCoord(x);
  const onH = Math.abs(y - cy) < 24;
  const onV = Math.abs(x - cx) < 24;
  let wx; let wy;
  if (!onH && !onV) {
    // Off the grid: rejoin it at the nearest point — the closest road line.
    if (Math.abs(x - cx) <= Math.abs(y - cy)) { wx = cx; wy = y; }
    else { wx = x; wy = cy; }
  } else if (onH && Math.abs(x - rx) > 40) { wx = rx; wy = cy; }
  else if (onV && Math.abs(y - ry) > 40) { wx = cx; wy = ry; }
  else { wx = rx; wy = ry; }
  return Math.atan2(wy - y, wx - x);
}

// The nearest stealable car within reach of the player on foot.
export function nearestCar(state, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of state.cars) {
    if (car.driver === 'player' || car.driver === 'cop') continue;
    const d = dist(state.player.x, state.player.y, car.x, car.y);
    if (d < bestD) { best = car; bestD = d; }
  }
  return best;
}

export function enterCar(state, car) {
  const p = state.player;
  p.onFoot = false;
  p.car = car;
  if (car.driver === 'parked') {
    state.stats.carsStolen += 1;
    p.wanted = Math.min(5, p.wanted + 1);
  } else if (car.driver === 'traffic') {
    state.stats.carsStolen += 1;
    p.wanted = Math.min(5, p.wanted + 1);
    // The driver bails out and runs.
    state.peds.push({
      x: car.x + 40, y: car.y + 40, angle: 0, speed: 180, shirt: '#f8fafc',
      skin: '#e0ac69', state: 'flee', targetX: car.x + 300, targetY: car.y + 300,
      wait: 0, flee: 2.5, bob: 0,
    });
  }
  car.driver = 'player';
  car.speed = 0;
  p.x = car.x; p.y = car.y; p.angle = car.angle;
}

export function exitCar(state) {
  const p = state.player;
  const car = p.car;
  if (!car) return;
  car.driver = 'parked';
  car.speed *= 0.2;
  p.onFoot = true;
  p.car = null;
  p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
  p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
  p.angle = car.angle;
  p.speed = 0;
}

function collideCarWithBuildings(state, car, world) {
  const half = { x: Math.cos(car.angle) * car.w / 2, y: Math.sin(car.angle) * car.w / 2 };
  const px = car.x + half.x;
  const py = car.y + half.y;
  const b = world.buildingAt(px, py, 8) || world.buildingAt(car.x - half.x, car.y - half.y, 8);
  if (b) {
    // Simple bounce: kill forward speed and push the car back out.
    const push = 26;
    car.x -= Math.cos(car.angle) * push * Math.sign(car.speed || 1) * 0.4;
    car.y -= Math.sin(car.angle) * push * Math.sign(car.speed || 1) * 0.4;
    if (Math.abs(car.speed) > 260) {
      state.player.wanted = Math.min(5, state.player.wanted + 0);
      world.burst(car.x, car.y, '#facc15', 6, 120);
    }
    car.speed *= -0.25;
  }
}

function collideCarWithCars(state, car, world) {
  for (const other of state.cars) {
    if (other === car || other.driver === 'cop') continue;
    const d = dist(car.x, car.y, other.x, other.y);
    if (d < 52 && d > 0.01) {
      const push = (52 - d) / 2;
      const nx = (other.x - car.x) / d;
      const ny = (other.y - car.y) / d;
      other.x += nx * push; other.y += ny * push;
      car.x -= nx * push * 0.5; car.y -= ny * push * 0.5;
      const impact = Math.abs(car.speed - other.speed);
      if (impact > 180) {
        world.burst(other.x, other.y, '#e5e7eb', 8, 160);
        car.speed *= 0.55;
        other.speed = car.speed * 0.4;
        if (other.driver === 'traffic') other.driver = 'parked';
      } else {
        other.speed = car.speed * 0.5;
      }
    }
  }
}

export function updatePlayerCar(state, dt, input, world) {
  const p = state.player;
  const car = p.car;
  if (!car || p.onFoot) return;
  const forward = input.moveY() < 0 ? 1 : input.moveY() > 0 ? -0.6 : 0;
  const steer = input.moveX();
  const maxSpeed = car.kind === 'sport' ? CAR.sportMax : car.kind === 'truck' ? CAR.truckMax : CAR.maxSpeed;
  if (forward > 0) car.speed += CAR.accel * forward * dt;
  else if (forward < 0) {
    if (car.speed > 30) car.speed -= CAR.brake * dt; // braking, not reversing yet
    else car.speed += CAR.reverseAccel * forward * dt; // reversing
  }
  else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 320 * dt);
  if (input.handbrake()) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 900 * dt);
  // Drag and the speed cap.
  car.speed -= car.speed * CAR.drag * dt * 0.4;
  car.speed = clamp(car.speed, -260, maxSpeed);
  const steerAuthority = clamp(0.55 + Math.abs(car.speed) / 600, 0, 1) * CAR.steer;
  car.angle += steer * steerAuthority * Math.sign(car.speed) * dt * (input.handbrake() ? 1.7 : 1);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.x = clamp(car.x, 30, WORLD.size - 30);
  car.y = clamp(car.y, 30, WORLD.size - 30);
  collideCarWithBuildings(state, car, world);
  collideCarWithCars(state, car, world);
  // Running over a pedestrian is a crime the whole street sees.
  for (const ped of state.peds) {
    if (ped.state === 'down') continue;
    if (dist(car.x, car.y, ped.x, ped.y) < 30 && Math.abs(car.speed) > 60) {
      ped.state = 'down';
      p.wanted = Math.min(5, p.wanted + 1);
      p.heat = 0;
      world.burst(ped.x, ped.y, '#e5534b', 10, 140);
    }
  }
  p.x = car.x; p.y = car.y; p.angle = car.angle; p.speed = Math.abs(car.speed);
  p.moving = Math.abs(car.speed) > 20;
  car.brakeLight = input.moveY() > 0 || input.handbrake();
}
