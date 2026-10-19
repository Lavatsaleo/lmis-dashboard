import React, { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { api } from "../api/client";
import ImplementationPicker from "../components/ImplementationPicker";
import { implementationQuery, useImplementationChoice } from "../components/implementationChoice";
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
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

function fmtNumber(value, digits = 2) {
  const n = Number(value || 0);
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: digits,
  }).format(n);
}

function fmtMoney(value, currency = "USD") {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function MetricCard({ title, primary, secondary, warning }) {
  return (
    <Card sx={{ borderRadius: 4, height: "100%" }}>
      <CardContent>
        <Typography variant="body2" color="text.secondary">
          {title}
        </Typography>
        <Typography variant="h5" fontWeight={900} sx={{ mt: 0.7 }}>
          {primary}
        </Typography>
        {secondary ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {secondary}
          </Typography>
        ) : null}
        {warning ? (
          <Chip size="small" label="Configuration incomplete" color="warning" sx={{ mt: 1 }} />
        ) : null}
      </CardContent>
    </Card>
  );
}

function measureLabel(measure, currency) {
  if (!measure) return { mt: "0 MT", value: fmtMoney(0, currency), incomplete: false };
  return {
    mt: `${fmtNumber(measure.metricTonnes, 4)} MT${measure.weightComplete ? "" : "*"}`,
    value: `${fmtMoney(measure.reportingValue, currency)}${measure.valueComplete ? "" : "*"}`,
    incomplete: !measure.weightComplete || !measure.valueComplete,
  };
}

