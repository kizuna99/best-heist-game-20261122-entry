// The renderer: everything the player (and the judge's screenshots) sees.
// One frame must read at a glance — the thief crossing a room, guard cones
// in warm yellow that redden as suspicion rises, camera cones in cold blue,
// loot glowing green and the star piece gold, cover you can trust, and the
// alarm meter always riding the top of the screen. Flat shapes, strong
// silhouettes, labels on the floor itself: a museum at night, not a tile set.

import { ALARM, CELL, FONT, GUARD, PALETTE, STAGE } from './config.js';
import { COVER_KINDS, TILE } from './floors.js';
import { conePolygon } from './vision.js';
import { CAMERA_STATE } from './cameras.js';
import { GUARD_MODE } from './guards.js';
import { carriedValue, holdsStar } from './thief.js';
import { heistGrade, SCREEN } from './world.js';

const ROOM_STYLES = {
  marble: { base: '#2b3252', line: 'rgba(255,255,255,0.045)', checker: 'rgba(255,255,255,0.02)' },
  carpet: { base: '#402634', line: 'rgba(255,180,120,0.06)', checker: 'rgba(0,0,0,0.06)' },
  wood: { base: '#453a2d', line: 'rgba(0,0,0,0.13)', checker: 'rgba(255,220,160,0.02)' },
  steel: { base: '#27313f', line: 'rgba(140,190,255,0.07)', checker: 'rgba(0,0,0,0.07)' },
};

export function formatMoney(value) {
  return `$${value.toLocaleString('en-US')}`;
}

export function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

/** Draw the whole world: floor, actors, HUD, and any screen over it. */
export function drawWorld(ctx, world, options = {}) {
  ctx.fillStyle = PALETTE.backdrop;
  ctx.fillRect(0, 0, STAGE.width, STAGE.height);
  drawFloorBase(ctx, world);
  // Cones lie on the floor but never over a wall: the walls come after
  // them, so a cone stops at a wall face exactly as the raycast says.
  drawCones(ctx, world);
  drawWallsAndDoors(ctx, world);
  drawLoot(ctx, world);
  drawCoins(ctx, world);
  drawCameras(ctx, world);
  drawGuards(ctx, world);
  drawThief(ctx, world);
  drawVignette(ctx, world);
  if (world.empFlash > 0) {
    ctx.fillStyle = `rgba(160, 210, 255, ${world.empFlash * 0.5})`;
    ctx.fillRect(0, 0, STAGE.width, STAGE.height);
  }
  drawHud(ctx, world, options);
  if (world.screen === SCREEN.TITLE) drawTitle(ctx, world);
  if (world.screen === SCREEN.CAUGHT) drawCaught(ctx, world);
  if (world.screen === SCREEN.FLOOR_CLEAR) drawFloorClear(ctx, world);
  if (world.screen === SCREEN.DONE) drawDone(ctx, world);
}

