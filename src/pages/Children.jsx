import React, { useEffect, useState } from "react";
import { api } from "../api/client";
import { Link as RouterLink } from "react-router-dom";
import {
  Card, CardContent, Typography, Table, TableHead, TableRow,
  TableCell, TableBody, TextField, Box, Link, Chip
} from "@mui/material";

export default function Children() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");

  const load = () => {
    setErr("");
    api.get(`/api/dashboard/children?take=50&skip=0${q ? `&q=${encodeURIComponent(q)}` : ""}`)
      .then((res) => setData(res.data))
      .catch((e) => setErr(e?.response?.data?.message || e.message));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, []);

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
          <Typography variant="h6" fontWeight={800}>Children (Anonymized)</Typography>
          <TextField
            size="small"
            label="Search Reg # / CWC"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
          />
        </Box>

        {err ? <Typography color="error" sx={{ mt: 2 }}>Error: {err}</Typography> : null}
        {!data ? <Typography sx={{ mt: 2 }}>Loading...</Typography> : null}

        {data ? (
          <Table size="small" sx={{ mt: 2 }}>
            <TableHead>
              <TableRow>
                <TableCell>Registration #</TableCell>
                <TableCell>Facility</TableCell>
                <TableCell>Sex</TableCell>
                <TableCell>Enrolled</TableCell>
                <TableCell>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.rows.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link component={RouterLink} to={`/children/${c.id}`}>
                      {c.uniqueChildNumber}
                    </Link>
                  </TableCell>
                  <TableCell>{c.facility?.name}</TableCell>
                  <TableCell>
                    <Chip size="small" label={c.sex || "-"} />
                  </TableCell>
                  <TableCell>{c.enrollmentDate ? new Date(c.enrollmentDate).toISOString().slice(0, 10) : "-"}</TableCell>
                  <TableCell>
                    <Link component={RouterLink} to={`/children/${c.id}`}>View</Link>
                  </TableCell>
                </TableRow>
              ))}
              {data.rows.length === 0 ? (
                <TableRow><TableCell colSpan={5}>No children found.</TableCell></TableRow>
              ) : null}
            </TableBody>
          </Table>
        ) : null}
      </CardContent>
    </Card>
  );
}