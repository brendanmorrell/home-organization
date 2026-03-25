import { QueryClient, useQuery } from "@tanstack/react-query";
import { fetchAllRoomsWithFrames, type RoomWithFrames } from "~/lib/supabase";

// Zone → Room name mapping (shared across modules)
export const ZONE_ROOM: Record<string, string> = {
  "LIVING-BAR-CABINETS": "Living Room",
  "LIVING-HALL-CLOSET": "Living Room",
  "KITCHEN-LOWER-CAB": "Kitchen",
  "KITCHEN-UPPER-CAB": "Kitchen",
  "KITCHEN-NOOK": "Kitchen",
  "KITCHEN-NOOK-SOUTH": "Kitchen",
  "GARAGE-BIN-SPEECH": "Garage",
  "GARAGE-BIN-BARDECOR": "Garage",
  "GARAGE-BIN-ELECTRONICS": "Garage",
  "GARAGE-BIN-AUTO": "Garage",
  "GARAGE-BIN-BOOKS": "Garage",
  "GARAGE-BIN-HEALTH": "Garage",
  "GARAGE-BIN-ASIANKITCHEN": "Garage",
  "GARAGE-BIN-PHOTO": "Garage",
  "GARAGE-BIN-ASIANDECOR": "Garage",
  "GARAGE-BIN-DESK": "Garage",
  "GARAGE-BIN-DECOR": "Garage",
  "GARAGE-BIN-FRAMES": "Garage",
  "GARAGE-SHELF-WEST": "Garage",
  "GARAGE-SHELF-NORTH": "Garage",
  "GARAGE-SHELF-NE": "Garage",
  "GARAGE-PEGBOARD": "Garage",
  "GARAGE-HOOKS-WEST": "Garage",
  "GARAGE-FLOOR": "Garage",
  "GARAGE-FLOOR-NE": "Garage",
  "PACKED-BOX:c18": "Garage",
  "BSMT-RAISED-W": "Basement",
  "BSMT-RAISED-E": "Basement",
  "BSMT-BIN-CLOTHING": "Basement",
  "BSMT-BIN-BABY": "Basement",
  "BSMT-BIN-DECOR": "Basement",
  "BSMT-SINK-AREA": "Basement",
  "BSMT-CLOTHES": "Basement",
  "BSMT-UNDERSTAIR": "Basement",
  "BSMT-PAINT-CLOSET": "Basement",
  "BSMT-SHELVING-EW": "Basement",
  "BSMT-SHELVING-NS": "Basement",
  "WORKHALL-DRAWERS-N": "Work Hallway",
  "WORKHALL-DRAWERS-S": "Work Hallway",
  "WORKHALL-MID-CAB": "Work Hallway",
  "WORKHALL-SOUTH-CAB": "Work Hallway",
  "FOYER-COAT-CLOSET": "Foyer",
  "MASTER-CLOSET-E": "Master Bedroom",
  "MASTER-CLOSET-W": "Master Bedroom",
  "BABY-CLOSET": "Baby's Room",
  "BATH-CLOSET": "Upstairs Hallway",
  "BATH-VANITY": "Upstairs Hallway",
  "HALL-LAUNDRY": "Upstairs Hallway",
  "HALL-LINEN": "Upstairs Hallway",
  BALCONY: "Balcony",
  "BALCONY-DECKBOX": "Balcony",
};

// Room name → 3D model IDs
export const ROOM_3D_ID: Record<string, string> = {
  Kitchen: "r1",
  Basement: "r2",
  Garage: "r3",
  "Master Bedroom": "r4",
  "Living Room": "r5",
  "Work Hallway": "r6",
  Foyer: "r7",
  Bathroom: "r8",
  "Baby's Room": "r9",
  "Upstairs Hallway": "r10",
  "Bath Corridor": "r11",
  "Bath Alcove": "r12",
  "Walk-in Closet": "r13",
  "Baby Closet": "r14",
  Balcony: "r15",
};

