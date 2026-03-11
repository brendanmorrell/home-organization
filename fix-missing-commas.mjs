import fs from 'fs';

let content = fs.readFileSync('public/house-3d.html', 'utf8');
const lines = content.split('\n');

const issuesFound = [];

for (let i = 0; i < lines.length - 1; i++) {
  const line = lines[i];
  const nextLine = lines[i + 1];
  
  // Looking for "items: []" not followed by a comma/bracket/comment
  if (/^\s+items:\s*\[\]\s*$/.test(line) && nextLine.trim() !== '') {
    if (!/^\s*(},|],|},$)/.test(nextLine) && !nextLine.trim().startsWith('//')) {
      issuesFound.push(i);
    }
  }
}

console.log(`Found ${issuesFound.length} missing commas`);

// Fix them in reverse order to preserve line numbers
for (let i = issuesFound.length - 1; i >= 0; i--) {
  const lineIdx = issuesFound[i];
  lines[lineIdx] = lines[lineIdx].replace(/items:\s*\[\]\s*$/, 'items: []},');
  console.log(`Fixed line ${lineIdx + 1}`);
}

fs.writeFileSync('public/house-3d.html', lines.join('\n'));
console.log('File updated');
