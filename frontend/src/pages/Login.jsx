import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import {
  Lock,
  Mail,
  ArrowRight,
  AlertCircle,
  Eye,
  EyeOff,
  Sun,
  Moon
} from "lucide-react";

/**
 * Ultra-vivid Crimson-to-Amber Luxury Logo:
 * Obsidian Shield containing a 6-Blade Aperture Iris and Platinum/Gold Optical Sensor Lock
 * Gradient: #FF1A4B to #F59E0B
 */
export function PhotoGuardLuxuryLogo({ className = "w-12 h-12" }) {
  return (
    <svg
      viewBox="0 0 512 512"
      className={`${className} shrink-0 drop-shadow-[0_8px_24px_rgba(255,26,75,0.4)]`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Luxury Crimson-to-Amber Gradient */}
        <linearGradient id="pgLuxuryGradInline" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FF1A4B" />
          <stop offset="45%" stopColor="#FF4D36" />
          <stop offset="100%" stopColor="#F59E0B" />
        </linearGradient>

        {/* Obsidian Carbon/Armor Shield Surface */}
        <linearGradient id="pgObsidianInline" x1="20%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%" stopColor="#161B26" />
          <stop offset="50%" stopColor="#0B0E14" />
          <stop offset="100%" stopColor="#05070A" />
        </linearGradient>

        {/* Optical Sensor Gold & Platinum Highlights */}
        <linearGradient id="pgSensorGoldInline" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFFBEB" />
          <stop offset="35%" stopColor="#FDE68A" />
          <stop offset="70%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#D97706" />
        </linearGradient>

        <linearGradient id="pgPlatinumInline" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="45%" stopColor="#E2E8F0" />
          <stop offset="100%" stopColor="#94A3B8" />
        </linearGradient>
      </defs>

      {/* Outer Obsidian Shield with Crimson-to-Amber Contour */}
      <path
        d="M256,50 L416,115 C416,276 334,402 256,462 C178,402 96,276 96,115 Z"
        fill="url(#pgObsidianInline)"
        stroke="url(#pgLuxuryGradInline)"
        strokeWidth="12"
        strokeLinejoin="round"
      />

      {/* Inner Bevel Shield Rim */}
      <path
        d="M256,76 L392,132 C392,266 324,374 256,426 C188,374 120,266 120,132 Z"
        fill="none"
        stroke="#FFFFFF"
        strokeOpacity="0.14"
        strokeWidth="3"
      />

      {/* 6-Blade Aperture Outer Lens Barrel */}
      <circle cx="256" cy="246" r="96" fill="#040609" stroke="url(#pgLuxuryGradInline)" strokeWidth="5" strokeOpacity="0.85" />
      <circle cx="256" cy="246" r="88" fill="none" stroke="url(#pgPlatinumInline)" strokeWidth="1.5" strokeOpacity="0.35" strokeDasharray="6 4" />

      {/* 6-Blade Aperture Iris Geometry */}
      <g transform="translate(256, 246)">
        <path d="M0,-84 L54,-24 L16,-38 Z" fill="url(#pgLuxuryGradInline)" opacity="0.95" />
        <path d="M73,-42 L48,34 L21,8 Z" fill="url(#pgLuxuryGradInline)" opacity="0.9" />
        <path d="M73,42 L-6,58 L6,25 Z" fill="url(#pgLuxuryGradInline)" opacity="0.85" />
        <path d="M0,84 L-54,24 L-16,38 Z" fill="url(#pgLuxuryGradInline)" opacity="0.95" />
        <path d="M-73,42 L-48,-34 L-21,-8 Z" fill="url(#pgLuxuryGradInline)" opacity="0.9" />
        <path d="M-73,-42 L6,-58 L-6,-25 Z" fill="url(#pgLuxuryGradInline)" opacity="0.85" />
      </g>

      {/* Platinum / Gold Optical Sensor Core & Vault Lock */}
      <circle cx="256" cy="246" r="44" fill="#07090E" stroke="url(#pgSensorGoldInline)" strokeWidth="5" />
      <circle cx="256" cy="246" r="36" fill="none" stroke="url(#pgPlatinumInline)" strokeWidth="1.5" strokeOpacity="0.75" />
      <circle cx="256" cy="246" r="24" fill="url(#pgObsidianInline)" stroke="url(#pgLuxuryGradInline)" strokeWidth="2.5" />

      {/* Vault Optical Sensor Lock Component */}
      <rect x="245" y="241" width="22" height="17" rx="4" fill="url(#pgSensorGoldInline)" />
      <path
        d="M250,241 L250,233 C250,229.7 252.7,227 256,227 C259.3,227 262,229.7 262,233 L262,241"
        fill="none"
        stroke="url(#pgSensorGoldInline)"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="256" cy="248.5" r="2.2" fill="#090B10" />

      {/* Optical Lens Glint Reflection */}
      <circle cx="234" cy="224" r="7" fill="#FFFFFF" opacity="0.8" />
      <circle cx="241" cy="231" r="3" fill="#FFFFFF" opacity="0.95" />
    </svg>
  );
}

