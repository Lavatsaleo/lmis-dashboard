import React, { useEffect, useMemo, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { api, clearSessionAndRedirect } from "../api/client";
import {
  AppBar,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import MenuIcon from "@mui/icons-material/Menu";
import DashboardIcon from "@mui/icons-material/Dashboard";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import ChildCareIcon from "@mui/icons-material/ChildCare";
import StorefrontIcon from "@mui/icons-material/Storefront";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import AssignmentTurnedInIcon from "@mui/icons-material/AssignmentTurnedIn";
import AssessmentIcon from "@mui/icons-material/Assessment";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import SettingsSuggestOutlinedIcon from "@mui/icons-material/SettingsSuggestOutlined";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import LogoutIcon from "@mui/icons-material/Logout";
import HistoryIcon from "@mui/icons-material/History";
import WarehouseOutlinedIcon from "@mui/icons-material/WarehouseOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import SummarizeOutlinedIcon from "@mui/icons-material/SummarizeOutlined";
import RuleOutlinedIcon from "@mui/icons-material/RuleOutlined";
import QrCode2Icon from "@mui/icons-material/QrCode2";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import LockResetIcon from "@mui/icons-material/LockReset";
import SyncAltIcon from "@mui/icons-material/SyncAlt";
import { RequiredPasswordChange } from "../pages/ChangePassword";

import anchorMark from "../assets/anchor-mark.png";

const drawerWidth = 272;

function roleLabel(role) {
  return String(role || "").replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function DashboardLayout() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [open, setOpen] = useState(false);

  const [me, setMe] = useState(null);
  const [meLoading, setMeLoading] = useState(true);

  const loc = useLocation();

  const [meVersion, setMeVersion] = useState(0);
  const refreshMe = () => setMeVersion((v) => v + 1);

  useEffect(() => {
    let mounted = true;
    api
      .get("/api/me")
      .then((res) => {
        if (!mounted) return;
        setMe(res.data?.user || null);
      })
      .catch(() => {
        if (!mounted) return;
        setMe(null);
      })
      .finally(() => {
        if (!mounted) return;
        setMeLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [meVersion]);

  const role = me?.role;
  const platformContext = me?.platformContext || null;
  const implementationConfigured = Boolean(platformContext?.implementation?.id);
  const enabledModules = Array.isArray(platformContext?.enabledModules)
    ? platformContext.enabledModules
    : [];

  // Legacy fallback keeps the current Kenya dashboard usable during a staged
  // deployment where the frontend may briefly reach an older backend.
  const moduleEnabled = (code) =>
    !implementationConfigured || enabledModules.includes(code);
  const logisticsVisible = moduleEnabled("LOGISTICS") || moduleEnabled("PHARMACY");
  const clinicalVisible = moduleEnabled("CLINICAL");
  // Children read from DHIS2 tracker programs (South Sudan: OTP, ...).
  const trackerPrograms = platformContext?.implementation?.trackerPrograms || [];
  const dhis2ChildrenVisible = role === "SUPER_ADMIN" || trackerPrograms.length > 0;

  // Same items and rules as before, grouped for scanning.
  const navGroups = useMemo(() => {
    const groups = [{ label: null, items: [{ label: "Overview", to: "/overview", icon: <DashboardIcon /> }] }];

    if (logisticsVisible) {
      groups.push({
        label: "Logistics",
        items: [
          // Warehouse view: not for facility-only roles (they have no warehouse).
          ...(role && role !== "CLINICIAN" && role !== "FACILITY_OFFICER"
            ? [
                { label: "Warehouses", to: "/warehouses", icon: <WarehouseOutlinedIcon /> },
                { label: "Purchase Orders", to: "/purchase-orders", icon: <ReceiptLongOutlinedIcon /> },
                { label: "QR Labels", to: "/qr-labels", icon: <QrCode2Icon /> },
                { label: "Adjustments & Losses", to: "/stock-adjustments", icon: <RuleOutlinedIcon /> },
                { label: "Stock Counts", to: "/stock-counts", icon: <FactCheckOutlinedIcon /> },
                { label: "Warehouse Reports", to: "/warehouse-reports", icon: <SummarizeOutlinedIcon /> },
              ]
            : []),
          { label: "Inventory Intelligence", to: "/inventory", icon: <Inventory2OutlinedIcon /> },
          { label: "Facility Store", to: "/facility-store", icon: <StorefrontIcon /> },
          { label: "Alerts", to: "/alerts", icon: <WarningAmberIcon /> },
          { label: "Manifests", to: "/manifests", icon: <AssignmentTurnedInIcon /> },
        ],
      });
    }

    if (clinicalVisible) {
      groups.push({
        label: "Clinical",
        items: [
          { label: "Children", to: "/children", icon: <ChildCareIcon /> },
          { label: "Duplicate Review", to: "/duplicate-cases", icon: <ContentCopyOutlinedIcon /> },
          { label: "Reports", to: "/reports", icon: <AssessmentIcon /> },
          ...(dhis2ChildrenVisible ? [{ label: "Children (DHIS2)", to: "/dhis2-children", icon: <ChildCareIcon /> }] : []),
        ],
      });
    } else if (dhis2ChildrenVisible) {
      groups.push({
        label: "Clinical",
        items: [{ label: "Children", to: "/dhis2-children", icon: <ChildCareIcon /> }],
      });
    }

    // Super Admins administer every country; Country Admins only their own
    // (the API enforces that, these pages just follow).
    if (role === "SUPER_ADMIN" || role === "COUNTRY_ADMIN") {
      const admin = [];
      if (logisticsVisible) {
        admin.push({ label: "Supply Configuration", to: "/supply-configuration", icon: <SettingsSuggestOutlinedIcon /> });
      }
      admin.push({ label: "Users", to: "/users", icon: <PeopleAltIcon /> });
      admin.push({ label: "Audit Log", to: "/audit-log", icon: <HistoryIcon /> });
      // DHIS2 connection and settings: Super Admin only.
      if (role === "SUPER_ADMIN") {
        admin.push({ label: "DHIS2 Integration", to: "/dhis2", icon: <SyncAltIcon /> });
      }
      groups.push({ label: "Administration", items: admin });
    }

    return groups;
  }, [role, logisticsVisible, clinicalVisible, dhis2ChildrenVisible]);

  const nav = navGroups.flatMap((g) => g.items);
  const isActive = (to) => loc.pathname === to || loc.pathname.startsWith(to + "/");

  const pageTitle =
    loc.pathname === "/users/new"
      ? "Add User"
      : loc.pathname.startsWith("/warehouses/")
      ? "Warehouse"
      : loc.pathname === "/purchase-orders/new"
      ? "New purchase order"
      : loc.pathname.startsWith("/purchase-orders/")
      ? "Purchase order"
      : loc.pathname.startsWith("/stock-counts/")
      ? "Stock count"
      : loc.pathname === "/account/password"
      ? "Change password"
      : nav.find((n) => isActive(n.to))?.label || "Anchor";

  const contextLabel = [platformContext?.country?.name, platformContext?.implementation?.name]
    .filter(Boolean)
    .join(" • ");

  const logout = () => {
    clearSessionAndRedirect();
  };

  const brandBlock = (
    <Box sx={{ px: 2.5, pt: 2.5, pb: 2, display: "flex", alignItems: "center", gap: 1.5 }}>
      <Box component="img" src={anchorMark} alt="" sx={{ width: 40, height: 40, objectFit: "contain", flexShrink: 0 }} />
      <Box sx={{ minWidth: 0 }}>
        <Typography
          sx={{ fontFamily: theme.typography.h1.fontFamily, fontWeight: 800, fontSize: 22, letterSpacing: "1.5px", lineHeight: 1, color: "primary.main" }}
        >
          ANCHOR
        </Typography>
        {contextLabel ? (
          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block", mt: 0.5 }} title={contextLabel}>
            {contextLabel}
          </Typography>
        ) : null}
      </Box>
    </Box>
  );

  const DrawerContent = (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {brandBlock}
      <Divider />

      <Box component="nav" aria-label="Main navigation" sx={{ flexGrow: 1, overflowY: "auto", px: 1.5, py: 1 }}>
        {navGroups.map((group, gi) => (
          <List
            key={group.label || `group-${gi}`}
            dense
            disablePadding
            subheader={
              group.label ? (
                <ListSubheader
                  disableSticky
                  sx={{ bgcolor: "transparent", lineHeight: "32px", mt: 1.5, px: 1.5, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "text.secondary" }}
                >
                  {group.label}
                </ListSubheader>
              ) : null
            }
          >
            {group.items.map((n) => {
              const selected = isActive(n.to);
              return (
                <ListItemButton
                  key={n.to}
                  component={Link}
                  to={n.to}
                  onClick={() => isMobile && setOpen(false)}
                  selected={selected}
                  aria-current={selected ? "page" : undefined}
                  sx={{
                    mb: 0.25,
                    py: 1,
                    color: "text.primary",
                    "& .MuiListItemIcon-root": { color: "text.secondary", minWidth: 36 },
                    "&.Mui-selected, &.Mui-selected:hover": {
                      bgcolor: alpha(theme.palette.primary.main, 0.12),
                      color: "primary.dark",
                      "& .MuiListItemIcon-root": { color: "primary.main" },
                    },
                    "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.06) },
                  }}
                >
                  <ListItemIcon>{n.icon}</ListItemIcon>
                  <ListItemText primary={n.label} primaryTypographyProps={{ fontWeight: selected ? 700 : 500, fontSize: 14 }} />
                </ListItemButton>
              );
            })}
          </List>
        ))}
      </Box>

      <Divider />
      <Box sx={{ p: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: 1.5 }}>
          <Avatar sx={{ bgcolor: "secondary.main", width: 36, height: 36, fontSize: 15, fontWeight: 700 }}>
            {meLoading ? <CircularProgress size={16} color="inherit" /> : (me?.fullName || me?.email || "A").slice(0, 1).toUpperCase()}
          </Avatar>
          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
            <Typography fontWeight={600} fontSize={14} noWrap title={me?.fullName || me?.email || ""}>
              {meLoading ? "Loading…" : me?.fullName || me?.email || "Signed in"}
            </Typography>
            {role ? <Chip size="small" label={roleLabel(role)} sx={{ height: 20, fontSize: 11, mt: 0.25 }} /> : null}
          </Box>
        </Box>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button sx={{ flexGrow: 1 }} variant="outlined" color="secondary" startIcon={<LogoutIcon />} onClick={logout}>
            Sign out
          </Button>
          <Tooltip title="Change password">
            <IconButton
              component={Link}
              to="/account/password"
              onClick={() => isMobile && setOpen(false)}
              aria-label="Change password"
              sx={{ border: 1, borderColor: "divider", borderRadius: 2 }}
            >
              <LockResetIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", textAlign: "center", mt: 1.5 }}>
          by Action Against Hunger
        </Typography>
      </Box>
    </Box>
  );

  // An admin set this password: nothing else until the user picks their own.
  if (me?.mustChangePassword) {
    return <RequiredPasswordChange onChanged={refreshMe} />;
  }

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      {isMobile ? (
        <AppBar
          position="fixed"
          elevation={0}
          sx={{
            bgcolor: alpha("#ffffff", 0.92),
            backdropFilter: "blur(10px)",
            borderBottom: `1px solid ${theme.palette.divider}`,
            color: "text.primary",
          }}
        >
          <Toolbar sx={{ gap: 1, minHeight: { xs: 56 } }}>
            <IconButton edge="start" onClick={() => setOpen(true)} aria-label="Open navigation">
              <MenuIcon />
            </IconButton>
            {/* Brand here; each page shows its own title in its header card. */}
            <Box component="img" src={anchorMark} alt="" sx={{ width: 28, height: 28, objectFit: "contain" }} />
            <Box sx={{ minWidth: 0, flexGrow: 1 }}>
              <Typography
                sx={{ fontFamily: theme.typography.h1.fontFamily, fontWeight: 800, fontSize: 17, letterSpacing: "1.2px", lineHeight: 1.1, color: "primary.main" }}
              >
                ANCHOR
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block", lineHeight: 1.2 }}>
                {pageTitle}
              </Typography>
            </Box>
          </Toolbar>
        </AppBar>
      ) : null}

      <Drawer
        variant={isMobile ? "temporary" : "permanent"}
        open={isMobile ? open : true}
        onClose={() => setOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          width: { md: drawerWidth },
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: drawerWidth,
            maxWidth: "85vw",
            boxSizing: "border-box",
            borderRight: `1px solid ${theme.palette.divider}`,
            bgcolor: "#ffffff",
          },
        }}
      >
        {DrawerContent}
      </Drawer>

      {/* minWidth: 0 stops wide content (tables, data grids) from stretching the page. */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          width: { md: `calc(100% - ${drawerWidth}px)` },
          px: { xs: 1.5, sm: 2.5, md: 3.5 },
          pb: { xs: 3, md: 4 },
          pt: { xs: "72px", md: 3.5 },
        }}
      >
        <Box sx={{ maxWidth: 1600, mx: "auto" }}>
          <Outlet context={{ me, refreshMe }} />
        </Box>
      </Box>
    </Box>
  );
}
