// Combat: fists and a pistol for the player, and gang members who guard stashes
// and shoot back. Bullets are simple fast projectiles; hits spark particles, cost
// health, and raise the wanted level when the police see them.
import { PLAYER, WORLD, clamp, dist } from './config.js';

export function punch(state, world) {
  const p = state.player;
  if (!p.onFoot || p.punchCd > 0 || p.dead) return;
  p.punchCd = PLAYER.punchCd;
  const reach = PLAYER.punchRange;
  const cx = p.x + Math.cos(p.angle) * reach;
  const cy = p.y + Math.sin(p.angle) * reach;
  let hit = false;
  for (const e of state.enemies) {
    if (e.health <= 0) continue;
    if (dist(cx, cy, e.x, e.y) < 34) {
      e.health -= PLAYER.punchDamage;
      hit = true;
      world.burst(e.x, e.y, '#f8fafc', 6, 120);
    }
  }
  for (const ped of state.peds) {
    if (ped.state === 'down') continue;
    if (dist(cx, cy, ped.x, ped.y) < 30) {
      ped.state = 'down';
      hit = true;
      p.wanted = Math.min(5, p.wanted + 1);
    }
  }
  if (hit) world.burst(cx, cy, '#facc15', 4, 90);
}

export function shoot(state, world, tx, ty) {
  const p = state.player;
  if (p.shootCd > 0 || p.ammo <= 0 || p.dead) return;
  p.shootCd = PLAYER.shootCd;
  p.ammo -= 1;
  state.stats.shotsFired += 1;
  const angle = Math.atan2(ty - p.y, tx - p.x);
  p.angle = angle;
  const sx = p.x + Math.cos(angle) * 22;
  const sy = p.y + Math.sin(angle) * 22;
  state.bullets.push({ x: sx, y: sy, vx: Math.cos(angle) * 980, vy: Math.sin(angle) * 980, life: 0.9, from: 'player' });
  world.burst(sx, sy, '#fde68a', 4, 160);
}

export function updateCombat(state, dt, world) {
  const p = state.player;
  // Player bullets vs enemies, buildings and cars.
  for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
    const b = state.bullets[i];
    let dead = false;
    if (b.from === 'player') {
      for (const e of state.enemies) {
        if (e.health > 0 && dist(b.x, b.y, e.x, e.y) < 20) {
          e.health -= 26;
          world.burst(e.x, e.y, '#e5534b', 8, 140);
          if (e.health <= 0) {
            p.money += 60;
            state.stats.earned += 60;
            world.say('Viper down +$60');
          }
          dead = true;
          break;
        }
      }
      if (!dead) {
        for (const car of state.cars) {
          if (car.driver === 'player') continue;
          if (Math.abs(b.x - car.x) < 28 && Math.abs(b.y - car.y) < 18) {
            world.burst(b.x, b.y, '#e5e7eb', 5, 120);
            if (car.driver === 'cop') p.wanted = Math.min(5, p.wanted + 1);
            dead = true;
            break;
          }
        }
      }
    } else {
      // Enemy bullets vs the player.
      if (dist(b.x, b.y, p.x, p.y) < 16) {
        world.hurtPlayer(9, 'bullet');
        dead = true;
      }
    }
    if (dead) state.bullets.splice(i, 1);
  }
  // Enemies: chase the player when close, shoot when in range, guard otherwise.
  for (const e of state.enemies) {
    if (e.health <= 0) continue;
    e.bob += dt * 8;
    const d = dist(e.x, e.y, p.x, p.y);
    e.shootCd -= dt;
    if (d < 520 && !p.dead) {
      e.state = 'chase';
      e.angle = Math.atan2(p.y - e.y, p.x - e.x);
      if (d > 180) {
        e.x += Math.cos(e.angle) * e.speed * dt;
        e.y += Math.sin(e.angle) * e.speed * dt;
      } else if (e.shootCd <= 0) {
        e.shootCd = 1.1;
        state.bullets.push({
          x: e.x + Math.cos(e.angle) * 20, y: e.y + Math.sin(e.angle) * 20,
          vx: Math.cos(e.angle) * 620, vy: Math.sin(e.angle) * 620, life: 1.1, from: 'enemy',
        });
      }
    } else {
      e.state = 'guard';
    }
    e.x = clamp(e.x, 30, WORLD.size - 30);
    e.y = clamp(e.y, 30, WORLD.size - 30);
  }
  // Remove the dead (their cash is already paid).
  state.enemies = state.enemies.filter((e) => e.health > 0);
}
