import React, { useCallback, useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { api } from "../api/client";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  InputLabel,
  Link,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";

const STATUS_OPTIONS = [
  { value: "OPEN", label: "Open" },
  { value: "UNDER_REVIEW", label: "Under review" },
  { value: "RESOLVED_NOT_DUPLICATE", label: "Resolved: not duplicate" },
  { value: "RESOLVED_DUPLICATE", label: "Resolved: duplicate" },
  { value: "TRANSFER_APPROVED", label: "Transfer approved" },
  { value: "MERGED", label: "Merged" },
  { value: "CLOSED", label: "Closed" },
  { value: "ALL", label: "All statuses" },
];

const RESOLUTION_ACTIONS = [
  { value: "NOT_DUPLICATE", label: "Mark as not duplicate" },
  { value: "DUPLICATE", label: "Mark as duplicate" },
  { value: "TRANSFER", label: "Approve transfer" },
  { value: "UNDER_REVIEW", label: "Keep under review" },
  { value: "CLOSE", label: "Close case" },
];

const formatDate = (value) => {
  if (!value) return "-";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "-" : d.toISOString().slice(0, 10);
};

const formatDateTime = (value) => {
  if (!value) return "-";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString();
};

const shortId = (value) => (value ? String(value).slice(0, 8) : "-");

const childName = (child) => {
  if (!child) return "-";
  return child.childName || [child.firstName, child.lastName].filter(Boolean).join(" ") || "-";
};

const statusColor = (status) => {
  switch (status) {
    case "OPEN":
      return "error";
    case "UNDER_REVIEW":
      return "warning";
    case "RESOLVED_NOT_DUPLICATE":
    case "RESOLVED_DUPLICATE":
    case "TRANSFER_APPROVED":
    case "MERGED":
    case "CLOSED":
      return "success";
    default:
      return "default";
  }
};

const decisionLabel = (value) => {
  if (!value) return "-";
  const v = String(value).toUpperCase();
  if (v === "SAME_CHILD") return "Same child";
  if (v === "DIFFERENT_CHILD") return "Different child";
  if (v === "NOT_SURE") return "Not sure";
  if (v === "PENDING_SERVER_CHECK") return "Pending server check";
  return value;
};

function InfoLine({ label, value }) {
  return (
    <Box sx={{ display: "flex", gap: 1, py: 0.25 }}>
      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 145 }}>
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={700} sx={{ wordBreak: "break-word" }}>
        {value || "-"}
      </Typography>
    </Box>
  );
}

function ChildSummaryCard({ title, child, fallbackFacility }) {
  return (
    <Card variant="outlined" sx={{ borderRadius: 3, height: "100%" }}>
      <CardContent>
        <Typography fontWeight={900} gutterBottom>
          {title}
        </Typography>
        {child ? (
          <>
            <InfoLine label="Child" value={childName(child)} />
            <InfoLine label="Registration #" value={child.uniqueChildNumber || child.cwcNumber} />
            <InfoLine label="Sex" value={child.sex} />
            <InfoLine label="Date of birth" value={formatDate(child.dateOfBirth)} />
            <InfoLine label="Enrolled" value={formatDate(child.enrollmentDate)} />
            <InfoLine label="Facility" value={child.facility?.name || fallbackFacility?.name} />
            <Divider sx={{ my: 1.2 }} />
            <InfoLine label="Caregiver" value={child.caregiver?.fullName} />
            <InfoLine label="Caregiver phone" value={child.caregiver?.contacts} />
            <InfoLine label="Village" value={child.caregiver?.village} />
            <Divider sx={{ my: 1.2 }} />
            <InfoLine label="Last visit" value={formatDate(child.lastVisit?.visitDate)} />
            <InfoLine label="Last MUAC" value={child.lastVisit?.muacMm} />
            <InfoLine label="Last WHZ" value={child.lastVisit?.whzScore} />
            <InfoLine label="Last dispensed" value={child.lastVisit?.sachetsDispensed} />
            {child.id ? (
              <Link component={RouterLink} to={`/children/${child.id}`} sx={{ display: "inline-block", mt: 1 }}>
                Open child record
              </Link>
            ) : null}
          </>
        ) : (
          <Typography color="text.secondary">No child details available.</Typography>
        )}
      </CardContent>
    </Card>
  );
}

