// Every tuning number and colour of Midnight Vault in one place. The world is
// a fixed 1280x720 logical stage: a 64px HUD bar over a 32x16 grid of 40px
// cells. The renderer scales the stage to the window, so no rule below ever
// depends on the screen size.

export const STAGE = { width: 1280, height: 720, hudHeight: 64 };
export const CELL = 40;
export const COLS = 32;
export const ROWS = 16;

/** The simulation's fixed step, in seconds: 60 updates a second at any refresh rate. */
export const STEP = 1 / 60;

export const THIEF = {
  radius: 13,
  walkSpeed: 168,
  sneakSpeed: 92,
  interactRange: 46,
  /** Detection multiplier while sneaking: a low profile is harder to see. */
  sneakProfile: 0.5,
  /** Detection multiplier while standing still in the open. */
  stillProfile: 0.8,
};

export const GUARD = {
  radius: 14,
  patrolSpeed: 74,
  investigateSpeed: 118,
  chaseSpeed: 176,
  coneRange: 196,
  coneHalfAngle: 0.56, // radians, about 32 degrees
  catchRange: 30,
  /** Seconds a guard must lose sight of the thief before giving up the chase. */
  memorySeconds: 2.4,
};

export const CAMERA = {
  coneRange: 176,
  coneHalfAngle: 0.5,
  sweepSpeed: 0.55, // radians per second at the centre of the swing
  /** Seconds an EMP charge keeps every camera dark. */
  empSeconds: 8,
};

export const ALARM = {
  max: 100,
  /** Meter gained per second at point-blank detection, before distance scaling. */
  fillRate: 46,
  /** Meter shed per second while nobody sees the thief. */
  decayRate: 7,
  /** Seconds the meter may sit full before the night ends in a bust. */
  fullGraceSeconds: 1.6,
  /** Extra guard speed for each alarm level (the meter in thirds). */
  speedPerLevel: 0.13,
};

export const TOOLS = {
  coins: 3,
  empCharges: 2,
  /** Seconds of held E to pick a lock; the vault door takes longer (floors.js). */
  lockpickSeconds: 2.2,
  /** Seconds of held E at a camera's wall panel to cut that camera for good. */
  cutSeconds: 1.6,
  coinGuardSeconds: 3.2, // how long a tossed coin holds a guard's attention
};

export const PALETTE = {
  backdrop: '#07090f',
  hudBar: '#0d1220',
  hudEdge: '#2b3550',
  wall: '#39415a',
  wallTop: '#4a5474',
  door: '#7a5c33',
  vent: '#232c42',
  thief: '#ffd34d',
  thiefCoat: '#20242e',
  guard: '#e5534b',
  guardUniform: '#5a2326',
  cameraBody: '#9fb4c8',
  coneCalm: 'rgba(255, 209, 77, 0.20)',
  coneAlert: 'rgba(255, 84, 60, 0.34)',
  cameraCone: 'rgba(94, 200, 255, 0.16)',
  cameraConeAlert: 'rgba(255, 84, 60, 0.30)',
  loot: '#57e6a3',
  lootStar: '#ffe066',
  alarmLow: '#57e6a3',
  alarmMid: '#ffb340',
  alarmHigh: '#ff5040',
  text: '#eef1f5',
  muted: '#8b93a3',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best haul is kept between visits (this browser only). */
export const BEST_KEY = 'midnight-vault.best';
