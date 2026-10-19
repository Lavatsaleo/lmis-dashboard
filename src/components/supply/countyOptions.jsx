import React from "react";
import { ListSubheader, MenuItem } from "@mui/material";

/**
 * Menu items for a county <Select>, grouped under their state.
 * Returns an array (MUI Select needs MenuItem / ListSubheader as direct children).
 */
export function countyMenuItems(counties) {
  const byState = new Map();
  for (const c of counties) {
    const state = c.state || "Other";
    if (!byState.has(state)) byState.set(state, []);
    byState.get(state).push(c);
  }
  const items = [];
  for (const state of [...byState.keys()].sort((a, b) => a.localeCompare(b))) {
    items.push(<ListSubheader key={`state-${state}`}>{state}</ListSubheader>);
    for (const c of byState.get(state).sort((a, b) => a.name.localeCompare(b.name))) {
      items.push(<MenuItem key={c.id} value={c.id} sx={{ pl: 3 }}>{c.name}</MenuItem>);
    }
  }
  return items;
}
