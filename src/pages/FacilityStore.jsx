import React, { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { api } from "../api/client";
import { CountryScopeSelect } from "../components/CountryScope";
import { useCountryScope } from "../components/useCountryScope";
import dayjs from "dayjs";
import {
  Box,
  Card,
  CardContent,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Chip,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Divider,
  TableContainer,
  TextField,
  Tooltip,
  Button,
} from "@mui/material";
import { alpha } from "@mui/material/styles";

function fmt(n) {
  return new Intl.NumberFormat().format(Number(n || 0));
}

function Kpi({ title, value }) {
  return (
    // Label on top, number pinned to the bottom so tiles in a row line up.
    <Card sx={{ overflow: "hidden", height: "100%" }}>
      <CardContent sx={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 1 }}>
        <Typography variant="body2" color="text.secondary">
          {title}
        </Typography>
        <Typography variant="h4" sx={{ fontWeight: 800, lineHeight: 1.1 }}>
          {fmt(value)}
        </Typography>
      </CardContent>
    </Card>
  );
}

const SOURCE_NOTE = {
  CLINICAL: "Sachets given at clinical visits recorded in Anchor.",
  DHIS2: "Sachets reported at visits in DHIS2 (synced to Anchor).",
  BOTH: "Clinical visits recorded in Anchor and visits reported in DHIS2.",
};
const shortDay = (d) => dayjs(d).format("ddd D MMM");

