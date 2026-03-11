import fs from 'fs';

const src = fs.readFileSync('public/house-3d.html', 'utf8');
const match = src.match(/const ROOMS = \[([\s\S]*?)\n\];/);
if (!match) {
  console.error('No match');
  process.exit(1);
}

const roomContent = match[1];

// Find each room
let rooms = [];
let braceCount = 0;
let startIdx = -1;

for (let i = 0; i < roomContent.length; i++) {
  const char = roomContent[i];
  const prevThree = roomContent.substring(Math.max(0, i-3), i);
  
  if (char === '{' && (prevThree.endsWith('\n  {') || i === 0 || prevThree.endsWith('[\n  {'))) {
    if (startIdx === -1) startIdx = i;
    braceCount = 1;
    let j = i + 1;
    let localBraces = 1;
    while (j < roomContent.length && localBraces > 0) {
      if (roomContent[j] === '{') localBraces++;
      if (roomContent[j] === '}') localBraces--;
      j++;
    }
    rooms.push({idx: rooms.length, start: i, end: j, len: j - i});
  }
}

console.log('Found', rooms.length, 'rooms');
rooms.forEach(r => {
  const room = roomContent.substring(r.start, r.end);
  try {
    eval('[' + room + ']');
    console.log(`✓ Room ${r.idx} parses OK`);
  } catch (e) {
    console.log(`✗ Room ${r.idx} error:`, e.message.substring(0, 60));
  }
});
