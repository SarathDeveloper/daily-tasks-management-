import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'public', 'icons');

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let t = ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const x = x1 + t * dx;
  const y = y1 + t * dy;
  return Math.hypot(px - x, py - y);
}

function createIcon(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const thickness = size * 0.075;
  const x1 = size * 0.28;
  const y1 = size * 0.52;
  const x2 = size * 0.44;
  const y2 = size * 0.68;
  const x3 = size * 0.74;
  const y3 = size * 0.34;

  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < size; x++) {
      const onCheck =
        distToSegment(x + 0.5, y + 0.5, x1, y1, x2, y2) <= thickness ||
        distToSegment(x + 0.5, y + 0.5, x2, y2, x3, y3) <= thickness;
      const i = row + 1 + x * 4;
      if (onCheck) {
        raw[i] = 255;
        raw[i + 1] = 255;
        raw[i + 2] = 255;
      } else {
        raw[i] = 79;
        raw[i + 1] = 70;
        raw[i + 2] = 229;
      }
      raw[i + 3] = 255;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  return png;
}

fs.mkdirSync(outDir, { recursive: true });
for (const [name, size] of [
  ['favicon-32.png', 32],
  ['apple-touch-icon.png', 180],
  ['icon-192.png', 192],
  ['icon-512.png', 512],
]) {
  fs.writeFileSync(path.join(outDir, name), createIcon(size));
}
console.log('wrote icons to', outDir);
