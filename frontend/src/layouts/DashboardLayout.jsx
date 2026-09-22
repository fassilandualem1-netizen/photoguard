import React, { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
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
  Sparkles,
  LifeBuoy,
  Users,
} from "lucide-react";
import ProfileSettingsModal from "../components/ProfileSettingsModal";
import ChangePasswordModal from "../components/ChangePasswordModal";
import TeamManagementModal from "../components/TeamManagementModal";

export default function DashboardLayout({
  children,
  activeTab = "albums",
  onTabChange = () => {},
  onChangePasswordClick = () => {}
}) {
  const { user, logout, refreshProfile, isAdmin } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
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

  const storageUsed = Number(user?.storage_used) || 0;
  const storageQuota = Number(user?.storage_quota_limit) > 0 ? Number(user.storage_quota_limit) : 5368709120;
  const storagePercentage = Math.min(100, Math.max(0, Math.round((storageUsed / storageQuota) * 100)));
  const userPlan = String(user?.subscription_plan || "").toLowerCase();
  const isStudio = userPlan === "studio" || Boolean(isAdmin);

  return (
    <div id="dashboard-layout" className="min-h-screen bg-[#0d0f12] text-slate-100 flex flex-col selection:bg-amber-500/20 selection:text-amber-200">
      {/* Pristine Minimalist Topbar */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-[#0d0f12]/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo / Brand */}
          <div className="flex items-center gap-3">
            {user?.studio_logo_url && isStudio ? (
              <img
                src={user.studio_logo_url}
                alt={user.full_name || "Studio Logo"}
                className="h-9 max-w-[120px] object-contain rounded-lg"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            ) : (
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shadow-md"
                style={{
                  backgroundColor: user?.brand_color || "#F59E0B",
                  boxShadow: `0 4px 14px ${(user?.brand_color || "#F59E0B")}33`
                }}
              >
                <ShieldCheck className="w-4 h-4 text-black stroke-[2.2]" />
              </div>
            )}
            <div className="flex items-baseline gap-2">
              <span className="font-semibold text-base sm:text-lg tracking-tight text-white">
                {user?.studio_logo_url && isStudio ? user.full_name : "PhotoGuard"}
              </span>
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
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${storagePercentage}%`,
                  backgroundColor: user?.brand_color || "#F59E0B"
                }}
              />
            </div>
          </div>

          {/* Admin Back-to-Command Switcher */}
          {isAdmin && (
            <Link
              to="/admin"
              id="back-to-admin-btn"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-indigo-300 hover:text-white text-xs font-semibold transition-all shadow-sm"
            >
              <span>← Back to Admin Center</span>
            </Link>
          )}

          {/* Clean Hamburger Menu Trigger */}
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

            {/* Pristine Dropdown */}
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
                  {isAdmin && (
                    <Link
                      to="/admin"
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-indigo-300 hover:text-white hover:bg-indigo-950/40 transition-colors text-left"
                    >
                      <ShieldCheck className="w-4 h-4 text-indigo-400" />
                      <span>Switch to Admin Center</span>
                    </Link>
                  )}

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
                    <span>Studio Profile & Branding</span>
                  </button>

                  <button
                    id="menu-team-btn"
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      setIsTeamModalOpen(true);
                    }}
                    className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <Users className="w-4 h-4 text-amber-400" />
                      <span>Studio Assistants</span>
                    </div>
                    {isStudio && (
                      <span className="text-[10px] font-semibold text-amber-400/90 bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20">
                        Studio
                      </span>
                    )}
                  </button>

                  <button
                    id="menu-change-password-btn"
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      setIsChangePasswordModalOpen(true);
                      if (typeof onChangePasswordClick === "function") {
                        onChangePasswordClick();
                      }
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors text-left"
                  >
                    <KeyRound className="w-4 h-4 text-slate-400" />
                    <span>Change Password</span>
                  </button>

                  <a
                    id="menu-support-link"
                    href="https://t.me/fassilandualem"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setIsMenuOpen(false)}
                    className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-slate-300 hover:text-sky-300 hover:bg-slate-800/60 transition-colors text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <LifeBuoy className="w-4 h-4 text-sky-400" />
                      <span>Support</span>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-500 group-hover:text-sky-400 transition-colors" />
                  </a>
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

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Studio Profile & Telegram Settings Modal */}
      <ProfileSettingsModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={isChangePasswordModalOpen}
        onClose={() => setIsChangePasswordModalOpen(false)}
      />

      {/* Studio Assistants Team Management Modal */}
      <TeamManagementModal
        isOpen={isTeamModalOpen}
        onClose={() => setIsTeamModalOpen(false)}
      />
    </div>
  );
}
