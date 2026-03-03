import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import {
  Card, CardContent, Typography, Table, TableHead, TableRow,
  TableCell, TableBody, Box, Chip
} from "@mui/material";

export default function ChildDetails() {
  const { childId } = useParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api.get(`/api/dashboard/children/${childId}/measurements`)
      .then((res) => setData(res.data))
      .catch((e) => setErr(e?.response?.data?.message || e.message));
  }, [childId]);

  if (err) return <Typography color="error">Error: {err}</Typography>;
  if (!data) return <Typography>Loading...</Typography>;

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Card>
        <CardContent>
          <Typography variant="h6" fontWeight={900}>
            Child Registration #: {data.child.uniqueChildNumber}
          </Typography>
          <Typography color="text.secondary">
            Enrolled: {data.child.enrollmentDate ? new Date(data.child.enrollmentDate).toISOString().slice(0, 10) : "-"}
          </Typography>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" fontWeight={800} gutterBottom>Visits & Measurements</Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell align="right">Weight (kg)</TableCell>
                <TableCell align="right">Height (cm)</TableCell>
                <TableCell align="right">MUAC (mm)</TableCell>
                <TableCell align="right">WHZ</TableCell>
                <TableCell>Next Appointment</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.visits.map((v) => (
                <TableRow key={v.id}>
                  <TableCell>{v.visitDate ? new Date(v.visitDate).toISOString().slice(0, 10) : "-"}</TableCell>
                  <TableCell align="right">{v.weightKg ?? "-"}</TableCell>
                  <TableCell align="right">{v.heightCm ?? "-"}</TableCell>
                  <TableCell align="right">
                    {v.muacMm ? <Chip size="small" label={v.muacMm} /> : "-"}
                  </TableCell>
                  <TableCell align="right">{v.whzScore ?? "-"}</TableCell>
                  <TableCell>{v.nextAppointmentDate ? new Date(v.nextAppointmentDate).toISOString().slice(0, 10) : "-"}</TableCell>
                </TableRow>
              ))}
              {data.visits.length === 0 ? (
                <TableRow><TableCell colSpan={6}>No visits recorded yet.</TableCell></TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </Box>
  );
}