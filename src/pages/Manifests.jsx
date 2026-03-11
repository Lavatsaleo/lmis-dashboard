import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import { DataGrid } from "@mui/x-data-grid";
import { api } from "../api/client";

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function getStatusColor(status) {
  switch ((status || "").toUpperCase()) {
    case "RECEIVED":
      return "success";
    case "IN_TRANSIT":
      return "warning";
    case "DISPATCHED":
      return "info";
    default:
      return "default";
  }
}

export default function Manifests() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadManifests() {
      try {
        setLoading(true);
        setError("");

        const res = await api.get("/api/shipments?status=RECEIVED");

        const payload = res?.data;
        const shipments = Array.isArray(payload)
          ? payload
          : payload?.items || payload?.shipments || payload?.data || [];

        const normalized = shipments.map((item, index) => ({
          id: item.id || item.shipmentId || item.manifestId || index + 1,
          manifestNumber:
            item.manifestNumber ||
            item.manifestNo ||
            item.waybillNumber ||
            item.referenceNumber ||
            "—",
          fromFacility:
            item.fromFacility?.name ||
            item.fromFacilityName ||
            item.sourceFacility?.name ||
            item.sourceFacilityName ||
            "—",
          toFacility:
            item.toFacility?.name ||
            item.toFacilityName ||
            item.destinationFacility?.name ||
            item.destinationFacilityName ||
            "—",
          boxesCount:
            item.boxesCount ??
            item.totalBoxes ??
            item.boxCount ??
            item.shipmentItems?.length ??
            0,
          dispatchedAt: item.dispatchedAt || item.createdAt || null,
          receivedAt: item.receivedAt || null,
          receivedBy:
            item.receivedBy?.fullName ||
            item.receivedByName ||
            item.receiverName ||
            item.receivedBy ||
            "—",
          status: item.status || "—",
          waybillUrl: item.waybillUrl || item.manifestUrl || item.pdfUrl || "",
        }));

        if (!mounted) return;
        setRows(normalized);
      } catch (err) {
        if (!mounted) return;
        setError(
          err?.response?.data?.message ||
            "Failed to load received manifests."
        );
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    }

    loadManifests();

    return () => {
      mounted = false;
    };
  }, []);

  const columns = useMemo(
    () => [
      {
        field: "manifestNumber",
        headerName: "Manifest Number",
        flex: 1.2,
        minWidth: 180,
      },
      {
        field: "fromFacility",
        headerName: "From",
        flex: 1.2,
        minWidth: 180,
      },
      {
        field: "toFacility",
        headerName: "To",
        flex: 1.2,
        minWidth: 180,
      },
      {
        field: "boxesCount",
        headerName: "Boxes",
        width: 100,
      },
      {
        field: "dispatchedAt",
        headerName: "Dispatch Date",
        flex: 1,
        minWidth: 170,
        renderCell: (params) => formatDate(params.value),
      },
      {
        field: "receivedAt",
        headerName: "Received Date",
        flex: 1,
        minWidth: 170,
        renderCell: (params) => formatDate(params.value),
      },
      {
        field: "receivedBy",
        headerName: "Received By",
        flex: 1,
        minWidth: 180,
      },
      {
        field: "status",
        headerName: "Status",
        width: 130,
        renderCell: (params) => (
          <Chip
            label={params.value || "—"}
            color={getStatusColor(params.value)}
            size="small"
            sx={{ fontWeight: 700 }}
          />
        ),
      },
      {
        field: "actions",
        headerName: "Waybill",
        width: 130,
        sortable: false,
        filterable: false,
        renderCell: (params) =>
          params.row.waybillUrl ? (
            <Button
              size="small"
              variant="outlined"
              endIcon={<OpenInNewIcon />}
              onClick={() => window.open(params.row.waybillUrl, "_blank")}
            >
              Open
            </Button>
          ) : (
            "—"
          ),
      },
    ],
    []
  );

  return (
    <Box>
      <Stack
        direction={{ xs: "column", md: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", md: "center" }}
        spacing={1.5}
        sx={{ mb: 2 }}
      >
        <Box>
          <Typography variant="h5" fontWeight={900}>
            Received Manifests
          </Typography>
          <Typography variant="body2" color="text.secondary">
            All manifests that have completed transit and were received at the
            facility.
          </Typography>
        </Box>

        <Chip
          icon={<Inventory2OutlinedIcon />}
          label={`${rows.length} manifest${rows.length === 1 ? "" : "s"}`}
          color="primary"
          variant="outlined"
          sx={{ fontWeight: 800 }}
        />
      </Stack>

      <Card
        elevation={0}
        sx={{
          border: "1px solid rgba(112,112,112,0.14)",
          borderRadius: 3,
        }}
      >
        <CardContent sx={{ p: 2 }}>
          {error ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          ) : null}

          {loading ? (
            <Box
              sx={{
                minHeight: 320,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <CircularProgress />
            </Box>
          ) : (
            <Box sx={{ width: "100%" }}>
              <DataGrid
                rows={rows}
                columns={columns}
                autoHeight
                disableRowSelectionOnClick
                pageSizeOptions={[10, 25, 50]}
                initialState={{
                  pagination: {
                    paginationModel: { pageSize: 10, page: 0 },
                  },
                  sorting: {
                    sortModel: [{ field: "receivedAt", sort: "desc" }],
                  },
                }}
                sx={{
                  border: 0,
                  "& .MuiDataGrid-columnHeaders": {
                    backgroundColor: "rgba(0, 95, 182, 0.04)",
                    fontWeight: 800,
                  },
                  "& .MuiDataGrid-cell": {
                    alignItems: "center",
                  },
                }}
              />
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}