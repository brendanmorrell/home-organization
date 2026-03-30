-- Enable Supabase Realtime for todo tables
-- Run this in the Supabase SQL Editor

alter publication supabase_realtime add table public.todo_lists;
alter publication supabase_realtime add table public.todo_items;
