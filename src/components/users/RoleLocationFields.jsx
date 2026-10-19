import React, { useMemo } from "react";
import {
  Box,
  FormControl,
  FormHelperText,
  InputLabel,
  ListSubheader,
  MenuItem,
  Select,
  Stack,
  Typography,
} from "@mui/material";

import { useImplementationLocations } from "./useUserAdmin";
import {
  ROLES,
  ROLE_META,
  WHOLE_COUNTRY,
  implementationLabel,
  locationLabelFor,
  locationOptionsFor,
  roleUnavailableReason,
} from "./roles";

/**
 * Country -> role -> location, in that order: the country decides which roles
 * exist (South Sudan has no LMIS clinicians) and which locations are offered.
 * A Super Admin is global (no country); a Country Admin has a country but no
 * location; a Viewer can be given a whole country instead of a location.
 */
export default function RoleLocationFields({
  implementations,
  implementationId,
  onImplementationChange,
  role,
  onRoleChange,
  facilityCode,
  onFacilityCodeChange,
  roles = ROLES,
  countryLocked = false,
  roleLocked = false,
  roleLockedReason = "",
}) {
  const implementation = implementations.find((i) => i.id === implementationId) || null;
  const meta = ROLE_META[role] || {};
  const isGlobalRole = meta.location === "none";
  const isCountryRole = meta.location === "country";
  const needsLocation = !isGlobalRole && !isCountryRole;
  const { locations, loading } = useImplementationLocations(needsLocation ? implementationId : null);

  const options = useMemo(() => locationOptionsFor(role, locations), [role, locations]);
  const warehouses = options.filter((o) => o.type === "WAREHOUSE");
  const sites = options.filter((o) => o.type !== "WAREHOUSE");
  const grouped = meta.location === "any" && warehouses.length > 0 && sites.length > 0;
  const countryName = implementation?.country?.name || implementation?.name || "this country";

  const renderOption = (o) => (
    <MenuItem key={o.id} value={o.code} disabled={o.disabled}>
      <Box sx={{ display: "flex", gap: 1, alignItems: "baseline", minWidth: 0 }}>
        <Typography noWrap>{o.name}</Typography>
        <Typography variant="caption" color="text.secondary" noWrap>
          {o.code} · {o.hint}
        </Typography>
      </Box>
    </MenuItem>
  );

  const locationValue =
    facilityCode === WHOLE_COUNTRY && meta.countryWide
      ? WHOLE_COUNTRY
      : options.some((o) => o.code === facilityCode)
      ? facilityCode
      : "";

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
        <FormControl fullWidth disabled={isGlobalRole || countryLocked}>
          <InputLabel>Country / programme</InputLabel>
          <Select
            label="Country / programme"
            value={isGlobalRole ? "" : implementationId || ""}
            onChange={(e) => onImplementationChange(e.target.value)}
            renderValue={(v) =>
              isGlobalRole ? "Global (all countries)" : implementationLabel(implementations.find((i) => i.id === v))
            }
            displayEmpty={isGlobalRole}
          >
            {implementations.map((impl) => (
              <MenuItem key={impl.id} value={impl.id}>
                {implementationLabel(impl)}
              </MenuItem>
            ))}
          </Select>
          <FormHelperText>
            {isGlobalRole
              ? "Super Admins are global and are not tied to a country."
              : implementation
              ? `Modules: ${(implementation.enabledModules || []).join(", ") || "none"}`
              : "Pick the country this user works in."}
          </FormHelperText>
        </FormControl>

        <FormControl fullWidth disabled={roleLocked}>
          <InputLabel>Role</InputLabel>
          <Select
            label="Role"
            value={role}
            onChange={(e) => onRoleChange(e.target.value)}
            renderValue={(v) => ROLE_META[v]?.label || v}
          >
            {roles.map((r) => {
              const reason = roleUnavailableReason(r, implementation);
              return (
                <MenuItem key={r} value={r} disabled={!!reason}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography fontWeight={700}>{ROLE_META[r].label}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "normal" }}>
                      {reason || ROLE_META[r].description}
                    </Typography>
                  </Box>
                </MenuItem>
              );
            })}
          </Select>
          <FormHelperText>{roleLocked ? roleLockedReason : meta.description}</FormHelperText>
        </FormControl>
      </Stack>

      {needsLocation ? (
        <FormControl fullWidth disabled={!implementationId}>
          <InputLabel>{locationLabelFor(role)}</InputLabel>
          <Select
            label={locationLabelFor(role)}
            value={locationValue}
            onChange={(e) => onFacilityCodeChange(e.target.value)}
            renderValue={(v) =>
              v === WHOLE_COUNTRY ? `All of ${countryName} (read-only)` : options.find((o) => o.code === v)?.name || v
            }
          >
            {meta.countryWide ? (
              <MenuItem value={WHOLE_COUNTRY}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography fontWeight={700}>All of {countryName}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Every warehouse, field base and site, read-only
                  </Typography>
                </Box>
              </MenuItem>
            ) : null}
            {grouped
              ? [
                  <ListSubheader key="wh">Warehouses &amp; field bases</ListSubheader>,
                  ...warehouses.map(renderOption),
                  <ListSubheader key="st">Facilities &amp; sites</ListSubheader>,
                  ...sites.map(renderOption),
                ]
              : options.map(renderOption)}
          </Select>
          <FormHelperText>
            {loading
              ? "Loading locations…"
              : options.length === 0 && !meta.countryWide
              ? "No matching locations in this country yet. Add them in Supply Configuration."
              : meta.location === "any"
              ? "A viewer at a warehouse also sees every field base and site under it."
              : " "}
          </FormHelperText>
        </FormControl>
      ) : null}
    </Stack>
  );
}
