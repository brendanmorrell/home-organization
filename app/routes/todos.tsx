import { Fragment, useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchTodoListsWithItems,
  createTodoList,
  updateTodoList,
  deleteTodoList,
  createTodoItem,
  updateTodoItem,
  deleteTodoItem,
  reorderTodoItems,
  reorderTodoLists,
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

// Matches "- ", "* ", "• ", "1. ", "1) ", "[x] " etc. at the start of a pasted line
const BULLET_PREFIX = /^(?:[-*•–—]\s+|\d+[.)]\s+|\[.\]\s+)/;

// How long a just-completed item stays in place before sorting down to the done section
const DONE_SORT_DELAY_MS = 500;
// Long-press duration before a touch drag activates
const DRAG_LONG_PRESS_MS = 300;
// How long a dragged item must hover a tab before the view switches to that list
const TAB_DWELL_MS = 600;

function sortItems(items: TodoItem[], recentlyDone?: Set<string>): TodoItem[] {
  return [...items].sort((a, b) => {
    const aStatus = recentlyDone?.has(a.id) ? "todo" : a.status;
    const bStatus = recentlyDone?.has(b.id) ? "todo" : b.status;
    return (
      (STATUS_ORDER[aStatus] ?? 0) - (STATUS_ORDER[bStatus] ?? 0) ||
      a.sort_order - b.sort_order
    );
  });
}

function stripBulletPrefix(line: string): string {
  return line.replace(BULLET_PREFIX, "");
}