export default function DuplicateCases() {
  const [data, setData] = useState({ rows: [], total: 0, take: 10, skip: 0 });
  const [status, setStatus] = useState("OPEN");
  const [q, setQ] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [selected, setSelected] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [resolutionAction, setResolutionAction] = useState("UNDER_REVIEW");
  const [resolutionNote, setResolutionNote] = useState("");
  const [saving, setSaving] = useState(false);

  const loadCases = useCallback(async () => {
    try {
      setLoading(true);
      setErr("");

      const skip = page * rowsPerPage;
      const params = new URLSearchParams();
      params.set("take", String(rowsPerPage));
      params.set("skip", String(skip));
      if (status) params.set("status", status);
      if (q) params.set("q", q);

      const res = await api.get(`/api/dashboard/duplicate-cases?${params.toString()}`);
      setData(res.data || { rows: [], total: 0, take: rowsPerPage, skip });
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || "Failed to load duplicate cases");
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, status, q]);

  useEffect(() => {
    loadCases();
  }, [loadCases]);

  const handleSearch = () => {
    setPage(0);
    setQ(searchInput.trim());
  };

  const handleStatusChange = (e) => {
    setStatus(e.target.value);
    setPage(0);
  };

  const openDetails = async (row) => {
    setSelected(row);
    setResolutionAction("UNDER_REVIEW");
    setResolutionNote("");
    setDetailOpen(true);

    try {
      const res = await api.get(`/api/dashboard/duplicate-cases/${row.id}`);
      setSelected(res.data || row);
    } catch (e) {
      console.warn("Failed to load duplicate case detail", e);
    }
  };

  const saveResolution = async () => {
    if (!selected?.id) return;
    try {
      setSaving(true);
      setErr("");
      const res = await api.patch(`/api/dashboard/duplicate-cases/${selected.id}/resolve`, {
        action: resolutionAction,
        note: resolutionNote,
      });
      setSelected(res.data?.case || selected);
      await loadCases();
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || "Failed to resolve duplicate case");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Card sx={{ borderRadius: 4 }}>
        <CardContent>
          <Stack
            direction={{ xs: "column", md: "row" }}
            justifyContent="space-between"
            alignItems={{ xs: "stretch", md: "center" }}
            spacing={2}
          >
            <Box>
              <Typography variant="h6" fontWeight={900}>
                Duplicate Review
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Review possible duplicate children flagged by the mobile app or backend validation.
              </Typography>
            </Box>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <FormControl size="small" sx={{ minWidth: 210 }}>
                <InputLabel id="duplicate-status-filter-label">Status</InputLabel>
                <Select
                  labelId="duplicate-status-filter-label"
                  label="Status"
                  value={status}
                  onChange={handleStatusChange}
                >
                  {STATUS_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                size="small"
                label="Search case/user decision"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSearch();
                }}
              />

              <Button variant="contained" onClick={handleSearch}>
                Search
              </Button>
            </Stack>
          </Stack>

          {err ? (
            <Alert severity="error" sx={{ mt: 2 }}>
              {err}
            </Alert>
          ) : null}

          {loading ? (
            <Typography sx={{ mt: 2 }}>Loading...</Typography>
          ) : (
            <>
              <Table size="small" sx={{ mt: 2 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Case</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Mobile decision</TableCell>
                    <TableCell>Triggering child</TableCell>
                    <TableCell>Possible match</TableCell>
                    <TableCell>Facilities</TableCell>
                    <TableCell align="right">Score</TableCell>
                    <TableCell>Created</TableCell>
                    <TableCell>Action</TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {(data.rows || []).map((row) => (
                    <TableRow key={row.id} hover>
                      <TableCell>{shortId(row.id)}</TableCell>
                      <TableCell>
                        <Chip size="small" color={statusColor(row.status)} label={row.status || "-"} />
                      </TableCell>
                      <TableCell>{decisionLabel(row.mobileDecision)}</TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={800}>
                          {childName(row.primaryChild)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {row.primaryChild?.uniqueChildNumber || row.primaryChild?.cwcNumber || shortId(row.primaryChildId)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={800}>
                          {childName(row.duplicateChild)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {row.duplicateChild?.uniqueChildNumber || row.duplicateChild?.cwcNumber || shortId(row.duplicateChildId)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{row.facility?.name || "-"}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Match: {row.matchingFacility?.name || "-"}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">{row.matchScore ?? "-"}</TableCell>
                      <TableCell>{formatDateTime(row.createdAt)}</TableCell>
                      <TableCell>
                        <Button size="small" variant="outlined" onClick={() => openDetails(row)}>
                          Review
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}

                  {(!data.rows || data.rows.length === 0) ? (
                    <TableRow>
                      <TableCell colSpan={9}>No duplicate cases found.</TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>

              <TablePagination
                component="div"
                count={data.total || 0}
                page={page}
                onPageChange={(_, newPage) => setPage(newPage)}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={(e) => {
                  setRowsPerPage(parseInt(e.target.value, 10));
                  setPage(0);
                }}
                rowsPerPageOptions={[10, 25, 50]}
              />
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>Duplicate case review</DialogTitle>
        <DialogContent dividers>
          {selected ? (
            <Box sx={{ display: "grid", gap: 2 }}>
              <Stack direction={{ xs: "column", md: "row" }} spacing={1.2} alignItems={{ xs: "stretch", md: "center" }}>
                <Chip color={statusColor(selected.status)} label={selected.status || "-"} />
                <Chip label={`Mobile decision: ${decisionLabel(selected.mobileDecision)}`} />
                <Chip label={`Source: ${selected.source || "-"}`} />
                <Chip label={`Score: ${selected.matchScore ?? "-"}`} />
              </Stack>

              {Array.isArray(selected.matchReasons) && selected.matchReasons.length ? (
                <Alert severity="info">
                  <strong>Match reasons:</strong> {selected.matchReasons.join(", ")}
                </Alert>
              ) : null}

              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                  gap: 2,
                }}
              >
                <ChildSummaryCard
                  title="Triggering / current record"
                  child={selected.primaryChild}
                  fallbackFacility={selected.facility}
                />
                <ChildSummaryCard
                  title="Possible duplicate / matching record"
                  child={selected.duplicateChild}
                  fallbackFacility={selected.matchingFacility}
                />
              </Box>

              <Card variant="outlined" sx={{ borderRadius: 3 }}>
                <CardContent>
                  <Typography fontWeight={900} gutterBottom>
                    Resolution
                  </Typography>
                  <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                    <FormControl size="small" sx={{ minWidth: 260 }}>
                      <InputLabel id="resolution-action-label">Action</InputLabel>
                      <Select
                        labelId="resolution-action-label"
                        label="Action"
                        value={resolutionAction}
                        onChange={(e) => setResolutionAction(e.target.value)}
                      >
                        {RESOLUTION_ACTIONS.map((option) => (
                          <MenuItem key={option.value} value={option.value}>
                            {option.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <TextField
                      size="small"
                      label="Resolution note"
                      value={resolutionNote}
                      onChange={(e) => setResolutionNote(e.target.value)}
                      fullWidth
                    />
                    <Button variant="contained" onClick={saveResolution} disabled={saving}>
                      {saving ? "Saving..." : "Save"}
                    </Button>
                  </Stack>

                  {selected.resolutionAction ? (
                    <Box sx={{ mt: 1.5 }}>
                      <Typography variant="body2" color="text.secondary">
                        Last resolution: <strong>{selected.resolutionAction}</strong>{" "}
                        {selected.resolvedAt ? `on ${formatDateTime(selected.resolvedAt)}` : ""}
                      </Typography>
                      {selected.resolutionNote ? (
                        <Typography variant="body2" color="text.secondary">
                          Note: {selected.resolutionNote}
                        </Typography>
                      ) : null}
                    </Box>
                  ) : null}
                </CardContent>
              </Card>
            </Box>
          ) : (
            <Typography>Loading...</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
