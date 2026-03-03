import React, { useEffect, useMemo, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { api } from "../api/client";
import {
  Box,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Divider,
  Avatar,
  useMediaQuery,
  CircularProgress,
} from "@mui/material";
import { useTheme, alpha } from "@mui/material/styles";

import MenuIcon from "@mui/icons-material/Menu";
import DashboardIcon from "@mui/icons-material/Dashboard";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import ChildCareIcon from "@mui/icons-material/ChildCare";
import StorefrontIcon from "@mui/icons-material/Storefront";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";

import acfLogo from "../assets/acf-logo.png";

const drawerWidth = 280;

export default function DashboardLayout() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [open, setOpen] = useState(false);

  const [me, setMe] = useState(null);
  const [meLoading, setMeLoading] = useState(true);

  const loc = useLocation();

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
  }, []);

  const role = me?.role;

  const nav = useMemo(
    () => {
      const items = [
        { label: "Overview", to: "/overview", icon: <DashboardIcon /> },
        { label: "Facility Store", to: "/facility-store", icon: <StorefrontIcon /> },
        { label: "Alerts", to: "/alerts", icon: <WarningAmberIcon /> },
        { label: "Children", to: "/children", icon: <ChildCareIcon /> },
      ];

      // Super Admin only
      if (role === "SUPER_ADMIN") {
        items.push({ label: "Users", to: "/users", icon: <PeopleAltIcon /> });
      }

      return items;
    },
    [role]
  );

  const pageTitle =
    loc.pathname === "/users/new"
      ? "Add User"
      : nav.find((n) => loc.pathname === n.to || loc.pathname.startsWith(n.to + "/"))?.label || "Dashboard";

  const logout = () => {
    localStorage.removeItem("accessToken");
    window.location.href = "/";
  };

  const DrawerContent = (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Branding */}
      <Box sx={{ p: 2.2, display: "flex", alignItems: "center", gap: 1.4 }}>
        <Box
          component="img"
          src={acfLogo}
          alt="ACF"
          sx={{ width: 42, height: 42, objectFit: "contain" }}
        />
        <Box>
          <Typography fontWeight={900} lineHeight={1.1}>
            Action Against Hunger
          </Typography>
          <Typography variant="body2" color="text.secondary">
            LMIS Dashboard
          </Typography>
        </Box>
      </Box>

      <Divider />

      {/* Nav */}
      <List sx={{ px: 1.2, py: 1.2 }}>
        {nav.map((n) => {
          const selected = loc.pathname === n.to || loc.pathname.startsWith(n.to + "/");
          return (
            <ListItemButton
              key={n.to}
              component={Link}
              to={n.to}
              onClick={() => isMobile && setOpen(false)}
              selected={selected}
              sx={{
                borderRadius: 2,
                mb: 0.6,
                "&.Mui-selected": {
                  background: alpha(theme.palette.primary.main, 0.12),
                  color: theme.palette.primary.main,
                  "& .MuiListItemIcon-root": { color: theme.palette.primary.main },
                },
                "&:hover": { background: alpha(theme.palette.primary.main, 0.08) },
              }}
            >
              <ListItemIcon sx={{ minWidth: 38 }}>{n.icon}</ListItemIcon>
              <ListItemText primary={n.label} primaryTypographyProps={{ fontWeight: 800 }} />
            </ListItemButton>
          );
        })}
      </List>

      <Box sx={{ flexGrow: 1 }} />

      <Divider />

      {/* Footer */}
      <Box sx={{ p: 2, display: "flex", alignItems: "center", gap: 1.2 }}>
        <Avatar sx={{ bgcolor: theme.palette.secondary.main, fontWeight: 900 }}>
          {(me?.fullName || me?.email || "A").slice(0, 1).toUpperCase()}
        </Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Typography fontWeight={900} noWrap>
            {meLoading ? "Loading…" : me?.fullName || me?.email || "Signed in"}
          </Typography>
          <Typography variant="body2" color="text.secondary" noWrap>
            {meLoading ? "" : me?.role || ""}
          </Typography>
        </Box>
        <Box sx={{ flexGrow: 1 }} />
        <Typography
          onClick={logout}
          sx={{
            cursor: "pointer",
            fontWeight: 900,
            color: theme.palette.primary.main,
          }}
        >
          Logout
        </Typography>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: "flex" }}>
      {/* Top Bar */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          zIndex: 1201,
          background: "rgba(255,255,255,0.85)",
          backdropFilter: "blur(10px)",
          borderBottom: `1px solid ${alpha("#707070", 0.15)}`,
          color: "#111827",
        }}
      >
        <Toolbar sx={{ gap: 1.5 }}>
          {isMobile ? (
            <IconButton onClick={() => setOpen(true)}>
              <MenuIcon />
            </IconButton>
          ) : null}

          <Typography variant="h6" fontWeight={900} sx={{ flexGrow: 1 }}>
            {pageTitle}
          </Typography>

          {meLoading ? (
            <CircularProgress size={22} />
          ) : (
            <Avatar sx={{ bgcolor: theme.palette.primary.main, width: 34, height: 34, fontWeight: 900 }}>
              {(me?.fullName || me?.email || "U").slice(0, 1).toUpperCase()}
            </Avatar>
          )}
        </Toolbar>
      </AppBar>

      {/* Sidebar */}
      <Drawer
        variant={isMobile ? "temporary" : "permanent"}
        open={isMobile ? open : true}
        onClose={() => setOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: {
            width: drawerWidth,
            boxSizing: "border-box",
            borderRight: `1px solid ${alpha("#707070", 0.12)}`,
            background: "#ffffff",
          },
        }}
      >
        <Toolbar />
        {DrawerContent}
      </Drawer>

      {/* Main */}
      <Box component="main" sx={{ flexGrow: 1, p: { xs: 2, md: 3 } }}>
        <Toolbar />
        <Outlet context={{ me }} />
      </Box>
    </Box>
  );
}