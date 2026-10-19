import { useEffect, useState } from "react";
import { api } from "../api/client";

/**
 * Which implementation (country/programme) a page shows or configures.
 * A SUPER_ADMIN can switch between all of them; other roles only ever get
 * their own. Defaults to the user's own implementation, else the first one.
 */
export function useImplementationChoice(me) {
  const [implementations, setImplementations] = useState([]);
  const [implementationId, setImplementationId] = useState("");
  const isSuperAdmin = me?.role === "SUPER_ADMIN";
  const ownId = me?.platformContext?.implementation?.id || "";

  useEffect(() => {
    if (!me) return;
    let mounted = true;
    api
      .get("/api/implementations")
      .then((res) => {
        if (!mounted) return;
        const rows = Array.isArray(res.data) ? res.data : [];
        setImplementations(rows);
        setImplementationId((current) => current || ownId || rows[0]?.id || "");
      })
      .catch(() => {
        if (mounted) setImplementationId((current) => current || ownId);
      });
    return () => {
      mounted = false;
    };
  }, [me, ownId]);

  return { implementations, implementationId, setImplementationId, isSuperAdmin };
}

/** Query-string fragment for endpoints that accept ?implementationId (honoured for SUPER_ADMIN only). */
export function implementationQuery(isSuperAdmin, implementationId, joiner = "?") {
  return isSuperAdmin && implementationId ? `${joiner}implementationId=${encodeURIComponent(implementationId)}` : "";
}
