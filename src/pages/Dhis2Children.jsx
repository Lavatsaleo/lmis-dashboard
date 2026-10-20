import React, { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import dayjs from "dayjs";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Collapse,
  Divider,
  Drawer,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";

import { api } from "../api/client";
import { CountryScopeSelect } from "../components/CountryScope";
import { useCountryScope } from "../components/useCountryScope";

const fmt = (n) => new Intl.NumberFormat().format(Number(n || 0));
const day = (d) => (d ? dayjs(d).format("D MMM YYYY") : "—");
const num = (v, digits = 1) => (v === null || v === undefined ? "—" : Number(v).toFixed(digits).replace(/\.0+$/, ""));

const STATUS_COLOR = {
  "In treatment": "info",
  "Missed appointment": "warning",
  Cured: "success",
  Died: "error",
  Default: "warning",
  "Default (No Supply)": "warning",
  "Non response": "warning",
};
const BASE_STATUSES = [
  ["", "All children"],
  ["IN_TREATMENT", "In treatment"],
  ["MISSED", "Missed appointment"],
  ["DISCHARGED", "Discharged (any outcome)"],
];
const STAGE_LABEL = { ADMISSION: "Admission", FOLLOW_UP: "Follow-up", DISCHARGE: "Discharge", OTHER: "Other" };

async function downloadCsv(url, params, fallbackName) {
  const res = await api.get(url, { params, responseType: "blob" });
  const name = /filename="([^"]+)"/.exec(res.headers["content-disposition"] || "")?.[1] || fallbackName;
  const href = URL.createObjectURL(new Blob([res.data], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 30000);
}

