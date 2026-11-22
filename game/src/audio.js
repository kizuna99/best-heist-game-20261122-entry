// Sound for Midnight Vault, synthesised with WebAudio — no audio files, so
// the game stays a handful of static text files. Everything is a short
// shaped tone or a breath of filtered noise: a coin's clink, a lock's
// clicks, the sting when a guard makes you, the rising beeps of the alarm.
// The context stays locked until the player's first click or keypress, as
// browsers require; every call before that is a no-op.

let context = null;
let master = null;
let muted = false;

/** Create the context on the first user gesture; safe to call every frame. */
export function unlockAudio() {
  if (context) {
    if (context.state === 'suspended') context.resume();
    return;
  }
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) return;
  context = new AudioCtor();
  master = context.createGain();
  master.gain.value = 0.5;
  master.connect(context.destination);
}

export function toggleMuted() {
  muted = !muted;
  return muted;
}

export function isMuted() {
  return muted;
}

/** One shaped tone; the whole synth is built from these. */
function tone(freq, endFreq, seconds, type, volume, delay = 0) {
  if (!context || muted) return;
  const start = context.currentTime + delay;
  const osc = context.createOscillator();
  const gain = context.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (endFreq !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), start + seconds);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
  osc.connect(gain).connect(master);
  osc.start(start);
  osc.stop(start + seconds + 0.05);
}

/** A short burst of filtered noise: cloth, static, a snip. */
function noiseBurst(seconds, volume, freq, delay = 0) {
  if (!context || muted) return;
  const start = context.currentTime + delay;
  const length = Math.max(1, Math.floor(context.sampleRate * seconds));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  const source = context.createBufferSource();
  source.buffer = buffer;
  const filter = context.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  filter.Q.value = 0.8;
  const gain = context.createGain();
  gain.gain.value = volume;
  source.connect(filter).connect(gain).connect(master);
  source.start(start);
}

export function soundFootstep(sneaking) {
  noiseBurst(0.05, sneaking ? 0.015 : 0.04, 500);
}

export function soundPickup(star) {
  tone(star ? 1046 : 880, star ? 1568 : 1174, 0.16, 'sine', 0.22);
  if (star) tone(1318, 1975, 0.3, 'sine', 0.18, 0.09);
}

export function soundCoinToss() {
  tone(2093, 2093, 0.07, 'triangle', 0.16);
  tone(2637, 2637, 0.12, 'triangle', 0.14, 0.055);
}

export function soundLockTick() {
  tone(340, 240, 0.03, 'square', 0.05);
}

export function soundLockOpen() {
  tone(520, 520, 0.05, 'square', 0.1);
  tone(196, 130, 0.14, 'sine', 0.2, 0.05);
}

export function soundCameraCut() {
  noiseBurst(0.06, 0.12, 2400);
  tone(880, 110, 0.28, 'sawtooth', 0.08, 0.04);
}

export function soundEmp() {
  tone(1600, 60, 0.4, 'sawtooth', 0.14);
  noiseBurst(0.3, 0.1, 900);
}

export function soundSpotted() {
  tone(196, 196, 0.3, 'sawtooth', 0.16);
  tone(208, 208, 0.3, 'sawtooth', 0.16);
}

export function soundAlarmRise() {
  tone(660, 660, 0.09, 'square', 0.1);
  tone(880, 880, 0.09, 'square', 0.1, 0.11);
}

export function soundAlarmPulse() {
  tone(740, 587, 0.16, 'triangle', 0.07);
}

export function soundCaught() {
  tone(392, 392, 0.18, 'sawtooth', 0.16);
  tone(311, 311, 0.18, 'sawtooth', 0.16, 0.16);
  tone(233, 110, 0.5, 'sawtooth', 0.18, 0.32);
}

export function soundFloorClear() {
  tone(523, 523, 0.12, 'sine', 0.16);
  tone(659, 659, 0.12, 'sine', 0.16, 0.1);
  tone(784, 784, 0.22, 'sine', 0.18, 0.2);
}

export function soundHeistDone() {
  const notes = [523, 659, 784, 1046, 784, 1046, 1318];
  notes.forEach((freq, i) => tone(freq, freq, 0.22, 'sine', 0.16, i * 0.13));
}
