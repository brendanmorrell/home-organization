# Session Handoff — 3D Home Inventory Navigator

## Project Overview

React Router v7 SPA + Three.js r128 (CDN, in `public/house-3d.html` iframe) + Supabase. A 3D model of a house where you can search for items and the camera flies to the right room/furniture.

**Read `CLAUDE.md` first** — it has all room data, coordinate systems, furniture types, and conventions.

---

## What Was Done (Latest Sessions)

### 1. Fixed pulse/flyout bug on search results
- **Problem**: Both `searchItem` and `highlightZones` postMessages fired on every search, conflicting with each other (both called `flyToFurniture`, overwrote `pulsingFurn`/`highlightedFurn`)
- **Fix**: Removed `searchItem` message entirely. Now only `highlightZones` is sent from home.tsx. The single message extracts zone labels from item locations and sends them to the 3D model.
- **Files**: `app/routes/home.tsx` (removed searchItem postMessage), `public/house-3d.html` (highlightZones handler is the sole search handler)

### 2. Added directional camera logic
- **Problem**: Camera always approached furniture from the same default angle regardless of wall placement
- **Fix**: `flyToFurniture()` in house-3d.html now calculates camera position based on which wall the furniture is against (using local x/z within the room). Furniture on the west wall → camera approaches from the east, etc.
- **Files**: `public/house-3d.html` (`flyToFurniture` function)

### 3. Added null guards throughout
- **Problem**: `searchItems()` and `handleSyncItems()` in house-3d.html could crash on items with null/undefined names
- **Fix**: Added `(item.name || '').toLowerCase()` guards in house-3d.html's searchItems and `if (!item.name) continue;` in handleSyncItems. Also added `if (!item.name) continue;` in `searchItemsLocal()` in supabase.ts.
- **Files**: `public/house-3d.html`, `app/lib/supabase.ts`

### 4. Fixed 25 items with missing zone labels in Supabase
- **Problem**: 25 items had human-readable locations (e.g., "Vertical organizer, next to oven") instead of the required `ZONE_LABEL | notes` format. The 3D model's `highlightZones` handler couldn't find matching `ZONE_TO_FURN_ID` entries for these items, so search wouldn't highlight the right furniture.
- **Fix**: Updated all 25 items in Supabase directly (via browser JS) to use proper zone labels. Examples: "Vertical organizer, next to oven" → "KITCHEN-LOWER-CAB | Vertical organizer, next to oven"
- **Where**: Supabase `items` table (not in code files — done via browser JS on deployed app)

### 5. Split "Charcoal lighter fluid" into two items
- Renamed existing item to "Charcoal", created new "Lighter fluid" item in same frame/location (BALCONY-DECKBOX)
- Updated both Supabase and `public/inventory.json` (added item i198)
- **Total items: 196**

### 6. Persisted search query in URL
- **Problem**: Search didn't survive page navigation or refresh
- **Fix**: Search query stored in URL as `?q=...` via `useSearchParams`. On page load, if `?q=` present, search runs automatically.
- **Files**: `app/routes/layout.tsx`

### 7. Debounced search for performance
- **Problem**: After adding URL persistence, typing in search was "super laggy and choppy"
- **Fix**: Separated `inputValue` (local state, updates instantly on every keystroke) from `searchQuery` (derived from URL `?q=`). Search computation debounced at 250ms, URL update debounced at 500ms.
- **Files**: `app/routes/layout.tsx`

---

## Architecture

### Data Flow
```
Supabase (196 items, source of truth)
    ↓ fetchAllRoomsWithFrames()
React layout.tsx (loads rooms + items)
    ↓ postMessage({ type: "syncItems", items })
3D iframe house-3d.html (injects into furniture, rebuilds ALL_ITEMS)
```

### Search Flow
```
User types query
    ↓ (instant)
inputValue updates → input field responsive
    ↓ (250ms debounce)
searchItemsLocal() runs → SearchResult[]
    ↓ (extracts zones from item_location)
postMessage "highlightZones" → 3D looks up ZONE_TO_FURN_ID → flyToFurniture + pulse
    ↓ (if no zone found)
fallbackRoomId → flyToRoom (camera flies to room even without specific furniture)
    ↓ (500ms debounce)
URL updated with ?q=...
```

**Note**: Only `highlightZones` is sent now. The old `searchItem` message was removed to fix animation conflicts.

