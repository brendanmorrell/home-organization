import fs from 'fs';

const src = fs.readFileSync('public/house-3d.html', 'utf8');

// Find line 373
const lines = src.split('\n');
console.log('Line 373:', lines[372]);

const match = src.match(/const ROOMS = \[([\s\S]*?)\n\];/);
if (!match) {
  console.error('Could not find ROOMS array');
  process.exit(1);
}

const content = match[1];
console.log('Content starts with:', content.substring(0, 100));
console.log('Content ends with:', content.substring(content.length - 100));

// Try to find missing commas or unclosed brackets before line 800
const testContent = content.substring(0, content.indexOf('\n  },\n  {\n    id: "r2"'));
console.log('Testing up to r2...');
try {
  eval('[' + testContent + '\n  }]');
  console.log('✓ Up to r2 is OK');
} catch (e) {
  console.error('✗ Error before r2:', e.message);
}
