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
  // Local draft for names input — prevents comma/space being swallowed by controlled re-render
  const [draftNames, setDraftNames] = useState<string | null>(null);
  // Visual save feedback
  const [savedId, setSavedId] = useState<string | null>(null);
  const saveTimeout = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const savedFeedbackTimeout = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

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

  // Reset draft whenever the selected lot changes
  useEffect(() => {
    setDraftNames(null);
  }, [selectedId]);

  const handleSelect = useCallback((id: string) => {
    setSelectedId((prev) => (prev === id ? null : id));
  }, []);

  const triggerSave = useCallback((id: string) => {
    if (saveTimeout.current[id]) clearTimeout(saveTimeout.current[id]);
    saveTimeout.current[id] = setTimeout(() => {
      setNeighbors((current) => {
        const neighbor = current.find((n) => n.id === id);
        if (neighbor) {
          const { created_at, ...rest } = neighbor;
          upsertNeighbor(rest)
            .then(() => {
              // Show "Saved" feedback
              setSavedId(id);
              if (savedFeedbackTimeout.current[id])
                clearTimeout(savedFeedbackTimeout.current[id]);
              savedFeedbackTimeout.current[id] = setTimeout(() => {
                setSavedId((prev) => (prev === id ? null : prev));
              }, 1800);
            })
            .catch((err) => console.error("Failed to save:", err));
        }
        return current;
      });
    }, 800);
  }, []);

  const updateField = useCallback(
    (id: string, field: "notes" | "names", value: string | string[]) => {
      setNeighbors((prev) =>
        prev.map((n) => (n.id === id ? { ...n, [field]: value } : n))
      );
      triggerSave(id);
    },
    [triggerSave]
  );

  // Commit the names draft to the neighbor state and trigger save
  const commitNamesDraft = useCallback(() => {
    if (!selectedId || draftNames === null) return;
    const parsed = draftNames
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    updateField(selectedId, "names", parsed);
    setDraftNames(null);
  }, [selectedId, draftNames, updateField]);

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
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {savedId === selected.id && (
                <span className="neighbor-saved-badge">✓ Saved</span>
              )}
              <button
                className="close-btn"
                onClick={() => setSelectedId(null)}
              >
                ✕
              </button>
            </div>
          </div>

          <div className="neighbor-detail-field">
            <label>Names</label>
            {/* Use draftNames as local state — avoids comma/space being swallowed
                by the parse-then-join round-trip on every keystroke */}
            <input
              type="text"
              className={`neighbor-names-input${savedId === selected.id ? " neighbor-input--saved" : ""}`}
              placeholder="Add names (comma-separated)..."
              value={draftNames ?? selected.names.join(", ")}
              onChange={(e) => setDraftNames(e.target.value)}
              onBlur={commitNamesDraft}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  commitNamesDraft();
                  (e.target as HTMLInputElement).blur();
                }
                if (e.key === "Escape") {
                  setDraftNames(null);
                  (e.target as HTMLInputElement).blur();
                }
              }}
            />
          </div>

          <div className="neighbor-detail-field">
            <label>Notes</label>
            <textarea
              className={`neighbor-notes${savedId === selected.id ? " neighbor-input--saved" : ""}`}
              placeholder="Add notes..."
              value={selected.notes}
              onChange={(e) =>
                updateField(selected.id, "notes", e.target.value)
              }
              onBlur={() => triggerSave(selected.id)}
              rows={2}
            />
          </div>
        </div>
      )}

      <style>{`
        .neighbor-saved-badge {
          font-size: 12px;
          color: var(--success, #66bb6a);
          font-weight: 600;
          animation: neighbor-fade-in 0.2s ease;
        }
        @keyframes neighbor-fade-in {
          from { opacity: 0; transform: translateY(2px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .neighbor-input--saved {
          border-color: var(--success, #66bb6a) !important;
          box-shadow: 0 0 0 2px rgba(102, 187, 106, 0.2) !important;
          transition: border-color 0.3s, box-shadow 0.3s;
        }
      `}</style>
    </div>
  );
}
