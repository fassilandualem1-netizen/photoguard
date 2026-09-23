import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import {
  Users,
  HardDrive,
  FolderLock,
  Activity,
  UserPlus,
  Shield,
  Search,
  RefreshCw,
  Copy,
  Check,
  AlertTriangle,
  Sparkles,
  Sliders,
  Power,
  Layers,
  Mail,
  Zap,
  KeyRound,
  X,
} from "lucide-react";

export default function AdminDashboard() {
  const { user, logout } = useAuth();

  // Platform statistics
  const [stats, setStats] = useState({
    total_photographers: 0,
    total_storage_used_bytes: 0,
    total_storage_used_gb: 0,
    total_albums: 0,
    total_photos: 0,
  });

  // Photographers Directory
  const [photographers, setPhotographers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [errorBanner, setErrorBanner] = useState("");

  // Register Photographer Form
  const [registerForm, setRegisterForm] = useState({
    full_name: "",
    email: "",
    subscription_plan: "basic",
  });
  const [customQuotaGB, setCustomQuotaGB] = useState(5);
  const [isRegistering, setIsRegistering] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState(null);
  const [hasCopiedPassword, setHasCopiedPassword] = useState(false);

  // Password Reset Modal State
  const [resetModalData, setResetModalData] = useState(null);
  const [hasCopiedResetPassword, setHasCopiedResetPassword] = useState(false);

  // Navigation Tabs State
  const [activeTab, setActiveTab] = useState("directory"); // "directory" | "audit_logs" | "system_health"
  const [auditLogs, setAuditLogs] = useState([]);
  const [loadingAuditLogs, setLoadingAuditLogs] = useState(false);

  // System Health & Crash Diagnostics State
  const [systemErrors, setSystemErrors] = useState([]);
  const [loadingErrors, setLoadingErrors] = useState(false);
  const [resolvingErrorId, setResolvingErrorId] = useState(null);

  // Fetch Audit Logs
  const fetchAuditLogs = async () => {
    try {
      setLoadingAuditLogs(true);
      const res = await api.get("/api/v1/admin/audit-logs?limit=50");
      setAuditLogs(res.data);
    } catch (err) {
      console.error("Failed to load audit logs:", err);
    } finally {
      setLoadingAuditLogs(false);
    }
  };

  // Fetch Unresolved System Health Crashes
  const fetchSystemErrors = async () => {
    try {
      setLoadingErrors(true);
      const res = await api.get("/api/v1/admin/system-health/errors?limit=50&include_resolved=false");
      setSystemErrors(res.data);
    } catch (err) {
      console.error("Failed to load system health errors:", err);
    } finally {
      setLoadingErrors(false);
    }
  };

  // Resolve System Error Callback
  const handleResolveError = async (errorId) => {
    try {
      setResolvingErrorId(errorId);
      await api.put(`/api/v1/admin/system-health/errors/${errorId}/resolve`);
      // Instantly remove the resolved error from UI state
      setSystemErrors((prev) => prev.filter((item) => item.id !== errorId));
    } catch (err) {
      console.error(`Failed to resolve system error #${errorId}:`, err);
      alert(err.response?.data?.detail || "Failed to mark error as resolved.");
    } finally {
      setResolvingErrorId(null);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === "audit_logs") {
      fetchAuditLogs();
    } else if (tab === "system_health") {
      fetchSystemErrors();
    }
  };

  // Fetch initial stats & directory
  const fetchData = async () => {
    try {
      setLoading(true);
      setErrorBanner("");
      const [statsRes, usersRes] = await Promise.all([
        api.get("/api/v1/admin/stats"),
        api.get("/api/v1/admin/users"),
      ]);
      setStats(statsRes.data);
      setPhotographers(usersRes.data);
      // Preload active crash count for badge notification
      api.get("/api/v1/admin/system-health/errors?limit=50&include_resolved=false")
        .then((res) => setSystemErrors(res.data))
        .catch(() => {});
    } catch (err) {
      console.error("Failed to load admin metrics:", err);
      setErrorBanner(
        err.response?.data?.detail || "Failed to connect to PhotoGuard Admin Service."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Handle Photographer Registration
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (!registerForm.email || !registerForm.full_name) return;

    try {
      setIsRegistering(true);
      setErrorBanner("");
      const res = await api.post("/api/v1/admin/users", {
        full_name: registerForm.full_name,
        email: registerForm.email,
        subscription_plan: registerForm.subscription_plan,
        custom_quota_gb: parseFloat(customQuotaGB) || (registerForm.subscription_plan === "studio" ? 25 : 5),
      });

      // Show temporary password banner
      setCreatedCredentials({
        email: res.data.user.email,
        full_name: res.data.user.full_name,
        temp_password: res.data.temp_password,
        plan: res.data.user.subscription_plan,
      });
      setHasCopiedPassword(false);

      // Reset form and update table
      setRegisterForm({
        full_name: "",
        email: "",
        subscription_plan: "basic",
      });
      setCustomQuotaGB(5);

      // Refresh list
      fetchData();
    } catch (err) {
      setErrorBanner(
        err.response?.data?.detail || "Failed to register photographer."
      );
    } finally {
      setIsRegistering(false);
    }
  };

  // Toggle Suspend / Active
  const handleToggleSuspend = async (userId, currentActive) => {
    try {
      setActionLoadingId(userId);
      await api.put(`/api/v1/admin/users/${userId}/suspend`);
      setPhotographers((prev) =>
        prev.map((p) =>
          p.id === userId ? { ...p, is_active: !currentActive } : p
        )
      );
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to toggle user status.");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Toggle Plan (basic <-> studio)
  const handleTogglePlan = async (userId, currentPlan) => {
    try {
      setActionLoadingId(userId);
      const res = await api.put(`/api/v1/admin/users/${userId}/plan`);
      setPhotographers((prev) =>
        prev.map((p) =>
          p.id === userId
            ? {
                ...p,
                subscription_plan: res.data.subscription_plan,
                storage_quota_limit: res.data.storage_quota_limit,
              }
            : p
        )
      );
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to update plan.");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Edit Quota (Prompt for GB -> API Call with new_quota_gb)
  const handleEditQuota = async (userId, currentQuotaBytes) => {
    const currentGb = (currentQuotaBytes / (1024 * 1024 * 1024)).toFixed(1);
    const inputVal = window.prompt(
      "Enter new storage allocation in GB (Enter 9999 for Unlimited):",
      currentGb
    );

    if (inputVal === null) return; // Cancelled
    const parsedGb = parseFloat(inputVal.trim());
    if (isNaN(parsedGb) || parsedGb <= 0) {
      alert("Please provide a valid positive number for storage allocation in GB.");
      return;
    }

    try {
      setActionLoadingId(userId);
      const res = await api.put(`/api/v1/admin/users/${userId}/quota`, {
        new_quota_gb: parsedGb,
      });

      // Show success alert
      alert(`Storage quota updated successfully to ${res.data.quota_gb || parsedGb} GB!`);

      // Refresh photographer directory to instantly update the Storage Allocation bar
      await fetchData();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to update storage quota.");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Emergency Password Reset for Individual Users (Phase 2 Frontend)
  const handleResetPassword = async (userId, userEmail) => {
    if (
      !window.confirm(
        `Are you sure you want to reset the password for this user (${userEmail})?`
      )
    ) {
      return;
    }

    try {
      setActionLoadingId(userId);
      const res = await api.post(`/api/v1/admin/users/${userId}/reset-password`);
      const tempPassword = res.data.temporary_password || res.data.temp_password;

      setResetModalData({
        user_id: userId,
        email: res.data.email || userEmail,
        temporary_password: tempPassword,
      });
      setHasCopiedResetPassword(false);
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to reset photographer password.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCopyResetPassword = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setHasCopiedResetPassword(true);
    setTimeout(() => setHasCopiedResetPassword(false), 3000);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setHasCopiedPassword(true);
    setTimeout(() => setHasCopiedPassword(false), 3000);
  };

  // Filtered photographers list: strictly root photographers (no assistants as rows)
  const filteredPhotographers = photographers
    .filter((p) => !p.parent_id && String(p.role).toLowerCase() !== "admin")
    .filter((p) => {
      const term = searchQuery.toLowerCase();
      return (
        p.full_name?.toLowerCase().includes(term) ||
        p.email?.toLowerCase().includes(term) ||
        p.subscription_plan?.toLowerCase().includes(term)
      );
    });

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return "0.00 GB";
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) return `${gb.toFixed(2)} GB`;
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  return (
    <div className="min-h-screen bg-[#090b10] text-slate-100 selection:bg-indigo-500 selection:text-white">
      {/* Top Command Bar */}
      <header className="border-b border-indigo-950/60 bg-[#0d1017]/80 backdrop-blur-md sticky top-0 z-30 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center shadow-lg shadow-indigo-500/20 border border-indigo-400/30">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold tracking-tight text-white font-mono">
                  PhotoGuard
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 uppercase">
                  Super Admin
                </span>
              </div>
              <p className="text-xs text-slate-400 font-sans">
                Root Infrastructure Command Center
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/dashboard"
              id="admin-to-galleries-link"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 hover:text-amber-200 text-xs font-semibold transition-all shadow-sm"
            >
              <span>Photographer Galleries & Proofs</span>
              <span className="text-amber-400 font-bold">→</span>
            </Link>
            <button
              onClick={fetchData}
              className="p-2 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-indigo-300 border border-slate-800 transition-colors"
              title="Refresh Analytics"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-indigo-400" : ""}`} />
            </button>
            <div className="h-6 w-px bg-slate-800" />
            <div className="flex items-center gap-3 pl-1">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-medium text-slate-200">{user?.full_name || "Root Admin"}</p>
                <p className="text-[11px] text-slate-500 font-mono">{user?.email}</p>
              </div>
              <button
                onClick={logout}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Error Notification */}
        {errorBanner && (
          <div className="p-4 rounded-xl bg-red-950/40 border border-red-800/60 text-red-300 flex items-center gap-3 text-sm animate-fade-in">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <span>{errorBanner}</span>
          </div>
        )}

        {/* Section 1: 4 Stat Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Photographers */}
          <div className="p-5 rounded-2xl bg-[#0e121b] border border-indigo-950/70 hover:border-indigo-800/60 transition-all relative overflow-hidden group shadow-lg shadow-black/40">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Total Photographers
              </span>
              <div className="w-9 h-9 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20 group-hover:scale-105 transition-transform">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-bold tracking-tight text-white font-mono">
                {stats.total_photographers}
              </span>
              <span className="text-xs text-indigo-400 font-medium">registered</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Active SaaS photographer tenancies
            </p>
          </div>

          {/* Card 2: Total Storage Used */}
          <div className="p-5 rounded-2xl bg-[#0e121b] border border-indigo-950/70 hover:border-indigo-800/60 transition-all relative overflow-hidden group shadow-lg shadow-black/40">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Total Storage Used
              </span>
              <div className="w-9 h-9 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400 border border-cyan-500/20 group-hover:scale-105 transition-transform">
                <HardDrive className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-bold tracking-tight text-white font-mono">
                {stats.total_storage_used_gb}
              </span>
              <span className="text-xs text-cyan-400 font-medium">GB</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Cloud storage utilized
            </p>
          </div>

          {/* Card 3: Active Albums */}
          <div className="p-5 rounded-2xl bg-[#0e121b] border border-indigo-950/70 hover:border-indigo-800/60 transition-all relative overflow-hidden group shadow-lg shadow-black/40">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Active Albums
              </span>
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20 group-hover:scale-105 transition-transform">
                <FolderLock className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-bold tracking-tight text-white font-mono">
                {stats.total_albums}
              </span>
              <span className="text-xs text-emerald-400 font-medium">
                ({stats.total_photos} photos)
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              PIN-secured selection galleries
            </p>
          </div>

          {/* Card 4: System Health */}
          <div className="p-5 rounded-2xl bg-[#0e121b] border border-indigo-950/70 hover:border-indigo-800/60 transition-all relative overflow-hidden group shadow-lg shadow-black/40">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                System Health
              </span>
              <div className="w-9 h-9 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20 group-hover:scale-105 transition-transform">
                <Activity className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-xl font-bold tracking-tight text-emerald-400 font-mono">
                Operational
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Cloud Infrastructure & Live Sync Active
            </p>
          </div>
        </section>

        {/* Temporary Credentials Success Banner */}
        {createdCredentials && (
          <section className="p-5 rounded-2xl bg-indigo-950/30 border-2 border-indigo-500/60 shadow-xl shadow-indigo-950/50 animate-fade-in relative overflow-hidden">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="p-1 rounded-md bg-indigo-500/20 text-indigo-300">
                    <Sparkles className="w-4 h-4" />
                  </span>
                  <h3 className="text-sm font-bold text-white tracking-wide uppercase font-mono">
                    New Photographer Provisioned Successfully!
                  </h3>
                </div>
                <p className="text-xs text-slate-300">
                  Deliver these credentials to the client. They will be forced to choose a private password on initial login.
                </p>
                <div className="pt-2 flex flex-wrap items-center gap-3 text-xs font-mono">
                  <span className="px-2.5 py-1 rounded-md bg-black/50 border border-indigo-800/60 text-slate-300">
                    User: <strong className="text-white">{createdCredentials.full_name}</strong>
                  </span>
                  <span className="px-2.5 py-1 rounded-md bg-black/50 border border-indigo-800/60 text-slate-300">
                    Email: <strong className="text-white">{createdCredentials.email}</strong>
                  </span>
                  <span className="px-2.5 py-1 rounded-md bg-indigo-500/20 border border-indigo-400/50 text-indigo-300">
                    Plan: <strong className="uppercase">{createdCredentials.plan}</strong>
                  </span>
                </div>
              </div>

              {/* Password Copy Container */}
              <div className="flex items-center gap-2 w-full md:w-auto bg-black/70 p-2 rounded-xl border border-indigo-500/50">
                <div className="px-3 py-1 text-center">
                  <div className="text-[10px] uppercase font-mono text-slate-400">Temporary Password</div>
                  <div className="text-lg font-bold font-mono tracking-wider text-indigo-300">
                    {createdCredentials.temp_password}
                  </div>
                </div>
                <button
                  onClick={() => copyToClipboard(createdCredentials.temp_password)}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs flex items-center gap-2 transition-all shadow-md shadow-indigo-600/30 active:scale-95"
                >
                  {hasCopiedPassword ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-300" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copy Password</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Navigation Tab Switcher */}
        <div className="flex items-center gap-3 border-b border-indigo-950/80 pb-4">
          <button
            type="button"
            id="admin-directory-tab"
            onClick={() => handleTabChange("directory")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === "directory"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/25"
                : "bg-[#0e121b] text-slate-400 hover:text-white hover:bg-slate-900 border border-indigo-950/60"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Photographers Directory</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                activeTab === "directory"
                  ? "bg-white/20 text-white"
                  : "bg-slate-800 text-slate-400"
              }`}
            >
              {filteredPhotographers.length}
            </span>
          </button>

          <button
            type="button"
            id="admin-audit-logs-tab"
            onClick={() => handleTabChange("audit_logs")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === "audit_logs"
                ? "bg-amber-600 text-white shadow-lg shadow-amber-600/25"
                : "bg-[#0e121b] text-slate-400 hover:text-white hover:bg-slate-900 border border-indigo-950/60"
            }`}
          >
            <Shield className="w-4 h-4 text-amber-400" />
            <span>Security Ledger & Audit Logs</span>
            {auditLogs.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {auditLogs.length}
              </span>
            )}
          </button>

          <button
            type="button"
            id="admin-system-health-tab"
            onClick={() => handleTabChange("system_health")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === "system_health"
                ? "bg-rose-600 text-white shadow-lg shadow-rose-600/25"
                : "bg-[#0e121b] text-slate-400 hover:text-white hover:bg-slate-900 border border-indigo-950/60"
            }`}
          >
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            <span>System Health & Crashes</span>
            {systemErrors.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse">
                {systemErrors.length}
              </span>
            )}
          </button>
        </div>

        {/* Tab 1: Directory & Provisioning */}
        {activeTab === "directory" && (
          <>
            {/* Section 2: "Register Photographer" Form */}
            <section className="p-6 rounded-2xl bg-[#0e121b] border border-indigo-950/70 shadow-xl shadow-black/30">
          <div className="flex items-center gap-2.5 mb-5 pb-4 border-b border-indigo-950/60">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Register New Photographer
              </h2>
              <p className="text-xs text-slate-400">
                Generate an account with automatic secure 8-character password generation
              </p>
            </div>
          </div>

          <form onSubmit={handleRegisterSubmit} className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
            <div className="sm:col-span-3 space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Full Name / Studio
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="e.g. Dawit Studio"
                  value={registerForm.full_name}
                  onChange={(e) =>
                    setRegisterForm({ ...registerForm, full_name: e.target.value })
                  }
                  className="w-full bg-[#080a0f] border border-indigo-950/80 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
              </div>
            </div>

            <div className="sm:col-span-3 space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Email Address
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  placeholder="photographer@example.com"
                  value={registerForm.email}
                  onChange={(e) =>
                    setRegisterForm({ ...registerForm, email: e.target.value })
                  }
                  className="w-full bg-[#080a0f] border border-indigo-950/80 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
              </div>
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Tier Plan
              </label>
              <select
                value={registerForm.subscription_plan}
                onChange={(e) => {
                  const selectedPlan = e.target.value;
                  setRegisterForm({
                    ...registerForm,
                    subscription_plan: selectedPlan,
                  });
                  // Dynamic auto-fill: 5 for Basic, 25 for Studio
                  if (selectedPlan === "studio") {
                    setCustomQuotaGB(25);
                  } else {
                    setCustomQuotaGB(5);
                  }
                }}
                className="w-full bg-[#080a0f] border border-indigo-950/80 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
              >
                <option value="basic">Basic (Default: 5 GB)</option>
                <option value="studio">Studio (Default: 25 GB)</option>
              </select>
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Storage (GB)
                </label>
              </div>
              <div className="relative">
                <input
                  type="number"
                  min="0.1"
                  step="0.5"
                  required
                  placeholder="5"
                  value={customQuotaGB}
                  onChange={(e) => setCustomQuotaGB(e.target.value)}
                  className="w-full bg-[#080a0f] border border-indigo-950/80 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors font-mono"
                />
              </div>
              <p className="text-[10px] text-slate-500 font-mono">
                (Enter 9999 for Unlimited)
              </p>
            </div>

            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={isRegistering}
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/25 active:scale-[0.98]"
              >
                {isRegistering ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>Create Account</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </section>

        {/* Section 3: "Photographers Directory" Table */}
        <section className="p-6 rounded-2xl bg-[#0e121b] border border-indigo-950/70 shadow-xl shadow-black/30">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-indigo-950/60">
            <div>
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <span>Photographers Directory</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {filteredPhotographers.length}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Manage accounts, quota overrides, and subscription statuses
              </p>
            </div>

            {/* Search Input */}
            <div className="w-full sm:w-72 relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Search by name, email, or plan..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#080a0f] border border-indigo-950/80 rounded-xl pl-10 pr-3.5 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>

          {/* Directory Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-indigo-950/80 text-slate-400 font-mono uppercase tracking-wider">
                  <th className="pb-3 px-3">Photographer</th>
                  <th className="pb-3 px-3">Plan Tier</th>
                  <th className="pb-3 px-3">Storage Allocation</th>
                  <th className="pb-3 px-3">Albums & Media</th>
                  <th className="pb-3 px-3">Status</th>
                  <th className="pb-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-indigo-950/40">
                {filteredPhotographers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500">
                      {loading ? "Loading directory..." : "No photographers match the search query."}
                    </td>
                  </tr>
                ) : (
                  filteredPhotographers.map((p) => {
                    const quotaGb = (p.storage_quota_limit / (1024 * 1024 * 1024)).toFixed(1);
                    const usagePercent = Math.min(
                      100,
                      Math.round((p.storage_used / (p.storage_quota_limit || 1)) * 100)
                    );
                    const isLoading = actionLoadingId === p.id;

                    return (
                      <tr key={p.id} className="hover:bg-indigo-950/20 transition-colors">
                        {/* Name & Email */}
                        <td className="py-3.5 px-3">
                          <div className="font-semibold text-white">{p.full_name}</div>
                          <div className="text-slate-400 font-mono text-[11px] flex items-center gap-1 mt-0.5">
                            <Mail className="w-3 h-3 text-indigo-400/60" />
                            <span>{p.email}</span>
                          </div>
                        </td>

                        {/* Plan */}
                        <td className="py-3.5 px-3">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold uppercase tracking-wider font-mono border ${
                              p.subscription_plan === "studio"
                                ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/40"
                                : "bg-slate-800 text-slate-300 border-slate-700"
                            }`}
                          >
                            {p.subscription_plan === "studio" && (
                              <Zap className="w-3 h-3 text-indigo-400" />
                            )}
                            {p.subscription_plan}
                          </span>
                        </td>

                        {/* Storage */}
                        <td className="py-3.5 px-3 min-w-[170px]">
                          <div className="flex items-center justify-between text-[11px] text-slate-300 font-mono mb-1">
                            <span>{formatBytes(p.storage_used)}</span>
                            <span className="text-slate-500">/ {quotaGb} GB</span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                usagePercent > 90
                                  ? "bg-red-500"
                                  : usagePercent > 70
                                  ? "bg-amber-400"
                                  : "bg-indigo-500"
                              }`}
                              style={{ width: `${usagePercent}%` }}
                            />
                          </div>
                        </td>

                        {/* Albums & Media (Accurate Aggregated Studio Hierarchy) */}
                        <td className="py-3.5 px-3">
                          <div className="text-slate-200 font-mono text-xs">
                            <strong>{p.total_albums}</strong> <span className="text-slate-400 font-sans">albums</span>
                            <span className="text-slate-600 mx-1">•</span>
                            <strong>{p.total_media}</strong> <span className="text-slate-400 font-sans">media</span>
                          </div>
                          <div className="mt-1">
                            {p.assistants_count > 0 ? (
                              <span
                                title={`Includes data aggregated from ${p.assistants_count} studio assistant(s): ${p.assistants?.map(a => a.full_name).join(', ') || ''}`}
                                className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/25"
                              >
                                <Users className="w-3 h-3 text-amber-400" />
                                <span>Root + {p.assistants_count} Assistant{p.assistants_count > 1 ? 's' : ''}</span>
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-500 font-mono">
                                Root Solo Account
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-3">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
                              p.is_active
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                : "bg-red-500/10 text-red-400 border-red-500/30"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                p.is_active ? "bg-emerald-400" : "bg-red-400"
                              }`}
                            />
                            {p.is_active ? "Active" : "Suspended"}
                          </span>
                        </td>

                        {/* Actions (Visually Distinct & Unambiguous) */}
                        <td className="py-3.5 px-3 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            {/* 1. Toggle Suspend / Active (Root + Cascading) */}
                            <button
                              onClick={() => handleToggleSuspend(p.id, p.is_active)}
                              disabled={isLoading}
                              title={
                                p.is_active
                                  ? "Suspend Root Account (Cascades suspension to all assistants)"
                                  : "Activate Root Account (Re-enables studio access)"
                              }
                              className={`p-2 rounded-lg text-xs font-medium border transition-all ${
                                p.is_active
                                  ? "bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/30 hover:scale-105 active:scale-95"
                                  : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:scale-105 active:scale-95"
                              }`}
                            >
                              <Power className="w-3.5 h-3.5" />
                            </button>

                            {/* 2. Toggle Plan (Basic <-> Studio) */}
                            <button
                              onClick={() => handleTogglePlan(p.id, p.subscription_plan)}
                              disabled={isLoading}
                              title={
                                p.subscription_plan === "basic"
                                  ? "Upgrade to Studio Tier (Unlocks assistants, custom branding & downloads)"
                                  : "Downgrade to Basic Tier (Deactivates assistants)"
                              }
                              className="p-2 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 transition-all hover:scale-105 active:scale-95"
                            >
                              <Layers className="w-3.5 h-3.5" />
                            </button>

                            {/* 3. Emergency Reset Password for Root Account */}
                            <button
                              onClick={() => handleResetPassword(p.id, p.email)}
                              disabled={isLoading}
                              title="Reset Password for Root Account (Generates fresh temporary credentials)"
                              className="p-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-all hover:scale-105 active:scale-95"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                            </button>

                            {/* 4. Edit Quota Limit Override */}
                            <button
                              onClick={() => handleEditQuota(p.id, p.storage_quota_limit)}
                              disabled={isLoading || actionLoadingId === p.id}
                              title="Override Storage Quota Limit (GB) (e.g. 5, 25, 50, 9999 for Unlimited)"
                              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                            >
                              {actionLoadingId === p.id ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                              ) : (
                                <Sliders className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </>
    )}

    {/* Tab 2: Security Ledger & Audit Logs View */}
    {activeTab === "audit_logs" && (
      <section className="p-6 rounded-2xl bg-[#0e121b] border border-amber-950/50 shadow-xl shadow-black/30 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-indigo-950/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Security & Administrative Audit Ledger
              </h2>
              <p className="text-xs text-slate-400 font-sans">
                Immutable log of administrative overrides, password resets, suspensions, and quota changes
              </p>
            </div>
          </div>
          <button
            onClick={fetchAuditLogs}
            disabled={loadingAuditLogs}
            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingAuditLogs ? "animate-spin text-amber-400" : ""}`} />
            <span>Refresh Ledger</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-indigo-950/80 text-slate-400 font-mono uppercase tracking-wider">
                <th className="pb-3 px-3">Timestamp</th>
                <th className="pb-3 px-3">Action</th>
                <th className="pb-3 px-3">Admin</th>
                <th className="pb-3 px-3">Target User</th>
                <th className="pb-3 px-3">Event Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-indigo-950/40 font-mono">
              {auditLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500 font-sans">
                    {loadingAuditLogs ? "Loading security audit records..." : "No audit records found."}
                  </td>
                </tr>
              ) : (
                auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-indigo-950/20 transition-colors">
                    <td className="py-3 px-3 text-slate-400 text-[11px] whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                        log.action.includes("RESET")
                          ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                          : log.action.includes("SUSPEND")
                          ? "bg-red-500/15 text-red-300 border-red-500/30"
                          : "bg-indigo-500/15 text-indigo-300 border-indigo-500/30"
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-300 text-xs font-sans whitespace-nowrap">
                      {log.admin_email || `Admin #${log.admin_id}`}
                    </td>
                    <td className="py-3 px-3 text-slate-300 text-xs font-sans whitespace-nowrap">
                      {log.target_user_email ? (
                        <span className="text-white font-medium">{log.target_user_email}</span>
                      ) : log.target_user_id ? (
                        `User #${log.target_user_id}`
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-slate-300 text-xs font-sans max-w-md truncate" title={log.details}>
                      {log.details}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    )}

    {/* Tab 3: System Health & Crash Diagnostics */}
    {activeTab === "system_health" && (
      <section className="p-6 rounded-2xl bg-[#0e121b] border border-rose-950/70 shadow-xl shadow-black/30">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-indigo-950/60">
          <div>
            <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-400" />
              <span>System Health & Unresolved Crashes</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-rose-500/20 text-rose-300 border border-rose-500/30">
                {systemErrors.length} {systemErrors.length === 1 ? "Incident" : "Incidents"}
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Centralized SRE monitoring for unhandled runtime crashes, database disconnects, and API faults.
            </p>
          </div>

          <button
            type="button"
            onClick={fetchSystemErrors}
            disabled={loadingErrors}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-2 border border-slate-700/60 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingErrors ? "animate-spin" : ""}`} />
            <span>Refresh Crashes</span>
          </button>
        </div>

        <div className="overflow-x-auto rounded-xl border border-indigo-950/80 bg-[#080a0f]">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-indigo-950/80 bg-indigo-950/30 text-slate-400 uppercase tracking-wider font-mono">
                <th className="py-3 px-4">Error Type</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Endpoint</th>
                <th className="py-3 px-4">Error Message & Details</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-indigo-950/60 text-slate-300 font-sans">
              {loadingErrors ? (
                <tr>
                  <td colSpan="5" className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-5 h-5 animate-spin text-rose-400" />
                      <span>Scanning system error logs...</span>
                    </div>
                  </td>
                </tr>
              ) : systemErrors.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                        <Check className="w-5 h-5 stroke-[2.5]" />
                      </div>
                      <span className="text-sm font-semibold text-slate-300">All Systems Operational</span>
                      <span className="text-xs text-slate-500">Zero unresolved database or runtime crashes recorded.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                systemErrors.map((err) => (
                  <tr key={err.id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-1 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider ${
                          err.error_type === "DATABASE"
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                            : err.error_type === "NETWORK"
                            ? "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                            : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                        }`}
                      >
                        {err.error_type}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                      {err.timestamp ? new Date(err.timestamp).toLocaleString() : "N/A"}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-300 whitespace-nowrap">
                      {err.endpoint || "Global Service"}
                    </td>
                    <td className="py-3 px-4 max-w-md">
                      <p className="font-medium text-rose-200 line-clamp-2" title={err.error_message}>
                        {err.error_message}
                      </p>
                      {err.traceback_details && (
                        <details className="mt-1 text-[10px] text-slate-500 font-mono cursor-pointer">
                          <summary className="hover:text-slate-400">View Stack Trace</summary>
                          <pre className="mt-1 p-2 rounded bg-black/60 text-slate-400 whitespace-pre-wrap max-h-36 overflow-y-auto border border-rose-950/40">
                            {err.traceback_details}
                          </pre>
                        </details>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleResolveError(err.id)}
                        disabled={resolvingErrorId === err.id}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 hover:text-emerald-200 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5 ml-auto transition-all disabled:opacity-50"
                        title="Mark this system crash as resolved"
                      >
                        {resolvingErrorId === err.id ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        )}
                        <span>Mark as Resolved</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    )}
  </main>

      {/* High-Visibility Password Reset Modal Overlay */}
      {resetModalData && (
        <div
          id="password-reset-modal-overlay"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
        >
          <div className="w-full max-w-md rounded-2xl bg-[#0e121b] border-2 border-amber-500/60 p-6 shadow-2xl shadow-amber-950/50 space-y-5 relative">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-wide">
                    Emergency Password Reset
                  </h3>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    User: <span className="text-amber-300 font-medium">{resetModalData.email}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setResetModalData(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
                title="Dismiss"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Temporary Password Box */}
            <div className="space-y-2">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider font-mono">
                New Temporary Password
              </label>
              <div className="flex items-center justify-between gap-3 bg-black/90 p-3.5 rounded-xl border border-amber-500/40">
                <span className="font-mono text-xl font-bold tracking-widest text-amber-300 select-all">
                  {resetModalData.temporary_password}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyResetPassword(resetModalData.temporary_password)}
                  className="px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-amber-500/20 active:scale-95 shrink-0"
                >
                  {hasCopiedResetPassword ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-950 stroke-[3]" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 stroke-[2.5]" />
                      <span>Copy Password</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Critical Security Warning */}
            <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-200/90 leading-relaxed">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <p>
                <strong className="text-amber-300 font-semibold">Security Warning:</strong> Please copy and deliver this temporary password immediately. For strict security, this password cannot be retrieved or shown again once closed. The user will be required to change their password on next sign-in.
              </p>
            </div>

            {/* Footer Action */}
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setResetModalData(null)}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
              >
                Done & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
