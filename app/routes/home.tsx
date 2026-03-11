import { useState, useCallback, useEffect, useRef } from "react";
import { useOutletContext, useNavigate, useSearchParams } from "react-router";
import type { RoomWithFrames, SearchResult } from "~/lib/supabase";

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
  const [searchParams] = useSearchParams();
  const [view, setView] = useState<"3d" | "grid">("3d");
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeReady, setIframeReady] = useState(false);

  // Room to fly to on load (from ?room=r1 query param or search)
  const initialRoom = searchParams.get("room");
  const pendingFlyRef = useRef<string | null>(initialRoom);

  // Listen for postMessage events from the iframe
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (!e.data || !e.data.type) return;

      if (e.data.type === "ready") {
        setIframeReady(true);
        // Send any pending fly-to
        if (pendingFlyRef.current && iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage(
            { type: "flyToRoom", roomId: pendingFlyRef.current },
            "*"
          );
          pendingFlyRef.current = null;
        }
      }

      if (e.data.type === "roomClicked") {
        setActiveRoomId(e.data.roomId);
      }

      if (e.data.type === "roomDoubleClicked") {
        navigate(`/rooms/${e.data.roomId}`);
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [navigate, setActiveRoomId]);

  // When activeRoomId changes (e.g. sidebar click), fly the 3D camera
  useEffect(() => {
    if (iframeReady && activeRoomId && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        { type: "flyToRoom", roomId: activeRoomId },
        "*"
      );
    }
  }, [activeRoomId, iframeReady]);

  // When search results change, highlight matching rooms in 3D
  useEffect(() => {
    if (iframeReady && iframeRef.current?.contentWindow) {
      const roomIds = [...new Set(searchResults.map((r) => r.room_id))];
      iframeRef.current.contentWindow.postMessage(
        { type: "setHighlight", roomIds },
        "*"
      );
      // Fly to first result
      if (roomIds.length > 0) {
        iframeRef.current.contentWindow.postMessage(
          { type: "flyToRoom", roomId: roomIds[0] },
          "*"
        );
      }
    }
  }, [searchResults, iframeReady]);

  // Click on a search result → fly to that room
  const handleSearchResultClick = useCallback(
    (roomId: string) => {
      setActiveRoomId(roomId);
      if (iframeReady && iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage(
          { type: "flyToRoom", roomId },
          "*"
        );
      }
    },
    [setActiveRoomId, iframeReady]
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
      {/* View toggle */}
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
          <iframe
            ref={iframeRef}
            src="/house-3d.html"
            className="house-iframe"
            title="3D House View"
          />

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
                  onClick={() => handleSearchResultClick(result.room_id)}
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
              Click a room to focus &middot; Double-click to view details &middot; Scroll to zoom
            </div>
          )}
        </div>
      ) : (
        /* Grid View — show one card per room, listing all items */
        <div className="frame-grid">
          {rooms.map((room) => {
            const allRoomItems = room.frames.flatMap((f) => f.items);
            const q = searchQuery.toLowerCase();
            const matchingItems = q
              ? allRoomItems.filter(
                  (item) =>
                    item.name.toLowerCase().includes(q) ||
                    item.location.toLowerCase().includes(q)
                )
              : [];
            const isHighlighted = matchingItems.length > 0;
            const hasImage = room.frames.some((f) => f.image_url);
            const firstImage = room.frames.find((f) => f.image_url)?.image_url;

            return (
              <div
                key={room.id}
                className={`frame-card ${isHighlighted ? "highlighted" : ""}`}
                onClick={() => navigate(`/rooms/${room.id}`)}
              >
                <div className="frame-img-wrap">
                  {hasImage ? (
                    <img src={firstImage!} alt={room.name} />
                  ) : (
                    <div
                      className="placeholder-img room-card-header"
                      style={{
                        background: `linear-gradient(135deg, ${room.color}dd, ${room.color}88)`,
                      }}
                    >
                      <span className="room-icon-large">{room.icon}</span>
                    </div>
                  )}
                  <span className="frame-room-badge">{room.name}</span>
                  <span className="frame-time">{allRoomItems.length} items</span>
                </div>
                <div className="frame-info">
                  <div className="frame-items">
                    {(q ? matchingItems : allRoomItems.slice(0, 12)).map((item) => (
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
                    {!q && allRoomItems.length > 12 && (
                      <span className="item-tag" style={{ opacity: 0.5 }}>
                        +{allRoomItems.length - 12} more
                      </span>
                    )}
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
          })}
        </div>
      )}
    </>
  );
}
