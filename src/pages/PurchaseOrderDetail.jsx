import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
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
  Divider,
  IconButton,
  LinearProgress,
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
  Tooltip,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import InventoryIcon from "@mui/icons-material/Inventory";
import PrintOutlinedIcon from "@mui/icons-material/PrintOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import AddIcon from "@mui/icons-material/Add";
import BlockIcon from "@mui/icons-material/Block";

import { api } from "../api/client";
import { PO_STATUS, dateOnly, dateTime, isoDay, money } from "../components/warehouse/format";
import { labelSheetUrl, openAuthenticatedFile, uploadPoDocument } from "../components/warehouse/poApi";

const newKey = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

function Stat({ label, value, hint }) {
  return (
    <Card variant="outlined">
      <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
        <Typography variant="caption" color="text.secondary" fontWeight={600}>
          {label}
        </Typography>
        <Typography variant="h6" fontWeight={800}>
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

function ReceiveDialog({ po, onClose, onDone }) {
  const open = po.lines.filter((l) => l.outstandingPacks > 0);
  const [idemKey] = useState(newKey);
  const [rows, setRows] = useState(() => open.map((l) => ({ key: newKey(), lineId: l.id, batchNo: "", expiryDate: "", packs: String(l.outstandingPacks) })));
  const [meta, setMeta] = useState({ receivedAt: isoDay(), deliveryNote: "", waybillNo: "", note: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState(null);
  const lineMap = useMemo(() => new Map(po.lines.map((l) => [l.id, l])), [po.lines]);
  const setRow = (key, f, v) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, [f]: v } : r)));

  const perLine = new Map();
  rows.forEach((r) => perLine.set(r.lineId, (perLine.get(r.lineId) || 0) + (Number(r.packs) || 0)));
  const totalBoxes = rows.reduce((s, r) => s + (Number(r.packs) || 0), 0);

  const submit = async () => {
    setErr("");
    const today = isoDay();
    const use = rows.filter((r) => Number(r.packs) > 0);
    if (!use.length) return setErr("Enter the quantity received on at least one row");
    for (const [i, r] of use.entries()) {
      if (!r.batchNo.trim()) return setErr(`Row ${i + 1}: enter the batch number printed on the cartons`);
      if (!r.expiryDate) return setErr(`Row ${i + 1}: enter the expiry date`);
      if (r.expiryDate < today) return setErr(`Row ${i + 1}: this batch is expired; do not receive it`);
      if (!Number.isInteger(Number(r.packs))) return setErr(`Row ${i + 1}: quantity must be a whole number`);
    }
    for (const [lineId, packs] of perLine) {
      const l = lineMap.get(lineId);
      if (packs > l.outstandingPacks) return setErr(`Line ${l.lineNo} (${l.product.name}): ${packs} entered but only ${l.outstandingPacks} outstanding`);
    }
    try {
      setSaving(true);
      const res = await api.post(
        `/api/purchase-orders/${po.id}/receipts`,
        { ...meta, lines: use.map((r) => ({ lineId: r.lineId, batchNo: r.batchNo.trim(), expiryDate: r.expiryDate, packs: Number(r.packs) })) },
        { headers: { "X-Idempotency-Key": idemKey } }
      );
      setResult(res.data);
      onDone();
    } catch (e) {
      setErr(e?.response?.data?.message || e.message);
    } finally {
      setSaving(false);
    }
  };

  if (result) {
    return (
      <Dialog open onClose={onClose} fullWidth maxWidth="sm">
        <DialogTitle>Goods received</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity="success">
              {result.grnNumber}: {result.createdCount.toLocaleString()} boxes added to stock, each with its own QR label.
            </Alert>
            <Typography variant="body2" color="text.secondary">
              Print the labels now and stick one on each carton. Box numbers start at {result.sample?.[0]}.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Close</Button>
          <Button
            variant="contained"
            startIcon={<PrintOutlinedIcon />}
            onClick={async () => {
              const m = await openAuthenticatedFile(labelSheetUrl(result.orderId, result.receipt.id), "application/pdf");
              if (m) setErr(m);
            }}
          >
            Print labels
          </Button>
        </DialogActions>
        {err ? <Alert severity="error">{err}</Alert> : null}
      </Dialog>
    );
  }

  return (
    <Dialog open onClose={saving ? undefined : onClose} fullWidth maxWidth="lg">
      <DialogTitle>Receive goods · {po.poNumber}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {err ? <Alert severity="error">{err}</Alert> : null}
          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0,1fr))" } }}>
            <TextField type="date" label="Date received" value={meta.receivedAt} onChange={(e) => setMeta((m) => ({ ...m, receivedAt: e.target.value }))} InputLabelProps={{ shrink: true }} inputProps={{ max: isoDay() }} />
            <TextField label="Supplier delivery note no." value={meta.deliveryNote} onChange={(e) => setMeta((m) => ({ ...m, deliveryNote: e.target.value }))} />
            <TextField label="Waybill no." value={meta.waybillNo} onChange={(e) => setMeta((m) => ({ ...m, waybillNo: e.target.value }))} />
          </Box>
          <Typography variant="body2" color="text.secondary">
            One row per batch. If a line arrived in two batches, add a second row for it. Leave quantity at 0 for lines that did not arrive.
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ minWidth: 240 }}>PO line</TableCell>
                  <TableCell sx={{ minWidth: 150 }}>Batch no.</TableCell>
                  <TableCell sx={{ minWidth: 150 }}>Expiry date</TableCell>
                  <TableCell sx={{ minWidth: 120 }}>Cartons received</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((r) => {
                  const l = lineMap.get(r.lineId);
                  const over = (perLine.get(r.lineId) || 0) > (l?.outstandingPacks || 0);
                  return (
                    <TableRow key={r.key}>
                      <TableCell>
                        <Select size="small" fullWidth value={r.lineId} onChange={(e) => setRow(r.key, "lineId", e.target.value)}>
                          {open.map((x) => (
                            <MenuItem key={x.id} value={x.id}>
                              {x.lineNo}. {x.product.name} · {x.donor.name} · {x.outstandingPacks} outstanding
                            </MenuItem>
                          ))}
                        </Select>
                      </TableCell>
                      <TableCell>
                        <TextField size="small" value={r.batchNo} onChange={(e) => setRow(r.key, "batchNo", e.target.value)} />
                      </TableCell>
                      <TableCell>
                        <TextField size="small" type="date" value={r.expiryDate} onChange={(e) => setRow(r.key, "expiryDate", e.target.value)} inputProps={{ min: isoDay() }} />
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          type="number"
                          value={r.packs}
                          error={over}
                          helperText={over ? "More than outstanding" : " "}
                          onChange={(e) => setRow(r.key, "packs", e.target.value)}
                          inputProps={{ min: 0, step: 1 }}
                        />
                      </TableCell>
                      <TableCell>
                        <IconButton size="small" disabled={rows.length === 1} onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}>
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Button size="small" startIcon={<AddIcon />} onClick={() => setRows((rs) => [...rs, { key: newKey(), lineId: rs[rs.length - 1]?.lineId || open[0]?.id, batchNo: "", expiryDate: "", packs: "0" }])}>
              Add batch row
            </Button>
            <Typography fontWeight={700}>{totalBoxes.toLocaleString()} boxes will be created</Typography>
          </Stack>
          <TextField label="Notes (damages, shortages…)" value={meta.note} onChange={(e) => setMeta((m) => ({ ...m, note: e.target.value }))} multiline minRows={2} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button variant="contained" onClick={submit} disabled={saving || totalBoxes <= 0}>
          {saving ? "Receiving…" : `Receive ${totalBoxes.toLocaleString()} boxes`}
        </Button>
      </DialogActions>
      {saving ? <LinearProgress /> : null}
    </Dialog>
  );
}

