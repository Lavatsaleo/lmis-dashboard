import React, { useState } from "react";
import { api } from "../api/client";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import anchorLogo from "../assets/anchor-logo.png";
import { brand } from "../theme";

export default function Login({ onLoggedIn }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setErr("");
    setSubmitting(true);
    try {
      const res = await api.post("/api/auth/login", { email, password });
      const token = res.data?.accessToken || res.data?.token;
      if (!token) throw new Error("No token returned from login");

      const now = Date.now();
      localStorage.setItem("accessToken", token);
      localStorage.setItem("sessionStartedAt", String(now));
      localStorage.setItem("lastActivityAt", String(now));

      onLoggedIn();
    } catch (e2) {
      setErr(e2?.response?.data?.message || e2.message);
      setSubmitting(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        px: 2,
        py: 4,
        background: `radial-gradient(1200px 600px at 50% -10%, ${alpha(brand.teal, 0.16)}, transparent 60%), ${brand.surface}`,
      }}
    >
      <Box sx={{ width: "100%", maxWidth: 420 }}>
        <Box sx={{ textAlign: "center", mb: 3 }}>
          <Box
            component="img"
            src={anchorLogo}
            alt="Anchor"
            sx={{ width: { xs: 132, sm: 156 }, height: "auto", display: "inline-block" }}
          />
        </Box>

        <Card>
          <CardContent sx={{ p: { xs: 3, sm: 4 }, "&:last-child": { pb: { xs: 3, sm: 4 } } }}>
            <Typography variant="h5" component="h1">
              Sign in
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 3 }}>
              Use your Anchor account to continue.
            </Typography>

            <Box component="form" onSubmit={submit} noValidate sx={{ display: "grid", gap: 2 }}>
              <TextField
                label="Email"
                type="email"
                autoComplete="username"
                autoFocus
                fullWidth
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <TextField
                label="Password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                fullWidth
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          aria-label={showPassword ? "Hide password" : "Show password"}
                          onClick={() => setShowPassword((v) => !v)}
                          edge="end"
                        >
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
              />
              {err ? <Alert severity="error">{err}</Alert> : null}
              <Button
                type="submit"
                variant="contained"
                size="large"
                disabled={submitting || !email || !password}
                startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : null}
                sx={{ minHeight: 48 }}
              >
                {submitting ? "Signing in…" : "Sign in"}
              </Button>
            </Box>
          </CardContent>
        </Card>

        <Typography variant="caption" color="text.secondary" sx={{ display: "block", textAlign: "center", mt: 3 }}>
          Anchor · by Action Against Hunger
        </Typography>
      </Box>
    </Box>
  );
}
