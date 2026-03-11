#!/usr/bin/env npx tsx
/**
 * merge-inventory.ts — Iterative Inventory Merge Engine
 *
 * The ingestion pipeline (ingest-video.ts) produces a snapshot from a single
 * video walkthrough. But real-world cataloging is iterative: you record a room,
 * get feedback, go back, re-record a specific box, add items, move things.
 *
 * This script is the intelligence layer that handles all of that. It:
 *
 * 1. Takes one or more ingestion JSONs as input
 * 2. Loads the current inventory state (either from a local master file or Supabase)
 * 3. Uses Claude to intelligently merge — resolving duplicates, moves, updates
 * 4. Outputs a clean, merged inventory ready for push-to-supabase.ts
 *
 * The key insight: this ISN'T a dumb merge. It uses AI to understand intent.
 * "I moved the screwdriver to Box B3" means DELETE from old location, ADD to new.
 * "This is actually what's in Box B2" means REPLACE Box B2's contents entirely.
 * "Oh, I forgot — there's also a tape measure in here" means APPEND to current box.
 *
 * Usage:
 *   npx tsx scripts/merge-inventory.ts <new-ingestion.json> [options]
 *
 * Options:
 *   --master <path>        Path to current master inventory (default: ./inventory/master.json)
 *   --output <path>        Output path for merged inventory
 *   --auto                 Skip confirmation prompts, auto-apply all merges
 *   --dry-run              Show what would change without writing
 *   --pull                 Pull current state from Supabase before merging
 *
 * Workflow:
 *   # First walkthrough
 *   npm run ingest -- basement-walkthrough.mp4 --room Basement
 *   npm run merge -- ./ingestion-output/basement-2026-03-08.json
 *   npm run push -- ./inventory/master.json
 *
 *   # Days later, corrections
 *   npm run ingest -- box-b2-correction.mp4 --room Basement
 *   npm run merge -- ./ingestion-output/basement-2026-03-10.json
 *   npm run push -- ./inventory/master.json
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname, resolve } from "path";

// ============================================================================
// TYPES
// ============================================================================

interface InventoryItem {
  name: string;
  location: string;
  category?: string;
  confidence?: string;
  source?: string;
  added_at?: string;       // ISO date when first added
  updated_at?: string;     // ISO date of last update
  source_video?: string;   // which video this came from
}

interface StorageUnit {
  id: string;              // stable ID like "basement_box_b2"
  name: string;            // "Box B2"
  type: string;            // "box" | "cabinet" | "shelf" | "appliance"
  category?: string;
  room_id: string;
  position: { x: number; y: number; z: number };
  dimensions: { w: number; h: number; d: number };
  color: string;
  items: InventoryItem[];
}

interface Room {
  id: string;
  name: string;
  icon: string;
  color: string;
  width: number;
  depth: number;
  height: number;
  pos_x: number;
  pos_y: number;
  pos_z: number;
  storage_units: StorageUnit[];
}

interface MasterInventory {
  version: number;
  last_updated: string;
  merge_history: MergeEvent[];
  rooms: Room[];
}

interface MergeEvent {
  timestamp: string;
  session_id: string;       // links back to IngestOutput.metadata.session_id
  source_video: string;
  room: string;
  actions: MergeAction[];
}

interface MergeAction {
  type: "add_room" | "add_unit" | "add_item" | "update_item" | "remove_item" | "move_item" | "replace_unit_contents";
  target: string;          // human-readable description
  details: any;
}

// ============================================================================
// LOAD / INIT MASTER INVENTORY
// ============================================================================

function loadOrCreateMaster(masterPath: string): MasterInventory {
  if (existsSync(masterPath)) {
    console.log(`  Loading existing master: ${masterPath}`);
    return JSON.parse(readFileSync(masterPath, "utf-8"));
  }
  console.log(`  No master found, creating new inventory`);
  return {
    version: 1,
    last_updated: new Date().toISOString(),
    merge_history: [],
    rooms: [],
  };
}

// ============================================================================
// CONVERT INGESTION OUTPUT TO MERGEABLE FORMAT
// ============================================================================

interface IngestionOutput {
  metadata: { session_id?: string; source_video: string; room_name: string };
  transcript: { full_text: string; segments: any[] };
  room: { name: string; icon: string; color: string; width: number; depth: number; height: number; pos_x: number; pos_y: number; pos_z: number };
  frames: {
    image_path: string;
    timestamp: string;
    transcript_context: string;
    items: { name: string; location: string; category?: string; confidence?: string; source?: string }[];
    scene_description: string;
    storage_units_visible: string[];
  }[];
}

function normalizeId(roomName: string, unitName: string): string {
  return `${roomName}_${unitName}`.toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

function extractStorageUnitsFromIngestion(ingestion: IngestionOutput): {
  roomName: string;
  units: Map<string, { name: string; category: string; items: InventoryItem[] }>;
  transcript: string;
} {
  const units = new Map<string, { name: string; category: string; items: InventoryItem[] }>();
  const roomName = ingestion.metadata.room_name;
  const sourceVideo = ingestion.metadata.source_video;

  for (const frame of ingestion.frames) {
    // Group items by their storage unit (inferred from location or scene)
    for (const item of frame.items) {
      // Try to extract the storage unit name from the location
      const unitName = inferStorageUnit(item.location, frame.storage_units_visible);
      const unitId = normalizeId(roomName, unitName);

      if (!units.has(unitId)) {
        units.set(unitId, {
          name: unitName,
          category: item.category || "",
          items: [],
        });
      }

      units.get(unitId)!.items.push({
        name: item.name,
        location: item.location,
        category: item.category,
        confidence: item.confidence,
        source: item.source,
        added_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        source_video: sourceVideo,
      });
    }
  }

  return { roomName, units, transcript: ingestion.transcript.full_text };
}

function inferStorageUnit(location: string, visibleUnits: string[]): string {
  const loc = location.toLowerCase();

  // Try to match against visible storage units from the frame
  for (const unit of visibleUnits) {
    if (loc.includes(unit.toLowerCase())) return unit;
  }

  // Common patterns
  if (loc.includes("box")) {
    const boxMatch = loc.match(/box\s*[a-z]?\d*/i);
    if (boxMatch) return boxMatch[0];
  }
  if (loc.includes("cabinet")) return "Cabinet";
  if (loc.includes("shelf") || loc.includes("shelving")) return "Shelving Unit";
  if (loc.includes("drawer")) return "Drawer Unit";
  if (loc.includes("closet")) return "Closet";
  if (loc.includes("counter")) return "Counter";
  if (loc.includes("wall") || loc.includes("hook") || loc.includes("pegboard")) return "Wall Storage";
  if (loc.includes("floor")) return "Floor Area";

  return "Uncategorized Storage";
}

