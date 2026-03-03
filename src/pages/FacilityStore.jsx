import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import dayjs from "dayjs";
import {
  Box,
  Card,
  CardContent,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Chip,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Divider,
  TableContainer,
} from "@mui/material";
import { alpha } from "@mui/material/styles";

function fmt(n) {
  return new Intl.NumberFormat().format(Number(n || 0));
}

function Kpi({ title, value }) {
  return (
    <Card sx={{ overflow: "hidden" }}>
      <CardContent sx={{ py: 2.2 }}>
        <Typography variant="body2" color="text.secondary">
          {title}
        </Typography>
        <Typography variant="h4" sx={{ mt: 0.5 }}>
          {fmt(value)}
        </Typography>
      </CardContent>
    </Card>
  );
}

export default function FacilityStore() {
  const [facilities, setFacilities] = useState([]);
  const [facilityId, setFacilityId] = useState("");
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  // settings (can be made UI controls later)
  const days = 30;
  const expiryWarnDays = 60;
  const stockoutThresholdDays = 14;

  // Load facilities
  useEffect(() => {
    api
      .get("/api/facilities")
      .then((res) => {
        const rows = (res.data || []).filter((f) => f.type === "FACILITY");
        rows.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        setFacilities(rows);
        if (rows.length && !facilityId) setFacilityId(rows[0].id);
      })
      .catch((e) => setErr(e?.response?.data?.message || e.message));
    // eslint-disable-next-line
  }, []);

  // Load facility store data
  useEffect(() => {
    if (!facilityId) return;
    setErr("");
    setData(null);

    api
      .get(
        `/api/dashboard/facilities/${facilityId}/store?days=${days}&expiryWarnDays=${expiryWarnDays}&stockoutThresholdDays=${stockoutThresholdDays}`
      )
      .then((res) => setData(res.data))
      .catch((e) => setErr(e?.response?.data?.message || e.message));
  }, [facilityId]);

  const riskCount = useMemo(() => {
    if (!data) return 0;
    return (data.stockoutRisk || []).length;
  }, [data]);

  if (err) return <Typography color="error">Error: {err}</Typography>;
  if (!facilityId) return <Typography>Loading facilities...</Typography>;
  if (!data) return <Typography>Loading facility store...</Typography>;

  return (
    <Box sx={{ display: "grid", gap: 2.5 }}>
      {/* Header + Facility selector */}
      <Card sx={{ overflow: "hidden" }}>
        <CardContent>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            alignItems={{ xs: "stretch", sm: "center" }}
            justifyContent="space-between"
          >
            <Box>
              <Typography variant="h6" fontWeight={900}>
                Facility Store
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Window: last {days} days • Expiry warning: {expiryWarnDays} days • Stockout threshold: {stockoutThresholdDays} days
              </Typography>
            </Box>

            <FormControl size="small" sx={{ minWidth: { xs: "100%", sm: 360 } }}>
              <InputLabel>Select Facility</InputLabel>
              <Select
                label="Select Facility"
                value={facilityId}
                onChange={(e) => setFacilityId(e.target.value)}
              >
                {facilities.map((f) => (
                  <MenuItem key={f.id} value={f.id}>
                    {f.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </CardContent>
      </Card>

      {/* KPI Tiles — CSS Grid */}
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: {
            xs: "1fr",
            md: "repeat(3, 1fr)",
          },
        }}
      >
        <Kpi title="Boxes on Hand" value={data.kpis.boxesOnHand} />
        <Kpi title="Sachets Remaining" value={data.kpis.sachetsRemaining} />
        <Kpi title="Products at Stockout Risk" value={riskCount} />
      </Box>

      {/* By product table */}
      <Card sx={{ overflow: "hidden" }}>
        <CardContent>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
            <Typography variant="h6" fontWeight={900}>
              Stock Status by Product
            </Typography>
            <Chip
              size="small"
              label={`${data.byProduct.length} product(s)`}
              sx={{ bgcolor: alpha("#005fb6", 0.08), fontWeight: 900 }}
            />
          </Stack>

          <Divider sx={{ mb: 2 }} />

          <TableContainer sx={{ maxHeight: 520 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Product</TableCell>
                  <TableCell align="right">Boxes</TableCell>
                  <TableCell align="right">On Hand (Sachets)</TableCell>
                  <TableCell align="right">Avg/Day</TableCell>
                  <TableCell align="right">Days of Stock</TableCell>
                  <TableCell>Risk</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.byProduct.map((r) => (
                  <TableRow key={r.product?.id} hover>
                    <TableCell sx={{ fontWeight: 800 }}>{r.product?.name}</TableCell>
                    <TableCell align="right">{fmt(r.boxesOnHand)}</TableCell>
                    <TableCell align="right">{fmt(r.onHandSachets)}</TableCell>
                    <TableCell align="right">{r.avgDailyDispense}</TableCell>
                    <TableCell align="right">
                      {r.daysOfStock === null ? (
                        <Chip size="small" label="N/A" />
                      ) : (
                        <Chip
                          size="small"
                          label={r.daysOfStock}
                          color={
                            r.daysOfStock <= 7
                              ? "error"
                              : r.daysOfStock <= stockoutThresholdDays
                              ? "warning"
                              : "success"
                          }
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      {r.isAtRisk ? (
                        <Chip size="small" color="warning" label="At Risk" />
                      ) : (
                        <Chip size="small" label="OK" />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {data.byProduct.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6}>No stock found for this facility.</TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Expiring soon */}
      <Card sx={{ overflow: "hidden" }}>
        <CardContent>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
            <Typography variant="h6" fontWeight={900}>
              Expiring Soon (≤ {expiryWarnDays} days)
            </Typography>
            <Chip
              size="small"
              label={`${data.expiringSoon.length} box(es)`}
              sx={{ bgcolor: alpha("#52ae32", 0.10), fontWeight: 900 }}
            />
          </Stack>

          <Divider sx={{ mb: 2 }} />

          <TableContainer sx={{ maxHeight: 520 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Box UID</TableCell>
                  <TableCell>Product</TableCell>
                  <TableCell>Batch</TableCell>
                  <TableCell>Expiry</TableCell>
                  <TableCell align="right">Sachets Remaining</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.expiringSoon.map((b) => (
                  <TableRow key={b.id} hover>
                    <TableCell sx={{ fontWeight: 800 }}>{b.boxUid}</TableCell>
                    <TableCell>{b.product?.name}</TableCell>
                    <TableCell>{b.batchNo || "-"}</TableCell>
                    <TableCell>{b.expiryDate ? dayjs(b.expiryDate).format("DD-MMM-YYYY") : "-"}</TableCell>
                    <TableCell align="right">{fmt(b.sachetsRemaining)}</TableCell>
                  </TableRow>
                ))}
                {data.expiringSoon.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5}>No boxes expiring within the warning window.</TableCell>
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