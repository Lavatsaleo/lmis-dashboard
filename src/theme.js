import { alpha, createTheme, responsiveFontSizes } from "@mui/material/styles";

// Anchor brand. Teal sampled from the logo artwork.
export const brand = {
  teal: "#0098B4",
  tealDark: "#00748A",
  tealLight: "#E6F6F9",
  ink: "#0F2A33", // deep teal-navy for text and the sidebar accents
  muted: "#5B6B73",
  surface: "#F4F8F9",
};

const headingFont = `"Montserrat", "Inter", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif`;
const bodyFont = `"Inter", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif`;

// shape.borderRadius is the unit for `sx={{ borderRadius: n }}` (n x 4px), so the
// existing `borderRadius: 4` on page cards renders as 16px rather than a pill.
let theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: brand.teal, dark: brand.tealDark, light: "#33ADC3", contrastText: "#ffffff" },
    secondary: { main: brand.ink, contrastText: "#ffffff" },
    success: { main: "#2E7D32" },
    warning: { main: "#E08A00" },
    error: { main: "#D32F2F" },
    info: { main: brand.teal },
    text: { primary: brand.ink, secondary: brand.muted },
    background: { default: brand.surface, paper: "#ffffff" },
    divider: alpha(brand.ink, 0.1),
  },

  shape: { borderRadius: 4 },

  typography: {
    fontFamily: bodyFont,
    h1: { fontFamily: headingFont, fontWeight: 800 },
    h2: { fontFamily: headingFont, fontWeight: 800 },
    h3: { fontFamily: headingFont, fontWeight: 800, letterSpacing: "-0.5px" },
    h4: { fontFamily: headingFont, fontWeight: 800, letterSpacing: "-0.5px" },
    h5: { fontFamily: headingFont, fontWeight: 700, letterSpacing: "-0.2px" },
    h6: { fontFamily: headingFont, fontWeight: 700, fontSize: "1.05rem" },
    subtitle1: { fontWeight: 600 },
    subtitle2: { fontWeight: 600 },
    body1: { lineHeight: 1.55 },
    body2: { lineHeight: 1.45 },
    button: { fontWeight: 600, textTransform: "none", letterSpacing: 0 },
    caption: { lineHeight: 1.4 },
  },

  components: {
    MuiCssBaseline: {
      styleOverrides: {
        html: { WebkitTextSizeAdjust: "100%" },
        body: {
          backgroundColor: brand.surface,
          WebkitFontSmoothing: "antialiased",
          MozOsxFontSmoothing: "grayscale",
        },
      },
    },

    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          border: `1px solid ${alpha(brand.ink, 0.08)}`,
          boxShadow: "0 1px 2px rgba(15, 42, 51, 0.04), 0 8px 24px rgba(15, 42, 51, 0.05)",
        },
      },
    },
    MuiCardContent: {
      styleOverrides: {
        root: ({ theme: t }) => ({
          padding: t.spacing(2),
          "&:last-child": { paddingBottom: t.spacing(2) },
          [t.breakpoints.up("sm")]: { padding: t.spacing(2.5), "&:last-child": { paddingBottom: t.spacing(2.5) } },
        }),
      },
    },
    MuiPaper: { styleOverrides: { rounded: { borderRadius: 12 } } },

    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 10, paddingInline: 16, minHeight: 40 },
        sizeSmall: { minHeight: 32, paddingInline: 12 },
      },
    },
    MuiOutlinedInput: { styleOverrides: { root: { borderRadius: 10, backgroundColor: "#fff" } } },
    MuiChip: { styleOverrides: { root: { fontWeight: 600, borderRadius: 8 } } },
    MuiAlert: { styleOverrides: { root: { borderRadius: 12 } } },
    MuiDialog: { styleOverrides: { paper: { borderRadius: 16 } } },

    // Tables keep readable columns on small screens and scroll sideways inside
    // their card instead of crushing inputs or widening the page.
    MuiTableContainer: {
      styleOverrides: { root: { overflowX: "auto", WebkitOverflowScrolling: "touch" } },
    },
    MuiTable: {
      styleOverrides: {
        root: ({ theme: t }) => ({ [t.breakpoints.down("md")]: { minWidth: 640 } }),
      },
    },
    MuiTableCell: {
      styleOverrides: {
        // On small screens rows stay on one line and the table scrolls sideways,
        // instead of breaking values like manifest numbers over several lines.
        root: ({ theme: t }) => ({
          borderColor: alpha(brand.ink, 0.08),
          [t.breakpoints.down("md")]: { whiteSpace: "nowrap" },
        }),
        head: {
          fontWeight: 700,
          fontSize: "0.75rem",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          color: brand.muted,
          background: "#F7FAFB",
          whiteSpace: "nowrap",
        },
      },
    },

    MuiListItemButton: { styleOverrides: { root: { borderRadius: 10 } } },
    MuiTablePagination: { styleOverrides: { toolbar: { flexWrap: "wrap" } } },
  },
});

// Scales h1-h6 down on small screens (e.g. KPI numbers, page titles).
theme = responsiveFontSizes(theme, { factor: 2.2 });

export { theme };
