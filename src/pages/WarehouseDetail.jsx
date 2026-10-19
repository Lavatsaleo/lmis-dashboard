import React, { Component, Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  LinearProgress,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import RefreshIcon from "@mui/icons-material/Refresh";
import HomeWorkOutlinedIcon from "@mui/icons-material/HomeWorkOutlined";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ViewInArOutlinedIcon from "@mui/icons-material/ViewInArOutlined";
import GridViewOutlinedIcon from "@mui/icons-material/GridViewOutlined";

import { api } from "../api/client";
import FloorPlan2D from "../components/warehouse/FloorPlan2D";
import { BAND_COLORS, BAND_LABELS, HOLD_COLOR, buildLayout, donorColors, formatDate, productColors } from "../components/warehouse/layout";
import BuildingDialog from "../components/warehouse/BuildingDialog";
import { money, moneyMap } from "../components/warehouse/format";
import { typeLabel } from "../components/supply/hierarchy";

// three.js is large: load the 3D view only when it is shown.
const Warehouse3D = lazy(() => import("../components/warehouse/Warehouse3D"));

function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")));
  } catch {
    return false;
  }
}

/** If the 3D view fails (old GPU, driver), fall back to the floor plan. */
class ViewBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

const SEVERITY = {
  critical: { icon: <ErrorOutlineIcon />, color: "error" },
  warning: { icon: <WarningAmberIcon />, color: "warning" },
  info: { icon: <InfoOutlinedIcon />, color: "info" },
  good: { icon: <CheckCircleOutlineIcon />, color: "success" },
};

function Kpi({ label, value, hint, tone }) {
  const theme = useTheme();
  const color = tone ? theme.palette[tone].main : theme.palette.text.primary;
  return (
    <Card variant="outlined" sx={{ height: "100%" }}>
      <CardContent sx={{ py: 1.75, "&:last-child": { pb: 1.75 } }}>
        <Typography variant="caption" color="text.secondary" fontWeight={600}>
          {label}
        </Typography>
        <Typography variant="h5" fontWeight={800} sx={{ color, lineHeight: 1.2, mt: 0.25 }}>
          {value}
        </Typography>
        {hint ? (
          <Typography variant="caption" color="text.secondary">
            {hint}
          </Typography>
        ) : null}
      </CardContent>
    </Card>
  );
}

const swatch = (bg, extra = {}) => <Box component="span" sx={{ width: 10, height: 10, borderRadius: "3px", bgcolor: bg, ml: "8px !important", ...extra }} />;

function Legend({ mode, products, colors, donors, dColors, activeBands, toggleBand }) {
  if (mode === "real") {
    return (
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
        <Chip size="small" variant="outlined" label="Cartons" icon={swatch("#B08A57")} />
        <Chip size="small" variant="outlined" label="Sacks" icon={swatch("#ECE8DD", { border: "1px solid #bbb" })} />
        <Chip size="small" variant="outlined" label="On hold" icon={swatch(HOLD_COLOR)} />
        <Chip size="small" variant="outlined" label="Empty pallet" icon={swatch("#2E56B8")} />
        <Chip size="small" variant="outlined" label="Incoming" icon={swatch("#3B82F6", { opacity: 0.5 })} />
      </Stack>
    );
  }
  if (mode === "donor") {
    return (
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
        {donors.map((d) => (
          <Chip
            key={d.donorId || d.name}
            size="small"
            variant="outlined"
            label={`${d.name} · ${d.share}%`}
            icon={<Box component="span" sx={{ width: 10, height: 10, borderRadius: "3px", bgcolor: dColors[d.donorId || d.name], ml: "8px !important" }} />}
          />
        ))}
      </Stack>
    );
  }
  if (mode === "product") {
    return (
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
        {products.map((p) => (
          <Chip
            key={p.product.id}
            size="small"
            variant="outlined"
            label={p.product.name}
            icon={<Box component="span" sx={{ width: 10, height: 10, borderRadius: "3px", bgcolor: colors[p.product.id], ml: "8px !important" }} />}
          />
        ))}
      </Stack>
    );
  }
  return (
    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
      {Object.keys(BAND_COLORS).map((band) => {
        const on = activeBands.size === 0 || activeBands.has(band);
        return (
          <Tooltip key={band} title="Click to show only this band (click again to clear)">
            <Chip
              size="small"
              variant={on ? "filled" : "outlined"}
              onClick={() => toggleBand(band)}
              label={BAND_LABELS[band]}
              sx={{
                bgcolor: on ? alpha(BAND_COLORS[band], 0.14) : undefined,
                color: on ? BAND_COLORS[band] : "text.secondary",
                borderColor: alpha(BAND_COLORS[band], 0.5),
                fontWeight: 700,
              }}
              icon={<Box component="span" sx={{ width: 10, height: 10, borderRadius: "3px", bgcolor: BAND_COLORS[band], ml: "8px !important", opacity: on ? 1 : 0.4 }} />}
            />
          </Tooltip>
        );
      })}
      <Chip
        size="small"
        variant="outlined"
        label="Incoming"
        icon={<Box component="span" sx={{ width: 10, height: 10, borderRadius: "3px", bgcolor: "#3B82F6", opacity: 0.5, ml: "8px !important" }} />}
      />
    </Stack>
  );
}

