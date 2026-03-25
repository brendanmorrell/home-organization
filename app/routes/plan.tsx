import { useState } from "react";
import { useOutletContext } from "react-router";
import type { RoomWithFrames } from "~/lib/supabase";

interface LayoutContext {
  rooms: RoomWithFrames[];
  loading: boolean;
}

// ---- Data from organization-plan.md ----

interface PlanItem {
  id: string;
  name: string;
  zone: string;
  recommendation?: string;
  reasoning?: string;
}

interface CategoryGroup {
  name: string;
  zone: string;
  tier: "A" | "B" | "C" | "D";
  items: PlanItem[];
}


interface MoveStep {
  id: number;
  description: string;
  from: string;
  to: string;
  category: "unpack" | "rearrange" | "repack";
}

const DISPOSAL_ITEMS: PlanItem[] = [
  { id: "i046", name: "Dead batteries", zone: "KITCHEN-UPPER-CAB", recommendation: "DISPOSE", reasoning: "Useless, possible leak hazard" },
  { id: "i130", name: "3 LED lights", zone: "PACKED-BOX:c7", recommendation: "REGIFT", reasoning: "Already flagged — no use for them" },
  { id: "i139", name: "Baby gear manuals", zone: "PACKED-BOX:c8", recommendation: "DISPOSE", reasoning: "All available online" },
  { id: "i148", name: "Old laptop + misc paperwork + hammocks + decorative doll", zone: "PACKED-BOX:c18", recommendation: "REVIEW", reasoning: "Laptop likely obsolete. Wipe & recycle?" },
  { id: "i149", name: "Labels and decor for van", zone: "PACKED-BOX:c2", recommendation: "REVIEW", reasoning: "Do you still have the van?" },
  { id: "i012", name: "Stopwatch", zone: "LIVING-HALL-CLOSET", recommendation: "REVIEW", reasoning: "Phones have timers. Sentimental value?" },
  { id: "i060", name: "Extra spare keys (set 2)", zone: "WORKHALL-DRAWERS-S", recommendation: "REVIEW", reasoning: "You already have spare keys in i054" },
  { id: "i065", name: "Dog ball", zone: "FOYER-COAT-CLOSET", recommendation: "RETURN", reasoning: "Return to friend" },
  { id: "i062", name: "Gift cup for parents", zone: "WORKHALL-DRAWERS-N", recommendation: "GIVE", reasoning: "Give to parents" },
  { id: "i081", name: "Broken-away suitcase", zone: "BABY-CLOSET", recommendation: "REVIEW", reasoning: "Usable but not for important travel" },
  { id: "i171", name: "Burlap K monogram bag", zone: "GARAGE-BIN-DECOR", recommendation: "REVIEW", reasoning: "Decorative — still wanted?" },
];

const TIER_META = {
  A: { label: "Daily/Weekly", desc: "Inside the house, easy reach", color: "#4caf50", icon: "⚡" },
  B: { label: "Weekly/Monthly", desc: "In-house, less convenient spots", color: "#ff9800", icon: "📦" },
  C: { label: "Packed Storage", desc: "Garage shelves, moderate access", color: "#2196f3", icon: "🏷️" },
  D: { label: "Deep Storage", desc: "Basement platforms, rarely accessed", color: "#9c27b0", icon: "🗄️" },
};

