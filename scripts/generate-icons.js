#!/usr/bin/env node
// scripts/generate-icons.js
//
// Generates src/icons/icon{16,32,48,128}.png for Tufnut.
//
// Design:
//   • Google Material Dark rounded-square background  (#202124)
//   • White graduation cap (mortarboard) centred on the badge:
//       – flat diamond-shaped board (top)
//       – rectangular brim underneath
//       – small tassel hanging from the right corner
//
// Pure Node.js — no external image dependencies.  Uses zlib (built-in) to
// produce a valid DEFLATE-compressed RGBA PNG.

"use strict";

const fs   = require("fs");
const path = require("path");
const zlib = require("zlib");

// ── Tiny PNG writer ───────────────────────────────────────────────────────────

function writePng(filePath, size, pixels) {
  // pixels: Uint8ClampedArray, RGBA, row-major, size*size*4 bytes
  const w = size, h = size;

  // Build raw (unfiltered) image data: filter-byte 0 per row
  const raw = Buffer.alloc(h * (1 + w * 4));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 4)] = 0; // filter: None
    for (let x = 0; x < w; x++) {
      const src = (y * w + x) * 4;
      const dst = y * (1 + w * 4) + 1 + x * 4;
      raw[dst]     = pixels[src];
      raw[dst + 1] = pixels[src + 1];
      raw[dst + 2] = pixels[src + 2];
      raw[dst + 3] = pixels[src + 3];
    }
  }

  const compressed = zlib.deflateSync(raw, { level: 9 });

  // CRC-32 table
  const crcTable = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c;
    }
    return t;
  })();

  function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  function chunk(type, data) {
    const tb  = Buffer.from(type, "ascii");
    const crc = crc32(Buffer.concat([tb, data]));
    const out = Buffer.alloc(4 + 4 + data.length + 4);
    out.writeUInt32BE(data.length, 0);
    tb.copy(out, 4);
    data.copy(out, 8);
    out.writeUInt32BE(crc, 8 + data.length);
    return out;
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // color type: RGBA
  // compression, filter, interlace = 0

  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), // PNG magic
    chunk("IHDR", ihdr),
    chunk("IDAT", compressed),
    chunk("IEND", Buffer.alloc(0)),
  ]);

  fs.writeFileSync(filePath, png);
  console.log(`  ✓  ${path.basename(filePath)}  (${size}×${size})`);
}

// ── 2-D drawing helpers ───────────────────────────────────────────────────────

function makeCanvas(size) {
  const data = new Uint8ClampedArray(size * size * 4); // all transparent

  function set(x, y, r, g, b, a = 255) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || x >= size || y < 0 || y >= size) return;
    const i = (y * size + x) * 4;
    // Alpha-composite over existing pixel
    const sa = a / 255;
    const da = data[i + 3] / 255;
    const oa = sa + da * (1 - sa);
    if (oa === 0) return;
    data[i]     = Math.round((r * sa + data[i]     * da * (1 - sa)) / oa);
    data[i + 1] = Math.round((g * sa + data[i + 1] * da * (1 - sa)) / oa);
    data[i + 2] = Math.round((b * sa + data[i + 2] * da * (1 - sa)) / oa);
    data[i + 3] = Math.round(oa * 255);
  }

  function fillRect(x1, y1, x2, y2, r, g, b, a = 255) {
    for (let y = Math.ceil(y1); y <= Math.floor(y2); y++)
      for (let x = Math.ceil(x1); x <= Math.floor(x2); x++)
        set(x, y, r, g, b, a);
  }

  // Filled circle with anti-aliased edge
  function fillCircle(cx, cy, radius, r, g, b) {
    const r2 = radius * radius;
    for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y++) {
      for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++) {
        const dx = x - cx, dy = y - cy;
        const d2 = dx * dx + dy * dy;
        if (d2 <= r2) set(x, y, r, g, b, 255);
      }
    }
  }

  // Draw a filled rotated diamond (parallelogram with equal diagonals)
  // centred at (cx, cy) with half-widths hw (horizontal) and hh (vertical)
  function fillDiamond(cx, cy, hw, hh, r, g, b) {
    for (let y = Math.floor(cy - hh); y <= Math.ceil(cy + hh); y++) {
      const dy   = Math.abs(y - cy);
      const xSpan = hw * (1 - dy / hh);
      for (let x = Math.floor(cx - xSpan); x <= Math.ceil(cx + xSpan); x++) {
        set(x, y, r, g, b, 255);
      }
    }
  }

  // Filled polygon (convex, vertices in order)
  function fillPolygon(pts, r, g, b) {
    // Scanline fill
    const ys = pts.map(p => p[1]);
    const y0 = Math.floor(Math.min(...ys));
    const y1 = Math.ceil(Math.max(...ys));
    for (let y = y0; y <= y1; y++) {
      const xs = [];
      for (let i = 0; i < pts.length; i++) {
        const [ax, ay] = pts[i];
        const [bx, by] = pts[(i + 1) % pts.length];
        if ((ay <= y && by > y) || (by <= y && ay > y)) {
          xs.push(ax + (y - ay) * (bx - ax) / (by - ay));
        }
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k < xs.length - 1; k += 2) {
        for (let x = Math.ceil(xs[k]); x <= Math.floor(xs[k + 1]); x++) {
          set(x, y, r, g, b, 255);
        }
      }
    }
  }

  // Rounded rectangle
  function fillRoundRect(x, y, w, h, rx, r, g, b, a = 255) {
    // Fill body
    fillRect(x + rx, y,      x + w - rx, y + h,      r, g, b, a);
    fillRect(x,      y + rx, x + w,      y + h - rx, r, g, b, a);
    // Four corner circles
    fillCircle(x + rx,     y + rx,     rx, r, g, b);
    fillCircle(x + w - rx, y + rx,     rx, r, g, b);
    fillCircle(x + rx,     y + h - rx, rx, r, g, b);
    fillCircle(x + w - rx, y + h - rx, rx, r, g, b);
  }

  return { data, set, fillRect, fillCircle, fillDiamond, fillPolygon, fillRoundRect };
}

