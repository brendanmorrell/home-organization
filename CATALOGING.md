# Home Inventory Sorting & Cataloging — Project Brief

## What We're Doing

Unpacking ~40 boxes of everything the family owns from storage. Before putting things away, going through every item, categorizing it, deciding what to keep vs. donate/trash, and assigning it to a specific storage location. The end goal is a fully cataloged home inventory stored in Supabase, searchable via the 3D home model app.

## Process

1. Record video walkthroughs narrating each item on camera
2. Process videos via video-to-frames+transcript pipeline (frames + 15-second surrounding transcript per frame)
3. From output:
   - Identify every item visible in frames (visual + narration context)
   - Categorize into one of the 20 categories
   - Assign storage tier and location
   - Actively challenge on whether to keep (see Declutter Rules)
   - Log everything: item name, category, box assignment, storage location
4. Track box-to-items mapping: box label/number → items → physical location

## The House Layout

**Main Floor:**
- Kitchen (large pantry mostly full; giant cupboard above fridge — hard to access)
- Living room (one coat closet — the BIGGER one, deeper + taller, currently empty)
- Dining room
- Foyer (one coat closet — normal size, currently has coats/baby shoes)
- Work area between foyer and kitchen: 6 drawers (3 each side of chair), cabinets below (two doors, ~5ft wide), two large sliding drawers above, two big cabinets above those (currently hold light bulbs)

**Upstairs:**
- Two bedrooms connected by jack-and-jill bathroom (two sinks, shower, bathtub)
- Hallway with laundry closet
- Additional closets: one linen closet, one bathroom closet, one extra closet (unused)

**Basement:**
- Unfinished, roughly two rooms with divider
- Easy access via short interior staircase (low ceiling)
- Plan: bins/boxes around entire perimeter of both "rooms," floor to accessible height

**Garage:**
- 2-car with home gym + large woodworking tools (jointer-planer combo, etc.)
- High shelves along all 3 non-door walls (~2ft deep, ~3.5ft to ceiling) — requires ladder
- Floor space occupied by gym + woodworking, not available for storage

## Storage Tier System

### Tier 1 — Grab and Go (daily/anytime access)
**Locations:** Big living room closet, work area drawers + cabinets, kitchen pantry overflow
- Batteries, tape, scissors, pens, tape measure, small hand tools, first aid kit, flashlights, light bulbs, chargers, stain remover

### Tier 2 — Easy Trip (periodic, predictable access)
**Locations:** Basement front section (eye-level, easily reachable bins)
- Camping gear, specialty kitchen items, seasonal clothing, project supplies, wife's craft/hobby items

### Tier 3 — Planned Retrieval (once a year or less)
**Locations:** Basement back section
- Holiday decorations, old tax documents, rarely-used specialty tools

### Tier 4 — Deep Archive (keeping but functionally never accessing)
**Locations:** Garage high shelves, very back of basement
- Baby Round Two items, memorabilia, framed degrees, wife's SLP supplies, home repair materials (spare tiles, paint), original house fixtures
- **These boxes must be LIGHT — they go overhead in the garage**

## Item Categories (20 total)

| # | Category | Description |
|---|----------|-------------|
| 1 | Workshop | Woodworking tools, wood glue, clamps, sandpaper, saw blades, project materials |
| 2 | Auto & Garage | Car jack, jumper cables, fluids, ramps, car-specific wrenches |
| 3 | Outdoor & Lawn | Yard tools, garden supplies, pest control |
| 4 | Camping & Travel | Tents, sleeping bags, travel bags, packing cubes, recreation gear |
| 5 | Kitchen Overflow | Specialty appliances/tools not in daily rotation |
| 6 | Household Maintenance | Screws, nails, picture hooks, caulk, duct tape, WD-40, fix-it supplies |
| 7 | Household Chemicals | Paint thinner, stain remover, wood finish, solvents — NOT safe near food/kids |
| 8 | Cleaning & Consumables | Backstock soap, toilet paper, detergent — human-safe stuff |
| 9 | Medical & First Aid | Medications, bandages, first aid supplies — MUST be Tier 1 accessible |
| 10 | Office & Tech | Cables, chargers, office supplies, electronics |
| 11 | Seasonal & Holiday | Decorations, lights, ornaments, holiday-specific items |
| 12 | Clothing Overflow | Out-of-season or stored adult clothes, guest items |
| 13 | Baby: Current Overflow | Son's items still in use but not needed out daily |
| 14 | Baby: Round Two | Outgrown baby/toddler items saved for potential second child — deep archive |
| 15 | Memorabilia & Sentimental | Trip souvenirs, framed degrees, keepsake blankets |
| 16 | Linens & Bedding | Extra sheets, towels, blankets |
| 17 | Documents & Records | Tax files, important papers, legal/financial records |
| 18 | Home Materials | Spare tiles, flooring, leftover wall paint — insurance for repairs |
| 19 | Wife's SLP Supplies | Speech-language pathology books, therapy toys, professional materials |
| 20 | Original House Fixtures | Chandelier, anything that came with house and must be restored if they move |

**Non-storage:** Give Away / Donate / Trash — actively used during sorting, no need to catalog

## Item Naming & Search Convention

- Every item gets a common name (what you'd naturally call it)
- Vision model infers specific descriptors from video frames (brand, color, material, size)
- Search works at any specificity level: "screwdriver" → all; "Phillips head" → narrows down
- Need-based search handled at query time by Claude reasoning
- Hardware kits / misc small items: describe as specifically as possible

## Declutter Rules — ENFORCE AGGRESSIVELY

**Default posture: this should probably go unless you convince me otherwise.**

### The Keep/Toss Test:
1. Does it serve a specific, foreseeable purpose? (Not "might need it someday")
2. Does it have genuine sentimental value? (Would you feel a loss if it disappeared?)
3. Could you replace it for under ~$50 and a quick trip? If yes to #3 and no to #1/#2 → **GET RID OF IT**

### Exceptions:
- Small consumable supplies (wires, tapes, screws, misc hardware) → keep (hassle of a dedicated trip outweighs storage cost)
- Wife's SLP supplies → always keep
- Baby Round Two items → keep
- Home Materials (spare tiles, paint) → keep (irreplaceable match)
- Memorabilia → keep if genuinely sentimental, challenge if "keeping to keep"

### Red Flags to Call Out:
- "I might need this someday" with no specific scenario → challenge
- Duplicate items → challenge
- In a box 1+ year untouched and not seasonal → challenge
- Broken items "to fix" → challenge hard
- Kept out of guilt (gifts, inherited junk) → challenge

**Energy: "Are you really going to use this, or are you just keeping it because throwing it away feels wasteful?"**

## Household Context

- Residents: Brendan, wife, 1.5-year-old son
- Works from home
- Cook a lot
- Hobbies: Woodworking (serious), car maintenance, camping
- Wife: SLP (not currently practicing, will resume in a few years)
- Travel a lot — many souvenirs
- Colorado Springs, CO

## Box Log Format

```
BOX [label/number]
Location: [where this box will be stored]
Category: [primary category]
Tier: [1-4]
Items:
  - [Item common name] | [specific descriptors] | [notes]
  ...

FLAGGED FOR REMOVAL:
  - [Item] — [reason it should go]
```

This log feeds into the Supabase database for the 3D searchable home inventory app.
