import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Lock, Mail, ShieldCheck, ArrowRight, AlertCircle, Eye, EyeOff } from "lucide-react";

export default function Login({ onLoginSuccess }) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const user = await login(email, password);
      if (onLoginSuccess) {
        onLoginSuccess(user);
      }
    } catch (err) {
      const msg =
        err.response?.data?.detail ||
        "Authentication failed. Please check your credentials.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="login-container" className="min-h-screen w-full flex bg-[#0d0f12] text-slate-100 selection:bg-amber-500/20 selection:text-amber-200">
      {/* Left Column: Frosted Glass Form */}
      <div className="w-full lg:w-[480px] xl:w-[540px] flex flex-col justify-between p-8 sm:p-12 lg:p-16 relative z-10">
        <div>
          {/* Brand Header */}
          <div className="flex items-center gap-3 mb-14">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center shadow-lg shadow-amber-500/10">
              <ShieldCheck className="w-5 h-5 text-black stroke-[2.2]" />
            </div>
            <div>
              <span className="font-semibold text-lg tracking-tight text-white">PhotoGuard</span>
              <span className="text-xs px-2 py-0.5 ml-2 rounded-full border border-slate-700/80 bg-slate-800/60 text-slate-300 font-medium">Enterprise</span>
            </div>
          </div>

          {/* Welcome Text */}
          <div className="mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-2">Welcome back</h1>
            <p className="text-sm text-slate-400 leading-relaxed">
              Sign in to manage your client galleries, monitor selections, and protect high-resolution proofs.
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div id="login-error-alert" className="mb-6 p-4 rounded-xl border border-red-500/20 bg-red-950/40 text-red-300 flex items-start gap-3 text-sm">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wider text-slate-400">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="email-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="photographer@studio.com"
                  required
                  autoComplete="email"
                  className="w-full bg-slate-900/60 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/80 transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium uppercase tracking-wider text-slate-400">Password</label>
                <span className="text-xs text-slate-500">Contact admin if forgotten</span>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="password-input"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="w-full bg-slate-900/60 border border-slate-800 rounded-xl pl-10 pr-11 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/80 transition-all"
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

            <button
              id="submit-login-btn"
              type="submit"
              disabled={loading}
              className="w-full mt-2 group relative overflow-hidden rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 p-[1px] font-medium text-black transition-all hover:shadow-lg hover:shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center justify-center gap-2 rounded-[11px] bg-amber-400 px-5 py-3 font-semibold text-slate-950 transition-all group-hover:bg-amber-300">
                <span>{loading ? "Authenticating..." : "Access Studio"}</span>
                {!loading && <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />}
              </div>
            </button>
          </form>
        </div>

        {/* Footer Info */}
        <div className="pt-8 border-t border-slate-800/80 mt-12 text-xs text-slate-500 flex items-center justify-between">
          <span>Protected by PhotoGuard Security</span>
          <span>v7.2 Enterprise</span>
        </div>
      </div>

      {/* Right Column: Visual Showcase & Masonry Placeholder */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden bg-gradient-to-br from-slate-900 via-[#10141b] to-black items-center justify-center p-12">
        {/* Subtle Background Pattern */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-500/10 via-slate-900/0 to-transparent pointer-events-none" />
        
        <div className="relative w-full max-w-xl">
          {/* Aesthetic Masonry Frame Showcase */}
          <div className="grid grid-cols-2 gap-4 opacity-85">
            <div className="space-y-4">
              <div className="h-64 rounded-2xl bg-gradient-to-b from-slate-800/70 to-slate-900/60 border border-slate-700/40 backdrop-blur-md p-6 flex flex-col justify-end">
                <span className="text-xs uppercase tracking-widest text-amber-400/90 font-mono mb-1">Live Sync</span>
                <p className="text-sm font-medium text-slate-200">Collaborative multi-device client selection without WebSockets.</p>
              </div>
              <div className="h-44 rounded-2xl bg-gradient-to-b from-slate-800/40 to-slate-900/50 border border-slate-700/30 backdrop-blur-md p-5 flex flex-col justify-end">
                <span className="text-xs uppercase tracking-widest text-slate-400 font-mono mb-1">RAM-Only</span>
                <p className="text-sm font-medium text-slate-300">FLAG_SECURE zero-leak mobile rendering.</p>
              </div>
            </div>

            <div className="space-y-4 pt-8">
              <div className="h-48 rounded-2xl bg-gradient-to-b from-slate-800/50 to-slate-900/70 border border-slate-700/30 backdrop-blur-md p-5 flex flex-col justify-end">
                <span className="text-xs uppercase tracking-widest text-slate-400 font-mono mb-1">Atomic Lock</span>
                <p className="text-sm font-medium text-slate-300">Instant single-submit protection for family reviews.</p>
              </div>
              <div className="h-60 rounded-2xl bg-gradient-to-b from-slate-800/60 to-slate-900/80 border border-slate-700/40 backdrop-blur-md p-6 flex flex-col justify-end">
                <span className="text-xs uppercase tracking-widest text-amber-400/90 font-mono mb-1">Proof Security</span>
                <p className="text-sm font-medium text-slate-200">Smart WebP edge compression with lossless master delivery.</p>
              </div>
            </div>
          </div>

          <div className="mt-8 text-center">
            <p className="text-xs text-slate-500 tracking-wider uppercase font-mono">
              Designed for professional wedding & commercial photographers
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
Login.defaultProps = {
  onLoginSuccess: undefined,
};