export function formatLoginError(err) {
  if (!err) return "Authentication failed. Please check your credentials.";
  const detail = err.response?.data?.detail ?? err.response?.data?.message ?? err.message;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          const locParts = Array.isArray(item.loc) ? item.loc.filter((l) => l !== "body" && l !== "query") : [];
          const field = locParts.join(" ");
          const msg = item.msg || item.message || JSON.stringify(item);
          return field ? `${field}: ${msg}` : msg;
        }
        return String(item);
      })
      .filter(Boolean)
      .join(". ");
  }
  if (detail && typeof detail === "object") {
    return detail.msg || detail.message || JSON.stringify(detail);
  }
  return "Authentication failed. Please verify your credentials.";
}

class LoginErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("[PhotoGuard Login ErrorBoundary Caught]", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full flex items-center justify-center bg-[#07090c] text-white p-6">
          <div className="max-w-md w-full p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-4 shadow-2xl">
            <div className="w-12 h-12 mx-auto rounded-xl bg-red-500/20 text-red-600 flex items-center justify-center font-bold text-xl">
              !
            </div>
            <h2 className="text-xl font-bold">Authentication Console Alert</h2>
            <p className="text-xs text-slate-400">
              {String(this.state.error?.message || "An unexpected error occurred during rendering.")}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#FF1A4B] to-[#F59E0B] text-white font-bold text-sm shadow-lg shadow-amber-500/25 transition-all"
            >
              Reload Login Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function LoginContent({ onLoginSuccess }) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { theme, toggleTheme } = useTheme();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    const cleanPassword = password;

    if (!cleanEmail || !cleanPassword) {
      setError("Please enter your studio email and password.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const user = await login(cleanEmail, cleanPassword);
      if (onLoginSuccess) {
        onLoginSuccess(user);
      }
    } catch (err) {
      const msg = formatLoginError(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      id="login-container"
      className="min-h-screen w-full flex flex-col items-center justify-between p-4 sm:p-6 bg-[#F6F7FB] dark:bg-[#06080c] text-slate-900 dark:text-white selection:bg-indigo-100 selection:text-indigo-900 relative overflow-hidden"
    >
      {/* Premium Ambient Background Accents */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[540px] h-[540px] bg-gradient-to-tr from-indigo-500/10 via-sky-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-transparent via-[#F6F7FB]/60 to-[#F6F7FB] pointer-events-none" />

      {/* Spacer for optical vertical balance */}
      <div className="w-full h-4 hidden sm:block" />

      {/* Centered Login Card */}
      
        {/* Theme Toggle */}
        <button
          id="theme-toggle-login"
          onClick={toggleTheme}
          className="absolute top-4 right-4 z-50 p-2.5 rounded-full bg-white dark:bg-[#0b0e14] border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 shadow-sm transition-all"
        >
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <div className="w-full max-w-[440px] relative z-10 my-auto">
        <div className="p-8 sm:p-10 rounded-3xl bg-white dark:bg-[#0b0e14] border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 ">
          {/* Studio Brand Header */}
          <div className="flex flex-col items-center text-center mb-8">
            <div className="relative mb-4 group">
              <div className="absolute inset-0 rounded-2xl bg-indigo-500 blur-lg opacity-20 group-hover:opacity-40 transition-opacity" />
              <PhotoGuardLuxuryLogo className="w-16 h-16 relative" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-2xl tracking-tight text-slate-900 dark:text-white">PhotoGuard</span>
              <span className="text-[10px] uppercase tracking-widest px-2.5 py-0.5 rounded-full border border-indigo-200 bg-indigo-50 text-indigo-700 font-bold font-mono">
                Studio
              </span>
            </div>
          </div>

          {/* Welcome Text */}
          <div className="mb-6 text-center">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white mb-1.5">
              Sign in to your studio
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Manage your clients, albums, and proofs.
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <div
              id="login-error-alert"
              className="mb-6 p-3.5 rounded-xl border border-red-200 bg-red-50 text-red-700 flex items-start gap-3 text-xs sm:text-sm animate-in fade-in duration-200 shadow-lg shadow-red-100/50"
            >
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>
                {typeof error === "string" ? error : String(error?.msg || error?.message || "Authentication error")}
              </span>
            </div>
          )}

          {/* Clean Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 dark:text-slate-400">
                Studio Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 dark:text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="email-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="photographer@studio.com"
                  required
                  autoComplete="email"
                  className="w-full bg-white dark:bg-[#0b0e14] border border-slate-200 dark:border-slate-800 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/25 transition-all shadow-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 dark:text-slate-400">
                  Password
                </label>
                <span className="text-xs text-slate-500 dark:text-slate-400 cursor-default">
                  Provided by Admin
                </span>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 dark:text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="password-input"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  autoComplete="current-password"
                  className="w-full bg-white dark:bg-[#0b0e14] border border-slate-200 dark:border-slate-800 rounded-xl pl-10 pr-11 py-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/25 transition-all shadow-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-slate-300 dark:text-slate-400 transition-colors p-1"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              id="login-submit-btn"
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-indigo-600 border border-indigo-700 text-white font-bold text-sm hover:bg-indigo-700 active:scale-[0.99] transition-all duration-200 shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Studio</span>
                  <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Minimalist Professional Footer */}
      <footer className="relative z-10 py-3 text-center">
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
          © 2026 PhotoGuard Studio. All rights reserved.
        </p>
      </footer>
    </div>
  );
}

export default function Login(props) {
  return (
    <LoginErrorBoundary>
      <LoginContent {...props} />
    </LoginErrorBoundary>
  );
}

Login.defaultProps = {
  onLoginSuccess: undefined,
};
