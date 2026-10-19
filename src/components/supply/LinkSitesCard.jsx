import React, { useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  CardContent,
  Checkbox,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { api } from "../../api/client";
import { countyMenuItems } from "./countyOptions";
import { isSiteType, locationType, parentIdOf, typeLabel } from "./hierarchy";

const NO_COUNTY = "__none__";

export default function LinkSitesCard({ locations, counties, onSaved }) {
  const [countyId, setCountyId] = useState("");
  const [baseId, setBaseId] = useState("");
  const [selected, setSelected] = useState([]);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState({ severity: "", text: "" });

  const byId = useMemo(() => new Map(locations.map((l) => [l.id, l])), [locations]);
  // Only counties that already have field bases or sites (of the ~80 preloaded).
  const activeCounties = useMemo(() => {
    const used = new Set(locations.map((l) => l.countyId).filter(Boolean));
    return counties.filter((c) => used.has(c.id));
  }, [counties, locations]);
  const inCounty = (l) => (countyId === NO_COUNTY ? !l.countyId : l.countyId === countyId);

  const bases = locations.filter((l) => locationType(l) === "FIELD_BASE_WAREHOUSE" && countyId && countyId !== NO_COUNTY && l.countyId === countyId);
  const sites = countyId ? locations.filter((l) => isSiteType(locationType(l)) && inCounty(l)) : [];
  const allSelected = sites.length > 0 && sites.every((s) => selected.includes(s.id));

  const changeCounty = (value) => {
    setCountyId(value);
    setSelected([]);
    setResult({ severity: "", text: "" });
    const countyBases = locations.filter((l) => locationType(l) === "FIELD_BASE_WAREHOUSE" && l.countyId === value);
    setBaseId(countyBases.length === 1 ? countyBases[0].id : "");
  };

  const toggle = (id) => setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const toggleAll = () => setSelected(allSelected ? [] : sites.map((s) => s.id));

  const link = async () => {
    try {
      setSaving(true);
      setResult({ severity: "", text: "" });
      const res = await api.patch("/api/stock-locations/bulk/parent", { parentStockLocationId: baseId, locationIds: selected });
      setResult({ severity: "success", text: `Linked ${res.data?.linkedCount ?? selected.length} site(s) to ${res.data?.parent?.name || "the field base"}.` });
      setSelected([]);
      onSaved();
    } catch (e) {
      const problems = e?.response?.data?.problems;
      const detail = Array.isArray(problems) && problems.length ? ` ${problems.map((p) => `${p.code}: ${p.message}`).join("; ")}` : "";
      setResult({ severity: "error", text: (e?.response?.data?.message || e.message) + detail });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card sx={{ borderRadius: 4 }}>
      <CardContent>
        <Typography variant="h6" fontWeight={900}>Link Sites to a Field Base</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Choose a county, then one of its field bases, tick the sites it supplies and link them in one step.
          The county list shows counties that already have field bases or sites.
        </Typography>

        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ md: "center" }} sx={{ mb: 2 }}>
          <FormControl size="small" sx={{ minWidth: 240 }}>
            <InputLabel>County</InputLabel>
            <Select label="County" value={countyId} onChange={(e) => changeCounty(e.target.value)}>
              {countyMenuItems(activeCounties)}
              <MenuItem value={NO_COUNTY}>Sites with no county</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 240 }} disabled={!countyId || countyId === NO_COUNTY}>
            <InputLabel>Field base</InputLabel>
            <Select label="Field base" value={bases.some((b) => b.id === baseId) ? baseId : ""} onChange={(e) => setBaseId(e.target.value)}>
              {bases.map((b) => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
            </Select>
          </FormControl>
          <Button variant="contained" disabled={!baseId || !selected.length || saving} onClick={link}>
            {saving ? "Linking…" : `Link ${selected.length || ""} selected`.trim()}
          </Button>
        </Stack>

        {countyId && countyId !== NO_COUNTY && bases.length === 0 ? (
          <Alert severity="warning" sx={{ mb: 2 }}>This county has no field base yet. Add one in “Add Stock Location” (type: Field base).</Alert>
        ) : null}
        {countyId === NO_COUNTY ? (
          <Alert severity="info" sx={{ mb: 2 }}>Give these sites a county in the table below first; then link them here.</Alert>
        ) : null}
        {result.text ? <Alert severity={result.severity} sx={{ mb: 2 }}>{result.text}</Alert> : null}

        {countyId ? (
          <TableContainer sx={{ maxHeight: 420 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox checked={allSelected} indeterminate={!allSelected && selected.length > 0} onChange={toggleAll} disabled={!sites.length} />
                  </TableCell>
                  <TableCell>Site</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Currently linked to</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sites.map((s) => {
                  const parent = byId.get(parentIdOf(s));
                  return (
                    <TableRow key={s.id} hover onClick={() => toggle(s.id)} sx={{ cursor: "pointer" }}>
                      <TableCell padding="checkbox"><Checkbox checked={selected.includes(s.id)} /></TableCell>
                      <TableCell>
                        <Typography fontWeight={700}>{s.name}</Typography>
                        <Typography variant="caption" color="text.secondary">{s.code}</Typography>
                      </TableCell>
                      <TableCell>{typeLabel(locationType(s))}</TableCell>
                      <TableCell>{parent ? parent.name : <Typography variant="body2" color="warning.main">Not linked</Typography>}</TableCell>
                    </TableRow>
                  );
                })}
                {sites.length === 0 ? (
                  <TableRow><TableCell colSpan={4}>No sites in this county yet.</TableCell></TableRow>
                ) : null}
              </TableBody>
            </Table>
          </TableContainer>
        ) : null}
      </CardContent>
    </Card>
  );
}