// Room metadata for creating missing rooms from inventory.json
export const ROOM_META: Record<
  string,
  {
    icon: string;
    color: string;
    pos_x: number;
    pos_y: number;
    pos_z: number;
    width: number;
    depth: number;
    height: number;
  }
> = {
  Kitchen: {
    icon: "K",
    color: "#8d6e63",
    pos_x: 8.8,
    pos_y: 0,
    pos_z: 16.8,
    width: 4.57,
    depth: 4.57,
    height: 2.8,
  },
  "Living Room": {
    icon: "L",
    color: "#5c6bc0",
    pos_x: 8,
    pos_y: 0,
    pos_z: 9,
    width: 6.1,
    depth: 11.0,
    height: 3.35,
  },
  "Work Hallway": {
    icon: "W",
    color: "#7e57c2",
    pos_x: 7.7,
    pos_y: 0,
    pos_z: 19.69,
    width: 2.44,
    depth: 3.66,
    height: 2.8,
  },
  Garage: {
    icon: "G",
    color: "#78909c",
    pos_x: 8,
    pos_y: -0.45,
    pos_z: 0,
    width: 6.1,
    depth: 6.1,
    height: 3.7,
  },
  Basement: {
    icon: "B",
    color: "#546e7a",
    pos_x: 0,
    pos_y: -1.0,
    pos_z: -6.69,
    width: 6.5,
    depth: 8.28,
    height: 2.5,
  },
  Foyer: {
    icon: "F",
    color: "#ab47bc",
    pos_x: 7.7,
    pos_y: 0,
    pos_z: 23.37,
    width: 4.9,
    depth: 3.7,
    height: 2.8,
  },
  Bathroom: {
    icon: "b",
    color: "#26a69a",
    pos_x: 10.0,
    pos_y: 0,
    pos_z: 20.3,
    width: 2.1,
    depth: 1.5,
    height: 2.8,
  },
  "Master Bedroom": {
    icon: "M",
    color: "#ec407a",
    pos_x: -2.4,
    pos_y: 0,
    pos_z: 6.28,
    width: 7.01,
    depth: 4.88,
    height: 2.8,
  },
  "Baby's Room": {
    icon: "R",
    color: "#66bb6a",
    pos_x: -1.95,
    pos_y: 0,
    pos_z: 15.42,
    width: 6.1,
    depth: 4.27,
    height: 2.8,
  },
  "Upstairs Hallway": {
    icon: "H",
    color: "#5c6bc0",
    pos_x: -4.54,
    pos_y: 0,
    pos_z: 11.0,
    width: 2.74,
    depth: 4.57,
    height: 2.8,
  },
  "Bath Corridor": {
    icon: "c",
    color: "#80cbc4",
    pos_x: -1.49,
    pos_y: 0,
    pos_z: 11.0,
    width: 1.52,
    depth: 4.57,
    height: 2.8,
  },
  "Bath Alcove": {
    icon: "a",
    color: "#4dd0e1",
    pos_x: 0.19,
    pos_y: 0,
    pos_z: 12.07,
    width: 1.83,
    depth: 2.44,
    height: 2.8,
  },
  "Walk-in Closet": {
    icon: "C",
    color: "#8d6e63",
    pos_x: 0.19,
    pos_y: 0,
    pos_z: 9.78,
    width: 1.83,
    depth: 2.13,
    height: 2.8,
  },
  "Baby Closet": {
    icon: "c",
    color: "#a5d6a7",
    pos_x: -5.45,
    pos_y: 0,
    pos_z: 16.49,
    width: 0.91,
    depth: 1.52,
    height: 2.8,
  },
  Balcony: {
    icon: "B",
    color: "#a1887f",
    pos_x: 8.0,
    pos_y: 0,
    pos_z: -15,
    width: 6.1,
    depth: 6.1,
    height: 2.8,
  },
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 30 * 60 * 1000, // 30 minutes
    },
  },
});

