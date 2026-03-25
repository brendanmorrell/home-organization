import { Link } from "react-router";
import type { RoomWithFrames } from "~/lib/supabase";

interface RoomPanelProps {
  roomId: string;
  rooms: RoomWithFrames[];
  open: boolean;
  onClose: () => void;
}

export default function RoomPanel({ roomId, rooms, open, onClose }: RoomPanelProps) {
  if (!open) return null;

  const room = rooms.find((r) => r.id === roomId);
  if (!room) return null;

  const allItems = room.frames.flatMap((f) => f.items);

  return (
    <div className={`room-panel ${open ? "open" : ""}`}>
      <div className="room-panel-header">
        <div className="room-panel-title">
          <div
            className="room-panel-icon"
            style={{ background: room.color }}
          >
            {room.icon}
          </div>
          <div>
            <h3>{room.name}</h3>
            <span className="room-panel-count">{allItems.length} items</span>
          </div>
        </div>
        <button className="room-panel-close" onClick={onClose}>
          &times;
        </button>
      </div>

      <div className="room-panel-items">
        {allItems.length === 0 ? (
          <p className="room-panel-empty">No items cataloged in this room yet.</p>
        ) : (
          allItems.map((item) => (
            <div key={item.id} className="room-panel-item">
              <span className="room-panel-item-name">{item.name}</span>
              <span className="room-panel-item-loc">{item.location}</span>
            </div>
          ))
        )}
      </div>

      <div className="room-panel-actions">
        <Link to={`/rooms/${roomId}`} className="btn btn-sm" onClick={onClose}>
          View Full Room
        </Link>
      </div>

      <div className="room-panel-modules">
        <div className="room-panel-module-placeholder">
          <span className="room-panel-module-title">To-dos in this room</span>
          <span className="module-coming-soon">Coming Soon</span>
        </div>
        <div className="room-panel-module-placeholder">
          <span className="room-panel-module-title">Supplies stored here</span>
          <span className="module-coming-soon">Coming Soon</span>
        </div>
      </div>
    </div>
  );
}
