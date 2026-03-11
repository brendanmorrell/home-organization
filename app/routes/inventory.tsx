import { useState, useMemo, useCallback } from "react";
import { useOutletContext, Link } from "react-router";
import {
  updateItem,
  deleteItem,
  createItem,
  type RoomWithFrames,
  type Item,
  type SearchResult,
} from "~/lib/supabase";

interface LayoutContext {
  rooms: RoomWithFrames[];
  setRooms: React.Dispatch<React.SetStateAction<RoomWithFrames[]>>;
  searchQuery: string;
  searchResults: SearchResult[];
  activeRoomId: string | null;
  setActiveRoomId: (id: string | null) => void;
  loading: boolean;
}

// All 20 categories from CATALOGING.md
const CATEGORIES = [
  "Workshop",
  "Auto & Garage",
  "Outdoor & Lawn",
  "Camping & Travel",
  "Kitchen Overflow",
  "Household Maintenance",
  "Household Chemicals",
  "Cleaning & Consumables",
  "Medical & First Aid",
  "Office & Tech",
  "Seasonal & Holiday",
  "Clothing Overflow",
  "Baby: Current Overflow",
  "Baby: Round Two",
  "Memorabilia & Sentimental",
  "Linens & Bedding",
  "Documents & Records",
  "Home Materials",
  "Wife's SLP Supplies",
  "Original House Fixtures",
];

const TIERS = [1, 2, 3, 4];
const TIER_LABELS: Record<number, string> = {
  1: "Grab & Go",
  2: "Easy Trip",
  3: "Planned Retrieval",
  4: "Deep Archive",
};

// Zone → Room mapping (mirrors layout.tsx)
const ZONE_ROOM: Record<string, string> = {
  "LIVING-BAR-CABINETS": "Living Room",
  "LIVING-HALL-CLOSET": "Living Room",
  "KITCHEN-LOWER-CAB": "Kitchen",
  "KITCHEN-UPPER-CAB": "Kitchen",
  "KITCHEN-NOOK": "Kitchen",
  "KITCHEN-NOOK-SOUTH": "Kitchen",
  "GARAGE-BIN-SPEECH": "Garage",
  "GARAGE-BIN-BARDECOR": "Garage",
  "GARAGE-BIN-ELECTRONICS": "Garage",
  "GARAGE-BIN-BOOKS": "Garage",
  "GARAGE-BIN-HEALTH": "Garage",
  "GARAGE-BIN-ASIANKITCHEN": "Garage",
  "GARAGE-BIN-PHOTO": "Garage",
  "GARAGE-BIN-ASIANDECOR": "Garage",
  "GARAGE-BIN-DESK": "Garage",
  "GARAGE-BIN-DECOR": "Garage",
  "GARAGE-BIN-FRAMES": "Garage",
  "GARAGE-SHELF-WEST": "Garage",
  "GARAGE-SHELF-NORTH": "Garage",
  "GARAGE-SHELF-NE": "Garage",
  "GARAGE-PEGBOARD": "Garage",
  "GARAGE-HOOKS-WEST": "Garage",
  "GARAGE-FLOOR": "Garage",
  "PACKED-BOX:c18": "Garage",
  "BSMT-RAISED-W": "Basement",
  "BSMT-RAISED-E": "Basement",
  "BSMT-BIN-CLOTHING": "Basement",
  "BSMT-BIN-BABY": "Basement",
  "BSMT-BIN-DECOR": "Basement",
  "BSMT-SINK-AREA": "Basement",
  "BSMT-CLOTHES": "Basement",
  "BSMT-UNDERSTAIR": "Basement",
  "BSMT-PAINT-CLOSET": "Basement",
  "BSMT-SHELVING-EW": "Basement",
  "BSMT-SHELVING-NS": "Basement",
  "WORKHALL-DRAWERS-N": "Work Hallway",
  "WORKHALL-DRAWERS-S": "Work Hallway",
  "WORKHALL-MID-CAB": "Work Hallway",
  "WORKHALL-SOUTH-CAB": "Work Hallway",
  "FOYER-COAT-CLOSET": "Foyer",
  "MASTER-CLOSET-E": "Master Bedroom",
  "MASTER-CLOSET-W": "Master Bedroom",
  "BABY-CLOSET": "Baby's Room",
  "BATH-CLOSET": "Upstairs Hallway",
  "BATH-VANITY": "Upstairs Hallway",
  "HALL-LAUNDRY": "Upstairs Hallway",
  "HALL-LINEN": "Upstairs Hallway",
  BALCONY: "Balcony",
  "BALCONY-DECKBOX": "Balcony",
};

