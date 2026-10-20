import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormGroup,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import SyncIcon from "@mui/icons-material/Sync";
import CloudDownloadOutlinedIcon from "@mui/icons-material/CloudDownloadOutlined";
import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import LinkIcon from "@mui/icons-material/Link";

import { api } from "../api/client";
import ImplementationPicker from "../components/ImplementationPicker";
import { useImplementationChoice } from "../components/implementationChoice";

const STATUSES = [
  { value: "ACTIVE", label: "Active (open)" },
  { value: "COMPLETED", label: "Completed" },
  { value: "SCHEDULE", label: "Scheduled" },
  { value: "SKIPPED", label: "Skipped" },
];
const RUN_LABEL = {
  PULL: "Pull dispensing",
  PULL_SITE: "Pull one site",
  PULL_BACKFILL: "Back-fill one site",
  PUSH: "Push stock",
  PUSH_SITE: "Push one site",
};
const RUN_COLOR = { SUCCESS: "success", PARTIAL: "warning", FAILED: "error", RUNNING: "info" };

const errMsg = (e) => e?.response?.data?.message || e?.message || "Request failed";
const fmtTime = (v) => (v ? new Date(v).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "never");
const fmtDate = (v) => (v ? new Date(v).toLocaleDateString(undefined, { dateStyle: "medium" }) : "");
const n = (v) => Number(v || 0).toLocaleString();

function Stat({ label, value, hint, tone }) {
  return (
    <Card variant="outlined">
      <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
        <Typography variant="caption" color="text.secondary" fontWeight={700}>
          {label}
        </Typography>
        <Typography variant="h5" fontWeight={900} color={tone ? `${tone}.main` : "text.primary"}>
          {value}
        </Typography>
        {hint ? (
          <Typography variant="caption" color="text.secondary">
            {hint}
          </Typography>
        ) : null}
      </CardContent>
    </Card>
  );
}