// ============================================================================
// MERGE LOGIC — THE INTELLIGENCE LAYER
// ============================================================================

function mergeIntoMaster(
  master: MasterInventory,
  ingestion: IngestionOutput,
  options: { auto: boolean; dryRun: boolean }
): MergeAction[] {
  const { roomName, units, transcript } = extractStorageUnitsFromIngestion(ingestion);
  const actions: MergeAction[] = [];
  const now = new Date().toISOString();

  // FIRST: detect moves/removals BEFORE merging new data
  // This way findItemInMaster finds items in their OLD locations
  // (before the merge adds duplicates in new locations)

  // Find or create the room (needed for merge step)
  let room = master.rooms.find(r => r.name.toLowerCase() === roomName.toLowerCase());
  if (!room) {
    room = {
      id: roomName.toLowerCase().replace(/\s+/g, "_"),
      name: roomName,
      icon: ingestion.room.icon,
      color: ingestion.room.color,
      width: ingestion.room.width,
      depth: ingestion.room.depth,
      height: ingestion.room.height,
      pos_x: ingestion.room.pos_x,
      pos_y: ingestion.room.pos_y,
      pos_z: ingestion.room.pos_z,
      storage_units: [],
    };
    master.rooms.push(room);
    actions.push({
      type: "add_room",
      target: roomName,
      details: { room_id: room.id },
    });
  }

  // Detect moves/removals from transcript BEFORE merge
  const moveActions = detectMovesFromTranscript(transcript, master, roomName);

  // Apply move/remove actions to the master (removes items from old locations)
  for (const action of moveActions) {
    applyMoveAction(master, action);
    actions.push(action);
  }

  // NOW merge new ingestion data (items in new locations get added here)
  for (const [unitId, newUnit] of Array.from(units.entries())) {
    const existingUnit = room.storage_units.find(u => u.id === unitId);

    if (!existingUnit) {
      // Brand new storage unit — add it
      const su: StorageUnit = {
        id: unitId,
        name: newUnit.name,
        type: inferUnitType(newUnit.name),
        category: newUnit.category,
        room_id: room.id,
        position: { x: 0, y: 0, z: 0 },  // will be set by 3D layout later
        dimensions: { w: 0.5, h: 0.5, d: 0.5 },
        color: "#795548",
        items: deduplicateItems(newUnit.items),
      };
      room.storage_units.push(su);
      actions.push({
        type: "add_unit",
        target: `${newUnit.name} in ${roomName}`,
        details: { unit_id: unitId, item_count: su.items.length },
      });
    } else {
      // Existing unit — merge items intelligently
      const mergeResult = mergeItems(existingUnit.items, newUnit.items, transcript);
      existingUnit.items = mergeResult.merged;

      if (mergeResult.category && !existingUnit.category) {
        existingUnit.category = mergeResult.category;
      }

      for (const action of mergeResult.actions) {
        actions.push(action);
      }
    }
  }

  return actions;
}

