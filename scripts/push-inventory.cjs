#!/usr/bin/env node
/**
 * Push inventory.json items into Supabase
 * Maps zones → rooms, creates frames per zone, inserts items
 *
 * Run from project root:  node scripts/push-inventory.cjs
 */

const fs = require('fs');
const path = require('path');

const BASE = path.resolve(__dirname, '..');

// Load .env
const env = {};
fs.readFileSync(path.join(BASE, '.env'), 'utf-8').split('\n').forEach(l => {
  const m = l.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
});

const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SUPABASE_KEY = env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_KEY in .env');
  process.exit(1);
}

// Zone → room name mapping
const ZONE_TO_ROOM = {
  'LIVING-BAR-CABINETS': 'Living Room',
  'LIVING-HALL-CLOSET': 'Living Room',
  'KITCHEN-LOWER-CAB': 'Kitchen',
  'KITCHEN-NOOK': 'Kitchen',
  'KITCHEN-NOOK-SOUTH': 'Kitchen',
  'GARAGE-SHELF-NORTH': 'Garage',
  'GARAGE-SHELF-NE': 'Garage',
  'GARAGE-SHELF-WEST': 'Garage',
  'GARAGE-PEGBOARD': 'Garage',
  'GARAGE-FLOOR-NE': 'Garage',
  'GARAGE-BIN-SPEECH': 'Garage',
  'GARAGE-BIN-BARDECOR': 'Garage',
  'GARAGE-BIN-ELECTRONICS': 'Garage',
  'GARAGE-BIN-AUTO': 'Garage',
  'GARAGE-BIN-HARDWARE': 'Garage',
  'WORKHALL-UPPER': 'Work Hallway',
  'GARAGE-BIN-BOOKS': 'Garage',
  'GARAGE-BIN-HEALTH': 'Garage',
  'BSMT-RAISED-W': 'Basement',
  'BSMT-RAISED-E': 'Basement',
  'BSMT-BIN-CLOTHING': 'Basement',
  'BSMT-BIN-BABY': 'Basement',
  'BSMT-BIN-DECOR': 'Basement',
  'BSMT-SHELVING-EW': 'Basement',
  'BSMT-SHELVING-NS': 'Basement',
  'WORKHALL-DRAWERS-N': 'Work Hallway',
  'WORKHALL-DRAWERS-S': 'Work Hallway',
  'WORKHALL-MID-CAB': 'Work Hallway',
  'WORKHALL-SOUTH-CAB': 'Work Hallway',
  'FOYER-COAT-CLOSET': 'Foyer',
  'MASTER-CLOSET-E': 'Master Bedroom',
  'MASTER-CLOSET-W': 'Master Bedroom',
  'BABY-CLOSET': "Baby's Room",
  'BABY-DRESSER': "Baby's Room",
  'BABY-BOOKSHELF': "Baby's Room",
  'BATH-CLOSET': 'Upstairs Hallway',
  'BATH-VANITY': 'Upstairs Hallway',
  'HALL-LAUNDRY': 'Upstairs Hallway',
  'HALL-LINEN': 'Upstairs Hallway',
  'BALCONY': 'Balcony',
  'BALCONY-DECKBOX': 'Balcony',
  'PACKED-BOX:c18': 'Garage',
};

async function supaFetch(endpoint, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': options.prefer || 'return=representation',
      ...options.headers,
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Supabase ${res.status}: ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

async function main() {
  // 1. Load inventory
  const inv = JSON.parse(fs.readFileSync(path.join(BASE, 'inventory.json'), 'utf-8'));
  console.log(`Loaded ${inv.items.length} items from inventory.json`);

  // 2. Fetch existing rooms from Supabase
  const rooms = await supaFetch('rooms?select=id,name');
  console.log(`Found ${rooms.length} rooms in Supabase`);
  const roomByName = {};
  for (const r of rooms) {
    roomByName[r.name] = r.id;
  }

  // 3. Fetch existing frames
  const existingFrames = await supaFetch('frames?select=id,room_id,timestamp');
  console.log(`Found ${existingFrames.length} existing frames`);

  // 4. Fetch existing items to avoid duplicates
  const existingItems = await supaFetch('items?select=id,name,frame_id');
  console.log(`Found ${existingItems.length} existing items`);
  const existingItemNames = new Set(existingItems.map(i => i.name));

  // 5. Group inventory items by zone
  const byZone = {};
  for (const item of inv.items) {
    const z = item.zone || 'UNKNOWN';
    if (!byZone[z]) byZone[z] = [];
    byZone[z].push(item);
  }

  // 6. For each zone, map to room, create frame if needed, insert items
  let totalInserted = 0;
  let skipped = 0;
  const unmappedZones = [];
  let frameCounter = existingFrames.length;

  for (const [zone, items] of Object.entries(byZone)) {
    const roomName = ZONE_TO_ROOM[zone];
    if (!roomName) {
      unmappedZones.push(zone);
      console.log(`  WARNING: No room mapping for zone "${zone}" (${items.length} items)`);
      continue;
    }

    const roomId = roomByName[roomName];
    if (!roomId) {
      console.log(`  WARNING: Room "${roomName}" not found in Supabase (zone: ${zone})`);
      continue;
    }

    // Check if a frame for this zone already exists
    let frame = existingFrames.find(f => f.room_id === roomId && f.timestamp === zone);

    if (!frame) {
      frameCounter++;
      const [newFrame] = await supaFetch('frames', {
        method: 'POST',
        body: JSON.stringify({
          room_id: roomId,
          timestamp: zone,
          sort_order: frameCounter,
        }),
      });
      frame = newFrame;
      existingFrames.push(frame);
      console.log(`  Created frame for zone ${zone} → "${roomName}"`);
    }

    // Insert items that don't already exist
    const newItems = [];
    for (const item of items) {
      if (existingItemNames.has(item.name)) {
        skipped++;
        continue;
      }
      newItems.push({
        frame_id: frame.id,
        name: item.name,
        location: item.notes || zone,
      });
      existingItemNames.add(item.name);
    }

    if (newItems.length > 0) {
      await supaFetch('items', {
        method: 'POST',
        body: JSON.stringify(newItems),
      });
      totalInserted += newItems.length;
      console.log(`  Inserted ${newItems.length} items into ${zone} → "${roomName}"`);
    }
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Total inserted: ${totalInserted}`);
  console.log(`Skipped (already exist): ${skipped}`);
  if (unmappedZones.length > 0) {
    console.log(`Unmapped zones: ${unmappedZones.join(', ')}`);
  }
  console.log('\nDone! Refresh the app to see all items.');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
