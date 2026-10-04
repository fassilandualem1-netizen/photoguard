import React, { useState, useEffect, createContext, useContext } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import {
  Menu,
  X,
  ShieldCheck,
  KeyRound,
  User,
  LogOut,
  HardDrive,
  ExternalLink,
  LifeBuoy,
  Users,
  AlertTriangle,
  Megaphone,
  Info,
  Search,
  LayoutDashboard,
  FolderLock,
  Sliders,
} from "lucide-react";

export const DashboardSearchContext = createContext({
  searchQuery: "",
  setSearchQuery: () => {},
});

export function useDashboardSearch() {
  return useContext(DashboardSearchContext);
}

export default function DashboardLayout({
  children,
  activeTab = "dashboard",
  onTabChange = () => {},
}) {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [activeBroadcast, setActiveBroadcast] = useState(null);
  const [isBannerDismissed, setIsBannerDismissed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const tabParam = searchParams.get("tab");
  const currentTab = tabParam || activeTab || "dashboard";

  // Fetch active broadcast announcement on mount
  useEffect(() => {
    let isMounted = true;
    const fetchActiveBroadcast = async () => {
      try {
        const response = await api.get("/api/v1/broadcasts/active");
        if (isMounted && response.data && response.data.is_active) {
          const dismissedId = sessionStorage.getItem(`dismissed_broadcast_${response.data.id}`);
          if (dismissedId !== "true") {
            setActiveBroadcast(response.data);
          }
        }
      } catch (err) {
        // Non-critical background feature; suppress error
      }
    };
    fetchActiveBroadcast();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleDismissBanner = () => {
    if (activeBroadcast?.id) {
      sessionStorage.setItem(`dismissed_broadcast_${activeBroadcast.id}`, "true");
    }
    setIsBannerDismissed(true);
  };

  const handleNavClick = (tab) => {
    setIsMobileSidebarOpen(false);
    onTabChange(tab);
    if (tab === "dashboard") {
      navigate("/dashboard");
    } else {
      navigate(`/dashboard?tab=${tab}`);
    }
  };

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return "0 GB";
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(1)} GB`;
  };

  const storageUsed = Number(user?.storage_used) || 0;
  const storageQuota = Number(user?.storage_quota_limit) > 0 ? Number(user.storage_quota_limit) : 5368709120;
  const storagePercentage = Math.min(100, Math.max(0, Math.round((storageUsed / storageQuota) * 100)));
  const userPlan = String(user?.subscription_plan || "").toLowerCase();
  const isAssistant = user?.role === "assistant" || Boolean(user?.parent_id);
  const isStudio = !isAssistant && (userPlan === "studio" || Boolean(isAdmin));

  // Shared Sidebar Navigation Component
  const renderSidebarNav = () => (
    <div className="flex flex-col h-full">
      {/* Brand Header */}
      <div className="p-5 flex items-center gap-3 border-b border-slate-800/80">
        <img src="/logo.svg" alt="PhotoGuard Logo" className="w-8 h-8 object-contain shrink-0" />
        <div>
          <div className="flex items-center gap-2">
            <span className="text-white font-bold text-lg tracking-tight">PhotoGuard</span>
            {isStudio ? (
              <span className="text-[10px] bg-orange-500/15 text-orange-400 px-2 py-0.5 rounded-full border border-orange-500/30 font-semibold uppercase">
                STUDIO
              </span>
            ) : (
              <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full border border-slate-700 font-mono uppercase">
                PRO
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Sections */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        {/* SECTION: MAIN */}
        <div className="text-[10px] text-slate-500 font-bold tracking-wider mb-2 mt-4 px-3 uppercase">
          MAIN
        </div>

        {/* Dashboard */}
        <button
          type="button"
          onClick={() => handleNavClick("dashboard")}
          className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-medium cursor-pointer transition-all duration-200 ${
            currentTab === "dashboard"
              ? "bg-white/5 text-white font-medium border-l-2 border-orange-500 rounded-r-xl rounded-l-none pl-3 shadow-sm"
              : "text-slate-400 hover:text-white hover:bg-white/[0.04] rounded-xl border-l-2 border-transparent"
          }`}
        >
          <LayoutDashboard className={`w-4 h-4 transition-colors duration-200 ${currentTab === "dashboard" ? "text-orange-400" : "text-slate-400"}`} />
          <span>Dashboard</span>
        </button>

        {/* Albums */}
        <button
          type="button"
          onClick={() => handleNavClick("albums")}
          className={`w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-medium cursor-pointer transition-all duration-200 ${
            currentTab === "albums"
              ? "bg-white/5 text-white font-medium border-l-2 border-orange-500 rounded-r-xl rounded-l-none pl-3 shadow-sm"
              : "text-slate-400 hover:text-white hover:bg-white/[0.04] rounded-xl border-l-2 border-transparent"
          }`}
        >
          <div className="flex items-center gap-3">
            <FolderLock className={`w-4 h-4 transition-colors duration-200 ${currentTab === "albums" ? "text-orange-400" : "text-slate-400"}`} />
            <span>Albums</span>
          </div>
        </button>

        {/* Clients */}
        <button
          type="button"
          onClick={() => handleNavClick("clients")}
          className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-medium cursor-pointer transition-all duration-200 ${
            currentTab === "clients"
              ? "bg-white/5 text-white font-medium border-l-2 border-orange-500 rounded-r-xl rounded-l-none pl-3 shadow-sm"
              : "text-slate-400 hover:text-white hover:bg-white/[0.04] rounded-xl border-l-2 border-transparent"
          }`}
        >
          <Users className={`w-4 h-4 transition-colors duration-200 ${currentTab === "clients" ? "text-orange-400" : "text-slate-400"}`} />
          <span>Clients</span>
        </button>

        {/* Storage with integrated inline progress bar */}
        <div className="pt-1">
          <button
            type="button"
            onClick={() => handleNavClick("storage")}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-medium cursor-pointer transition-all duration-200 ${
              currentTab === "storage"
                ? "bg-white/5 text-white font-medium border-l-2 border-orange-500 rounded-r-xl rounded-l-none pl-3 shadow-sm"
                : "text-slate-400 hover:text-white hover:bg-white/[0.04] rounded-xl border-l-2 border-transparent"
            }`}
          >
            <HardDrive className={`w-4 h-4 transition-colors duration-200 ${currentTab === "storage" ? "text-orange-400" : "text-slate-400"} shrink-0`} />
            <span>Storage</span>
          </button>

          {/* Integrated Inline Storage Progress Bar */}
          <div className="mt-2 mx-1 p-3 rounded-xl bg-slate-900/40 border border-slate-800/60">
            <div className="flex items-center justify-between text-[11px] mb-1.5">
              <span className="text-slate-400 font-medium">Used Space</span>
              <span className="font-mono text-orange-400/90 font-medium">
                {formatBytes(storageUsed)} / {formatBytes(storageQuota)}
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-400 transition-all duration-300"
                style={{ width: `${storagePercentage}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1.5">
              <span>{storagePercentage}% full</span>
              <span>{Math.max(0, 100 - storagePercentage)}% free</span>
            </div>
          </div>
        </div>

        {/* SECTION: STUDIO & BRANDING */}
        <div className="text-[10px] text-slate-500 font-bold tracking-wider mb-2 mt-6 px-3 uppercase">
          STUDIO & BRANDING
        </div>

        {/* Profile & Branding */}
        <button
          type="button"
          onClick={() => handleNavClick("profile")}
          className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-medium cursor-pointer transition-all duration-200 ${
            currentTab === "profile"
              ? "bg-white/5 text-white font-medium border-l-2 border-orange-500 rounded-r-xl rounded-l-none pl-3 shadow-sm"
              : "text-slate-400 hover:text-white hover:bg-white/[0.04] rounded-xl border-l-2 border-transparent"
          }`}
        >
          <User className={`w-4 h-4 transition-colors duration-200 ${currentTab === "profile" ? "text-orange-400" : "text-slate-400"}`} />
          <span>Profile & Branding</span>
        </button>

        {/* Studio Assistants */}
        <button
          type="button"
          onClick={() => handleNavClick("assistants")}
          className={`w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-medium cursor-pointer transition-all duration-200 ${
            currentTab === "assistants"
              ? "bg-white/5 text-white font-medium border-l-2 border-orange-500 rounded-r-xl rounded-l-none pl-3 shadow-sm"
              : "text-slate-400 hover:text-white hover:bg-white/[0.04] rounded-xl border-l-2 border-transparent"
          }`}
        >
          <div className="flex items-center gap-3">
            <Users className={`w-4 h-4 transition-colors duration-200 ${currentTab === "assistants" ? "text-orange-400" : "text-slate-400"}`} />
            <span>Studio Assistants</span>
          </div>
          {isStudio && (
            <span className="text-[9px] font-bold text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded border border-orange-500/20">
              STUDIO
            </span>
          )}
        </button>

        {/* SECTION: ACCOUNT & RESOURCES */}
        <div className="text-[10px] text-slate-500 font-bold tracking-wider mb-2 mt-6 px-3 uppercase">
          ACCOUNT & RESOURCES
        </div>

        {/* Account Settings */}
        <button
          type="button"
          onClick={() => handleNavClick("settings")}
          className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-medium cursor-pointer transition-all duration-200 ${
            currentTab === "settings"
              ? "bg-white/5 text-white font-medium border-l-2 border-orange-500 rounded-r-xl rounded-l-none pl-3 shadow-sm"
              : "text-slate-400 hover:text-white hover:bg-white/[0.04] rounded-xl border-l-2 border-transparent"
          }`}
        >
          <Sliders className={`w-4 h-4 transition-colors duration-200 ${currentTab === "settings" ? "text-orange-400" : "text-slate-400"}`} />
          <span>Account Settings</span>
        </button>

        {/* Change Password */}
        <button
          type="button"
          onClick={() => handleNavClick("password")}
          className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-medium cursor-pointer transition-all duration-200 ${
            currentTab === "password"
              ? "bg-white/5 text-white font-medium border-l-2 border-orange-500 rounded-r-xl rounded-l-none pl-3 shadow-sm"
              : "text-slate-400 hover:text-white hover:bg-white/[0.04] rounded-xl border-l-2 border-transparent"
          }`}
        >
          <KeyRound className={`w-4 h-4 transition-colors duration-200 ${currentTab === "password" ? "text-orange-400" : "text-slate-400"}`} />
          <span>Change Password</span>
        </button>

        {/* Support / Help */}
        <a
          href="https://t.me/fassilandualem"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium text-slate-400 hover:text-sky-300 hover:bg-white/[0.04] transition-all duration-200 group border-l-2 border-transparent"
        >
          <div className="flex items-center gap-3">
            <LifeBuoy className="w-4 h-4 text-sky-400" />
            <span>Support / Help</span>
          </div>
          <ExternalLink className="w-3.5 h-3.5 text-slate-600 group-hover:text-sky-300 transition-colors" />
        </a>

        {/* SECTION: SESSION */}
        <div className="text-[10px] text-slate-500 font-bold tracking-wider mb-2 mt-6 px-3 uppercase">
          SESSION
        </div>

        {/* Sign Out */}
        <button
          type="button"
          onClick={() => {
            setIsMobileSidebarOpen(false);
            logout();
          }}
          className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all duration-200 cursor-pointer border-l-2 border-transparent"
        >
          <LogOut className="w-4 h-4 text-red-400" />
          <span>Sign Out</span>
        </button>
      </nav>
    </div>
  );

  return (
    <DashboardSearchContext.Provider value={{ searchQuery, setSearchQuery }}>
      <div id="dashboard-layout" className="flex h-screen bg-[#07090e] text-slate-100 font-sans overflow-hidden">
        {/* Desktop Sidebar (w-64 bg-[#0b1019]) */}
        <aside className="hidden md:flex w-64 bg-[#0b1019] border-r border-slate-800 flex-col shrink-0 h-full select-none z-30">
          {renderSidebarNav()}
        </aside>

        {/* Mobile Sidebar Slide-over Drawer */}
        {isMobileSidebarOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex">
            <div
              className="fixed inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setIsMobileSidebarOpen(false)}
            />
            <aside className="relative w-64 bg-[#0b1019] border-r border-slate-800 flex flex-col h-full z-10 shadow-2xl">
              <div className="absolute top-4 right-4 z-20">
                <button
                  type="button"
                  onClick={() => setIsMobileSidebarOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              {renderSidebarNav()}
            </aside>
          </div>
        )}

        {/* Main Body Column (Header + Banner + Content) */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          {/* Top Header (bg-[#0e131f]) */}
          <header className="h-16 bg-[#0e131f] border-b border-slate-800 px-4 sm:px-6 flex items-center justify-between gap-4 shrink-0 z-20">
            {/* Mobile Sidebar Hamburger Toggle */}
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
              className="md:hidden p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              aria-label="Toggle Navigation"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Wide Search Bar aligned to the left/center */}
            <div className="relative flex-1 max-w-md sm:max-w-lg">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by title, client name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/20 transition-all"
              />
            </div>

            {/* Top Right Header Controls */}
            <div className="flex items-center gap-3 sm:gap-4 shrink-0">
              {/* Admin Center Switcher */}
              {isAdmin && (
                <Link
                  to="/admin"
                  id="back-to-admin-btn"
                  className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-indigo-300 hover:text-white text-xs font-semibold transition-all shadow-sm"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Admin Center</span>
                </Link>
              )}

              {/* Highly Detailed Profile Widget: Avatar ('F'), Name, Email, Studio Tier badge */}
              <div
                onClick={() => handleNavClick("settings")}
                className="flex items-center gap-3 pl-2 sm:pl-3 py-1 cursor-pointer hover:opacity-90 transition-opacity"
                title="Open Account Settings"
              >
                {/* Avatar (Circle with 'F') */}
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-amber-500 to-orange-500 text-slate-950 font-bold text-sm flex items-center justify-center shadow-md shadow-orange-500/20 shrink-0">
                  {(user?.full_name || "F").charAt(0).toUpperCase()}
                </div>

                {/* Name, Email, and Orange/Gold "Studio Tier" Badge Stacked Neatly */}
                <div className="hidden sm:flex flex-col text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white leading-tight">
                      {user?.full_name || "Photographer"}
                    </span>
                    <span className="text-[10px] font-semibold text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-full border border-orange-500/30 leading-none">
                      {isStudio ? "Studio Tier" : (user?.subscription_plan ? `${user.subscription_plan} Tier` : "Studio Tier")}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 leading-tight mt-0.5 truncate max-w-[170px]">
                    {user?.email || "photographer@photoguard.com"}
                  </span>
                </div>
              </div>
            </div>
          </header>

          {/* Global Broadcast Banner (if active) */}
          {activeBroadcast && !isBannerDismissed && (
            <aside
              id="global-broadcast-banner"
              aria-label="Platform Announcement"
              className={`relative z-10 w-full border-b px-4 py-2 sm:px-6 transition-all shrink-0 ${
                activeBroadcast.type === "warning"
                  ? "bg-amber-500/15 border-amber-500/30 text-amber-200"
                  : activeBroadcast.type === "promo"
                  ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-200"
                  : "bg-sky-500/15 border-sky-500/30 text-sky-200"
              }`}
            >
              <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <span
                    className={`p-1 rounded-md flex-shrink-0 ${
                      activeBroadcast.type === "warning"
                        ? "bg-amber-500/20 text-amber-300"
                        : activeBroadcast.type === "promo"
                        ? "bg-emerald-500/20 text-emerald-300"
                        : "bg-sky-500/20 text-sky-300"
                    }`}
                  >
                    {activeBroadcast.type === "warning" ? (
                      <AlertTriangle className="w-3.5 h-3.5" />
                    ) : activeBroadcast.type === "promo" ? (
                      <Megaphone className="w-3.5 h-3.5" />
                    ) : (
                      <Info className="w-3.5 h-3.5" />
                    )}
                  </span>
                  <p className="truncate">
                    <strong className="font-semibold text-white mr-1.5">
                      {activeBroadcast.title}:
                    </strong>
                    <span className="opacity-95">{activeBroadcast.message}</span>
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleDismissBanner}
                  title="Dismiss announcement"
                  className="p-1 rounded-md hover:bg-black/20 text-slate-300 hover:text-white transition-colors flex-shrink-0"
                  aria-label="Dismiss banner"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </aside>
          )}

          {/* Main Content Area */}
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-[#07090e]">
            <div className="max-w-7xl mx-auto">
              {children}
            </div>
          </main>
        </div>
      </div>
    </DashboardSearchContext.Provider>
  );
}
