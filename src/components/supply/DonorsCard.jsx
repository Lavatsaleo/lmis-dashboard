import React, { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  CardContent,
  Chip,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";

import { api } from "../../api/client";

/**
 * Donors (funding sources) for one implementation. Purchase order lines and
 * boxes point to these, so stock and value can be reported per donor.
 */
export default function DonorsCard({ implementationId, canEdit }) {
  const [rows, setRows] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [reload, setReload] = useState(0);
  const q = implementationId ? `&implementationId=${encodeURIComponent(implementationId)}` : "";

  useEffect(() => {
    let mounted = true;
    api
      .get(`/api/donors?includeInactive=true${q}`)
      .then((res) => mounted && setRows(res.data || []))
      .catch((e) => mounted && setErr(e?.response?.data?.message || e.message));
    return () => {
      mounted = false;
    };
  }, [q, reload]);

  const run = async (fn) => {
    setErr("");
    try {
      await fn();
      setReload((r) => r + 1);
    } catch (e) {
      setErr(e?.response?.data?.message || e.message);
    }
  };

  return (
    <Card sx={{ borderRadius: 4 }}>
      <CardContent sx={{ display: "grid", gap: 2 }}>
        <div>
          <Typography variant="h6" fontWeight={900}>
            Donors
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Funding sources used on purchase order lines. Every box carries its donor, so warehouse stock and value can be reported per donor.
          </Typography>
        </div>
        {err ? <Alert severity="error">{err}</Alert> : null}
        {canEdit ? (
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <TextField size="small" label="New donor name" value={name} onChange={(e) => setName(e.target.value)} sx={{ minWidth: 260 }} />
            <Button
              variant="contained"
              disabled={name.trim().length < 2}
              onClick={() =>
                run(async () => {
                  await api.post("/api/donors", { name: name.trim(), implementationId });
                  setName("");
                })
              }
            >
              Add donor
            </Button>
          </Stack>
        ) : null}
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Code</TableCell>
                <TableCell align="right">PO lines</TableCell>
                <TableCell align="right">Boxes</TableCell>
                <TableCell align="center">Active</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((d) => {
                const draft = drafts[d.id] || { name: d.name, code: d.code || "" };
                const changed = draft.name !== d.name || draft.code !== (d.code || "");
                return (
                  <TableRow key={d.id} sx={{ opacity: d.isActive ? 1 : 0.55 }}>
                    <TableCell>
                      {canEdit ? (
                        <TextField size="small" value={draft.name} onChange={(e) => setDrafts((x) => ({ ...x, [d.id]: { ...draft, name: e.target.value } }))} />
                      ) : (
                        d.name
                      )}
                    </TableCell>
                    <TableCell>
                      {canEdit ? (
                        <TextField size="small" value={draft.code} placeholder="optional" onChange={(e) => setDrafts((x) => ({ ...x, [d.id]: { ...draft, code: e.target.value } }))} sx={{ maxWidth: 140 }} />
                      ) : (
                        d.code || "—"
                      )}
                    </TableCell>
                    <TableCell align="right">{d._count?.purchaseOrderLines ?? 0}</TableCell>
                    <TableCell align="right">{(d._count?.boxes ?? 0).toLocaleString()}</TableCell>
                    <TableCell align="center">
                      <Switch
                        checked={d.isActive}
                        disabled={!canEdit}
                        onChange={() => run(() => api.patch(`/api/donors/${d.id}`, { isActive: !d.isActive }))}
                      />
                    </TableCell>
                    <TableCell align="right">
                      {canEdit && changed ? (
                        <Button
                          size="small"
                          onClick={() =>
                            run(async () => {
                              await api.patch(`/api/donors/${d.id}`, draft);
                              setDrafts((x) => {
                                const next = { ...x };
                                delete next[d.id];
                                return next;
                              });
                            })
                          }
                        >
                          Save
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
              {!rows.length ? (
                <TableRow>
                  <TableCell colSpan={6}>
                    <Chip size="small" label="No donors yet" />
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );
}
