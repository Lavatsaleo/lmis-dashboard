import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Stack,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  Alert,
} from "@mui/material";
import { api } from "../api/client";

const ROLE_OPTIONS = [
  "SUPER_ADMIN",
  "WAREHOUSE_OFFICER",
  "FACILITY_OFFICER",
  "CLINICIAN",
  "VIEWER",
];

function genPassword() {
  // simple generator for testing
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#$!";
  let out = "";
  for (let i = 0; i < 12; i++) out += chars[Math.floor(Math.random() * chars.length)];
  // Ensure at least one special
  if (!/[!@#$]/.test(out)) out = out.slice(0, 11) + "!";
  return out;
}

export default function AddUser() {
  const { me } = useOutletContext();
  const isSuperAdmin = me?.role === "SUPER_ADMIN";

  const nav = useNavigate();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("CLINICIAN");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [facilityCode, setFacilityCode] = useState("");
  const [facilities, setFacilities] = useState([]);
  const [warehouses, setWarehouses] = useState([]);

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [okMsg, setOkMsg] = useState("");

  const needsWarehouse = role === "WAREHOUSE_OFFICER";
  const needsFacility = role === "CLINICIAN" || role === "FACILITY_OFFICER";
  const needsFacilityCode = needsWarehouse || needsFacility;

  useEffect(() => {
    if (!isSuperAdmin) return;
    // Load once
    api
      .get("/api/facilities?type=FACILITY")
      .then((res) => setFacilities(res.data || []))
      .catch(() => setFacilities([]));

    api
      .get("/api/facilities?type=WAREHOUSE")
      .then((res) => setWarehouses(res.data || []))
      .catch(() => setWarehouses([]));
  }, [isSuperAdmin]);

  // Clear selection when role changes
  useEffect(() => {
    setFacilityCode("");
  }, [role]);

  const facilityOptions = useMemo(() => {
    if (needsWarehouse) return warehouses;
    if (needsFacility) return facilities;
    return [];
  }, [needsWarehouse, needsFacility, facilities, warehouses]);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setOkMsg("");

    if (!fullName.trim()) return setErr("Full name is required");
    if (!email.trim()) return setErr("Email is required");
    if (!password) return setErr("Password is required");
    if (password.length < 8) return setErr("Password must be at least 8 characters");
    if (password !== confirm) return setErr("Passwords do not match");
    if (!ROLE_OPTIONS.includes(role)) return setErr("Invalid role");
    if (needsFacilityCode && !facilityCode) {
      return setErr(needsWarehouse ? "Warehouse is required" : "Facility is required");
    }

    const payload = {
      email: email.trim().toLowerCase(),
      fullName: fullName.trim(),
      password,
      role,
    };
    if (needsFacilityCode) payload.facilityCode = String(facilityCode);

    setSaving(true);
    try {
      await api.post("/api/admin/users", payload);
      setOkMsg("User created successfully");
      // back to list after short moment
      setTimeout(() => nav("/users"), 800);
    } catch (e2) {
      setErr(e2?.response?.data?.message || e2.message);
    } finally {
      setSaving(false);
    }
  };

  if (!isSuperAdmin) {
    return (
      <Card sx={{ overflow: "hidden" }}>
        <CardContent>
          <Typography variant="h6" fontWeight={900} gutterBottom>
            Add User
          </Typography>
          <Typography color="text.secondary">
            Forbidden: only Super Admin can add users.
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
                Add User
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Create a new account and assign the right role and facility.
              </Typography>
            </Box>

            <Button variant="outlined" onClick={() => nav("/users")}>Back to Users</Button>
          </Stack>
        </CardContent>
      </Card>

      <Card sx={{ overflow: "hidden" }}>
        <CardContent>
          <Box component="form" onSubmit={submit} sx={{ display: "grid", gap: 2 }}>
            {err ? <Alert severity="error">{err}</Alert> : null}
            {okMsg ? <Alert severity="success">{okMsg}</Alert> : null}

            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                label="Full Name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                fullWidth
              />
              <TextField
                label="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                fullWidth
              />
            </Stack>

            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <FormControl fullWidth>
                <InputLabel>Role</InputLabel>
                <Select label="Role" value={role} onChange={(e) => setRole(e.target.value)}>
                  {ROLE_OPTIONS.map((r) => (
                    <MenuItem key={r} value={r}>
                      {r}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {needsFacilityCode ? (
                <FormControl fullWidth>
                  <InputLabel>{needsWarehouse ? "Warehouse" : "Facility"}</InputLabel>
                  <Select
                    label={needsWarehouse ? "Warehouse" : "Facility"}
                    value={facilityCode}
                    onChange={(e) => setFacilityCode(e.target.value)}
                  >
                    {facilityOptions.map((f) => (
                      <MenuItem key={f.id} value={f.code}>
                        {f.name} ({f.code})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              ) : (
                <Box sx={{ flex: 1 }} />
              )}
            </Stack>

            <Divider />

            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                fullWidth
              />
              <TextField
                label="Confirm Password"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                fullWidth
              />
            </Stack>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "stretch", sm: "center" }}>
              <Button
                type="button"
                variant="text"
                onClick={() => {
                  const pw = genPassword();
                  setPassword(pw);
                  setConfirm(pw);
                }}
                sx={{ fontWeight: 900, justifyContent: { xs: "flex-start", sm: "center" } }}
              >
                Generate password
              </Button>

              <Box sx={{ flexGrow: 1 }} />

              <Button type="submit" variant="contained" disabled={saving}>
                {saving ? "Creating…" : "Create User"}
              </Button>
            </Stack>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
