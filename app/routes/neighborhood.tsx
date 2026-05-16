import { useState, useEffect, useCallback } from "react";
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

  const commitField = useCallback(
    (id: string, field: "notes" | "names", value: string | string[]) => {
      setNeighbors((prev) => {
        const next = prev.map((n) =>
          n.id === id ? { ...n, [field]: value } : n
        );
        const neighbor = next.find((n) => n.id === id);
        if (neighbor) {
          const { created_at, ...rest } = neighbor;
          upsertNeighbor(rest).catch((err) =>
            console.error("Failed to save:", err)
          );
        }
        return next;
      });
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
        <NeighborDetail
          key={selected.id}
          neighbor={selected}
          onClose={() => setSelectedId(null)}
          onCommit={commitField}
        />
      )}
    </div>
  );
}

function NeighborDetail({
  neighbor,
  onClose,
  onCommit,
}: {
  neighbor: Neighbor;
  onClose: () => void;
  onCommit: (
    id: string,
    field: "notes" | "names",
    value: string | string[]
  ) => void;
}) {
  // Local drafts so the user can type freely (spaces, commas) without the
  // value being parsed/trimmed on every keystroke. Committed on blur/Enter.
  const [namesDraft, setNamesDraft] = useState(neighbor.names.join(", "));
  const [notesDraft, setNotesDraft] = useState(neighbor.notes ?? "");

  const commitNames = () => {
    const parsed = namesDraft
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    setNamesDraft(parsed.join(", "));
    onCommit(neighbor.id, "names", parsed);
  };

  const commitNotes = () => {
    onCommit(neighbor.id, "notes", notesDraft);
  };

  return (
    <div className="neighbor-detail">
      <div className="neighbor-detail-header">
        <h3>{neighbor.address}</h3>
        <button className="close-btn" onClick={onClose}>
          ✕
        </button>
      </div>

      <div className="neighbor-detail-field">
        <label>Names</label>
        <input
          type="text"
          className="neighbor-names-input"
          placeholder="Add names (comma-separated)..."
          enterKeyHint="done"
          value={namesDraft}
          onChange={(e) => setNamesDraft(e.target.value)}
          onBlur={commitNames}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitNames();
              e.currentTarget.blur();
            }
          }}
        />
      </div>

      <div className="neighbor-detail-field">
        <label>Notes</label>
        <textarea
          className="neighbor-notes"
          placeholder="Add notes..."
          enterKeyHint="done"
          value={notesDraft}
          onChange={(e) => setNotesDraft(e.target.value)}
          onBlur={commitNotes}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              commitNotes();
              e.currentTarget.blur();
            }
          }}
          rows={2}
        />
      </div>
    </div>
  );
}