/** Split free text into task lines, trimming and stripping bullet/number prefixes */
function splitTaskLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map(stripBulletPrefix)
    .filter(Boolean);
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

  const [realtimeHealthy, setRealtimeHealthy] = useState(false);

  const { data: allLists = [], isLoading } = useQuery<TodoListWithItems[]>({
    queryKey: ["todo-lists"],
    queryFn: fetchTodoListsWithItems,
    refetchInterval: realtimeHealthy ? false : 10000, // only poll when realtime is down
  });

  // Filter lists visible to the current user
  const lists = allLists.filter((l) => isListVisibleTo(l, currentUser));

  // Sort purely by sort_order so tabs can be freely rearranged by dragging,
  // mixing personal and shared lists in any order (matches the desktop app)
  const sortedLists = [...lists].sort(
    (a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id)
  );

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
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setRealtimeHealthy(true);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setRealtimeHealthy(false);
        }
      });
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
  const [addingSubtaskFor, setAddingSubtaskFor] = useState<string | null>(null);
  const [subtaskText, setSubtaskText] = useState("");
  // Just-completed items keep their spot (and animate) briefly before sorting down
  const [recentlyDone, setRecentlyDone] = useState<Set<string>>(() => new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const renameRef = useRef<HTMLInputElement>(null);
  const editRef = useRef<HTMLInputElement>(null);
  const subInputRef = useRef<HTMLInputElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-select first list ONLY if no valid active list exists
  // Use list IDs as stable dependency, not the array reference
  const visibleListIds = sortedLists.map(l => l.id).join(",");
  useEffect(() => {
    if (sortedLists.length === 0) return;
    if (activeListId && sortedLists.some((l) => l.id === activeListId)) return;
    // Only auto-select if current selection is genuinely invalid
    setActiveListId(sortedLists[0].id);
  }, [visibleListIds]); // eslint-disable-line react-hooks/exhaustive-deps

  // Focus rename input when renaming
  useEffect(() => {
    if (renamingListId) renameRef.current?.focus();
  }, [renamingListId]);

  // Focus edit input when editing
  useEffect(() => {
    if (editingItemId) editRef.current?.focus();
  }, [editingItemId]);

  // Focus subtask input when it opens
  useEffect(() => {
    if (addingSubtaskFor) subInputRef.current?.focus();
  }, [addingSubtaskFor]);

  const activeList = sortedLists.find((l) => l.id === activeListId) ?? null;
  const activeColor = activeList ? NEON_COLORS[activeList.color_index % NEON_COLORS.length] : NEON_COLORS[0];

  // Top-level items and their subtasks, both status-sorted (with done-sort delay)
  const sortedTopLevel = activeList
    ? sortItems(activeList.items.filter((i) => !i.parent_id), recentlyDone)
    : [];
  const subsByParent: Record<string, TodoItem[]> = {};
  if (activeList) {
    for (const item of activeList.items) {
      if (item.parent_id) {
        (subsByParent[item.parent_id] ??= []).push(item);
      }
    }
    for (const key of Object.keys(subsByParent)) {
      subsByParent[key] = sortItems(subsByParent[key], recentlyDone);
    }
  }

  const allItems = activeList ? activeList.items : [];
  const todoCt = allItems.filter((i) => i.status === "todo").length;
  const inflightCt = allItems.filter((i) => i.status === "inflight").length;
  const doneCt = allItems.filter((i) => i.status === "done").length;
  const doneTopLevelCt = allItems.filter((i) => i.status === "done" && !i.parent_id).length;

  // --- Mutations ---

  const addListMut = useMutation({
    mutationFn: () =>
      createTodoList({
        name: "New List",
        color_index: allLists.length % NEON_COLORS.length,
        sort_order: allLists.length,
        owner: newListShared ? null : currentUser,
      }),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["todo-lists"] });
      const prev = queryClient.getQueryData<TodoListWithItems[]>(["todo-lists"]);
      const tempId = `temp-${Date.now()}`;
      const optimisticList: TodoListWithItems = {
        id: tempId,
        name: "New List",
        color_index: allLists.length % NEON_COLORS.length,
        sort_order: allLists.length,
        owner: newListShared ? null : currentUser,
        items: [],
        created_at: new Date().toISOString(),
      };
      queryClient.setQueryData<TodoListWithItems[]>(["todo-lists"], (old) => [...(old ?? []), optimisticList]);
      setActiveListId(tempId);
      setNewListShared(false);
      return { prev, tempId };
    },
    onSuccess: (newList: { id: string; name: string }, _, context) => {
      if (context?.tempId && activeListId === context.tempId) setActiveListId(newList.id);
      // Only enter rename mode once the real id exists — renaming the optimistic
      // temp row would send a PATCH against an id the server has never seen
      setRenamingListId(newList.id);
      setRenamingListName("New List");
      queryClient.invalidateQueries({ queryKey: ["todo-lists"] });
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(["todo-lists"], context.prev);
    },
  });

  const updateListMut = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Parameters<typeof updateTodoList>[1] }) =>
      updateTodoList(id, updates),
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: ["todo-lists"] });
      const prev = queryClient.getQueryData<TodoListWithItems[]>(["todo-lists"]);
      queryClient.setQueryData<TodoListWithItems[]>(["todo-lists"], (old) =>
        old?.map((l) => (l.id === id ? { ...l, ...updates } : l)) ?? []
      );
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(["todo-lists"], context.prev);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["todo-lists"] }),
  });

  const deleteListMut = useMutation({
    mutationFn: (id: string) => deleteTodoList(id),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ["todo-lists"] });
      const prev = queryClient.getQueryData<TodoListWithItems[]>(["todo-lists"]);
      queryClient.setQueryData<TodoListWithItems[]>(["todo-lists"], (old) =>
        old?.filter((l) => l.id !== id) ?? []
      );
      if (activeListId === id) {
        const remaining = sortedLists.filter((l) => l.id !== id);
        setActiveListId(remaining.length > 0 ? remaining[0].id : null);
      }
      return { prev };
    },
    onError: (_err, _id, context) => {
      if (context?.prev) queryClient.setQueryData(["todo-lists"], context.prev);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["todo-lists"] }),
  });

  const addItemMut = useMutation({
    mutationFn: ({ text, parentId, sortOrder }: { text: string; parentId?: string; sortOrder: number }) =>
      createTodoItem({
        list_id: activeListId!,
        text,
        sort_order: sortOrder,
        ...(parentId ? { parent_id: parentId } : {}),
      }),
    onMutate: async ({ text, parentId, sortOrder }) => {
      await queryClient.cancelQueries({ queryKey: ["todo-lists"] });
      const prev = queryClient.getQueryData<TodoListWithItems[]>(["todo-lists"]);
      const optimisticItem: TodoItem = {
        id: `temp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        list_id: activeListId!,
        text,
        status: "todo",
        sort_order: sortOrder,
        parent_id: parentId ?? null,
        created_at: new Date().toISOString(),
      };
      queryClient.setQueryData<TodoListWithItems[]>(["todo-lists"], (old) =>
        old?.map((l) =>
          l.id === activeListId ? { ...l, items: [...l.items, optimisticItem] } : l
        ) ?? []
      );
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(["todo-lists"], context.prev);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["todo-lists"] }),
  });

  const updateItemMut = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Parameters<typeof updateTodoItem>[1] }) =>
      updateTodoItem(id, updates),
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: ["todo-lists"] });
      const prev = queryClient.getQueryData<TodoListWithItems[]>(["todo-lists"]);
      queryClient.setQueryData<TodoListWithItems[]>(["todo-lists"], (old) =>
        old?.map((l) => ({
          ...l,
          items: l.items.map((i) => (i.id === id ? { ...i, ...updates } : i)),
        })) ?? []
      );
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(["todo-lists"], context.prev);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["todo-lists"] }),
  });

  const deleteItemMut = useMutation({
    mutationFn: (id: string) => deleteTodoItem(id),
    onMutate: async (id: string) => {
      // Optimistic: remove item AND its subtasks from cache immediately
      await queryClient.cancelQueries({ queryKey: ["todo-lists"] });
      const prev = queryClient.getQueryData<TodoListWithItems[]>(["todo-lists"]);
      queryClient.setQueryData<TodoListWithItems[]>(["todo-lists"], (old) =>
        old?.map((l) => ({
          ...l,
          items: l.items.filter((i) => i.id !== id && i.parent_id !== id),
        })) ?? []
      );
      return { prev };
    },
    onError: (_err, _id, context) => {
      if (context?.prev) queryClient.setQueryData(["todo-lists"], context.prev);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["todo-lists"] }),
  });

  const moveItemMut = useMutation({
    mutationFn: async ({ itemId, targetListId, childIds }: { itemId: string; targetListId: string; childIds: string[] }) => {
      await updateTodoItem(itemId, { list_id: targetListId });
      await Promise.all(childIds.map((cid) => updateTodoItem(cid, { list_id: targetListId })));
    },
    onMutate: async ({ itemId, targetListId, childIds }) => {
      await queryClient.cancelQueries({ queryKey: ["todo-lists"] });
      const prev = queryClient.getQueryData<TodoListWithItems[]>(["todo-lists"]);
      const movingIds = new Set([itemId, ...childIds]);
      queryClient.setQueryData<TodoListWithItems[]>(["todo-lists"], (old) => {
        if (!old) return [];
        const moving: TodoItem[] = [];
        for (const l of old) {
          for (const i of l.items) {
            if (movingIds.has(i.id)) moving.push({ ...i, list_id: targetListId });
          }
        }
        return old.map((l) => {
          const kept = l.items.filter((i) => !movingIds.has(i.id));
          return l.id === targetListId
            ? { ...l, items: [...kept, ...moving] }
            : { ...l, items: kept };
        });
      });
      // Follow the item to its new list, like the desktop app
      setActiveListId(targetListId);
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(["todo-lists"], context.prev);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["todo-lists"] }),
  });

  const reorderMut = useMutation({
    mutationFn: (updates: { id: string; sort_order: number }[]) =>
      reorderTodoItems(updates.filter((u) => !u.id.startsWith("temp-"))),
    onMutate: async (updates) => {
      await queryClient.cancelQueries({ queryKey: ["todo-lists"] });
      const prev = queryClient.getQueryData<TodoListWithItems[]>(["todo-lists"]);
      const orderById = new Map(updates.map((u) => [u.id, u.sort_order]));
      queryClient.setQueryData<TodoListWithItems[]>(["todo-lists"], (old) =>
        old?.map((l) => ({
          ...l,
          items: l.items.map((i) =>
            orderById.has(i.id) ? { ...i, sort_order: orderById.get(i.id)! } : i
          ),
        })) ?? []
      );
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(["todo-lists"], context.prev);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["todo-lists"] }),
  });

  const reorderListsMut = useMutation({
    mutationFn: (updates: { id: string; sort_order: number }[]) =>
      reorderTodoLists(updates.filter((u) => !u.id.startsWith("temp-"))),
    onMutate: async (updates) => {
      await queryClient.cancelQueries({ queryKey: ["todo-lists"] });
      const prev = queryClient.getQueryData<TodoListWithItems[]>(["todo-lists"]);
      const orderById = new Map(updates.map((u) => [u.id, u.sort_order]));
      queryClient.setQueryData<TodoListWithItems[]>(["todo-lists"], (old) =>
        old?.map((l) =>
          orderById.has(l.id) ? { ...l, sort_order: orderById.get(l.id)! } : l
        ) ?? []
      );
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(["todo-lists"], context.prev);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["todo-lists"] }),
  });

  // --- Status changes with done-sort delay + cascades ---

  const markRecentlyDone = useCallback((id: string) => {
    setRecentlyDone((prevSet) => new Set(prevSet).add(id));
    setTimeout(() => {
      setRecentlyDone((prevSet) => {
        const next = new Set(prevSet);
        next.delete(id);
        return next;
      });
    }, DONE_SORT_DELAY_MS);
  }, []);

  const setItemStatus = useCallback(
    (item: TodoItem, status: TodoItem["status"]) => {
      if (status === "done" && item.status !== "done") markRecentlyDone(item.id);
      updateItemMut.mutate({ id: item.id, updates: { status } });
    },
    [markRecentlyDone, updateItemMut]
  );

  const handleCheckboxClick = useCallback(
    (item: TodoItem) => {
      const nextStatus = item.status === "done" ? "todo" : "done";
      setItemStatus(item, nextStatus);
      if (!activeList) return;
      if (!item.parent_id && nextStatus === "done") {
        // Cascade: completing a parent completes all its subtasks
        activeList.items
          .filter((i) => i.parent_id === item.id && i.status !== "done")
          .forEach((sub) => setItemStatus(sub, "done"));
      } else if (item.parent_id && nextStatus === "done") {
        // Auto-complete the parent when every sibling is done
        const siblings = activeList.items.filter(
          (i) => i.parent_id === item.parent_id && i.id !== item.id
        );
        const parent = activeList.items.find((i) => i.id === item.parent_id);
        if (parent && parent.status !== "done" && siblings.every((s) => s.status === "done")) {
          setItemStatus(parent, "done");
        }
      }
    },
    [activeList, setItemStatus]
  );

  const handleCheckboxContext = useCallback(
    (e: React.MouseEvent, item: TodoItem) => {
      e.preventDefault();
      const nextStatus = item.status === "inflight" ? "todo" : "inflight";
      setItemStatus(item, nextStatus);
    },
    [setItemStatus]
  );

  const handlePointerDown = useCallback(
    (item: TodoItem) => {
      longPressTimer.current = setTimeout(() => {
        const nextStatus = item.status === "inflight" ? "todo" : "inflight";
        setItemStatus(item, nextStatus);
        longPressTimer.current = null;
      }, 500);
    },
    [setItemStatus]
  );

  const handlePointerUp = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  // --- Other handlers ---

  const addTaskLines = useCallback(
    (text: string) => {
      if (!activeList) return;
      const lines = splitTaskLines(text);
      const base = activeList.items.length;
      lines.forEach((line, i) => addItemMut.mutate({ text: line, sortOrder: base + i }));
    },
    [activeList, addItemMut]
  );

  const handleAddItems = useCallback(() => {
    if (!newInput.trim() || !activeListId) return;
    addTaskLines(newInput);
    setNewInput("");
    inputRef.current?.focus();
  }, [newInput, activeListId, addTaskLines]);

  const handleClearDone = useCallback(() => {
    if (!activeList) return;
    // Only top-level done items — their subtasks are removed with them
    const doneItems = activeList.items.filter((i) => i.status === "done" && !i.parent_id);
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
    if (editingItemId) {
      const trimmed = editingItemText.trim();
      if (trimmed) {
        updateItemMut.mutate({ id: editingItemId, updates: { text: trimmed } });
      } else {
        // Editing an item down to nothing deletes it, like the desktop app
        deleteItemMut.mutate(editingItemId);
      }
    }
    setEditingItemId(null);
  }, [editingItemId, editingItemText, updateItemMut, deleteItemMut]);

  const commitSubtask = useCallback(
    (parentId: string, keepOpen: boolean) => {
      const trimmed = subtaskText.trim();
      if (trimmed && activeList) {
        addItemMut.mutate({ text: trimmed, parentId, sortOrder: activeList.items.length });
      }
      setSubtaskText("");
      if (!keepOpen) setAddingSubtaskFor(null);
    },
    [subtaskText, activeList, addItemMut]
  );

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

  // --- Keyboard shortcuts (Cmd/Ctrl+N focus input, +T new list, +1..9 switch list) ---

  const shortcutCtx = useRef<{
    sortedLists: TodoListWithItems[];
    setActiveListId: (id: string | null) => void;
    addList: () => void;
  }>({ sortedLists, setActiveListId, addList: () => {} });
  shortcutCtx.current = {
    sortedLists,
    setActiveListId,
    addList: () => addListMut.mutate(),
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return;
      if (e.key === "n") {
        e.preventDefault();
        inputRef.current?.focus();
      } else if (e.key === "t") {
        e.preventDefault();
        shortcutCtx.current.addList();
      } else if (e.key >= "1" && e.key <= "9") {
        const idx = parseInt(e.key, 10) - 1;
        const lists = shortcutCtx.current.sortedLists;
        if (idx < lists.length) {
          e.preventDefault();
          shortcutCtx.current.setActiveListId(lists[idx].id);
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // --- Drag: reorder within a list + move to another list via its tab ---
  // Pointer-events based so it works with both touch (long-press) and mouse (press-and-move).

  const [dragItemId, setDragItemId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ itemId: string; after: boolean } | null>(null);
  const [dragOverTabId, setDragOverTabId] = useState<string | null>(null);
  const dropTargetRef = useRef<{ itemId: string; after: boolean } | null>(null);
  const dragOverTabRef = useRef<string | null>(null);
  const tabDwellTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const itemsScrollRef = useRef<HTMLDivElement>(null);
  // Fresh data for handlers that outlive the render they were created in
  const dragCtx = useRef({ allLists, sortedLists, activeListId, recentlyDone });
  dragCtx.current = { allLists, sortedLists, activeListId, recentlyDone };
  const dragGesture = useRef<{
    pointerId: number;
    itemId: string;
    text: string;
    pointerType: string;
    startX: number;
    startY: number;
    active: boolean;
  } | null>(null);

  const setDropTargetBoth = (v: { itemId: string; after: boolean } | null) => {
    const cur = dropTargetRef.current;
    if (cur?.itemId === v?.itemId && cur?.after === v?.after) return;
    dropTargetRef.current = v;
    setDropTarget(v);
  };
  const setDragOverTabBoth = (v: string | null) => {
    if (dragOverTabRef.current === v) return;
    dragOverTabRef.current = v;
    setDragOverTabId(v);
    if (tabDwellTimer.current) {
      clearTimeout(tabDwellTimer.current);
      tabDwellTimer.current = null;
    }
    // Hovering a different list's tab for a moment switches the view to it
    if (v && v !== dragCtx.current.activeListId) {
      tabDwellTimer.current = setTimeout(() => {
        setActiveListId(v);
      }, TAB_DWELL_MS);
    }
  };

  const preventTouchScroll = useCallback((ev: TouchEvent) => ev.preventDefault(), []);

  const endDragCleanup = useCallback(() => {
    dragGesture.current = null;
    setDragItemId(null);
    setDropTargetBoth(null);
    setDragOverTabBoth(null);
    if (tabDwellTimer.current) {
      clearTimeout(tabDwellTimer.current);
      tabDwellTimer.current = null;
    }
    if (ghostRef.current) ghostRef.current.style.display = "none";
    document.removeEventListener("touchmove", preventTouchScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => endDragCleanup, [endDragCleanup]); // clean up if unmounted mid-drag

  const handleRowPointerDown = (e: React.PointerEvent, item: TodoItem) => {
    if (item.parent_id) return; // only top-level items are draggable, like the desktop app
    if (e.button !== 0 && e.pointerType === "mouse") return;
    const target = e.target as HTMLElement;
    if (target.closest("button, input")) return; // don't hijack checkbox/delete/edit taps
    if (editingItemId) return;

    const gesture = {
      pointerId: e.pointerId,
      itemId: item.id,
      text: item.text,
      pointerType: e.pointerType,
      startX: e.clientX,
      startY: e.clientY,
      active: false,
    };
    dragGesture.current = gesture;

    const activate = (x: number, y: number) => {
      if (!dragGesture.current || dragGesture.current.active) return;
      dragGesture.current.active = true;
      setDragItemId(gesture.itemId);
      if (gesture.pointerType !== "mouse") {
        document.addEventListener("touchmove", preventTouchScroll, { passive: false });
        navigator.vibrate?.(10);
      }
      const ghost = ghostRef.current;
      if (ghost) {
        ghost.textContent = gesture.text;
        ghost.style.display = "block";
        ghost.style.transform = `translate(${x + 14}px, ${y + 14}px)`;
      }
    };

    let longPressDragTimer: ReturnType<typeof setTimeout> | null = null;
    if (e.pointerType !== "mouse") {
      longPressDragTimer = setTimeout(() => activate(gesture.startX, gesture.startY), DRAG_LONG_PRESS_MS);
    }

    const finish = (ev: PointerEvent, dropped: boolean) => {
      if (longPressDragTimer) clearTimeout(longPressDragTimer);
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onCancel);
      const g = dragGesture.current;
      const dropTab = dragOverTabRef.current;
      const dropTgt = dropTargetRef.current;
      endDragCleanup();
      if (!g?.active || !dropped) return;

      const { allLists: listsNow, activeListId: activeNow, recentlyDone: recentNow } = dragCtx.current;
      let sourceList: TodoListWithItems | undefined;
      let draggedItem: TodoItem | undefined;
      for (const l of listsNow) {
        const found = l.items.find((i) => i.id === g.itemId);
        if (found) { sourceList = l; draggedItem = found; break; }
      }
      if (!sourceList || !draggedItem || draggedItem.id.startsWith("temp-")) return;
      const childIds = sourceList.items
        .filter((i) => i.parent_id === draggedItem!.id)
        .map((i) => i.id);

      // 1) Dropped on another list's tab → move it (and its subtasks) there
      if (dropTab && dropTab !== draggedItem.list_id && !dropTab.startsWith("temp-")) {
        moveItemMut.mutate({ itemId: draggedItem.id, targetListId: dropTab, childIds });
        return;
      }
      // 2) The view switched lists mid-drag (tab dwell) and the drop landed in the
      //    list area → move the item into the now-active list
      if (activeNow && draggedItem.list_id !== activeNow) {
        const el = document.elementFromPoint(ev.clientX, ev.clientY);
        if (el && itemsScrollRef.current?.contains(el) && !activeNow.startsWith("temp-")) {
          moveItemMut.mutate({ itemId: draggedItem.id, targetListId: activeNow, childIds });
        }
        return;
      }
      // 3) Reorder within the current list
      if (dropTgt && dropTgt.itemId !== draggedItem.id) {
        const top = sortItems(
          sourceList.items.filter((i) => !i.parent_id),
          recentNow
        ).filter((i) => i.id !== draggedItem!.id);
        let insertIdx = top.findIndex((i) => i.id === dropTgt.itemId);
        if (insertIdx === -1) return;
        if (dropTgt.after) insertIdx += 1;
        top.splice(insertIdx, 0, draggedItem);
        reorderMut.mutate(top.map((it, idx) => ({ id: it.id, sort_order: idx })));
      }
    };

    const onMove = (ev: PointerEvent) => {
      const g = dragGesture.current;
      if (!g || ev.pointerId !== g.pointerId) return;
      const dx = ev.clientX - g.startX;
      const dy = ev.clientY - g.startY;
      if (!g.active) {
        const dist = Math.hypot(dx, dy);
        if (g.pointerType === "mouse") {
          if (dist > 5) activate(ev.clientX, ev.clientY);
        } else if (dist > 12) {
          // Finger is scrolling — give the gesture back to the browser
          finish(ev, false);
          return;
        }
        if (!g.active) return;
      }

      const ghost = ghostRef.current;
      if (ghost) ghost.style.transform = `translate(${ev.clientX + 14}px, ${ev.clientY + 14}px)`;

      const el = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null;
      const tabEl = el?.closest?.("[data-tab-id]") as HTMLElement | null;
      if (tabEl) {
        setDropTargetBoth(null);
        setDragOverTabBoth(tabEl.dataset.tabId ?? null);
      } else {
        setDragOverTabBoth(null);
        const rowEl = el?.closest?.('[data-item-id][data-top="1"]') as HTMLElement | null;
        if (rowEl && rowEl.dataset.itemId !== g.itemId) {
          const rect = rowEl.getBoundingClientRect();
          setDropTargetBoth({
            itemId: rowEl.dataset.itemId!,
            after: ev.clientY > rect.top + rect.height / 2,
          });
        } else {
          setDropTargetBoth(null);
        }
      }

      // Auto-scroll the list when dragging near its edges
      const scroller = itemsScrollRef.current;
      if (scroller) {
        const rect = scroller.getBoundingClientRect();
        if (ev.clientY < rect.top + 56) scroller.scrollTop -= 10;
        else if (ev.clientY > rect.bottom - 56) scroller.scrollTop += 10;
      }
    };

    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== gesture.pointerId) return;
      finish(ev, true);
    };
    const onCancel = (ev: PointerEvent) => {
      if (ev.pointerId !== gesture.pointerId) return;
      finish(ev, false);
    };

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onCancel);
  };

  // --- Drag: reorder the list tabs themselves ---
  // Same gesture model as items: long-press on touch, press-and-move on mouse.

  const [dragListId, setDragListId] = useState<string | null>(null);
  const [tabDropTarget, setTabDropTarget] = useState<{ listId: string; after: boolean } | null>(null);
  const tabDropTargetRef = useRef<{ listId: string; after: boolean } | null>(null);
  const tabsScrollRef = useRef<HTMLDivElement>(null);
  // A completed tab drag must not fire the tab's onClick (which would switch lists)
  const suppressTabClick = useRef(false);
  const tabDragGesture = useRef<{
    pointerId: number;
    listId: string;
    name: string;
    pointerType: string;
    startX: number;
    startY: number;
    active: boolean;
  } | null>(null);

  const setTabDropTargetBoth = (v: { listId: string; after: boolean } | null) => {
    const cur = tabDropTargetRef.current;
    if (cur?.listId === v?.listId && cur?.after === v?.after) return;
    tabDropTargetRef.current = v;
    setTabDropTarget(v);
  };

  const endTabDragCleanup = useCallback(() => {
    tabDragGesture.current = null;
    setDragListId(null);
    setTabDropTargetBoth(null);
    if (ghostRef.current) ghostRef.current.style.display = "none";
    document.removeEventListener("touchmove", preventTouchScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => endTabDragCleanup, [endTabDragCleanup]); // clean up if unmounted mid-drag

  const handleTabPointerDown = (e: React.PointerEvent, list: TodoListWithItems) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    if (renamingListId === list.id) return;
    const target = e.target as HTMLElement;
    if (target.closest("button, input")) return; // don't hijack delete/rename taps

    const gesture = {
      pointerId: e.pointerId,
      listId: list.id,
      name: list.name,
      pointerType: e.pointerType,
      startX: e.clientX,
      startY: e.clientY,
      active: false,
    };
    tabDragGesture.current = gesture;

    const activate = (x: number, y: number) => {
      if (!tabDragGesture.current || tabDragGesture.current.active) return;
      tabDragGesture.current.active = true;
      setDragListId(gesture.listId);
      if (gesture.pointerType !== "mouse") {
        document.addEventListener("touchmove", preventTouchScroll, { passive: false });
        navigator.vibrate?.(10);
      }
      const ghost = ghostRef.current;
      if (ghost) {
        ghost.textContent = gesture.name;
        ghost.style.display = "block";
        ghost.style.transform = `translate(${x + 14}px, ${y + 14}px)`;
      }
    };

    let longPressDragTimer: ReturnType<typeof setTimeout> | null = null;
    if (e.pointerType !== "mouse") {
      longPressDragTimer = setTimeout(() => activate(gesture.startX, gesture.startY), DRAG_LONG_PRESS_MS);
    }

    const finish = (dropped: boolean) => {
      if (longPressDragTimer) clearTimeout(longPressDragTimer);
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onCancel);
      const g = tabDragGesture.current;
      const dropTgt = tabDropTargetRef.current;
      endTabDragCleanup();
      if (!g?.active) return;
      // The click event fires synchronously right after pointerup, then the flag clears
      suppressTabClick.current = true;
      setTimeout(() => { suppressTabClick.current = false; }, 0);
      if (!dropped || !dropTgt || dropTgt.listId === g.listId) return;

      const { sortedLists: listsNow } = dragCtx.current;
      const src = listsNow.find((l) => l.id === g.listId);
      if (!src || src.id.startsWith("temp-")) return;
      const without = listsNow.filter((l) => l.id !== g.listId);
      let insertIdx = without.findIndex((l) => l.id === dropTgt.listId);
      if (insertIdx === -1) return;
      if (dropTgt.after) insertIdx += 1;
      without.splice(insertIdx, 0, src);
      reorderListsMut.mutate(without.map((l, idx) => ({ id: l.id, sort_order: idx })));
    };

    const onMove = (ev: PointerEvent) => {
      const g = tabDragGesture.current;
      if (!g || ev.pointerId !== g.pointerId) return;
      const dx = ev.clientX - g.startX;
      const dy = ev.clientY - g.startY;
      if (!g.active) {
        const dist = Math.hypot(dx, dy);
        if (g.pointerType === "mouse") {
          if (dist > 5) activate(ev.clientX, ev.clientY);
        } else if (dist > 12) {
          // Finger is scrolling the tab bar — give the gesture back to the browser
          finish(false);
          return;
        }
        if (!g.active) return;
      }

      const ghost = ghostRef.current;
      if (ghost) ghost.style.transform = `translate(${ev.clientX + 14}px, ${ev.clientY + 14}px)`;

      const el = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null;
      const tabEl = el?.closest?.("[data-tab-id]") as HTMLElement | null;
      if (tabEl && tabEl.dataset.tabId !== g.listId) {
        const rect = tabEl.getBoundingClientRect();
        setTabDropTargetBoth({
          listId: tabEl.dataset.tabId!,
          after: ev.clientX > rect.left + rect.width / 2,
        });
      } else {
        setTabDropTargetBoth(null);
      }

      // Auto-scroll the tab bar when dragging near its edges
      const scroller = tabsScrollRef.current;
      if (scroller) {
        const rect = scroller.getBoundingClientRect();
        if (ev.clientX < rect.left + 48) scroller.scrollLeft -= 10;
        else if (ev.clientX > rect.right - 48) scroller.scrollLeft += 10;
      }
    };

    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== gesture.pointerId) return;
      finish(true);
    };
    const onCancel = (ev: PointerEvent) => {
      if (ev.pointerId !== gesture.pointerId) return;
      finish(false);
    };

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onCancel);
  };

  // --- Render ---

  if (isLoading) {
    return (
      <div className="todo-page">
        <style>{styles}</style>
        <div className="todo-loading">Loading lists...</div>
      </div>
    );
  }

  const renderRow = (item: TodoItem, isSub: boolean) => {
    const subs = isSub ? [] : subsByParent[item.id] ?? [];
    const doneSubs = subs.filter((s) => s.status === "done").length;
    const isDropBefore = dropTarget?.itemId === item.id && !dropTarget.after;
    const isDropAfter = dropTarget?.itemId === item.id && dropTarget.after;
    return (
      <div
        key={item.id}
        data-item-id={item.id}
        data-top={isSub ? undefined : "1"}
        className={[
          "todo-item",
          `todo-item--${item.status}`,
          isSub ? "todo-subtask-row" : "",
          dragItemId === item.id ? "dragging" : "",
          isDropBefore ? "drop-before" : "",
          isDropAfter ? "drop-after" : "",
          recentlyDone.has(item.id) ? "completing" : "",
        ].filter(Boolean).join(" ")}
        onMouseEnter={() => setHoveredItemId(item.id)}
        onMouseLeave={() => setHoveredItemId(null)}
        onPointerDown={isSub ? undefined : (e) => handleRowPointerDown(e, item)}
        onContextMenu={(e) => {
          // Android long-press fires contextmenu — suppress it while a drag is armed
          if (dragGesture.current) e.preventDefault();
        }}
      >
        {isSub && <span className="todo-subtask-indent" />}
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

        {!isSub && subs.length > 0 && (
          <span className="todo-subtask-badge" title={`${doneSubs} of ${subs.length} subtasks done`}>
            {doneSubs}/{subs.length}
          </span>
        )}

        {!isSub && (
          <button
            className={`todo-item-addsub ${hoveredItemId === item.id ? "visible" : ""}`}
            onClick={() => {
              setSubtaskText("");
              setAddingSubtaskFor(addingSubtaskFor === item.id ? null : item.id);
            }}
            title="Add subtask"
          >
            +
          </button>
        )}

        <button
          className={`todo-item-delete ${hoveredItemId === item.id ? "visible" : ""}`}
          onClick={() => deleteItemMut.mutate(item.id)}
          title="Delete task"
        >
          &times;
        </button>
      </div>
    );
  };

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
        <div className="todo-tabs-scroll" ref={tabsScrollRef}>
          {sortedLists.map((list) => {
            const color = NEON_COLORS[list.color_index % NEON_COLORS.length];
            const isActive = list.id === activeListId;
            const shared = isSharedList(list);
            return (
              <div
                key={list.id}
                data-tab-id={list.id}
                className={[
                  "todo-tab",
                  isActive ? "active" : "",
                  shared ? "todo-tab--shared" : "",
                  dragOverTabId === list.id && !isActive ? "drag-target" : "",
                  dragListId === list.id ? "dragging" : "",
                  tabDropTarget?.listId === list.id && !tabDropTarget.after ? "tab-drop-before" : "",
                  tabDropTarget?.listId === list.id && tabDropTarget.after ? "tab-drop-after" : "",
                ].filter(Boolean).join(" ")}
                style={{ "--tab-color": color } as React.CSSProperties}
                onClick={() => {
                  if (suppressTabClick.current) return;
                  setActiveListId(list.id);
                }}
                onPointerDown={(e) => handleTabPointerDown(e, list)}
                onContextMenu={(e) => {
                  // Android long-press fires contextmenu — suppress it while a drag is armed
                  if (tabDragGesture.current) e.preventDefault();
                }}
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
                <span className="todo-tab-count">
                  {list.items.filter((i) => !i.parent_id).length}
                </span>
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
          {sortedTopLevel.length === 0 ? (
            <div className="todo-empty">
              <div>No tasks yet</div>
              <div className="todo-empty-hint">Type below and hit Enter</div>
            </div>
          ) : (
            <div className="todo-items" ref={itemsScrollRef}>
              {sortedTopLevel.map((item) => (
                <Fragment key={item.id}>
                  {renderRow(item, false)}
                  {(subsByParent[item.id] ?? []).map((sub) => renderRow(sub, true))}
                  {addingSubtaskFor === item.id && (
                    <div className="todo-item todo-subtask-row todo-subtask-add-row">
                      <span className="todo-subtask-indent" />
                      <span className="todo-subtask-dot">&#9702;</span>
                      <input
                        ref={subInputRef}
                        className="todo-subtask-input"
                        placeholder="New subtask&hellip;"
                        value={subtaskText}
                        onChange={(e) => setSubtaskText(e.target.value)}
                        onBlur={() => commitSubtask(item.id, false)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            commitSubtask(item.id, true);
                          }
                          if (e.key === "Escape") {
                            setSubtaskText("");
                            setAddingSubtaskFor(null);
                          }
                        }}
                      />
                    </div>
                  )}
                </Fragment>
              ))}
            </div>
          )}

          {/* Status bar */}
          <div className="todo-status">
            <span className="todo-status-counts">
              {todoCt} to do &middot; {inflightCt} in flight &middot; {doneCt} done
            </span>
            {doneTopLevelCt > 0 && (
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
              enterKeyHint="done"
              onChange={(e) => setNewInput(e.target.value)}
              onBlur={() => {
                if (newInput.trim()) handleAddItems();
              }}
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
                  const el = e.currentTarget;
                  const prefix = newInput.slice(0, el.selectionStart ?? newInput.length);
                  const suffix = newInput.slice(el.selectionEnd ?? newInput.length);
                  addTaskLines(prefix + pasted + suffix);
                  setNewInput("");
                }
              }}
            />
          </div>
        </div>
      ) : (
        <div className="todo-empty">
          <div>{sortedLists.length === 0 ? "No lists yet" : "Select a list"}</div>
          <div className="todo-empty-hint">
            {sortedLists.length === 0 ? 'Hit "+" to create one' : "Tap a tab above"}
          </div>
        </div>
      )}

      {/* Floating label that follows the pointer while dragging */}
      <div ref={ghostRef} className="todo-drag-ghost" />
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
  background: color-mix(in srgb, var(--todo-accent) 4%, var(--bg));
  color: var(--text);
  --todo-accent: #00e5ff;
}

.todo-loading,
.todo-empty {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: center;
  justify-content: center;
  flex: 1;
  color: var(--text-dim);
  font-size: 14px;
}

.todo-empty-hint {
  font-size: 12px;
  opacity: 0.6;
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

.todo-tab.drag-target {
  animation: todo-tab-drag-pulse 0.5s ease infinite alternate;
  border-color: var(--tab-color);
}

.todo-tab.dragging {
  opacity: 0.35;
}
.todo-tab.tab-drop-before::before,
.todo-tab.tab-drop-after::after {
  content: "";
  position: absolute;
  top: 15%;
  height: 70%;
  width: 3px;
  border-radius: 2px;
  background: var(--tab-color, var(--accent));
  box-shadow: 0 0 6px var(--tab-color, var(--accent));
}
.todo-tab.tab-drop-before::before { left: -5px; }
.todo-tab.tab-drop-after::after { right: -5px; }
@keyframes todo-tab-drag-pulse {
  from { box-shadow: 0 0 6px color-mix(in srgb, var(--tab-color) 35%, transparent); }
  to   { box-shadow: 0 0 18px color-mix(in srgb, var(--tab-color) 60%, transparent); }
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
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  touch-action: pan-y;
}
.todo-item:hover {
  background: var(--surface2);
}

/* Drag states */
.todo-item.dragging {
  opacity: 0.35;
}
.todo-item.drop-before {
  box-shadow: 0 -2px 0 var(--todo-accent);
}
.todo-item.drop-after {
  box-shadow: 0 2px 0 var(--todo-accent);
}

.todo-drag-ghost {
  position: fixed;
  top: 0;
  left: 0;
  display: none;
  z-index: 1000;
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  background: var(--surface2);
  border: 1px solid var(--todo-accent);
  color: var(--text);
  border-radius: 8px;
  padding: 6px 12px;
  font-size: 13px;
  pointer-events: none;
  box-shadow: 0 8px 24px rgba(0,0,0,0.4);
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

/* Completion pop — plays while the item holds its spot before sorting down */
@keyframes todo-check-pop {
  0%   { transform: scale(1); }
  40%  { transform: scale(1.35); }
  70%  { transform: scale(0.88); }
  100% { transform: scale(1); }
}
.todo-item.completing .todo-checkbox {
  animation: todo-check-pop 0.35s ease forwards;
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
  min-width: 0;
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

.todo-item-addsub {
  background: none;
  border: 1px solid transparent;
  border-radius: 50%;
  color: var(--text-dim);
  font-size: 16px;
  cursor: pointer;
  padding: 0 5px;
  line-height: 1.2;
  opacity: 0;
  transition: opacity 0.1s, color 0.1s;
  flex-shrink: 0;
}
.todo-item-addsub.visible {
  opacity: 0.5;
}
.todo-item-addsub:hover {
  opacity: 1;
  color: var(--todo-accent);
  border-color: var(--todo-accent);
}

/* ---- Subtasks ---- */
.todo-subtask-row {
  padding-left: 28px;
  padding-top: 5px;
  padding-bottom: 5px;
  min-height: 34px;
}

.todo-subtask-indent {
  display: inline-block;
  width: 16px;
  height: 22px;
  border-left: 2px solid var(--border);
  border-bottom: 2px solid var(--border);
  border-bottom-left-radius: 4px;
  flex-shrink: 0;
  align-self: center;
  margin-bottom: 8px;
}

.todo-subtask-row .todo-checkbox {
  width: 17px;
  height: 17px;
  border-radius: 5px;
}
.todo-subtask-row .todo-checkbox svg {
  width: 11px;
  height: 11px;
}

.todo-subtask-row .todo-item-text {
  font-size: 13px;
}

.todo-subtask-badge {
  font-size: 10px;
  color: var(--text-dim);
  background: rgba(255,255,255,0.06);
  padding: 1px 6px;
  border-radius: 8px;
  flex-shrink: 0;
  white-space: nowrap;
}

.todo-subtask-dot {
  color: var(--text-dim);
  font-size: 16px;
  flex-shrink: 0;
  line-height: 1;
}

.todo-subtask-input {
  flex: 1;
  background: var(--surface);
  border: 1px solid var(--todo-accent);
  border-radius: 6px;
  color: var(--text);
  font-size: 14px;
  padding: 3px 8px;
  outline: none;
  min-width: 0;
}
.todo-subtask-input::placeholder {
  color: var(--text-dim);
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
  .todo-subtask-row {
    padding-left: 22px;
    min-height: 40px;
  }
  .todo-subtask-row .todo-checkbox {
    width: 22px;
    height: 22px;
  }
  .todo-subtask-row .todo-item-text {
    font-size: 14px;
  }
  .todo-subtask-input {
    font-size: 16px;
  }
  /* Always show row actions on touch — no hover */
  .todo-item-delete {
    display: flex;
    opacity: 0.4;
  }
  .todo-item-addsub {
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
