// The world: Midnight Vault's whole state and the fixed-step simulation
// that advances it. Title, play, the bust, the getaway and the final tally
// are screens of one state machine. The world owns no DOM and no sound —
// each step it returns event names ('pickup', 'spotted', 'emp', ...) and
// the shell in main.js plays them, which is also what lets screenshot
// scenes step the same world silently, driven by a scripted hand.

import { ALARM, CAMERA, GUARD, THIEF, TOOLS } from './config.js';
import { buildFloor, cellAt, FLOOR_COUNT, isSolid, COVER_KINDS } from './floors.js';
import { buildSolidRects, exposureAt } from './vision.js';
import { createGuard, guardSees, guardSpeed, GUARD_MODE, stepGuardMind } from './guards.js';
import { blackoutCameras, CAMERA_STATE, createCamera, cutCamera, stepCamera } from './cameras.js';
import { createAlarm, stepAlarm } from './alarm.js';
import { carriedValue, createThief, holdsStar, thiefProfile, thiefSpeed } from './thief.js';
import { createRandom } from './random.js';

export const SCREEN = {
  TITLE: 'title',
  PLAY: 'play',
  CAUGHT: 'caught',
  FLOOR_CLEAR: 'floor-clear',
  DONE: 'done',
};

/** A whole night, before it starts: three floors, an empty bag, no score. */
export function createWorld() {
  return {
    screen: SCREEN.TITLE,
    floorIndex: 0,
    floor: null,
    rects: [],
    thief: null,
    guards: [],
    cameras: [],
    alarm: createAlarm(),
    rng: createRandom(1),
    elapsed: 0, // seconds on this floor
    totalTime: 0, // seconds across the night
    banked: 0, // loot value already in the van
    maxBankable: 0, // every floor's loot summed, for the final grade
    seenCount: 0, // times a guard became certain
    busts: 0,
    coins: [], // live decoys on the floor: {x, y, age}
    empFlash: 0,
    message: null, // {text, timer} toast under the HUD
    caughtReason: '',
    prevInteract: false,
    prevEmp: false,
    alarmPulseTimer: 0,
  };
}

/** Everything there is to steal in one night, summed over the floors. */
export function computeMaxBankable() {
  let total = 0;
  for (let i = 0; i < FLOOR_COUNT; i += 1) {
    total += buildFloor(i).loot.reduce((sum, item) => sum + item.value, 0);
  }
  return total;
}

/** Begin (or restart) the night from floor 1. */
export function startHeist(world) {
  world.floorIndex = 0;
  world.banked = 0;
  world.totalTime = 0;
  world.seenCount = 0;
  world.busts = 0;
  world.maxBankable = computeMaxBankable();
  loadFloor(world, 0);
  world.screen = SCREEN.PLAY;
}

/** Set up one floor: fresh thief, patrols, cameras and a silent alarm. */
export function loadFloor(world, index) {
  world.floorIndex = index;
  world.floor = buildFloor(index);
  world.rects = buildSolidRects(world.floor);
  world.thief = createThief(world.floor.start);
  world.guards = world.floor.guards.map((def, i) => createGuard(def, i));
  world.cameras = world.floor.cameras.map((def, i) => createCamera(def, i));
  world.alarm = createAlarm();
  world.rng = createRandom(world.floor.seed);
  world.elapsed = 0;
  world.coins = [];
  world.empFlash = 0;
  world.message = { text: world.floor.objective, timer: 5 };
}

/** After a bust: the same floor again, its loot back on the pedestals. */
export function retryFloor(world) {
  loadFloor(world, world.floorIndex);
  world.screen = SCREEN.PLAY;
}

/** After a getaway: bank the bag (done by stepWorld) and move up a floor. */
export function nextFloor(world) {
  if (world.floorIndex + 1 >= FLOOR_COUNT) {
    world.screen = SCREEN.DONE;
    return;
  }
  loadFloor(world, world.floorIndex + 1);
  world.screen = SCREEN.PLAY;
}

