import React, { useEffect, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  LinearProgress,
  Stack,
  Typography,
} from "@mui/material";
import WarehouseOutlinedIcon from "@mui/icons-material/WarehouseOutlined";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";

import { api } from "../api/client";
import ImplementationPicker from "../components/ImplementationPicker";
import { implementationQuery, useImplementationChoice } from "../components/implementationChoice";
import { typeLabel } from "../components/supply/hierarchy";

function utilisationColor(pct) {
  if (pct >= 95) return "error";
  if (pct >= 85) return "warning";
  return "primary";
}

function WarehouseCard({ w, onOpen }) {
  const pct = w.utilisationPct;
  return (
    <Card variant="outlined" sx={{ height: "100%" }}>
      <CardActionArea onClick={onOpen} sx={{ height: "100%", display: "flex", alignItems: "stretch" }}>
        <CardContent sx={{ display: "grid", gap: 1.5, alignContent: "start", width: "100%" }}>
          <Stack direction="row" spacing={1.5} alignItems="flex-start">
            <Box sx={{ p: 1, borderRadius: 2, bgcolor: "primary.main", color: "#fff", display: "grid", placeItems: "center" }}>
              <WarehouseOutlinedIcon fontSize="small" />
            </Box>
            <Box sx={{ minWidth: 0, flexGrow: 1 }}>
              <Typography fontWeight={800} noWrap title={w.name}>
                {w.name}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap component="div">
                {[w.code, typeLabel(w.stockLocationType), w.county?.name].filter(Boolean).join(" · ")}
              </Typography>
            </Box>
          </Stack>

          <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="baseline">
              <Typography variant="body2" color="text.secondary">
                Space used
              </Typography>
              <Typography variant="body2" fontWeight={700}>
                {pct !== null && pct !== undefined
                  ? `${pct}%`
                  : w.capacityMetricTonnes
                  ? "Pack weight missing"
                  : "Capacity not set"}
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={Math.min(100, pct || 0)}
              color={utilisationColor(pct || 0)}
              sx={{ height: 8, borderRadius: 4, mt: 0.75, bgcolor: "action.hover" }}
            />
            <Typography variant="caption" color="text.secondary">
              {w.metricTonnes !== null ? `${w.metricTonnes} MT` : `${w.pallets} pallets`}
              {w.capacityMetricTonnes ? ` of ${w.capacityMetricTonnes} MT` : ""}
            </Typography>
          </Box>

          <Stack direction="row" spacing={2}>
            <Box>
              <Typography variant="h6" fontWeight={800} lineHeight={1.1}>
                {w.boxes.toLocaleString()}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                boxes
              </Typography>
            </Box>
            <Box>
              <Typography variant="h6" fontWeight={800} lineHeight={1.1}>
                {w.units.toLocaleString()}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                units
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
            {w.expiredBoxes ? <Chip size="small" color="error" label={`${w.expiredBoxes} expired`} /> : null}
            {w.expiringBoxes ? <Chip size="small" color="warning" variant="outlined" label={`${w.expiringBoxes} expiring < 120 d`} /> : null}
            {w.incomingShipments ? (
              <Chip size="small" icon={<LocalShippingOutlinedIcon />} variant="outlined" label={`${w.incomingShipments} incoming`} />
            ) : null}
            {!w.expiredBoxes && !w.expiringBoxes && !w.incomingShipments ? (
              <Chip size="small" variant="outlined" label={w.boxes ? "No expiry alerts" : "Empty"} />
            ) : null}
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

export default function Warehouses() {
  const { me } = useOutletContext();
  const nav = useNavigate();
  const { implementations, implementationId, setImplementationId, isSuperAdmin } = useImplementationChoice(me);
  const query = implementationQuery(isSuperAdmin, implementationId);
  const [state, setState] = useState({ query: null, rows: [], error: "" });

  useEffect(() => {
    if (!me || (isSuperAdmin && !implementationId)) return undefined;
    let mounted = true;
    api
      .get(`/api/warehouses${query}`)
      .then((res) => mounted && setState({ query, rows: res.data?.rows || [], error: "" }))
      .catch((e) => mounted && setState({ query, rows: [], error: e?.response?.data?.message || e.message }));
    return () => {
      mounted = false;
    };
  }, [me, isSuperAdmin, implementationId, query]);

  const loading = state.query !== query;

  return (
    <Box sx={{ display: "grid", gap: 2.5 }}>
      <Card>
        <CardContent>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} justifyContent="space-between" alignItems={{ xs: "stretch", md: "center" }}>
            <Box>
              <Typography variant="h6" fontWeight={900}>
                Warehouses
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Open a warehouse for its 3D view, space, expiry risk, incoming stock and what to do next.
              </Typography>
            </Box>
            <ImplementationPicker
              implementations={implementations}
              value={implementationId}
              onChange={setImplementationId}
              isSuperAdmin={isSuperAdmin}
            />
          </Stack>
        </CardContent>
      </Card>

      {state.error ? <Typography color="error">{state.error}</Typography> : null}
      {loading ? <LinearProgress /> : null}
      {!loading && !state.rows.length && !state.error ? (
        <Card>
          <CardContent>
            <Typography color="text.secondary">No warehouses to show for your account.</Typography>
          </CardContent>
        </Card>
      ) : null}

      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0,1fr))", xl: "repeat(3, minmax(0,1fr))" } }}>
        {state.rows.map((w) => (
          <WarehouseCard key={w.id} w={w} onOpen={() => nav(`/warehouses/${w.id}`)} />
        ))}
      </Box>
    </Box>
  );
}
