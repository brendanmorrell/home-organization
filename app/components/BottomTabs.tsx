import { Link, useLocation } from "react-router";
import { useState } from "react";

const tabs = [
  { label: "Todos", icon: "\u2705", to: "/" },
  { label: "Home", icon: "\u{1F3E0}", to: "/dashboard" },
  { label: "House", icon: "3D", to: "/house" },
  { label: "Items", icon: "\u{1F4CB}", to: "/inventory" },
];

const moreItems = [
  { label: "Block Map", icon: "\u{1F3D8}", to: "/neighborhood" },
  { label: "Vehicles", icon: "\u{1F697}", to: "/vehicles" },
  { label: "Documents", icon: "\u{1F4C1}", to: "/docs" },
  { label: "Org Plan", icon: "\u{1F5FA}", to: "/plan" },
  { label: "Admin", icon: "+", to: "/admin" },
];

export default function BottomTabs() {
  const location = useLocation();
  const [showMore, setShowMore] = useState(false);

  const isMoreActive = moreItems.some((item) => location.pathname === item.to);

  return (
    <>
      {/* More slide-up sheet */}
      {showMore && (
        <div className="bottom-sheet-overlay" onClick={() => setShowMore(false)}>
          <div className="bottom-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="bottom-sheet-handle" />
            {moreItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`bottom-sheet-item ${location.pathname === item.to ? "active" : ""}`}
                onClick={() => setShowMore(false)}
              >
                <span className="bottom-sheet-icon">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <nav className="bottom-tabs">
        {tabs.map((tab) => (
          <Link
            key={tab.to}
            to={tab.to}
            className={`bottom-tab ${location.pathname === tab.to ? "active" : ""}`}
          >
            <span className="bottom-tab-icon">{tab.icon}</span>
            <span className="bottom-tab-label">{tab.label}</span>
          </Link>
        ))}
        <button
          className={`bottom-tab ${isMoreActive ? "active" : ""}`}
          onClick={() => setShowMore(!showMore)}
        >
          <span className="bottom-tab-icon">{"\u2026"}</span>
          <span className="bottom-tab-label">More</span>
        </button>
      </nav>
    </>
  );
}
