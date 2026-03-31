import { useState, useEffect, useRef, useCallback } from "react";
import BlockMap from "~/components/neighborhood/BlockMap";
import { defaultNeighbors, VALID_IDS } from "~/data/neighbors";
import {
  fetchNeighbors,
  upsertNeighbor,
  upsertNeighbors,
  deleteNeighbor,
  type Neighbor,
} from "~/lib/supabase";

export default function Neighborhood() {
  const [neighbors, setNeighbors] = useState<Neighbor[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const saveTimeout = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    (async () => {
      try {
        let data = await fetchNeighbors();

        // Remove entries not in the valid set
        const badIds = data
          .filter((n) => !VALID_IDS.has(n.id))
          .map((n) => n.id);
        if (badIds.length > 0) {
          for (const id of badIds) {
            await deleteNeighbor(id);
          }
          data = data.filter((n) => VALID_IDS.has(n.id));
        }

        // Migrate Kenton from 315 → 309 Institute if needed
        const inst315 = data.find((n) => n.id === "315-institute");
        const inst309 = data.find((n) => n.id === "309-institute");
        if (
          inst315?.names?.includes("Kenton") &&
          (!inst309 || !inst309.names?.includes("Kenton"))
        ) {
          const updated315 = {
            ...inst315,
            names: inst315.names.filter((n) => n !== "Kenton"),
          };
          const { created_at: _a, ...rest315 } = updated315;
          await upsertNeighbor(rest315);
          Object.assign(inst315, updated315);

          if (inst309) {
            const updated309 = {
              ...inst309,
              names: [...inst309.names, "Kenton"],
            };
            const { created_at: _b, ...rest309 } = updated309;
            await upsertNeighbor(rest309);
            Object.assign(inst309, updated309);
          }
        }

        // Upsert any defaults not already in the DB
        const existingIds = new Set(data.map((n) => n.id));
        const missing = defaultNeighbors.filter(
          (n) => !existingIds.has(n.id)
        );
        if (missing.length > 0) {
          const inserted = await upsertNeighbors(missing);
          data = [...data, ...inserted];
        }

        data.sort((a, b) => a.position_index - b.position_index);
        setNeighbors(data);
      } catch (err) {
        console.error("Failed to load neighbors:", err);
        setNeighbors(
          defaultNeighbors.map((n) => ({ ...n, created_at: "" }))
        );
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSelect = useCallback((id: string) => {
    setSelectedId((prev) => (prev === id ? null : id));
  }, []);

  const updateField = useCallback(
    (id: string, field: "notes" | "names", value: string | string[]) => {
      setNeighbors((prev) =>
        prev.map((n) => (n.id === id ? { ...n, [field]: value } : n))
      );

      if (saveTimeout.current[id]) clearTimeout(saveTimeout.current[id]);
      saveTimeout.current[id] = setTimeout(() => {
        setNeighbors((current) => {
          const neighbor = current.find((n) => n.id === id);
          if (neighbor) {
            const { created_at, ...rest } = neighbor;
            upsertNeighbor(rest).catch((err) =>
              console.error("Failed to save:", err)
            );
          }
          return current;
        });
      }, 800);
    },
    []
  );

  const selected = neighbors.find((n) => n.id === selectedId);

  if (loading) {
    return (
      <div className="neighborhood-page">
        <p style={{ color: "var(--text-dim)" }}>Loading neighborhood...</p>
      </div>
    );
  }

  return (
    <div className="neighborhood-page">
      <div className="neighborhood-header">
        <h2>Neighborhood Rolodex</h2>
        <p className="subtitle">
          314 Custer Ave block — tap a lot to select
        </p>
      </div>

      <BlockMap
        neighbors={neighbors}
        selectedId={selectedId}
        onSelect={handleSelect}
      />

      {selected && !selected.is_us && (
        <div className="neighbor-detail">
          <div className="neighbor-detail-header">
            <h3>{selected.address}</h3>
            <button
              className="close-btn"
              onClick={() => setSelectedId(null)}
            >
              ✕
            </button>
          </div>

          <div className="neighbor-detail-field">
            <label>Names</label>
            <input
              type="text"
              className="neighbor-names-input"
              placeholder="Add names (comma-separated)..."
              value={selected.names.join(", ")}
              onChange={(e) =>
                updateField(
                  selected.id,
                  "names",
                  e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean)
                )
              }
            />
          </div>

          <div className="neighbor-detail-field">
            <label>Notes</label>
            <textarea
              className="neighbor-notes"
              placeholder="Add notes..."
              value={selected.notes}
              onChange={(e) =>
                updateField(selected.id, "notes", e.target.value)
              }
              rows={2}
            />
          </div>
        </div>
      )}

    </div>
  );
}
