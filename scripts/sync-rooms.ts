/**
 * sync-rooms.ts
 *
 * Parses all 14 room definitions from public/house-3d.html and upserts them
 * into Supabase.  Rooms that already exist (matched by name) are updated;
 * new rooms are inserted.  Frames / items are NOT touched.
 *
 * Usage:
 *   npx tsx scripts/sync-rooms.ts
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";

// ---- Load .env ----
function loadEnv() {
  const envPath = resolve(dirname(new URL(import.meta.url).pathname), "../.env");
  if (existsSync(envPath)) {
    const lines = readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const val = match[2].trim().replace(/^["']|["']$/g, "");
        if (!process.env[key]) process.env[key] = val;
      }
    }
  }
}
loadEnv();

// ---- Extract ROOMS from house-3d.html ----
function extractRooms(): Array<{
  id: string;
  name: string;
  icon: string;
  color: string;
  pos_x: number;
  pos_y: number;
  pos_z: number;
  width: number;
  depth: number;
  height: number;
}> {
  const htmlPath = resolve(dirname(new URL(import.meta.url).pathname), "../public/house-3d.html");
  const html = readFileSync(htmlPath, "utf-8");

  // Find the ROOMS array — we just need the top-level room metadata, not furniture
  const rooms: any[] = [];
  // Match each room object header:  { id: "r1", name: "Kitchen", ...
  const roomRegex = /\{\s*id:\s*"(r\d+)",\s*name:\s*"([^"]+)",\s*icon:\s*"([^"]+)",\s*color:\s*"([^"]+)",/g;
  let m: RegExpExecArray | null;

  while ((m = roomRegex.exec(html)) !== null) {
    const id = m[1];
    const name = m[2];
    const icon = m[3];
    const color = m[4];

    // Now find pos_x, pos_y, pos_z, width, depth, height after this match
    const afterMatch = html.substring(m.index, m.index + 600);

    const num = (key: string): number => {
      const re = new RegExp(`${key}:\\s*(-?[\\d.]+)`);
      const found = afterMatch.match(re);
      return found ? parseFloat(found[1]) : 0;
    };

    rooms.push({
      id,
      name,
      icon,
      color,
      pos_x: num("pos_x"),
      pos_y: num("pos_y"),
      pos_z: num("pos_z"),
      width: num("width"),
      depth: num("depth"),
      height: num("height"),
    });
  }

  return rooms;
}

// ---- Main ----
async function main() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env");
    process.exit(1);
  }

  const supabase = createClient(url, key);
  const rooms = extractRooms();
  console.log(`Found ${rooms.length} rooms in house-3d.html\n`);

  // Fetch existing rooms from Supabase
  const { data: existing, error: fetchErr } = await supabase
    .from("rooms")
    .select("id, name");
  if (fetchErr) {
    console.error("Failed to fetch existing rooms:", fetchErr.message);
    process.exit(1);
  }

  const existingByName = new Map((existing || []).map((r: any) => [r.name, r.id]));

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (let i = 0; i < rooms.length; i++) {
    const r = rooms[i];
    const payload = {
      name: r.name,
      icon: r.icon,
      color: r.color,
      pos_x: r.pos_x,
      pos_y: r.pos_y,
      pos_z: r.pos_z,
      width: r.width,
      depth: r.depth,
      height: r.height,
      sort_order: i + 1,
    };

    if (existingByName.has(r.name)) {
      // Update existing
      const dbId = existingByName.get(r.name);
      const { error } = await supabase
        .from("rooms")
        .update(payload)
        .eq("id", dbId);
      if (error) {
        console.error(`  ✗ Failed to update "${r.name}": ${error.message}`);
        skipped++;
      } else {
        console.log(`  ↻ Updated: ${r.name} (${dbId})`);
        updated++;
      }
    } else {
      // Insert new
      const { data: newRoom, error } = await supabase
        .from("rooms")
        .insert(payload)
        .select("id")
        .single();
      if (error) {
        console.error(`  ✗ Failed to create "${r.name}": ${error.message}`);
        skipped++;
      } else {
        console.log(`  ✚ Created: ${r.name} (${newRoom.id})`);
        created++;
      }
    }
  }

  console.log(`\nDone! ${created} created, ${updated} updated, ${skipped} failed.`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
