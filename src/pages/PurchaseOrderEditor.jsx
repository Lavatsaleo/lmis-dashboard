import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
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
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

import { api } from "../api/client";
import { isoDay, money } from "../components/warehouse/format";
import { uploadPoDocument } from "../components/warehouse/poApi";

const CURRENCIES = ["USD", "EUR", "GBP", "CHF", "KES", "SSP"];
const emptyLine = () => ({ key: Math.random().toString(36).slice(2), productId: "", donorId: "", grantCode: "", quantityPacks: "", unitPrice: "" });

function AddDonorDialog({ open, onClose, implementationId, onCreated }) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const save = async () => {
    setErr("");
    if (name.trim().length < 2) return setErr("Enter the donor name");
    try {
      setSaving(true);
      const res = await api.post("/api/donors", { name: name.trim(), implementationId });
      onCreated(res.data);
      setName("");
    } catch (e) {
      setErr(e?.response?.data?.message || e.message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Add donor</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {err ? <Alert severity="error">{err}</Alert> : null}
          <TextField autoFocus label="Donor name" value={name} onChange={(e) => setName(e.target.value)} helperText="Use the official name, e.g. ECHO, USAID BHA. Existing names are reused." />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={saving}>
          Add
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function PurchaseOrderEditor() {
  const { me } = useOutletContext();
  const { poId } = useParams();
  const editing = !!poId;
  const nav = useNavigate();

  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [donors, setDonors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [donorDialog, setDonorDialog] = useState(null); // line key awaiting a new donor

  const [form, setForm] = useState({
    poNumber: "",
    supplierName: "",
    destinationWarehouseId: "",
    orderDate: isoDay(),
    expectedDeliveryDate: "",
    currencyCode: "USD",
    note: "",
  });
  const [lines, setLines] = useState([emptyLine()]);
  const [received, setReceived] = useState({}); // lineId -> receivedPacks (editing)
  const [file, setFile] = useState(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // Warehouses the user can enter POs for: officers only their own.
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await api.get("/api/warehouses");
        let rows = res.data?.rows || [];
        if (me?.role === "WAREHOUSE_OFFICER") rows = rows.filter((w) => w.id === me.warehouseId);
        if (!mounted) return;
        setWarehouses(rows);
        if (editing) {
          const po = (await api.get(`/api/purchase-orders/${poId}`)).data;
          if (!mounted) return;
          setForm({
            poNumber: po.poNumber,
            supplierName: po.supplierName || "",
            destinationWarehouseId: po.destinationWarehouseId,
            orderDate: po.orderDate ? isoDay(po.orderDate) : "",
            expectedDeliveryDate: po.expectedDeliveryDate ? isoDay(po.expectedDeliveryDate) : "",
            currencyCode: po.currencyCode,
            note: po.note || "",
          });
          setLines(po.lines.map((l) => ({ key: l.id, id: l.id, productId: l.productId, donorId: l.donorId, grantCode: l.grantCode || "", quantityPacks: String(l.quantityPacks), unitPrice: String(l.unitPrice) })));
          setReceived(Object.fromEntries(po.lines.map((l) => [l.id, l.receivedPacks])));
        } else if (rows.length === 1) {
          setForm((f) => ({ ...f, destinationWarehouseId: rows[0].id }));
        }
      } catch (e) {
        if (mounted) setErr(e?.response?.data?.message || e.message);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [me, editing, poId]);

  const warehouse = warehouses.find((w) => w.id === form.destinationWarehouseId);
  const implementationId = warehouse?.implementationId || "";

  // Products and donors of the destination warehouse's country.
  useEffect(() => {
    if (!implementationId) return undefined;
    let mounted = true;
    const q = `implementationId=${encodeURIComponent(implementationId)}`;
    Promise.all([api.get(`/api/products?${q}`), api.get(`/api/donors?${q}`)])
      .then(([p, d]) => {
        if (!mounted) return;
        setProducts((p.data || []).filter((x) => x.isActive !== false));
        setDonors(d.data || []);
      })
      .catch((e) => mounted && setErr(e?.response?.data?.message || e.message));
    return () => {
      mounted = false;
    };
  }, [implementationId]);

  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const setLine = (key, field, value) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, [field]: value } : l)));
  const total = lines.reduce((s, l) => s + (Number(l.quantityPacks) || 0) * (Number(l.unitPrice) || 0), 0);

  const submit = async () => {
    setErr("");
    if (!form.poNumber.trim()) return setErr("Enter the PO number exactly as on the procurement document");
    if (!form.destinationWarehouseId) return setErr("Choose the warehouse that will receive the goods");
    const payloadLines = lines
      .filter((l) => l.productId || l.donorId || l.quantityPacks || l.unitPrice)
      .map((l) => ({
        ...(l.id ? { id: l.id } : {}),
        productId: l.productId,
        donorId: l.donorId,
        grantCode: l.grantCode,
        quantityPacks: Number(l.quantityPacks),
        unitPrice: l.unitPrice === "" ? NaN : Number(l.unitPrice),
      }));
    if (!payloadLines.length) return setErr("Add at least one line");
    const bad = payloadLines.findIndex((l) => !l.productId || !l.donorId || !Number.isInteger(l.quantityPacks) || l.quantityPacks <= 0 || !Number.isFinite(l.unitPrice) || l.unitPrice < 0);
    if (bad >= 0) return setErr(`Line ${bad + 1}: choose product and donor, enter a whole quantity and the unit price`);
    if (!editing && !file) return setErr("Attach the signed PO (PDF or photo) as evidence");

    const body = { ...form, lines: payloadLines };
    try {
      setSaving(true);
      const res = editing ? await api.patch(`/api/purchase-orders/${poId}`, body) : await api.post("/api/purchase-orders", body);
      const id = res.data.id;
      if (file) {
        try {
          await uploadPoDocument(id, file);
        } catch (e) {
          nav(`/purchase-orders/${id}`, { state: { warning: `PO saved, but the file did not upload: ${e?.response?.data?.message || e.message}. Attach it again from the PO page.` } });
          return;
        }
      }
      nav(`/purchase-orders/${id}`);
    } catch (e) {
      setErr(e?.response?.data?.message || e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LinearProgress />;
  if (!warehouses.length) {
    return <Alert severity="info">You are not assigned to a warehouse that can receive purchase orders.</Alert>;
  }

  return (
    <Box sx={{ display: "grid", gap: 2.5 }}>
      <Card>
        <CardContent>
          <Button size="small" startIcon={<ArrowBackIcon />} onClick={() => nav(editing ? `/purchase-orders/${poId}` : "/purchase-orders")} sx={{ ml: -1, mb: 0.5 }}>
            Back
          </Button>
          <Typography variant="h6" fontWeight={900}>
            {editing ? `Edit ${form.poNumber}` : "New purchase order"}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Copy the details from the final PO issued by procurement. Batch numbers and expiry dates are recorded later, when the goods arrive.
          </Typography>
        </CardContent>
      </Card>

      <Card>
        <CardContent sx={{ display: "grid", gap: 2 }}>
          {err ? <Alert severity="error">{err}</Alert> : null}
          <Typography fontWeight={800}>Order details</Typography>
          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0,1fr))" } }}>
            <TextField label="PO number" value={form.poNumber} onChange={set("poNumber")} required helperText="Box labels will start with this number" />
            <TextField label="Supplier" value={form.supplierName} onChange={set("supplierName")} />
            <FormControl required disabled={editing}>
              <InputLabel>Receiving warehouse</InputLabel>
              <Select label="Receiving warehouse" value={form.destinationWarehouseId} onChange={set("destinationWarehouseId")}>
                {warehouses.map((w) => (
                  <MenuItem key={w.id} value={w.id}>
                    {w.name} ({w.code})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField type="date" label="PO date" value={form.orderDate} onChange={set("orderDate")} InputLabelProps={{ shrink: true }} />
            <TextField type="date" label="Expected delivery" value={form.expectedDeliveryDate} onChange={set("expectedDeliveryDate")} InputLabelProps={{ shrink: true }} />
            <Autocomplete
              freeSolo
              options={CURRENCIES}
              value={form.currencyCode}
              onInputChange={(_, v) => setForm((f) => ({ ...f, currencyCode: (v || "").toUpperCase().slice(0, 3) }))}
              renderInput={(params) => <TextField {...params} label="Currency" helperText="3-letter code" />}
            />
          </Box>
          <TextField label="Notes" value={form.note} onChange={set("note")} multiline minRows={2} />

          <Divider />
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography fontWeight={800}>Lines</Typography>
            <Typography variant="body2" color="text.secondary">
              Each line can have its own donor (split funding).
            </Typography>
          </Stack>
          {!implementationId ? <Alert severity="info">Choose the receiving warehouse first.</Alert> : null}
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ minWidth: 200 }}>Product</TableCell>
                  <TableCell sx={{ minWidth: 200 }}>Donor</TableCell>
                  <TableCell sx={{ minWidth: 130 }}>Grant / project code</TableCell>
                  <TableCell sx={{ minWidth: 110 }}>Quantity</TableCell>
                  <TableCell sx={{ minWidth: 120 }}>Unit price ({form.currencyCode || "—"})</TableCell>
                  <TableCell align="right">Line total</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {lines.map((l) => {
                  const p = productMap.get(l.productId);
                  const got = l.id ? received[l.id] || 0 : 0;
                  return (
                    <TableRow key={l.key}>
                      <TableCell>
                        <Select size="small" fullWidth displayEmpty value={l.productId} disabled={got > 0} onChange={(e) => setLine(l.key, "productId", e.target.value)}>
                          <MenuItem value="" disabled>
                            Choose product
                          </MenuItem>
                          {products.map((x) => (
                            <MenuItem key={x.id} value={x.id}>
                              {x.name}
                            </MenuItem>
                          ))}
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          size="small"
                          fullWidth
                          displayEmpty
                          value={l.donorId}
                          disabled={got > 0}
                          onChange={(e) => (e.target.value === "__new" ? setDonorDialog(l.key) : setLine(l.key, "donorId", e.target.value))}
                        >
                          <MenuItem value="" disabled>
                            Choose donor
                          </MenuItem>
                          {donors.map((d) => (
                            <MenuItem key={d.id} value={d.id}>
                              {d.name}
                            </MenuItem>
                          ))}
                          <MenuItem value="__new" sx={{ color: "primary.main", fontWeight: 700 }}>
                            + Add donor…
                          </MenuItem>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <TextField size="small" value={l.grantCode} onChange={(e) => setLine(l.key, "grantCode", e.target.value)} />
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          type="number"
                          value={l.quantityPacks}
                          onChange={(e) => setLine(l.key, "quantityPacks", e.target.value)}
                          inputProps={{ min: Math.max(1, got), step: 1 }}
                          helperText={got ? `${got} received` : p ? `${p.packUnitName || "packs"} of ${p.unitsPerPack}` : " "}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          type="number"
                          value={l.unitPrice}
                          onChange={(e) => setLine(l.key, "unitPrice", e.target.value)}
                          inputProps={{ min: 0, step: "0.01" }}
                          helperText={p ? `per ${String(p.packUnitName || "pack").toLowerCase()}` : " "}
                        />
                      </TableCell>
                      <TableCell align="right">{money((Number(l.quantityPacks) || 0) * (Number(l.unitPrice) || 0), form.currencyCode)}</TableCell>
                      <TableCell>
                        <Tooltip title={got ? "Goods received on this line" : "Remove line"}>
                          <span>
                            <IconButton size="small" disabled={got > 0 || lines.length === 1} onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}>
                              <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
                <TableRow>
                  <TableCell colSpan={5}>
                    <Button size="small" startIcon={<AddIcon />} onClick={() => setLines((ls) => [...ls, { ...emptyLine(), donorId: ls[ls.length - 1]?.donorId || "" }])}>
                      Add line
                    </Button>
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800 }}>
                    {money(total, form.currencyCode)}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>

          <Divider />
          <Typography fontWeight={800}>Evidence</Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ xs: "stretch", sm: "center" }}>
            <Button component="label" variant="outlined" startIcon={<UploadFileIcon />}>
              {file ? "Change file" : editing ? "Attach another file" : "Attach signed PO"}
              <input hidden type="file" accept="application/pdf,image/jpeg,image/png" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </Button>
            <Typography variant="body2" color={file ? "text.primary" : "text.secondary"}>
              {file ? `${file.name} (${Math.ceil(file.size / 1024)} KB)` : "PDF, JPEG or PNG, up to 15 MB. Not read by Anchor; kept as evidence."}
            </Typography>
          </Stack>

          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button onClick={() => nav(editing ? `/purchase-orders/${poId}` : "/purchase-orders")} disabled={saving}>
              Cancel
            </Button>
            <Button variant="contained" onClick={submit} disabled={saving}>
              {saving ? "Saving…" : editing ? "Save changes" : "Create purchase order"}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <AddDonorDialog
        open={!!donorDialog}
        implementationId={implementationId}
        onClose={() => setDonorDialog(null)}
        onCreated={(d) => {
          setDonors((ds) => (ds.some((x) => x.id === d.id) ? ds : [...ds, d].sort((a, b) => a.name.localeCompare(b.name))));
          setLine(donorDialog, "donorId", d.id);
          setDonorDialog(null);
        }}
      />
    </Box>
  );
}
