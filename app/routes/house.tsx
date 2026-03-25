import { useState, useCallback, useEffect, useRef } from "react";
import { useOutletContext, useNavigate, useSearchParams } from "react-router";
import type { RoomWithFrames, SearchResult } from "~/lib/supabase";
import type { AiSearchState, FuzzyMatchMeta } from "~/lib/search";

interface LayoutContext {
  rooms: RoomWithFrames[];
  searchQuery: string;
  searchResults: SearchResult[];
  activeRoomId: string | null;
  setActiveRoomId: (id: string | null) => void;
  loading: boolean;
  aiSearchState: AiSearchState;
  fuzzyMatchMeta: Map<string, FuzzyMatchMeta>;
  inputValue: string;
  handleSearch: (query: string) => void;
  searchRef: React.RefObject<HTMLInputElement | null>;
}

function SearchDiagnostics({
  query,
  fuzzyResults,
  fuzzyMatchMeta,
  aiState,
}: {
  query: string;
  fuzzyResults: SearchResult[];
  fuzzyMatchMeta: Map<string, FuzzyMatchMeta>;
  aiState: AiSearchState;
}) {
  const hasFuzzy = fuzzyResults.length > 0;
  const hasAi = aiState.results.length > 0;
  const aiDone = !aiState.loading && query.trim().length >= 3;
  const noResults = !hasFuzzy && !hasAi && aiDone;

  // Summarize match types
  const exactCount = fuzzyResults.filter(
    (r) => fuzzyMatchMeta.get(r.item_id)?.type === "exact"
  ).length;
  const fuzzyCount = fuzzyResults.filter(
    (r) => fuzzyMatchMeta.get(r.item_id)?.type === "fuzzy"
  ).length;
  const synonymCount = fuzzyResults.filter(
    (r) => fuzzyMatchMeta.get(r.item_id)?.type === "synonym"
  ).length;

  // Get unique synonyms used
  const synonymsUsed = new Map<string, string>();
  for (const r of fuzzyResults) {
    const meta = fuzzyMatchMeta.get(r.item_id);
    if (meta?.type === "synonym" && meta.synonymOf) {
      synonymsUsed.set(meta.synonymOf, meta.matchedQuery);
    }
  }

  const diagStyle: React.CSSProperties = {
    padding: "6px 16px",
    fontSize: 11,
    lineHeight: 1.5,
    color: "var(--text-dim)",
    borderBottom: "1px solid var(--border)",
    background: "rgba(255,255,255,0.02)",
    display: "flex",
    flexWrap: "wrap",
    gap: "6px 12px",
    alignItems: "center",
  };

  const tagStyle = (color: string): React.CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 3,
    padding: "1px 6px",
    borderRadius: 4,
    fontSize: 10,
    fontWeight: 600,
    background: color + "18",
    color,
    border: `1px solid ${color}30`,
  });

  if (noResults) {
    return (
      <div style={diagStyle}>
        <span style={tagStyle("#f44336")}>No matches</span>
        <span>
          Neither fuzzy search nor AI found results for "{query}"
        </span>
      </div>
    );
  }

  return (
    <div style={diagStyle}>
      {exactCount > 0 && (
        <span style={tagStyle("#4caf50")}>
          {exactCount} exact
        </span>
      )}
      {fuzzyCount > 0 && (
        <span style={tagStyle("#ff9800")}>
          {fuzzyCount} fuzzy
        </span>
      )}
      {synonymCount > 0 && (
        <span style={tagStyle("#2196f3")}>
          {synonymCount} synonym
        </span>
      )}
      {synonymsUsed.size > 0 && (
        <span>
          {[...synonymsUsed.entries()]
            .map(([orig, expanded]) => `"${orig}" → "${expanded}"`)
            .join(", ")}
        </span>
      )}
      {aiState.loading && (
        <span style={tagStyle("#9c27b0")}>
          <span className="ai-spinner" /> AI thinking...
        </span>
      )}
      {hasAi && (
        <span style={tagStyle("#9c27b0")}>
          +{aiState.results.length} AI
        </span>
      )}
      {!hasFuzzy && !hasAi && aiState.loading && (
        <span>No fuzzy matches — waiting for AI...</span>
      )}
    </div>
  );
}

// Map room names → 3D model IDs used in house-3d.html
const ROOM_NAME_TO_3D: Record<string, string> = {
  'Kitchen': 'r1', 'Basement': 'r2', 'Garage': 'r3', 'Master Bedroom': 'r4',
  'Living Room': 'r5', 'Work Hallway': 'r6', 'Foyer': 'r7', 'Bathroom': 'r8',
  "Baby's Room": 'r9', 'Upstairs Hallway': 'r10', 'Bath Corridor': 'r11',
  'Bath Alcove': 'r12', 'Walk-in Closet': 'r13', 'Baby Closet': 'r14', 'Balcony': 'r15',
};

