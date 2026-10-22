import React, { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import dayjs from "dayjs";
import {
  Alert,
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

import { api } from "../api/client";
import { useImplementationChoice } from "../components/implementationChoice";

// DHIS2 times are the DHIS2 server's own clock (no zone): show them as they are.
const when = (s) => (s ? dayjs(String(s).slice(0, 19)).format("D MMM YYYY, HH:mm") : "—");
const dayOnly = (s) => (s ? dayjs(String(s).slice(0, 10)).format("D MMM YYYY") : "—");
const ago = (days) => (days === null || days === undefined ? "never" : days === 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`);
const fmt = (n) => new Intl.NumberFormat().format(Number(n || 0));
const wait = (h) => (h === null || h === undefined ? "—" : h < 1 ? "under 1 hour" : h < 24 ? `${Math.round(h)} h` : `${Math.round(h / 24)} day${Math.round(h / 24) === 1 ? "" : "s"}`);
const share = (w) => (w.records ? Math.round((w.late / w.records) * 100) : 0);

const QUIET_DAYS = [3, 7, 14, 30];
// A site struggles when a quarter of its records (at least 3) reach DHIS2 a day
// or more after entry, or one waited 3 days or more.
const struggling = (w) => (w.late >= 3 && share(w) >= 25) || (w.maxDelayHours ?? 0) >= 72;

/** quiet | never | clock | struggling | ok */
function statusOf(s, quietDays) {
  if (s.daysSince === null) return "never";
  if (s.daysSince > quietDays) return "quiet";
  if (s.window.clockAhead) return "clock";
  if (struggling(s.window)) return "struggling";
  return "ok";
}
const STATUS = {
  ok: { label: "Syncing well", color: "success" },
  struggling: { label: "Records arrive late", color: "warning" },
  clock: { label: "Tablet clock wrong", color: "warning" },
  quiet: { label: "No data", color: "error" },
  never: { label: "Never sent data", color: "default" },
};

function Advice({ title, severity = "warning", children }) {
  return (
    <Alert severity={severity} sx={{ "& .MuiAlert-message": { width: "100%" } }}>
      <Typography variant="body2" fontWeight={800}>
        {title}
      </Typography>
      <Box sx={{ mt: 0.5, display: "grid", gap: 0.75 }}>{children}</Box>
    </Alert>
  );
}

function TabletTable({ rows, showSites }) {
  return (
    <TableContainer>
      <Table size="small" sx={{ "&&": { minWidth: 0 }, "& th, & td": { px: { xs: 0.75, md: 1.25 }, verticalAlign: "top" }, "& th": { fontSize: 11 } }}>
        <TableHead>
          <TableRow>
            <TableCell>User (tablet)</TableCell>
            <TableCell>Last sync</TableCell>
            <TableCell align="right">Records</TableCell>
            <TableCell align="right">Arrived late</TableCell>
            <TableCell align="right" sx={{ display: { xs: "none", sm: "table-cell" } }}>
              Longest wait
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((t) => (
            <TableRow key={t.username}>
              <TableCell>
                <Typography variant="body2" fontWeight={800} sx={{ wordBreak: "break-all" }}>
                  {t.username}
                </Typography>
                {showSites ? (
                  <Typography variant="caption" color="text.secondary">
                    {t.sites.join(", ")}
                  </Typography>
                ) : null}
                {t.clockAhead ? <Chip size="small" color="warning" label="Clock wrong" sx={{ mt: 0.5, display: "flex", width: "fit-content" }} /> : null}
              </TableCell>
              <TableCell sx={{ whiteSpace: "nowrap" }}>{when(t.lastArrival)}</TableCell>
              <TableCell align="right">{fmt(t.records)}</TableCell>
              <TableCell align="right">
                <Typography variant="body2" fontWeight={800} color={struggling(t) ? "warning.dark" : "text.primary"}>
                  {fmt(t.late)} ({share(t)}%)
                </Typography>
              </TableCell>
              <TableCell align="right" sx={{ display: { xs: "none", sm: "table-cell" } }}>
                {wait(t.maxDelayHours)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function SiteDrawer({ site, quietDays, days, implParams, onClose }) {
  const [log, setLog] = useState({ key: null, data: null, error: "" });
  const [tick, setTick] = useState(0);
  const logKey = `${site.orgUnitUid}|${tick}`;
  const loading = log.key !== logKey;
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
  const status = statusOf(site, quietDays);
  const w = site.window;
  const records = log.data?.records || [];

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
          ["Last data reached DHIS2", ago(site.daysSince)],
          [`Arrived late (${days} days)`, `${fmt(w.late)} of ${fmt(w.records)}`],
          ["Typical / longest wait", `${wait(w.medianDelayHours)} / ${wait(w.maxDelayHours)}`],
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

      <Typography variant="subtitle1" fontWeight={900}>
        What to check
      </Typography>
      {status === "quiet" || status === "never" ? (
        <Advice severity="error" title={status === "never" ? "No records from this site have ever reached DHIS2" : `Nothing from this site has reached DHIS2 for ${site.daysSince} days`}>
          <Typography variant="body2">
            Call the site. On the tablet: check there is internet (data bundle or Wi-Fi), open the DHIS2 Capture app and tap <b>Sync</b>.
          </Typography>
          <Typography variant="body2">
            If it still fails, a red sync icon shows next to the program: open the app&apos;s <b>Settings → Sync data</b> and its error log, and send a photo of the message to support.
          </Typography>
          {status === "never" ? <Typography variant="body2">If the site has started, check its staff have DHIS2 accounts assigned to this site and to the program.</Typography> : null}
        </Advice>
      ) : null}
      {w.clockAhead ? (
        <Advice title={`The tablet's date or time is wrong (${fmt(w.clockAhead)} record(s) dated in the future)`}>
          <Typography variant="body2">
            On the tablet open Settings → Date &amp; time and switch on <b>automatic date and time</b> (and the right time zone). A wrong clock puts wrong dates on records and can stop the sync.
          </Typography>
        </Advice>
      ) : null}
      {status !== "quiet" && status !== "never" && struggling(w) ? (
        <Advice title={`${fmt(w.late)} of ${fmt(w.records)} records reached DHIS2 a day or more after they were entered`}>
          <Typography variant="body2">
            Records wait on the tablet before they reach the server (typically {wait(w.medianDelayHours)}, up to {wait(w.maxDelayHours)}). The tablet is offline most of the time or is not synced
            daily.
          </Typography>
          <Typography variant="body2">Ask the site to sync at least once a day where there is signal, and check the tablet has data credit. The users below show which tablet is behind.</Typography>
        </Advice>
      ) : null}
      {status === "ok" ? <Alert severity="success">This site&apos;s records are reaching DHIS2 soon after they are entered.</Alert> : null}

      {site.tablets.length ? (
        <>
          <Typography variant="subtitle1" fontWeight={900}>
            Tablets at this site (last {days} days)
          </Typography>
          <TabletTable rows={site.tablets} />
        </>
      ) : null}

      <Divider />
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="subtitle1" fontWeight={900}>
          Sync log: latest records from this site
        </Typography>
        <Button size="small" onClick={() => setTick((t) => t + 1)} disabled={loading}>
          Refresh
        </Button>
      </Stack>
      <Typography variant="caption" color="text.secondary" sx={{ mt: -1.5 }}>
        Read live from DHIS2. &quot;Entered on tablet&quot; is when the record was saved on the tablet; &quot;Reached DHIS2&quot; is when the sync delivered it. Records still on the tablet do not show
        until they sync.
      </Typography>
      {loading ? (
        <Stack direction="row" spacing={1} alignItems="center">
          <CircularProgress size={18} />
          <Typography variant="body2">Reading from DHIS2…</Typography>
        </Stack>
      ) : null}
      {log.error ? <Alert severity="error">{log.error}</Alert> : null}
      {log.data && !records.length ? <Typography color="text.secondary">DHIS2 has no records from this site in these programs.</Typography> : null}
      {records.length ? (
        <TableContainer>
          <Table size="small" sx={{ "&&": { minWidth: 0 }, "& th, & td": { px: { xs: 0.75, md: 1.25 }, verticalAlign: "top" }, "& th": { fontSize: 11 } }}>
            <TableHead>
              <TableRow>
                <TableCell>Entered on tablet</TableCell>
                <TableCell>Reached DHIS2</TableCell>
                <TableCell>Record</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {records.map((r) => (
                <TableRow key={r.event}>
                  <TableCell>
                    <Typography variant="body2" sx={{ whiteSpace: "nowrap" }}>
                      {when(r.enteredAt)}
                    </Typography>
                    {r.by ? (
                      <Typography variant="caption" color="text.secondary" component="div" sx={{ wordBreak: "break-all" }}>
                        {r.by}
                      </Typography>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ whiteSpace: "nowrap" }}>
                      {when(r.receivedAt)}
                    </Typography>
                    {r.clockAhead ? (
                      <Chip size="small" color="warning" label="Tablet clock ahead" sx={{ mt: 0.5 }} />
                    ) : r.delayHours !== null && r.delayHours >= 24 ? (
                      <Chip size="small" color="warning" label={`${wait(r.delayHours)} later`} sx={{ mt: 0.5 }} />
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
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
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
  const ready = isSuperAdmin ? !!countryId : true;

  const [quietDays, setQuietState] = useState(() => {
    try {
      return Number(localStorage.getItem("anchor.syncQuietDays")) || 7;
    } catch {
      return 7;
    }
  });
  const setQuietDays = (v) => {
    setQuietState(v);
    try {
      localStorage.setItem("anchor.syncQuietDays", String(v));
    } catch {
      /* storage unavailable */
    }
  };
  const [days, setDays] = useState(30);
  const implParams = useMemo(() => (isSuperAdmin && countryId ? { implementationId: countryId } : {}), [isSuperAdmin, countryId]);
  const params = useMemo(() => ({ ...implParams, days }), [implParams, days]);
  const [tab, setTab] = useState(0);
  const [show, setShow] = useState("attention");
  const [county, setCounty] = useState("");
  const [search, setSearch] = useState("");
  const [openKey, setOpenKey] = useState(null);
  const [result, setResult] = useState({ key: null, data: null, error: "" });

  const key = JSON.stringify(params);
  useEffect(() => {
    if (!ready) return undefined;
    let alive = true;
    const k = JSON.stringify(params);
    api
      .get("/api/dhis2-sync/sites", { params })
      .then((r) => alive && setResult({ key: k, data: r.data, error: "" }))
      .catch((e) => alive && setResult({ key: k, data: null, error: e?.response?.data?.message || e.message }));
    return () => {
      alive = false;
    };
  }, [params, ready]);
  const data = result.data;
  const loading = result.key !== key;
  const sites = useMemo(() => (data?.sites || []).map((s) => ({ ...s, status: statusOf(s, quietDays) })), [data, quietDays]);

  const counties = [...new Set(sites.map((s) => s.county).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const count = (k) => sites.filter((s) => s.status === k).length;
  const attention = (s) => s.status !== "ok";
  const term = search.trim().toLowerCase();
  const rank = { quiet: 0, struggling: 1, clock: 2, never: 3, ok: 4 };
  const shown = sites
    .filter((s) => (show === "all" ? true : show === "attention" ? attention(s) : s.status === show))
    .filter((s) => !county || s.county === county)
    .filter((s) => !term || `${s.name} ${s.payam || ""} ${s.tablets.map((t) => t.username).join(" ")}`.toLowerCase().includes(term))
    .sort((a, b) => rank[a.status] - rank[b.status] || (b.daysSince ?? -1) - (a.daysSince ?? -1) || share(b.window) - share(a.window) || a.name.localeCompare(b.name));
  const tablets = (data?.tablets || []).filter((t) => !term || `${t.username} ${t.sites.join(" ")}`.toLowerCase().includes(term));
  const open = sites.find((s) => s.orgUnitUid === openKey) || null;

  return (
    <Box sx={{ display: "grid", gap: 2.5, gridTemplateColumns: "minmax(0, 1fr)" }}>
      <Card>
        <CardContent sx={{ display: "grid", gap: 2 }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} justifyContent="space-between" alignItems={{ xs: "stretch", md: "center" }}>
            <Box>
              <Typography variant="h5" fontWeight={900}>
                Tablet sync
              </Typography>
              <Typography variant="body2" color="text.secondary">
                How records from the DHIS2 Capture app on each site&apos;s tablets are reaching the DHIS2 server: sites that have gone quiet, records that wait days on a tablet, tablets with a
                wrong clock. Click a site for its sync log.
              </Typography>
            </Box>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              {isSuperAdmin && countries.length > 1 ? (
                <FormControl size="small" sx={{ minWidth: 170 }}>
                  <InputLabel>Country</InputLabel>
                  <Select label="Country" value={countryId} onChange={(e) => setPicked(e.target.value)}>
                    {countries.map((c) => (
                      <MenuItem key={c.id} value={c.id}>
                        {c.country?.name || c.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              ) : null}
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Look back</InputLabel>
                <Select label="Look back" value={days} onChange={(e) => setDays(Number(e.target.value))}>
                  {[14, 30, 60, 90].map((d) => (
                    <MenuItem key={d} value={d}>
                      {d} days
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 190 }}>
                <InputLabel>&quot;No data&quot; after</InputLabel>
                <Select label='"No data" after' value={quietDays} onChange={(e) => setQuietDays(Number(e.target.value))}>
                  {QUIET_DAYS.map((d) => (
                    <MenuItem key={d} value={d}>
                      {d} days without records
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
          </Stack>
          {data?.liveError ? <Alert severity="warning">Could not read the latest records from DHIS2 ({data.liveError}). Showing the last data Anchor has copied.</Alert> : null}
          {isSuperAdmin && withDhis2 && !countries.length ? <Alert severity="info">No country uses DHIS2 programs yet.</Alert> : null}
          {result.error ? <Alert severity="error">{result.error}</Alert> : null}
        </CardContent>
      </Card>

      <Box sx={{ display: "grid", gap: { xs: 1.5, sm: 2 }, gridTemplateColumns: { xs: "repeat(2, minmax(0,1fr))", md: "repeat(5, minmax(0,1fr))" } }}>
        {[
          ["ok", "Syncing well", "success.main"],
          ["struggling", "Records arrive late", "warning.dark"],
          ["quiet", `No data for > ${quietDays} days`, "error.main"],
          ["clock", "Tablet clock wrong", "warning.dark"],
          ["never", "Never sent data", "text.primary"],
        ].map(([k, label, color]) => (
          <Card
            key={k}
            onClick={() => {
              setShow(k);
              setTab(0);
            }}
            sx={{ cursor: "pointer", opacity: loading ? 0.6 : 1, outline: show === k ? "2px solid" : "none", outlineColor: "primary.main" }}
          >
            <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
              <Typography variant="caption" color="text.secondary" fontWeight={800}>
                {label}
              </Typography>
              <Typography variant="h5" fontWeight={900} sx={{ color }}>
                {loading && !data ? "…" : fmt(count(k))}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Box>

      <Card>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 1 }}>
          <Tab label={`Sites (${sites.length})`} />
          <Tab label={`Tablets (${(data?.tablets || []).length})`} />
        </Tabs>
        <Divider />
        <CardContent sx={{ display: "grid", gap: 2 }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ xs: "stretch", md: "center" }}>
            {tab === 0 ? (
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                {[
                  ["attention", "Needs attention"],
                  ["all", "All sites"],
                ].map(([k, l]) => (
                  <Chip key={k} label={l} color={show === k ? "primary" : "default"} variant={show === k ? "filled" : "outlined"} onClick={() => setShow(k)} />
                ))}
                {!["attention", "all"].includes(show) ? <Chip label={STATUS[show].label} color="primary" onDelete={() => setShow("attention")} /> : null}
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                One row per DHIS2 user account (normally one per tablet), most late records first.
              </Typography>
            )}
            <Box sx={{ flexGrow: 1 }} />
            {tab === 0 ? (
              <FormControl size="small" sx={{ minWidth: 170 }}>
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
            ) : null}
            <TextField size="small" label={tab === 0 ? "Search site or user" : "Search user or site"} value={search} onChange={(e) => setSearch(e.target.value)} />
          </Stack>

          {loading && !data ? (
            <Stack direction="row" spacing={1} alignItems="center">
              <CircularProgress size={18} />
              <Typography variant="body2">Reading the last {days} days of records from DHIS2…</Typography>
            </Stack>
          ) : null}

          {tab === 0 && data ? (
            <TableContainer>
              <Table size="small" sx={{ "&&": { minWidth: 0 }, "& th, & td": { px: { xs: 0.75, md: 1.5 } } }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Site</TableCell>
                    <TableCell>Last data reached DHIS2</TableCell>
                    <TableCell align="right" sx={{ display: { xs: "none", md: "table-cell" } }}>
                      Records, {days} days
                    </TableCell>
                    <TableCell align="right">Arrived late</TableCell>
                    <TableCell align="right" sx={{ display: { xs: "none", sm: "table-cell" } }}>
                      Longest wait
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {shown.map((s) => (
                    <TableRow key={s.orgUnitUid} hover sx={{ cursor: "pointer" }} onClick={() => setOpenKey(s.orgUnitUid)}>
                      <TableCell>
                        <Typography variant="body2" fontWeight={800}>
                          {s.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" component="div">
                          {[s.county, s.payam].filter(Boolean).join(" · ")}
                        </Typography>
                        <Chip size="small" variant="outlined" color={STATUS[s.status].color} label={STATUS[s.status].label} sx={{ mt: 0.5 }} />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={700} color={s.status === "quiet" ? "error.main" : "text.primary"}>
                          {ago(s.daysSince)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: { xs: "none", sm: "block" } }}>
                          {s.lastReceivedAt ? when(s.lastReceivedAt) : ""}
                        </Typography>
                      </TableCell>
                      <TableCell align="right" sx={{ display: { xs: "none", md: "table-cell" } }}>
                        {fmt(s.window.records)}
                      </TableCell>
                      <TableCell align="right">
                        {s.window.records ? (
                          <Typography variant="body2" fontWeight={800} color={struggling(s.window) ? "warning.dark" : "text.primary"}>
                            {fmt(s.window.late)} ({share(s.window)}%)
                          </Typography>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell align="right" sx={{ display: { xs: "none", sm: "table-cell" } }}>
                        {wait(s.window.maxDelayHours)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!shown.length && !loading ? (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <Typography color="text.secondary" sx={{ py: 2 }}>
                          {show === "attention" ? "Every site's records are reaching DHIS2 soon after they are entered." : "No sites match."}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </TableContainer>
          ) : null}
          {tab === 1 && data ? <TabletTable rows={tablets} showSites /> : null}

          <Typography variant="caption" color="text.secondary">
            &quot;Arrived late&quot; counts records that reached DHIS2 a day or more after they were entered on the tablet, over the last {days} days. A tablet&apos;s own sync errors stay on the
            tablet (DHIS2 does not receive them), so a struggling site is spotted by its late or missing records; its error log is in the app&apos;s settings. Times are DHIS2 server time.
          </Typography>
        </CardContent>
      </Card>

      <Drawer anchor="right" open={!!open} onClose={() => setOpenKey(null)}>
        {open ? <SiteDrawer key={open.orgUnitUid} site={open} quietDays={quietDays} days={days} implParams={implParams} onClose={() => setOpenKey(null)} /> : null}
      </Drawer>
    </Box>
  );
}
