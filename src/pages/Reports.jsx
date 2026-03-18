import React, { useEffect, useState, useCallback } from "react";
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

export default function Reports() {
  const [fromDate, setFromDate] = useState(daysAgoIso(30));
  const [toDate, setToDate] = useState(todayIso());

  const [appliedFromDate, setAppliedFromDate] = useState(daysAgoIso(30));
  const [appliedToDate, setAppliedToDate] = useState(todayIso());

  const [data, setData] = useState({
    summary: { missedAppointments: 0 },
    rows: [],
    total: 0,
    take: 10,
    skip: 0,
  });

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [showDetails, setShowDetails] = useState(false);

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const loadReport = useCallback(async () => {
    try {
      setLoading(true);
      setErr("");

      const skip = page * rowsPerPage;
      const params = new URLSearchParams();
      params.set("fromDate", appliedFromDate);
      params.set("toDate", appliedToDate);
      params.set("take", String(rowsPerPage));
      params.set("skip", String(skip));

      const res = await api.get(
        `/api/dashboard/reports/missed-appointments?${params.toString()}`
      );

      setData(
        res.data || {
          summary: { missedAppointments: 0 },
          rows: [],
          total: 0,
          take: rowsPerPage,
          skip,
        }
      );
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || "Failed to load report");
    } finally {
      setLoading(false);
    }
  }, [appliedFromDate, appliedToDate, page, rowsPerPage]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const runReport = () => {
    setPage(0);
    setShowDetails(false);
    setAppliedFromDate(fromDate);
    setAppliedToDate(toDate);
  };

  const handleChangePage = (_, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (e) => {
    setRowsPerPage(parseInt(e.target.value, 10));
    setPage(0);
  };

  return (
    <Box sx={{ display: "grid", gap: 2.5 }}>
      <Card>
        <CardContent>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={2}
            alignItems={{ xs: "stretch", md: "center" }}
            justifyContent="space-between"
          >
            <Box>
              <Typography variant="h6" fontWeight={900}>
                Reports
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Missed appointments report
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

      <Card>
        <CardContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Date range: {appliedFromDate} to {appliedToDate}
          </Typography>

          <Typography variant="body2" color="text.secondary">
            Click the number to see the list of children with missed appointments.
          </Typography>

          <Box
            onClick={() => setShowDetails(true)}
            sx={{
              mt: 2,
              display: "inline-flex",
              flexDirection: "column",
              cursor: "pointer",
              userSelect: "none",
            }}
          >
            <Typography variant="body2" color="text.secondary">
              Missed Appointments
            </Typography>
            <Typography
              variant="h2"
              fontWeight={900}
              color="error.main"
              sx={{ lineHeight: 1 }}
            >
              {loading ? "..." : data.summary?.missedAppointments ?? 0}
            </Typography>
          </Box>
        </CardContent>
      </Card>

      {showDetails ? (
        <Card>
          <CardContent>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              justifyContent="space-between"
              alignItems={{ xs: "stretch", sm: "center" }}
              sx={{ mb: 2 }}
            >
              <Typography variant="h6" fontWeight={900}>
                Children with Missed Appointments
              </Typography>

              <Chip
                label={`${data.total || 0} record(s)`}
                color="error"
                variant="outlined"
              />
            </Stack>

            {loading ? (
              <Typography>Loading...</Typography>
            ) : (
              <>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Registration #</TableCell>
                      <TableCell>Facility</TableCell>
                      <TableCell>Appointment Date</TableCell>
                      <TableCell>Next Visit Date</TableCell>
                      <TableCell align="right">Days Late</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Action</TableCell>
                    </TableRow>
                  </TableHead>

                  <TableBody>
                    {(data.rows || []).map((row) => (
                      <TableRow key={row.appointmentId}>
                        <TableCell>
                          <Link component={RouterLink} to={`/children/${row.childId}`}>
                            {row.uniqueChildNumber || "-"}
                          </Link>
                        </TableCell>
                        <TableCell>{row.facility?.name || "-"}</TableCell>
                        <TableCell>{formatDate(row.appointmentDate)}</TableCell>
                        <TableCell>{formatDate(row.nextVisitDate)}</TableCell>
                        <TableCell align="right">{row.daysLate ?? 0}</TableCell>
                        <TableCell>
                          <Chip size="small" color="error" label="Missed" />
                        </TableCell>
                        <TableCell>
                          <Link component={RouterLink} to={`/children/${row.childId}`}>
                            View Child
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}

                    {(!data.rows || data.rows.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={7}>
                          No missed appointments found for this date range.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>

                <TablePagination
                  component="div"
                  count={data.total || 0}
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