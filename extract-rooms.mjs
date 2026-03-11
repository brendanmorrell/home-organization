import fs from 'fs';

const src = fs.readFileSync('public/house-3d.html', 'utf8');
const start = src.indexOf('const ROOMS = [');
const end = src.indexOf('];', start) + 2;
const code = src.substring(start, end);

// Write to temp file
fs.writeFileSync('temp-rooms.js', code);

// Now try to eval it
try {
  const ctx = {};
  eval(code);
  console.log('Parsed successfully! Rooms:', ctx.ROOMS.length);
} catch (e) {
  console.error('Parse error at character', e.message);
  // Try to find the line
  const before = code.substring(Math.max(0, e.index - 100), e.index);
  const after = code.substring(e.index, Math.min(code.length, e.index + 100));
  console.log('Context before:', JSON.stringify(before));
  console.log('Error:', e.message);
  console.log('Context after:', JSON.stringify(after));
}
