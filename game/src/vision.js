// Seeing, for guards and cameras: vision cones as raycast fans, so a wall, a
// crate or a closed door genuinely blocks a gaze, and a thief behind cover
// is safe until he steps out. Every solid cell of the floor becomes a rect
// (merged into runs, once per floor); a cone is a fan of rays stopped by the
// first rect each ray meets, which is also exactly the polygon the renderer
// draws — what you see is what sees you.

import { CELL, STAGE } from './config.js';
import { COVER_KINDS, isSolid } from './floors.js';

/** Merge a floor's solid cells (walls, closed doors, cover) into rects. */
export function buildSolidRects(floor) {
  const rects = [];
  const closedDoors = new Set(floor.doors.filter((d) => !d.open).map((d) => `${d.col},${d.row}`));
  for (let row = 0; row < floor.grid.length; row += 1) {
    let runStart = -1;
    for (let col = 0; col <= floor.grid[row].length; col += 1) {
      const tile = col < floor.grid[row].length ? floor.grid[row][col] : '.';
      // A locked door is solid only while it is closed; an opened one is a
      // doorway. (isSolid alone would keep a picked door shut forever.)
      const solid = tile === 'D'
        ? closedDoors.has(`${col},${row}`)
        : isSolid(tile) || COVER_KINDS[tile] !== undefined;
      if (solid && runStart === -1) runStart = col;
      if (!solid && runStart !== -1) {
        rects.push({
          x: runStart * CELL,
          y: STAGE.hudHeight + row * CELL,
          w: (col - runStart) * CELL,
          h: CELL,
        });
        runStart = -1;
      }
    }
  }
  return rects;
}

/** Distance from (x, y) along `angle` to the nearest rect, capped at maxDist. */
export function castRay(x, y, angle, maxDist, rects) {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  let best = maxDist;
  for (const rect of rects) {
    // Slab test: where does the ray cross this rect's x and y ranges?
    let tMin = 0;
    let tMax = best;
    if (Math.abs(dx) < 1e-9) {
      if (x < rect.x || x > rect.x + rect.w) continue;
    } else {
      let t1 = (rect.x - x) / dx;
      let t2 = (rect.x + rect.w - x) / dx;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tMin = Math.max(tMin, t1);
      tMax = Math.min(tMax, t2);
      if (tMin > tMax) continue;
    }
    if (Math.abs(dy) < 1e-9) {
      if (y < rect.y || y > rect.y + rect.h) continue;
    } else {
      let t1 = (rect.y - y) / dy;
      let t2 = (rect.y + rect.h - y) / dy;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tMin = Math.max(tMin, t1);
      tMax = Math.min(tMax, t2);
      if (tMin > tMax) continue;
    }
    if (tMin < best) best = tMin;
  }
  return best;
}

/** The visible fan from (x, y): a polygon of ray endpoints around `angle`. */
export function conePolygon(x, y, angle, halfAngle, range, rects) {
  const rays = 26;
  const points = [{ x, y }];
  for (let i = 0; i <= rays; i += 1) {
    const rayAngle = angle - halfAngle + (2 * halfAngle * i) / rays;
    const dist = castRay(x, y, rayAngle, range, rects);
    points.push({ x: x + Math.cos(rayAngle) * dist, y: y + Math.sin(rayAngle) * dist });
  }
  return points;
}

/** True when nothing solid stands between two stage points. */
export function hasLineOfSight(x1, y1, x2, y2, rects) {
  const dist = Math.hypot(x2 - x1, y2 - y1);
  if (dist < 1) return true;
  const angle = Math.atan2(y2 - y1, x2 - x1);
  return castRay(x1, y1, angle, dist, rects) >= dist - 1;
}

/**
 * How exposed a point is to a watcher at (x, y) facing `angle`: 0 when out
 * of the cone or behind something solid, otherwise a 0..1 strength that
 * grows as the point nears the watcher and the cone's centre line.
 */
export function exposureAt(px, py, x, y, angle, halfAngle, range, rects) {
  const dx = px - x;
  const dy = py - y;
  const dist = Math.hypot(dx, dy);
  if (dist > range) return 0;
  let diff = Math.atan2(dy, dx) - angle;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  if (Math.abs(diff) > halfAngle) return 0;
  if (!hasLineOfSight(x, y, px, py, rects)) return 0;
  const centre = 1 - Math.abs(diff) / halfAngle; // 1 dead ahead, 0 at the edge
  const near = 1 - dist / range;
  return Math.min(1, 0.25 + 0.75 * near) * (0.45 + 0.55 * centre);
}
