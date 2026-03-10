// Room Layout Validator — catches positioning, bounds, and overlap errors
// Run with: node validate-room.js

import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(join(__dirname, 'public/test.html'), 'utf8');

// Extract ROOMS array
const match = src.match(/const ROOMS = \[([\s\S]*?)\n\];/);
if (!match) { console.error('Could not find ROOMS array'); process.exit(1); }
let ROOMS;
try { ROOMS = eval('[' + match[1] + ']'); } catch (e) { console.error('Parse error:', e.message); process.exit(1); }

let errors = 0;
let warnings = 0;

function err(room, furn, msg) { errors++; console.log(`  ❌ ERROR [${furn}]: ${msg}`); }
function warn(room, furn, msg) { warnings++; console.log(`  ⚠️  WARN  [${furn}]: ${msg}`); }

ROOMS.forEach(room => {
  console.log(`\n=== ${room.name} (${room.width}m × ${room.depth}m × ${room.height}m) ===`);
  const halfW = room.width / 2;
  const halfD = room.depth / 2;
  const halfH = room.height / 2;
  const floorY = -halfH;
  const ceilY = halfH;

  room.furniture.forEach(furn => {
    const name = furn.name;
    const { x, y, z, w, h, d } = furn;

    // 1. Check bounds — is furniture inside the room?
    const leftEdge = x - w / 2;
    const rightEdge = x + w / 2;
    const frontEdge = z - d / 2;
    const backEdge = z + d / 2;
    const bottomEdge = y - h / 2;
    const topEdge = y + h / 2;

    if (leftEdge < -halfW - 0.05) err(room.name, name, `LEFT edge at ${leftEdge.toFixed(2)} exceeds wall at ${(-halfW).toFixed(2)} by ${(-halfW - leftEdge).toFixed(2)}m`);
    if (rightEdge > halfW + 0.05) err(room.name, name, `RIGHT edge at ${rightEdge.toFixed(2)} exceeds wall at ${halfW.toFixed(2)} by ${(rightEdge - halfW).toFixed(2)}m`);
    if (frontEdge < -halfD - 0.05) err(room.name, name, `FRONT edge at ${frontEdge.toFixed(2)} exceeds wall at ${(-halfD).toFixed(2)} by ${(-halfD - frontEdge).toFixed(2)}m`);
    if (backEdge > halfD + 0.05) err(room.name, name, `BACK edge at ${backEdge.toFixed(2)} exceeds wall at ${halfD.toFixed(2)} by ${(backEdge - halfD).toFixed(2)}m`);
    if (bottomEdge < floorY - 0.05) err(room.name, name, `BOTTOM at ${bottomEdge.toFixed(2)} is below floor at ${floorY.toFixed(2)}`);
    if (topEdge > ceilY + 0.05) warn(room.name, name, `TOP at ${topEdge.toFixed(2)} exceeds ceiling at ${ceilY.toFixed(2)}`);

    // 2. Check y positioning — is the item on the floor or reasonably wall-mounted?
    const distFromFloor = bottomEdge - floorY;
    const isStructural = furn.category === 'Structural' || name.includes('Door') || name.includes('Staircase');
    const isWallMounted = name.includes('TV') || name.includes('Wine Rack') || name.includes('Upper') ||
                          name.includes('Mantel') || name.includes('Arch') || name.includes('Signs') ||
                          name.includes('Pegboard') || name.includes('Hook') || name.includes('Counter');
    const isRug = name.includes('Rug');

    if (!isWallMounted && !isStructural && !isRug && distFromFloor > 0.15) {
      err(room.name, name, `FLOATING ${distFromFloor.toFixed(2)}m above floor (bottom=${bottomEdge.toFixed(2)}, floor=${floorY.toFixed(2)}). Expected y ≈ ${(floorY + h/2).toFixed(3)}`);
    }
    if (!isRug && distFromFloor < -0.1) {
      err(room.name, name, `SUNK ${(-distFromFloor).toFixed(2)}m into floor`);
    }

    // 3. Check dimensions are reasonable
    if (w <= 0 || h <= 0 || d <= 0) err(room.name, name, `Invalid dimensions: w=${w}, h=${h}, d=${d}`);
    if (w > room.width) warn(room.name, name, `Width ${w}m exceeds room width ${room.width}m`);
    if (d > room.depth) warn(room.name, name, `Depth ${d}m exceeds room depth ${room.depth}m`);
  });

  // 4. Check for overlaps between furniture
  const boxes = room.furniture.map(f => ({
    name: f.name,
    minX: f.x - f.w/2, maxX: f.x + f.w/2,
    minY: f.y - f.h/2, maxY: f.y + f.h/2,
    minZ: f.z - f.d/2, maxZ: f.z + f.d/2,
  }));

  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      const overlapX = Math.max(0, Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX));
      const overlapY = Math.max(0, Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY));
      const overlapZ = Math.max(0, Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ));
      const overlapVol = overlapX * overlapY * overlapZ;
      if (overlapVol > 0.01) {  // more than 10 liters of overlap
        warn(room.name, `${a.name} ↔ ${b.name}`, `OVERLAP of ${(overlapVol * 1000).toFixed(0)} liters (${overlapX.toFixed(2)}×${overlapY.toFixed(2)}×${overlapZ.toFixed(2)}m)`);
      }
    }
  }
});

console.log(`\n============================`);
console.log(`Total: ${errors} errors, ${warnings} warnings`);
if (errors > 0) process.exit(1);
