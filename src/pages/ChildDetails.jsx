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
  Alert,
} from "@mui/material";

const formatDate = (value) => {
  if (!value) return "-";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "-" : d.toISOString().slice(0, 10);
};

const formatValue = (value) => (value ?? "-");

const formatWhz = (value) => {
  if (value === null || value === undefined || value === "") return "-";
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(2) : "-";
};

const renderAppointmentStatus = (status) => {
  if (!status) return "-";

  if (status === "HONOURED") {
    return <Chip size="small" color="success" label="Honoured" />;
  }

  if (status === "MISSED") {
    return <Chip size="small" color="error" label="Missed" />;
  }

  if (status === "UPCOMING") {
    return <Chip size="small" color="info" label="Upcoming" />;
  }

  return status;
};

export default function ChildDetails() {
  const { childId } = useParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api
      .get(`/api/dashboard/children/${childId}/measurements`)
      .then((res) => setData(res.data))
      .catch((e) => setErr(e?.response?.data?.message || e.message));
  }, [childId]);

  if (err) return <Typography color="error">Error: {err}</Typography>;
  if (!data) return <Typography>Loading...</Typography>;

  const appt = data.appointmentStatus;

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Card>
        <CardContent>
          <Typography variant="h6" fontWeight={900}>
            Child Registration #: {data.child.uniqueChildNumber || "-"}
          </Typography>
          <Typography color="text.secondary">
            Enrolled: {formatDate(data.child.enrollmentDate)}
          </Typography>
        </CardContent>
      </Card>

      {appt?.status === "MISSED" && (
        <Alert severity="warning">
          This child missed the latest appointment scheduled for{" "}
          <strong>{formatDate(appt.nextAppointmentDate)}</strong>. Overdue by{" "}
          <strong>{appt.daysOverdue}</strong> day(s).
        </Alert>
      )}

      {appt?.status === "UPCOMING" && (
        <Alert severity="info">
          The latest appointment is scheduled for{" "}
          <strong>{formatDate(appt.nextAppointmentDate)}</strong>.
        </Alert>
      )}

      {appt?.status === "HONOURED" && (
        <Alert severity="success">
          The latest appointment scheduled for{" "}
          <strong>{formatDate(appt.nextAppointmentDate)}</strong> was honoured.
        </Alert>
      )}

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
                <TableCell>Appointment Status</TableCell>
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
                  <TableCell align="right">{formatWhz(v.whzScore)}</TableCell>
                  <TableCell align="right">
                    {formatValue(v.sachetsDispensed)}
                  </TableCell>
                  <TableCell>{formatDate(v.nextAppointmentDate)}</TableCell>
                  <TableCell>
                    {renderAppointmentStatus(v.appointmentStatus)}
                  </TableCell>
                </TableRow>
              ))}

              {data.visits.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8}>No visits recorded yet.</TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </Box>
  );
}