// Build reverse mapping: Room name → zones
const ROOM_ZONES: Record<string, string[]> = {};
for (const [zone, room] of Object.entries(ZONE_ROOM)) {
  if (!ROOM_ZONES[room]) ROOM_ZONES[room] = [];
  ROOM_ZONES[room].push(zone);
}

interface FlatItem {
  id: string;
  name: string;
  location: string;
  roomName: string;
  roomId: string;
  roomIcon: string;
  frameId: string;
  frameTimestamp: string | null;
  category: string;
  tier: number | null;
  box: string;
  zone: string;
  notes: string;
}

// Parse category/tier/box/zone/notes from the location string
function parseLocationMeta(location: string): {
  category: string;
  tier: number | null;
  box: string;
  zone: string;
  notes: string;
} {
  let category = "Uncategorized";
  let tier: number | null = null;
  let box = "";
  let zone = "";
  let notes = "";

  // Try to extract zone from pipe-delimited format: "ZONE | rest"
  const parts = location.split("|").map((s) => s.trim());
  if (parts.length >= 1 && parts[0].match(/^[A-Z][A-Z0-9_:-]+$/)) {
    zone = parts[0];
    // Remaining parts after zone
    const rest = parts.slice(1).join(" | ");
    if (rest) notes = rest;
  }

  // Try to extract tier from location string
  const tierMatch = location.match(/tier\s*(\d)/i);
  if (tierMatch) tier = parseInt(tierMatch[1]);

  // Try to extract box label
  const boxMatch = location.match(/box\s+([\w-]+)/i);
  if (boxMatch) box = boxMatch[1];

  // Match category from CATEGORIES list first (exact match in pipe-delimited parts)
  for (const part of parts) {
    const trimmed = part.trim();
    if (CATEGORIES.includes(trimmed)) {
      category = trimmed;
      break;
    }
  }

  // If no exact match, try keyword matching
  if (category === "Uncategorized") {
    const locLower = location.toLowerCase();
    if (locLower.includes("workshop") || locLower.includes("tool"))
      category = "Workshop";
    else if (locLower.includes("garage") || locLower.includes("auto"))
      category = "Auto & Garage";
    else if (locLower.includes("outdoor") || locLower.includes("lawn"))
      category = "Outdoor & Lawn";
    else if (locLower.includes("camping") || locLower.includes("travel"))
      category = "Camping & Travel";
    else if (locLower.includes("kitchen")) category = "Kitchen Overflow";
    else if (locLower.includes("maintenance"))
      category = "Household Maintenance";
    else if (locLower.includes("chemical")) category = "Household Chemicals";
    else if (
      locLower.includes("cleaning") ||
      locLower.includes("consumable")
    )
      category = "Cleaning & Consumables";
    else if (locLower.includes("medical") || locLower.includes("first aid"))
      category = "Medical & First Aid";
    else if (locLower.includes("office") || locLower.includes("tech"))
      category = "Office & Tech";
    else if (locLower.includes("seasonal") || locLower.includes("holiday"))
      category = "Seasonal & Holiday";
    else if (locLower.includes("clothing")) category = "Clothing Overflow";
    else if (locLower.includes("baby") && locLower.includes("round two"))
      category = "Baby: Round Two";
    else if (locLower.includes("baby")) category = "Baby: Current Overflow";
    else if (
      locLower.includes("memorabilia") ||
      locLower.includes("sentimental")
    )
      category = "Memorabilia & Sentimental";
    else if (locLower.includes("linen") || locLower.includes("bedding"))
      category = "Linens & Bedding";
    else if (locLower.includes("document") || locLower.includes("record"))
      category = "Documents & Records";
    else if (locLower.includes("slp")) category = "Wife's SLP Supplies";
    else if (locLower.includes("fixture"))
      category = "Original House Fixtures";
    else if (locLower.includes("home material")) category = "Home Materials";
  }

  return { category, tier, box, zone, notes };
}