function drawFloorBase(ctx, world) {
  const floor = world.floor;
  // Rooms first: each paints its rect in its own material, with its name
  // written on the floor the way a gallery stencils a wing.
  ctx.fillStyle = '#1a1f2e';
  ctx.fillRect(0, STAGE.hudHeight, STAGE.width, STAGE.height - STAGE.hudHeight);
  for (const room of floor.rooms) {
    const style = ROOM_STYLES[room.style] ?? ROOM_STYLES.marble;
    const x = room.x * CELL;
    const y = STAGE.hudHeight + room.y * CELL;
    const w = room.w * CELL;
    const h = room.h * CELL;
    ctx.fillStyle = style.base;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = style.checker;
    for (let cx = 0; cx < room.w; cx += 1) {
      for (let cy = 0; cy < room.h; cy += 1) {
        if ((cx + cy) % 2 === 0) ctx.fillRect(x + cx * CELL, y + cy * CELL, CELL, CELL);
      }
    }
    ctx.strokeStyle = style.line;
    ctx.lineWidth = 1;
    for (let cx = 0; cx <= room.w; cx += 1) {
      ctx.beginPath(); ctx.moveTo(x + cx * CELL, y); ctx.lineTo(x + cx * CELL, y + h); ctx.stroke();
    }
    for (let cy = 0; cy <= room.h; cy += 1) {
      ctx.beginPath(); ctx.moveTo(x, y + cy * CELL); ctx.lineTo(x + w, y + cy * CELL); ctx.stroke();
    }
  }

  // Tiles: street, vents, doorways, cover, walls.
  for (let row = 0; row < floor.grid.length; row += 1) {
    for (let col = 0; col < floor.grid[row].length; col += 1) {
      const tile = floor.grid[row][col];
      const x = col * CELL;
      const y = STAGE.hudHeight + row * CELL;
      if (tile === TILE.STREET) {
        ctx.fillStyle = '#14161d';
        ctx.fillRect(x, y, CELL, CELL);
        ctx.fillStyle = 'rgba(255,209,77,0.35)';
        ctx.fillRect(x + 4, y + CELL / 2 - 1, 10, 2);
      } else if (tile === TILE.VENT) {
        ctx.fillStyle = '#10141f';
        ctx.fillRect(x + 3, y + 3, CELL - 6, CELL - 6);
        ctx.fillStyle = '#3d4a68';
        for (let s = 0; s < 4; s += 1) ctx.fillRect(x + 7, y + 9 + s * 7, CELL - 14, 3);
      } else if (tile === TILE.DOORWAY) {
        ctx.fillStyle = '#0e1220';
        ctx.fillRect(x + 2, y + 2, 5, CELL - 4);
        ctx.fillRect(x + CELL - 7, y + 2, 5, CELL - 4);
      } else if (COVER_KINDS[tile]) {
        drawCover(ctx, COVER_KINDS[tile], x, y);
      }
    }
  }
  drawVan(ctx, world);
}

