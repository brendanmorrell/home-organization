# Home Organization — 3D Home Inventory Navigator

React Router v7 SPA + Three.js r128 (CDN, in `public/house-3d.html`) + Supabase.

## CRITICAL: Camera Flip Rule

Camera at (22,18,28) → lookAt(4,-0.5,2). **+x = WEST = LEFT on screen**, -x = EAST = RIGHT. +z = NORTH, -z = SOUTH. +y = UP.

## Workstreams

1. **3D Modeling (ACTIVE)** — Build rooms in `public/house-3d.html`
2. **Item Cataloging (NOT STARTED)** — Process videos, categorize items

**Completed:** Living Room (r5), Kitchen (r1), Work Hallway (r6), Garage (r3), Foyer (r7), Bathroom (r8), Master Bedroom (r4), Baby's Room (r9), Upstairs Hallway (r10), Bath Corridor (r11), Bath Alcove (r12), Walk-in Closet (r13), Baby Closet (r14), Basement (r2), Balcony (r15)
**Next:** Item cataloging phase.

## Room Data Structure

```javascript
{
  id: "r1", name: "Kitchen", icon: "K", color: "#8d6e63",
  pos_x: 8.8, pos_y: 0, pos_z: 16.8,
  width: 4.57, depth: 4.57, height: 2.8,
  wallOpenings: {  // optional: cuts holes in room perimeter walls
    front: [], back: [], left: [], right: []
    // each: { x, y, w, h, arch? } — x/y relative to wall center
  },
  furniture: [{
    type: "cabinet", name: "West Wall Cabinets",
    storageZone: true, zoneLabel: "KITCHEN-WEST", zoneType: "cabinet",
    capacity: { slots: 6, slotDesc: "cabinet doors" },
    x: 1.85, y: -0.95, z: 0,  // LOCAL to room center
    w: 0.6, h: 0.9, d: 3.0,   // w=E-W, h=up-down, d=N-S
    color: "#78909c",
    items: [{ name: "Plates", location: "Top shelf" }],
    // Optional properties:
    rotY: 0,              // rotation in radians on Y-axis
    doorFace: "+z",       // removes one face for closet openings: "+z","-z","+x","-x"
    badgeOffsetX: 0,      // shift item count badge position
    badgeOffsetY: 0,
    badgeOffsetZ: 0,
  }]
}
```

**Local coords:** x ∈ [-width/2, +width/2] (+x=WEST), y ∈ [-height/2, +height/2] (floor=-height/2), z ∈ [-depth/2, +depth/2] (+z=NORTH). Floor placement: `y = -(height/2) + (objH/2)`.

## Room Positions

| Room             | ID  | pos_x | pos_y | pos_z | W    | D    | H    |
| ---------------- | --- | ----- | ----- | ----- | ---- | ---- | ---- |
| Kitchen          | r1  | 8.8   | 0     | 16.8  | 4.57 | 4.57 | 2.8  |
| Work Hallway     | r6  | 7.7   | 0     | 19.69 | 2.44 | 3.66 | 2.8  |
| Living Room      | r5  | 8     | 0     | 9     | 6.1  | 11.0 | 3.35 |
| Garage           | r3  | 8     | -0.45 | 0     | 6.1  | 6.1  | 3.7  |
| Basement         | r2  | 0     | -1.0  | -6.69 | 6.5  | 8.28 | 2.5  |
| Foyer            | r7  | 7.7   | 0     | 23.37 | 4.9  | 3.7  | 2.8  |
| Bathroom (down)  | r8  | 10.0  | 0     | 20.3  | 2.1  | 1.5  | 2.8  |
| Master Bedroom   | r4  | -2.40 | 0     | 6.28  | 7.01 | 4.88 | 2.8  |
| Baby's Room      | r9  | -1.95 | 0     | 15.42 | 6.10 | 4.27 | 2.8  |
| Baby Closet      | r14 | -5.45 | 0     | 16.49 | 0.91 | 1.52 | 2.8  |
| Upstairs Hallway | r10 | -4.54 | 0     | 11.0  | 2.74 | 4.57 | 2.8  |
| Bath Corridor    | r11 | -1.49 | 0     | 11.0  | 1.52 | 4.57 | 2.8  |
| Bath Alcove      | r12 | 0.19  | 0     | 12.07 | 1.83 | 2.44 | 2.8  |
| Walk-in Closet   | r13 | 0.19  | 0     | 9.78  | 1.83 | 2.13 | 2.8  |
| Balcony          | r15 | 8.0   | 0     | -15   | 6.1  | 6.1  | 2.8  |

