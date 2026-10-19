import React, { useCallback, useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { api } from "../api/client";
import ImplementationPicker from "../components/ImplementationPicker";
import { implementationQuery, useImplementationChoice } from "../components/implementationChoice";
import AddLocationCard from "../components/supply/AddLocationCard";
import HierarchyCard from "../components/supply/HierarchyCard";
import LinkSitesCard from "../components/supply/LinkSitesCard";
import DonorsCard from "../components/supply/DonorsCard";
import { countyMenuItems } from "../components/supply/countyOptions";
import {
  LOCATION_TYPES,
  locationType,
  parentIdOf,
  parentOptions,
  typeLabel,
  usesCounty,
} from "../components/supply/hierarchy";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  FormControl,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";

function ProductRow({ row, onSaved }) {
  const [form, setForm] = useState({
    baseUnitName: row.baseUnitName || "Sachet",
    packUnitName: row.packUnitName || "Box",
    unitsPerPack: row.unitsPerPack ?? 600,
    grossPackWeightKg: row.grossPackWeightKg ?? "",
    cartonsPerPallet: row.cartonsPerPallet ?? "",
    defaultUnitValue: row.defaultUnitValue ?? "",
    defaultCurrencyCode: row.defaultCurrencyCode || "USD",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    try {
      setSaving(true);
      setError("");
      await api.patch(`/api/products/${row.id}`, {
        ...form,
        unitsPerPack: Number(form.unitsPerPack),
        grossPackWeightKg: form.grossPackWeightKg === "" ? null : Number(form.grossPackWeightKg),
        cartonsPerPallet: form.cartonsPerPallet === "" ? null : Number(form.cartonsPerPallet),
        defaultUnitValue: form.defaultUnitValue === "" ? null : Number(form.defaultUnitValue),
      });
      onSaved();
    } catch (e) {
      setError(e?.response?.data?.message || e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <TableRow hover>
      <TableCell sx={{ minWidth: 190 }}>
        <Typography fontWeight={800}>{row.name}</Typography>
        <Typography variant="caption" color="text.secondary">{row.code}</Typography>
        {error ? <Typography variant="caption" color="error" display="block">{error}</Typography> : null}
      </TableCell>
      <TableCell><TextField size="small" value={form.baseUnitName} onChange={(e) => setForm({ ...form, baseUnitName: e.target.value })} /></TableCell>
      <TableCell><TextField size="small" value={form.packUnitName} onChange={(e) => setForm({ ...form, packUnitName: e.target.value })} /></TableCell>
      <TableCell><TextField size="small" type="number" value={form.unitsPerPack} onChange={(e) => setForm({ ...form, unitsPerPack: e.target.value })} sx={{ width: 110 }} /></TableCell>
      <TableCell><TextField size="small" type="number" value={form.grossPackWeightKg} onChange={(e) => setForm({ ...form, grossPackWeightKg: e.target.value })} sx={{ width: 130 }} /></TableCell>
      <TableCell><TextField size="small" type="number" value={form.cartonsPerPallet} placeholder="auto" onChange={(e) => setForm({ ...form, cartonsPerPallet: e.target.value })} sx={{ width: 110 }} /></TableCell>
      <TableCell><TextField size="small" type="number" value={form.defaultUnitValue} onChange={(e) => setForm({ ...form, defaultUnitValue: e.target.value })} sx={{ width: 130 }} /></TableCell>
      <TableCell><TextField size="small" value={form.defaultCurrencyCode} onChange={(e) => setForm({ ...form, defaultCurrencyCode: e.target.value.toUpperCase() })} sx={{ width: 90 }} /></TableCell>
      <TableCell><Button variant="contained" size="small" disabled={saving} onClick={save}>{saving ? "Saving…" : "Save"}</Button></TableCell>
    </TableRow>
  );
}

function LocationRow({ row, locations, counties, countiesEnabled, onSaved }) {
  const initial = {
    stockLocationType: locationType(row),
    countyId: row.countyId || "",
    parentStockLocationId: parentIdOf(row),
    capacityMetricTonnes: row.capacityMetricTonnes ?? "",
  };
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const options = parentOptions(locations, form.stockLocationType, { selfId: row.id, countyId: form.countyId });

  const save = async () => {
    // Send only what changed, so a capacity edit never re-submits type/parent.
    const payload = {};
    if (form.stockLocationType !== initial.stockLocationType) payload.stockLocationType = form.stockLocationType;
    if (form.countyId !== initial.countyId) payload.countyId = form.countyId || null;
    if (form.parentStockLocationId !== initial.parentStockLocationId) {
      payload.parentStockLocationId = form.parentStockLocationId || null;
    }
    if (String(form.capacityMetricTonnes) !== String(initial.capacityMetricTonnes)) {
      payload.capacityMetricTonnes = form.capacityMetricTonnes === "" ? null : Number(form.capacityMetricTonnes);
    }
    if (!Object.keys(payload).length) return;

    try {
      setSaving(true);
      setError("");
      await api.patch(`/api/stock-locations/${row.id}`, payload);
      onSaved();
    } catch (e) {
      setError(e?.response?.data?.message || e.message);
    } finally {
      setSaving(false);
    }
  };

  // Keep the parent only if it is still valid for the new type/county.
  const withValidParent = (next) => {
    const stillValid = parentOptions(locations, next.stockLocationType, { selfId: row.id, countyId: next.countyId })
      .some((x) => x.id === next.parentStockLocationId);
    return { ...next, parentStockLocationId: stillValid ? next.parentStockLocationId : "" };
  };

  return (
    <TableRow hover>
      <TableCell sx={{ minWidth: 200 }}>
        <Typography fontWeight={800}>{row.name}</Typography>
        <Typography variant="caption" color="text.secondary">{row.code}</Typography>
        {error ? <Typography variant="caption" color="error" display="block">{error}</Typography> : null}
      </TableCell>
      <TableCell>
        <FormControl size="small" sx={{ minWidth: 170 }}>
          <Select
            value={form.stockLocationType}
            onChange={(e) => setForm(withValidParent({ ...form, stockLocationType: e.target.value, countyId: usesCounty(e.target.value) ? form.countyId : "" }))}
          >
            {LOCATION_TYPES.map((t) => <MenuItem value={t} key={t}>{typeLabel(t)}</MenuItem>)}
          </Select>
        </FormControl>
      </TableCell>
      {countiesEnabled ? (
        <TableCell>
          <FormControl size="small" sx={{ minWidth: 170 }} disabled={!usesCounty(form.stockLocationType)}>
            <Select value={form.countyId} onChange={(e) => setForm(withValidParent({ ...form, countyId: e.target.value }))} displayEmpty>
              <MenuItem value="">No county</MenuItem>
              {countyMenuItems(counties)}
            </Select>
          </FormControl>
        </TableCell>
      ) : null}
      <TableCell>
        <FormControl size="small" sx={{ minWidth: 200 }} disabled={form.stockLocationType === "CENTRAL_WAREHOUSE"}>
          <Select
            value={options.some((x) => x.id === form.parentStockLocationId) ? form.parentStockLocationId : ""}
            onChange={(e) => setForm({ ...form, parentStockLocationId: e.target.value })}
            displayEmpty
          >
            <MenuItem value="">Not linked</MenuItem>
            {options.map((x) => <MenuItem key={x.id} value={x.id}>{x.name}</MenuItem>)}
          </Select>
        </FormControl>
      </TableCell>
      <TableCell>
        <TextField size="small" type="number" value={form.capacityMetricTonnes} onChange={(e) => setForm({ ...form, capacityMetricTonnes: e.target.value })} sx={{ width: 110 }} />
      </TableCell>
      <TableCell><Button variant="contained" size="small" disabled={saving} onClick={save}>{saving ? "Saving…" : "Save"}</Button></TableCell>
    </TableRow>
  );
}

const EMPTY_PRODUCT = { code: "", name: "", baseUnitName: "Sachet", packUnitName: "Box", unitsPerPack: 600, grossPackWeightKg: "", cartonsPerPallet: "", defaultUnitValue: "", defaultCurrencyCode: "USD" };

export default function SupplyConfiguration() {
  const { me } = useOutletContext() || {};
  const { implementations, implementationId, setImplementationId, isSuperAdmin } = useImplementationChoice(me);

  const [products, setProducts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [counties, setCounties] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [newProduct, setNewProduct] = useState(EMPTY_PRODUCT);

  const load = useCallback(async () => {
    if (isSuperAdmin && !implementationId) return; // wait for the default selection
    try {
      setLoading(true);
      setError("");
      const [p, l, c] = await Promise.all([
        api.get(`/api/products?includeInactive=true${implementationQuery(isSuperAdmin, implementationId, "&")}`),
        api.get(`/api/stock-locations${implementationQuery(isSuperAdmin, implementationId)}`),
        api.get(`/api/counties${implementationQuery(isSuperAdmin, implementationId)}`),
      ]);
      setProducts(p.data || []);
      setLocations(l.data || []);
      setCounties(c.data || []);
    } catch (e) {
      setError(e?.response?.data?.message || e.message);
    } finally {
      setLoading(false);
    }
  }, [isSuperAdmin, implementationId]);

  useEffect(() => {
    if (me) load();
  }, [me, load]);

  // Records created here belong to the selected implementation.
  const implementationBody = isSuperAdmin && implementationId ? { implementationId } : {};

  const createProduct = async () => {
    try {
      setError("");
      if (!newProduct.code || !newProduct.name) return setError("Product code and name are required.");
      await api.post("/api/products", {
        ...newProduct,
        ...implementationBody,
        unitsPerPack: Number(newProduct.unitsPerPack),
        grossPackWeightKg: newProduct.grossPackWeightKg === "" ? null : Number(newProduct.grossPackWeightKg),
        cartonsPerPallet: newProduct.cartonsPerPallet === "" ? null : Number(newProduct.cartonsPerPallet),
        defaultUnitValue: newProduct.defaultUnitValue === "" ? null : Number(newProduct.defaultUnitValue),
      });
      setNewProduct(EMPTY_PRODUCT);
      await load();
    } catch (e) {
      setError(e?.response?.data?.message || e.message);
    }
  };

  const selectedImplementation = implementations.find((x) => x.id === implementationId);
  // Counties are preloaded for countries that use them (South Sudan). Where
  // there are none (Kenya), county controls are hidden and nothing changes.
  const countiesEnabled = counties.length > 0;
  // Order the table the way stock flows: main warehouse, field bases, sites.
  const sortedLocations = [...locations].sort(
    (a, b) =>
      LOCATION_TYPES.indexOf(locationType(a)) - LOCATION_TYPES.indexOf(locationType(b)) ||
      String(a.name).localeCompare(String(b.name))
  );

  return (
    <Box sx={{ display: "grid", gap: 2.5 }}>
      <Card sx={{ borderRadius: 4 }}>
        <CardContent>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} justifyContent="space-between" alignItems={{ md: "center" }}>
            <Box>
              <Typography variant="h5" fontWeight={900}>Supply Configuration</Typography>
              <Typography variant="body2" color="text.secondary">
                Configure the warehouse hierarchy, capacity, commodity packaging, logistics weight and default financial value
                {selectedImplementation ? ` for ${[selectedImplementation.country?.name, selectedImplementation.name].filter(Boolean).join(" • ")}` : ""}.
              </Typography>
            </Box>
            <ImplementationPicker
              implementations={implementations}
              value={implementationId}
              onChange={setImplementationId}
              isSuperAdmin={isSuperAdmin}
            />
          </Stack>
          {error ? <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert> : null}
        </CardContent>
      </Card>

      {loading ? (
        <Typography>Loading supply configuration…</Typography>
      ) : (
        <>
          <HierarchyCard locations={locations} counties={counties} />
          <AddLocationCard locations={locations} counties={counties} implementationBody={implementationBody} onSaved={load} setError={setError} />
          {countiesEnabled ? <LinkSitesCard locations={locations} counties={counties} onSaved={load} /> : null}
          <DonorsCard implementationId={implementationId} canEdit={me?.role === "SUPER_ADMIN" || me?.role === "COUNTRY_ADMIN"} />

          <Card sx={{ borderRadius: 4 }}>
            <CardContent>
              <Typography variant="h6" fontWeight={900}>Stock Locations</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {countiesEnabled
                  ? "Edit a location’s type, county, parent or capacity. For a site, the parent list shows its county’s field bases."
                  : "Edit a location’s type, parent or capacity."}
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Location</TableCell>
                      <TableCell>Type</TableCell>
                      {countiesEnabled ? <TableCell>County</TableCell> : null}
                      <TableCell>Parent</TableCell>
                      <TableCell>Capacity MT</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {sortedLocations.map((row) => (
                      <LocationRow
                        key={row.id}
                        row={row}
                        locations={locations}
                        counties={counties}
                        countiesEnabled={countiesEnabled}
                        onSaved={load}
                      />
                    ))}
                    {sortedLocations.length === 0 ? (
                      <TableRow><TableCell colSpan={countiesEnabled ? 6 : 5}>No stock locations yet.</TableCell></TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>

          <Card sx={{ borderRadius: 4 }}>
            <CardContent>
              <Typography variant="h6" fontWeight={900}>Add Commodity / Product</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Gross pack weight enables metric-tonne reporting. Default unit value is a fallback; batch-specific acquisition values can override it during receipt.
              </Typography>
              <Stack direction={{ xs: "column", xl: "row" }} spacing={1.2} alignItems={{ xl: "center" }}>
                <TextField size="small" label="Code" value={newProduct.code} onChange={(e) => setNewProduct({ ...newProduct, code: e.target.value })} />
                <TextField size="small" label="Name" value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} />
                <TextField size="small" label="Base unit" value={newProduct.baseUnitName} onChange={(e) => setNewProduct({ ...newProduct, baseUnitName: e.target.value })} />
                <TextField size="small" label="Pack unit" value={newProduct.packUnitName} onChange={(e) => setNewProduct({ ...newProduct, packUnitName: e.target.value })} />
                <TextField size="small" type="number" label="Units/pack" value={newProduct.unitsPerPack} onChange={(e) => setNewProduct({ ...newProduct, unitsPerPack: e.target.value })} sx={{ width: 120 }} />
                <TextField size="small" type="number" label="Gross pack kg" value={newProduct.grossPackWeightKg} onChange={(e) => setNewProduct({ ...newProduct, grossPackWeightKg: e.target.value })} sx={{ width: 135 }} />
                <TextField size="small" type="number" label="Packs/pallet" value={newProduct.cartonsPerPallet} onChange={(e) => setNewProduct({ ...newProduct, cartonsPerPallet: e.target.value })} sx={{ width: 125 }} helperText="from packing list" />
                <TextField size="small" type="number" label="Default value/unit" value={newProduct.defaultUnitValue} onChange={(e) => setNewProduct({ ...newProduct, defaultUnitValue: e.target.value })} sx={{ width: 150 }} />
                <TextField size="small" label="Currency" value={newProduct.defaultCurrencyCode} onChange={(e) => setNewProduct({ ...newProduct, defaultCurrencyCode: e.target.value.toUpperCase() })} sx={{ width: 95 }} />
                <Button variant="contained" onClick={createProduct}>Add</Button>
              </Stack>

              <Divider sx={{ my: 2.5 }} />
              <TableContainer>
                <Table size="small">
                  <TableHead><TableRow><TableCell>Commodity</TableCell><TableCell>Base unit</TableCell><TableCell>Pack</TableCell><TableCell>Units/pack</TableCell><TableCell>Gross kg/pack</TableCell><TableCell>Packs/pallet</TableCell><TableCell>Default value/unit</TableCell><TableCell>Currency</TableCell><TableCell /></TableRow></TableHead>
                  <TableBody>{products.map((row) => <ProductRow key={row.id} row={row} onSaved={load} />)}</TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </>
      )}
    </Box>
  );
}
