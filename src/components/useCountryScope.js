import { useState } from "react";

import { useImplementationChoice } from "./implementationChoice";

const STORAGE_KEY = "anchor.countryScope";
export const ALL_COUNTRIES = "ALL";

const readSaved = () => {
  try {
    return window.localStorage.getItem(STORAGE_KEY) || "";
  } catch {
    return "";
  }
};

/**
 * Which country the stock pages (Overview, Alerts, Facility Store) show.
 * Only a SUPER_ADMIN chooses: their own country by default (Kenya for the
 * existing accounts), another country, or "All countries" combined. Everyone
 * else is limited by the server to their own scope, so the query is empty.
 */
export function useCountryScope(me) {
  const { implementations, isSuperAdmin } = useImplementationChoice(me);
  const ownId = me?.platformContext?.implementation?.id || "";
  const [saved, setSaved] = useState(readSaved);

  const known = (id) => implementations.some((i) => i.id === id);
  // A saved choice that no longer exists falls back to the user's own country.
  const value = !implementations.length
    ? ""
    : saved === ALL_COUNTRIES || known(saved)
      ? saved
      : known(ownId)
        ? ownId
        : ALL_COUNTRIES;

  const setValue = (v) => {
    setSaved(v);
    try {
      window.localStorage.setItem(STORAGE_KEY, v);
    } catch {
      // remembered for this page only
    }
  };

  const ready = !isSuperAdmin || !!value;
  const implementationId = isSuperAdmin && value && value !== ALL_COUNTRIES ? value : "";
  return { isSuperAdmin, implementations, value, setValue, ready, implementationId };
}
