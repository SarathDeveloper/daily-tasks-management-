/**
 * Generates the notification sound files bundled with the Android app.
 *
 * Android 8+ takes notification sounds from the notification *channel*, and a
 * channel's sound cannot be changed after creation, so each in-app chime needs
 * its own channel and its own `res/raw/*.wav` file.
 *
 * Run with: node scripts/generate-notification-sounds.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SAMPLE_RATE = 22050;
const OUT_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../android/app/src/main/res/raw'
);

function encodeWav(samples) {
  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // PCM chunk size
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28); // byte rate
  buffer.writeUInt16LE(2, 32); // block align
  buffer.writeUInt16LE(16, 34); // bits per sample
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(clamped * 32767), 44 + i * 2);
  }
  return buffer;
}

function silence(seconds) {
  return new Float32Array(Math.floor(seconds * SAMPLE_RATE));
}

function envelope(t, attack, release) {
  if (t < 0) return 0;
  if (t < attack) return t / attack;
  return Math.exp(-(t - attack) / release);
}

/** Adds a decaying tone into `out` starting at `start` seconds. */
function addTone(out, { freq, start, duration, release, amplitude, type = 'sine', sweepTo }) {
  const from = Math.floor(start * SAMPLE_RATE);
  const count = Math.min(Math.floor(duration * SAMPLE_RATE), out.length - from);
  for (let i = 0; i < count; i++) {
    const t = i / SAMPLE_RATE;
    let freqNow = freq;
    if (sweepTo) {
      const progress = i / count;
      freqNow = freq * Math.pow(sweepTo / freq, progress);
    }
    const phase = 2 * Math.PI * freqNow * t;
    let value;
    if (type === 'square') value = Math.sign(Math.sin(phase)) * 0.35;
    else if (type === 'triangle') value = (2 / Math.PI) * Math.asin(Math.sin(phase));
    else value = Math.sin(phase);
    out[from + i] += value * envelope(t, 0.01, release) * amplitude;
  }
}

function chime() {
  const out = silence(1.0);
  addTone(out, { freq: 880, start: 0, duration: 0.8, release: 0.3, amplitude: 0.45, sweepTo: 1760 });
  addTone(out, { freq: 1318.5, start: 0.1, duration: 0.7, release: 0.28, amplitude: 0.25 });
  return out;
}

function bell() {
  const out = silence(1.3);
  [523.25, 659.25, 783.99].forEach((freq) => {
    addTone(out, { freq, start: 0, duration: 1.2, release: 0.42, amplitude: 0.3, type: 'triangle' });
  });
  return out;
}

function digital() {
  const out = silence(0.6);
  [0, 0.15, 0.3].forEach((start) => {
    addTone(out, { freq: 1046.5, start, duration: 0.09, release: 0.03, amplitude: 0.42, type: 'square' });
  });
  return out;
}

function gentle() {
  const out = silence(1.3);
  [329.63, 440, 523.25].forEach((freq, index) => {
    addTone(out, {
      freq,
      start: index * 0.12,
      duration: 1.0,
      release: 0.36,
      amplitude: 0.32,
    });
  });
  return out;
}

const sounds = {
  chime: chime(),
  bell: bell(),
  digital: digital(),
  gentle: gentle(),
  // A real silent file is required: a channel with no sound file still plays
  // the system default sound.
  silent: silence(0.25),
};

mkdirSync(OUT_DIR, { recursive: true });
for (const [name, samples] of Object.entries(sounds)) {
  const file = resolve(OUT_DIR, `${name}.wav`);
  writeFileSync(file, encodeWav(samples));
  console.log(`wrote ${file} (${(samples.length * 2 / 1024).toFixed(1)} KB)`);
}
