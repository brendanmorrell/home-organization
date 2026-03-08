import { useState, useCallback, Suspense, lazy } from "react";
import { useOutletContext, useNavigate } from "react-router";
import type { RoomWithFrames, SearchResult } from "~/lib/supabase";

// Lazy load the 3D scene for better initial load
const HouseScene = lazy(() => import("~/components/three/HouseScene"));

interface LayoutContext {
  rooms: RoomWithFrames[];
  searchQuery: string;
  searchResults: SearchResult[];
  activeRoomId: string | null;
  setActiveRoomId: (id: string | null) => void;
  loading: boolean;
}

export default function HomePage() {
  const {
    rooms,
    searchQuery,
    searchResults,
    activeRoomId,
    setActiveRoomId,
    loading,
  } = useOutletContext<LayoutContext>();

  const navigate = useNavigate();
  const [flyToRoom, setFlyToRoom] = useState<string | null>(null);
  const [view, setView] = useState<"3d" | "grid">("3d");

  // When search results come in, fly to the first matching room
  const firstResultRoom = searchResults.length > 0 ? searchResults[0].room_id : null;

  const handleRoomClick = useCallback(
    (roomId: string) => {
      setActiveRoomId(roomId);
      // Double-click or second click navigates to room detail
    },
    [setActiveRoomId]
  );

  const handleRoomDoubleClick = useCallback(
    (roomId: string) => {
      navigate(`/rooms/${roomId}`);
    },
    [navigate]
  );

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-dim)" }}>
        Loading your house...
      </div>
    );
  }

  if (rooms.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", textAlign: "center", padding: 40 }}>
        <div style={{ fontSize: 48, opacity: 0.5, marginBottom: 16 }}>&#x1F3E0;</div>
        <h2 style={{ fontSize: 20, marginBottom: 8 }}>Welcome to Home Navigator</h2>
        <p style={{ color: "var(--text-dim)", fontSize: 13, maxWidth: 400, lineHeight: 1.6 }}>
          Your searchable 3D home inventory. Head to Admin to set up your rooms,
          or connect Supabase and run the setup SQL to get started with demo data.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* View toggle in top right of content area */}
      <div style={{ position: "absolute", top: 68, right: 20, zIndex: 10, display: "flex", gap: 4 }}>
        <button
          className={`btn ${view === "3d" ? "active" : ""}`}
          onClick={() => setView("3d")}
          style={view === "3d" ? { background: "var(--accent-glow)", borderColor: "var(--accent)", color: "var(--accent)" } : {}}
        >
          3D View
        </button>
        <button
          className={`btn ${view === "grid" ? "active" : ""}`}
          onClick={() => setView("grid")}
          style={view === "grid" ? { background: "var(--accent-glow)", borderColor: "var(--accent)", color: "var(--accent)" } : {}}
        >
          Grid View
        </button>
      </div>

      {view === "3d" ? (
        <div className="canvas-container" style={{ flex: 1, position: "relative" }}>
          <Suspense
            fallback={
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-dim)" }}>
                Loading 3D scene...
              </div>
            }
          >
            <HouseScene
              rooms={rooms}
              searchResults={searchResults}
              activeRoomId={activeRoomId}
              onRoomClick={handleRoomClick}
              flyToRoom={firstResultRoom || flyToRoom}
              onFlyComplete={() => setFlyToRoom(null)}
            />
          </Suspense>

          {/* Search result overlay in 3D mode */}
          {searchResults.length > 0 && (
            <div
              style={{
                position: "absolute",
                top: 20,
                right: 20,
                background: "rgba(26, 29, 39, 0.95)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                padding: 16,
                maxWidth: 320,
                maxHeight: "60vh",
                overflowY: "auto",
                backdropFilter: "blur(8px)",
                zIndex: 5,
              }}
            >
              <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 8 }}>
                Found {searchResults.length} {searchResults.length === 1 ? "item" : "items"}
              </div>
              {searchResults.map((result) => (
                <div
                  key={result.item_id}
                  style={{
                    padding: "8px 0",
                    borderBottom: "1px solid var(--border)",
                    cursor: "pointer",
                  }}
                  onClick={() => {
                    setFlyToRoom(result.room_id);
                    setActiveRoomId(result.room_id);
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    {result.item_name}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>
                    {result.room_name} &middot; {result.item_location}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Instructions overlay */}
          {!searchQuery && (
            <div className="canvas-overlay">
              Click a room to focus &middot; Scroll to zoom &middot; Drag to rotate
            </div>
          )}
        </div>
      ) : (
        /* Grid View */
        <div className="frame-grid">
          {rooms.flatMap((room) =>
            room.frames.map((frame) => {
              const q = searchQuery.toLowerCase();
              const matchingItems = q
                ? frame.items.filter(
                    (item) =>
                      item.name.toLowerCase().includes(q) ||
                      item.location.toLowerCase().includes(q)
                  )
                : [];
              const isHighlighted = matchingItems.length > 0;

              return (
                <div
                  key={frame.id}
                  className={`frame-card ${isHighlighted ? "highlighted" : ""}`}
                  onClick={() => navigate(`/rooms/${room.id}`)}
                >
                  <div className="frame-img-wrap">
                    {frame.image_url ? (
                      <img src={frame.image_url} alt={`Frame ${frame.timestamp}`} />
                    ) : (
                      <div className="placeholder-img" style={{ background: `linear-gradient(135deg, ${room.color}, ${room.color}cc)` }}>
                        <span className="emoji">&#x1F4F7;</span>
                        <span className="label">{room.name}</span>
                      </div>
                    )}
                    <span className="frame-time">{frame.timestamp}</span>
                    <span className="frame-room-badge">{room.name}</span>
                  </div>
                  <div className="frame-info">
                    <div className="frame-items">
                      {frame.items.map((item) => (
                        <span
                          key={item.id}
                          className={`item-tag ${
                            q &&
                            (item.name.toLowerCase().includes(q) ||
                              item.location.toLowerCase().includes(q))
                              ? "match"
                              : ""
                          }`}
                        >
                          {item.name}
                        </span>
                      ))}
                    </div>
                    {isHighlighted && matchingItems[0] && (
                      <div className="frame-location">
                        <span style={{ color: "var(--highlight)" }}>&#x25B6;</span>
                        {matchingItems[0].location}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </>
  );
}
