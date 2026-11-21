// The screenshot scenes behind ?shot=start|play|end. Each one plays the real rules
// forward from a fresh world for a fixed number of steps, steered by a simple
// autopilot, so the frame is what real play looks like and the same seed always
// gives the same frame.
import { STEP, clamp, angleDiff, dist, nearestRoadCoord } from './config.js';
import { SCREEN_END, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { spawnParkedCar, spawnTrafficCar, updateTraffic } from './traffic.js';
import { spawnPedestrian, updatePedestrians } from './pedestrians.js';
import { enterCar, roadAngle, updatePlayerCar } from './vehicles.js';
import { updatePolice } from './police.js';
import { startMission, updateMissions } from './missions.js';
import { updateCombat } from './combat.js';

function fakeInput() {
  const input = { mx: 0, my: 0 };
  input.moveX = () => input.mx;
  input.moveY = () => input.my;
  input.running = () => false;
  input.handbrake = () => false;
  input.mouse = () => ({ x: 640, y: 360, down: false });
  input.takeActions = () => 0;
  return input;
}

// Drive the player's car toward the mission target along the road grid, the way
// a real driver would — down one road, turn, down the next.
function chasePilot(state, input) {
  const car = state.player.car;
  const target = state.mission.target;
  if (!car || !target) { input.mx = 0; input.my = 0; return; }
  const want = roadAngle(car.x, car.y, target.x, target.y);
  const diff = angleDiff(car.angle, want);
  input.mx = clamp(diff * 2.2, -1, 1);
  // Brake hard while turning and in the braking zone before the one turn that
  // matters — the intersection where the car leaves its road for the target's.
  // (Braking for every intersection it crosses would never let it speed up.)
  const turnX = nearestRoadCoord(target.x);
  const turnY = nearestRoadCoord(car.y);
  const needTurn = Math.abs(car.x - turnX) > 40;
  const turnDist = needTurn ? dist(car.x, car.y, turnX, turnY) : dist(car.x, car.y, target.x, target.y);
  input.my = car.speed > 120 && (Math.abs(diff) > 0.5 || turnDist < 380) ? 1 : -1;
}

function simulate(world, input, seconds, random) {
  const state = world.state;
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    if (input && input._pilot) input._pilot(state, input);
    world.step(STEP, input || fakeInput());
    updateTraffic(state, STEP, random);
    updatePedestrians(state, STEP, random);
    updatePlayerCar(state, STEP, input || fakeInput(), world);
    updatePolice(state, STEP, random, world);
    updateMissions(state, STEP, random, world);
    updateCombat(state, STEP, world);
  }
}

function populateStreet(state, random, cx, cy) {
  for (let i = 0; i < 14; i += 1) spawnTrafficCar(state, random, { x: cx, y: cy });
  for (let i = 0; i < 16; i += 1) spawnPedestrian(state, random, { x: cx, y: cy });
  // A few parked cars along the road for the cover to read as a lived-in street.
  spawnParkedCar(state, random, cx - 260, cy + 30, 'sedan');
  spawnParkedCar(state, random, cx + 300, cy - 30, 'taxi');
}

/**
 * Set `world` to the named scene (start, play or end; any other name is start) and
 * return the screen to draw over it and the save to show on the title.
 */
export function stageShot(name, world, random) {
  const state = world.state;
  world.reset();
  if (name === 'end') {
    state.player.x = 3120; state.player.y = 3120;
    state.player.money = 8340;
    state.stats.earned = 8090;
    state.stats.missionsDone = 5;
    state.stats.carsStolen = 7;
    state.stats.shotsFired = 42;
    state.stats.busted = 1;
    state.mission.index = 5;
    state.mission.stage = 'allDone';
    state.camera.x = 3120; state.camera.y = 3120;
    populateStreet(state, random, 3120, 3120);
    simulate(world, fakeInput(), 2, random);
    return { screen: SCREEN_END, best: null };
  }
  if (name === 'play') {
    // Cover: Mara mid-chase in a red sportscar, wanted 3, mission 2 live, cops closing.
    state.player.x = 1920; state.player.y = 1680;
    state.camera.x = 1920; state.camera.y = 1680;
    state.player.money = 1150;
    const car = spawnParkedCar(state, random, 1920, 1680, 'sport');
    car.angle = 0; // east, down the road toward the motel
    enterCar(state, car);
    state.player.wanted = 0; // startMission adds 2, then top up to 3
    state.mission.index = 1;
    state.mission.stage = 'brief';
    startMission(state, random, world);
    state.player.wanted = 3;
    populateStreet(state, random, 1920, 1680);
    const input = fakeInput();
    input._pilot = chasePilot;
    simulate(world, input, 6, random);
    // The pilot may have reached the motel mid-simulation; re-stage mission 2
    // so the cover frame always shows the chase, wanted 3, target live.
    state.mission.index = 1;
    state.mission.stage = 'active';
    state.mission.target = { x: 3120, y: 720, label: 'Rooftop Motel' };
    state.mission.timer = 0;
    state.player.wanted = 3;
    return { screen: SCREEN_PLAY, best: null };
  }
  // Title: a golden-hour vista over Neon Plaza, traffic flowing, people walking.
  state.player.x = 1920; state.player.y = 1920;
  state.camera.x = 1920; state.camera.y = 1920;
  populateStreet(state, random, 1920, 1920);
  simulate(world, fakeInput(), 6, random);
  return { screen: SCREEN_TITLE, best: null };
}
