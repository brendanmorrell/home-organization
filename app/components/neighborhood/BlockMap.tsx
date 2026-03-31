import type { Neighbor } from "~/lib/supabase";
import { STREET_NAME, ALLEY_NAME, INSTITUTE_NAME } from "~/data/neighbors";

interface BlockMapProps {
  neighbors: Neighbor[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

// --- Static lot geography matching county assessor ---

type SingleLot = { id: string; addr: string; h: number };
type SplitRow = { h: number; split: { id: string; addr: string; w: number }[] };
type LotRow = SingleLot | SplitRow;

function isSplit(row: LotRow): row is SplitRow {
  return "split" in row;
}

// Institute St block (west of alley), north → south
// Heights tuned to match assessor proportions
const INSTITUTE_LOTS: LotRow[] = [
  { h: 1.7, split: [
    { id: "331-institute", addr: "331", w: 0.55 },
    { id: "907-boulder", addr: "907", w: 0.45 },
  ]},
  { id: "325-institute", addr: "325", h: 1.1 },
  { id: "323-institute", addr: "323", h: 1.5 },
  { id: "315-institute", addr: "315", h: 2.6 },
  { id: "309-institute", addr: "309", h: 0.75 },
  { id: "307-institute", addr: "307", h: 0.75 },
  { id: "303-institute", addr: "303", h: 1.5 },
];

// Our block (west side of Custer Ave), north → south
const OUR_LOTS: LotRow[] = [
  { h: 1.5, split: [
    { id: "915-boulder", addr: "915", w: 0.45 },
    { id: "919-boulder", addr: "919", w: 0.55 },
  ]},
  { id: "324-custer", addr: "324", h: 1.4 },
  { id: "322-custer", addr: "322", h: 1.4 },
  { id: "316-custer", addr: "316", h: 1.4 },
  { id: "314-custer", addr: "314", h: 1.3 },
  { id: "312-custer", addr: "312", h: 1.4 },
  { h: 1.5, split: [
    { id: "914-platte", addr: "914", w: 0.3 },
    { id: "916-platte", addr: "916", w: 0.35 },
    { id: "940-platte", addr: "940", w: 0.35 },
  ]},
];

// East side of Custer Ave, north → south
const EAST_LOTS: LotRow[] = [
  { h: 1.5, split: [
    { id: "1003-custer-e", addr: "1003", w: 0.55 },
    { id: "1007-boulder-e", addr: "1007", w: 0.45 },
  ]},
  { id: "319-custer", addr: "319", h: 2.8 },
  { id: "315-custer", addr: "315", h: 2.0 },
  { id: "309-custer", addr: "309", h: 2.0 },
  { id: "1002-platte-e", addr: "1002", h: 1.6 },
];

// Layout dimensions — proportions match assessor
const BLOCK_H = 680;
const INSTITUTE_W = 140;
const OUR_W = 190;
const EAST_W = 200;
const STREET_W = 50;
const ALLEY_W = 16;
const CROSS_H = 32;
const PAD = 36;

function totalH(lots: LotRow[]) {
  return lots.reduce((s, r) => s + r.h, 0);
}

/** Find a neighbor by ID */
function findById(neighbors: Neighbor[], id: string): Neighbor | undefined {
  return neighbors.find((n) => n.id === id);
}

export default function BlockMap({
  neighbors,
  selectedId,
  onSelect,
}: BlockMapProps) {
  // X positions
  const xInstSt = PAD;
  const xInstBlock = xInstSt + STREET_W;
  const xAlley = xInstBlock + INSTITUTE_W;
  const xOurBlock = xAlley + ALLEY_W;
  const xCuster = xOurBlock + OUR_W;
  const xEastBlock = xCuster + STREET_W;
  const svgW = xEastBlock + EAST_W + PAD;

  // Y positions
  const yBoulder = PAD;
  const yBlocks = yBoulder + CROSS_H;
  const yPlatte = yBlocks + BLOCK_H;
  const svgH = yPlatte + CROSS_H + PAD;

  return (
    <div className="block-map-container">
      <div className="block-map-title">SITE PLAN — {STREET_NAME} Block</div>
      <svg
        viewBox={`0 0 ${svgW} ${svgH}`}
        className="block-map-svg"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Cross streets */}
        <rect x={PAD} y={yBoulder} width={svgW - PAD * 2} height={CROSS_H}
          fill="var(--surface)" stroke="var(--border)" strokeWidth={0.5} />
        <text x={svgW / 2} y={yBoulder + CROSS_H / 2 + 4}
          textAnchor="middle" className="street-label" style={{ fontSize: "11px" }}>
          E Boulder St
        </text>

        <rect x={PAD} y={yPlatte} width={svgW - PAD * 2} height={CROSS_H}
          fill="var(--surface)" stroke="var(--border)" strokeWidth={0.5} />
        <text x={svgW / 2} y={yPlatte + CROSS_H / 2 + 4}
          textAnchor="middle" className="street-label" style={{ fontSize: "11px" }}>
          E Platte Ave
        </text>

        {/* Vertical streets */}
        <VStreet x={xInstSt} y={yBlocks} w={STREET_W} h={BLOCK_H} label={INSTITUTE_NAME} />
        <VStreet x={xAlley} y={yBlocks} w={ALLEY_W} h={BLOCK_H} label="" />
        <VStreet x={xCuster} y={yBlocks} w={STREET_W} h={BLOCK_H} label={STREET_NAME} />

        {/* Blocks */}
        <LotBlock lots={INSTITUTE_LOTS}
          x={xInstBlock} y={yBlocks} w={INSTITUTE_W} h={BLOCK_H}
          neighbors={neighbors} selectedId={selectedId} onSelect={onSelect} />
        <LotBlock lots={OUR_LOTS}
          x={xOurBlock} y={yBlocks} w={OUR_W} h={BLOCK_H}
          neighbors={neighbors} selectedId={selectedId} onSelect={onSelect} />
        <LotBlock lots={EAST_LOTS}
          x={xEastBlock} y={yBlocks} w={EAST_W} h={BLOCK_H}
          neighbors={neighbors} selectedId={selectedId} onSelect={onSelect} />

        {/* North arrow */}
        <g transform={`translate(${svgW - 18}, ${PAD - 2})`}>
          <line x1={0} y1={12} x2={0} y2={0} stroke="var(--text-dim)" strokeWidth={1.5} />
          <polygon points="-3,4 0,-2 3,4" fill="var(--text-dim)" />
          <text y={20} textAnchor="middle" className="compass-label">N</text>
        </g>
      </svg>
    </div>
  );
}

function VStreet({ x, y, w, h, label }: {
  x: number; y: number; w: number; h: number; label: string;
}) {
  return (
    <>
      <rect x={x} y={y} width={w} height={h}
        fill="var(--surface)" stroke="var(--border)" strokeWidth={0.5} />
      {label && (
        <text
          transform={`translate(${x + w / 2}, ${y + h / 2}) rotate(-90)`}
          textAnchor="middle" className="street-label"
          style={{ fontSize: "11px" }}
        >
          {label}
        </text>
      )}
    </>
  );
}

function LotBlock({ lots, x, y, w, h, neighbors, selectedId, onSelect }: {
  lots: LotRow[];
  x: number; y: number; w: number; h: number;
  neighbors: Neighbor[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const total = totalH(lots);
  let cy = y;

  return (
    <g>
      <rect x={x} y={y} width={w} height={h}
        fill="var(--surface2)" stroke="var(--border)" strokeWidth={1} />

      {lots.map((row, i) => {
        const lotH = (row.h / total) * h;
        const rowY = cy;
        cy += lotH;
        const isLast = i === lots.length - 1;

        if (isSplit(row)) {
          let cx = x;
          return (
            <g key={i}>
              {row.split.map((sub, j) => {
                const subW = sub.w * w;
                const subX = cx;
                cx += subW;
                const neighbor = findById(neighbors, sub.id);
                return (
                  <LotCell
                    key={sub.id}
                    addr={sub.addr}
                    neighbor={neighbor}
                    x={subX} y={rowY} w={subW} h={lotH}
                    selectedId={selectedId} onSelect={onSelect}
                    borderRight={j < row.split.length - 1}
                    borderBottom={!isLast}
                  />
                );
              })}
            </g>
          );
        }

        const neighbor = findById(neighbors, row.id);
        return (
          <LotCell
            key={row.id}
            addr={row.addr}
            neighbor={neighbor}
            x={x} y={rowY} w={w} h={lotH}
            selectedId={selectedId} onSelect={onSelect}
            borderBottom={!isLast}
          />
        );
      })}
    </g>
  );
}

function LotCell({ addr, neighbor, x, y, w, h, selectedId, onSelect, borderBottom, borderRight }: {
  addr: string;
  neighbor: Neighbor | undefined;
  x: number; y: number; w: number; h: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  borderBottom?: boolean;
  borderRight?: boolean;
}) {
  const isUs = neighbor?.is_us ?? false;
  const selected = neighbor ? selectedId === neighbor.id : false;
  const names = neighbor?.names ?? [];

  let fill = "transparent";
  let stroke = "none";
  let strokeW = 0;

  if (isUs) {
    fill = "var(--accent-glow)";
    stroke = "var(--accent)";
    strokeW = 2;
  } else if (selected) {
    fill = "var(--highlight-glow)";
    stroke = "var(--highlight)";
    strokeW = 2;
  }

  const namesLine = isUs
    ? "Us"
    : names.length > 0
      ? names.join(", ")
      : "";

  const interactive = !!neighbor && !isUs;

  // For small cells (split lots), use smaller font
  const small = w < 80 || h < 45;

  return (
    <g
      className={`house-group ${names.length > 0 || isUs ? "has-info" : ""} ${selected ? "selected" : ""}`}
      onClick={interactive ? () => onSelect(neighbor!.id) : undefined}
      style={{ cursor: interactive ? "pointer" : "default" }}
    >
      <rect x={x} y={y} width={w} height={h}
        fill={fill} stroke={stroke} strokeWidth={strokeW} />

      {borderBottom && (
        <line x1={x} y1={y + h} x2={x + w} y2={y + h}
          stroke="var(--border)" strokeWidth={0.5} />
      )}
      {borderRight && (
        <line x1={x + w} y1={y} x2={x + w} y2={y + h}
          stroke="var(--border)" strokeWidth={0.5} />
      )}

      <text
        x={x + w / 2}
        y={y + (namesLine ? h / 2 - 2 : h / 2 + 4)}
        textAnchor="middle"
        className={`house-address${!interactive ? " decorative" : ""}`}
        style={small ? { fontSize: "10px" } : undefined}
      >
        {addr}
      </text>

      {namesLine && (
        <text
          x={x + w / 2}
          y={y + h / 2 + (small ? 9 : 12)}
          textAnchor="middle"
          className={`house-name ${isUs ? "is-us" : ""}`}
          style={{ fontSize: small ? "9px" : "10px" }}
        >
          {namesLine}
        </text>
      )}
    </g>
  );
}
