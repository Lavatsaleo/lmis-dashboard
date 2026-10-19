import React from "react";
import { Chip, Tooltip } from "@mui/material";
import { alpha } from "@mui/material/styles";

import { countryColor } from "./roles";

/** Country badge for a user row. A SUPER_ADMIN is global whatever its home programme. */
export default function CountryChip({ implementation, global = false, size = "small" }) {
  if (global || !implementation) {
    return (
      <Tooltip title="Global access: every country and programme">
        <Chip size={size} label="Global" variant="outlined" sx={{ fontWeight: 700 }} />
      </Tooltip>
    );
  }

  const color = countryColor(implementation.country?.code);
  return (
    <Tooltip title={implementation.name || ""}>
      <Chip
        size={size}
        label={implementation.country?.name || implementation.name}
        sx={{
          fontWeight: 700,
          color,
          bgcolor: alpha(color, 0.1),
          border: `1px solid ${alpha(color, 0.35)}`,
        }}
      />
    </Tooltip>
  );
}