// Compose location string from structured fields
function composeLocation(fields: {
  zone: string;
  category: string;
  tier: number | null;
  notes: string;
}): string {
  const parts: string[] = [];
  if (fields.zone) parts.push(fields.zone);
  if (fields.category && fields.category !== "Uncategorized")
    parts.push(fields.category);
  if (fields.tier) parts.push(`Tier ${fields.tier}`);
  if (fields.notes) parts.push(fields.notes);
  return parts.join(" | ");
}

function flattenItems(rooms: RoomWithFrames[]): FlatItem[] {
  const items: FlatItem[] = [];
  for (const room of rooms) {
    for (const frame of room.frames) {
      for (const item of frame.items) {
        const meta = parseLocationMeta(item.location);
        items.push({
          id: item.id,
          name: item.name,
          location: item.location,
          roomName: room.name,
          roomId: room.id,
          roomIcon: room.icon,
          frameId: frame.id,
          frameTimestamp: frame.timestamp,
          category: meta.category,
          tier: meta.tier,
          box: meta.box,
          zone: meta.zone,
          notes: meta.notes,
        });
      }
    }
  }
  return items;
}

// ---- Form state for Add / Edit ----
interface ItemFormState {
  name: string;
  roomId: string;
  zone: string;
  category: string;
  tier: number | null;
  notes: string;
}

const EMPTY_FORM: ItemFormState = {
  name: "",
  roomId: "",
  zone: "",
  category: "Uncategorized",
  tier: null,
  notes: "",
};

interface FormErrors {
  name?: string;
  roomId?: string;
  zone?: string;
}

function validateForm(form: ItemFormState): FormErrors {
  const errors: FormErrors = {};
  if (!form.name.trim() || form.name.trim().length < 2)
    errors.name = "Name is required (min 2 characters)";
  if (!form.roomId) errors.roomId = "Please select a room";
  // Zone is optional if the room has no defined zones
  return errors;
}

