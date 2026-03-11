import fs from 'fs';

const src = fs.readFileSync('public/house-3d.html', 'utf8');

// Find the ROOMS array
const match = src.match(/const ROOMS = \[([\s\S]*?)\n\];/);
if (!match) {
  console.error('Could not find ROOMS array');
  process.exit(1);
}

// Try parsing just the first room
const roomContent = match[1];
const firstRoomEnd = roomContent.indexOf('\n  },\n  {');
if (firstRoomEnd === -1) {
  console.error('Could not find first room boundary');
  process.exit(1);
}

const firstRoom = roomContent.substring(0, firstRoomEnd + 7); // Include closing },
try {
  eval('[' + firstRoom + ']');
  console.log('First room parsed OK');
} catch (e) {
  console.error('Error in first room:', e.message);
}
