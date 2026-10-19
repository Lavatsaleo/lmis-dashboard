import { useEffect, useMemo, useState } from "react";

import { api } from "../../api/client";

/** Every stock location of one country/programme (SUPER_ADMIN only). */
export function useImplementationLocations(implementationId) {
  const [state, setState] = useState({ key: null, rows: [] });
  const key = implementationId || "";

  useEffect(() => {
    let mounted = true;
    const query = implementationId ? `?implementationId=${encodeURIComponent(implementationId)}` : "";
    api
      .get(`/api/facilities${query}`)
      .then((res) => mounted && setState({ key, rows: Array.isArray(res.data) ? res.data : [] }))
      .catch(() => mounted && setState({ key, rows: [] }));
    return () => {
      mounted = false;
    };
  }, [implementationId, key]);

  return { locations: state.key === key ? state.rows : [], loading: state.key !== key };
}

/**
 * Countries/programmes with their enabled modules and user head counts
 * (GET /api/admin/users/summary). Bump `refreshKey` to reload.
 */
export function useUserSummary(enabled, refreshKey = 0) {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    if (!enabled) return undefined;
    let mounted = true;
    api
      .get("/api/admin/users/summary")
      .then((res) => mounted && setRows(res.data?.rows || []))
      .catch(() => mounted && setRows([]));
    return () => {
      mounted = false;
    };
  }, [enabled, refreshKey]);

  const implementations = useMemo(() => rows.map((r) => r.implementation).filter(Boolean), [rows]);
  return { rows, implementations };
}
