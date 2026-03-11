import fs from 'fs';

const src = fs.readFileSync('public/house-3d.html', 'utf8');
const match = src.match(/const ROOMS = \[([\s\S]*?)\n\];/);
if (!match) { 
  console.error('Could not find ROOMS array'); 
  process.exit(1); 
}
let ROOMS;
try { 
  ROOMS = eval('[' + match[1] + ']'); 
  console.log('Parsed successfully!');
  console.log('Total rooms:', ROOMS.length);
} catch (e) { 
  console.error('Parse error:', e.message); 
  process.exit(1); 
}
