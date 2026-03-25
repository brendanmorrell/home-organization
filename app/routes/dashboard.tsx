import { Link, useOutletContext } from "react-router";
import type { RoomWithFrames } from "~/lib/supabase";

interface LayoutContext {
  rooms: RoomWithFrames[];
  loading: boolean;
}

const modules = [
  {
    key: "house",
    label: "House (3D)",
    icon: "\u{1F3E0}",
    to: "/house",
    color: "#5c6bc0",
    active: true,
  },
  {
    key: "inventory",
    label: "Inventory",
    icon: "\u{1F4CB}",
    to: "/inventory",
    color: "#8d6e63",
    active: true,
  },
  {
    key: "todos",
    label: "To-dos",
    icon: "\u2705",
    to: "/todos",
    color: "#66bb6a",
    active: false,
  },
  {
    key: "weekly",
    label: "Weekly",
    icon: "\u{1F6D2}",
    to: "/weekly",
    color: "#ffb74d",
    active: false,
  },
  {
    key: "vehicles",
    label: "Vehicles",
    icon: "\u{1F697}",
    to: "/vehicles",
    color: "#78909c",
    active: false,
  },
  {
    key: "docs",
    label: "Documents",
    icon: "\u{1F4C1}",
    to: "/docs",
    color: "#ab47bc",
    active: false,
  },
];

export default function DashboardPage() {
  const { rooms, loading } = useOutletContext<LayoutContext>();

  const totalItems = rooms.reduce(
    (sum, r) => sum + r.frames.reduce((s, f) => s + f.items.length, 0),
    0
  );

  if (loading) {
    return (
      <div className="dashboard-page">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-dim)" }}>
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <h2>Welcome to HomeBase</h2>
        <p>Your home, organized</p>
      </div>

      <div className="module-grid">
        {modules.map((mod) => {
          let stat = "";
          if (mod.key === "house") stat = `${rooms.length} rooms`;
          else if (mod.key === "inventory") stat = `${totalItems} items`;

          return (
            <Link key={mod.key} to={mod.to} className="module-card">
              <div
                className="module-icon"
                style={{ background: `${mod.color}22`, color: mod.color }}
              >
                {mod.icon}
              </div>
              <div className="module-info">
                <span className="module-label">{mod.label}</span>
                {mod.active ? (
                  stat && <span className="module-stat">{stat}</span>
                ) : (
                  <span className="module-coming-soon">Coming Soon</span>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      <div className="dashboard-section">
        <h3>Due Soon</h3>
        <div className="dashboard-empty-timeline">
          <p>Set up your modules to see upcoming items here</p>
          <div className="dashboard-quick-links">
            <Link to="/house" className="btn btn-sm">Open House View</Link>
            <Link to="/inventory" className="btn btn-sm">Browse Inventory</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
