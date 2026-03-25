import Fuse, { type IFuseOptions } from "fuse.js";
import type { RoomWithFrames, SearchResult } from "~/lib/supabase";

// ---- Synonym Map ----
// Each group is bidirectional: searching any word finds all others
const SYNONYM_GROUPS: string[][] = [
  ["couch", "sofa", "sectional", "futon", "loveseat"],
  ["chair", "recliner", "rocker", "glider", "seat", "stool"],
  ["table", "desk", "counter", "countertop", "surface"],
  ["lamp", "light", "lighting", "pendant", "fixture", "sconce"],
  ["blanket", "throw", "comforter", "quilt", "duvet", "bedding"],
  ["dresser", "credenza", "chest", "bureau", "drawers"],
  ["shelf", "shelves", "shelving", "bookshelf", "bookcase", "rack"],
  ["cabinet", "cupboard", "pantry", "armoire", "hutch"],
  ["bin", "box", "container", "crate", "tub", "tote"],
  ["rug", "carpet", "mat", "runner"],
  ["tv", "television", "monitor", "screen"],
  ["knife", "blade", "cutter"],
  ["pan", "skillet", "frying pan", "wok"],
  ["pot", "saucepan", "stockpot", "dutch oven"],
  ["tool", "wrench", "screwdriver", "pliers", "hammer"],
  ["clothes", "clothing", "garment", "apparel", "outfit"],
  ["toy", "game", "plaything"],
  ["bag", "backpack", "suitcase", "luggage", "duffel"],
  ["mirror", "glass", "looking glass"],
  ["picture", "photo", "frame", "photograph", "portrait"],
];

// Build lookup: word → set of synonyms
const synonymLookup = new Map<string, Set<string>>();
for (const group of SYNONYM_GROUPS) {
  const groupSet = new Set(group);
  for (const word of group) {
    const existing = synonymLookup.get(word.toLowerCase());
    if (existing) {
      for (const w of groupSet) existing.add(w.toLowerCase());
    } else {
      synonymLookup.set(
        word.toLowerCase(),
        new Set(group.map((w) => w.toLowerCase()))
      );
    }
  }
}

/** Expand a query with synonym variants. Returns array of queries to run. */
export function expandWithSynonyms(query: string): string[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const queries = new Set<string>();
  queries.add(query.toLowerCase());

  for (const word of words) {
    const syns = synonymLookup.get(word);
    if (syns) {
      for (const syn of syns) {
        if (syn === word) continue;
        // Replace the matched word with each synonym
        queries.add(
          words.map((w) => (w === word ? syn : w)).join(" ")
        );
      }
    }
  }

  return [...queries];
}

// ---- Fuse.js Index ----

interface FuseItem {
  item_id: string;
  item_name: string;
  item_location: string;
  frame_id: string;
  frame_image_url: string | null;
  frame_timestamp: string | null;
  room_id: string;
  room_name: string;
  room_icon: string;
}

const FUSE_OPTIONS: IFuseOptions<FuseItem> = {
  threshold: 0.4,
  ignoreLocation: true,
  keys: [
    { name: "item_name", weight: 0.6 },
    { name: "item_location", weight: 0.25 },
    { name: "room_name", weight: 0.15 },
  ],
  includeScore: true,
};

/** Flatten rooms into searchable items and create a Fuse index. */
export function buildFuseIndex(rooms: RoomWithFrames[]): Fuse<FuseItem> {
  const items: FuseItem[] = [];
  for (const room of rooms) {
    for (const frame of room.frames) {
      for (const item of frame.items) {
        if (!item.name) continue;
        items.push({
          item_id: item.id,
          item_name: item.name,
          item_location: item.location || "",
          frame_id: frame.id,
          frame_image_url: frame.image_url,
          frame_timestamp: frame.timestamp,
          room_id: room.id,
          room_name: room.name,
          room_icon: room.icon,
        });
      }
    }
  }
  return new Fuse(items, FUSE_OPTIONS);
}

/** Metadata about how a fuzzy match was found */
export interface FuzzyMatchMeta {
  type: "exact" | "fuzzy" | "synonym";
  score: number; // 0–1, higher = better match
  matchedQuery: string; // the actual query variant that matched
  synonymOf?: string; // if synonym, the original word it expanded from
}