function runSummary(r) {
  const s = r.stats || {};
  if (r.status === "RUNNING") return "Running…";
  if (String(r.direction).startsWith("TRACKER:")) {
    return [`${n(s.children)} children read`, `${n(s.added)} new`, `${n(s.updated)} updated`, `${n(s.visits)} visits`, s.removed ? `${n(s.removed)} removed` : null, s.mode === "full" ? "full read" : null]
      .filter(Boolean)
      .join(" · ");
  }
  if (r.direction === "PUSH" || r.direction === "PUSH_SITE") {
    return [
      s.site,
      s.period && `period ${s.period}`,
      s.site ? null : `${n(s.sites)} sites`,
      `${n(s.values)} values`,
      `${n((s.imported || 0) + (s.updated || 0))} saved`,
      s.ignored ? `${n(s.ignored)} refused` : null,
      s.notAssigned?.length ? `${n(s.notAssigned.length)} sites not in the DHIS2 data set` : null,
    ]
      .filter(Boolean)
      .join(" · ");
  }
  return [
    s.site,
    `${n(s.events)} events read`,
    `${n(s.applied)} changed`,
    s.sachetsDeducted ? `${n(s.sachetsDeducted)} sachets deducted` : null,
    s.sachetsReturned ? `${n(s.sachetsReturned)} returned` : null,
    s.newShortfall ? `${n(s.newShortfall)} short` : null,
    s.settledShortfall ? `${n(s.settledShortfall)} shortfall settled` : null,
    s.unmappedEvents ? `${n(s.unmappedEvents)} from unmapped org units` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

// Aggregate data element picker (searches DHIS2 as you type; accepts a pasted UID).
function DataElementPicker({ label, value, onChange, disabled }) {
  const [input, setInput] = useState("");
  const [options, setOptions] = useState([]);
  const [names, setNames] = useState({});
  useEffect(() => {
    if (disabled) return undefined;
    let alive = true;
    const t = setTimeout(() => {
      api
        .get("/api/dhis2/metadata/data-elements", { params: { q: input.length >= 2 ? input : "" } })
        .then((res) => {
          if (!alive) return;
          const rows = res.data || [];
          setOptions(rows);
          setNames((m) => ({ ...m, ...Object.fromEntries(rows.map((r) => [r.id, r.displayName])) }));
        })
        .catch(() => alive && setOptions([]));
    }, 300);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [input, disabled]);
  const current = value ? { id: value, displayName: names[value] || value } : null;
  return (
    <Autocomplete
      size="small"
      freeSolo
      disabled={disabled}
      options={options}
      value={current}
      filterOptions={(x) => x}
      getOptionLabel={(o) => (typeof o === "string" ? o : o.displayName === o.id ? o.id : `${o.displayName}`)}
      isOptionEqualToValue={(a, b) => a.id === b.id}
      onInputChange={(_, v, reason) => reason === "input" && setInput(v)}
      onChange={(_, v) => {
        if (!v) return onChange("");
        if (typeof v === "string") return onChange(v.trim());
        setNames((m) => ({ ...m, [v.id]: v.displayName }));
        return onChange(v.id);
      }}
      renderOption={(props, o) => (
        <li {...props} key={o.id}>
          <Box>
            <Typography variant="body2">{o.displayName}</Typography>
            <Typography variant="caption" color="text.secondary">
              {o.id}
              {o.dataSetElements?.length ? ` · ${o.dataSetElements.map((d) => `${d.dataSet.displayName} (${d.dataSet.periodType})`).join(", ")}` : " · not in any data set"}
            </Typography>
          </Box>
        </li>
      )}
      renderInput={(params) => <TextField {...params} label={label} placeholder="Search name or paste UID" />}
    />
  );
}

// Children from DHIS2 tracker programs (OTP, TSFP, ...): copied read-only
// into Anchor for the Children page.
function TrackerProgramsCard({ params, programs, configured, onNotice }) {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ programId: "", code: "", commodity: "", startDate: "" });
  const [busy, setBusy] = useState("");
  const load = useCallback(() => {
    api
      .get("/api/dhis2/tracker-programs", { params })
      .then((r) => setRows(r.data || []))
      .catch(() => setRows([]));
  }, [params]);
  useEffect(() => {
    load();
  }, [load]);
  // While a sync runs, refresh the counts every few seconds.
  useEffect(() => {
    if (!rows.some((r) => r.running)) return undefined;
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [rows, load]);

  const tracker = programs.filter((p) => p.programType === "WITH_REGISTRATION" && !rows.some((r) => r.programId === p.id));
  const act = async (key, fn, okText) => {
    setBusy(key);
    try {
      const r = await fn();
      onNotice({ severity: "success", text: okText || r?.data?.message || "Done." });
      load();
    } catch (e) {
      onNotice({ severity: "error", text: errMsg(e) });
    } finally {
      setBusy("");
    }
  };

  return (
    <Card>
      <CardContent sx={{ display: "grid", gap: 2, gridTemplateColumns: "minmax(0, 1fr)" }}>
        <Box>
          <Typography fontWeight={900}>4. Children from DHIS2 (tracker programs)</Typography>
          <Typography variant="body2" color="text.secondary">
            Children, visits and outcomes are copied read-only into Anchor for the Children page, so support officers can compare them with facility
            registers. The first sync reads all history from the start date; then only changes, on the same schedule as above.
          </Typography>
        </Box>
        {rows.length ? (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Program</TableCell>
                  <TableCell>Commodity</TableCell>
                  <TableCell>Start date</TableCell>
                  <TableCell align="right">Children</TableCell>
                  <TableCell>Last sync</TableCell>
                  <TableCell>Automatic</TableCell>
                  <TableCell align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Typography variant="body2" fontWeight={800}>
                        {r.code}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {r.name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        defaultValue={r.commodity || ""}
                        placeholder="e.g. RUTF"
                        sx={{ width: 110 }}
                        onBlur={(e) => e.target.value !== (r.commodity || "") && act(`c${r.id}`, () => api.patch(`/api/dhis2/tracker-programs/${r.id}`, { commodity: e.target.value }), "Commodity saved.")}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        type="date"
                        defaultValue={r.startDate ? String(r.startDate).slice(0, 10) : ""}
                        onBlur={(e) =>
                          e.target.value !== (r.startDate ? String(r.startDate).slice(0, 10) : "") &&
                          act(`d${r.id}`, () => api.patch(`/api/dhis2/tracker-programs/${r.id}`, { startDate: e.target.value || null }), "Start date saved; the next sync re-reads all children.")
                        }
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight={800}>
                        {Number(r.children).toLocaleString()}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {Number(r.inTreatment).toLocaleString()} in treatment
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {r.running ? (
                        <Chip size="small" color="info" label="Syncing…" />
                      ) : r.lastRun ? (
                        <>
                          <Chip size="small" color={RUN_COLOR[r.lastRun.status] || "default"} label={r.lastRun.status} />
                          <Typography variant="caption" color="text.secondary" component="div">
                            {fmtTime(r.lastRun.startedAt)}
                            {r.lastRun.stats ? ` · ${n(r.lastRun.stats.added)} new, ${n(r.lastRun.stats.updated)} updated` : ""}
                          </Typography>
                          {r.lastRun.error ? (
                            <Typography variant="caption" color="error.main" component="div">
                              {r.lastRun.error}
                            </Typography>
                          ) : null}
                        </>
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          never
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch checked={r.enabled} onChange={(e) => act(`e${r.id}`, () => api.patch(`/api/dhis2/tracker-programs/${r.id}`, { enabled: e.target.checked }), e.target.checked ? "Automatic sync on." : "Automatic sync off.")} />
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                      <Button size="small" disabled={!configured || r.running || !!busy} onClick={() => act(`s${r.id}`, () => api.post(`/api/dhis2/tracker-programs/${r.id}/sync`, {}))}>
                        Sync now
                      </Button>
                      <Tooltip title="Read every child again from the start date (after a mapping or start-date change)">
                        <span>
                          <Button size="small" disabled={!configured || r.running || !!busy} onClick={() => act(`f${r.id}`, () => api.post(`/api/dhis2/tracker-programs/${r.id}/sync`, { fromStart: true }))}>
                            Re-read all
                          </Button>
                        </span>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Typography variant="body2" color="text.secondary">
            No tracker program added yet.
          </Typography>
        )}

        <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "minmax(0,1fr)", md: "2fr 1fr 1fr 1fr auto" }, alignItems: "center" }}>
          <FormControl size="small">
            <InputLabel>Add a tracker program</InputLabel>
            <Select
              label="Add a tracker program"
              value={tracker.some((p) => p.id === form.programId) ? form.programId : ""}
              onChange={(e) => {
                const p = tracker.find((x) => x.id === e.target.value);
                setForm({ ...form, programId: p.id, code: form.code || p.displayName });
              }}
              disabled={!configured}
            >
              {tracker.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.displayName}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField size="small" label="Short name" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="e.g. OTP" />
          <TextField size="small" label="Commodity" value={form.commodity} onChange={(e) => setForm({ ...form, commodity: e.target.value })} placeholder="e.g. RUTF" />
          <TextField size="small" type="date" label="Start date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} InputLabelProps={{ shrink: true }} helperText="Empty = all history" />
          <Button
            variant="contained"
            disabled={!form.programId || !!busy}
            onClick={() =>
              act(
                "add",
                async () => {
                  const r = await api.post("/api/dhis2/tracker-programs", { ...params, ...form, enabled: true });
                  setForm({ programId: "", code: "", commodity: "", startDate: "" });
                  return r;
                },
                "Program added. Press Sync now to read its children."
              )
            }
          >
            Add
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
}

export default function Dhis2Integration() {
  const { me } = useOutletContext();
  const isAdmin = me?.role === "SUPER_ADMIN";
  const { implementations, implementationId, setImplementationId, isSuperAdmin } = useImplementationChoice(me);
  const params = useMemo(() => (isSuperAdmin && implementationId ? { implementationId } : {}), [isSuperAdmin, implementationId]);

  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState("");
  // Manual sync of one linked site ("" = all). Automatic sync always does all.
  const [syncSite, setSyncSite] = useState("");
  const [tab, setTab] = useState(0);

  // config form
  const [form, setForm] = useState(null);
  const [programs, setPrograms] = useState([]);
  const [program, setProgram] = useState(null);
  const [connection, setConnection] = useState(null);

  // mapping
  const [mapping, setMapping] = useState({ sites: [], orgUnits: [], orgUnitError: null });
  const [mapFilter, setMapFilter] = useState("all");
  const [matchPreview, setMatchPreview] = useState(null);

  // tabs
  const [runs, setRuns] = useState([]);
  const [imports, setImports] = useState({ rows: [], bySite: [], total: 0 });
  const [shortOnly, setShortOnly] = useState(false);
  const [preview, setPreview] = useState({ rows: [], period: "" });

  const loadStatus = useCallback(async () => {
    if (!isAdmin || (isSuperAdmin && !implementationId)) return;
    try {
      const res = await api.get("/api/dhis2/status", { params });
      setStatus(res.data);
      const c = res.data.config || {};
      setForm({
        enabled: !!c.enabled,
        programId: c.programId || "",
        programName: c.programName || "",
        programStageId: c.programStageId || "",
        dispenseDataElementId: c.dispenseDataElementId || "",
        dispenseDataElementName: c.dispenseDataElementName || "",
        dispenseProductId: c.dispenseProductId || "",
        countStatuses: (c.countStatuses || "ACTIVE,COMPLETED").split(","),
        startDate: c.startDate ? String(c.startDate).slice(0, 10) : "",
        stockPeriodType: c.stockPeriodType || "Daily",
        intervalMinutes: c.intervalMinutes || 60,
        stockElements: Object.fromEntries((c.stockElements || []).map((e) => [e.productId, { boxes: e.boxesDataElementId || "", sachets: e.sachetsDataElementId || "" }])),
      });
      setError("");
    } catch (e) {
      setError(errMsg(e));
    }
  }, [isAdmin, isSuperAdmin, implementationId, params]);

  const loadMapping = useCallback(async () => {
    if (!isAdmin || (isSuperAdmin && !implementationId)) return;
    try {
      const res = await api.get("/api/dhis2/org-units", { params });
      setMapping(res.data);
    } catch (e) {
      setError(errMsg(e));
    }
  }, [isAdmin, isSuperAdmin, implementationId, params]);

  const loadTab = useCallback(async () => {
    if (!isAdmin || (isSuperAdmin && !implementationId)) return;
    try {
      if (tab === 0) setRuns((await api.get("/api/dhis2/runs", { params })).data);
      if (tab === 1) setImports((await api.get("/api/dhis2/imports", { params: { ...params, shortfall: shortOnly ? "1" : undefined } })).data);
      if (tab === 2) setPreview((await api.get("/api/dhis2/stock-preview", { params })).data);
    } catch (e) {
      setError(errMsg(e));
    }
  }, [isAdmin, isSuperAdmin, implementationId, params, tab, shortOnly]);

  useEffect(() => {
    loadStatus();
    loadMapping();
  }, [loadStatus, loadMapping]);
  useEffect(() => {
    loadTab();
  }, [loadTab]);

  // Program list (only when the server can reach DHIS2)
  useEffect(() => {
    if (!status?.configured) return undefined;
    let alive = true;
    api
      .get("/api/dhis2/metadata/programs")
      .then((res) => alive && setPrograms(res.data || []))
      .catch((e) => alive && setConnection({ ok: false, message: errMsg(e) }));
    return () => {
      alive = false;
    };
  }, [status?.configured]);

  const programId = form?.programId;
  useEffect(() => {
    if (!status?.configured || !programId) {
      setProgram(null);
      return undefined;
    }
    let alive = true;
    api
      .get(`/api/dhis2/metadata/programs/${programId}`)
      .then((res) => alive && setProgram(res.data))
      .catch(() => alive && setProgram(null));
    return () => {
      alive = false;
    };
  }, [status?.configured, programId]);

  const stage = program?.programStages?.find((s) => s.id === form?.programStageId);
  const stageElements = useMemo(() => {
    const list = stage ? stage.programStageDataElements : (program?.programStages || []).flatMap((s) => s.programStageDataElements || []);
    const seen = new Set();
    return (list || []).map((x) => x.dataElement).filter((d) => d && !seen.has(d.id) && seen.add(d.id));
  }, [program, stage]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const products = status?.products || [];

  const testConnection = async () => {
    setBusy("test");
    try {
      const res = await api.get("/api/dhis2/test");
      setConnection({ ok: true, ...res.data });
    } catch (e) {
      setConnection({ ok: false, message: errMsg(e) });
    } finally {
      setBusy("");
    }
  };

  const save = async () => {
    setBusy("save");
    try {
      await api.put("/api/dhis2/config", {
        ...params,
        enabled: form.enabled,
        programId: form.programId,
        programName: form.programName,
        programStageId: form.programStageId,
        dispenseDataElementId: form.dispenseDataElementId,
        dispenseDataElementName: form.dispenseDataElementName,
        dispenseProductId: form.dispenseProductId,
        countStatuses: form.countStatuses.join(","),
        startDate: form.startDate || null,
        stockPeriodType: form.stockPeriodType,
        intervalMinutes: Number(form.intervalMinutes),
        stockElements: Object.entries(form.stockElements).map(([productId, e]) => ({ productId, boxesDataElementId: e.boxes, sachetsDataElementId: e.sachets })),
      });
      setNotice({ severity: "success", text: "DHIS2 settings saved." });
      await loadStatus();
      await loadMapping();
    } catch (e) {
      setNotice({ severity: "error", text: errMsg(e) });
    } finally {
      setBusy("");
    }
  };

  const runSync = async (direction, fromStart = false) => {
    setBusy(direction);
    try {
      const res = await api.post("/api/dhis2/sync", { ...params, direction, fromStart, facilityId: syncSite || undefined });
      const parts = [];
      for (const [k, v] of Object.entries(res.data || {})) {
        const label = k === "pull" ? "Pull" : "Push";
        if (v?.skipped) parts.push(`${label}: ${v.skipped}`);
        else if (!v?.ok) parts.push(`${label} failed: ${v?.error || "see history"}`);
        else parts.push(`${label}: ${runSummary({ direction: k === "pull" ? "PULL" : "PUSH", stats: v.stats })}`);
      }
      const failed = Object.values(res.data || {}).some((v) => v && !v.ok && !v.skipped);
      setNotice({ severity: failed ? "error" : "success", text: parts.join("  |  ") });
    } catch (e) {
      setNotice({ severity: "error", text: errMsg(e) });
    } finally {
      setBusy("");
      loadStatus();
      loadTab();
    }
  };

  const mapSite = async (site, orgUnitId) => {
    try {
      const res = await api.put(`/api/dhis2/org-units/${site.id}`, { dhis2OrgUnitId: orgUnitId || null });
      setMapping((m) => ({ ...m, sites: m.sites.map((s) => (s.id === site.id ? { ...s, dhis2OrgUnitId: orgUnitId || null } : s)) }));
      if (res.data.backfill) setNotice({ severity: "info", text: `${site.name} linked. Its DHIS2 visits since the start date are being pulled in the background.` });
      if (res.data.previouslyImportedEvents) {
        setNotice({ severity: "warning", text: `${site.name} had ${res.data.previouslyImportedEvents} visits from its previous org unit; their deductions stay at this site.` });
      }
      loadStatus();
    } catch (e) {
      setNotice({ severity: "error", text: errMsg(e) });
    }
  };

  const autoMatch = async (apply) => {
    setBusy("match");
    try {
      const res = await api.post("/api/dhis2/org-units/auto-match", { ...params, apply });
      if (apply) {
        setMatchPreview(null);
        setNotice({ severity: "success", text: `${res.data.matches.length} sites linked to DHIS2 org units.` });
        loadMapping();
        loadStatus();
      } else setMatchPreview(res.data);
    } catch (e) {
      setNotice({ severity: "error", text: errMsg(e) });
    } finally {
      setBusy("");
    }
  };

  if (!isAdmin) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" fontWeight={900}>
            DHIS2 Integration
          </Typography>
          <Typography color="text.secondary">Only a Super Admin can configure the DHIS2 integration.</Typography>
        </CardContent>
      </Card>
    );
  }

  const ouById = new Map((mapping.orgUnits || []).map((o) => [o.id, o]));
  const linkedSites = mapping.sites.filter((x) => x.dhis2OrgUnitId);
  const usedOus = new Set(mapping.sites.map((s) => s.dhis2OrgUnitId).filter(Boolean));
  const shownSites = mapping.sites.filter((s) => (mapFilter === "unmapped" ? !s.dhis2OrgUnitId : mapFilter === "mapped" ? !!s.dhis2OrgUnitId : true));
  const c = status?.config;
  const counts = status?.counts || {};
  const ready = !!(form?.programId && form?.dispenseDataElementId && form?.dispenseProductId);

  return (
    <Box sx={{ display: "grid", gap: 2.5 }}>
      <Card>
        <CardContent>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} justifyContent="space-between" alignItems={{ xs: "stretch", md: "center" }}>
            <Box>
              <Typography variant="h6" fontWeight={900}>
                DHIS2 Integration
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Sachets dispensed at visits in DHIS2 come off the site's stock in Anchor; boxes and sachets remaining go back to DHIS2 so clinicians can see them.
              </Typography>
            </Box>
            <ImplementationPicker implementations={implementations} value={implementationId} onChange={setImplementationId} isSuperAdmin={isSuperAdmin} />
          </Stack>

          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ xs: "stretch", md: "center" }} sx={{ mt: 2 }} useFlexGap flexWrap="wrap">
            {status ? (
              status.configured ? (
                <Chip color="success" variant="outlined" icon={<LinkIcon />} label={`Server: ${status.server}`} />
              ) : (
                <Chip color="warning" label="Not connected: set DHIS2_URL and DHIS2_TOKEN in the server .env" />
              )
            ) : null}
            <Button size="small" variant="outlined" onClick={testConnection} disabled={!status?.configured || busy === "test"}>
              {busy === "test" ? <CircularProgress size={16} /> : "Test connection"}
            </Button>
            {connection ? (
              connection.ok ? (
                <Typography variant="body2" color="success.main">
                  Connected to {connection.systemName || "DHIS2"} {connection.version} as {connection.user?.username}
                </Typography>
              ) : (
                <Typography variant="body2" color="error.main">
                  {connection.message}
                </Typography>
              )
            ) : null}
            <Box sx={{ flexGrow: 1 }} />
            {status?.running ? <Chip size="small" color="info" label="Sync running…" /> : null}
            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel>Sync now for</InputLabel>
              <Select label="Sync now for" value={linkedSites.some((x) => x.id === syncSite) ? syncSite : ""} onChange={(e) => setSyncSite(e.target.value)}>
                <MenuItem value="">All linked sites</MenuItem>
                {linkedSites.map((x) => (
                  <MenuItem key={x.id} value={x.id}>
                    {x.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button startIcon={<CloudDownloadOutlinedIcon />} variant="outlined" disabled={!status?.configured || !c?.programId || !!busy} onClick={() => runSync("PULL")}>
              Pull dispensing
            </Button>
            <Button startIcon={<CloudUploadOutlinedIcon />} variant="outlined" disabled={!status?.configured || !c?.stockElements?.length || !!busy} onClick={() => runSync("PUSH")}>
              Push stock
            </Button>
            <Button startIcon={busy === "BOTH" ? <CircularProgress size={16} color="inherit" /> : <SyncIcon />} variant="contained" disabled={!status?.configured || !c?.programId || !!busy} onClick={() => runSync("BOTH")}>
              Sync now
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {error ? <Alert severity="error">{error}</Alert> : null}
      {notice ? (
        <Alert severity={notice.severity} onClose={() => setNotice(null)}>
          {notice.text}
        </Alert>
      ) : null}

      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" } }}>
        <Stat label="Automatic sync" value={c?.enabled ? "On" : "Off"} tone={c?.enabled ? "success" : undefined} hint={c?.enabled ? `every ${c.intervalMinutes} min` : "turn on below"} />
        <Stat label="Sites linked" value={`${n(counts.mapped)} / ${n(counts.sites)}`} hint="Anchor sites with a DHIS2 org unit" />
        <Stat label="Last pull / push" value={c?.lastPullAt ? fmtTime(c.lastPullAt) : "never"} hint={`push: ${fmtTime(c?.lastPushAt)}`} />
        <Stat
          label="Not in stock (shortfall)"
          value={`${n(counts.shortfallSachets)} sachets`}
          tone={counts.shortfallSachets ? "warning" : undefined}
          hint={counts.shortfallSachets ? `${n(counts.shortfallEvents)} visits; deducted when stock arrives` : "all dispensing matched to stock"}
        />
      </Box>

      {form ? (
        <Box sx={{ display: "grid", gap: 2.5, gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" } }}>
          <Card>
            <CardContent sx={{ display: "grid", gap: 2 }}>
              <Box>
                <Typography fontWeight={900}>1. Dispensing from DHIS2</Typography>
                <Typography variant="body2" color="text.secondary">
                  The tracker program and data element where clinicians record sachets dispensed per visit.
                </Typography>
              </Box>
              {!status?.configured ? <Alert severity="info">Connect the server to DHIS2 to pick from lists. You can still paste UIDs.</Alert> : null}
              {programs.length ? (
                <FormControl size="small">
                  <InputLabel>Program</InputLabel>
                  <Select
                    label="Program"
                    value={programs.some((p) => p.id === form.programId) ? form.programId : ""}
                    onChange={(e) => {
                      const p = programs.find((x) => x.id === e.target.value);
                      set({ programId: p.id, programName: p.displayName, programStageId: p.programStages?.length === 1 ? p.programStages[0].id : "", dispenseDataElementId: "", dispenseDataElementName: "" });
                    }}
                  >
                    {programs.map((p) => (
                      <MenuItem key={p.id} value={p.id}>
                        {p.displayName}
                        <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                          {p.programType === "WITH_REGISTRATION" ? "tracker" : "event"}
                        </Typography>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              ) : (
                <TextField size="small" label="Program UID" value={form.programId} onChange={(e) => set({ programId: e.target.value.trim() })} />
              )}
              {program ? (
                <FormControl size="small">
                  <InputLabel>Program stage</InputLabel>
                  <Select label="Program stage" value={form.programStageId} onChange={(e) => set({ programStageId: e.target.value })}>
                    <MenuItem value="">Any stage</MenuItem>
                    {(program.programStages || []).map((s) => (
                      <MenuItem key={s.id} value={s.id}>
                        {s.displayName}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              ) : (
                <TextField size="small" label="Program stage UID (optional)" value={form.programStageId} onChange={(e) => set({ programStageId: e.target.value.trim() })} />
              )}
              {stageElements.length ? (
                <FormControl size="small">
                  <InputLabel>Sachets dispensed data element</InputLabel>
                  <Select
                    label="Sachets dispensed data element"
                    value={stageElements.some((d) => d.id === form.dispenseDataElementId) ? form.dispenseDataElementId : ""}
                    onChange={(e) => set({ dispenseDataElementId: e.target.value, dispenseDataElementName: stageElements.find((d) => d.id === e.target.value)?.displayName || "" })}
                  >
                    {stageElements.map((d) => (
                      <MenuItem key={d.id} value={d.id} disabled={!/INTEGER|NUMBER/.test(d.valueType || "INTEGER")}>
                        {d.displayName}
                        <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                          {d.valueType}
                        </Typography>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              ) : (
                <TextField size="small" label="Sachets dispensed data element UID" value={form.dispenseDataElementId} onChange={(e) => set({ dispenseDataElementId: e.target.value.trim() })} />
              )}
              <FormControl size="small">
                <InputLabel>Product dispensed</InputLabel>
                <Select label="Product dispensed" value={form.dispenseProductId} onChange={(e) => set({ dispenseProductId: e.target.value })}>
                  {products.map((p) => (
                    <MenuItem key={p.id} value={p.id}>
                      {p.name} ({p.code})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight={700}>
                  Visits that count as dispensed
                </Typography>
                <FormGroup row>
                  {STATUSES.map((s) => (
                    <FormControlLabel
                      key={s.value}
                      control={
                        <Checkbox
                          size="small"
                          checked={form.countStatuses.includes(s.value)}
                          onChange={(e) => set({ countStatuses: e.target.checked ? [...form.countStatuses, s.value] : form.countStatuses.filter((x) => x !== s.value) })}
                        />
                      }
                      label={s.label}
                    />
                  ))}
                </FormGroup>
              </Box>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  size="small"
                  type="date"
                  label="Go-live date"
                  helperText="Visits before this date are ignored"
                  value={form.startDate}
                  onChange={(e) => set({ startDate: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                />
                <TextField
                  size="small"
                  type="number"
                  label="Sync every (minutes)"
                  value={form.intervalMinutes}
                  onChange={(e) => set({ intervalMinutes: e.target.value })}
                  inputProps={{ min: 15, max: 1440 }}
                  helperText="15 to 1440"
                  fullWidth
                />
              </Stack>
            </CardContent>
          </Card>

          <Card>
            <CardContent sx={{ display: "grid", gap: 2 }}>
              <Box>
                <Typography fontWeight={900}>2. Stock remaining to DHIS2</Typography>
                <Typography variant="body2" color="text.secondary">
                  One aggregate data element per product and unit. Add them to a data set assigned to the sites, with the period below, so DHIS2 accepts the values.
                </Typography>
              </Box>
              <FormControl size="small" sx={{ maxWidth: 240 }}>
                <InputLabel>Period</InputLabel>
                <Select label="Period" value={form.stockPeriodType} onChange={(e) => set({ stockPeriodType: e.target.value })}>
                  <MenuItem value="Daily">Daily (today's stock)</MenuItem>
                  <MenuItem value="Weekly">Weekly</MenuItem>
                  <MenuItem value="Monthly">Monthly</MenuItem>
                </Select>
              </FormControl>
              {products.map((p) => {
                const e = form.stockElements[p.id] || { boxes: "", sachets: "" };
                const setEl = (patch) => set({ stockElements: { ...form.stockElements, [p.id]: { ...e, ...patch } } });
                return (
                  <Box key={p.id} sx={{ display: "grid", gap: 1 }}>
                    <Typography variant="body2" fontWeight={800}>
                      {p.name}{" "}
                      <Typography component="span" variant="caption" color="text.secondary">
                        {p.code}
                      </Typography>
                    </Typography>
                    <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" } }}>
                      <DataElementPicker label="Boxes remaining" value={e.boxes} onChange={(v) => setEl({ boxes: v })} disabled={!status?.configured} />
                      <DataElementPicker label={`${p.baseUnitName || "Sachet"}s remaining`} value={e.sachets} onChange={(v) => setEl({ sachets: v })} disabled={!status?.configured} />
                    </Box>
                  </Box>
                );
              })}
              {!products.length ? <Typography color="text.secondary">No products in this country yet.</Typography> : null}
            </CardContent>
          </Card>
        </Box>
      ) : null}

      {form ? (
        <Card>
          <CardContent>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ xs: "stretch", sm: "center" }}>
              <Tooltip title={ready ? "" : "Choose the program, data element and product first"}>
                <FormControlLabel
                  control={<Switch checked={form.enabled && ready} disabled={!ready} onChange={(e) => set({ enabled: e.target.checked })} />}
                  label={<Typography fontWeight={800}>Automatic sync</Typography>}
                />
              </Tooltip>
              <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
                When on, Anchor pulls new and edited visits, then pushes stock, every {form.intervalMinutes} minutes.
              </Typography>
              <Button variant="contained" onClick={save} disabled={busy === "save"}>
                {busy === "save" ? <CircularProgress size={18} color="inherit" /> : "Save settings"}
              </Button>
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent sx={{ display: "grid", gap: 2 }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} justifyContent="space-between" alignItems={{ xs: "stretch", md: "center" }}>
            <Box>
              <Typography fontWeight={900}>3. Sites and DHIS2 organisation units</Typography>
              <Typography variant="body2" color="text.secondary">
                Link each Anchor site to its org unit. Visits from unlinked org units are skipped. Linking a site pulls its earlier visits.
              </Typography>
            </Box>
            <Stack direction="row" spacing={1}>
              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel>Show</InputLabel>
                <Select label="Show" value={mapFilter} onChange={(e) => setMapFilter(e.target.value)}>
                  <MenuItem value="all">All sites</MenuItem>
                  <MenuItem value="unmapped">Not linked</MenuItem>
                  <MenuItem value="mapped">Linked</MenuItem>
                </Select>
              </FormControl>
              <Button startIcon={<AutoFixHighIcon />} variant="outlined" disabled={!mapping.orgUnits.length || busy === "match"} onClick={() => autoMatch(false)}>
                Auto-match
              </Button>
            </Stack>
          </Stack>
          {mapping.orgUnitError ? <Alert severity="warning">Could not load the program's org units: {mapping.orgUnitError}</Alert> : null}
          {!mapping.orgUnits.length && !mapping.orgUnitError ? (
            <Alert severity="info">Choose and save the program to list its org units. You can also paste an org unit UID.</Alert>
          ) : null}
          <TableContainer sx={{ maxHeight: 520 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Anchor site</TableCell>
                  <TableCell>County / base</TableCell>
                  <TableCell sx={{ minWidth: 320 }}>DHIS2 org unit</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {shownSites.map((s) => {
                  const ou = s.dhis2OrgUnitId ? ouById.get(s.dhis2OrgUnitId) || { id: s.dhis2OrgUnitId, displayName: s.dhis2OrgUnitId } : null;
                  return (
                    <TableRow key={s.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight={700}>
                          {s.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {s.code}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{s.county?.name || "—"}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {s.parentStockLocation?.name || ""}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Autocomplete
                          size="small"
                          freeSolo
                          options={mapping.orgUnits}
                          value={ou}
                          getOptionLabel={(o) => (typeof o === "string" ? o : o.displayName)}
                          getOptionDisabled={(o) => usedOus.has(o.id) && o.id !== s.dhis2OrgUnitId}
                          isOptionEqualToValue={(a, b) => a.id === b.id}
                          onChange={(_, v) => mapSite(s, typeof v === "string" ? v.trim() : v?.id || null)}
                          renderOption={(props, o) => (
                            <li {...props} key={o.id}>
                              <Box>
                                <Typography variant="body2">{o.displayName}</Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {[o.parent?.displayName, o.code, o.id].filter(Boolean).join(" · ")}
                                  {usedOus.has(o.id) && o.id !== s.dhis2OrgUnitId ? " · already linked" : ""}
                                </Typography>
                              </Box>
                            </li>
                          )}
                          renderInput={(params) => <TextField {...params} placeholder="Not linked" />}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!shownSites.length ? (
                  <TableRow>
                    <TableCell colSpan={3}>
                      <Typography color="text.secondary">No sites.</Typography>
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      <TrackerProgramsCard params={params} programs={programs} configured={!!status?.configured} onNotice={setNotice} />

      <Card>
        <CardContent sx={{ display: "grid", gap: 2 }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable">
            <Tab label="Sync history" />
            <Tab label="Visits imported" />
            <Tab label="Stock sent to DHIS2" />
          </Tabs>

          {tab === 0 ? (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Started</TableCell>
                    <TableCell>What</TableCell>
                    <TableCell>Trigger</TableCell>
                    <TableCell>Result</TableCell>
                    <TableCell>Details</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {runs.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>{fmtTime(r.startedAt)}</TableCell>
                      <TableCell>{RUN_LABEL[r.direction] || (String(r.direction).startsWith("TRACKER:") ? `Children: ${r.direction.slice(8)}` : r.direction)}</TableCell>
                      <TableCell>{r.trigger === "SCHEDULE" ? "Automatic" : r.trigger === "MAPPING" ? "Site linked" : "Manual"}</TableCell>
                      <TableCell>
                        <Chip size="small" color={RUN_COLOR[r.status] || "default"} label={r.status} />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{runSummary(r)}</Typography>
                        {r.error ? (
                          <Typography variant="caption" color="error.main">
                            {r.error}
                          </Typography>
                        ) : null}
                        {r.stats?.conflicts?.length ? (
                          <Typography variant="caption" color="warning.main" component="div">
                            {r.stats.conflicts.slice(0, 3).join(" · ")}
                          </Typography>
                        ) : null}
                        {r.stats?.notAssigned?.length ? (
                          <Typography variant="caption" color="warning.main" component="div">
                            Not in the DHIS2 stock data set (assign them in DHIS2): {r.stats.notAssigned.join(", ")}
                          </Typography>
                        ) : null}
                        {r.stats?.unmappedOrgUnits && Object.keys(r.stats.unmappedOrgUnits).length ? (
                          <Typography variant="caption" color="text.secondary" component="div">
                            Unlinked org units: {Object.keys(r.stats.unmappedOrgUnits).slice(0, 8).join(", ")}
                          </Typography>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!runs.length ? (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <Typography color="text.secondary">No sync has run yet.</Typography>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </TableContainer>
          ) : null}

          {tab === 1 ? (
            <Box sx={{ display: "grid", gap: 2 }}>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Site</TableCell>
                      <TableCell align="right">Visits</TableCell>
                      <TableCell align="right">Sachets reported</TableCell>
                      <TableCell align="right">Deducted from stock</TableCell>
                      <TableCell align="right">Not in stock</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {imports.bySite.map((s) => (
                      <TableRow key={s.facilityId || "none"}>
                        <TableCell>{s.siteName}</TableCell>
                        <TableCell align="right">{n(s.events)}</TableCell>
                        <TableCell align="right">{n(s.reported)}</TableCell>
                        <TableCell align="right">{n(s.deducted)}</TableCell>
                        <TableCell align="right" sx={{ color: s.shortfall ? "warning.main" : undefined, fontWeight: s.shortfall ? 800 : undefined }}>
                          {n(s.shortfall)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {!imports.bySite.length ? (
                      <TableRow>
                        <TableCell colSpan={5}>
                          <Typography color="text.secondary">No visits imported yet.</Typography>
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </TableContainer>
              <FormControlLabel control={<Switch checked={shortOnly} onChange={(e) => setShortOnly(e.target.checked)} />} label="Only visits with sachets not in stock" />
              <TableContainer sx={{ maxHeight: 480 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>Visit date</TableCell>
                      <TableCell>Site</TableCell>
                      <TableCell>DHIS2 event</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="right">Reported</TableCell>
                      <TableCell align="right">Deducted</TableCell>
                      <TableCell align="right">Short</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {imports.rows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>{fmtDate(r.occurredAt)}</TableCell>
                        <TableCell>{r.facility?.name || r.orgUnitId}</TableCell>
                        <TableCell sx={{ fontFamily: "monospace" }}>{r.eventUid}</TableCell>
                        <TableCell>{r.deleted ? <Chip size="small" label="Deleted" /> : r.status}</TableCell>
                        <TableCell align="right">{n(r.reportedSachets)}</TableCell>
                        <TableCell align="right">{n(r.deductedSachets)}</TableCell>
                        <TableCell align="right" sx={{ color: r.shortfallSachets ? "warning.main" : undefined }}>
                          {n(r.shortfallSachets)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              {imports.total > imports.rows.length ? (
                <Typography variant="caption" color="text.secondary">
                  Showing the latest {imports.rows.length} of {n(imports.total)} visits.
                </Typography>
              ) : null}
            </Box>
          ) : null}

          {tab === 2 ? (
            <Box sx={{ display: "grid", gap: 1 }}>
              <Typography variant="body2" color="text.secondary">
                What the next push sends, for period {preview.period}. Only linked sites and products with data elements are included.
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Site</TableCell>
                      <TableCell>Org unit</TableCell>
                      <TableCell>Product</TableCell>
                      <TableCell align="right">Boxes</TableCell>
                      <TableCell align="right">Sachets</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {preview.rows.map((r) => (
                      <TableRow key={`${r.facilityId}-${r.product?.id}`}>
                        <TableCell>{r.siteName}</TableCell>
                        <TableCell sx={{ fontFamily: "monospace" }}>{r.orgUnitId}</TableCell>
                        <TableCell>{r.product?.name}</TableCell>
                        <TableCell align="right">{n(r.boxes)}</TableCell>
                        <TableCell align="right">{n(r.sachets)}</TableCell>
                      </TableRow>
                    ))}
                    {!preview.rows.length ? (
                      <TableRow>
                        <TableCell colSpan={5}>
                          <Typography color="text.secondary">Nothing to send yet: link sites and choose stock data elements.</Typography>
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={!!matchPreview} onClose={() => setMatchPreview(null)} maxWidth="md" fullWidth>
        <DialogTitle>Auto-match sites to org units</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            {matchPreview?.matches?.length || 0} matches by code or name. {matchPreview?.unmatched || 0} unlinked sites had no clear match; link those by hand.
          </Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Anchor site</TableCell>
                <TableCell>DHIS2 org unit</TableCell>
                <TableCell>Matched by</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(matchPreview?.matches || []).map((m) => (
                <TableRow key={m.facilityId}>
                  <TableCell>{m.siteName}</TableCell>
                  <TableCell>{m.orgUnitName}</TableCell>
                  <TableCell>{m.by}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMatchPreview(null)}>Cancel</Button>
          <Button variant="contained" disabled={!matchPreview?.matches?.length || busy === "match"} onClick={() => autoMatch(true)}>
            Link {matchPreview?.matches?.length || 0} sites
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