/** The night's verdict, from how much was banked and how loud it got. */
export function heistGrade(world) {
  const share = world.maxBankable > 0 ? world.banked / world.maxBankable : 0;
  if (world.seenCount === 0 && share >= 0.9) return 'GHOST — never seen, nearly everything taken';
  if (world.seenCount === 0) return 'GHOST — never seen';
  if (world.seenCount <= 3 && share >= 0.7) return 'PROFESSIONAL — in, out, barely a whisper';
  if (share >= 0.7) return 'LOUD BUT RICH — the papers will love it';
  return 'SURVIVOR — out alive, pockets light';
}

function circleHitsRect(x, y, radius, rect) {
  const nearX = Math.max(rect.x, Math.min(x, rect.x + rect.w));
  const nearY = Math.max(rect.y, Math.min(y, rect.y + rect.h));
  return (x - nearX) ** 2 + (y - nearY) ** 2 < radius * radius;
}

/** Move a circle by (dx, dy), sliding along whatever solid it meets. */
export function moveCircle(body, dx, dy, rects) {
  if (dx !== 0) {
    const nextX = body.x + dx;
    if (!rects.some((rect) => circleHitsRect(nextX, body.y, body.radius, rect))) body.x = nextX;
  }
  if (dy !== 0) {
    const nextY = body.y + dy;
    if (!rects.some((rect) => circleHitsRect(body.x, nextY, body.radius, rect))) body.y = nextY;
  }
}

function say(world, text, seconds = 3.5) {
  world.message = { text, timer: seconds };
}

function caught(world, events, reason) {
  world.screen = SCREEN.CAUGHT;
  world.caughtReason = reason;
  world.busts += 1;
  events.push('caught');
}

/** The nearest thing held E can work on: a lock, a camera panel, or null. */
function findTask(world) {
  const thief = world.thief;
  for (const door of world.floor.doors) {
    if (door.open) continue;
    const dx = thief.x - (door.col * 40 + 20);
    const dy = thief.y - (64 + door.row * 40 + 20);
    if (Math.hypot(dx, dy) < THIEF.interactRange + 14) {
      return { kind: 'lock', ref: door, seconds: door.seconds };
    }
  }
  for (const camera of world.cameras) {
    if (camera.state === CAMERA_STATE.CUT) continue;
    const dx = thief.x - camera.panel.x;
    const dy = thief.y - camera.panel.y;
    if (Math.hypot(dx, dy) < THIEF.interactRange) {
      return { kind: 'cut', ref: camera, seconds: TOOLS.cutSeconds };
    }
  }
  return null;
}

