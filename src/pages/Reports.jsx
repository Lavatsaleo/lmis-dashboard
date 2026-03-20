import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Link as RouterLink } from "react-router-dom";
import { api } from "../api/client";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Stack,
  TextField,
  Button,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TablePagination,
  Link,
  Chip,
  Alert,
  Divider,
} from "@mui/material";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function formatDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "-" : d.toISOString().slice(0, 10);
}

const REPORTS = {
  missedAppointments: {
    key: "missedAppointments",
    title: "Missed Appointments",
    description: "Children who missed their scheduled follow up visit",
    endpoint: "/api/dashboard/reports/missed-appointments",
    color: "error",
    emptyText: "No missed appointments found for this date range.",
  },
  honouredFollowUps: {
    key: "honouredFollowUps",
    title: "Follow Up Visits Honoured",
    description: "Children who returned on time or earlier for scheduled follow up visits",
    endpoint: "/api/dashboard/reports/honoured-follow-ups",
    color: "success",
    emptyText: "No honoured follow up visits found for this date range.",
  },
};

export default function Reports() {
  const [fromDate, setFromDate] = useState(daysAgoIso(30));
  const [toDate, setToDate] = useState(todayIso());

  const [appliedFromDate, setAppliedFromDate] = useState(daysAgoIso(30));
  const [appliedToDate, setAppliedToDate] = useState(todayIso());

  const [summaries, setSummaries] = useState({
    missedAppointments: 0,
    honouredFollowUps: 0,
  });

  const [detailData, setDetailData] = useState({
    rows: [],
    total: 0,
    take: 10,
    skip: 0,
  });

  const [selectedReport, setSelectedReport] = useState(null);

  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [err, setErr] = useState("");

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const selectedConfig = selectedReport ? REPORTS[selectedReport] : null;

  const summaryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("fromDate", appliedFromDate);
    params.set("toDate", appliedToDate);
    params.set("take", "1");
    params.set("skip", "0");
    return params.toString();
  }, [appliedFromDate, appliedToDate]);

  const loadSummaries = useCallback(async () => {
    try {
      setLoadingSummary(true);
      setErr("");

      const [missedRes, honouredRes] = await Promise.all([
        api.get(`${REPORTS.missedAppointments.endpoint}?${summaryParams}`),
        api.get(`${REPORTS.honouredFollowUps.endpoint}?${summaryParams}`),
      ]);

      setSummaries({
        missedAppointments:
          missedRes.data?.summary?.missedAppointments ?? missedRes.data?.total ?? 0,
        honouredFollowUps:
          honouredRes.data?.summary?.honouredFollowUps ?? honouredRes.data?.total ?? 0,
      });
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || "Failed to load reports");
    } finally {
      setLoadingSummary(false);
    }
  }, [summaryParams]);

  const loadDetails = useCallback(async () => {
    if (!selectedConfig) return;

    try {
      setLoadingDetails(true);
      setErr("");

      const skip = page * rowsPerPage;
      const params = new URLSearchParams();
      params.set("fromDate", appliedFromDate);
      params.set("toDate", appliedToDate);
      params.set("take", String(rowsPerPage));
      params.set("skip", String(skip));

      const res = await api.get(`${selectedConfig.endpoint}?${params.toString()}`);

      setDetailData(
        res.data || {
          rows: [],
          total: 0,
          take: rowsPerPage,
          skip,
        }
      );
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || "Failed to load report details");
    } finally {
      setLoadingDetails(false);
    }
  }, [selectedConfig, appliedFromDate, appliedToDate, page, rowsPerPage]);

  useEffect(() => {
    loadSummaries();
  }, [loadSummaries]);

  useEffect(() => {
    loadDetails();
  }, [loadDetails]);

  const runReport = () => {
    setPage(0);
    setAppliedFromDate(fromDate);
    setAppliedToDate(toDate);
  };

  const openReport = (reportKey) => {
    setSelectedReport(reportKey);
    setPage(0);
  };

  const handleChangePage = (_, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (e) => {
    setRowsPerPage(parseInt(e.target.value, 10));
    setPage(0);
  };

  const renderSummaryCard = (reportKey) => {
    const report = REPORTS[reportKey];
    const isSelected = selectedReport === reportKey;
    const count = summaries[reportKey] ?? 0;

    return (
      <Card
        key={report.key}
        onClick={() => openReport(report.key)}
        sx={{
          cursor: "pointer",
          borderRadius: 4,
          border: isSelected ? "2px solid" : "1px solid",
          borderColor: isSelected ? `${report.color}.main` : "divider",
          transition: "0.2s ease",
          "&:hover": {
            transform: "translateY(-2px)",
            boxShadow: 4,
          },
        }}
      >
        <CardContent>
          <Stack spacing={1.5}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
              <Box>
                <Typography variant="h6" fontWeight={900}>
                  {report.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {report.description}
                </Typography>
              </Box>

              <Chip
                size="small"
                label={isSelected ? "Open" : "View"}
                color={report.color}
                variant={isSelected ? "filled" : "outlined"}
              />
            </Stack>

            <Box>
              <Typography variant="body2" color="text.secondary">
                Total
              </Typography>
              <Typography
                variant="h3"
                fontWeight={900}
                color={`${report.color}.main`}
                sx={{ lineHeight: 1 }}
              >
                {loadingSummary ? "..." : count}
              </Typography>
            </Box>

            <Button
              variant={isSelected ? "contained" : "outlined"}
              color={report.color}
              onClick={(e) => {
                e.stopPropagation();
                openReport(report.key);
              }}
            >
              Open Report
            </Button>
          </Stack>
        </CardContent>
      </Card>
    );
  };

  return (
    <Box sx={{ display: "grid", gap: 2.5 }}>
      <Card sx={{ borderRadius: 4 }}>
        <CardContent>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={2}
            alignItems={{ xs: "stretch", md: "center" }}
            justifyContent="space-between"
          >
            <Box>
              <Typography variant="h5" fontWeight={900}>
                Reports
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Select a report, apply the date range, then open the detailed list
              </Typography>
            </Box>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <TextField
                label="From Date"
                type="date"
                size="small"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />

              <TextField
                label="To Date"
                type="date"
                size="small"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />

              <Button variant="contained" onClick={runReport}>
                Run Report
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {err ? <Alert severity="error">{err}</Alert> : null}

      <Card sx={{ borderRadius: 4 }}>
        <CardContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Date range: {appliedFromDate} to {appliedToDate}
          </Typography>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
              gap: 2,
            }}
          >
            {renderSummaryCard("missedAppointments")}
            {renderSummaryCard("honouredFollowUps")}
          </Box>
        </CardContent>
      </Card>

      {selectedConfig ? (
        <Card sx={{ borderRadius: 4 }}>
          <CardContent>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              justifyContent="space-between"
              alignItems={{ xs: "stretch", sm: "center" }}
              sx={{ mb: 2 }}
              spacing={1.5}
            >
              <Box>
                <Typography variant="h6" fontWeight={900}>
                  {selectedConfig.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {selectedConfig.description}
                </Typography>
              </Box>

              <Chip
                label={`${detailData.total || 0} record(s)`}
                color={selectedConfig.color}
                variant="outlined"
              />
            </Stack>

            <Divider sx={{ mb: 2 }} />

            {loadingDetails ? (
              <Typography>Loading...</Typography>
            ) : (
              <>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Registration #</TableCell>
                      <TableCell>Facility</TableCell>
                      <TableCell>Appointment Date</TableCell>
                      <TableCell>
                        {selectedReport === "missedAppointments"
                          ? "Next Visit Date"
                          : "Return Visit Date"}
                      </TableCell>
                      {selectedReport === "missedAppointments" ? (
                        <TableCell align="right">Days Late</TableCell>
                      ) : (
                        <TableCell align="right">Days Early</TableCell>
                      )}
                      <TableCell>Status</TableCell>
                      <TableCell>Action</TableCell>
                    </TableRow>
                  </TableHead>

                  <TableBody>
                    {(detailData.rows || []).map((row) => (
                      <TableRow
                        key={`${selectedReport}-${row.appointmentId}-${row.childId}`}
                      >
                        <TableCell>
                          <Link component={RouterLink} to={`/children/${row.childId}`}>
                            {row.uniqueChildNumber || "-"}
                          </Link>
                        </TableCell>
                        <TableCell>{row.facility?.name || "-"}</TableCell>
                        <TableCell>{formatDate(row.appointmentDate)}</TableCell>
                        <TableCell>{formatDate(row.nextVisitDate)}</TableCell>
                        <TableCell align="right">
                          {selectedReport === "missedAppointments"
                            ? row.daysLate ?? 0
                            : row.daysEarly ?? 0}
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            color={selectedConfig.color}
                            label={
                              selectedReport === "missedAppointments"
                                ? "Missed"
                                : "Honoured"
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Link component={RouterLink} to={`/children/${row.childId}`}>
                            View Child
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}

                    {(!detailData.rows || detailData.rows.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={7}>{selectedConfig.emptyText}</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>

                <TablePagination
                  component="div"
                  count={detailData.total || 0}
                  page={page}
                  onPageChange={handleChangePage}
                  rowsPerPage={rowsPerPage}
                  onRowsPerPageChange={handleChangeRowsPerPage}
                  rowsPerPageOptions={[10, 25, 50]}
                />
              </>
            )}
          </CardContent>
        </Card>
      ) : null}
    </Box>
  );
}