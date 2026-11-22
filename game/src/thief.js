// The thief: one person, a bag, and a small kit of tools that all cost
// something. Movement is velocity toward the held keys, slower and lower
// while sneaking; the bag fills with whatever the world hands over, and the
// tools — coins for a guard's ears, EMP charges for the cameras' eyes —
// are counted here so the HUD and the world read the same numbers.

import { THIEF, TOOLS } from './config.js';

/** A fresh thief at the floor's way in, tools stocked, bag empty. */
export function createThief(start) {
  return {
    x: start.x,
    y: start.y,
    radius: THIEF.radius,
    angle: -Math.PI / 2, // facing into the room
    moving: false,
    sneaking: false,
    coinsLeft: TOOLS.coins,
    empLeft: TOOLS.empCharges,
    carried: [], // loot items in the bag, banked only at the van
    /** What held E is working on: {kind, ref, progress, seconds} or null. */
    task: null,
    /** Seconds since the last footstep sound, for the audio's stride. */
    stepTimer: 0,
  };
}

/** The thief's speed this step: sneaking is slow, and that is the point. */
export function thiefSpeed(thief, sneaking) {
  return sneaking ? THIEF.sneakSpeed : THIEF.walkSpeed;
}

/**
 * How visible the thief is to a watcher who has line of sight: sneaking
 * halves it, standing still helps a little, walking upright in the open is
 * the full, foolish one.
 */
export function thiefProfile(thief) {
  if (thief.sneaking) return THIEF.sneakProfile;
  if (!thief.moving) return THIEF.stillProfile;
  return 1;
}

/** The value in the bag right now — lost if the night ends in a bust. */
export function carriedValue(thief) {
  return thief.carried.reduce((sum, item) => sum + item.value, 0);
}

/** Has the floor's star piece been taken (in the bag or already banked)? */
export function holdsStar(thief) {
  return thief.carried.some((item) => item.star);
}
