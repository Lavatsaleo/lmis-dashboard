import React, { useEffect, useMemo, useState, useCallback } from "react";
import { api } from "../api/client";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Link,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  TableContainer,
  Divider,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import dayjs from "dayjs";

function fmt(n) {
  return new Intl.NumberFormat().format(Number(n || 0));
}

function Kpi({ title, value }) {
  return (
    <Card sx={{ overflow: "hidden", borderRadius: 4, height: "100%" }}>
      <CardContent sx={{ py: 2.4 }}>
        <Typography variant="body2" color="text.secondary">
          {title}
        </Typography>
        <Typography variant="h4" sx={{ mt: 0.8, fontWeight: 900, lineHeight: 1.1 }}>
          {fmt(value)}
        </Typography>
      </CardContent>
    </Card>
  );
}

export default function Overview() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  const [facilities, setFacilities] = useState([]);
  const [selectedFacilityId, setSelectedFacilityId] = useState("");

  const openWaybill = async (waybillUrl) => {
    const win = window.open("", "_blank");
    try {
      const res = await api.get(waybillUrl, { responseType: "blob" });
      const blob = new Blob([res.data], { type: "application/pdf" });
      const blobUrl = URL.createObjectURL(blob);
      win.location.href = blobUrl;
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    } catch (e) {
      if (win) win.close();
      alert("Failed to open waybill PDF. Please login again and try.");
      console.error(e);
    }
  };

  const loadOverview = useCallback(async () => {
    try {
      setLoading(true);
      setErr("");

      const params = new URLSearchParams();
      params.set("days", "30");
      params.set("stockoutThresholdDays", "14");
      params.set("expiryWarnDays", "60");

      if (selectedFacilityId) {
        params.set("facilityId", selectedFacilityId);
      }

      const res = await api.get(`/api/dashboard/overview?${params.toString()}`);
      setData(res.data);
    } catch (e) {
      setErr(e?.response?.data?.message || e.message);
    } finally {
      setLoading(false);
    }
  }, [selectedFacilityId]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    api
      .get("/api/facilities")
      .then((res) => {
        const rows = (res.data || []).filter((f) => f.type === "FACILITY");
        rows.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        setFacilities(rows);
      })
      .catch(() => setFacilities([]));
  }, []);

  const computed = useMemo(() => {
    if (!data) return null;

    const selectedFacility = selectedFacilityId
      ? facilities.find((f) => f.id === selectedFacilityId)
      : null;

    return {
      selectedFacility,
      boxesInWarehouse: data.kpis?.boxesInWarehouse || 0,
      boxesInTransit: data.kpis?.boxesInTransit || 0,
      boxesInFacilities: data.kpis?.boxesInFacilities || 0,
      sachetsShown: selectedFacilityId
        ? data.kpis?.sachetsInFacilities || 0
        : data.kpis?.sachetsInWarehouse || 0,
      sachetsDispensed: data.kpis?.sachetsDispensed || 0,
      childrenEnrolled: data.kpis?.childrenEnrolled || 0,
      transitShown: data.transitTo || [],
      stockoutRiskShown: data.stockoutRisk || [],
      expiringSoonShown: data.expiringSoon || [],
    };
  }, [data, facilities, selectedFacilityId]);

  if (err) return <Typography color="error">Error: {err}</Typography>;
  if (loading || !data || !computed) return <Typography>Loading...</Typography>;

  return (
    <Box sx={{ display: "grid", gap: 2.5 }}>
      <Card sx={{ overflow: "hidden", borderRadius: 4 }}>
        <CardContent>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            alignItems={{ xs: "stretch", sm: "center" }}
            justifyContent="space-between"
          >
            <Box>
              <Typography variant="h5" fontWeight={900}>
                Overview
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Warehouse + facility visibility, expiry risk, and consumption-driven stockout risk.
              </Typography>
            </Box>

            <FormControl size="small" sx={{ minWidth: { xs: "100%", sm: 360 } }}>
              <InputLabel>Filter by Facility</InputLabel>
              <Select
                label="Filter by Facility"
                value={selectedFacilityId}
                onChange={(e) => setSelectedFacilityId(e.target.value)}
              >
                <MenuItem value="">All Facilities</MenuItem>
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

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, 1fr)",
            md: "repeat(3, 1fr)",
            xl: "repeat(6, 1fr)",
          },
        }}
      >
        <Kpi title="Boxes in Warehouse" value={computed.boxesInWarehouse} />
        <Kpi title="Boxes in Transit" value={computed.boxesInTransit} />
        <Kpi
          title={
            computed.selectedFacility
              ? `Boxes in ${computed.selectedFacility.name}`
              : "Boxes in Facilities"
          }
          value={computed.boxesInFacilities}
        />
        <Kpi
          title={
            computed.selectedFacility
              ? `Sachets in ${computed.selectedFacility.name}`
              : "Sachets in Warehouse"
          }
          value={computed.sachetsShown}
        />
        <Kpi
          title={
            computed.selectedFacility
              ? `Sachets Dispensed (${computed.selectedFacility.name})`
              : "Sachets Dispensed"
          }
          value={computed.sachetsDispensed}
        />
        <Kpi title="Children Enrolled" value={computed.childrenEnrolled} />
      </Box>

      <Card sx={{ overflow: "hidden", borderRadius: 4 }}>
        <CardContent>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
            <Typography variant="h6" fontWeight={900}>
              In Transit {computed.selectedFacility ? `→ ${computed.selectedFacility.name}` : ""}
            </Typography>
            <Chip
              size="small"
              label={`${computed.transitShown.length} shipment(s)`}
              sx={{ bgcolor: alpha("#005fb6", 0.08), fontWeight: 900 }}
            />
          </Stack>

          <Divider sx={{ mb: 2 }} />

          <TableContainer sx={{ maxHeight: 420 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Manifest</TableCell>
                  <TableCell>From</TableCell>
                  <TableCell>To</TableCell>
                  <TableCell>Boxes</TableCell>
                  <TableCell>Dispatched</TableCell>
                  <TableCell>Waybill</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {computed.transitShown.map((t) => (
                  <TableRow key={t.shipmentId} hover>
                    <TableCell sx={{ fontWeight: 800 }}>{t.manifestNo}</TableCell>
                    <TableCell>{t.fromWarehouse?.name}</TableCell>
                    <TableCell>{t.toFacility?.name}</TableCell>
                    <TableCell>
                      <Chip label={t.boxCount} size="small" />
                    </TableCell>
                    <TableCell>
                      {t.dispatchedAt ? dayjs(t.dispatchedAt).format("DD-MMM-YYYY") : "-"}
                    </TableCell>
                    <TableCell>
                      <Link
                        component="button"
                        onClick={() => openWaybill(t.waybillUrl)}
                        sx={{ fontWeight: 900, cursor: "pointer" }}
                        underline="hover"
                      >
                        PDF
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
                {computed.transitShown.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6}>No active shipments.</TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" },
        }}
      >
        <Card sx={{ overflow: "hidden", borderRadius: 4 }}>
          <CardContent>
            <Typography variant="h6" fontWeight={900} gutterBottom>
              Stockout Risk (Days of Stock)
              {computed.selectedFacility ? ` — ${computed.selectedFacility.name}` : ""}
            </Typography>
            <Divider sx={{ mb: 2 }} />

            <TableContainer sx={{ maxHeight: 420 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Facility</TableCell>
                    <TableCell>Product</TableCell>
                    <TableCell align="right">On Hand</TableCell>
                    <TableCell align="right">Avg/Day</TableCell>
                    <TableCell align="right">Days</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {computed.stockoutRiskShown.map((r, idx) => (
                    <TableRow key={idx} hover>
                      <TableCell>{r.facility?.name}</TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>{r.product?.name}</TableCell>
                      <TableCell align="right">{fmt(r.onHandSachets)}</TableCell>
                      <TableCell align="right">{r.avgDailyDispense}</TableCell>
                      <TableCell align="right">
                        <Chip
                          size="small"
                          label={r.daysOfStock}
                          color={r.daysOfStock <= 7 ? "error" : "warning"}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                  {computed.stockoutRiskShown.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5}>
                        No facilities at risk (based on recent dispensing).
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>

        <Card sx={{ overflow: "hidden", borderRadius: 4 }}>
          <CardContent>
            <Typography variant="h6" fontWeight={900} gutterBottom>
              Expiring Soon{computed.selectedFacility ? ` — ${computed.selectedFacility.name}` : ""}
            </Typography>
            <Divider sx={{ mb: 2 }} />

            <TableContainer sx={{ maxHeight: 420 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Box UID</TableCell>
                    <TableCell>Product</TableCell>
                    <TableCell>Location</TableCell>
                    <TableCell>Expiry</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {computed.expiringSoonShown.map((b) => (
                    <TableRow key={b.id} hover>
                      <TableCell sx={{ fontWeight: 800 }}>{b.boxUid}</TableCell>
                      <TableCell>{b.product?.name}</TableCell>
                      <TableCell>{b.currentFacility?.name}</TableCell>
                      <TableCell>
                        {b.expiryDate ? dayjs(b.expiryDate).format("DD-MMM-YYYY") : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {computed.expiringSoonShown.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4}>
                        No boxes expiring within the warning window.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}