-- =============================================
-- Home Navigator - Supabase Schema Setup
-- Run this in the Supabase SQL Editor
-- =============================================

-- 1. Rooms table
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  icon text not null default 'R',
  -- Floor plan position (for 3D layout)
  pos_x float not null default 0,
  pos_y float not null default 0,
  pos_z float not null default 0,
  width float not null default 4,
  depth float not null default 4,
  height float not null default 2.7,
  color text not null default '#4a5568',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- 2. Frames table (extracted video frames)
create table public.frames (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  image_url text, -- Supabase Storage URL
  timestamp text, -- Position in original video
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- 3. Items table (cataloged items from frames)
create table public.items (
  id uuid primary key default gen_random_uuid(),
  frame_id uuid not null references public.frames(id) on delete cascade,
  name text not null,
  location text not null, -- e.g. "Bottom cabinet, left side"
  -- Optional: position within the room for 3D pin placement
  pin_x float,
  pin_y float,
  pin_z float,
  created_at timestamptz not null default now()
);

-- 4. Indexes for fast search
create index idx_items_name on public.items using gin (to_tsvector('english', name));
create index idx_items_location on public.items using gin (to_tsvector('english', location));
create index idx_items_frame_id on public.items(frame_id);
create index idx_frames_room_id on public.frames(room_id);

-- 5. Full-text search function
create or replace function search_items(query text)
returns table (
  item_id uuid,
  item_name text,
  item_location text,
  frame_id uuid,
  frame_image_url text,
  frame_timestamp text,
  room_id uuid,
  room_name text,
  room_icon text,
  rank float4
) language sql stable as $$
  select
    i.id as item_id,
    i.name as item_name,
    i.location as item_location,
    f.id as frame_id,
    f.image_url as frame_image_url,
    f.timestamp as frame_timestamp,
    r.id as room_id,
    r.name as room_name,
    r.icon as room_icon,
    ts_rank(
      to_tsvector('english', i.name || ' ' || i.location),
      plainto_tsquery('english', query)
    ) as rank
  from public.items i
  join public.frames f on f.id = i.frame_id
  join public.rooms r on r.id = f.room_id
  where
    to_tsvector('english', i.name || ' ' || i.location)
    @@ plainto_tsquery('english', query)
    or i.name ilike '%' || query || '%'
    or i.location ilike '%' || query || '%'
  order by rank desc;
$$;

-- 6. Row Level Security (allow public read, authenticated write)
alter table public.rooms enable row level security;
alter table public.frames enable row level security;
alter table public.items enable row level security;

-- Allow anyone with the anon key to read
create policy "Public read rooms" on public.rooms for select using (true);
create policy "Public read frames" on public.frames for select using (true);
create policy "Public read items" on public.items for select using (true);

-- Allow anyone with the anon key to insert/update/delete
-- (In production you'd lock this down more, but for a personal app this is fine)
create policy "Public write rooms" on public.rooms for all using (true) with check (true);
create policy "Public write frames" on public.frames for all using (true) with check (true);
create policy "Public write items" on public.items for all using (true) with check (true);

-- 7. Create storage bucket for frame images
insert into storage.buckets (id, name, public)
values ('frame-images', 'frame-images', true)
on conflict (id) do nothing;

-- Allow public read on storage
create policy "Public read frame images"
on storage.objects for select
using (bucket_id = 'frame-images');

-- Allow public upload
create policy "Public upload frame images"
on storage.objects for insert
with check (bucket_id = 'frame-images');

-- 8. Seed some demo data so the app has something to show
insert into public.rooms (id, name, icon, pos_x, pos_y, pos_z, width, depth, height, color, sort_order) values
  ('00000000-0000-0000-0000-000000000001', 'Kitchen', 'K', 0, 0, 0, 5, 4, 2.7, '#5d4037', 1),
  ('00000000-0000-0000-0000-000000000002', 'Basement', 'B', 0, -3, 0, 6, 5, 2.4, '#283593', 2),
  ('00000000-0000-0000-0000-000000000003', 'Garage', 'G', 6, 0, 0, 5, 5, 3, '#455a64', 3),
  ('00000000-0000-0000-0000-000000000004', 'Master Bedroom', 'M', 0, 5, 0, 4, 4, 2.7, '#2e7d32', 4);

insert into public.frames (id, room_id, timestamp, sort_order) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '0:02', 1),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '0:06', 2),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', '0:04', 1),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', '0:08', 2),
  ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000003', '0:03', 1),
  ('10000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000004', '0:02', 1);

insert into public.items (frame_id, name, location) values
  ('10000000-0000-0000-0000-000000000001', 'Stand mixer', 'Counter, left of stove'),
  ('10000000-0000-0000-0000-000000000001', 'Knife block', 'Counter, right of stove'),
  ('10000000-0000-0000-0000-000000000001', 'Spice rack', 'Upper cabinet, right of stove'),
  ('10000000-0000-0000-0000-000000000002', 'Cast iron skillet', 'Lower cabinet, under island'),
  ('10000000-0000-0000-0000-000000000002', 'Dutch oven', 'Lower cabinet, under island'),
  ('10000000-0000-0000-0000-000000000002', 'Baking sheets', 'Vertical organizer, next to oven'),
  ('10000000-0000-0000-0000-000000000003', 'Tea tray', 'Bottom cabinet, left side'),
  ('10000000-0000-0000-0000-000000000003', 'Serving bowls', 'Bottom cabinet, right side'),
  ('10000000-0000-0000-0000-000000000003', 'Holiday tablecloths', 'Bottom cabinet, middle shelf'),
  ('10000000-0000-0000-0000-000000000004', 'Power drill', 'Pegboard wall, top row'),
  ('10000000-0000-0000-0000-000000000004', 'Screwdriver set', 'Pegboard wall, middle row'),
  ('10000000-0000-0000-0000-000000000004', 'Extension cords', 'Hook by door'),
  ('10000000-0000-0000-0000-000000000005', 'Bicycle', 'Wall mount, left side'),
  ('10000000-0000-0000-0000-000000000005', 'Camping tent', 'Top shelf, back wall'),
  ('10000000-0000-0000-0000-000000000005', 'Cooler', 'Floor, under shelf'),
  ('10000000-0000-0000-0000-000000000006', 'Extra pillows', 'Top shelf, closet'),
  ('10000000-0000-0000-0000-000000000006', 'Winter blankets', 'Second shelf, closet'),
  ('10000000-0000-0000-0000-000000000006', 'Luggage set', 'Floor, back of closet');
