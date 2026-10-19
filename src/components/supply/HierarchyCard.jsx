import React, { useState } from "react";
import { Box, Button, Card, CardContent, Chip, Collapse, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { countyLabel, isSiteType, locationType, parentIdOf } from "./hierarchy";

function capacityChip(loc) {
  return loc.capacityMetricTonnes == null ? null : (
    <Chip size="small" variant="outlined" label={`${loc.capacityMetricTonnes} MT`} />
  );
}

function BaseNode({ base, sites }) {
  const [open, setOpen] = useState(false);
  return (
    <Box sx={{ ml: 3, mt: 1, pl: 1.5, borderLeft: (t) => `2px solid ${alpha(t.palette.primary.main, 0.25)}` }}>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
        <Typography fontWeight={800}>{base.name}</Typography>
        <Chip size="small" label="Field base" color="primary" variant="outlined" />
        {capacityChip(base)}
        <Button size="small" onClick={() => setOpen(!open)} disabled={!sites.length}>
          {sites.length} site(s) {sites.length ? (open ? "▲" : "▼") : ""}
        </Button>
      </Stack>
      <Collapse in={open}>
        <Typography variant="body2" color="text.secondary" sx={{ ml: 1, mt: 0.5 }}>
          {sites.map((s) => s.name).join(" • ")}
        </Typography>
      </Collapse>
    </Box>
  );
}

export default function HierarchyCard({ locations, counties }) {
  const childrenOf = (id) => locations.filter((l) => parentIdOf(l) === id);
  const countyById = new Map(counties.map((c) => [c.id, c]));

  const mains = locations.filter((l) => locationType(l) === "CENTRAL_WAREHOUSE");
  const unlinkedBases = locations.filter((l) => locationType(l) === "FIELD_BASE_WAREHOUSE" && !parentIdOf(l));
  const unlinkedSites = locations.filter((l) => isSiteType(locationType(l)) && !parentIdOf(l));

  const renderBasesByCounty = (bases) => {
    const groups = new Map();
    for (const b of bases) {
      const key = b.countyId || "";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(b);
    }
    return [...groups.entries()]
      .sort(([a], [b]) => countyLabel(countyById.get(a)).localeCompare(countyLabel(countyById.get(b))))
      .map(([countyId, countyBases]) => (
        <Box key={countyId || "none"} sx={{ ml: 3, mt: 1.5 }}>
          {counties.length ? (
            <Typography variant="subtitle2" fontWeight={900} color="text.secondary">
              {countyId ? `County: ${countyLabel(countyById.get(countyId))}` : "No county set"}
            </Typography>
          ) : null}
          {countyBases.map((b) => (
            <BaseNode key={b.id} base={b} sites={childrenOf(b.id).filter((s) => isSiteType(locationType(s)))} />
          ))}
        </Box>
      ));
  };

  return (
    <Card sx={{ borderRadius: 4 }}>
      <CardContent>
        <Typography variant="h6" fontWeight={900}>Supply Chain Hierarchy</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          How stock flows: main warehouse → county → field base → sites.
        </Typography>

        {mains.length === 0 ? (
          <Typography color="text.secondary">No main warehouse yet. Start by adding one (type: Main warehouse).</Typography>
        ) : null}

        {mains.map((main) => {
          const children = childrenOf(main.id);
          const bases = children.filter((c) => locationType(c) === "FIELD_BASE_WAREHOUSE");
          const directSites = children.filter((c) => isSiteType(locationType(c)));
          return (
            <Box key={main.id} sx={{ mb: 2 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="subtitle1" fontWeight={900}>{main.name}</Typography>
                <Chip size="small" label="Main warehouse" color="secondary" />
                {capacityChip(main)}
                <Chip size="small" variant="outlined" label={`${bases.length} field base(s)`} />
              </Stack>
              {renderBasesByCounty(bases)}
              {directSites.length ? (
                <Box sx={{ ml: 3, mt: 1.5 }}>
                  <Typography variant="subtitle2" fontWeight={900} color="text.secondary">Sites supplied directly</Typography>
                  <Typography variant="body2" color="text.secondary">{directSites.map((s) => s.name).join(" • ")}</Typography>
                </Box>
              ) : null}
            </Box>
          );
        })}

        {unlinkedBases.length || unlinkedSites.length ? (
          <Box sx={{ mt: 2, p: 1.5, borderRadius: 2, bgcolor: (t) => alpha(t.palette.warning.main, 0.08) }}>
            <Typography variant="subtitle2" fontWeight={900} color="warning.main">Not linked yet</Typography>
            {unlinkedBases.length ? (
              <Typography variant="body2">Field bases: {unlinkedBases.map((b) => b.name).join(" • ")}</Typography>
            ) : null}
            {unlinkedSites.length ? (
              <Typography variant="body2">Sites ({unlinkedSites.length}): {unlinkedSites.map((s) => s.name).join(" • ")}</Typography>
            ) : null}
          </Box>
        ) : null}
      </CardContent>
    </Card>
  );
}
