-- Add parent_id to todo_items for subtask support
-- Subtasks are todo_items with a non-null parent_id pointing to another todo_item
-- Deleting a parent item cascades to delete all its subtasks
ALTER TABLE todo_items
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES todo_items(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_todo_items_parent_id ON todo_items(parent_id);
