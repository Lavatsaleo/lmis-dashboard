// Stock-location hierarchy rules shared by the Supply Configuration screens.
// Mirrors the backend (stockLocations.js ALLOWED_PARENT_TYPES).
//
//   Main warehouse  ->  County  ->  Field base  ->  Sites
// Counties group field bases and sites; they are not stock locations.

export const LOCATION_TYPES = [
  "CENTRAL_WAREHOUSE",
  "FIELD_BASE_WAREHOUSE",
  "CLINIC_STORE",
  "PHARMACY_STORE",
  "OTHER",
];

export const LOCATION_TYPE_LABELS = {
  CENTRAL_WAREHOUSE: "Main warehouse",
  FIELD_BASE_WAREHOUSE: "Field base",
  CLINIC_STORE: "Site (clinic)",
  PHARMACY_STORE: "Pharmacy store",
  OTHER: "Other store",
};

export const ALLOWED_PARENT_TYPES = {
  CENTRAL_WAREHOUSE: [],
  FIELD_BASE_WAREHOUSE: ["CENTRAL_WAREHOUSE"],
  CLINIC_STORE: ["CENTRAL_WAREHOUSE", "FIELD_BASE_WAREHOUSE"],
  PHARMACY_STORE: ["CENTRAL_WAREHOUSE", "FIELD_BASE_WAREHOUSE"],
  OTHER: ["CENTRAL_WAREHOUSE", "FIELD_BASE_WAREHOUSE"],
};

export const typeLabel = (t) => LOCATION_TYPE_LABELS[t] || String(t || "").replaceAll("_", " ");

export const isSiteType = (t) => t === "CLINIC_STORE" || t === "PHARMACY_STORE" || t === "OTHER";

// Types that belong to a county (everything below the main warehouse).
export const usesCounty = (t) => t !== "CENTRAL_WAREHOUSE";

export function locationType(loc) {
  return loc.stockLocationType || (loc.type === "WAREHOUSE" ? "CENTRAL_WAREHOUSE" : "CLINIC_STORE");
}

export function parentIdOf(loc) {
  return loc.parentStockLocationId || loc.warehouseId || "";
}

/**
 * Valid parents for a location of `childType`.
 * For a site with a county, only that county's field bases are offered (plus
 * the main warehouse(s), which may supply sites directly).
 */
export function parentOptions(locations, childType, { selfId = null, countyId = "" } = {}) {
  const allowed = ALLOWED_PARENT_TYPES[childType] || [];
  return locations.filter((x) => {
    if (x.id === selfId) return false;
    const t = locationType(x);
    if (!allowed.includes(t)) return false;
    if (isSiteType(childType) && countyId && t === "FIELD_BASE_WAREHOUSE") return x.countyId === countyId;
    return true;
  });
}

export const countyLabel = (c) => (c ? (c.state ? `${c.name} (${c.state})` : c.name) : "");
