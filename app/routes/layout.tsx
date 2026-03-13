import { useState, useEffect, useRef, useCallback } from "react";
import { Outlet, Link, useNavigate, useLocation, useSearchParams } from "react-router";
import {
  fetchAllRoomsWithFrames,
  type RoomWithFrames,
  type SearchResult,
} from "~/lib/supabase";
import {
  buildFuseIndex,
  fuzzySearch,
  aiSearch,
  INITIAL_AI_STATE,
  type AiSearchState,
} from "~/lib/search";
import type Fuse from "fuse.js";

export default function AppLayout() {
  const [rooms, setRooms] = useState<RoomWithFrames[]>([]);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const searchRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);
  const urlTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [roomsExpanded, setRoomsExpanded] = useState(false);
  const fuseRef = useRef<Fuse<any> | null>(null);
  const [aiSearchState, setAiSearchState] = useState<AiSearchState>(INITIAL_AI_STATE);
  const aiTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Search query: local state for instant input, URL (?q=) for persistence
  const [inputValue, setInputValue] = useState(searchParams.get("q") || "");
  const searchQuery = searchParams.get("q") || "";

  // Load rooms on mount — Supabase is source of truth, inventory.json as offline fallback only
  useEffect(() => {
    async function loadData() {
      try {
        const supaRooms = await fetchAllRoomsWithFrames();
        // Count Supabase items
        const supaItemCount = supaRooms.reduce(
          (sum, r) => sum + r.frames.reduce((s, f) => s + f.items.length, 0), 0
        );
        // If Supabase has few items, supplement with local inventory.json
        if (supaItemCount < 50) {
          try {
            const resp = await fetch("/inventory.json");
            if (resp.ok) {
              const inv = await resp.json();
              const localItems = inv.items || [];
              // Zone → room name mapping
              const ZONE_ROOM: Record<string, string> = {
                'LIVING-BAR-CABINETS': 'Living Room', 'LIVING-HALL-CLOSET': 'Living Room',
                'KITCHEN-LOWER-CAB': 'Kitchen', 'KITCHEN-UPPER-CAB': 'Kitchen',
                'KITCHEN-NOOK': 'Kitchen', 'KITCHEN-NOOK-SOUTH': 'Kitchen',
                'GARAGE-BIN-SPEECH': 'Garage', 'GARAGE-BIN-BARDECOR': 'Garage',
                'GARAGE-BIN-ELECTRONICS': 'Garage', 'GARAGE-BIN-BOOKS': 'Garage',
                'GARAGE-BIN-HEALTH': 'Garage', 'GARAGE-BIN-ASIANKITCHEN': 'Garage',
                'GARAGE-BIN-PHOTO': 'Garage', 'GARAGE-BIN-ASIANDECOR': 'Garage',
                'GARAGE-BIN-DESK': 'Garage', 'GARAGE-BIN-DECOR': 'Garage',
                'GARAGE-BIN-FRAMES': 'Garage',
                'GARAGE-SHELF-WEST': 'Garage', 'GARAGE-SHELF-NORTH': 'Garage',
                'GARAGE-SHELF-NE': 'Garage', 'GARAGE-PEGBOARD': 'Garage',
                'GARAGE-HOOKS-WEST': 'Garage', 'GARAGE-FLOOR': 'Garage',
                'PACKED-BOX:c18': 'Garage',
                'BSMT-RAISED-W': 'Basement', 'BSMT-RAISED-E': 'Basement',
                'BSMT-BIN-CLOTHING': 'Basement', 'BSMT-BIN-BABY': 'Basement',
                'BSMT-BIN-DECOR': 'Basement',
                'BSMT-SINK-AREA': 'Basement', 'BSMT-CLOTHES': 'Basement',
                'BSMT-UNDERSTAIR': 'Basement', 'BSMT-PAINT-CLOSET': 'Basement',
                'BSMT-SHELVING-EW': 'Basement', 'BSMT-SHELVING-NS': 'Basement',
                'WORKHALL-DRAWERS-N': 'Work Hallway', 'WORKHALL-DRAWERS-S': 'Work Hallway',
                'WORKHALL-MID-CAB': 'Work Hallway', 'WORKHALL-SOUTH-CAB': 'Work Hallway',
                'FOYER-COAT-CLOSET': 'Foyer',
                'MASTER-CLOSET-E': 'Master Bedroom', 'MASTER-CLOSET-W': 'Master Bedroom',
                'BABY-CLOSET': "Baby's Room",
                'BATH-CLOSET': 'Upstairs Hallway', 'BATH-VANITY': 'Upstairs Hallway',
                'HALL-LAUNDRY': 'Upstairs Hallway', 'HALL-LINEN': 'Upstairs Hallway',
                'BALCONY': 'Balcony', 'BALCONY-DECKBOX': 'Balcony',
              };
              // Group local items by room name
              const byRoom: Record<string, any[]> = {};
              for (const item of localItems) {
                const roomName = ZONE_ROOM[item.zone];
                if (!roomName) continue;
                if (!byRoom[roomName]) byRoom[roomName] = [];
                byRoom[roomName].push(item);
              }
              // Existing Supabase item names for dedup
              const existingNames = new Set<string>();
              supaRooms.forEach(r => r.frames.forEach(f => f.items.forEach(i => existingNames.add(i.name))));
              // Map room names to 3D model IDs (must match house-3d.html room ids)
              const ROOM_3D_ID: Record<string, string> = {
                'Kitchen': 'r1', 'Basement': 'r2', 'Garage': 'r3', 'Master Bedroom': 'r4',
                'Living Room': 'r5', 'Work Hallway': 'r6', 'Foyer': 'r7', 'Bathroom': 'r8',
                "Baby's Room": 'r9', 'Upstairs Hallway': 'r10', 'Bath Corridor': 'r11',
                'Bath Alcove': 'r12', 'Walk-in Closet': 'r13', 'Baby Closet': 'r14', 'Balcony': 'r15',
              };
              // Room metadata for creating missing rooms
              const ROOM_META: Record<string, { icon: string; color: string; pos_x: number; pos_y: number; pos_z: number; width: number; depth: number; height: number }> = {
                'Kitchen':          { icon: 'K', color: '#8d6e63', pos_x: 8.8,  pos_y: 0,    pos_z: 16.8,  width: 4.57, depth: 4.57, height: 2.8 },
                'Living Room':      { icon: 'L', color: '#5c6bc0', pos_x: 8,    pos_y: 0,    pos_z: 9,     width: 6.1,  depth: 11.0, height: 3.35 },
                'Work Hallway':     { icon: 'W', color: '#7e57c2', pos_x: 7.7,  pos_y: 0,    pos_z: 19.69, width: 2.44, depth: 3.66, height: 2.8 },
                'Garage':           { icon: 'G', color: '#78909c', pos_x: 8,    pos_y: -0.45,pos_z: 0,     width: 6.1,  depth: 6.1,  height: 3.7 },
                'Basement':         { icon: 'B', color: '#546e7a', pos_x: 0,    pos_y: -1.0, pos_z: -6.69, width: 6.5,  depth: 8.28, height: 2.5 },
                'Foyer':            { icon: 'F', color: '#ab47bc', pos_x: 7.7,  pos_y: 0,    pos_z: 23.37, width: 4.9,  depth: 3.7,  height: 2.8 },
                'Bathroom':         { icon: 'b', color: '#26a69a', pos_x: 10.0, pos_y: 0,    pos_z: 20.3,  width: 2.1,  depth: 1.5,  height: 2.8 },
                'Master Bedroom':   { icon: 'M', color: '#ec407a', pos_x: -2.4, pos_y: 0,    pos_z: 6.28,  width: 7.01, depth: 4.88, height: 2.8 },
                "Baby's Room":      { icon: 'R', color: '#66bb6a', pos_x: -1.95,pos_y: 0,    pos_z: 15.42, width: 6.1,  depth: 4.27, height: 2.8 },
                'Upstairs Hallway': { icon: 'H', color: '#5c6bc0', pos_x: -4.54,pos_y: 0,    pos_z: 11.0,  width: 2.74, depth: 4.57, height: 2.8 },
                'Bath Corridor':    { icon: 'c', color: '#80cbc4', pos_x: -1.49,pos_y: 0,    pos_z: 11.0,  width: 1.52, depth: 4.57, height: 2.8 },
                'Bath Alcove':      { icon: 'a', color: '#4dd0e1', pos_x: 0.19, pos_y: 0,    pos_z: 12.07, width: 1.83, depth: 2.44, height: 2.8 },
                'Walk-in Closet':   { icon: 'C', color: '#8d6e63', pos_x: 0.19, pos_y: 0,    pos_z: 9.78,  width: 1.83, depth: 2.13, height: 2.8 },
                'Baby Closet':      { icon: 'c', color: '#a5d6a7', pos_x: -5.45,pos_y: 0,    pos_z: 16.49, width: 0.91, depth: 1.52, height: 2.8 },
                'Balcony':          { icon: 'B', color: '#a1887f', pos_x: 8.0,  pos_y: 0,    pos_z: -15,   width: 6.1,  depth: 6.1,  height: 2.8 },
              };
              // Merge into existing rooms
              const supaRoomNames = new Set(supaRooms.map(r => r.name));
              for (const room of supaRooms) {
                const localForRoom = byRoom[room.name] || [];
                if (localForRoom.length === 0) continue;
                const newItems = localForRoom
                  .filter(li => !existingNames.has(li.name))
                  .map(li => ({
                    id: li.id || crypto.randomUUID(),
                    name: li.name,
                    location: `${li.zone} | ${li.notes || ''}`.trim(),
                    frame_id: room.frames[0]?.id || 'local',
                    pin_x: null, pin_y: null, pin_z: null,
                    created_at: new Date().toISOString(),
                  }));
                if (newItems.length > 0) {
                  if (room.frames.length === 0) {
                    room.frames.push({
                      id: 'local-' + room.id,
                      room_id: room.id,
                      image_url: null,
                      timestamp: 'local',
                      sort_order: 1,
                      created_at: new Date().toISOString(),
                      items: newItems,
                    } as any);
                  } else {
                    room.frames[0].items.push(...newItems);
                  }
                }
              }
              // Create missing rooms that exist in inventory but not in Supabase
              let sortOrder = supaRooms.length + 1;
              for (const [roomName, items] of Object.entries(byRoom)) {
                if (supaRoomNames.has(roomName)) continue; // already merged above
                const meta = ROOM_META[roomName];
                if (!meta) continue;
                const roomId = ROOM_3D_ID[roomName] || ('local-room-' + roomName.toLowerCase().replace(/[^a-z0-9]/g, '-'));
                const frameId = 'local-frame-' + roomId;
                const newItems = items
                  .filter(li => !existingNames.has(li.name))
                  .map(li => ({
                    id: li.id || crypto.randomUUID(),
                    name: li.name,
                    location: `${li.zone} | ${li.notes || ''}`.trim(),
                    frame_id: frameId,
                    pin_x: null, pin_y: null, pin_z: null,
                    created_at: new Date().toISOString(),
                  }));
                if (newItems.length > 0) {
                  supaRooms.push({
                    id: roomId,
                    name: roomName,
                    icon: meta.icon,
                    pos_x: meta.pos_x, pos_y: meta.pos_y, pos_z: meta.pos_z,
                    width: meta.width, depth: meta.depth, height: meta.height,
                    color: meta.color,
                    sort_order: sortOrder++,
                    created_at: new Date().toISOString(),
                    frames: [{
                      id: frameId,
                      room_id: roomId,
                      image_url: null,
                      timestamp: 'local',
                      sort_order: 1,
                      created_at: new Date().toISOString(),
                      items: newItems,
                    }],
                  } as any);
                }
              }
              console.log(`[inventory] Loaded ${supaRooms.length} rooms with local inventory.json fallback (${localItems.length} total local items)`);
            }
          } catch (e) {
            console.warn('[inventory] Could not load local inventory.json fallback:', e);
          }
        }
        setRooms(supaRooms);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Build Fuse index when rooms data loads
  useEffect(() => {
    if (rooms.length > 0) {
      fuseRef.current = buildFuseIndex(rooms);
    }
  }, [rooms]);

  // Cmd+K to focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Handle typing: update input instantly, debounce search + URL update
  const handleSearch = useCallback(
    (query: string) => {
      setInputValue(query); // instant — keeps input responsive

      if (searchTimeout.current) clearTimeout(searchTimeout.current);
      if (urlTimeout.current) clearTimeout(urlTimeout.current);
      if (aiTimeout.current) clearTimeout(aiTimeout.current);

      if (!query.trim()) {
        setSearchResults([]);
        setAiSearchState(INITIAL_AI_STATE);
        // Clear URL param immediately when input is cleared
        setSearchParams(prev => { prev.delete("q"); return prev; }, { replace: true });
        return;
      }

      // Debounce: fuzzy search after 250ms of no typing
      searchTimeout.current = setTimeout(() => {
        if (!fuseRef.current) return;
        const results = fuzzySearch(fuseRef.current, query);
        setSearchResults(results);
        if (results.length > 0 && location.pathname !== "/") {
          navigate("/?q=" + encodeURIComponent(query));
        }

        // If few results and query is long enough, trigger AI search after extra delay
        if (results.length <= 2 && query.trim().length >= 3) {
          setAiSearchState(prev => ({ ...prev, loading: true, error: null }));
          aiTimeout.current = setTimeout(() => {
            aiSearch(query, rooms)
              .then(({ results: aiResults, reasons }) => {
                // Deduplicate against fuzzy results
                const fuzzyIds = new Set(results.map(r => r.item_id));
                const newAiResults = aiResults.filter(r => !fuzzyIds.has(r.item_id));
                setAiSearchState({ loading: false, results: newAiResults, reasons, error: null });
              })
              .catch(err => {
                console.error("[ai-search]", err);
                setAiSearchState({ loading: false, results: [], reasons: new Map(), error: err.message });
              });
          }, 1500);
        } else {
          setAiSearchState(INITIAL_AI_STATE);
        }
      }, 250);

      // Debounce URL update a bit longer (500ms) to avoid history churn
      urlTimeout.current = setTimeout(() => {
        setSearchParams(prev => { prev.set("q", query); return prev; }, { replace: true });
      }, 500);
    },
    [rooms, location.pathname, navigate, setSearchParams]
  );

  // Run search when rooms load (handles page refresh with ?q= in URL)
  useEffect(() => {
    if (rooms.length > 0 && searchQuery.trim() && fuseRef.current) {
      setInputValue(searchQuery);
      const results = fuzzySearch(fuseRef.current, searchQuery);
      setSearchResults(results);
    }
  }, [rooms]); // Only re-run when rooms data loads

  const totalItems = rooms.reduce(
    (sum, r) => sum + r.frames.reduce((s, f) => s + f.items.length, 0),
    0
  );
  const totalFrames = rooms.reduce((sum, r) => sum + r.frames.length, 0);

  const highlightedRoomIds = new Set(searchResults.map((r) => r.room_id));

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-header">
          <h1>Home Navigator</h1>
          <p>Search anything in your house</p>
        </div>
        <div className="sidebar-nav">
          <div className="nav-section">Views</div>
          <Link
            to="/"
            className={`nav-item ${location.pathname === "/" ? "active" : ""}`}
            onClick={() => setActiveRoomId(null)}
          >
            <span className="icon">3D</span>
            <span>House View</span>
          </Link>

          {/* Active room (if on a room page) */}
          {(() => {
            const activeRoom = rooms.find(r => location.pathname === `/rooms/${r.id}`);
            if (activeRoom) {
              const activeCount = activeRoom.frames.reduce((s, f) => s + f.items.length, 0);
              return (
                <>
                  <div className="nav-section">Current Room</div>
                  <Link
                    to={`/rooms/${activeRoom.id}`}
                    className="nav-item active"
                    onClick={() => setActiveRoomId(activeRoom.id)}
                  >
                    <span className="icon">{activeRoom.icon}</span>
                    <span>{activeRoom.name}</span>
                    <span className="count">{activeCount}</span>
                  </Link>
                </>
              );
            }
            return null;
          })()}

          {/* Collapsible rooms list */}
          <button
            className="nav-section nav-section-toggle"
            onClick={() => setRoomsExpanded(prev => !prev)}
          >
            <span>Rooms ({rooms.length})</span>
            <span className={`toggle-arrow ${roomsExpanded ? "open" : ""}`}>&#x25B8;</span>
          </button>
          {roomsExpanded && rooms.map((room) => {
            const itemCount = room.frames.reduce(
              (s, f) => s + f.items.length,
              0
            );
            const hasResults = highlightedRoomIds.has(room.id);
            const isActive = location.pathname === `/rooms/${room.id}`;
            return (
              <Link
                key={room.id}
                to={`/rooms/${room.id}`}
                className={`nav-item nav-item-compact ${isActive ? "active" : ""} ${hasResults ? "has-results" : ""}`}
                onClick={() => setActiveRoomId(room.id)}
              >
                <span className="icon">{room.icon}</span>
                <span>{room.name}</span>
                <span className="count">{itemCount}</span>
              </Link>
            );
          })}

          <div className="nav-section">Manage</div>
          <Link
            to="/inventory"
            className={`nav-item ${
              location.pathname === "/inventory" ? "active" : ""
            }`}
          >
            <span className="icon">&#x1F4CB;</span>
            <span>Inventory</span>
            <span className="count">{totalItems}</span>
          </Link>
          <Link
            to="/plan"
            className={`nav-item ${
              location.pathname === "/plan" ? "active" : ""
            }`}
          >
            <span className="icon">&#x1F5FA;</span>
            <span>Org Plan</span>
          </Link>
          <Link
            to="/admin"
            className={`nav-item ${
              location.pathname === "/admin" ? "active" : ""
            }`}
          >
            <span className="icon">+</span>
            <span>Admin</span>
          </Link>
        </div>
      </div>

      {/* Main area */}
      <div className="main-content">
        {/* Top bar — only show on home (3D/grid) view */}
        {location.pathname === "/" && (
          <div className="topbar">
            <div className="search-box">
              <span className="search-icon">&#x1F50D;</span>
              <input
                ref={searchRef}
                type="text"
                placeholder='Search for anything... (Cmd+K)'
                value={inputValue}
                onChange={(e) => handleSearch(e.target.value)}
              />
            </div>
            {searchResults.length > 0 && (
              <span className="result-count">
                {searchResults.length}{" "}
                {searchResults.length === 1 ? "match" : "matches"} across{" "}
                {new Set(searchResults.map((r) => r.room_id)).size} rooms
              </span>
            )}
            {aiSearchState.loading && (
              <span className="result-count ai-searching">
                <span className="ai-spinner" /> Asking AI...
              </span>
            )}
            {!aiSearchState.loading && aiSearchState.results.length > 0 && (
              <span className="result-count ai-badge">
                +{aiSearchState.results.length} AI suggestion{aiSearchState.results.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        )}

        {/* Route content */}
        <div className="content-area">
          <Outlet
            context={{
              rooms,
              setRooms,
              searchQuery,
              searchResults,
              activeRoomId,
              setActiveRoomId,
              loading,
              aiSearchState,
            }}
          />
        </div>

        {/* Stats */}
        <div className="stats-bar">
          <span>{rooms.length} rooms</span>
          <span>{totalFrames} frames</span>
          <span>{totalItems} items cataloged</span>
        </div>
      </div>
    </div>
  );
}
