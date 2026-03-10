import { useState, useEffect, useRef, useCallback } from "react";
import { Outlet, Link, useNavigate, useLocation } from "react-router";
import {
  fetchAllRoomsWithFrames,
  searchItems,
  type RoomWithFrames,
  type SearchResult,
} from "~/lib/supabase";

export default function AppLayout() {
  const [rooms, setRooms] = useState<RoomWithFrames[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const searchRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>();

  // Load rooms on mount
  useEffect(() => {
    fetchAllRoomsWithFrames()
      .then(setRooms)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

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

  // Debounced search
  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);

      if (searchTimeout.current) clearTimeout(searchTimeout.current);

      if (!query.trim()) {
        setSearchResults([]);
        return;
      }

      searchTimeout.current = setTimeout(async () => {
        try {
          const results = await searchItems(query);
          setSearchResults(results);
          // If we're on a room page but results are in other rooms, go home
          if (results.length > 0 && location.pathname !== "/") {
            navigate("/");
          }
        } catch (err) {
          console.error("Search failed:", err);
        }
      }, 300);
    },
    [location.pathname, navigate]
  );

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

          <div className="nav-section">Rooms</div>
          {rooms.map((room) => {
            const itemCount = room.frames.reduce(
              (s, f) => s + f.items.length,
              0
            );
            const hasResults = highlightedRoomIds.has(room.id);
            return (
              <Link
                key={room.id}
                to={`/rooms/${room.id}`}
                className={`nav-item ${
                  location.pathname === `/rooms/${room.id}` ? "active" : ""
                } ${hasResults ? "has-results" : ""}`}
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
        {/* Top bar */}
        <div className="topbar">
          <div className="search-box">
            <span className="search-icon">&#x1F50D;</span>
            <input
              ref={searchRef}
              type="text"
              placeholder='Search for anything... (Cmd+K)'
              value={searchQuery}
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
        </div>

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
