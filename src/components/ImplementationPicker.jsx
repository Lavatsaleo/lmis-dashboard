import React from "react";
import { FormControl, InputLabel, MenuItem, Select } from "@mui/material";

/**
 * Country / programme selector for SUPER_ADMIN (see useImplementationChoice).
 * Renders nothing for other roles or when there is only one implementation.
 */
export default function ImplementationPicker({ implementations, value, onChange, isSuperAdmin }) {
  if (!isSuperAdmin || implementations.length < 2) return null;
  return (
    <FormControl size="small" sx={{ minWidth: 260 }}>
      <InputLabel>Country / programme</InputLabel>
      <Select label="Country / programme" value={value} onChange={(e) => onChange(e.target.value)}>
        {implementations.map((impl) => (
          <MenuItem key={impl.id} value={impl.id}>
            {[impl.country?.name, impl.name].filter(Boolean).join(" • ")}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
