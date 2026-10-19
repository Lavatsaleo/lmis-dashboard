import React, { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  FormControl,
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
  Switch,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import QrCode2Icon from "@mui/icons-material/QrCode2";
import PrintOutlinedIcon from "@mui/icons-material/PrintOutlined";

import { api } from "../api/client";
import { dateTime, isoDay } from "../components/warehouse/format";
import { labelSheetUrl, openAuthenticatedFile } from "../components/warehouse/poApi";
import { typeLabel } from "../components/supply/hierarchy";

const newKey = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
const isAdmin = (me) => me?.role === "SUPER_ADMIN" || me?.role === "COUNTRY_ADMIN";

function PolicyCard({ implementations, onChanged, me }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  if (!implementations.length) return null;
  return (
    <Card variant="outlined">
      <CardContent sx={{ display: "grid", gap: 1.5 }}>
        <Typography fontWeight={800}>Where can QR labels be generated?</Typography>
        {err ? <Alert severity="error">{err}</Alert> : null}
        {implementations.map((impl) => (
          <Stack key={impl.id} direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }} justifyContent="space-between">
            <Typography variant="body2">{[impl.country?.name, impl.name].filter(Boolean).join(" • ")}</Typography>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={impl.labelGenerationScope || "ALL_WAREHOUSES"}
              disabled={!isAdmin(me) || busy}
              onChange={async (_, v) => {
                if (!v) return;
                setErr("");
                setBusy(true);
                try {
                  await api.patch(`/api/implementations/${impl.id}`, { labelGenerationScope: v });
                  onChanged();
                } catch (e) {
                  setErr(e?.response?.data?.message || e.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <ToggleButton value="ALL_WAREHOUSES">All warehouses</ToggleButton>
              <ToggleButton value="MAIN_ONLY">Main warehouse only</ToggleButton>
            </ToggleButtonGroup>
          </Stack>
        ))}
        <Typography variant="caption" color="text.secondary">
          “Main warehouse only”: labels are made where goods are first received; field bases receive labelled boxes by transfer.
          {isAdmin(me) ? "" : " Only administrators can change this."}
        </Typography>
      </CardContent>
    </Card>
  );
}

// Mobile app: receive deliveries against a PO, stock counts and loss reports
// for warehouse officers. Per country, so one can keep its current app.
function MobileToolsCard({ implementations, onChanged, me }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  if (!implementations.length) return null;
  return (
    <Card variant="outlined">
      <CardContent sx={{ display: "grid", gap: 1.5 }}>
        <Typography fontWeight={800}>Mobile app: warehouse stock tools</Typography>
        <Typography variant="body2" color="text.secondary">
          When on, warehouse officers see Receive delivery (purchase order), Stock count and Report loss in the mobile app.
        </Typography>
        {err ? <Alert severity="error">{err}</Alert> : null}
        {implementations.map((impl) => (
          <Stack key={impl.id} direction="row" spacing={1.5} alignItems="center" justifyContent="space-between">
            <Typography variant="body2">{[impl.country?.name, impl.name].filter(Boolean).join(" • ")}</Typography>
            <Switch
              checked={!!impl.warehouseTools}
              disabled={!isAdmin(me) || busy}
              onChange={async (e) => {
                setErr("");
                setBusy(true);
                try {
                  await api.patch(`/api/implementations/${impl.id}`, { warehouseTools: e.target.checked });
                  onChanged();
                } catch (x) {
                  setErr(x?.response?.data?.message || x.message);
                } finally {
                  setBusy(false);
                }
              }}
            />
          </Stack>
        ))}
        <Typography variant="caption" color="text.secondary">
          Phones pick up a change the next time the app is opened with internet.{isAdmin(me) ? "" : " Only administrators can change this."}
        </Typography>
      </CardContent>
    </Card>
  );
}

export default function QrLabels() {
  const { me } = useOutletContext();
  const [implementations, setImplementations] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [mode, setMode] = useState("po");
  const [pos, setPos] = useState([]);
  const [poId, setPoId] = useState("");
  const [po, setPo] = useState(null);
  const [rows, setRows] = useState([]);
  const [receivedAt, setReceivedAt] = useState(isoDay());
  const [products, setProducts] = useState([]);
  const [donors, setDonors] = useState([]);
  const [free, setFree] = useState({ reference: "", productId: "", donorId: "", batchNo: "", expiryDate: "", quantity: "", note: "" });
  const [idem, setIdem] = useState(newKey);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(null);
  const [runs, setRuns] = useState([]);
  const [reload, setReload] = useState(0);

  // Warehouses the user may label for, given each country's label policy.
  useEffect(() => {
    if (!me) return undefined;
    let mounted = true;
    Promise.all([api.get("/api/implementations"), api.get("/api/warehouses")]).then(([i, w]) => {
      if (!mounted) return;
      const impls = Array.isArray(i.data) ? i.data : [];
      const policy = new Map(impls.map((x) => [x.id, x.labelGenerationScope || "ALL_WAREHOUSES"]));
      let list = w.data?.rows || [];
      if (me.role === "WAREHOUSE_OFFICER") list = list.filter((x) => x.id === me.warehouseId);
      if (!isAdmin(me) && me.role !== "WAREHOUSE_OFFICER") list = [];
      list = list.map((x) => ({ ...x, blocked: policy.get(x.implementationId) === "MAIN_ONLY" && x.stockLocationType !== "CENTRAL_WAREHOUSE" }));
      setImplementations(impls);
      setWarehouses(list);
      setWarehouseId((cur) => cur || list.find((x) => !x.blocked)?.id || "");
    });
    return () => {
      mounted = false;
    };
  }, [me, reload]);

  const warehouse = warehouses.find((w) => w.id === warehouseId);
  const implQuery = warehouse?.implementationId ? `implementationId=${encodeURIComponent(warehouse.implementationId)}` : "";

  // Open POs, products and donors for the chosen warehouse's country.
  useEffect(() => {
    if (!warehouseId || !implQuery) return undefined;
    let mounted = true;
    Promise.all([
      api.get(`/api/purchase-orders?status=OPEN_ANY&warehouseId=${warehouseId}`),
      api.get(`/api/products?${implQuery}`),
      api.get(`/api/donors?${implQuery}`),
      api.get(`/api/labels/runs?warehouseId=${warehouseId}`),
    ]).then(([p, pr, d, r]) => {
      if (!mounted) return;
      setPos(p.data?.rows || []);
      setProducts((pr.data || []).filter((x) => x.isActive !== false));
      setDonors(d.data || []);
      setRuns(r.data?.rows || []);
    });
    return () => {
      mounted = false;
    };
  }, [warehouseId, implQuery, reload]);

  useEffect(() => {
    if (!poId) return undefined;
    let mounted = true;
    api.get(`/api/purchase-orders/${poId}`).then((res) => {
      if (!mounted) return;
      setPo(res.data);
      setRows(res.data.lines.filter((l) => l.outstandingPacks > 0).map((l) => ({ key: newKey(), lineId: l.id, batchNo: "", expiryDate: "", packs: "" })));
    });
    return () => {
      mounted = false;
    };
  }, [poId]);

  const openLines = useMemo(() => (po?.lines || []).filter((l) => l.outstandingPacks > 0), [po]);
  const lineMap = useMemo(() => new Map(openLines.map((l) => [l.id, l])), [openLines]);
  const setRow = (key, f, v) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, [f]: v } : r)));
  const poTotal = rows.reduce((s, r) => s + (Number(r.packs) || 0), 0);
  const freeQty = Number(free.quantity) || 0;
  const total = mode === "po" ? poTotal : freeQty;

  const print = async (orderId, query) => {
    const m = await openAuthenticatedFile(`${labelSheetUrl(orderId)}${query}`, "application/pdf");
    if (m) setErr(m);
  };

  const generate = async () => {
    setErr("");
    setDone(null);
    const today = isoDay();
    try {
      setSaving(true);
      if (mode === "po") {
        if (!po) throw new Error("Choose the purchase order");
        const use = rows.filter((r) => Number(r.packs) > 0);
        if (!use.length) throw new Error("Enter the number of cartons on at least one row");
        for (const [i, r] of use.entries()) {
          if (!r.batchNo.trim()) throw new Error(`Row ${i + 1}: enter the batch number`);
          if (!r.expiryDate) throw new Error(`Row ${i + 1}: enter the expiry date`);
          if (r.expiryDate < today) throw new Error(`Row ${i + 1}: expired stock cannot be labelled into stock`);
        }
        const res = await api.post(
          `/api/purchase-orders/${po.id}/receipts`,
          { receivedAt, lines: use.map((r) => ({ lineId: r.lineId, batchNo: r.batchNo.trim(), expiryDate: r.expiryDate, packs: Number(r.packs) })) },
          { headers: { "X-Idempotency-Key": idem } }
        );
        setDone({ count: res.data.createdCount, first: res.data.sample?.[0], orderId: res.data.orderId, query: `?goodsReceiptId=${res.data.receipt.id}`, ref: res.data.grnNumber });
        await print(res.data.orderId, `?goodsReceiptId=${res.data.receipt.id}`);
      } else {
        const product = products.find((p) => p.id === free.productId);
        const donor = donors.find((d) => d.id === free.donorId);
        if (!free.reference.trim()) throw new Error("Enter a reference (order or waybill number); labels start with it");
        if (!product) throw new Error("Choose the product");
        if (!free.batchNo.trim() || !free.expiryDate) throw new Error("Enter batch and expiry");
        if (!Number.isInteger(freeQty) || freeQty <= 0) throw new Error("Enter how many cartons (labels) to generate");
        const order = await api.post("/api/orders", { orderNumber: free.reference.trim(), donorName: donor?.name });
        const orderId = order.data.id || order.data.order?.id;
        const res = await api.post(
          `/api/orders/${orderId}/boxes/generate`,
          {
            productCode: product.code,
            productName: product.name,
            batchNo: free.batchNo.trim(),
            expiryDate: free.expiryDate,
            quantity: freeQty,
            warehouseFacilityId: warehouseId,
            donorName: donor?.name,
          },
          { headers: { "X-Idempotency-Key": idem }, timeout: 180000 }
        );
        setDone({ count: res.data.createdCount, first: res.data.sample?.[0], orderId, query: `?generationRequestId=${encodeURIComponent(idem)}`, ref: free.reference.trim() });
        await print(orderId, `?generationRequestId=${encodeURIComponent(idem)}`);
      }
      setIdem(newKey());
      setPoId("");
      setPo(null);
      setRows([]);
      setFree((f) => ({ ...f, batchNo: "", expiryDate: "", quantity: "" }));
      setReload((r) => r + 1);
    } catch (e) {
      setErr(e?.response?.data?.message || e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ display: "grid", gap: 2.5 }}>
      <Card>
        <CardContent>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <QrCode2Icon color="primary" />
            <Box>
              <Typography variant="h6" fontWeight={900}>
                QR Labels
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Generate box labels in bulk. Every label is one carton added to the warehouse stock, so the labels printed equal the boxes on the shelves.
              </Typography>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      <PolicyCard implementations={implementations} me={me} onChanged={() => setReload((r) => r + 1)} />
      <MobileToolsCard implementations={implementations} me={me} onChanged={() => setReload((r) => r + 1)} />

      <Card>
        <CardContent sx={{ display: "grid", gap: 2 }}>
          {err ? <Alert severity="error">{err}</Alert> : null}
          {done ? (
            <Alert
              severity="success"
              action={
                <Button color="inherit" startIcon={<PrintOutlinedIcon />} onClick={() => print(done.orderId, done.query)}>
                  Print again
                </Button>
              }
            >
              {done.ref}: {done.count.toLocaleString()} labels generated and {done.count.toLocaleString()} boxes added to stock (first label {done.first}).
            </Alert>
          ) : null}
          <FormControl fullWidth>
            <InputLabel>Warehouse</InputLabel>
            <Select label="Warehouse" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
              {warehouses.map((w) => (
                <MenuItem key={w.id} value={w.id} disabled={w.blocked}>
                  {w.name} · {typeLabel(w.stockLocationType)}
                  {w.blocked ? " · labels made at the main warehouse" : ""}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {!warehouses.length ? <Alert severity="info">You are not assigned to a warehouse that can generate labels.</Alert> : null}

          <Tabs value={mode} onChange={(_, v) => setMode(v)} sx={{ borderBottom: 1, borderColor: "divider" }}>
            <Tab value="po" label={`Against a purchase order (${pos.length} open)`} />
            <Tab value="free" label="Without a purchase order" />
          </Tabs>

          {mode === "po" ? (
            <>
              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <FormControl fullWidth>
                  <InputLabel>Purchase order</InputLabel>
                  <Select label="Purchase order" value={poId} onChange={(e) => setPoId(e.target.value)}>
                    {pos.map((p) => (
                      <MenuItem key={p.id} value={p.id}>
                        {p.poNumber} · {p.supplierName || "supplier"} · {p.totals.outstandingPacks.toLocaleString()} cartons outstanding
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField type="date" label="Date received" value={receivedAt} onChange={(e) => setReceivedAt(e.target.value)} InputLabelProps={{ shrink: true }} inputProps={{ max: isoDay() }} sx={{ minWidth: 200 }} />
              </Stack>
              {!pos.length ? <Typography variant="body2" color="text.secondary">No open purchase orders for this warehouse. Enter the PO first under Purchase Orders, or use “Without a purchase order”.</Typography> : null}
              {po ? (
                <>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ minWidth: 220 }}>PO line</TableCell>
                          <TableCell sx={{ minWidth: 140 }}>Batch no.</TableCell>
                          <TableCell sx={{ minWidth: 150 }}>Expiry</TableCell>
                          <TableCell sx={{ minWidth: 120 }}>Cartons = labels</TableCell>
                          <TableCell />
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {rows.map((r) => {
                          const l = lineMap.get(r.lineId);
                          return (
                            <TableRow key={r.key}>
                              <TableCell>
                                <Select size="small" fullWidth value={r.lineId} onChange={(e) => setRow(r.key, "lineId", e.target.value)}>
                                  {openLines.map((x) => (
                                    <MenuItem key={x.id} value={x.id}>
                                      {x.product.name} · {x.donor.name} · {x.outstandingPacks} left
                                    </MenuItem>
                                  ))}
                                </Select>
                              </TableCell>
                              <TableCell>
                                <TextField size="small" value={r.batchNo} onChange={(e) => setRow(r.key, "batchNo", e.target.value)} />
                              </TableCell>
                              <TableCell>
                                <TextField size="small" type="date" value={r.expiryDate} onChange={(e) => setRow(r.key, "expiryDate", e.target.value)} />
                              </TableCell>
                              <TableCell>
                                <TextField size="small" type="number" value={r.packs} onChange={(e) => setRow(r.key, "packs", e.target.value)} inputProps={{ min: 0, max: l?.outstandingPacks }} helperText={l ? `max ${l.outstandingPacks}` : " "} />
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
                  <Button size="small" startIcon={<AddIcon />} sx={{ justifySelf: "start" }} onClick={() => setRows((rs) => [...rs, { key: newKey(), lineId: rs[rs.length - 1]?.lineId || openLines[0]?.id, batchNo: "", expiryDate: rs[rs.length - 1]?.expiryDate || "", packs: "" }])}>
                    Add another batch
                  </Button>
                </>
              ) : null}
            </>
          ) : (
            <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0,1fr))" } }}>
              <TextField label="Reference (labels start with this)" value={free.reference} onChange={(e) => setFree({ ...free, reference: e.target.value })} helperText="e.g. waybill or order number" />
              <FormControl>
                <InputLabel>Product</InputLabel>
                <Select label="Product" value={free.productId} onChange={(e) => setFree({ ...free, productId: e.target.value })}>
                  {products.map((p) => (
                    <MenuItem key={p.id} value={p.id}>
                      {p.name} ({p.code})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl>
                <InputLabel>Donor</InputLabel>
                <Select label="Donor" value={free.donorId} onChange={(e) => setFree({ ...free, donorId: e.target.value })}>
                  {donors.map((d) => (
                    <MenuItem key={d.id} value={d.id}>
                      {d.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField label="Batch no." value={free.batchNo} onChange={(e) => setFree({ ...free, batchNo: e.target.value })} />
              <TextField label="Expiry" type="date" value={free.expiryDate} onChange={(e) => setFree({ ...free, expiryDate: e.target.value })} InputLabelProps={{ shrink: true }} />
              <TextField label="Number of cartons = labels" type="number" value={free.quantity} onChange={(e) => setFree({ ...free, quantity: e.target.value })} inputProps={{ min: 1, max: 5000 }} />
            </Box>
          )}

          <Divider />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }} justifyContent="space-between">
            <Typography variant="body2" color="text.secondary">
              {total ? `${total.toLocaleString()} labels on ${Math.ceil(total / 80)} A3 sheet${Math.ceil(total / 80) === 1 ? "" : "s"} (80 per sheet) · ${total.toLocaleString()} boxes into ${warehouse?.name || "the warehouse"}` : "Enter the cartons to label."}
            </Typography>
            <Button variant="contained" size="large" startIcon={<QrCode2Icon />} onClick={generate} disabled={saving || !total || !warehouseId || warehouse?.blocked}>
              {saving ? "Generating…" : `Generate ${total ? total.toLocaleString() : ""} labels`}
            </Button>
          </Stack>
          {saving ? <LinearProgress /> : null}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography fontWeight={800} gutterBottom>
            Label runs{warehouse ? ` · ${warehouse.name}` : ""}
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>When</TableCell>
                  <TableCell>Reference</TableCell>
                  <TableCell>Batches</TableCell>
                  <TableCell align="right">Labels</TableCell>
                  <TableCell>By</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {runs.map((r) => (
                  <TableRow key={`${r.kind}${r.goodsReceiptId || r.generationRequestId}`}>
                    <TableCell>{dateTime(r.at)}</TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={700} sx={{ fontFamily: "monospace" }}>
                        {r.reference}
                      </Typography>
                      {r.poNumber ? <Chip size="small" variant="outlined" label={`PO ${r.poNumber}`} sx={{ height: 20 }} /> : <Chip size="small" variant="outlined" label="No PO" sx={{ height: 20 }} />}
                    </TableCell>
                    <TableCell>{r.batches}</TableCell>
                    <TableCell align="right">{r.boxes.toLocaleString()}</TableCell>
                    <TableCell>{r.by}</TableCell>
                    <TableCell align="right">
                      {r.orderId ? (
                        <Button size="small" startIcon={<PrintOutlinedIcon />} onClick={() => print(r.orderId, r.goodsReceiptId ? `?goodsReceiptId=${r.goodsReceiptId}` : `?generationRequestId=${encodeURIComponent(r.generationRequestId)}`)}>
                          Reprint
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
                {!runs.length ? (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <Typography variant="body2" color="text.secondary">
                        No labels generated here yet.
                      </Typography>
                    </TableCell>
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
