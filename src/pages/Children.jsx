import React, { useEffect, useState, useCallback } from "react";
import { api } from "../api/client";
import { Link as RouterLink } from "react-router-dom";
import {
  Card,
  CardContent,
  Typography,
  Table,
  TableContainer,
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
  Alert,
} from "@mui/material";

const EXPORT_PAGE_SIZE = 200;

const formatDate = (value) => {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
};

const xmlEscape = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function downloadExcelXml({ filename, sheetName, headers, rows }) {
  const headerXml = headers
    .map((h) => `<Cell><Data ss:Type="String">${xmlEscape(h)}</Data></Cell>`)
    .join("");

  const rowXml = rows
    .map((row) => {
      const cells = headers
        .map((h) => `<Cell><Data ss:Type="String">${xmlEscape(row[h])}</Data></Cell>`)
        .join("");
      return `<Row>${cells}</Row>`;
    })
    .join("");

  const workbook = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:html="http://www.w3.org/TR/REC-html40">
  <Worksheet ss:Name="${xmlEscape(sheetName).slice(0, 31) || "Children"}">
    <Table>
      <Row>${headerXml}</Row>
      ${rowXml}
    </Table>
  </Worksheet>
</Workbook>`;

  const blob = new Blob([workbook], {
    type: "application/vnd.ms-excel;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function Children() {
  const [data, setData] = useState({ rows: [], total: 0, take: 10, skip: 0 });
  const [facilities, setFacilities] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

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

  const buildChildParams = useCallback(
    ({ take, skip }) => {
      const params = new URLSearchParams();
      params.set("take", String(take));
      params.set("skip", String(skip));

      if (q) params.set("q", q);
      if (facilityId) params.set("facilityId", facilityId);

      return params;
    },
    [q, facilityId]
  );

  const loadChildren = useCallback(async () => {
    try {
      setLoading(true);
      setErr("");

      const skip = page * rowsPerPage;
      const params = buildChildParams({ take: rowsPerPage, skip });

      const res = await api.get(`/api/dashboard/children?${params.toString()}`);
      setData(res.data || { rows: [], total: 0, take: rowsPerPage, skip });
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || "Failed to load children");
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, buildChildParams]);

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

  const handleExport = async () => {
    try {
      setExporting(true);
      setErr("");

      let skip = 0;
      let total = null;
      const allRows = [];

      while (total === null || skip < total) {
        const params = buildChildParams({ take: EXPORT_PAGE_SIZE, skip });
        const res = await api.get(`/api/dashboard/children?${params.toString()}`);
        const body = res.data || {};
        const rows = Array.isArray(body.rows) ? body.rows : [];
        total = Number(body.total || 0);
        allRows.push(...rows);

        if (!rows.length) break;
        skip += rows.length;
      }

      if (!allRows.length) {
        setErr("There are no children to export for the selected filters.");
        return;
      }

      const selectedFacilityName = facilityId
        ? facilities.find((f) => f.id === facilityId)?.name || "Selected facility"
        : "All facilities";

      const headers = [
        "Registration Number",
        "CWC Number",
        "Facility Code",
        "Facility Name",
        "Sex",
        "Date of Birth",
        "Enrollment Date",
      ];

      const rows = allRows.map((c) => ({
        "Registration Number": c.uniqueChildNumber || "",
        "CWC Number": c.cwcNumber || "",
        "Facility Code": c.facility?.code || "",
        "Facility Name": c.facility?.name || "",
        Sex: c.sex || "",
        "Date of Birth": formatDate(c.dateOfBirth),
        "Enrollment Date": formatDate(c.enrollmentDate),
      }));

      const today = new Date().toISOString().slice(0, 10);
      const safeFacility = selectedFacilityName
        .replace(/[^a-z0-9]+/gi, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 50);
      const suffix = q ? `_search_${q.replace(/[^a-z0-9]+/gi, "_").slice(0, 30)}` : "";

      downloadExcelXml({
        filename: `children_export_${safeFacility || "all"}${suffix}_${today}.xls`,
        sheetName: "Children",
        headers,
        rows,
      });
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || "Failed to export children");
    } finally {
      setExporting(false);
    }
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

            <Button variant="outlined" onClick={handleExport} disabled={exporting || loading}>
              {exporting ? "Exporting..." : "Export Excel"}
            </Button>
          </Stack>
        </Stack>

        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Export uses the same search and facility filters currently applied to this page.
        </Typography>

        {err ? (
          <Alert severity="error" sx={{ mt: 2 }}>
            {err}
          </Alert>
        ) : null}

        {loading ? (
          <Typography sx={{ mt: 2 }}>Loading...</Typography>
        ) : (
          <>
            <TableContainer>
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
            </TableContainer>

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
