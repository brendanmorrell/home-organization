const ROOMS = [
  {
    id: "r1", name: "Kitchen", icon: "K", color: "#8d6e63",
    // CORRECTED: Kitchen is north of living room (open plan).
    // Living room north wall at world z=14.5. Kitchen south edge meets it.
    // Kitchen: 15ft x 15ft = 4.57m x 4.57m, height 2.8m
    // West wall aligned with living room west wall (x=11.05 world)
    // Center x = 11.05 - 4.57/2 = 8.77 → 8.8
    // Center z = 14.5 + 4.57/2 = 16.78 → 16.8
    // ORIENTATION (same camera-flip rule as living room):
    //   x = +2.285 → WEST WALL (stove, microwave, upper cabs)
    //   x = -2.285 → EAST WALL (mirrors on wall)
    //   z = -2.285 → SOUTH (open to living room — breakfast nook bar here, walkway gap on east)
    //   z = +2.285 → NORTH (fridge, opens to work hallway)
    //   Floor at y = -1.4, Ceiling at y = +1.4
    pos_x: 8.8, pos_y: 0, pos_z: 16.8, width: 4.57, depth: 4.57, height: 2.8,
    furniture: [
      // === WEST WALL: COOKING COUNTER ===
      // Lower cabinets + granite counter (against west wall, ~3m run centered N-S)
      { type: "cabinet", name: "West Wall Lower Cabinets + Counter", category: "Kitchenware",
        storageZone: true, zoneLabel: "KITCHEN-LOWER-CAB", zoneType: "cabinet",
        capacity: { slots: 8, slotDesc: "cabinet sections and drawers" },
        x: 1.85, y: -0.95, z: 0, w: 0.6, h: 0.9, d: 3.0, color: "#8d6e63",
        items: []},
      // Upper cabinets (above counter, against west wall)
      { type: "cabinet", name: "West Wall Upper Cabinets", category: "Kitchenware",
        storageZone: true, zoneLabel: "KITCHEN-UPPER-CAB", zoneType: "cabinet",
        capacity: { slots: 6, slotDesc: "3-4 cabinet doors" },
        x: 2.1, y: 0.35, z: 0, w: 0.35, h: 0.8, d: 3.0, color: "#5d4037",
        items: []},
      // Stove/Range (electric, stainless) — middle of west wall
      { type: "appliance", name: "Stove/Range (Electric)", category: "Kitchen",
        storageZone: false,
        x: 1.85, y: -0.95, z: 0, w: 0.75, h: 0.9, d: 0.75, color: "#37474f",
        items: []},
      // Samsung Microwave (mounted above stove)
      { type: "appliance", name: "Samsung Microwave", category: "Kitchen",
        storageZone: false,
        x: 1.95, y: 0.0, z: 0, w: 0.6, h: 0.35, d: 0.4, color: "#546e7a",
        items: []},
      // Tile backsplash (thin visual element against west wall)
      { type: "appliance", name: "Tile Backsplash (West Wall)", category: "Structural",
        storageZone: false,
        x: 2.22, y: -0.3, z: 0, w: 0.05, h: 1.3, d: 3.0, color: "#bcaaa4",
        items: []},

      // === NW CORNER: 45° PANTRY DOOR ===
      // Diagonal wall + door cutting the NW corner between the stove counter and the fridge.
      // rotY = PI/4 (45°) so it angles from the west wall counter area to the north wall fridge.
      // Positioned at the midpoint between end of counter (~z=1.5) and fridge (z=1.9)
      { type: "appliance", name: "Pantry Door (45° angle)", category: "Structural",
        storageZone: false,
        x: 1.1, y: -0.35, z: 1.7, w: 0.1, h: 2.1, d: 1.4, color: "#f5f5f5",
        rotY: -Math.PI / 4,
        items: []},

      // === NORTH WALL: FRIDGE ===
      // French door stainless steel fridge, centered-ish on north wall, facing south
      { type: "appliance", name: "Fridge (French Door Stainless)", category: "Kitchen",
        storageZone: false,
        x: 0.3, y: -0.5, z: 1.9, w: 0.9, h: 1.8, d: 0.8, color: "#78909c",
        items: []},
      // Cabinet above fridge
      { type: "cabinet", name: "Cabinet Above Fridge", category: "Kitchenware",
        storageZone: true, zoneLabel: "KITCHEN-ABOVE-FRIDGE", zoneType: "cabinet",
        capacity: { slots: 2, slotDesc: "deep cabinet above fridge" },
        x: 0.3, y: 0.7, z: 1.9, w: 0.9, h: 0.5, d: 0.8, color: "#5d4037",
        items: []},

      // === BREAKFAST NOOK (south edge, runs E-W) ===
      // Bar-height counter running west-to-east along the south wall.
      // ~3ft deep (0.9m N-S), stretches from west wall almost to east wall.
      // Walkway gap on the east side (~3ft) for entry from living room.
      // Seating on the living room (south) side — 2 bar stools.
      // Sink is on this counter. Dishwasher built into it.
      { type: "cabinet", name: "Breakfast Nook Counter", category: "Kitchen",
        storageZone: true, zoneLabel: "KITCHEN-NOOK", zoneType: "cabinet",
        capacity: { slots: 6, slotDesc: "lower cabinets under breakfast bar" },
        x: 0.5, y: -0.95, z: -1.8, w: 3.5, h: 0.9, d: 0.9, color: "#78909c",
        items: []},
      // South-facing cabinets under breakfast nook (accessed from living room side)
      { type: "cabinet", name: "Breakfast Nook South Cabinets", category: "Kitchen",
        storageZone: true, zoneLabel: "KITCHEN-NOOK-SOUTH", zoneType: "cabinet",
        capacity: { slots: 4, slotDesc: "south-facing cabinets under breakfast bar" },
        x: 0.5, y: -0.95, z: -2.35, w: 3.0, h: 0.9, d: 0.15, color: "#607d8b",
        doorFace: "-z",
        items: []},
      // Sink (on the breakfast nook, south face, centered E-W)
      { type: "appliance", name: "Kitchen Sink", category: "Kitchen",
        storageZone: false,
        x: 0.3, y: -0.4, z: -2.1, w: 0.5, h: 0.15, d: 0.4, color: "#90caf9",
        items: []},
      // Dishwasher (built into south side of breakfast nook)
      { type: "appliance", name: "Dishwasher (Stainless)", category: "Kitchen",
        storageZone: false,
        x: -0.5, y: -0.95, z: -2.15, w: 0.6, h: 0.85, d: 0.1, color: "#455a64",
        items: []},
      // Bar stool 1 (south of nook, in living room space)
      { type: "chair", name: "Bar Stool 1", category: "Furniture",
        storageZone: false,
        x: 0.8, y: -1.15, z: -2.5, w: 0.4, h: 0.7, d: 0.4, color: "#6d4c41",
        items: []},
      // Bar stool 2
      { type: "chair", name: "Bar Stool 2", category: "Furniture",
        storageZone: false,
        x: -0.2, y: -1.15, z: -2.5, w: 0.4, h: 0.7, d: 0.4, color: "#6d4c41",
        items: []},

      // === KITCHEN ISLAND (center of room, runs N-S) ===
      // Separate from the breakfast nook. 5ft x 2ft = 1.52m x 0.61m.
      // Sits in the middle of the open kitchen floor.
      { type: "cabinet", name: "Kitchen Island", category: "Cookware",
        storageZone: true, zoneLabel: "KITCHEN-ISLAND", zoneType: "cabinet",
        capacity: { slots: 4, slotDesc: "shelves and cabinets inside island" },
        x: 0, y: -0.95, z: 0.2, w: 0.61, h: 0.9, d: 1.52, color: "#6d4c41",
        items: []},

      // === PENDANT LIGHTS above BREAKFAST NOOK (3 lights running E-W) ===
      { type: "appliance", name: "Pendant Light 1", category: "Lighting",
        storageZone: false,
        x: 1.2, y: 1.0, z: -1.8, w: 0.2, h: 0.3, d: 0.2, color: "#ffcc02",
        items: []},
      { type: "appliance", name: "Pendant Light 2", category: "Lighting",
        storageZone: false,
        x: 0.3, y: 1.0, z: -1.8, w: 0.2, h: 0.3, d: 0.2, color: "#ffcc02",
        items: []},
      { type: "appliance", name: "Pendant Light 3", category: "Lighting",
        storageZone: false,
        x: -0.6, y: 1.0, z: -1.8, w: 0.2, h: 0.3, d: 0.2, color: "#ffcc02",
        items: []},

      // === EAST WALL: DECORATIVE MIRRORS ===
      { type: "appliance", name: "Wall Mirror 1", category: "Decor",
        storageZone: false,
        x: -2.2, y: 0.1, z: 0.5, w: 0.05, h: 0.8, d: 0.6, color: "#b0bec5",
        items: []},
      { type: "appliance", name: "Wall Mirror 2", category: "Decor",
        storageZone: false,
        x: -2.2, y: 0.1, z: -0.5, w: 0.05, h: 0.8, d: 0.6, color: "#b0bec5",
        items: []},
    ]
  },
  // === WORK HALLWAY (r6) — extends north from kitchen, east side ===
  // WIDENED 50%: ~8ft E-W x 12ft N-S = 2.44m x 3.66m. Extends south into kitchen area.
  // West side is a bathroom wall (not modeled here).
  // East side: redesigned cabinetry layout (S→N): cupboard+drawer, cabinet+2drawers, 3drawers, chair, 3drawers
  // Kitchen east wall world x = 8.8 - 2.285 = 6.515
  // Work hallway east wall = kitchen east wall = 6.515
  // Work hallway width 2.44m → west wall at 6.515 + 2.44 = 8.955
  // Center x = (6.515 + 8.955)/2 = 7.735 → 7.7
  // North edge stays at 21.52 (foyer connection). New depth 3.66m.
  // Center z = 21.52 - 3.66/2 = 19.69
  // ORIENTATION:
  //   x = +1.22 → WEST (bathroom wall)
  //   x = -1.22 → EAST (counters, cabinets, printer)
  //   z = -1.83 → SOUTH (extends into kitchen area, near fridge line)
  //   z = +1.83 → NORTH (foyer arch)
  //   Floor at y = -1.4, Ceiling at y = +1.4
  {
    id: "r6", name: "Work Hallway", icon: "W", color: "#e8b960",
    pos_x: 7.7, pos_y: 0, pos_z: 19.69, width: 2.44, depth: 3.66, height: 2.8,
    // Arch to foyer on north wall, bathroom door on west wall
    wallOpenings: {
      front: [ // north wall (+z) — arch to foyer
        { x: 0, y: -0.1, w: 1.2, h: 2.2, arch: true },
      ],
      right: [ // west wall (+x) — bathroom door (shifted north since room extended south)
        { x: 0.6, y: -0.1, w: 0.75, h: 2.1 },
      ],
    },
    furniture: [
      // === EAST WALL CABINETRY (redesigned, S→N layout) ===
      // Continuous countertop spanning full east wall
      { type: "appliance", name: "Desk Countertop (continuous)", category: "Office/Utility",
        storageZone: false,
        x: -0.8, y: -0.53, z: -0.15, w: 0.7, h: 0.05, d: 3.2, color: "#a1887f",
        items: []},

      // 1. Cupboard + drawer above (southmost section, against south wall)
      { type: "cabinet", name: "South Cupboard + Drawer", category: "Office/Utility",
        storageZone: true, zoneLabel: "WORKHALL-SOUTH-CAB", zoneType: "cabinet",
        capacity: { slots: 2, slotDesc: "cupboard + drawer above" },
        x: -0.8, y: -0.98, z: -1.5, w: 0.7, h: 0.85, d: 0.55, color: "#78909c",
        items: []

      // 2. Covered cabinet + 2 drawers above (left/right)
      { type: "cabinet", name: "Cabinet + Double Drawers", category: "Office/Utility",
        storageZone: true, zoneLabel: "WORKHALL-MID-CAB", zoneType: "cabinet",
        capacity: { slots: 3, slotDesc: "cabinet + 2 drawers" },
        x: -0.8, y: -0.98, z: -0.85, w: 0.7, h: 0.85, d: 0.65, color: "#78909c",
        items: []

      // 3. Three drawers (south of chair / closer to chair from south)
      { type: "cabinet", name: "Three Drawers (South of Chair)", category: "Office/Utility",
        storageZone: true, zoneLabel: "WORKHALL-DRAWERS-S", zoneType: "cabinet",
        capacity: { slots: 3, slotDesc: "3 stacked drawers" },
        x: -0.8, y: -0.98, z: -0.25, w: 0.7, h: 0.85, d: 0.5, color: "#78909c",
        items: []

      // 4. Chair (knee-hole) — centered in the run
      { type: "chair", name: "Office Chair (wheeled)", category: "Office/Utility",
        storageZone: false,
        x: -0.4, y: -0.9, z: 0.3, w: 0.55, h: 1.0, d: 0.55, color: "#37474f",
        rotY: -Math.PI / 2,
        items: []},

      // 5. Three drawers (north of chair)
      { type: "cabinet", name: "Three Drawers (North of Chair)", category: "Office/Utility",
        storageZone: true, zoneLabel: "WORKHALL-DRAWERS-N", zoneType: "cabinet",
        capacity: { slots: 3, slotDesc: "3 stacked drawers" },
        x: -0.8, y: -0.98, z: 0.85, w: 0.7, h: 0.85, d: 0.5, color: "#78909c",
        items: []

      // Upper cabinets — stay touching south wall (above south cabinetry section)
      { type: "cabinet", name: "Desk Upper Cabinets", category: "Office/Utility",
        storageZone: true, zoneLabel: "WORKHALL-UPPER", zoneType: "cabinet",
        capacity: { slots: 4, slotDesc: "3 cabinet doors" },
        x: -1.05, y: 0.35, z: -1.2, w: 0.35, h: 0.8, d: 1.2, color: "#5d4037",
        items: []

      // Canon Printer on south end of counter
      { type: "appliance", name: "Canon Printer", category: "Office/Utility",
        storageZone: false,
        x: -0.7, y: -0.35, z: -1.5, w: 0.35, h: 0.2, d: 0.3, color: "#e0e0e0",
        items: []},

      // Window (NE area, on north wall above counter)
      { type: "appliance", name: "Window 1", category: "Structural",
        storageZone: false,
        x: -0.8, y: 0.2, z: 1.76, w: 0.6, h: 0.8, d: 0.05, color: "#90caf9",
        items: []},
    ]
  },
  {
    id: "r2", name: "Basement", icon: "B", color: "#3949ab",
    // BASEMENT — 6.5m × 8.28m × 2.5m, floor at world y = -2.25
    // Extended depth +20% south (6.9 → 8.28m). North wall held at world z = -2.55.
    // Local coords: +x=WEST, -x=EAST, +z=NORTH, -z=SOUTH
    // halfW=3.25, halfD=4.14, halfH=1.25, floor y=-1.25
    // Old south wall was z=-3.45 local; new south wall at z=-4.14 local (0.69m further S)
    pos_x: 0, pos_y: -1.0, pos_z: -6.69, width: 6.5, depth: 8.28, height: 2.5,
    furniture: [
      // ============================================================
      //  NORTH: RAISED CONCRETE PLATFORMS (both sides of dividing wall)
      // ============================================================

      // West raised concrete platform — against north wall, west of dividing wall
      // Extended to new north wall (halfD=4.14). d: 1.2→1.89, z shifted to abut north wall.
      { type: "appliance", name: "Raised Concrete Platform (West)", category: "Structural",
        storageZone: true, zoneLabel: "BSMT-RAISED-W", zoneType: "platform",
        capacity: { slots: 4, slotDesc: "open platform area" },
        x: 1.69, y: -0.72, z: 3.195, w: 3.125, h: 1.07, d: 1.89, color: "#5c4033",
        items: []},

      // East raised concrete platform — against north wall, east of dividing wall
      // Extended to new north wall (halfD=4.14). d: 1.2→1.89, z shifted.
      { type: "appliance", name: "Raised Concrete Platform (East)", category: "Structural",
        storageZone: true, zoneLabel: "BSMT-RAISED-E", zoneType: "platform",
        capacity: { slots: 6, slotDesc: "open platform area" },
        x: -1.64, y: -0.72, z: 3.195, w: 3.225, h: 1.07, d: 1.89, color: "#5c4033",
        items: []},

      // NOTE: East platform shelf removed — user doesn't recognize it.
      // Items on east platform stored as platform inventory instead.


      // ============================================================
      //  DIVIDING WALL — L-shaped, splits W/HVAC from E/Bedroom
      //  ~5in (0.15m) thick wall
      // ============================================================

      // Vertical portion: runs N-S from north wall south to L-turn
      // Extended to new north wall (halfD=4.14). d: 4.375→5.07, z shifted.
      // South edge at -0.93 (unchanged), north edge at 4.14 (new north wall).
      { type: "appliance", name: "Dividing Wall (N-S)", category: "Structural",
        storageZone: false,
        x: 0.05, y: 0, z: 1.605, w: 0.15, h: 2.5, d: 5.07, color: "#607d8b",
        items: []},

      // Horizontal portion: turns east from vertical wall, solid part only (before door)
      // bp: x=250→314 solid (64px = 0.8m), at y=338→350
      // center: (282, 344)
      { type: "appliance", name: "Dividing Wall (E-W turn)", category: "Structural",
        storageZone: false,
        x: -0.28, y: 0, z: -0.85, w: 0.8, h: 2.5, d: 0.15, color: "#607d8b",
        items: []},

      // ============================================================
      //  WEST SIDE: HVAC ROOM
      // ============================================================

      // HVAC furnace — centered west side, close to north platform
      // bp: x=50,y=108,w=150,h=90 → center (125,153)
      { type: "appliance", name: "HVAC Furnace + Ductwork", category: "Utilities",
        storageZone: false,
        x: 1.69, y: -0.25, z: 1.24, w: 1.875, h: 2.0, d: 1.125, color: "#37474f",
        items: []},

      // Utility sink — west wall, N-S double basin orientation
      // bp: x=4,y=320,w=48,h=100 → center (28,370)
      { type: "appliance", name: "Utility Sink (Double Basin)", category: "Utilities",
        storageZone: true, zoneLabel: "BSMT-SINK-AREA", zoneType: "utility",
        capacity: { slots: 2, slotDesc: "under-sink area" },
        x: 2.9, y: -0.80, z: -1.18, w: 0.6, h: 0.9, d: 1.25, color: "#546e7a",
        items: []},

      // ============================================================
      //  EAST SIDE: BEDROOM
      // ============================================================

      // Bed — mattress + box spring on floor, west edge against dividing wall
      // bp: x=264,y=104,w=150,h=110 → center (339,159)
      // h=0.76m (~2.5ft), floor placement: y = -1.25 + 0.38 = -0.87
      { type: "appliance", name: "Bed (Mattress + Box Spring)", category: "Bedroom",
        storageZone: false,
        x: -0.99, y: -0.87, z: 1.46, w: 1.875, h: 0.76, d: 1.375, color: "#8d6e63",
        items: []},

      // Clothes box (U-Haul) — south of bed, against dividing wall
      // bp: x=264,y=222,w=56,h=72 → center (292,258)
      // h=1.5m (~5ft tall wardrobe box), floor: y = -1.25 + 0.75 = -0.50
      { type: "box", name: "Clothes Box (U-Haul)", category: "Clothing",
        storageZone: true, zoneLabel: "BSMT-CLOTHES", zoneType: "box",
        capacity: { slots: 1, slotDesc: "large moving box" },
        x: -0.40, y: -0.50, z: 0.23, w: 0.7, h: 1.5, d: 0.9, color: "#795548",
        items: []},

      // ============================================================
      //  SOUTH SECTION: STAIRWELL + PAINT CLOSET + OPEN SHELVING
      // ============================================================

      // Partition wall — stairwell west wall (N-S)
      // bp: x=440, y=400→552 → 1.9m tall wall
      // center: (440, 476)
      { type: "appliance", name: "Stairwell West Wall", category: "Structural",
        storageZone: false,
        x: -2.25, y: 0, z: -2.845, w: 0.1, h: 2.5, d: 2.59, color: "#455a64",
        items: []},

      // Partition wall — open area / closet east wall (N-S)
      // bp: x=380, y=411→552 → 1.76m
      // center: (380, 481.5)
      { type: "appliance", name: "Open Area East Wall", category: "Structural",
        storageZone: false,
        x: -1.50, y: 0, z: -2.915, w: 0.1, h: 2.5, d: 2.45, color: "#455a64",
        items: []},

      // Partition wall — paint closet north wall (E-W)
      // bp: x=262→380 at y=411 → 1.475m
      // center: (321, 411)
      { type: "appliance", name: "Paint Closet North Wall", category: "Structural",
        storageZone: false,
        x: -0.76, y: 0, z: -1.69, w: 1.475, h: 2.5, d: 0.1, color: "#455a64",
        items: []},

      // Staircase — SE corner, climbs from floor up to ceiling, heading N→S
      // bp: x=440,y=435,w=80,h=117 → center (480,493.5)
      // rotY: Math.PI reverses default climb direction (now climbs south toward living room)
      { type: "staircase", name: "Staircase to Living Room", category: "Structural",
        storageZone: false, rotY: Math.PI,
        x: -2.75, y: 0, z: -3.065, w: 1.0, h: 2.5, d: 2.15, color: "#bcaaa4",
        items: []},

      // Under-stair storage nook (north of stairs, tucked underneath)
      // bp: x=440,y=400,w=80,h=35 → center (480,417.5)
      { type: "cabinet", name: "Under-Stair Nook", category: "Storage",
        storageZone: true, zoneLabel: "BSMT-UNDERSTAIR", zoneType: "cabinet",
        capacity: { slots: 3, slotDesc: "nook area under stairs" },
        x: -2.75, y: -0.75, z: -1.77, w: 1.0, h: 1.0, d: 0.44, color: "#3e2723",
        items: []},

      // Paint closet — enclosed room with shelves, door opens east
      // bp: x=262,y=411,w=118,h=70 → center (321,446)
      // doorFace: "-x" opens east into open area / hallway
      { type: "cabinet", name: "Paint Closet", category: "Supplies",
        storageZone: true, zoneLabel: "BSMT-PAINT-CLOSET", zoneType: "cabinet",
        doorFace: "-x",
        capacity: { slots: 6, slotDesc: "closet shelves" },
        x: -0.76, y: 0, z: -2.13, w: 1.475, h: 2.5, d: 0.875, color: "#455a64",
        items: []},

      // Open shelving — L-shaped along south face of paint closet + east partition wall
      // Paint closet south edge at local z = -2.57. Room south wall at z = -3.45.
      // East partition wall (west face) at local x ≈ -1.45.
      // Piece 1: E-W shelf along paint closet south wall (full width)
      //   0.4m deep shelf against the wall
      { type: "shelf", name: "Open Shelving (E-W leg)", category: "Storage",
        storageZone: true, zoneLabel: "BSMT-SHELVING-EW", zoneType: "shelf",
        capacity: { slots: 3, slotDesc: "shelf positions" },
        x: -0.76, y: -0.25, z: -2.77, w: 1.475, h: 2.0, d: 0.4, color: "#78909c",
        items: []},
      // Piece 2: N-S shelf along east partition wall (down to south room wall)
      //   0.4m deep shelf against the wall, from paint closet south to room south
      { type: "shelf", name: "Open Shelving (N-S leg)", category: "Storage",
        storageZone: true, zoneLabel: "BSMT-SHELVING-NS", zoneType: "shelf",
        capacity: { slots: 3, slotDesc: "shelf positions" },
        x: -1.25, y: -0.25, z: -3.355, w: 0.4, h: 2.0, d: 1.57, color: "#78909c",
        items: []},

      // ============================================================
      //  WINDOWS (thin visual markers)
      // ============================================================

      // North wall windows removed — don't exist in reality.

      // Window — east wall
      // bp: x=516,y=200,w=8,h=48 → center (520,224) on east wall
      { type: "appliance", name: "Window (East Wall)", category: "Structural",
        storageZone: false,
        x: -3.25, y: 0.5, z: 0.65, w: 0.05, h: 0.5, d: 0.6, color: "#4fc3f7",
        items: []},

      // Window — west wall (near utility sink)
      // bp: x=-4,y=340,w=8,h=56 → center (0,368) on west wall
      { type: "appliance", name: "Window (West Wall)", category: "Structural",
        storageZone: false,
        x: 3.25, y: 0.5, z: -1.15, w: 0.05, h: 0.5, d: 0.7, color: "#4fc3f7",
        items: []},

      // ============================================================
      //  STORAGE CONTAINERS ON BASEMENT RAISED PLATFORMS
      // ============================================================

      // KEEPSAKE CLOTHING (Large B&Y) on WEST platform
      { type: "box", name: "KEEPSAKE CLOTHING", category: "Deep Storage",
        x: 2.2, y: -0.005, z: 3.195, w: 0.61, h: 0.36, d: 0.41, color: "#fdd835",
        items: []},

      // BABY KEEPSAKES (Large B&Y) on WEST platform
      { type: "box", name: "BABY KEEPSAKES", category: "Deep Storage",
        x: 1.0, y: -0.005, z: 3.195, w: 0.61, h: 0.36, d: 0.41, color: "#fdd835",
        items: []},

      // DÉCOR - SEASONAL (Clear medium) on EAST platform
      { type: "box", name: "DÉCOR - SEASONAL", category: "Deep Storage",
        x: -1.64, y: -0.035, z: 3.195, w: 0.51, h: 0.30, d: 0.36, color: "#b3e5fc",
        items: []},
    ]
  },
  {
    id: "r3", name: "Garage", icon: "G", color: "#546e7a",
    // Same ceiling as living room (world y=1.4), but floor ~3ft lower (ground level)
    // Living room floor: world y=-1.4. Garage floor: world y=-2.31.
    // height=3.7, pos_y=-0.45 → floor at -2.3, ceiling at 1.4
    pos_x: 8, pos_y: -0.45, pos_z: 0, width: 6.1, depth: 6.1, height: 3.7,
    furniture: [
      // ==== WALL LAYOUT (CORRECTED ORIENTATION) ====
      // South wall (z = -3.05): GARAGE DOOR
      // North wall (z = +3.05): Doorway to living room (NE side) + 3-step staircase up
      // East wall  (x = -3.05): Shelves (NE area), pegboard, hooks, dumbbell rack
      // West wall  (x = +3.05): Shelves
      // Floor at y_local = -1.85

      // ---- GARAGE DOOR (south wall, z-) ----
      { type: "appliance", name: "Garage Door", category: "Structural",
        storageZone: false,
        x: 0, y: -0.3, z: -2.95, w: 4.8, h: 2.4, d: 0.08, color: "#455a64",
        items: []},

      // ---- WEST WALL SHELF: ~3.8m long, 0.6m deep ----
      { type: "shelf", name: "Upper Shelves — West Wall", category: "Garage Storage",
        storageZone: true, zoneLabel: "GARAGE-SHELF-WEST", zoneType: "shelf",
        capacity: { slots: 8, slotDesc: "bins across (0.45m each), single depth row" },
        x: 2.85, y: 1.0, z: 0.3, w: 0.6, h: 0.15, d: 4.5, color: "#78909c",
        items: []},

      // ---- NORTH WALL SHELF: from door (x≈-1.3) to west wall (x≈+2.85) ----
      // Connects with west wall shelves at the NW corner
      { type: "shelf", name: "Upper Shelves — North Wall", category: "Garage Storage",
        storageZone: true, zoneLabel: "GARAGE-SHELF-NORTH", zoneType: "shelf",
        capacity: { slots: 8, slotDesc: "bins across (0.45m each)" },
        x: 0.95, y: 1.0, z: 2.85, w: 4.4, h: 0.15, d: 0.6, color: "#78909c",
        items: []},

      // ---- EAST WALL SHELF (NE area, near staircase): ~2.5m long ----
      { type: "shelf", name: "Upper Shelves — East Wall (NE)", category: "Garage Storage",
        storageZone: true, zoneLabel: "GARAGE-SHELF-NE", zoneType: "shelf",
        capacity: { slots: 5, slotDesc: "bins along wall (0.45m each)" },
        x: -2.85, y: 1.0, z: 1.5, w: 0.6, h: 0.15, d: 2.5, color: "#78909c",
        items: []},

      // ---- PEGBOARD (east wall, middle area) ----
      { type: "shelf", name: "Pegboard Tool Wall", category: "Tools",
        storageZone: true, zoneLabel: "GARAGE-PEGBOARD", zoneType: "wall-hooks",
        capacity: { slots: 15, slotDesc: "hook positions across pegboard" },
        badgeOffsetY: -1.2, badgeOffsetZ: 0.5,
        x: -2.85, y: 0, z: 0.2, w: 0.1, h: 1.2, d: 1.5, color: "#607d8b",
        items: []},

      // ---- WALL HOOKS (west wall, same N-S position) ----
      { type: "shelf", name: "Wall Hook Rack", category: "Garage Storage",
        storageZone: true, zoneLabel: "GARAGE-HOOKS-WEST", zoneType: "wall-hooks",
        capacity: { slots: 6, slotDesc: "individual hooks" },
        x: 2.85, y: 0.2, z: 0.2, w: 0.15, h: 0.05, d: 1.2, color: "#607d8b",
        items: []},

      // ---- FLOOR ZONE: open garage floor ----
      { type: "appliance", name: "Garage Floor — Open Area", category: "Garage Storage",
        storageZone: true, zoneLabel: "GARAGE-FLOOR", zoneType: "floor",
        capacity: { slots: 20, slotDesc: "floor positions (~0.5m² each)" },
        x: 0, y: -1.85, z: -0.5, w: 4.0, h: 0.01, d: 5.0, color: "#37474f",
        items: []},

      // ---- STRUCTURAL: Load-bearing pipe (~5ft from north wall) ----
      { type: "appliance", name: "Load-Bearing Pipe", category: "Structural",
        storageZone: false,
        x: 0, y: 0, z: 1.5, w: 0.1, h: 3.7, d: 0.1, color: "#90a4ae",
        items: []},

      // ---- DOORWAY TO LIVING ROOM (north wall, NE side) ----
      // Door bottom at living room floor level (local y = -0.95)
      { type: "appliance", name: "Door Frame — West Side", category: "Structural",
        x: -2.05, y: 0.1, z: 2.95, w: 0.08, h: 2.1, d: 0.12, color: "#6d4c41",
        items: []},
      { type: "appliance", name: "Door Frame — East Side", category: "Structural",
        x: -2.95, y: 0.1, z: 2.95, w: 0.08, h: 2.1, d: 0.12, color: "#6d4c41",
        items: []},
      { type: "appliance", name: "Door Frame — Top", category: "Structural",
        x: -2.5, y: 1.19, z: 2.95, w: 0.98, h: 0.08, d: 0.12, color: "#6d4c41",
        items: []},

      // ---- 3-STEP STAIRCASE: garage floor up to living room level ----
      // Rise: 0.9m (floor -1.85 up to -0.95) over 3 stacked steps
      // Steps approach the north wall door from the south
      { type: "appliance", name: "Stair Step 1 (bottom)", category: "Structural",
        x: -2.5, y: -1.7, z: 2.1, w: 0.9, h: 0.3, d: 0.3, color: "#8d6e63",
        items: []},
      { type: "appliance", name: "Stair Step 2 (middle)", category: "Structural",
        x: -2.5, y: -1.55, z: 2.4, w: 0.9, h: 0.6, d: 0.3, color: "#8d6e63",
        items: []},
      { type: "appliance", name: "Stair Step 3 (top)", category: "Structural",
        x: -2.5, y: -1.4, z: 2.7, w: 0.9, h: 0.9, d: 0.3, color: "#8d6e63",
        items: []},

      // ---- GYM EQUIPMENT ----
      // Weight tower — SW corner (x+, z-) — wireframe: 4 vertical poles + horizontal bars
      // Tower footprint: ~1.52m x 1.52m (~5ft x 5ft), ~2.0m tall. Anchored at SW corner x:2.3, z:-2.3
      // Poles at: SW(2.3,-2.3), SE(0.78,-2.3), NW(2.3,-0.78), NE(0.78,-0.78). Center: x:1.54, z:-1.54
      // Vertical poles (4 corners)
      { type: "appliance", name: "Tower Pole — SW", category: "Fitness", storageZone: false,
        x: 2.3, y: -0.85, z: -2.3, w: 0.08, h: 2.0, d: 0.08, color: "#222222", items: []},
      { type: "appliance", name: "Tower Pole — SE", category: "Fitness", storageZone: false,
        x: 0.78, y: -0.85, z: -2.3, w: 0.08, h: 2.0, d: 0.08, color: "#222222", items: []},
      { type: "appliance", name: "Tower Pole — NW", category: "Fitness", storageZone: false,
        x: 2.3, y: -0.85, z: -0.78, w: 0.08, h: 2.0, d: 0.08, color: "#222222", items: []},
      { type: "appliance", name: "Tower Pole — NE", category: "Fitness", storageZone: false,
        x: 0.78, y: -0.85, z: -0.78, w: 0.08, h: 2.0, d: 0.08, color: "#222222", items: []},
      // Top horizontal bars (connecting poles at top)
      { type: "appliance", name: "Tower Bar — Top N-S West", category: "Fitness", storageZone: false,
        x: 2.3, y: 0.12, z: -1.54, w: 0.08, h: 0.08, d: 1.52, color: "#222222", items: []},
      { type: "appliance", name: "Tower Bar — Top N-S East", category: "Fitness", storageZone: false,
        x: 0.78, y: 0.12, z: -1.54, w: 0.08, h: 0.08, d: 1.52, color: "#222222", items: []},
      { type: "appliance", name: "Tower Bar — Top E-W South", category: "Fitness", storageZone: false,
        x: 1.54, y: 0.12, z: -2.3, w: 1.52, h: 0.08, d: 0.08, color: "#222222", items: []},
      { type: "appliance", name: "Tower Bar — Top E-W North", category: "Fitness", storageZone: false,
        x: 1.54, y: 0.12, z: -0.78, w: 1.52, h: 0.08, d: 0.08, color: "#222222", items: []},
      // Middle horizontal bars (mid-height crossbars)
      { type: "appliance", name: "Tower Bar — Mid N-S West", category: "Fitness", storageZone: false,
        x: 2.3, y: -0.85, z: -1.54, w: 0.08, h: 0.08, d: 1.52, color: "#222222", items: []},
      { type: "appliance", name: "Tower Bar — Mid N-S East", category: "Fitness", storageZone: false,
        x: 0.78, y: -0.85, z: -1.54, w: 0.08, h: 0.08, d: 1.52, color: "#222222", items: []},
      { type: "appliance", name: "Tower Bar — Mid E-W South", category: "Fitness", storageZone: false,
        x: 1.54, y: -0.85, z: -2.3, w: 1.52, h: 0.08, d: 0.08, color: "#222222", items: []},
      { type: "appliance", name: "Tower Bar — Mid E-W North", category: "Fitness", storageZone: false,
        x: 1.54, y: -0.85, z: -0.78, w: 1.52, h: 0.08, d: 0.08, color: "#222222", items: []},
      // ---- DUMBBELL RACK — against north wall, centered E-W, runs N-S from wall to pole ----
      // Wireframe rack: 4 vertical poles + horizontal bars
      // Centered at x:0 (middle of room), spans z: 1.55 (near pole) to 2.85 (north wall)
      // Vertical poles (4 corners)
      { type: "appliance", name: "Rack Pole — NE", category: "Fitness", storageZone: false,
        x: -0.2, y: -1.35, z: 2.85, w: 0.06, h: 1.0, d: 0.06, color: "#333333", items: []},
      { type: "appliance", name: "Rack Pole — NW", category: "Fitness", storageZone: false,
        x: 0.2, y: -1.35, z: 2.85, w: 0.06, h: 1.0, d: 0.06, color: "#333333", items: []},
      { type: "appliance", name: "Rack Pole — SE", category: "Fitness", storageZone: false,
        x: -0.2, y: -1.35, z: 1.55, w: 0.06, h: 1.0, d: 0.06, color: "#333333", items: []},
      { type: "appliance", name: "Rack Pole — SW", category: "Fitness", storageZone: false,
        x: 0.2, y: -1.35, z: 1.55, w: 0.06, h: 1.0, d: 0.06, color: "#333333", items: []},
      // Top horizontal bars
      { type: "appliance", name: "Rack Bar — Top E", category: "Fitness", storageZone: false,
        x: -0.2, y: -0.88, z: 2.2, w: 0.06, h: 0.06, d: 1.3, color: "#333333", items: []},
      { type: "appliance", name: "Rack Bar — Top W", category: "Fitness", storageZone: false,
        x: 0.2, y: -0.88, z: 2.2, w: 0.06, h: 0.06, d: 1.3, color: "#333333", items: []},
      { type: "appliance", name: "Rack Bar — Top N", category: "Fitness", storageZone: false,
        x: 0, y: -0.88, z: 2.85, w: 0.4, h: 0.06, d: 0.06, color: "#333333", items: []},
      { type: "appliance", name: "Rack Bar — Top S", category: "Fitness", storageZone: false,
        x: 0, y: -0.88, z: 1.55, w: 0.4, h: 0.06, d: 0.06, color: "#333333", items: []},
      // Bottom horizontal bars
      { type: "appliance", name: "Rack Bar — Bot E", category: "Fitness", storageZone: false,
        x: -0.2, y: -1.82, z: 2.2, w: 0.06, h: 0.06, d: 1.3, color: "#333333", items: []},
      { type: "appliance", name: "Rack Bar — Bot W", category: "Fitness", storageZone: false,
        x: 0.2, y: -1.82, z: 2.2, w: 0.06, h: 0.06, d: 1.3, color: "#333333", items: []},
      // Two square dumbbells sitting on top of the rack
      { type: "appliance", name: "Dumbbell 1 (square)", category: "Fitness", storageZone: false,
        x: 0, y: -0.75, z: 2.5, w: 0.35, h: 0.15, d: 0.15, color: "#222222", items: []},
      { type: "appliance", name: "Dumbbell 2 (square)", category: "Fitness", storageZone: false,
        x: 0, y: -0.75, z: 1.9, w: 0.35, h: 0.15, d: 0.15, color: "#222222", items: []},
      // Weight bench — E-W aligned, centered with rack (z:2.2), ~1ft west of rack
      // Bench pad (runs E-W)
      { type: "appliance", name: "Bench Pad", category: "Fitness",
        storageZone: false,
        x: 1.1, y: -1.5, z: 2.2, w: 1.2, h: 0.12, d: 0.3, color: "#1a1a1a",
        items: []},
      // Bench frame legs (west and east ends)
      { type: "appliance", name: "Bench Leg — West", category: "Fitness", storageZone: false,
        x: 1.6, y: -1.68, z: 2.2, w: 0.06, h: 0.5, d: 0.3, color: "#444444", items: []},
      { type: "appliance", name: "Bench Leg — East", category: "Fitness", storageZone: false,
        x: 0.6, y: -1.68, z: 2.2, w: 0.06, h: 0.5, d: 0.3, color: "#444444", items: []},
      // Bench crossbar (runs E-W under pad)
      { type: "appliance", name: "Bench Crossbar", category: "Fitness", storageZone: false,
        x: 1.1, y: -1.7, z: 2.2, w: 1.0, h: 0.06, d: 0.06, color: "#444444", items: []},

      // ============================================================
      //  STORAGE CONTAINERS ON GARAGE SHELVES
      // ============================================================

      // SPEECH THERAPY (Large B&Y) on NORTH shelf
      { type: "box", name: "SPEECH THERAPY", category: "Packed Storage",
        x: 2.0, y: 1.255, z: 2.85, w: 0.61, h: 0.36, d: 0.41, color: "#fdd835",
        items: []},

      // BAR DECOR & EXTRAS (Clear medium) on NORTH shelf
      { type: "box", name: "BAR DECOR & EXTRAS", category: "Packed Storage",
        x: 0.0, y: 1.225, z: 2.85, w: 0.51, h: 0.30, d: 0.36, color: "#b3e5fc",
        items: []},

      // ELECTRONICS (Clear medium) on NE shelf
      { type: "box", name: "ELECTRONICS", category: "Packed Storage",
        x: -2.85, y: 1.225, z: 1.5, w: 0.36, h: 0.30, d: 0.51, color: "#b3e5fc",
        items: []},

      // BOOKS (Clear medium) on WEST shelf
      { type: "box", name: "BOOKS", category: "Packed Storage",
        x: 2.85, y: 1.225, z: 1.0, w: 0.36, h: 0.30, d: 0.51, color: "#b3e5fc",
        items: []},

      // HEALTH & MEDICAL (Black small crate) on WEST shelf
      { type: "box", name: "HEALTH & MEDICAL", category: "Packed Storage",
        x: 2.85, y: 1.175, z: -0.5, w: 0.25, h: 0.20, d: 0.36, color: "#37474f",
        items: []},
    ]
  },
  // ================================================================
  //  UPSTAIRS ROOMS — floor level y=1.675 (living room ceiling)
  //  Blueprint coords (ft): x→East, y→South
  //  World conversion: world_x = -(bp_x * 0.3048) + 12.053
  //                    world_z = -(bp_y * 0.3048) + 19.687
  //  pos_y = 1.675 + height/2
  // ================================================================

  // ================================================================
  //  r4 — MASTER BEDROOM (bp: x=0..23, y=36..52, 23×16ft)
  //  N wall at y=36 = corridor zone S wall. NO GAP.
  //  S wall: stone fireplace centered, windows+balcony flanking.
  //  W wall: pictures. E wall: credenza+TV.
  //  ORIENTATION: +x=WEST, -x=EAST, +z=NORTH, -z=SOUTH
  //  center bp: x=11.5, y=44
  // ================================================================
  {
    id: "r4", name: "Master Bedroom", icon: "M", color: "#388e3c",
    pos_x: -2.40, pos_y: 0, pos_z: 6.28, width: 7.01, depth: 4.88, height: 2.8,
    wallOpenings: {
      front: [ // north wall (+z) — 3 doors: closet, bath corridor, hallway
        { x: 2.59, y: -0.35, w: 0.91, h: 2.1 },    // walk-in closet door (west side)
        { x: 0.91, y: -0.35, w: 0.91, h: 2.1 },    // bath corridor door (center-west)
        { x: -2.97, y: -0.35, w: 0.76, h: 2.1 },   // hallway door (east end)
      ],
    },
    furniture: [
      // === KING BED (white) + HEADBOARD on west side ===
      { type: "appliance", name: "King Bed", category: "Furniture",
        storageZone: false,
        x: 1.33, y: -1.1, z: 0.50, w: 1.92, h: 0.6, d: 2.04, color: "#f5f5f5",
        items: []},
      // Headboard — west side of bed, goes slightly above desk height
      { type: "appliance", name: "Headboard", category: "Furniture",
        storageZone: false,
        x: 2.33, y: -0.70, z: 0.50, w: 0.08, h: 1.4, d: 2.04, color: "#5d4037",
        items: []},

      // === DESK — grey top, 4 legs, open underneath, 1ft shorter ===
      // Top surface (grey)
      { type: "appliance", name: "Desk Top", category: "Furniture",
        storageZone: true, zoneLabel: "MASTER-DESK", zoneType: "cabinet",
        capacity: { slots: 4, slotDesc: "desk sections + drawers" },
        x: 2.59, y: -0.21, z: 0.46, w: 0.61, h: 0.05, d: 1.52, color: "#9e9e9e",
        items: []},
      // Desk legs (4)
      { type: "appliance", name: "Desk Leg — NW", category: "Furniture",
        storageZone: false,
        x: 2.86, y: -0.82, z: 1.17, w: 0.05, h: 1.17, d: 0.05, color: "#616161",
        items: []},
      { type: "appliance", name: "Desk Leg — NE", category: "Furniture",
        storageZone: false,
        x: 2.32, y: -0.82, z: 1.17, w: 0.05, h: 1.17, d: 0.05, color: "#616161",
        items: []},
      { type: "appliance", name: "Desk Leg — SW", category: "Furniture",
        storageZone: false,
        x: 2.86, y: -0.82, z: -0.25, w: 0.05, h: 1.17, d: 0.05, color: "#616161",
        items: []},
      { type: "appliance", name: "Desk Leg — SE", category: "Furniture",
        storageZone: false,
        x: 2.32, y: -0.82, z: -0.25, w: 0.05, h: 1.17, d: 0.05, color: "#616161",
        items: []},

      // === NIGHTSTANDS (brown, flanking desk) ===
      { type: "shelf", name: "Nightstand — North", category: "Bedroom",
        storageZone: false,
        x: 2.57, y: -1.1, z: 1.55, w: 0.46, h: 0.6, d: 0.24, color: "#5d4037",
        items: []},
      { type: "shelf", name: "Nightstand — South", category: "Bedroom",
        storageZone: false,
        x: 2.57, y: -1.1, z: -0.64, w: 0.46, h: 0.6, d: 0.24, color: "#5d4037",
        items: []},

      // === CONSOLE TABLE (black, 4 legs) on N wall ===
      // 6ft E-W × 1ft N-S × 3ft tall
      // Table top (black)
      { type: "appliance", name: "Console Table Top", category: "Furniture",
        storageZone: false,
        x: -0.91, y: -0.52, z: 2.04, w: 1.83, h: 0.05, d: 0.30, color: "#1a1a1a",
        items: []},
      // Table legs (4)
      { type: "appliance", name: "Table Leg — NW", category: "Furniture",
        storageZone: false,
        x: -0.04, y: -0.97, z: 2.16, w: 0.04, h: 0.86, d: 0.04, color: "#1a1a1a",
        items: []},
      { type: "appliance", name: "Table Leg — NE", category: "Furniture",
        storageZone: false,
        x: -1.78, y: -0.97, z: 2.16, w: 0.04, h: 0.86, d: 0.04, color: "#1a1a1a",
        items: []},
      { type: "appliance", name: "Table Leg — SW", category: "Furniture",
        storageZone: false,
        x: -0.04, y: -0.97, z: 1.92, w: 0.04, h: 0.86, d: 0.04, color: "#1a1a1a",
        items: []},
      { type: "appliance", name: "Table Leg — SE", category: "Furniture",
        storageZone: false,
        x: -1.78, y: -0.97, z: 1.92, w: 0.04, h: 0.86, d: 0.04, color: "#1a1a1a",
        items: []},
      // Stools that tuck under
      { type: "chair", name: "Stool — West", category: "Furniture",
        storageZone: false,
        x: -0.46, y: -1.1, z: 1.83, w: 0.35, h: 0.6, d: 0.35, color: "#4e342e",
        items: []},
      { type: "chair", name: "Stool — East", category: "Furniture",
        storageZone: false,
        x: -1.37, y: -1.1, z: 1.83, w: 0.35, h: 0.6, d: 0.35, color: "#4e342e",
        items: []},

      // === STONE FIREPLACE — S wall, half depth + mantel + tall shelf ===
      // Fireplace body (half depth, against south wall)
      { type: "appliance", name: "Stone Fireplace", category: "Structural",
        storageZone: false,
        x: 0, y: 0, z: -2.25, w: 1.83, h: 2.8, d: 0.38, color: "#795548",
        items: []},
      // Single mantel shelf — sticks out from fireplace at ~6ft height
      { type: "appliance", name: "Mantel Shelf", category: "Structural",
        storageZone: true, zoneLabel: "MASTER-MANTEL", zoneType: "shelf",
        capacity: { slots: 2, slotDesc: "mantel top" },
        x: 0, y: 0.43, z: -1.96, w: 2.0, h: 0.08, d: 0.30, color: "#6d4c41",
        items: []

      // === CREDENZA (brown wood, with drawers) + TV above — E wall ===
      { type: "cabinet", name: "Credenza", category: "Entertainment",
        storageZone: true, zoneLabel: "MASTER-CREDENZA", zoneType: "cabinet",
        capacity: { slots: 4, slotDesc: "drawers + shelves" },
        x: -3.17, y: -1.1, z: 0.46, w: 0.55, h: 0.6, d: 1.52, color: "#5d4037",
        items: []},
      // Drawer lines on credenza front face (3 horizontal dividers)
      { type: "appliance", name: "Credenza Drawer Line 1", category: "Furniture",
        x: -2.89, y: -0.95, z: 0.46, w: 0.02, h: 0.02, d: 1.48, color: "#3e2723", items: []},
      { type: "appliance", name: "Credenza Drawer Line 2", category: "Furniture",
        x: -2.89, y: -1.10, z: 0.46, w: 0.02, h: 0.02, d: 1.48, color: "#3e2723", items: []},
      { type: "appliance", name: "Credenza Drawer Line 3", category: "Furniture",
        x: -2.89, y: -1.25, z: 0.46, w: 0.02, h: 0.02, d: 1.48, color: "#3e2723", items: []},
      // Vertical divider (center split)
      { type: "appliance", name: "Credenza Center Divider", category: "Furniture",
        x: -2.89, y: -1.1, z: 0.46, w: 0.02, h: 0.56, d: 0.02, color: "#3e2723", items: []},
      // TV wall-mounted above credenza
      { type: "appliance", name: "TV", category: "Entertainment",
        storageZone: false,
        x: -3.40, y: 0.3, z: 0.46, w: 0.08, h: 0.76, d: 1.37, color: "#1a1a1a",
        items: []},

      // === ASIAN FOLDING SCREENS — 2 panels each at 120° angle ===
      // North screen (north of credenza) — hinge near east wall
      // North screen — panels fold toward room (west), away from wall
      { type: "appliance", name: "Folding Screen N — Panel A", category: "Decor",
        storageZone: false,
        x: -3.15, y: -0.64, z: 1.94, w: 0.60, h: 1.52, d: 0.03, color: "#3e2723",
        rotY: -1.047,  // -π/3 ≈ -60° (fold west)
        items: []},
      { type: "appliance", name: "Folding Screen N — Panel B", category: "Decor",
        storageZone: false,
        x: -3.15, y: -0.64, z: 1.42, w: 0.60, h: 1.52, d: 0.03, color: "#4e342e",
        rotY: 1.047,  // +π/3 ≈ 60° (fold west)
        items: []},
      // South screen — panels fold toward room (west), away from wall
      { type: "appliance", name: "Folding Screen S — Panel A", category: "Decor",
        storageZone: false,
        x: -3.15, y: -0.64, z: -0.53, w: 0.60, h: 1.52, d: 0.03, color: "#3e2723",
        rotY: -1.047,
        items: []},
      { type: "appliance", name: "Folding Screen S — Panel B", category: "Decor",
        storageZone: false,
        x: -3.15, y: -0.64, z: -1.05, w: 0.60, h: 1.52, d: 0.03, color: "#4e342e",
        rotY: 1.047,
        items: []},
    ]
  },
  {
    id: "r5", name: "Living Room", icon: "L", color: "#7b1fa2",
    pos_x: 8, pos_y: 0, pos_z: 9, width: 6.1, depth: 11, height: 3.35,
    // NOTE: Unified open floor plan for main living level.
    // Transcript: 20ft wide (6.1m), 11ft ceiling (3.35m).
    // ORIENTATION:
    //   z = -5.5  → SOUTH WALL (short, 6.1m) — FIREPLACE center, garage entry door (east side)
    //   z = +5.5  → FRONT WALL (short, 6.1m) — opens toward kitchen
    //   x = +3.05 → WEST WALL (long, 11m) — windows (no doors), L-couch, recliner
    //   x = -3.05 → EAST WALL (long, 11m) — staircase, hall closet, bar, shoe storage
    // Floor at y = -1.675, Ceiling at y = +1.675
    wallOpenings: {
      back: [ // south wall (z=-D/2) — garage entry door on east side
        { x: -2.5, y: -0.625, w: 0.9, h: 2.1 },
      ],
    },
    furniture: [

      // ============================================================
      // ZONE A: ENTRY FROM GARAGE (south wall, east side)
      // ============================================================

      // Garage entry door — on SOUTH (fireplace) wall, east side (moved east for hearth clearance)
      // Coming from garage, you enter the living room here
      { type: "appliance", name: "Garage Entry Door", category: "Structural",
        storageZone: false,
        x: -2.5, y: -0.625, z: -5.4, w: 0.9, h: 2.1, d: 0.1, color: "#f5f5f5",
        items: []},

      // Decorative ladder shelf — east of fireplace, between hearth and garage door
      { type: "shelf", name: "Decorative Ladder Shelf", category: "Decor",
        storageZone: true, zoneLabel: "LIVING-LADDER-SHELF", zoneType: "shelf",
        capacity: { slots: 4, slotDesc: "4 tiered shelves" },
        x: -1.6, y: -0.875, z: -5.25, w: 0.4, h: 1.5, d: 0.5, color: "#5d4037",
        items: []},

      // Rustic industrial shelf — against back wall, west of fireplace
      { type: "shelf", name: "Entry Shelf (Rustic Industrial)", category: "Decor",
        storageZone: true, zoneLabel: "LIVING-ENTRY-SHELF", zoneType: "shelf",
        capacity: { slots: 5, slotDesc: "5 open shelves" },
        x: 2.3, y: -0.875, z: -5.25, w: 0.7, h: 1.6, d: 0.4, color: "#5d4037",
        items: []

      // ============================================================
      // ZONE B: STONE FIREPLACE (back wall center, z ≈ -5.5)
      // ============================================================

      // Hearth base — stone perimeter around fireplace (~1ft high, ~1ft deep)
      // Extends beyond column on west, east, and north sides
      { type: "appliance", name: "Fireplace Hearth Base", category: "Structural",
        storageZone: false,
        x: 0, y: -1.25, z: -4.95, w: 2.1, h: 0.3, d: 1.1, color: "#8d8d8d",
        items: []},

      // Stone fireplace column — centered on back (short) wall, floor to ceiling
      // River rock / cobblestone, 1.5m wide, protrudes 0.8m from wall
      { type: "appliance", name: "Stone Fireplace Column", category: "Structural",
        storageZone: false,
        x: 0, y: 0.0, z: -5.1, w: 1.5, h: 3.35, d: 0.8, color: "#9e9e9e",
        items: []},

      // Fireplace insert — black metal, at base of column
      // Embedded in the column (overlap with column is intentional)
      { type: "appliance", name: "Fireplace Insert", category: "Structural",
        storageZone: false,
        x: 0, y: -1.325, z: -4.85, w: 0.9, h: 0.7, d: 0.4, color: "#212121",
        items: []},

      // Wood mantel shelf — on the stone, about 4ft / 1.2m up from floor
      { type: "shelf", name: "Fireplace Mantel", category: "Decor",
        storageZone: false,
        badgeOffsetY: 0.6, badgeOffsetZ: 0.4,
        x: 0, y: -0.455, z: -4.85, w: 1.2, h: 0.08, d: 0.25, color: "#8d6e63",
        items: []

      // TV — mounted on stone above mantel, ~5.5ft center
      { type: "appliance", name: "Wall-Mounted TV", category: "Electronics",
        storageZone: false,
        x: 0, y: 0.025, z: -5.1, w: 1.3, h: 0.75, d: 0.05, color: "#1a1a1a",
        items: []},

      // ============================================================
      // ZONE C: SEATING AREA — per floor plan drawing
      // L-shaped sectional: long arm along LEFT wall, short arm near fireplace
      // Recliner: bottom-left corner (near fireplace + left wall)
      // ============================================================

      // Leather recliner (La-Z-Boy) — bottom-left corner, between entry shelf and sofa
      { type: "chair", name: "Leather Recliner (La-Z-Boy)", category: "Furniture",
        storageZone: false,
        x: 2.4, y: -1.175, z: -4.5, w: 0.9, h: 1.0, d: 0.9, color: "#4e342e",
        items: []},

      // Sectional sofa — two separate pieces, cream/beige tufted
      // WESTERN PIECE: runs N-S along west wall, with chaise extending EAST at north end
      // Main body runs N-S
      { type: "appliance", name: "Sectional — West (main)", category: "Furniture",
        storageZone: false,
        x: 2.45, y: -1.275, z: -2.5, w: 1.1, h: 0.8, d: 2.8, color: "#d7ccc8",
        items: []},
      // Chaise at NORTH end of western piece, extends EAST — aligned with main piece north edge
      { type: "appliance", name: "Sectional — West (chaise)", category: "Furniture",
        storageZone: false,
        x: 1.35, y: -1.275, z: -1.65, w: 1.1, h: 0.8, d: 1.1, color: "#d7ccc8",
        items: []},
      // Couch back — west side of main piece (against wall)
      { type: "appliance", name: "Couch Back — West", category: "Furniture",
        storageZone: false,
        x: 2.95, y: -1.075, z: -2.5, w: 0.15, h: 1.2, d: 2.8, color: "#bcaaa4",
        items: []},
      // Couch back — north side of chaise
      { type: "appliance", name: "Couch Back — North (chaise)", category: "Furniture",
        storageZone: false,
        x: 1.9, y: -1.075, z: -1.15, w: 2.25, h: 1.2, d: 0.15, color: "#bcaaa4",
        items: []},
      // EASTERN PIECE: separate straight section, runs N-S
      { type: "appliance", name: "Sectional — East (straight)", category: "Furniture",
        storageZone: false,
        x: -0.5, y: -1.275, z: -2.5, w: 1.1, h: 0.8, d: 2.8, color: "#d7ccc8",
        items: []},
      // Couch back — east side of east piece
      { type: "appliance", name: "Couch Back — East", category: "Furniture",
        storageZone: false,
        x: -1.0, y: -1.075, z: -2.5, w: 0.15, h: 1.2, d: 2.8, color: "#bcaaa4",
        items: []},
      // Couch back — north side of east piece
      { type: "appliance", name: "Couch Back — North (east)", category: "Furniture",
        storageZone: false,
        x: -0.5, y: -1.075, z: -1.15, w: 1.1, h: 1.2, d: 0.15, color: "#bcaaa4",
        items: []},

      // Coffee table — between the two sectional pieces, ~1ft south of north backs
      { type: "appliance", name: "Coffee Table", category: "Furniture",
        storageZone: false,
        x: 1.0, y: -1.45, z: -2.8, w: 1.2, h: 0.45, d: 0.6, color: "#757575",
        items: []},

      // Area rug under seating area — centered on the L-shape zone
      { type: "appliance", name: "Area Rug", category: "Decor",
        storageZone: false,
        x: 1.5, y: -1.665, z: -3.2, w: 3.0, h: 0.02, d: 3.0, color: "#e0e0e0",
        items: []},

      // ============================================================
      // ZONE D: RIGHT WALL — CLOSET + SHOE STORAGE
      // Per corrected floor plan: closet is in MIDDLE of right wall
      // (between bar above and shoe storage below)
      // ============================================================

      // Utility / hall closet — MIDDLE of right wall per corrected floor plan
      // Transcript: 4ft × 4ft (1.22m × 1.22m), extra tall (staircase above)
      { type: "cabinet", name: "Hall Closet", category: "Household",
        storageZone: true, zoneLabel: "LIVING-HALL-CLOSET", zoneType: "cabinet",
        capacity: { slots: 8, slotDesc: "multiple shelves + floor area (tall closet, staircase above)" },
        doorFace: "-z",  // door opens south into living room
        x: -2.4, y: -0.475, z: -1.5, w: 1.22, h: 2.4, d: 1.22, color: "#fafafa",
        items: []

      // Shoe storage bench — against right wall, between closet and staircase area
      { type: "cabinet", name: "Shoe Storage Bench", category: "Household",
        storageZone: true, zoneLabel: "LIVING-SHOE-STORAGE", zoneType: "cabinet",
        capacity: { slots: 6, slotDesc: "cubby compartments" },
        x: -2.8, y: -1.425, z: -3.3, w: 0.4, h: 0.5, d: 1.5, color: "#212121",
        items: []

      // ============================================================
      // ZONE E: STAIRCASE TO UPPER FLOOR (right wall, z = 0 to +3)
      // ============================================================

      // Staircase — wrought iron balusters, wood treads
      // Against right wall, runs from z≈0 toward kitchen end
      { type: "staircase", name: "Staircase to Upper Floor", category: "Structural",
        storageZone: false,
        x: -2.5, y: 0.0, z: 2.0, w: 1.0, h: 3.35, d: 3.5, color: "#bcaaa4",
        rotY: Math.PI,
        items: []},

      // ============================================================
      // ZONE F: BUILT-IN BAR UNDER STAIRCASE
      // Bar runs along right wall under the stairs
      // Transcript: lower cabs 1.5ft deep (0.46m), upper cabs 8in deep (0.2m)
      // ============================================================

      // Lower cabinets — against right wall, oriented along z
      { type: "cabinet", name: "Bar Nook — Lower Cabinets", category: "Bar / Entertaining",
        storageZone: true, zoneLabel: "LIVING-BAR-CABINETS", zoneType: "cabinet",
        capacity: { slots: 6, slotDesc: "mini fridge + glass-front cab + 3 drawers" },
        x: -2.8, y: -1.225, z: 0.5, w: 0.46, h: 0.9, d: 2.0, color: "#d7ccc8",
        items: []

      // Upper cabinets — shallower, on wall above counter
      { type: "cabinet", name: "Bar Nook — Upper Cabinets", category: "Bar / Entertaining",
        storageZone: true, zoneLabel: "LIVING-BAR-UPPER-CABS", zoneType: "cabinet",
        capacity: { slots: 4, slotDesc: "2 big upper cabinets" },
        x: -2.9, y: -0.155, z: 0.5, w: 0.2, h: 0.6, d: 2.0, color: "#d7ccc8",
        items: []},

      // Bar countertop surface (granite) — at ~3ft / 0.9m height
      { type: "shelf", name: "Bar Counter (Granite)", category: "Bar / Entertaining",
        storageZone: true, zoneLabel: "LIVING-BAR-COUNTER", zoneType: "shelf",
        capacity: { slots: 8, slotDesc: "counter surface positions" },
        badgeOffsetY: -0.5, badgeOffsetX: 0.3,
        x: -2.8, y: -0.775, z: 0.5, w: 0.46, h: 0.05, d: 2.0, color: "#8d6e63",
        items: []

      // Arched nook back wall with vintage tin signs — on the right wall
      { type: "appliance", name: "Bar Nook Arch & Signs", category: "Decor",
        storageZone: false,
        x: -3, y: -0.305, z: 0.5, w: 0.1, h: 1.0, d: 1.5, color: "#757575",
        items: []

      // ============================================================
      // ZONE G: DINING AREA (toward kitchen end, z = +3 to +5)
      // ============================================================

      // Dining table — transcript: 10ft long (3.0m) × 3.5-4ft wide (1.1m)
      // Per floor plan: long axis runs LEFT-RIGHT (along x), chairs on z-sides
      { type: "appliance", name: "Dining Table", category: "Furniture",
        storageZone: false,
        x: 0.3, y: -1.275, z: 3.8, w: 3.0, h: 0.8, d: 1.1, color: "#8d6e63",
        items: []},

      // Wine rack — on left wall near dining area
      { type: "shelf", name: "Wall Wine Rack", category: "Bar / Entertaining",
        storageZone: true, zoneLabel: "LIVING-WINE-RACK", zoneType: "shelf",
        capacity: { slots: 4, slotDesc: "wine bottle slots + glass hooks" },
        x: 2.9, y: -0.155, z: 3.5, w: 0.2, h: 0.6, d: 0.8, color: "#5d4037",
        items: []

      // 4 dining chairs — 2 on each long side (z-axis sides)
      { type: "chair", name: "Dining Chair 1", category: "Furniture",
        storageZone: false,
        x: 1, y: -1.225, z: 3.0, w: 0.45, h: 0.9, d: 0.45, color: "#6d4c41",
        items: []},
      { type: "chair", name: "Dining Chair 2", category: "Furniture",
        storageZone: false,
        x: -0.4, y: -1.225, z: 3.0, w: 0.45, h: 0.9, d: 0.45, color: "#6d4c41",
        items: []},
      { type: "chair", name: "Dining Chair 3", category: "Furniture",
        storageZone: false,
        x: 1, y: -1.225, z: 4.6, w: 0.45, h: 0.9, d: 0.45, color: "#6d4c41",
        items: []},
      { type: "chair", name: "Dining Chair 4", category: "Furniture",
        storageZone: false,
        x: -0.4, y: -1.225, z: 4.6, w: 0.45, h: 0.9, d: 0.45, color: "#6d4c41",
        items: []},

      // ============================================================
      // CONNECTIONS / DOORWAYS
      // ============================================================

      // Door to basement — TOP-RIGHT corner, on kitchen-end wall (z = +5.5)
      // Rotated 90°: thin dimension faces the kitchen-end wall, opens outward
      // User note: "top area going forwards goes into the basement"
      { type: "appliance", name: "Basement Door", category: "Structural",
        storageZone: false,
        x: -2.5, y: -0.625, z: 5.4, w: 0.9, h: 2.1, d: 0.1, color: "#f5f5f5",
        items: []},

      // Doorway to garage (stairs down) — already modeled in garage room
      // Kitchen opening — front end (z = +5.5), will be modeled when kitchen is mapped
    ]
  },

  // ================================================================
  // FOYER (r7) — 16ft × 12ft (4.9m × 3.7m)
  // Through arched doorway at north end of Work Hallway
  // North = street side (front door). South = arch to hallway.
  // +x=WEST, -x=EAST per camera flip rule
  // LOCAL: x ∈ [-2.45, +2.45], z ∈ [-1.85, +1.85], y ∈ [-1.4, +1.4]
  // Floor at y=-1.4, Ceiling at y=+1.4
  // ================================================================
  {
    id: "r7", name: "Foyer", icon: "F", color: "#5c6bc0",
    pos_x: 7.7, pos_y: 0, pos_z: 23.37, width: 4.9, depth: 3.7, height: 2.8,
    // wallOpenings: front door + window on north wall, double window on east wall, arch on south
    wallOpenings: {
      front: [ // north wall (+z)
        { x: 0.6, y: -0.1, w: 0.95, h: 2.2 },   // front door (west offset)
        { x: -0.9, y: 0.2, w: 0.8, h: 1.1 },     // window east of door
      ],
      left: [ // east wall (-x)
        { x: 0, y: 0.2, w: 1.3, h: 1.2 },         // double window
      ],
      back: [ // south wall (-z)
        { x: -0.3, y: -0.1, w: 1.2, h: 2.2, arch: true },  // arch to hallway (slightly east of center)
        { x: -2.05, y: -0.1, w: 0.7, h: 2.1 },              // coat closet door (east of arch)
      ],
    },
    furniture: [
      // === L-SHAPED SECTIONAL (SW corner) ===
      // Single connected L: west piece flush against west wall, south piece flush against south wall
      // West piece (N-S run along west wall)
      { type: "appliance", name: "L-Sectional (West Piece)", category: "Furniture",
        storageZone: false,
        x: 2.05, y: -1.0, z: -0.45, w: 0.85, h: 0.8, d: 2.8, color: "#5b8def",
        items: []},
      // South piece / ottoman (E-W run along south wall) — shortened, flush to wall
      { type: "appliance", name: "L-Sectional (South Piece / Ottoman)", category: "Furniture",
        storageZone: false,
        x: 1.2, y: -1.0, z: -1.45, w: 1.2, h: 0.8, d: 0.85, color: "#5b8def",
        items: []},

      // === EAST WALL ===
      // Dark futon/bench against east wall, under double window (window is now a wall opening)
      { type: "appliance", name: "Dark Futon", category: "Furniture",
        storageZone: false,
        x: -2.05, y: -1.0, z: 0.15, w: 0.7, h: 0.8, d: 1.2, color: "#424242",
        items: []},

      // === NORTH WALL (Street Side) ===
      // Front door + window are now wall openings (no physical objects needed)

      // Shoe cubby bench (below north window) — wider E-W, less deep N-S
      { type: "cabinet", name: "Shoe Cubby Bench", category: "Furniture",
        storageZone: false,
        x: -0.9, y: -1.1, z: 1.47, w: 1.6, h: 0.6, d: 0.5, color: "#8d6e63",
        items: []},

      // Door mat (inside front door opening)
      { type: "appliance", name: "Door Mat", category: "Decor",
        storageZone: false,
        x: 0.6, y: -1.38, z: 1.4, w: 0.7, h: 0.04, d: 0.45, color: "#3e3e3e",
        items: []},

      // === SOUTH WALL ===
      // Hanging rope shelves ×3 (moved to south wall, above ottoman area of couch)
      { type: "shelf", name: "Hanging Rope Shelves ×3", category: "Decor",
        storageZone: false,
        x: 1.2, y: 0.3, z: -1.75, w: 1.0, h: 0.8, d: 0.25, color: "#ce93d8",
        items: []},

      // === CENTER ===
      // Area rug (flat on floor)
      { type: "appliance", name: "Area Rug", category: "Decor",
        storageZone: false,
        x: 0, y: -1.38, z: 0, w: 2.1, h: 0.03, d: 1.8, color: "#78748a",
        items: []},

      // Coat closet: door on south wall near east side, body extrudes southward out of foyer
      // East wall at x=-2.45, door touching it. Closet extends south (-z) past south wall.
      // Closet front (door) at z=-1.85 (south wall), body extends further south.
      { type: "cabinet", name: "Coat Closet", category: "Storage",
        storageZone: true, zoneLabel: "FOYER-COAT-CLOSET", zoneType: "cabinet",
        capacity: { slots: 4, slotDesc: "hanging rod + shelf" },
        doorFace: "+z",  // door opens north into foyer
        x: -2.05, y: -0.225, z: -2.2, w: 0.75, h: 2.35, d: 0.7, color: "#78909c",
        items: []

      // === CEILING ===
      // Pendant light (NE corner)
      { type: "appliance", name: "Pendant Light (NE)", category: "Lighting",
        storageZone: false,
        x: -1.8, y: 1.1, z: 1.2, w: 0.3, h: 0.3, d: 0.3, color: "#ffe0b0",
        items: []},

    ]
  },

  // ================================================================
  // BATHROOM (r8) — 7ft × 5ft (2.1m × 1.5m)
  // Door on east wall → connects to west wall of Work Hallway
  // All fixtures on NORTH wall. E→W: vanity, toilet, wall, shower
  // South wall is bare.
  // +x=WEST, -x=EAST per camera flip rule
  // LOCAL: x ∈ [-1.05, +1.05], z ∈ [-0.75, +0.75], y ∈ [-1.4, +1.4]
  // ================================================================
  {
    id: "r8", name: "Bathroom", icon: "B", color: "#4fc3f7",
    pos_x: 10.0, pos_y: 0, pos_z: 20.3, width: 2.1, depth: 1.5, height: 2.8,
    // Door opening on east wall (connects to work hallway)
    wallOpenings: {
      left: [ // east wall (-x)
        { x: 0.25, y: -0.1, w: 0.75, h: 2.1 },  // door in north half of east wall
      ],
    },
    furniture: [
      // === NORTH WALL FIXTURES (E→W) ===

      // 1. Vanity with vessel sink (NE corner, against north + east walls)
      { type: "cabinet", name: "Vanity (Vessel Sink)", category: "Bathroom",
        storageZone: true, zoneLabel: "BATH-VANITY", zoneType: "cabinet",
        capacity: { slots: 3, slotDesc: "drawers and under-sink" },
        x: -0.76, y: -0.95, z: 0.55, w: 0.55, h: 0.9, d: 0.4, color: "#8d6e63",
        items: []

      // Mirror above vanity (wall-mounted on north wall, aligned with vanity)
      { type: "appliance", name: "Mirror", category: "Bathroom",
        storageZone: false,
        x: -0.76, y: 0.3, z: 0.74, w: 0.5, h: 0.6, d: 0.03, color: "#b0bec5",
        items: []},

      // 2. Toilet (north wall, center, faces south)
      { type: "toilet", name: "Toilet", category: "Bathroom",
        storageZone: false,
        x: 0.1, y: -1.05, z: 0.45, w: 0.38, h: 0.7, d: 0.55, color: "#eceff1",
        items: []},

      // Framed Gazette Telegraph (on north wall above toilet)
      { type: "appliance", name: "Gazette Telegraph (Framed)", category: "Decor",
        storageZone: false,
        x: 0.1, y: 0.3, z: 0.74, w: 0.45, h: 0.35, d: 0.03, color: "#6d4c41",
        items: []},

      // Trash can (between vanity and toilet)
      { type: "appliance", name: "Trash Can", category: "Bathroom",
        storageZone: false,
        x: -0.35, y: -1.25, z: 0.5, w: 0.18, h: 0.3, d: 0.18, color: "#616161",
        items: []},

      // 3. Walk-in shower (west side, glass doors on east)
      // Takes up full west portion of room, floor to near-ceiling
      { type: "appliance", name: "Walk-in Shower", category: "Bathroom",
        storageZone: false,
        x: 0.7, y: -0.15, z: 0, w: 0.7, h: 2.4, d: 1.4, color: "#78909c",
        items: []},

      // Glass shower door (east face of shower — thin transparent panel)
      { type: "appliance", name: "Shower Glass Door", category: "Structural",
        storageZone: false,
        x: 0.35, y: -0.15, z: 0, w: 0.03, h: 2.0, d: 1.3, color: "#80deea",
        items: []},

      // East wall: door opening handled by wallOpenings, towel bar + switches removed
    ]
  },

  // ================================================================
  //  r9 — BABY'S ROOM (bp: x=0..20, y=7..21, 20×14ft)
  //  Upstairs, above living room area.
  //  S wall: 2 doors (to bath corridor + hallway), dresser+mirror between
  //  SW corner: queen bed against W wall
  //  NE corner: glider (1ft from N wall, 1ft from E wall)
  //  E wall: bookshelf south of closet area
  //  center bp: x=10, y=14
  // ================================================================
  {
    id: "r9", name: "Baby's Room", icon: "B", color: "#66bb6a",
    pos_x: -1.95, pos_y: 0, pos_z: 15.42, width: 6.10, depth: 4.27, height: 2.8,
    wallOpenings: {
      back: [ // south wall (-z) — 2 doors: to bath corridor (west) and hallway (east)
        { x: 0.46, y: -0.35, w: 0.91, h: 2.1 },    // door to bath corridor
        { x: -1.98, y: -0.35, w: 0.91, h: 2.1 },   // door to hallway
      ],
    },
    furniture: [
      // --- QUEEN BED (gray) — SW corner, against W wall ---
      { type: "appliance", name: "Queen Bed", category: "Furniture",
        storageZone: false,
        x: 2.20, y: -1.1, z: -1.07, w: 1.52, h: 0.6, d: 1.89, color: "#9e9e9e",
        items: []},

      // --- BOOKSHELF (black) — E wall, south of closet ---
      { type: "shelf", name: "Bookshelf", category: "Books & Media",
        storageZone: true, zoneLabel: "BABY-BOOKSHELF", zoneType: "shelf",
        capacity: { slots: 4, slotDesc: "shelves" },
        x: -2.74, y: -0.65, z: -0.30, w: 0.30, h: 1.5, d: 0.61, color: "#212121",
        items: []

      // --- GLIDER (gray) — NE corner, 1ft from N+E walls ---
      // Rotated 135° CCW (from top-down view) = 2.356 rad
      { type: "chair", name: "Glider Chair", category: "Furniture",
        storageZone: false,
        x: -2.44, y: -0.9, z: 1.52, w: 0.76, h: 1.0, d: 0.76, color: "#9e9e9e",
        rotY: 2.356,
        items: []},

      // --- BABY CRIB — NW corner, touches N+W walls ---
      // 5ft E-W (1.524m) × 3ft N-S (0.914m) × 3.5ft tall (1.067m)
      // Wooden banister style with hollow interior
      // Center: x=2.288, z=1.678, floor y=-1.4
      // Mattress pad (white, inside crib, raised ~0.45m from floor)
      { type: "appliance", name: "Crib Mattress", category: "Furniture",
        x: 2.288, y: -0.95, z: 1.678, w: 1.40, h: 0.08, d: 0.80, color: "#f5f5f5", items: []},
      // 4 Corner posts (wood)
      { type: "appliance", name: "Crib Post NW", category: "Furniture",
        x: 3.01, y: -0.867, z: 2.11, w: 0.05, h: 1.067, d: 0.05, color: "#c4a882", items: []},
      { type: "appliance", name: "Crib Post NE", category: "Furniture",
        x: 1.57, y: -0.867, z: 2.11, w: 0.05, h: 1.067, d: 0.05, color: "#c4a882", items: []},
      { type: "appliance", name: "Crib Post SW", category: "Furniture",
        x: 3.01, y: -0.867, z: 1.25, w: 0.05, h: 1.067, d: 0.05, color: "#c4a882", items: []},
      { type: "appliance", name: "Crib Post SE", category: "Furniture",
        x: 1.57, y: -0.867, z: 1.25, w: 0.05, h: 1.067, d: 0.05, color: "#c4a882", items: []},
      // 4 Top rails (horizontal bars connecting posts at top)
      { type: "appliance", name: "Crib Rail North", category: "Furniture",
        x: 2.288, y: -0.354, z: 2.11, w: 1.49, h: 0.04, d: 0.04, color: "#c4a882", items: []},
      { type: "appliance", name: "Crib Rail South", category: "Furniture",
        x: 2.288, y: -0.354, z: 1.25, w: 1.49, h: 0.04, d: 0.04, color: "#c4a882", items: []},
      { type: "appliance", name: "Crib Rail West", category: "Furniture",
        x: 3.01, y: -0.354, z: 1.678, w: 0.04, h: 0.04, d: 0.91, color: "#c4a882", items: []},
      { type: "appliance", name: "Crib Rail East", category: "Furniture",
        x: 1.57, y: -0.354, z: 1.678, w: 0.04, h: 0.04, d: 0.91, color: "#c4a882", items: []},
      // 4 Bottom rails (at mattress level)
      { type: "appliance", name: "Crib Bottom Rail N", category: "Furniture",
        x: 2.288, y: -1.30, z: 2.11, w: 1.49, h: 0.04, d: 0.04, color: "#c4a882", items: []},
      { type: "appliance", name: "Crib Bottom Rail S", category: "Furniture",
        x: 2.288, y: -1.30, z: 1.25, w: 1.49, h: 0.04, d: 0.04, color: "#c4a882", items: []},
      { type: "appliance", name: "Crib Bottom Rail W", category: "Furniture",
        x: 3.01, y: -1.30, z: 1.678, w: 0.04, h: 0.04, d: 0.91, color: "#c4a882", items: []},
      { type: "appliance", name: "Crib Bottom Rail E", category: "Furniture",
        x: 1.57, y: -1.30, z: 1.678, w: 0.04, h: 0.04, d: 0.91, color: "#c4a882", items: []},
      // Vertical spindles — North side (3 evenly spaced)
      { type: "appliance", name: "Crib Spindle N1", category: "Furniture",
        x: 1.93, y: -0.83, z: 2.11, w: 0.025, h: 0.90, d: 0.025, color: "#c4a882", items: []},
      { type: "appliance", name: "Crib Spindle N2", category: "Furniture",
        x: 2.29, y: -0.83, z: 2.11, w: 0.025, h: 0.90, d: 0.025, color: "#c4a882", items: []},
      { type: "appliance", name: "Crib Spindle N3", category: "Furniture",
        x: 2.65, y: -0.83, z: 2.11, w: 0.025, h: 0.90, d: 0.025, color: "#c4a882", items: []},
      // South side spindles (3)
      { type: "appliance", name: "Crib Spindle S1", category: "Furniture",
        x: 1.93, y: -0.83, z: 1.25, w: 0.025, h: 0.90, d: 0.025, color: "#c4a882", items: []},
      { type: "appliance", name: "Crib Spindle S2", category: "Furniture",
        x: 2.29, y: -0.83, z: 1.25, w: 0.025, h: 0.90, d: 0.025, color: "#c4a882", items: []},
      { type: "appliance", name: "Crib Spindle S3", category: "Furniture",
        x: 2.65, y: -0.83, z: 1.25, w: 0.025, h: 0.90, d: 0.025, color: "#c4a882", items: []},
      // West side spindles (2)
      { type: "appliance", name: "Crib Spindle W1", category: "Furniture",
        x: 3.01, y: -0.83, z: 1.53, w: 0.025, h: 0.90, d: 0.025, color: "#c4a882", items: []},
      { type: "appliance", name: "Crib Spindle W2", category: "Furniture",
        x: 3.01, y: -0.83, z: 1.83, w: 0.025, h: 0.90, d: 0.025, color: "#c4a882", items: []},
      // East side spindles (2)
      { type: "appliance", name: "Crib Spindle E1", category: "Furniture",
        x: 1.57, y: -0.83, z: 1.53, w: 0.025, h: 0.90, d: 0.025, color: "#c4a882", items: []},
      { type: "appliance", name: "Crib Spindle E2", category: "Furniture",
        x: 1.57, y: -0.83, z: 1.83, w: 0.025, h: 0.90, d: 0.025, color: "#c4a882", items: []},

      // --- DRESSER + MIRROR — S wall between doors ---
      { type: "cabinet", name: "Dresser + Mirror", category: "Clothing & Bedding",
        storageZone: true, zoneLabel: "BABY-DRESSER", zoneType: "cabinet",
        capacity: { slots: 6, slotDesc: "dresser drawers" },
        x: -0.91, y: -0.95, z: -1.83, w: 1.22, h: 0.91, d: 0.40, color: "#8d6e63",
        items: []},
      // Drawer lines on dresser front face (4 horizontal dividers)
      { type: "appliance", name: "Dresser Drawer Line 1", category: "Furniture",
        x: -0.91, y: -0.66, z: -1.62, w: 1.18, h: 0.02, d: 0.02, color: "#5d4037", items: []},
      { type: "appliance", name: "Dresser Drawer Line 2", category: "Furniture",
        x: -0.91, y: -0.82, z: -1.62, w: 1.18, h: 0.02, d: 0.02, color: "#5d4037", items: []},
      { type: "appliance", name: "Dresser Drawer Line 3", category: "Furniture",
        x: -0.91, y: -0.98, z: -1.62, w: 1.18, h: 0.02, d: 0.02, color: "#5d4037", items: []},
      { type: "appliance", name: "Dresser Drawer Line 4", category: "Furniture",
        x: -0.91, y: -1.14, z: -1.62, w: 1.18, h: 0.02, d: 0.02, color: "#5d4037", items: []},
    ]
  },

  // ================================================================
  //  r14 — BABY CLOSET (bp: x=20..23, y=8..13, 3×5ft)
  //  NE bump-out off baby's room.
  //  center bp: x=21.5, y=10.5
  // ================================================================
  {
    id: "r14", name: "Baby Closet", icon: "b", color: "#81c784",
    pos_x: -5.45, pos_y: 0, pos_z: 16.49, width: 0.91, depth: 1.52, height: 2.8,
    wallOpenings: {
      right: [ // west wall (+x) — opens into baby room
        { x: 0, y: -0.35, w: 0.76, h: 2.1 },
      ],
    },
    furniture: [
      { type: "cabinet", name: "Baby Closet Storage", category: "Clothing & Bedding",
        storageZone: true, zoneLabel: "BABY-CLOSET", zoneType: "cabinet",
        capacity: { slots: 4, slotDesc: "hanging rod + shelves" },
        x: 0, y: -0.15, z: 0, w: 0.7, h: 2.4, d: 1.2, color: "#66bb6a",
        doorFace: "+x",
        items: []
    ]
  },

  // ================================================================
  //  r15 — BALCONY (6.1×6.1m, 2nd floor, above garage area)
  //  Outdoor balcony with patio furniture and grill
  //  Shares fireplace with living room below
  //  center: pos_x=8.0, pos_y=3.0, pos_z=0.0
  // ================================================================
  {
    id: "r15", name: "Balcony", icon: "B", color: "#a1887f",
    pos_x: 8.0, pos_y: 3.0, pos_z: 0.0,
    width: 6.1, depth: 6.1, height: 2.8,
    noCeiling: true,
    wallOpenings: {
      front: [ // north wall (+z) — opening to master bedroom area
        { x: 0, y: -0.35, w: 1.5, h: 2.1 },
      ],
      back: [], left: [], right: []
    },
    furniture: [
      // --- PATIO TABLE & CHAIRS ---
      { type: "appliance", name: "Patio Table", category: "Furniture",
        x: 0, y: -0.95, z: 0, w: 1.2, h: 0.75, d: 1.2, color: "#5d4037", items: [] },
      { type: "chair", name: "Patio Chair 1", category: "Furniture",
        x: -1.0, y: -0.95, z: 0, w: 0.5, h: 0.8, d: 0.5, color: "#5d4037", items: [] },
      { type: "chair", name: "Patio Chair 2", category: "Furniture",
        x: 1.0, y: -0.95, z: 0, w: 0.5, h: 0.8, d: 0.5, color: "#5d4037", items: [] },

      // --- GRILL & TRASH ---
      { type: "appliance", name: "Grill", category: "Outdoor Cooking",
        x: 0, y: -0.75, z: -2.5, w: 0.8, h: 1.3, d: 0.6, color: "#37474f", items: [] },
      { type: "appliance", name: "Trash Can", category: "Maintenance",
        x: 1.5, y: -0.85, z: -2.5, w: 0.4, h: 1.1, d: 0.4, color: "#424242", items: [] },

      // --- DECK STORAGE BOX ---
      { type: "box", name: "Deck Storage Box", category: "Storage",
        storageZone: true, zoneLabel: "BALCONY-DECKBOX", zoneType: "box",
        capacity: { slots: 1, slotDesc: "large deck box" },
        x: -2.5, y: -1.05, z: -1.0, w: 1.2, h: 0.7, d: 0.6, color: "#6d4c41", items: [] },

      // --- STRING LIGHTS (decorative overhead) ---
      { type: "appliance", name: "String Lights", category: "Decoration",
        x: 0, y: 1.0, z: 0, w: 4.0, h: 0.05, d: 4.0, color: "#fff59d", items: [] },

      // --- SHARED FIREPLACE (north wall, visible from below) ---
      { type: "appliance", name: "Shared Fireplace (Upper Level)", category: "Fireplace",
        x: 0, y: -0.4, z: 2.8, w: 1.8, h: 2.0, d: 0.3, color: "#8d6e63", items: [] }
    ]
  },

  // ================================================================
  //  r10 — UPSTAIRS HALLWAY (bp: x=14..23, y=21..36, 9×15ft)
  //  E wall aligns with baby closet + master E wall at x=23.
  //  Contains hallway-side middle zone items (laundry nook, linen closet)
  //  on west wall.
  //  Stair railing at ~bp x=20 runs N-S.
  //  center bp: x=18.5, y=28.5
  // ================================================================
  {
    id: "r10", name: "Upstairs Hallway", icon: "H", color: "#5c6bc0",
    pos_x: -4.54, pos_y: 0, pos_z: 11.0, width: 2.74, depth: 4.57, height: 2.8,
    wallOpenings: {
      front: [ // north wall (+z) — door to baby room
        { x: -0.46, y: -0.35, w: 0.91, h: 2.1 },
      ],
      back: [ // south wall (-z) — door to master bedroom (SE side)
        { x: -0.76, y: -0.35, w: 0.76, h: 2.1 },
      ],
    },
    // Floor cutout for stair opening — from banister line to east wall
    // xMin=-1.37 (east wall), xMax=-0.35 (banister), zMin=-1.02 (baluster 8), zMax=2.13 (baluster 1)
    floorCutout: { xMin: -1.37, xMax: -0.35, zMin: -1.02, zMax: 2.13 },
    furniture: [
      // --- STAIR OPENING (east side of hallway) ---
      // The actual staircase geometry is in the living room (r5).
      // The banister here marks the edge of the stair opening.

      // --- BANISTER (black iron rods + metal handrail) ---
      // Separates stair opening from hallway walkway.
      // Runs N-S but stops ~1m (3.3ft) short of south wall for access.
      // Banister at local x ≈ -0.35 (between stair zone and walkway).
      // Total banister length: 4.57 - 1.0 = 3.57m, centered at z = 0.5 (shifted north)
      // Iron vertical rods (balusters)
      { type: "appliance", name: "Baluster 1", category: "Structural",
        x: -0.35, y: -0.45, z: 2.13, w: 0.03, h: 1.0, d: 0.03, color: "#1a1a1a", items: [] },
      { type: "appliance", name: "Baluster 2", category: "Structural",
        x: -0.35, y: -0.45, z: 1.68, w: 0.03, h: 1.0, d: 0.03, color: "#1a1a1a", items: [] },
      { type: "appliance", name: "Baluster 3", category: "Structural",
        x: -0.35, y: -0.45, z: 1.23, w: 0.03, h: 1.0, d: 0.03, color: "#1a1a1a", items: [] },
      { type: "appliance", name: "Baluster 4", category: "Structural",
        x: -0.35, y: -0.45, z: 0.78, w: 0.03, h: 1.0, d: 0.03, color: "#1a1a1a", items: [] },
      { type: "appliance", name: "Baluster 5", category: "Structural",
        x: -0.35, y: -0.45, z: 0.33, w: 0.03, h: 1.0, d: 0.03, color: "#1a1a1a", items: [] },
      { type: "appliance", name: "Baluster 6", category: "Structural",
        x: -0.35, y: -0.45, z: -0.12, w: 0.03, h: 1.0, d: 0.03, color: "#1a1a1a", items: [] },
      { type: "appliance", name: "Baluster 7", category: "Structural",
        x: -0.35, y: -0.45, z: -0.57, w: 0.03, h: 1.0, d: 0.03, color: "#1a1a1a", items: [] },
      { type: "appliance", name: "Baluster 8", category: "Structural",
        x: -0.35, y: -0.45, z: -1.02, w: 0.03, h: 1.0, d: 0.03, color: "#1a1a1a", items: [] },
      // Metal handrail on top of balusters
      { type: "appliance", name: "Handrail", category: "Structural",
        x: -0.35, y: 0.05, z: 0.56, w: 0.05, h: 0.04, d: 3.35, color: "#9e9e9e", items: [] },

      // --- MIDDLE ZONE: LAUNDRY NOOK (bp y=31..36, 5ft, S end) ---
      // Accessed from hallway (east side). On hallway's west wall.
      // doorFace: "-x" opens east into hallway.
      // Pulled slightly north so south face doesn't coincide with room wall.
      { type: "cabinet", name: "Laundry Nook", category: "Laundry",
        storageZone: true, zoneLabel: "HALL-LAUNDRY", zoneType: "cabinet",
        capacity: { slots: 3, slotDesc: "washer + dryer + shelf" },
        x: 1.83, y: -0.15, z: -1.47, w: 0.91, h: 2.4, d: 1.42, color: "#ef6c00",
        doorFace: "-x",
        items: []

      // --- MIDDLE ZONE: LINEN CLOSET (bp y=27..29, 2ft) ---
      // Accessed from hallway. On hallway's west wall.
      { type: "cabinet", name: "Linen Closet", category: "Linens & Towels",
        storageZone: true, zoneLabel: "HALL-LINEN", zoneType: "cabinet",
        capacity: { slots: 4, slotDesc: "shelves" },
        x: 1.83, y: -0.15, z: 0.15, w: 0.91, h: 2.4, d: 0.61, color: "#ef6c00",
        doorFace: "-x",
        items: []

      // --- MIDDLE ZONE: BATH CLOSET (bp y=29..31, 2ft) ---
      // Accessed from bath corridor (west). Extrudes east from corridor.
      // doorFace: "+x" opens westward into corridor
      { type: "cabinet", name: "Bath Closet", category: "Bathroom",
        storageZone: true, zoneLabel: "BATH-CLOSET", zoneType: "cabinet",
        capacity: { slots: 3, slotDesc: "shelves" },
        x: 1.83, y: -0.15, z: -0.46, w: 0.91, h: 2.4, d: 0.58, color: "#ef6c00",
        doorFace: "+x",
        items: []

      // --- MIDDLE ZONE: VANITY AREA (bp y=21..27, 6ft, N end) ---
      // Accessed from bath corridor (west). Extrudes east from corridor.
      // doorFace: "+x" opens westward into corridor
      { type: "appliance", name: "Vanity Counter", category: "Bathroom",
        storageZone: false,
        x: 1.83, y: -0.95, z: 1.37, w: 0.91, h: 0.91, d: 1.83, color: "#0288d1",
        doorFace: "+x",
        items: []},
      // Mirror above vanity — on east side wall of bathroom extension
      // East edge of vanity is at x ≈ 0.47. Mirror on that wall face.
      { type: "appliance", name: "Vanity Mirror", category: "Bathroom",
        storageZone: false,
        x: 1.37, y: 0.3, z: 1.37, w: 0.05, h: 0.76, d: 1.22, color: "#b3e5fc",
        items: []},
    ]
  },

  // ================================================================
  //  r11 — BATH CORRIDOR (bp: x=6..11, y=21..36, 5×15ft)
  //  Connects alcove (north) to master (south).
  //  Contains corridor-side middle zone items (bath closet, vanity) on
  //  east wall.
  //  center bp: x=8.5, y=28.5
  // ================================================================
  {
    id: "r11", name: "Bath Corridor", icon: "C", color: "#4fc3f7",
    pos_x: -1.49, pos_y: 0, pos_z: 11.0, width: 1.52, depth: 4.57, height: 2.8,
    noCeiling: true,
    wallOpenings: {
      front: [ // north wall (+z) — opening to baby room
        { x: 0, y: -0.35, w: 0.91, h: 2.1 },
      ],
      back: [ // south wall (-z) — door to master bedroom
        { x: 0, y: -0.35, w: 0.91, h: 2.1 },
      ],
    },
    furniture: [
      // Bath closet and vanity moved to r10 (hallway) to extrude eastward
      // into the middle zone, accessed from corridor side.
    ]
  },

  // ================================================================
  //  r12 — BATH ALCOVE (bp: x=0..6, y=21..29, 6×8ft)
  //  North portion of west strip. Contains tub, toilet, shower.
  //  S wall (y=29) = walk-in closet N wall.
  //  center bp: x=3, y=25
  // ================================================================
  {
    id: "r12", name: "Bath Alcove", icon: "A", color: "#29b6f6",
    pos_x: 0.19, pos_y: 0, pos_z: 12.07, width: 1.83, depth: 2.44, height: 2.8,
    wallOpenings: {
      left: [ // east wall (-x) — opening to bath corridor
        { x: 0, y: -0.30, w: 1.2, h: 2.2, arch: true },
      ],
    },
    furniture: [
      // --- BATHTUB — N end (bp x=0.3..5.7, y=21.3..23.5) ---
      // Hollow tub: bottom + 4 thin rim walls to create a basin
      // Tub outer: w=1.52, d=0.67, h=0.55. Rim thickness ~0.06m
      { type: "appliance", name: "Tub Bottom", category: "Bathroom",
        x: 0, y: -1.37, z: 0.88, w: 1.40, h: 0.06, d: 0.55, color: "#e0e0e0", items: []},
      { type: "appliance", name: "Tub North Rim", category: "Bathroom",
        x: 0, y: -1.1, z: 1.18, w: 1.52, h: 0.55, d: 0.06, color: "#e0e0e0", items: []},
      { type: "appliance", name: "Tub South Rim", category: "Bathroom",
        x: 0, y: -1.1, z: 0.58, w: 1.52, h: 0.55, d: 0.06, color: "#e0e0e0", items: []},
      { type: "appliance", name: "Tub West Rim", category: "Bathroom",
        x: 0.73, y: -1.1, z: 0.88, w: 0.06, h: 0.55, d: 0.55, color: "#e0e0e0", items: []},
      { type: "appliance", name: "Tub East Rim", category: "Bathroom",
        x: -0.73, y: -1.1, z: 0.88, w: 0.06, h: 0.55, d: 0.55, color: "#e0e0e0", items: []},

      // --- TOILET — center, W wall (bp x=0.3..2.3, y=24..26.5) ---
      { type: "toilet", name: "Toilet", category: "Bathroom",
        storageZone: false,
        x: 0.46, y: -1.02, z: 0, w: 0.46, h: 0.76, d: 0.67, color: "#e0e0e0",
        items: []},

      // --- WALK-IN SHOWER — S end (bp x=0.3..5.7, y=27..28.7) ---
      // Open wireframe: 3 wall panels (back, left, right) + glass door on east side
      // Back wall (west, +x side)
      { type: "appliance", name: "Shower Back Wall", category: "Bathroom",
        x: 0.73, y: -0.15, z: -0.88, w: 0.04, h: 2.2, d: 0.52, color: "#b0bec5", items: []},
      // South wall panel
      { type: "appliance", name: "Shower South Wall", category: "Bathroom",
        x: 0, y: -0.15, z: -1.11, w: 1.50, h: 2.2, d: 0.04, color: "#b0bec5", items: []},
      // North wall panel (partial — leave gap for entry from tub area)
      { type: "appliance", name: "Shower North Wall", category: "Bathroom",
        x: 0.38, y: -0.15, z: -0.65, w: 0.76, h: 2.2, d: 0.04, color: "#b0bec5", items: []},
      // Glass door on east side (thin transparent panel)
      { type: "appliance", name: "Shower Glass Door", category: "Structural",
        x: -0.73, y: -0.15, z: -0.88, w: 0.03, h: 2.0, d: 0.46, color: "#80deea", items: []},
    ]
  },

  // ================================================================
  //  r13 — WALK-IN CLOSET (bp: x=0..6, y=29..36, 6×7ft)
  //  South portion of west strip. Extrudes N from master.
  //  Door to master on south wall (y=36).
  //  center bp: x=3, y=32.5
  // ================================================================
  {
    id: "r13", name: "Walk-in Closet", icon: "W", color: "#8d6e63",
    pos_x: 0.19, pos_y: 0, pos_z: 9.78, width: 1.83, depth: 2.13, height: 2.8,
    wallOpenings: {
      back: [ // south wall (-z) — door to master bedroom
        { x: 0, y: -0.35, w: 0.91, h: 2.1 },
      ],
    },
    furniture: [
      { type: "cabinet", name: "Walk-in Closet — West Rod", category: "Clothing & Bedding",
        storageZone: true, zoneLabel: "MASTER-CLOSET-W", zoneType: "cabinet",
        capacity: { slots: 4, slotDesc: "hanging rod + shelves" },
        x: 0.61, y: -0.15, z: 0, w: 0.61, h: 2.4, d: 1.83, color: "#795548",
        doorFace: "-x",
        items: []
      { type: "cabinet", name: "Walk-in Closet — East Rod", category: "Clothing & Bedding",
        storageZone: true, zoneLabel: "MASTER-CLOSET-E", zoneType: "cabinet",
        capacity: { slots: 4, slotDesc: "hanging rod + shelves" },
        x: -0.61, y: -0.15, z: 0, w: 0.61, h: 2.4, d: 1.83, color: "#6d4c41",
        doorFace: "+x",
        items: []
    ]
  },
];