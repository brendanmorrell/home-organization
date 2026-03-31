create table if not exists neighbors (
  id text primary key,
  address text not null default '',
  side text not null check (side in ('west', 'east', 'alley')),
  names text[] not null default '{}',
  notes text not null default '',
  is_us boolean not null default false,
  position_index integer not null default 0,
  created_at timestamptz not null default now()
);

-- Allow public read/write (matches existing RLS pattern for rooms/frames/items)
alter table neighbors enable row level security;

create policy "Allow public read" on neighbors for select using (true);
create policy "Allow public insert" on neighbors for insert with check (true);
create policy "Allow public update" on neighbors for update using (true);
create policy "Allow public delete" on neighbors for delete using (true);
