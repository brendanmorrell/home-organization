/**
 * push-to-supabase.ts
 *
 * Used by Claude in Cowork to push cataloged room data directly to Supabase.
 *
 * Usage (from Cowork / Node):
 *   npx tsx scripts/push-to-supabase.ts <json-file>
 *
 * The JSON file should have this structure:
 * {
 *   "supabase_url": "https://xxx.supabase.co",
 *   "supabase_key": "sb_publishable_xxx",
 *   "room": {
 *     "name": "Kitchen",
 *     "icon": "K",
 *     "color": "#5d4037",
 *     "width": 5,
 *     "depth": 4,
 *     "height": 2.7,
 *     "pos_x": 0,
 *     "pos_z": 0
 *   },
 *   "frames": [
 *     {
 *       "image_path": "/path/to/frame_001.jpg",   (optional — will upload to storage)
 *       "image_url": "https://...",                (optional — use if already uploaded)
 *       "timestamp": "0:04",
 *       "items": [
 *         { "name": "Tea tray", "location": "Bottom cabinet, left side" },
 *         { "name": "Serving bowls", "location": "Bottom cabinet, right side" }
 *       ]
 *     }
 *   ]
 * }
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

async function main() {
  const jsonPath = process.argv[2];
  if (!jsonPath) {
    console.error("Usage: npx tsx scripts/push-to-supabase.ts <json-file>");
    process.exit(1);
  }

  const data = JSON.parse(readFileSync(jsonPath, "utf-8"));

  const url = data.supabase_url || process.env.VITE_SUPABASE_URL;
  const key = data.supabase_key || process.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error("Missing Supabase URL or key. Provide in JSON or .env.");
    process.exit(1);
  }

  const supabase = createClient(url, key);

  // 1. Create the room
  console.log(`Creating room: ${data.room.name}...`);
  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .insert({
      name: data.room.name,
      icon: data.room.icon || data.room.name[0],
      color: data.room.color || "#4a5568",
      width: data.room.width || 4,
      depth: data.room.depth || 4,
      height: data.room.height || 2.7,
      pos_x: data.room.pos_x || 0,
      pos_y: data.room.pos_y || 0,
      pos_z: data.room.pos_z || 0,
      sort_order: data.room.sort_order || 0,
    })
    .select()
    .single();

  if (roomError) {
    console.error("Failed to create room:", roomError.message);
    process.exit(1);
  }
  console.log(`  Room created: ${room.id}`);

  // 2. Create frames and items
  let totalItems = 0;

  for (let i = 0; i < data.frames.length; i++) {
    const frameData = data.frames[i];

    let imageUrl = frameData.image_url || null;

    // Upload image to Supabase Storage if a local path is provided
    if (frameData.image_path && !imageUrl) {
      try {
        const imageBuffer = readFileSync(frameData.image_path);
        const ext = frameData.image_path.split(".").pop() || "jpg";
        const storagePath = `${room.id}/frame_${String(i + 1).padStart(4, "0")}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("frame-images")
          .upload(storagePath, imageBuffer, {
            contentType: `image/${ext === "jpg" ? "jpeg" : ext}`,
            upsert: true,
          });

        if (uploadError) {
          console.warn(`  Warning: Failed to upload ${frameData.image_path}: ${uploadError.message}`);
        } else {
          const { data: urlData } = supabase.storage
            .from("frame-images")
            .getPublicUrl(storagePath);
          imageUrl = urlData.publicUrl;
          console.log(`  Uploaded frame image: ${storagePath}`);
        }
      } catch (err: any) {
        console.warn(`  Warning: Could not read ${frameData.image_path}: ${err.message}`);
      }
    }

    // Create frame record
    const { data: frame, error: frameError } = await supabase
      .from("frames")
      .insert({
        room_id: room.id,
        image_url: imageUrl,
        timestamp: frameData.timestamp || `${i}:00`,
        sort_order: i + 1,
      })
      .select()
      .single();

    if (frameError) {
      console.error(`  Failed to create frame ${i + 1}:`, frameError.message);
      continue;
    }

    // Create items for this frame
    if (frameData.items && frameData.items.length > 0) {
      const items = frameData.items.map((item: any) => ({
        frame_id: frame.id,
        name: item.name,
        location: item.location,
        pin_x: item.pin_x || null,
        pin_y: item.pin_y || null,
        pin_z: item.pin_z || null,
      }));

      const { error: itemsError } = await supabase
        .from("items")
        .insert(items);

      if (itemsError) {
        console.error(`  Failed to create items for frame ${i + 1}:`, itemsError.message);
      } else {
        totalItems += items.length;
      }
    }

    console.log(
      `  Frame ${i + 1}/${data.frames.length}: ${frameData.items?.length || 0} items`
    );
  }

  console.log(
    `\nDone! Created room "${data.room.name}" with ${data.frames.length} frames and ${totalItems} items.`
  );
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