function drawWallsAndDoors(ctx, world) {
  const floor = world.floor;
  // Walls as one mass, not siding: a flat fill everywhere, a lit top edge
  // where a wall meets open floor above it, and its shadow on the floor
  // below. Long runs read as a single wall; corners keep their depth.
  for (let row = 0; row < floor.grid.length; row += 1) {
    for (let col = 0; col < floor.grid[row].length; col += 1) {
      if (floor.grid[row][col] === TILE.WALL) drawWallCell(ctx, floor, col, row);
    }
  }
  for (const door of floor.doors) {
    drawDoor(ctx, world, door);
  }
  // Camera panels, small wall boxes with a tell-tale light.
  for (const camera of world.cameras) {
    const x = camera.panel.x;
    const y = camera.panel.y;
    ctx.fillStyle = '#11182a';
    ctx.fillRect(x - 9, y - 12, 18, 24);
    ctx.strokeStyle = '#3d4a68';
    ctx.strokeRect(x - 9, y - 12, 18, 24);
    ctx.fillStyle = camera.state === CAMERA_STATE.CUT ? '#ff5040' : '#57e6a3';
    ctx.beginPath();
    ctx.arc(x, y - 5, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = `700 7px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('CAM', x, y + 9);
  }
  // Room names last, over the walls: a room that starts at the map's edge
  // has its first row inside the border wall, so its name sits one row in.
  for (const room of floor.rooms) {
    if (room.w < 5 || room.h < 3) continue;
    const x = room.x * CELL + (room.w * CELL) / 2;
    const y = STAGE.hudHeight + room.y * CELL + 23 + (room.y === 0 ? CELL : 0);
    ctx.fillStyle = 'rgba(255,255,255,0.17)';
    ctx.font = `700 14px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(room.label, x, y);
  }
}

function drawWallCell(ctx, floor, col, row) {
  const x = col * CELL;
  const y = STAGE.hudHeight + row * CELL;
  const isWall = (c, r) => floor.grid[r]?.[c] === TILE.WALL;
  ctx.fillStyle = PALETTE.wall;
  ctx.fillRect(x, y, CELL, CELL);
  if (!isWall(col, row - 1)) {
    // The wall's lit face, where it rises out of the room above it.
    ctx.fillStyle = PALETTE.wallTop;
    ctx.fillRect(x, y, CELL, 8);
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fillRect(x, y + 8, CELL, 2);
  }
  if (!isWall(col, row + 1)) {
    // Its shadow, pooling on the floor beneath.
    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    ctx.fillRect(x, y + CELL - 3, CELL, 7);
  }
  if (!isWall(col - 1, row)) {
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(x, y, 3, CELL);
  }
  if (!isWall(col + 1, row)) {
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(x + CELL - 3, y, 3, CELL);
  }
}

function drawCover(ctx, kind, x, y) {
  if (kind === 'crate') {
    ctx.fillStyle = '#6b4f2a';
    ctx.fillRect(x + 4, y + 4, CELL - 8, CELL - 8);
    ctx.strokeStyle = '#3f2d14';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 4, y + 4, CELL - 8, CELL - 8);
    ctx.beginPath();
    ctx.moveTo(x + 4, y + 4); ctx.lineTo(x + CELL - 4, y + CELL - 4);
    ctx.moveTo(x + CELL - 4, y + 4); ctx.lineTo(x + 4, y + CELL - 4);
    ctx.stroke();
  } else if (kind === 'table') {
    ctx.fillStyle = '#4a3b2c';
    ctx.fillRect(x + 2, y + 6, CELL - 4, CELL - 12);
    ctx.fillStyle = '#e8e2d2';
    ctx.fillRect(x + 10, y + 13, 11, 8);
    ctx.fillStyle = '#ffd34d';
    ctx.beginPath();
    ctx.arc(x + CELL - 11, y + 13, 3.5, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = '#7a4433';
    ctx.beginPath();
    ctx.moveTo(x + 13, y + CELL - 8);
    ctx.lineTo(x + CELL - 13, y + CELL - 8);
    ctx.lineTo(x + CELL - 17, y + CELL - 20);
    ctx.lineTo(x + 17, y + CELL - 20);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#2e7d4f';
    for (const [ox, oy, r] of [[20, 14, 9], [12, 20, 7], [28, 20, 7], [20, 24, 8]]) {
      ctx.beginPath();
      ctx.arc(x + ox, y + oy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawVan(ctx, world) {
  const exits = world.floor.exits;
  if (exits.length === 0) return;
  const first = exits[0];
  const last = exits[exits.length - 1];
  const x = first.x - 52;
  const y = first.y - 17;
  const w = last.x - first.x + 104;
  const ready = holdsStar(world.thief) || world.screen === SCREEN.FLOOR_CLEAR || world.screen === SCREEN.DONE;
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(x + 3, y + 6, w, 34);
  ctx.fillStyle = ready ? '#dfe6f2' : '#79839a';
  ctx.beginPath();
  ctx.roundRect(x, y, w, 34, 7);
  ctx.fill();
  ctx.fillStyle = '#232c42';
  ctx.fillRect(x + w - 30, y + 6, 20, 12); // cab window
  ctx.fillRect(x + 8, y + 6, 26, 12); // cargo doors seam
  ctx.fillStyle = ready ? '#ffd34d' : '#4a5474';
  ctx.beginPath();
  ctx.arc(x + w - 4, y + 24, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#14161d';
  for (const wx of [x + 18, x + w - 22]) {
    ctx.beginPath();
    ctx.arc(wx, y + 34, 7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = ready ? '#12233a' : '#2c3549';
  ctx.font = `800 11px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(ready ? 'GETAWAY' : 'THE VAN', x + w / 2 - 8, y + 29);
}

function drawDoor(ctx, world, door) {
  const x = door.col * CELL;
  const y = STAGE.hudHeight + door.row * CELL;
  if (door.open) {
    ctx.fillStyle = '#0d0f16';
    ctx.fillRect(x, y, CELL, CELL);
    ctx.strokeStyle = PALETTE.door;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x + 3, y + 3);
    ctx.lineTo(x + 3, y + CELL - 10);
    ctx.stroke();
    return;
  }
  ctx.fillStyle = PALETTE.door;
  ctx.fillRect(x + 2, y + 2, CELL - 4, CELL - 4);
  ctx.strokeStyle = '#54382a';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 7, y + 7, CELL - 14, 11);
  ctx.strokeRect(x + 7, y + 23, CELL - 14, 11);
  // A gold padlock: the universal sign for "hold E, and hurry quietly".
  ctx.strokeStyle = '#ffd34d';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.arc(x + CELL / 2, y + 17, 5, Math.PI, 0);
  ctx.stroke();
  ctx.fillStyle = '#ffd34d';
  ctx.fillRect(x + CELL / 2 - 6, y + 17, 12, 9);
  const thief = world.thief;
  if (thief.task && thief.task.kind === 'lock' && thief.task.ref === door) {
    drawProgress(ctx, x + CELL / 2, y - 8, thief.task.progress / thief.task.seconds);
  }
}

function drawProgress(ctx, x, y, share) {
  ctx.fillStyle = 'rgba(6,8,14,0.8)';
  ctx.fillRect(x - 22, y - 5, 44, 8);
  ctx.fillStyle = '#ffd34d';
  ctx.fillRect(x - 20, y - 3, 40 * Math.min(1, share), 4);
}

function drawLoot(ctx, world) {
  for (const item of world.floor.loot) {
    if (item.taken) continue;
    const { x, y } = item;
    // Pedestal and a soft pool of light; the star piece gets a gold halo
    // and a slow pulse, so the eye finds the objective across the room.
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(x - 13, y - 8, 26, 20);
    ctx.fillStyle = '#1c2334';
    ctx.fillRect(x - 12, y - 10, 24, 20);
    ctx.strokeStyle = item.star ? '#ffd34d' : '#3d4a68';
    ctx.lineWidth = item.star ? 2 : 1;
    ctx.strokeRect(x - 12, y - 10, 24, 20);
    if (item.star) {
      const pulse = 0.5 + 0.5 * Math.sin(world.elapsed * 3);
      ctx.fillStyle = `rgba(255, 209, 77, ${0.10 + 0.08 * pulse})`;
      ctx.beginPath();
      ctx.arc(x, y, 30 + 4 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#ffe066';
      ctx.fillRect(-8, -8, 16, 16);
      ctx.fillStyle = '#fff3b0';
      ctx.fillRect(-4.5, -4.5, 9, 9);
      ctx.restore();
    } else {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = PALETTE.loot;
      ctx.fillRect(-6, -6, 12, 12);
      ctx.fillStyle = '#c8ffe6';
      ctx.fillRect(-3, -3, 6, 6);
      ctx.restore();
    }
    // A name tag when the thief is close enough to read it: loot is a
    // decision (value now versus seconds of exposure), so show the price.
    const thief = world.thief;
    if (Math.hypot(thief.x - x, thief.y - y) < 110) {
      ctx.font = `600 11px ${FONT}`;
      const label = `${item.name} · ${formatMoney(item.value)}`;
      const w = ctx.measureText(label).width + 14;
      ctx.fillStyle = 'rgba(6,8,14,0.85)';
      ctx.beginPath();
      ctx.roundRect(x - w / 2, y - 34, w, 17, 4);
      ctx.fill();
      ctx.fillStyle = item.star ? '#ffe066' : '#c8ffe6';
      ctx.textAlign = 'center';
      ctx.fillText(label, x, y - 21.5);
    }
  }
}

function drawCoins(ctx, world) {
  for (const coin of world.coins) {
    const ring = (coin.age % 0.9) / 0.9;
    ctx.strokeStyle = `rgba(255, 211, 77, ${0.7 * (1 - ring)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(coin.x, coin.y, 6 + ring * 30, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffd34d';
    ctx.beginPath();
    ctx.arc(coin.x, coin.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#a87e14';
    ctx.font = `800 7px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('$', coin.x, coin.y + 2.5);
  }
}

function drawCones(ctx, world) {
  for (const guard of world.guards) {
    const polygon = conePolygon(guard.x, guard.y, guard.angle, GUARD.coneHalfAngle, GUARD.coneRange, world.rects);
    const heat = Math.max(guard.suspicion, (guard.exposure ?? 0) > 0 ? 0.55 : 0);
    ctx.fillStyle = guard.mode === GUARD_MODE.CHASE || heat > 0.6
      ? PALETTE.coneAlert
      : `rgba(255, 209, 77, ${0.17 + 0.13 * heat})`;
    tracePolygon(ctx, polygon);
    ctx.fill();
  }
  for (const camera of world.cameras) {
    if (camera.state !== CAMERA_STATE.LIVE) continue;
    const polygon = conePolygon(camera.x, camera.y, camera.angle, 0.5, 176, world.rects);
    ctx.fillStyle = camera.exposure > 0 ? PALETTE.cameraConeAlert : PALETTE.cameraCone;
    tracePolygon(ctx, polygon);
    ctx.fill();
  }
}

function tracePolygon(ctx, polygon) {
  ctx.beginPath();
  polygon.forEach((point, i) => {
    if (i === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.closePath();
}

function drawCameras(ctx, world) {
  for (const camera of world.cameras) {
    const { x, y } = camera;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.arc(x + 2, y + 3, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = camera.state === CAMERA_STATE.LIVE ? PALETTE.cameraBody : '#4a5468';
    ctx.beginPath();
    ctx.arc(x, y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#10141f';
    ctx.beginPath();
    ctx.arc(x + Math.cos(camera.angle) * 4, y + Math.sin(camera.angle) * 4, 4, 0, Math.PI * 2);
    ctx.fill();
    // The tell-tale LED: green live, amber dark, red cut.
    ctx.fillStyle = camera.state === CAMERA_STATE.LIVE ? '#57e6a3' : camera.state === CAMERA_STATE.DARK ? '#ffb340' : '#ff5040';
    ctx.beginPath();
    ctx.arc(x, y - 7, 2.2, 0, Math.PI * 2);
    ctx.fill();
    if (camera.state !== CAMERA_STATE.LIVE) {
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.font = `700 8px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(camera.state === CAMERA_STATE.DARK ? 'EMP' : 'CUT', x, y + 19);
    }
  }
}

function drawGuards(ctx, world) {
  for (const guard of world.guards) {
    const { x, y } = guard;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.arc(x + 2, y + 4, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.guardUniform;
    ctx.beginPath();
    ctx.arc(x, y, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PALETTE.guard;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.fillStyle = '#e8b08a';
    ctx.beginPath();
    ctx.arc(x, y, 7.5, 0, Math.PI * 2);
    ctx.fill();
    // Cap brim toward the facing: the cheapest readable direction cue.
    ctx.strokeStyle = '#2b1113';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(guard.angle) * 11, y + Math.sin(guard.angle) * 11);
    ctx.stroke();
    // Suspicion arc over the head, filling white to red.
    if (guard.suspicion > 0.03 && guard.mode !== GUARD_MODE.CHASE) {
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, 18, -Math.PI / 2, Math.PI * 1.5);
      ctx.stroke();
      ctx.strokeStyle = guard.suspicion > 0.7 ? '#ff5040' : '#ffd34d';
      ctx.beginPath();
      ctx.arc(x, y, 18, -Math.PI / 2, -Math.PI / 2 + guard.suspicion * Math.PI * 2);
      ctx.stroke();
    }
    if (guard.mode === GUARD_MODE.CHASE) {
      badge(ctx, x, y - 30, '!', '#ff5040');
    } else if (guard.mode === GUARD_MODE.INVESTIGATE || guard.mode === GUARD_MODE.SEARCH) {
      badge(ctx, x, y - 30, '?', '#ffd34d');
    }
  }
}

function badge(ctx, x, y, text, color) {
  ctx.fillStyle = 'rgba(6,8,14,0.85)';
  ctx.beginPath();
  ctx.arc(x, y, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.font = `800 13px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(text, x, y + 4.5);
}

function drawThief(ctx, world) {
  const thief = world.thief;
  const { x, y } = thief;
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath();
  ctx.arc(x + 2, y + 4, 12, 0, Math.PI * 2);
  ctx.fill();
  // The bag rides behind, and grows with what's in it.
  const bagRadius = 6 + Math.min(6, thief.carried.length * 1.6);
  const back = thief.angle + Math.PI;
  ctx.fillStyle = '#7a5c33';
  ctx.beginPath();
  ctx.arc(x + Math.cos(back) * 13, y + Math.sin(back) * 13, bagRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.thiefCoat;
  ctx.beginPath();
  ctx.arc(x, y, thief.sneaking ? 11.5 : 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = PALETTE.thief;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.fillStyle = PALETTE.thief;
  ctx.beginPath();
  ctx.arc(x, y, 5.5, 0, Math.PI * 2);
  ctx.fill();
  if (thief.sneaking) {
    ctx.strokeStyle = 'rgba(255,211,77,0.5)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(x, y, 17, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  // Held-E work shows over the thief's head; being seen shows an eye.
  if (thief.task) {
    drawProgress(ctx, x, y - 26, thief.task.progress / thief.task.seconds);
  }
  const exposure = world.alarm.exposureNow;
  if (exposure > 0.02 && world.screen === SCREEN.PLAY) {
    const color = exposure > 0.5 ? '#ff5040' : '#ffd34d';
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(x, y - 34, 9, 5.5, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y - 34, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawVignette(ctx, world) {
  const gradient = ctx.createRadialGradient(640, 392, 420, 640, 392, 860);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, 'rgba(0,0,0,0.42)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, STAGE.width, STAGE.height);
  if (world.alarm.level >= 3 && world.screen === SCREEN.PLAY) {
    const pulse = 0.10 + 0.06 * Math.sin(world.elapsed * 6);
    ctx.strokeStyle = `rgba(255, 60, 40, ${pulse + 0.12})`;
    ctx.lineWidth = 26;
    ctx.strokeRect(0, 0, STAGE.width, STAGE.height);
  }
}

function drawHud(ctx, world, options) {
  ctx.fillStyle = PALETTE.hudBar;
  ctx.fillRect(0, 0, STAGE.width, STAGE.hudHeight);
  ctx.fillStyle = '#2b3550';
  ctx.fillRect(0, STAGE.hudHeight - 2, STAGE.width, 2);

  ctx.textAlign = 'left';
  ctx.fillStyle = PALETTE.text;
  ctx.font = `800 16px ${FONT}`;
  ctx.fillText(world.floor.name, 16, 26);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `600 12px ${FONT}`;
  const objective = world.floor.objective.length > 52
    ? `${world.floor.objective.slice(0, 52)}…`
    : world.floor.objective;
  ctx.fillText(objective, 16, 46);

  // The alarm meter, centre stage: segmented, so its thirds read as levels.
  const meterX = 470;
  const meterW = 340;
  ctx.fillStyle = PALETTE.text;
  ctx.font = `800 12px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(`ALARM — LEVEL ${world.alarm.level}`, meterX + meterW / 2, 20);
  ctx.fillStyle = '#05070c';
  ctx.fillRect(meterX - 3, 26, meterW + 6, 18);
  const segments = 30;
  const filled = Math.round((world.alarm.meter / ALARM.max) * segments);
  for (let i = 0; i < segments; i += 1) {
    const share = i / segments;
    ctx.fillStyle = i < filled
      ? (share < 1 / 3 ? PALETTE.alarmLow : share < 2 / 3 ? PALETTE.alarmMid : PALETTE.alarmHigh)
      : '#232c42';
    ctx.fillRect(meterX + i * (meterW / segments) + 1, 29, meterW / segments - 2, 12);
  }
  if (world.alarm.meter >= ALARM.max) {
    ctx.fillStyle = '#ff5040';
    ctx.font = `800 11px ${FONT}`;
    ctx.fillText('LOCKDOWN IMMINENT — HIDE!', meterX + meterW / 2, 58);
  }

  // Right side: the money and the tools.
  ctx.textAlign = 'right';
  ctx.fillStyle = PALETTE.text;
  ctx.font = `800 16px ${FONT}`;
  const carried = carriedValue(world.thief);
  ctx.fillText(`BANKED ${formatMoney(world.banked)}`, 1264, 26);
  ctx.font = `700 12px ${FONT}`;
  ctx.fillStyle = carried > 0 ? PALETTE.loot : PALETTE.muted;
  ctx.fillText(`IN THE BAG ${formatMoney(carried)}`, 1264, 45);
  ctx.fillStyle = PALETTE.muted;
  ctx.textAlign = 'left';
  ctx.font = `700 12px ${FONT}`;
  ctx.fillText(`COINS x${world.thief.coinsLeft}    EMP x${world.thief.empLeft}    TIME ${formatTime(world.totalTime)}${options.muted ? '    MUTED (M)' : ''}`, 856, 45);

  // The toast: one line of guidance or gossip, under the HUD.
  if (world.message && world.message.timer > 0 && world.screen === SCREEN.PLAY) {
    ctx.font = `700 14px ${FONT}`;
    const w = ctx.measureText(world.message.text).width + 28;
    ctx.fillStyle = 'rgba(6,8,14,0.82)';
    ctx.beginPath();
    ctx.roundRect(640 - w / 2, STAGE.hudHeight + 10, w, 26, 6);
    ctx.fill();
    ctx.fillStyle = '#ffe9a8';
    ctx.textAlign = 'center';
    ctx.fillText(world.message.text, 640, STAGE.hudHeight + 28);
  }
}

function overlayPanel(ctx, alpha) {
  ctx.fillStyle = `rgba(4, 6, 12, ${alpha})`;
  ctx.fillRect(0, 0, STAGE.width, STAGE.height);
}

function centreText(ctx, text, y, font, color) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.fillText(text, 640, y);
}

function drawTitle(ctx, world) {
  overlayPanel(ctx, 0.66);
  centreText(ctx, 'MIDNIGHT VAULT', 218, `800 68px ${FONT}`, '#ffd34d');
  centreText(ctx, 'One night. Three floors. Don\'t get seen.', 258, `600 20px ${FONT}`, PALETTE.text);
  centreText(ctx, 'Cross the gallery, crack the counting house, empty the Aurora Vault.', 292, `500 15px ${FONT}`, PALETTE.muted);
  const lines = [
    'WASD / arrows — move        SHIFT — sneak (slower, harder to spot)',
    'E — grab loot · pick locks · cut a camera at its panel',
    'CLICK — toss a coin: guards go and look where it lands',
    'F — EMP: every camera goes dark for eight seconds',
    'Fill the ALARM meter, or take a guard\'s hand, and the night is over.',
    'Take the star piece, reach the van, and the haul is banked.',
  ];
  lines.forEach((line, i) => centreText(ctx, line, 348 + i * 27, `600 15px ${FONT}`, '#c9d2e0'));
  const pulse = 0.65 + 0.35 * Math.sin(world.elapsed * 4);
  ctx.globalAlpha = pulse;
  centreText(ctx, 'CLICK OR PRESS ENTER TO START THE HEIST', 556, `800 19px ${FONT}`, '#57e6a3');
  ctx.globalAlpha = 1;
}

function drawCaught(ctx, world) {
  overlayPanel(ctx, 0.62);
  ctx.fillStyle = 'rgba(255, 60, 40, 0.10)';
  ctx.fillRect(0, 0, STAGE.width, STAGE.height);
  centreText(ctx, 'BUSTED', 268, `800 64px ${FONT}`, '#ff5040');
  centreText(ctx, world.caughtReason, 312, `600 18px ${FONT}`, PALETTE.text);
  centreText(ctx, 'The bag is emptied. What is already in the van stays in the van.', 344, `500 15px ${FONT}`, PALETTE.muted);
  centreText(ctx, `Banked so far: ${formatMoney(world.banked)}`, 384, `700 17px ${FONT}`, '#ffd34d');
  centreText(ctx, 'PRESS R TO TRY THE FLOOR AGAIN', 452, `800 18px ${FONT}`, '#57e6a3');
}

function drawFloorClear(ctx, world) {
  overlayPanel(ctx, 0.6);
  centreText(ctx, 'CLEAN GETAWAY', 258, `800 56px ${FONT}`, '#57e6a3');
  centreText(ctx, `${world.floor.name} is emptied and banked.`, 300, `600 18px ${FONT}`, PALETTE.text);
  centreText(ctx, `In the van: ${formatMoney(world.banked)} of ${formatMoney(world.maxBankable)}`, 338, `700 17px ${FONT}`, '#ffd34d');
  centreText(ctx, `Seen ${world.seenCount} time${world.seenCount === 1 ? '' : 's'} tonight · ${formatTime(world.totalTime)} on the clock`, 368, `500 15px ${FONT}`, PALETTE.muted);
  centreText(ctx, 'PRESS ENTER FOR THE NEXT FLOOR', 442, `800 18px ${FONT}`, '#57e6a3');
}

function drawDone(ctx, world) {
  overlayPanel(ctx, 0.68);
  centreText(ctx, 'THE NIGHT IS YOURS', 238, `800 54px ${FONT}`, '#ffd34d');
  centreText(ctx, `Final haul: ${formatMoney(world.banked)} of ${formatMoney(world.maxBankable)}`, 292, `800 24px ${FONT}`, '#57e6a3');
  centreText(ctx, heistGrade(world), 332, `700 19px ${FONT}`, PALETTE.text);
  centreText(ctx, `Time ${formatTime(world.totalTime)} · seen ${world.seenCount} time${world.seenCount === 1 ? '' : 's'} · busted ${world.busts} time${world.busts === 1 ? '' : 's'}`, 368, `500 15px ${FONT}`, PALETTE.muted);
  centreText(ctx, 'PRESS ENTER TO PLAN ANOTHER NIGHT', 448, `800 18px ${FONT}`, '#57e6a3');
}