## Furniture Types

- **staircase** — Steps + wrought iron posts + handrail. Use `rotY: Math.PI` to reverse.
- **chair** — Seat + backrest + 4 legs.
- **shelf** — Open shelving with horizontal planes in wireframe.
- **cabinet** — Solid box with internal shelves. Supports `doorFace` prop to remove one face (for closets).
- **box** — Cardboard-style with flap lines.
- **appliance** — Default solid box.
- **toilet** — Custom porcelain model (pedestal + bridge + tank + seat rim + lid).

`rotY` (radians) rotates any item on Y-axis.

## Multi-Piece Furniture

Complex items are built from multiple `appliance` entries:
- **Desk**: top + 4 legs (open underneath)
- **Console table**: top + 4 legs
- **Banister**: N vertical balusters + 1 horizontal handrail
- **Crib**: mattress pad + 4 corner posts + 4 top rails + 4 bottom rails + vertical spindles per side
- **Hollow tub**: bottom panel + 4 rim walls
- **Wireframe shower**: 3 wall panels + glass door panel
- **Credenza with drawers**: cabinet body + thin appliance "drawer line" strips on the face

## Floor Cutout System

Add `floorCutout` to a room to create a stair opening in the floor:
```javascript
floorCutout: { xMin: -1.37, xMax: -0.35, zMin: -1.02, zMax: 2.13 }
```
The renderer builds floor as strips around the rectangular hole. Used in r10 (Upstairs Hallway) for the stairwell view down to the living room.

## noCeiling Property

Set `noCeiling: true` on a room to remove its ceiling mesh and top edge wireframe. Used on r11 (Bath Corridor) to reduce visual clutter.

## Wall Opening Y-Position

For door openings with `h: 2.1` in rooms with `height: 2.8`, use `y: -0.35` so the bottom reaches the floor. Formula: `y = -H/2 + h/2 = -1.4 + 1.05 = -0.35`. Using `y: -0.1` leaves a 25cm gap above the floor that renders as visible blue wireframe artifacts.

## Middle Zone (Cross-Room Furniture)

When furniture items bridge the gap between two adjacent rooms (e.g., laundry nook, closets, and vanity between r10 and r11), place them as furniture in the larger room but position their x-coordinate to extend PAST the room's wall into the physical gap. In r10, items at `x: 1.83` (with `w: 0.91`) extend from inside the hallway through its west wall into the 0.92m gap to r11. Items accessed from the hallway use `doorFace: "-x"`, items accessed from the corridor use `doorFace: "+x"`.

## Wall Openings System

