import React, { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
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
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import PauseCircleOutlineIcon from "@mui/icons-material/PauseCircleOutline";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";

import { api } from "../api/client";
import { REASON_LABELS, dateOnly, dateTime, moneyMap } from "../components/warehouse/format";
import { openAuthenticatedFile } from "../components/warehouse/poApi";

const STATUS = {
  PENDING_APPROVAL: { label: "Awaiting approval", color: "warning" },
  APPROVED: { label: "Approved", color: "success" },
  REJECTED: { label: "Rejected", color: "error" },
  CANCELLED: { label: "Cancelled", color: "default" },
};
const isOperator = (me) => ["SUPER_ADMIN", "COUNTRY_ADMIN", "WAREHOUSE_OFFICER"].includes(me?.role);
const newKey = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

/** Warehouses the user may act in (officers: their own). */
function useOperableWarehouses(me) {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    if (!me) return undefined;
    let mounted = true;
    api
      .get("/api/warehouses")
      .then((res) => {
        let list = res.data?.rows || [];
        if (me.role === "WAREHOUSE_OFFICER") list = list.filter((w) => w.id === me.warehouseId);
        if (mounted) setRows(list);
      })
      .catch(() => mounted && setRows([]));
    return () => {
      mounted = false;
    };
  }, [me]);
  return rows;
}

/** Batches in stock at a warehouse (from the warehouse twin). */
function useWarehouseBatches(warehouseId, reload = 0) {
  const [state, setState] = useState({ key: null, batches: [] });
  const key = `${warehouseId}:${reload}`;
  useEffect(() => {
    if (!warehouseId) return undefined;
    let mounted = true;
    api
      .get(`/api/warehouses/${warehouseId}/twin`)
      .then((res) => mounted && setState({ key, batches: res.data?.batches || [] }))
      .catch(() => mounted && setState({ key, batches: [] }));
    return () => {
      mounted = false;
    };
  }, [warehouseId, key]);
  return { batches: state.key === key ? state.batches : [], loading: !!warehouseId && state.key !== key };
}

function BatchPicker({ batches, rows, setRows, allowHeld = true }) {
  const usable = batches.filter((b) => allowHeld || !b.onHold);
  const byKey = new Map(usable.map((b) => [b.key, b]));
  return (
    <Stack spacing={1}>
      {rows.map((r, i) => {
        const b = byKey.get(r.batchKey);
        return (
          <Stack key={r.key} direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
            <Select size="small" displayEmpty value={r.batchKey} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, batchKey: e.target.value } : x)))} sx={{ flexGrow: 1, minWidth: 0 }}>
              <MenuItem value="" disabled>
                Choose batch
              </MenuItem>
              {usable.map((x) => (
                <MenuItem key={x.key} value={x.key} disabled={x.pendingWriteOff}>
                  {x.productName} · {x.batchNo} · exp {dateOnly(x.expiryDate)} · {x.donorName} · {x.boxes} boxes{x.onHold ? " · on hold" : ""}
                </MenuItem>
              ))}
            </Select>
            <TextField
              size="small"
              type="number"
              label="Boxes"
              value={r.boxes}
              onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, boxes: e.target.value } : x)))}
              inputProps={{ min: 1, max: b?.boxes || undefined }}
              sx={{ width: 110 }}
            />
            <IconButton size="small" onClick={() => setRows(rows.filter((_, j) => j !== i))}>
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Stack>
        );
      })}
      <Button size="small" startIcon={<AddIcon />} onClick={() => setRows([...rows, { key: newKey(), batchKey: "", boxes: "" }])} sx={{ alignSelf: "flex-start" }}>
        Add batch
      </Button>
    </Stack>
  );
}

function batchSelections(rows, batches) {
  const byKey = new Map(batches.map((b) => [b.key, b]));
  return rows
    .filter((r) => r.batchKey && Number(r.boxes) > 0)
    .map((r) => {
      const b = byKey.get(r.batchKey);
      return { productId: b.productId, batchNo: b.batchNo, expiryDate: b.expiryDate, donorId: b.donorId, boxes: Number(r.boxes) };
    });
}

const uidList = (text) =>
  text
    .split(/[\s,;]+/)
    .map((x) => x.trim())
    .filter(Boolean);