const GROUPS: CategoryGroup[] = [
  // Tier A — Daily/Weekly access, inside the house
  { name: "Kitchen Everyday", zone: "KITCHEN-LOWER-CAB / NOOK / ISLAND", tier: "A", items: [
    { id: "i014", name: "Pots and pans", zone: "KITCHEN" },
    { id: "i015", name: "Spices", zone: "KITCHEN" },
    { id: "i021", name: "Big bowls and sieve", zone: "KITCHEN" },
    { id: "i022", name: "Kimchi fermenting container", zone: "KITCHEN" },
    { id: "i023", name: "Big thermoses (x2)", zone: "KITCHEN" },
    { id: "i024", name: "Cups", zone: "KITCHEN" },
    { id: "i025", name: "Mixer", zone: "KITCHEN" },
  ]},
  { name: "Cleaning — Kitchen & Downstairs", zone: "KITCHEN-NOOK-SOUTH", tier: "A", items: [
    { id: "i016", name: "Cleaning products", zone: "KITCHEN" },
    { id: "i017", name: "Dishwasher pads", zone: "KITCHEN" },
    { id: "i019", name: "Soaps (assorted)", zone: "KITCHEN" },
    { id: "i071", name: "Toilet bowl cleaner & brush", zone: "BATH" },
  ]},
  { name: "Cleaning — Hall Closet", zone: "LIVING-HALL-CLOSET", tier: "A", items: [
    { id: "i007", name: "Extra paper towels", zone: "CLOSET" },
    { id: "i008", name: "Light bulb replacer", zone: "CLOSET" },
    { id: "i009", name: "Swiffer WetJet", zone: "CLOSET" },
    { id: "i010", name: "Broom", zone: "CLOSET" },
    { id: "i013", name: "Metal stools (x2)", zone: "CLOSET" },
  ]},
  { name: "Bar & Entertaining", zone: "LIVING-BAR-CABINETS", tier: "A", items: [
    { id: "i001", name: "Sodas & canned drinks", zone: "BAR" },
    { id: "i003", name: "Wine aerator", zone: "BAR" },
    { id: "i005", name: "Cocktail smoking torch + wood chips", zone: "BAR" },
    { id: "i006", name: "Wine toppers", zone: "BAR" },
  ]},
  { name: "Bathroom Upstairs — Daily Use", zone: "BATH-CLOSET", tier: "A", items: [
    { id: "i089", name: "Drain clog tools", zone: "BATH" },
    { id: "i090", name: "Erin's toiletries", zone: "BATH" },
    { id: "i091", name: "Brendan's toiletries", zone: "BATH" },
    { id: "i092", name: "Hair clippers", zone: "BATH" },
    { id: "i094", name: "Erin's makeup (labeled: MAKEUP & TRAVEL)", zone: "BATH" },
    { id: "i095", name: "First aid kits", zone: "BATH" },
    { id: "i096", name: "Baby health supplies (labeled: BABYHEALTH)", zone: "BATH" },
    { id: "i146", name: "Curling iron, head massager, hairbrush ← UNPACK c9", zone: "BATH" },
    { id: "i147", name: "Red light therapy mask ← UNPACK c14", zone: "BATH" },
    { id: "i176", name: "Erin cosmetics, masks & makeup ← UNPACK c21", zone: "BATH" },
  ]},
  { name: "Laundry & Linens", zone: "HALL-LAUNDRY / HALL-LINEN", tier: "A", items: [
    { id: "i072", name: "Laundry detergent & supplies", zone: "LAUNDRY" },
    { id: "i073", name: "Stain stick", zone: "LAUNDRY" },
    { id: "i074", name: "Iron", zone: "LAUNDRY" },
    { id: "i076", name: "Blankets, towels, sheets, bedding", zone: "LINEN" },
    { id: "i179", name: "Blankets and sheets ← UNPACK c24", zone: "LINEN" },
  ]},
  { name: "Important Documents", zone: "WORKHALL-MID-CAB", tier: "A", items: [
    { id: "i174", name: "Fireproof box (passports, documents) ← UNPACK c19", zone: "WORKHALL" },
  ]},
  // Tier B — Weekly/Monthly, in-house but less convenient
  { name: "Office & Documents", zone: "WORKHALL-DRAWERS-S / MID-CAB", tier: "B", items: [
    { id: "i057", name: "Stationery (notes, letters, envelopes)", zone: "WORKHALL" },
    { id: "i059", name: "Tax documents", zone: "WORKHALL" },
    { id: "i047", name: "Receipts & warranties", zone: "WORKHALL" },
    { id: "i054", name: "Spare keys", zone: "WORKHALL" },
    { id: "i144", name: "House docs, wedding stuff, games ← UNPACK c13", zone: "WORKHALL" },
  ]},
  { name: "Crypto & Security", zone: "WORKHALL-MID-CAB", tier: "B", items: [
    { id: "i050", name: "Cryptography equipment (Ledger wallets)", zone: "WORKHALL" },
    { id: "i111", name: "External hard drive + USB ← from UNASSIGNED", zone: "WORKHALL" },
  ]},
  { name: "Baby & Kids Supplies", zone: "WORKHALL-DRAWERS-N / UPPER", tier: "B", items: [
    { id: "i061", name: "Ronin travel art supplies", zone: "WORKHALL" },
    { id: "i063", name: "Ronin stickers & gifts", zone: "WORKHALL" },
    { id: "i064", name: "Old photos / early life memories", zone: "WORKHALL" },
    { id: "i040", name: "Corner protectors (baby-proofing)", zone: "WORKHALL" },
  ]},
  { name: "Gifts & Wrapping", zone: "KITCHEN-LOWER-CAB", tier: "B", items: [
    { id: "i052", name: "Stuffed animal gifts", zone: "KITCHEN" },
    { id: "i053", name: "Gift wrapping materials", zone: "KITCHEN" },
    { id: "i143", name: "Gift wrapping ← UNPACK c5, consolidate", zone: "KITCHEN" },
  ]},
  { name: "Tools, Tape & Supplies", zone: "KITCHEN-UPPER-CAB", tier: "B", items: [
    { id: "i030", name: "Gorilla tape", zone: "KITCHEN" },
    { id: "i034", name: "Rechargeable battery charger", zone: "KITCHEN" },
    { id: "i035", name: "Duracell batteries", zone: "KITCHEN" },
    { id: "i037", name: "Glue", zone: "KITCHEN" },
    { id: "i043", name: "Scissors", zone: "KITCHEN" },
    { id: "i045", name: "Sharpies", zone: "KITCHEN" },
  ]},
  { name: "Home Fragrance & Candles", zone: "KITCHEN-UPPER-CAB", tier: "B", items: [
    { id: "i027", name: "Light bulbs and candles", zone: "KITCHEN" },
    { id: "i031", name: "Tea candles", zone: "KITCHEN" },
    { id: "i175", name: "Candles (box) ← UNPACK c20, consolidate", zone: "KITCHEN" },
  ]},
  // Tier C — Garage shelves, moderate access
  { name: "Erin's Work — Speech Therapy", zone: "GARAGE-SHELF-NORTH", tier: "C", items: [
    { id: "i120", name: "Flashcards, notebooks, therapy toys, puppets", zone: "GARAGE" },
    { id: "i121", name: "Felt letterboard, games, Velcro dots, paints", zone: "GARAGE" },
    { id: "i122", name: "Speech desk supplies, CVC game, books", zone: "GARAGE" },
    { id: "i123", name: "Work paperwork, test materials, assessment binder", zone: "GARAGE" },
  ]},
  { name: "Electronics — Organized", zone: "GARAGE-SHELF-NE", tier: "C", items: [
    { id: "i106", name: "Screwdriver kit (Strebito)", zone: "GARAGE" },
    { id: "i107", name: "USB plugs bag", zone: "GARAGE" },
    { id: "i110", name: "USB-C cords bag", zone: "GARAGE" },
    { id: "i113", name: "Power banks", zone: "GARAGE" },
    { id: "i116", name: "HDMI cord + universal adapter", zone: "GARAGE" },
    { id: "i118", name: "Power strips + extension cord", zone: "GARAGE" },
  ]},
  { name: "Books & Reading", zone: "GARAGE-SHELF-WEST", tier: "C", items: [
    { id: "i141", name: "Adult books, textbooks, puzzle, photos", zone: "GARAGE" },
    { id: "i142", name: "Chinese-language pop-up books", zone: "GARAGE" },
    { id: "i051", name: "Cooking books ← move from kitchen", zone: "GARAGE" },
    { id: "i132", name: "Children's games, wall art, misc books", zone: "GARAGE" },
  ]},
  { name: "Health & Medical", zone: "GARAGE-SHELF-WEST", tier: "C", items: [
    { id: "i138", name: "Neti pot, ovulation tests, pregnancy tests, thermometer", zone: "GARAGE" },
    { id: "i145", name: "Intubation tubes (x2), personal items", zone: "GARAGE" },
  ]},
  { name: "Asian Kitchen", zone: "GARAGE-SHELF-NORTH", tier: "C", items: [
    { id: "i153", name: "Trivet", zone: "GARAGE" },
    { id: "i154", name: "Bamboo steamer", zone: "GARAGE" },
    { id: "i155", name: "Taiwan beer glasses", zone: "GARAGE" },
    { id: "i156", name: "Tea cups", zone: "GARAGE" },
    { id: "i157", name: "Kochuramunal (Korean ramen pot)", zone: "GARAGE" },
  ]},
  { name: "Photo Supplies", zone: "GARAGE-SHELF-NORTH", tier: "C", items: [
    { id: "i158", name: "Polaroid camera (white case)", zone: "GARAGE" },
    { id: "i159", name: "Polaroid pictures", zone: "GARAGE" },
    { id: "i160", name: "Nikon camera (black bag)", zone: "GARAGE" },
  ]},
  { name: "Desk & Office Supplies (Overflow)", zone: "GARAGE-SHELF-NORTH", tier: "C", items: [
    { id: "i163", name: "Peel & stick envelopes (#10)", zone: "GARAGE" },
    { id: "i164", name: "Copy paper", zone: "GARAGE" },
    { id: "i165", name: "Laminator", zone: "GARAGE" },
    { id: "i166", name: "Scotch laminating pouches", zone: "GARAGE" },
    { id: "i167", name: "Thank you notes", zone: "GARAGE" },
  ]},
  { name: "Picture Frames & Wedding", zone: "GARAGE-SHELF-WEST", tier: "C", items: [
    { id: "i172", name: "Picture frames (multiple)", zone: "GARAGE" },
    { id: "i173", name: "Wedding hand-fasting ceremony knots", zone: "GARAGE" },
  ]},
  // Tier D — Basement platforms, rarely accessed
  { name: "Keepsake Clothing", zone: "BSMT-RAISED-W", tier: "D", items: [
    { id: "i124", name: "Sentimental t-shirts (shared)", zone: "BASEMENT" },
    { id: "i125", name: "Brendan's travel t-shirts", zone: "BASEMENT" },
    { id: "i126", name: "Erin's keepsake t-shirts & sweatshirts", zone: "BASEMENT" },
    { id: "i127", name: "Erin's old keepsake clothing", zone: "BASEMENT" },
  ]},
  { name: "Baby Keepsakes & Memorabilia", zone: "BSMT-RAISED-W", tier: "D", items: [
    { id: "i134", name: "Baptismal candle, hospital records, newborn clothing", zone: "BASEMENT" },
    { id: "i136", name: "Outgrown infant clothing + infant stuffed animals", zone: "BASEMENT" },
    { id: "i137", name: "Large Hello Kitty Squishmallow (unopened)", zone: "BASEMENT" },
    { id: "i135", name: "Baby play gym/mat", zone: "BASEMENT" },
    { id: "i178", name: "Sentimental items — baby keepsakes (Ronin & Brendan) ← from c23", zone: "BASEMENT" },
  ]},
  { name: "Décor — Asian & Seasonal", zone: "BSMT-RAISED-E", tier: "D", items: [
    { id: "i128", name: "Asian decorations (name stamp, rice cooker candle, vase)", zone: "BASEMENT" },
    { id: "i133", name: "Holiday books, picture frames, art wall decorations", zone: "BASEMENT" },
    { id: "i131", name: "Picture frame + bubble-wrapped items", zone: "BASEMENT" },
    { id: "i161", name: "Asian lanterns (collapsible paper) ← from garage", zone: "BASEMENT" },
    { id: "i162", name: "String lights / decoration lights ← from garage", zone: "BASEMENT" },
    { id: "i177", name: "Vases (box) ← from c22", zone: "BASEMENT" },
  ]},
];

