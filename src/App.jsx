import React, { useEffect, useState } from "react";
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

function isAuthed() {
  return !!localStorage.getItem("accessToken");
}

export default function App() {
  const [authed, setAuthed] = useState(isAuthed());

  useEffect(() => {
    const onStorage = () => setAuthed(isAuthed());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

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

        <Route path="/users" element={<Users />} />
        <Route path="/users/new" element={<AddUser />} />

        <Route path="*" element={<Navigate to="/overview" replace />} />
      </Route>
    </Routes>
  );
}