/** How much this facility has dispensed: fixed periods, any date range, and day by day. */
function DispensedCard({ dispensed, units, days, range, setRange }) {
  const [draft, setDraft] = useState(range);
  const d = dispensed || {};
  const unit = units.toLowerCase();
  const max = Math.max(1, ...(d.byDay || []).map((x) => x.sachets));
  const recentDays = [...(d.byDay || [])].filter((x) => x.sachets > 0).reverse();
  const periods = [
    ["Today", d.today],
    ["Yesterday", d.yesterday],
    ["Last 7 days", d.last7Days],
    [`Last ${days} days`, d.lastWindow],
    [d.firstDay ? `Since ${dayjs(d.firstDay).format("D MMM YYYY")}` : "All time", d.allTime],
  ];
  return (
    <Card sx={{ overflow: "hidden" }}>
      <CardContent sx={{ display: "grid", gap: 2 }}>
        <Box>
          <Typography variant="h6" fontWeight={900}>
            {units} dispensed at this facility
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {d.source ? SOURCE_NOTE[d.source] : `No ${unit} dispensed here yet.`} Days are counted in East Africa time.
          </Typography>
        </Box>

        <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "repeat(2, minmax(0,1fr))", md: "repeat(5, 1fr)" } }}>
          {periods.map(([label, value]) => (
            <Box key={label} sx={{ p: 1.5, borderRadius: 2, bgcolor: (t) => alpha(t.palette.primary.main, 0.06) }}>
              <Typography variant="caption" color="text.secondary" fontWeight={700}>
                {label}
              </Typography>
              <Typography variant="h5" fontWeight={900}>
                {fmt(value)}
              </Typography>
            </Box>
          ))}
        </Box>

        {d.notInStock > 0 ? (
          <Typography variant="body2" color="warning.main">
            {fmt(d.notInStock)} of these {unit} were reported but were not in this facility&apos;s stock in Anchor; they are taken off when stock arrives.
          </Typography>
        ) : null}

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ xs: "stretch", sm: "center" }}>
          <Typography variant="body2" fontWeight={800} sx={{ minWidth: 130 }}>
            Any period
          </Typography>
          <TextField size="small" type="date" label="From" value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} InputLabelProps={{ shrink: true }} />
          <TextField size="small" type="date" label="To" value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} InputLabelProps={{ shrink: true }} />
          <Button variant="outlined" disabled={!draft.from && !draft.to} onClick={() => setRange(draft)}>
            Show total
          </Button>
          {d.range ? (
            <Typography variant="body1">
              <b>{fmt(d.range.sachets)}</b> {unit}
              {d.range.from ? ` from ${dayjs(d.range.from).format("D MMM YYYY")}` : ""}
              {d.range.to ? ` to ${dayjs(d.range.to).format("D MMM YYYY")}` : ""}
            </Typography>
          ) : null}
        </Stack>

        <Box>
          <Typography variant="body2" fontWeight={800} sx={{ mb: 1 }}>
            Day by day, last {days} days
          </Typography>
          <Box sx={{ display: "flex", alignItems: "flex-end", gap: "3px", height: 90, borderBottom: 1, borderColor: "divider" }}>
            {(d.byDay || []).map((x) => (
              <Tooltip key={x.day} title={`${shortDay(x.day)}: ${fmt(x.sachets)} ${unit}`} arrow>
                <Box
                  sx={{
                    flex: 1,
                    minWidth: 3,
                    height: x.sachets ? `${Math.max(6, (x.sachets / max) * 100)}%` : "2px",
                    bgcolor: x.sachets ? "primary.main" : "divider",
                    borderRadius: "3px 3px 0 0",
                  }}
                />
              </Tooltip>
            ))}
          </Box>
          {recentDays.length ? (
            <TableContainer sx={{ maxHeight: 240, mt: 1.5 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Day</TableCell>
                    <TableCell align="right">{units} dispensed</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {recentDays.map((x) => (
                    <TableRow key={x.day} hover>
                      <TableCell>{shortDay(x.day)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800 }}>
                        {fmt(x.sachets)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Nothing dispensed in the last {days} days.
            </Typography>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}

export default function FacilityStore() {
  const { me } = useOutletContext() || {};
  // Super Admin: list one country's facilities at a time (default their own).
  const scope = useCountryScope(me);
  const scopeImpl = scope.implementationId;
  const scopeReady = scope.ready;
  const [facilities, setFacilities] = useState([]);
  const [facilitiesLoaded, setFacilitiesLoaded] = useState(false);
  const [facilityId, setFacilityId] = useState("");
  // Store data tagged with the facility it belongs to, so switching facility
  // shows "loading" until that facility's data arrives.
  const [store, setStore] = useState({ key: null, data: null });
  // Optional date range for the dispensed total (yyyy-mm-dd).
  const [range, setRange] = useState({ from: "", to: "" });
  const storeKey = `${facilityId}|${range.from}|${range.to}`;
  const [err, setErr] = useState("");

  // settings (can be made UI controls later)
  const days = 30;
  const expiryWarnDays = 60;
  const stockoutThresholdDays = 14;

  // Load facilities (for a Super Admin, those of the chosen country)
  useEffect(() => {
    if (!scopeReady) return;
    api
      .get("/api/facilities", { params: scopeImpl ? { implementationId: scopeImpl } : {} })
      .then((res) => {
        const rows = (res.data || []).filter((f) => f.type === "FACILITY");
        rows.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        setFacilities(rows);
        setFacilitiesLoaded(true);
        setFacilityId((current) => (rows.some((f) => f.id === current) ? current : rows[0]?.id || ""));
      })
      .catch((e) => setErr(e?.response?.data?.message || e.message));
  }, [scopeImpl, scopeReady]);

  // Load facility store data
  useEffect(() => {
    if (!facilityId) return;

    const key = `${facilityId}|${range.from}|${range.to}`;
    api
      .get(`/api/dashboard/facilities/${facilityId}/store`, {
        params: { days, expiryWarnDays, stockoutThresholdDays, ...(range.from ? { from: range.from } : {}), ...(range.to ? { to: range.to } : {}) },
      })
      .then((res) => {
        setErr("");
        setStore({ key, data: res.data });
      })
      .catch((e) => setErr(e?.response?.data?.message || e.message));
  }, [facilityId, range]);

  // Keep the figures on screen while only the date range changes.
  const sameFacility = String(store.key || "").split("|")[0] === facilityId;
  const data = store.key === storeKey || sameFacility ? store.data : null;
  // Base unit of the products in scope (e.g. "Sachets"), from the API.
  const units = data?.unit?.plural || "Sachets";

  const riskCount = useMemo(() => {
    if (!data) return 0;
    return (data.stockoutRisk || []).length;
  }, [data]);

  if (err) return <Typography color="error">Error: {err}</Typography>;
  if (!facilitiesLoaded) return <Typography>Loading facilities...</Typography>;
  if (!facilities.length) {
    return <Typography color="text.secondary">No facilities are available in your scope, so there is no facility store to show.</Typography>;
  }
  if (!facilityId) return <Typography>Loading facilities...</Typography>;
  if (!data) return <Typography>Loading facility store...</Typography>;

  return (
    <Box sx={{ display: "grid", gap: 2.5 }}>
      {/* Header + Facility selector */}
      <Card sx={{ overflow: "hidden" }}>
        <CardContent>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            alignItems={{ xs: "stretch", sm: "center" }}
            justifyContent="space-between"
          >
            <Box>
              <Typography variant="h6" fontWeight={900}>
                Facility Store
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Window: last {days} days • Expiry warning: {expiryWarnDays} days • Stockout threshold: {stockoutThresholdDays} days
              </Typography>
            </Box>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <CountryScopeSelect scope={scope} />
            <FormControl size="small" sx={{ minWidth: { xs: "100%", sm: 360 } }}>
              <InputLabel>Select Facility</InputLabel>
              <Select
                label="Select Facility"
                value={facilityId}
                onChange={(e) => {
                  setRange({ from: "", to: "" });
                  setFacilityId(e.target.value);
                }}
              >
                {facilities.map((f) => (
                  <MenuItem key={f.id} value={f.id}>
                    {f.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {/* KPI Tiles — CSS Grid */}
      <Box
        sx={{
          display: "grid",
          gap: { xs: 1.5, sm: 2 },
          gridTemplateColumns: {
            xs: "repeat(2, minmax(0, 1fr))",
            md: "repeat(4, 1fr)",
          },
        }}
      >
        <Kpi title="Boxes on Hand" value={data.kpis.boxesOnHand} />
        <Kpi title={`${units} Remaining`} value={data.kpis.sachetsRemaining} />
        <Kpi title={`${units} Dispensed (all time)`} value={data.kpis.sachetsDispensed || 0} />
        <Kpi title="Products at Stockout Risk" value={riskCount} />
      </Box>

      <DispensedCard key={facilityId} dispensed={data.dispensed} units={units} days={days} range={range} setRange={setRange} />

      {/* By product table */}
      <Card sx={{ overflow: "hidden" }}>
        <CardContent>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
            <Typography variant="h6" fontWeight={900}>
              Stock Status by Product
            </Typography>
            <Chip
              size="small"
              label={`${data.byProduct.length} product(s)`}
              sx={{ bgcolor: alpha("#005fb6", 0.08), fontWeight: 900 }}
            />
          </Stack>

          <Divider sx={{ mb: 2 }} />

          <TableContainer sx={{ maxHeight: 520 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Product</TableCell>
                  <TableCell align="right">Boxes</TableCell>
                  <TableCell align="right">On Hand ({units})</TableCell>
                  <TableCell align="right">Avg/Day</TableCell>
                  <TableCell align="right">Days of Stock</TableCell>
                  <TableCell>Risk</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.byProduct.map((r) => (
                  <TableRow key={r.product?.id} hover>
                    <TableCell sx={{ fontWeight: 800 }}>{r.product?.name}</TableCell>
                    <TableCell align="right">{fmt(r.boxesOnHand)}</TableCell>
                    <TableCell align="right">{fmt(r.onHandSachets)}</TableCell>
                    <TableCell align="right">{r.avgDailyDispense}</TableCell>
                    <TableCell align="right">
                      {r.daysOfStock === null ? (
                        <Chip size="small" label="N/A" />
                      ) : (
                        <Chip
                          size="small"
                          label={r.daysOfStock}
                          color={
                            r.daysOfStock <= 7
                              ? "error"
                              : r.daysOfStock <= stockoutThresholdDays
                              ? "warning"
                              : "success"
                          }
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      {r.isAtRisk ? (
                        <Chip size="small" color="warning" label="At Risk" />
                      ) : (
                        <Chip size="small" label="OK" />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {data.byProduct.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6}>No stock found for this facility.</TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Expiring soon */}
      <Card sx={{ overflow: "hidden" }}>
        <CardContent>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
            <Typography variant="h6" fontWeight={900}>
              Expiring Soon (≤ {expiryWarnDays} days)
            </Typography>
            <Chip
              size="small"
              label={`${data.expiringSoon.length} box(es)`}
              sx={{ bgcolor: alpha("#52ae32", 0.10), fontWeight: 900 }}
            />
          </Stack>

          <Divider sx={{ mb: 2 }} />

          <TableContainer sx={{ maxHeight: 520 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Box UID</TableCell>
                  <TableCell>Product</TableCell>
                  <TableCell>Batch</TableCell>
                  <TableCell>Expiry</TableCell>
                  <TableCell align="right">{units} Remaining</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.expiringSoon.map((b) => (
                  <TableRow key={b.id} hover>
                    <TableCell sx={{ fontWeight: 800 }}>{b.boxUid}</TableCell>
                    <TableCell>{b.product?.name}</TableCell>
                    <TableCell>{b.batchNo || "-"}</TableCell>
                    <TableCell>{b.expiryDate ? dayjs(b.expiryDate).format("DD-MMM-YYYY") : "-"}</TableCell>
                    <TableCell align="right">{fmt(b.sachetsRemaining)}</TableCell>
                  </TableRow>
                ))}
                {data.expiringSoon.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5}>No boxes expiring within the warning window.</TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  );
}