interface ContainerFull {
  type: string;
  label: string;
  zone: string;
  items: PlanItem[];
}

// Build full packing lists for each container by pulling from GROUPS
const CONTAINER_ITEMS_MAP: Record<string, PlanItem[]> = {};
for (const group of GROUPS) {
  for (const item of group.items) {
    CONTAINER_ITEMS_MAP[item.id] = CONTAINER_ITEMS_MAP[item.id] || [];
    CONTAINER_ITEMS_MAP[item.id].push(item);
  }
}

// All items in a flat lookup by ID
const ALL_ITEMS_BY_ID: Record<string, PlanItem> = {};
for (const group of GROUPS) {
  for (const item of group.items) {
    ALL_ITEMS_BY_ID[item.id] = item;
  }
}

const CONTAINERS: ContainerFull[] = [
  {
    type: "Large Black/Yellow Bin", label: "SPEECH THERAPY", zone: "GARAGE-SHELF-NORTH",
    items: GROUPS.find(g => g.name === "Erin's Work — Speech Therapy")?.items || [],
  },
  {
    type: "Large Black/Yellow Bin", label: "KEEPSAKE CLOTHING", zone: "BSMT-RAISED-W",
    items: GROUPS.find(g => g.name === "Keepsake Clothing")?.items || [],
  },
  {
    type: "Large Black/Yellow Bin", label: "BABY KEEPSAKES", zone: "BSMT-RAISED-W",
    items: GROUPS.find(g => g.name === "Baby Keepsakes & Memorabilia")?.items || [],
  },
  {
    type: "Clear Bin (medium)", label: "ELECTRONICS", zone: "GARAGE-SHELF-NE",
    items: GROUPS.find(g => g.name === "Electronics — Organized")?.items || [],
  },
  {
    type: "Clear Bin (medium)", label: "BAR DECOR & EXTRAS", zone: "GARAGE-SHELF-NORTH",
    items: [{ id: "i140", name: "Bar decorations & extra entertaining supplies", zone: "GARAGE" }],
  },
  {
    type: "Clear Bin (medium)", label: "BOOKS", zone: "GARAGE-SHELF-WEST",
    items: GROUPS.find(g => g.name === "Books & Reading")?.items || [],
  },
  {
    type: "Clear Bin (medium)", label: "DÉCOR - SEASONAL", zone: "BSMT-RAISED-E",
    items: GROUPS.find(g => g.name === "Décor — Asian & Seasonal")?.items || [],
  },
  {
    type: "Black Small Crate", label: "HEALTH & MEDICAL", zone: "GARAGE-SHELF-WEST",
    items: GROUPS.find(g => g.name === "Health & Medical")?.items || [],
  },
  {
    type: "Clear Bin (medium)", label: "ASIAN KITCHEN", zone: "GARAGE-SHELF-NORTH",
    items: GROUPS.find(g => g.name === "Asian Kitchen")?.items || [],
  },
  {
    type: "Clear Bin (small)", label: "PHOTO SUPPLIES", zone: "GARAGE-SHELF-NORTH",
    items: GROUPS.find(g => g.name === "Photo Supplies")?.items || [],
  },
  {
    type: "Clear Bin (medium)", label: "DESK SUPPLIES", zone: "GARAGE-SHELF-NORTH",
    items: GROUPS.find(g => g.name === "Desk & Office Supplies (Overflow)")?.items || [],
  },
  {
    type: "Clear Bin (medium)", label: "FRAMES & WEDDING", zone: "GARAGE-SHELF-WEST",
    items: GROUPS.find(g => g.name === "Picture Frames & Wedding")?.items || [],
  },
];

