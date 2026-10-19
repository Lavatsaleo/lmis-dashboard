import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import {
  Box,
  Button,
  Card,
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
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import AttachFileIcon from "@mui/icons-material/AttachFile";

import { api } from "../api/client";
import ImplementationPicker from "../components/ImplementationPicker";
import { useImplementationChoice } from "../components/implementationChoice";
import { PO_STATUS, dateOnly, money } from "../components/warehouse/format";
import { canEnterPurchaseOrders } from "../components/warehouse/poApi";

export default function PurchaseOrders() {
  const { me } = useOutletContext();
  const nav = useNavigate();
  const { implementations, implementationId, setImplementationId, isSuperAdmin } = useImplementationChoice(me);
  const [status, setStatus] = useState("OPEN_ANY");
  const [q, setQ] = useState("");
  const [state, setState] = useState({ key: null, rows: [], total: 0, error: "" });

  const params = useMemo(() => {
    const p = { take: 100 };
    if (status) p.status = status;
    if (q.trim()) p.q = q.trim();
    if (isSuperAdmin && implementationId) p.implementationId = implementationId;
    return p;
  }, [status, q, isSuperAdmin, implementationId]);
  const key = JSON.stringify(params);

  useEffect(() => {
    if (!me || (isSuperAdmin && !implementationId)) return undefined;
    let mounted = true;
    const t = setTimeout(() => {
      api
        .get("/api/purchase-orders", { params })
        .then((res) => mounted && setState({ key, rows: res.data?.rows || [], total: res.data?.total || 0, error: "" }))
        .catch((e) => mounted && setState({ key, rows: [], total: 0, error: e?.response?.data?.message || e.message }));
    }, 250);
    return () => {
      mounted = false;
      clearTimeout(t);
    };
  }, [me, isSuperAdmin, implementationId, params, key]);

  const loading = state.key !== key;

  return (
    <Box sx={{ display: "grid", gap: 2.5 }}>
      <Card>
        <CardContent>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} justifyContent="space-between" alignItems={{ xs: "stretch", md: "center" }}>
            <Box>
              <Typography variant="h6" fontWeight={900}>
                Purchase Orders
              </Typography>
              <Typography variant="body2" color="text.secondary">
                POs from procurement, entered with the signed PDF as evidence. Receive deliveries against them to create labelled stock.
              </Typography>
            </Box>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <ImplementationPicker implementations={implementations} value={implementationId} onChange={setImplementationId} isSuperAdmin={isSuperAdmin} />
              {canEnterPurchaseOrders(me) ? (
                <Button variant="contained" startIcon={<AddIcon />} onClick={() => nav("/purchase-orders/new")}>
                  New purchase order
                </Button>
              ) : null}
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent sx={{ display: "grid", gap: 2 }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <TextField size="small" label="Search PO, supplier or donor" value={q} onChange={(e) => setQ(e.target.value)} sx={{ minWidth: { md: 300 } }} />
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Status</InputLabel>
              <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
                <MenuItem value="OPEN_ANY">Awaiting delivery</MenuItem>
                <MenuItem value="">All</MenuItem>
                {Object.entries(PO_STATUS).map(([k, v]) => (
                  <MenuItem key={k} value={k}>
                    {v.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Box sx={{ flexGrow: 1 }} />
            <Chip label={`${state.total} purchase order${state.total === 1 ? "" : "s"}`} sx={{ fontWeight: 800, alignSelf: { xs: "flex-start", md: "center" } }} />
          </Stack>
          {loading ? <LinearProgress /> : null}
          {state.error ? <Typography color="error">{state.error}</Typography> : null}

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>PO number</TableCell>
                  <TableCell>Supplier</TableCell>
                  <TableCell>Warehouse</TableCell>
                  <TableCell>Donor(s)</TableCell>
                  <TableCell>Expected</TableCell>
                  <TableCell sx={{ minWidth: 160 }}>Received</TableCell>
                  <TableCell align="right">Value</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {state.rows.map((po) => (
                  <TableRow key={po.id} hover sx={{ cursor: "pointer" }} onClick={() => nav(`/purchase-orders/${po.id}`)}>
                    <TableCell>
                      <Stack direction="row" spacing={0.75} alignItems="center">
                        <Typography variant="body2" fontWeight={700} sx={{ fontFamily: "monospace" }}>
                          {po.poNumber}
                        </Typography>
                        {po._count?.documents ? <AttachFileIcon sx={{ fontSize: 16, color: "text.secondary" }} titleAccess="Evidence attached" /> : null}
                      </Stack>
                    </TableCell>
                    <TableCell>{po.supplierName || "—"}</TableCell>
                    <TableCell>{po.destinationWarehouse?.name}</TableCell>
                    <TableCell>{po.donors.map((d) => d.name).join(", ")}</TableCell>
                    <TableCell>
                      {dateOnly(po.expectedDeliveryDate) || "—"}
                      {po.isOverdue ? <Chip size="small" color="error" variant="outlined" label="Overdue" sx={{ ml: 1, height: 20 }} /> : null}
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {po.totals.receivedPacks.toLocaleString()} of {po.totals.orderedPacks.toLocaleString()}
                      </Typography>
                      <LinearProgress variant="determinate" value={po.totals.percentReceived} sx={{ height: 6, borderRadius: 3 }} />
                    </TableCell>
                    <TableCell align="right">{money(po.totals.value, po.currencyCode)}</TableCell>
                    <TableCell>
                      <Chip size="small" color={PO_STATUS[po.status]?.color} label={PO_STATUS[po.status]?.label || po.status} />
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && !state.rows.length ? (
                  <TableRow>
                    <TableCell colSpan={8}>
                      <Typography color="text.secondary" variant="body2">
                        No purchase orders here yet.{canEnterPurchaseOrders(me) ? " Use “New purchase order” once procurement has issued the PO." : ""}
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
