import fs from 'fs';

const content = fs.readFileSync('public/house-3d.html', 'utf8');
const lines = content.split('\n');

console.log('Looking for issues...');

// Find lines with } followed by lines starting with {
for (let i = 0; i < lines.length - 1; i++) {
  const line = lines[i];
  const nextLine = lines[i + 1];
  
  // Check for missing closing braces/brackets
  if (/items:\s*\[\]\s*$/.test(line) && /^\s*{/.test(nextLine) && !/},/.test(lines[i])) {
    console.log(`Issue at line ${i + 1}: Missing closing brace`);
  }
  
  // Check for orphaned opening braces
  if (/^\s*{\s*$/.test(line) && i > 0) {
    const prevLine = lines[i - 1];
    if (!prevLine.endsWith(',') && !prevLine.endsWith('[') && !prevLine.endsWith('{') && !prevLine.includes('//')) {
      console.log(`Issue at line ${i}: Missing comma before {`);
      console.log(`  ${prevLine}`);
      console.log(`  ${line}`);
    }
  }
}

console.log('Done checking');
