// Missions: five story jobs for Mara Quinn, each with a briefing, a map target,
// a timer where the story needs one, and a cash reward. A mission is a small
// state machine: brief -> active -> done, and completing one briefs the next.
import { MISSIONS, clamp, dist } from './config.js';
import { addWanted } from './police.js';
import { spawnParkedCar } from './traffic.js';

// Fixed landmarks on the map, so every mission target is a real place.
export const LANDMARKS = {
  motors: { x: 1680, y: 1150, label: 'Dustline Motors' },
  motel: { x: 3120, y: 720, label: 'Rooftop Motel' },
  diner: { x: 720, y: 3120, label: 'Cactus Jack Diner' },
  mill: { x: 3120, y: 3120, label: 'Old Mill Safehouse' },
  plaza: { x: 1920, y: 1920, label: 'Neon Plaza' },
};

function stashSpots() {
  return [
    { x: 720, y: 720, label: 'Stash 1 — Coyote Gas' },
    { x: 2640, y: 1680, label: 'Stash 2 — Sunset Mall' },
    { x: 1680, y: 2640, label: 'Stash 3 — The Foundry' },
  ];
}

export function startMission(state, random, world) {
  const m = state.mission;
  const def = MISSIONS[m.index];
  if (!def) { m.stage = 'allDone'; return; }
  m.stage = 'active';
  m.collected = 0;
  m.timer = 0;
  if (m.index === 0) {
    m.target = LANDMARKS.motors;
    m.text = def.brief;
    spawnParkedCar(state, random, 1240, 1150, 'sedan');
  } else if (m.index === 1) {
    m.target = LANDMARKS.motel;
    m.text = def.brief;
    addWanted(state, 2);
  } else if (m.index === 2) {
    m.target = LANDMARKS.diner;
    m.timer = 90;
    m.text = def.brief;
  } else if (m.index === 3) {
    m.target = { x: 720, y: 720, label: 'Collect 3 stashes' };
    m.text = def.brief;
    for (const s of stashSpots()) {
      state.pickups.push({ x: s.x, y: s.y, kind: 'stash', label: s.label, value: 0, taken: false });
    }
    spawnGang(state, random, 720, 720);
    spawnGang(state, random, 2640, 1680);
  } else if (m.index === 4) {
    m.target = LANDMARKS.mill;
    m.text = def.brief;
    addWanted(state, 4);
    spawnGang(state, random, 2640, 2640);
    spawnGang(state, random, 3120, 2880);
  }
  world.say(`${def.title} — ${def.target}`);
}

function spawnGang(state, random, x, y) {
  for (let i = 0; i < 2; i += 1) {
    state.enemies.push({
      x: x + (random() < 0.5 ? -60 : 60), y: y + (random() < 0.5 ? -60 : 60),
      angle: 0, health: 60, speed: 120, state: 'guard', shootCd: 1 + random(),
      shirt: '#7f1d1d', skin: '#c68642', bob: 0,
    });
  }
}

function completeMission(state, world) {
  const m = state.mission;
  const def = MISSIONS[m.index];
  state.player.money += def.reward;
  state.stats.earned += def.reward;
  state.stats.missionsDone += 1;
  world.say(`Mission complete! +$${def.reward}`);
  world.burst(state.player.x, state.player.y, '#f2c94c', 24, 220);
  m.index += 1;
  if (m.index >= MISSIONS.length) {
    m.stage = 'allDone';
    m.target = null;
    m.text = 'Every job done. Mara Quinn owns Dustline now.';
  } else {
    m.stage = 'brief';
    m.target = null;
    m.text = MISSIONS[m.index].brief;
  }
}

export function updateMissions(state, dt, random, world) {
  const m = state.mission;
  if (m.stage === 'brief' || m.stage === 'allDone') return;
  const p = state.player;
  if (m.index === 2 && m.timer > 0) {
    m.timer -= dt;
    if (m.timer <= 0) {
      m.stage = 'brief';
      m.timer = 0;
      m.text = 'Too slow — the client walked. The package job is open again. Press Enter to retry.';
      world.say('Too slow! Mission failed.');
      return;
    }
  }
  if (m.index === 3) {
    // Target is the nearest uncollected stash.
    let nearest = null;
    let best = Infinity;
    for (const pk of state.pickups) {
      if (pk.kind !== 'stash' || pk.taken) continue;
      const d = dist(p.x, p.y, pk.x, pk.y);
      if (d < best) { best = d; nearest = pk; }
    }
    if (nearest) m.target = { x: nearest.x, y: nearest.y, label: nearest.label };
    if (m.collected >= 3) { completeMission(state, world); return; }
  }
  if (m.target && dist(p.x, p.y, m.target.x, m.target.y) < 70) {
    if (m.index === 1 && p.wanted < 1) {
      // Mission 2 wants the heat still on: arriving clean does not count.
      world.say('The cops lost you — steal a car or cause trouble, then come back hot.');
      return;
    }
    completeMission(state, world);
  }
}

export function missionObjective(state) {
  const m = state.mission;
  if (m.stage === 'allDone') return 'All missions complete — free roam. Mara owns Dustline.';
  if (m.stage === 'brief') return MISSIONS[m.index] ? `Next: ${MISSIONS[m.index].title} — press Enter` : '';
  const def = MISSIONS[m.index];
  let line = `${def.title}: ${m.target ? m.target.label : ''}`;
  if (m.index === 2) line += ` — ${Math.max(0, Math.ceil(m.timer))}s left`;
  if (m.index === 3) line += ` — ${m.collected}/3 stashes`;
  return line;
}
