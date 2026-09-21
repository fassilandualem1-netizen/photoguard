import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { KeyRound, CheckCircle2, AlertCircle, Eye, EyeOff } from "lucide-react";

export default function ForceChangePassword({ onPasswordChanged }) {
  const { changePassword, logout } = useAuth();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword) {
      setError("Please fill out both password fields.");
      return;
    }

    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match. Please retype carefully.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await changePassword(newPassword);
      if (onPasswordChanged) {
        onPasswordChanged();
      }
    } catch (err) {
      let msg = "Failed to update password. Please try again.";
      const detail = err.response?.data?.detail ?? err.response?.data?.message ?? err.message;
      if (typeof detail === "string") {
        msg = detail;
      } else if (Array.isArray(detail)) {
        msg = detail.map((d) => (typeof d === "object" ? d.msg || JSON.stringify(d) : String(d))).join(". ");
      } else if (detail && typeof detail === "object") {
        msg = detail.msg || detail.message || JSON.stringify(detail);
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="force-password-container" className="min-h-screen w-full flex items-center justify-center bg-[#0d0f12] text-slate-100 p-4 sm:p-6">
      {/* Centered Glassmorphism Card */}
      <div className="w-full max-w-md rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-xl p-8 sm:p-10 shadow-2xl shadow-black/50">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4">
            <KeyRound className="w-6 h-6 text-amber-400" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white mb-2">
            Set Your Permanent Password
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-sm">
            As an enterprise security protocol, first-time photographer logins must replace the temporary administrative password.
          </p>
        </div>

        {error && (
          <div id="password-error-alert" className="mb-6 p-4 rounded-xl border border-red-500/20 bg-red-950/40 text-red-300 flex items-start gap-3 text-sm">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <span>{typeof error === "string" ? error : String(error?.msg || error?.message || "Failed to update password.")}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wider text-slate-400">
              New Password
            </label>
            <div className="relative">
              <input
                id="new-password-input"
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 6 characters"
                required
                className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/80 transition-all pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors p-1"
                aria-label="Toggle password visibility"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Confirm New Password
            </label>
            <input
              id="confirm-password-input"
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your password"
              required
              className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/80 transition-all"
            />
          </div>

          <div className="pt-2">
            <button
              id="submit-password-change-btn"
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-amber-400 py-3 font-semibold text-slate-950 transition-all hover:bg-amber-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-amber-500/10"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{loading ? "Updating Credentials..." : "Confirm & Access Studio"}</span>
            </button>
          </div>
        </form>

        <div className="mt-6 pt-6 border-t border-slate-800/80 text-center">
          <button
            id="cancel-logout-btn"
            type="button"
            onClick={logout}
            className="text-xs text-slate-400 hover:text-slate-200 transition-colors underline underline-offset-4"
          >
            Cancel and return to login
          </button>
        </div>
      </div>
    </div>
  );
}
