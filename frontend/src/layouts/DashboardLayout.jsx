import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import {
  Menu,
  X,
  ShieldCheck,
  KeyRound,
  User,
  LogOut,
  FolderOpen,
  PlusCircle,
  Users,
  Info,
  AlertTriangle,
  Megaphone,
  LayoutGrid
} from "lucide-react";

export default function DashboardLayout({ children }) {
  const { user, logout, isAdmin } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeBroadcast, setActiveBroadcast] = useState(null);
  const [isBannerDismissed, setIsBannerDismissed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const currentTab = searchParams.get("tab") || "albums";
  
  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location, searchParams]);

  // Fetch broadcast
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
      } catch (err) {}
    };
    fetchActiveBroadcast();
    return () => { isMounted = false; };
  }, []);

  const handleDismissBanner = () => {
    if (activeBroadcast?.id) {
      sessionStorage.setItem(`dismissed_broadcast_${activeBroadcast.id}`, "true");
    }
    setIsBannerDismissed(true);
  };

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return "0 GB";
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(1)} GB`;
  };

  const storageUsed = Number(user?.storage_used) || 0;
  const storageQuota = Number(user?.storage_quota_limit) > 0 ? Number(user.storage_quota_limit) : 5368709120;
  const storagePercentage = Math.min(100, Math.max(0, Math.round((storageUsed / storageQuota) * 100)));
  const isAssistant = user?.role === "assistant" || Boolean(user?.parent_id);

  const handleNavClick = (tabId) => {
    navigate(`/dashboard?tab=${tabId}`);
  };

  // Determine if a tab is active
  const isActive = (tabId) => {
    if (location.pathname.startsWith('/dashboard/albums/') && tabId === 'albums') return true;
    return location.pathname === '/dashboard' && currentTab === tabId;
  };

  const navItems = [
    { id: "albums", label: "Albums", icon: FolderOpen },
    { id: "clients", label: "Clients", icon: Users },
  ];

  if (!isAssistant) {
    navItems.push({ id: "profile", label: "Studio Profile", icon: User });
    navItems.push({ id: "assistants", label: "Assistants", icon: ShieldCheck });
  }
  
  navItems.push({ id: "password", label: "Password", icon: KeyRound });

  return (
    <div className="min-h-screen bg-[#F6F7FB] text-slate-900 flex font-sans selection:bg-indigo-100 selection:text-indigo-900">
      
      {/* Sidebar (Desktop) */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200 h-screen sticky top-0 z-30">
        <div className="p-6 flex items-center gap-3">
          {user?.studio_logo_url && !isAssistant ? (
            <img src={user.studio_logo_url} alt="Logo" className="h-8 max-w-[140px] object-contain" />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center">
              <LayoutGrid className="w-4 h-4 text-indigo-600" />
            </div>
          )}
          <span className="font-bold text-lg text-slate-900 tracking-tight">PhotoGuard</span>
        </div>

        <nav className="flex-1 px-4 py-4 flex flex-col gap-1 overflow-y-auto">
          {navItems.map((item) => {
            const active = isActive(item.id);
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active 
                    ? "bg-indigo-50 text-indigo-700" 
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? "text-indigo-600" : "text-slate-400"}`} />
                {item.label}
              </button>
            );
          })}

          {isAdmin && !isAssistant && (
            <Link
              to="/admin"
              className="mt-4 w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors"
            >
              <ShieldCheck className="w-4 h-4" />
              Admin Center
            </Link>
          )}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="mb-4 px-3">
            <div className="flex justify-between text-xs text-slate-500 mb-1.5">
              <span>Storage</span>
              <span>{storagePercentage}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div 
                className="h-full bg-indigo-500 rounded-full" 
                style={{ width: `${storagePercentage}%` }}
              />
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              {formatBytes(storageUsed)} of {formatBytes(storageQuota)}
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Column */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Mobile Header */}
        <header className="md:hidden bg-white border-b border-slate-200 sticky top-0 z-30">
          <div className="px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                <LayoutGrid className="w-3.5 h-3.5 text-indigo-600" />
              </div>
              <span className="font-bold text-base text-slate-900">PhotoGuard</span>
            </div>
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 text-slate-500 hover:text-slate-900"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </header>

        {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)}>
            <div 
              className="absolute right-0 top-0 bottom-0 w-64 bg-white shadow-2xl flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-4 border-b border-slate-100 flex justify-end">
                <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 text-slate-500 hover:text-slate-900">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <nav className="flex-1 overflow-y-auto p-4 flex flex-col gap-1">
                {navItems.map((item) => {
                  const active = isActive(item.id);
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavClick(item.id)}
                      className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors ${
                        active 
                          ? "bg-indigo-50 text-indigo-700" 
                          : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${active ? "text-indigo-600" : "text-slate-400"}`} />
                      {item.label}
                    </button>
                  );
                })}
              </nav>
              <div className="p-4 border-t border-slate-100">
                <button
                  onClick={logout}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Global Broadcast */}
        {activeBroadcast && !isBannerDismissed && (
          <div className={`px-4 py-2 text-xs flex items-center justify-between gap-3 ${
            activeBroadcast.type === 'warning' ? 'bg-amber-50 text-amber-800 border-b border-amber-200' :
            activeBroadcast.type === 'promo' ? 'bg-emerald-50 text-emerald-800 border-b border-emerald-200' :
            'bg-blue-50 text-blue-800 border-b border-blue-200'
          }`}>
            <div className="flex items-center gap-2 truncate">
              {activeBroadcast.type === 'warning' ? <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> : <Info className="w-3.5 h-3.5 shrink-0" />}
              <span className="truncate"><strong>{activeBroadcast.title}:</strong> {activeBroadcast.message}</span>
            </div>
            <button onClick={handleDismissBanner} className="shrink-0 p-1 hover:bg-black/5 rounded">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-8 max-w-6xl w-full mx-auto">
          {children}
        </main>
        
      </div>
    </div>
  );
}
