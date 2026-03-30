import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchTodoListsWithItems,
  createTodoList,
  updateTodoList,
  deleteTodoList,
  createTodoItem,
  updateTodoItem,
  deleteTodoItem,
  type TodoListWithItems,
  type TodoItem,
} from "~/lib/supabase";

const NEON_COLORS = [
  "#00e5ff", // Electric Cyan
  "#b388ff", // Neon Violet
  "#76ff03", // Neon Green
  "#ff9100", // Neon Orange
  "#ff4081", // Neon Pink
  "#ffea00", // Neon Yellow
  "#1de9b6", // Neon Teal
  "#ea80fc", // Neon Magenta
];

const STATUS_ORDER: Record<string, number> = { todo: 0, inflight: 1, done: 2 };

function sortItems(items: TodoItem[]): TodoItem[] {
  return [...items].sort(
    (a, b) => (STATUS_ORDER[a.status] ?? 0) - (STATUS_ORDER[b.status] ?? 0) || a.sort_order - b.sort_order
  );
}

export default function TodosPage() {
  const queryClient = useQueryClient();

  const { data: lists = [], isLoading } = useQuery<TodoListWithItems[]>({
    queryKey: ["todo-lists"],
    queryFn: fetchTodoListsWithItems,
  });

  // --- Local UI state ---
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [newInput, setNewInput] = useState("");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemText, setEditingItemText] = useState("");
  const [renamingListId, setRenamingListId] = useState<string | null>(null);
  const [renamingListName, setRenamingListName] = useState("");
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const renameRef = useRef<HTMLInputElement>(null);
  const editRef = useRef<HTMLInputElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-select first list if none active
  useEffect(() => {
    if (!activeListId && lists.length > 0) {
      setActiveListId(lists[0].id);
    }
  }, [lists, activeListId]);

  // Focus rename input when renaming
  useEffect(() => {
    if (renamingListId) renameRef.current?.focus();
  }, [renamingListId]);

  // Focus edit input when editing
  useEffect(() => {
    if (editingItemId) editRef.current?.focus();
  }, [editingItemId]);

  const activeList = lists.find((l) => l.id === activeListId) ?? null;
  const activeColor = activeList ? NEON_COLORS[activeList.color_index % NEON_COLORS.length] : NEON_COLORS[0];
  const sortedItems = activeList ? sortItems(activeList.items) : [];

  const todoCt = sortedItems.filter((i) => i.status === "todo").length;
  const inflightCt = sortedItems.filter((i) => i.status === "inflight").length;
  const doneCt = sortedItems.filter((i) => i.status === "done").length;

  // --- Mutations ---

  const addListMut = useMutation({
    mutationFn: () =>
      createTodoList({
        name: "New List",
        color_index: lists.length % NEON_COLORS.length,
        sort_order: lists.length,
      }),
    onSuccess: (newList: { id: string; name: string }) => {
      queryClient.invalidateQueries({ queryKey: ["todo-lists"] });
      setActiveListId(newList.id);
      setRenamingListId(newList.id);
      setRenamingListName(newList.name);
    },
  });

  const updateListMut = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Parameters<typeof updateTodoList>[1] }) =>
      updateTodoList(id, updates),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["todo-lists"] }),
  });

  const deleteListMut = useMutation({
    mutationFn: (id: string) => deleteTodoList(id),
    onSuccess: (_, deletedId) => {
      if (activeListId === deletedId) {
        const remaining = lists.filter((l) => l.id !== deletedId);
        setActiveListId(remaining.length > 0 ? remaining[0].id : null);
      }
      queryClient.invalidateQueries({ queryKey: ["todo-lists"] });
    },
  });

  const addItemMut = useMutation({
    mutationFn: (text: string) =>
      createTodoItem({
        list_id: activeListId!,
        text,
        sort_order: activeList ? activeList.items.length : 0,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["todo-lists"] }),
  });

  const updateItemMut = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Parameters<typeof updateTodoItem>[1] }) =>
      updateTodoItem(id, updates),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["todo-lists"] }),
  });

  const deleteItemMut = useMutation({
    mutationFn: (id: string) => deleteTodoItem(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["todo-lists"] }),
  });

  // --- Handlers ---

  const handleAddItems = useCallback(() => {
    if (!newInput.trim() || !activeListId) return;
    const lines = newInput.split("\n").map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      addItemMut.mutate(line);
    }
    setNewInput("");
    inputRef.current?.focus();
  }, [newInput, activeListId, addItemMut]);

  const handleCheckboxClick = useCallback(
    (item: TodoItem) => {
      const nextStatus = item.status === "done" ? "todo" : "done";
      updateItemMut.mutate({ id: item.id, updates: { status: nextStatus } });
    },
    [updateItemMut]
  );

  const handleCheckboxContext = useCallback(
    (e: React.MouseEvent, item: TodoItem) => {
      e.preventDefault();
      const nextStatus = item.status === "inflight" ? "todo" : "inflight";
      updateItemMut.mutate({ id: item.id, updates: { status: nextStatus } });
    },
    [updateItemMut]
  );

  const handlePointerDown = useCallback(
    (item: TodoItem) => {
      longPressTimer.current = setTimeout(() => {
        const nextStatus = item.status === "inflight" ? "todo" : "inflight";
        updateItemMut.mutate({ id: item.id, updates: { status: nextStatus } });
        longPressTimer.current = null;
      }, 500);
    },
    [updateItemMut]
  );

  const handlePointerUp = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleClearDone = useCallback(() => {
    if (!activeList) return;
    const doneItems = activeList.items.filter((i) => i.status === "done");
    for (const item of doneItems) {
      deleteItemMut.mutate(item.id);
    }
  }, [activeList, deleteItemMut]);

  const commitRename = useCallback(() => {
    if (renamingListId && renamingListName.trim()) {
      updateListMut.mutate({ id: renamingListId, updates: { name: renamingListName.trim() } });
    }
    setRenamingListId(null);
  }, [renamingListId, renamingListName, updateListMut]);

  const commitItemEdit = useCallback(() => {
    if (editingItemId && editingItemText.trim()) {
      updateItemMut.mutate({ id: editingItemId, updates: { text: editingItemText.trim() } });
    }
    setEditingItemId(null);
  }, [editingItemId, editingItemText, updateItemMut]);

  const handleDeleteList = useCallback(
    (e: React.MouseEvent, listId: string) => {
      e.stopPropagation();
      const list = lists.find((l) => l.id === listId);
      if (!list) return;
      if (!window.confirm(`Delete "${list.name}" and all its items?`)) return;
      deleteListMut.mutate(listId);
    },
    [lists, deleteListMut]
  );

  // --- Render ---

  if (isLoading) {
    return (
      <div className="todo-page">
        <style>{styles}</style>
        <div className="todo-loading">Loading lists...</div>
      </div>
    );
  }

  return (
    <div className="todo-page" style={{ "--todo-accent": activeColor } as React.CSSProperties}>
      <style>{styles}</style>

      {/* Tab bar */}
      <div className="todo-tabs">
        <div className="todo-tabs-scroll">
          {lists.map((list) => {
            const color = NEON_COLORS[list.color_index % NEON_COLORS.length];
            const isActive = list.id === activeListId;
            return (
              <div
                key={list.id}
                className={`todo-tab ${isActive ? "active" : ""}`}
                style={{ "--tab-color": color } as React.CSSProperties}
                onClick={() => setActiveListId(list.id)}
                onMouseEnter={() => setHoveredTab(list.id)}
                onMouseLeave={() => setHoveredTab(null)}
              >
                {renamingListId === list.id ? (
                  <input
                    ref={renameRef}
                    className="todo-tab-rename"
                    value={renamingListName}
                    onChange={(e) => setRenamingListName(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitRename();
                      if (e.key === "Escape") setRenamingListId(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span
                    className="todo-tab-name"
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setRenamingListId(list.id);
                      setRenamingListName(list.name);
                    }}
                  >
                    {list.name}
                  </span>
                )}
                <span className="todo-tab-count">{list.items.length}</span>
                {hoveredTab === list.id && (
                  <button
                    className="todo-tab-delete"
                    onClick={(e) => handleDeleteList(e, list.id)}
                    title="Delete list"
                  >
                    &times;
                  </button>
                )}
              </div>
            );
          })}
          <button
            className="todo-tab todo-tab-add"
            onClick={() => addListMut.mutate()}
            disabled={addListMut.isPending}
            title="Add new list"
          >
            +
          </button>
        </div>
      </div>

      {/* Item list */}
      {activeList ? (
        <div className="todo-items-container">
          {sortedItems.length === 0 ? (
            <div className="todo-empty">No tasks yet. Add one below.</div>
          ) : (
            <div className="todo-items">
              {sortedItems.map((item) => (
                <div
                  key={item.id}
                  className={`todo-item todo-item--${item.status}`}
                  onMouseEnter={() => setHoveredItemId(item.id)}
                  onMouseLeave={() => setHoveredItemId(null)}
                >
                  <button
                    className={`todo-checkbox todo-checkbox--${item.status}`}
                    onClick={() => handleCheckboxClick(item)}
                    onContextMenu={(e) => handleCheckboxContext(e, item)}
                    onPointerDown={() => handlePointerDown(item)}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                    title="Click: toggle done. Right-click/long-press: toggle in-flight"
                  >
                    {item.status === "done" && (
                      <svg viewBox="0 0 16 16" width="14" height="14">
                        <path d="M3 8l3 3 7-7" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                    {item.status === "inflight" && (
                      <svg viewBox="0 0 16 16" width="12" height="12">
                        <path d="M5 3l8 5-8 5V3z" fill="currentColor" />
                      </svg>
                    )}
                  </button>

                  {editingItemId === item.id ? (
                    <input
                      ref={editRef}
                      className="todo-item-edit"
                      value={editingItemText}
                      onChange={(e) => setEditingItemText(e.target.value)}
                      onBlur={commitItemEdit}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitItemEdit();
                        if (e.key === "Escape") setEditingItemId(null);
                      }}
                    />
                  ) : (
                    <span
                      className="todo-item-text"
                      onDoubleClick={() => {
                        setEditingItemId(item.id);
                        setEditingItemText(item.text);
                      }}
                    >
                      {item.text}
                    </span>
                  )}

                  {hoveredItemId === item.id && (
                    <button
                      className="todo-item-delete"
                      onClick={() => deleteItemMut.mutate(item.id)}
                      title="Delete task"
                    >
                      &times;
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Status bar */}
          <div className="todo-status">
            <span className="todo-status-counts">
              {todoCt} to do &middot; {inflightCt} in flight &middot; {doneCt} done
            </span>
            {doneCt > 0 && (
              <button className="todo-clear-done" onClick={handleClearDone}>
                clear done
              </button>
            )}
          </div>

          {/* Input bar */}
          <div className="todo-input-bar">
            <input
              ref={inputRef}
              className="todo-input"
              placeholder="Add a task..."
              value={newInput}
              onChange={(e) => setNewInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleAddItems();
                }
              }}
              onPaste={(e) => {
                const pasted = e.clipboardData.getData("text");
                if (pasted.includes("\n")) {
                  e.preventDefault();
                  const lines = pasted.split("\n").map((l) => l.trim()).filter(Boolean);
                  for (const line of lines) {
                    addItemMut.mutate(line);
                  }
                }
              }}
            />
          </div>
        </div>
      ) : (
        <div className="todo-empty">
          {lists.length === 0
            ? 'No lists yet. Click "+" to create one.'
            : "Select a list to view tasks."}
        </div>
      )}
    </div>
  );
}

// ---- Scoped styles ----

const styles = `
.todo-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg);
  color: var(--text);
  --todo-accent: #00e5ff;
}

.todo-loading,
.todo-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  color: var(--text-dim);
  font-size: 14px;
}

/* ---- Tab bar ---- */
.todo-tabs {
  padding: 12px 16px 0;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.todo-tabs-scroll {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding-bottom: 10px;
  scrollbar-width: thin;
}

.todo-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  background: var(--surface2);
  color: var(--text-dim);
  border: 1px solid transparent;
  transition: all 0.15s;
  white-space: nowrap;
  position: relative;
  user-select: none;
}

.todo-tab:hover {
  background: var(--surface);
  border-color: var(--tab-color, var(--border));
  color: var(--text);
}

.todo-tab.active {
  background: color-mix(in srgb, var(--tab-color) 15%, transparent);
  border-color: var(--tab-color);
  color: var(--tab-color);
  box-shadow: 0 0 12px color-mix(in srgb, var(--tab-color) 25%, transparent);
}

.todo-tab-name {
  cursor: pointer;
}

.todo-tab-rename {
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--tab-color, var(--accent));
  color: var(--text);
  font-size: 13px;
  font-weight: 500;
  outline: none;
  width: 80px;
  padding: 0;
}

.todo-tab-count {
  font-size: 11px;
  opacity: 0.6;
  background: rgba(255,255,255,0.08);
  padding: 1px 6px;
  border-radius: 10px;
}

.todo-tab-delete {
  background: none;
  border: none;
  color: var(--text-dim);
  font-size: 16px;
  cursor: pointer;
  padding: 0 2px;
  line-height: 1;
  opacity: 0.6;
  transition: opacity 0.1s, color 0.1s;
}
.todo-tab-delete:hover {
  opacity: 1;
  color: var(--red);
}

.todo-tab-add {
  font-size: 18px;
  font-weight: 300;
  color: var(--text-dim);
  padding: 6px 14px;
}
.todo-tab-add:hover {
  color: var(--accent);
  border-color: var(--accent);
}

/* ---- Items container ---- */
.todo-items-container {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.todo-items {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

/* ---- Item row ---- */
.todo-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  transition: background 0.1s;
  min-height: 42px;
}
.todo-item:hover {
  background: var(--surface2);
}

/* Checkbox */
.todo-checkbox {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid var(--border);
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.15s;
  color: transparent;
  padding: 0;
}

.todo-checkbox--todo:hover {
  border-color: var(--todo-accent);
}

.todo-checkbox--done {
  border-color: var(--success);
  background: var(--success);
  color: #fff;
}

.todo-checkbox--inflight {
  border-color: #ffb74d;
  background: rgba(255, 183, 77, 0.15);
  color: #ffb74d;
}

/* Item text */
.todo-item-text {
  flex: 1;
  font-size: 14px;
  line-height: 1.4;
  cursor: default;
  min-width: 0;
  word-break: break-word;
}

.todo-item--done .todo-item-text {
  text-decoration: line-through;
  color: var(--text-dim);
  opacity: 0.6;
}

.todo-item--inflight .todo-item-text {
  color: #ffb74d;
}

.todo-item-edit {
  flex: 1;
  background: var(--surface);
  border: 1px solid var(--todo-accent);
  border-radius: 6px;
  color: var(--text);
  font-size: 14px;
  padding: 4px 8px;
  outline: none;
}

.todo-item-delete {
  background: none;
  border: none;
  color: var(--text-dim);
  font-size: 18px;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
  opacity: 0.5;
  transition: opacity 0.1s, color 0.1s;
  flex-shrink: 0;
}
.todo-item-delete:hover {
  opacity: 1;
  color: var(--red);
}

/* ---- Status bar ---- */
.todo-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  border-top: 1px solid var(--border);
  font-size: 12px;
  color: var(--text-dim);
  flex-shrink: 0;
}

.todo-status-counts {
  letter-spacing: 0.02em;
}

.todo-clear-done {
  background: none;
  border: 1px solid var(--border);
  color: var(--text-dim);
  font-size: 11px;
  padding: 3px 10px;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.15s;
}
.todo-clear-done:hover {
  border-color: var(--red);
  color: var(--red);
}

/* ---- Input bar ---- */
.todo-input-bar {
  padding: 12px 16px;
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}

.todo-input {
  width: 100%;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text);
  font-size: 14px;
  padding: 10px 14px;
  outline: none;
  transition: border-color 0.15s;
}
.todo-input::placeholder {
  color: var(--text-dim);
}
.todo-input:focus {
  border-color: var(--todo-accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--todo-accent) 20%, transparent);
}
`;
