import fs from 'fs';

const content = fs.readFileSync('public/house-3d.html', 'utf8');
const lines = content.split('\n');

// Find all room declarations
const rooms = [];
for (let i = 0; i < lines.length; i++) {
  if (/id:\s*"r\d+"/.test(lines[i])) {
    const match = lines[i].match(/id:\s*"(r\d+)"/);
    rooms.push({ id: match[1], lineNum: i + 1, line: lines[i] });
  }
}

console.log('Rooms found:');
rooms.forEach(r => console.log(`  ${r.id} at line ${r.lineNum}`));

// Now check if each room has a closing brace
rooms.forEach(room => {
  // Find the furniture array closing for this room
  let foundClosing = false;
  for (let i = room.lineNum; i < lines.length; i++) {
    if (/^\s+},$/.test(lines[i]) && i > room.lineNum + 10) {
      // This might be the room closing
      foundClosing = true;
      console.log(`  ${room.id}: room closing found at line ${i + 1}`);
      break;
    }
  }
  if (!foundClosing) {
    console.log(`  ${room.id}: NO CLOSING BRACE FOUND`);
  }
});
