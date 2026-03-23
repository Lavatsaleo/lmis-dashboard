import React, { useState } from "react";
import { api } from "../api/client";
import { Box, Button, Card, CardContent, TextField, Typography } from "@mui/material";

export default function Login({ onLoggedIn }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
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
    }
  };

  return (
    <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", p: 2 }}>
      <Card sx={{ width: 420 }}>
        <CardContent>
          <Typography variant="h5" fontWeight={800} gutterBottom>
            LMIS Dashboard Login
          </Typography>
          <Box component="form" onSubmit={submit} sx={{ display: "grid", gap: 2, mt: 2 }}>
            <TextField label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <TextField label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            {err ? <Typography color="error">{err}</Typography> : null}
            <Button type="submit" variant="contained">Sign in</Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
