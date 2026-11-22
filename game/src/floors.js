// The three floors of the Marlowe building, one a night-shift of the same
// job: the Gallery, the Counting House and the Aurora Vault. Each floor is a
// 32x16 map of 40px cells plus lists of the people and things in it, so a
// floor is data, not code — the world parses it into walls, cover, doors,
// loot, patrols and cameras.
//
// Map letters: # wall · . open floor · d open doorway · D locked door
// (picked with held E) · V vent grate (a low way through a wall) · X the
// street outside, where the van waits · S the thief's way in.

import { CELL, STAGE } from './config.js';

export const TILE = {
  WALL: '#',
  FLOOR: '.',
  DOORWAY: 'd',
  LOCKED_DOOR: 'D',
  VENT: 'V',
  STREET: 'X',
  START: 'S',
};

/** Cells that stop a body and a gaze: walls and closed locked doors. */
export function isSolid(tile) {
  return tile === TILE.WALL || tile === TILE.LOCKED_DOOR;
}

/** Cells that stop sight but are furniture, drawn over the floor. */
export const COVER_KINDS = { C: 'crate', T: 'table', P: 'plant' };

const FLOOR_DATA = [
  {
    name: 'Floor 1 — The Marlowe Gallery',
    objective: 'Steal the Aurora Portrait from the Star Room',
    seed: 1101,
    lockSeconds: 2.2,
    map: [
      '################################',
      '#.........#..........#.........#',
      '#.........#..........#.........#',
      '#.........#..........#.........#',
      '#.........V..........#.........#',
      '#.........#..........#.........#',
      '#.........#..........####D######',
      '#.........#....................#',
      '#.........#....................#',
      '#.........#....####d#####......#',
      '#.........d....................#',
      '#.........#....................#',
      '#.........#....................#',
      '#.........#....................#',
      '#.S.......#....................#',
      '###XXX##########################',
    ],
    rooms: [
      { x: 0, y: 0, w: 10, h: 16, style: 'wood', label: 'WEST GALLERY' },
      { x: 11, y: 0, w: 10, h: 9, style: 'marble', label: 'MAIN HALL' },
      { x: 22, y: 0, w: 10, h: 6, style: 'carpet', label: 'STAR ROOM' },
      { x: 22, y: 7, w: 10, h: 9, style: 'wood', label: 'EAST WING' },
      { x: 11, y: 10, w: 10, h: 6, style: 'carpet', label: 'GIFT SHOP' },
    ],
    cover: [[5, 4, 'C'], [17, 12, 'C'], [6, 12, 'T'], [26, 9, 'T'], [14, 5, 'P'], [29, 14, 'P']],
    guards: [
      { waypoints: [[2, 2], [8, 2], [8, 7], [2, 7]], waitSeconds: 1.6 },
      { waypoints: [[12, 2], [19, 2], [19, 8], [12, 8]], waitSeconds: 2.2 },
      { waypoints: [[23, 8], [29, 8], [29, 13], [23, 13]], waitSeconds: 1.8 },
    ],
    cameras: [
      { cell: [15, 1], baseAngle: Math.PI / 2, sweep: 0.65, panel: [13, 2] },
    ],
    loot: [
      { cell: [3, 1], name: 'The Drowned Sailor, oil on canvas', value: 4000 },
      { cell: [16, 4], name: 'Silver tea service', value: 1500 },
      { cell: [6, 13], name: 'Gift-shop till', value: 600 },
      { cell: [27, 12], name: 'Bronze fox', value: 2500 },
      { cell: [26, 2], name: 'THE AURORA PORTRAIT', value: 10000, star: true },
    ],
  },
  {
    name: 'Floor 2 — The Counting House',
    objective: 'Steal the St. Bride Ledger from the Strong Room',
    seed: 2202,
    lockSeconds: 2.6,
    map: [
      '################################',
      '#..............#.......#.......#',
      '#..............#.......D.......#',
      '#..............#.......#.......#',
      '#..............#.......#.......#',
      '#######d########.......#########',
      '#..............#...............#',
      '#..............d...............#',
      '#..............#...............#',
      '#..............#...............#',
      '#..............#########d#######',
      '#..............#...............#',
      '#..............V...............#',
      '#..............#...............#',
      '#.S............#...............#',
      '###XXX##########################',
    ],
    rooms: [
      { x: 0, y: 0, w: 15, h: 5, style: 'carpet', label: "CLERKS' HALL" },
      { x: 25, y: 0, w: 7, h: 5, style: 'steel', label: 'STRONG ROOM' },
      { x: 16, y: 0, w: 8, h: 10, style: 'wood', label: "MANAGER'S OFFICE" },
      { x: 0, y: 6, w: 15, h: 10, style: 'wood', label: 'BACK OFFICE' },
      { x: 16, y: 11, w: 16, h: 5, style: 'carpet', label: 'ARCHIVE' },
    ],
    cover: [[5, 10, 'C'], [20, 7, 'C'], [9, 3, 'T'], [25, 12, 'T'], [18, 13, 'T'], [13, 13, 'P']],
    guards: [
      { waypoints: [[2, 2], [13, 2], [13, 4], [2, 4]], waitSeconds: 1.4 },
      { waypoints: [[3, 8], [12, 8], [12, 13], [3, 13]], waitSeconds: 2.0 },
      { waypoints: [[17, 2], [22, 4], [22, 8], [17, 8]], waitSeconds: 1.7 },
    ],
    cameras: [
      { cell: [14, 1], baseAngle: Math.PI / 2, sweep: 0.6, panel: [13, 2] },
      { cell: [29, 11], baseAngle: Math.PI, sweep: 0.5, panel: [28, 11] },
    ],
    loot: [
      { cell: [7, 2], name: 'Bearer bonds, untraceable', value: 3000 },
      { cell: [12, 12], name: 'Jeweled watch collection', value: 3500 },
      { cell: [20, 13], name: 'Stamp album, 1840', value: 2200 },
      { cell: [18, 4], name: 'Ivory chess set', value: 1800 },
      { cell: [27, 2], name: 'THE ST. BRIDE LEDGER', value: 14000, star: true },
    ],
  },
  {
    name: 'Floor 3 — The Aurora Vault',
    objective: 'Crack the vault and take the Aurora Diamond',
    seed: 3303,
    lockSeconds: 3.0,
    map: [
      '################################',
      '#........#.....................#',
      '#........#.....................#',
      '#........d.....................#',
      '#........#.........#############',
      '#........#.........#...........#',
      '#........#.........#...........#',
      '#........#.........D...........#',
      '#........######d####...........#',
      '#........#.........#...........#',
      '#........#.........#...........#',
      '#........V.........#############',
      '#........#.....................#',
      '#........#.....................#',
      '#.S......#.....................#',
      '###XXX##########################',
    ],
    rooms: [
      { x: 0, y: 0, w: 9, h: 16, style: 'marble', label: 'LOBBY' },
      { x: 10, y: 0, w: 8, h: 8, style: 'carpet', label: 'SECURITY WING' },
      { x: 19, y: 0, w: 13, h: 4, style: 'marble', label: 'VAULT APPROACH' },
      { x: 19, y: 4, w: 13, h: 8, style: 'steel', label: 'THE AURORA VAULT' },
      { x: 10, y: 9, w: 8, h: 7, style: 'wood', label: 'COUNTING ROOM' },
      { x: 19, y: 12, w: 13, h: 4, style: 'carpet', label: 'BULLION STORE' },
    ],
    cover: [[5, 4, 'C'], [14, 4, 'C'], [20, 13, 'C'], [6, 10, 'T'], [14, 12, 'P'], [22, 9, 'C']],
    guards: [
      { waypoints: [[2, 2], [7, 2], [7, 13], [2, 13]], waitSeconds: 1.5 },
      { waypoints: [[11, 2], [16, 2], [16, 6], [11, 6]], waitSeconds: 1.9 },
      { waypoints: [[11, 10], [16, 10], [16, 14], [11, 14]], waitSeconds: 2.1 },
      { waypoints: [[12, 7], [17, 7], [17, 5], [12, 5]], waitSeconds: 0.8 },
    ],
    cameras: [
      { cell: [8, 1], baseAngle: Math.PI / 2, sweep: 0.6, panel: [7, 2] },
      { cell: [17, 3], baseAngle: 0.9, sweep: 0.5, panel: [16, 3] },
      { cell: [29, 5], baseAngle: Math.PI, sweep: 0.7, panel: [28, 5] },
    ],
    loot: [
      { cell: [4, 7], name: 'Jeweled hen egg', value: 4200 },
      { cell: [13, 12], name: 'Cash bricks', value: 3500 },
      { cell: [21, 5], name: 'Gold bars, four', value: 6000 },
      { cell: [27, 9], name: 'Crown sapphires', value: 5000 },
      { cell: [24, 7], name: 'THE AURORA DIAMOND', value: 25000, star: true },
    ],
  },
];