async function fetchRoomsWithFallback(): Promise<RoomWithFrames[]> {
  const supaRooms = await fetchAllRoomsWithFrames();

  // Count Supabase items
  const supaItemCount = supaRooms.reduce(
    (sum, r) => sum + r.frames.reduce((s, f) => s + f.items.length, 0),
    0
  );

  // If Supabase has few items, supplement with local inventory.json
  if (supaItemCount < 50) {
    try {
      const resp = await fetch("/inventory.json");
      if (resp.ok) {
        const inv = await resp.json();
        const localItems = inv.items || [];

        // Group local items by room name
        const byRoom: Record<string, any[]> = {};
        for (const item of localItems) {
          const roomName = ZONE_ROOM[item.zone];
          if (!roomName) continue;
          if (!byRoom[roomName]) byRoom[roomName] = [];
          byRoom[roomName].push(item);
        }

        // Existing Supabase item names for dedup
        const existingNames = new Set<string>();
        supaRooms.forEach((r) =>
          r.frames.forEach((f) => f.items.forEach((i) => existingNames.add(i.name)))
        );

        // Merge into existing rooms
        const supaRoomNames = new Set(supaRooms.map((r) => r.name));
        for (const room of supaRooms) {
          const localForRoom = byRoom[room.name] || [];
          if (localForRoom.length === 0) continue;
          const newItems = localForRoom
            .filter((li: any) => !existingNames.has(li.name))
            .map((li: any) => ({
              id: li.id || crypto.randomUUID(),
              name: li.name,
              location: `${li.zone} | ${li.notes || ""}`.trim(),
              frame_id: room.frames[0]?.id || "local",
              pin_x: null,
              pin_y: null,
              pin_z: null,
              created_at: new Date().toISOString(),
            }));
          if (newItems.length > 0) {
            if (room.frames.length === 0) {
              room.frames.push({
                id: "local-" + room.id,
                room_id: room.id,
                image_url: null,
                timestamp: "local",
                sort_order: 1,
                created_at: new Date().toISOString(),
                items: newItems,
              } as any);
            } else {
              room.frames[0].items.push(...newItems);
            }
          }
        }

        // Create missing rooms that exist in inventory but not in Supabase
        let sortOrder = supaRooms.length + 1;
        for (const [roomName, items] of Object.entries(byRoom)) {
          if (supaRoomNames.has(roomName)) continue;
          const meta = ROOM_META[roomName];
          if (!meta) continue;
          const roomId =
            ROOM_3D_ID[roomName] ||
            "local-room-" + roomName.toLowerCase().replace(/[^a-z0-9]/g, "-");
          const frameId = "local-frame-" + roomId;
          const newItems = items
            .filter((li: any) => !existingNames.has(li.name))
            .map((li: any) => ({
              id: li.id || crypto.randomUUID(),
              name: li.name,
              location: `${li.zone} | ${li.notes || ""}`.trim(),
              frame_id: frameId,
              pin_x: null,
              pin_y: null,
              pin_z: null,
              created_at: new Date().toISOString(),
            }));
          if (newItems.length > 0) {
            supaRooms.push({
              id: roomId,
              name: roomName,
              icon: meta.icon,
              pos_x: meta.pos_x,
              pos_y: meta.pos_y,
              pos_z: meta.pos_z,
              width: meta.width,
              depth: meta.depth,
              height: meta.height,
              color: meta.color,
              sort_order: sortOrder++,
              created_at: new Date().toISOString(),
              frames: [
                {
                  id: frameId,
                  room_id: roomId,
                  image_url: null,
                  timestamp: "local",
                  sort_order: 1,
                  created_at: new Date().toISOString(),
                  items: newItems,
                },
              ],
            } as any);
          }
        }
        console.log(
          `[inventory] Loaded ${supaRooms.length} rooms with local inventory.json fallback (${localItems.length} total local items)`
        );
      }
    } catch (e) {
      console.warn("[inventory] Could not load local inventory.json fallback:", e);
    }
  }

  return supaRooms;
}

export function useRooms() {
  return useQuery<RoomWithFrames[]>({
    queryKey: ["rooms"],
    queryFn: fetchRoomsWithFallback,
  });
}