export default function HousePage() {
  const {
    rooms,
    searchQuery,
    searchResults,
    activeRoomId,
    setActiveRoomId,
    loading,
    aiSearchState,
    fuzzyMatchMeta,
    inputValue,
    handleSearch,
    searchRef,
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
      const hash = window.location.hash.slice(1);
      if (hash) {
        iframeRef.current.contentWindow.postMessage({ type: "setCameraState", hash }, "*");
      }
    }
  }, []);

  // Push Supabase items to 3D iframe when rooms data arrives
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
  const allResults = [...searchResults, ...aiSearchState.results];
  useEffect(() => {
    if (iframeReady && iframeRef.current?.contentWindow) {
      if (allResults.length > 0) {
        const zones = [...new Set(
          allResults
            .map((r) => r.item_location?.split("|")[0].trim())
            .filter((z) => z && z !== "undefined")
        )];
        const itemNames = allResults.map((r) => r.item_name);
        const fallbackRoomId = to3dId(allResults[0].room_id);
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
  }, [searchResults, aiSearchState.results, searchQuery, iframeReady]);

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
        <h2 style={{ fontSize: 20, marginBottom: 8 }}>Welcome to HomeBase</h2>
        <p style={{ color: "var(--text-dim)", fontSize: 13, maxWidth: 400, lineHeight: 1.6 }}>
          Your searchable 3D home inventory. Head to Admin to set up your rooms,
          or connect Supabase and run the setup SQL to get started with demo data.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Top bar with search */}
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

      {/* Search diagnostics bar */}
      {inputValue.trim() && (
        <SearchDiagnostics
          query={inputValue}
          fuzzyResults={searchResults}
          fuzzyMatchMeta={fuzzyMatchMeta}
          aiState={aiSearchState}
        />
      )}

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
          {(searchResults.length > 0 || aiSearchState.results.length > 0 || aiSearchState.loading) && (
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
              {searchResults.length > 0 && (
                <>
                  <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 8 }}>
                    Found {searchResults.length} {searchResults.length === 1 ? "item" : "items"}
                  </div>
                  {searchResults.map((result) => {
                    const meta = fuzzyMatchMeta.get(result.item_id);
                    return (
                      <div
                        key={result.item_id}
                        style={{
                          padding: "8px 0",
                          borderBottom: "1px solid var(--border)",
                          cursor: "pointer",
                        }}
                        onClick={() => handleSearchResultClick(result.room_id)}
                      >
                        <div style={{ fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                          {result.item_name}
                          {meta?.type === "fuzzy" && (
                            <span style={{ fontSize: 9, padding: "1px 4px", borderRadius: 3, background: "#ff980018", color: "#ff9800", border: "1px solid #ff980030", fontWeight: 600 }}>
                              fuzzy
                            </span>
                          )}
                          {meta?.type === "synonym" && (
                            <span style={{ fontSize: 9, padding: "1px 4px", borderRadius: 3, background: "#2196f318", color: "#2196f3", border: "1px solid #2196f330", fontWeight: 600 }}>
                              synonym
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>
                          {result.room_name} &middot; {result.item_location}
                        </div>
                        {meta?.type === "synonym" && meta.synonymOf && (
                          <div style={{ fontSize: 10, color: "#2196f3", marginTop: 2, fontStyle: "italic" }}>
                            "{meta.synonymOf}" → "{meta.matchedQuery}"
                          </div>
                        )}
                        {meta?.type === "fuzzy" && (
                          <div style={{ fontSize: 10, color: "#ff9800", marginTop: 2, fontStyle: "italic" }}>
                            fuzzy match ({Math.round(meta.score * 100)}% confidence)
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
              )}

              {/* AI suggestions section */}
              {aiSearchState.loading && (
                <div className="ai-suggestion-section" style={{ padding: "8px 0", fontSize: 12, color: "var(--text-dim)" }}>
                  <span className="ai-spinner" /> Asking AI for suggestions...
                </div>
              )}
              {!aiSearchState.loading && aiSearchState.results.length > 0 && (
                <>
                  <div className="ai-suggestion-section" style={{ fontSize: 11, color: "var(--accent)", marginTop: searchResults.length > 0 ? 8 : 0, marginBottom: 8 }}>
                    AI Suggestions
                  </div>
                  {aiSearchState.results.map((result) => (
                    <div
                      key={result.item_id}
                      style={{
                        padding: "8px 0",
                        borderBottom: "1px solid var(--border)",
                        cursor: "pointer",
                      }}
                      onClick={() => handleSearchResultClick(result.room_id)}
                    >
                      <div style={{ fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                        {result.item_name}
                        <span className="ai-badge-tag">AI</span>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>
                        {result.room_name} &middot; {result.item_location}
                      </div>
                      {aiSearchState.reasons.get(result.item_id) && (
                        <div style={{ fontSize: 10, color: "var(--accent)", marginTop: 2, fontStyle: "italic" }}>
                          {aiSearchState.reasons.get(result.item_id)}
                        </div>
                      )}
                    </div>
                  ))}
                </>
              )}
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
