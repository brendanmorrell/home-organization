#!/usr/bin/env node
/**
 * inv.js — Home Inventory CLI
 *
 * Usage:
 *   node inv.js list [zone|category|source] [filter]   List items
 *   node inv.js zones                                   Show all storage zones + item counts
 *   node inv.js search <term>                           Search items by name
 *   node inv.js move <itemId> <newZone>                 Move item to a new zone
 *   node inv.js add <name> <category> <zone> [source]   Add a new item
 *   node inv.js remove <itemId>                         Remove an item
 *   node inv.js stats                                   Show inventory statistics
 *   node inv.js unassigned                              Show items not yet placed
 *   node inv.js packed                                  Show items in packed boxes
 *   node inv.js actions                                 Show items with dispositions
 *
 * Examples:
 *   node inv.js search "tape"
 *   node inv.js list zone KITCHEN-UPPER-CAB
 *   node inv.js move i046 GARAGE-FLOOR
 *   node inv.js unassigned
 *   node inv.js add "New blender" appliance KITCHEN-NOOK IMG_9999
 */

const fs = require('fs');
const path = require('path');

const INV_PATH = path.join(__dirname, 'inventory.json');

function load() {
  return JSON.parse(fs.readFileSync(INV_PATH, 'utf-8'));
}

function save(data) {
  data.meta.updatedAt = new Date().toISOString();
  fs.writeFileSync(INV_PATH, JSON.stringify(data, null, 2) + '\n');
}

function nextId(items) {
  const max = items.reduce((m, i) => {
    const n = parseInt(i.id.replace('i', ''), 10);
    return n > m ? n : m;
  }, 0);
  return 'i' + String(max + 1).padStart(3, '0');
}

const [,, cmd, ...args] = process.argv;

switch (cmd) {
  case 'list': {
    const data = load();
    const [by, filter] = args;
    let items = data.items;
    if (by && filter) {
      items = items.filter(i => (i[by] || '').toLowerCase().includes(filter.toLowerCase()));
    }
    items.forEach(i => {
      console.log(`  ${i.id}  [${i.zone}]  ${i.name}${i.disposition ? '  ⚑ ' + i.disposition : ''}`);
    });
    console.log(`\n${items.length} items`);
    break;
  }

  case 'zones': {
    const data = load();
    const zoneMap = {};
    data.items.forEach(i => {
      if (!zoneMap[i.zone]) zoneMap[i.zone] = [];
      zoneMap[i.zone].push(i);
    });
    Object.keys(zoneMap).sort().forEach(z => {
      console.log(`  ${z} (${zoneMap[z].length} items)`);
      zoneMap[z].forEach(i => console.log(`    ${i.id}  ${i.name}`));
    });
    break;
  }

  case 'search': {
    const data = load();
    const term = args.join(' ').toLowerCase();
    const matches = data.items.filter(i =>
      i.name.toLowerCase().includes(term) ||
      (i.notes || '').toLowerCase().includes(term) ||
      i.category.toLowerCase().includes(term)
    );
    matches.forEach(i => {
      console.log(`  ${i.id}  [${i.zone}]  ${i.name}`);
      if (i.notes) console.log(`         ${i.notes}`);
    });
    console.log(`\n${matches.length} matches for "${term}"`);
    break;
  }

  case 'move': {
    const [itemId, newZone] = args;
    if (!itemId || !newZone) { console.log('Usage: node inv.js move <itemId> <newZone>'); break; }
    const data = load();
    const item = data.items.find(i => i.id === itemId);
    if (!item) { console.log(`Item ${itemId} not found`); break; }
    const oldZone = item.zone;
    item.zone = newZone;
    save(data);
    console.log(`Moved "${item.name}" from ${oldZone} → ${newZone}`);
    break;
  }

  case 'add': {
    const [name, category, zone, source] = args;
    if (!name || !category || !zone) { console.log('Usage: node inv.js add <name> <category> <zone> [source]'); break; }
    const data = load();
    const id = nextId(data.items);
    const newItem = { id, name, category, zone, source: source || 'manual' };
    data.items.push(newItem);
    save(data);
    console.log(`Added ${id}: "${name}" → ${zone}`);
    break;
  }

  case 'remove': {
    const [itemId] = args;
    if (!itemId) { console.log('Usage: node inv.js remove <itemId>'); break; }
    const data = load();
    const idx = data.items.findIndex(i => i.id === itemId);
    if (idx === -1) { console.log(`Item ${itemId} not found`); break; }
    const removed = data.items.splice(idx, 1)[0];
    save(data);
    console.log(`Removed ${removed.id}: "${removed.name}" from ${removed.zone}`);
    break;
  }

  case 'stats': {
    const data = load();
    const items = data.items;
    const zones = new Set(items.map(i => i.zone));
    const categories = new Set(items.map(i => i.category));
    const placed = items.filter(i => !i.zone.startsWith('PACKED-BOX') && i.zone !== 'UNASSIGNED');
    const packed = items.filter(i => i.zone.startsWith('PACKED-BOX'));
    const unassigned = items.filter(i => i.zone === 'UNASSIGNED');
    const withActions = items.filter(i => i.disposition);
    console.log(`Inventory Stats:`);
    console.log(`  Total items: ${items.length}`);
    console.log(`  Unique zones: ${zones.size}`);
    console.log(`  Categories: ${categories.size}`);
    console.log(`  In-place (in house): ${placed.length}`);
    console.log(`  In packed boxes: ${packed.length}`);
    console.log(`  Unassigned: ${unassigned.length}`);
    console.log(`  With action items: ${withActions.length}`);
    break;
  }

  case 'unassigned': {
    const data = load();
    const items = data.items.filter(i => i.zone === 'UNASSIGNED');
    items.forEach(i => console.log(`  ${i.id}  ${i.name}  (${i.category})`));
    console.log(`\n${items.length} unassigned items`);
    break;
  }

  case 'packed': {
    const data = load();
    const boxMap = {};
    data.items.filter(i => i.zone.startsWith('PACKED-BOX')).forEach(i => {
      if (!boxMap[i.zone]) boxMap[i.zone] = [];
      boxMap[i.zone].push(i);
    });
    Object.keys(boxMap).sort().forEach(b => {
      console.log(`  ${b} (${boxMap[b].length} items):`);
      boxMap[b].forEach(i => console.log(`    ${i.id}  ${i.name}`));
    });
    break;
  }

  case 'actions': {
    const data = load();
    const items = data.items.filter(i => i.disposition);
    items.forEach(i => {
      console.log(`  ${i.id}  [${i.disposition}]  ${i.name}  (${i.zone})`);
    });
    console.log(`\n${items.length} action items`);
    break;
  }

  default:
    console.log(`Home Inventory CLI — ${load().items.length} items tracked`);
    console.log(`Commands: list, zones, search, move, add, remove, stats, unassigned, packed, actions`);
    console.log(`Run: node inv.js <command> --help for usage`);
}
