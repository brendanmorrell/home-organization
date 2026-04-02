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

export interface Neighbor {
  id: string;
  address: string;
  side: "west" | "east" | "alley";
  names: string[];
  notes: string;
  is_us: boolean;
  position_index: number;
  created_at: string;
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

export async function updateItem(
  id: string,
  fields: Partial<Pick<Item, "name" | "location" | "frame_id">>
): Promise<Item> {
  const { data, error } = await supabase
    .from("items")
    .update(fields)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteItem(id: string): Promise<void> {
  const { error } = await supabase.from("items").delete().eq("id", id);
  if (error) throw error;
}

export async function createItem(
  item: Omit<Item, "id" | "created_at">
): Promise<Item> {
  const { data, error } = await supabase
    .from("items")
    .insert(item)
    .select()
    .single();
  if (error) throw error;
  return data;
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

// ---- Reference Types ----

export interface Reference {
  id: string;
  title: string;
  category: string;
  content: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export const REFERENCE_CATEGORIES = [
  "Credit Cards",
  "Travel",
  "Grocery",
  "Auto-Order",
  "Medical",
  "Household",
  "Financial",
  "Baby",
] as const;

export type ReferenceCategory = (typeof REFERENCE_CATEGORIES)[number];

// ---- Reference Data Fetching ----

export async function fetchReferences(): Promise<Reference[]> {
  const { data, error } = await supabase
    .from("references")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

// ---- Reference Mutations ----

/** Normalize tags: lowercase, trimmed, deduplicated */
export function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  return tags
    .map((t) => t.trim().toLowerCase())
    .filter((t) => {
      if (!t || seen.has(t)) return false;
      seen.add(t);
      return true;
    });
}

export async function createReference(ref: {
  title: string;
  category: string;
  content?: string;
  tags?: string[];
}): Promise<Reference> {
  const { data, error } = await supabase
    .from("references")
    .insert({
      title: ref.title,
      category: ref.category,
      content: ref.content || null,
      tags: normalizeTags(ref.tags || []),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateReference(
  id: string,
  updates: Partial<Pick<Reference, "title" | "category" | "content" | "tags">>
): Promise<Reference> {
  const payload: Record<string, any> = {};
  if (updates.title !== undefined) payload.title = updates.title;
  if (updates.category !== undefined) payload.category = updates.category;
  if (updates.content !== undefined) payload.content = updates.content;
  if (updates.tags !== undefined) payload.tags = normalizeTags(updates.tags);

  const { data, error } = await supabase
    .from("references")
    .update(payload)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteReference(id: string): Promise<void> {
  const { error } = await supabase.from("references").delete().eq("id", id);
  if (error) throw error;
}

// ---- Todo Types ----

export type TodoList = {
  id: string;
  name: string;
  color_index: number;
  sort_order: number;
  owner?: string | null;
  created_at: string;
};

export type TodoItem = {
  id: string;
  list_id: string;
  text: string;
  status: "todo" | "inflight" | "done";
  sort_order: number;
  created_at: string;
};

export type TodoListWithItems = TodoList & { items: TodoItem[] };

// ---- Todo Data Fetching ----

export async function fetchTodoLists(): Promise<TodoList[]> {
  const { data, error } = await supabase
    .from("todo_lists")
    .select("*")
    .order("sort_order");
  if (error) throw error;
  return data || [];
}

export async function fetchTodoListsWithItems(): Promise<TodoListWithItems[]> {
  const lists = await fetchTodoLists();

  const { data: items, error } = await supabase
    .from("todo_items")
    .select("*")
    .order("sort_order");
  if (error) throw error;

  const itemsByListId = (items || []).reduce(
    (acc: Record<string, TodoItem[]>, item: TodoItem) => {
      if (!acc[item.list_id]) acc[item.list_id] = [];
      acc[item.list_id].push(item);
      return acc;
    },
    {}
  );

  return lists.map((list) => ({
    ...list,
    items: itemsByListId[list.id] || [],
  }));
}

// ---- Todo Mutations ----

export async function createTodoList(list: {
  name: string;
  color_index: number;
  sort_order: number;
  owner?: string | null;
}): Promise<TodoList> {
  const { data, error } = await supabase
    .from("todo_lists")
    .insert(list)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateTodoList(
  id: string,
  updates: Partial<Pick<TodoList, "name" | "color_index" | "sort_order" | "owner">>
): Promise<TodoList> {
  const { data, error } = await supabase
    .from("todo_lists")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTodoList(id: string): Promise<void> {
  const { error } = await supabase
    .from("todo_lists")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function createTodoItem(item: {
  list_id: string;
  text: string;
  status?: string;
  sort_order: number;
}): Promise<TodoItem> {
  const { data, error } = await supabase
    .from("todo_items")
    .insert(item)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateTodoItem(
  id: string,
  updates: Partial<Pick<TodoItem, "text" | "status" | "sort_order">>
): Promise<TodoItem> {
  const { data, error } = await supabase
    .from("todo_items")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTodoItem(id: string): Promise<void> {
  const { error } = await supabase
    .from("todo_items")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function reorderTodoItems(
  items: { id: string; sort_order: number }[]
): Promise<void> {
  await Promise.all(
    items.map(({ id, sort_order }) =>
      supabase
        .from("todo_items")
        .update({ sort_order })
        .eq("id", id)
        .then(({ error }) => {
          if (error) throw error;
        })
    )
  );
}

// ---- Neighbors ----

export async function fetchNeighbors(): Promise<Neighbor[]> {
  const { data, error } = await supabase
    .from("neighbors")
    .select("*")
    .order("position_index");
  if (error) throw error;
  return data || [];
}

export async function upsertNeighbor(
  neighbor: Omit<Neighbor, "created_at">
): Promise<Neighbor> {
  const { data, error } = await supabase
    .from("neighbors")
    .upsert(neighbor, { onConflict: "id" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function upsertNeighbors(
  neighbors: Omit<Neighbor, "created_at">[]
): Promise<Neighbor[]> {
  const { data, error } = await supabase
    .from("neighbors")
    .upsert(neighbors, { onConflict: "id" })
    .select();
  if (error) throw error;
  return data || [];
}

export async function deleteNeighbor(id: string): Promise<void> {
  const { error } = await supabase.from("neighbors").delete().eq("id", id);
  if (error) throw error;
}
