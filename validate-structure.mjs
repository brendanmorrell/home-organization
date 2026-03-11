import fs from 'fs';

const content = fs.readFileSync('public/house-3d.html', 'utf8');
const start = content.indexOf('const ROOMS = [');
const end = content.indexOf('];', start) + 2;
const roomsCode = content.substring(start, end);

// Count opening and closing braces
let openBraces = 0;
let closeBraces = 0;
let openBrackets = 0;
let closeBrackets = 0;

for (let i = 0; i < roomsCode.length; i++) {
  const char = roomsCode[i];
  if (char === '{') openBraces++;
  if (char === '}') closeBraces++;
  if (char === '[') openBrackets++;
  if (char === ']') closeBrackets++;
}

console.log('Open braces:', openBraces);
console.log('Close braces:', closeBraces);
console.log('Open brackets:', openBrackets);
console.log('Close brackets:', closeBrackets);

if (openBraces !== closeBraces) {
  console.log('ERROR: Mismatched braces!');
  process.exit(1);
}

if (openBrackets !== closeBrackets) {
  console.log('ERROR: Mismatched brackets!');
  process.exit(1);
}

console.log('Counts are balanced');

// Now try actual eval
try {
  eval(roomsCode);
  console.log('SUCCESS: Parsed', ROOMS.length, 'rooms');
} catch (e) {
  console.error('EVAL ERROR:', e.message);
  // Try to find approximate location
  const lines = roomsCode.split('\n');
  console.log(`Total lines: ${lines.length}`);
  
  // Try binary search
  for (let mid = Math.floor(lines.length / 2); mid > 10; mid = Math.floor(mid / 2)) {
    const testCode = 'const ROOMS = [\n' + lines.slice(1, mid).join('\n') + '\n];';
    try {
      eval(testCode);
      console.log(`✓ First ${mid} lines parse OK`);
    } catch (e2) {
      console.log(`✗ Error in first ${mid} lines`);
    }
  }
}