function VisitRow({ v }) {
  const [open, setOpen] = useState(false);
  const scheduled = String(v.status || "").toUpperCase() === "SCHEDULE";
  return (
    <>
      <TableRow hover sx={{ "& td": { borderBottom: open ? 0 : undefined }, opacity: scheduled ? 0.65 : 1 }}>
        <TableCell padding="checkbox">
          <IconButton size="small" onClick={() => setOpen(!open)} disabled={!v.fields?.length}>
            {open ? <KeyboardArrowUpIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
          </IconButton>
        </TableCell>
        <TableCell sx={{ whiteSpace: "nowrap" }}>{scheduled ? `Due ${day(v.scheduledAt)}` : day(v.occurredAt)}</TableCell>
        <TableCell>
          <Typography variant="body2" fontWeight={700}>
            {STAGE_LABEL[v.stage] || v.stageName}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {scheduled ? "Scheduled" : v.visitStatus || v.status}
          </Typography>
        </TableCell>
        <TableCell align="right">{num(v.weightKg)}</TableCell>
        <TableCell align="right">{num(v.muacCm)}</TableCell>
        <TableCell align="right">{num(v.whz, 2)}</TableCell>
        <TableCell>{v.oedema || "—"}</TableCell>
        <TableCell align="right">{v.sachets ?? "—"}</TableCell>
        <TableCell sx={{ whiteSpace: "nowrap" }}>{v.outcome || (v.nextVisitDate ? day(v.nextVisitDate) : "—")}</TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={9} sx={{ py: 0 }}>
          <Collapse in={open} unmountOnExit>
            <Box sx={{ py: 1.5, display: "grid", gap: 0.5, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" } }}>
              {(v.fields || []).map((f) => (
                <Typography key={f.name} variant="body2">
                  <Box component="span" sx={{ color: "text.secondary" }}>
                    {f.name}:
                  </Box>{" "}
                  <b>{f.value === "true" ? "Yes" : f.value === "false" ? "No" : f.value}</b>
                </Typography>
              ))}
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

function ChildDrawer({ id, onClose }) {
  const [child, setChild] = useState({ id: null, data: null, error: "" });
  useEffect(() => {
    if (!id) return undefined;
    let alive = true;
    api
      .get(`/api/dhis2-children/${id}`)
      .then((r) => alive && setChild({ id, data: r.data, error: "" }))
      .catch((e) => alive && setChild({ id, data: null, error: e?.response?.data?.message || e.message }));
    return () => {
      alive = false;
    };
  }, [id]);
  const c = child.id === id ? child.data : null;
  const commodity = c?.programConfig?.commodity || "Sachets";
  return (
    <Drawer anchor="right" open={!!id} onClose={onClose} PaperProps={{ sx: { width: { xs: "100%", md: 920 } } }}>
      <Box sx={{ p: 2.5, display: "grid", gap: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography variant="h5" fontWeight={900}>
              {c?.childName || (child.error ? "Child" : "Loading…")}
            </Typography>
            {c ? (
              <Typography variant="body2" color="text.secondary">
                {c.programConfig.code} · Patient ID {c.patientId || "—"} · {c.orgUnitName}
              </Typography>
            ) : null}
          </Box>
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Stack>
        {child.error && child.id === id ? <Alert severity="error">{child.error}</Alert> : null}
        {c ? (
          <>
            <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" } }}>
              {[
                ["Sex", c.sex],
                ["Age at admission", c.ageMonths !== null ? `${c.ageMonths} months` : "—"],
                ["Date of birth", day(c.dateOfBirth)],
                ["Caregiver", c.caregiverName],
                ["Payam", c.addressPayam],
                ["Village / Boma", c.addressVillage],
                ["Admitted", day(c.enrolledAt)],
                ["Admission type", c.admissionType],
                ["Status", c.status],
                ["Outcome date", day(c.outcomeDate)],
                ["Visits", fmt(c.visitCount)],
                [`${commodity} sachets given`, fmt(c.sachetsTotal)],
              ].map(([k, v]) => (
                <Box key={k} sx={{ p: 1.25, borderRadius: 2, bgcolor: (t) => alpha(t.palette.primary.main, 0.05) }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={700}>
                    {k}
                  </Typography>
                  <Typography variant="body2" fontWeight={800} sx={{ wordBreak: "break-word" }}>
                    {v || "—"}
                  </Typography>
                </Box>
              ))}
            </Box>
            <Box>
              <Typography variant="h6" fontWeight={900}>
                Visits
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                As recorded in DHIS2. Open a row to see every field, to compare with the register.
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox" />
                      <TableCell>Date</TableCell>
                      <TableCell>Visit</TableCell>
                      <TableCell align="right">Weight (kg)</TableCell>
                      <TableCell align="right">MUAC (cm)</TableCell>
                      <TableCell align="right">WHZ</TableCell>
                      <TableCell>Oedema</TableCell>
                      <TableCell align="right">{commodity}</TableCell>
                      <TableCell>Next visit / outcome</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {c.visits.map((v) => (
                      <VisitRow key={v.id} v={v} />
                    ))}
                    {!c.visits.length ? (
                      <TableRow>
                        <TableCell colSpan={9}>No visits recorded.</TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          </>
        ) : null}
      </Box>
    </Drawer>
  );
}

export default function Dhis2Children() {
  const { me } = useOutletContext() || {};
  const scope = useCountryScope(me);
  const scopeImpl = scope.implementationId;
  const scopeReady = scope.ready;
  const implParams = useMemo(() => (scopeImpl ? { implementationId: scopeImpl } : {}), [scopeImpl]);

  const [programs, setPrograms] = useState({ key: null, rows: [] });
  const [programId, setProgramId] = useState("");
  const [sites, setSites] = useState([]);
  const [site, setSite] = useState(null);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [dates, setDates] = useState({ enrolledFrom: "", enrolledTo: "", visitFrom: "", visitTo: "" });
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [result, setResult] = useState({ key: null, data: null, error: "" });
  const [openId, setOpenId] = useState(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

  // Programs for this country
  useEffect(() => {
    if (!scopeReady) return undefined;
    let alive = true;
    api.get("/api/dhis2-children/programs", { params: implParams }).then((r) => {
      if (!alive) return;
      setPrograms({ key: scopeImpl || "ALL", rows: r.data || [] });
    });
    return () => {
      alive = false;
    };
  }, [scopeReady, scopeImpl, implParams]);
  const programRows = programs.key === (scopeImpl || "ALL") ? programs.rows : [];
  const program = programRows.find((p) => p.id === programId) || programRows[0] || null;
  const pid = program?.id || "";

  // Sites with children in this program
  useEffect(() => {
    if (!pid) return undefined;
    let alive = true;
    api.get("/api/dhis2-children/sites", { params: { ...implParams, programId: pid } }).then((r) => alive && setSites(r.data || []));
    return () => {
      alive = false;
    };
  }, [pid, implParams]);

  // Wait until typing stops before searching.
  useEffect(() => {
    const t = setTimeout(() => {
      setTerm(search.trim());
      setPage(0);
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const filters = useMemo(
    () => ({
      ...implParams,
      programId: pid,
      ...(site ? { orgUnit: site.orgUnitUid } : {}),
      ...(status ? { status } : {}),
      ...(term ? { q: term } : {}),
      ...Object.fromEntries(Object.entries(dates).filter(([, v]) => v)),
    }),
    [implParams, pid, site, status, term, dates]
  );
  const key = JSON.stringify({ ...filters, page, pageSize });

  useEffect(() => {
    if (!pid) return undefined;
    let alive = true;
    const k = JSON.stringify({ ...filters, page, pageSize });
    api
      .get("/api/dhis2-children", { params: { ...filters, page: page + 1, pageSize } })
      .then((r) => alive && setResult({ key: k, data: r.data, error: "" }))
      .catch((e) => alive && setResult({ key: k, data: null, error: e?.response?.data?.message || e.message }));
    return () => {
      alive = false;
    };
  }, [filters, page, pageSize, pid]);

  const data = result.data;
  const loading = result.key !== key;
  const s = data?.summary;
  const commodity = program?.commodity || "Sachets";
  const outcomeOptions = (s?.outcomes || []).map((o) => o.outcome);

  const exportCsv = async (level) => {
    setErr("");
    setBusy(level);
    try {
      await downloadCsv("/api/dhis2-children/export.csv", { ...filters, level }, `children-${level}.csv`);
    } catch (e) {
      setErr(e?.response?.data?.message || e.message);
    } finally {
      setBusy("");
    }
  };
  const resetPage = (fn) => (v) => {
    fn(v);
    setPage(0);
  };

  if (scopeReady && programs.key !== null && !programRows.length) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h5" fontWeight={900}>
            Children (DHIS2)
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            No DHIS2 program is set up for this country yet. An administrator adds one on the DHIS2 Integration page.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Box sx={{ display: "grid", gap: 2.5 }}>
      <Card>
        <CardContent sx={{ display: "grid", gap: 2, gridTemplateColumns: "minmax(0, 1fr)" }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} justifyContent="space-between" alignItems={{ xs: "stretch", md: "center" }}>
            <Box>
              <Typography variant="h5" fontWeight={900}>
                Children (DHIS2)
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Patient records from DHIS2 for checking against facility registers. Read-only
                {program?.lastPullAt ? ` · updated ${dayjs(program.lastPullAt).format("D MMM, HH:mm")}` : ""}.
              </Typography>
            </Box>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <CountryScopeSelect
                scope={{
                  ...scope,
                  setValue: (v) => {
                    setSite(null);
                    setProgramId("");
                    setPage(0);
                    scope.setValue(v);
                  },
                }}
              />
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Program</InputLabel>
                <Select
                  label="Program"
                  value={pid}
                  onChange={(e) => {
                    setProgramId(e.target.value);
                    setSite(null);
                    setStatus("");
                    setPage(0);
                  }}
                >
                  {programRows.map((p) => (
                    <MenuItem key={p.id} value={p.id}>
                      {p.code} · {fmt(p.children)} children
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
          </Stack>

          <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "minmax(0,1fr)", md: "2fr 1.3fr 1.6fr" } }}>
            <Autocomplete
              size="small"
              options={sites}
              value={site}
              onChange={(_, v) => resetPage(setSite)(v)}
              groupBy={(o) => o.county || "Other"}
              getOptionLabel={(o) => o?.name || ""}
              isOptionEqualToValue={(a, b) => a.orgUnitUid === b.orgUnitUid}
              renderOption={(props, o) => {
                const { key: k, ...rest } = props;
                return (
                  <li key={k} {...rest}>
                    <Stack direction="row" justifyContent="space-between" sx={{ width: "100%" }} spacing={1}>
                      <Box>
                        <Typography variant="body2" fontWeight={700}>
                          {o.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {[o.payam, o.inAnchor ? null : "not an Anchor site"].filter(Boolean).join(" · ")}
                        </Typography>
                      </Box>
                      <Typography variant="caption" sx={{ alignSelf: "center" }}>
                        {fmt(o.children)}
                      </Typography>
                    </Stack>
                  </li>
                );
              }}
              renderInput={(params) => <TextField {...params} label={`Site (${sites.length})`} placeholder="All sites — type to search" />}
            />
            <FormControl size="small">
              <InputLabel>Status</InputLabel>
              <Select label="Status" value={status} onChange={(e) => resetPage(setStatus)(e.target.value)}>
                {BASE_STATUSES.map(([v, l]) => (
                  <MenuItem key={v} value={v}>
                    {l}
                  </MenuItem>
                ))}
                {outcomeOptions.length ? <Divider /> : null}
                {outcomeOptions.map((o) => (
                  <MenuItem key={o} value={o}>
                    Discharged: {o}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField size="small" label="Search name, caregiver or Patient ID" value={search} onChange={(e) => setSearch(e.target.value)} />
          </Box>

          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} useFlexGap flexWrap="wrap" alignItems={{ xs: "stretch", md: "center" }}>
            {[
              ["enrolledFrom", "Admitted from"],
              ["enrolledTo", "Admitted to"],
              ["visitFrom", "Visited from"],
              ["visitTo", "Visited to"],
            ].map(([k, label]) => (
              <TextField
                key={k}
                size="small"
                type="date"
                label={label}
                value={dates[k]}
                onChange={(e) => resetPage(setDates)({ ...dates, [k]: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            ))}
            {Object.values(dates).some(Boolean) || site || status || search ? (
              <Button
                onClick={() => {
                  setDates({ enrolledFrom: "", enrolledTo: "", visitFrom: "", visitTo: "" });
                  setSite(null);
                  setStatus("");
                  setSearch("");
                  setPage(0);
                }}
              >
                Clear filters
              </Button>
            ) : null}
            <Box sx={{ flexGrow: 1 }} />
            <Button variant="outlined" startIcon={<DownloadOutlinedIcon />} disabled={!!busy || !data?.total} onClick={() => exportCsv("children")}>
              {busy === "children" ? "Exporting…" : "Export children"}
            </Button>
            <Button variant="outlined" startIcon={<DownloadOutlinedIcon />} disabled={!!busy || !data?.total} onClick={() => exportCsv("visits")}>
              {busy === "visits" ? "Exporting…" : "Export visits"}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {err ? <Alert severity="error">{err}</Alert> : null}
      {result.error ? <Alert severity="error">{result.error}</Alert> : null}

      {s ? (
        <Box sx={{ display: "grid", gap: { xs: 1.5, sm: 2 }, gridTemplateColumns: { xs: "repeat(2, minmax(0,1fr))", md: "repeat(5, 1fr)" } }}>
          {[
            ["Children", s.children, null],
            ["In treatment", s.inTreatment, "info"],
            ["Missed appointment", s.missed, s.missed ? "warning" : null],
            ["Discharged", s.discharged, null],
            [`${commodity} sachets given`, s.sachets, null],
          ].map(([label, value, tone]) => (
            <Card key={label}>
              <CardContent>
                <Typography variant="body2" color="text.secondary" fontWeight={700}>
                  {label}
                </Typography>
                <Typography variant="h4" fontWeight={900} color={tone ? `${tone}.main` : undefined}>
                  {fmt(value)}
                </Typography>
              </CardContent>
            </Card>
          ))}
        </Box>
      ) : null}
      {s?.outcomes?.length ? (
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
          <Typography variant="body2" color="text.secondary" sx={{ alignSelf: "center" }}>
            Discharge outcomes:
          </Typography>
          {s.outcomes.map((o) => (
            <Chip key={o.outcome} size="small" color={STATUS_COLOR[o.outcome] || "default"} variant="outlined" label={`${o.outcome}: ${fmt(o.children)}`} onClick={() => resetPage(setStatus)(o.outcome)} />
          ))}
        </Stack>
      ) : null}

      <Card>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Patient ID</TableCell>
                <TableCell>Child</TableCell>
                <TableCell>Caregiver</TableCell>
                <TableCell>Site</TableCell>
                <TableCell>Admitted</TableCell>
                <TableCell align="right">Visits</TableCell>
                <TableCell>Last visit</TableCell>
                <TableCell>Next visit</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">{commodity}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody sx={{ opacity: loading ? 0.5 : 1 }}>
              {(data?.rows || []).map((c) => (
                <TableRow key={c.id} hover sx={{ cursor: "pointer" }} onClick={() => setOpenId(c.id)}>
                  <TableCell sx={{ fontFamily: "monospace", whiteSpace: "nowrap" }}>{c.patientId || "—"}</TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={800}>
                      {c.childName || "—"}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {[c.sex, c.ageMonths !== null ? `${c.ageMonths} m` : null].filter(Boolean).join(" · ")}
                    </Typography>
                  </TableCell>
                  <TableCell>{c.caregiverName || "—"}</TableCell>
                  <TableCell>
                    <Typography variant="body2">{c.orgUnitName}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {c.orgUnitParentName}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>
                    <Typography variant="body2">{day(c.enrolledAt)}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {c.admissionType || ""}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">{c.visitCount}</TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>{day(c.lastVisitDate)}</TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>{day(c.nextVisitDate)}</TableCell>
                  <TableCell>
                    <Chip size="small" color={STATUS_COLOR[c.status] || "default"} label={c.status} />
                  </TableCell>
                  <TableCell align="right">{fmt(c.sachetsTotal)}</TableCell>
                </TableRow>
              ))}
              {data && !data.rows.length ? (
                <TableRow>
                  <TableCell colSpan={10}>
                    <Typography color="text.secondary">No child matches these filters.</Typography>
                  </TableCell>
                </TableRow>
              ) : null}
              {!data && !result.error ? (
                <TableRow>
                  <TableCell colSpan={10}>Loading…</TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={data?.total || 0}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={pageSize}
          onRowsPerPageChange={(e) => {
            setPageSize(Number(e.target.value));
            setPage(0);
          }}
          rowsPerPageOptions={[25, 50, 100, 200]}
        />
      </Card>

      <ChildDrawer id={openId} onClose={() => setOpenId(null)} />
    </Box>
  );
}
