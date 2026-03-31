import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://bbztmfiefxymkfmmplfj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_-pkNGDQJIBajbVAPgcbe_Q_OcPtkJ1X';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

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
  status: 'todo' | 'inflight' | 'done';
  sort_order: number;
  created_at: string;
};

export type TodoListWithItems = TodoList & { items: TodoItem[] };

export async function fetchTodoListsWithItems(): Promise<TodoListWithItems[]> {
  const { data: lists, error: le } = await supabase
    .from('todo_lists').select('*').order('sort_order');
  if (le) throw le;
  const { data: items, error: ie } = await supabase
    .from('todo_items').select('*').order('sort_order');
  if (ie) throw ie;
  const byList: Record<string, TodoItem[]> = {};
  (items || []).forEach(item => {
    if (!byList[item.list_id]) byList[item.list_id] = [];
    byList[item.list_id].push(item);
  });
  return (lists || []).map(list => ({
    ...list,
    items: byList[list.id] || [],
  }));
}

export async function createTodoList(list: { name: string; color_index: number; sort_order: number; owner?: string | null }) {
  const { data, error } = await supabase.from('todo_lists').insert(list).select().single();
  if (error) throw error;
  return data as TodoList;
}

export async function createTodoItem(item: { list_id: string; text: string; status?: string; sort_order: number }) {
  const { data, error } = await supabase.from('todo_items').insert(item).select().single();
  if (error) throw error;
  return data as TodoItem;
}

export async function updateTodoItem(id: string, updates: Partial<Pick<TodoItem, 'text' | 'status' | 'sort_order'>>) {
  const { error } = await supabase.from('todo_items').update(updates).eq('id', id);
  if (error) throw error;
}

export async function deleteTodoItem(id: string) {
  const { error } = await supabase.from('todo_items').delete().eq('id', id);
  if (error) throw error;
}

export async function deleteTodoList(id: string) {
  const { error } = await supabase.from('todo_lists').delete().eq('id', id);
  if (error) throw error;
}

export async function updateTodoList(id: string, updates: Partial<Pick<TodoList, 'name' | 'color_index' | 'sort_order' | 'owner'>>) {
  const { error } = await supabase.from('todo_lists').update(updates).eq('id', id);
  if (error) throw error;
}