const MOVES: MoveStep[] = [
  // Unpack into house
  { id: 1, description: "Curling iron, hairbrush, etc.", from: "box c9", to: "BATH-CLOSET", category: "unpack" },
  { id: 2, description: "Red light therapy mask", from: "box c14", to: "BATH-CLOSET", category: "unpack" },
  { id: 3, description: "Gift wrapping materials", from: "box c5", to: "KITCHEN-LOWER-CAB (consolidate with i053)", category: "unpack" },
  { id: 4, description: "Window garden herb kit", from: "box c7", to: "KITCHEN-NOOK-SOUTH", category: "unpack" },
  { id: 5, description: "House docs, wedding stuff, games", from: "box c13", to: "WORKHALL-DRAWERS-S + LIVING-ENTRY-SHELF", category: "unpack" },
  { id: 6, description: "External hard drive + USB", from: "UNASSIGNED", to: "WORKHALL-MID-CAB", category: "unpack" },
  { id: 18, description: "Fireproof documents box (passports!)", from: "box c19", to: "WORKHALL-MID-CAB (secure, accessible)", category: "unpack" },
  { id: 19, description: "Erin's cosmetics, masks & makeup", from: "box c21", to: "BATH-CLOSET (with existing makeup)", category: "unpack" },
  { id: 20, description: "Blankets and sheets", from: "box c24", to: "HALL-LINEN (consolidate with i076)", category: "unpack" },
  { id: 21, description: "Candles", from: "box c20", to: "KITCHEN-UPPER-CAB (consolidate with i027, i031)", category: "unpack" },
  // Rearrange within house
  { id: 7, description: "Old baby stuff & clothes", from: "LIVING-HALL-CLOSET", to: "FOYER-COAT-CLOSET", category: "rearrange" },
  { id: 8, description: "Stroller", from: "FOYER-COAT-CLOSET", to: "BSMT-RAISED-E", category: "rearrange" },
  { id: 9, description: "Cooking books", from: "KITCHEN-LOWER-CAB", to: "BOOKS bin → GARAGE-SHELF-WEST", category: "rearrange" },
  // Repack into labeled containers
  { id: 10, description: "Speech therapy items (boxes c4/c10/c16/c19)", from: "Packed boxes", to: "SPEECH THERAPY bin → GARAGE-SHELF-NORTH", category: "repack" },
  { id: 11, description: "Electronics (14 items)", from: "Bags", to: "ELECTRONICS bin → GARAGE-SHELF-NE", category: "repack" },
  { id: 12, description: "Bar extras (box c11)", from: "box c11", to: "BAR DECOR bin → GARAGE-SHELF-NORTH", category: "repack" },
  { id: 13, description: "Books (boxes c22/c17)", from: "Packed boxes", to: "BOOKS bin → GARAGE-SHELF-WEST", category: "repack" },
  { id: 14, description: "Health items (boxes c8/c3)", from: "Packed boxes", to: "HEALTH & MEDICAL crate → GARAGE-SHELF-WEST", category: "repack" },
  { id: 15, description: "Keepsake clothes (boxes c1/c20/c21/c25)", from: "Packed boxes", to: "KEEPSAKE CLOTHING bin → BSMT-RAISED-W", category: "repack" },
  { id: 16, description: "Baby keepsakes (incl. c23 sentimental items)", from: "Packed boxes", to: "BABY KEEPSAKES bin → BSMT-RAISED-W", category: "repack" },
  { id: 17, description: "Décor + lanterns + vases (c6/c7/c15/c22)", from: "Packed boxes", to: "DÉCOR - SEASONAL bin → BSMT-RAISED-E", category: "repack" },
  { id: 22, description: "Asian kitchen items into labeled bin", from: "GARAGE-BIN-ASIANKITCHEN", to: "ASIAN KITCHEN bin → GARAGE-SHELF-NORTH", category: "repack" },
  { id: 23, description: "Photo supplies into labeled bin", from: "GARAGE-BIN-PHOTO", to: "PHOTO SUPPLIES bin → GARAGE-SHELF-NORTH", category: "repack" },
  { id: 24, description: "Desk supplies into labeled bin", from: "GARAGE-BIN-DESK", to: "DESK SUPPLIES bin → GARAGE-SHELF-NORTH", category: "repack" },
  { id: 25, description: "Picture frames + wedding knots into bin", from: "GARAGE-BIN-FRAMES", to: "FRAMES & WEDDING bin → GARAGE-SHELF-WEST", category: "repack" },
];

