import React, { useEffect, useMemo, useState } from "react";
import { Link as RouterLink, useOutletContext } from "react-router-dom";
import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  Typography,
  Stack,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  Divider,
  Switch,
  Snackbar,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  IconButton,
  FormControlLabel,
  Checkbox,
} from "@mui/material";
import LockOpenIcon from "@mui/icons-material/LockOpen";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import LockResetIcon from "@mui/icons-material/LockReset";
import { alpha } from "@mui/material/styles";

import { api } from "../api/client";
import CountryChip from "../components/users/CountryChip";
import RoleLocationFields from "../components/users/RoleLocationFields";
import { useImplementationLocations, useUserSummary } from "../components/users/useUserAdmin";
import {
  ROLES,
  ROLE_META,
  WHOLE_COUNTRY,
  assignableRoles,
  assignmentKind,
  countryColor,
  genPassword,
  implementationLabel,
  isAdminRole,
  roleLabel,
} from "../components/users/roles";
import { locationType, typeLabel } from "../components/supply/hierarchy";

function formatLastLogin(value) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function CountryTile({ row, selected, onClick }) {
  const impl = row.implementation;
  const color = impl ? countryColor(impl.country?.code) : "#64748B";
  const roles = ROLES.filter((r) => row.byRole?.[r]);
  return (
    <Card
      variant="outlined"
      sx={{
        height: "100%",
        borderColor: selected ? color : "divider",
        borderWidth: selected ? 2 : 1,
        bgcolor: selected ? alpha(color, 0.05) : "background.paper",
      }}
    >
      <CardActionArea onClick={onClick} sx={{ height: "100%", display: "flex", alignItems: "stretch" }}>
        <CardContent sx={{ display: "grid", gap: 1, alignContent: "start", width: "100%" }}>
          <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
            <Box sx={{ minWidth: 0 }}>
              <Typography fontWeight={800} sx={{ color }} noWrap>
                {impl ? impl.country?.name || impl.name : "No country"}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap component="div">
                {impl ? impl.name : "Accounts not tied to a programme"}
              </Typography>
            </Box>
            <Box sx={{ textAlign: "right" }}>
              <Typography variant="h5" fontWeight={800} lineHeight={1}>
                {row.total}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {row.active} active
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
            {roles.length === 0 ? (
              <Typography variant="caption" color="text.secondary">
                No users yet
              </Typography>
            ) : (
              roles.map((r) => <Chip key={r} size="small" variant="outlined" label={`${roleLabel(r)} ${row.byRole[r]}`} />)
            )}
          </Stack>
          {impl ? (
            <Typography variant="caption" color="text.secondary">
              Modules: {(impl.enabledModules || []).join(", ") || "none"}
            </Typography>
          ) : null}
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

function EditUserDialog({ user, me, implementations, isSelf, onClose, onSaved }) {
  // A country-wide viewer has a country but no location.
  const initialCode = user.facility?.code || (user.role === "VIEWER" && user.implementationId ? WHOLE_COUNTRY : "");
  const [fullName, setFullName] = useState(user.fullName || "");
  const [role, setRole] = useState(user.role);
  const [implementationId, setImplementationId] = useState(user.implementationId || implementations[0]?.id || "");
  const [facilityCode, setFacilityCode] = useState(initialCode);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const save = async () => {
    setErr("");
    const kind = assignmentKind(role, facilityCode);
    const payload = {};
    if (fullName.trim() !== user.fullName) payload.fullName = fullName.trim();
    if (role !== user.role) payload.role = role;
    if (kind === "location") {
      if (!facilityCode) {
        setErr("Pick a location for this role.");
        return;
      }
      if (facilityCode !== user.facility?.code) payload.facilityCode = facilityCode;
    }
    if (kind === "country") {
      if (!implementationId) {
        setErr("Pick a country for this role.");
        return;
      }
      if (implementationId !== user.implementationId) payload.implementationId = implementationId;
      // A viewer moving from a location to the whole country.
      if (role === "VIEWER" && user.facility) payload.countryWide = true;
    }
    if (Object.keys(payload).length === 0) {
      onClose();
      return;
    }
    try {
      setSaving(true);
      await api.patch(`/api/admin/users/${user.id}`, payload);
      onSaved(`${fullName.trim() || user.fullName} updated.`);
    } catch (e) {
      setErr(e?.response?.data?.message || e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onClose={saving ? undefined : onClose} fullWidth maxWidth="md">
      <DialogTitle>Edit user</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {err ? <Alert severity="error">{err}</Alert> : null}
          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <TextField label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} fullWidth />
            <TextField label="Email" value={user.email} fullWidth disabled helperText="Email is the sign-in name and cannot change." />
          </Stack>
          <RoleLocationFields
            implementations={implementations}
            implementationId={implementationId}
            onImplementationChange={(id) => {
              setImplementationId(id);
              setFacilityCode("");
            }}
            role={role}
            onRoleChange={(r) => {
              setRole(r);
              if (ROLE_META[r]?.location !== ROLE_META[role]?.location) setFacilityCode("");
            }}
            facilityCode={facilityCode}
            onFacilityCodeChange={setFacilityCode}
            roles={assignableRoles(me)}
            countryLocked={me?.role !== "SUPER_ADMIN"}
            roleLocked={isSelf}
            roleLockedReason="You cannot change your own role."
          />
          <Alert severity="info">
            Changing the role, location or country signs the user out of the mobile app and dashboard so the new access
            applies.
          </Alert>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button onClick={save} variant="contained" disabled={saving}>
          {saving ? "Saving..." : "Save changes"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function LocationCell({ user }) {
  const facility = user.facility;
  if (!facility) {
    const text =
      user.role === "SUPER_ADMIN"
        ? "Every country"
        : user.role === "COUNTRY_ADMIN" || (user.role === "VIEWER" && user.implementationId)
        ? `All of ${user.implementation?.country?.name || "the country"}`
        : "Not assigned";
    return (
      <Typography variant="body2" color="text.secondary">
        {text}
      </Typography>
    );
  }
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="body2" fontWeight={600}>
        {facility.name}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {[facility.code, typeLabel(locationType(facility)), facility.county?.name].filter(Boolean).join(" · ")}
      </Typography>
    </Box>
  );
}

export default function Users() {
  const { me } = useOutletContext();

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [implementationId, setImplementationId] = useState("");
  const [facilityCode, setFacilityCode] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const [toast, setToast] = useState({ open: false, msg: "", severity: "success" });

  const [editUser, setEditUser] = useState(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetUser, setResetUser] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetSaving, setResetSaving] = useState(false);
  const [resetRequireChange, setResetRequireChange] = useState(true);

  const isSuperAdmin = me?.role === "SUPER_ADMIN";
  const isAdmin = isSuperAdmin || me?.role === "COUNTRY_ADMIN";
  const { rows: summaryRows, implementations } = useUserSummary(isAdmin, refreshKey);
  // A Country Admin only ever sees their own country.
  const ownImplementationId = isSuperAdmin ? "" : implementations[0]?.id || "";
  // Country Admins cannot touch admin accounts (the API refuses too).
  const canManage = (u) => isSuperAdmin || !isAdminRole(u.role) || u.id === me?.id;
  const realImplementationId =
    ownImplementationId || (implementationId && implementationId !== "none" ? implementationId : null);
  const { locations } = useImplementationLocations(realImplementationId);

  const params = useMemo(() => {
    const p = { take: 200, skip: 0 };
    if (q.trim()) p.q = q.trim();
    if (role) p.role = role;
    if (implementationId) p.implementationId = implementationId;
    if (facilityCode) p.facilityCode = facilityCode;
    if (status === "active") p.isActive = true;
    if (status === "disabled") p.isActive = false;
    if (status === "locked") p.locked = true;
    return p;
  }, [q, role, implementationId, facilityCode, status]);

  const load = async () => {
    if (!isAdmin) return;
    setLoading(true);
    setErr("");
    try {
      const res = await api.get("/api/admin/users", { params });
      setRows(res.data?.rows || []);
      setTotal(res.data?.total || 0);
    } catch (e) {
      setErr(e?.response?.data?.message || e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, isAdmin, refreshKey]);

  const refresh = () => setRefreshKey((k) => k + 1);

  const pickImplementation = (id) => {
    setImplementationId(id);
    setFacilityCode("");
  };

  const toggleActive = async (user) => {
    try {
      await api.patch(`/api/admin/users/${user.id}`, { isActive: !user.isActive });
      setToast({ open: true, msg: user.isActive ? `${user.fullName} disabled.` : `${user.fullName} enabled.`, severity: "success" });
      refresh();
    } catch (e) {
      setToast({ open: true, msg: e?.response?.data?.message || e.message, severity: "error" });
    }
  };

  const unlock = async (user) => {
    try {
      await api.patch(`/api/admin/users/${user.id}`, { unlock: true });
      setToast({ open: true, msg: `${user.fullName} can sign in again.`, severity: "success" });
      refresh();
    } catch (e) {
      setToast({ open: true, msg: e?.response?.data?.message || e.message, severity: "error" });
    }
  };

  const openResetDialog = (user) => {
    setResetUser(user);
    setResetRequireChange(true);
    const generated = genPassword();
    setNewPassword(generated);
    setConfirmPassword(generated);
    setResetOpen(true);
  };

  const closeResetDialog = () => {
    if (resetSaving) return;
    setResetOpen(false);
    setResetUser(null);
    setNewPassword("");
    setConfirmPassword("");
  };

  const resetPassword = async () => {
    if (!resetUser) return;
    if (newPassword.trim().length < 8) {
      setToast({ open: true, msg: "Password must be at least 8 characters.", severity: "error" });
      return;
    }
    if (newPassword !== confirmPassword) {
      setToast({ open: true, msg: "Passwords do not match.", severity: "error" });
      return;
    }

    try {
      setResetSaving(true);
      await api.patch(`/api/admin/users/${resetUser.id}`, { password: newPassword, requirePasswordChange: resetRequireChange });
      setToast({ open: true, msg: `Password reset for ${resetUser.fullName}.`, severity: "success" });
      setResetSaving(false);
      closeResetDialog();
      load();
    } catch (e) {
      setToast({ open: true, msg: e?.response?.data?.message || e.message, severity: "error" });
    } finally {
      setResetSaving(false);
    }
  };

  if (!isAdmin) {
    return (
      <Card sx={{ overflow: "hidden" }}>
        <CardContent>
          <Typography variant="h6" fontWeight={900} gutterBottom>
            Users
          </Typography>
          <Typography color="text.secondary">
            Forbidden: only administrators can manage users.
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
                Users
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Accounts by country. Create users, change roles and locations, reset passwords and disable access.
              </Typography>
            </Box>

            <Button component={RouterLink} to="/users/new" variant="contained">
              Add User
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {summaryRows.length > 0 ? (
        <Box
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(3, minmax(0, 1fr))" },
          }}
        >
          {summaryRows.map((row) => {
            const id = row.implementation?.id || "none";
            return (
              <CountryTile
                key={id}
                row={row}
                selected={implementationId === id}
                onClick={() => isSuperAdmin && pickImplementation(implementationId === id ? "" : id)}
              />
            );
          })}
        </Box>
      ) : null}

      <Card sx={{ overflow: "hidden" }}>
        <CardContent>
          <Stack direction={{ xs: "column", lg: "row" }} spacing={2} alignItems={{ xs: "stretch", lg: "center" }} useFlexGap flexWrap="wrap">
            <TextField
              size="small"
              label="Search (name/email)"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              sx={{ minWidth: { xs: "100%", lg: 240 } }}
            />

            {isSuperAdmin ? (
            <FormControl size="small" sx={{ minWidth: { xs: "100%", lg: 220 } }}>
              <InputLabel>Country</InputLabel>
              <Select label="Country" value={implementationId} onChange={(e) => pickImplementation(e.target.value)}>
                <MenuItem value="">All countries</MenuItem>
                {implementations.map((impl) => (
                  <MenuItem key={impl.id} value={impl.id}>
                    {implementationLabel(impl)}
                  </MenuItem>
                ))}
                {summaryRows.some((r) => !r.implementation) ? <MenuItem value="none">No country</MenuItem> : null}
              </Select>
            </FormControl>
            ) : null}

            <FormControl size="small" sx={{ minWidth: { xs: "100%", lg: 180 } }}>
              <InputLabel>Role</InputLabel>
              <Select label="Role" value={role} onChange={(e) => setRole(e.target.value)}>
                <MenuItem value="">All roles</MenuItem>
                {ROLES.map((r) => (
                  <MenuItem key={r} value={r}>
                    {roleLabel(r)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: { xs: "100%", lg: 150 } }}>
              <InputLabel>Status</InputLabel>
              <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
                <MenuItem value="">All</MenuItem>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="disabled">Disabled</MenuItem>
                <MenuItem value="locked">Locked out</MenuItem>
              </Select>
            </FormControl>

            <Tooltip title={realImplementationId ? "" : "Pick a country to filter by location"}>
              <FormControl size="small" sx={{ minWidth: { xs: "100%", lg: 240 } }} disabled={!realImplementationId}>
                <InputLabel>Location</InputLabel>
                <Select label="Location" value={facilityCode} onChange={(e) => setFacilityCode(e.target.value)}>
                  <MenuItem value="">All locations</MenuItem>
                  {locations.map((f) => (
                    <MenuItem key={f.id} value={f.code}>
                      {f.name} ({f.code})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Tooltip>

            <Box sx={{ flexGrow: 1 }} />

            <Chip
              size="small"
              label={`${total} user(s)`}
              sx={{ bgcolor: (t) => alpha(t.palette.primary.main, 0.08), fontWeight: 900, alignSelf: { xs: "flex-start", lg: "center" } }}
            />
          </Stack>

          <Divider sx={{ my: 2 }} />

          {err ? (
            <Typography color="error" sx={{ mb: 2 }}>
              {err}
            </Typography>
          ) : null}

          <TableContainer sx={{ maxHeight: 600 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>User</TableCell>
                  <TableCell>Country</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Location</TableCell>
                  <TableCell>Last login</TableCell>
                  <TableCell align="center">Active</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7}>Loading…</TableCell>
                  </TableRow>
                ) : null}

                {!loading && rows.map((u) => {
                  const isSelf = u.id === me?.id;
                  const manageable = canManage(u);
                  return (
                    <TableRow key={u.id} hover sx={{ opacity: u.isActive ? 1 : 0.6 }}>
                      <TableCell>
                        <Typography variant="body2" fontWeight={700}>
                          {u.fullName}
                          {isSelf ? (
                            <Typography component="span" variant="caption" color="text.secondary"> (you)</Typography>
                          ) : null}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" component="div">
                          {u.email}
                        </Typography>
                        {u.isLocked || u.mustChangePassword ? (
                          <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
                            {u.isLocked ? (
                              <Tooltip title={`Too many wrong passwords. Locked until ${new Date(u.lockedUntil).toLocaleTimeString()}`}>
                                <Chip size="small" color="error" variant="outlined" label="Locked" sx={{ height: 20, fontSize: 11 }} />
                              </Tooltip>
                            ) : null}
                            {u.mustChangePassword ? (
                              <Tooltip title="Must choose their own password at next sign-in">
                                <Chip size="small" variant="outlined" label="New password due" sx={{ height: 20, fontSize: 11 }} />
                              </Tooltip>
                            ) : null}
                          </Stack>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <CountryChip implementation={u.implementation} global={u.role === "SUPER_ADMIN"} />
                      </TableCell>
                      <TableCell>
                        <Tooltip title={ROLE_META[u.role]?.description || ""}>
                          <Chip
                            size="small"
                            color={ROLE_META[u.role]?.color || "default"}
                            variant={u.role === "VIEWER" ? "outlined" : "filled"}
                            label={roleLabel(u.role)}
                          />
                        </Tooltip>
                      </TableCell>
                      <TableCell sx={{ minWidth: 200 }}>
                        <LocationCell user={u} />
                      </TableCell>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>{formatLastLogin(u.lastLoginAt)}</TableCell>
                      <TableCell align="center">
                        <Tooltip
                          title={isSelf ? "You cannot disable your own account" : manageable ? "" : "Only a Super Admin can change admin accounts"}
                        >
                          <span>
                            <Switch
                              checked={!!u.isActive}
                              disabled={isSelf || !manageable}
                              onChange={() => toggleActive(u)}
                              inputProps={{ "aria-label": "toggle active" }}
                            />
                          </span>
                        </Tooltip>
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          {u.isLocked && manageable ? (
                            <Tooltip title="Unlock sign-in">
                              <IconButton size="small" color="error" aria-label="unlock user" onClick={() => unlock(u)}>
                                <LockOpenIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          ) : null}
                          <Tooltip title={manageable ? "Edit name, role or location" : "Only a Super Admin can change admin accounts"}>
                            <span>
                              <IconButton size="small" color="primary" aria-label="edit user" disabled={!manageable} onClick={() => setEditUser(u)}>
                                <EditOutlinedIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title={manageable ? "Reset password" : "Only a Super Admin can change admin accounts"}>
                            <span>
                              <IconButton size="small" aria-label="reset password" disabled={!manageable} onClick={() => openResetDialog(u)}>
                                <LockResetIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })}

                {!loading && rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7}>No users found.</TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {editUser ? (
        <EditUserDialog
          key={editUser.id}
          user={editUser}
          me={me}
          implementations={implementations}
          isSelf={editUser.id === me?.id}
          onClose={() => setEditUser(null)}
          onSaved={(msg) => {
            setEditUser(null);
            setToast({ open: true, msg, severity: "success" });
            refresh();
          }}
        />
      ) : null}

      <Dialog open={resetOpen} onClose={closeResetDialog} fullWidth maxWidth="sm">
        <DialogTitle>Reset password</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity="info">
              You are resetting the password for <strong>{resetUser?.fullName || "this user"}</strong>. They will be
              signed out everywhere and must sign in with the new password.
            </Alert>

            <TextField
              label="New password"
              type="text"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              fullWidth
              helperText="Minimum 8 characters."
            />

            <TextField
              label="Confirm password"
              type="text"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              fullWidth
            />

            <Box>
              <Button variant="text" onClick={() => {
                const generated = genPassword();
                setNewPassword(generated);
                setConfirmPassword(generated);
              }}>
                Generate strong password
              </Button>
            </Box>

            <FormControlLabel
              control={<Checkbox checked={resetRequireChange} onChange={(e) => setResetRequireChange(e.target.checked)} />}
              label={
                <Typography variant="body2">
                  Ask them to choose their own password at next sign-in
                  <Typography component="span" variant="caption" color="text.secondary" sx={{ display: "block" }}>
                    Recommended. Untick only for someone still on an older mobile app version. This also unlocks the
                    account.
                  </Typography>
                </Typography>
              }
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeResetDialog} disabled={resetSaving}>Cancel</Button>
          <Button onClick={resetPassword} variant="contained" disabled={resetSaving}>
            {resetSaving ? "Saving..." : "Reset Password"}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={toast.open}
        autoHideDuration={3500}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          severity={toast.severity}
          variant="filled"
          onClose={() => setToast((t) => ({ ...t, open: false }))}
        >
          {toast.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
