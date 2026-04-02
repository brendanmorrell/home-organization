import { useState, useEffect, useRef, useCallback } from "react";
import { Outlet, useNavigate, useLocation, useSearchParams } from "react-router";
import type { RoomWithFrames, SearchResult } from "~/lib/supabase";
import {
  buildFuseIndex,
  fuzzySearch,
  aiSearch,
  INITIAL_AI_STATE,
  type AiSearchState,
  type FuzzyMatchMeta,
} from "~/lib/search";
import type Fuse from "fuse.js";
import { useRooms, queryClient } from "~/lib/queries";
import Sidebar from "~/components/Sidebar";
import BottomTabs from "~/components/BottomTabs";
import QuickAddFAB from "~/components/QuickAddFAB";

export default function AppLayout() {
  const { data: rooms = [], isLoading: loading } = useRooms();

  // Provide setRooms for backward compat with inventory optimistic updates
  const setRooms = useCallback(
    (updater: RoomWithFrames[] | ((prev: RoomWithFrames[]) => RoomWithFrames[])) => {
      queryClient.setQueryData<RoomWithFrames[]>(["rooms"], (old) => {
        const prev = old || [];
        return typeof updater === "function" ? updater(prev) : updater;
      });
    },
    []
  );
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [fuzzyMatchMeta, setFuzzyMatchMeta] = useState<Map<string, FuzzyMatchMeta>>(new Map());
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);
  const urlTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);
  const fuseRef = useRef<Fuse<any> | null>(null);
  const [aiSearchState, setAiSearchState] = useState<AiSearchState>(INITIAL_AI_STATE);
  const aiTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Search query: local state for instant input, URL (?q=) for persistence
  const [inputValue, setInputValue] = useState(searchParams.get("q") || "");
  const searchQuery = searchParams.get("q") || "";

  // Build Fuse index when rooms data loads
  useEffect(() => {
    if (rooms.length > 0) {
      fuseRef.current = buildFuseIndex(rooms);
    }
  }, [rooms]);

  // Cmd+K to focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Handle typing: update input instantly, debounce search + URL update
  const handleSearch = useCallback(
    (query: string) => {
      setInputValue(query);

      if (searchTimeout.current) clearTimeout(searchTimeout.current);
      if (urlTimeout.current) clearTimeout(urlTimeout.current);
      if (aiTimeout.current) clearTimeout(aiTimeout.current);

      if (!query.trim()) {
        setSearchResults([]);
        setFuzzyMatchMeta(new Map());
        setAiSearchState(INITIAL_AI_STATE);
        setSearchParams(
          (prev) => {
            prev.delete("q");
            return prev;
          },
          { replace: true }
        );
        return;
      }

      // Debounce: fuzzy search after 250ms of no typing
      searchTimeout.current = setTimeout(() => {
        if (!fuseRef.current) return;
        const { results, matchMeta } = fuzzySearch(fuseRef.current, query);
        setSearchResults(results);
        setFuzzyMatchMeta(matchMeta);
        if (results.length > 0 && location.pathname !== "/house") {
          navigate("/house?q=" + encodeURIComponent(query));
        }

        // If few results and query is long enough, trigger AI search after extra delay
        if (results.length <= 2 && query.trim().length >= 3) {
          setAiSearchState((prev) => ({ ...prev, loading: true, error: null }));
          aiTimeout.current = setTimeout(() => {
            aiSearch(query, rooms)
              .then(({ results: aiResults, reasons }) => {
                const fuzzyIds = new Set(results.map((r) => r.item_id));
                const newAiResults = aiResults.filter(
                  (r) => !fuzzyIds.has(r.item_id)
                );
                setAiSearchState({
                  loading: false,
                  results: newAiResults,
                  reasons,
                  error: null,
                });
              })
              .catch((err) => {
                console.error("[ai-search]", err);
                setAiSearchState({
                  loading: false,
                  results: [],
                  reasons: new Map(),
                  error: err.message,
                });
              });
          }, 1500);
        } else {
          setAiSearchState(INITIAL_AI_STATE);
        }
      }, 250);

      // Debounce URL update a bit longer (500ms) to avoid history churn
      urlTimeout.current = setTimeout(() => {
        setSearchParams(
          (prev) => {
            prev.set("q", query);
            return prev;
          },
          { replace: true }
        );
      }, 500);
    },
    [rooms, location.pathname, navigate, setSearchParams]
  );

  // Run search when rooms load (handles page refresh with ?q= in URL)
  useEffect(() => {
    if (rooms.length > 0 && searchQuery.trim() && fuseRef.current) {
      setInputValue(searchQuery);
      const { results, matchMeta } = fuzzySearch(fuseRef.current, searchQuery);
      setSearchResults(results);
      setFuzzyMatchMeta(matchMeta);
    }
  }, [rooms]); // Only re-run when rooms data loads

  const totalItems = rooms.reduce(
    (sum, r) => sum + r.frames.reduce((s, f) => s + f.items.length, 0),
    0
  );
  const totalFrames = rooms.reduce((sum, r) => sum + r.frames.length, 0);

  return (
    <div className="app-layout">
      <Sidebar
        rooms={rooms}
        activeRoomId={activeRoomId}
        setActiveRoomId={setActiveRoomId}
        totalItems={totalItems}
      />

      <div className="main-content">
        <div className="content-area">
          <Outlet
            context={{
              rooms,
              setRooms,
              searchQuery,
              searchResults,
              activeRoomId,
              setActiveRoomId,
              loading,
              aiSearchState,
              fuzzyMatchMeta,
              inputValue,
              handleSearch,
              searchRef,
              totalItems,
            }}
          />
        </div>

        <div className="stats-bar">
          <span>{rooms.length} rooms</span>
          <span>{totalFrames} frames</span>
          <span>{totalItems} items cataloged</span>
        </div>
      </div>

      <BottomTabs />
      {/* Show FAB on inventory and reference pages */}
      {["/inventory", "/house", "/dashboard", "/rooms"].some(p => location.pathname.startsWith(p)) && (
        <QuickAddFAB rooms={rooms} />
      )}
      {["/references", "/brief"].some(p => location.pathname.startsWith(p)) && (
        <QuickAddFAB rooms={rooms} defaultMode="reference" />
      )}
    </div>
  );
}