function RequestDialog({ warehouses, onClose, onDone }) {
  const [warehouseId, setWarehouseId] = useState(warehouses.length === 1 ? warehouses[0].id : "");
  const { batches, loading } = useWarehouseBatches(warehouseId);
  const [reason, setReason] = useState("DAMAGED");
  const [note, setNote] = useState("");
  const [rows, setRows] = useState([{ key: newKey(), batchKey: "", boxes: "" }]);
  const [uids, setUids] = useState("");
  const [expiredOnly, setExpiredOnly] = useState(false);
  const [partial, setPartial] = useState([]);
  const [file, setFile] = useState(null);
  const [idem] = useState(newKey);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const expiredCount = batches.filter((b) => b.expiryBand === "EXPIRED" && !b.pendingWriteOff).reduce((s, b) => s + b.boxes, 0);

  const submit = async () => {
    setErr("");
    const body = {
      warehouseId,
      reason,
      note,
      batches: expiredOnly ? [] : batchSelections(rows, batches),
      boxUids: expiredOnly ? [] : uidList(uids),
      expiredOnly,
      partial: partial.filter((p) => p.boxUid.trim() && Number(p.units) > 0).map((p) => ({ boxUid: p.boxUid.trim(), units: Number(p.units) })),
    };
    if (!warehouseId) return setErr("Choose the warehouse");
    if (!body.expiredOnly && !body.batches.length && !body.boxUids.length && !body.partial.length) return setErr("Choose the boxes to write off");
    try {
      setSaving(true);
      const res = await api.post("/api/stock-adjustments", body, { headers: { "X-Idempotency-Key": idem } });
      if (file) {
        await api.post(`/api/stock-adjustments/${res.data.id}/documents`, file, {
          headers: { "Content-Type": file.type, "X-File-Name": encodeURIComponent(file.name) },
          transformRequest: [(d) => d],
        });
      }
      onDone(res.data);
    } catch (e) {
      setErr(e?.response?.data?.message || e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onClose={saving ? undefined : onClose} fullWidth maxWidth="md">
      <DialogTitle>Request a write-off</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {err ? <Alert severity="error">{err}</Alert> : null}
          <Alert severity="info" variant="outlined">
            The boxes go on hold now and leave stock only when an administrator (not you) approves.
          </Alert>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
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
              <InputLabel>Reason</InputLabel>
              <Select label="Reason" value={reason} onChange={(e) => setReason(e.target.value)}>
                {Object.entries(REASON_LABELS)
                  .filter(([k]) => k !== "COUNT_VARIANCE")
                  .map(([k, v]) => (
                    <MenuItem key={k} value={k}>
                      {v}
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>
          </Stack>
          <TextField label="What happened?" value={note} onChange={(e) => setNote(e.target.value)} multiline minRows={2} helperText="Required for damage, loss, theft and contamination. Mention reports (police, incident) where relevant." />
          {loading ? <LinearProgress /> : null}
          {reason === "EXPIRED" ? (
            <FormControlLabel
              control={<Checkbox checked={expiredOnly} onChange={(e) => setExpiredOnly(e.target.checked)} />}
              label={`All expired stock in this warehouse (${expiredCount} boxes)`}
            />
          ) : null}
          {!expiredOnly ? (
            <>
              <Typography fontWeight={700}>Whole boxes, by batch</Typography>
              <BatchPicker batches={batches} rows={rows} setRows={setRows} />
              <TextField label="…or box IDs (scan or type, one per line)" value={uids} onChange={(e) => setUids(e.target.value)} multiline minRows={2} />
              <Typography fontWeight={700}>Part of a box</Typography>
              <Typography variant="caption" color="text.secondary">
                When only some units in a carton are damaged; the rest stay in stock.
              </Typography>
              {partial.map((p, i) => (
                <Stack key={p.key} direction="row" spacing={1} alignItems="center">
                  <TextField size="small" label="Box ID" value={p.boxUid} onChange={(e) => setPartial(partial.map((x, j) => (j === i ? { ...x, boxUid: e.target.value } : x)))} sx={{ flexGrow: 1 }} />
                  <TextField size="small" type="number" label="Units" value={p.units} onChange={(e) => setPartial(partial.map((x, j) => (j === i ? { ...x, units: e.target.value } : x)))} sx={{ width: 110 }} />
                  <IconButton size="small" onClick={() => setPartial(partial.filter((_, j) => j !== i))}>
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Stack>
              ))}
              <Button size="small" startIcon={<AddIcon />} onClick={() => setPartial([...partial, { key: newKey(), boxUid: "", units: "" }])} sx={{ alignSelf: "flex-start" }}>
                Add part box
              </Button>
            </>
          ) : null}
          <Divider />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }}>
            <Button component="label" variant="outlined" startIcon={<UploadFileIcon />}>
              {file ? "Change evidence" : "Attach evidence"}
              <input hidden type="file" accept="application/pdf,image/jpeg,image/png" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </Button>
            <Typography variant="body2" color="text.secondary">
              {file ? file.name : "Photos of the damage, incident or police report (PDF, JPEG, PNG)"}
            </Typography>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button variant="contained" onClick={submit} disabled={saving}>
          {saving ? "Submitting…" : "Submit for approval"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function HoldDialog({ warehouses, onClose, onDone }) {
  const [warehouseId, setWarehouseId] = useState(warehouses.length === 1 ? warehouses[0].id : "");
  const [reload, setReload] = useState(0);
  const { batches, loading } = useWarehouseBatches(warehouseId, reload);
  const [rows, setRows] = useState([{ key: newKey(), batchKey: "", boxes: "" }]);
  const [uids, setUids] = useState("");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const held = batches.filter((b) => b.onHold);

  const run = async (fn) => {
    setErr("");
    setMsg("");
    try {
      const m = await fn();
      setMsg(m);
      setReload((r) => r + 1);
      onDone();
    } catch (e) {
      setErr(e?.response?.data?.message || e.message);
    }
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Hold / release stock</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {err ? <Alert severity="error">{err}</Alert> : null}
          {msg ? <Alert severity="success">{msg}</Alert> : null}
          <Typography variant="body2" color="text.secondary">
            Held stock stays in the warehouse but cannot be dispatched (suspected damage, recall, quality check). Release it when cleared, or request a write-off.
          </Typography>
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
          {loading ? <LinearProgress /> : null}
          <Typography fontWeight={700}>Put on hold</Typography>
          <BatchPicker batches={batches.filter((b) => !b.onHold)} rows={rows} setRows={setRows} allowHeld={false} />
          <TextField label="…or box IDs" value={uids} onChange={(e) => setUids(e.target.value)} multiline minRows={2} />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <TextField size="small" label="Reason for hold" value={reason} onChange={(e) => setReason(e.target.value)} sx={{ flexGrow: 1 }} />
            <Button
              variant="contained"
              startIcon={<PauseCircleOutlineIcon />}
              disabled={!warehouseId || !reason.trim()}
              onClick={() =>
                run(async () => {
                  const res = await api.post("/api/stock-adjustments/holds", { warehouseId, reason, batches: batchSelections(rows, batches), boxUids: uidList(uids) });
                  setRows([{ key: newKey(), batchKey: "", boxes: "" }]);
                  setUids("");
                  return `${res.data.held} box(es) put on hold`;
                })
              }
            >
              Hold
            </Button>
          </Stack>
          <Divider />
          <Typography fontWeight={700}>On hold now</Typography>
          {!held.length ? (
            <Typography variant="body2" color="text.secondary">
              Nothing on hold.
            </Typography>
          ) : (
            <Table size="small">
              <TableBody>
                {held.map((b) => (
                  <TableRow key={b.key}>
                    <TableCell>
                      {b.productName} · {b.batchNo}
                      <Typography variant="caption" color="text.secondary" component="div">
                        {b.holdReason}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">{b.boxes} boxes</TableCell>
                    <TableCell align="right">
                      {b.pendingWriteOff ? (
                        <Chip size="small" label="Pending write-off" />
                      ) : (
                        <Button
                          size="small"
                          onClick={() =>
                            run(async () => {
                              const res = await api.post("/api/stock-adjustments/holds/release", {
                                warehouseId,
                                // The exact held boxes (the twin lists up to 200 per batch).
                                ...(b.boxUids.length >= b.boxes
                                  ? { boxUids: b.boxUids }
                                  : { batches: [{ productId: b.productId, batchNo: b.batchNo, expiryDate: b.expiryDate, donorId: b.donorId, boxes: b.boxes }] }),
                              });
                              return `${res.data.released} box(es) released`;
                            })
                          }
                        >
                          Release
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

function DetailDialog({ adj, onClose, onChanged }) {
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const act = async (action) => {
    setErr("");
    try {
      setBusy(true);
      await api.post(`/api/stock-adjustments/${adj.id}/${action}`, { note });
      onChanged();
    } catch (e) {
      setErr(e?.response?.data?.message || e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>
        {adj.adjustmentNumber} · {REASON_LABELS[adj.reason]}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {err ? <Alert severity="error">{err}</Alert> : null}
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip size="small" color={STATUS[adj.status].color} label={STATUS[adj.status].label} />
            <Chip size="small" variant="outlined" label={adj.warehouse.name} />
            {adj.stockCount ? <Chip size="small" variant="outlined" label={`From count ${adj.stockCount.countNumber}`} /> : null}
          </Stack>
          <Typography variant="body2">
            Requested by <b>{adj.requestedBy.fullName}</b> on {dateTime(adj.requestedAt)}
            {adj.decidedBy ? (
              <>
                {" "}
                · {STATUS[adj.status].label.toLowerCase()} by <b>{adj.decidedBy.fullName}</b> on {dateTime(adj.decidedAt)}
              </>
            ) : null}
          </Typography>
          {adj.note ? <Alert severity="info" variant="outlined">{adj.note}</Alert> : null}
          {adj.decisionNote ? <Alert severity={adj.status === "APPROVED" ? "success" : "warning"} variant="outlined">Decision: {adj.decisionNote}</Alert> : null}
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Product</TableCell>
                  <TableCell>Batch</TableCell>
                  <TableCell>Donor</TableCell>
                  <TableCell align="right">Boxes</TableCell>
                  <TableCell align="right">Units</TableCell>
                  <TableCell align="right">Value</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {adj.groups.map((g) => (
                  <TableRow key={`${g.product}${g.batchNo}${g.donor}`}>
                    <TableCell>{g.product}</TableCell>
                    <TableCell>
                      {g.batchNo}
                      <Typography variant="caption" color="text.secondary" component="div">
                        exp {dateOnly(g.expiryDate)}
                      </Typography>
                    </TableCell>
                    <TableCell>{g.donor}</TableCell>
                    <TableCell align="right">
                      {g.boxes}
                      {g.fullBoxes < g.boxes ? (
                        <Typography variant="caption" color="text.secondary" component="div">
                          {g.boxes - g.fullBoxes} partly
                        </Typography>
                      ) : null}
                    </TableCell>
                    <TableCell align="right">{g.units.toLocaleString()}</TableCell>
                    <TableCell align="right">{moneyMap(g.currency ? { [g.currency]: g.value } : {})}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Typography variant="caption" color="text.secondary">
            Box IDs: {adj.groups.flatMap((g) => g.boxUids).slice(0, 40).join(", ")}
            {adj.totals.boxes > 40 ? " …" : ""}
          </Typography>
          {adj.documents.length ? (
            <Stack spacing={0.5}>
              {adj.documents.map((d) => (
                <Button
                  key={d.id}
                  size="small"
                  startIcon={<DescriptionOutlinedIcon />}
                  sx={{ justifyContent: "flex-start" }}
                  onClick={async () => {
                    const m = await openAuthenticatedFile(`/api/stock-adjustments/${adj.id}/documents/${d.id}`, d.mimeType);
                    if (m) setErr(m);
                  }}
                >
                  {d.fileName}
                </Button>
              ))}
            </Stack>
          ) : (
            <Alert severity="warning" variant="outlined">
              No evidence attached.
            </Alert>
          )}
          {adj.canApprove || adj.canCancel ? <TextField label={adj.canApprove ? "Decision note (required to reject)" : "Note"} value={note} onChange={(e) => setNote(e.target.value)} multiline minRows={2} /> : null}
          {adj.status === "PENDING_APPROVAL" && !adj.canApprove && !adj.canCancel ? (
            <Typography variant="body2" color="text.secondary">
              Waiting for a Country Admin or Super Admin (other than the requester) to decide.
            </Typography>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        {adj.canCancel ? (
          <Button onClick={() => act("cancel")} disabled={busy}>
            Cancel request
          </Button>
        ) : null}
        {adj.canApprove ? (
          <>
            <Button color="error" onClick={() => act("reject")} disabled={busy}>
              Reject
            </Button>
            <Button variant="contained" onClick={() => act("approve")} disabled={busy}>
              Approve write-off
            </Button>
          </>
        ) : null}
      </DialogActions>
    </Dialog>
  );
}

export default function StockAdjustments() {
  const { me } = useOutletContext();
  const warehouses = useOperableWarehouses(me);
  const [status, setStatus] = useState("PENDING_APPROVAL");
  const [reload, setReload] = useState(0);
  const [data, setData] = useState({ key: null, rows: [], error: "" });
  const [dialog, setDialog] = useState(null);
  const [open, setOpen] = useState(null);
  const [notice, setNotice] = useState("");
  const params = useMemo(() => (status ? { status } : {}), [status]);
  const key = `${status}:${reload}`;

  useEffect(() => {
    let mounted = true;
    api
      .get("/api/stock-adjustments", { params })
      .then((res) => mounted && setData({ key, rows: res.data?.rows || [], error: "" }))
      .catch((e) => mounted && setData({ key, rows: [], error: e?.response?.data?.message || e.message }));
    return () => {
      mounted = false;
    };
  }, [params, key]);
  const refresh = () => setReload((r) => r + 1);
  const loading = data.key !== key;

  return (
    <Box sx={{ display: "grid", gap: 2.5 }}>
      <Card>
        <CardContent>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} justifyContent="space-between" alignItems={{ xs: "stretch", md: "center" }}>
            <Box>
              <Typography variant="h6" fontWeight={900}>
                Adjustments &amp; Losses
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Hold suspect stock and write off expired, damaged or lost stock. Every write-off needs approval by an administrator other than the requester.
              </Typography>
            </Box>
            {isOperator(me) && warehouses.length ? (
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ whiteSpace: "nowrap", flexShrink: 0 }}>
                <Button variant="outlined" startIcon={<PauseCircleOutlineIcon />} onClick={() => setDialog("hold")}>
                  Hold / release
                </Button>
                <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialog("request")}>
                  Request write-off
                </Button>
              </Stack>
            ) : null}
          </Stack>
        </CardContent>
      </Card>
      {notice ? (
        <Alert severity="success" onClose={() => setNotice("")}>
          {notice}
        </Alert>
      ) : null}

      <Card>
        <Tabs value={status} onChange={(_, v) => setStatus(v)} variant="scrollable" allowScrollButtonsMobile sx={{ px: 2, borderBottom: 1, borderColor: "divider" }}>
          <Tab value="PENDING_APPROVAL" label="Awaiting approval" />
          <Tab value="APPROVED" label="Approved" />
          <Tab value="REJECTED" label="Rejected" />
          <Tab value="CANCELLED" label="Cancelled" />
          <Tab value="" label="All" />
        </Tabs>
        <CardContent>
          {loading ? <LinearProgress /> : null}
          {data.error ? <Alert severity="error">{data.error}</Alert> : null}
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Reference</TableCell>
                  <TableCell>Warehouse</TableCell>
                  <TableCell>Reason</TableCell>
                  <TableCell align="right">Boxes</TableCell>
                  <TableCell align="right">Units</TableCell>
                  <TableCell align="right">Value</TableCell>
                  <TableCell>Requested</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.rows.map((a) => (
                  <TableRow key={a.id} hover sx={{ cursor: "pointer" }} onClick={() => setOpen(a)}>
                    <TableCell sx={{ fontFamily: "monospace", fontWeight: 700 }}>{a.adjustmentNumber}</TableCell>
                    <TableCell>{a.warehouse.name}</TableCell>
                    <TableCell>{REASON_LABELS[a.reason]}</TableCell>
                    <TableCell align="right">{a.totals.boxes}</TableCell>
                    <TableCell align="right">{a.totals.units.toLocaleString()}</TableCell>
                    <TableCell align="right">{moneyMap(a.totals.value)}</TableCell>
                    <TableCell>
                      {dateOnly(a.requestedAt)}
                      <Typography variant="caption" color="text.secondary" component="div">
                        {a.requestedBy.fullName}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip size="small" color={STATUS[a.status].color} label={a.canApprove ? "Needs your approval" : STATUS[a.status].label} variant={a.canApprove ? "filled" : "outlined"} />
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && !data.rows.length ? (
                  <TableRow>
                    <TableCell colSpan={8}>
                      <Typography variant="body2" color="text.secondary">
                        Nothing here.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {dialog === "request" ? (
        <RequestDialog
          warehouses={warehouses}
          onClose={() => setDialog(null)}
          onDone={(adj) => {
            setDialog(null);
            setNotice(`${adj.adjustmentNumber} submitted: ${adj.totals.boxes} box(es) on hold awaiting approval.`);
            setStatus("PENDING_APPROVAL");
            refresh();
          }}
        />
      ) : null}
      {dialog === "hold" ? <HoldDialog warehouses={warehouses} onClose={() => setDialog(null)} onDone={refresh} /> : null}
      {open ? (
        <DetailDialog
          key={open.id}
          adj={open}
          onClose={() => setOpen(null)}
          onChanged={() => {
            setOpen(null);
            refresh();
          }}
        />
      ) : null}
    </Box>
  );
}
