import React, { useState, useEffect, useRef } from "react";
import api from "../api/axios";
import AdminPhotographerTable from "../components/AdminPhotographerTable";
import ThemeToggle from "../components/ThemeToggle";
import { useAuth } from "../context/AuthContext";
import {
  Users,
  HardDrive,
  FolderLock,
  Activity,
  UserPlus,
  Shield,
  ShieldCheck,
  Search,
  RefreshCw,
  Copy,
  Check,
  AlertTriangle,
  CheckCircle2,
  Sliders,
  Power,
  Layers,
  Mail,
  Zap,
  KeyRound,
  X,
  Megaphone,
  CheckCircle,
  LogOut,
  ChevronDown,
  Images,
  CircleUser,
} from "lucide-react";

export default function AdminDashboard() {
  const { user, logout } = useAuth();

  // Profile menu and modal states
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef(null);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);

  // Click-outside listener for profile menu
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) {
        setIsProfileMenuOpen(false);
      }
    };
    if (isProfileMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isProfileMenuOpen]);

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

  // Global Dashboard Broadcast Announcements State
  const [currentBroadcast, setCurrentBroadcast] = useState(null);
  const [broadcastList, setBroadcastList] = useState([]);
  const [loadingBroadcasts, setLoadingBroadcasts] = useState(false);
  const [isPublishingBroadcast, setIsPublishingBroadcast] = useState(false);
  const [deactivatingId, setDeactivatingId] = useState(null);
  const [broadcastSuccessMsg, setBroadcastSuccessMsg] = useState("");
  const [broadcastForm, setBroadcastForm] = useState({
    title: "",
    message: "",
    type: "info",
  });

  // Navigation Tabs State
  const [activeTab, setActiveTab] = useState("directory"); // "directory" | "broadcasts" | "audit_logs" | "system_health"
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
      setAuditLogs(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setAuditLogs([]);
    } finally {
      setLoadingAuditLogs(false);
    }
  };

  // Fetch Unresolved System Health Crashes
  const fetchSystemErrors = async () => {
    try {
      setLoadingErrors(true);
      const res = await api.get("/api/v1/admin/system-health/errors?limit=50&include_resolved=false");
      setSystemErrors(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setSystemErrors([]);
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

  // Fetch all broadcasts history + active banner
  const fetchBroadcasts = async () => {
    try {
      setLoadingBroadcasts(true);
      const [activeRes, listRes] = await Promise.all([
        api.get("/api/v1/broadcasts/active").catch(() => ({ data: null })),
        api.get("/api/v1/admin/broadcasts").catch(() => ({ data: [] })),
      ]);
      setCurrentBroadcast(activeRes.data || null);
      setBroadcastList(Array.isArray(listRes.data) ? listRes.data : []);
    } catch (err) {
      console.error("Failed to load broadcasts:", err);
    } finally {
      setLoadingBroadcasts(false);
    }
  };

  // Publish a new broadcast announcement
  const handlePublishBroadcast = async (e) => {
    e.preventDefault();
    if (!broadcastForm.title.trim() || !broadcastForm.message.trim()) return;

    try {
      setIsPublishingBroadcast(true);
      setBroadcastSuccessMsg("");
      const res = await api.post("/api/v1/admin/broadcasts", {
        title: broadcastForm.title.trim(),
        message: broadcastForm.message.trim(),
        type: broadcastForm.type,
      });
      setCurrentBroadcast(res.data);
      setBroadcastForm({ title: "", message: "", type: "info" });
      setBroadcastSuccessMsg("Global announcement published live to all photographers!");
      fetchBroadcasts();
      setTimeout(() => setBroadcastSuccessMsg(""), 4500);
    } catch (err) {
      console.error("Failed to publish broadcast:", err);
      alert(err.response?.data?.detail || "Failed to publish broadcast announcement.");
    } finally {
      setIsPublishingBroadcast(false);
    }
  };

  // Deactivate broadcast banner
  const handleDeactivateBroadcast = async (broadcastId) => {
    try {
      setDeactivatingId(broadcastId);
      await api.put(`/api/v1/admin/broadcasts/${broadcastId}/deactivate`);
      if (currentBroadcast?.id === broadcastId) {
        setCurrentBroadcast(null);
      }
      setBroadcastList((prev) =>
        prev.map((b) => (b.id === broadcastId ? { ...b, is_active: false } : b))
      );
      setBroadcastSuccessMsg("Broadcast announcement deactivated.");
      setTimeout(() => setBroadcastSuccessMsg(""), 3500);
    } catch (err) {
      console.error("Failed to deactivate broadcast:", err);
      alert(err.response?.data?.detail || "Failed to deactivate broadcast.");
    } finally {
      setDeactivatingId(null);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === "broadcasts") {
      fetchBroadcasts();
    } else if (tab === "audit_logs") {
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
      // Preload active broadcast banner for tab indicator
      api.get("/api/v1/broadcasts/active")
        .then((res) => setCurrentBroadcast(res.data))
        .catch(() => {});
      // Preload active crash count for badge notification
      api.get("/api/v1/admin/system-health/errors?limit=50&include_resolved=false")
        .then((res) => setSystemErrors(Array.isArray(res.data) ? res.data : []))
        .catch(() => setSystemErrors([]));
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

      // Show temporary password banner and close modal
      setCreatedCredentials({
        email: res.data.user.email,
        full_name: res.data.user.full_name,
        temp_password: res.data.temp_password,
        plan: res.data.user.subscription_plan,
      });
      setHasCopiedPassword(false);
      setIsRegisterModalOpen(false);

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

  // Permanently Delete Photographer
  const handleDeletePhotographer = async (userId, photographerName) => {
    const confirmed = window.confirm(
      `⚠️ PERMANENT ACTION:\n\nAre you sure you want to permanently delete photographer "${photographerName}"?\n\nThis will permanently remove:\n• Their account and login credentials\n• All their albums and uploaded photos\n• All client selections and assistant accounts\n\nThis action cannot be undone.`
    );
    if (!confirmed) return;

    try {
      setActionLoadingId(userId);
      await api.delete(`/api/v1/admin/users/${userId}`);
      // Remove from table immediately
      setPhotographers((prev) => prev.filter((p) => p.id !== userId));
      // Refresh stats
      await fetchData();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to delete photographer.");
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

  const adminStorageUsed = Number(stats?.total_storage_used_bytes || user?.storage_used || 0);
  const adminStorageLimit = Number(user?.storage_quota_limit) > 0 ? Number(user.storage_quota_limit) : 5368709120;
  const adminStoragePercentage = Math.min(100, Math.max(0, Math.round((adminStorageUsed / adminStorageLimit) * 100)));
  const adminStorageUsedDisplay = stats?.total_storage_used_gb 
    ? `${Number(stats.total_storage_used_gb).toFixed(2)} GB` 
    : formatBytes(adminStorageUsed);

  return (
    <div className="flex h-screen bg-[#080b12] text-slate-300 font-sans overflow-hidden">
      {/* FIXED LEFT SIDEBAR */}
      <aside className="w-64 bg-[#05070d] border-r border-slate-800/80 flex flex-col shrink-0 justify-between h-full">
        <div className="flex flex-col flex-1 min-h-0">
          {/* Logo Area */}
          <div className="p-6 flex items-center gap-3">
            <img src="/logo.svg" alt="PhotoGuard Logo" className="w-8 h-8 object-contain shrink-0" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-white font-bold text-xl tracking-tight">PhotoGuard</span>
                <span className="text-[10px] bg-indigo-900/50 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-700/50 font-mono">
                  SUPER ADMIN
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Links (Vertical) */}
          <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto">
            {/* Directory */}
            <button
              type="button"
              id="sidebar-nav-directory"
              onClick={() => handleTabChange("directory")}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                activeTab === "directory"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-400 hover:text-white hover:bg-slate-900/60"
              }`}
            >
              <div className="flex items-center gap-3">
                <Users className={`w-5 h-5 ${activeTab === "directory" ? "text-indigo-600" : "text-slate-400"}`} />
                <span>Directory</span>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs font-mono font-bold ${
                activeTab === "directory"
                  ? "bg-indigo-600 text-white"
                  : "bg-indigo-900/60 text-indigo-300 border border-indigo-700/40"
              }`}>
                {filteredPhotographers.length}
              </span>
            </button>

            {/* Broadcasts */}
            <button
              type="button"
              id="sidebar-nav-broadcasts"
              onClick={() => handleTabChange("broadcasts")}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                activeTab === "broadcasts"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-400 hover:text-white hover:bg-slate-900/60"
              }`}
            >
              <div className="flex items-center gap-3">
                <Megaphone className={`w-5 h-5 ${activeTab === "broadcasts" ? "text-sky-600" : "text-slate-400"}`} />
                <span>Broadcasts</span>
              </div>
              {currentBroadcast && currentBroadcast.is_active ? (
                <span className={`px-2 py-0.5 rounded-full text-xs font-mono font-bold flex items-center gap-1.5 ${
                  activeTab === "broadcasts"
                    ? "bg-emerald-600 text-white"
                    : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                }`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-300" />
                  Live
                </span>
              ) : (
                <span className={`px-2 py-0.5 rounded-full text-xs font-mono font-bold ${
                  activeTab === "broadcasts"
                    ? "bg-slate-200 text-slate-800"
                    : "bg-slate-800 text-slate-400 border border-slate-700/40"
                }`}>
                  {broadcastList.length}
                </span>
              )}
            </button>

            {/* Audit Logs */}
            <button
              type="button"
              id="sidebar-nav-audit-logs"
              onClick={() => handleTabChange("audit_logs")}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                activeTab === "audit_logs"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-400 hover:text-white hover:bg-slate-900/60"
              }`}
            >
              <div className="flex items-center gap-3">
                <Shield className={`w-5 h-5 ${activeTab === "audit_logs" ? "text-amber-600" : "text-slate-400"}`} />
                <span>Audit Logs</span>
              </div>
              {auditLogs.length > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-mono font-bold ${
                  activeTab === "audit_logs"
                    ? "bg-amber-600 text-white"
                    : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                }`}>
                  {auditLogs.length}
                </span>
              )}
            </button>

            {/* System Health */}
            <button
              type="button"
              id="sidebar-nav-system-health"
              onClick={() => handleTabChange("system_health")}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                activeTab === "system_health"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-400 hover:text-white hover:bg-slate-900/60"
              }`}
            >
              <div className="flex items-center gap-3">
                <AlertTriangle className={`w-5 h-5 ${activeTab === "system_health" ? "text-rose-600" : "text-slate-400"}`} />
                <span>System Health</span>
              </div>
              {systemErrors.length > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-mono font-bold ${
                  activeTab === "system_health"
                    ? "bg-rose-600 text-white"
                    : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                }`}>
                  {systemErrors.length}
                </span>
              )}
            </button>
          </nav>
        </div>

        {/* SIDEBAR FOOTER */}
        <div className="p-4 border-t border-slate-800/80 space-y-3 shrink-0">
          {/* Storage Progress Indicator */}
          <div className="px-2">
            <div className="flex justify-between text-xs text-slate-400 mb-1.5 font-medium">
              <span>Storage</span>
              <span className="font-mono">{adminStoragePercentage}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                style={{ width: `${adminStoragePercentage}%` }}
              />
            </div>
            <div className="text-[11px] text-slate-400 mt-1 font-mono">
              {adminStorageUsedDisplay} of {formatBytes(adminStorageLimit)}
            </div>
          </div>

          {/* Light Mode Toggle */}
          <ThemeToggle variant="menu" className="!px-3 !py-2.5 rounded-xl !text-slate-400 hover:!text-white hover:!bg-slate-900/60 transition-colors" />

          {/* Sign Out Button (Red) */}
          <button
            type="button"
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-red-500 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4 text-red-500" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* TOP HEADER */}
        <header className="h-[72px] flex items-center justify-between px-8 border-b border-slate-800/80 bg-[#080b12] shrink-0">
          <h1 className="text-xl text-slate-200 font-semibold tracking-tight">System Administration</h1>
          <div className="flex items-center gap-4">
            {/* Refresh Icon */}
            <button
              onClick={fetchData}
              className="p-2.5 rounded-xl bg-[#101422] hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors cursor-pointer"
              title="Refresh Analytics"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-indigo-400" : ""}`} />
            </button>
          </div>
        </header>

        {/* SCROLLABLE BODY */}
        <main className="flex-1 overflow-y-auto p-8">
          {/* Error Notification */}
          {errorBanner && (
            <div className="mb-6 p-4 rounded-xl bg-red-950/40 border border-red-800/60 text-red-300 flex items-center gap-3 text-sm animate-fade-in">
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <span>{errorBanner}</span>
            </div>
          )}

          {/* 4 STAT CARDS GRID */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* Photographers */}
            <div className="bg-[#0e1320] border border-slate-800/80 rounded-2xl p-5 shadow-lg flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-indigo-400 shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider font-mono">PHOTOGRAPHERS</p>
                <div className="text-2xl font-bold text-white font-mono mt-0.5">{stats.total_photographers}</div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">Registered studio accounts</p>
              </div>
            </div>

            {/* Storage Used */}
            <div className="bg-[#0e1320] border border-slate-800/80 rounded-2xl p-5 shadow-lg flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-cyan-400 shrink-0">
                <HardDrive className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider font-mono">STORAGE USED</p>
                <div className="text-2xl font-bold text-white font-mono mt-0.5">{stats.total_storage_used_gb} GB</div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">Total allocated space used</p>
              </div>
            </div>

            {/* Active Galleries */}
            <div className="bg-[#0e1320] border border-slate-800/80 rounded-2xl p-5 shadow-lg flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-emerald-400 shrink-0">
                <FolderLock className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider font-mono">ACTIVE GALLERIES</p>
                <div className="text-2xl font-bold text-white font-mono mt-0.5">{stats.total_albums}</div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">Active galleries ({stats.total_photos} photos)</p>
              </div>
            </div>

            {/* System Health */}
            <div className="bg-[#0e1320] border border-slate-800/80 rounded-2xl p-5 shadow-lg flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-indigo-400 shrink-0">
                <Activity className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider font-mono">SYSTEM HEALTH</p>
                <div className="text-xl font-bold text-emerald-400 font-mono flex items-center gap-2 mt-0.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Operational</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">All systems running normally</p>
              </div>
            </div>
          </div>

        {/* Tab 1: Directory */}
        {activeTab === "directory" && (
          <AdminPhotographerTable
            filteredPhotographers={filteredPhotographers}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            loading={loading}
            actionLoadingId={actionLoadingId}
            handleToggleSuspend={handleToggleSuspend}
            handleTogglePlan={handleTogglePlan}
            handleResetPassword={handleResetPassword}
            handleEditQuota={handleEditQuota}
            handleDeletePhotographer={handleDeletePhotographer}
            formatBytes={formatBytes}
            onOpenRegisterModal={() => setIsRegisterModalOpen(true)}
          />
        )}

    {/* Tab: Global Dashboard Broadcasts */}
    {activeTab === "broadcasts" && (
      <section className="space-y-6 animate-fade-in">
        {/* Broadcast Creation & Live Banner Card */}
        <div className="p-6 rounded-2xl bg-[#0e121b] border border-sky-950/70 shadow-xl shadow-black/30 space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-indigo-950/60">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center text-sky-400 border border-sky-500/20 shadow-sm">
                <Megaphone className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                  <span>Dashboard Broadcasts</span>
                  {currentBroadcast && currentBroadcast.is_active && (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-medium bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      Live Banner Active
                    </span>
                  )}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Publish announcement banners to photographer dashboards.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={fetchBroadcasts}
              disabled={loadingBroadcasts}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-2 border border-slate-700/60 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingBroadcasts ? "animate-spin text-sky-400" : ""}`} />
              <span>Refresh</span>
            </button>
          </div>

          {/* Feedback banner */}
          {broadcastSuccessMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 flex items-center gap-2.5 text-xs animate-fade-in">
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{broadcastSuccessMsg}</span>
            </div>
          )}

          {/* Active Live Banner Showcase Card */}
          <div className="space-y-2">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider font-mono">
              Current Live Status
            </div>
            {currentBroadcast && currentBroadcast.is_active ? (
              <div className="p-4 rounded-xl bg-[#090c13] border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold tracking-wider ${
                        currentBroadcast.type === "warning"
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          : currentBroadcast.type === "promo"
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                          : "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                      }`}
                    >
                      {currentBroadcast.type || "INFO"}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      Published: {new Date(currentBroadcast.created_at).toLocaleString()}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white">
                    {currentBroadcast.title}
                  </h4>
                  <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">
                    {currentBroadcast.message}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeactivateBroadcast(currentBroadcast.id)}
                  disabled={deactivatingId === currentBroadcast.id}
                  className="px-4 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5 disabled:opacity-50"
                >
                  {deactivatingId === currentBroadcast.id && (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  )}
                  <span>Turn Off Banner</span>
                </button>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-[#080a0f] border border-indigo-950/70 text-slate-400 text-xs flex items-center justify-between">
                <span>No active announcements. Dashboards are currently clear.</span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">Status: Idle</span>
              </div>
            )}
          </div>

          {/* New Broadcast Composition Form */}
          <form onSubmit={handlePublishBroadcast} className="space-y-4 pt-2">
            <div className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider font-mono">
              New Announcement
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
              <div className="sm:col-span-8 space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Announcement Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Scheduled Maintenance or Platform Update"
                  value={broadcastForm.title}
                  onChange={(e) =>
                    setBroadcastForm({ ...broadcastForm, title: e.target.value })
                  }
                  className="w-full bg-[#080a0f] border border-indigo-950/80 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-400 transition-colors"
                />
              </div>
              <div className="sm:col-span-4 space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Type
                </label>
                <select
                  value={broadcastForm.type}
                  onChange={(e) =>
                    setBroadcastForm({ ...broadcastForm, type: e.target.value })
                  }
                  className="w-full bg-[#080a0f] border border-indigo-950/80 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-sky-400 transition-colors capitalize"
                >
                  <option value="info">Info</option>
                  <option value="warning">Warning</option>
                  <option value="promo">Promotion</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Message
              </label>
              <textarea
                required
                rows={3}
                placeholder="Enter announcement text for photographers..."
                value={broadcastForm.message}
                onChange={(e) =>
                  setBroadcastForm({ ...broadcastForm, message: e.target.value })
                }
                className="w-full bg-[#080a0f] border border-indigo-950/80 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-400 transition-colors resize-none"
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                <Zap className="w-3 h-3 text-sky-400" /> Publishing deactivates previous active announcements.
              </span>
              <button
                type="submit"
                disabled={isPublishingBroadcast}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-sky-500/20 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {isPublishingBroadcast ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span>Publishing...</span>
                  </>
                ) : (
                  <>
                    <Megaphone className="w-4 h-4 text-white" />
                    <span>Publish Announcement</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Historical Broadcast Announcements Table */}
        <div className="p-6 rounded-2xl bg-[#0e121b] border border-indigo-950/70 shadow-xl shadow-black/30 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-indigo-950/60">
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">
                Announcement History
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Past broadcast messages sent to users.
              </p>
            </div>
            <span className="text-xs font-mono text-slate-400">
              {broadcastList.length} Announcements
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-indigo-950/80 bg-[#080a0f]">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-indigo-950/80 bg-indigo-950/30 text-slate-400 uppercase tracking-wider font-mono">
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Title</th>
                  <th className="py-3 px-4">Message</th>
                  <th className="py-3 px-4">Created At</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-indigo-950/60 text-slate-300 font-sans">
                {loadingBroadcasts ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-500 dark:text-slate-400">
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
                        <span>Loading announcements...</span>
                      </div>
                    </td>
                  </tr>
                ) : broadcastList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500 dark:text-slate-400">
                      No broadcast announcements found.
                    </td>
                  </tr>
                ) : (
                  broadcastList.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-3 px-4">
                        {item.is_active ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5 w-fit">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            Active
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono text-slate-400 bg-slate-800/60 border border-slate-700/40 flex items-center gap-1.5 w-fit">
                            <span className="w-2 h-2 rounded-full bg-slate-50 dark:bg-[#111620]0" />
                            Archived
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider ${
                            item.type === "warning"
                              ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                              : item.type === "promo"
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                              : "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                          }`}
                        >
                          {item.type || "INFO"}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-white whitespace-nowrap">
                        {item.title}
                      </td>
                      <td className="py-3 px-4 max-w-md text-slate-300 truncate" title={item.message}>
                        {item.message}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                        {new Date(item.created_at).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {item.is_active ? (
                          <button
                            type="button"
                            onClick={() => handleDeactivateBroadcast(item.id)}
                            disabled={deactivatingId === item.id}
                            className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[11px] font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                          >
                            Deactivate
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-600 dark:text-slate-300 dark:text-slate-400 font-mono">-</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
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
                Audit Logs
              </h2>
              <p className="text-xs text-slate-400 font-sans">
                History of administrative actions and account changes.
              </p>
            </div>
          </div>
          <button
            onClick={fetchAuditLogs}
            disabled={loadingAuditLogs}
            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingAuditLogs ? "animate-spin text-amber-400" : ""}`} />
            <span>Refresh</span>
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
                  <td colSpan={5} className="py-12 text-center text-slate-500 dark:text-slate-400 font-sans">
                    {loadingAuditLogs ? "Loading audit records..." : "No audit records found."}
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
                        <span className="text-slate-600 dark:text-slate-300 dark:text-slate-400">—</span>
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
              <span>System Health & Errors</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-rose-500/20 text-rose-300 border border-rose-500/30">
                {systemErrors.length} {systemErrors.length === 1 ? "Incident" : "Incidents"}
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Monitor runtime errors and API incidents.
            </p>
          </div>

          <button
            type="button"
            onClick={fetchSystemErrors}
            disabled={loadingErrors}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-2 border border-slate-700/60 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingErrors ? "animate-spin" : ""}`} />
            <span>Refresh</span>
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
                  <td colSpan="5" className="py-12 text-center text-slate-500 dark:text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-5 h-5 animate-spin text-rose-400" />
                      <span>Scanning system error logs...</span>
                    </div>
                  </td>
                </tr>
              ) : systemErrors.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-12 text-center text-slate-500 dark:text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                        <Check className="w-5 h-5 stroke-[2.5]" />
                      </div>
                      <span className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        All Systems Operational
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">No unresolved system errors recorded.</span>
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
                        <details className="mt-1 text-[10px] text-slate-500 dark:text-slate-400 font-mono cursor-pointer">
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
      </div>

      {/* Register New Photographer Dialog/Modal */}
      {isRegisterModalOpen && (
        <div
          id="register-photographer-modal-overlay"
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
        >
          <div className="w-full max-w-xl rounded-2xl bg-[#0e121b] border border-slate-800 p-6 sm:p-7 shadow-2xl shadow-black/80 space-y-5 relative animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20 shrink-0">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">
                    Add Photographer
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Create a new photographer account with temporary credentials.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRegisterModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                title="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form inside Dialog */}
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Full Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Full Name / Studio
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dawit Studio"
                    value={registerForm.full_name}
                    onChange={(e) =>
                      setRegisterForm({ ...registerForm, full_name: e.target.value })
                    }
                    className="w-full bg-[#080a0f] border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40 transition-all"
                  />
                </div>

                {/* Email */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="photographer@example.com"
                    value={registerForm.email}
                    onChange={(e) =>
                      setRegisterForm({ ...registerForm, email: e.target.value })
                    }
                    className="w-full bg-[#080a0f] border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40 transition-all"
                  />
                </div>

                {/* Tier Plan */}
                <div className="space-y-1.5">
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
                      if (selectedPlan === "studio") {
                        setCustomQuotaGB(25);
                      } else {
                        setCustomQuotaGB(5);
                      }
                    }}
                    className="w-full bg-[#080a0f] border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40 transition-all"
                  >
                    <option value="basic">Basic (Default: 5 GB)</option>
                    <option value="studio">Studio (Default: 25 GB)</option>
                  </select>
                </div>

                {/* Storage Quota */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Storage Quota (GB)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    placeholder="5"
                    value={customQuotaGB}
                    onChange={(e) => setCustomQuotaGB(e.target.value)}
                    className="w-full bg-[#080a0f] border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40 transition-all font-mono"
                  />
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                    (Enter 9999 for Unlimited)
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsRegisterModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRegistering}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/25 active:scale-95 cursor-pointer"
                >
                  {isRegistering ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>Create Account</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Temporary Credentials Success Modal Overlay */}
      {createdCredentials && (
        <div
          id="photographer-created-modal-overlay"
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
        >
          <div className="w-full max-w-lg rounded-2xl bg-[#0e121b] border-2 border-indigo-500/60 p-6 shadow-2xl shadow-indigo-950/50 space-y-5 relative">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-wide">
                    Account Created
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Temporary login credentials:
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCreatedCredentials(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
                title="Dismiss"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="pt-2 flex flex-col gap-2 text-xs font-mono">
              <div className="flex justify-between items-center px-3 py-2 rounded-lg bg-black/50 border border-indigo-800/60">
                <span className="text-slate-400">User:</span>
                <strong className="text-white">{createdCredentials.full_name}</strong>
              </div>
              <div className="flex justify-between items-center px-3 py-2 rounded-lg bg-black/50 border border-indigo-800/60">
                <span className="text-slate-400">Email:</span>
                <strong className="text-white">{createdCredentials.email}</strong>
              </div>
              <div className="flex justify-between items-center px-3 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/30">
                <span className="text-indigo-300">Plan:</span>
                <strong className="text-indigo-300 uppercase">{createdCredentials.plan}</strong>
              </div>
            </div>

            {/* Temporary Password Box */}
            <div className="space-y-2 mt-4">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider font-mono">
                Temporary Password
              </label>
              <div className="flex items-center justify-between gap-3 bg-black/90 p-3.5 rounded-xl border border-indigo-500/40">
                <span className="font-mono text-xl font-bold tracking-widest text-indigo-300 select-all">
                  {createdCredentials.temp_password}
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(createdCredentials.temp_password)}
                  className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/30 active:scale-95 shrink-0"
                >
                  {hasCopiedPassword ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-300 stroke-[3]" />
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
            <div className="p-3.5 rounded-xl bg-indigo-950/40 border border-indigo-500/30 flex items-start gap-2.5 text-xs text-indigo-200/90 leading-relaxed mt-4">
              <AlertTriangle className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <p>
                <strong className="text-indigo-300 font-semibold">Security Warning:</strong> Please copy and deliver this temporary password immediately. The user will be required to change their password on next sign-in.
              </p>
            </div>

            {/* Footer Action */}
            <div className="pt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setCreatedCredentials(null)}
                className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/25 active:scale-95"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

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
                    Password Reset
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
                  className="px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-amber-500/20 active:scale-95 shrink-0 cursor-pointer"
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
                <strong className="text-amber-300 font-semibold">Security Note:</strong> Please share this temporary password with the user. It will not be shown again. The user must change it upon sign-in.
              </p>
            </div>

            {/* Footer Action */}
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setResetModalData(null)}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
