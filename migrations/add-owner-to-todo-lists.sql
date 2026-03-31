-- Add owner column to todo_lists for user identity segmentation
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)

-- 1. Add the column (nullable so existing lists still work)
ALTER TABLE todo_lists ADD COLUMN IF NOT EXISTS owner text;

-- 2. Assign existing lists to brendan (the original user)
UPDATE todo_lists SET owner = 'brendan' WHERE owner IS NULL;

-- 3. (Optional) Create an index for filtering by owner
CREATE INDEX IF NOT EXISTS idx_todo_lists_owner ON todo_lists(owner);
