import { createTheme } from "@mui/material/styles";
import { alpha } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#005fb6" },   // ACF Blue
    secondary: { main: "#52ae32" }, // ACF Green
    text: {
      primary: "#111827",
      secondary: "#707070",
    },
    background: {
      default: "#f6f8fb",
      paper: "#ffffff",
    },
    divider: alpha("#707070", 0.15),
  },

  typography: {
    fontFamily: `"Inter", system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif`,
    h4: { fontWeight: 900, letterSpacing: "-0.5px" },
    h5: { fontWeight: 900, letterSpacing: "-0.3px" },
    h6: { fontWeight: 850 },
    body1: { lineHeight: 1.5 },
    body2: { lineHeight: 1.4 },
  },

  shape: { borderRadius: 14 },

  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          WebkitFontSmoothing: "antialiased",
          MozOsxFontSmoothing: "grayscale",
        },
      },
    },

    MuiCard: {
      styleOverrides: {
        root: {
          border: `1px solid ${alpha("#707070", 0.12)}`,
          boxShadow: "0 8px 24px rgba(16, 24, 40, 0.06)",
        },
      },
    },

    MuiTableCell: {
      styleOverrides: {
        head: {
          fontWeight: 900,
          color: "#111827",
          background: "#f8fafc",
        },
      },
    },

    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
        },
      },
    },

    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 800,
        },
      },
    },
  },
});