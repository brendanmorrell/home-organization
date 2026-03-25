import { useState, useEffect } from "react";
import { useParams, useOutletContext, Link } from "react-router";
import type { RoomWithFrames, SearchResult, FrameWithItems } from "~/lib/supabase";

interface LayoutContext {
  rooms: RoomWithFrames[];
  searchQuery: string;
  searchResults: SearchResult[];
}

export default function RoomDetailPage() {
  const { roomId } = useParams();
  const { rooms, searchQuery, searchResults } = useOutletContext<LayoutContext>();
  const [selectedFrame, setSelectedFrame] = useState<FrameWithItems | null>(null);

  const room = rooms.find((r) => r.id === roomId);

  if (!room) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-dim)" }}>
        Room not found
      </div>
    );
  }

  const q = searchQuery.toLowerCase();

  return (
    <>
      <div style={{ padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: room.color,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              fontWeight: 600,
            }}
          >
            {room.icon}
          </div>
          <div>
            <h2 style={{ fontSize: 18 }}>{room.name}</h2>
            <p style={{ fontSize: 12, color: "var(--text-dim)" }}>
              {room.frames.length} frames &middot;{" "}
              {room.frames.reduce((s, f) => s + f.items.length, 0)} items
            </p>
          </div>
          <Link
            to={`/house?room=${room.id}`}
            className="btn btn-sm"
            style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}
          >
            <span style={{ fontSize: 14 }}>&#x1F3E0;</span> View in 3D
          </Link>
        </div>

        {/* Show frames with images as cards, or if all local, show item list */}
        {room.frames.some((f) => f.image_url) ? (
          <div className="frame-grid">
            {room.frames.filter((f) => f.image_url).map((frame) => {
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
                  onClick={() => setSelectedFrame(frame)}
                >
                  <div className="frame-img-wrap">
                    <img src={frame.image_url!} alt={`Frame ${frame.timestamp}`} />
                    <span className="frame-time">{frame.timestamp}</span>
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
            })}
          </div>
        ) : (
          /* All items are from local inventory — show a clean item list */
          <div className="room-items-list">
            {room.frames.flatMap((f) => f.items).map((item) => {
              const isMatch =
                q &&
                (item.name.toLowerCase().includes(q) ||
                  item.location.toLowerCase().includes(q));
              return (
                <div
                  key={item.id}
                  className={`room-item-row ${isMatch ? "match" : ""}`}
                >
                  <span className="room-item-name">{item.name}</span>
                  <span className="room-item-loc">{item.location}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Frame detail overlay */}
      {selectedFrame && (
        <div className="detail-overlay" onClick={() => setSelectedFrame(null)}>
          <button className="detail-close" onClick={() => setSelectedFrame(null)}>
            &times;
          </button>
          <div className="detail-panel" onClick={(e) => e.stopPropagation()}>
            <div
              style={{
                position: "relative",
                width: "100%",
                paddingTop: "56.25%",
                background: "var(--bg)",
                borderRadius: "14px 14px 0 0",
                overflow: "hidden",
              }}
            >
              {selectedFrame.image_url ? (
                <img
                  src={selectedFrame.image_url}
                  alt=""
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
              ) : (
                <div
                  className="placeholder-img"
                  style={{
                    background: `linear-gradient(135deg, ${room.color}, ${room.color}cc)`,
                    borderRadius: "14px 14px 0 0",
                  }}
                >
                  <span className="emoji">&#x1F4F7;</span>
                  <span className="label">{room.name}</span>
                </div>
              )}
            </div>
            <div className="detail-body">
              <h3>
                {room.name} &middot; {selectedFrame.timestamp}
              </h3>
              <ul className="detail-items-list">
                {selectedFrame.items.map((item) => (
                  <li key={item.id}>
                    <span>{item.name}</span>
                    <span className="loc">{item.location}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
