// LumAI toolbar icons — TRUE transparent PNG, no white card. Bold solid "L"
// corner-bracket + 4-point star, ~90% canvas fill, rendered directly with alpha
// (do NOT rasterize via qlmanage — it flattens transparency onto white).
const fs = require('fs'), zlib = require('zlib');
const crcTable = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = b => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = crcTable[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const t = Buffer.from(type, 'ascii'); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data]))); return Buffer.concat([len, t, data, crc]); };
const distSeg = (px, py, ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy; let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(px - (ax + t * dx), py - (ay + t * dy)); };
const inPoly = (x, y, p) => { let o = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const xi = p[i][0], yi = p[i][1], xj = p[j][0], yj = p[j][1]; if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) o = !o; } return o; };

const BLUE = [9, 76, 178], SS = 4;
// Bold "L": two segments + half-thickness (round caps/joins via distance).
const T = 0.28, hT = T / 2, VX = 0.19, VY0 = 0.18, VY1 = 0.80, HX = 0.81;
// 4-point star (fattened for small-size readability), top-right of the L.
function starPoly(big) {
  const cx = 0.76, cy = 0.25, Ro = big ? 0.22 : 0.20, Ri = big ? 0.12 : 0.10, d = Ri * 0.7071;
  return [[cx, cy - Ro], [cx + d, cy - d], [cx + Ro, cy], [cx + d, cy + d], [cx, cy + Ro], [cx - d, cy + d], [cx - Ro, cy], [cx - d, cy - d]];
}
function render(size) {
  const star = starPoly(size <= 32);     // slightly larger star at 16/32
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4); let o = 1;
    for (let x = 0; x < size; x++) {
      let cov = 0;
      for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
        const nx = (x + (sx + 0.5) / SS) / size, ny = (y + (sy + 0.5) / SS) / size;
        const dL = Math.min(distSeg(nx, ny, VX, VY0, VX, VY1), distSeg(nx, ny, VX, VY1, HX, VY1));
        if (dL <= hT || inPoly(nx, ny, star)) cov++;
      }
      const a = Math.round(cov / (SS * SS) * 255);
      row[o++] = a ? BLUE[0] : 0; row[o++] = a ? BLUE[1] : 0; row[o++] = a ? BLUE[2] : 0; row[o++] = a;
    }
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(Buffer.concat(rows), { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
for (const s of [16, 32, 48, 128]) fs.writeFileSync(`icons/icon-${s}.png`, render(s));
console.log('generated icon-16/32/48/128.png (L + star, transparent)');