function CloseDialog({ po, onClose, onDone }) {
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const anyReceived = po.totals.receivedPacks > 0;
  const submit = async () => {
    try {
      await api.post(`/api/purchase-orders/${po.id}/close`, { reason });
      onDone();
    } catch (e) {
      setErr(e?.response?.data?.message || e.message);
    }
  };
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{anyReceived ? "Close purchase order short" : "Cancel purchase order"}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {err ? <Alert severity="error">{err}</Alert> : null}
          <Typography variant="body2">
            {anyReceived
              ? `${po.totals.outstandingPacks} packs were never delivered. Closing marks the PO as finished; no more deliveries can be received against it.`
              : "Nothing has been received. The PO will be marked cancelled."}
          </Typography>
          <TextField label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} required multiline minRows={2} autoFocus />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Back</Button>
        <Button color="error" variant="contained" onClick={submit} disabled={!reason.trim()}>
          {anyReceived ? "Close PO" : "Cancel PO"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function PurchaseOrderDetail() {
  const { poId } = useParams();
  const nav = useNavigate();
  const location = useLocation();
  const [reload, setReload] = useState(0);
  const [data, setData] = useState({ key: null, po: null, error: "" });
  const [dialog, setDialog] = useState(null);
  const [notice, setNotice] = useState(location.state?.warning || "");
  const [uploading, setUploading] = useState(false);
  const key = `${poId}:${reload}`;

  useEffect(() => {
    let mounted = true;
    api
      .get(`/api/purchase-orders/${poId}`)
      .then((res) => mounted && setData({ key, po: res.data, error: "" }))
      .catch((e) => mounted && setData({ key, po: null, error: e?.response?.data?.message || e.message }));
    return () => {
      mounted = false;
    };
  }, [poId, key]);

  const refresh = () => setReload((r) => r + 1);
  const po = data.po;
  if (data.error) return <Alert severity="error">{data.error}</Alert>;
  if (!po) return <LinearProgress />;

  const isOpen = ["OPEN", "PARTIALLY_RECEIVED"].includes(po.status);
  const canOperate = !!po.canOperate;
  const donorTotals = Object.values(
    po.lines.reduce((acc, l) => {
      const k = l.donor.id;
      acc[k] = acc[k] || { name: l.donor.name, ordered: 0, received: 0, value: 0, receivedValue: 0, grants: new Set() };
      acc[k].ordered += l.quantityPacks;
      acc[k].received += l.receivedPacks;
      acc[k].value += l.lineValue;
      acc[k].receivedValue += l.receivedValue;
      if (l.grantCode) acc[k].grants.add(l.grantCode);
      return acc;
    }, {})
  );

  const upload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      await uploadPoDocument(po.id, file);
      refresh();
    } catch (e) {
      setNotice(e?.response?.data?.message || e.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Box sx={{ display: "grid", gap: 2.5 }}>
      {notice ? (
        <Alert severity="warning" onClose={() => setNotice("")}>
          {notice}
        </Alert>
      ) : null}
      <Card>
        <CardContent>
          <Button size="small" startIcon={<ArrowBackIcon />} onClick={() => nav("/purchase-orders")} sx={{ ml: -1, mb: 0.5 }}>
            All purchase orders
          </Button>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} justifyContent="space-between" alignItems={{ xs: "stretch", md: "center" }}>
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                <Typography variant="h6" fontWeight={900} sx={{ fontFamily: "monospace" }}>
                  {po.poNumber}
                </Typography>
                <Chip size="small" color={PO_STATUS[po.status]?.color} label={PO_STATUS[po.status]?.label} />
                {po.isOverdue ? <Chip size="small" color="error" variant="outlined" label="Overdue" /> : null}
              </Stack>
              <Typography variant="body2" color="text.secondary">
                {[po.supplierName, `to ${po.destinationWarehouse.name}`, po.orderDate ? `PO date ${dateOnly(po.orderDate)}` : null, po.expectedDeliveryDate ? `expected ${dateOnly(po.expectedDeliveryDate)}` : null, po.currencyCode]
                  .filter(Boolean)
                  .join(" · ")}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Entered by {po.createdBy?.fullName} on {dateOnly(po.createdAt)}
                {po.cancelReason ? ` · Closed: ${po.cancelReason}` : ""}
              </Typography>
            </Box>
            {canOperate && isOpen ? (
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <Button variant="contained" startIcon={<InventoryIcon />} onClick={() => setDialog("receive")}>
                  Receive goods
                </Button>
                <Button variant="outlined" startIcon={<EditOutlinedIcon />} onClick={() => nav(`/purchase-orders/${po.id}/edit`)}>
                  Edit
                </Button>
                <Button color="error" startIcon={<BlockIcon />} onClick={() => setDialog("close")}>
                  {po.totals.receivedPacks > 0 ? "Close short" : "Cancel"}
                </Button>
              </Stack>
            ) : null}
          </Stack>
        </CardContent>
      </Card>

      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "repeat(2, minmax(0,1fr))", md: "repeat(4, minmax(0,1fr))" } }}>
        <Stat label="Ordered" value={po.totals.orderedPacks.toLocaleString()} hint="packs" />
        <Stat label="Received" value={`${po.totals.receivedPacks.toLocaleString()} (${po.totals.percentReceived}%)`} hint={`${po.receipts.length} deliver${po.receipts.length === 1 ? "y" : "ies"}`} />
        <Stat label="Outstanding" value={po.totals.outstandingPacks.toLocaleString()} hint="packs" />
        <Stat label="PO value" value={money(po.totals.value, po.currencyCode)} hint={`received ${money(po.totals.receivedValue, po.currencyCode)}`} />
      </Box>

      <Card>
        <CardContent>
          <Typography fontWeight={800} gutterBottom>
            Lines
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>#</TableCell>
                  <TableCell>Product</TableCell>
                  <TableCell>Donor</TableCell>
                  <TableCell>Grant</TableCell>
                  <TableCell align="right">Ordered</TableCell>
                  <TableCell sx={{ minWidth: 150 }}>Received</TableCell>
                  <TableCell align="right">Unit price</TableCell>
                  <TableCell align="right">Line value</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {po.lines.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>{l.lineNo}</TableCell>
                    <TableCell>
                      {l.product.name}
                      <Typography variant="caption" color="text.secondary" component="div">
                        {l.product.packUnitName} of {l.product.unitsPerPack} {String(l.product.baseUnitName || "").toLowerCase()}s
                      </Typography>
                    </TableCell>
                    <TableCell>{l.donor.name}</TableCell>
                    <TableCell>{l.grantCode || "—"}</TableCell>
                    <TableCell align="right">{l.quantityPacks.toLocaleString()}</TableCell>
                    <TableCell>
                      <Typography variant="caption">
                        {l.receivedPacks.toLocaleString()} · {l.outstandingPacks.toLocaleString()} outstanding
                      </Typography>
                      <LinearProgress variant="determinate" value={l.quantityPacks ? (l.receivedPacks / l.quantityPacks) * 100 : 0} sx={{ height: 6, borderRadius: 3 }} />
                    </TableCell>
                    <TableCell align="right">{money(l.unitPrice, po.currencyCode)}</TableCell>
                    <TableCell align="right">{money(l.lineValue, po.currencyCode)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      <Box sx={{ display: "grid", gap: 2.5, gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" } }}>
        <Card>
          <CardContent>
            <Typography fontWeight={800} gutterBottom>
              Funding by donor
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Donor</TableCell>
                  <TableCell align="right">Ordered</TableCell>
                  <TableCell align="right">Received</TableCell>
                  <TableCell align="right">Value</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {donorTotals.map((d) => (
                  <TableRow key={d.name}>
                    <TableCell>
                      {d.name}
                      {d.grants.size ? (
                        <Typography variant="caption" color="text.secondary" component="div">
                          {[...d.grants].join(", ")}
                        </Typography>
                      ) : null}
                    </TableCell>
                    <TableCell align="right">{d.ordered.toLocaleString()}</TableCell>
                    <TableCell align="right">{d.received.toLocaleString()}</TableCell>
                    <TableCell align="right">
                      {money(d.value, po.currencyCode)}
                      <Typography variant="caption" color="text.secondary" component="div">
                        received {money(d.receivedValue, po.currencyCode)}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Typography fontWeight={800}>Evidence</Typography>
              {canOperate ? (
                <Button component="label" size="small" startIcon={<UploadFileIcon />} disabled={uploading}>
                  {uploading ? "Uploading…" : "Attach file"}
                  <input hidden type="file" accept="application/pdf,image/jpeg,image/png" onChange={(e) => upload(e.target.files?.[0])} />
                </Button>
              ) : null}
            </Stack>
            {!po.documents.length ? (
              <Alert severity="warning" variant="outlined">
                No signed PO attached yet.
              </Alert>
            ) : (
              <Stack divider={<Divider flexItem />}>
                {po.documents.map((d) => (
                  <Stack key={d.id} direction="row" spacing={1} alignItems="center" sx={{ py: 1 }}>
                    <DescriptionOutlinedIcon color="action" />
                    <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                      <Typography
                        variant="body2"
                        fontWeight={600}
                        noWrap
                        sx={{ cursor: "pointer", color: "primary.main" }}
                        onClick={async () => {
                          const m = await openAuthenticatedFile(`/api/purchase-orders/${po.id}/documents/${d.id}`, d.mimeType);
                          if (m) setNotice(m);
                        }}
                      >
                        {d.fileName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {Math.ceil(d.sizeBytes / 1024)} KB · {d.uploadedBy?.fullName} · {dateOnly(d.createdAt)}
                      </Typography>
                    </Box>
                    {canOperate ? (
                      <Tooltip title="Remove">
                        <IconButton
                          size="small"
                          onClick={async () => {
                            if (!window.confirm(`Remove ${d.fileName}?`)) return;
                            try {
                              await api.delete(`/api/purchase-orders/${po.id}/documents/${d.id}`);
                              refresh();
                            } catch (e) {
                              setNotice(e?.response?.data?.message || e.message);
                            }
                          }}
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    ) : null}
                  </Stack>
                ))}
              </Stack>
            )}
          </CardContent>
        </Card>
      </Box>

      <Card>
        <CardContent>
          <Typography fontWeight={800} gutterBottom>
            Deliveries received
          </Typography>
          {!po.receipts.length ? (
            <Typography variant="body2" color="text.secondary">
              Nothing received yet.
            </Typography>
          ) : (
            <Stack spacing={1.5}>
              {po.receipts.map((r) => (
                <Card key={r.id} variant="outlined">
                  <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                    <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1}>
                      <Box>
                        <Typography fontWeight={700} sx={{ fontFamily: "monospace" }}>
                          {r.grnNumber}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {dateTime(r.receivedAt)} · {r.receivedBy?.fullName} · {r._count.boxes} boxes
                          {r.deliveryNote ? ` · DN ${r.deliveryNote}` : ""}
                          {r.waybillNo ? ` · Waybill ${r.waybillNo}` : ""}
                        </Typography>
                      </Box>
                      {po.order?.id && canOperate ? (
                        <Button
                          size="small"
                          startIcon={<PrintOutlinedIcon />}
                          onClick={async () => {
                            const m = await openAuthenticatedFile(labelSheetUrl(po.order.id, r.id), "application/pdf");
                            if (m) setNotice(m);
                          }}
                        >
                          Labels
                        </Button>
                      ) : null}
                    </Stack>
                    <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mt: 1 }}>
                      {r.lines.map((x) => (
                        <Chip key={x.id} size="small" variant="outlined" label={`${x.purchaseOrderLine.product.name} · ${x.batchNo} · exp ${dateOnly(x.expiryDate)} · ${x.packs}`} />
                      ))}
                    </Stack>
                    {r.note ? (
                      <Typography variant="body2" sx={{ mt: 1 }}>
                        {r.note}
                      </Typography>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
            </Stack>
          )}
        </CardContent>
      </Card>

      {dialog === "receive" ? <ReceiveDialog po={po} onClose={() => setDialog(null)} onDone={refresh} /> : null}
      {dialog === "close" ? (
        <CloseDialog
          po={po}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            refresh();
          }}
        />
      ) : null}
    </Box>
  );
}
