import { useState } from "react";
import { useOutletContext } from "react-router";
import {
  createRoom,
  createFrame,
  createItems,
  type RoomWithFrames,
  fetchAllRoomsWithFrames,
} from "~/lib/supabase";

interface LayoutContext {
  rooms: RoomWithFrames[];
  setRooms: (rooms: RoomWithFrames[]) => void;
}

export default function AdminPage() {
  const { rooms, setRooms } = useOutletContext<LayoutContext>();
  const [importJson, setImportJson] = useState("");
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState("");

  // Bulk import from JSON (what Claude outputs)
  const handleImport = async () => {
    setImporting(true);
    setMessage("");

    try {
      const data = JSON.parse(importJson);

      if (data.rooms && Array.isArray(data.rooms)) {
        for (const roomData of data.rooms) {
          // Create the room
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

          // Create frames and items
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

      // Refresh data
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
    <div style={{ padding: 20, maxWidth: 700 }}>
      <h2 style={{ fontSize: 18, marginBottom: 20 }}>Admin</h2>

      {/* Current rooms summary */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          padding: 16,
          marginBottom: 24,
        }}
      >
        <h3 style={{ fontSize: 14, marginBottom: 12 }}>Current Inventory</h3>
        {rooms.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--text-dim)" }}>
            No rooms yet. Import data below or have Claude push data from Cowork.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {rooms.map((room) => (
              <div
                key={room.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  fontSize: 13,
                }}
              >
                <span
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    background: room.color,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                  }}
                >
                  {room.icon}
                </span>
                <span>{room.name}</span>
                <span style={{ color: "var(--text-dim)", marginLeft: "auto" }}>
                  {room.frames.length} frames &middot;{" "}
                  {room.frames.reduce((s, f) => s + f.items.length, 0)} items
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Import section */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          padding: 16,
          marginBottom: 24,
        }}
      >
        <h3 style={{ fontSize: 14, marginBottom: 8 }}>Import from JSON</h3>
        <p style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 12, lineHeight: 1.5 }}>
          Paste the JSON that Claude generates after analyzing your video frames.
          This will add the rooms, frames, and items to your database.
        </p>
        <textarea
          value={importJson}
          onChange={(e) => setImportJson(e.target.value)}
          placeholder='{"rooms": [{"name": "Kitchen", "icon": "K", "frames": [...]}]}'
          style={{
            width: "100%",
            minHeight: 160,
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
            <span
              style={{
                fontSize: 12,
                color: message.startsWith("Error") ? "#ef5350" : "var(--success)",
              }}
            >
              {message}
            </span>
          )}
        </div>
      </div>

      {/* Cowork integration info */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          padding: 16,
        }}
      >
        <h3 style={{ fontSize: 14, marginBottom: 8 }}>Cowork Integration</h3>
        <p style={{ fontSize: 12, color: "var(--text-dim)", lineHeight: 1.6 }}>
          Claude can push inventory data directly to this database from Cowork.
          Just tell Claude the Supabase URL and anon key, then say something like:
        </p>
        <div
          style={{
            background: "var(--bg)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            padding: "10px 12px",
            fontSize: 12,
            fontFamily: "monospace",
            color: "var(--accent)",
            marginTop: 8,
          }}
        >
          "These frames are from my kitchen. Catalog the items and push them to
          my home-navigator Supabase."
        </div>
      </div>
    </div>
  );
}
