import React, { useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import { api } from "../../api/client";

/** Admins set the warehouse building type and inside size for the 3D view. */
export default function BuildingDialog({ warehouse, onClose, onSaved }) {
  const st = warehouse.structure || {};
  const [type, setType] = useState(st.type || "BUILDING");
  const [lengthM, setLengthM] = useState(st.lengthM ?? (st.type === "RUBB_HALL" ? 24 : ""));
  const [widthM, setWidthM] = useState(st.widthM ?? (st.type === "RUBB_HALL" ? 10 : ""));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const save = async () => {
    setErr("");
    try {
      setSaving(true);
      await api.patch(`/api/stock-locations/${warehouse.id}`, {
        structureType: type,
        lengthM: lengthM === "" ? null : Number(lengthM),
        widthM: widthM === "" ? null : Number(widthM),
      });
      onSaved();
    } catch (e) {
      setErr(e?.response?.data?.message || e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onClose={saving ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>Building</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {err ? <Alert severity="error">{err}</Alert> : null}
          <Typography variant="body2" color="text.secondary">
            Shapes the 3D view of {warehouse.name}. Measure the inside of the hall.
          </Typography>
          <FormControl fullWidth>
            <InputLabel>Type</InputLabel>
            <Select
              label="Type"
              value={type}
              onChange={(e) => {
                setType(e.target.value);
                if (e.target.value === "RUBB_HALL") {
                  if (lengthM === "") setLengthM(24);
                  if (widthM === "") setWidthM(10);
                }
              }}
            >
              <MenuItem value="RUBB_HALL">Rubb hall (tented warehouse)</MenuItem>
              <MenuItem value="BUILDING">Building / store</MenuItem>
            </Select>
          </FormControl>
          <Stack direction="row" spacing={2}>
            <TextField label="Length (m)" type="number" value={lengthM} onChange={(e) => setLengthM(e.target.value)} inputProps={{ min: 3, max: 500, step: 0.5 }} fullWidth />
            <TextField label="Width (m)" type="number" value={widthM} onChange={(e) => setWidthM(e.target.value)} inputProps={{ min: 3, max: 500, step: 0.5 }} fullWidth />
          </Stack>
          <Typography variant="caption" color="text.secondary">
            Common Rubb halls: 10 × 24 m, 10 × 32 m, 20 × 40 m.
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button variant="contained" onClick={save} disabled={saving}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