/** The centre of a map cell, in stage pixels. */
export function cellCenter(col, row) {
  return { x: col * CELL + CELL / 2, y: STAGE.hudHeight + row * CELL + CELL / 2 };
}

/** The map cell a stage position falls in. */
export function cellAt(x, y) {
  return {
    col: Math.floor(x / CELL),
    row: Math.floor((y - STAGE.hudHeight) / CELL),
  };
}

/**
 * Parse floor `index` into a fresh, mutable floor: the tile grid with cover
 * laid over it, the locked doors with their pick times, the loot still on
 * its pedestals, and the patrol and camera definitions the world animates.
 */
export function buildFloor(index) {
  const data = FLOOR_DATA[index];
  const grid = data.map.map((row) => row.split(''));
  for (const [col, row, kind] of data.cover) grid[row][col] = kind;

  let start = { x: 60, y: 660 };
  const exits = [];
  const doors = [];
  for (let row = 0; row < grid.length; row += 1) {
    for (let col = 0; col < grid[row].length; col += 1) {
      const tile = grid[row][col];
      if (tile === TILE.START) {
        start = cellCenter(col, row);
        grid[row][col] = TILE.FLOOR;
      }
      if (tile === TILE.STREET) exits.push({ col, row, ...cellCenter(col, row) });
      if (tile === TILE.LOCKED_DOOR) {
        doors.push({ col, row, seconds: data.lockSeconds, progress: 0, open: false });
      }
    }
  }

  return {
    index,
    name: data.name,
    objective: data.objective,
    seed: data.seed,
    grid,
    rooms: data.rooms,
    start,
    exits,
    doors,
    guards: data.guards,
    cameras: data.cameras,
    loot: data.loot.map((item) => ({ ...item, ...cellCenter(item.cell[0], item.cell[1]), taken: false })),
  };
}

export const FLOOR_COUNT = FLOOR_DATA.length;