/** Advance the world one fixed step; returns the step's event names. */
export function stepWorld(world, dt, input) {
  const events = [];
  if (world.screen === SCREEN.TITLE) {
    // The building idles behind the title: patrols walk, cameras sweep.
    world.elapsed += dt;
    for (const camera of world.cameras) stepCamera(camera, dt, world.elapsed);
    stepGuards(world, dt, null, events);
    return events;
  }
  if (world.screen !== SCREEN.PLAY) return events;

  const thief = world.thief;
  world.elapsed += dt;
  world.totalTime += dt;
  if (world.message && world.message.timer > 0) world.message.timer -= dt;
  if (world.empFlash > 0) world.empFlash -= dt;

  // --- Hands: coin toss and EMP -------------------------------------------
  const toss = input.takeCoinToss();
  if (toss && thief.coinsLeft > 0) {
    const cell = cellAt(toss.x, toss.y);
    const tile = world.floor.grid[cell.row]?.[cell.col];
    if (tile !== undefined && !isSolid(tile) && !COVER_KINDS[tile]) {
      thief.coinsLeft -= 1;
      world.coins.push({ x: toss.x, y: toss.y, age: 0 });
      events.push('coin');
      say(world, 'The coin sings. Every guard nearby turns to listen.');
    }
  }
  const empNow = input.pressed('KeyF');
  if (empNow && !world.prevEmp && thief.empLeft > 0) {
    thief.empLeft -= 1;
    blackoutCameras(world.cameras);
    world.empFlash = 0.4;
    events.push('emp');
    say(world, 'EMP! Every camera is dark for eight seconds.');
  }
  world.prevEmp = empNow;

  // --- Feet ----------------------------------------------------------------
  const move = input.moveVector();
  thief.sneaking = input.sneaking();
  thief.moving = move.x !== 0 || move.y !== 0;
  if (thief.moving) {
    thief.angle = Math.atan2(move.y, move.x);
    const speed = thiefSpeed(thief, thief.sneaking);
    moveCircle(thief, move.x * speed * dt, move.y * speed * dt, world.rects);
    thief.stepTimer -= dt;
    if (thief.stepTimer <= 0) {
      events.push(thief.sneaking ? 'step-quiet' : 'step');
      thief.stepTimer = thief.sneaking ? 0.42 : 0.3;
    }
  }

  // --- Held E: grab, pick, cut --------------------------------------------
  const interacting = input.interacting();
  stepInteraction(world, dt, interacting, events);
  world.prevInteract = interacting;

  // --- Eyes ----------------------------------------------------------------
  for (const camera of world.cameras) stepCamera(camera, dt, world.elapsed);
  const profile = thiefProfile(thief);
  let exposure = 0;
  let exposureRate = 1;
  for (const guard of world.guards) {
    const seen = exposureAt(
      thief.x, thief.y, guard.x, guard.y, guard.angle,
      GUARD.coneHalfAngle, GUARD.coneRange, world.rects,
    ) * profile;
    if (seen > 0) guardSees(guard, thief.x, thief.y);
    guard.exposure = seen;
    if (seen > exposure) { exposure = seen; exposureRate = 1; }
  }
  for (const camera of world.cameras) {
    if (camera.state !== CAMERA_STATE.LIVE) { camera.exposure = 0; continue; }
    const seen = exposureAt(
      thief.x, thief.y, camera.x, camera.y, camera.angle,
      CAMERA.coneHalfAngle, CAMERA.coneRange, world.rects,
    ) * profile;
    camera.exposure = seen;
    if (seen > exposure) { exposure = seen; exposureRate = 1.3; } // cameras pour faster
  }

  // Guards think, then move.
  stepGuards(world, dt, exposure, events);
  for (const guard of world.guards) {
    if (guard.mode === GUARD_MODE.CHASE
      && Math.hypot(guard.x - thief.x, guard.y - thief.y) < GUARD.catchRange) {
      caught(world, events, `Guard ${guard.index + 1} got a hand on your collar.`);
      return events;
    }
  }

  // --- The alarm -------------------------------------------------------------
  const alarmEvents = stepAlarm(world.alarm, dt, exposure, exposureRate);
  if (alarmEvents.levelUp) {
    events.push('alarm-up');
    say(world, `Alarm level ${world.alarm.level}! The guards pick up the pace.`);
  }
  if (world.alarm.level >= 2) {
    world.alarmPulseTimer -= dt;
    if (world.alarmPulseTimer <= 0) {
      events.push('alarm-pulse');
      world.alarmPulseTimer = 1.1;
    }
  }
  if (world.alarm.busted) {
    caught(world, events, 'The alarm sat at full blast too long. The building locked down.');
    return events;
  }

  // Decoys ring out and fade.
  for (const coin of world.coins) coin.age += dt;
  world.coins = world.coins.filter((coin) => coin.age < TOOLS.coinGuardSeconds + 1.5);

  // --- The van ---------------------------------------------------------------
  if (holdsStar(thief)) {
    const cell = cellAt(thief.x, thief.y);
    if (world.floor.exits.some((exit) => exit.col === cell.col && exit.row === cell.row)) {
      world.banked += carriedValue(thief);
      events.push(world.floorIndex + 1 >= FLOOR_COUNT ? 'done' : 'clear');
      world.screen = world.floorIndex + 1 >= FLOOR_COUNT ? SCREEN.DONE : SCREEN.FLOOR_CLEAR;
    }
  }
  return events;
}