Walls are built using a strip-based PlaneGeometry approach (not Shape holes — those don't work in Three.js r128). Each wall with openings returns a `THREE.Group` with `_isWallGroup: true`. Blue edge outlines (LineSegments, 0x90caf9) are always visible regardless of smart wall opacity. The smart visibility system skips `Line` objects when adjusting wall opacity.

Wall sides: `front` (+z/north), `back` (-z/south), `left` (-x/east), `right` (+x/west).

## doorFace Property

For closets/cabinets that open into a room, set `doorFace` to remove one face and add a blue door frame outline. Values: `"+z"` (north), `"-z"` (south), `"+x"` (west), `"-x"` (east). Closets with `doorFace` get no internal shelves.

## Badge Offsets

When item count badges conflict with nearby geometry, use `badgeOffsetX`, `badgeOffsetY`, `badgeOffsetZ` on the furniture item to shift the badge position.

## Blueprint-First Workflow (MANDATORY for new rooms)

1. Ingest source material (video/photos/descriptions)
2. Create `{room}-blueprint.html` — 2D top-down with labels, dimensions, wall assignments, N/S/E/W, uncertainty markers (❓)
3. User reviews & corrects
4. Build 3D ONLY after blueprint approval

## Room Layouts

### Kitchen (r1) 15×15ft

N: Fridge (centered) + cabinet above. Pantry door at 45° in NW corner.
W: Lower cabs + counter, stove (center), microwave (above), upper cabs, backsplash.
E: 2 decorative mirrors.
S: Breakfast nook (E-W bar, walkway gap on east). Sink on nook, dishwasher in south face. 2 bar stools south. 3 pendants above.
CENTER: Kitchen island (SEPARATE from nook) — 5ft N-S × 2ft E-W.

### Work Hallway (r6) 8×12ft (widened 50% N-S)

E: Continuous countertop. Redesigned cabinetry (S→N): cupboard+drawer, cabinet+double drawers, 3 drawers, chair (knee-hole), 3 drawers. Upper cabs touch south wall. Printer on south counter. Window on north wall.
W: Bathroom wall (solid, door opening to bathroom).
Extends south into kitchen area (south edge at ~z=17.86, past fridge line).

### Living Room (r5) 20×36ft

S: Stone fireplace (centered, floor-to-ceiling), hearth, insert, mantel, TV. Ladder shelf (E of FP). Garage door (E end). Entry shelf (W of FP).
W: L-sectional (main N-S + chaise E). Recliner near FP.
E: Staircase (starts N, climbs S, rotY: π). Hall closet (mid, doorFace: "-z"). Shoe bench (S of closet). Bar (N end, under stairs).
CENTER: Coffee table, area rug, east straight couch section.

### Garage (r3) 20×20ft, floor 3ft below

S: Garage door. N: Door to living room (NE) + 3-step stairs up. Upper shelves N→W continuous, also NE.
E: Pegboard (south), wall hooks (mid). Load-bearing pipe at x:0, z:1.5.
NE quadrant: Weight tower (wireframe), dumbbell rack (against N wall), weight bench (N-S, ~1ft W of rack, pad+legs+crossbar).

### Foyer (r7) 16×12ft

Connected through arch at north end of Work Hallway. Front door on north wall (street side).
N: Front door (west offset), window (east of door), shoe cubby bench (below window), door mat.
W: L-sectional vertical piece (N-S along wall). Hanging rope shelves ×3 (wall-mounted above). Welcome sign.
S: Arch to hallway (slightly east of center). Coat closet (doorFace: "+z", east of arch, extends backward into hallway).
E: Dark futon (under double window). Double window.
CENTER: Area rug. Plant stand (NW corner).
CEILING: Pendant light (NE corner).
Storage: ONLY the coat closet is a storage zone in the foyer.

### Bathroom (r8) 7×5ft

Door on east wall connects to west wall of Work Hallway.
All fixtures on NORTH wall (E→W): vanity (vessel sink) + mirror above, toilet (faces S) + Gazette Telegraph frame above, small wall section, walk-in shower (glass doors on east side).
E: Door to hallway (N half), towel bar (S half behind door), light switches.
S: Bare wall.

### Master Bedroom (r4) 23×16ft

N: Nightstand (NW), bed (king, N-centered), nightstand (NE). Wall art above bed.
W: Dresser (credenza w/ drawer lines). TV mounted above.
S: Bare wall.
E: 3 doorways to hallway (walk-in closet, bath corridor, hallway access).
Wall openings: front (N) has 3 openings for walk-in closet, bath corridor, and hallway.

### Baby's Room (r9) 20×14ft

NW: Baby crib (multi-piece: mattress + 4 posts + 8 rails + 10 spindles).
W: Changing table (dresser-style).
S: Rocking chair/glider.
E: Bookshelf.
Doorway on south wall to hallway. Doorway on west wall to baby closet (r14).

### Baby Closet (r14) 3×5ft

Small closet off west wall of baby room. Single shelf unit. `doorFace: "+x"` opens east into baby room.

### Upstairs Hallway (r10) 9×15ft

E side (x: -1.37 to -0.35): Floor cutout for stairwell view down to living room. Iron balusters + handrail along cutout edge.
W side (x: 1.83, extending into gap): Middle zone items — Laundry Nook (S), Bath Closet (mid), Linen Closet (mid), Vanity Counter + Mirror (N).
Doorways: front (N) to baby room, back (S) to master bedroom.

### Bath Corridor (r11) 5×15ft

Narrow corridor connecting bath alcove (N) and walk-in closet area (S). `noCeiling: true`.
Doorways: front (N) to bath alcove, back (S) to master bedroom.
No furniture (middle zone items housed in r10 extend into this space).

### Bath Alcove (r12) 6×8ft

Bathtub area. Hollow tub (multi-piece: bottom + 4 rim walls).
Doorway on back (S) wall to bath corridor.

### Walk-in Closet (r13) 6×7ft

Master closet. Shelving units along walls. `doorFace: "-z"` opens south.
Doorway on back (S) wall connecting to bath corridor area.

### Basement (r2) 21×23ft (extended 25% N-S)

Split into W/HVAC room and E/bedroom by L-shaped dividing wall (~5in). Floor at world y=-4.45.
N: Two raised concrete platforms (W and E of dividing wall), ~1.07m high, ~1.22m open above. Shelf on E platform (boxes, seasonal). Windows on N wall.
W (HVAC Room): HVAC furnace (centered, near N platform). Utility sink (W wall, N-S double basin, ~5ft S of HVAC). Window on W wall above sink.
E (Bedroom): Bed (mattress+box spring on floor, W edge against wall). Clothes box (U-Haul, S of bed, against wall).
DIVIDING WALL: L-shaped — vertical N-S from N wall ~4.4m, turns E ~0.8m to door frame (~3.5ft opening).
HALLWAY: ~3.5ft gap between bedroom and south section.
S Section: Staircase (SE corner, climbs N to living room). Under-stair nook (N of stairs). Open landing (W of stairs). Paint closet (W of landing, extends W to dividing wall, doorFace: "-x"). Open shelving (S of closet, no W wall — opens to HVAC/sink area).
Partition walls: Stairwell W wall, open area E wall, paint closet N wall.

## Validator

`node validate-room.js` — checks bounds, y-positions, overlaps. Known false positives: wall-mounted, counter-mounted, ceiling-hung, and embedded items.

Ground plane: y=-2.5. Grid: y=-2.48.

## Key Files

- `public/house-3d.html` — All 3D model code (~3300 lines)
- `validate-room.js` — Room validator
- `scripts/push-to-supabase.ts` — DB push script
- `check.js` — Quick syntax checker for house-3d.html
- `scripts/run-migration.sh` — Run SQL migrations against Supabase

## Supabase Migrations

When you need to create or alter tables in Supabase, write a SQL file in `migrations/` and run it:

```bash
./scripts/run-migration.sh migrations/my-migration.sql
```

The script uses the Supabase Management API with `SUPABASE_ACCESS_TOKEN` from `.env`. No manual SQL editor needed.

**Important:** `references` is a reserved word in PostgreSQL. Always quote it as `"references"` in SQL. The Supabase JS client (`.from("references")`) handles this automatically.

### .env keys (all in `.env`, gitignored)
- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — Public anon key (embedded in client)
- `SUPABASE_SERVICE_ROLE_KEY` — Admin key for server-side operations
- `SUPABASE_ACCESS_TOKEN` — Personal access token for Management API (migrations)

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
- Save progress, checkpoint, resume → invoke checkpoint
- Code quality, health check → invoke health
