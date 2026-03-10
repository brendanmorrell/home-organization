import { useState, useMemo, useCallback } from "react";
import { useOutletContext, Link } from "react-router";
import {
  updateItem,
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

interface FlatItem {
  id: string;
  name: string;
  location: string;
  roomName: string;
  roomId: string;
  roomIcon: string;
  frameId: string;
  frameTimestamp: string | null;
  // Extended fields (from location parsing or future enrichment)
  category: string;
  tier: number | null;
  box: string;
}

// Parse category/tier/box hints from the location string
// e.g. "Garage — NE quadrant, upper shelf" or "Workshop | Tier 2 | Box G-3"
function parseLocationMeta(location: string): {
  category: string;
  tier: number | null;
  box: string;
} {
  let category = "Uncategorized";
  let tier: number | null = null;
  let box = "";

  // Try to extract tier from location string
  const tierMatch = location.match(/tier\s*(\d)/i);
  if (tierMatch) tier = parseInt(tierMatch[1]);

  // Try to extract box label
  const boxMatch = location.match(/box\s+([\w-]+)/i);
  if (boxMatch) box = boxMatch[1];

  // Try to match category from location keywords
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
  else if (locLower.includes("maintenance")) category = "Household Maintenance";
  else if (locLower.includes("chemical")) category = "Household Chemicals";
  else if (locLower.includes("cleaning") || locLower.includes("consumable"))
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
  else if (locLower.includes("memorabilia") || locLower.includes("sentimental"))
    category = "Memorabilia & Sentimental";
  else if (locLower.includes("linen") || locLower.includes("bedding"))
    category = "Linens & Bedding";
  else if (locLower.includes("document") || locLower.includes("record"))
    category = "Documents & Records";
  else if (locLower.includes("slp")) category = "Wife's SLP Supplies";
  else if (locLower.includes("fixture")) category = "Original House Fixtures";
  else if (locLower.includes("home material")) category = "Home Materials";

  return { category, tier, box };
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
        });
      }
    }
  }
  return items;
}

export default function InventoryPage() {
  const { rooms, setRooms, loading } = useOutletContext<LayoutContext>();

  // Local state
  const [localSearch, setLocalSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [tierFilters, setTierFilters] = useState<Set<number>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [saving, setSaving] = useState(false);
  const [sortField, setSortField] = useState<"name" | "room" | "category">(
    "name"
  );
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // Flatten all items from all rooms
  const allItems = useMemo(() => flattenItems(rooms), [rooms]);

  // Filter items
  const filteredItems = useMemo(() => {
    let items = allItems;

    // Text search
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

    // Category filter
    if (categoryFilter !== "All") {
      items = items.filter((item) => item.category === categoryFilter);
    }

    // Tier filter
    if (tierFilters.size > 0) {
      items = items.filter(
        (item) => item.tier !== null && tierFilters.has(item.tier)
      );
    }

    // Sort
    items = [...items].sort((a, b) => {
      let cmp = 0;
      if (sortField === "name") cmp = a.name.localeCompare(b.name);
      else if (sortField === "room") cmp = a.roomName.localeCompare(b.roomName);
      else if (sortField === "category")
        cmp = a.category.localeCompare(b.category);
      return sortDir === "asc" ? cmp : -cmp;
    });

    return items;
  }, [allItems, localSearch, categoryFilter, tierFilters, sortField, sortDir]);

  // Category counts for the filter dropdown
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of allItems) {
      counts[item.category] = (counts[item.category] || 0) + 1;
    }
    return counts;
  }, [allItems]);

  // Toggle tier filter
  const toggleTier = useCallback((tier: number) => {
    setTierFilters((prev) => {
      const next = new Set(prev);
      if (next.has(tier)) next.delete(tier);
      else next.add(tier);
      return next;
    });
  }, []);

  // Start editing
  const startEdit = useCallback((item: FlatItem) => {
    setEditingId(item.id);
    setEditName(item.name);
    setEditLocation(item.location);
  }, []);

  // Cancel editing
  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditName("");
    setEditLocation("");
  }, []);

  // Save edit
  const saveEdit = useCallback(
    async (itemId: string) => {
      setSaving(true);
      try {
        const updated = await updateItem(itemId, {
          name: editName,
          location: editLocation,
        });

        // Update local state so the UI reflects the change
        setRooms((prev) =>
          prev.map((room) => ({
            ...room,
            frames: room.frames.map((frame) => ({
              ...frame,
              items: frame.items.map((item) =>
                item.id === itemId
                  ? { ...item, name: updated.name, location: updated.location }
                  : item
              ),
            })),
          }))
        );
        setEditingId(null);
      } catch (err) {
        console.error("Failed to save item:", err);
        alert("Failed to save. Check the console for details.");
      } finally {
        setSaving(false);
      }
    },
    [editName, editLocation, setRooms]
  );

  // Toggle sort
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
    return sortDir === "asc" ? " ▲" : " ▼";
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

        <div className="inventory-count">
          {filteredItems.length} of {allItems.length} items
        </div>
      </div>

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
                <th
                  className="sortable"
                  onClick={() => handleSort("name")}
                >
                  Item{sortIcon("name")}
                </th>
                <th
                  className="sortable"
                  onClick={() => handleSort("category")}
                >
                  Category{sortIcon("category")}
                </th>
                <th>Tier</th>
                <th
                  className="sortable"
                  onClick={() => handleSort("room")}
                >
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
                  className={editingId === item.id ? "editing" : ""}
                >
                  {editingId === item.id ? (
                    <>
                      <td colSpan={2}>
                        <input
                          className="edit-input"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEdit(item.id);
                            if (e.key === "Escape") cancelEdit();
                          }}
                        />
                      </td>
                      <td colSpan={1}>
                        <span className="tier-badge">
                          {item.tier ? `T${item.tier}` : "—"}
                        </span>
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
                      <td colSpan={2}>
                        <input
                          className="edit-input"
                          value={editLocation}
                          onChange={(e) => setEditLocation(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEdit(item.id);
                            if (e.key === "Escape") cancelEdit();
                          }}
                        />
                      </td>
                      <td className="actions-col">
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => saveEdit(item.id)}
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
                          <span className="tier-badge tier-none">—</span>
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
                          <span className="no-box">—</span>
                        )}
                      </td>
                      <td className="actions-col">
                        <button
                          className="btn btn-sm"
                          onClick={() => startEdit(item)}
                        >
                          Edit
                        </button>
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
