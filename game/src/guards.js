// The guards: night staff walking waypoint patrols, each with a vision cone,
// a suspicion meter and a memory. A guard who half-sees something stops and
// stares; one who sees the thief clearly gives chase and shouts the alarm
// up; one who hears a coin land goes to look at it instead — that is the
// coin's whole job. Movement and wall collision are the world's business;
// a guard only decides where it wants to go and how fast.

import { GUARD } from './config.js';
import { cellCenter } from './floors.js';

export const GUARD_MODE = {
  PATROL: 'patrol',
  INVESTIGATE: 'investigate', // walking to a glimpse or a sound
  CHASE: 'chase',
  SEARCH: 'search', // lost the thief, looking around the last known spot
};

/** A fresh guard on the first waypoint of its patrol. */
export function createGuard(definition, index) {
  const [col, row] = definition.waypoints[0];
  const start = cellCenter(col, row);
  const [nextCol, nextRow] = definition.waypoints[1 % definition.waypoints.length];
  const next = cellCenter(nextCol, nextRow);
  return {
    index,
    x: start.x,
    y: start.y,
    radius: GUARD.radius,
    angle: Math.atan2(next.y - start.y, next.x - start.x),
    waypoints: definition.waypoints.map(([c, r]) => cellCenter(c, r)),
    waypointIndex: 1 % definition.waypoints.length,
    waitSeconds: definition.waitSeconds,
    waitTimer: 0,
    mode: GUARD_MODE.PATROL,
    suspicion: 0, // 0 calm .. 1 certain
    lastSeen: null, // {x, y} of the thief, or of a coin that rang
    lastSeenAge: 99, // seconds since the last clear sighting
    searchTimer: 0,
    /** The spot this guard currently wants to reach, and why it matters. */
    get target() {
      if (this.mode === GUARD_MODE.PATROL) return this.waypoints[this.waypointIndex];
      return this.lastSeen ?? this.waypoints[this.waypointIndex];
    },
  };
}

/** How fast this guard wants to move in its current mode, before the world's alarm boost. */
export function guardSpeed(guard) {
  if (guard.mode === GUARD_MODE.CHASE) return GUARD.chaseSpeed;
  if (guard.mode === GUARD_MODE.INVESTIGATE || guard.mode === GUARD_MODE.SEARCH) {
    return GUARD.investigateSpeed;
  }
  return GUARD.patrolSpeed;
}

/**
 * Advance one guard's mind by dt. `exposure` is how clearly it sees the
 * thief this step (0..1, from vision.js); `coin` is a fresh coin landing
 * {x, y} in earshot, or null. Returns events the world acts on:
 * {spotted: boolean} the step the guard becomes certain.
 */
export function stepGuardMind(guard, dt, exposure, coin) {
  const events = { spotted: false };

  if (coin && guard.mode !== GUARD_MODE.CHASE) {
    guard.mode = GUARD_MODE.INVESTIGATE;
    guard.lastSeen = { x: coin.x, y: coin.y };
    guard.lastSeenAge = 0;
    guard.suspicion = Math.max(guard.suspicion, 0.45);
  }

  if (exposure > 0) {
    guard.lastSeenAge = 0;
    // A clear look fills suspicion fast; a glimpse at the cone's edge, slowly.
    guard.suspicion = Math.min(1, guard.suspicion + exposure * dt * 1.9);
    if (guard.suspicion >= 1 && guard.mode !== GUARD_MODE.CHASE) {
      guard.mode = GUARD_MODE.CHASE;
      events.spotted = true;
    } else if (guard.suspicion > 0.35 && guard.mode === GUARD_MODE.PATROL) {
      guard.mode = GUARD_MODE.INVESTIGATE;
    }
    guard.lastSeen = guard.lastSeen ?? null;
  } else {
    guard.lastSeenAge += dt;
    guard.suspicion = Math.max(0, guard.suspicion - dt * 0.22);
    if (guard.mode === GUARD_MODE.CHASE && guard.lastSeenAge > GUARD.memorySeconds) {
      guard.mode = GUARD_MODE.SEARCH;
      guard.searchTimer = 3.2;
      guard.suspicion = 0.6;
    } else if (guard.mode === GUARD_MODE.SEARCH) {
      guard.searchTimer -= dt;
      if (guard.searchTimer <= 0) {
        guard.mode = GUARD_MODE.PATROL;
        guard.suspicion = 0;
      }
    } else if (guard.mode === GUARD_MODE.INVESTIGATE && guard.lastSeenAge > 4.5) {
      guard.mode = GUARD_MODE.PATROL;
      guard.suspicion = 0;
    }
  }
  return events;
}

/** Record a clear sighting position (the world calls this when exposure > 0). */
export function guardSees(guard, x, y) {
  guard.lastSeen = { x, y };
}
