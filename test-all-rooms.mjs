import fs from 'fs';

const src = fs.readFileSync('public/house-3d.html', 'utf8');
const match = src.match(/const ROOMS = \[([\s\S]*?)\n\];/);
if (!match) {
  console.error('No match');
  process.exit(1);
}

const code = 'const ROOMS = [' + match[1] + '\n];';

// Now try eval
try {
  eval(code);
  console.log('SUCCESS: Parsed all', ROOMS.length, 'rooms');
} catch (e) {
  console.error('PARSE ERROR:', e.message);
  // Find the problematic line number
  const lines = code.split('\n');
  const errorPos = code.indexOf(e.message);
  console.error('Stack:', e.stack);
}