type TabKey = "overview" | "tiers" | "containers" | "moves" | "disposal";

export default function PlanPage() {
  const { loading } = useOutletContext<LayoutContext>();
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [expandedTier, setExpandedTier] = useState<string | null>("A");
  const [completedMoves, setCompletedMoves] = useState<Set<number>>(new Set());

  const toggleMove = (id: number) => {
    setCompletedMoves((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loading) {
    return <div className="plan-page"><div style={{ padding: 40, color: "var(--text-dim)" }}>Loading...</div></div>;
  }

  const tierGroups = (tier: string) => GROUPS.filter((g) => g.tier === tier);
  const totalGroupItems = GROUPS.reduce((s, g) => s + g.items.length, 0);

  const tabs: { key: TabKey; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "tiers", label: "Tier Groups" },
    { key: "containers", label: "Containers" },
    { key: "moves", label: "Move Checklist" },
    { key: "disposal", label: "Disposal" },
  ];

  return (
    <div className="plan-page">
      <div className="plan-header">
        <h2>Organization Plan</h2>
        <p className="plan-subtitle">
          {totalGroupItems} items across {GROUPS.length} groups in 4 access tiers
        </p>
      </div>

      {/* Tabs */}
      <div className="plan-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={`plan-tab ${activeTab === tab.key ? "active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="plan-content">
        {activeTab === "overview" && (
          <div className="plan-overview">
            {/* Tier summary cards */}
            <div className="tier-summary-grid">
              {(["A", "B", "C", "D"] as const).map((tier) => {
                const meta = TIER_META[tier];
                const groups = tierGroups(tier);
                const itemCount = groups.reduce((s, g) => s + g.items.length, 0);
                return (
                  <div
                    key={tier}
                    className="tier-summary-card"
                    style={{ borderLeftColor: meta.color }}
                    onClick={() => { setActiveTab("tiers"); setExpandedTier(tier); }}
                  >
                    <div className="tier-card-header">
                      <span className="tier-icon">{meta.icon}</span>
                      <span className="tier-label">Tier {tier}</span>
                    </div>
                    <div className="tier-card-title">{meta.label}</div>
                    <div className="tier-card-desc">{meta.desc}</div>
                    <div className="tier-card-stats">
                      <span>{groups.length} groups</span>
                      <span>{itemCount} items</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Flow diagram */}
            <div className="plan-flow">
              <h3>How It Works</h3>
              <div className="flow-steps">
                <div className="flow-step">
                  <div className="flow-num">1</div>
                  <div className="flow-text">
                    <strong>Dispose / Give Away</strong>
                    <span>{DISPOSAL_ITEMS.length} items flagged for review, disposal, or regifting</span>
                  </div>
                </div>
                <div className="flow-arrow">→</div>
                <div className="flow-step">
                  <div className="flow-num">2</div>
                  <div className="flow-text">
                    <strong>Unpack Boxes</strong>
                    <span>10 items to unpack from moving boxes into the house</span>
                  </div>
                </div>
                <div className="flow-arrow">→</div>
                <div className="flow-step">
                  <div className="flow-num">3</div>
                  <div className="flow-text">
                    <strong>Rearrange In-House</strong>
                    <span>3 items to move between rooms for better access</span>
                  </div>
                </div>
                <div className="flow-arrow">→</div>
                <div className="flow-step">
                  <div className="flow-num">4</div>
                  <div className="flow-text">
                    <strong>Repack into Bins</strong>
                    <span>12 labeled containers for garage & basement storage</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Container summary */}
            <div className="plan-containers-mini">
              <h3>Containers Needed</h3>
              <div className="container-counts">
                <div className="container-count-card">
                  <span className="count-num">3</span>
                  <span className="count-label">Large Black/Yellow Bins</span>
                </div>
                <div className="container-count-card">
                  <span className="count-num">7</span>
                  <span className="count-label">Clear Plastic Bins (medium)</span>
                </div>
                <div className="container-count-card">
                  <span className="count-num">1</span>
                  <span className="count-label">Clear Plastic Bin (small)</span>
                </div>
                <div className="container-count-card">
                  <span className="count-num">1</span>
                  <span className="count-label">Black Small Crate</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "tiers" && (
          <div className="plan-tiers">
            {(["A", "B", "C", "D"] as const).map((tier) => {
              const meta = TIER_META[tier];
              const groups = tierGroups(tier);
              const isExpanded = expandedTier === tier;
              return (
                <div key={tier} className="tier-section">
                  <div
                    className="tier-section-header"
                    style={{ borderLeftColor: meta.color }}
                    onClick={() => setExpandedTier(isExpanded ? null : tier)}
                  >
                    <span className="tier-icon">{meta.icon}</span>
                    <div>
                      <span className="tier-section-title">Tier {tier} — {meta.label}</span>
                      <span className="tier-section-desc">{meta.desc}</span>
                    </div>
                    <span className="tier-toggle">{isExpanded ? "▼" : "▶"}</span>
                  </div>
                  {isExpanded && (
                    <div className="tier-groups">
                      {groups.map((group) => (
                        <div key={group.name} className="group-card">
                          <div className="group-header">
                            <span className="group-name">{group.name}</span>
                            <span className="group-zone">{group.zone}</span>
                          </div>
                          <div className="group-items">
                            {group.items.map((item) => (
                              <div key={item.id} className="group-item">
                                <span className="item-id">{item.id}</span>
                                <span className="item-label">{item.name}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {activeTab === "containers" && (
          <div className="plan-containers-full">
            <p className="plan-note">
              Full packing list for each container. Check off items as you pack them.
            </p>
            <div className="packing-list">
              {CONTAINERS.map((c) => (
                <div key={c.label} className="packing-container">
                  <div className="packing-container-header">
                    <div>
                      <div className="container-label-tag">{c.label}</div>
                      <div className="packing-container-meta">
                        <span className="container-type">{c.type}</span>
                        <span className="packing-separator">&middot;</span>
                        <span className="container-zone">{c.zone}</span>
                        <span className="packing-separator">&middot;</span>
                        <span className="packing-item-count">{c.items.length} items</span>
                      </div>
                    </div>
                  </div>
                  <div className="packing-items">
                    {c.items.map((item) => (
                      <div key={item.id} className="packing-item">
                        <span className="packing-item-id">{item.id}</span>
                        <span className="packing-item-name">{item.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "moves" && (
          <div className="plan-moves">
            <p className="plan-note">
              {completedMoves.size} of {MOVES.length} moves completed. Check off as you go.
            </p>
            <div className="move-progress-bar">
              <div
                className="move-progress-fill"
                style={{ width: `${(completedMoves.size / MOVES.length) * 100}%` }}
              />
            </div>

            {(["unpack", "rearrange", "repack"] as const).map((cat) => {
              const moves = MOVES.filter((m) => m.category === cat);
              const catLabels = { unpack: "Unpack from Boxes → Into House", rearrange: "Rearrange Within House", repack: "Repack into Labeled Containers" };
              return (
                <div key={cat} className="move-category">
                  <h4 className="move-cat-title">{catLabels[cat]}</h4>
                  {moves.map((move) => (
                    <div
                      key={move.id}
                      className={`move-row ${completedMoves.has(move.id) ? "done" : ""}`}
                      onClick={() => toggleMove(move.id)}
                    >
                      <span className="move-check">
                        {completedMoves.has(move.id) ? "✓" : "○"}
                      </span>
                      <div className="move-info">
                        <span className="move-desc">{move.description}</span>
                        <span className="move-path">
                          {move.from} → {move.to}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {activeTab === "disposal" && (
          <div className="plan-disposal">
            <p className="plan-note">
              Items flagged for disposal, review, or gifting. Confirm yes/no for each.
            </p>
            <div className="disposal-list">
              {DISPOSAL_ITEMS.map((item) => (
                <div key={item.id} className="disposal-row">
                  <div className={`disposal-badge badge-${item.recommendation?.toLowerCase()}`}>
                    {item.recommendation}
                  </div>
                  <div className="disposal-info">
                    <span className="disposal-name">
                      <span className="disposal-id">{item.id}</span> {item.name}
                    </span>
                    <span className="disposal-reason">{item.reasoning}</span>
                  </div>
                  <span className="disposal-zone">{item.zone}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
