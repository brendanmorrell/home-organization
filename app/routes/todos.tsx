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
  supabase,
  type TodoListWithItems,
  type TodoItem,
} from "~/lib/supabase";
import {
  getIdentity,
  setIdentity,
  clearIdentity,
  getActiveListKey,
  USERS,
  type Identity,
} from "~/lib/identity";

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

/** Check if a list is visible to a given user */
function isListVisibleTo(list: TodoListWithItems, user: Identity): boolean {
  // Shared lists (owner is null/undefined) are visible to everyone
  if (!list.owner) return true;
  // Personal lists are only visible to their owner
  return list.owner === user;
}

/** Check if a list is shared (no owner) */
function isSharedList(list: TodoListWithItems): boolean {
  return !list.owner;
}

// ---- Identity Picker Component ----

function IdentityPicker({ onSelect }: { onSelect: (id: Identity) => void }) {
  return (
    <div className="identity-picker">
      <style>{pickerStyles}</style>
      <div className="identity-picker-content">
        <h1 className="identity-picker-title">Who are you?</h1>
        <div className="identity-picker-buttons">
          {USERS.map((user) => (
            <button
              key={user.id}
              className="identity-picker-btn"
              onClick={() => onSelect(user.id)}
            >
              <span className="identity-picker-avatar">
                {user.label.charAt(0)}
              </span>
              <span className="identity-picker-name">{user.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function TodosPage() {
  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = useState<Identity | null>(() => getIdentity());
  const [newListShared, setNewListShared] = useState(false);

  const handleSelectIdentity = useCallback((id: Identity) => {
    setIdentity(id);
    setCurrentUser(id);
  }, []);

  const handleSwitchUser = useCallback(() => {
    clearIdentity();
    setCurrentUser(null);
  }, []);

  // If no identity, show picker
  if (!currentUser) {
    return <IdentityPicker onSelect={handleSelectIdentity} />;
  }

  return (
    <TodosMain
      currentUser={currentUser}
      onSwitchUser={handleSwitchUser}
      newListShared={newListShared}
      setNewListShared={setNewListShared}
    />
  );
}

function TodosMain({
  currentUser,
  onSwitchUser,
  newListShared,
  setNewListShared,
}: {
  currentUser: Identity;
  onSwitchUser: () => void;
  newListShared: boolean;
  setNewListShared: (v: boolean) => void;
}) {
  const queryClient = useQueryClient();

  const { data: allLists = [], isLoading } = useQuery<TodoListWithItems[]>({
    queryKey: ["todo-lists"],
    queryFn: fetchTodoListsWithItems,
    refetchInterval: 5000,
  });

  // Filter lists visible to the current user
  const lists = allLists.filter((l) => isListVisibleTo(l, currentUser));

  // Sort: user's own lists first, then shared
  const sortedLists = [...lists].sort((a, b) => {
    const aOwned = a.owner === currentUser ? 0 : 1;
    const bOwned = b.owner === currentUser ? 0 : 1;
    if (aOwned !== bOwned) return aOwned - bOwned;
    return a.sort_order - b.sort_order;
  });

  // --- Realtime ---
  useEffect(() => {
    const channel = supabase
      .channel('todo-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'todo_lists' }, () => {
        queryClient.invalidateQueries({ queryKey: ["todo-lists"] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'todo_items' }, () => {
        queryClient.invalidateQueries({ queryKey: ["todo-lists"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  // --- Local UI state ---
  const activeListKey = getActiveListKey(currentUser);
  const [activeListId, setActiveListIdRaw] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(activeListKey);
  });

  const setActiveListId = useCallback((id: string | null) => {
    setActiveListIdRaw(id);
    if (id) {
      localStorage.setItem(activeListKey, id);
    } else {
      localStorage.removeItem(activeListKey);
    }
  }, [activeListKey]);

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

  // Auto-select first list if none active or active not in visible lists
  useEffect(() => {
    if (sortedLists.length === 0) return;
    const activeStillVisible = activeListId && sortedLists.some((l) => l.id === activeListId);
    if (!activeStillVisible) {
      setActiveListId(sortedLists[0].id);
    }
  }, [sortedLists, activeListId, setActiveListId]);

  // Focus rename input when renaming
  useEffect(() => {
    if (renamingListId) renameRef.current?.focus();
  }, [renamingListId]);

  // Focus edit input when editing
  useEffect(() => {
    if (editingItemId) editRef.current?.focus();
  }, [editingItemId]);

  const activeList = sortedLists.find((l) => l.id === activeListId) ?? null;
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
        color_index: allLists.length % NEON_COLORS.length,
        sort_order: allLists.length,
        owner: newListShared ? null : currentUser,
      }),
    onSuccess: (newList: { id: string; name: string }) => {
      queryClient.invalidateQueries({ queryKey: ["todo-lists"] });
      setActiveListId(newList.id);
      setRenamingListId(newList.id);
      setRenamingListName(newList.name);
      setNewListShared(false);
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
        const remaining = sortedLists.filter((l) => l.id !== deletedId);
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
      const list = sortedLists.find((l) => l.id === listId);
      if (!list) return;
      if (!window.confirm(`Delete "${list.name}" and all its items?`)) return;
      deleteListMut.mutate(listId);
    },
    [sortedLists, deleteListMut]
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

      {/* User header */}
      <div className="todo-user-bar">
        <span className="todo-user-name">
          {currentUser.charAt(0).toUpperCase() + currentUser.slice(1)}'s Todos
        </span>
        <button className="todo-switch-user" onClick={onSwitchUser}>
          Switch
        </button>
      </div>

      {/* Tab bar */}
      <div className="todo-tabs">
        <div className="todo-tabs-scroll">
          {sortedLists.map((list) => {
            const color = NEON_COLORS[list.color_index % NEON_COLORS.length];
            const isActive = list.id === activeListId;
            const shared = isSharedList(list);
            return (
              <div
                key={list.id}
                className={`todo-tab ${isActive ? "active" : ""} ${shared ? "todo-tab--shared" : ""}`}
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
                {shared && <span className="todo-tab-shared-badge">shared</span>}
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

          {/* New list button with shared toggle */}
          <div className="todo-tab-add-group">
            <button
              className="todo-tab todo-tab-add"
              onClick={() => addListMut.mutate()}
              disabled={addListMut.isPending}
              title={newListShared ? "Add shared list" : "Add personal list"}
            >
              +
            </button>
            <button
              className={`todo-shared-toggle ${newListShared ? "active" : ""}`}
              onClick={() => setNewListShared(!newListShared)}
              title={newListShared ? "Will create shared list" : "Will create personal list"}
            >
              {newListShared ? "Shared" : "Personal"}
            </button>
          </div>
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

                  <button
                    className={`todo-item-delete ${hoveredItemId === item.id ? "visible" : ""}`}
                    onClick={() => deleteItemMut.mutate(item.id)}
                    title="Delete task"
                  >
                    &times;
                  </button>
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
          {sortedLists.length === 0
            ? 'No lists yet. Click "+" to create one.'
            : "Select a list to view tasks."}
        </div>
      )}
    </div>
  );
}

// ---- Identity Picker styles ----

const pickerStyles = `
.identity-picker {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  background: #0a0a1a;
  color: #e8e8f0;
}

.identity-picker-content {
  text-align: center;
  padding: 24px;
}

.identity-picker-title {
  font-size: 28px;
  font-weight: 700;
  margin-bottom: 40px;
  color: #e8e8f0;
  letter-spacing: -0.5px;
}

.identity-picker-buttons {
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: center;
}

.identity-picker-btn {
  display: flex;
  align-items: center;
  gap: 16px;
  width: 260px;
  padding: 20px 28px;
  background: #16213e;
  border: 2px solid #2a3a5e;
  border-radius: 16px;
  color: #e8e8f0;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
}

.identity-picker-btn:hover {
  border-color: #00e5ff;
  background: #1a2844;
  box-shadow: 0 0 20px rgba(0, 229, 255, 0.15);
  transform: translateY(-2px);
}

.identity-picker-btn:active {
  transform: translateY(0);
}

.identity-picker-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: linear-gradient(135deg, #00e5ff, #b388ff);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  font-weight: 700;
  color: #0a0a1a;
  flex-shrink: 0;
}

.identity-picker-name {
  font-size: 20px;
  font-weight: 600;
}
`;

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

/* ---- User bar ---- */
.todo-user-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  flex-shrink: 0;
  border-bottom: 1px solid var(--border);
}

.todo-user-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
}

.todo-switch-user {
  background: none;
  border: 1px solid var(--border);
  color: var(--text-dim);
  font-size: 12px;
  padding: 4px 12px;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.15s;
  font-family: inherit;
}
.todo-switch-user:hover {
  border-color: var(--todo-accent);
  color: var(--todo-accent);
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
  align-items: center;
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

.todo-tab--shared {
  border-style: dashed;
}
.todo-tab--shared.active {
  border-style: solid;
}

.todo-tab-shared-badge {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  opacity: 0.5;
  font-weight: 600;
}

.todo-tab-name {
  cursor: pointer;
}

.todo-tab-rename {
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--tab-color, var(--accent));
  color: var(--text);
  font-size: 16px;
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

.todo-tab-add-group {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
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

.todo-shared-toggle {
  background: none;
  border: 1px solid var(--border);
  color: var(--text-dim);
  font-size: 10px;
  padding: 4px 8px;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
  font-family: inherit;
}
.todo-shared-toggle:hover {
  border-color: var(--todo-accent);
  color: var(--todo-accent);
}
.todo-shared-toggle.active {
  border-color: var(--todo-accent);
  color: var(--todo-accent);
  background: color-mix(in srgb, var(--todo-accent) 10%, transparent);
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
  font-size: 16px;
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
  opacity: 0;
  transition: opacity 0.1s, color 0.1s;
  flex-shrink: 0;
}
.todo-item-delete.visible {
  opacity: 0.5;
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
  font-size: 16px;
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

/* ---- Mobile touch optimizations ---- */
@media (max-width: 767px) {
  .todo-tabs {
    padding: 8px 12px 0;
  }
  .todo-tab {
    padding: 8px 14px;
    font-size: 14px;
  }
  .todo-item {
    padding: 12px 12px;
    gap: 12px;
    min-height: 48px;
  }
  .todo-checkbox {
    width: 28px;
    height: 28px;
  }
  .todo-item-text {
    font-size: 15px;
  }
  /* Always show delete on touch — no hover */
  .todo-item-delete {
    display: flex;
    opacity: 0.4;
  }
  .todo-input-bar {
    padding: 10px 12px;
    padding-bottom: calc(10px + env(safe-area-inset-bottom, 0));
  }
  .todo-status {
    padding: 6px 12px;
  }
  .todo-user-bar {
    padding: 8px 12px;
  }
}
`;
