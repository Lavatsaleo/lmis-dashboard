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
  CircularProgress,
  Divider,
  Drawer,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import SyncIcon from "@mui/icons-material/Sync";
import LinkIcon from "@mui/icons-material/Link";

import { api } from "../api/client";
import { useImplementationChoice } from "../components/implementationChoice";

// DHIS2 times are the DHIS2 server's own clock (no zone): show them as they are.
const when = (s) => (s ? dayjs(String(s).slice(0, 19)).format("D MMM YYYY, HH:mm") : "—");
const dayOnly = (s) => (s ? dayjs(String(s).slice(0, 10)).format("D MMM YYYY") : "—");
const ago = (days) => (days === null || days === undefined ? "never" : days === 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`);
const fmt = (n) => new Intl.NumberFormat().format(Number(n || 0));
const sinceRun = (iso) => (iso ? dayjs(iso).format("D MMM, HH:mm") : "—");

const THRESHOLDS = [3, 7, 14, 30];
const RECENT_DAYS = 3;

/** ok | late | stale | never, from days since the last record reached DHIS2. */
const statusOf = (s, limit) => (s.daysSince === null ? "never" : s.daysSince <= RECENT_DAYS ? "ok" : s.daysSince <= limit ? "late" : "stale");
const STATUS = {
  ok: { label: "Up to date", color: "success" },
  late: { label: "Late", color: "warning" },
  stale: { label: "Not synced", color: "error" },
  never: { label: "Never sent data", color: "default" },
};
const PROBLEM_LABEL = { NOT_LINKED: "Not linked to Anchor", SHORTFALL: "Sachets not in stock", NOT_ASSIGNED: "Stock not sent" };
const ANCHOR = {
  COPIED: { label: "In Anchor", color: "success" },
  OLDER: { label: "Update pending", color: "warning" },
  MISSING: { label: "Not in Anchor yet", color: "warning" },
  NOT_LINKED: { label: "Not counted: site not linked", color: "error" },
  NOTHING_TO_COUNT: { label: "Nothing to count", color: "default" },
};

/** A sync error in plain words, for support officers. */
function explain(error) {
  const e = String(error || "");
  if (!e) return null;
  if (/not configured|DHIS2_URL/i.test(e)) return "The DHIS2 connection is not set up on the Anchor server.";
  if (/fetch failed|ECONN|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|socket|network|timed? ?out/i.test(e)) return "Anchor could not reach DHIS2 (internet or DHIS2 down). It tries again automatically every hour.";
  if (/\b401\b|\b403\b|unauthori|forbidden/i.test(e)) return "DHIS2 refused Anchor's access token. A Super Admin needs to renew it on the DHIS2 Integration page.";
  if (/not assigned/i.test(e)) return "Some sites are not in the DHIS2 stock data set, so their stock could not be sent. A DHIS2 administrator adds them to the data set.";
  if (/\b409\b|conflict/i.test(e)) return "DHIS2 refused some values. Usually a site missing from the stock data set or a period that is closed for entry.";
  if (/Choose the DHIS2 program/i.test(e)) return "The DHIS2 dispensing program is not chosen yet (DHIS2 Integration page).";
  return e;
}

function Problem({ title, children, severity = "warning" }) {
  return (
    <Alert severity={severity} sx={{ "& .MuiAlert-message": { width: "100%" } }}>
      <Typography variant="body2" fontWeight={800}>
        {title}
      </Typography>
      <Box sx={{ mt: 0.5, display: "grid", gap: 1 }}>{children}</Box>
    </Alert>
  );
}

function SiteDrawer({ site, limit, implParams, onClose, onChanged }) {
  const [log, setLog] = useState({ key: null, data: null, error: "" });
  const [resync, setResync] = useState({ busy: false, result: null, error: "" });
  const [options, setOptions] = useState([]);
  const [linkTo, setLinkTo] = useState(null);
  const [linking, setLinking] = useState({ busy: false, msg: "", error: "" });
  const notLinked = site.problems.some((p) => p.code === "NOT_LINKED") || !site.facility;
  const status = statusOf(site, limit);
  const shortfall = site.problems.find((p) => p.code === "SHORTFALL");

  // The sync log, read live from DHIS2; bump logTick to read it again.
  const [logTick, setLogTick] = useState(0);
  const logKey = `${site.orgUnitUid}|${logTick}`;
  const logLoading = log.key !== logKey;
  const loadLog = () => setLogTick((t) => t + 1);
  useEffect(() => {
    let alive = true;
    api
      .get(`/api/dhis2-sync/sites/${site.orgUnitUid}/log`, { params: implParams })
      .then((r) => alive && setLog({ key: logKey, data: r.data, error: "" }))
      .catch((e) => alive && setLog({ key: logKey, data: null, error: e?.response?.data?.message || e.message }));
    return () => {
      alive = false;
    };
  }, [logKey, site.orgUnitUid, implParams]);

  useEffect(() => {
    if (site.facility) return undefined;
    let alive = true;
    api
      .get("/api/dhis2-sync/link-options", { params: implParams })
      .then((r) => alive && setOptions(r.data || []))
      .catch(() => alive && setOptions([]));
    return () => {
      alive = false;
    };
  }, [site.facility, implParams]);

  const runResync = async () => {
    setResync({ busy: true, result: null, error: "" });
    try {
      const r = await api.post(`/api/dhis2-sync/sites/${site.orgUnitUid}/resync`, implParams);
      setResync({ busy: false, result: r.data, error: "" });
      loadLog();
      onChanged();
    } catch (e) {
      setResync({ busy: false, result: null, error: e?.response?.data?.message || e.message });
    }
  };

  const link = async () => {
    if (!linkTo) return;
    setLinking({ busy: true, msg: "", error: "" });
    try {
      const r = await api.put(`/api/dhis2-sync/sites/${site.orgUnitUid}/link`, { ...implParams, facilityId: linkTo.id });
      setLinking({
        busy: false,
        error: "",
        msg: `Linked to ${r.data.facility.name}.${r.data.backfill ? " Anchor is now counting this site's dispensing from the go-live date; this takes a minute." : ""}`,
      });
      onChanged();
    } catch (e) {
      setLinking({ busy: false, msg: "", error: e?.response?.data?.message || e.message });
    }
  };

  const records = log.data?.records || [];
  const lateRecords = records.filter((r) => r.delayHours !== null && r.delayHours >= 24).length;

  return (
    <Box sx={{ width: { xs: "100vw", md: 720 }, maxWidth: "100vw", p: { xs: 2, md: 3 }, display: "grid", gap: 2, alignContent: "start" }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h6" fontWeight={900}>
            {site.name}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {[site.payam, site.county].filter(Boolean).join(" · ") || "—"}
          </Typography>
        </Box>
        <IconButton onClick={onClose} aria-label="Close">
          <CloseIcon />
        </IconButton>
      </Stack>

      <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(4, minmax(0,1fr))" } }}>
        {[
          ["Status", <Chip key="s" size="small" color={STATUS[status].color} label={STATUS[status].label} />],
          ["Last data in DHIS2", <span key="l">{site.lastReceivedAt ? `${ago(site.daysSince)}` : "never"}</span>],
          ["Last visit recorded", dayOnly(site.lastVisitDate)],
          ["Anchor location", site.facility ? site.facility.name : "Not linked"],
        ].map(([k, v]) => (
          <Box key={k} sx={{ p: 1.25, borderRadius: 2, bgcolor: "action.hover" }}>
            <Typography variant="caption" color="text.secondary" fontWeight={800} component="div">
              {k}
            </Typography>
            <Typography variant="body2" fontWeight={800} component="div" sx={{ mt: 0.25 }}>
              {v}
            </Typography>
          </Box>
        ))}
      </Box>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "stretch", sm: "center" }}>
        <Button variant="contained" startIcon={resync.busy ? <CircularProgress size={16} color="inherit" /> : <SyncIcon />} disabled={resync.busy} onClick={runResync}>
          {resync.busy ? "Re-syncing…" : "Re-sync this site"}
        </Button>
        <Typography variant="caption" color="text.secondary">
          Reads this site&apos;s children again from DHIS2{site.facility ? ", recounts its dispensing and sends its stock" : ""}. Safe to repeat.
        </Typography>
      </Stack>
      {resync.error ? <Alert severity="error">{explain(resync.error)}</Alert> : null}
      {resync.result ? (
        <Alert severity={resync.result.steps.every((s) => s.ok || s.skipped) ? "success" : "warning"}>
          {resync.result.steps.length ? (
            resync.result.steps.map((s) => (
              <div key={s.step}>
                <b>{s.step}:</b>{" "}
                {s.ok
                  ? s.stats?.children !== undefined
                    ? `done, ${fmt(s.stats.children)} children and ${fmt(s.stats.visits)} visits read`
                    : s.stats?.events !== undefined
                      ? `done, ${fmt(s.stats.events)} records read${s.stats.newShortfall ? `, ${fmt(s.stats.newShortfall)} sachets not in stock` : ""}`
                      : "done"
                  : s.skipped || explain(s.error)}
              </div>
            ))
          ) : (
            "Nothing to re-sync for this site."
          )}
        </Alert>
      ) : null}

      <Divider />
      <Typography variant="subtitle1" fontWeight={900}>
        What to check
      </Typography>
      {status === "stale" || status === "never" ? (
        <Problem title={status === "never" ? "No records from this site have reached DHIS2" : `No records have reached DHIS2 from this site for ${site.daysSince} days`} severity="error">
          <Typography variant="body2">
            Call the site. On the tablet, check there is internet, open the DHIS2 Capture app and tap <b>Sync</b>. Records still on the tablet show a sync icon; records DHIS2 refused show a red icon:
            open one to read the message, correct it and sync again.
          </Typography>
          {status === "never" ? <Typography variant="body2">If the site has started, check its staff have DHIS2 accounts assigned to this site and the program.</Typography> : null}
        </Problem>
      ) : null}
      {lateRecords ? (
        <Problem title={`${lateRecords} recent record(s) reached DHIS2 a day or more after they were entered`}>
          <Typography variant="body2">The tablet is often offline or not synced daily. Ask the site to sync at least once a day when it has a connection.</Typography>
        </Problem>
      ) : null}
      {notLinked && site.problems.some((p) => p.code === "NOT_LINKED") ? (
        <Problem title="Not linked to an Anchor location" severity="error">
          <Typography variant="body2">Dispensing recorded in DHIS2 at this site cannot come off Anchor stock until the site is linked to its Anchor location.</Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <Autocomplete
              size="small"
              options={options}
              value={linkTo}
              onChange={(_, v) => setLinkTo(v)}
              getOptionLabel={(o) => `${o.name}${o.code ? ` (${o.code})` : ""}`}
              groupBy={(o) => o.county || "Other"}
              sx={{ flex: 1, minWidth: 220, bgcolor: "background.paper" }}
              renderInput={(p) => <TextField {...p} label="Anchor location" placeholder="Type to search" />}
            />
            <Button variant="outlined" startIcon={<LinkIcon />} disabled={!linkTo || linking.busy} onClick={link}>
              Link
            </Button>
          </Stack>
          {linking.msg ? <Typography variant="body2" color="success.main">{linking.msg}</Typography> : null}
          {linking.error ? <Typography variant="body2" color="error.main">{linking.error}</Typography> : null}
          <Typography variant="caption">If the site is not in Anchor at all, ask the logistics team to add it first.</Typography>
        </Problem>
      ) : null}
      {shortfall ? (
        <Problem title={`${fmt(shortfall.sachets)} sachets recorded as given in DHIS2 when Anchor had no stock at this site`}>
          <Typography variant="body2">
            Record the delivery or transfer to this site in Anchor (or correct the amount in DHIS2 if it was a typing error), then press <b>Re-sync this site</b>: the missing sachets come off stock once it is there.
          </Typography>
          {(log.data?.shortfalls || []).length ? (
            <Table size="small" sx={{ "&&": { minWidth: 0 } }}>
              <TableHead>
                <TableRow>
                  <TableCell>Visit date</TableCell>
                  <TableCell align="right">Recorded</TableCell>
                  <TableCell align="right">Not in stock</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {log.data.shortfalls.map((s) => (
                  <TableRow key={s.eventUid}>
                    <TableCell>{dayOnly(s.occurredAt)}</TableCell>
                    <TableCell align="right">{fmt(s.reportedSachets)}</TableCell>
                    <TableCell align="right">{fmt(s.shortfallSachets)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}
        </Problem>
      ) : null}
      {site.problems.some((p) => p.code === "NOT_ASSIGNED") ? (
        <Problem title="Anchor could not send this site's stock to DHIS2">
          <Typography variant="body2">
            The site is not in the DHIS2 stock data set. A DHIS2 administrator adds it (Maintenance → Data sets → the stock data set → organisation units), then press <b>Re-sync this site</b>.
          </Typography>
        </Problem>
      ) : null}
      {status === "ok" && !site.problems.length && !lateRecords ? <Alert severity="success">Nothing to fix: this site&apos;s records are reaching DHIS2 and Anchor.</Alert> : null}

      <Divider />
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="subtitle1" fontWeight={900}>
          Sync log: latest records from this site
        </Typography>
        <Button size="small" onClick={loadLog} disabled={logLoading}>
          Refresh
        </Button>
      </Stack>
      <Typography variant="caption" color="text.secondary" sx={{ mt: -1.5 }}>
        Read live from DHIS2. &quot;Entered on tablet&quot; is when the record was saved on the device; &quot;Reached DHIS2&quot; is when the sync delivered it.
      </Typography>
      {logLoading ? (
        <Stack direction="row" spacing={1} alignItems="center">
          <CircularProgress size={18} />
          <Typography variant="body2">Reading from DHIS2…</Typography>
        </Stack>
      ) : null}
      {log.error ? <Alert severity="error">{explain(log.error)}</Alert> : null}
      {log.data && !records.length ? <Typography color="text.secondary">DHIS2 has no records from this site in these programs.</Typography> : null}
      {records.length ? (
        <TableContainer>
          <Table size="small" sx={{ "&&": { minWidth: 0 }, "& th, & td": { px: { xs: 0.75, md: 1.25 }, verticalAlign: "top" }, "& th": { fontSize: 11 } }}>
            <TableHead>
              <TableRow>
                <TableCell>Reached DHIS2</TableCell>
                <TableCell>Entered on tablet</TableCell>
                <TableCell>Record</TableCell>
                <TableCell>In Anchor</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {records.map((r) => (
                <TableRow key={r.event}>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>
                    <Typography variant="body2">{when(r.receivedAt)}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ whiteSpace: "nowrap" }}>
                      {when(r.capturedAt)}
                    </Typography>
                    {r.delayHours !== null && r.delayHours >= 24 ? (
                      <Chip size="small" color="warning" label={`${Math.round(r.delayHours / 24)} day(s) late`} sx={{ mt: 0.5 }} />
                    ) : null}
                    {r.by ? (
                      <Typography variant="caption" color="text.secondary" component="div" sx={{ wordBreak: "break-all" }}>
                        {r.by}
                      </Typography>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={700}>
                      {r.program}
                      {r.stage ? ` · ${r.stage}` : ""}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {r.deleted ? "Deleted · " : ""}
                      {r.visitDate ? `Visit ${dayOnly(r.visitDate)}` : r.status === "SCHEDULE" ? "Scheduled visit" : r.status}
                      {r.sachets ? ` · ${fmt(r.sachets.reported)} sachets${r.sachets.shortfall ? `, ${fmt(r.sachets.shortfall)} not in stock` : ""}` : ""}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip size="small" variant="outlined" color={ANCHOR[r.anchor]?.color || "default"} label={ANCHOR[r.anchor]?.label || r.anchor} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : null}
      {records.some((r) => r.anchor === "MISSING" || r.anchor === "OLDER") ? (
        <Typography variant="caption" color="text.secondary">
          &quot;Not in Anchor yet&quot; and &quot;Update pending&quot; clear at the next hourly sync, or now with Re-sync this site. Admissions before the program&apos;s start date are not copied.
        </Typography>
      ) : null}

      {(log.data?.runs || []).length ? (
        <>
          <Divider />
          <Typography variant="subtitle1" fontWeight={900}>
            Re-syncs of this site
          </Typography>
          {log.data.runs.map((r) => (
            <Stack key={r.id} direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <Chip size="small" color={r.status === "SUCCESS" ? "success" : r.status === "RUNNING" ? "info" : "error"} label={r.status === "SUCCESS" ? "OK" : r.status === "RUNNING" ? "Running" : "Failed"} />
              <Typography variant="body2">
                {sinceRun(r.startedAt)} · {r.direction.replace("TRACKER_SITE:", "Children ").replace("PULL_SITE", "Dispensing").replace("PUSH_SITE", "Stock")}
              </Typography>
              {r.error ? (
                <Typography variant="caption" color="error.main">
                  {explain(r.error)}
                </Typography>
              ) : null}
            </Stack>
          ))}
        </>
      ) : null}
    </Box>
  );
}

export default function Dhis2SyncStatus() {
  const { me } = useOutletContext() || {};
  const isSuperAdmin = me?.role === "SUPER_ADMIN";
  const { implementations } = useImplementationChoice(me);

  // Countries using DHIS2 (they have tracker programs); a Super Admin chooses.
  const [withDhis2, setWithDhis2] = useState(null);
  useEffect(() => {
    let alive = true;
    api
      .get("/api/dhis2-children/programs")
      .then((r) => alive && setWithDhis2([...new Set((r.data || []).map((p) => p.implementationId))]))
      .catch(() => alive && setWithDhis2([]));
    return () => {
      alive = false;
    };
  }, []);
  const countries = useMemo(() => implementations.filter((i) => (withDhis2 || []).includes(i.id)), [implementations, withDhis2]);
  const [picked, setPicked] = useState("");
  const country = countries.find((c) => c.id === picked) || countries[0] || null;
  const countryId = country?.id || "";
  const implParams = useMemo(() => (isSuperAdmin && countryId ? { implementationId: countryId } : {}), [isSuperAdmin, countryId]);
  const ready = isSuperAdmin ? !!countryId : true;

  const [limit, setLimitState] = useState(() => {
    try {
      return Number(localStorage.getItem("anchor.syncLimit")) || 7;
    } catch {
      return 7;
    }
  });
  const setLimit = (v) => {
    setLimitState(v);
    try {
      localStorage.setItem("anchor.syncLimit", String(v));
    } catch {
      /* storage unavailable */
    }
  };
  const [tab, setTab] = useState(0);
  const [show, setShow] = useState("attention");
  const [county, setCounty] = useState("");
  const [search, setSearch] = useState("");
  const [openKey, setOpenKey] = useState(null);
  const [reload, setReload] = useState(0);
  const [result, setResult] = useState({ key: null, data: null, error: "" });

  const key = JSON.stringify({ ...implParams, reload });
  useEffect(() => {
    if (!ready) return undefined;
    let alive = true;
    const k = JSON.stringify({ ...implParams, reload });
    api
      .get("/api/dhis2-sync/sites", { params: implParams })
      .then((r) => alive && setResult({ key: k, data: r.data, error: "" }))
      .catch((e) => alive && setResult({ key: k, data: null, error: e?.response?.data?.message || e.message }));
    return () => {
      alive = false;
    };
  }, [implParams, ready, reload]);
  const data = result.data;
  const loading = result.key !== key;
  const sites = useMemo(() => (data?.sites || []).map((s) => ({ ...s, status: statusOf(s, limit) })), [data, limit]);

  const counties = [...new Set(sites.map((s) => s.county).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const counts = {
    ok: sites.filter((s) => s.status === "ok").length,
    late: sites.filter((s) => s.status === "late").length,
    stale: sites.filter((s) => s.status === "stale").length,
    never: sites.filter((s) => s.status === "never").length,
    problems: sites.filter((s) => s.problems.length).length,
  };
  const needsAttention = (s) => s.status === "stale" || s.status === "never" || s.problems.length > 0;
  const term = search.trim().toLowerCase();
  const shown = sites
    .filter((s) => (show === "all" ? true : show === "attention" ? needsAttention(s) : show === "problems" ? s.problems.length > 0 : s.status === show))
    .filter((s) => !county || s.county === county)
    .filter((s) => !term || `${s.name} ${s.payam || ""} ${s.facility?.name || ""}`.toLowerCase().includes(term))
    .sort((a, b) => (b.daysSince ?? 1e6) - (a.daysSince ?? 1e6) || a.name.localeCompare(b.name));
  const open = sites.find((s) => s.orgUnitUid === openKey) || null;

  const pull = (data?.latestRuns || []).find((r) => r.direction === "PULL");
  const failed = (data?.latestRuns || []).filter((r) => r.status === "FAILED");

  return (
    <Box sx={{ display: "grid", gap: 2.5, gridTemplateColumns: "minmax(0, 1fr)" }}>
      <Card>
        <CardContent sx={{ display: "grid", gap: 2 }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} justifyContent="space-between" alignItems={{ xs: "stretch", md: "center" }}>
            <Box>
              <Typography variant="h5" fontWeight={900}>
                DHIS2 sync
              </Typography>
              <Typography variant="body2" color="text.secondary">
                When each site&apos;s records last reached DHIS2, what is stopping them, and a re-sync per site. Click a site for its sync log.
              </Typography>
            </Box>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              {isSuperAdmin && countries.length > 1 ? (
                <FormControl size="small" sx={{ minWidth: 180 }}>
                  <InputLabel>Country</InputLabel>
                  <Select label="Country" value={country?.id || ""} onChange={(e) => setPicked(e.target.value)}>
                    {countries.map((c) => (
                      <MenuItem key={c.id} value={c.id}>
                        {c.country?.name || c.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              ) : null}
              <FormControl size="small" sx={{ minWidth: 220 }}>
                <InputLabel>Not synced means no data for</InputLabel>
                <Select label="Not synced means no data for" value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
                  {THRESHOLDS.map((d) => (
                    <MenuItem key={d} value={d}>
                      more than {d} days
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
          </Stack>
          {failed.length ? (
            <Alert severity="warning">
              {failed.map((r) => (
                <div key={r.id}>
                  <b>{r.direction.replace("TRACKER:", "Children ").replace("PULL", "Dispensing from DHIS2").replace("PUSH", "Stock to DHIS2")}</b> failed at {sinceRun(r.startedAt)}: {explain(r.error)}
                </div>
              ))}
            </Alert>
          ) : null}
          {isSuperAdmin && withDhis2 && !countries.length ? <Alert severity="info">No country uses DHIS2 programs yet.</Alert> : null}
          {result.error ? <Alert severity="error">{result.error}</Alert> : null}
        </CardContent>
      </Card>

      <Box sx={{ display: "grid", gap: { xs: 1.5, sm: 2 }, gridTemplateColumns: { xs: "repeat(2, minmax(0,1fr))", md: "repeat(6, minmax(0,1fr))" } }}>
        {[
          ["ok", `Data in the last ${RECENT_DAYS} days`, counts.ok, "success.main"],
          ["late", `Late (${RECENT_DAYS + 1}–${limit} days)`, counts.late, "warning.main"],
          ["stale", `Not synced (> ${limit} days)`, counts.stale, "error.main"],
          ["never", "Never sent data", counts.never, "text.primary"],
          ["problems", "Sites with problems", counts.problems, counts.problems ? "error.main" : "text.primary"],
        ].map(([k, label, value, color]) => (
          <Card key={k} onClick={() => setShow(k)} sx={{ cursor: "pointer", opacity: loading ? 0.6 : 1, outline: show === k ? "2px solid" : "none", outlineColor: "primary.main" }}>
            <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
              <Typography variant="caption" color="text.secondary" fontWeight={800}>
                {label}
              </Typography>
              <Typography variant="h5" fontWeight={900} sx={{ color }}>
                {fmt(value)}
              </Typography>
            </CardContent>
          </Card>
        ))}
        <Card sx={{ opacity: loading ? 0.6 : 1 }}>
          <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
            <Typography variant="caption" color="text.secondary" fontWeight={800}>
              Anchor last read DHIS2
            </Typography>
            <Typography variant="body1" fontWeight={900} sx={{ color: pull?.status === "FAILED" ? "error.main" : "text.primary", mt: 0.5 }}>
              {sinceRun((data?.latestRuns || []).map((r) => r.startedAt).sort().pop())}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              every {data?.intervalMinutes || 60} min
            </Typography>
          </CardContent>
        </Card>
      </Box>

      <Card>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 1 }}>
          <Tab label={`Sites (${sites.length})`} />
          <Tab label="Anchor sync runs" />
        </Tabs>
        <Divider />
        <CardContent sx={{ display: "grid", gap: 2 }}>
          {tab === 0 ? (
            <>
              <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ xs: "stretch", md: "center" }}>
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  {[
                    ["attention", "Needs attention"],
                    ["all", "All sites"],
                    ["stale", "Not synced"],
                    ["never", "Never sent data"],
                    ["problems", "Problems"],
                  ].map(([k, l]) => (
                    <Chip key={k} label={l} color={show === k ? "primary" : "default"} variant={show === k ? "filled" : "outlined"} onClick={() => setShow(k)} />
                  ))}
                </Stack>
                <Box sx={{ flexGrow: 1 }} />
                <FormControl size="small" sx={{ minWidth: 180 }}>
                  <InputLabel shrink>County</InputLabel>
                  <Select label="County" notched displayEmpty value={county} onChange={(e) => setCounty(e.target.value)}>
                    <MenuItem value="">All counties</MenuItem>
                    {counties.map((c) => (
                      <MenuItem key={c} value={c}>
                        {c}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField size="small" label="Search site" value={search} onChange={(e) => setSearch(e.target.value)} />
              </Stack>
              <TableContainer>
                <Table size="small" sx={{ "&&": { minWidth: 0 }, "& th, & td": { px: { xs: 0.75, md: 1.5 } } }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Site</TableCell>
                      <TableCell>Last data in DHIS2</TableCell>
                      <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>Last visit</TableCell>
                      <TableCell align="right" sx={{ display: { xs: "none", md: "table-cell" } }}>
                        Records, 7 days
                      </TableCell>
                      <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>Problems</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {shown.map((s) => (
                      <TableRow key={s.orgUnitUid} hover sx={{ cursor: "pointer" }} onClick={() => setOpenKey(s.orgUnitUid)}>
                        <TableCell>
                          <Typography variant="body2" fontWeight={800}>
                            {s.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {[s.county, s.payam].filter(Boolean).join(" · ")}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip size="small" color={STATUS[s.status].color} label={s.status === "never" ? STATUS.never.label : ago(s.daysSince)} />
                          <Typography variant="caption" color="text.secondary" component="div" sx={{ display: { xs: "none", sm: "block" } }}>
                            {s.lastReceivedAt ? when(s.lastReceivedAt) : ""}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>{dayOnly(s.lastVisitDate)}</TableCell>
                        <TableCell align="right" sx={{ display: { xs: "none", md: "table-cell" } }}>
                          {fmt(s.recentRecords)}
                        </TableCell>
                        <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>
                          <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
                            {s.problems.map((p) => (
                              <Chip key={p.code} size="small" variant="outlined" color="error" label={PROBLEM_LABEL[p.code] || p.code} />
                            ))}
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!shown.length && !loading ? (
                      <TableRow>
                        <TableCell colSpan={5}>
                          <Typography color="text.secondary" sx={{ py: 2 }}>
                            {show === "attention" ? "Every site is sending data and nothing needs fixing." : "No sites match."}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </TableContainer>
              <Typography variant="caption" color="text.secondary">
                &quot;Last data in DHIS2&quot; is the latest record from the site that reached DHIS2, as copied into Anchor every {data?.intervalMinutes || 60} minutes (DHIS2 server time). Sites
                assigned to the programs in DHIS2 that have sent nothing show as &quot;Never sent data&quot;.
              </Typography>
            </>
          ) : (
            <TableContainer>
              <Table size="small" sx={{ "&&": { minWidth: 0 } }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Sync</TableCell>
                    <TableCell>Last run</TableCell>
                    <TableCell>Result</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(data?.latestRuns || []).map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Typography variant="body2" fontWeight={800}>
                          {r.direction.startsWith("TRACKER:") ? `Children: ${r.direction.slice(8)}` : r.direction === "PULL" ? "Dispensing from DHIS2" : r.direction === "PUSH" ? "Stock to DHIS2" : r.direction}
                        </Typography>
                      </TableCell>
                      <TableCell>{sinceRun(r.startedAt)}</TableCell>
                      <TableCell>
                        <Chip size="small" color={r.status === "SUCCESS" ? "success" : r.status === "RUNNING" ? "info" : r.status === "PARTIAL" ? "warning" : "error"} label={r.status === "SUCCESS" ? "OK" : r.status.toLowerCase()} />
                        {r.error ? (
                          <Typography variant="caption" component="div" color="text.secondary" sx={{ mt: 0.5 }}>
                            {explain(r.error)}
                          </Typography>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      <Drawer anchor="right" open={!!open} onClose={() => setOpenKey(null)}>
        {open ? <SiteDrawer key={open.orgUnitUid} site={open} limit={limit} implParams={implParams} onClose={() => setOpenKey(null)} onChanged={() => setReload((x) => x + 1)} /> : null}
      </Drawer>
    </Box>
  );
}
