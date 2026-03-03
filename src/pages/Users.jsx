import React, { useEffect, useMemo, useState } from "react";
import { Link as RouterLink, useOutletContext } from "react-router-dom";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Stack,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  Divider,
  Switch,
  Snackbar,
  Alert,
} from "@mui/material";
import { alpha } from "@mui/material/styles";

import { api } from "../api/client";

const ROLE_OPTIONS = [
  "SUPER_ADMIN",
  "WAREHOUSE_OFFICER",
  "FACILITY_OFFICER",
  "CLINICIAN",
  "VIEWER",
];

export default function Users() {
  const { me } = useOutletContext();

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState(""); // "" | "active" | "disabled"
  const [facilityCode, setFacilityCode] = useState("");

  const [facilities, setFacilities] = useState([]);
  const [toast, setToast] = useState({ open: false, msg: "", severity: "success" });

  const isSuperAdmin = me?.role === "SUPER_ADMIN";

  const params = useMemo(() => {
    const p = { take: 50, skip: 0 };
    if (q.trim()) p.q = q.trim();
    if (role) p.role = role;
    if (facilityCode) p.facilityCode = facilityCode;
    if (status === "active") p.isActive = true;
    if (status === "disabled") p.isActive = false;
    return p;
  }, [q, role, status, facilityCode]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    api
      .get("/api/facilities?type=FACILITY")
      .then((res) => setFacilities(res.data || []))
      .catch(() => setFacilities([]));
  }, [isSuperAdmin]);

  const load = async () => {
    if (!isSuperAdmin) return;
    setLoading(true);
    setErr("");
    try {
      const res = await api.get("/api/admin/users", { params });
      setRows(res.data?.rows || []);
      setTotal(res.data?.total || 0);
    } catch (e) {
      setErr(e?.response?.data?.message || e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, isSuperAdmin]);

  const toggleActive = async (user) => {
    try {
      await api.patch(`/api/admin/users/${user.id}`, { isActive: !user.isActive });
      setToast({ open: true, msg: "User updated", severity: "success" });
      load();
    } catch (e) {
      setToast({ open: true, msg: e?.response?.data?.message || e.message, severity: "error" });
    }
  };

  if (!isSuperAdmin) {
    return (
      <Card sx={{ overflow: "hidden" }}>
        <CardContent>
          <Typography variant="h6" fontWeight={900} gutterBottom>
            Users
          </Typography>
          <Typography color="text.secondary">
            Forbidden: only Super Admin can manage users.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Box sx={{ display: "grid", gap: 2.5 }}>
      <Card sx={{ overflow: "hidden" }}>
        <CardContent>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ xs: "stretch", md: "center" }} justifyContent="space-between">
            <Box>
              <Typography variant="h6" fontWeight={900}>
                Users
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Create, enable/disable accounts and assign roles/facilities.
              </Typography>
            </Box>

            <Button component={RouterLink} to="/users/new" variant="contained">
              Add User
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Card sx={{ overflow: "hidden" }}>
        <CardContent>
          <Stack direction={{ xs: "column", lg: "row" }} spacing={2} alignItems={{ xs: "stretch", lg: "center" }}>
            <TextField
              size="small"
              label="Search (name/email)"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              sx={{ minWidth: { xs: "100%", lg: 280 } }}
            />

            <FormControl size="small" sx={{ minWidth: { xs: "100%", lg: 220 } }}>
              <InputLabel>Role</InputLabel>
              <Select label="Role" value={role} onChange={(e) => setRole(e.target.value)}>
                <MenuItem value="">All roles</MenuItem>
                {ROLE_OPTIONS.map((r) => (
                  <MenuItem key={r} value={r}>
                    {r}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: { xs: "100%", lg: 180 } }}>
              <InputLabel>Status</InputLabel>
              <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
                <MenuItem value="">All</MenuItem>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="disabled">Disabled</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: { xs: "100%", lg: 280 } }}>
              <InputLabel>Facility</InputLabel>
              <Select
                label="Facility"
                value={facilityCode}
                onChange={(e) => setFacilityCode(e.target.value)}
              >
                <MenuItem value="">All facilities</MenuItem>
                {facilities.map((f) => (
                  <MenuItem key={f.id} value={f.code}>
                    {f.name} ({f.code})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Box sx={{ flexGrow: 1 }} />

            <Chip
              size="small"
              label={`${total} user(s)`}
              sx={{ bgcolor: alpha("#005fb6", 0.08), fontWeight: 900, alignSelf: { xs: "flex-start", lg: "center" } }}
            />
          </Stack>

          <Divider sx={{ my: 2 }} />

          {err ? (
            <Typography color="error" sx={{ mb: 2 }}>
              {err}
            </Typography>
          ) : null}

          <TableContainer sx={{ maxHeight: 540 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Facility</TableCell>
                  <TableCell align="center">Active</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5}>Loading…</TableCell>
                  </TableRow>
                ) : null}

                {!loading && rows.map((u) => (
                  <TableRow key={u.id} hover>
                    <TableCell sx={{ fontWeight: 800 }}>{u.fullName}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>
                      <Chip size="small" label={u.role} />
                    </TableCell>
                    <TableCell>
                      {u.facility ? `${u.facility.name} (${u.facility.code})` : "-"}
                    </TableCell>
                    <TableCell align="center">
                      <Switch
                        checked={!!u.isActive}
                        onChange={() => toggleActive(u)}
                        inputProps={{ "aria-label": "toggle active" }}
                      />
                    </TableCell>
                  </TableRow>
                ))}

                {!loading && rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5}>No users found.</TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      <Snackbar
        open={toast.open}
        autoHideDuration={3500}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          severity={toast.severity}
          variant="filled"
          onClose={() => setToast((t) => ({ ...t, open: false }))}
        >
          {toast.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