function PalletPanel({ pallet, twin, onShowBatch, highlightedBatch }) {
  if (!pallet) {
    return (
      <Box sx={{ p: 2, color: "text.secondary" }}>
        <Typography fontWeight={700} color="text.primary" gutterBottom>
          Click a pallet
        </Typography>
        <Typography variant="body2">
          Each block is a pallet of one batch. Height shows how full it is; colour shows expiry, product or donor. Pallets
          that expire first sit nearest the dispatch dock, so the front row is what should leave next.
        </Typography>
      </Box>
    );
  }
  const b = pallet.batch;
  const product = twin.products.find((p) => p.product.id === b.productId);
  return (
    <Box sx={{ p: 2, display: "grid", gap: 1.25 }}>
      <Box>
        <Typography variant="caption" color="text.secondary">
          Pallet · FEFO position {b.fefoRank} of {twin.batches.length}
        </Typography>
        <Typography fontWeight={800}>{b.productName}</Typography>
        <Typography variant="body2" color="text.secondary">
          Batch {b.batchNo}
        </Typography>
      </Box>
      <Chip
        size="small"
        label={b.daysToExpiry < 0 ? `Expired ${-b.daysToExpiry} days ago` : `Expires in ${b.daysToExpiry} days · ${formatDate(b.expiryDate)}`}
        sx={{ justifySelf: "start", bgcolor: alpha(BAND_COLORS[b.expiryBand], 0.14), color: BAND_COLORS[b.expiryBand], fontWeight: 700 }}
      />
      <Divider />
      <Row label="On this pallet" value={`${pallet.boxes} boxes (${Math.round(pallet.fill * 100)}% full)`} />
      <Row label="Whole batch here" value={`${b.boxes} boxes · ${b.units.toLocaleString()} ${(product?.product.baseUnitName || "unit").toLowerCase()}s`} />
      {b.weightKg ? <Row label="Weight" value={`${b.weightKg.toLocaleString()} kg`} /> : null}
      <Row label="In stock since" value={formatDate(b.oldestInStockSince)} />
      <Row label="Donor" value={b.donorName || b.donors?.join(", ") || "Unknown"} />
      {b.onHold ? <Row label="On hold" value={b.holdReason || "Yes"} /> : null}
      {b.value !== null && b.value !== undefined ? <Row label="Value of batch here" value={money(b.value, b.currency)} /> : null}
      {product?.daysOfCover ? <Row label="Product cover" value={`~${product.daysOfCover} days at recent rate`} /> : null}
      <Button size="small" variant={highlightedBatch === b.key ? "contained" : "outlined"} onClick={() => onShowBatch(highlightedBatch === b.key ? null : b.key)}>
        {highlightedBatch === b.key ? "Show all pallets" : "Highlight this batch"}
      </Button>
      <Box>
        <Typography variant="caption" color="text.secondary">
          Box IDs ({Math.min(b.boxUids.length, 12)} of {b.boxes})
        </Typography>
        <Typography variant="caption" component="div" sx={{ fontFamily: "monospace", wordBreak: "break-all" }}>
          {b.boxUids.slice(0, 12).join(", ")}
          {b.boxes > 12 ? " …" : ""}
        </Typography>
      </Box>
    </Box>
  );
}

