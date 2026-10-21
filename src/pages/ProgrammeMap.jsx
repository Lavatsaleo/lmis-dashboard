import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import dayjs from "dayjs";
import { CircleMarker, GeoJSON, MapContainer, Marker, Pane, TileLayer, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  FormControl,
  FormControlLabel,
  GlobalStyles,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import CenterFocusStrongOutlinedIcon from "@mui/icons-material/CenterFocusStrongOutlined";
import ChildCareIcon from "@mui/icons-material/ChildCare";

import { api } from "../api/client";
import { CountryScopeSelect } from "../components/CountryScope";
import { useCountryScope } from "../components/useCountryScope";

// --------------------------------------------------------------------------
// Measures, colours and helpers
// --------------------------------------------------------------------------
const SSD_BOUNDS = [
  [3.4, 23.4],
  [12.3, 36.0],
];
const TEAL = ["#E3F4F7", "#B7E3EB", "#7FCBDA", "#3EAFC6", "#0098B4", "#007189", "#004B5C"];
const GOOD = "#1B7F4B";
const WARN = "#D99A00";
const BAD = "#C0392B";
const NONE = "#B8C2C8";

const MEASURES = {
  admissions: { label: "New admissions", kind: "count", help: "Children admitted in the period" },
  inTreatment: { label: "In treatment now", kind: "count", help: "Children currently enrolled and not discharged" },
  missed: { label: "Missed appointments", kind: "count", help: "In treatment, next visit date already passed" },
  given: { label: "Commodity given", kind: "count", help: "Amount given in the period (choose the commodity)" },
  cureRate: { label: "Cure rate", kind: "rate", good: (v) => v >= 75, bad: (v) => v < 50, target: "≥ 75%", help: "Discharged as cured ÷ all discharges × 100, in the period" },
  defaultRate: { label: "Default rate", kind: "rate", good: (v) => v < 15, bad: (v) => v >= 25, target: "< 15%", help: "Discharged as defaulter ÷ all discharges × 100, in the period" },
  deathRate: { label: "Death rate", kind: "rate", good: (v) => v < 3, bad: (v) => v >= 10, target: "< 10%", help: "Discharged as died ÷ all discharges × 100, in the period" },
};
const PERIODS = [
  ["30d", "Last 30 days", () => [dayjs().subtract(29, "day"), dayjs()]],
  ["3m", "Last 3 months", () => [dayjs().subtract(3, "month").add(1, "day"), dayjs()]],
  ["12m", "Last 12 months", () => [dayjs().subtract(12, "month").add(1, "day"), dayjs()]],
  ["ytd", "This year", () => [dayjs().startOf("year"), dayjs()]],
  ["all", "All time", () => [null, null]],
  ["custom", "Custom", null],
];

const fmt = (n, d = 0) => (n === null || n === undefined || Number.isNaN(n) ? "—" : Number(n).toLocaleString(undefined, { maximumFractionDigits: d }));
const pct = (n) => (n === null || n === undefined ? "—" : `${n.toFixed(n < 10 ? 1 : 0)}%`);
const countyKey = (s) => String(s || "").toLowerCase().replace(/county/g, "").replace(/gograil/g, "gogrial").replace(/[^a-z]/g, "");

/** Add up one site's program figures (only the selected programs are sent). */
function totalsOf(list) {
  const t = { admissions: 0, inTreatment: 0, missed: 0, cured: 0, died: 0, defaulted: 0, nonResponse: 0, otherExits: 0 };
  for (const p of list) for (const k of Object.keys(t)) t[k] += p[k] || 0;
  // Rates use every discharge in the period as the denominator.
  const exits = t.cured + t.died + t.defaulted + t.nonResponse + t.otherExits;
  return {
    ...t,
    exits,
    cureRate: exits ? (t.cured / exits) * 100 : null,
    defaultRate: exits ? (t.defaulted / exits) * 100 : null,
    deathRate: exits ? (t.died / exits) * 100 : null,
  };
}
const givenSum = (given, commodity) => given.filter((g) => `${g.commodity}|${g.unit}` === commodity).reduce((n, g) => n + g.amount, 0);
function valueOf(t, measure, given, commodity) {
  if (measure === "given") return givenSum(given, commodity);
  return t[measure];
}
function rateColor(measure, v) {
  const m = MEASURES[measure];
  if (v === null || v === undefined) return NONE;
  return m.good(v) ? GOOD : m.bad(v) ? BAD : WARN;
}
function scaleColor(v, max) {
  if (!v || !max) return null;
  const i = Math.min(TEAL.length - 1, Math.max(1, Math.ceil((Math.sqrt(v) / Math.sqrt(max)) * (TEAL.length - 1))));
  return TEAL[i];
}

// --------------------------------------------------------------------------
// Map pieces
// --------------------------------------------------------------------------
// Fit the view to `bounds` when what is shown changes (not on every render, so
// it never fights the user's own panning), and once the map box gets its size.
function FitTo({ bounds, boundsKey, token }) {
  const map = useMap();
  const latest = React.useRef(bounds);
  // Keep the latest bounds for the resize observer (effects run in order, so this is current below).
  useEffect(() => {
    latest.current = bounds;
  });
  useEffect(() => {
    if (!latest.current) return;
    map.invalidateSize();
    map.fitBounds(latest.current, { padding: [24, 24], maxZoom: 9 });
  }, [map, boundsKey, token]);
  useEffect(() => {
    const el = map.getContainer();
    let fitted = false;
    const ro = new ResizeObserver(() => {
      map.invalidateSize();
      if (!fitted && el.clientWidth > 0 && latest.current) {
        fitted = true;
        map.fitBounds(latest.current, { padding: [24, 24], maxZoom: 9 });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [map]);
  return null;
}

function Legend({ measure, max, commodityLabel }) {
  const m = MEASURES[measure];
  return (
    <Box
      sx={{
        position: "absolute",
        left: 12,
        bottom: { xs: 52, md: 30 },
        zIndex: 500,
        bgcolor: "rgba(255,255,255,0.94)",
        borderRadius: 2,
        boxShadow: "0 2px 10px rgba(0,0,0,0.12)",
        px: 1.5,
        py: 1.25,
        minWidth: { xs: 160, md: 190 },
        maxWidth: { xs: 200, md: 260 },
        pointerEvents: "none",
      }}
    >
      <Typography variant="caption" fontWeight={800} component="div">
        {measure === "given" ? commodityLabel : m.label}
      </Typography>
      {m.kind === "rate" ? (
        <Stack spacing={0.4} sx={{ mt: 0.5 }}>
          {[
            [GOOD, `On target (${m.target})`],
            [WARN, "Below target"],
            [BAD, "Needs attention"],
            [NONE, "No discharges yet"],
          ].map(([c, l]) => (
            <Stack key={l} direction="row" spacing={1} alignItems="center">
              <Box sx={{ width: 12, height: 12, borderRadius: "50%", bgcolor: c }} />
              <Typography variant="caption">{l}</Typography>
            </Stack>
          ))}
        </Stack>
      ) : (
        <>
          <Box sx={{ display: "flex", height: 10, borderRadius: 1, overflow: "hidden", mt: 0.75 }}>
            {TEAL.slice(1).map((c) => (
              <Box key={c} sx={{ flex: 1, bgcolor: c }} />
            ))}
          </Box>
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="caption">low</Typography>
            <Typography variant="caption">{fmt(max)}</Typography>
          </Stack>
        </>
      )}
      <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.5 }}>
        Bubble size = {m.kind === "rate" ? "children discharged" : "the figure"} · shading = counties
      </Typography>
    </Box>
  );
}

function SiteCard({ site, programs, commodity, onOpen }) {
  const t = totalsOf(Object.values(site.programs));
  const rows = programs.filter((p) => site.programs[p.id]);
  return (
    <Box sx={{ display: "grid", gap: 1.5 }}>
      <Box>
        <Typography variant="h6" fontWeight={900}>
          {site.name}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {[site.payam, site.county, site.state].filter(Boolean).join(" · ")}
        </Typography>
      </Box>
      <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: "repeat(3, 1fr)" }}>
        {[
          ["Admitted", fmt(t.admissions)],
          ["In treatment", fmt(t.inTreatment)],
          ["Missed", fmt(t.missed)],
          ["Cure rate", pct(t.cureRate)],
          ["Default rate", pct(t.defaultRate)],
          ["Death rate", pct(t.deathRate)],
        ].map(([k, v]) => (
          <Box key={k} sx={{ p: 1, borderRadius: 1.5, bgcolor: (th) => alpha(th.palette.primary.main, 0.06) }}>
            <Typography variant="caption" color="text.secondary" fontWeight={700}>
              {k}
            </Typography>
            <Typography variant="subtitle1" fontWeight={900}>
              {v}
            </Typography>
          </Box>
        ))}
      </Box>
      <Table size="small" sx={{ "&&": { minWidth: 0 }, "& th, & td": { px: 0.75, fontSize: 12.5, whiteSpace: "nowrap" }, "& th": { fontSize: 11, letterSpacing: 0.2 } }}>
        <TableHead>
          <TableRow>
            <TableCell>Program</TableCell>
            <TableCell align="right">Admitted</TableCell>
            <TableCell align="right" title="In treatment now">Active</TableCell>
            <TableCell align="right">Cured</TableCell>
            <TableCell align="right">Default</TableCell>
            <TableCell align="right">Died</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((p) => {
            const x = site.programs[p.id];
            return (
              <TableRow key={p.id}>
                <TableCell sx={{ fontWeight: 800 }}>{p.code}</TableCell>
                <TableCell align="right">{fmt(x.admissions)}</TableCell>
                <TableCell align="right">{fmt(x.inTreatment)}</TableCell>
                <TableCell align="right">{fmt(x.cured)}</TableCell>
                <TableCell align="right">{fmt(x.defaulted)}</TableCell>
                <TableCell align="right">{fmt(x.died)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {site.given.length ? (
        <Box>
          <Typography variant="caption" color="text.secondary" fontWeight={700}>
            Given in the period
          </Typography>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 0.5 }}>
            {Object.values(
              site.given.reduce((acc, g) => {
                const k = `${g.commodity}|${g.unit}`;
                acc[k] = { ...g, amount: (acc[k]?.amount || 0) + g.amount };
                return acc;
              }, {})
            ).map((g) => (
              <Chip key={`${g.commodity}${g.unit}`} size="small" color={`${g.commodity}|${g.unit}` === commodity ? "primary" : "default"} label={`${g.commodity} ${fmt(g.amount, 2)} ${g.unit}`} />
            ))}
          </Stack>
        </Box>
      ) : null}
      <Button variant="outlined" startIcon={<ChildCareIcon />} onClick={onOpen}>
        Open this site&apos;s children
      </Button>
    </Box>
  );
}

// --------------------------------------------------------------------------
// Page
// --------------------------------------------------------------------------
export default function ProgrammeMap() {
  const { me } = useOutletContext() || {};
  const navigate = useNavigate();
  const scope = useCountryScope(me);

  // Super Admin: open on a country that has DHIS2 programs (as the Children page).
  const [allPrograms, setAllPrograms] = useState(null);
  const [picked, setPicked] = useState("");
  useEffect(() => {
    if (!scope.isSuperAdmin) return undefined;
    let alive = true;
    api
      .get("/api/dhis2-children/programs")
      .then((r) => alive && setAllPrograms(r.data || []))
      .catch(() => alive && setAllPrograms([]));
    return () => {
      alive = false;
    };
  }, [scope.isSuperAdmin]);
  const ownImpl = me?.platformContext?.implementation?.id || "";
  const withPrograms = [...new Set((allPrograms || []).map((p) => p.implementationId))];
  const country = picked || (withPrograms.includes(ownImpl) ? ownImpl : withPrograms[0] || ownImpl);
  const implId = scope.isSuperAdmin ? country : "";
  const ready = scope.isSuperAdmin ? allPrograms !== null : true;

  const [programIds, setProgramIds] = useState([]);
  const [period, setPeriod] = useState("3m");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const [measure, setMeasure] = useState("admissions");
  const [commodity, setCommodity] = useState("");
  const [showIdle, setShowIdle] = useState(true);
  // Clean vector map by default; OpenStreetMap roads and towns on request.
  const [streets, setStreets] = useState(false);
  const [tab, setTab] = useState(0);
  const [selected, setSelected] = useState(null);
  // County filter, remembered on this device so a county team lands on its own county.
  const [countyFocus, setCountyFocusState] = useState(() => {
    try {
      return localStorage.getItem("anchor.mapCounty") || null;
    } catch {
      return null;
    }
  });
  const setCountyFocus = (k) => {
    setCountyFocusState(k);
    try {
      if (k) localStorage.setItem("anchor.mapCounty", k);
      else localStorage.removeItem("anchor.mapCounty");
    } catch {
      /* storage unavailable */
    }
  };
  const [fitToken, setFitToken] = useState(0);
  const [geo, setGeo] = useState({ states: null, counties: null });
  const [result, setResult] = useState({ key: null, data: null, error: "" });

  // Boundaries (bundled with the dashboard)
  useEffect(() => {
    const base = import.meta.env.BASE_URL || "/";
    Promise.all([fetch(`${base}geo/ssd-states.geojson`).then((r) => r.json()), fetch(`${base}geo/ssd-counties.geojson`).then((r) => r.json())])
      .then(([states, counties]) => setGeo({ states, counties }))
      .catch(() => setGeo({ states: null, counties: null }));
  }, []);

  const [from, to] = useMemo(() => {
    if (period === "custom") return [custom.from || null, custom.to || null];
    const p = PERIODS.find(([k]) => k === period);
    const [a, b] = p[2]();
    return [a ? a.format("YYYY-MM-DD") : null, b ? b.format("YYYY-MM-DD") : null];
  }, [period, custom]);

  const params = useMemo(
    () => ({ ...(implId ? { implementationId: implId } : {}), ...(programIds.length ? { programIds: programIds.join(",") } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}) }),
    [implId, programIds, from, to]
  );
  const key = JSON.stringify(params);
  useEffect(() => {
    if (!ready) return undefined;
    let alive = true;
    const k = JSON.stringify(params);
    api
      .get("/api/dhis2-children/map", { params })
      .then((r) => alive && setResult({ key: k, data: r.data, error: "" }))
      .catch((e) => alive && setResult({ key: k, data: null, error: e?.response?.data?.message || e.message }));
    return () => {
      alive = false;
    };
  }, [params, ready]);
  const data = result.data;
  const loading = result.key !== key;
  const programs = data?.programs || [];

  // Commodities present (for the "Commodity given" measure)
  const commodities = useMemo(() => {
    const set = new Map();
    for (const s of data?.sites || []) for (const g of s.given) set.set(`${g.commodity}|${g.unit}`, `${g.commodity} (${g.unit})`);
    return [...set.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [data]);
  const commodityKey = commodities.some(([k]) => k === commodity) ? commodity : commodities[0]?.[0] || "";
  const commodityLabel = commodities.find(([k]) => k === commodityKey)?.[1] || "Commodity given";

  // Per site figures for the chosen measure
  const sites = useMemo(
    () =>
      (data?.sites || []).map((s) => {
        const t = totalsOf(Object.values(s.programs));
        return { ...s, t, value: valueOf(t, measure, s.given, commodityKey) };
      }),
    [data, measure, commodityKey]
  );
  const located = sites.filter((s) => s.latitude !== null && s.longitude !== null);
  const isRate = MEASURES[measure].kind === "rate";
  const sizeOf = (s) => (isRate ? s.t.exits : s.value) || 0;
  const maxSize = Math.max(1, ...located.map(sizeOf));
  const maxValue = Math.max(1, ...sites.map((s) => (isRate ? 0 : s.value || 0)));

  // County figures: add up the sites of each county
  const counties = useMemo(() => {
    const map = new Map();
    for (const s of sites) {
      const k = countyKey(s.county);
      if (!k) continue;
      const c = map.get(k) || { key: k, name: s.county, state: s.state, sites: [], given: [], programs: [] };
      c.sites.push(s);
      c.programs.push(...Object.values(s.programs));
      c.given.push(...s.given);
      if (!c.state && s.state) c.state = s.state;
      map.set(k, c);
    }
    return [...map.values()].map((c) => {
      const t = totalsOf(c.programs);
      return { ...c, t, value: valueOf(t, measure, c.given, commodityKey) };
    });
  }, [sites, measure, commodityKey]);
  const countyByKey = new Map(counties.map((c) => [c.key, c]));
  // Counties with sites, plus the chosen one if it has nothing in this period.
  const focusFeature = countyFocus && geo.counties ? geo.counties.features.find((x) => countyKey(x.properties.name) === countyFocus) : null;
  const countyOptions = focusFeature && !countyByKey.has(countyFocus) ? [...counties, { key: countyFocus, name: focusFeature.properties.name, state: focusFeature.properties.state }] : counties;
  const countyLabels = useMemo(() => {
    if (!geo.counties) return [];
    const keys = new Set(counties.map((c) => c.key));
    return geo.counties.features
      .filter((f) => keys.has(countyKey(f.properties.name)))
      .map((f) => ({ key: f.properties.id || f.properties.name, name: f.properties.name, center: L.geoJSON(f).getBounds().getCenter() }));
  }, [geo.counties, counties]);
  const maxCounty = Math.max(1, ...counties.map((c) => (isRate ? 0 : c.value || 0)));

  // Country totals
  const inView = countyFocus ? sites.filter((s) => countyKey(s.county) === countyFocus) : sites;
  const total = totalsOf(inView.flatMap((s) => Object.values(s.programs)));
  const givenTotals = commodities.map(([k, label]) => [label, inView.reduce((n, s) => n + givenSum(s.given, k), 0)]);

  // Map view: where the sites are (or a chosen county)
  const bounds = useMemo(() => {
    if (countyFocus && geo.counties) {
      const f = geo.counties.features.find((x) => countyKey(x.properties.name) === countyFocus);
      if (f) return L.geoJSON(f).getBounds();
    }
    const pts = [...located, ...(showIdle ? data?.idleSites || [] : [])].filter((s) => s.latitude !== null && s.longitude !== null);
    if (!pts.length) return SSD_BOUNDS;
    return L.latLngBounds(pts.map((s) => [s.latitude, s.longitude])).pad(0.15);
  }, [countyFocus, geo.counties, located, showIdle, data]);
  const boundsKey = (() => {
    try {
      return bounds.toBBoxString ? bounds.toBBoxString() : JSON.stringify(bounds);
    } catch {
      return "";
    }
  })();
  // Redraw the county layer when what it shows changes.
  const geoKey = `${key}|${measure}|${commodityKey}|${countyFocus}`;

  const countyStyle = (f) => {
    const c = countyByKey.get(countyKey(f.properties.name));
    const focus = countyFocus && countyKey(f.properties.name) === countyFocus;
    if (!c) return { color: "#A9B6BD", weight: 0.7, fillColor: "#FFFFFF", fillOpacity: streets ? 0.15 : 0.92 };
    const fill = isRate ? rateColor(measure, c.t[measure]) : scaleColor(c.value, maxCounty) || "#FFFFFF";
    return { color: focus ? "#00495A" : "#5F7480", weight: focus ? 2.5 : 1.1, fillColor: fill, fillOpacity: isRate ? 0.3 : 0.65 };
  };
  const onCounty = (f, layer) => {
    const c = countyByKey.get(countyKey(f.properties.name));
    const html = c
      ? `<b>${f.properties.name}</b> · ${f.properties.state || ""}<br/>${MEASURES[measure].label}: <b>${isRate ? pct(c.t[measure]) : fmt(c.value, 2)}</b><br/>${c.sites.length} site(s)`
      : `<b>${f.properties.name}</b> · ${f.properties.state || ""}<br/>No programme sites`;
    layer.bindTooltip(html, { sticky: true, direction: "top" });
    layer.on("click", () => {
      if (c) {
        setCountyFocus(countyKey(f.properties.name));
        setTab(0);
      }
    });
  };

  const openChildren = (s) => {
    const q = new URLSearchParams({ site: s.key, ...(implId ? { country: implId } : {}) });
    navigate(`/dhis2-children?${q.toString()}`);
  };

  const ranking = inView
    .slice()
    .sort((a, b) => (isRate ? (b.t.exits ? b.value ?? -1 : -2) - (a.t.exits ? a.value ?? -1 : -2) : (b.value || 0) - (a.value || 0)));
  const countyRanking = counties.slice().sort((a, b) => (isRate ? (b.value ?? -1) - (a.value ?? -1) : (b.value || 0) - (a.value || 0)));

  return (
    <Box sx={{ display: "grid", gap: 2.5 }}>
      <GlobalStyles
        styles={{
          ".anchor-county-label span": {
            display: "inline-block",
            transform: "translate(-50%, -50%)",
            whiteSpace: "nowrap",
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: 0.2,
            color: "#29404B",
            textShadow: "0 0 3px #fff, 0 0 3px #fff, 0 0 2px #fff",
          },
          ".leaflet-container": { fontFamily: "inherit" },
          ".leaflet-tooltip": { borderRadius: 8, boxShadow: "0 2px 10px rgba(0,0,0,.15)" },
        }}
      />
      <Card>
        <CardContent sx={{ display: "grid", gap: 2, gridTemplateColumns: "minmax(0, 1fr)" }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} justifyContent="space-between" alignItems={{ xs: "stretch", md: "center" }}>
            <Box>
              <Typography variant="h5" fontWeight={900}>
                Programme map
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Workload and results per site, county and state, from DHIS2 programme records. Click a county to zoom in, a site for its details.
              </Typography>
            </Box>
            <CountryScopeSelect
              scope={{
                ...scope,
                value: country,
                setValue: (v) => {
                  setPicked(v);
                  setProgramIds([]);
                  setSelected(null);
                  setCountyFocus(null);
                },
              }}
            />
          </Stack>

          <Stack direction={{ xs: "column", lg: "row" }} spacing={1.5} useFlexGap flexWrap="wrap" alignItems={{ xs: "stretch", lg: "center" }}>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              <Chip label="All programs" color={programIds.length ? "default" : "primary"} variant={programIds.length ? "outlined" : "filled"} onClick={() => setProgramIds([])} />
              {programs.map((p) => {
                const on = programIds.includes(p.id);
                return (
                  <Chip
                    key={p.id}
                    label={p.code}
                    color={on ? "primary" : "default"}
                    variant={on ? "filled" : "outlined"}
                    onClick={() => setProgramIds(on ? programIds.filter((x) => x !== p.id) : [...programIds, p.id])}
                  />
                );
              })}
            </Stack>
            <FormControl size="small" sx={{ minWidth: 170 }}>
              <InputLabel>Period</InputLabel>
              <Select label="Period" value={period} onChange={(e) => setPeriod(e.target.value)}>
                {PERIODS.map(([k, l]) => (
                  <MenuItem key={k} value={k}>
                    {l}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 190 }}>
              <InputLabel shrink>County</InputLabel>
              <Select label="County" notched value={countyOptions.some((c) => c.key === countyFocus) ? countyFocus : ""} displayEmpty onChange={(e) => setCountyFocus(e.target.value || null)}>
                <MenuItem value="">All counties</MenuItem>
                {countyOptions
                  .slice()
                  .sort((a, b) => String(a.state || "").localeCompare(String(b.state || "")) || a.name.localeCompare(b.name))
                  .map((c) => (
                    <MenuItem key={c.key} value={c.key}>
                      {c.name}
                      <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                        {c.state || ""}
                      </Typography>
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>
            {period === "custom" ? (
              <>
                <TextField size="small" type="date" label="From" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} InputLabelProps={{ shrink: true }} />
                <TextField size="small" type="date" label="To" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} InputLabelProps={{ shrink: true }} />
              </>
            ) : null}
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Show on map</InputLabel>
              <Select label="Show on map" value={measure} onChange={(e) => setMeasure(e.target.value)}>
                {Object.entries(MEASURES).map(([k, m]) => (
                  <MenuItem key={k} value={k}>
                    {m.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {measure === "given" ? (
              <FormControl size="small" sx={{ minWidth: 170 }}>
                <InputLabel>Commodity</InputLabel>
                <Select label="Commodity" value={commodityKey} onChange={(e) => setCommodity(e.target.value)}>
                  {commodities.map(([k, l]) => (
                    <MenuItem key={k} value={k}>
                      {l}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            ) : null}
            <FormControlLabel control={<Switch checked={showIdle} onChange={(e) => setShowIdle(e.target.checked)} />} label="Sites with no records" />
            <FormControlLabel control={<Switch checked={streets} onChange={(e) => setStreets(e.target.checked)} />} label="Street map" />
          </Stack>
          <Typography variant="caption" color="text.secondary">
            {MEASURES[measure].help}. Period: {from ? dayjs(from).format("D MMM YYYY") : "start"} – {to ? dayjs(to).format("D MMM YYYY") : "today"}.
          </Typography>
        </CardContent>
      </Card>

      {result.error ? <Alert severity="error">{result.error}</Alert> : null}

      <Box sx={{ display: "grid", gap: { xs: 1.5, sm: 2 }, gridTemplateColumns: { xs: "repeat(2, minmax(0,1fr))", md: "repeat(auto-fit, minmax(150px, 1fr))" } }}>
        {[
          ["Sites with children", fmt(inView.length), null],
          ["New admissions", fmt(total.admissions), null],
          ["In treatment now", fmt(total.inTreatment), null],
          ["Cure rate", pct(total.cureRate), total.cureRate === null ? null : rateColor("cureRate", total.cureRate)],
          ["Default rate", pct(total.defaultRate), total.defaultRate === null ? null : rateColor("defaultRate", total.defaultRate)],
          ["Death rate", pct(total.deathRate), total.deathRate === null ? null : rateColor("deathRate", total.deathRate)],
          ...givenTotals.map(([l, v]) => [l.replace(" (", " given (").replace(/\)$/, ")"), fmt(v, 2), null]),
        ].map(([label, value, color]) => (
          <Card key={label} sx={{ opacity: loading ? 0.6 : 1 }}>
            <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
              <Typography variant="caption" color="text.secondary" fontWeight={800}>
                {label}
              </Typography>
              <Typography variant="h5" fontWeight={900} sx={{ color: color || "text.primary" }}>
                {value}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Box>

      <Box sx={{ display: "grid", gap: 2.5, gridTemplateColumns: { xs: "minmax(0,1fr)", lg: "minmax(0, 1.75fr) minmax(0, 1fr)" } }}>
        <Card sx={{ overflow: "hidden", position: "relative" }}>
          <Box sx={{ height: { xs: 460, md: 640 }, position: "relative" }}>
            <MapContainer bounds={SSD_BOUNDS} style={{ height: "100%", width: "100%", background: "#E9EFF2" }} zoomSnap={0.25} scrollWheelZoom attributionControl>
              {streets ? (
                <TileLayer
                  url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  maxZoom={18}
                  opacity={0.55}
                />
              ) : null}
              <FitTo bounds={bounds} boundsKey={boundsKey} token={fitToken} />
              {geo.counties ? <GeoJSON key={`c-${geoKey}`} data={geo.counties} style={countyStyle} onEachFeature={onCounty} /> : null}
              {geo.states ? (
                <GeoJSON
                  key="states"
                  data={geo.states}
                  style={() => ({ color: "#2F4450", weight: 2.2, fill: false })}
                  interactive={false}
                  attribution="Boundaries: OCHA / NBS South Sudan (2020) via geoBoundaries, CC BY 3.0 IGO"
                />
              ) : null}
              <Pane name="labels" style={{ zIndex: 640, pointerEvents: "none" }}>
                {countyLabels.map((l) => (
                  <Marker
                    key={l.key}
                    position={l.center}
                    pane="labels"
                    interactive={false}
                    icon={L.divIcon({ className: "anchor-county-label", html: `<span>${l.name}</span>`, iconSize: [0, 0] })}
                  />
                ))}
              </Pane>
              <Pane name="sites" style={{ zIndex: 650 }}>
                {showIdle
                  ? (data?.idleSites || [])
                      .filter((s) => s.latitude !== null && s.longitude !== null)
                      .map((s) => (
                        <CircleMarker key={`idle-${s.name}`} center={[s.latitude, s.longitude]} radius={3.5} pathOptions={{ color: "#7A8A93", weight: 1, fillColor: "#FFFFFF", fillOpacity: 1 }}>
                          <Tooltip direction="top">
                            <b>{s.name}</b>
                            <br />
                            {[s.payam, s.county].filter(Boolean).join(" · ")} · no records in the selected programs
                          </Tooltip>
                        </CircleMarker>
                      ))
                  : null}
                {located
                  .slice()
                  .sort((a, b) => sizeOf(b) - sizeOf(a))
                  .map((s) => {
                    const size = sizeOf(s);
                    const r = 5 + 21 * Math.sqrt(size / maxSize);
                    const fill = isRate ? rateColor(measure, s.value) : scaleColor(s.value, maxValue) || "#FFFFFF";
                    const isSel = selected === s.key;
                    return (
                      <CircleMarker
                        key={s.key}
                        center={[s.latitude, s.longitude]}
                        radius={r}
                        pathOptions={{ color: isSel ? "#0F2A33" : "#FFFFFF", weight: isSel ? 3 : 1.5, fillColor: fill, fillOpacity: 0.9 }}
                        eventHandlers={{
                          click: () => {
                            setSelected(s.key);
                            setTab(2);
                          },
                        }}
                      >
                        <Tooltip direction="top" offset={[0, -r]}>
                          <b>{s.name}</b> · {s.county}
                          <br />
                          {MEASURES[measure].label}: <b>{isRate ? pct(s.value) : fmt(s.value, 2)}</b>
                          {isRate ? ` (${s.t.exits} discharged)` : ""}
                        </Tooltip>
                      </CircleMarker>
                    );
                  })}
              </Pane>
            </MapContainer>
            <Legend measure={measure} max={maxValue} commodityLabel={commodityLabel} />
            <Stack direction="row" spacing={1} sx={{ position: "absolute", top: 12, right: 12, zIndex: 500 }}>
              {countyFocus ? (
                <Chip color="primary" label={`County: ${countyByKey.get(countyFocus)?.name || focusFeature?.properties.name || ""}`} onDelete={() => setCountyFocus(null)} sx={{ bgcolor: "primary.main", boxShadow: 2 }} />
              ) : null}
              <Button
                size="small"
                variant="contained"
                color="inherit"
                startIcon={<CenterFocusStrongOutlinedIcon />}
                onClick={() => {
                  setCountyFocus(null);
                  setFitToken((x) => x + 1);
                }}
                sx={{ bgcolor: "white", boxShadow: 2 }}
              >
                Reset view
              </Button>
            </Stack>
            {loading ? (
              <Chip label="Updating…" size="small" sx={{ position: "absolute", top: 12, left: 56, zIndex: 500, bgcolor: "white", boxShadow: 2 }} />
            ) : null}
          </Box>
        </Card>

        <Card sx={{ display: "flex", flexDirection: "column", minHeight: { lg: 640 } }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="fullWidth">
            <Tab label={`Counties (${counties.length})`} />
            <Tab label={`Sites (${ranking.length})`} />
            <Tab label="Site" disabled={!selected} />
          </Tabs>
          <Divider />
          <CardContent sx={{ flex: 1, overflow: "auto", maxHeight: { lg: 590 } }}>
            {tab === 0 ? (
              <TableContainer>
                <Table size="small" stickyHeader sx={{ "&&": { minWidth: 0 }, "& th, & td": { px: { xs: 0.75, md: 1.5 } }, "& th": { fontSize: { xs: 11, md: 12 }, whiteSpace: "normal" } }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>County</TableCell>
                      <TableCell align="right">Sites</TableCell>
                      <TableCell align="right">{isRate ? MEASURES[measure].label : measure === "given" ? commodityLabel : MEASURES[measure].label}</TableCell>
                      {!isRate ? <TableCell align="right">Cure</TableCell> : null}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {countyRanking.map((c) => (
                      <TableRow key={c.key} hover selected={countyFocus === c.key} sx={{ cursor: "pointer" }} onClick={() => setCountyFocus(countyFocus === c.key ? null : c.key)}>
                        <TableCell>
                          <Typography variant="body2" fontWeight={800}>
                            {c.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {c.state}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">{c.sites.length}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 800, color: isRate ? rateColor(measure, c.value) : undefined }}>
                          {isRate ? pct(c.value) : fmt(c.value, 2)}
                        </TableCell>
                        {!isRate ? <TableCell align="right">{pct(c.t.cureRate)}</TableCell> : null}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : null}

            {tab === 1 ? (
              <TableContainer>
                <Table size="small" stickyHeader sx={{ "&&": { minWidth: 0 }, "& th, & td": { px: { xs: 0.75, md: 1.5 } }, "& th": { fontSize: { xs: 11, md: 12 }, whiteSpace: "normal" } }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Site</TableCell>
                      <TableCell align="right">{measure === "given" ? commodityLabel : MEASURES[measure].label}</TableCell>
                      <TableCell align="right">In treatment</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {ranking.map((s) => (
                      <TableRow
                        key={s.key}
                        hover
                        selected={selected === s.key}
                        sx={{ cursor: "pointer" }}
                        onClick={() => {
                          setSelected(s.key);
                          setTab(2);
                        }}
                      >
                        <TableCell>
                          <Typography variant="body2" fontWeight={800}>
                            {s.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {[s.county, s.latitude === null ? "not on the map (no coordinates)" : null].filter(Boolean).join(" · ")}
                          </Typography>
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 800, color: isRate ? rateColor(measure, s.value) : undefined }}>
                          {isRate ? pct(s.value) : fmt(s.value, 2)}
                        </TableCell>
                        <TableCell align="right">{fmt(s.t.inTreatment)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : null}

            {tab === 2 && selected ? (
              (() => {
                const s = sites.find((x) => x.key === selected);
                return s ? <SiteCard site={s} programs={programs} commodity={commodityKey} onOpen={() => openChildren(s)} /> : <Typography color="text.secondary">Choose a site on the map.</Typography>;
              })()
            ) : null}

          </CardContent>
        </Card>
      </Box>

      <Typography variant="caption" color="text.secondary">
        Figures come from the DHIS2 programme records copied into Anchor (updated hourly). Admissions and discharge rates use the selected period; &quot;in treatment&quot; and
        &quot;missed appointments&quot; are as of today. Rates are only meaningful with enough discharges: a site with few exits can swing widely. Prevalence needs population
        figures, which are not part of these records; the map shows caseload.
      </Typography>
    </Box>
  );
}
