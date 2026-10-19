import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";

import { api } from "../api/client";
import { dateOnly, dateTime, isoDay } from "../components/warehouse/format";

const STATUS = {
  IN_PROGRESS: { label: "In progress", color: "info" },
  SUBMITTED: { label: "Submitted", color: "success" },
  CANCELLED: { label: "Cancelled", color: "default" },
};
const isOperator = (me) => ["SUPER_ADMIN", "COUNTRY_ADMIN", "WAREHOUSE_OFFICER"].includes(me?.role);

function StartDialog({ me, onClose, onStarted }) {
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [productId, setProductId] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => {
    api.get("/api/warehouses").then((res) => {
      let rows = res.data?.rows || [];
      if (me.role === "WAREHOUSE_OFFICER") rows = rows.filter((w) => w.id === me.warehouseId);
      setWarehouses(rows);
      if (rows.length === 1) setWarehouseId(rows[0].id);
    });
  }, [me]);
  const wh = warehouses.find((w) => w.id === warehouseId);
  useEffect(() => {
    if (!wh?.implementationId) return;
    api.get(`/api/products?implementationId=${encodeURIComponent(wh.implementationId)}`).then((res) => setProducts(res.data || []));
  }, [wh?.implementationId]);
  const start = async () => {
    setErr("");
    try {
      const res = await api.post("/api/stock-counts", { warehouseId, productId: productId || undefined, note });
      onStarted(res.data);
    } catch (e) {
      const d = e?.response?.data;
      if (d?.countId) onStarted({ id: d.countId });
      else setErr(d?.message || e.message);
    }
  };
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Start a stock count</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {err ? <Alert severity="error">{err}</Alert> : null}
          <FormControl fullWidth>
            <InputLabel>Warehouse</InputLabel>
            <Select label="Warehouse" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
              {warehouses.map((w) => (
                <MenuItem key={w.id} value={w.id}>
                  {w.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth>
            <InputLabel>Product</InputLabel>
            <Select label="Product" value={productId} onChange={(e) => setProductId(e.target.value)} displayEmpty>
              <MenuItem value="">All products (full count)</MenuItem>
              {products.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField label="Note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Month-end count, October" />
          <Typography variant="body2" color="text.secondary">
            Anchor lists every batch it expects. Count the cartons per batch; the sheet can be filled on the dashboard or the phone and saved as you go.
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={start} disabled={!warehouseId}>
          Start count
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function StockCountList() {
  const { me } = useOutletContext();
  const nav = useNavigate();
  const [data, setData] = useState({ loaded: false, rows: [], error: "" });
  const [starting, setStarting] = useState(false);
  useEffect(() => {
    api
      .get("/api/stock-counts")
      .then((res) => setData({ loaded: true, rows: res.data?.rows || [], error: "" }))
      .catch((e) => setData({ loaded: true, rows: [], error: e?.response?.data?.message || e.message }));
  }, []);
  return (
    <Box sx={{ display: "grid", gap: 2.5 }}>
      <Card>
        <CardContent>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} justifyContent="space-between" alignItems={{ xs: "stretch", md: "center" }}>
            <Box>
              <Typography variant="h6" fontWeight={900}>
                Stock Counts
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Physical counts per batch. Shortages become a write-off for approval; surpluses are flagged to investigate.
              </Typography>
            </Box>
            {isOperator(me) ? (
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => setStarting(true)}>
                Start a count
              </Button>
            ) : null}
          </Stack>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          {!data.loaded ? <LinearProgress /> : null}
          {data.error ? <Alert severity="error">{data.error}</Alert> : null}
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Count</TableCell>
                  <TableCell>Warehouse</TableCell>
                  <TableCell>Started</TableCell>
                  <TableCell sx={{ minWidth: 150 }}>Progress</TableCell>
                  <TableCell>Write-off</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.rows.map((c) => (
                  <TableRow key={c.id} hover sx={{ cursor: "pointer" }} onClick={() => nav(`/stock-counts/${c.id}`)}>
                    <TableCell sx={{ fontFamily: "monospace", fontWeight: 700 }}>{c.countNumber}</TableCell>
                    <TableCell>{c.warehouse.name}</TableCell>
                    <TableCell>
                      {dateOnly(c.startedAt)}
                      <Typography variant="caption" color="text.secondary" component="div">
                        {c.startedBy.fullName}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">
                        {c.totals.countedLines} of {c.totals.lines} batches counted
                      </Typography>
                      <LinearProgress variant="determinate" value={c.totals.lines ? (c.totals.countedLines / c.totals.lines) * 100 : 0} sx={{ height: 6, borderRadius: 3 }} />
                    </TableCell>
                    <TableCell>{c.adjustment ? `${c.adjustment.adjustmentNumber} (${c.adjustment.status.toLowerCase().replace("_", " ")})` : "—"}</TableCell>
                    <TableCell>
                      <Chip size="small" color={STATUS[c.status].color} label={STATUS[c.status].label} />
                    </TableCell>
                  </TableRow>
                ))}
                {data.loaded && !data.rows.length ? (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <Typography variant="body2" color="text.secondary">
                        No counts yet.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
      {starting ? <StartDialog me={me} onClose={() => setStarting(false)} onStarted={(c) => nav(`/stock-counts/${c.id}`)} /> : null}
    </Box>
  );
}

function FoundDialog({ count, onClose, onAdded }) {
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({ productId: count.productId || "", batchNo: "", expiryDate: "", countedBoxes: "", note: "" });
  const [err, setErr] = useState("");
  useEffect(() => {
    api.get(`/api/products?implementationId=${encodeURIComponent(count.implementationId)}`).then((res) => setProducts(res.data || []));
  }, [count.implementationId]);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const add = async () => {
    setErr("");
    try {
      const res = await api.post(`/api/stock-counts/${count.id}/lines`, { ...form, countedBoxes: Number(form.countedBoxes) });
      onAdded(res.data);
    } catch (e) {
      setErr(e?.response?.data?.message || e.message);
    }
  };
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Add stock found</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {err ? <Alert severity="error">{err}</Alert> : null}
          <Typography variant="body2" color="text.secondary">
            Cartons you found that are not on the sheet. They are recorded as a surplus to investigate (stock is not added automatically).
          </Typography>
          <FormControl fullWidth>
            <InputLabel>Product</InputLabel>
            <Select label="Product" value={form.productId} onChange={set("productId")} disabled={!!count.productId}>
              {products.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Stack direction="row" spacing={2}>
            <TextField label="Batch" value={form.batchNo} onChange={set("batchNo")} fullWidth />
            <TextField label="Expiry" type="date" value={form.expiryDate} onChange={set("expiryDate")} InputLabelProps={{ shrink: true }} fullWidth />
          </Stack>
          <TextField label="Cartons counted" type="number" value={form.countedBoxes} onChange={set("countedBoxes")} />
          <TextField label="Where / note" value={form.note} onChange={set("note")} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={add}>
          Add
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function StockCountSheet() {
  const { countId } = useParams();
  const nav = useNavigate();
  const [count, setCount] = useState(null);
  const [error, setError] = useState("");
  const [drafts, setDrafts] = useState({});
  const [showExpected, setShowExpected] = useState(false);
  const [saving, setSaving] = useState(false);
  const [found, setFound] = useState(false);
  const [result, setResult] = useState(null);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    api
      .get(`/api/stock-counts/${countId}`)
      .then((res) => setCount(res.data))
      .catch((e) => setError(e?.response?.data?.message || e.message));
  }, [countId]);

  const dirty = useMemo(() => Object.keys(drafts).length > 0, [drafts]);
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!count) return <LinearProgress />;
  const editable = count.canEdit;
  const reveal = showExpected || count.status !== "IN_PROGRESS";
  const valueOf = (l) => (drafts[l.id] !== undefined ? drafts[l.id] : l.countedBoxes ?? "");

  const save = async () => {
    if (!dirty) return count;
    setSaving(true);
    try {
      const res = await api.patch(`/api/stock-counts/${count.id}/lines`, {
        lines: Object.entries(drafts).map(([id, v]) => ({ id, countedBoxes: v === "" ? null : Number(v) })),
      });
      setCount(res.data);
      setDrafts({});
      return res.data;
    } catch (e) {
      setError(e?.response?.data?.message || e.message);
      return null;
    } finally {
      setSaving(false);
    }
  };

  const submit = async () => {
    setConfirm(false);
    const saved = await save();
    if (!saved) return;
    setSaving(true);
    try {
      const res = await api.post(`/api/stock-counts/${count.id}/submit`, {});
      setCount(res.data);
      setResult(res.data.result);
    } catch (e) {
      setError(e?.response?.data?.message || e.message);
    } finally {
      setSaving(false);
    }
  };

  const counted = count.lines.filter((l) => valueOf(l) !== "").length;

  return (
    <Box sx={{ display: "grid", gap: 2.5 }}>
      <Card>
        <CardContent>
          <Button size="small" startIcon={<ArrowBackIcon />} onClick={() => nav("/stock-counts")} sx={{ ml: -1, mb: 0.5 }}>
            All counts
          </Button>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} justifyContent="space-between" alignItems={{ xs: "stretch", md: "center" }}>
            <Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="h6" fontWeight={900} sx={{ fontFamily: "monospace" }}>
                  {count.countNumber}
                </Typography>
                <Chip size="small" color={STATUS[count.status].color} label={STATUS[count.status].label} />
              </Stack>
              <Typography variant="body2" color="text.secondary">
                {count.warehouse.name} · started {dateTime(count.startedAt)} by {count.startedBy.fullName}
                {count.submittedAt ? ` · ${count.status === "CANCELLED" ? "cancelled" : "submitted"} ${dateTime(count.submittedAt)}` : ""}
                {count.note ? ` · ${count.note}` : ""}
              </Typography>
            </Box>
            {editable ? (
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ whiteSpace: "nowrap", flexShrink: 0 }}>
                <Button onClick={() => setFound(true)} startIcon={<AddIcon />}>
                  Stock found
                </Button>
                <Button variant="outlined" onClick={save} disabled={!dirty || saving}>
                  {saving ? "Saving…" : "Save"}
                </Button>
                <Button variant="contained" startIcon={<FactCheckOutlinedIcon />} onClick={() => setConfirm(true)} disabled={saving || counted < count.lines.length}>
                  Submit count
                </Button>
                <Button
                  color="error"
                  onClick={async () => {
                    if (!window.confirm("Cancel this count? Entered numbers are kept for the record but nothing is adjusted.")) return;
                    const res = await api.post(`/api/stock-counts/${count.id}/cancel`, {});
                    setCount(res.data);
                  }}
                >
                  Cancel count
                </Button>
              </Stack>
            ) : null}
          </Stack>
        </CardContent>
      </Card>

      {result ? (
        <Alert severity={result.shortageBoxes ? "warning" : "success"}>
          Count submitted. {result.shortageBoxes ? `${result.shortageBoxes} carton(s) short: write-off request created and waiting for approval in Adjustments & Losses.` : "No shortages."}{" "}
          {result.surplusBoxes ? `${result.surplusBoxes} carton(s) more than expected: investigate (stock is not added automatically).` : ""}
          {result.groupsArrivedDuringCount ? ` ${result.groupsArrivedDuringCount} batch(es) arrived during the count and were not part of it.` : ""}
        </Alert>
      ) : null}
      {count.adjustment ? (
        <Alert severity="info" action={<Button onClick={() => nav("/stock-adjustments")}>Open</Button>}>
          Shortages from this count: write-off {count.adjustment.adjustmentNumber} ({count.adjustment.status.toLowerCase().replace("_", " ")}).
        </Alert>
      ) : null}

      <Card>
        <CardContent sx={{ display: "grid", gap: 1.5 }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="space-between" alignItems={{ sm: "center" }}>
            <Typography variant="body2" color="text.secondary">
              {counted} of {count.lines.length} batches counted · enter 0 where nothing is found
            </Typography>
            {count.status === "IN_PROGRESS" ? (
              <FormControlLabel control={<Switch checked={showExpected} onChange={(e) => setShowExpected(e.target.checked)} />} label="Show expected quantities" />
            ) : null}
          </Stack>
          {!reveal ? (
            <Alert severity="info" variant="outlined" sx={{ py: 0 }}>
              Blind count: expected quantities are hidden so counters write what they see.
            </Alert>
          ) : null}
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Product</TableCell>
                  <TableCell>Batch</TableCell>
                  <TableCell>Expiry</TableCell>
                  <TableCell>Donor</TableCell>
                  {reveal ? <TableCell align="right">Expected</TableCell> : null}
                  <TableCell align="right" sx={{ minWidth: 120 }}>
                    Counted (cartons)
                  </TableCell>
                  {reveal ? <TableCell align="right">Difference</TableCell> : null}
                </TableRow>
              </TableHead>
              <TableBody>
                {count.lines.map((l) => {
                  const v = valueOf(l);
                  const diff = v === "" ? null : Number(v) - l.expectedBoxes;
                  return (
                    <TableRow key={l.id}>
                      <TableCell>
                        {l.productName}
                        {l.addedByCounter ? <Chip size="small" label="Found" sx={{ ml: 1, height: 20 }} /> : null}
                      </TableCell>
                      <TableCell sx={{ fontFamily: "monospace" }}>{l.batchNo}</TableCell>
                      <TableCell>{dateOnly(l.expiryDate)}</TableCell>
                      <TableCell>{l.donorName}</TableCell>
                      {reveal ? <TableCell align="right">{l.expectedBoxes}</TableCell> : null}
                      <TableCell align="right">
                        {editable ? (
                          <TextField
                            size="small"
                            type="number"
                            value={v}
                            onChange={(e) => setDrafts((d) => ({ ...d, [l.id]: e.target.value }))}
                            inputProps={{ min: 0, style: { textAlign: "right" } }}
                            sx={{ width: 110 }}
                          />
                        ) : (
                          l.countedBoxes ?? "—"
                        )}
                      </TableCell>
                      {reveal ? (
                        <TableCell align="right" sx={{ fontWeight: 700, color: diff < 0 ? "error.main" : diff > 0 ? "warning.main" : "success.main" }}>
                          {diff === null ? "" : diff > 0 ? `+${diff}` : diff}
                        </TableCell>
                      ) : null}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {found ? (
        <FoundDialog
          count={count}
          onClose={() => setFound(false)}
          onAdded={(c) => {
            setCount(c);
            setFound(false);
          }}
        />
      ) : null}
      <Dialog open={confirm} onClose={() => setConfirm(false)} fullWidth maxWidth="xs">
        <DialogTitle>Submit count?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Anchor compares your numbers with stock now ({isoDay()}). Shortages become a write-off request for an administrator to approve; the sheet can no longer be edited.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(false)}>Back</Button>
          <Button variant="contained" onClick={submit}>
            Submit
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
