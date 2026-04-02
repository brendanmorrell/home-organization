import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import {
  createReference,
  updateReference,
  deleteReference,
  REFERENCE_CATEGORIES,
  type Reference,
  type ReferenceCategory,
} from "~/lib/supabase";
import { useReferences } from "~/lib/queries";

type FilterCategory = ReferenceCategory | "All";

export default function ReferencesPage() {
  const { data: references = [], isLoading } = useReferences();
  const queryClient = useQueryClient();

  const [activeCategory, setActiveCategory] = useState<FilterCategory>("All");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const filtered =
    activeCategory === "All"
      ? references
      : references.filter((r) => r.category === activeCategory);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm("Delete this reference?")) return;
      try {
        await deleteReference(id);
        queryClient.invalidateQueries({ queryKey: ["references"] });
      } catch (err) {
        console.error("Failed to delete:", err);
      }
    },
    [queryClient]
  );

  return (
    <div className="references-page">
      <div className="references-header">
        <h2>References</h2>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => {
            setShowAddForm(true);
            setEditingId(null);
          }}
        >
          + Add
        </button>
      </div>

      {/* Category pills */}
      <div className="category-pills">
        <button
          className={`cat-pill ${activeCategory === "All" ? "active" : ""}`}
          onClick={() => setActiveCategory("All")}
        >
          All
        </button>
        {REFERENCE_CATEGORIES.map((cat) => {
          const count = references.filter((r) => r.category === cat).length;
          return (
            <button
              key={cat}
              className={`cat-pill ${activeCategory === cat ? "active" : ""}`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
              {count > 0 && <span className="cat-pill-count">{count}</span>}
            </button>
          );
        })}
      </div>

      {/* Add/Edit form */}
      {(showAddForm || editingId) && (
        <ReferenceForm
          reference={editingId ? references.find((r) => r.id === editingId) : undefined}
          onSave={async (data) => {
            try {
              if (editingId) {
                await updateReference(editingId, data);
              } else {
                await createReference(data);
              }
              queryClient.invalidateQueries({ queryKey: ["references"] });
              setEditingId(null);
              setShowAddForm(false);
            } catch (err) {
              console.error("Failed to save:", err);
            }
          }}
          onCancel={() => {
            setEditingId(null);
            setShowAddForm(false);
          }}
        />
      )}

      {/* Card list */}
      {isLoading ? (
        <div className="skeleton-list">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton-card" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state-text">
            {activeCategory === "All"
              ? "No references yet. Add one with the + button above."
              : `No ${activeCategory} references yet.`}
          </p>
        </div>
      ) : (
        <div className="ref-card-list">
          {filtered.map((ref) => (
            <div key={ref.id} className="ref-card">
              <div className="ref-card-header">
                <h3 className="ref-card-title">{ref.title}</h3>
                <div className="ref-card-actions">
                  <button
                    className="ref-card-action"
                    onClick={() => {
                      setEditingId(ref.id);
                      setShowAddForm(false);
                    }}
                    title="Edit"
                  >
                    &#9998;
                  </button>
                  <button
                    className="ref-card-action ref-card-action-delete"
                    onClick={() => handleDelete(ref.id)}
                    title="Delete"
                  >
                    &times;
                  </button>
                </div>
              </div>
              <div className="ref-card-category">{ref.category}</div>
              {ref.content && (
                <div className="ref-card-content">
                  <ReactMarkdown>{ref.content}</ReactMarkdown>
                </div>
              )}
              {ref.tags.length > 0 && (
                <div className="ref-card-tags">
                  {ref.tags.map((tag) => (
                    <span key={tag} className="ref-tag">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Add/Edit Form ----

function ReferenceForm({
  reference,
  onSave,
  onCancel,
}: {
  reference?: Reference;
  onSave: (data: {
    title: string;
    category: string;
    content?: string;
    tags?: string[];
  }) => Promise<void>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(reference?.title || "");
  const [category, setCategory] = useState(reference?.category || REFERENCE_CATEGORIES[0]);
  const [content, setContent] = useState(reference?.content || "");
  const [tagsInput, setTagsInput] = useState(reference?.tags.join(", ") || "");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        category,
        content: content.trim() || undefined,
        tags: tagsInput
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="ref-form">
      <div className="ref-form-header">
        <h3>{reference ? "Edit Reference" : "New Reference"}</h3>
      </div>
      <div className="form-field">
        <label>Title *</label>
        <input
          className="edit-input"
          type="text"
          placeholder="e.g., Chase Sapphire Reserve"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Escape") onCancel();
          }}
        />
      </div>
      <div className="form-field">
        <label>Category</label>
        <select
          className="edit-select"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          {REFERENCE_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>
      <div className="form-field">
        <label>Content (markdown)</label>
        <textarea
          className="edit-textarea"
          rows={6}
          placeholder={"- $300 travel credit\n- Priority Pass lounge\n- 3x points on dining"}
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
      </div>
      <div className="form-field">
        <label>Tags (comma-separated)</label>
        <input
          className="edit-input"
          type="text"
          placeholder="travel, dining, lounge"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onCancel();
            if (e.key === "Enter" && title.trim()) handleSubmit();
          }}
        />
      </div>
      <div className="ref-form-footer">
        <button className="btn" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button
          className="btn btn-primary"
          onClick={handleSubmit}
          disabled={saving || !title.trim()}
        >
          {saving ? "Saving..." : reference ? "Update" : "Add Reference"}
        </button>
      </div>
    </div>
  );
}