### Key Files
- `public/house-3d.html` (~4200 lines) — All 3D model code, room geometry, furniture, camera, search
- `app/routes/home.tsx` (~371 lines) — React home page with iframe + postMessage bridge
- `app/routes/layout.tsx` (~380 lines) — React layout, sidebar, search (debounced), Supabase data loading, URL persistence
- `app/lib/supabase.ts` — Supabase client, types, search functions (with null guards)
- `public/inventory.json` (~1460 lines, 196 items) — Offline fallback only
- `CLAUDE.md` — All room data, coord system, furniture types, conventions

### Supabase Schema
- `rooms` table: id, name, icon, pos_x/y/z, width/depth/height, color, sort_order
- `frames` table: id, room_id, image_url, timestamp, sort_order
- `items` table: id, frame_id, name, location (stores "ZONE_LABEL | notes"), pin_x/y/z
- RPC: `search_items(query)` — full-text search returning SearchResult[]

### Supabase Credentials
```
URL: https://bbztmfiefxymkfmmplfj.supabase.co
Anon Key: in .env file (VITE_SUPABASE_ANON_KEY)
```

### 3D Model Key Data Structures
- `ROOMS[]` — Room geometry + furniture definitions
- `ALL_ITEMS[]` — Flat array of all items (rebuilt by `rebuildAllItems()`)
- `ZONE_FURN_REF{}` — zone label → furniture object reference
- `ZONE_TO_FURN_ID{}` — zone label → furnId string (for postMessage lookups)
- `ZONE_ROOM_MAP{}` — zone label → room ID
- `furnitureMeshes{}` — furnId → { group, badge, furn, room }

### PostMessage Protocol (React → iframe)
| Message | Purpose |
|---------|---------|
| `{ type: "ping" }` | Trigger ready handshake |
| `{ type: "readyAck" }` | Acknowledge iframe ready |
| `{ type: "syncItems", items }` | Push Supabase items into 3D model |
| `{ type: "flyToRoom", roomId }` | Fly camera to room |
| `{ type: "highlightZones", zones, itemNames, fallbackRoomId }` | Highlight furniture by zone + fly to it |
| `{ type: "clearSearch" }` | Clear all highlights |

### PostMessage Protocol (iframe → React)
| Message | Purpose |
|---------|---------|
| `{ type: "ready" }` | Iframe finished loading |
| `{ type: "roomClicked", roomId }` | User clicked a room |
| `{ type: "roomDoubleClicked", roomId }` | User double-clicked (navigate to detail) |

---

## VM Limitation
The Cowork VM cannot reach external networks (Supabase). All Supabase operations must be done via browser JavaScript (`mcp__Claude_in_Chrome__javascript_tool`) on the deployed app, or by running the dev server and using the app's own Supabase client.

To access Supabase from the browser console on the deployed app:
```javascript
const mod = await import('/assets/supabase-BrTdwqKE.js');
window._sb = mod.a; // the Supabase client
// Then: const { data } = await _sb.from('items').select('*');
```

---

## TODO: Run in Supabase Dashboard

Add NOT NULL constraint on items table (anon key can't run DDL):
```sql
ALTER TABLE items ALTER COLUMN name SET NOT NULL;
ALTER TABLE items ADD CONSTRAINT items_name_not_empty CHECK (name <> '');
ALTER TABLE items ALTER COLUMN location SET NOT NULL;
ALTER TABLE items ADD CONSTRAINT items_location_not_empty CHECK (name <> '');
```

---

## Completed Workstreams
1. **3D Modeling** — All 15 rooms built (r1-r15): Kitchen, Basement, Garage, Master Bedroom, Living Room, Work Hallway, Foyer, Bathroom, Baby's Room, Upstairs Hallway, Bath Corridor, Bath Alcove, Walk-in Closet, Baby Closet, Balcony
2. **Item Cataloging** — 196 items cataloged across all rooms, synced to Supabase
3. **iframe + postMessage Bridge** — React SPA communicates with standalone Three.js 3D model
4. **Search** — Debounced local search with URL persistence, 3D zone highlighting, directional camera

## Next Up
- Deploy latest build to Vercel (`npx vercel --prod` from local machine)
- Further item cataloging from additional video walkthroughs
- Consider adding item editing UI (currently items are read-only in the app)
