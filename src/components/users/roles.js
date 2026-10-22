// User roles, what each one does, and which country/programme modules it
// needs. Mirrors the backend (routes/users.js ROLE_MODULES and
// resolveUserAssignment), so the forms only offer choices the API accepts.

import { locationType, typeLabel } from "../supply/hierarchy";

export const ROLES = ["SUPER_ADMIN", "COUNTRY_ADMIN", "WAREHOUSE_OFFICER", "FACILITY_OFFICER", "CLINICIAN", "VIEWER"];

// Only a Super Admin can create, edit or grant these.
export const ADMIN_ROLES = ["SUPER_ADMIN", "COUNTRY_ADMIN"];

/** Roles the signed-in admin may assign. */
// A Country Admin may make another Country Admin for their own country, never a Super Admin.
export const assignableRoles = (me) =>
  me?.role === "SUPER_ADMIN" ? ROLES : me?.role === "COUNTRY_ADMIN" ? ROLES.filter((r) => r !== "SUPER_ADMIN") : ROLES.filter((r) => !ADMIN_ROLES.includes(r));

export const isAdminRole = (role) => ADMIN_ROLES.includes(role);

// Location picker value for a viewer who reads the whole country.
export const WHOLE_COUNTRY = "__WHOLE_COUNTRY__";

export const ROLE_META = {
  SUPER_ADMIN: {
    label: "Super Admin",
    color: "error",
    description: "Global: every country, configuration and user management.",
    location: "none",
  },
  COUNTRY_ADMIN: {
    label: "Country Admin",
    color: "warning",
    description: "One country: its users, supply configuration and all of its data.",
    location: "country",
  },
  WAREHOUSE_OFFICER: {
    label: "Warehouse Officer",
    color: "primary",
    description: "Receives stock, generates boxes and dispatches from one warehouse or field base.",
    location: "warehouse",
    modules: ["LOGISTICS"],
  },
  FACILITY_OFFICER: {
    label: "Facility Officer",
    color: "secondary",
    description: "Receives deliveries and manages the store at one facility or site.",
    location: "facility",
    modules: ["LOGISTICS", "CLINICAL"],
  },
  CLINICIAN: {
    label: "Clinician",
    color: "success",
    description: "Enrols children and records visits and dispenses at one facility.",
    location: "facility",
    modules: ["CLINICAL"],
  },
  VIEWER: {
    label: "Viewer",
    color: "default",
    description: "Read-only. A whole country, a warehouse and everything under it, or one facility.",
    location: "any",
    countryWide: true,
  },
};

export const roleLabel = (role) => ROLE_META[role]?.label || role;

/** Is the role usable in an implementation with these modules enabled? */
export function roleAllowed(role, enabledModules) {
  const needed = ROLE_META[role]?.modules;
  if (!needed || !enabledModules) return true;
  return needed.some((m) => enabledModules.includes(m));
}

/** Why a role cannot be used in an implementation, or "" when it can. */
export function roleUnavailableReason(role, implementation) {
  if (!implementation || roleAllowed(role, implementation.enabledModules)) return "";
  const where = implementation.country?.name || implementation.name;
  return `Not used in ${where} (${ROLE_META[role].modules.join("/")} module off)`;
}

/** Locations a role can be assigned to, with a disabled flag and reason. */
export function locationOptionsFor(role, locations) {
  const kind = ROLE_META[role]?.location;
  if (!kind || kind === "none") return [];
  return locations
    .filter((l) => (kind === "warehouse" ? l.type === "WAREHOUSE" : kind === "facility" ? l.type === "FACILITY" : true))
    .map((l) => {
      const unlinked = kind === "facility" && !l.warehouseId;
      return {
        ...l,
        disabled: unlinked || l.isActive === false,
        hint: unlinked ? "not linked to a warehouse" : l.isActive === false ? "inactive" : typeLabel(locationType(l)),
      };
    })
    .sort((a, b) => Number(a.disabled) - Number(b.disabled) || String(a.name).localeCompare(String(b.name)));
}

export const locationLabelFor = (role) =>
  ({ warehouse: "Warehouse / field base", facility: "Facility / site", any: "What they can see" })[
    ROLE_META[role]?.location
  ] || "Location";

export const implementationLabel = (impl) =>
  impl ? [impl.country?.name, impl.name].filter(Boolean).join(" • ") : "Global";

export function genPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#$!";
  const random = new Uint32Array(12);
  crypto.getRandomValues(random);
  let out = Array.from(random, (n) => chars[n % chars.length]).join("");
  if (!/[!@#$]/.test(out)) out = `${out.slice(0, 11)}!`;
  if (!/\d/.test(out)) out = `${out.slice(0, 10)}7${out.slice(11)}`;
  return out;
}

// One stable colour per country so Kenya and South Sudan users are told apart
// at a glance. Unknown countries fall back to a neutral tone.
const COUNTRY_COLORS = {
  KE: "#0098B4",
  SS: "#C2410C",
};

const FALLBACK = "#64748B";

export function countryColor(code) {
  return COUNTRY_COLORS[String(code || "").toUpperCase()] || FALLBACK;
}

/**
 * How a role + picker value is assigned: "global" (Super Admin), "country"
 * (Country Admin, or a Viewer given the whole country) or "location".
 */
export function assignmentKind(role, facilityCode) {
  const location = ROLE_META[role]?.location;
  if (location === "none") return "global";
  if (location === "country") return "country";
  if (facilityCode === WHOLE_COUNTRY && ROLE_META[role]?.countryWide) return "country";
  return "location";
}
