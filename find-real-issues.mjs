import fs from 'fs';

const content = fs.readFileSync('public/house-3d.html', 'utf8');
const lines = content.split('\n');

const stack = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  // Count open and close braces
  for (let j = 0; j < line.length; j++) {
    const char = line[j];
    if (char === '{') {
      stack.push({lineNum: i + 1, col: j, content: line.substring(0, 70)});
    } else if (char === '}') {
      if (stack.length > 0) {
        stack.pop();
      } else {
        console.log(`Extra closing brace at line ${i + 1}, col ${j}: ${line}`);
      }
    }
  }
}

if (stack.length > 0) {
  console.log(`${stack.length} unclosed opening braces:`);
  stack.slice(0, 10).forEach(item => {
    console.log(`  Line ${item.lineNum}: ${item.content}...`);
  });
}
