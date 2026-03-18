import React, { useEffect, useState, useCallback } from "react";
import { api } from "../api/client";
import { Link as RouterLink } from "react-router-dom";
import {
  Card,
  CardContent,
  Typography,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TextField,
  Link,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TablePagination,
  Stack,
  Button,
} from "@mui/material";

export default function Children() {
  const [data, setData] = useState({ rows: [], total: 0, take: 10, skip: 0 });
  const [facilities, setFacilities] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const [q, setQ] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [facilityId, setFacilityId] = useState("");

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const loadFacilities = useCallback(async () => {
    try {
      const res = await api.get("/api/facilities?type=FACILITY");
      setFacilities(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error("Failed to load facilities", e);
    }
  }, []);

  const loadChildren = useCallback(async () => {
    try {
      setLoading(true);
      setErr("");

      const skip = page * rowsPerPage;

      const params = new URLSearchParams();
      params.set("take", String(rowsPerPage));
      params.set("skip", String(skip));

      if (q) params.set("q", q);
      if (facilityId) params.set("facilityId", facilityId);

      const res = await api.get(`/api/dashboard/children?${params.toString()}`);
      setData(res.data || { rows: [], total: 0, take: rowsPerPage, skip });
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || "Failed to load children");
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, q, facilityId]);

  useEffect(() => {
    loadFacilities();
  }, [loadFacilities]);

  useEffect(() => {
    loadChildren();
  }, [loadChildren]);

  const handleSearch = () => {
    setPage(0);
    setQ(searchInput.trim());
  };

  const handleFacilityChange = (e) => {
    setFacilityId(e.target.value);
    setPage(0);
  };

  const handleChangePage = (_, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (e) => {
    const value = parseInt(e.target.value, 10);
    setRowsPerPage(value);
    setPage(0);
  };

  return (
    <Card sx={{ borderRadius: 4 }}>
      <CardContent>
        <Stack
          direction={{ xs: "column", md: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "stretch", md: "center" }}
          spacing={2}
        >
          <Typography variant="h6" fontWeight={800}>
            Children (Anonymized)
          </Typography>

          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            sx={{ width: { xs: "100%", md: "auto" } }}
          >
            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel id="facility-filter-label">Facility</InputLabel>
              <Select
                labelId="facility-filter-label"
                label="Facility"
                value={facilityId}
                onChange={handleFacilityChange}
              >
                <MenuItem value="">All Facilities</MenuItem>
                {facilities.map((f) => (
                  <MenuItem key={f.id} value={f.id}>
                    {f.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              size="small"
              label="Search Reg # / CWC"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSearch();
              }}
            />

            <Button variant="contained" onClick={handleSearch}>
              Search
            </Button>
          </Stack>
        </Stack>

        {err ? (
          <Typography color="error" sx={{ mt: 2 }}>
            Error: {err}
          </Typography>
        ) : null}

        {loading ? (
          <Typography sx={{ mt: 2 }}>Loading...</Typography>
        ) : (
          <>
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
                {(data.rows || []).map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Link component={RouterLink} to={`/children/${c.id}`}>
                        {c.uniqueChildNumber || c.cwcNumber || "-"}
                      </Link>
                    </TableCell>
                    <TableCell>{c.facility?.name || "-"}</TableCell>
                    <TableCell>
                      <Chip size="small" label={c.sex || "-"} />
                    </TableCell>
                    <TableCell>
                      {c.enrollmentDate
                        ? new Date(c.enrollmentDate).toISOString().slice(0, 10)
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <Link component={RouterLink} to={`/children/${c.id}`}>
                        View
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}

                {(!data.rows || data.rows.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={5}>No children found.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            <TablePagination
              component="div"
              count={data.total || 0}
              page={page}
              onPageChange={handleChangePage}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              rowsPerPageOptions={[10, 25, 50]}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}