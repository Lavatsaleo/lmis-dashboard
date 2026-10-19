import React, { useState } from "react";
import { Button, Card, CardContent, FormControl, InputLabel, MenuItem, Select, Stack, TextField, Typography } from "@mui/material";
import { api } from "../../api/client";
import { countyMenuItems } from "./countyOptions";
import {
  LOCATION_TYPES,
  isSiteType,
  parentOptions,
  typeLabel,
  usesCounty,
} from "./hierarchy";

const EMPTY = { code: "", name: "", stockLocationType: "CLINIC_STORE", countyId: "", parentStockLocationId: "", capacityMetricTonnes: "", latitude: "", longitude: "" };

const isWarehouseType = (t) => t === "CENTRAL_WAREHOUSE" || t === "FIELD_BASE_WAREHOUSE";

export default function AddLocationCard({ locations, counties, implementationBody, onSaved, setError }) {
  const [form, setForm] = useState(EMPTY);
  // Countries without preloaded counties (Kenya) keep the simple form.
  const showCounty = counties.length > 0 && usesCounty(form.stockLocationType);

  const options = parentOptions(locations, form.stockLocationType, { countyId: form.countyId });
  // A field base normally sits under the one main warehouse: preselect it.
  const defaultParentFor = (type, countyId) => {
    const opts = parentOptions(locations, type, { countyId });
    return type === "FIELD_BASE_WAREHOUSE" && opts.length === 1 ? opts[0].id : "";
  };

  const changeType = (stockLocationType) =>
    setForm({
      ...form,
      stockLocationType,
      countyId: usesCounty(stockLocationType) ? form.countyId : "",
      parentStockLocationId: defaultParentFor(stockLocationType, form.countyId),
    });

  const changeCounty = (countyId) => {
    const stillValid = parentOptions(locations, form.stockLocationType, { countyId }).some((x) => x.id === form.parentStockLocationId);
    setForm({ ...form, countyId, parentStockLocationId: stillValid ? form.parentStockLocationId : defaultParentFor(form.stockLocationType, countyId) });
  };

  const add = async () => {
    try {
      setError("");
      if (!form.code.trim() || !form.name.trim()) return setError("Location code and name are required.");
      if (usesCounty(form.stockLocationType) && counties.length && !form.countyId) return setError("Choose the county.");
      await api.post("/api/stock-locations", {
        ...implementationBody,
        code: form.code,
        name: form.name,
        stockLocationType: form.stockLocationType,
        countyId: form.countyId || null,
        parentStockLocationId: form.parentStockLocationId || null,
        capacityMetricTonnes: isWarehouseType(form.stockLocationType) && form.capacityMetricTonnes !== "" ? Number(form.capacityMetricTonnes) : null,
        latitude: form.latitude === "" ? null : Number(form.latitude),
        longitude: form.longitude === "" ? null : Number(form.longitude),
      });
      setForm({ ...EMPTY, stockLocationType: form.stockLocationType, countyId: form.countyId, parentStockLocationId: form.parentStockLocationId });
      onSaved();
    } catch (e) {
      setError(e?.response?.data?.message || e.message);
    }
  };

  const parentLabel = isSiteType(form.stockLocationType) ? "Field base" : "Parent location";

  return (
    <Card sx={{ borderRadius: 4 }}>
      <CardContent>
        <Typography variant="h6" fontWeight={900}>Add Stock Location</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {counties.length
            ? "Main warehouse → county → field base → sites. Pick the county first; for a site, the field base list shows only that county's bases."
            : "Choose the location type and, where needed, the location it is supplied from."}
        </Typography>

        <Stack spacing={1.5}>
          <Stack direction={{ xs: "column", lg: "row" }} spacing={1.5}>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Location type</InputLabel>
              <Select label="Location type" value={form.stockLocationType} onChange={(e) => changeType(e.target.value)}>
                {LOCATION_TYPES.map((t) => <MenuItem value={t} key={t}>{typeLabel(t)}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField size="small" label="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            <TextField size="small" label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} sx={{ minWidth: 230 }} />
          </Stack>

          <Stack direction={{ xs: "column", lg: "row" }} spacing={1.5}>
            {showCounty ? (
              <FormControl size="small" sx={{ minWidth: 220 }}>
                <InputLabel>County</InputLabel>
                <Select label="County" value={form.countyId} onChange={(e) => changeCounty(e.target.value)}>
                  {countyMenuItems(counties)}
                </Select>
              </FormControl>
            ) : null}

            {form.stockLocationType !== "CENTRAL_WAREHOUSE" ? (
              <FormControl size="small" sx={{ minWidth: 240 }}>
                <InputLabel>{parentLabel}</InputLabel>
                <Select
                  label={parentLabel}
                  value={options.some((x) => x.id === form.parentStockLocationId) ? form.parentStockLocationId : ""}
                  onChange={(e) => setForm({ ...form, parentStockLocationId: e.target.value })}
                >
                  <MenuItem value="">Not linked yet</MenuItem>
                  {options.map((x) => (
                    <MenuItem key={x.id} value={x.id}>{x.name} — {typeLabel(x.stockLocationType)}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            ) : null}

            {isWarehouseType(form.stockLocationType) ? (
              <TextField size="small" type="number" label="Capacity (MT)" value={form.capacityMetricTonnes} onChange={(e) => setForm({ ...form, capacityMetricTonnes: e.target.value })} sx={{ width: 140 }} />
            ) : null}
            <TextField size="small" type="number" label="Latitude" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} sx={{ width: 140 }} />
            <TextField size="small" type="number" label="Longitude" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} sx={{ width: 140 }} />
            <Button variant="contained" onClick={add}>Add</Button>
          </Stack>

          {showCounty && isSiteType(form.stockLocationType) && form.countyId && options.every((x) => x.stockLocationType !== "FIELD_BASE_WAREHOUSE") ? (
            <Typography variant="caption" color="warning.main">
              This county has no field base yet. Add one (type: Field base, same county) or link the site later.
            </Typography>
          ) : null}
        </Stack>
      </CardContent>
    </Card>
  );
}
