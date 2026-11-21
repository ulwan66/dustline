// Save and load: money, mission progress, position, health and stats in
// localStorage, so a session survives a closed tab. Nothing personal is stored.
import { SAVE_KEY } from './config.js';

export function saveGame(state) {
  try {
    const p = state.player;
    const data = {
      money: p.money, mission: state.mission.index, x: p.x, y: p.y,
      health: p.health, ammo: p.ammo, earned: state.stats.earned,
      missionsDone: state.stats.missionsDone, carsStolen: state.stats.carsStolen,
      time: state.time,
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.money !== 'number' || typeof data.mission !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

export function clearSave() {
  try { window.localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
}

export function applySave(state, data) {
  const p = state.player;
  p.money = data.money;
  p.x = data.x; p.y = data.y;
  p.health = data.health || 100;
  p.ammo = data.ammo || 36;
  state.stats.earned = data.earned || 0;
  state.stats.missionsDone = data.missionsDone || 0;
  state.stats.carsStolen = data.carsStolen || 0;
  state.camera.x = p.x; state.camera.y = p.y;
  state.mission.index = Math.min(data.mission, 4);
  state.mission.stage = 'brief';
}
