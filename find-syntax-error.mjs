import fs from 'fs';

const src = fs.readFileSync('public/house-3d.html', 'utf8');
const match = src.match(/const ROOMS = \[([\s\S]*?)\n\];/);
if (!match) {
  console.error('No match');
  process.exit(1);
}

const roomContent = match[1];

// Try to find where the first room ends more carefully
let braceCount = 0;
let startIdx = -1;
let endIdx = -1;
let inFirstRoom = false;

for (let i = 0; i < roomContent.length; i++) {
  const char = roomContent[i];
  const prevChar = i > 0 ? roomContent[i-1] : '';
  const nextChar = i < roomContent.length - 1 ? roomContent[i+1] : '';
  
  if (char === '{' && !inFirstRoom && (prevChar === '\n' || prevChar === ' ' || i === 0)) {
    if (!inFirstRoom) {
      startIdx = i;
      inFirstRoom = true;
    }
    braceCount++;
  } else if (char === '{') {
    if (inFirstRoom) braceCount++;
  } else if (char === '}') {
    if (inFirstRoom) {
      braceCount--;
      if (braceCount === 0) {
        endIdx = i;
        break;
      }
    }
  }
}

if (startIdx !== -1 && endIdx !== -1) {
  const firstRoom = roomContent.substring(startIdx, endIdx + 1);
  console.log('First room length:', firstRoom.length);
  console.log('First 200 chars:', firstRoom.substring(0, 200));
  console.log('Last 200 chars:', firstRoom.substring(firstRoom.length - 200));
  
  try {
    eval('[' + firstRoom + ']');
    console.log('✓ First room parsed successfully');
  } catch (e) {
    console.error('✗ Parse error:', e.message);
    console.log('Line with error might be around:', e.stack.split('\n')[0]);
  }
}
