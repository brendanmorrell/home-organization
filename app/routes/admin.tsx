import { useState, useRef, useCallback, useEffect } from "react";
import { useOutletContext } from "react-router";
import {
  createRoom,
  createFrame,
  createItems,
  supabase,
  type RoomWithFrames,
  fetchAllRoomsWithFrames,
} from "~/lib/supabase";

interface LayoutContext {
  rooms: RoomWithFrames[];
  setRooms: (rooms: RoomWithFrames[]) => void;
}

// ---- 2D Floor Plan Editor ----

const GRID_SIZE = 20;
const CELL_PX = 32;

function FloorPlanEditor({
  rooms,
  onUpdateRoom,
}: {
  rooms: RoomWithFrames[];
  onUpdateRoom: (id: string, updates: { pos_x: number; pos_z: number }) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const toCanvas = (worldX: number, worldZ: number) => ({
    x: (worldX + GRID_SIZE / 2) * CELL_PX,
    y: (worldZ + GRID_SIZE / 2) * CELL_PX,
  });

  const toWorld = (canvasX: number, canvasY: number) => ({
    x: canvasX / CELL_PX - GRID_SIZE / 2,
    z: canvasY / CELL_PX - GRID_SIZE / 2,
  });

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = GRID_SIZE * CELL_PX;
    const h = GRID_SIZE * CELL_PX;
    canvas.width = w;
    canvas.height = h;

    // Background
    ctx.fillStyle = "#0f1117";
    ctx.fillRect(0, 0, w, h);

    // Grid
    ctx.strokeStyle = "#1a1d27";
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= GRID_SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(i * CELL_PX, 0);
      ctx.lineTo(i * CELL_PX, h);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * CELL_PX);
      ctx.lineTo(w, i * CELL_PX);
      ctx.stroke();
    }

    // Major grid lines
    ctx.strokeStyle = "#2e3345";
    ctx.lineWidth = 1;
    for (let i = 0; i <= GRID_SIZE; i += 5) {
      ctx.beginPath();
      ctx.moveTo(i * CELL_PX, 0);
      ctx.lineTo(i * CELL_PX, h);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * CELL_PX);
      ctx.lineTo(w, i * CELL_PX);
      ctx.stroke();
    }

    // Rooms
    rooms.forEach((room) => {
      const pos = toCanvas(room.pos_x, room.pos_z);
      const rw = room.width * CELL_PX;
      const rd = room.depth * CELL_PX;

      // Room fill
      ctx.fillStyle = room.color + "40";
      ctx.fillRect(pos.x - rw / 2, pos.y - rd / 2, rw, rd);

      // Room border
      ctx.strokeStyle = room.color;
      ctx.lineWidth = 2;
      ctx.strokeRect(pos.x - rw / 2, pos.y - rd / 2, rw, rd);

      // Room label
      ctx.fillStyle = "#e4e6f0";
      ctx.font = "bold 12px -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(room.name, pos.x, pos.y - 6);

      const itemCount = room.frames.reduce(
        (s, f) => s + f.items.length,
        0
      );
      ctx.fillStyle = "#8b8fa3";
      ctx.font = "10px -apple-system, sans-serif";
      ctx.fillText(`${itemCount} items`, pos.x, pos.y + 8);
    });
  }, [rooms]);

  useEffect(() => {
    draw();
  }, [draw]);

  const handleMouseDown = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    for (const room of rooms) {
      const pos = toCanvas(room.pos_x, room.pos_z);
      const rw = room.width * CELL_PX;
      const rd = room.depth * CELL_PX;

      if (
        mx >= pos.x - rw / 2 &&
        mx <= pos.x + rw / 2 &&
        my >= pos.y - rd / 2 &&
        my <= pos.y + rd / 2
      ) {
        setDragging(room.id);
        setDragOffset({ x: mx - pos.x, y: my - pos.y });
        break;
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left - dragOffset.x;
    const my = e.clientY - rect.top - dragOffset.y;
    const world = toWorld(mx, my);

    // Snap to 0.5 grid
    const snappedX = Math.round(world.x * 2) / 2;
    const snappedZ = Math.round(world.z * 2) / 2;

    onUpdateRoom(dragging, { pos_x: snappedX, pos_z: snappedZ });
  };

  const handleMouseUp = () => {
    setDragging(null);
  };

  return (
    <div>
      <p style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 8 }}>
        Drag rooms to match your actual house layout. Positions are saved to Supabase.
      </p>
      <canvas
        ref={canvasRef}
        style={{
          border: "1px solid var(--border)",
          borderRadius: 8,
          cursor: dragging ? "grabbing" : "grab",
          maxWidth: "100%",
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
    </div>
  );
}

// ---- Room Editor Row ----

