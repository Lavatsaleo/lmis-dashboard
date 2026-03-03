import React, { useEffect, useState } from "react";
import { api } from "../api/client";
import {
  Card,
  CardContent,
  Typography,
  Chip,
  Box,
  Stack,
  Button,
  Divider,
} from "@mui/material";
import { alpha } from "@mui/material/styles";

export default function Alerts() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  // ✅ Open waybill using axios (sends Authorization header), then show PDF in new tab
  const openWaybill = async (waybillUrl) => {
    const win = window.open("", "_blank");
    try {
      const res = await api.get(waybillUrl, { responseType: "blob" });

      const blob = new Blob([res.data], { type: "application/pdf" });
      const blobUrl = URL.createObjectURL(blob);

      win.location.href = blobUrl;
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    } catch (e) {
      if (win) win.close();
      alert("Failed to open waybill PDF. Please login again and try.");
      console.error(e);
    }
  };

  useEffect(() => {
    api
      .get(
        "/api/dashboard/alerts?days=30&stockoutThresholdDays=14&expiryWarnDays=60&transitSlaDays=3"
      )
      .then((res) => setData(res.data))
      .catch((e) => setErr(e?.response?.data?.message || e.message));
  }, []);

  if (err) return <Typography color="error">Error: {err}</Typography>;
  if (!data) return <Typography>Loading...</Typography>;

  const severityColor = (sev) => {
    if (sev === "HIGH") return "error";
    if (sev === "MEDIUM") return "warning";
    return "default";
  };

  const titleFor = (a) => {
    if (a.type === "STOCKOUT_RISK")
      return `${a.facility?.name} → ${a.product?.name} (${a.daysOfStock} days)`;
    if (a.type === "EXPIRY_RISK") return `Expiry: ${a.boxUid} → ${a.product?.name}`;
    return `Overdue transit: ${a.manifestNo}`;
  };

  const subtitleFor = (a) => {
    if (a.type === "STOCKOUT_RISK")
      return `On hand: ${a.onHandSachets} sachets • Avg/day: ${a.avgDailyDispense}`;
    if (a.type === "EXPIRY_RISK")
      return `Expires: ${a.expiryDate ? String(a.expiryDate).slice(0, 10) : "-"} • Location: ${
        a.location?.name || "-"
      }`;
    if (a.type === "OVERDUE_TRANSIT")
      return `From: ${a.fromWarehouse?.name || "-"} • To: ${a.toFacility?.name || "-"} • Boxes: ${
        a.boxCount || 0
      }`;
    return "";
  };

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Card sx={{ overflow: "hidden" }}>
        <CardContent>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Box>
              <Typography variant="h6" fontWeight={900}>
                Alerts
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Operational risks across stockout, expiry, and delayed transit.
              </Typography>
            </Box>
            <Chip
              size="small"
              label={`${data.alerts.length} alert(s)`}
              sx={{ bgcolor: alpha("#005fb6", 0.08), fontWeight: 900 }}
            />
          </Stack>
        </CardContent>
      </Card>

      {data.alerts.map((a, idx) => (
        <Card key={idx} sx={{ overflow: "hidden" }}>
          <CardContent>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={2}
              alignItems={{ xs: "flex-start", sm: "center" }}
              justifyContent="space-between"
            >
              <Box sx={{ minWidth: 0 }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                  <Chip label={a.type} color={severityColor(a.severity)} size="small" />
                  <Chip label={a.severity || "INFO"} size="small" variant="outlined" />
                </Stack>

                <Typography fontWeight={900} sx={{ mb: 0.5 }} noWrap>
                  {titleFor(a)}
                </Typography>

                <Typography variant="body2" color="text.secondary">
                  {subtitleFor(a)}
                </Typography>
              </Box>

              {/* Right-side actions */}
              <Stack direction="row" spacing={1}>
                {a.type === "OVERDUE_TRANSIT" && a.waybillUrl ? (
                  <Button
                    variant="contained"
                    onClick={() => openWaybill(a.waybillUrl)}
                    size="small"
                  >
                    Waybill PDF
                  </Button>
                ) : null}

                {/* Placeholder for next step: initiate dispatch */}
                {/* {a.type === "STOCKOUT_RISK" ? (
                  <Button variant="outlined" size="small">
                    Initiate Distribution
                  </Button>
                ) : null} */}
              </Stack>
            </Stack>

            <Divider sx={{ mt: 2, opacity: 0.5 }} />
          </CardContent>
        </Card>
      ))}

      {data.alerts.length === 0 ? <Typography>No alerts 🎉</Typography> : null}
    </Box>
  );
}