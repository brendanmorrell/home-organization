import fs from 'fs';

const content = fs.readFileSync('public/house-3d.html', 'utf8');
const lines = content.split('\n');

let stack = [];
let foundIssues = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  // Track furniture definitions
  if (/{ type:/.test(line)) {
    stack.push({ startLine: i + 1, line });
  }
  
  // Count braces
  for (const char of line) {
    if (char === '{') {
      // Already tracked furniture definitions
    }
    if (char === '}' && /items:\s*\[\]/.test(lines[i])) {
      // This is closing a furniture item
      if (stack.length > 0) {
        const item = stack.pop();
        if (!line.includes('},')) {
          foundIssues.push(`Line ${i + 1} (${item.startLine}): Missing comma after closing brace`);
        }
      }
    }
  }
}

foundIssues.forEach(issue => console.log(issue));

if (stack.length > 0) {
  console.log(`\nUnclosed furniture items:`);
  stack.forEach(item => {
    console.log(`  Line ${item.startLine}: ${item.line.substring(0, 70)}`);
  });
}
