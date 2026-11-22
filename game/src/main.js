// Midnight Vault's shell: the canvas, the fixed-step loop, the screens'
// keys, and the wiring from world events to synthesised sound. The world
// itself (world.js) knows nothing of the DOM; this file owns it.
//
// With ?shot=<name> in the URL there is no loop and no sound: the named
// scene is staged by shots.js and drawn once, which is how the maker's
// screenshots are taken — the same code a player runs, posed by its own
// autopilot.

import { STEP, STAGE } from './config.js';
import { createInput } from './input.js';
import { drawWorld } from './render.js';
import {
  createWorld, loadFloor, nextFloor, retryFloor, SCREEN, startHeist, stepWorld,
} from './world.js';
import { stageShot } from './shots.js';
import {
  isMuted, soundAlarmPulse, soundAlarmRise, soundCameraCut, soundCaught, soundCoinToss,
  soundEmp, soundFloorClear, soundFootstep, soundHeistDone, soundLockOpen, soundLockTick,
  soundPickup, soundSpotted, toggleMuted, unlockAudio,
} from './audio.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = STAGE.width;
canvas.height = STAGE.height;
const status = document.getElementById('status');

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');

if (shotName !== null) {
  const world = stageShot(shotName);
  drawWorld(ctx, world, {});
  window.__shotReady = true;
} else {
  const world = createWorld();
  loadFloor(world, 0); // the gallery idles behind the title screen
  world.screen = SCREEN.TITLE;
  const input = createInput(canvas);
  let lastScreen = world.screen;

  const SOUNDS = {
    pickup: () => soundPickup(false),
    'pickup-star': () => soundPickup(true),
    coin: () => soundCoinToss(),
    emp: () => soundEmp(),
    'lock-tick': () => soundLockTick(),
    'lock-open': () => soundLockOpen(),
    cut: () => soundCameraCut(),
    spotted: () => soundSpotted(),
    'alarm-up': () => soundAlarmRise(),
    'alarm-pulse': () => soundAlarmPulse(),
    caught: () => soundCaught(),
    clear: () => soundFloorClear(),
    done: () => soundHeistDone(),
    step: () => soundFootstep(false),
    'step-quiet': () => soundFootstep(true),
  };

  function announce() {
    if (world.screen === lastScreen) return;
    lastScreen = world.screen;
    const lines = {
      [SCREEN.TITLE]: 'Midnight Vault. Press Enter to start the heist.',
      [SCREEN.PLAY]: `${world.floor.name}. ${world.floor.objective}.`,
      [SCREEN.CAUGHT]: `Busted. ${world.caughtReason} Press R to try again.`,
      [SCREEN.FLOOR_CLEAR]: 'Clean getaway. Press Enter for the next floor.',
      [SCREEN.DONE]: 'The night is yours. Press Enter to play again.',
    };
    if (status) status.textContent = lines[world.screen] ?? '';
  }

  window.addEventListener('keydown', (event) => {
    unlockAudio();
    if (event.code === 'KeyM') toggleMuted();
    if (world.screen === SCREEN.TITLE && (event.code === 'Enter' || event.code === 'Space')) {
      startHeist(world);
    } else if (world.screen === SCREEN.CAUGHT && event.code === 'KeyR') {
      retryFloor(world);
    } else if (world.screen === SCREEN.FLOOR_CLEAR && event.code === 'Enter') {
      nextFloor(world);
    } else if (world.screen === SCREEN.DONE && event.code === 'Enter') {
      startHeist(world);
    }
  });
  canvas.addEventListener('pointerdown', () => {
    unlockAudio();
    if (world.screen === SCREEN.TITLE) startHeist(world);
  });

  let accumulator = 0;
  let lastTime = performance.now();
  function frame(now) {
    accumulator += Math.min(0.25, (now - lastTime) / 1000);
    lastTime = now;
    while (accumulator >= STEP) {
      const events = stepWorld(world, STEP, input);
      for (const event of events) SOUNDS[event]?.();
      accumulator -= STEP;
    }
    announce();
    drawWorld(ctx, world, { muted: isMuted() });
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
