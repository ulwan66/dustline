// Keyboard and pointer input for Dustline. Held keys give movement and driving;
// one-shot presses (confirm, pause, enter car, punch, shoot, horn, mute) are queued
// as bit flags and taken once by the loop, so a press between frames is never lost.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_PUNCH = 8;
export const ACTION_SHOOT = 16;
export const ACTION_MUTE = 32;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const RUN = new Set(['ShiftLeft', 'ShiftRight']);
const HANDBRAKE = new Set(['Space']);
const CONFIRM = new Set(['Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const ENTER = new Set(['KeyE']);
const PUNCH = new Set(['KeyF']);
const SHOOT = new Set(['KeyG']);
const MUTE = new Set(['KeyM']);

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    held.add(event.code);
    if (CONFIRM.has(event.code)) actions |= ACTION_CONFIRM;
    else if (PAUSE.has(event.code)) actions |= ACTION_PAUSE;
    else if (ENTER.has(event.code)) actions |= ACTION_ENTER;
    else if (PUNCH.has(event.code)) actions |= ACTION_PUNCH;
    else if (SHOOT.has(event.code)) actions |= ACTION_SHOOT;
    else if (MUTE.has(event.code)) actions |= ACTION_MUTE;
    if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code) || HANDBRAKE.has(event.code)) {
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => { held.delete(event.code); });
  window.addEventListener('blur', () => { held.clear(); mouseDown = false; });
  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
  });
  canvas.addEventListener('pointerdown', (event) => {
    mouseDown = true;
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
    if (event.button === 0) actions |= ACTION_SHOOT;
  });
  window.addEventListener('pointerup', () => { mouseDown = false; });

  const has = (set) => { for (const code of set) if (held.has(code)) return true; return false; };
  return {
    moveX() { return (has(RIGHT) ? 1 : 0) - (has(LEFT) ? 1 : 0); },
    moveY() { return (has(DOWN) ? 1 : 0) - (has(UP) ? 1 : 0); },
    running() { return has(RUN); },
    handbrake() { return has(HANDBRAKE); },
    mouse() { return { x: mouseX, y: mouseY, down: mouseDown }; },
    takeActions() { const taken = actions; actions = 0; return taken; },
  };
}
