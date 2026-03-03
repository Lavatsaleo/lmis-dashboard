import React, { useEffect, useMemo, useState } from "react";
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

const SACHETS_PER_BOX = 600;

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

export default function Overview() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  const [facilities, setFacilities] = useState([]);
  const [selectedFacilityId, setSelectedFacilityId] = useState(""); // "" = All facilities

  const [childrenShown, setChildrenShown] = useState(null);

  // ✅ Open waybill using axios (sends Authorization header), then show PDF in new tab
  const openWaybill = async (waybillUrl) => {
    // Open immediately to avoid popup blockers
    const win = window.open("", "_blank");
    try {
      const res = await api.get(waybillUrl, { responseType: "blob" });

      const blob = new Blob([res.data], { type: "application/pdf" });
      const blobUrl = URL.createObjectURL(blob);

      win.location.href = blobUrl;

      // cleanup later
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    } catch (e) {
      if (win) win.close();
      alert("Failed to open waybill PDF. Please login again and try.");
      console.error(e);
    }
  };

  // Load dashboard data
  useEffect(() => {
    api
      .get("/api/dashboard/overview?days=30&stockoutThresholdDays=14&expiryWarnDays=60")
      .then((res) => setData(res.data))
      .catch((e) => setErr(e?.response?.data?.message || e.message));
  }, []);

  // Load facilities list for filter dropdown
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

  // Update children count when facility filter changes
  useEffect(() => {
    if (!data) return;

    if (!selectedFacilityId) {
      setChildrenShown(data.kpis.childrenEnrolled);
      return;
    }

    api
      .get(`/api/dashboard/children?facilityId=${encodeURIComponent(selectedFacilityId)}&take=1&skip=0`)
      .then((res) => setChildrenShown(res.data?.total ?? 0))
      .catch(() => setChildrenShown(data.kpis.childrenEnrolled));
  }, [selectedFacilityId, data]);

  const computed = useMemo(() => {
    if (!data) return null;

    const selectedFacility = selectedFacilityId
      ? facilities.find((f) => f.id === selectedFacilityId)
      : null;

    const facilityRow = selectedFacilityId
      ? data.facilityStore.find((f) => f.facilityId === selectedFacilityId)
      : null;

    const boxesInWarehouse = data.kpis.boxesInWarehouse;
    const sachetsInWarehouse = boxesInWarehouse * SACHETS_PER_BOX;

    const boxesInFacilitiesShown = selectedFacilityId
      ? facilityRow?.boxCount || 0
      : data.kpis.boxesInFacilities;

    const sachetsShown = selectedFacilityId
      ? facilityRow?.sachetsRemaining || 0
      : sachetsInWarehouse;

    const transitShown = selectedFacilityId
      ? data.transitTo.filter((t) => t.toFacility?.id === selectedFacilityId)
      : data.transitTo;

    const stockoutRiskShown = selectedFacilityId
      ? data.stockoutRisk.filter((r) => r.facility?.id === selectedFacilityId)
      : data.stockoutRisk;

    const expiringSoonShown = selectedFacilityId
      ? data.expiringSoon.filter((b) => b.currentFacility?.id === selectedFacilityId)
      : data.expiringSoon;

    const boxesInTransitShown = transitShown.reduce((sum, t) => sum + (t.boxCount || 0), 0);

    return {
      selectedFacility,
      boxesInWarehouse,
      boxesInFacilitiesShown,
      sachetsShown,
      transitShown,
      stockoutRiskShown,
      expiringSoonShown,
      boxesInTransitShown,
    };
  }, [data, facilities, selectedFacilityId]);

  if (err) return <Typography color="error">Error: {err}</Typography>;
  if (!data || !computed) return <Typography>Loading...</Typography>;

  return (
    <Box sx={{ display: "grid", gap: 2.5 }}>
      {/* Filter Card */}
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

      {/* KPI Tiles */}
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, 1fr)",
            md: "repeat(3, 1fr)",
            lg: "repeat(5, 1fr)",
          },
        }}
      >
        <Kpi title="Boxes in Warehouse" value={computed.boxesInWarehouse} />
        <Kpi title="Boxes in Transit" value={computed.boxesInTransitShown} />
        <Kpi
          title={
            computed.selectedFacility
              ? `Boxes in ${computed.selectedFacility.name}`
              : "Boxes in Facilities"
          }
          value={computed.boxesInFacilitiesShown}
        />
        <Kpi
          title={
            computed.selectedFacility
              ? `Sachets Remaining (${computed.selectedFacility.name})`
              : "Sachets in Warehouse"
          }
          value={computed.sachetsShown}
        />
        <Kpi title="Children Enrolled" value={childrenShown ?? data.kpis.childrenEnrolled} />
      </Box>

      {/* Transit */}
      <Card sx={{ overflow: "hidden" }}>
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

      {/* Stockout Risk + Expiry */}
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" },
        }}
      >
        {/* Stockout */}
        <Card sx={{ overflow: "hidden" }}>
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

        {/* Expiry */}
        <Card sx={{ overflow: "hidden" }}>
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