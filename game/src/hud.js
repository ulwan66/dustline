// HUD: everything drawn in screen space — money, health, wanted stars, ammo,
// speed, the mission banner, the minimap, toasts and the off-screen target arrow.
// The minimap is the city at a glance: roads, the player, the cops, the target.
import { FONT, PALETTE, VIEW, WORLD, clamp, dist } from './config.js';
import { missionObjective } from './missions.js';

const MAP = { x: VIEW.width - 216, y: 16, size: 200 };

function text(ctx, value, x, y, size, color, align, bold) {
  ctx.font = `${bold ? '700 ' : ''}${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align || 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(value, x, y);
}

function star(ctx, x, y, size, filled) {
  ctx.beginPath();
  for (let i = 0; i < 5; i += 1) {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
    const a2 = a + Math.PI / 5;
    const r1 = size;
    const r2 = size * 0.45;
    ctx.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1);
    ctx.lineTo(x + Math.cos(a2) * r2, y + Math.sin(a2) * r2);
  }
  ctx.closePath();
  ctx.fillStyle = filled ? '#facc15' : 'rgba(248,245,238,0.25)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawMinimap(ctx, state) {
  const p = state.player;
  const s = MAP.size / WORLD.size;
  ctx.fillStyle = 'rgba(12,10,14,0.82)';
  ctx.fillRect(MAP.x - 6, MAP.y - 6, MAP.size + 12, MAP.size + 12);
  ctx.strokeStyle = '#f2c94c';
  ctx.lineWidth = 2;
  ctx.strokeRect(MAP.x - 6, MAP.y - 6, MAP.size + 12, MAP.size + 12);
  // Sand, then the road grid.
  ctx.fillStyle = '#c9924e';
  ctx.fillRect(MAP.x, MAP.y, MAP.size, MAP.size);
  ctx.fillStyle = '#3a3a40';
  for (let i = 0; i < 8; i += 1) {
    const c = (240 + i * 480) * s;
    ctx.fillRect(MAP.x, MAP.y + c - 2, MAP.size, 4);
    ctx.fillRect(MAP.x + c - 2, MAP.y, 4, MAP.size);
  }
  // Downtown blocks glow, faintly, under the roads.
  ctx.fillStyle = 'rgba(255,46,136,0.16)';
  ctx.fillRect(MAP.x + 1200 * s, MAP.y + 1200 * s, 1440 * s, 1440 * s);
  // Mission target.
  const m = state.mission;
  if (m.target && m.stage === 'active') {
    const tx = MAP.x + m.target.x * s;
    const ty = MAP.y + m.target.y * s;
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.moveTo(tx, ty - 7); ctx.lineTo(tx + 6, ty); ctx.lineTo(tx, ty + 7); ctx.lineTo(tx - 6, ty);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1; ctx.stroke();
  }
  // Cops as red dots, player as a white arrow.
  for (const car of state.cars) {
    if (car.driver !== 'cop') continue;
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(MAP.x + car.x * s, MAP.y + car.y * s, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  const px = MAP.x + p.x * s;
  const py = MAP.y + p.y * s;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(p.angle);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(7, 0); ctx.lineTo(-5, -5); ctx.lineTo(-5, 5);
  ctx.closePath(); ctx.fill();
  ctx.restore();
  text(ctx, 'DUSTLINE', MAP.x + MAP.size / 2, MAP.y + MAP.size + 22, 12, PALETTE.muted, 'center');
}

export function drawHud(ctx, state, screen, toScreen) {
  const p = state.player;
  // Top-left: money, health bar, ammo, wanted stars.
  ctx.fillStyle = 'rgba(12,10,14,0.66)';
  ctx.fillRect(14, 14, 250, 96);
  text(ctx, `$${p.money.toLocaleString('en-US')}`, 26, 46, 30, PALETTE.gold, 'left', true);
  ctx.fillStyle = '#3f3f46';
  ctx.fillRect(26, 56, 180, 12);
  ctx.fillStyle = p.health > 40 ? '#4ade80' : '#ef4444';
  ctx.fillRect(26, 56, 180 * clamp(p.health / 100, 0, 1), 12);
  text(ctx, 'HP', 212, 67, 12, PALETTE.text, 'left', true);
  text(ctx, `Ammo ${p.ammo}  •  Pistol`, 26, 92, 14, PALETTE.text, 'left');
  for (let i = 0; i < 5; i += 1) star(ctx, 36 + i * 26, 128, 11, i < p.wanted);
  if (p.wanted > 0) text(ctx, 'WANTED', 170, 133, 13, '#f87171', 'left', true);

  drawMinimap(ctx, state);

  // Bottom: mission objective banner.
  const objective = missionObjective(state);
  if (objective) {
    ctx.font = `600 17px ${FONT}`;
    const w = Math.min(760, ctx.measureText(objective).width + 36);
    ctx.fillStyle = 'rgba(12,10,14,0.78)';
    ctx.fillRect((VIEW.width - w) / 2, VIEW.height - 52, w, 36);
    ctx.fillStyle = '#f2c94c';
    ctx.fillRect((VIEW.width - w) / 2, VIEW.height - 52, 4, 36);
    text(ctx, objective, VIEW.width / 2, VIEW.height - 28, 17, PALETTE.text, 'center');
  }
  // Speed when driving.
  if (p.car && !p.onFoot) {
    const kmh = Math.round(Math.abs(p.car.speed) * 0.18);
    text(ctx, `${kmh}`, VIEW.width - 36, VIEW.height - 84, 44, PALETTE.text, 'right', true);
    text(ctx, 'km/h', VIEW.width - 36, VIEW.height - 60, 13, PALETTE.muted, 'right');
  }
  // Toast message.
  if (state.message.t > 0) {
    ctx.globalAlpha = clamp(state.message.t, 0, 1);
    ctx.font = `700 22px ${FONT}`;
    const w = ctx.measureText(state.message.text).width + 40;
    ctx.fillStyle = 'rgba(12,10,14,0.8)';
    ctx.fillRect((VIEW.width - w) / 2, 120, w, 40);
    text(ctx, state.message.text, VIEW.width / 2, 148, 22, PALETTE.gold, 'center', true);
    ctx.globalAlpha = 1;
  }
  // Off-screen mission target arrow at the screen edge.
  const m = state.mission;
  if (m.target && m.stage === 'active' && screen === 'play') {
    const s = toScreen(m.target.x, m.target.y);
    if (s.x < 40 || s.x > VIEW.width - 40 || s.y < 40 || s.y > VIEW.height - 40) {
      let cx = clamp(s.x, 60, VIEW.width - 60);
      let cy = clamp(s.y, 90, VIEW.height - 90);
      // Keep the arrow clear of the minimap in the top-right corner.
      if (cy < 250 && cx > MAP.x - 60) cx = MAP.x - 60;
      const ang = Math.atan2(s.y - cy, s.x - cx);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(ang);
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.moveTo(16, 0); ctx.lineTo(-8, -10); ctx.lineTo(-8, 10);
      ctx.closePath(); ctx.fill();
      ctx.restore();
      const d = Math.round(dist(p.x, p.y, m.target.x, m.target.y));
      text(ctx, `${d}m`, cx, cy + 30, 13, '#facc15', 'center', true);
    }
  }
  // Early controls hint.
  if (state.time < 25 && screen === 'play') {
    ctx.globalAlpha = clamp(25 - state.time, 0, 1) * 0.9;
    text(ctx, 'WASD move / drive   •   E enter car   •   F punch   •   Click shoot   •   Space handbrake   •   P pause   •   M mute', VIEW.width / 2, VIEW.height - 64, 14, PALETTE.muted, 'center');
    ctx.globalAlpha = 1;
  }
}
