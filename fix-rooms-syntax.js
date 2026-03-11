import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, 'public', 'house-3d.html');

console.log('Reading', htmlPath);
let html = fs.readFileSync(htmlPath, 'utf-8');

// Extract ROOMS array
const startIdx = html.indexOf('const ROOMS = [');
const endIdx = html.indexOf('];', startIdx);
const before = html.substring(0, startIdx);
const roomsSection = html.substring(startIdx, endIdx + 2);
const after = html.substring(endIdx + 2);

console.log('Extracted', roomsSection.length, 'chars');

// Get just the array content
const match = roomsSection.match(/const ROOMS = \[([\s\S]*?)\];/);
let arrayContent = match[1];

// Count braces
let openBraces = 0, closeBraces = 0;
for (const char of arrayContent) {
  if (char === '{') openBraces++;
  if (char === '}') closeBraces++;
}
console.log('Braces: { count =', openBraces, ', } count =', closeBraces, ', diff =', openBraces - closeBraces);

// Apply fixes: look for closing brace not followed by comma or closing bracket
const lines = arrayContent.split('\n');
const fixed_lines = [];

for (let i = 0; i < lines.length; i++) {
  let line = lines[i];

  // Check if this line ends with } but not },
  if (line.trim().endsWith('}') && !line.trim().endsWith('},') && !line.trim().endsWith('};')) {
    // Look at next line
    const nextLine = i + 1 < lines.length ? lines[i + 1].trim() : '';

    // If next line starts with { or is another property, add comma
    if (nextLine.startsWith('{') || nextLine.includes(':') || nextLine === ']' || nextLine === '},') {
      // This } needs a comma before closing
      // Replace the last } with },
      line = line.replace(/}\s*$/, '},');
      console.log('Added comma at line', i + 374, ':', line.substring(Math.max(0, line.length - 60)));
    }
  }

  fixed_lines.push(line);
}

let fixed = fixed_lines.join('\n');

// Test parse
console.log('\n--- Testing parse ---');
try {
  const testRooms = eval('[' + fixed + ']');
  console.log('SUCCESS! Parsed', testRooms.length, 'rooms');
  testRooms.forEach(r => {
    console.log(' ', r.id, r.name, r.furniture?.length || 0, 'furniture');
  });
} catch(err) {
  console.error('ERROR:', err.message);
  console.error('\nTrying to isolate...');

  // Count braces in fixed version
  let open = 0, close = 0;
  for (const char of fixed) {
    if (char === '{') open++;
    if (char === '}') close++;
  }
  console.log('Fixed braces: { =', open, ', } =', close, ', diff =', open - close);

  // If still unbalanced, try to find the problem
  if (open !== close) {
    const testLines = fixed.split('\n');
    for (let i = 0; i < testLines.length; i++) {
      const line = testLines[i];
      let o = (line.match(/{/g) || []).length;
      let c = (line.match(/}/g) || []).length;

      if (o > 0 && c === 0) {
        console.log('Line', i + 374, 'opens but doesnt close:', line.substring(0, 80));
      }
    }
  }

  process.exit(1);
}

// Write back
const newHtml = before + 'const ROOMS = [' + fixed + '];' + after;
fs.writeFileSync(htmlPath, newHtml, 'utf-8');
console.log('\nWrote fixed HTML back to', htmlPath);
