import fs from 'fs';

const content = fs.readFileSync('public/house-3d.html', 'utf8');
const start = content.indexOf('const ROOMS = [');
const end = content.indexOf('];', start) + 2;
const roomsCode = content.substring(start, end);
const lines = roomsCode.split('\n');

// Find lines that open braces but might not close them
const stack = [];

for (let i = 1; i < lines.length; i++) {
  const line = lines[i];
  
  // Count braces on this line
  for (const char of line) {
    if (char === '{') {
      stack.push({ line: i, content: line.substring(0, 60) });
    }
    if (char === '}') {
      if (stack.length === 0) {
        console.log(`Extra closing brace at line ${i}`);
      } else {
        stack.pop();
      }
    }
  }
}

if (stack.length > 0) {
  console.log(`${stack.length} unclosed opening braces:`);
  stack.forEach(item => {
    console.log(`  Line ${item.line}: ${item.content}...`);
  });
}
