import { Link, useLocation } from "react-router";
import type { RoomWithFrames } from "~/lib/supabase";
import { useState } from "react";

interface SidebarProps {
  rooms: RoomWithFrames[];
  activeRoomId: string | null;
  setActiveRoomId: (id: string | null) => void;
  totalItems: number;
}

export default function Sidebar({
  rooms,
  activeRoomId,
  setActiveRoomId,
  totalItems,
}: SidebarProps) {
  const location = useLocation();
  const [roomsExpanded, setRoomsExpanded] = useState(false);

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h1>HomeBase</h1>
        <p>Your home, organized</p>
      </div>
      <div className="sidebar-nav">
        <div className="nav-section">Navigate</div>
        <Link
          to="/dashboard"
          className={`nav-item ${location.pathname === "/dashboard" ? "active" : ""}`}
          onClick={() => setActiveRoomId(null)}
        >
          <span className="icon">{"\u{1F3E0}"}</span>
          <span>Dashboard</span>
        </Link>
        <Link
          to="/house"
          className={`nav-item ${location.pathname === "/house" ? "active" : ""}`}
          onClick={() => setActiveRoomId(null)}
        >
          <span className="icon">3D</span>
          <span>House View</span>
        </Link>
        <Link
          to="/inventory"
          className={`nav-item ${location.pathname === "/inventory" ? "active" : ""}`}
        >
          <span className="icon">{"\u{1F4CB}"}</span>
          <span>Inventory</span>
          <span className="count">{totalItems}</span>
        </Link>

        {/* Active room (if on a room page) */}
        {(() => {
          const activeRoom = rooms.find(
            (r) => location.pathname === `/rooms/${r.id}`
          );
          if (activeRoom) {
            const activeCount = activeRoom.frames.reduce(
              (s, f) => s + f.items.length,
              0
            );
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
          onClick={() => setRoomsExpanded((prev) => !prev)}
        >
          <span>Rooms ({rooms.length})</span>
          <span className={`toggle-arrow ${roomsExpanded ? "open" : ""}`}>
            &#x25B8;
          </span>
        </button>
        {roomsExpanded &&
          rooms.map((room) => {
            const itemCount = room.frames.reduce(
              (s, f) => s + f.items.length,
              0
            );
            const isActive = location.pathname === `/rooms/${room.id}`;
            return (
              <Link
                key={room.id}
                to={`/rooms/${room.id}`}
                className={`nav-item nav-item-compact ${isActive ? "active" : ""}`}
                onClick={() => setActiveRoomId(room.id)}
              >
                <span className="icon">{room.icon}</span>
                <span>{room.name}</span>
                <span className="count">{itemCount}</span>
              </Link>
            );
          })}

        <div className="nav-section">Modules</div>
        <Link
          to="/references"
          className={`nav-item ${location.pathname === "/references" ? "active" : ""}`}
        >
          <span className="icon">{"\u{1F4D1}"}</span>
          <span>References</span>
        </Link>
        <Link
          to="/"
          className={`nav-item ${location.pathname === "/" ? "active" : ""}`}
        >
          <span className="icon">{"\u2705"}</span>
          <span>To-dos</span>
        </Link>
        <Link
          to="/vehicles"
          className={`nav-item ${location.pathname === "/vehicles" ? "active" : ""}`}
        >
          <span className="icon">{"\u{1F697}"}</span>
          <span>Vehicles</span>
          <span className="count coming-soon-badge">Soon</span>
        </Link>
        <Link
          to="/docs"
          className={`nav-item ${location.pathname === "/docs" ? "active" : ""}`}
        >
          <span className="icon">{"\u{1F4C1}"}</span>
          <span>Documents</span>
          <span className="count coming-soon-badge">Soon</span>
        </Link>

        <div className="nav-section">Briefs</div>
        {[
          { label: "Travel", context: "travel" },
          { label: "Grocery", context: "grocery" },
          { label: "Weekend", context: "weekend" },
        ].map((brief) => (
          <Link
            key={brief.context}
            to={`/brief?context=${brief.context}`}
            className={`nav-item nav-item-compact ${
              location.pathname === "/brief" &&
              location.search.includes(`context=${brief.context}`)
                ? "active"
                : ""
            }`}
          >
            <span className="icon" style={{ fontSize: "11px" }}>{brief.context === "travel" ? "\u2708" : brief.context === "grocery" ? "\u{1F6D2}" : "\u{1F324}"}</span>
            <span>{brief.label}</span>
          </Link>
        ))}

        <div className="nav-section">Manage</div>
        <Link
          to="/plan"
          className={`nav-item ${location.pathname === "/plan" ? "active" : ""}`}
        >
          <span className="icon">{"\u{1F5FA}"}</span>
          <span>Org Plan</span>
        </Link>
        <Link
          to="/neighborhood"
          className={`nav-item ${location.pathname === "/neighborhood" ? "active" : ""}`}
        >
          <span className="icon">{"\u{1F3D8}"}</span>
          <span>Block Map</span>
        </Link>
        <Link
          to="/admin"
          className={`nav-item ${location.pathname === "/admin" ? "active" : ""}`}
        >
          <span className="icon">+</span>
          <span>Admin</span>
        </Link>
      </div>
    </div>
  );
}
