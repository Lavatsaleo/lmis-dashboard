import React, { useEffect, useMemo, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import DashboardLayout from "./components/DashboardLayout";
import Overview from "./pages/Overview";
import Alerts from "./pages/Alerts";
import Children from "./pages/Children";
import ChildDetails from "./pages/ChildDetails";
import FacilityStore from "./pages/FacilityStore";
import Users from "./pages/Users";
import AddUser from "./pages/AddUser";
import Manifests from "./pages/Manifests";
import Reports from "./pages/Reports";
import { clearSessionAndRedirect } from "./api/client";

const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
const ABSOLUTE_SESSION_MS = 8 * 60 * 60 * 1000; // 8 hours
const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "scroll",
  "touchstart",
  "click",
];

function isAuthed() {
  return !!localStorage.getItem("accessToken");
}

function markActivity() {
  localStorage.setItem("lastActivityAt", String(Date.now()));
}

function ensureSessionTimestamps() {
  const now = Date.now();

  if (!localStorage.getItem("sessionStartedAt")) {
    localStorage.setItem("sessionStartedAt", String(now));
  }

  if (!localStorage.getItem("lastActivityAt")) {
    localStorage.setItem("lastActivityAt", String(now));
  }
}

export default function App() {
  const [authed, setAuthed] = useState(isAuthed());

  const logout = useMemo(
    () => () => {
      clearSessionAndRedirect();
      setAuthed(false);
    },
    []
  );

  useEffect(() => {
    const onStorage = () => setAuthed(isAuthed());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (!authed) return;

    ensureSessionTimestamps();
    markActivity();

    let lastRecordedActivity = 0;
    const handleActivity = () => {
      const now = Date.now();
      // throttle localStorage writes
      if (now - lastRecordedActivity < 5000) return;
      lastRecordedActivity = now;
      markActivity();
    };

    ACTIVITY_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, handleActivity, { passive: true });
    });

    const timer = window.setInterval(() => {
      const now = Date.now();
      const sessionStartedAt = Number(localStorage.getItem("sessionStartedAt") || 0);
      const lastActivityAt = Number(localStorage.getItem("lastActivityAt") || 0);

      const absoluteExpired = sessionStartedAt > 0 && now - sessionStartedAt >= ABSOLUTE_SESSION_MS;
      const idleExpired = lastActivityAt > 0 && now - lastActivityAt >= IDLE_TIMEOUT_MS;

      if (absoluteExpired || idleExpired) {
        logout();
      }
    }, 15000);

    return () => {
      window.clearInterval(timer);
      ACTIVITY_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, handleActivity);
      });
    };
  }, [authed, logout]);

  if (!authed) {
    return <Login onLoggedIn={() => setAuthed(true)} />;
  }

  return (
    <Routes>
      <Route element={<DashboardLayout />}>
        <Route path="/" element={<Navigate to="/overview" replace />} />
        <Route path="/overview" element={<Overview />} />
        <Route path="/facility-store" element={<FacilityStore />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/children" element={<Children />} />
        <Route path="/children/:childId" element={<ChildDetails />} />
        <Route path="/manifests" element={<Manifests />} />
        <Route path="/reports" element={<Reports />} />

        <Route path="/users" element={<Users />} />
        <Route path="/users/new" element={<AddUser />} />

        <Route path="*" element={<Navigate to="/overview" replace />} />
      </Route>
    </Routes>
  );
}
