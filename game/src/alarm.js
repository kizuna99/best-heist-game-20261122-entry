// The alarm: one meter for the whole building, and the game's clock of
// consequences. Being seen pours into it — a guard's eyes fill it slowly, a
// camera's faster, standing close and upright fastest of all. Hiding lets
// it drain. The meter in thirds is the alarm level: each level makes every
// guard quicker. A meter held full past a short grace ends the night.

import { ALARM } from './config.js';

/** A fresh, silent alarm. */
export function createAlarm() {
  return {
    meter: 0, // 0..ALARM.max
    level: 0, // 0, 1, 2 or 3: the meter in thirds
    fullTimer: 0, // seconds the meter has sat full
    busted: false,
    /** The loudest exposure this step, kept for the renderer's eye icon. */
    exposureNow: 0,
  };
}

/**
 * Advance the alarm by dt. `exposure` is the strongest 0..1 sighting of the
 * thief this step across guards and cameras; `sourceRate` scales it (a
 * camera pours faster than a distant guard). Returns {levelUp} when the
 * level rose this step, so the world can sting the sound.
 */
export function stepAlarm(alarm, dt, exposure, sourceRate) {
  const events = { levelUp: false };
  alarm.exposureNow = exposure;
  if (exposure > 0) {
    alarm.meter = Math.min(ALARM.max, alarm.meter + exposure * ALARM.fillRate * sourceRate * dt);
  } else {
    alarm.meter = Math.max(0, alarm.meter - ALARM.decayRate * dt);
  }
  const level = Math.min(3, Math.floor(alarm.meter / (ALARM.max / 3)));
  if (level > alarm.level) events.levelUp = true;
  alarm.level = level;

  if (alarm.meter >= ALARM.max) {
    alarm.fullTimer += dt;
    if (alarm.fullTimer >= ALARM.fullGraceSeconds) alarm.busted = true;
  } else {
    alarm.fullTimer = 0;
  }
  return events;
}
