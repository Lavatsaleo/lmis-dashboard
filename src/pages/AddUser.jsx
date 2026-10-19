import React, { useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Stack,
  TextField,
  Button,
  Divider,
  Alert,
  FormControlLabel,
  Checkbox,
} from "@mui/material";
import { api } from "../api/client";
import RoleLocationFields from "../components/users/RoleLocationFields";
import { useUserSummary } from "../components/users/useUserAdmin";
import {
  ROLE_META,
  assignableRoles,
  assignmentKind,
  genPassword,
  locationLabelFor,
  roleUnavailableReason,
} from "../components/users/roles";

export default function AddUser() {
  const { me } = useOutletContext();
  const isSuperAdmin = me?.role === "SUPER_ADMIN";
  const isAdmin = isSuperAdmin || me?.role === "COUNTRY_ADMIN";

  const nav = useNavigate();
  const { implementations } = useUserSummary(isAdmin);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("CLINICIAN");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [chosenImplementationId, setChosenImplementationId] = useState("");
  const [facilityCode, setFacilityCode] = useState("");
  const [requirePasswordChange, setRequirePasswordChange] = useState(true);

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [okMsg, setOkMsg] = useState("");

  // Default to the admin's own country until they pick one.
  const ownId = me?.platformContext?.implementation?.id || "";
  const implementationId =
    chosenImplementationId || (implementations.some((i) => i.id === ownId) ? ownId : implementations[0]?.id || "");
  const implementation = implementations.find((i) => i.id === implementationId) || null;
  const kind = assignmentKind(role, facilityCode);
  const needsCountry = kind !== "global";

  const changeImplementation = (id) => {
    setChosenImplementationId(id);
    setFacilityCode("");
    // e.g. switching to South Sudan while "Clinician" is selected.
    const next = implementations.find((i) => i.id === id);
    if (roleUnavailableReason(role, next)) setRole("WAREHOUSE_OFFICER");
  };

  const changeRole = (r) => {
    setRole(r);
    setFacilityCode("");
  };

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setOkMsg("");

    if (!fullName.trim()) return setErr("Full name is required");
    if (!email.trim()) return setErr("Email is required");
    if (!password) return setErr("Password is required");
    if (password.length < 8) return setErr("Password must be at least 8 characters");
    if (password !== confirm) return setErr("Passwords do not match");
    if (needsCountry && !implementationId) return setErr("Country / programme is required");
    const unavailable = needsCountry ? roleUnavailableReason(role, implementation) : "";
    if (unavailable) return setErr(`${ROLE_META[role].label}: ${unavailable}`);
    if (kind === "location" && !facilityCode) return setErr(`${locationLabelFor(role)} is required`);

    const payload = {
      email: email.trim().toLowerCase(),
      fullName: fullName.trim(),
      password,
      role,
      requirePasswordChange,
    };
    if (needsCountry) payload.implementationId = implementationId;
    if (kind === "location") payload.facilityCode = String(facilityCode);

    setSaving(true);
    try {
      await api.post("/api/admin/users", payload);
      setOkMsg("User created successfully");
      setTimeout(() => nav("/users"), 800);
    } catch (e2) {
      setErr(e2?.response?.data?.message || e2.message);
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) {
    return (
      <Card sx={{ overflow: "hidden" }}>
        <CardContent>
          <Typography variant="h6" fontWeight={900} gutterBottom>
            Add User
          </Typography>
          <Typography color="text.secondary">
            Forbidden: only administrators can add users.
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
                Pick the country first: it decides which roles and locations are available.
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

            <RoleLocationFields
              implementations={implementations}
              implementationId={implementationId}
              onImplementationChange={changeImplementation}
              role={role}
              onRoleChange={changeRole}
              roles={assignableRoles(me)}
              countryLocked={!isSuperAdmin}
              facilityCode={facilityCode}
              onFacilityCodeChange={setFacilityCode}
            />

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

            <FormControlLabel
              control={
                <Checkbox checked={requirePasswordChange} onChange={(e) => setRequirePasswordChange(e.target.checked)} />
              }
              label={
                <Typography variant="body2">
                  Ask them to choose their own password at first sign-in
                  <Typography component="span" variant="caption" color="text.secondary" sx={{ display: "block" }}>
                    Recommended. Untick only for someone still on an older mobile app version.
                  </Typography>
                </Typography>
              }
            />

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
