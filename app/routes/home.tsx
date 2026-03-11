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

// Map room names → 3D model IDs used in house-3d.html
const ROOM_NAME_TO_3D: Record<string, string> = {
  'Kitchen': 'r1', 'Basement': 'r2', 'Garage': 'r3', 'Master Bedroom': 'r4',
  'Living Room': 'r5', 'Work Hallway': 'r6', 'Foyer': 'r7', 'Bathroom': 'r8',
  "Baby's Room": 'r9', 'Upstairs Hallway': 'r10', 'Bath Corridor': 'r11',
  'Bath Alcove': 'r12', 'Walk-in Closet': 'r13', 'Baby Closet': 'r14', 'Balcony': 'r15',
};

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

  // Resolve any room ID to its 3D model ID (r1-r15)
  const to3dId = useCallback((roomId: string): string => {
    // Already a 3D ID?
    if (/^r\d+$/.test(roomId)) return roomId;
    // Look up by name from rooms list
    const room = rooms.find(r => r.id === roomId);
    if (room) {
      const mapped = ROOM_NAME_TO_3D[room.name];
      if (mapped) return mapped;
    }
    return roomId; // fallback
  }, [rooms]);

  // Room to fly to on load (from ?room=r1 query param or search)
  const initialRoom = searchParams.get("room");
  const pendingFlyRef = useRef<string | null>(initialRoom);

  // Listen for postMessage events from the iframe
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (!e.data || !e.data.type) return;

      if (e.data.type === "ready") {
        setIframeReady(true);
        // Ack so iframe stops repeating ready
        if (iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage({ type: "readyAck" }, "*");
        }
        // Push all Supabase items into the 3D model (replaces inventory.json)
        if (rooms.length > 0 && iframeRef.current?.contentWindow) {
          const items: { name: string; zone: string; notes: string }[] = [];
          rooms.forEach(room => {
            room.frames.forEach(frame => {
              frame.items.forEach(item => {
                // location is stored as "ZONE_LABEL | notes" or just zone label
                const parts = (item.location || "").split("|");
                const zone = (parts[0] || "").trim();
                const notes = (parts[1] || "").trim();
                if (zone) {
                  items.push({ name: item.name, zone, notes });
                }
              });
            });
          });
          iframeRef.current.contentWindow.postMessage(
            { type: "syncItems", items },
            "*"
          );
        }
        // Send any pending fly-to
        if (pendingFlyRef.current && iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage(
            { type: "flyToRoom", roomId: to3dId(pendingFlyRef.current) },
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

      if (e.data.type === "cameraState" && e.data.hash) {
        // Mirror iframe camera state into parent URL hash so the address bar is shareable
        history.replaceState(null, "", "#" + e.data.hash);
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [navigate, setActiveRoomId, to3dId]);

  // When iframe loads, send a ping to trigger ready handshake and restore camera
  const onIframeLoad = useCallback(() => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({ type: "ping" }, "*");
      // Restore camera state from parent URL hash if present
      const hash = window.location.hash.slice(1);
      if (hash) {
        iframeRef.current.contentWindow.postMessage({ type: "setCameraState", hash }, "*");
      }
    }
  }, []);

  // Push Supabase items to 3D iframe when rooms data arrives (handles case where
  // rooms load after iframe ready event)
  useEffect(() => {
    if (!iframeReady || rooms.length === 0 || !iframeRef.current?.contentWindow) return;
    const items: { name: string; zone: string; notes: string }[] = [];
    rooms.forEach(room => {
      room.frames.forEach(frame => {
        frame.items.forEach(item => {
          const parts = (item.location || "").split("|");
          const zone = (parts[0] || "").trim();
          const notes = (parts[1] || "").trim();
          if (zone) {
            items.push({ name: item.name, zone, notes });
          }
        });
      });
    });
    iframeRef.current.contentWindow.postMessage(
      { type: "syncItems", items },
      "*"
    );
  }, [rooms, iframeReady]);

  // When activeRoomId changes (e.g. sidebar click), fly the 3D camera
  useEffect(() => {
    if (iframeReady && activeRoomId && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        { type: "flyToRoom", roomId: to3dId(activeRoomId) },
        "*"
      );
    }
  }, [activeRoomId, iframeReady, to3dId]);

  // When search results change, send zone info to the 3D iframe
  useEffect(() => {
    if (iframeReady && iframeRef.current?.contentWindow) {
      if (searchResults.length > 0) {
        // Extract zone labels from item locations (format: "ZONE_LABEL | notes")
        const zones = [...new Set(
          searchResults
            .map((r) => r.item_location?.split("|")[0].trim())
            .filter((z) => z && z !== "undefined")
        )];
        const itemNames = searchResults.map((r) => r.item_name);
        // Determine fallback room from first result (in case 3D can't find item)
        const fallbackRoomId = to3dId(searchResults[0].room_id);
        // Send zone-based highlighting (single message to avoid animation conflicts)
        // Include fallbackRoomId so 3D can fly to the room even if item isn't in its data
        iframeRef.current.contentWindow.postMessage(
          { type: "highlightZones", zones, itemNames, fallbackRoomId },
          "*"
        );
      } else if (!searchQuery.trim()) {
        iframeRef.current.contentWindow.postMessage(
          { type: "clearSearch" },
          "*"
        );
      }
    }
  }, [searchResults, searchQuery, iframeReady]);

  // Click on a search result → fly to that room
  const handleSearchResultClick = useCallback(
    (roomId: string) => {
      setActiveRoomId(roomId);
      if (iframeReady && iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage(
          { type: "flyToRoom", roomId: to3dId(roomId) },
          "*"
        );
      }
    },
    [setActiveRoomId, iframeReady, to3dId]
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
            onLoad={onIframeLoad}
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
