// Drawing only: the city, the cars, the people and the light, then the screens.
// The 1280x720 logical view is scaled to fit the window; the camera follows the
// player and only what is on screen is drawn. Golden-hour sun, neon downtown,
// headlights and a dark overlay after dusk.
import { FONT, PALETTE, VIEW, WORLD, clamp, dist, roadCenters } from './config.js';
import { drawHud } from './hud.js';
import { MISSIONS } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_BRIEF = 'brief';
export const SCREEN_END = 'end';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / VIEW.width, height / VIEW.height);
    view.x = (width - VIEW.width * view.scale) / 2;
    view.y = (height - VIEW.height * view.scale) / 2;
  }
  function text(value, x, y, size, color, align, bold) {
    if (!fonts.has(size)) fonts.set(size, `${bold ? '700 ' : ''}${size}px ${FONT}`);
    ctx.font = fonts.get(size);
    ctx.fillStyle = color;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(value, x, y);
  }
  function toScreen(wx, wy) {
    return { x: (wx - stateCamera.x) * 1 + VIEW.width / 2, y: (wy - stateCamera.y) * 1 + VIEW.height / 2 };
  }
  let stateCamera = { x: 0, y: 0 };

  function drawGround(state) {
    // Desert sand with a subtle checker of tones, then sidewalks and roads.
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(0, 0, WORLD.size, WORLD.size);
    const tile = 120;
    const x0 = Math.max(0, Math.floor((stateCamera.x - VIEW.width / 2) / tile) * tile);
    const y0 = Math.max(0, Math.floor((stateCamera.y - VIEW.height / 2) / tile) * tile);
    for (let x = x0; x < Math.min(WORLD.size, stateCamera.x + VIEW.width / 2 + tile); x += tile) {
      for (let y = y0; y < Math.min(WORLD.size, stateCamera.y + VIEW.height / 2 + tile); y += tile) {
        const h = ((x * 31 + y * 17) % 5) / 5;
        ctx.fillStyle = h > 0.6 ? PALETTE.sandLight : h < 0.2 ? PALETTE.sandDark : PALETTE.sand;
        ctx.fillRect(x, y, tile, tile);
      }
    }
    const centers = roadCenters();
    const half = WORLD.roadWidth / 2;
    // Sidewalks.
    ctx.fillStyle = PALETTE.sidewalk;
    for (const c of centers) {
      ctx.fillRect(0, c - half - 12, WORLD.size, 12);
      ctx.fillRect(0, c + half, WORLD.size, 12);
      ctx.fillRect(c - half - 12, 0, 12, WORLD.size);
      ctx.fillRect(c + half, 0, 12, WORLD.size);
    }
    // Asphalt.
    ctx.fillStyle = PALETTE.road;
    for (const c of centers) {
      ctx.fillRect(0, c - half, WORLD.size, WORLD.roadWidth);
      ctx.fillRect(c - half, 0, WORLD.roadWidth, WORLD.size);
    }
    // Centre dashes.
    ctx.fillStyle = PALETTE.roadLine;
    for (const c of centers) {
      for (let d = 0; d < WORLD.size; d += 64) {
        ctx.fillRect(d, c - 2, 34, 4);
        ctx.fillRect(c - 2, d, 4, 34);
      }
    }
    // Crosswalks at intersections.
    ctx.fillStyle = 'rgba(248,245,238,0.75)';
    for (const cx of centers) {
      for (const cy of centers) {
        for (let i = -3; i <= 3; i += 1) {
          ctx.fillRect(cx + i * 14 - 4, cy - half - 10, 8, 8);
          ctx.fillRect(cx + i * 14 - 4, cy + half + 2, 8, 8);
        }
      }
    }
    // Traffic lights at every intersection: green one way, red the other.
    const phase = Math.floor(state.trafficLight / 7) % 2;
    for (const cx of centers) {
      for (const cy of centers) {
        if (Math.abs(cx - stateCamera.x) > VIEW.width || Math.abs(cy - stateCamera.y) > VIEW.height) continue;
        ctx.fillStyle = '#1f2937';
        ctx.fillRect(cx + half + 2, cy - half - 16, 10, 26);
        ctx.fillStyle = phase === 0 ? '#4ade80' : '#ef4444';
        ctx.beginPath(); ctx.arc(cx + half + 7, cy - half - 8, 3.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = phase === 0 ? '#ef4444' : '#4ade80';
        ctx.beginPath(); ctx.arc(cx + half + 7, cy - half + 2, 3.5, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  function drawBuildings(state) {
    for (const b of state.city.buildings) {
      if (Math.abs(b.x + b.w / 2 - stateCamera.x) > VIEW.width || Math.abs(b.y + b.h / 2 - stateCamera.y) > VIEW.height) continue;
      // Shadow.
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(b.x + 8, b.y + 10, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      // Roof inset and windows.
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x + 8, b.y + 8, b.w - 16, b.h - 16);
      ctx.fillStyle = 'rgba(248,245,238,0.28)';
      const cols = Math.max(1, Math.floor(b.w / 46));
      const rows = Math.max(1, Math.floor(b.h / 46));
      for (let i = 0; i < cols; i += 1) {
        for (let j = 0; j < rows; j += 1) {
          if ((i * 7 + j * 13 + b.x) % 3 === 0) ctx.fillRect(b.x + 16 + i * 44, b.y + 16 + j * 44, 18, 12);
        }
      }
      if (b.tall) {
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(b.x + b.w * 0.3, b.y + b.h * 0.25, b.w * 0.4, b.h * 0.5);
      }
      if (b.neon) {
        ctx.fillStyle = b.neon;
        ctx.fillRect(b.x + 6, b.y - 6, b.w - 12, 7);
        ctx.globalAlpha = 0.35;
        ctx.fillRect(b.x - 4, b.y - 12, b.w + 8, 20);
        ctx.globalAlpha = 1;
      }
      if (b.name) {
        ctx.font = `700 15px ${FONT}`;
        ctx.fillStyle = 'rgba(248,245,238,0.9)';
        ctx.textAlign = 'center';
        ctx.fillText(b.name.toUpperCase(), b.x + b.w / 2, b.y + b.h / 2 + 5);
      }
    }
    // Palms and lamps.
    for (const palm of state.city.palms) {
      if (Math.abs(palm.x - stateCamera.x) > VIEW.width || Math.abs(palm.y - stateCamera.y) > VIEW.height) continue;
      ctx.strokeStyle = '#7d5a2e';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(palm.x, palm.y); ctx.lineTo(palm.x + 4, palm.y - 16); ctx.stroke();
      ctx.fillStyle = PALETTE.palm;
      for (let i = 0; i < 5; i += 1) {
        const a = (i / 5) * Math.PI * 2 + 0.4;
        ctx.beginPath();
        ctx.ellipse(palm.x + 4 + Math.cos(a) * 12, palm.y - 16 + Math.sin(a) * 8, 13, 5, a, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawPickup(p) {
    const bob = Math.sin(performance.now() / 300 + p.x) * 3;
    ctx.save();
    ctx.translate(p.x, p.y + bob);
    if (p.kind === 'stash') {
      ctx.fillStyle = '#7f1d1d';
      roundRect(ctx, -14, -10, 28, 20, 4); ctx.fill();
      ctx.fillStyle = '#f2c94c';
      ctx.fillRect(-14, -3, 28, 6);
    } else if (p.kind === 'cash') {
      ctx.fillStyle = '#4ade80';
      ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#14532d';
      ctx.font = `700 13px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('$', 0, 1);
    } else if (p.kind === 'health') {
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(-10, -10, 20, 20);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(-3, -8, 6, 16); ctx.fillRect(-8, -3, 16, 6);
    } else {
      ctx.fillStyle = '#facc15';
      ctx.fillRect(-8, -10, 6, 20); ctx.fillRect(2, -10, 6, 20);
    }
    ctx.restore();
    ctx.textBaseline = 'alphabetic';
  }

  function drawPerson(x, y, angle, shirt, skin, bob, down) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(0, 6, 12, 6, 0, 0, Math.PI * 2); ctx.fill();
    if (down) {
      ctx.rotate(angle + Math.PI / 2);
      ctx.fillStyle = shirt;
      roundRect(ctx, -13, -6, 26, 12, 6); ctx.fill();
      ctx.fillStyle = skin;
      ctx.beginPath(); ctx.arc(16, 0, 6, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      return;
    }
    ctx.rotate(angle);
    const swing = Math.sin(bob) * 4;
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(-6 + swing, -9, 5, 18);
    ctx.fillRect(1 - swing, -9, 5, 18);
    ctx.fillStyle = shirt;
    roundRect(ctx, -9, -10, 18, 20, 7); ctx.fill();
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.arc(0, -14, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1f2937';
    ctx.beginPath(); ctx.arc(0, -16, 7, Math.PI, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawCar(car, state) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(3, 5, car.w / 2 + 2, car.h / 2 + 3, car.angle, 0, Math.PI * 2); ctx.fill();
    ctx.rotate(car.angle);
    const isCop = car.kind === 'cop';
    ctx.fillStyle = isCop ? '#111827' : car.color;
    roundRect(ctx, -car.w / 2, -car.h / 2, car.w, car.h, 8); ctx.fill();
    if (isCop) {
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(-6, -car.h / 2, 12, car.h);
      const flash = Math.sin(car.siren || 0) > 0;
      ctx.fillStyle = flash ? '#ef4444' : '#3b82f6';
      ctx.fillRect(-8, -car.h / 2 - 2, 7, 5);
      ctx.fillStyle = flash ? '#3b82f6' : '#ef4444';
      ctx.fillRect(1, -car.h / 2 - 2, 7, 5);
    } else {
      ctx.fillStyle = 'rgba(15,23,42,0.85)';
      roundRect(ctx, -car.w / 2 + 10, -car.h / 2 + 4, 16, car.h - 8, 3); ctx.fill();
      ctx.fillStyle = 'rgba(226,232,240,0.75)';
      roundRect(ctx, car.w / 2 - 18, -car.h / 2 + 4, 10, car.h - 8, 3); ctx.fill();
      if (car.kind === 'taxi') {
        ctx.fillStyle = '#111827';
        for (let i = 0; i < 4; i += 1) ctx.fillRect(-8 + i * 8, -car.h / 2 + 2, 4, 4);
      }
    }
    // Headlights and brake lights.
    ctx.fillStyle = '#fef9c3';
    ctx.fillRect(car.w / 2 - 2, -car.h / 2 + 3, 4, 5);
    ctx.fillRect(car.w / 2 - 2, car.h / 2 - 8, 4, 5);
    ctx.fillStyle = car.brakeLight ? '#ef4444' : '#7f1d1d';
    ctx.fillRect(-car.w / 2 - 1, -car.h / 2 + 3, 4, 5);
    ctx.fillRect(-car.w / 2 - 1, car.h / 2 - 8, 4, 5);
    ctx.restore();
    // Headlight cones at night.
    if (state.dayTime > 0.95) {
      ctx.save();
      ctx.translate(car.x, car.y);
      ctx.rotate(car.angle);
      const grad = ctx.createLinearGradient(car.w / 2, 0, car.w / 2 + 150, 0);
      grad.addColorStop(0, 'rgba(254,249,195,0.20)');
      grad.addColorStop(1, 'rgba(254,249,195,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(car.w / 2, -8); ctx.lineTo(car.w / 2 + 150, -42);
      ctx.lineTo(car.w / 2 + 150, 42); ctx.lineTo(car.w / 2, 8);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }

  function drawWorld(state) {
    drawGround(state);
    drawBuildings(state);
    // Mission target beacon.
    const m = state.mission;
    if (m.target && m.stage === 'active') {
      const pulse = 1 + Math.sin(state.time * 4) * 0.15;
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(m.target.x, m.target.y, 34 * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(m.target.x, m.target.y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = `700 15px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#facc15';
      ctx.fillText(m.target.label.toUpperCase(), m.target.x, m.target.y - 46);
    }
    for (const p of state.pickups) {
      if (p.taken) continue;
      if (Math.abs(p.x - stateCamera.x) > VIEW.width || Math.abs(p.y - stateCamera.y) > VIEW.height) continue;
      drawPickup(p);
    }
    for (const ped of state.peds) {
      if (Math.abs(ped.x - stateCamera.x) > VIEW.width || Math.abs(ped.y - stateCamera.y) > VIEW.height) continue;
      drawPerson(ped.x, ped.y, ped.angle, ped.shirt, ped.skin, ped.bob, ped.state === 'down');
    }
    for (const e of state.enemies) {
      if (Math.abs(e.x - stateCamera.x) > VIEW.width || Math.abs(e.y - stateCamera.y) > VIEW.height) continue;
      drawPerson(e.x, e.y, e.angle, e.shirt, e.skin, e.bob, false);
      ctx.fillStyle = '#3f3f46';
      ctx.fillRect(e.x - 14, e.y - 26, 28, 5);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(e.x - 14, e.y - 26, 28 * clamp(e.health / 60, 0, 1), 5);
      ctx.fillStyle = '#1f2937';
      ctx.save();
      ctx.translate(e.x + Math.cos(e.angle) * 16, e.y + Math.sin(e.angle) * 16);
      ctx.rotate(e.angle);
      ctx.fillRect(0, -2, 14, 4);
      ctx.restore();
    }
    for (const car of state.cars) {
      if (Math.abs(car.x - stateCamera.x) > VIEW.width || Math.abs(car.y - stateCamera.y) > VIEW.height) continue;
      drawCar(car, state);
    }
    // Player on foot.
    const p = state.player;
    if (p.onFoot && !p.dead) {
      drawPerson(p.x, p.y, p.angle, PALETTE.playerShirt, '#e0ac69', p.moving ? state.time * 10 : 0, false);
      if (p.ammo > 0) {
        ctx.save();
        ctx.translate(p.x + Math.cos(p.angle) * 16, p.y + Math.sin(p.angle) * 16);
        ctx.rotate(p.angle);
        ctx.fillStyle = '#1f2937';
        ctx.fillRect(0, -2, 12, 4);
        ctx.restore();
      }
    }
    // Bullets and particles.
    for (const b of state.bullets) {
      ctx.strokeStyle = '#fde68a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    for (const pt of state.particles) {
      ctx.globalAlpha = clamp(pt.life / pt.max, 0, 1);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Dusk overlay: the later the day, the darker and bluer, with neon popping.
    const night = clamp((state.dayTime - 0.9) / 0.25, 0, 1);
    if (night > 0) {
      ctx.fillStyle = `rgba(10,10,40,${night * 0.45})`;
      ctx.fillRect(stateCamera.x - VIEW.width / 2, stateCamera.y - VIEW.height / 2, VIEW.width, VIEW.height);
    }
  }

  function drawPanel(title, lines, prompt, accent) {
    const width = 640;
    const height = 150 + lines.length * 32 + 64;
    const x = (VIEW.width - width) / 2;
    const y = (VIEW.height - height) / 2;
    ctx.fillStyle = PALETTE.panel;
    roundRect(ctx, x, y, width, height, 14); ctx.fill();
    ctx.strokeStyle = accent || '#f2c94c';
    ctx.lineWidth = 2;
    roundRect(ctx, x, y, width, height, 14); ctx.stroke();
    text(title, VIEW.width / 2, y + 62, 42, PALETTE.text, 'center', true);
    lines.forEach((line, i) => {
      text(line, VIEW.width / 2, y + 108 + i * 32, 19, PALETTE.muted, 'center');
    });
    text(prompt, VIEW.width / 2, y + height - 30, 20, '#f2c94c', 'center', true);
  }

  function drawTitle(state, best) {
    // Sun-soaked title over the living city.
    const grad = ctx.createLinearGradient(0, 0, 0, VIEW.height);
    grad.addColorStop(0, 'rgba(20,12,8,0.55)');
    grad.addColorStop(0.55, 'rgba(20,12,8,0.15)');
    grad.addColorStop(1, 'rgba(20,12,8,0.75)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    text('DUSTLINE', VIEW.width / 2, 132, 92, '#f8f5ee', 'center', true);
    ctx.fillStyle = '#f2c94c';
    ctx.fillRect(VIEW.width / 2 - 120, 152, 240, 5);
    text('AN OPEN-WORLD CRIME GAME', VIEW.width / 2, 190, 20, '#f2c94c', 'center', true);
    text('Mara Quinn is back. Five jobs. One way out.', VIEW.width / 2, 224, 20, PALETTE.text, 'center');
    const lines = [
      'WASD move & drive  •  E steal / enter car  •  F punch  •  Click shoot',
      'Space handbrake  •  P pause  •  M mute  •  Progress saves automatically',
    ];
    if (best && best.missionsDone > 0) lines.push(`Save found: $${best.money} — ${best.missionsDone} mission(s) done. Press Enter to continue.`);
    // Lower panel, clear of the title block above it.
    const width = 640;
    const height = 60 + lines.length * 32 + 64;
    const x = (VIEW.width - width) / 2;
    const y = 268;
    ctx.fillStyle = PALETTE.panel;
    roundRect(ctx, x, y, width, height, 14); ctx.fill();
    ctx.strokeStyle = '#f2c94c';
    ctx.lineWidth = 2;
    roundRect(ctx, x, y, width, height, 14); ctx.stroke();
    lines.forEach((line, i) => {
      text(line, VIEW.width / 2, y + 52 + i * 32, 19, PALETTE.muted, 'center');
    });
    text(best && best.missionsDone > 0 ? 'Press Enter to continue  •  N for a new game' : 'Press Enter to start', VIEW.width / 2, y + height - 26, 20, '#f2c94c', 'center', true);
  }

  function drawBrief(state) {
    const def = MISSIONS[state.mission.index];
    if (!def) return;
    ctx.fillStyle = 'rgba(10,8,12,0.55)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    const lines = [
      `MISSION ${def.id} OF 5 — ${def.title.toUpperCase()}`,
      '',
      ...wrapText(def.brief, 62),
      '',
      `Reward: $${def.reward}   •   Target: ${def.target}`,
    ];
    drawPanel(def.title, lines, 'Press Enter to accept the job', '#f2c94c');
  }

  function wrapText(str, width) {
    const words = str.split(' ');
    const lines = [];
    let line = '';
    for (const word of words) {
      if ((line + ' ' + word).trim().length > width) { lines.push(line.trim()); line = word; }
      else line += ' ' + word;
    }
    if (line.trim()) lines.push(line.trim());
    return lines;
  }

  function drawOver(state) {
    const p = state.player;
    const lines = p.dead
      ? ['Mara went down in the dust.', `Cash kept: $${p.money}`, 'The city does not wait.']
      : ['Busted. The fine stings, the job goes on.', `Cash kept: $${p.money}`];
    drawPanel(p.dead ? 'WASTED' : 'BUSTED', lines, 'Press Enter to get back up', '#ef4444');
  }

  function drawEnd(state) {
    const s = state.stats;
    const lines = [
      'Every job done. Mara Quinn owns Dustline now.',
      `Missions completed: ${s.missionsDone} / 5`,
      `Cash earned: $${s.earned.toLocaleString('en-US')}   •   Cars stolen: ${s.carsStolen}`,
      `Shots fired: ${s.shotsFired}   •   Times busted: ${s.busted}`,
    ];
    drawPanel('DUSTLINE — COMPLETE', lines, 'Press Enter to keep roaming free', '#4ade80');
  }

  function draw(state, screen, best) {
    stateCamera = state.camera;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // Desert beyond the city edge, so the camera never shows a black void.
    ctx.fillStyle = PALETTE.sandDark;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    // World space, camera centred.
    ctx.save();
    ctx.translate(VIEW.width / 2 - state.camera.x, VIEW.height / 2 - state.camera.y);
    drawWorld(state);
    ctx.restore();
    if (screen === SCREEN_TITLE) { drawTitle(state, best); return; }
    drawHud(ctx, state, screen, (wx, wy) => ({
      x: (wx - state.camera.x) + VIEW.width / 2,
      y: (wy - state.camera.y) + VIEW.height / 2,
    }));
    if (screen === SCREEN_BRIEF) drawBrief(state);
    else if (screen === SCREEN_PAUSED) drawPanel('PAUSED', ['The city waits for no one — except right now.', `Cash $${state.player.money}  •  Mission ${state.mission.index + 1} of 5`], 'Press P to resume', '#f2c94c');
    else if (screen === SCREEN_OVER) drawOver(state);
    else if (screen === SCREEN_END) drawEnd(state);
    // Vignette.
    const vg = ctx.createRadialGradient(VIEW.width / 2, VIEW.height / 2, VIEW.height * 0.45, VIEW.width / 2, VIEW.height / 2, VIEW.height * 0.85);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.28)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, view };
}
