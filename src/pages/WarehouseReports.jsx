import React, { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  FormControl,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableFooter,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import PrintOutlinedIcon from "@mui/icons-material/PrintOutlined";
import AssessmentOutlinedIcon from "@mui/icons-material/AssessmentOutlined";

import { api } from "../api/client";
import ImplementationPicker from "../components/ImplementationPicker";
import { useImplementationChoice } from "../components/implementationChoice";
import { dateOnly, downloadCsv, formatCell, isoDay } from "../components/warehouse/format";

// Which filters each report uses.
const FILTERS = {
  "stock-on-hand": ["donor", "product"],
  "stock-movement": ["period", "donor", "product"],
  "daily-activity": ["period"],
  "activity-log": ["period"],
  "donor-summary": ["period", "donor", "product"],
  expiry: ["donor", "product", "expiryDays"],
  "purchase-orders": ["period", "donor"],
  dispatches: ["period"],
  losses: ["period", "donor", "product"],
  "stock-counts": ["period", "product"],
};

const monthStart = () => {
  const d = new Date();
  return isoDay(new Date(d.getFullYear(), d.getMonth(), 1));
};

export default function WarehouseReports() {
  const { me } = useOutletContext();
  const { implementations, implementationId, setImplementationId, isSuperAdmin } = useImplementationChoice(me);
  const [reports, setReports] = useState([]);
  const [report, setReport] = useState("stock-on-hand");
  const [warehouses, setWarehouses] = useState([]);
  const [donors, setDonors] = useState([]);
  const [products, setProducts] = useState([]);
  const [filters, setFilters] = useState({ warehouseId: "", from: monthStart(), to: isoDay(), donorId: "", productId: "", expiryDays: "180" });
  const [data, setData] = useState({ key: null, result: null, error: "" });

  const implQuery = isSuperAdmin && implementationId ? `implementationId=${encodeURIComponent(implementationId)}` : "";

  useEffect(() => {
    api.get("/api/warehouse-reports").then((res) => setReports(res.data?.reports || [])).catch(() => setReports([]));
  }, []);

  useEffect(() => {
    if (!me || (isSuperAdmin && !implementationId)) return undefined;
    let mounted = true;
    Promise.all([
      api.get(`/api/warehouses${implQuery ? `?${implQuery}` : ""}`),
      api.get(`/api/donors?includeInactive=true${implQuery ? `&${implQuery}` : ""}`),
      api.get(`/api/products?includeInactive=true${implQuery ? `&${implQuery}` : ""}`),
    ])
      .then(([w, d, p]) => {
        if (!mounted) return;
        setWarehouses(w.data?.rows || []);
        setDonors(d.data || []);
        setProducts(p.data || []);
        setFilters((f) => ({ ...f, warehouseId: "", donorId: "", productId: "" }));
      })
      .catch(() => null);
    return () => {
      mounted = false;
    };
  }, [me, isSuperAdmin, implementationId, implQuery]);

  const used = useMemo(() => FILTERS[report] || [], [report]);
  const params = useMemo(() => {
    const p = {};
    if (isSuperAdmin && implementationId) p.implementationId = implementationId;
    if (filters.warehouseId) p.warehouseId = filters.warehouseId;
    if (used.includes("period")) {
      p.from = filters.from;
      p.to = filters.to;
    }
    if (used.includes("donor") && filters.donorId) p.donorId = filters.donorId;
    if (used.includes("product") && filters.productId) p.productId = filters.productId;
    if (used.includes("expiryDays")) p.expiryDays = filters.expiryDays;
    return p;
  }, [filters, used, isSuperAdmin, implementationId]);
  const key = `${report}:${JSON.stringify(params)}`;

  useEffect(() => {
    if (!me || (isSuperAdmin && !implementationId)) return undefined;
    let mounted = true;
    const t = setTimeout(() => {
      api
        .get(`/api/warehouse-reports/${report}`, { params })
        .then((res) => mounted && setData({ key, result: res.data, error: "" }))
        .catch((e) => mounted && setData({ key, result: null, error: e?.response?.data?.message || e.message }));
    }, 250);
    return () => {
      mounted = false;
      clearTimeout(t);
    };
  }, [me, isSuperAdmin, implementationId, report, params, key]);

  const loading = data.key !== key;
  const result = data.result;
  const set = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));
  const meta = reports.find((r) => r.key === report);

  const exportCsv = () => {
    if (!result) return;
    const wh = warehouses.find((w) => w.id === filters.warehouseId)?.name || "All warehouses in scope";
    const lines = [
      `Anchor · ${result.title}`,
      `Warehouse: ${wh}`,
      used.includes("period") ? `Period: ${filters.from} to ${filters.to}` : `As at: ${new Date(result.generatedAt).toLocaleString()}`,
      ...(result.notes || []),
    ];
    downloadCsv(`anchor-${report}-${isoDay()}`, result.columns, result.rows, result.totals, lines);
  };

  return (
    <Box sx={{ display: "grid", gap: 2.5 }}>
      <Card className="no-print">
        <CardContent>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} justifyContent="space-between" alignItems={{ xs: "stretch", md: "center" }}>
            <Box>
              <Typography variant="h6" fontWeight={900}>
                Warehouse Reports
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Day-to-day warehouse activity, stock, donors and purchase orders. Export any report to Excel.
              </Typography>
            </Box>
            <ImplementationPicker implementations={implementations} value={implementationId} onChange={setImplementationId} isSuperAdmin={isSuperAdmin} />
          </Stack>
        </CardContent>
      </Card>

      <Box className="no-print" sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "repeat(2, minmax(0,1fr))", md: "repeat(4, minmax(0,1fr))" } }}>
        {reports.map((r) => {
          const on = r.key === report;
          return (
            <Card key={r.key} variant="outlined" sx={{ borderColor: on ? "primary.main" : "divider", borderWidth: on ? 2 : 1, bgcolor: on ? "action.selected" : "background.paper" }}>
              <CardActionArea onClick={() => setReport(r.key)} sx={{ height: "100%", p: 1.5, display: "flex", alignItems: "flex-start", justifyContent: "flex-start" }}>
                <Stack direction="row" spacing={1} alignItems="flex-start">
                  <AssessmentOutlinedIcon fontSize="small" color={on ? "primary" : "action"} sx={{ mt: 0.25 }} />
                  <Box>
                    <Typography variant="body2" fontWeight={800}>
                      {r.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: { xs: "none", sm: "block" } }}>
                      {r.description}
                    </Typography>
                  </Box>
                </Stack>
              </CardActionArea>
            </Card>
          );
        })}
      </Box>

      <Card>
        <CardContent sx={{ display: "grid", gap: 2 }}>
          <Stack className="no-print" direction={{ xs: "column", lg: "row" }} spacing={1.5} useFlexGap flexWrap="wrap" alignItems={{ xs: "stretch", lg: "center" }}>
            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel>Warehouse</InputLabel>
              <Select label="Warehouse" value={filters.warehouseId} onChange={set("warehouseId")}>
                <MenuItem value="">All warehouses</MenuItem>
                {warehouses.map((w) => (
                  <MenuItem key={w.id} value={w.id}>
                    {w.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {used.includes("period") ? (
              <>
                <TextField size="small" type="date" label="From" value={filters.from} onChange={set("from")} InputLabelProps={{ shrink: true }} />
                <TextField size="small" type="date" label="To" value={filters.to} onChange={set("to")} InputLabelProps={{ shrink: true }} />
              </>
            ) : null}
            {used.includes("donor") ? (
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Donor</InputLabel>
                <Select label="Donor" value={filters.donorId} onChange={set("donorId")}>
                  <MenuItem value="">All donors</MenuItem>
                  {donors.map((d) => (
                    <MenuItem key={d.id} value={d.id}>
                      {d.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            ) : null}
            {used.includes("product") ? (
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Product</InputLabel>
                <Select label="Product" value={filters.productId} onChange={set("productId")}>
                  <MenuItem value="">All products</MenuItem>
                  {products.map((p) => (
                    <MenuItem key={p.id} value={p.id}>
                      {p.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            ) : null}
            {used.includes("expiryDays") ? (
              <FormControl size="small" sx={{ minWidth: 170 }}>
                <InputLabel>Expiring within</InputLabel>
                <Select label="Expiring within" value={filters.expiryDays} onChange={set("expiryDays")}>
                  {["60", "90", "120", "180", "365"].map((d) => (
                    <MenuItem key={d} value={d}>
                      {d} days
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            ) : null}
            <Box sx={{ flexGrow: 1 }} />
            <Button variant="outlined" startIcon={<PrintOutlinedIcon />} onClick={() => window.print()} disabled={!result}>
              Print
            </Button>
            <Button variant="contained" startIcon={<FileDownloadOutlinedIcon />} onClick={exportCsv} disabled={!result || !result.rows?.length}>
              Export to Excel
            </Button>
          </Stack>

          <Box>
            <Typography variant="subtitle1" fontWeight={800}>
              {result?.title || meta?.title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {result?.description || meta?.description}
              {used.includes("period") ? ` · ${dateOnly(filters.from)} – ${dateOnly(filters.to)}` : result?.generatedAt ? ` · as at ${new Date(result.generatedAt).toLocaleString()}` : ""}
            </Typography>
          </Box>

          {loading ? <LinearProgress /> : null}
          {data.error ? <Alert severity="error">{data.error}</Alert> : null}
          {(result?.notes || []).map((n) => (
            <Alert key={n} severity="info" variant="outlined" sx={{ py: 0 }}>
              {n}
            </Alert>
          ))}

          {result ? (
            <>
              <Chip size="small" label={`${result.rows.length.toLocaleString()} row${result.rows.length === 1 ? "" : "s"}`} sx={{ justifySelf: "start", fontWeight: 700 }} />
              <TableContainer sx={{ maxHeight: { xs: 520, md: 640 }, "@media print": { maxHeight: "none" } }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      {result.columns.map((c) => (
                        <TableCell key={c.key} align={["number", "money", "percent"].includes(c.type) ? "right" : "left"}>
                          {c.label}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {result.rows.slice(0, 2000).map((r, i) => (
                      <TableRow key={i} hover>
                        {result.columns.map((c) => (
                          <TableCell key={c.key} align={["number", "money", "percent"].includes(c.type) ? "right" : "left"} sx={c.type === "number" && Number(r[c.key]) < 0 ? { color: "error.main" } : undefined}>
                            {formatCell(r[c.key], c.type, r)}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                    {!result.rows.length ? (
                      <TableRow>
                        <TableCell colSpan={Math.max(1, result.columns.length)}>
                          <Typography variant="body2" color="text.secondary">
                            Nothing to report for these filters.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                  {result.rows.length && result.totals && Object.values(result.totals).some((v) => v !== null && v !== undefined) ? (
                    <TableFooter>
                      <TableRow>
                        {result.columns.map((c, i) => (
                          <TableCell key={c.key} align={["number", "money", "percent"].includes(c.type) ? "right" : "left"} sx={{ fontWeight: 800, color: "text.primary", fontSize: 13 }}>
                            {i === 0 ? "Total" : result.totals[c.key] === undefined || result.totals[c.key] === null ? "" : formatCell(result.totals[c.key], c.type === "money" && typeof result.totals[c.key] === "string" ? "text" : c.type, result.rows.length === 1 ? result.rows[0] : { currency: result.rows[0]?.currency })}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableFooter>
                  ) : null}
                </Table>
              </TableContainer>
              {result.rows.length > 2000 ? (
                <Typography variant="caption" color="text.secondary">
                  Showing the first 2,000 rows; the Excel export contains all {result.rows.length.toLocaleString()}.
                </Typography>
              ) : null}
            </>
          ) : null}
        </CardContent>
      </Card>
    </Box>
  );
}