export default function InventoryIntelligence() {
  const { me } = useOutletContext() || {};
  const { implementations, implementationId, setImplementationId, isSuperAdmin } = useImplementationChoice(me);
  const [locations, setLocations] = useState([]);
  const [locationId, setLocationId] = useState("");
  // The summary is tagged with the request it answers; until the current
  // request's answer arrives, the page is loading.
  const [result, setResult] = useState({ key: null, data: null, err: "" });

  // Wait for the user (and, for SUPER_ADMIN, the default implementation).
  const ready = Boolean(me) && (!isSuperAdmin || Boolean(implementationId));

  useEffect(() => {
    if (!ready) return;
    api
      .get(`/api/stock-locations${implementationQuery(isSuperAdmin, implementationId)}`)
      .then((res) => setLocations(res.data || []))
      .catch(() => setLocations([]));
  }, [ready, isSuperAdmin, implementationId]);

  const params = new URLSearchParams();
  if (locationId) params.set("locationId", locationId);
  if (isSuperAdmin && implementationId) params.set("implementationId", implementationId);
  const requestKey = params.toString();

  useEffect(() => {
    if (!ready) return undefined;
    let mounted = true;
    api
      .get(`/api/inventory/summary${requestKey ? `?${requestKey}` : ""}`)
      .then((res) => mounted && setResult({ key: requestKey, data: res.data, err: "" }))
      .catch((e) => mounted && setResult({ key: requestKey, data: null, err: e?.response?.data?.message || e.message }));
    return () => {
      mounted = false;
    };
  }, [ready, requestKey]);

  const loading = result.key !== requestKey;
  const data = result.data;
  const err = result.err;

  const changeImplementation = (id) => {
    setLocationId(""); // locations belong to one implementation
    setImplementationId(id);
  };

  const currency = data?.reportingCurrencyCode || "USD";
  const metrics = useMemo(() => {
    if (!data) return null;
    return {
      current: measureLabel(data.currentStock, currency),
      used: measureLabel(data.usedStock, currency),
      transit: measureLabel(data.inTransit, currency),
      expiry: measureLabel(data.expiringWithin90Days, currency),
    };
  }, [data, currency]);

  if (loading) return <Typography>Loading inventory intelligence…</Typography>;
  if (err) return <Alert severity="error">{err}</Alert>;
  if (!data || !metrics) return <Typography>No inventory data available.</Typography>;

  const warningCount =
    (data.configurationWarnings?.productsMissingWeight?.length || 0) +
    (data.configurationWarnings?.productsOrBatchesMissingValue?.length || 0);

  return (
    <Box sx={{ display: "grid", gap: 2.5 }}>
      <Card sx={{ borderRadius: 4 }}>
        <CardContent>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={2}
            justifyContent="space-between"
            alignItems={{ xs: "stretch", md: "center" }}
          >
            <Box>
              <Typography variant="h5" fontWeight={900}>
                Inventory Intelligence
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Physical stock, metric-tonne capacity and commodity value, including stock already used.
              </Typography>
            </Box>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <ImplementationPicker
              implementations={implementations}
              value={implementationId}
              onChange={changeImplementation}
              isSuperAdmin={isSuperAdmin}
            />
            <FormControl size="small" sx={{ minWidth: 340 }}>
              <InputLabel>Stock location</InputLabel>
              <Select
                label="Stock location"
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
              >
                <MenuItem value="">All accessible locations</MenuItem>
                {locations.map((loc) => (
                  <MenuItem key={loc.id} value={loc.id}>
                    {loc.name} ({String(loc.stockLocationType || loc.type).replaceAll("_", " ")})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {warningCount > 0 ? (
        <Alert severity="warning">
          Some products do not yet have logistics weight and/or valuation configured. Values marked with * are known subtotals, not complete totals.
        </Alert>
      ) : null}

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", xl: "repeat(4, 1fr)" },
        }}
      >
        <MetricCard
          title="Current usable stock"
          primary={metrics.current.mt}
          secondary={`Worth ${metrics.current.value}`}
          warning={metrics.current.incomplete}
        />
        <MetricCard
          title="Stock already used / dispensed"
          primary={metrics.used.mt}
          secondary={`Worth ${metrics.used.value}`}
          warning={metrics.used.incomplete}
        />
        <MetricCard
          title="Stock in transit"
          primary={metrics.transit.mt}
          secondary={`Worth ${metrics.transit.value}`}
          warning={metrics.transit.incomplete}
        />
        <MetricCard
          title="Expiring within 90 days"
          primary={metrics.expiry.mt}
          secondary={`Value at risk ${metrics.expiry.value}`}
          warning={metrics.expiry.incomplete}
        />
      </Box>

      <Card sx={{ borderRadius: 4 }}>
        <CardContent>
          <Typography variant="h6" fontWeight={900} sx={{ mb: 1.5 }}>
            Warehouse & Stock Location Capacity
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Location</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell align="right">Capacity (MT)</TableCell>
                  <TableCell align="right">Current (MT)</TableCell>
                  <TableCell align="right">Available (MT)</TableCell>
                  <TableCell align="right">Utilisation</TableCell>
                  <TableCell align="right">Current worth</TableCell>
                  <TableCell align="right">Used (MT)</TableCell>
                  <TableCell align="right">Used worth</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(data.byLocation || []).map((row) => (
                  <TableRow key={row.location.id} hover>
                    <TableCell sx={{ fontWeight: 800 }}>{row.location.name}</TableCell>
                    <TableCell>{String(row.location.stockLocationType || row.location.type).replaceAll("_", " ")}</TableCell>
                    <TableCell align="right">
                      {row.capacity?.capacityMetricTonnes == null ? "Not set" : fmtNumber(row.capacity.capacityMetricTonnes, 3)}
                    </TableCell>
                    <TableCell align="right">
                      {fmtNumber(row.currentStock.metricTonnes, 4)}{row.currentStock.weightComplete ? "" : "*"}
                    </TableCell>
                    <TableCell align="right">
                      {row.capacity?.availableMetricTonnes == null ? "—" : fmtNumber(row.capacity.availableMetricTonnes, 4)}
                    </TableCell>
                    <TableCell align="right">
                      {row.capacity?.utilizationPct == null ? "—" : `${fmtNumber(row.capacity.utilizationPct, 2)}%`}
                    </TableCell>
                    <TableCell align="right">
                      {fmtMoney(row.currentStock.reportingValue, currency)}{row.currentStock.valueComplete ? "" : "*"}
                    </TableCell>
                    <TableCell align="right">
                      {fmtNumber(row.usedStock.metricTonnes, 4)}{row.usedStock.weightComplete ? "" : "*"}
                    </TableCell>
                    <TableCell align="right">
                      {fmtMoney(row.usedStock.reportingValue, currency)}{row.usedStock.valueComplete ? "" : "*"}
                    </TableCell>
                  </TableRow>
                ))}
                {(data.byLocation || []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9}>No stock recorded in this scope.</TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      <Card sx={{ borderRadius: 4 }}>
        <CardContent>
          <Typography variant="h6" fontWeight={900} sx={{ mb: 1.5 }}>
            Commodity Breakdown
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Commodity</TableCell>
                  <TableCell>Base unit</TableCell>
                  <TableCell align="right">Current units</TableCell>
                  <TableCell align="right">Current MT</TableCell>
                  <TableCell align="right">Current worth</TableCell>
                  <TableCell align="right">Used units</TableCell>
                  <TableCell align="right">Used MT</TableCell>
                  <TableCell align="right">Used worth</TableCell>
                  <TableCell align="right">In transit MT</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(data.byProduct || []).map((row) => (
                  <TableRow key={row.product.id} hover>
                    <TableCell sx={{ fontWeight: 800 }}>
                      {row.product.name}
                      <Typography variant="caption" display="block" color="text.secondary">
                        {row.product.code}
                      </Typography>
                    </TableCell>
                    <TableCell>{row.product.baseUnitName}</TableCell>
                    <TableCell align="right">{fmtNumber(row.currentStock.baseUnits, 0)}</TableCell>
                    <TableCell align="right">{fmtNumber(row.currentStock.metricTonnes, 4)}{row.currentStock.weightComplete ? "" : "*"}</TableCell>
                    <TableCell align="right">{fmtMoney(row.currentStock.reportingValue, currency)}{row.currentStock.valueComplete ? "" : "*"}</TableCell>
                    <TableCell align="right">{fmtNumber(row.usedStock.baseUnits, 0)}</TableCell>
                    <TableCell align="right">{fmtNumber(row.usedStock.metricTonnes, 4)}{row.usedStock.weightComplete ? "" : "*"}</TableCell>
                    <TableCell align="right">{fmtMoney(row.usedStock.reportingValue, currency)}{row.usedStock.valueComplete ? "" : "*"}</TableCell>
                    <TableCell align="right">{fmtNumber(row.inTransit.metricTonnes, 4)}{row.inTransit.weightComplete ? "" : "*"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  );
}