export default function InventoryPage() {
  const { rooms, setRooms, loading } = useOutletContext<LayoutContext>();

  // Local state
  const [localSearch, setLocalSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [tierFilters, setTierFilters] = useState<Set<number>>(new Set());
  const [sortField, setSortField] = useState<"name" | "room" | "category">(
    "name"
  );
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ItemFormState>(EMPTY_FORM);
  const [editErrors, setEditErrors] = useState<FormErrors>({});

  // Add state
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState<ItemFormState>(EMPTY_FORM);
  const [addErrors, setAddErrors] = useState<FormErrors>({});

  // Shared
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Flatten all items from all rooms
  const allItems = useMemo(() => flattenItems(rooms), [rooms]);

  // Filter items
  const filteredItems = useMemo(() => {
    let items = allItems;

    if (localSearch.trim()) {
      const q = localSearch.toLowerCase();
      items = items.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.location.toLowerCase().includes(q) ||
          item.roomName.toLowerCase().includes(q) ||
          item.box.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q)
      );
    }

    if (categoryFilter !== "All") {
      items = items.filter((item) => item.category === categoryFilter);
    }

    if (tierFilters.size > 0) {
      items = items.filter(
        (item) => item.tier !== null && tierFilters.has(item.tier)
      );
    }

    items = [...items].sort((a, b) => {
      let cmp = 0;
      if (sortField === "name") cmp = a.name.localeCompare(b.name);
      else if (sortField === "room")
        cmp = a.roomName.localeCompare(b.roomName);
      else if (sortField === "category")
        cmp = a.category.localeCompare(b.category);
      return sortDir === "asc" ? cmp : -cmp;
    });

    return items;
  }, [
    allItems,
    localSearch,
    categoryFilter,
    tierFilters,
    sortField,
    sortDir,
  ]);

  // Category counts for the filter dropdown
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of allItems) {
      counts[item.category] = (counts[item.category] || 0) + 1;
    }
    return counts;
  }, [allItems]);

  // Get zones available for a given room
  const getZonesForRoom = useCallback(
    (roomId: string): string[] => {
      const room = rooms.find((r) => r.id === roomId);
      if (!room) return [];
      return ROOM_ZONES[room.name] || [];
    },
    [rooms]
  );

  // Toggle tier filter
  const toggleTier = useCallback((tier: number) => {
    setTierFilters((prev) => {
      const next = new Set(prev);
      if (next.has(tier)) next.delete(tier);
      else next.add(tier);
      return next;
    });
  }, []);

  // ---- Edit ----
  const startEdit = useCallback(
    (item: FlatItem) => {
      setEditingId(item.id);
      setEditForm({
        name: item.name,
        roomId: item.roomId,
        zone: item.zone,
        category: item.category,
        tier: item.tier,
        notes: item.notes || item.location, // fallback to raw location if no structured notes
      });
      setEditErrors({});
    },
    []
  );

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditForm(EMPTY_FORM);
    setEditErrors({});
  }, []);

  const saveEdit = useCallback(
    async (itemId: string, originalFrameId: string) => {
      const errors = validateForm(editForm);
      if (Object.keys(errors).length > 0) {
        setEditErrors(errors);
        return;
      }

      setSaving(true);
      try {
        const location = composeLocation(editForm);
        // Check if room changed — if so, need to update frame_id
        const targetRoom = rooms.find((r) => r.id === editForm.roomId);
        const targetFrameId = targetRoom?.frames[0]?.id || originalFrameId;

        const fields: Partial<Pick<Item, "name" | "location" | "frame_id">> = {
          name: editForm.name.trim(),
          location,
        };
        if (targetFrameId !== originalFrameId) {
          fields.frame_id = targetFrameId;
        }

        const updated = await updateItem(itemId, fields);

        // Optimistic UI update
        setRooms((prev) => {
          let newRooms = prev.map((room) => ({
            ...room,
            frames: room.frames.map((frame) => ({
              ...frame,
              items: frame.items
                .map((item) =>
                  item.id === itemId
                    ? {
                        ...item,
                        name: updated.name,
                        location: updated.location,
                        frame_id: updated.frame_id,
                      }
                    : item
                )
                // If frame_id changed, remove from old frame
                .filter(
                  (item) =>
                    item.id !== itemId || frame.id === updated.frame_id
                ),
            })),
          }));

          // If frame_id changed, add to new frame
          if (targetFrameId !== originalFrameId) {
            newRooms = newRooms.map((room) => ({
              ...room,
              frames: room.frames.map((frame) => {
                if (frame.id === targetFrameId) {
                  const alreadyExists = frame.items.some(
                    (i) => i.id === itemId
                  );
                  if (!alreadyExists) {
                    return {
                      ...frame,
                      items: [...frame.items, updated],
                    };
                  }
                }
                return frame;
              }),
            }));
          }

          return newRooms;
        });
        setEditingId(null);
        setEditForm(EMPTY_FORM);
      } catch (err) {
        console.error("Failed to save item:", err);
        alert("Failed to save. Check the console for details.");
      } finally {
        setSaving(false);
      }
    },
    [editForm, rooms, setRooms]
  );

  // ---- Delete ----
  const handleDelete = useCallback(
    async (item: FlatItem) => {
      if (!window.confirm(`Delete "${item.name}"? This cannot be undone.`))
        return;

      setDeleting(item.id);
      try {
        await deleteItem(item.id);

        // Optimistic UI: remove from rooms state
        setRooms((prev) =>
          prev.map((room) => ({
            ...room,
            frames: room.frames.map((frame) => ({
              ...frame,
              items: frame.items.filter((i) => i.id !== item.id),
            })),
          }))
        );
      } catch (err) {
        console.error("Failed to delete item:", err);
        alert("Failed to delete. Check the console for details.");
      } finally {
        setDeleting(null);
      }
    },
    [setRooms]
  );

  // ---- Add ----
  const openAddForm = useCallback(() => {
    setShowAddForm(true);
    setAddForm(EMPTY_FORM);
    setAddErrors({});
  }, []);

  const cancelAdd = useCallback(() => {
    setShowAddForm(false);
    setAddForm(EMPTY_FORM);
    setAddErrors({});
  }, []);

  const saveAdd = useCallback(async () => {
    const errors = validateForm(addForm);
    if (Object.keys(errors).length > 0) {
      setAddErrors(errors);
      return;
    }

    setSaving(true);
    try {
      const targetRoom = rooms.find((r) => r.id === addForm.roomId);
      if (!targetRoom) throw new Error("Room not found");

      const frameId = targetRoom.frames[0]?.id;
      if (!frameId) throw new Error("Room has no frames — cannot add items");

      const location = composeLocation(addForm);
      const created = await createItem({
        frame_id: frameId,
        name: addForm.name.trim(),
        location,
        pin_x: null,
        pin_y: null,
        pin_z: null,
      });

      // Optimistic UI: add to rooms state
      setRooms((prev) =>
        prev.map((room) => {
          if (room.id !== addForm.roomId) return room;
          return {
            ...room,
            frames: room.frames.map((frame, idx) => {
              if (idx !== 0) return frame;
              return {
                ...frame,
                items: [...frame.items, created],
              };
            }),
          };
        })
      );

      setShowAddForm(false);
      setAddForm(EMPTY_FORM);
    } catch (err) {
      console.error("Failed to add item:", err);
      alert("Failed to add item. Check the console for details.");
    } finally {
      setSaving(false);
    }
  }, [addForm, rooms, setRooms]);

  // ---- Sort ----
  const handleSort = useCallback(
    (field: "name" | "room" | "category") => {
      if (sortField === field) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortField(field);
        setSortDir("asc");
      }
    },
    [sortField]
  );

  const sortIcon = (field: string) => {
    if (sortField !== field) return "";
    return sortDir === "asc" ? " \u25B2" : " \u25BC";
  };

  // ---- Render helpers ----
  const renderFormFields = (
    form: ItemFormState,
    setForm: React.Dispatch<React.SetStateAction<ItemFormState>>,
    errors: FormErrors,
    autoFocusName?: boolean
  ) => {
    const availableZones = form.roomId ? getZonesForRoom(form.roomId) : [];

    return (
      <div className="item-form">
        <div className="form-row">
          <div className={`form-field ${errors.name ? "has-error" : ""}`}>
            <label>Name *</label>
            <input
              type="text"
              className="edit-input"
              placeholder="Item name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              autoFocus={autoFocusName}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  if (showAddForm) cancelAdd();
                  else cancelEdit();
                }
              }}
            />
            {errors.name && <span className="field-error">{errors.name}</span>}
          </div>

          <div className={`form-field ${errors.roomId ? "has-error" : ""}`}>
            <label>Room *</label>
            <select
              className="edit-select"
              value={form.roomId}
              onChange={(e) => {
                const newRoomId = e.target.value;
                setForm((f) => ({ ...f, roomId: newRoomId, zone: "" }));
              }}
            >
              <option value="">Select room...</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.icon} {r.name}
                </option>
              ))}
            </select>
            {errors.roomId && (
              <span className="field-error">{errors.roomId}</span>
            )}
          </div>

          <div className="form-field">
            <label>Zone</label>
            <select
              className="edit-select"
              value={form.zone}
              onChange={(e) =>
                setForm((f) => ({ ...f, zone: e.target.value }))
              }
              disabled={!form.roomId}
            >
              <option value="">
                {form.roomId
                  ? availableZones.length > 0
                    ? "Select zone..."
                    : "No zones defined"
                  : "Pick a room first"}
              </option>
              {availableZones.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-field">
            <label>Category</label>
            <select
              className="edit-select"
              value={form.category}
              onChange={(e) =>
                setForm((f) => ({ ...f, category: e.target.value }))
              }
            >
              <option value="Uncategorized">Uncategorized</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label>Tier</label>
            <select
              className="edit-select"
              value={form.tier ?? ""}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  tier: e.target.value ? parseInt(e.target.value) : null,
                }))
              }
            >
              <option value="">No tier</option>
              {TIERS.map((t) => (
                <option key={t} value={t}>
                  T{t} — {TIER_LABELS[t]}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field form-field-wide">
            <label>Notes</label>
            <input
              type="text"
              className="edit-input"
              placeholder="Additional details..."
              value={form.notes}
              onChange={(e) =>
                setForm((f) => ({ ...f, notes: e.target.value }))
              }
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  if (showAddForm) cancelAdd();
                  else cancelEdit();
                }
              }}
            />
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="inventory-page">
        <div className="inventory-loading">Loading inventory...</div>
      </div>
    );
  }

  return (
    <div className="inventory-page">
      {/* Filter bar */}
      <div className="inventory-toolbar">
        <div className="inventory-search">
          <input
            type="text"
            placeholder="Filter items by name, location, box..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
          />
        </div>

        <div className="inventory-filters">
          <select
            className="inventory-select"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="All">All Categories ({allItems.length})</option>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat} ({categoryCounts[cat] || 0})
              </option>
            ))}
          </select>

          <div className="tier-chips">
            {TIERS.map((t) => (
              <button
                key={t}
                className={`tier-chip ${tierFilters.has(t) ? "active" : ""}`}
                onClick={() => toggleTier(t)}
                title={TIER_LABELS[t]}
              >
                T{t}
              </button>
            ))}
          </div>
        </div>

        <div className="inventory-actions-bar">
          <span className="inventory-count">
            {filteredItems.length} of {allItems.length} items
          </span>
          <button
            className="btn btn-primary btn-add"
            onClick={openAddForm}
            disabled={showAddForm}
          >
            + Add Item
          </button>
        </div>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="add-form-panel">
          <div className="add-form-header">
            <h3>Add New Item</h3>
            <div className="add-form-actions">
              <button
                className="btn btn-primary btn-sm"
                onClick={saveAdd}
                disabled={saving}
              >
                {saving ? "Saving..." : "Save"}
              </button>
              <button
                className="btn btn-sm"
                onClick={cancelAdd}
                disabled={saving}
              >
                Cancel
              </button>
            </div>
          </div>
          {renderFormFields(addForm, setAddForm, addErrors, true)}
        </div>
      )}

      {/* Items table */}
      {filteredItems.length === 0 ? (
        <div className="inventory-empty">
          {allItems.length === 0 ? (
            <>
              <div className="empty-icon">&#x1F4E6;</div>
              <h3>No items cataloged yet</h3>
              <p>
                Process video walkthroughs to start cataloging items into your
                inventory.
              </p>
            </>
          ) : (
            <>
              <div className="empty-icon">&#x1F50D;</div>
              <h3>No matches</h3>
              <p>Try adjusting your search or filters.</p>
            </>
          )}
        </div>
      ) : (
        <div className="inventory-table-wrap">
          <table className="inventory-table">
            <thead>
              <tr>
                <th className="sortable" onClick={() => handleSort("name")}>
                  Item{sortIcon("name")}
                </th>
                <th
                  className="sortable"
                  onClick={() => handleSort("category")}
                >
                  Category{sortIcon("category")}
                </th>
                <th>Tier</th>
                <th className="sortable" onClick={() => handleSort("room")}>
                  Room{sortIcon("room")}
                </th>
                <th>Location</th>
                <th>Box</th>
                <th className="actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <tr
                  key={item.id}
                  className={`${editingId === item.id ? "editing" : ""} ${deleting === item.id ? "deleting" : ""}`}
                >
                  {editingId === item.id ? (
                    <>
                      <td colSpan={6}>
                        {renderFormFields(
                          editForm,
                          setEditForm,
                          editErrors,
                          true
                        )}
                      </td>
                      <td className="actions-col">
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => saveEdit(item.id, item.frameId)}
                          disabled={saving}
                        >
                          {saving ? "..." : "Save"}
                        </button>
                        <button
                          className="btn btn-sm"
                          onClick={cancelEdit}
                          disabled={saving}
                        >
                          Cancel
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="item-name-cell">{item.name}</td>
                      <td>
                        <span className="category-badge">{item.category}</span>
                      </td>
                      <td>
                        {item.tier ? (
                          <span
                            className={`tier-badge tier-${item.tier}`}
                            title={TIER_LABELS[item.tier]}
                          >
                            T{item.tier}
                          </span>
                        ) : (
                          <span className="tier-badge tier-none">&mdash;</span>
                        )}
                      </td>
                      <td>
                        <Link
                          to={`/rooms/${item.roomId}`}
                          className="room-link"
                        >
                          <span className="room-icon-sm">{item.roomIcon}</span>
                          {item.roomName}
                        </Link>
                      </td>
                      <td className="location-cell" title={item.location}>
                        {item.location}
                      </td>
                      <td>
                        {item.box ? (
                          <span className="box-badge">{item.box}</span>
                        ) : (
                          <span className="no-box">&mdash;</span>
                        )}
                      </td>
                      <td className="actions-col">
                        <button
                          className="btn btn-sm"
                          onClick={() => startEdit(item)}
                          title="Edit item"
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => handleDelete(item)}
                          disabled={deleting === item.id}
                          title="Delete item"
                        >
                          {deleting === item.id ? "..." : "\u2715"}
                        </button>
                        <Link
                          to={`/?room=${item.roomId}`}
                          className="btn btn-sm"
                          title="View in 3D"
                        >
                          3D
                        </Link>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
