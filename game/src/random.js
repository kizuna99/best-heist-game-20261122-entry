// A small seeded random generator (mulberry32). The world seeds it once per
// floor, so patrol timing, sparkle and sound jitter are the same on every
// machine and every run — a heist you can learn, and screenshots that stage
// the same frame twice.

export function createRandom(seed) {
  let state = seed >>> 0;
  return function nextRandom() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A random float in [min, max) from a createRandom stream. */
export function randomRange(nextRandom, min, max) {
  return min + nextRandom() * (max - min);
}

/** A random integer in [min, max] from a createRandom stream. */
export function randomInt(nextRandom, min, max) {
  return min + Math.floor(nextRandom() * (max - min + 1));
}
