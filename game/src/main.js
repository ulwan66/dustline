// Dustline boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the renderer
// paints what is there. Screens: title, mission briefing, play, paused, busted /
// wasted, and the end screen after the fifth mission.
//
// ?seed=N fixes the city and the traffic. ?shot=start|play|end (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld } from './world.js';
import { ACTION_CONFIRM, ACTION_ENTER, ACTION_MUTE, ACTION_PAUSE, ACTION_PUNCH, ACTION_SHOOT, createInput } from './input.js';
import { createRenderer, SCREEN_BRIEF, SCREEN_END, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';
import { createAudio } from './audio.js';
import { applySave, clearSave, loadGame, saveGame } from './save.js';
import { enterCar, exitCar, nearestCar, updatePlayerCar } from './vehicles.js';
import { updateTraffic, spawnParkedCar } from './traffic.js';
import { updatePedestrians } from './pedestrians.js';
import { updatePolice } from './police.js';
import { startMission, updateMissions } from './missions.js';
import { punch, shoot, updateCombat } from './combat.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);
const random = createRandom(seed);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(random);
const state = world.state;
const renderer = createRenderer(canvas);
const audio = createAudio();
const saved = loadGame();

function announce(message) { status.textContent = message; }

function runShot(name) {
  const scene = stageShot(name, world, random);
  let painted = 0;
  function paint() {
    renderer.draw(state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let newGameKey = false;
  let prevMission = { index: 0, stage: 'brief' };

  window.addEventListener('keydown', (event) => {
    if (event.code === 'KeyN' && screen === SCREEN_TITLE) newGameKey = true;
    if (event.code === 'Enter' || event.code === 'Space') audio.unlock();
  });
  canvas.addEventListener('pointerdown', () => audio.unlock());

  function toWorld(mx, my) {
    const ratio = window.devicePixelRatio || 1;
    const v = renderer.view;
    const lx = ((mx * ratio) - v.x) / v.scale;
    const ly = ((my * ratio) - v.y) / v.scale;
    return { x: state.camera.x + (lx - 1280 / 2), y: state.camera.y + (ly - 720 / 2) };
  }

  function beginMission() {
    startMission(state, random, world);
    screen = SCREEN_PLAY;
    audio.mission();
    announce(`Mission ${state.mission.index + 1}: ${state.mission.target ? state.mission.target.label : ''}`);
  }

  function startNewGame() {
    clearSave();
    world.reset();
    state.player.money = 250;
    screen = SCREEN_BRIEF;
    announce('Mission 1: Welcome Back.');
  }

  function continueGame() {
    world.reset();
    applySave(state, saved);
    screen = SCREEN_BRIEF;
    announce(`Welcome back. Mission ${state.mission.index + 1}.`);
  }

  function respawn() {
    const p = state.player;
    p.dead = false;
    p.health = 100;
    p.wanted = 0;
    p.x = 1200; p.y = 1200;
    state.camera.x = 1200; state.camera.y = 1200;
    if (p.car) { p.car.driver = 'parked'; p.car = null; }
    p.onFoot = true;
    screen = SCREEN_PLAY;
    announce('Back on your feet. Dustline is still yours to take.');
  }

  function stepGame(dt) {
    const events = world.step(dt, input);
    updateTraffic(state, dt, random);
    updatePedestrians(state, dt, random);
    updatePlayerCar(state, dt, input, world);
    const busted = updatePolice(state, dt, random, world);
    updateMissions(state, dt, random, world);
    updateCombat(state, dt, world);
    // Mission flow: finishing a job opens its briefing; finishing the last opens the end screen.
    if (state.mission.stage !== prevMission.stage || state.mission.index !== prevMission.index) {
      if (state.mission.stage === 'allDone') {
        screen = SCREEN_END;
        saveGame(state);
        audio.mission();
      } else if (state.mission.stage === 'brief' && prevMission.stage === 'active') {
        screen = SCREEN_BRIEF;
        saveGame(state);
        audio.mission();
      }
      prevMission = { index: state.mission.index, stage: state.mission.stage };
    }
    if (busted === 'busted') {
      screen = SCREEN_OVER;
      audio.busted();
      announce('Busted.');
    }
    if (state.player.dead && screen === SCREEN_PLAY) {
      screen = SCREEN_OVER;
      announce('Wasted.');
    }
    // Driving and siren sounds follow the live state.
    const p = state.player;
    audio.engine(p.car && !p.onFoot ? p.car.speed : 0, !!p.car && !p.onFoot);
    audio.siren(p.wanted);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Sound off.' : 'Sound on.');
    }
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) {
        if (newGameKey || !saved || !saved.missionsDone) startNewGame();
        else continueGame();
        newGameKey = false;
      }
      return;
    }
    if (screen === SCREEN_BRIEF) {
      if (actions & ACTION_CONFIRM) beginMission();
      return;
    }
    if (screen === SCREEN_OVER) {
      if (actions & ACTION_CONFIRM) respawn();
      return;
    }
    if (screen === SCREEN_END) {
      if (actions & ACTION_CONFIRM) {
        screen = SCREEN_PLAY;
        state.mission.stage = 'allDone';
      }
      return;
    }
    if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
      return;
    }
    // SCREEN_PLAY
    if (actions & ACTION_PAUSE) {
      screen = SCREEN_PAUSED;
      saveGame(state);
      announce('Paused. Progress saved.');
      return;
    }
    if (actions & ACTION_ENTER) {
      const p = state.player;
      if (p.onFoot) {
        const car = nearestCar(state, 70);
        if (car) {
          const wasParked = car.driver === 'parked';
          enterCar(state, car);
          audio.blip();
          announce(wasParked ? 'Driving.' : 'Car stolen — the street saw it.');
        }
      } else {
        exitCar(state);
        audio.blip();
      }
    }
    if (actions & ACTION_PUNCH) {
      punch(state, world);
      audio.punch();
    }
    if (actions & ACTION_SHOOT) {
      const mouse = input.mouse();
      const target = toWorld(mouse.x, mouse.y);
      shoot(state, world, target.x, target.y);
      audio.gunshot();
    }
  }

  let accumulator = 0;
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP) {
        stepGame(STEP);
        accumulator -= STEP;
        if (screen !== SCREEN_PLAY) { accumulator = 0; break; }
      }
    } else if (screen === SCREEN_TITLE) {
      // The title lives: traffic flows behind the panel.
      while (accumulator >= STEP) {
        world.step(STEP, input);
        updateTraffic(state, STEP, random);
        updatePedestrians(state, STEP, random);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(state, screen, saved);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      saveGame(state);
      announce('Paused.');
    }
  });

  // A parked car near the start so the first minutes always have a ride.
  spawnParkedCar(state, random, 1240, 1150, 'sedan');
  announce('Dustline. Press Enter to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
