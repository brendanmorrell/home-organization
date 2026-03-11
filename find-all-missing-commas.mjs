import fs from 'fs';

const content = fs.readFileSync('public/house-3d.html', 'utf8');
const lines = content.split('\n');

const issues = [];

for (let i = 0; i < lines.length - 1; i++) {
  const line = lines[i];
  const nextLine = lines[i + 1];
  
  // Looking for "items: []" not followed by a comma
  if (/^\s+items:\s*\[\]\s*$/.test(line)) {
    // Check next line
    if (!/^\s*(},|],|},$)/.test(nextLine) && nextLine.trim() !== '' && nextLine.trim() !== '//') {
      // Special case: if it's a comment, check the line after
      if (nextLine.trim().startsWith('//')) {
        const lineAfter = i + 2 < lines.length ? lines[i + 2] : '';
        if (!/^\s*(},|],|},$)/.test(lineAfter) && lineAfter.trim() !== '') {
          issues.push(`Line ${i + 1}: Possible missing comma (followed by ${nextLine.trim().substring(0, 40)}...)`);
        }
      } else if (/^\s*{/.test(nextLine)) {
        issues.push(`Line ${i + 1}: MISSING COMMA (next line starts with {)`);
      }
    }
  }
}

issues.forEach(issue => console.log(issue));
