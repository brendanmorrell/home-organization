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

type SaveStatus = "idle" | "saving" | "saved";

function parseNames(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function Neighborhood() {
  const [neighbors, setNeighbors] = useState<Neighbor[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // Raw string editing buffer for the names field — avoids array round-trip
  // that strips trailing commas/spaces as the user types.
  const [namesDraft, setNamesDraft] = useState<string>("");
  const [notesDraft, setNotesDraft] = useState<string>("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedFlashTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track pending writes so blur can flush immediately.
  const pendingWriteRef = useRef<{
    id: string;
    names: string[];
    notes: string;
  } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        let data = await fetchNeighbors();

        const badIds = data
          .filter((n) => !VALID_IDS.has(n.id))
          .map((n) => n.id);
        if (badIds.length > 0) {
          for (const id of badIds) {
            await deleteNeighbor(id);
          }
          data = data.filter((n) => VALID_IDS.has(n.id));
        }

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
    setSelectedId((prev) => {
      // Flush any pending save when switching selection
      flushPendingSave();
      return prev === id ? null : id;
    });
  }, []);

  // Sync drafts when a different neighbor is selected
  useEffect(() => {
    if (!selectedId) {
      setNamesDraft("");
      setNotesDraft("");
      return;
    }
    const n = neighbors.find((x) => x.id === selectedId);
    if (n) {
      setNamesDraft(n.names.join(", "));
      setNotesDraft(n.notes ?? "");
    }
    // Don't re-sync on every neighbors change — only when selection changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const persist = useCallback(
    async (id: string, names: string[], notes: string) => {
      pendingWriteRef.current = null;
      setSaveStatus("saving");
      // Optimistic local update
      setNeighbors((prev) =>
        prev.map((n) => (n.id === id ? { ...n, names, notes } : n))
      );
      try {
        const target = neighbors.find((n) => n.id === id);
        if (!target) return;
        const { created_at, ...rest } = target;
        await upsertNeighbor({ ...rest, names, notes });
        setSaveStatus("saved");
        if (savedFlashTimeout.current) clearTimeout(savedFlashTimeout.current);
        savedFlashTimeout.current = setTimeout(() => {
          setSaveStatus("idle");
        }, 1600);
      } catch (err) {
        console.error("Failed to save neighbor:", err);
        setSaveStatus("idle");
      }
    },
    [neighbors]
  );

  const flushPendingSave = useCallback(() => {
    if (saveTimeout.current) {
      clearTimeout(saveTimeout.current);
      saveTimeout.current = null;
    }
    const pending = pendingWriteRef.current;
    if (pending) {
      persist(pending.id, pending.names, pending.notes);
    }
  }, [persist]);

  const scheduleSave = useCallback(
    (id: string, names: string[], notes: string) => {
      pendingWriteRef.current = { id, names, notes };
      setSaveStatus("saving");
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      saveTimeout.current = setTimeout(() => {
        flushPendingSave();
      }, 700);
    },
    [flushPendingSave]
  );

  // Flush pending on unmount
  useEffect(() => {
    return () => {
      flushPendingSave();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
            <div className="neighbor-detail-actions">
              <SaveStatusBadge status={saveStatus} />
              <button
                className="close-btn"
                onClick={() => {
                  flushPendingSave();
                  setSelectedId(null);
                }}
              >
                ✕
              </button>
            </div>
          </div>

          <div className="neighbor-detail-field">
            <label>Names</label>
            <input
              type="text"
              className="neighbor-names-input"
              placeholder="Add names (comma-separated)..."
              value={namesDraft}
              enterKeyHint="done"
              onChange={(e) => {
                setNamesDraft(e.target.value);
                scheduleSave(
                  selected.id,
                  parseNames(e.target.value),
                  notesDraft
                );
              }}
              onBlur={flushPendingSave}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  (e.target as HTMLInputElement).blur();
                }
              }}
            />
          </div>

          <div className="neighbor-detail-field">
            <label>Notes</label>
            <textarea
              className="neighbor-notes"
              placeholder="Add notes..."
              value={notesDraft}
              enterKeyHint="done"
              onChange={(e) => {
                setNotesDraft(e.target.value);
                scheduleSave(
                  selected.id,
                  parseNames(namesDraft),
                  e.target.value
                );
              }}
              onBlur={flushPendingSave}
              rows={2}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function SaveStatusBadge({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;
  return (
    <span className={`save-status save-status--${status}`}>
      {status === "saving" ? (
        <>
          <span className="save-spinner" />
          Saving…
        </>
      ) : (
        <>
          <span className="save-check">✓</span>
          Saved
        </>
      )}
    </span>
  );
}