// ── Graduation cap renderer ───────────────────────────────────────────────────
//
// Layout (proportional, all values as fraction of `size`):
//
//   Background: rounded square, full size, colour #202124
//
//   Cap board (diamond / rhombus):
//     Centre at (0.50, 0.38) of the icon
//     Half-width  0.34, half-height 0.17  →  flat diamond ("board top")
//
//   Brim (rectangle):
//     Centred horizontally at 0.50
//     Top at 0.50, bottom at 0.60
//     Width 0.46, slightly wider than the widest point of the diamond
//
//   Tassel:
//     Small vertical line from (0.72, 0.50) down to (0.72, 0.70)
//     Small circle at the bottom  r=0.035
//     Colour: Google Blue #1a73e8  (accent pop on white cap)
//
//   All cap parts are white (#ffffff).

function renderIcon(size) {
  const s  = size;
  const cv = makeCanvas(s);

  // ── Background ──────────────────────────────────────────────────────────
  const bgR = 4, bgRad = Math.round(s * 0.18);
  cv.fillRoundRect(0, 0, s, s, bgRad, 32, 33, 36);  // #202124

  const W = 255, WG = 255, WB = 255; // white
  const BR = 26, BG2 = 115, BB = 232; // Google Blue #1a73e8

  // ── Board (flat diamond) ────────────────────────────────────────────────
  const cx   = s * 0.50;
  const cy   = s * 0.385;
  const hw   = s * 0.34;
  const hh   = s * 0.175;
  cv.fillDiamond(cx, cy, hw, hh, W, WG, WB);

  // ── Brim (rectangle) ────────────────────────────────────────────────────
  const brimTop    = s * 0.500;
  const brimBot    = s * 0.610;
  const brimLeft   = s * 0.175;
  const brimRight  = s * 0.825;
  cv.fillRect(brimLeft, brimTop, brimRight, brimBot, W, WG, WB);

  // Small rounded bottom corners on the brim look better at large sizes
  if (s >= 48) {
    const brimRad = Math.round(s * 0.04);
    cv.fillCircle(brimLeft  + brimRad, brimBot - brimRad, brimRad, W, WG, WB);
    cv.fillCircle(brimRight - brimRad, brimBot - brimRad, brimRad, W, WG, WB);
  }

  // ── Tassel ───────────────────────────────────────────────────────────────
  // Vertical string from the right corner of the diamond
  const tasselX    = cx + hw * 0.55;         // offset from centre toward right
  const tasselTopY = cy;                     // starts at board height
  const tasselBotY = s * 0.75;
  const tasselW    = Math.max(1, Math.round(s * 0.04));
  const tasselBall = s * 0.045;

  cv.fillRect(
    tasselX - tasselW / 2, tasselTopY,
    tasselX + tasselW / 2, tasselBotY,
    BR, BG2, BB
  );
  cv.fillCircle(tasselX, tasselBotY + tasselBall * 0.6, tasselBall, BR, BG2, BB);

  return cv.data;
}

// ── Generate ──────────────────────────────────────────────────────────────────

const outDir = path.join(__dirname, "..", "src", "icons");
fs.mkdirSync(outDir, { recursive: true });

console.log("Generating Tufnut icons…");
for (const size of [16, 32, 48, 128]) {
  const pixels   = renderIcon(size);
  const filePath = path.join(outDir, `icon${size}.png`);
  writePng(filePath, size, pixels);
}
console.log("Done.");
