// Turns a warehouse's stock (from GET /api/warehouses/:id/twin) into an
// illustrative floor layout: pallets on floor positions, earliest expiry
// nearest the dispatch door (FEFO), with incoming stock waiting outside.
// Positions are generated, not real rack locations.
//
// Two building types:
//  - BUILDING: a rectangular store with a grid of pallet rows and aisles.
//  - RUBB_HALL: a tented hall (most field bases): one central aisle down the
//    length, pallet blocks along both walls, door at the front gable.

// Real-world sizes in metres (one scene unit = 1 m). A full pallet of
// cartons stands about 1.8 m (roughly ten cartons high).
export const PALLET = { w: 1.2, d: 1.0, base: 0.14, loadMax: 1.8 };
const GAP = 0.35;
const AISLE = 3.2;
const MARGIN = 2.5;
const DOCK_DEPTH = 6;

// Rubb hall proportions (typical WFP/UNHRD hall: 10 m wide, 24-32 m long).
export const HALL = { eave: 3.4, ridge: 5.6, aisle: 2.3, wallGap: 0.3, doorClear: 2.2, backClear: 0.8, bayGap: 0.06, rowGap: 0.1 };
// In a hall pallets are turned: the 1.0 m side faces the aisle.
const HALL_PALLET = { w: 1.0, d: 1.2 };

export const BAND_COLORS = {
  EXPIRED: "#B91C1C",
  CRITICAL: "#EA580C",
  WARNING: "#EAB308",
  OK: "#0E9F6E",
};

export const BAND_LABELS = {
  EXPIRED: "Expired",
  CRITICAL: "Expires < 60 days",
  WARNING: "Expires 60–120 days",
  OK: "Over 120 days",
};

export const HOLD_COLOR = "#7C3AED";

// Distinct, colour-blind friendlier palette for "colour by product".
const PRODUCT_PALETTE = ["#0098B4", "#7C3AED", "#DB2777", "#2563EB", "#059669", "#D97706", "#4B5563", "#0891B2"];

export function donorColors(donors) {
  const map = {};
  (donors || []).forEach((d, i) => {
    map[d.donorId || d.name] = PRODUCT_PALETTE[(i + 3) % PRODUCT_PALETTE.length];
  });
  return map;
}

export function productColors(products) {
  const map = {};
  products.forEach((p, i) => {
    map[p.product.id] = PRODUCT_PALETTE[i % PRODUCT_PALETTE.length];
  });
  return map;
}

/** Bags/sacks render as white sacks, everything else as cartons. */
export function isBagProduct(product) {
  return /bag|sack/i.test(`${product?.packUnitName || ""}`);
}

// Pallets in the field are a mix: blue plastic, wood, dark plastic.
const PALLET_COLORS = ["#3A62C4", "#3A62C4", "#3A62C4", "#9C7447", "#8A6640", "#454B52", "#A98256"];
// Hash so neighbouring positions get unrelated pallet types.
export const palletColorFor = (slotIndex) => {
  let h = (slotIndex + 1) * 2654435761;
  h = (h ^ (h >>> 13)) >>> 0;
  return PALLET_COLORS[h % PALLET_COLORS.length];
};

function stockToPallets(twin) {
  const bppByProduct = new Map(twin.products.map((p) => [p.product.id, p.boxesPerPallet]));
  const bagByProduct = new Map(twin.products.map((p) => [p.product.id, isBagProduct(p.product)]));
  const pallets = [];
  for (const batch of twin.batches) {
    const bpp = bppByProduct.get(batch.productId) || twin.layout.defaultBoxesPerPallet;
    let remaining = batch.boxes;
    let n = 0;
    while (remaining > 0) {
      const boxes = Math.min(bpp, remaining);
      pallets.push({
        id: `${batch.key}#${n}`,
        boxes,
        fill: boxes / bpp,
        batch,
        productId: batch.productId,
        bag: !!bagByProduct.get(batch.productId),
        held: !!batch.onHold,
      });
      remaining -= boxes;
      n += 1;
    }
  }
  return pallets;
}

function placeIncoming(twin, { width, frontZ, startX, cellW, cellD, maxCols }) {
  const incoming = [];
  let k = 0;
  for (const s of twin.incoming || []) {
    const count = Math.max(1, Math.ceil(s.boxes / twin.layout.defaultBoxesPerPallet));
    for (let i = 0; i < count && k < maxCols * 3; i += 1, k += 1) {
      const col = k % maxCols;
      const r = Math.floor(k / maxCols);
      incoming.push({
        id: `${s.id}#${i}`,
        x: startX + col * cellW + PALLET.w / 2,
        z: frontZ + 1.5 + r * cellD + PALLET.d / 2,
        shipment: s,
      });
    }
  }
  return incoming.filter((g) => Math.abs(g.x) < width / 2 + 2);
}