/** Run fuzzy search with synonym expansion. Returns deduplicated SearchResult[] + match metadata. */
export function fuzzySearch(
  fuse: Fuse<FuseItem>,
  query: string
): { results: SearchResult[]; matchMeta: Map<string, FuzzyMatchMeta> } {
  if (!query.trim()) return { results: [], matchMeta: new Map() };

  const queries = expandWithSynonyms(query);
  const originalQuery = query.toLowerCase().trim();
  const seen = new Set<string>();
  const results: SearchResult[] = [];
  const matchMeta = new Map<string, FuzzyMatchMeta>();

  for (const q of queries) {
    const isSynonymVariant = q !== originalQuery;
    const hits = fuse.search(q, { limit: 50 });
    for (const hit of hits) {
      if (seen.has(hit.item.item_id)) continue;
      seen.add(hit.item.item_id);

      const score = 1 - (hit.score ?? 0);
      const isExact = score > 0.85 && !isSynonymVariant;

      let meta: FuzzyMatchMeta;
      if (isSynonymVariant) {
        // Figure out which word was the synonym
        const origWords = originalQuery.split(/\s+/);
        const synWords = q.split(/\s+/);
        let synonymOf: string | undefined;
        for (let i = 0; i < origWords.length; i++) {
          if (origWords[i] !== synWords[i]) {
            synonymOf = origWords[i];
            break;
          }
        }
        meta = { type: "synonym", score, matchedQuery: q, synonymOf };
      } else if (isExact) {
        meta = { type: "exact", score, matchedQuery: q };
      } else {
        meta = { type: "fuzzy", score, matchedQuery: q };
      }

      matchMeta.set(hit.item.item_id, meta);

      results.push({
        item_id: hit.item.item_id,
        item_name: hit.item.item_name,
        item_location: hit.item.item_location,
        frame_id: hit.item.frame_id,
        frame_image_url: hit.item.frame_image_url,
        frame_timestamp: hit.item.frame_timestamp,
        room_id: hit.item.room_id,
        room_name: hit.item.room_name,
        room_icon: hit.item.room_icon,
        rank: score,
      });
    }
  }

  // Sort by rank descending
  results.sort((a, b) => b.rank - a.rank);
  return { results, matchMeta };
}

// ---- AI Search (Claude API) ----

interface AiMatch {
  item_name: string;
  reason: string;
}

interface AiCacheEntry {
  results: SearchResult[];
  reasons: Map<string, string>;
  timestamp: number;
}

const aiCache = new Map<string, AiCacheEntry>();
const AI_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/** Build a compact catalog string for the AI prompt. */
function buildCatalog(rooms: RoomWithFrames[]): string {
  const lines: string[] = [];
  for (const room of rooms) {
    for (const frame of room.frames) {
      for (const item of frame.items) {
        if (!item.name) continue;
        const loc = item.location ? ` (${item.location})` : "";
        lines.push(`${item.name} in ${room.name}${loc}`);
      }
    }
  }
  return lines.join("\n");
}

export interface AiSearchState {
  loading: boolean;
  results: SearchResult[];
  reasons: Map<string, string>; // item_id → reason
  error: string | null;
}

export const INITIAL_AI_STATE: AiSearchState = {
  loading: false,
  results: [],
  reasons: new Map(),
  error: null,
};

/** Call Claude API to find semantically matching items. */
export async function aiSearch(
  query: string,
  rooms: RoomWithFrames[]
): Promise<{ results: SearchResult[]; reasons: Map<string, string> }> {
  const cacheKey = query.toLowerCase().trim();
  const cached = aiCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < AI_CACHE_TTL) {
    return { results: cached.results, reasons: cached.reasons };
  }

  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("VITE_ANTHROPIC_API_KEY not set");
  }

  const catalog = buildCatalog(rooms);

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `You are a home inventory search assistant. Given a search query and a catalog of items in a house, find items that semantically match the query. Consider:
- Direct matches (the item IS what they're looking for)
- Related items (items commonly used together or for the same purpose)
- Use-case matches ("something to cut with" → knives, scissors, saw)

Search query: "${query}"

Catalog:
${catalog}

Return ONLY a JSON object with this format (no other text):
{"matches": [{"item_name": "exact item name from catalog", "reason": "brief reason"}]}

Return up to 10 matches, ordered by relevance. Return empty matches array if nothing relevant.`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Claude API error: ${response.status} ${errText}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text || "";

  // Parse JSON from response
  let matches: AiMatch[] = [];
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      matches = parsed.matches || [];
    }
  } catch {
    console.warn("[ai-search] Failed to parse AI response:", text);
  }

  // Map AI matches back to SearchResult objects
  const results: SearchResult[] = [];
  const reasons = new Map<string, string>();

  for (const match of matches) {
    // Find the item in rooms by name (case-insensitive)
    const matchName = match.item_name.toLowerCase();
    for (const room of rooms) {
      for (const frame of room.frames) {
        for (const item of frame.items) {
          if (!item.name) continue;
          if (item.name.toLowerCase() === matchName) {
            results.push({
              item_id: item.id,
              item_name: item.name,
              item_location: item.location || "",
              frame_id: frame.id,
              frame_image_url: frame.image_url,
              frame_timestamp: frame.timestamp,
              room_id: room.id,
              room_name: room.name,
              room_icon: room.icon,
              rank: 0.5, // AI results get a baseline rank
            });
            reasons.set(item.id, match.reason);
            break;
          }
        }
      }
    }
  }

  // Cache the result
  aiCache.set(cacheKey, { results, reasons, timestamp: Date.now() });

  return { results, reasons };
}
