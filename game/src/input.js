// Keyboard and mouse state for the thief's hands. The world reads a plain
// snapshot each step — which move keys are down, whether sneak and interact
// are held, and at most one queued coin toss at a stage position — so the
// simulation never touches the DOM and a screenshot scene can drive the same
// snapshot by hand.

export function createInput(canvas) {
  const keys = new Set();
  let coinToss = null; // {x, y} in stage coordinates, consumed by the world
  let clicked = false; // any click, for starting screens and audio

  const MOVE_KEYS = {
    KeyW: 'up', ArrowUp: 'up',
    KeyS: 'down', ArrowDown: 'down',
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right',
  };

  window.addEventListener('keydown', (event) => {
    if (MOVE_KEYS[event.code] || event.code === 'Space') event.preventDefault();
    keys.add(event.code);
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('pointerdown', (event) => {
    clicked = true;
    const rect = canvas.getBoundingClientRect();
    coinToss = {
      x: ((event.clientX - rect.left) / rect.width) * 1280,
      y: ((event.clientY - rect.top) / rect.height) * 720,
    };
  });

  return {
    /** The movement direction the held keys ask for, as a unit vector (or zero). */
    moveVector() {
      let x = 0;
      let y = 0;
      for (const code of keys) {
        const direction = MOVE_KEYS[code];
        if (direction === 'up') y -= 1;
        if (direction === 'down') y += 1;
        if (direction === 'left') x -= 1;
        if (direction === 'right') x += 1;
      }
      if (x === 0 && y === 0) return { x: 0, y: 0 };
      const length = Math.hypot(x, y);
      return { x: x / length, y: y / length };
    },
    sneaking() {
      return keys.has('ShiftLeft') || keys.has('ShiftRight');
    },
    interacting() {
      return keys.has('KeyE');
    },
    /** True on the step a key goes down (the caller polls once per step). */
    pressed(code) {
      return keys.has(code);
    },
    /** Take the queued coin toss, if any; the world calls this once a step. */
    takeCoinToss() {
      const toss = coinToss;
      coinToss = null;
      return toss;
    },
    /** Take the "a click happened" flag, for screens that wait for one. */
    takeClick() {
      const was = clicked;
      clicked = false;
      return was;
    },
  };
}

/** A still, silent input snapshot: what screenshot scenes start from. */
export function createIdleInput() {
  return {
    moveVector: () => ({ x: 0, y: 0 }),
    sneaking: () => false,
    interacting: () => false,
    pressed: () => false,
    takeCoinToss: () => null,
    takeClick: () => false,
  };
}
