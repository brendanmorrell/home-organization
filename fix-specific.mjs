import fs from 'fs';

const targetLines = [1251, 1333, 1341, 1366, 1380, 1388, 1854, 1863];
let content = fs.readFileSync('public/house-3d.html', 'utf8');
let lines = content.split('\n');

targetLines.forEach(lineNum => {
  // Find the items: [] line after this furniture definition
  for (let i = lineNum - 1; i < Math.min(lineNum + 10, lines.length); i++) {
    if (/items:\s*\[\]\s*$/.test(lines[i])) {
      console.log(`Fixing line ${i + 1} (was missing comma after ${lines[i].trim()})`);
      lines[i] = lines[i].replace(/items:\s*\[\]\s*$/, 'items: []},');
      break;
    }
  }
});

fs.writeFileSync('public/house-3d.html', lines.join('\n'));
console.log('Fixes applied');