function Row({ label, value }) {
  return (
    <Stack direction="row" justifyContent="space-between" spacing={2}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={600} textAlign="right">
        {value}
      </Typography>
    </Stack>
  );
}

function MovementChart({ movement }) {
  const theme = useTheme();
  const days = movement.days;
  const max = Math.max(1, ...days.map((d) => Math.max(d.inBoxes, d.outBoxes)));
  const w = 900;
  const h = 180;
  const bw = w / days.length;
  const totalIn = days.reduce((s, d) => s + d.inBoxes, 0);
  const totalOut = days.reduce((s, d) => s + d.outBoxes, 0);
  return (
    <Box>
      <Stack direction="row" spacing={2} sx={{ mb: 1 }}>
        <Chip size="small" label={`Received ${totalIn.toLocaleString()} boxes`} sx={{ bgcolor: alpha(theme.palette.primary.main, 0.12), fontWeight: 700 }} />
        <Chip size="small" label={`Dispatched ${totalOut.toLocaleString()} boxes`} sx={{ bgcolor: alpha("#EA580C", 0.12), fontWeight: 700 }} />
        <Typography variant="caption" color="text.secondary" sx={{ alignSelf: "center" }}>
          Last {movement.windowDays} days
        </Typography>
      </Stack>
      <Box component="svg" viewBox={`0 0 ${w} ${h + 20}`} sx={{ width: "100%", height: 200 }} role="img" aria-label="Boxes received and dispatched per day">
        <line x1={0} x2={w} y1={h / 2} y2={h / 2} stroke={theme.palette.divider} />
        {days.map((d, i) => {
          const up = (d.inBoxes / max) * (h / 2 - 4);
          const down = (d.outBoxes / max) * (h / 2 - 4);
          return (
            <g key={d.date}>
              <title>{`${d.date}: in ${d.inBoxes}, out ${d.outBoxes}`}</title>
              {up > 0 ? <rect x={i * bw + 1} y={h / 2 - up} width={Math.max(1, bw - 2)} height={up} fill={theme.palette.primary.main} rx={1} /> : null}
              {down > 0 ? <rect x={i * bw + 1} y={h / 2} width={Math.max(1, bw - 2)} height={down} fill="#EA580C" rx={1} /> : null}
            </g>
          );
        })}
        <text x={0} y={h + 16} fontSize={12} fill={theme.palette.text.secondary}>
          {days[0]?.date}
        </text>
        <text x={w} y={h + 16} fontSize={12} textAnchor="end" fill={theme.palette.text.secondary}>
          today
        </text>
      </Box>
      <Typography variant="caption" color="text.secondary">
        Above the line: received. Below: dispatched.
      </Typography>
    </Box>
  );
}

