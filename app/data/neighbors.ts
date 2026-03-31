import type { Neighbor } from "~/lib/supabase";

export const STREET_NAME = "Custer Ave";
export const ALLEY_NAME = "Alley";
export const INSTITUTE_NAME = "N Institute St";
export const USER_ADDRESS = "314 Custer Ave";

/** Valid neighbor IDs — anything not in this set gets cleaned from DB */
export const VALID_IDS = new Set([
  // West side of Custer Ave (our block)
  "312-custer", "314-custer", "316-custer", "322-custer", "324-custer",
  // East side of Custer Ave
  "309-custer", "315-custer", "319-custer",
  // N Institute St (across the alley)
  "303-institute", "307-institute", "309-institute",
  "315-institute", "323-institute", "325-institute", "331-institute",
  // Cross-street lots (E Boulder / E Platte / corners)
  "907-boulder", "915-boulder", "919-boulder",
  "914-platte", "916-platte", "940-platte",
  "1003-custer-e", "1007-boulder-e", "1002-platte-e",
]);

/** Default seed data — used if Supabase has no neighbors yet */
export const defaultNeighbors: Omit<Neighbor, "created_at">[] = [
  // ── West side of Custer Ave (our block), south → north ──
  {
    id: "312-custer",
    address: "312 Custer Ave",
    side: "west",
    names: [],
    notes: "",
    is_us: false,
    position_index: 0,
  },
  {
    id: "314-custer",
    address: "314 Custer Ave",
    side: "west",
    names: [],
    notes: "Our house",
    is_us: true,
    position_index: 1,
  },
  {
    id: "316-custer",
    address: "316 Custer Ave",
    side: "west",
    names: [],
    notes: "",
    is_us: false,
    position_index: 2,
  },
  {
    id: "322-custer",
    address: "322 Custer Ave",
    side: "west",
    names: ["Dianna", "Jim"],
    notes: "",
    is_us: false,
    position_index: 3,
  },
  {
    id: "324-custer",
    address: "324 Custer Ave",
    side: "west",
    names: ["Eric", "Christine", "Klara"],
    notes: "",
    is_us: false,
    position_index: 4,
  },

  // ── East side of Custer Ave, south → north ──
  {
    id: "309-custer",
    address: "309 Custer Ave",
    side: "east",
    names: [],
    notes: "",
    is_us: false,
    position_index: 0,
  },
  {
    id: "315-custer",
    address: "315 Custer Ave",
    side: "east",
    names: [],
    notes: "",
    is_us: false,
    position_index: 1,
  },
  {
    id: "319-custer",
    address: "319 Custer Ave",
    side: "east",
    names: ["Joy"],
    notes: "",
    is_us: false,
    position_index: 2,
  },

  // ── N Institute St (across the alley), south → north ──
  {
    id: "303-institute",
    address: "303 N Institute St",
    side: "alley",
    names: [],
    notes: "",
    is_us: false,
    position_index: 0,
  },
  {
    id: "307-institute",
    address: "307 N Institute St",
    side: "alley",
    names: [],
    notes: "",
    is_us: false,
    position_index: 1,
  },
  {
    id: "309-institute",
    address: "309 N Institute St",
    side: "alley",
    names: ["Kenton"],
    notes: "",
    is_us: false,
    position_index: 2,
  },
  {
    id: "315-institute",
    address: "315 N Institute St",
    side: "alley",
    names: [],
    notes: "",
    is_us: false,
    position_index: 3,
  },
  {
    id: "323-institute",
    address: "323 N Institute St",
    side: "alley",
    names: [],
    notes: "",
    is_us: false,
    position_index: 4,
  },
  {
    id: "325-institute",
    address: "325 N Institute St",
    side: "alley",
    names: [],
    notes: "",
    is_us: false,
    position_index: 5,
  },
  {
    id: "331-institute",
    address: "331 N Institute St",
    side: "alley",
    names: [],
    notes: "",
    is_us: false,
    position_index: 6,
  },

  // ── Cross-street lots (Boulder St / Platte Ave corners) ──
  // Institute block, NE corner
  {
    id: "907-boulder",
    address: "907 E Boulder St",
    side: "alley",
    names: [],
    notes: "",
    is_us: false,
    position_index: 7,
  },
  // Our block, north end
  {
    id: "915-boulder",
    address: "915 E Boulder St",
    side: "west",
    names: [],
    notes: "",
    is_us: false,
    position_index: 10,
  },
  {
    id: "919-boulder",
    address: "919 E Boulder St",
    side: "west",
    names: [],
    notes: "",
    is_us: false,
    position_index: 11,
  },
  // Our block, south end
  {
    id: "914-platte",
    address: "914 E Platte Ave",
    side: "west",
    names: [],
    notes: "",
    is_us: false,
    position_index: -3,
  },
  {
    id: "916-platte",
    address: "916 E Platte Ave",
    side: "west",
    names: [],
    notes: "",
    is_us: false,
    position_index: -2,
  },
  {
    id: "940-platte",
    address: "940 E Platte Ave",
    side: "west",
    names: [],
    notes: "",
    is_us: false,
    position_index: -1,
  },
  // East block, north end
  {
    id: "1003-custer-e",
    address: "1003 Custer Ave",
    side: "east",
    names: [],
    notes: "",
    is_us: false,
    position_index: 10,
  },
  {
    id: "1007-boulder-e",
    address: "1007 E Boulder St",
    side: "east",
    names: [],
    notes: "",
    is_us: false,
    position_index: 11,
  },
  // East block, south end
  {
    id: "1002-platte-e",
    address: "1002 E Platte Ave",
    side: "east",
    names: [],
    notes: "",
    is_us: false,
    position_index: -1,
  },
];
