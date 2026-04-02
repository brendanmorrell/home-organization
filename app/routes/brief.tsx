import { useSearchParams, Link } from "react-router";
import ReactMarkdown from "react-markdown";
import { useReferences } from "~/lib/queries";
import { useRooms } from "~/lib/queries";
import { useQuery } from "@tanstack/react-query";
import { fetchTodoListsWithItems } from "~/lib/supabase";
import Fuse from "fuse.js";

const BRIEF_FUSE_THRESHOLD = 0.2;

export default function BriefPage() {
  const [searchParams] = useSearchParams();
  const context = searchParams.get("context")?.toLowerCase() || "";

  const { data: references = [] } = useReferences();
  const { data: rooms = [] } = useRooms();
  const { data: todoLists = [] } = useQuery({
    queryKey: ["todoLists"],
    queryFn: fetchTodoListsWithItems,
  });

  if (!context) {
    return (
      <div className="brief-page">
        <div className="brief-header">
          <Link to="/references" className="brief-back">&larr; References</Link>
          <h2>Brief</h2>
        </div>
        <div className="empty-state">
          <p className="empty-state-text">
            Choose a context to see your brief. Try{" "}
            <Link to="/brief?context=travel">Travel</Link>,{" "}
            <Link to="/brief?context=grocery">Grocery</Link>, or{" "}
            <Link to="/brief?context=weekend">Weekend</Link>.
          </p>
        </div>
      </div>
    );
  }

  // 1. References matching by tag
  const matchedRefs = references.filter((r) =>
    r.tags.some((tag) => tag === context)
  );

  // 2. Inventory items matching by fuzzy search
  const allItems: { id: string; name: string; location: string; roomName: string; roomId: string }[] = [];
  for (const room of rooms) {
    for (const frame of room.frames) {
      for (const item of frame.items) {
        if (!item.name) continue;
        allItems.push({
          id: item.id,
          name: item.name,
          location: item.location || "",
          roomName: room.name,
          roomId: room.id,
        });
      }
    }
  }

  const itemFuse = new Fuse(allItems, {
    threshold: BRIEF_FUSE_THRESHOLD,
    keys: [{ name: "name", weight: 0.8 }, { name: "location", weight: 0.2 }],
    includeScore: true,
  });
  const matchedItems = itemFuse.search(context, { limit: 10 }).map((r) => r.item);

  // 3. Todos matching by fuzzy search
  const allTodos: { id: string; text: string; status: string; listName: string }[] = [];
  for (const list of todoLists) {
    for (const item of list.items) {
      allTodos.push({
        id: item.id,
        text: item.text,
        status: item.status,
        listName: list.name,
      });
    }
  }

  const todoFuse = new Fuse(allTodos, {
    threshold: BRIEF_FUSE_THRESHOLD,
    keys: [{ name: "text", weight: 0.7 }, { name: "listName", weight: 0.3 }],
    includeScore: true,
  });
  const matchedTodos = todoFuse.search(context, { limit: 10 }).map((r) => r.item);

  const contextTitle = context.charAt(0).toUpperCase() + context.slice(1);
  const hasAnyResults = matchedRefs.length > 0 || matchedItems.length > 0 || matchedTodos.length > 0;

  return (
    <div className="brief-page">
      <div className="brief-header">
        <Link to="/references" className="brief-back">&larr; References</Link>
        <h2>{contextTitle} Brief</h2>
      </div>

      {!hasAnyResults ? (
        <div className="empty-state">
          <p className="empty-state-text">
            No items for "{context}" yet. Add references tagged "{context}" to see them here.
          </p>
        </div>
      ) : (
        <div className="brief-sections">
          {/* References section */}
          {matchedRefs.length > 0 && (
            <div className="brief-section brief-section-refs">
              <div className="brief-section-title">Perks &amp; Credits</div>
              {matchedRefs.map((ref) => (
                <div key={ref.id} className="brief-card">
                  <div className="brief-card-title">{ref.title}</div>
                  {ref.content && (
                    <div className="brief-card-content">
                      <ReactMarkdown>{ref.content}</ReactMarkdown>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Inventory section */}
          {matchedItems.length > 0 && (
            <div className="brief-section brief-section-inventory">
              <div className="brief-section-title">From Your House</div>
              {matchedItems.map((item) => (
                <Link
                  key={item.id}
                  to={`/house?q=${encodeURIComponent(item.name)}`}
                  className="brief-item-link"
                >
                  <div className="brief-item">
                    <span className="brief-item-name">{item.name}</span>
                    <span className="brief-item-location">{item.roomName}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Todos section */}
          {matchedTodos.length > 0 && (
            <div className="brief-section brief-section-todos">
              <div className="brief-section-title">Todos</div>
              {matchedTodos.map((todo) => (
                <Link key={todo.id} to="/" className="brief-item-link">
                  <div className="brief-item">
                    <span
                      className={`brief-todo-check ${todo.status === "done" ? "done" : ""}`}
                    >
                      {todo.status === "done" ? "\u2611" : "\u2610"}
                    </span>
                    <span className="brief-item-name">{todo.text}</span>
                    <span className="brief-item-location">{todo.listName}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
