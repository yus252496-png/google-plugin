/**
 * Simple PNG icon generator for the CNBC News Collector extension.
 * Run: node scripts/generate-icons.js
 * Uses Node.js built-in zlib — no external dependencies.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function makeCRCTable() {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  return table;
}
const crcTable = makeCRCTable();

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeB = Buffer.from(type, 'ascii');
  const crcVal = crc32(Buffer.concat([typeB, data]));
  const crcB = Buffer.alloc(4);
  crcB.writeUInt32BE(crcVal, 0);
  return Buffer.concat([len, typeB, data, crcB]);
}

function createPNG(size) {
  const r = 37, g = 99, b = 235; // blue tone
  const rawData = [];

  for (let y = 0; y < size; y++) {
    rawData.push(0); // filter byte = None
    for (let x = 0; x < size; x++) {
      const cx = size / 2, cy = size / 2, rad = size / 2 - 1, ir = size / 4;
      const dx = x - cx, dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const innerDist = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy));

      // Simple "N" letter icon
      if (dist > rad) {
        rawData.push(r, g, b, 0); // transparent outside circle
      } else if (dist > rad - 1) {
        rawData.push(r, g, b, 200); // edge
      } else {
        // Clear background
        rawData.push(r, g, b, 255);
        // Draw "N" letter
        const nx = x / size, ny = y / size;
        const letterW = 0.5, letterH = 0.6;
        const lx = (nx - 0.25) / letterW, ly = (ny - 0.2) / letterH;
        if (lx >= 0 && lx <= 1 && ly >= 0 && ly <= 1) {
          // Left vertical bar
          if (lx < 0.15) { rawData[rawData.length - 4] = 255; rawData[rawData.length - 3] = 255; rawData[rawData.length - 2] = 255; }
          // Right vertical bar
          else if (lx > 0.85) { rawData[rawData.length - 4] = 255; rawData[rawData.length - 3] = 255; rawData[rawData.length - 2] = 255; }
          // Diagonal
          else {
            const diagY = 1 - lx;
            if (Math.abs(ly - diagY) < 0.08) { rawData[rawData.length - 4] = 255; rawData[rawData.length - 3] = 255; rawData[rawData.length - 2] = 255; }
          }
        }
      }
    }
  }

  const compressed = zlib.deflateSync(Buffer.from(rawData));
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// Generate icons
const iconsDir = path.resolve(__dirname, '..', 'icons');
if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });

const sizes = [16, 48, 128];
for (const size of sizes) {
  const png = createPNG(size);
  const filePath = path.join(iconsDir, `icon${size}.png`);
  fs.writeFileSync(filePath, png);
  console.log(`Created: ${filePath} (${png.length} bytes)`);
}

console.log('Done. Icons generated successfully.');
