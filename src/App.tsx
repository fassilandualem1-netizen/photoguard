import React, { useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import ForceChangePassword from "./pages/ForceChangePassword";
import DashboardLayout from "./layouts/DashboardLayout";
import { Plus, Image as ImageIcon, Sparkles, Clock, Lock, Check } from "lucide-react";

function MainApp() {
  const { isAuthenticated, needsPasswordChange, loading, user } = useAuth();
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d0f12] flex items-center justify-center text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
          <span className="text-xs font-mono uppercase tracking-wider text-slate-500">Loading PhotoGuard...</span>
        </div>
      </div>
    );
  }

  // If not logged in, render the Split-screen Glassmorphism Login
  if (!isAuthenticated) {
    return <Login />;
  }

  // If logged in but enterprise requires initial password change
  if (needsPasswordChange || showPasswordModal) {
    return (
      <ForceChangePassword
        onPasswordChanged={() => {
          setShowPasswordModal(false);
        }}
      />
    );
  }

  // Authenticated Dashboard: Minimalist Canvas with Masonry Grid
  return (
    <DashboardLayout onChangePasswordClick={() => setShowPasswordModal(true)}>
      <div className="space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Client Galleries</h1>
            <p className="text-xs text-slate-400 mt-1">
              Active client photo review sessions with live multi-device sync
            </p>
          </div>
          <button
            id="create-album-btn"
            type="button"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-xs transition-all shadow-md shadow-amber-500/10"
          >
            <Plus className="w-4 h-4" />
            <span>New Album</span>
          </button>
        </div>

        {/* Minimalist Masonry Gallery Grid Showcase */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Sample Active Gallery Card */}
          <div className="group rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-sm overflow-hidden hover:border-slate-700 transition-all">
            <div className="h-44 bg-gradient-to-tr from-slate-950 to-slate-800 flex items-center justify-center relative p-4">
              <ImageIcon className="w-10 h-10 text-slate-700 group-hover:text-amber-400/80 transition-colors" />
              <div className="absolute top-3 left-3 px-2 py-1 rounded-md bg-black/60 backdrop-blur-md border border-slate-700/60 text-[10px] font-mono text-amber-400">
                PIN: 492015
              </div>
              <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-950/60 border border-emerald-500/40 text-[10px] text-emerald-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Sync
              </div>
            </div>
            <div className="p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">Abel & Sara Wedding</h3>
                  <p className="text-xs text-slate-400">Client: Sara Mengistu</p>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">142 Photos</span>
              </div>
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> 7 days left
                </span>
                <span className="text-amber-400 font-medium">38 Selected</span>
              </div>
            </div>
          </div>

          {/* Sample Finalized Gallery Card */}
          <div className="group rounded-2xl border border-slate-800/80 bg-slate-900/20 backdrop-blur-sm overflow-hidden hover:border-slate-700 transition-all">
            <div className="h-44 bg-gradient-to-tr from-slate-950 to-slate-900 flex items-center justify-center relative p-4">
              <ImageIcon className="w-10 h-10 text-slate-800" />
              <div className="absolute top-3 left-3 px-2 py-1 rounded-md bg-black/60 backdrop-blur-md border border-slate-800 text-[10px] font-mono text-slate-400">
                PIN: 810344
              </div>
              <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 rounded-md bg-slate-800/80 border border-slate-700 text-[10px] text-slate-300">
                <Lock className="w-3 h-3 text-amber-400" />
                Submitted
              </div>
            </div>
            <div className="p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">Commercial Studio Editorial</h3>
                  <p className="text-xs text-slate-400">Client: Addis Brand House</p>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">60 Photos</span>
              </div>
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
                <span className="flex items-center gap-1 text-emerald-400">
                  <Check className="w-3.5 h-3.5" /> Ready for Lightroom
                </span>
                <span className="text-slate-300 font-medium">25 Selected</span>
              </div>
            </div>
          </div>

          {/* Empty New Upload Action Card */}
          <button
            type="button"
            className="rounded-2xl border-2 border-dashed border-slate-800/90 hover:border-amber-500/50 hover:bg-slate-900/20 p-8 flex flex-col items-center justify-center gap-3 text-slate-400 hover:text-white transition-all min-h-[220px]"
          >
            <div className="w-12 h-12 rounded-2xl bg-slate-800/60 flex items-center justify-center">
              <Plus className="w-5 h-5 text-slate-300" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-white">Create New Proof Gallery</p>
              <p className="text-xs text-slate-500 mt-0.5">Bulk upload photos with auto-PIN generation</p>
            </div>
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
