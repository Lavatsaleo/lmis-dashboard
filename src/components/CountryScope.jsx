import React from "react";
import { FormControl, InputLabel, MenuItem, Select } from "@mui/material";

import { ALL_COUNTRIES } from "./useCountryScope";

/** Country selector for the stock pages: SUPER_ADMIN only, and only with more than one country. */
export function CountryScopeSelect({ scope, sx }) {
  if (!scope.isSuperAdmin || scope.implementations.length < 2) return null;
  return (
    <FormControl size="small" sx={{ minWidth: 220, ...sx }}>
      <InputLabel>Country</InputLabel>
      <Select label="Country" value={scope.value || ""} onChange={(e) => scope.setValue(e.target.value)}>
        {scope.implementations.map((impl) => (
          <MenuItem key={impl.id} value={impl.id}>
            {impl.country?.name || impl.name}
          </MenuItem>
        ))}
        <MenuItem value={ALL_COUNTRIES}>All countries (combined)</MenuItem>
      </Select>
    </FormControl>
  );
}
