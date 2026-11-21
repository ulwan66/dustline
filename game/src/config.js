// Dustline — every tuning number, colour and shared helper in one place.
// The city is a 3840x3840 top-down grid: roads every 480 px, blocks of desert
// buildings between them, downtown neon in the middle, sand and palms outside.
export const STEP = 1 / 60;
export const WORLD = { size: 3840, roadSpacing: 480, roadWidth: 104, roads: 8 };
export const VIEW = { width: 1280, height: 720 };
export const SAVE_KEY = 'dustline.save.v1';

export const PLAYER = {
  walkSpeed: 210, runSpeed: 330, radius: 13, health: 100,
  punchDamage: 34, punchRange: 46, punchArc: 1.1, punchCd: 0.38,
  shootCd: 0.22, ammoMax: 36, regenDelay: 6, regenRate: 4,
};
export const CAR = {
  accel: 520, brake: 900, reverseAccel: 300, maxSpeed: 620,
  sportMax: 760, truckMax: 460, steer: 2.6, grip: 6.5, drag: 0.55,
  length: 54, width: 26, damage: 100,
};
export const COP = { maxSpeed: 700, chaseRange: 1500, ramDamage: 12, bustRange: 52 };
export const WANTED = { decaySeen: 26, decayHidden: 9, max: 5 };

export const PALETTE = {
  sand: '#d9a75f', sandDark: '#c9924e', sandLight: '#e8bd7d',
  road: '#3a3a40', roadLine: '#e8d44f', sidewalk: '#b9a684', curb: '#8f7d5f',
  building: ['#c96f4a', '#d9a05b', '#7d8ba0', '#a8574e', '#5e7d6b', '#b08a4f', '#8a6f9e', '#4f7d8a'],
  roof: ['#8a4a34', '#9c7a3e', '#5a6a7d', '#7d3f3a', '#46604f', '#7d6335', '#63537a', '#3a5f68'],
  neon: ['#ff2e88', '#22d3ee', '#facc15', '#a3e635', '#c084fc'],
  grass: '#7d9b4e', water: '#3e7d9e', tree: '#4a7d3a', palm: '#3f7d33',
  player: '#f2c94c', playerShirt: '#e5534b', cop: '#1f2937', copWhite: '#f8fafc',
  traffic: ['#b91c1c', '#1d4ed8', '#0f766e', '#a16207', '#6d28d9', '#be185d', '#334155', '#ea580c', '#65a30d', '#0e7490'],
  text: '#f8f5ee', muted: '#c9bda6', panel: 'rgba(16,14,20,0.88)', gold: '#f2c94c',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

// Mission catalogue: title, briefing, reward, target label. Logic lives in missions.js.
export const MISSIONS = [
  { id: 1, title: 'Welcome Back', reward: 500, target: 'Dustline Motors',
    brief: 'Mara Quinn is back in Dustline after five years away. An old friend left a car at Dustline Motors — get in and drive it to the meet point.' },
  { id: 2, title: 'Heat on Your Tail', reward: 900, target: 'Rooftop Motel',
    brief: 'A patrol clocked the stolen car. Lose the heat or outrun it — reach the Rooftop Motel with the cops still chasing and the job pays double.' },
  { id: 3, title: 'The Package', reward: 1400, target: 'Cactus Jack Diner',
    brief: 'A package has to cross town in 90 seconds. No excuses, no stops. The client is watching the clock — and so is every patrol car in Dustline.' },
  { id: 4, title: 'Heist Prep', reward: 2000, target: 'Collect 3 stashes',
    brief: 'The big one needs gear: three stashes hidden around the city. The Vipers gang knows you are coming. Bring a gun, leave quietly.' },
  { id: 5, title: 'The Last Run', reward: 3500, target: 'Safehouse — Old Mill',
    brief: 'Four stars and the whole city awake. One last drive through Dustline to the Old Mill safehouse. Make it there and Mara is free.' },
];

export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function dist(ax, ay, bx, by) { return Math.hypot(bx - ax, by - ay); }
export function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
export function roadCenters() {
  const list = [];
  for (let i = 0; i < WORLD.roads; i += 1) list.push(240 + i * WORLD.roadSpacing);
  return list;
}
export function onRoad(x, y) {
  const half = WORLD.roadWidth / 2;
  for (const c of roadCenters()) {
    if (Math.abs(x - c) < half || Math.abs(y - c) < half) return true;
  }
  return false;
}
export function nearestRoadCoord(v) {
  let best = roadCenters()[0];
  for (const c of roadCenters()) if (Math.abs(v - c) < Math.abs(v - best)) best = c;
  return best;
}
