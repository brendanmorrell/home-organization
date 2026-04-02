import { useState, useCallback } from "react";
import { createItem, createReference, REFERENCE_CATEGORIES, type RoomWithFrames } from "~/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";
import { ZONE_ROOM } from "~/lib/queries";

// Build reverse mapping: Room name → zones
const ROOM_ZONES: Record<string, string[]> = {};
for (const [zone, room] of Object.entries(ZONE_ROOM)) {
  if (!ROOM_ZONES[room]) ROOM_ZONES[room] = [];
  ROOM_ZONES[room].push(zone);
}

type FabMode = "item" | "reference";

interface QuickAddFABProps {
  rooms: RoomWithFrames[];
  prefilledRoomId?: string | null;
  defaultMode?: FabMode;
}

export default function QuickAddFAB({ rooms, prefilledRoomId, defaultMode = "item" }: QuickAddFABProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<FabMode>(defaultMode);
  const [name, setName] = useState("");
  const [roomId, setRoomId] = useState(prefilledRoomId || "");
  const [zone, setZone] = useState("");
  const [notes, setNotes] = useState("");
  // Reference fields
  const [refCategory, setRefCategory] = useState<string>(REFERENCE_CATEGORIES[0]);
  const [refContent, setRefContent] = useState("");
  const [refTags, setRefTags] = useState("");
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const selectedRoom = rooms.find((r) => r.id === roomId);
  const availableZones = selectedRoom ? ROOM_ZONES[selectedRoom.name] || [] : [];

  const resetForm = useCallback(() => {
    setName("");
    setRoomId(prefilledRoomId || "");
    setZone("");
    setNotes("");
    setRefCategory(REFERENCE_CATEGORIES[0]);
    setRefContent("");
    setRefTags("");
  }, [prefilledRoomId]);

  const handleClose = useCallback(() => {
    setOpen(false);
    resetForm();
  }, [resetForm]);

  const handleSave = useCallback(async () => {
    if (mode === "item") {
      if (!name.trim() || !roomId) return;
      const targetRoom = rooms.find((r) => r.id === roomId);
      if (!targetRoom) return;
      const frameId = targetRoom.frames[0]?.id;
      if (!frameId) return;

      const locationParts: string[] = [];
      if (zone) locationParts.push(zone);
      if (notes) locationParts.push(notes);
      const location = locationParts.join(" | ");

      setSaving(true);
      try {
        await createItem({
          frame_id: frameId,
          name: name.trim(),
          location,
          pin_x: null,
          pin_y: null,
          pin_z: null,
        });
        await queryClient.invalidateQueries({ queryKey: ["rooms"] });
        handleClose();
      } catch (err) {
        console.error("Failed to add item:", err);
      } finally {
        setSaving(false);
      }
    } else {
      if (!name.trim()) return;
      setSaving(true);
      try {
        await createReference({
          title: name.trim(),
          category: refCategory,
          content: refContent.trim() || undefined,
          tags: refTags.split(",").map((t) => t.trim()).filter(Boolean),
        });
        await queryClient.invalidateQueries({ queryKey: ["references"] });
        handleClose();
      } catch (err) {
        console.error("Failed to add reference:", err);
      } finally {
        setSaving(false);
      }
    }
  }, [mode, name, roomId, zone, notes, rooms, refCategory, refContent, refTags, queryClient, handleClose]);

  return (
    <>
      <button
        className="fab-button"
        onClick={() => setOpen(true)}
        title="Quick Add"
      >
        +
      </button>

      {open && (
        <div className="fab-modal-overlay" onClick={handleClose}>
          <div className="fab-modal" onClick={(e) => e.stopPropagation()}>
            <div className="fab-modal-header">
              <h3>Quick Add</h3>
              <button className="fab-modal-close" onClick={handleClose}>
                &times;
              </button>
            </div>
            {/* Mode toggle */}
            <div className="fab-mode-toggle">
              <button
                className={`fab-mode-btn ${mode === "item" ? "active" : ""}`}
                onClick={() => { setMode("item"); resetForm(); }}
              >
                Item
              </button>
              <button
                className={`fab-mode-btn ${mode === "reference" ? "active" : ""}`}
                onClick={() => { setMode("reference"); resetForm(); }}
              >
                Reference
              </button>
            </div>
            <div className="fab-modal-body">
              {mode === "item" ? (
                <>
                  <div className="form-field">
                    <label>Name *</label>
                    <input
                      className="edit-input"
                      type="text"
                      placeholder="Item name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Escape") handleClose();
                        if (e.key === "Enter" && name.trim() && roomId) handleSave();
                      }}
                    />
                  </div>
                  <div className="form-field">
                    <label>Room *</label>
                    <select
                      className="edit-select"
                      value={roomId}
                      onChange={(e) => {
                        setRoomId(e.target.value);
                        setZone("");
                      }}
                    >
                      <option value="">Select room...</option>
                      {rooms.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.icon} {r.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-field">
                    <label>Zone</label>
                    <select
                      className="edit-select"
                      value={zone}
                      onChange={(e) => setZone(e.target.value)}
                      disabled={!roomId}
                    >
                      <option value="">
                        {roomId
                          ? availableZones.length > 0
                            ? "Select zone..."
                            : "No zones defined"
                          : "Pick a room first"}
                      </option>
                      {availableZones.map((z) => (
                        <option key={z} value={z}>
                          {z}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-field">
                    <label>Notes</label>
                    <input
                      className="edit-input"
                      type="text"
                      placeholder="Additional details..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") handleClose();
                        if (e.key === "Enter" && name.trim() && roomId) handleSave();
                      }}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="form-field">
                    <label>Title *</label>
                    <input
                      className="edit-input"
                      type="text"
                      placeholder="e.g., Chase Sapphire Reserve"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Escape") handleClose();
                        if (e.key === "Enter" && name.trim()) handleSave();
                      }}
                    />
                  </div>
                  <div className="form-field">
                    <label>Category</label>
                    <select
                      className="edit-select"
                      value={refCategory}
                      onChange={(e) => setRefCategory(e.target.value)}
                    >
                      {REFERENCE_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-field">
                    <label>Content (markdown)</label>
                    <textarea
                      className="edit-textarea"
                      rows={4}
                      placeholder={"- $300 travel credit\n- Priority Pass lounge"}
                      value={refContent}
                      onChange={(e) => setRefContent(e.target.value)}
                    />
                  </div>
                  <div className="form-field">
                    <label>Tags (comma-separated)</label>
                    <input
                      className="edit-input"
                      type="text"
                      placeholder="travel, dining, lounge"
                      value={refTags}
                      onChange={(e) => setRefTags(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") handleClose();
                        if (e.key === "Enter" && name.trim()) handleSave();
                      }}
                    />
                  </div>
                </>
              )}
            </div>
            <div className="fab-modal-footer">
              <button className="btn" onClick={handleClose} disabled={saving}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={saving || !name.trim() || (mode === "item" && !roomId)}
              >
                {saving ? "Saving..." : mode === "item" ? "Add Item" : "Add Reference"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
