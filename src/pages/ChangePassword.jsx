import React, { useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";

import { api, clearSessionAndRedirect } from "../api/client";
import anchorLogo from "../assets/anchor-logo.png";

/**
 * Choose a new password. `required` (an admin created the account or reset the
 * password) shows it full-page before anything else; the server refuses other
 * requests until it is done. Otherwise it is the "Change password" page.
 */
export function ChangePasswordForm({ required = false, onChanged }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setOk("");
    if (!current) return setErr("Enter your current password.");
    if (next.length < 8) return setErr("The new password must be at least 8 characters.");
    if (next !== confirm) return setErr("The new passwords do not match.");
    if (next === current) return setErr("Choose a password different from the current one.");

    setSaving(true);
    try {
      const res = await api.post("/api/auth/change-password", { currentPassword: current, newPassword: next });
      if (res.data?.accessToken) localStorage.setItem("accessToken", res.data.accessToken);
      setCurrent("");
      setNext("");
      setConfirm("");
      setOk("Password changed. Other devices have been signed out.");
      onChanged?.(res.data?.user || null);
    } catch (e2) {
      setErr(e2?.response?.data?.message || e2.message);
    } finally {
      setSaving(false);
    }
  };

  const toggle = (
    <InputAdornment position="end">
      <IconButton onClick={() => setShow((s) => !s)} edge="end" aria-label={show ? "Hide passwords" : "Show passwords"}>
        {show ? <VisibilityOff /> : <Visibility />}
      </IconButton>
    </InputAdornment>
  );
  const type = show ? "text" : "password";

  return (
    <Box component="form" onSubmit={submit} sx={{ display: "grid", gap: 2 }}>
      {required ? (
        <Alert severity="info">
          Your password was set by an administrator. Choose a new one that only you know before continuing.
        </Alert>
      ) : null}
      {err ? <Alert severity="error">{err}</Alert> : null}
      {ok ? <Alert severity="success">{ok}</Alert> : null}
      <TextField
        label="Current password"
        type={type}
        value={current}
        onChange={(e) => setCurrent(e.target.value)}
        autoComplete="current-password"
        InputProps={{ endAdornment: toggle }}
        fullWidth
      />
      <TextField
        label="New password"
        type={type}
        value={next}
        onChange={(e) => setNext(e.target.value)}
        autoComplete="new-password"
        helperText="At least 8 characters."
        fullWidth
      />
      <TextField
        label="Confirm new password"
        type={type}
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        autoComplete="new-password"
        fullWidth
      />
      <Stack direction={{ xs: "column-reverse", sm: "row" }} spacing={1} justifyContent="flex-end">
        {required ? (
          <Button color="secondary" onClick={clearSessionAndRedirect} disabled={saving}>
            Sign out
          </Button>
        ) : null}
        <Button type="submit" variant="contained" disabled={saving}>
          {saving ? "Saving…" : "Save new password"}
        </Button>
      </Stack>
    </Box>
  );
}

/** Full-page version shown by DashboardLayout while a change is required. */
export function RequiredPasswordChange({ onChanged }) {
  return (
    <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", px: 2, py: 4, bgcolor: "background.default" }}>
      <Card sx={{ width: "100%", maxWidth: 480 }}>
        <CardContent sx={{ display: "grid", gap: 2.5, p: { xs: 2.5, sm: 3.5 } }}>
          <Box component="img" src={anchorLogo} alt="Anchor" sx={{ height: 56, objectFit: "contain", justifySelf: "center" }} />
          <Box>
            <Typography variant="h6" fontWeight={800}>
              Set your own password
            </Typography>
            <Typography variant="body2" color="text.secondary">
              One step before you continue.
            </Typography>
          </Box>
          <ChangePasswordForm required onChanged={onChanged} />
        </CardContent>
      </Card>
    </Box>
  );
}

export default function ChangePassword() {
  const nav = useNavigate();
  const { refreshMe } = useOutletContext() || {};
  return (
    <Box sx={{ display: "grid", gap: 2.5 }}>
      <Card>
        <CardContent>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="space-between" alignItems={{ xs: "stretch", sm: "center" }}>
            <Box>
              <Typography variant="h6" fontWeight={900}>
                Change password
              </Typography>
              <Typography variant="body2" color="text.secondary">
                You stay signed in here; other devices and browsers are signed out.
              </Typography>
            </Box>
            <Button variant="outlined" onClick={() => nav(-1)}>
              Back
            </Button>
          </Stack>
        </CardContent>
      </Card>
      <Card sx={{ maxWidth: 560 }}>
        <CardContent>
          <ChangePasswordForm onChanged={() => refreshMe?.()} />
        </CardContent>
      </Card>
    </Box>
  );
}
