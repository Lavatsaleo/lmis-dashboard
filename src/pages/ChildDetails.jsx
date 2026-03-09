import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import {
  Card,
  CardContent,
  Typography,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Box,
  Chip,
} from "@mui/material";

const formatDate = (value) => {
  if (!value) return "-";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "-" : d.toISOString().slice(0, 10);
};

const formatValue = (value) => (value ?? "-");

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
            Enrolled: {formatDate(data.child.enrollmentDate)}
          </Typography>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" fontWeight={800} gutterBottom>
            Visits &amp; Measurements
          </Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell align="right">Weight (kg)</TableCell>
                <TableCell align="right">Height (cm)</TableCell>
                <TableCell align="right">MUAC (mm)</TableCell>
                <TableCell align="right">WHZ</TableCell>
                <TableCell align="right">Sachets Dispensed</TableCell>
                <TableCell>Next Appointment</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.visits.map((v) => (
                <TableRow key={v.id}>
                  <TableCell>{formatDate(v.visitDate)}</TableCell>
                  <TableCell align="right">{formatValue(v.weightKg)}</TableCell>
                  <TableCell align="right">{formatValue(v.heightCm)}</TableCell>
                  <TableCell align="right">
                    {v.muacMm !== null && v.muacMm !== undefined ? (
                      <Chip size="small" label={v.muacMm} />
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell align="right">{formatValue(v.whzScore)}</TableCell>
                  <TableCell align="right">{formatValue(v.sachetsDispensed)}</TableCell>
                  <TableCell>{formatDate(v.nextAppointmentDate)}</TableCell>
                </TableRow>
              ))}
              {data.visits.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7}>No visits recorded yet.</TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </Box>
  );
}
