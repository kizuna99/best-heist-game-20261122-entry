// The cameras: ceiling eyes that sweep a cone back and forth across the
// room. A camera cannot chase, but everything it sees goes straight to the
// alarm meter. Two ways to beat one: fire an EMP charge and every camera
// goes dark for a few seconds, or find the camera's wall panel and hold E
// to cut it for the rest of the floor — the panel is always somewhere the
// camera cannot quite watch.

import { CAMERA } from './config.js';
import { cellCenter } from './floors.js';

export const CAMERA_STATE = {
  LIVE: 'live',
  DARK: 'dark', // EMP blackout, counting down
  CUT: 'cut', // panel cut: off for the rest of the floor
};

/** A fresh camera from its floor definition. */
export function createCamera(definition, index) {
  const pos = cellCenter(definition.cell[0], definition.cell[1]);
  const panelPos = cellCenter(definition.panel[0], definition.panel[1]);
  return {
    index,
    x: pos.x,
    y: pos.y,
    panel: { col: definition.panel[0], row: definition.panel[1], x: panelPos.x, y: panelPos.y },
    baseAngle: definition.baseAngle,
    sweep: definition.sweep,
    angle: definition.baseAngle,
    phase: index * 1.7, // cameras do not swing in lockstep
    state: CAMERA_STATE.LIVE,
    darkTimer: 0,
    /** How clearly this camera sees the thief right now (world fills it). */
    exposure: 0,
  };
}

/** Advance one camera's swing (and its EMP blackout) by dt seconds. */
export function stepCamera(camera, dt, elapsed) {
  if (camera.state === CAMERA_STATE.DARK) {
    camera.darkTimer -= dt;
    if (camera.darkTimer <= 0) camera.state = CAMERA_STATE.LIVE;
  }
  if (camera.state === CAMERA_STATE.LIVE) {
    camera.angle = camera.baseAngle
      + Math.sin(elapsed * CAMERA.sweepSpeed + camera.phase) * camera.sweep;
  }
}

/** Put every camera into EMP blackout for the configured seconds. */
export function blackoutCameras(cameras) {
  for (const camera of cameras) {
    if (camera.state === CAMERA_STATE.LIVE) {
      camera.state = CAMERA_STATE.DARK;
      camera.darkTimer = CAMERA.empSeconds;
      camera.exposure = 0;
    }
  }
}

/** Cut one camera at its panel: off for the rest of the floor. */
export function cutCamera(camera) {
  camera.state = CAMERA_STATE.CUT;
  camera.exposure = 0;
}
