import React from "react";
import { useAuth } from "../context/AuthContext";
import AdminDashboard from "./AdminDashboard";
import PhotographerDashboard from "../components/PhotographerDashboard";

export default function DashboardHome() {
  const { isAdmin, isPhotographer, user } = useAuth();

  if (isAdmin) {
    return <AdminDashboard />;
  }

  if (isPhotographer) {
    return <PhotographerDashboard />;
  }

  // Fallback for custom or unassigned roles
  return (
    <div id="unknown-role-fallback" className="p-8 rounded-2xl border border-slate-800 bg-slate-900/40 text-center">
      <h2 className="text-base font-semibold text-white mb-1">Authenticated Account</h2>
      <p className="text-xs text-slate-400">
        Signed in as {user?.email}. Role assignment pending administrator verification.
      </p>
    </div>
  );
}
