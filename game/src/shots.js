// The screenshot scenes behind ?shot=cover|alarm|getaway|vault. Each one
// loads a real floor and plays the real rules forward with a small
// autopilot — breadth-first paths across the floor's own grid, a pause
// when a cone is about to cross the next step, held E at locks and
// panels — so the frame is a moment the game itself produced, and the
// same scene stages the same frame every time. Nothing here draws or
// fakes anything; it only presses the keys a patient player would.

import { STEP } from './config.js';
import { cellAt, cellCenter, COVER_KINDS, isSolid } from './floors.js';
import { exposureAt } from './vision.js';
import { GUARD } from './config.js';
import { CAMERA } from './config.js';
import { CAMERA_STATE } from './cameras.js';
import { computeMaxBankable, createWorld, loadFloor, SCREEN, stepWorld } from './world.js';

const MAX_STEPS = 60 * 50; // no scene may take longer than 50 game seconds

/** Breadth-first path of cells from one cell to another over open floor. */
function findPath(floor, from, to) {
  const key = (c, r) => `${c},${r}`;
  const passable = (c, r) => {
    const tile = floor.grid[r]?.[c];
    if (tile === undefined) return false;
    if (COVER_KINDS[tile]) return false;
    if (tile === 'D') {
      const door = floor.doors.find((d) => d.col === c && d.row === r);
      return door ? door.open : false;
    }
    return !isSolid(tile);
  };
  const queue = [[from.col, from.row]];
  const came = new Map([[key(from.col, from.row), null]]);
  while (queue.length > 0) {
    const [c, r] = queue.shift();
    if (c === to.col && r === to.row) {
      const path = [];
      let cell = [c, r];
      while (cell) {
        path.unshift({ col: cell[0], row: cell[1] });
        cell = came.get(key(cell[0], cell[1]));
      }
      return path;
    }
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc;
      const nr = r + dr;
      if (!came.has(key(nc, nr)) && passable(nc, nr)) {
        came.set(key(nc, nr), [c, r]);
        queue.push([nc, nr]);
      }
    }
  }
  return null;
}

/** Would a watcher see a thief standing at (x, y) right now? */
function exposureThere(world, x, y) {
  let worst = 0;
  for (const guard of world.guards) {
    worst = Math.max(worst, exposureAt(x, y, guard.x, guard.y, guard.angle, GUARD.coneHalfAngle, GUARD.coneRange, world.rects));
  }
  for (const camera of world.cameras) {
    if (camera.state !== CAMERA_STATE.LIVE) continue;
    worst = Math.max(worst, exposureAt(x, y, camera.x, camera.y, camera.angle, CAMERA.coneHalfAngle, CAMERA.coneRange, world.rects));
  }
  return worst;
}

/** The scripted hand: decisions the autopilot rewrites before every step. */
function createScriptedHand() {
  return {
    vector: { x: 0, y: 0 },
    sneak: false,
    hold: false,
    pendingToss: null,
    /** Queue a coin toss at a stage position, as a click would. */
    tossAt(x, y) { this.pendingToss = { x, y }; },
    moveVector() { return this.vector; },
    sneaking() { return this.sneak; },
    interacting() { return this.hold; },
    pressed() { return false; },
    takeCoinToss() {
      const toss = this.pendingToss;
      this.pendingToss = null;
      return toss;
    },
    takeClick() { return false; },
  };
}

/**
 * Drive the thief to a goal cell, then optionally work (grab/pick) there.
 * Waits, sneaking, whenever the next step would step into a live cone.
 * Returns when the goal is reached, the screen changes, or steps run out.
 */
function goTo(world, hand, goalCell, steps, workSeconds = 0) {
  let worked = 0;
  for (let i = 0; i < steps; i += 1) {
    if (world.screen !== SCREEN.PLAY) return false;
    const thief = world.thief;
    const here = cellAt(thief.x, thief.y);
    const atGoal = here.col === goalCell.col && here.row === goalCell.row;
    const nearGoal = Math.hypot(thief.x - cellCenter(goalCell.col, goalCell.row).x, thief.y - cellCenter(goalCell.col, goalCell.row).y) < 14;
    if ((atGoal || nearGoal) && !thief.task) {
      if (workSeconds === 0) return true;
      // Work: pulse E for a grab, or hold it for a lock or a panel.
      hand.vector = { x: 0, y: 0 };
      hand.hold = true;
      stepWorld(world, STEP, hand);
      worked += STEP;
      if (worked >= workSeconds) return true;
      continue;
    }
    hand.hold = thief.task !== null; // keep holding E while a task runs
    const path = findPath(world.floor, here, goalCell);
    if (!path || path.length < 2) {
      // The next cell may be a locked door: stand adjacent and pick it.
      hand.vector = { x: 0, y: 0 };
      hand.hold = true;
      stepWorld(world, STEP, hand);
      continue;
    }
    const next = cellCenter(path[1].col, path[1].row);
    const dx = next.x - thief.x;
    const dy = next.y - thief.y;
    const dist = Math.hypot(dx, dy) || 1;
    const aheadX = thief.x + (dx / dist) * 26;
    const aheadY = thief.y + (dy / dist) * 26;
    if (exposureThere(world, aheadX, aheadY) > 0.3 && exposureThere(world, thief.x, thief.y) < 0.05) {
      hand.vector = { x: 0, y: 0 }; // wait for the cone to sweep past
      hand.sneak = true;
    } else {
      hand.vector = { x: dx / dist, y: dy / dist };
      hand.sneak = false;
    }
    stepWorld(world, STEP, hand);
  }
  return world.screen === SCREEN.PLAY;
}