export default function WarehouseDetail() {
  const { warehouseId } = useParams();
  const nav = useNavigate();
  const theme = useTheme();
  const isPhone = useMediaQuery(theme.breakpoints.down("sm"));
  const [reloadKey, setReloadKey] = useState(0);
  const [data, setData] = useState({ key: null, twin: null, error: "" });
  const [view, setView] = useState(() => (webglAvailable() ? "3d" : "plan"));
  const [mode, setMode] = useState("real");
  const [preset, setPreset] = useState("overview");
  const [showRoof, setShowRoof] = useState(true);
  const [buildingOpen, setBuildingOpen] = useState(false);
  const { me } = useOutletContext() || {};
  const isAdmin = me?.role === "SUPER_ADMIN" || me?.role === "COUNTRY_ADMIN";
  const [selected, setSelected] = useState(null);
  const [highlightBatch, setHighlightBatch] = useState(null);
  const [activeBands, setActiveBands] = useState(() => new Set());
  const [tab, setTab] = useState("batches");
  const key = `${warehouseId}:${reloadKey}`;

  useEffect(() => {
    let mounted = true;
    api
      .get(`/api/warehouses/${warehouseId}/twin`)
      .then((res) => mounted && setData({ key, twin: res.data, error: "" }))
      .catch((e) => mounted && setData({ key, twin: null, error: e?.response?.data?.message || e.message }));
    return () => {
      mounted = false;
    };
  }, [warehouseId, key]);

  const twin = data.twin;
  const loading = data.key !== key;
  const layout = useMemo(() => (twin ? buildLayout(twin) : null), [twin]);
  const colors = useMemo(() => (twin ? productColors(twin.products) : {}), [twin]);
  const dColors = useMemo(() => (twin ? donorColors(twin.donors) : {}), [twin]);

  const colorFor = useCallback(
    (p) =>
      mode === "real"
        ? p.held
          ? HOLD_COLOR
          : p.bag
          ? "#D9D4C7"
          : "#B08A57"
        : mode === "product"
        ? colors[p.productId] || "#64748B"
        : mode === "donor"
        ? dColors[p.batch.donorId || p.batch.donorName] || "#64748B"
        : BAND_COLORS[p.batch.expiryBand],
    [mode, colors, dColors]
  );
  const isDimmed = useCallback(
    (p) => (highlightBatch ? p.batch.key !== highlightBatch : activeBands.size > 0 && !activeBands.has(p.batch.expiryBand)),
    [highlightBatch, activeBands]
  );
  const toggleBand = (band) => {
    setHighlightBatch(null);
    setActiveBands((prev) => (prev.size === 1 && prev.has(band) ? new Set() : new Set([band])));
  };
  const showBatch = (batchKey) => {
    setHighlightBatch(batchKey);
    setActiveBands(new Set());
    if (batchKey && layout) setSelected(layout.pallets.find((p) => p.batch.key === batchKey) || null);
  };

  if (data.error && !loading) {
    return (
      <Stack spacing={2}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => nav("/warehouses")} sx={{ alignSelf: "flex-start" }}>
          All warehouses
        </Button>
        <Alert severity="error">{data.error}</Alert>
      </Stack>
    );
  }
  if (!twin || !layout) return <LinearProgress />;

  const s = twin.summary;
  const w = twin.warehouse;
  const space =
    s.utilisationPct !== null
      ? { value: `${s.utilisationPct}%`, hint: `${s.metricTonnes} of ${w.capacityMetricTonnes} MT`, tone: s.utilisationPct >= 95 ? "error" : s.utilisationPct >= 85 ? "warning" : undefined }
      : s.palletUtilisationPct !== null
      ? { value: `${s.palletUtilisationPct}%`, hint: `${s.usedPallets} of ${s.capacityPallets} pallet positions`, tone: undefined }
      : { value: `${s.usedPallets} pallets`, hint: "Set capacity to see % used", tone: undefined };
  const riskBoxes = s.expiredBoxes + s.criticalBoxes;
  const onOrder = (twin.expectedPurchaseOrders || []).reduce((sum, p) => sum + p.outstandingPacks, 0);
  const coverDays = twin.products.map((p) => p.daysOfCover).filter((d) => d !== null);
  const minCover = coverDays.length ? Math.min(...coverDays) : null;
  const viewHeight = isPhone ? 360 : 540;
  const plan = (
    <FloorPlan2D layout={layout} colorFor={colorFor} isDimmed={isDimmed} selected={selected} onSelect={setSelected} height={viewHeight} />
  );

  return (
    <Box sx={{ display: "grid", gap: 2.5 }}>
      <Card>
        <CardContent>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} justifyContent="space-between" alignItems={{ xs: "stretch", md: "center" }}>
            <Box sx={{ minWidth: 0 }}>
              <Button size="small" startIcon={<ArrowBackIcon />} onClick={() => nav("/warehouses")} sx={{ mb: 0.5, ml: -1 }}>
                All warehouses
              </Button>
              <Typography variant="h6" fontWeight={900}>
                {w.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {[w.code, typeLabel(w.stockLocationType), w.county?.name, w.parent ? `supplied by ${w.parent.name}` : null, w.implementation?.country?.name]
                  .filter(Boolean)
                  .join(" · ")}
              </Typography>
              {w.childWarehouses?.length ? (
                <Typography variant="caption" color="text.secondary">
                  Supplies {w.childWarehouses.length} field base{w.childWarehouses.length === 1 ? "" : "s"}:{" "}
                  {w.childWarehouses.map((c, i) => (
                    <React.Fragment key={c.id}>
                      {i ? ", " : ""}
                      <Box component="span" onClick={() => nav(`/warehouses/${c.id}`)} sx={{ color: "primary.main", cursor: "pointer", fontWeight: 600 }}>
                        {c.name}
                      </Box>
                    </React.Fragment>
                  ))}
                </Typography>
              ) : null}
            </Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="caption" color="text.secondary">
                Updated {new Date(twin.generatedAt).toLocaleTimeString()}
              </Typography>
              {isAdmin ? (
                <Button variant="text" startIcon={<HomeWorkOutlinedIcon />} onClick={() => setBuildingOpen(true)}>
                  Building
                </Button>
              ) : null}
              <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => setReloadKey((k) => k + 1)} disabled={loading}>
                Refresh
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "repeat(2, minmax(0,1fr))", md: "repeat(3, minmax(0,1fr))", xl: "repeat(6, minmax(0,1fr))" } }}>
        <Kpi label="Stock" value={s.boxes.toLocaleString()} hint={`boxes · ${s.batches} batch${s.batches === 1 ? "" : "es"}`} />
        <Kpi
          label="Stock value"
          value={moneyMap(s.stockValue)}
          hint={s.valueComplete ? `${(twin.donors || []).length} donor${(twin.donors || []).length === 1 ? "" : "s"}` : "some stock has no price"}
        />
        <Kpi label="Space used" value={space.value} hint={space.hint} tone={space.tone} />
        <Kpi
          label="Expiry risk"
          value={riskBoxes.toLocaleString()}
          hint={s.expiredBoxes ? `${s.expiredBoxes} expired · ${s.criticalBoxes} < 60 days` : "boxes expiring < 60 days"}
          tone={s.expiredBoxes ? "error" : riskBoxes ? "warning" : undefined}
        />
        <Kpi
          label="Incoming"
          value={(s.incomingBoxes + onOrder).toLocaleString()}
          hint={`${s.incomingBoxes.toLocaleString()} in transit · ${onOrder.toLocaleString()} on ${(twin.expectedPurchaseOrders || []).length} open PO${(twin.expectedPurchaseOrders || []).length === 1 ? "" : "s"}`}
        />
        <Kpi
          label="Days of cover"
          value={minCover !== null ? minCover.toLocaleString() : "—"}
          hint={minCover !== null ? "lowest product, at recent dispatch rate" : "no dispatches in 90 days"}
          tone={minCover !== null && minCover < 30 ? "warning" : undefined}
        />
      </Box>

      <Card>
        <CardContent sx={{ display: "grid", gap: 2 }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} justifyContent="space-between" alignItems={{ xs: "stretch", md: "center" }}>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              <ToggleButtonGroup size="small" exclusive value={view} onChange={(_, v) => v && setView(v)}>
                <ToggleButton value="3d">
                  <ViewInArOutlinedIcon fontSize="small" sx={{ mr: 0.75 }} />
                  3D
                </ToggleButton>
                <ToggleButton value="plan">
                  <GridViewOutlinedIcon fontSize="small" sx={{ mr: 0.75 }} />
                  Floor plan
                </ToggleButton>
              </ToggleButtonGroup>
              <ToggleButtonGroup size="small" exclusive value={mode} onChange={(_, v) => v && setMode(v)}>
                <ToggleButton value="real">Realistic</ToggleButton>
                <ToggleButton value="expiry">By expiry</ToggleButton>
                <ToggleButton value="product">By product</ToggleButton>
                <ToggleButton value="donor">By donor</ToggleButton>
              </ToggleButtonGroup>
              {view === "3d" ? (
                <ToggleButtonGroup size="small" exclusive value={preset} onChange={(_, v) => v && setPreset(v)}>
                  <ToggleButton value="overview">Overview</ToggleButton>
                  {layout.structure === "RUBB_HALL" ? <ToggleButton value="inside">Walk-in</ToggleButton> : null}
                  <ToggleButton value="top">Top</ToggleButton>
                </ToggleButtonGroup>
              ) : null}
              {view === "3d" && layout.structure === "RUBB_HALL" ? (
                <ToggleButton size="small" value="roof" selected={!showRoof} onChange={() => setShowRoof((r) => !r)}>
                  {showRoof ? "Hide roof" : "Show roof"}
                </ToggleButton>
              ) : null}
            </Stack>
            <Legend mode={mode} products={twin.products} colors={colors} donors={twin.donors || []} dColors={dColors} activeBands={activeBands} toggleBand={toggleBand} />
          </Stack>

          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", lg: "minmax(0,1fr) 320px" } }}>
            <Box sx={{ position: "relative", minWidth: 0 }}>
              {view === "3d" ? (
                <ViewBoundary fallback={plan}>
                  <Suspense fallback={<Box sx={{ height: viewHeight, display: "grid", placeItems: "center" }}>Loading 3D view…</Box>}>
                    <Warehouse3D
                      layout={layout}
                      colorFor={colorFor}
                      isDimmed={isDimmed}
                      selected={selected}
                      onSelect={setSelected}
                      height={viewHeight}
                      realistic={mode === "real"}
                      preset={preset}
                      showRoof={showRoof}
                    />
                  </Suspense>
                </ViewBoundary>
              ) : (
                plan
              )}
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.75 }}>
                {view === "3d" ? "Drag to rotate · scroll or pinch to zoom · right-drag to pan · " : ""}
                {layout.structure === "RUBB_HALL"
                  ? `Rubb hall ${layout.hall.length} × ${layout.hall.width} m · ${layout.positions} pallet positions. `
                  : ""}
                Layout is generated from stock records (FEFO order); it shows quantities and expiry, not exact rack positions.
              </Typography>
            </Box>
            <Card variant="outlined" sx={{ alignSelf: "start" }}>
              <PalletPanel pallet={selected} twin={twin} onShowBatch={showBatch} highlightedBatch={highlightBatch} />
            </Card>
          </Box>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={800} gutterBottom>
            What needs attention
          </Typography>
          <Box sx={{ display: "grid", gap: 1.25, gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0,1fr))" } }}>
            {twin.insights.map((i, idx) => {
              const sev = SEVERITY[i.severity] || SEVERITY.info;
              return (
                <Alert key={idx} severity={sev.color} icon={sev.icon} variant="outlined" sx={{ alignItems: "flex-start" }}>
                  <Typography fontWeight={700} variant="body2">
                    {i.title}
                  </Typography>
                  <Typography variant="body2">{i.detail}</Typography>
                  {i.action ? (
                    <Typography variant="caption" fontWeight={700} component="div" sx={{ mt: 0.5 }}>
                      → {i.action}
                    </Typography>
                  ) : null}
                </Alert>
              );
            })}
          </Box>
        </CardContent>
      </Card>

      <Card>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" allowScrollButtonsMobile sx={{ px: 2, borderBottom: 1, borderColor: "divider" }}>
          <Tab value="batches" label={`Batches (${twin.batches.length})`} />
          <Tab value="pick" label="Next to dispatch" />
          <Tab value="shipments" label={`Incoming & shipments (${twin.incoming.length + twin.outgoing.length + (twin.expectedPurchaseOrders || []).length})`} />
          <Tab value="movement" label="Movement" />
          <Tab value="products" label="Products" />
          <Tab value="donors" label={`Donors (${(twin.donors || []).length})`} />
        </Tabs>
        <CardContent>
          {tab === "batches" ? (
            <TableContainer sx={{ maxHeight: 460 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>FEFO</TableCell>
                    <TableCell>Product</TableCell>
                    <TableCell>Batch</TableCell>
                    <TableCell>Donor</TableCell>
                    <TableCell>Expiry</TableCell>
                    <TableCell align="right">Boxes</TableCell>
                    <TableCell align="right">Units</TableCell>
                    <TableCell align="right">Pallets</TableCell>
                    <TableCell align="right">Value</TableCell>
                    <TableCell>Since</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {twin.batches.map((b) => (
                    <TableRow
                      key={b.key}
                      hover
                      selected={highlightBatch === b.key}
                      onClick={() => showBatch(highlightBatch === b.key ? null : b.key)}
                      sx={{ cursor: "pointer" }}
                    >
                      <TableCell>{b.fefoRank}</TableCell>
                      <TableCell>{b.productName}</TableCell>
                      <TableCell sx={{ fontFamily: "monospace" }}>{b.batchNo}</TableCell>
                      <TableCell>{b.donorName}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={b.daysToExpiry < 0 ? `Expired · ${formatDate(b.expiryDate)}` : `${formatDate(b.expiryDate)} · ${b.daysToExpiry} d`}
                          sx={{ bgcolor: alpha(BAND_COLORS[b.expiryBand], 0.14), color: BAND_COLORS[b.expiryBand], fontWeight: 700 }}
                        />
                      </TableCell>
                      <TableCell align="right">{b.boxes.toLocaleString()}</TableCell>
                      <TableCell align="right">{b.units.toLocaleString()}</TableCell>
                      <TableCell align="right">{b.pallets}</TableCell>
                      <TableCell align="right">{money(b.value, b.currency)}</TableCell>
                      <TableCell>{formatDate(b.oldestInStockSince)}</TableCell>
                    </TableRow>
                  ))}
                  {!twin.batches.length ? (
                    <TableRow>
                      <TableCell colSpan={10}>No stock in this warehouse.</TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </TableContainer>
          ) : null}

          {tab === "pick" ? (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                Earliest-expiry-first pick list for the next dispatch (expired boxes are excluded; quarantine those).
              </Typography>
              <TableContainer sx={{ maxHeight: 460 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>#</TableCell>
                      <TableCell>Box ID</TableCell>
                      <TableCell>Product</TableCell>
                      <TableCell>Batch</TableCell>
                      <TableCell>Expiry</TableCell>
                      <TableCell align="right">Units</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {twin.pickList.map((p, i) => (
                      <TableRow key={p.boxUid}>
                        <TableCell>{i + 1}</TableCell>
                        <TableCell sx={{ fontFamily: "monospace" }}>{p.boxUid}</TableCell>
                        <TableCell>{p.productName}</TableCell>
                        <TableCell sx={{ fontFamily: "monospace" }}>{p.batchNo}</TableCell>
                        <TableCell>{formatDate(p.expiryDate)}</TableCell>
                        <TableCell align="right">{p.units.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                    {!twin.pickList.length ? (
                      <TableRow>
                        <TableCell colSpan={6}>Nothing to pick.</TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          ) : null}

          {tab === "shipments" && (twin.expectedPurchaseOrders || []).length ? (
            <Box sx={{ mb: 2.5 }}>
              <Typography fontWeight={700} gutterBottom>
                Expected from suppliers (open purchase orders)
              </Typography>
              <Stack spacing={1}>
                {twin.expectedPurchaseOrders.map((p) => (
                  <Card key={p.id} variant="outlined" sx={{ cursor: "pointer" }} onClick={() => nav(`/purchase-orders/${p.id}`)}>
                    <CardContent sx={{ py: 1.25, "&:last-child": { pb: 1.25 } }}>
                      <Stack direction="row" justifyContent="space-between" spacing={1}>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography fontWeight={700} variant="body2" sx={{ fontFamily: "monospace" }}>
                            {p.poNumber}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {[p.supplierName, p.products.join(", "), p.donors.join(", ")].filter(Boolean).join(" · ")}
                          </Typography>
                        </Box>
                        <Box sx={{ textAlign: "right" }}>
                          <Typography fontWeight={700} variant="body2">
                            {p.outstandingPacks.toLocaleString()} packs · {money(p.outstandingValue, p.currencyCode)}
                          </Typography>
                          <Chip
                            size="small"
                            variant="outlined"
                            color={p.overdue ? "error" : "default"}
                            label={p.expectedDeliveryDate ? `${p.overdue ? "Overdue · " : "Expected "}${formatDate(p.expectedDeliveryDate)}` : "No date"}
                          />
                        </Box>
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            </Box>
          ) : null}

          {tab === "shipments" ? (
            <Box sx={{ display: "grid", gap: 2.5, gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" } }}>
              {[
                { title: "Incoming (not yet received)", rows: twin.incoming, who: (x) => `from ${x.from.name}` },
                { title: "Dispatched, awaiting receipt", rows: twin.outgoing, who: (x) => `to ${x.to.name}` },
              ].map((group) => (
                <Box key={group.title}>
                  <Typography fontWeight={700} gutterBottom>
                    {group.title}
                  </Typography>
                  {group.rows.length ? (
                    <Stack spacing={1}>
                      {group.rows.map((x) => (
                        <Card key={x.id} variant="outlined">
                          <CardContent sx={{ py: 1.25, "&:last-child": { pb: 1.25 } }}>
                            <Stack direction="row" justifyContent="space-between" spacing={1}>
                              <Box sx={{ minWidth: 0 }}>
                                <Typography fontWeight={700} variant="body2" sx={{ fontFamily: "monospace" }}>
                                  {x.manifestNo}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {group.who(x)} · sent {formatDate(x.dispatchedAt)}
                                </Typography>
                              </Box>
                              <Box sx={{ textAlign: "right" }}>
                                <Typography fontWeight={700} variant="body2">
                                  {x.boxes} boxes
                                </Typography>
                                <Chip
                                  size="small"
                                  color={x.daysInTransit > 14 ? "warning" : "default"}
                                  variant="outlined"
                                  label={`${x.daysInTransit} d in transit`}
                                />
                              </Box>
                            </Stack>
                          </CardContent>
                        </Card>
                      ))}
                    </Stack>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      None.
                    </Typography>
                  )}
                </Box>
              ))}
            </Box>
          ) : null}

          {tab === "movement" ? <MovementChart movement={twin.movement} /> : null}

          {tab === "donors" ? (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Donor</TableCell>
                    <TableCell align="right">Boxes</TableCell>
                    <TableCell align="right">Units</TableCell>
                    <TableCell sx={{ minWidth: 160 }}>Share of stock</TableCell>
                    <TableCell align="right">Value</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(twin.donors || []).map((d) => (
                    <TableRow
                      key={d.donorId || d.name}
                      hover
                      sx={{ cursor: "pointer" }}
                      onClick={() => {
                        setMode("donor");
                        setTab("batches");
                      }}
                    >
                      <TableCell>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Box sx={{ width: 10, height: 10, borderRadius: "3px", bgcolor: dColors[d.donorId || d.name] }} />
                          <span>{d.name}</span>
                        </Stack>
                      </TableCell>
                      <TableCell align="right">{d.boxes.toLocaleString()}</TableCell>
                      <TableCell align="right">{d.units.toLocaleString()}</TableCell>
                      <TableCell>
                        <Typography variant="caption">{d.share}%</Typography>
                        <LinearProgress variant="determinate" value={d.share} sx={{ height: 6, borderRadius: 3 }} />
                      </TableCell>
                      <TableCell align="right">{moneyMap(d.value)}</TableCell>
                    </TableRow>
                  ))}
                  {!(twin.donors || []).length ? (
                    <TableRow>
                      <TableCell colSpan={5}>No stock in this warehouse.</TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </TableContainer>
          ) : null}

          {tab === "products" ? (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Product</TableCell>
                    <TableCell align="right">Boxes</TableCell>
                    <TableCell align="right">Units</TableCell>
                    <TableCell align="right">Per pallet</TableCell>
                    <TableCell align="right">Out / day</TableCell>
                    <TableCell align="right">Days of cover</TableCell>
                    <TableCell align="right">Received 90 d</TableCell>
                    <TableCell align="right">Dispatched 90 d</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {twin.products.map((p) => (
                    <TableRow key={p.product.id}>
                      <TableCell>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Box sx={{ width: 10, height: 10, borderRadius: "3px", bgcolor: colors[p.product.id] }} />
                          <span>{p.product.name}</span>
                        </Stack>
                      </TableCell>
                      <TableCell align="right">{p.boxes.toLocaleString()}</TableCell>
                      <TableCell align="right">{p.units.toLocaleString()}</TableCell>
                      <TableCell align="right">
                        <Tooltip title={p.packWeightKg ? `${p.packWeightKg} kg per box, ~1 t per pallet` : "No pack weight set: assumed 40 boxes per pallet"}>
                          <span>{p.boxesPerPallet}</span>
                        </Tooltip>
                      </TableCell>
                      <TableCell align="right">{p.avgDailyOutUnits.toLocaleString()}</TableCell>
                      <TableCell align="right">{p.daysOfCover ?? "—"}</TableCell>
                      <TableCell align="right">{p.receivedUnits90d.toLocaleString()}</TableCell>
                      <TableCell align="right">{p.dispatchedUnits90d.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : null}
        </CardContent>
      </Card>
      {buildingOpen ? (
        <BuildingDialog
          warehouse={twin.warehouse}
          onClose={() => setBuildingOpen(false)}
          onSaved={() => {
            setBuildingOpen(false);
            setReloadKey((k) => k + 1);
          }}
        />
      ) : null}
    </Box>
  );
}