function buildHallLayout(twin, pallets) {
  const st = twin.warehouse.structure || {};
  const W = st.widthM || 10;
  const L = st.lengthM || 24;
  const cellX = HALL_PALLET.w + HALL.bayGap;
  const cellZ = HALL_PALLET.d + HALL.rowGap;
  const sideWidth = W / 2 - HALL.aisle / 2 - HALL.wallGap;
  const depthPerSide = Math.max(1, Math.floor(sideWidth / cellX));
  const rows = Math.max(1, Math.floor((L - HALL.doorClear - HALL.backClear) / cellZ));

  // Nearest the door first, then both sides, aisle side before wall side:
  // the earliest-expiry pallets are the easiest to reach and load.
  const slots = [];
  for (let row = 0; row < rows; row += 1) {
    const z = L / 2 - HALL.doorClear - row * cellZ - HALL_PALLET.d / 2;
    for (let d = 0; d < depthPerSide; d += 1) {
      for (const side of [-1, 1]) {
        const x = side * (HALL.aisle / 2 + d * cellX + HALL_PALLET.w / 2);
        slots.push({ x, z, row, col: d, side });
      }
    }
  }
  // More stock than floor positions: stack a second tier.
  pallets.forEach((p, i) => {
    const slot = slots[i % slots.length];
    Object.assign(p, slot, { slot: i % slots.length, level: Math.floor(i / slots.length) });
  });

  const incoming = placeIncoming(twin, { width: W, frontZ: L / 2, startX: -HALL.aisle / 2 - HALL_PALLET.w, cellW: cellX, cellD: cellZ, maxCols: 3 });
  return {
    structure: "RUBB_HALL",
    pallet: { ...PALLET, ...HALL_PALLET },
    pallets,
    incoming,
    slots,
    positions: slots.length,
    floor: { width: W, depth: L, cols: depthPerSide * 2, rows },
    hall: { width: W, length: L, ...HALL },
    dock: { z: L / 2, depth: DOCK_DEPTH, width: W },
  };
}

function buildGridLayout(twin, pallets) {
  // Floor grid sized to capacity (or stock + headroom). Rows come in
  // back-to-back pairs with a forklift aisle between pairs.
  const positions = Math.max(twin.summary.floorPallets, pallets.length);
  const cols = Math.max(6, Math.min(32, Math.ceil(Math.sqrt(positions * 1.8))));
  const rows = Math.max(2, Math.ceil(positions / cols));
  const pairCount = Math.ceil(rows / 2);

  const cellW = PALLET.w + GAP;
  const cellD = PALLET.d + GAP;
  const width = cols * cellW - GAP + MARGIN * 2;
  const depth = pairCount * (2 * cellD) + (pairCount - 1) * AISLE + MARGIN * 2;

  // Row 0 is nearest the dock (front, +z); FEFO fills front rows first.
  const slots = [];
  for (let row = 0; row < rows; row += 1) {
    const pair = Math.floor(row / 2);
    const zFromFront = MARGIN + pair * (2 * cellD + AISLE) + (row % 2) * cellD + PALLET.d / 2;
    for (let col = 0; col < cols; col += 1) {
      const x = -width / 2 + MARGIN + col * cellW + PALLET.w / 2;
      slots.push({ x, z: depth / 2 - zFromFront, row, col });
    }
  }
  pallets.forEach((p, i) => Object.assign(p, slots[i], { slot: i, level: 0 }));

  const incoming = placeIncoming(twin, {
    width,
    frontZ: depth / 2,
    startX: -width / 2 + MARGIN,
    cellW,
    cellD,
    maxCols: Math.max(4, Math.floor((width - MARGIN * 2) / cellW)),
  });
  return {
    structure: "BUILDING",
    pallet: PALLET,
    pallets,
    incoming,
    slots: slots.slice(0, positions),
    positions,
    floor: { width, depth, cols, rows },
    dock: { z: depth / 2, depth: DOCK_DEPTH, width },
  };
}

/**
 * @returns {{
 *   structure: "BUILDING" | "RUBB_HALL",
 *   pallets: Array<{id, x, z, level, fill, boxes, batch, productId, bag, held, slot}>,
 *   incoming: Array<{id, x, z, shipment}>,
 *   slots: Array<{x, z, row, col}>,
 *   floor: {width, depth},
 *   hall?: object,
 *   dock: {z, depth, width}
 * }}
 */
export function buildLayout(twin) {
  const pallets = stockToPallets(twin);
  return twin.warehouse.structure?.type === "RUBB_HALL" ? buildHallLayout(twin, pallets) : buildGridLayout(twin, pallets);
}

export function formatDate(d) {
  if (!d) return "-";
  const x = new Date(d);
  return Number.isNaN(x.getTime()) ? "-" : x.toLocaleDateString();
}