/** Stand beside a locked door and hold E until it opens. */
function pickDoor(world, hand, doorCell, steps) {
  const door = world.floor.doors.find((d) => d.col === doorCell.col && d.row === doorCell.row);
  hand.vector = { x: 0, y: 0 };
  hand.sneak = true;
  for (let i = 0; i < steps && world.screen === SCREEN.PLAY; i += 1) {
    if (door && door.open) return true;
    hand.hold = true;
    stepWorld(world, STEP, hand);
  }
  hand.hold = false;
  return door ? door.open : false;
}

/** Idle in place, sneaking, until `condition` holds or steps run out. */
function waitFor(world, hand, steps, condition) {
  hand.vector = { x: 0, y: 0 };
  hand.sneak = true;
  hand.hold = false;
  for (let i = 0; i < steps; i += 1) {
    if (world.screen !== SCREEN.PLAY || condition(world)) return;
    stepWorld(world, STEP, hand);
  }
}

/**
 * Stage the named scene in a fresh world and return it, ready to draw.
 * cover: floor 1, mid-crossing with a painting in the bag.
 * alarm: floor 2, standing in a camera's cone while the meter climbs.
 * getaway: floor 1 again — the portrait taken and the van reached.
 * vault: floor 3, inside the Aurora Vault with the diamond in the bag.
 */
export function stageShot(name) {
  const world = createWorld();
  world.maxBankable = computeMaxBankable(); // the tally screens quote it
  const hand = createScriptedHand();
  if (name === 'alarm') {
    loadFloor(world, 1);
    world.screen = SCREEN.PLAY;
    goTo(world, hand, { col: 26, row: 12 }, MAX_STEPS);
    waitFor(world, hand, 60 * 14, (w) => w.alarm.meter >= 42);
    return world;
  }
  if (name === 'getaway') {
    loadFloor(world, 0);
    world.screen = SCREEN.PLAY;
    goTo(world, hand, { col: 25, row: 7 }, MAX_STEPS); // under the Star Room door
    pickDoor(world, hand, { col: 25, row: 6 }, 60 * 6);
    goTo(world, hand, { col: 26, row: 2 }, MAX_STEPS, 0.3); // grab the portrait
    goTo(world, hand, { col: 3, row: 15 }, MAX_STEPS); // the van
    return world;
  }
  if (name === 'vault') {
    loadFloor(world, 2);
    world.screen = SCREEN.PLAY;
    goTo(world, hand, { col: 18, row: 7 }, MAX_STEPS); // at the vault door
    // The corridor guard patrols past the door: ring a coin across the
    // security wing to pull him away, then pick while he searches.
    const coinSpot = cellCenter(13, 2);
    hand.tossAt(coinSpot.x, coinSpot.y);
    pickDoor(world, hand, { col: 19, row: 7 }, 60 * 8);
    goTo(world, hand, { col: 24, row: 7 }, MAX_STEPS, 0.3); // grab the diamond
    goTo(world, hand, { col: 22, row: 8 }, MAX_STEPS); // pose among the gold
    return world;
  }
  // cover (and any other name): the gallery, mid-crossing.
  loadFloor(world, 0);
  world.screen = SCREEN.PLAY;
  goTo(world, hand, { col: 16, row: 4 }, MAX_STEPS, 0.3); // the tea service
  goTo(world, hand, { col: 17, row: 6 }, MAX_STEPS);
  // Hold the pose until the main-hall guard starts down the hall's east
  // side, so his cone is sweeping the hall when the picture is taken —
  // caught in the first moment of the descent, before he gets close.
  waitFor(world, hand, 60 * 30, (w) => w.guards[1].x > 700 && Math.sin(w.guards[1].angle) > 0.6);
  return world;
}
