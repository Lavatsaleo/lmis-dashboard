import React, { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import dayjs from "dayjs";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";

import { api } from "../api/client";
import { CountryScopeSelect } from "../components/CountryScope";
import { useCountryScope } from "../components/useCountryScope";

const DAYS = 30; // consumption window
const EXPIRY_WARN_DAYS = 60;
const LOW_STOCK_DAYS = 14;
const LAST_FACILITY_KEY = "anchor.facilityStore.last";

const fmt = (n) => new Intl.NumberFormat().format(Math.round(Number(n || 0)));
const shortDay = (d) => dayjs(d).format("ddd D MMM");
const longDay = (d) => dayjs(d).format("D MMM YYYY");

/** "about 3 months" from a number of days. */
function howLong(days) {
  if (days === null || days === undefined || !Number.isFinite(days)) return null;
  if (days < 1) return "less than a day";
  if (days < 14) return `${Math.round(days)} day${Math.round(days) === 1 ? "" : "s"}`;
  if (days < 60) return `about ${Math.round(days / 7)} weeks`;
  if (days < 730) return `about ${Math.round(days / 30)} months`;
  return "more than 2 years";
}

const readLast = () => {
  try {
    return window.localStorage.getItem(LAST_FACILITY_KEY) || "";
  } catch {
    return "";
  }
};
const saveLast = (id) => {
  try {
    window.localStorage.setItem(LAST_FACILITY_KEY, id);
  } catch {
    // not remembered
  }
};

// Stock status of one product at the facility, in plain words.
function productStatus(p) {
  if (p.onHandSachets === 0) return { tone: "error", label: "Out of stock" };
  if (p.daysOfStock === null || p.avgDailyDispense === 0) return { tone: "default", label: "Not dispensing" };
  if (p.daysOfStock <= LOW_STOCK_DAYS) return { tone: "warning", label: "Running low" };
  return { tone: "success", label: "Enough stock" };
}

function Kpi({ title, value, note, tone }) {
  return (
    <Card sx={{ height: "100%" }}>
      <CardContent sx={{ height: "100%", display: "flex", flexDirection: "column", gap: 0.5 }}>
        <Typography variant="body2" color="text.secondary" fontWeight={700}>
          {title}
        </Typography>
        <Typography variant="h4" fontWeight={900} sx={{ lineHeight: 1.15, fontSize: { xs: "1.6rem", sm: "2.125rem" }, color: tone ? `${tone}.main` : undefined }}>
          {value}
        </Typography>
        {note ? (
          <Typography variant="caption" color="text.secondary">
            {note}
          </Typography>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** One or two sentences per product: what is there and how long it lasts. */
function Summary({ data, units }) {
  const unit = units.toLowerCase();
  const name = data.facility?.name || "This facility";
  const incoming = data.deliveries?.incoming || [];
  const incomingBoxes = incoming.reduce((n, s) => n + s.boxes, 0);
  const products = data.byProduct || [];
  const worst = products.reduce((w, p) => {
    const rank = { error: 3, warning: 2, success: 1, default: 0 };
    const s = productStatus(p);
    return !w || rank[s.tone] > rank[w.tone] ? s : w;
  }, null);
  const tone = worst?.tone === "default" || !worst ? "info" : worst.tone;

  return (
    <Alert severity={tone} icon={<StorefrontOutlinedIcon />} sx={{ "& .MuiAlert-message": { width: "100%" } }}>
      <Stack spacing={0.75}>
        {!products.length ? (
          <Typography>
            <b>{name}</b> has no stock in Anchor yet and has not dispensed anything. Stock appears here once a delivery is received.
          </Typography>
        ) : (
          products.map((p) => {
            const product = p.product?.name || "this product";
            if (p.onHandSachets === 0) {
              return (
                <Typography key={p.product?.id}>
                  <b>{name} has no {product} left.</b> It was dispensing about {fmt(p.avgDailyDispense)} {unit} a day.
                </Typography>
              );
            }
            const lasts = p.avgDailyDispense > 0 ? howLong(p.daysOfStock) : null;
            return (
              <Typography key={p.product?.id}>
                <b>
                  {name} has {fmt(p.onHandSachets)} {unit} of {product}
                </b>{" "}
                ({fmt(p.boxesOnHand)} carton{p.boxesOnHand === 1 ? "" : "s"}).{" "}
                {lasts ? (
                  <>
                    At the recent rate of about {fmt(Math.max(1, p.avgDailyDispense))} a day, that lasts <b>{lasts}</b>.
                  </>
                ) : (
                  <>Nothing was dispensed in the last {DAYS} days, so there is no rate to estimate how long it lasts.</>
                )}
              </Typography>
            );
          })
        )}
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
          {data.nextExpiry ? <Chip size="small" variant="outlined" label={`Next expiry ${longDay(data.nextExpiry)}`} /> : null}
          {incoming.length ? (
            <Chip size="small" color="info" label={`${incoming.length} deliver${incoming.length === 1 ? "y" : "ies"} on the way · ${fmt(incomingBoxes)} cartons`} />
          ) : null}
          {data.deliveries?.received?.[0] ? (
            <Chip size="small" variant="outlined" label={`Last delivery received ${longDay(data.deliveries.received[0].receivedAt)}`} />
          ) : null}
        </Stack>
      </Stack>
    </Alert>
  );
}

const SOURCE_NOTE = {
  CLINICAL: "From clinical visits recorded in Anchor.",
  DHIS2: "As reported at visits in DHIS2 (synced to Anchor).",
  BOTH: "From clinical visits in Anchor and visits reported in DHIS2.",
};

/** How much this facility has dispensed: fixed periods, any date range, and day by day. */
function DispensedCard({ dispensed, units, range, setRange }) {
  const [draft, setDraft] = useState(range);
  const d = dispensed || {};
  const unit = units.toLowerCase();
  const max = Math.max(1, ...(d.byDay || []).map((x) => x.sachets));
  const recentDays = [...(d.byDay || [])].filter((x) => x.sachets > 0).reverse();
  const periods = [
    ["Today", d.today],
    ["Yesterday", d.yesterday],
    ["Last 7 days", d.last7Days],
    [`Last ${DAYS} days`, d.lastWindow],
    [d.firstDay ? `Since ${longDay(d.firstDay)}` : "All time", d.allTime],
  ];
  return (
    <Card>
      <CardContent sx={{ display: "grid", gap: 2, gridTemplateColumns: "minmax(0, 1fr)" }}>
        <Box>
          <Typography variant="h6" fontWeight={900}>
            {units} dispensed
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
            {fmt(d.notInStock)} of these {unit} were reported but were not in this facility&apos;s stock in Anchor; they come off when stock arrives.
          </Typography>
        ) : null}

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ xs: "stretch", sm: "center" }} useFlexGap flexWrap="wrap">
          <Typography variant="body2" fontWeight={800}>
            Check a period:
          </Typography>
          <TextField size="small" type="date" label="From" value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} InputLabelProps={{ shrink: true }} />
          <TextField size="small" type="date" label="To" value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} InputLabelProps={{ shrink: true }} />
          <Button variant="outlined" disabled={!draft.from && !draft.to} onClick={() => setRange(draft)}>
            Show total
          </Button>
          {d.range ? (
            <Typography variant="body1">
              <b>
                {fmt(d.range.sachets)} {unit}
              </b>
              {d.range.from ? ` from ${longDay(d.range.from)}` : ""}
              {d.range.to ? ` to ${longDay(d.range.to)}` : ""}
            </Typography>
          ) : null}
        </Stack>

        <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(0, 2fr) minmax(0, 1fr)" } }}>
          <Box>
            <Typography variant="body2" fontWeight={800} sx={{ mb: 1 }}>
              Day by day, last {DAYS} days
            </Typography>
            <Box sx={{ display: "flex", alignItems: "flex-end", gap: "3px", height: 110, borderBottom: 1, borderColor: "divider" }}>
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
            <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.5 }}>
              <Typography variant="caption" color="text.secondary">
                {d.byDay?.[0] ? shortDay(d.byDay[0].day) : ""}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Today
              </Typography>
            </Stack>
          </Box>
          <Box>
            <Typography variant="body2" fontWeight={800} sx={{ mb: 1 }}>
              Days with dispensing
            </Typography>
            {recentDays.length ? (
              <TableContainer sx={{ maxHeight: 200 }}>
                <Table size="small" sx={{ tableLayout: "fixed", width: "100%", "&&": { minWidth: 0 } }}>
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
              <Typography variant="body2" color="text.secondary">
                Nothing dispensed in the last {DAYS} days.
              </Typography>
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

/** Batches on the shelf, earliest expiry first. */
function ShelfCard({ data, units }) {
  const batches = data.batches || [];
  return (
    <Card sx={{ height: "100%" }}>
      <CardContent sx={{ display: "grid", gap: 1.5, gridTemplateColumns: "minmax(0, 1fr)" }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Inventory2OutlinedIcon color="primary" />
          <Typography variant="h6" fontWeight={900}>
            On the shelf
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary">
          By batch, earliest expiry first. Use the top row first.
        </Typography>
        {batches.length ? (
          <TableContainer>
            <Table size="small" sx={{ tableLayout: "fixed", width: "100%", "&&": { minWidth: 0 }, "& td, & th": { px: { xs: 1, sm: 2 } } }}>
              <TableHead>
                <TableRow>
                  <TableCell>Batch</TableCell>
                  <TableCell>Expires</TableCell>
                  <TableCell align="right">In store</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {batches.map((b) => {
                  const daysLeft = dayjs(b.expiryDate).diff(dayjs(), "day");
                  return (
                    <TableRow key={`${b.product?.id}-${b.batchNo}-${b.expiryDate}`}>
                      <TableCell>
                        <Typography variant="body2" fontWeight={800}>
                          {b.product?.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Batch {b.batchNo}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{longDay(b.expiryDate)}</Typography>
                        {daysLeft < 0 ? (
                          <Chip size="small" color="error" label="Expired" />
                        ) : daysLeft <= EXPIRY_WARN_DAYS ? (
                          <Chip size="small" color="warning" label={`In ${daysLeft} days`} />
                        ) : (
                          <Typography variant="caption" color="text.secondary">
                            in {howLong(daysLeft)}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight={800}>
                          {fmt(b.sachets)} {units.toLowerCase()}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {fmt(b.boxes)} carton{b.boxes === 1 ? "" : "s"}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Typography variant="body2" color="text.secondary">
            Nothing in store.
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

/** Deliveries on the way and recently received. */
function DeliveriesCard({ data }) {
  const incoming = data.deliveries?.incoming || [];
  const received = data.deliveries?.received || [];
  const Row = ({ s, kind }) => (
    <Box sx={{ py: 1, borderTop: 1, borderColor: "divider" }}>
      <Stack direction="row" justifyContent="space-between" spacing={1}>
        <Typography variant="body2" fontWeight={800}>
          {fmt(s.boxes)} carton{s.boxes === 1 ? "" : "s"} from {s.from || "the warehouse"}
        </Typography>
        {kind === "incoming" ? <Chip size="small" color="info" label="On the way" /> : <Chip size="small" color="success" variant="outlined" label="Received" />}
      </Stack>
      <Typography variant="caption" color="text.secondary">
        Waybill {s.manifestNo} · sent {longDay(s.dispatchedAt)}
        {kind === "received" && s.receivedAt ? ` · received ${longDay(s.receivedAt)}` : ""}
      </Typography>
    </Box>
  );
  return (
    <Card sx={{ height: "100%" }}>
      <CardContent sx={{ display: "grid", gap: 1, gridTemplateColumns: "minmax(0, 1fr)" }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <LocalShippingOutlinedIcon color="primary" />
          <Typography variant="h6" fontWeight={900}>
            Deliveries
          </Typography>
        </Stack>
        {incoming.map((s) => (
          <Row key={s.id} s={s} kind="incoming" />
        ))}
        {received.map((s) => (
          <Row key={s.id} s={s} kind="received" />
        ))}
        {!incoming.length && !received.length ? (
          <Typography variant="body2" color="text.secondary">
            No deliveries recorded for this facility yet.
          </Typography>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function FacilityStore() {
  const { me } = useOutletContext() || {};
  // Super Admin: one country at a time (default their own). Everyone else only
  // ever gets the facilities of their own scope from the server.
  const scope = useCountryScope(me);
  const scopeImpl = scope.implementationId;
  const scopeReady = scope.ready;

  const [list, setList] = useState({ key: null, rows: [] });
  const [chosenId, setChosenId] = useState(readLast);
  const [range, setRange] = useState({ from: "", to: "" });
  const [store, setStore] = useState({ key: null, data: null });
  const [err, setErr] = useState("");

  // Facilities for the picker
  useEffect(() => {
    if (!scopeReady) return undefined;
    let alive = true;
    api
      .get("/api/dashboard/facility-list", { params: scopeImpl ? { implementationId: scopeImpl } : {} })
      .then((res) => alive && setList({ key: scopeImpl || "ALL", rows: res.data?.rows || [] }))
      .catch((e) => alive && setErr(e?.response?.data?.message || e.message));
    return () => {
      alive = false;
    };
  }, [scopeImpl, scopeReady]);

  const listLoaded = list.key === (scopeImpl || "ALL");
  const facilities = list.rows;
  // The remembered facility if it is in this list, else the first with stock.
  const facility =
    facilities.find((f) => f.id === chosenId) || facilities.find((f) => f.boxesOnHand > 0) || facilities[0] || null;
  const facilityId = facility?.id || "";
  const storeKey = `${facilityId}|${range.from}|${range.to}`;

  useEffect(() => {
    if (!facilityId) return undefined;
    let alive = true;
    const key = `${facilityId}|${range.from}|${range.to}`;
    api
      .get(`/api/dashboard/facilities/${facilityId}/store`, {
        params: {
          days: DAYS,
          expiryWarnDays: EXPIRY_WARN_DAYS,
          stockoutThresholdDays: LOW_STOCK_DAYS,
          ...(range.from ? { from: range.from } : {}),
          ...(range.to ? { to: range.to } : {}),
        },
      })
      .then((res) => {
        if (!alive) return;
        setErr("");
        setStore({ key, data: res.data });
      })
      .catch((e) => alive && setErr(e?.response?.data?.message || e.message));
    return () => {
      alive = false;
    };
  }, [facilityId, range]);

  // Keep the figures on screen while only the date range changes.
  const sameFacility = String(store.key || "").split("|")[0] === facilityId;
  const data = store.key === storeKey || sameFacility ? store.data : null;
  const units = data?.unit?.plural || "Sachets";

  const totals = useMemo(() => {
    const rows = data?.byProduct || [];
    const rate = rows.reduce((n, r) => n + (r.avgDailyDispense || 0), 0);
    const onHand = data?.kpis?.sachetsRemaining || 0;
    return { rate, lasts: rate > 0 ? onHand / rate : null };
  }, [data]);

  const choose = (f) => {
    if (!f) return;
    setRange({ from: "", to: "" });
    setChosenId(f.id);
    saveLast(f.id);
  };

  const header = (
    <Card>
      <CardContent>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ xs: "stretch", md: "center" }} justifyContent="space-between">
          <Box>
            <Typography variant="h5" fontWeight={900}>
              Facility store
            </Typography>
            {facility ? (
              <Typography variant="body2" color="text.secondary">
                {[facility.code, facility.county, facility.suppliedBy ? `supplied by ${facility.suppliedBy}` : null, facility.country].filter(Boolean).join(" · ")}
              </Typography>
            ) : (
              <Typography variant="body2" color="text.secondary">
                What a facility holds, how long it will last, and what it has dispensed.
              </Typography>
            )}
          </Box>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <CountryScopeSelect scope={scope} />
            <Autocomplete
              size="small"
              sx={{ minWidth: { xs: "100%", sm: 380 } }}
              options={facilities}
              value={facility}
              onChange={(_, v) => choose(v)}
              groupBy={(o) => o.suppliedBy || "Other"}
              getOptionLabel={(o) => o?.name || ""}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              filterOptions={(opts, { inputValue }) => {
                const q = inputValue.trim().toLowerCase();
                if (!q) return opts;
                return opts.filter((o) => [o.name, o.code, o.county, o.suppliedBy].some((v) => String(v || "").toLowerCase().includes(q)));
              }}
              renderOption={(props, o) => {
                const { key, ...rest } = props;
                return (
                  <li key={key} {...rest}>
                    <Stack direction="row" justifyContent="space-between" sx={{ width: "100%" }} spacing={1}>
                      <Box>
                        <Typography variant="body2" fontWeight={700}>
                          {o.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {[o.code, o.county].filter(Boolean).join(" · ")}
                        </Typography>
                      </Box>
                      <Typography variant="caption" color={o.sachetsOnHand ? "text.primary" : "text.disabled"} sx={{ whiteSpace: "nowrap", alignSelf: "center" }}>
                        {o.sachetsOnHand ? `${fmt(o.sachetsOnHand)} ${units.toLowerCase()}` : "no stock"}
                      </Typography>
                    </Stack>
                  </li>
                );
              }}
              renderInput={(params) => <TextField {...params} label={`Facility (${facilities.length})`} placeholder="Type a name, code or county" />}
              noOptionsText="No facility matches"
            />
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );

  if (err) {
    return (
      <Box sx={{ display: "grid", gap: 2.5 }}>
        {header}
        <Alert severity="error">{err}</Alert>
      </Box>
    );
  }
  if (!listLoaded) return <Box sx={{ display: "grid", gap: 2.5 }}>{header}<Typography>Loading facilities…</Typography></Box>;
  if (!facilities.length) {
    return (
      <Box sx={{ display: "grid", gap: 2.5 }}>
        {header}
        <Typography color="text.secondary">There are no facilities in your scope, so there is no facility store to show.</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: "grid", gap: 2.5 }}>
      {header}
      {!data ? (
        <Typography>Loading {facility?.name}…</Typography>
      ) : (
        <>
          <Summary data={data} units={units} />

          <Box sx={{ display: "grid", gap: { xs: 1.5, sm: 2 }, gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(4, 1fr)" } }}>
            <Kpi title="In store now" value={fmt(data.kpis.sachetsRemaining)} note={`${units.toLowerCase()} in ${fmt(data.kpis.boxesOnHand)} carton${data.kpis.boxesOnHand === 1 ? "" : "s"}`} />
            <Kpi
              title="Lasts about"
              value={data.kpis.sachetsRemaining === 0 ? "Out" : (howLong(totals.lasts) || "—").replace(/^about /, "")}
              tone={data.kpis.sachetsRemaining === 0 ? "error" : totals.lasts !== null && totals.lasts <= LOW_STOCK_DAYS ? "warning" : undefined}
              note={totals.rate > 0 ? `at about ${fmt(Math.max(1, totals.rate))} ${units.toLowerCase()} a day` : `no dispensing in the last ${DAYS} days`}
            />
            <Kpi title={`Dispensed, last ${DAYS} days`} value={fmt(data.dispensed?.lastWindow)} note={`${fmt(data.dispensed?.today)} today · ${fmt(data.dispensed?.yesterday)} yesterday`} />
            <Kpi
              title="Dispensed in total"
              value={fmt(data.dispensed?.allTime)}
              note={data.dispensed?.firstDay ? `since ${longDay(data.dispensed.firstDay)}` : "nothing recorded yet"}
            />
          </Box>

          <DispensedCard key={facilityId} dispensed={data.dispensed} units={units} range={range} setRange={setRange} />

          <Box sx={{ display: "grid", gap: 2.5, gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "minmax(0, 3fr) minmax(0, 2fr)" } }}>
            <ShelfCard data={data} units={units} />
            <DeliveriesCard data={data} />
          </Box>

          {(data.byProduct || []).length > 1 ? (
            <Card>
              <CardContent>
                <Typography variant="h6" fontWeight={900} sx={{ mb: 1 }}>
                  By product
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Product</TableCell>
                        <TableCell align="right">In store</TableCell>
                        <TableCell align="right">Per day</TableCell>
                        <TableCell>Lasts</TableCell>
                        <TableCell>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {data.byProduct.map((p) => {
                        const st = productStatus(p);
                        return (
                          <TableRow key={p.product?.id}>
                            <TableCell sx={{ fontWeight: 800 }}>{p.product?.name}</TableCell>
                            <TableCell align="right">{fmt(p.onHandSachets)}</TableCell>
                            <TableCell align="right">{p.avgDailyDispense ? fmt(Math.max(1, p.avgDailyDispense)) : "—"}</TableCell>
                            <TableCell>{p.onHandSachets === 0 ? "—" : howLong(p.avgDailyDispense > 0 ? p.daysOfStock : null) || "—"}</TableCell>
                            <TableCell>
                              <Chip size="small" color={st.tone === "default" ? undefined : st.tone} label={st.label} />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          ) : null}
        </>
      )}
    </Box>
  );
}
