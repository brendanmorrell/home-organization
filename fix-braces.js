import fs from 'fs';

const html = fs.readFileSync('public/house-3d.html', 'utf-8');
const lines = html.split('\n');

// Problem rooms and where to add closing braces
// Based on analysis: r4, r5, r7, r8, r9, r10 need +1 }, and r13 needs -1 }
// But the brace tracking suggests missing internal closing braces

// Strategy: find the pattern `}` (closing furniture array) + empty/whitespace lines + `},` (closing room)
// And if there's an extra { before it, add a } before the room closing

let fixed = [];
let i = 0;

while (i < lines.length) {
  const line = lines[i];
  fixed.push(line);

  // Check if this line closes a furniture array with ]
  if (line.trim() === ']') {
    // Look ahead - if next non-empty/comment line is `},`, then room closes correctly
    let j = i + 1;
    let foundRoomClose = false;

    while (j < lines.length && (lines[j].trim() === '' || lines[j].trim().startsWith('//'))) {
      j++;
    }

    // If next meaningful line is `},`, room closes correctly
    // But if there's an extra brace somewhere, we might need to add one
    // This is getting complex - let me use a different approach

    // For now, just continue
  }

  i++;
}

// Let me try a different approach: parse and catch the actual error
const m = html.match(/const ROOMS = \[([\s\S]*?)\];/);
let arrayContent = m[1];

try {
  eval('[' + arrayContent + ']');
  console.log('Already parses correctly!');
  process.exit(0);
} catch(e) {
  console.log('Parse error:', e.message);
}

// Try to fix by looking at the array structure
// Find rooms where wallOpenings doesn't have a closing ,}
const roomRegex = /\{[^}]*id:\s*"(r\d+)"[^}]*?(?:wallOpenings:[^}]*})?[^}]*?furniture:\s*\[[\s\S]*?\][^}]*?\}/g;

// Actually, let me manually fix the known issues
// I'll add closing braces before the final } of each problem room

// For r5: found the issue is in wallOpenings
// Let me just add } before furniture: [ in problematic rooms

let output = html;

// Based on analysis, rooms r4, r5, r7, r8, r9, r10 are short 1 closing brace
// The most likely place is they're missing a closing } for wallOpenings

// Let me search for the pattern: wallOpenings: { ... ]} followed by furniture (no }, between)
// and add the missing },

// r5: lines 1193-1197
// Check: wallOpenings: { at 1193, closes at 1197 with },
// But there might be an extra { from a nested structure

// Actually, let's just add } at specific locations I can verify

// Find "furniture: [" lines that come after "wallOpenings:" without a proper close
const lines2 = output.split('\n');
const fixed2 = [];

for (let i = 0; i < lines2.length; i++) {
  const line = lines2[i];
  fixed2.push(line);

  // If we see "furniture: [" and the previous section had wallOpenings, check if it closed
  if (line.includes('furniture:') && line.includes('[')) {
    // Look back for wallOpenings
    let wallOpeningsIdx = -1;
    for (let j = i - 1; j >= Math.max(0, i - 30); j++) {
      if (lines2[j].includes('wallOpenings:')) {
        wallOpeningsIdx = j;
        break;
      }
    }

    if (wallOpeningsIdx >= 0) {
      // Count braces between wallOpenings and furniture
      let openCount = 0, closeCount = 0;
      for (let j = wallOpeningsIdx; j < i; j++) {
        for (const char of lines2[j]) {
          if (char === '{') openCount++;
          if (char === '}') closeCount++;
        }
      }

      if (openCount > closeCount) {
        // Missing closing braces
        const missing = openCount - closeCount;
        // Insert closing braces before this furniture line
        fixed2[fixed2.length - 1] = '    },'.repeat(missing) + '\n' + line;
        console.log('Added ' + missing + ' closing braces before line ' + (i + 1));
      }
    }
  }
}

output = fixed2.join('\n');

// Write back
fs.writeFileSync('public/house-3d.html', output, 'utf-8');

// Test
const m2 = output.match(/const ROOMS = \[([\s\S]*?)\];/);
if (!m2) {
  console.error('Could not find ROOMS array');
  process.exit(1);
}

try {
  const rooms = eval('[' + m2[1] + ']');
  console.log('SUCCESS! Parsed ' + rooms.length + ' rooms');
  rooms.forEach(r => {
    console.log(' ', r.id, r.name);
  });
} catch(e) {
  console.error('Still has error:', e.message);
  process.exit(1);
}