function RoomEditor({
  room,
  onUpdate,
}: {
  room: RoomWithFrames;
  onUpdate: (id: string, field: string, value: any) => void;
}) {
  const itemCount = room.frames.reduce((s, f) => s + f.items.length, 0);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 0",
        borderBottom: "1px solid var(--border)",
        fontSize: 13,
      }}
    >
      <input
        type="color"
        value={room.color}
        onChange={(e) => onUpdate(room.id, "color", e.target.value)}
        style={{ width: 28, height: 28, border: "none", borderRadius: 4, cursor: "pointer" }}
      />
      <span style={{ flex: 1, fontWeight: 500 }}>{room.name}</span>
      <span style={{ color: "var(--text-dim)", fontSize: 11 }}>
        {room.frames.length} frames &middot; {itemCount} items
      </span>
      <label style={{ fontSize: 11, color: "var(--text-dim)" }}>
        W
        <input
          type="number"
          value={room.width}
          onChange={(e) => onUpdate(room.id, "width", parseFloat(e.target.value))}
          style={{
            width: 40,
            marginLeft: 4,
            padding: "2px 4px",
            background: "var(--bg)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            color: "var(--text)",
            fontSize: 11,
          }}
        />
      </label>
      <label style={{ fontSize: 11, color: "var(--text-dim)" }}>
        D
        <input
          type="number"
          value={room.depth}
          onChange={(e) => onUpdate(room.id, "depth", parseFloat(e.target.value))}
          style={{
            width: 40,
            marginLeft: 4,
            padding: "2px 4px",
            background: "var(--bg)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            color: "var(--text)",
            fontSize: 11,
          }}
        />
      </label>
      <label style={{ fontSize: 11, color: "var(--text-dim)" }}>
        H
        <input
          type="number"
          value={room.height}
          onChange={(e) => onUpdate(room.id, "height", parseFloat(e.target.value))}
          style={{
            width: 40,
            marginLeft: 4,
            padding: "2px 4px",
            background: "var(--bg)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            color: "var(--text)",
            fontSize: 11,
          }}
        />
      </label>
    </div>
  );
}

// ---- Main Admin Page ----

