import React, { useState, useRef, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import {
  Menu,
  X,
  ShieldCheck,
  KeyRound,
  User,
  LogOut,
  HardDrive
} from "lucide-react";

export default function DashboardLayout({
  children,
  activeTab = "albums",
  onTabChange = () => {},
  onChangePasswordClick = () => {}
}) {
  const { user, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const menuRef = useRef(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return "0 GB";
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(1)} GB`;
  };

  const storageUsed = user?.storage_used || 0;
  const storageQuota = user?.storage_quota_limit || 5368709120;
  const storagePercentage = Math.min(100, Math.round((storageUsed / storageQuota) * 100));

  return (
    <div id="dashboard-layout" className="min-h-screen bg-[#0d0f12] text-slate-100 flex flex-col selection:bg-amber-500/20 selection:text-amber-200">
      {/* Pristine Minimalist Topbar */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-[#0d0f12]/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo / Brand */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center shadow-md shadow-amber-500/10">
              <ShieldCheck className="w-4 h-4 text-black stroke-[2.2]" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-semibold text-base sm:text-lg tracking-tight text-white">PhotoGuard</span>
              <span className="hidden sm:inline-block text-[11px] px-2 py-0.5 rounded-full border border-slate-700/80 bg-slate-800/60 text-slate-300 font-medium capitalize">
                {user?.subscription_plan || "Basic"}
              </span>
            </div>
          </div>

          {/* Quick Storage Indicator (Desktop Only, Subdued & Clean) */}
          <div className="hidden md:flex items-center gap-4 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <HardDrive className="w-3.5 h-3.5 text-slate-500" />
              <span>{formatBytes(storageUsed)} / {formatBytes(storageQuota)}</span>
            </div>
            <div className="w-24 h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-amber-400 rounded-full transition-all duration-300"
                style={{ width: `${storagePercentage}%` }}
              />
            </div>
          </div>

          {/* Clean Hamburger Menu Trigger (All Actions Hidden Behind This) */}
          <div className="relative" ref={menuRef}>
            <button
              id="hamburger-menu-btn"
              type="button"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800/80 hover:border-slate-700 transition-all text-slate-300 hover:text-white"
              aria-label="Open Navigation Menu"
            >
              <span className="text-xs font-medium max-w-[120px] truncate hidden sm:inline">
                {user?.full_name || "Account"}
              </span>
              {isMenuOpen ? (
                <X className="w-4 h-4 text-slate-300" />
              ) : (
                <Menu className="w-4 h-4 text-slate-300" />
              )}
            </button>

            {/* Pristine Glassmorphism Dropdown */}
            {isMenuOpen && (
              <div
                id="hamburger-dropdown-menu"
                className="absolute right-0 mt-2 w-64 rounded-2xl border border-slate-800 bg-slate-900/95 backdrop-blur-xl shadow-2xl shadow-black/80 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
              >
                {/* User Header Section */}
                <div className="px-4 py-3 border-b border-slate-800/80">
                  <p className="text-xs font-medium text-white truncate">{user?.full_name}</p>
                  <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                    <span className="capitalize">{user?.role}</span>
                    <span className="text-amber-400/90 font-medium capitalize">{user?.subscription_plan} Tier</span>
                  </div>
                </div>

                {/* Storage Quick View on Mobile */}
                <div className="md:hidden px-4 py-2.5 border-b border-slate-800/80 text-xs">
                  <div className="flex justify-between text-slate-400 mb-1">
                    <span>Cloud Storage</span>
                    <span>{formatBytes(storageUsed)} / {formatBytes(storageQuota)}</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-amber-400 rounded-full"
                      style={{ width: `${storagePercentage}%` }}
                    />
                  </div>
                </div>

                {/* Menu Items */}
                <div className="py-1">
                  <button
                    id="menu-profile-btn"
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      setIsProfileModalOpen(true);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors text-left"
                  >
                    <User className="w-4 h-4 text-slate-400" />
                    <span>Studio Profile</span>
                  </button>

                  <button
                    id="menu-change-password-btn"
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onChangePasswordClick();
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors text-left"
                  >
                    <KeyRound className="w-4 h-4 text-slate-400" />
                    <span>Change Password</span>
                  </button>
                </div>

                {/* Logout Action */}
                <div className="pt-1 border-t border-slate-800/80">
                  <button
                    id="menu-logout-btn"
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      logout();
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors text-left font-medium"
                  >
                    <LogOut className="w-4 h-4 text-red-400" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area: Pristine Canvas for the Masonry Grid */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Profile Modal (Minimalist) */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl text-left">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-white">Studio Profile</h3>
              <button
                type="button"
                onClick={() => setIsProfileModalOpen(false)}
                className="text-slate-500 hover:text-slate-300 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300 mb-6">
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-[11px] text-slate-500 block mb-0.5">Photographer Name</span>
                <span className="font-medium text-white">{user?.full_name}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-[11px] text-slate-500 block mb-0.5">Email Address</span>
                <span className="font-medium text-white">{user?.email}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-[11px] text-slate-500 block mb-0.5">Plan Status</span>
                <span className="font-medium text-amber-400 uppercase tracking-wider">{user?.subscription_plan} Plan</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-[11px] text-slate-500 block mb-0.5">Telegram Alerts</span>
                <span className="font-medium text-slate-200">
                  {user?.telegram_chat_id ? `Linked (Chat ID: ${user.telegram_chat_id})` : "Not connected"}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsProfileModalOpen(false)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
