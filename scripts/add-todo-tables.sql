-- Run this in the Supabase SQL Editor to add todo tables
-- https://supabase.com/dashboard/project/bbztmfiefxymkfmmplfj/sql/new

create table public.todo_lists (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color_index int not null default 0,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.todo_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.todo_lists(id) on delete cascade,
  text text not null,
  status text not null default 'todo' check (status in ('todo', 'inflight', 'done')),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index idx_todo_items_list_id on public.todo_items(list_id);
create index idx_todo_items_status on public.todo_items(status);

alter table public.todo_lists enable row level security;
alter table public.todo_items enable row level security;

create policy "Public read todo_lists" on public.todo_lists for select using (true);
create policy "Public write todo_lists" on public.todo_lists for all using (true) with check (true);
create policy "Public read todo_items" on public.todo_items for select using (true);
create policy "Public write todo_items" on public.todo_items for all using (true) with check (true);