export default function AdminPage() {
  const { rooms, setRooms } = useOutletContext<LayoutContext>();
  const [importJson, setImportJson] = useState("");
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"layout" | "import" | "cowork">("layout");

  // Update room position from floor plan drag
  const handleUpdateRoomPosition = useCallback(
    (id: string, updates: { pos_x: number; pos_z: number }) => {
      setRooms(
        rooms.map((r) => (r.id === id ? { ...r, ...updates } : r))
      );
    },
    [rooms, setRooms]
  );

  // Update room field
  const handleUpdateRoom = useCallback(
    (id: string, field: string, value: any) => {
      setRooms(
        rooms.map((r) => (r.id === id ? { ...r, [field]: value } : r))
      );
    },
    [rooms, setRooms]
  );

  // Save layout to Supabase
  const handleSaveLayout = async () => {
    setSaving(true);
    setMessage("");
    try {
      for (const room of rooms) {
        await supabase
          .from("rooms")
          .update({
            pos_x: room.pos_x,
            pos_y: room.pos_y,
            pos_z: room.pos_z,
            width: room.width,
            depth: room.depth,
            height: room.height,
            color: room.color,
          })
          .eq("id", room.id);
      }
      setMessage("Layout saved!");
    } catch (err: any) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Bulk import from JSON
  const handleImport = async () => {
    setImporting(true);
    setMessage("");

    try {
      const data = JSON.parse(importJson);

      if (data.rooms && Array.isArray(data.rooms)) {
        for (const roomData of data.rooms) {
          const room = await createRoom({
            name: roomData.name,
            icon: roomData.icon || roomData.name[0],
            pos_x: roomData.pos_x || 0,
            pos_y: roomData.pos_y || 0,
            pos_z: roomData.pos_z || 0,
            width: roomData.width || 4,
            depth: roomData.depth || 4,
            height: roomData.height || 2.7,
            color: roomData.color || "#4a5568",
            sort_order: roomData.sort_order || 0,
          });

          if (roomData.frames && Array.isArray(roomData.frames)) {
            for (const frameData of roomData.frames) {
              const frame = await createFrame({
                room_id: room.id,
                image_url: frameData.image_url || null,
                timestamp: frameData.timestamp || null,
                sort_order: frameData.sort_order || 0,
              });

              if (frameData.items && Array.isArray(frameData.items)) {
                await createItems(
                  frameData.items.map((item: any) => ({
                    frame_id: frame.id,
                    name: item.name,
                    location: item.location,
                    pin_x: item.pin_x || null,
                    pin_y: item.pin_y || null,
                    pin_z: item.pin_z || null,
                  }))
                );
              }
            }
          }
        }
      }

      const updated = await fetchAllRoomsWithFrames();
      setRooms(updated);
      setMessage(`Imported ${data.rooms?.length || 0} rooms successfully.`);
      setImportJson("");
    } catch (err: any) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div style={{ padding: 20, maxWidth: 800 }}>
      <h2 style={{ fontSize: 18, marginBottom: 16 }}>Admin</h2>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
        {(["layout", "import", "cowork"] as const).map((tab) => (
          <button
            key={tab}
            className={`btn ${activeTab === tab ? "btn-primary" : ""}`}
            onClick={() => setActiveTab(tab)}
            style={{ textTransform: "capitalize" }}
          >
            {tab === "layout" ? "Floor Plan" : tab === "import" ? "Import Data" : "Cowork Setup"}
          </button>
        ))}
      </div>

      {/* Layout tab */}
      {activeTab === "layout" && (
        <>
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: 16,
              marginBottom: 16,
            }}
          >
            <h3 style={{ fontSize: 14, marginBottom: 12 }}>Floor Plan Layout</h3>
            <FloorPlanEditor
              rooms={rooms}
              onUpdateRoom={handleUpdateRoomPosition}
            />
          </div>

          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: 16,
              marginBottom: 16,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <h3 style={{ fontSize: 14 }}>Room Properties</h3>
              <button
                className="btn btn-primary"
                onClick={handleSaveLayout}
                disabled={saving}
                style={{ opacity: saving ? 0.5 : 1 }}
              >
                {saving ? "Saving..." : "Save Layout"}
              </button>
            </div>
            {message && (
              <div style={{ fontSize: 12, marginBottom: 8, color: message.startsWith("Error") ? "#ef5350" : "var(--success)" }}>
                {message}
              </div>
            )}
            {rooms.map((room) => (
              <RoomEditor
                key={room.id}
                room={room}
                onUpdate={handleUpdateRoom}
              />
            ))}
            {rooms.length === 0 && (
              <p style={{ fontSize: 13, color: "var(--text-dim)", padding: "12px 0" }}>
                No rooms yet. Import data or have Claude catalog a room from Cowork.
              </p>
            )}
          </div>
        </>
      )}

      {/* Import tab */}
      {activeTab === "import" && (
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: 16,
          }}
        >
          <h3 style={{ fontSize: 14, marginBottom: 8 }}>Import from JSON</h3>
          <p style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 12, lineHeight: 1.5 }}>
            Paste the JSON that Claude generates after analyzing your video frames.
          </p>
          <textarea
            value={importJson}
            onChange={(e) => setImportJson(e.target.value)}
            placeholder='{"rooms": [{"name": "Kitchen", "icon": "K", "frames": [...]}]}'
            style={{
              width: "100%",
              minHeight: 200,
              padding: "10px 12px",
              borderRadius: 7,
              border: "1px solid var(--border)",
              background: "var(--bg)",
              color: "var(--text)",
              fontFamily: "monospace",
              fontSize: 12,
              resize: "vertical",
            }}
            spellCheck={false}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
            <button
              className="btn btn-primary"
              onClick={handleImport}
              disabled={importing || !importJson.trim()}
              style={{ opacity: importing || !importJson.trim() ? 0.5 : 1 }}
            >
              {importing ? "Importing..." : "Import"}
            </button>
            {message && (
              <span style={{ fontSize: 12, color: message.startsWith("Error") ? "#ef5350" : "var(--success)" }}>
                {message}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Cowork setup tab */}
      {activeTab === "cowork" && (
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: 16,
          }}
        >
          <h3 style={{ fontSize: 14, marginBottom: 8 }}>Cowork Integration</h3>
          <p style={{ fontSize: 12, color: "var(--text-dim)", lineHeight: 1.6, marginBottom: 16 }}>
            Claude in Cowork can push inventory data directly to this database.
            The workflow is:
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              { step: "1", text: "Record a video walkthrough of a room" },
              { step: "2", text: "Drop the video into Cowork" },
              { step: "3", text: 'Say "This is my kitchen — catalog everything"' },
              { step: "4", text: "Claude extracts frames, identifies items, and pushes to Supabase" },
              { step: "5", text: "Refresh this app to see the new data in 3D" },
            ].map((s) => (
              <div key={s.step} style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    background: "var(--accent)",
                    color: "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  {s.step}
                </span>
                <span style={{ fontSize: 13 }}>{s.text}</span>
              </div>
            ))}
          </div>

          <div
            style={{
              background: "var(--bg)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              padding: "12px 14px",
              fontSize: 12,
              fontFamily: "monospace",
              marginTop: 16,
            }}
          >
            <div style={{ color: "var(--text-dim)", marginBottom: 4 }}>Example prompt:</div>
            <div style={{ color: "var(--accent)" }}>
              "These frames are from my kitchen. Catalog the items and push them to
              my home-navigator Supabase."
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