/** One step of interaction: instant loot grabs, held-E locks and cuts. */
function stepInteraction(world, dt, interacting, events) {
  const thief = world.thief;
  if (interacting && !world.prevInteract) {
    for (const item of world.floor.loot) {
      if (!item.taken && Math.hypot(item.x - thief.x, item.y - thief.y) < THIEF.interactRange) {
        item.taken = true;
        thief.carried.push(item);
        events.push(item.star ? 'pickup-star' : 'pickup');
        say(world, item.star
          ? `${item.name} is in the bag — GET TO THE VAN!`
          : `Bagged: ${item.name} (+$${item.value.toLocaleString('en-US')})`);
        return;
      }
    }
  }

  const wanted = interacting ? findTask(world) : null;
  if (!wanted) {
    thief.task = null;
    return;
  }
  if (!thief.task || thief.task.ref !== wanted.ref) {
    thief.task = { ...wanted, progress: 0, tickTimer: 0 };
  }
  thief.task.progress += dt;
  thief.task.tickTimer -= dt;
  if (thief.task.kind === 'lock' && thief.task.tickTimer <= 0) {
    events.push('lock-tick');
    thief.task.tickTimer = 0.28;
  }
  if (thief.task.progress >= thief.task.seconds) {
    if (thief.task.kind === 'lock') {
      thief.task.ref.open = true;
      world.rects = buildSolidRects(world.floor);
      events.push('lock-open');
      say(world, 'The lock gives. The door swings wide.');
    } else {
      cutCamera(thief.task.ref);
      events.push('cut');
      say(world, 'Snip. That camera watches nothing now.');
    }
    thief.task = null;
  }
}

/**
 * Guards think and walk. In play, `exposure` is the thief's visibility to
 * each guard (read off guard.exposure, set by the caller); on the title
 * screen it is null and the guards simply patrol for the backdrop.
 */
function stepGuards(world, dt, exposure, events) {
  const thief = world.thief;
  for (const guard of world.guards) {
    let coin = null;
    for (const live of world.coins) {
      if (live.age < 0.1 && Math.hypot(live.x - guard.x, live.y - guard.y) < 300) coin = live;
    }
    if (exposure !== null) {
      const mind = stepGuardMind(guard, dt, guard.exposure ?? 0, coin);
      if (mind.spotted) {
        world.seenCount += 1;
        world.alarm.meter = Math.min(ALARM.max, world.alarm.meter + 7);
        events.push('spotted');
        say(world, 'SPOTTED! Break line of sight — hide behind cover!');
      }
    }
    // Walk toward the target; wait at patrol waypoints; scan while waiting.
    const target = guard.target;
    const chasing = guard.mode === GUARD_MODE.CHASE && thief && exposure !== null;
    const goal = chasing ? { x: thief.x, y: thief.y } : target;
    const gx = goal.x - guard.x;
    const gy = goal.y - guard.y;
    const goalDist = Math.hypot(gx, gy);
    if (guard.waitTimer > 0) {
      guard.waitTimer -= dt;
      guard.angle += Math.sin(world.elapsed * 0.9 + guard.index * 2.1) * dt * 0.7;
    } else if (goalDist > 6) {
      const speed = guardSpeed(guard) * (1 + world.alarm.level * ALARM.speedPerLevel);
      const stepX = (gx / goalDist) * speed * dt;
      const stepY = (gy / goalDist) * speed * dt;
      moveCircle(guard, stepX, stepY, world.rects);
      guard.angle = Math.atan2(gy, gx);
    } else if (guard.mode === GUARD_MODE.PATROL) {
      guard.waitTimer = guard.waitSeconds;
      guard.waypointIndex = (guard.waypointIndex + 1) % guard.waypoints.length;
    } else if (guard.mode === GUARD_MODE.INVESTIGATE) {
      // Arrived at the glimpse or the coin: stop and search the spot for a
      // few seconds before giving it up — this linger is the coin's value.
      guard.mode = GUARD_MODE.SEARCH;
      guard.searchTimer = 2.4;
      guard.angle += dt * 1.4;
    } else if (guard.mode === GUARD_MODE.SEARCH) {
      guard.angle += dt * 1.4; // the mind runs the search timer down
    }
  }
}
