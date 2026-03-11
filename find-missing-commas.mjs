import fs from 'fs';

const content = fs.readFileSync('public/house-3d.html', 'utf8');
const lines = content.split('\n');

for (let i = 0; i < lines.length - 1; i++) {
  const line = lines[i];
  const nextLine = lines[i + 1];
  
  if (/items: \[\]$/.test(line)) {
    // Check if next line needs a comma
    if (/^      \/\//.test(nextLine) || /^      {/.test(nextLine) || /^      \/\*/.test(nextLine)) {
      console.log(`Line ${i + 1}: Missing comma after "items: []"`);
      console.log(`  Current: ${line}`);
      console.log(`  Next: ${nextLine}`);
    }
  }
}
