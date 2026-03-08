import { createClient } from "@supabase/supabase-js";

// These will be set via environment variables
// VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "Supabase credentials not set. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env"
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ---- Types ----

export interface Room {
  id: string;
  name: string;
  icon: string;
  pos_x: number;
  pos_y: number;
  pos_z: number;
  width: number;
  depth: number;
  height: number;
  color: string;
  sort_order: number;
  created_at: string;
}

export interface Frame {
  id: string;
  room_id: string;
  image_url: string | null;
  timestamp: string | null;
  sort_order: number;
  created_at: string;
}

export interface Item {
  id: string;
  frame_id: string;
  name: string;
  location: string;
  pin_x: number | null;
  pin_y: number | null;
  pin_z: number | null;
  created_at: string;
}

export interface SearchResult {
  item_id: string;
  item_name: string;
  item_location: string;
  frame_id: string;
  frame_image_url: string | null;
  frame_timestamp: string | null;
  room_id: string;
  room_name: string;
  room_icon: string;
  rank: number;
}

export interface FrameWithItems extends Frame {
  items: Item[];
}

export interface RoomWithFrames extends Room {
  frames: FrameWithItems[];
}

// ---- Data fetching ----

export async function fetchRooms(): Promise<Room[]> {
  const { data, error } = await supabase
    .from("rooms")
    .select("*")
    .order("sort_order");
  if (error) throw error;
  return data || [];
}

export async function fetchRoomWithFrames(
  roomId: string
): Promise<RoomWithFrames | null> {
  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("*")
    .eq("id", roomId)
    .single();
  if (roomError) throw roomError;
  if (!room) return null;

  const { data: frames, error: framesError } = await supabase
    .from("frames")
    .select("*, items(*)")
    .eq("room_id", roomId)
    .order("sort_order");
  if (framesError) throw framesError;

  return {
    ...room,
    frames: (frames || []).map((f: any) => ({
      ...f,
      items: f.items || [],
    })),
  };
}

export async function fetchAllRoomsWithFrames(): Promise<RoomWithFrames[]> {
  const rooms = await fetchRooms();
  const results: RoomWithFrames[] = [];

  for (const room of rooms) {
    const full = await fetchRoomWithFrames(room.id);
    if (full) results.push(full);
  }
  return results;
}

export async function searchItems(query: string): Promise<SearchResult[]> {
  const { data, error } = await supabase.rpc("search_items", {
    query,
  });
  if (error) throw error;
  return data || [];
}

// ---- Mutations ----

export async function createRoom(
  room: Omit<Room, "id" | "created_at">
): Promise<Room> {
  const { data, error } = await supabase
    .from("rooms")
    .insert(room)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function createFrame(
  frame: Omit<Frame, "id" | "created_at">
): Promise<Frame> {
  const { data, error } = await supabase
    .from("frames")
    .insert(frame)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function createItems(
  items: Omit<Item, "id" | "created_at">[]
): Promise<Item[]> {
  const { data, error } = await supabase
    .from("items")
    .insert(items)
    .select();
  if (error) throw error;
  return data || [];
}

export async function uploadFrameImage(
  file: File | Blob,
  path: string
): Promise<string> {
  const { error } = await supabase.storage
    .from("frame-images")
    .upload(path, file, { upsert: true });
  if (error) throw error;

  const {
    data: { publicUrl },
  } = supabase.storage.from("frame-images").getPublicUrl(path);
  return publicUrl;
}