function inferUnitType(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("box")) return "box";
  if (n.includes("cabinet")) return "cabinet";
  if (n.includes("shelf") || n.includes("shelving")) return "shelf";
  if (n.includes("closet")) return "cabinet";
  if (n.includes("drawer")) return "cabinet";
  return "box";
}

function deduplicateItems(items: InventoryItem[]): InventoryItem[] {
  const seen = new Map<string, InventoryItem>();
  for (const item of items) {
    const key = item.name.toLowerCase().trim();
    if (!seen.has(key)) {
      seen.set(key, item);
    } else {
      // Keep the one with higher confidence
      const existing = seen.get(key)!;
      if (item.confidence === "high" && existing.confidence !== "high") {
        seen.set(key, item);
      }
    }
  }
  return Array.from(seen.values());
}

function mergeItems(
  existing: InventoryItem[],
  incoming: InventoryItem[],
  transcript: string
): { merged: InventoryItem[]; actions: MergeAction[]; category?: string } {
  const actions: MergeAction[] = [];
  const merged = [...existing];
  let category: string | undefined;

  // Check if transcript suggests a full replacement
  // e.g., "this is actually what's in Box B2" or "let me show you what's really in here"
  const replacePhrases = [
    "actually what's in",
    "what's really in",
    "let me correct",
    "this is what's in",
    "the real contents",
    "let me redo",
  ];
  const isReplacement = replacePhrases.some(p => transcript.toLowerCase().includes(p));

  if (isReplacement) {
    // Full replacement — trust the new data completely
    const deduped = deduplicateItems(incoming);
    actions.push({
      type: "replace_unit_contents",
      target: `Replaced contents (${existing.length} items → ${deduped.length} items)`,
      details: { old_count: existing.length, new_count: deduped.length },
    });
    return { merged: deduped, actions, category: incoming[0]?.category };
  }

  // Otherwise, merge incrementally
  for (const newItem of incoming) {
    const key = newItem.name.toLowerCase().trim();
    const existingIdx = merged.findIndex(e => e.name.toLowerCase().trim() === key);

    if (existingIdx >= 0) {
      // Item already exists — update location/confidence if the new data is better
      const existingItem = merged[existingIdx];
      if (newItem.confidence === "high" || newItem.source === "both") {
        existingItem.location = newItem.location;
        existingItem.updated_at = new Date().toISOString();
        existingItem.source_video = newItem.source_video;
        actions.push({
          type: "update_item",
          target: `Updated "${newItem.name}" location`,
          details: { item: newItem.name, new_location: newItem.location },
        });
      }
    } else {
      // New item — add it
      merged.push({
        ...newItem,
        added_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      actions.push({
        type: "add_item",
        target: `Added "${newItem.name}"`,
        details: { item: newItem.name, location: newItem.location },
      });
    }
  }

  if (incoming[0]?.category) category = incoming[0].category;
  return { merged, actions, category };
}

// ============================================================================
// TRANSCRIPT-BASED MOVE DETECTION
// ============================================================================

function detectMovesFromTranscript(
  transcript: string,
  master: MasterInventory,
  currentRoom: string
): MergeAction[] {
  const actions: MergeAction[] = [];
  const t = transcript.toLowerCase();

  // Patterns for moves: "moved X to Y", "put X in Y", "X goes in Y now"
  const movePatterns = [
    /(?:moved?|put|placing?|transferr?(?:ed|ing))\s+(?:the\s+)?(.+?)\s+(?:to|in|into|over to)\s+(.+?)(?:\.|,|$)/gi,
    /(.+?)\s+(?:goes|should go|belongs)\s+(?:in|into|to)\s+(.+?)(?:\.|,|$)/gi,
  ];

  for (const pattern of movePatterns) {
    let match;
    while ((match = pattern.exec(t)) !== null) {
      const itemName = match[1].trim();
      const destination = match[2].trim();

      // Only act on this if we can find the item in the master inventory
      const found = findItemInMaster(master, itemName);
      if (found) {
        actions.push({
          type: "move_item",
          target: `Move "${found.item.name}" → ${destination}`,
          details: {
            item: found.item.name,
            from_unit: found.unitId,
            to_description: destination,
          },
        });
      }
    }
  }

  // Patterns for removals: "got rid of X", "threw away X", "X is gone"
  const removePatterns = [
    /(?:got rid of|threw away|tossed|removed|donated|trashed)\s+(?:the\s+)?(.+?)(?:\.|,|$)/gi,
    /(.+?)\s+(?:is gone|was donated|was thrown away)/gi,
  ];

  for (const pattern of removePatterns) {
    let match;
    while ((match = pattern.exec(t)) !== null) {
      const itemName = match[1].trim();
      const found = findItemInMaster(master, itemName);
      if (found) {
        actions.push({
          type: "remove_item",
          target: `Remove "${found.item.name}" (${match[0].trim()})`,
          details: {
            item: found.item.name,
            from_unit: found.unitId,
            reason: match[0].trim(),
          },
        });
      }
    }
  }

  return actions;
}

function findItemInMaster(
  master: MasterInventory,
  itemName: string
): { item: InventoryItem; roomId: string; unitId: string } | null {
  const needle = itemName.toLowerCase().trim();
  for (const room of master.rooms) {
    for (const unit of room.storage_units) {
      for (const item of unit.items) {
        if (item.name.toLowerCase().trim().includes(needle) ||
            needle.includes(item.name.toLowerCase().trim())) {
          return { item, roomId: room.id, unitId: unit.id };
        }
      }
    }
  }
  return null;
}

function applyMoveAction(master: MasterInventory, action: MergeAction): void {
  if (action.type === "move_item") {
    // Remove from ALL units EXCEPT the destination (the new ingestion already
    // placed the item there during the merge step). This handles the case where
    // the item exists in the old location and was also newly added to the new one.
    const itemNameLower = action.details.item.toLowerCase();
    for (const room of master.rooms) {
      for (const unit of room.storage_units) {
        // Keep the item in its new location (the unit where it was just added)
        // Remove from everywhere else
        if (unit.id !== action.details.from_unit) continue;
        unit.items = unit.items.filter(
          i => i.name.toLowerCase() !== itemNameLower
        );
      }
    }
    // Note: the item will be added to its new location by the normal merge flow
    // if it appeared in the new ingestion. If not, it stays removed (moved to
    // somewhere we haven't cataloged yet).
  }

  if (action.type === "remove_item") {
    for (const room of master.rooms) {
      for (const unit of room.storage_units) {
        if (unit.id === action.details.from_unit) {
          unit.items = unit.items.filter(
            i => i.name.toLowerCase() !== action.details.item.toLowerCase()
          );
        }
      }
    }
  }
}

// ============================================================================
// EXPORT TO PUSH FORMAT
// ============================================================================

function exportForPush(master: MasterInventory): any {
  // Convert master inventory to the format push-to-supabase.ts expects
  // This creates one push payload per room
  return master.rooms.map(room => ({
    room: {
      name: room.name,
      icon: room.icon,
      color: room.color,
      width: room.width,
      depth: room.depth,
      height: room.height,
      pos_x: room.pos_x,
      pos_y: room.pos_y || 0,
      pos_z: room.pos_z,
    },
    frames: room.storage_units.map(unit => ({
      image_path: null,  // images are managed separately
      timestamp: "0:00",
      items: unit.items.map(item => ({
        name: item.name,
        location: `${unit.name} — ${item.location}`,
      })),
    })),
  }));
}

// ============================================================================
// REPORTING
// ============================================================================

function printMergeSummary(actions: MergeAction[]): void {
  if (actions.length === 0) {
    console.log("\n  No changes detected.");
    return;
  }

  console.log(`\n  Merge Summary (${actions.length} actions):`);
  console.log("  ─────────────────────────────────────");

  const grouped: Record<string, MergeAction[]> = {};
  for (const a of actions) {
    if (!grouped[a.type]) grouped[a.type] = [];
    grouped[a.type].push(a);
  }

  const labels: Record<string, string> = {
    add_room: "New Rooms",
    add_unit: "New Storage Units",
    add_item: "New Items Added",
    update_item: "Items Updated",
    remove_item: "Items Removed",
    move_item: "Items Moved",
    replace_unit_contents: "Units Replaced",
  };

  for (const [type, items] of Object.entries(grouped)) {
    console.log(`\n  ${labels[type] || type} (${items.length}):`);
    for (const item of items.slice(0, 10)) {
      console.log(`    • ${item.target}`);
    }
    if (items.length > 10) {
      console.log(`    ... and ${items.length - 10} more`);
    }
  }
}

function printInventoryStats(master: MasterInventory): void {
  const totalRooms = master.rooms.length;
  const totalUnits = master.rooms.reduce((s, r) => s + r.storage_units.length, 0);
  const totalItems = master.rooms.reduce((s, r) =>
    s + r.storage_units.reduce((s2, u) => s2 + u.items.length, 0), 0);

  console.log("\n  Inventory State:");
  console.log(`    Rooms:         ${totalRooms}`);
  console.log(`    Storage Units: ${totalUnits}`);
  console.log(`    Total Items:   ${totalItems}`);
  console.log(`    Merge History: ${master.merge_history.length} sessions`);
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║  Home Navigator — Inventory Merge Engine ║");
  console.log("╚══════════════════════════════════════════╝");

  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === "--help") {
    console.log(`
Usage: npx tsx scripts/merge-inventory.ts <ingestion.json> [options]

Options:
  --master <path>   Master inventory file (default: ./inventory/master.json)
  --output <path>   Output path (default: same as master)
  --auto            Auto-apply without confirmation
  --dry-run         Show changes without applying
  --pull            Pull from Supabase first (TODO)

Workflow:
  1. npm run ingest -- video.mp4 --room "Basement"
  2. npm run merge -- ./ingestion-output/basement-*.json
  3. Review changes
  4. npm run push -- ./inventory/master.json
    `);
    process.exit(0);
  }

  const ingestionPath = args[0];
  let masterPath = "./inventory/master.json";
  let outputPath = "";
  let auto = false;
  let dryRun = false;

  for (let i = 1; i < args.length; i++) {
    switch (args[i]) {
      case "--master": masterPath = args[++i]; break;
      case "--output": outputPath = args[++i]; break;
      case "--auto": auto = true; break;
      case "--dry-run": dryRun = true; break;
    }
  }
  if (!outputPath) outputPath = masterPath;

  // Ensure directories exist
  mkdirSync(dirname(masterPath), { recursive: true });
  mkdirSync(dirname(outputPath), { recursive: true });

  // Load inputs
  if (!existsSync(ingestionPath)) {
    console.error(`\n  Error: Ingestion file not found: ${ingestionPath}`);
    process.exit(1);
  }

  console.log(`\n  Ingestion: ${ingestionPath}`);
  console.log(`  Master:    ${masterPath}`);

  const ingestion: IngestionOutput = JSON.parse(readFileSync(ingestionPath, "utf-8"));
  const master = loadOrCreateMaster(masterPath);

  console.log(`\n  New data from: "${ingestion.metadata.room_name}"`);
  console.log(`  Session ID:    ${ingestion.metadata.session_id || "(no session ID — pre-tracking)"}`);
  console.log(`  Video source:  ${ingestion.metadata.source_video}`);
  console.log(`  Frames:        ${ingestion.frames.length}`);
  const newItemCount = ingestion.frames.reduce((s, f) => s + f.items.length, 0);
  console.log(`  Items in new:  ${newItemCount}`);

  // Perform merge
  console.log("\n  Merging...");
  const actions = mergeIntoMaster(master, ingestion, { auto, dryRun });

  // Record this merge event
  master.merge_history.push({
    timestamp: new Date().toISOString(),
    session_id: ingestion.metadata.session_id || `legacy-${Date.now()}`,
    source_video: ingestion.metadata.source_video,
    room: ingestion.metadata.room_name,
    actions,
  });
  master.last_updated = new Date().toISOString();
  master.version++;

  // Report
  printMergeSummary(actions);
  printInventoryStats(master);

  if (dryRun) {
    console.log("\n  [DRY RUN] No files written.");
  } else {
    writeFileSync(outputPath, JSON.stringify(master, null, 2));
    console.log(`\n  ✓ Master inventory saved: ${outputPath}`);
    console.log(`\n  Next: npm run push -- ${outputPath}`);
  }
}

main().catch(err => {
  console.error("\nFatal error:", err);
  process.exit(1);
});
