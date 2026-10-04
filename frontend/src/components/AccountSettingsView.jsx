import React, { useState, useEffect, useRef } from "react";
import {
  Sliders,
  Shield,
  KeyRound,
  Eye,
  EyeOff,
  HardDrive,
  User,
  Mail,
  Check,
  AlertCircle,
  Loader2,
  ExternalLink,
  Sparkles,
  ShieldCheck,
  Send,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";

export default function AccountSettingsView({ defaultFocusPassword = false }) {
  const { user, refreshProfile, isAdmin } = useAuth();
  const passwordSectionRef = useRef(null);

  // Password Change Form State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState(null);
  const [passwordSuccess, setPasswordSuccess] = useState(null);

  // Auto scroll to password section if defaultFocusPassword is true
  useEffect(() => {
    if (defaultFocusPassword && passwordSectionRef.current) {
      passwordSectionRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [defaultFocusPassword]);

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return "0 GB";
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(2)} GB`;
  };

  const storageUsed = Number(user?.storage_used) || 0;
  const storageQuota = Number(user?.storage_quota_limit) > 0 ? Number(user.storage_quota_limit) : 5368709120; // 5GB default
  const storagePercentage = Math.min(100, Math.max(0, Math.round((storageUsed / storageQuota) * 100)));
  const userPlan = String(user?.subscription_plan || "").toLowerCase();
  const isStudio = userPlan === "studio" || Boolean(isAdmin);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!currentPassword) {
      setPasswordError("Please enter your current password.");
      return;
    }

    if (!newPassword) {
      setPasswordError("Please enter a new password.");
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match. Please verify and retype.");
      return;
    }

    if (currentPassword === newPassword) {
      setPasswordError("New password must be different from your current password.");
      return;
    }

    setIsChangingPassword(true);

    try {
      try {
        await api.put("/api/auth/change-password", {
          current_password: currentPassword,
          new_password: newPassword,
          confirm_password: confirmPassword,
        });
      } catch (firstErr) {
        await api.put("/api/v1/users/change-password", {
          current_password: currentPassword,
          new_password: newPassword,
          confirm_password: confirmPassword,
        });
      }

      setPasswordSuccess("Your password has been changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);

      if (refreshProfile) {
        await refreshProfile();
      }
    } catch (err) {
      const detail = err.response?.data?.detail || "Failed to update password. Please check your credentials.";
      setPasswordError(detail);
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div id="account-settings-view" className="space-y-6 max-w-4xl">
      {/* Title Section */}
      <div className="pb-2">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Account Settings & Security
          </h1>
          <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 text-xs font-semibold uppercase tracking-wider">
            {isStudio ? "Studio Plan" : "Pro Plan"}
          </span>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Manage your photographer credentials, monitor storage allocation, and configure account security.
        </p>
      </div>

      {/* Profile Overview Card */}
      <div className="p-6 rounded-2xl bg-[#151a23] border border-slate-800 space-y-5">
        <div className="flex items-center gap-2.5">
          <User className="w-4 h-4 text-orange-400" />
          <h2 className="text-sm font-semibold text-white">Photographer Profile</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80">
            <span className="text-[11px] font-medium text-slate-400 block mb-1">Full Name</span>
            <p className="text-sm font-semibold text-white">{user?.full_name || "Photographer"}</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80">
            <span className="text-[11px] font-medium text-slate-400 block mb-1">Email Address</span>
            <p className="text-sm font-semibold text-white font-mono text-xs">{user?.email || "photographer@photoguard.com"}</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80">
            <span className="text-[11px] font-medium text-slate-400 block mb-1">Account Role</span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs font-semibold text-white capitalize">{user?.role || "Photographer"}</span>
              {isAdmin && (
                <span className="text-[10px] bg-indigo-500/15 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/30 font-semibold">
                  Administrator
                </span>
              )}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80">
            <span className="text-[11px] font-medium text-slate-400 block mb-1">Subscription Plan</span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-xs font-bold uppercase tracking-wider ${isStudio ? "text-orange-400" : "text-slate-300"}`}>
                {user?.subscription_plan || "Pro"} Tier
              </span>
              {isStudio && (
                <span className="text-[10px] bg-orange-500/15 text-orange-400 px-2 py-0.5 rounded-full border border-orange-500/30 font-semibold">
                  Unlimited Staff
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Storage Breakdown Card */}
      <div id="storage-breakdown-section" className="p-6 rounded-2xl bg-[#151a23] border border-slate-800 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <HardDrive className="w-4 h-4 text-orange-400" />
            <h2 className="text-sm font-semibold text-white">Storage Usage & Allocation</h2>
          </div>
          <span className="text-[11px] font-mono text-orange-400 font-semibold">
            {formatBytes(storageUsed)} of {formatBytes(storageQuota)}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="w-full h-3 rounded-full bg-slate-900 border border-slate-800 overflow-hidden p-0.5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-500"
              style={{ width: `${storagePercentage}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
            <span>{storagePercentage}% capacity utilized</span>
            <span>{formatBytes(Math.max(0, storageQuota - storageUsed))} available</span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/40 border border-slate-800/60 text-xs text-slate-400 flex items-center justify-between gap-3">
          <span>Need more storage capacity for client galleries?</span>
          <a
            href="https://t.me/fassilandualem"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-orange-400 hover:text-orange-300 font-semibold hover:underline"
          >
            <span>Request Quota Increase</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Change Password Card */}
      <div
        ref={passwordSectionRef}
        id="change-password-section"
        className="p-6 rounded-2xl bg-[#151a23] border border-slate-800 space-y-5"
      >
        <div className="flex items-center gap-2.5">
          <KeyRound className="w-4 h-4 text-orange-400" />
          <h2 className="text-sm font-semibold text-white">Change Account Password</h2>
        </div>

        {passwordError && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center gap-3">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{passwordError}</span>
          </div>
        )}

        {passwordSuccess && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-3">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{passwordSuccess}</span>
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-4 max-w-lg">
          {/* Current Password */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Current Password
            </label>
            <div className="relative">
              <input
                type={showCurrentPassword ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                disabled={isChangingPassword}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-orange-500/60 pr-10 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              New Password
            </label>
            <div className="relative">
              <input
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                disabled={isChangingPassword}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-orange-500/60 pr-10 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm New Password */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Confirm New Password
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-type new password"
                disabled={isChangingPassword}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-orange-500/60 pr-10 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isChangingPassword || !currentPassword || !newPassword || !confirmPassword}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-slate-950 font-semibold text-xs tracking-wide shadow-md shadow-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              {isChangingPassword ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Updating Password...</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Update Password</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
