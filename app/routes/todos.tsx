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

function isListVisibleTo(list: TodoListWithItems, user: Identity): boolean {
  if (!list.owner) return true;
  return list.owner === user;
}

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
    refetchInterval: realtimeHealthy ? false : 10000,
  });

  const lists = allLists.filter((l) => isListVisibleTo(l, currentUser));

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
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setRealtimeHealthy(true);
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') setRealtimeHealthy(false);
      });
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  // --- Active list state ---
  const activeListKey = getActiveListKey(currentUser);
  const [activeListId, setActiveListIdRaw] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(activeListKey);
  });

  // Track manual selections to prevent auto-select from overriding
  const userSelectedRef = useRef(false);

  const setActiveListId = useCallback((id: string | null) => {
    userSelectedRef.current = true;
    setActiveListIdRaw(id);
    if (id) localStorage.setItem(activeListKey, id);
    else localStorage.removeItem(activeListKey);
  }, [activeListKey]);

  // Auto-select first list only when selection becomes invalid AND user hasn't manually picked
  const visibleListIds = sortedLists.map(l => l.id).join(",");
  useEffect(() => {
    if (sortedLists.length === 0) return;
    if (activeListId && sortedLists.some((l) => l.id === activeListId)) return;
    // Only auto-select if user hasn't manually chosen something
    if (!userSelectedRef.current) {
      setActiveListId(sortedLists[0].id);
    } else {
      // User selected something that no longer exists — reset
      userSelectedRef.current = false;
      setActiveListId(sortedLists[0].id);
    }
  }, [visibleListIds]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- UI state ---
  const [newInput, setNewInput] = useState("");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemText, setEditingItemText] = useState("");
  const [renamingListId, setRenamingListId] = useState<string | null>(null);
  const [renamingListName, setRenamingListName] = useState("");
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const [addingSubtaskFor, setAddingSubtaskFor] = useState<string | null>(null);
  const [subtaskDraft, setSubtaskDraft] = useState("");

  // --- Drag state ---
  const [draggingItem, setDraggingItem] = useState<TodoItem | null>(null);
  const [ghostPos, setGhostPos] = useState({ x: 0, y: 0 });
  const [dragTargetTabId, setDragTargetTabId] = useState<string | null>(null);
  const dragActiveRef = useRef(false);
  const capturedItemRef = useRef<TodoItem | null>(null);
  const startPosRef = useRef({ x: 0, y: 0 });
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tabSwitchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const renameRef = useRef<HTMLInputElement>(null);
  const editRef = useRef<HTMLInputElement>(null);
  const subtaskRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renamingListId) renameRef.current?.focus();
  }, [renamingListId]);

  useEffect(() => {
    if (editingItemId) editRef.current?.focus();
  }, [editingItemId]);

  useEffect(() => {
    if (addingSubtaskFor) subtaskRef.current?.focus();
  }, [addingSubtaskFor]);

  const activeList = sortedLists.find((l) => l.id === activeListId) ?? null;
  const activeColor = activeList ? NEON_COLORS[activeList.color_index % NEON_COLORS.length] : NEON_COLORS[0];

  // Separate top-level items from subtasks
  const topLevelItems = activeList ? sortItems(activeList.items.filter(i => !i.parent_id)) : [];
  const subtasksOf = useCallback((parentId: string): TodoItem[] => {
    if (!activeList) return [];
    return sortItems(activeList.items.filter(i => i.parent_id === parentId));
  }, [activeList]);

  // Counts include subtasks
  const todoCt = activeList ? activeList.items.filter(i => i.status === "todo").length : 0;
  const inflightCt = activeList ? activeList.items.filter(i => i.status === "inflight").length : 0;
  const doneCt = activeList ? activeList.items.filter(i => i.status === "done").length : 0;

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
      setRenamingListId(tempId);
      setRenamingListName("New List");
      setNewListShared(false);
      return { prev, tempId };
    },
    onSuccess: (newList: { id: string; name: string }, _, context) => {
      if (context?.tempId) {
        if (activeListId === context.tempId) setActiveListId(newList.id);
        if (renamingListId === context.tempId) setRenamingListId(newList.id);
      }
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
    mutationFn: (params: { text: string; parentId?: string | null }) =>
      createTodoItem({
        list_id: activeListId!,
        text: params.text,
        sort_order: activeList ? activeList.items.length : 0,
        parent_id: params.parentId ?? null,
      }),
    onMutate: async ({ text, parentId }) => {
      await queryClient.cancelQueries({ queryKey: ["todo-lists"] });
      const prev = queryClient.getQueryData<TodoListWithItems[]>(["todo-lists"]);
      const optimisticItem: TodoItem = {
        id: `temp-${Date.now()}`,
        list_id: activeListId!,
        text,
        status: "todo",
        sort_order: activeList ? activeList.items.length : 0,
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
    onError: (_err, _text, context) => {
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
      await queryClient.cancelQueries({ queryKey: ["todo-lists"] });
      const prev = queryClient.getQueryData<TodoListWithItems[]>(["todo-lists"]);
      queryClient.setQueryData<TodoListWithItems[]>(["todo-lists"], (old) =>
        old?.map((l) => ({
          ...l,
          // Also remove subtasks of the deleted item
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

  // Move item to a different list
  const moveItemMut = useMutation({
    mutationFn: ({ itemId, newListId }: { itemId: string; newListId: string }) =>
      updateTodoItem(itemId, { list_id: newListId }),
    onMutate: async ({ itemId, newListId }) => {
      await queryClient.cancelQueries({ queryKey: ["todo-lists"] });
      const prev = queryClient.getQueryData<TodoListWithItems[]>(["todo-lists"]);
      const sourceList = allLists.find(l => l.items.some(i => i.id === itemId));
      const item = sourceList?.items.find(i => i.id === itemId);
      if (!item || !sourceList) return { prev };
      queryClient.setQueryData<TodoListWithItems[]>(["todo-lists"], (old) =>
        old?.map((l) => {
          if (l.id === sourceList.id) {
            return { ...l, items: l.items.filter(i => i.id !== itemId && i.parent_id !== itemId) };
          }
          if (l.id === newListId) {
            return { ...l, items: [...l.items, { ...item, list_id: newListId }] };
          }
          return l;
        }) ?? []
      );
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(["todo-lists"], context.prev);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["todo-lists"] }),
  });

  // --- Handlers ---

  const handleAddItems = useCallback(() => {
    if (!newInput.trim() || !activeListId) return;
    const lines = newInput.split("\n").map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      addItemMut.mutate({ text: line });
    }
    setNewInput("");
    inputRef.current?.focus();
  }, [newInput, activeListId, addItemMut]);

  const handleAddSubtask = useCallback(() => {
    if (!subtaskDraft.trim() || !addingSubtaskFor || !activeListId) return;
    addItemMut.mutate({ text: subtaskDraft.trim(), parentId: addingSubtaskFor });
    setSubtaskDraft("");
    setAddingSubtaskFor(null);
  }, [subtaskDraft, addingSubtaskFor, activeListId, addItemMut]);

  // Cascade checkbox: completing parent marks all subtasks done;
  // completing all subtasks auto-completes the parent.
  const handleCheckboxClick = useCallback(
    (item: TodoItem) => {
      const nextStatus = item.status === "done" ? "todo" : "done";
      updateItemMut.mutate({ id: item.id, updates: { status: nextStatus } });

      if (!item.parent_id) {
        // Parent: cascade to subtasks when marking done
        if (nextStatus === "done" && activeList) {
          const subs = activeList.items.filter(i => i.parent_id === item.id);
          for (const s of subs) {
            updateItemMut.mutate({ id: s.id, updates: { status: "done" } });
          }
        }
      } else {
        // Subtask: auto-complete parent if all siblings will be done
        if (nextStatus === "done" && activeList) {
          const siblings = activeList.items.filter(
            i => i.parent_id === item.parent_id && i.id !== item.id
          );
          if (siblings.every(s => s.status === "done")) {
            updateItemMut.mutate({ id: item.parent_id, updates: { status: "done" } });
          }
        }
      }
    },
    [updateItemMut, activeList]
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
    // Delete top-level done items (cascade in DB handles subtasks)
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

  // --- Drag handlers (cross-list) ---

  const handleItemPointerDown = useCallback((e: React.PointerEvent, item: TodoItem) => {
    if (item.parent_id) return; // Subtasks not draggable
    startPosRef.current = { x: e.clientX, y: e.clientY };
    capturedItemRef.current = item;

    longPressTimerRef.current = setTimeout(() => {
      dragActiveRef.current = true;
      setDraggingItem(item);
      setGhostPos({ x: e.clientX, y: e.clientY });
      // Prevent parent long-press timer from firing
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    }, 450);
  }, []);

  const handleItemPointerMove = useCallback((e: React.PointerEvent) => {
    if (!capturedItemRef.current) return;

    const dx = e.clientX - startPosRef.current.x;
    const dy = e.clientY - startPosRef.current.y;

    if (!dragActiveRef.current) {
      // Cancel long-press if user scrolls/moves before threshold
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
        capturedItemRef.current = null;
      }
      return;
    }

    e.preventDefault();
    setGhostPos({ x: e.clientX, y: e.clientY });

    // Find what tab (if any) is under the pointer
    const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    const tabEl = el?.closest('[data-tab-list-id]') as HTMLElement | null;
    const newTargetId = tabEl?.dataset.tabListId ?? null;

    setDragTargetTabId(prev => {
      if (newTargetId !== prev) {
        if (tabSwitchTimerRef.current) clearTimeout(tabSwitchTimerRef.current);
        if (newTargetId && newTargetId !== capturedItemRef.current?.list_id) {
          tabSwitchTimerRef.current = setTimeout(() => {
            setActiveListId(newTargetId!);
          }, 600);
        }
      }
      return newTargetId;
    });
  }, [setActiveListId]);

  const handleItemPointerUp = useCallback((e: React.PointerEvent) => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    if (tabSwitchTimerRef.current) clearTimeout(tabSwitchTimerRef.current);

    if (dragActiveRef.current && capturedItemRef.current) {
      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      const tabEl = el?.closest('[data-tab-list-id]') as HTMLElement | null;
      const targetListId = tabEl?.dataset.tabListId ?? null;

      if (targetListId && targetListId !== capturedItemRef.current.list_id) {
        moveItemMut.mutate({ itemId: capturedItemRef.current.id, newListId: targetListId });
      }
    }

    dragActiveRef.current = false;
    capturedItemRef.current = null;
    setDraggingItem(null);
    setDragTargetTabId(null);
  }, [moveItemMut]);

  // Clean up drag if pointer leaves the window
  useEffect(() => {
    const cleanup = () => {
      if (dragActiveRef.current) {
        dragActiveRef.current = false;
        capturedItemRef.current = null;
        setDraggingItem(null);
        setDragTargetTabId(null);
        if (tabSwitchTimerRef.current) clearTimeout(tabSwitchTimerRef.current);
      }
    };
    window.addEventListener('pointercancel', cleanup);
    return () => window.removeEventListener('pointercancel', cleanup);
  }, []);

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

      {/* Drag ghost */}
      {draggingItem && (
        <div
          className="todo-drag-ghost"
          style={{ left: ghostPos.x - 100, top: ghostPos.y - 20 }}
        >
          {draggingItem.text}
        </div>
      )}

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
            const isDragTarget = dragTargetTabId === list.id;
            return (
              <button
                key={list.id}
                type="button"
                data-tab-list-id={list.id}
                className={`todo-tab${isActive ? " active" : ""}${shared ? " todo-tab--shared" : ""}${isDragTarget ? " todo-tab--drag-target" : ""}`}
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
                <span className="todo-tab-count">{list.items.filter(i => !i.parent_id).length}</span>
                {hoveredTab === list.id && !isDragTarget && (
                  <button
                    className="todo-tab-delete"
                    onClick={(e) => handleDeleteList(e, list.id)}
                    title="Delete list"
                  >
                    &times;
                  </button>
                )}
              </button>
            );
          })}

          {/* New list button */}
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
          {topLevelItems.length === 0 ? (
            <div className="todo-empty">No tasks yet. Add one below.</div>
          ) : (
            <div className="todo-items">
              {topLevelItems.map((item) => {
                const subs = subtasksOf(item.id);
                const doneSubs = subs.filter(s => s.status === "done").length;
                return (
                  <div key={item.id}>
                    {/* Top-level item row */}
                    <div
                      className={`todo-item todo-item--${item.status}${draggingItem?.id === item.id ? " todo-item--dragging" : ""}`}
                      onMouseEnter={() => setHoveredItemId(item.id)}
                      onMouseLeave={() => setHoveredItemId(null)}
                      onPointerDown={(e) => handleItemPointerDown(e, item)}
                      onPointerMove={handleItemPointerMove}
                      onPointerUp={handleItemPointerUp}
                      style={{ touchAction: dragActiveRef.current ? "none" : "auto" }}
                    >
                      <button
                        className={`todo-checkbox todo-checkbox--${item.status}`}
                        onClick={() => handleCheckboxClick(item)}
                        onContextMenu={(e) => handleCheckboxContext(e, item)}
                        onPointerDown={(e) => { e.stopPropagation(); handlePointerDown(item); }}
                        onPointerUp={(e) => { e.stopPropagation(); handlePointerUp(); }}
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

                      {/* Subtask count badge */}
                      {subs.length > 0 && (
                        <span className="todo-subtask-badge" title={`${doneSubs}/${subs.length} subtasks done`}>
                          {doneSubs}/{subs.length}
                        </span>
                      )}

                      {/* Add subtask button */}
                      {(hoveredItemId === item.id || addingSubtaskFor === item.id) && item.status !== "done" && (
                        <button
                          className="todo-add-subtask-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setAddingSubtaskFor(item.id);
                            setSubtaskDraft("");
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

                    {/* Subtask rows */}
                    {subs.map((sub) => (
                      <div
                        key={sub.id}
                        className={`todo-item todo-item--subtask todo-item--${sub.status}`}
                        onMouseEnter={() => setHoveredItemId(sub.id)}
                        onMouseLeave={() => setHoveredItemId(null)}
                      >
                        <span className="todo-subtask-indent" />
                        <button
                          className={`todo-checkbox todo-checkbox--${sub.status}`}
                          onClick={() => handleCheckboxClick(sub)}
                          onContextMenu={(e) => handleCheckboxContext(e, sub)}
                          onPointerDown={() => handlePointerDown(sub)}
                          onPointerUp={handlePointerUp}
                          onPointerCancel={handlePointerUp}
                          title="Click: toggle done. Right-click/long-press: toggle in-flight"
                        >
                          {sub.status === "done" && (
                            <svg viewBox="0 0 16 16" width="12" height="12">
                              <path d="M3 8l3 3 7-7" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                          {sub.status === "inflight" && (
                            <svg viewBox="0 0 16 16" width="10" height="10">
                              <path d="M5 3l8 5-8 5V3z" fill="currentColor" />
                            </svg>
                          )}
                        </button>

                        {editingItemId === sub.id ? (
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
                              setEditingItemId(sub.id);
                              setEditingItemText(sub.text);
                            }}
                          >
                            {sub.text}
                          </span>
                        )}

                        <button
                          className={`todo-item-delete ${hoveredItemId === sub.id ? "visible" : ""}`}
                          onClick={() => deleteItemMut.mutate(sub.id)}
                          title="Delete subtask"
                        >
                          &times;
                        </button>
                      </div>
                    ))}

                    {/* Add subtask input row */}
                    {addingSubtaskFor === item.id && (
                      <div className="todo-item todo-item--subtask todo-item--add-subtask">
                        <span className="todo-subtask-indent" />
                        <span className="todo-subtask-new-dot">◦</span>
                        <input
                          ref={subtaskRef}
                          className="todo-item-edit todo-subtask-input"
                          placeholder="New subtask…"
                          value={subtaskDraft}
                          onChange={(e) => setSubtaskDraft(e.target.value)}
                          onBlur={() => {
                            if (subtaskDraft.trim()) handleAddSubtask();
                            else setAddingSubtaskFor(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleAddSubtask();
                            if (e.key === "Escape") {
                              setAddingSubtaskFor(null);
                              setSubtaskDraft("");
                            }
                          }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
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

          {/* Input bar — onBlur fires when iOS "Done" button dismisses keyboard */}
          <div className="todo-input-bar">
            <input
              ref={inputRef}
              className="todo-input"
              placeholder="Add a task…"
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
                  const lines = pasted.split("\n").map((l) => l.trim()).filter(Boolean);
                  for (const line of lines) {
                    addItemMut.mutate({ text: line });
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
  position: relative;
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
  font-family: inherit;
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

/* Drag-target tab: pulsing glow */
.todo-tab--drag-target {
  border-color: var(--tab-color) !important;
  animation: tab-drag-pulse 0.5s ease infinite alternate;
}
@keyframes tab-drag-pulse {
  from { box-shadow: 0 0 6px color-mix(in srgb, var(--tab-color) 40%, transparent); }
  to   { box-shadow: 0 0 22px color-mix(in srgb, var(--tab-color) 90%, transparent), 0 0 8px color-mix(in srgb, var(--tab-color) 50%, transparent); }
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
.todo-item--dragging {
  opacity: 0.35;
}

/* Subtask indent */
.todo-item--subtask {
  padding-left: 16px;
  background: transparent;
}
.todo-item--subtask:hover {
  background: var(--surface2);
}
.todo-subtask-indent {
  display: block;
  width: 24px;
  flex-shrink: 0;
  border-left: 2px solid var(--border);
  height: 28px;
  margin-left: 4px;
  border-bottom: 2px solid var(--border);
  border-bottom-left-radius: 4px;
  align-self: center;
  margin-bottom: -4px;
}
.todo-subtask-new-dot {
  color: var(--text-dim);
  font-size: 18px;
  flex-shrink: 0;
  line-height: 1;
}

.todo-item--add-subtask {
  opacity: 0.7;
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
.todo-item--subtask .todo-checkbox {
  width: 18px;
  height: 18px;
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
  font-family: inherit;
}
.todo-subtask-input {
  font-size: 14px;
}

/* Subtask count badge */
.todo-subtask-badge {
  font-size: 11px;
  color: var(--text-dim);
  background: rgba(255,255,255,0.06);
  padding: 1px 7px;
  border-radius: 10px;
  flex-shrink: 0;
  white-space: nowrap;
}

/* Add subtask button */
.todo-add-subtask-btn {
  background: none;
  border: 1px solid var(--border);
  color: var(--text-dim);
  font-size: 14px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.15s;
  line-height: 1;
  padding: 0;
}
.todo-add-subtask-btn:hover {
  border-color: var(--todo-accent);
  color: var(--todo-accent);
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

/* Drag ghost */
.todo-drag-ghost {
  position: fixed;
  pointer-events: none;
  z-index: 9999;
  background: var(--surface);
  border: 2px solid var(--todo-accent);
  border-radius: 10px;
  padding: 8px 14px;
  font-size: 14px;
  color: var(--text);
  max-width: 220px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  opacity: 0.92;
  box-shadow: 0 6px 24px rgba(0,0,0,0.45);
  transform: rotate(-2deg);
  transition: box-shadow 0.1s;
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
  font-family: inherit;
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
  font-family: inherit;
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
  .todo-item--subtask {
    padding-left: 12px;
  }
  .todo-checkbox {
    width: 28px;
    height: 28px;
  }
  .todo-item--subtask .todo-checkbox {
    width: 22px;
    height: 22px;
  }
  .todo-item-text {
    font-size: 15px;
  }
  /* Always show delete on touch — no hover */
  .todo-item-delete {
    display: flex;
    opacity: 0.4;
  }
  /* Always show add-subtask on touch */
  .todo-add-subtask-btn {
    display: flex;
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
