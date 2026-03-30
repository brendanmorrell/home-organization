#!/usr/bin/env npx tsx
/**
 * Migrate QuickTodo local JSON data into Supabase todo_lists and todo_items tables.
 *
 * Run from project root:  npx tsx scripts/migrate-quicktodo.ts
 */

import fs from 'fs';
import path from 'path';

const BASE = path.resolve(import.meta.dirname, '..');

// Load .env (same pattern as push-inventory.cjs)
const env: Record<string, string> = {};
fs.readFileSync(path.join(BASE, '.env'), 'utf-8').split('\n').forEach(l => {
  const m = l.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
});

const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SUPABASE_KEY = env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

interface QuickTodoItem {
  text: string;
  done: boolean;
  status: 'todo' | 'inflight' | 'done';
}

interface QuickTodoList {
  name: string;
  colorIndex: number;
  items: QuickTodoItem[];
}

interface QuickTodoData {
  activeList: number;
  lists: QuickTodoList[];
}

interface SupabaseTodoList {
  id: string;
  name: string;
  color_index: number;
  sort_order: number;
}

async function supaFetch<T = unknown>(endpoint: string, options: RequestInit & { prefer?: string } = {}): Promise<T> {
  const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': options.prefer || 'return=representation',
      ...options.headers as Record<string, string>,
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Supabase ${res.status}: ${text}`);
  }
  return (text ? JSON.parse(text) : null) as T;
}

async function main() {
  // 1. Load QuickTodo data
  const dataPath = path.join(BASE, 'quicktodo', '.quicktodo-data.json');
  const data: QuickTodoData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
  console.log(`Loaded ${data.lists.length} lists from .quicktodo-data.json`);

  let totalLists = 0;
  let totalItems = 0;

  // 2. Process each list
  for (let i = 0; i < data.lists.length; i++) {
    const list = data.lists[i];
    console.log(`\nProcessing list: "${list.name}" (${list.items.length} items)`);

    // Insert the list
    const [created] = await supaFetch<SupabaseTodoList[]>('todo_lists', {
      method: 'POST',
      body: JSON.stringify({
        name: list.name,
        color_index: list.colorIndex,
        sort_order: i,
      }),
    });
    totalLists++;
    console.log(`  Created list "${list.name}" (id: ${created.id})`);

    // Insert items for this list
    if (list.items.length > 0) {
      const items = list.items.map((item, idx) => ({
        list_id: created.id,
        text: item.text,
        status: item.status || (item.done ? 'done' : 'todo'),
        sort_order: idx,
      }));

      await supaFetch('todo_items', {
        method: 'POST',
        body: JSON.stringify(items),
      });
      totalItems += items.length;
      console.log(`  Inserted ${items.length} items`);
    }
  }

  // 3. Summary
  console.log(`\n=== SUMMARY ===`);
  console.log(`Lists created: ${totalLists}`);
  console.log(`Items created: ${totalItems}`);
  console.log('\nDone!');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
