import React, { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  FormControl,
  InputLabel,
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

import { api } from "../api/client";
import ImplementationPicker from "../components/ImplementationPicker";
import { useImplementationChoice } from "../components/implementationChoice";
import { roleLabel } from "../components/users/roles";

const PAGE_SIZE = 50;

// What each action means, and how loud it should look.
const ACTIONS = {
  USER_CREATED: { label: "User created", color: "success" },
  USER_UPDATED: { label: "User updated", color: "default" },
  ROLE_CHANGED: { label: "Role changed", color: "warning" },
  USER_DISABLED: { label: "User disabled", color: "error" },
  USER_ENABLED: { label: "User enabled", color: "success" },
  PASSWORD_RESET: { label: "Password reset", color: "warning" },
  PASSWORD_CHANGED: { label: "Password changed", color: "default" },
  USER_UNLOCKED: { label: "Unlocked", color: "info" },
  ACCOUNT_LOCKED: { label: "Account locked", color: "error" },
  LOGIN_FAILED: { label: "Failed sign-in", color: "default" },
};

function describe(row) {
  const d = row.details || {};
  switch (row.action) {
    case "USER_CREATED":
      return [roleLabel(d.role), d.facilityCode ? `at ${d.facilityCode}` : null, d.mustChangePassword ? "must set own password" : null]
        .filter(Boolean)
        .join(" · ");
    case "ROLE_CHANGED":
    case "USER_UPDATED":
      return Object.entries(d)
        .map(([field, change]) => {
          const name = { role: "Role", facility: "Location", implementationId: "Country", fullName: "Name" }[field] || field;
          const show = (v) => (field === "role" ? roleLabel(v) : v) || "none";
          return `${name}: ${show(change?.from)} → ${show(change?.to)}`;
        })
        .join(" · ");
    case "PASSWORD_RESET":
      return d.mustChangePassword ? "Must set own password at next sign-in" : "No change required";
    case "ACCOUNT_LOCKED":
      return `${d.failedAttempts || "Several"} wrong passwords · locked ${d.lockedMinutes || 15} min`;
    case "LOGIN_FAILED":
      return d.failedAttempts ? `Attempt ${d.failedAttempts} in a row` : "";
    default:
      return "";
  }
}

export default function AuditLog() {
  const { me } = useOutletContext();
  const isAdmin = me?.role === "SUPER_ADMIN" || me?.role === "COUNTRY_ADMIN";
  const { implementations, implementationId, setImplementationId, isSuperAdmin } = useImplementationChoice(me);

  const [action, setAction] = useState("");
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [allCountries, setAllCountries] = useState(true);
  const [page, setPage] = useState(0);
  const [data, setData] = useState({ key: null, total: 0, rows: [], error: "" });

  const params = useMemo(() => {
    const p = { take: PAGE_SIZE, skip: page * PAGE_SIZE };
    if (action) p.action = action;
    if (q.trim()) p.q = q.trim();
    if (from) p.from = new Date(`${from}T00:00:00`).toISOString();
    if (to) p.to = new Date(`${to}T23:59:59.999`).toISOString();
    if (isSuperAdmin && !allCountries && implementationId) p.implementationId = implementationId;
    return p;
  }, [action, q, from, to, page, isSuperAdmin, allCountries, implementationId]);
  const key = JSON.stringify(params);

  useEffect(() => {
    if (!isAdmin) return undefined;
    let mounted = true;
    api
      .get("/api/admin/audit-logs", { params })
      .then((res) => mounted && setData({ key, total: res.data?.total || 0, rows: res.data?.rows || [], error: "" }))
      .catch((e) => mounted && setData({ key, total: 0, rows: [], error: e?.response?.data?.message || e.message }));
    return () => {
      mounted = false;
    };
  }, [isAdmin, params, key]);

  const loading = data.key !== key;
  const pages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));
  const resetPage = (fn) => (value) => {
    fn(value);
    setPage(0);
  };

  if (!isAdmin) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" fontWeight={900} gutterBottom>
            Audit Log
          </Typography>
          <Typography color="text.secondary">Forbidden: only administrators can view the audit log.</Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Box sx={{ display: "grid", gap: 2.5 }}>
      <Card>
        <CardContent>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} justifyContent="space-between" alignItems={{ xs: "stretch", md: "center" }}>
            <Box>
              <Typography variant="h6" fontWeight={900}>
                Audit Log
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Who created, changed, disabled or reset which account, plus lockouts and failed sign-ins.
              </Typography>
            </Box>
            {isSuperAdmin ? (
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "stretch", sm: "center" }}>
                <FormControl size="small" sx={{ minWidth: 160 }}>
                  <InputLabel>Scope</InputLabel>
                  <Select label="Scope" value={allCountries ? "all" : "one"} onChange={(e) => resetPage(setAllCountries)(e.target.value === "all")}>
                    <MenuItem value="all">All countries</MenuItem>
                    <MenuItem value="one">One country</MenuItem>
                  </Select>
                </FormControl>
                {!allCountries ? (
                  <ImplementationPicker
                    implementations={implementations}
                    value={implementationId}
                    onChange={resetPage(setImplementationId)}
                    isSuperAdmin={isSuperAdmin}
                  />
                ) : null}
              </Stack>
            ) : null}
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack direction={{ xs: "column", lg: "row" }} spacing={2} useFlexGap flexWrap="wrap" alignItems={{ xs: "stretch", lg: "center" }}>
            <TextField
              size="small"
              label="Search email"
              value={q}
              onChange={(e) => resetPage(setQ)(e.target.value)}
              sx={{ minWidth: { xs: "100%", lg: 240 } }}
            />
            <FormControl size="small" sx={{ minWidth: { xs: "100%", lg: 200 } }}>
              <InputLabel>Action</InputLabel>
              <Select label="Action" value={action} onChange={(e) => resetPage(setAction)(e.target.value)}>
                <MenuItem value="">All actions</MenuItem>
                {Object.entries(ACTIONS).map(([value, meta]) => (
                  <MenuItem key={value} value={value}>
                    {meta.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              size="small"
              type="date"
              label="From"
              value={from}
              onChange={(e) => resetPage(setFrom)(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: { xs: "100%", lg: 170 } }}
            />
            <TextField
              size="small"
              type="date"
              label="To"
              value={to}
              onChange={(e) => resetPage(setTo)(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: { xs: "100%", lg: 170 } }}
            />
            <Box sx={{ flexGrow: 1 }} />
            <Chip size="small" label={`${data.total} entr${data.total === 1 ? "y" : "ies"}`} sx={{ fontWeight: 800, alignSelf: { xs: "flex-start", lg: "center" } }} />
          </Stack>

          <Divider sx={{ my: 2 }} />

          {data.error ? (
            <Typography color="error" sx={{ mb: 2 }}>
              {data.error}
            </Typography>
          ) : null}

          <TableContainer sx={{ maxHeight: 620 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>When</TableCell>
                  <TableCell>Action</TableCell>
                  <TableCell>Account</TableCell>
                  <TableCell>Done by</TableCell>
                  <TableCell>Details</TableCell>
                  <TableCell>IP address</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6}>Loading…</TableCell>
                  </TableRow>
                ) : null}
                {!loading &&
                  data.rows.map((row) => {
                    const meta = ACTIONS[row.action] || { label: row.action, color: "default" };
                    const selfAction = row.actorId && row.actorId === row.targetId;
                    return (
                      <TableRow key={row.id} hover>
                        <TableCell sx={{ whiteSpace: "nowrap" }}>{new Date(row.createdAt).toLocaleString()}</TableCell>
                        <TableCell>
                          <Chip size="small" color={meta.color} variant={meta.color === "default" ? "outlined" : "filled"} label={meta.label} />
                        </TableCell>
                        <TableCell>{row.targetLabel || "-"}</TableCell>
                        <TableCell>
                          {selfAction ? (
                            <Typography variant="body2" color="text.secondary">
                              The user
                            </Typography>
                          ) : (
                            <>
                              <Typography variant="body2" fontWeight={600}>
                                {row.actor?.fullName || row.actorEmail || "System"}
                              </Typography>
                              {row.actor?.role ? (
                                <Typography variant="caption" color="text.secondary">
                                  {roleLabel(row.actor.role)}
                                </Typography>
                              ) : null}
                            </>
                          )}
                        </TableCell>
                        <TableCell sx={{ minWidth: 220 }}>{describe(row) || "-"}</TableCell>
                        <TableCell sx={{ whiteSpace: "nowrap", color: "text.secondary" }}>{row.ipAddress || "-"}</TableCell>
                      </TableRow>
                    );
                  })}
                {!loading && data.rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6}>No entries match these filters.</TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </TableContainer>

          {pages > 1 ? (
            <Stack direction="row" spacing={1} justifyContent="flex-end" alignItems="center" sx={{ mt: 2 }}>
              <Button size="small" disabled={page === 0 || loading} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Typography variant="body2" color="text.secondary">
                Page {page + 1} of {pages}
              </Typography>
              <Button size="small" disabled={page + 1 >= pages || loading} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </Stack>
          ) : null}
        </CardContent>
      </Card>
    </Box>
  );
}
