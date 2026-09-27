import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { 
  Lock, 
  Mail, 
  ShieldCheck, 
  ArrowRight, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  Users,
  Download,
  Share2
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
            <div className="w-12 h-12 mx-auto rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center font-bold text-xl">
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
    <div id="login-container" className="min-h-screen w-full flex bg-[#06080c] text-slate-100 selection:bg-[#FF1A4B]/30 selection:text-amber-200">
      
      {/* Left Column: Pure, High-End Studio Authentication Console */}
      <div className="w-full lg:w-[480px] xl:w-[520px] flex flex-col justify-between p-8 sm:p-12 lg:p-14 relative z-20 bg-[#090c12]/95 border-r border-slate-800/80 backdrop-blur-2xl shrink-0">
        <div>
          {/* Studio Brand Header with Luxury Obsidian Shield Logo */}
          <div className="flex items-center gap-4 mb-10">
            <PhotoGuardLuxuryLogo className="w-12 h-12" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-2xl tracking-tight text-white">PhotoGuard</span>
                <span className="text-[10px] uppercase tracking-widest px-2.5 py-0.5 rounded-full border border-amber-500/30 bg-gradient-to-r from-[#FF1A4B]/15 to-[#F59E0B]/15 text-amber-300 font-bold font-mono">
                  Studio Suite
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium tracking-wide">
                Professional Proofing & Anti-Theft Vault
              </p>
            </div>
          </div>

          {/* Welcome Text */}
          <div className="mb-8">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-2">
              Welcome back
            </h1>
            <p className="text-sm text-slate-400 leading-relaxed">
              Sign in to manage client galleries, monitor live selections, and export approved photo proofs.
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <div id="login-error-alert" className="mb-6 p-4 rounded-xl border border-red-500/40 bg-red-950/60 text-red-200 flex items-start gap-3 text-sm animate-in fade-in duration-200 shadow-lg shadow-red-950/40">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <span className="text-xs sm:text-sm">{typeof error === "string" ? error : String(error?.msg || error?.message || "Authentication error")}</span>
            </div>
          )}

          {/* Clean Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Studio Email
              </label>
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
                  className="w-full bg-slate-900/90 border border-slate-800 rounded-xl pl-10 pr-4 py-3.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all shadow-inner"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Password
                </label>
                <span className="text-xs text-slate-500 cursor-default">
                  Provided by Admin
                </span>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="password-input"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  autoComplete="current-password"
                  className="w-full bg-slate-900/90 border border-slate-800 rounded-xl pl-10 pr-11 py-3.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all shadow-inner"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors p-1"
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
              className="w-full mt-2 py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#FF1A4B] via-[#FF5E3A] to-[#F59E0B] text-white font-bold text-sm hover:opacity-95 active:scale-[0.99] transition-all duration-200 shadow-xl shadow-[#FF1A4B]/20 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  <span>Authenticating Studio...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Studio</span>
                  <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                </>
              )}
            </button>
          </form>

          {/* Secure Studio Notice */}
          <div className="mt-8 pt-6 border-t border-slate-800/80">
            <div className="flex items-start gap-3 text-xs text-slate-400">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <p>
                Strict Studio Policy: Studio and Photographer accounts are provisioned exclusively by your Studio Administrator.
              </p>
            </div>
          </div>
        </div>

        {/* Console Footer */}
        <div className="pt-8 text-xs text-slate-500 flex items-center justify-between">
          <span>PhotoGuard Enterprise v7.0</span>
          <span className="font-mono">AES-256 VAULT</span>
        </div>
      </div>

      {/* Right Column: World-Class Studio Hero Section with High-Tech Viewfinder UI & Distinct Color-Coded Feature Cards */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden bg-[#05070a] items-center justify-center p-10 xl:p-14">
        
        {/* Crystal-Clear, High-Quality Studio Strobe / Softbox Photography Background */}
        <div 
          className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 ease-out"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1542038784456-1ea8e935640e?q=85&w=2160&auto=format&fit=crop')`,
          }}
        />

        {/* Cinematic Vignette Overlay (Dark studio gradient vignette) */}
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(circle at 55% 45%, rgba(6,9,14,0.35) 0%, rgba(5,7,11,0.82) 65%, rgba(3,4,7,0.98) 100%)",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#090c12] via-transparent to-[#040609]/90 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#040609] via-transparent to-[#040609]/80 pointer-events-none" />

        {/* Anti-Piracy Diagonal Security Watermark Mesh */}
        <div 
          className="absolute inset-0 pointer-events-none opacity-[0.035] mix-blend-overlay"
          style={{
            backgroundImage: `repeating-linear-gradient(45deg, #ffffff 0, #ffffff 1px, transparent 0, transparent 48px)`,
          }}
        />

        {/* =========================================================================
            HIGH-TECH VIEWFINDER UI (Digital EVF Screen Watermark)
            ========================================================================= */}
        <div className="absolute inset-4 xl:inset-8 pointer-events-none z-10 flex flex-col justify-between select-none">
          
          {/* Viewfinder Top Bar: Golden/White Corner Focus Brackets & Live Studio Data Overlay */}
          <div className="flex items-start justify-between">
            {/* Top-Left Corner Focus Bracket */}
            <div className="relative w-12 h-12 border-t-2 border-l-2 border-amber-400/85">
              <div className="absolute top-1.5 left-1.5 w-3 h-3 border-t border-l border-white/60" />
            </div>

            {/* Live Studio EVF Data Monospace Overlay */}
            <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-lg bg-black/75 border border-amber-500/40 backdrop-blur-md shadow-[0_0_20px_rgba(245,158,11,0.2)]">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_10px_#ef4444]" />
              <span className="font-mono text-xs xl:text-[13px] tracking-wider text-amber-300 font-bold">
                [ ] REC RAW | 85mm f/1.2 L | 1/250s | ISO 100 | AES-256 VAULT LOCK
              </span>
            </div>

            {/* Top-Right Corner Focus Bracket */}
            <div className="relative w-12 h-12 border-t-2 border-r-2 border-amber-400/85">
              <div className="absolute top-1.5 right-1.5 w-3 h-3 border-t border-r border-white/60" />
            </div>
          </div>

          {/* Viewfinder Center: Optical Lens Ring Outlines & Autofocus Crosshairs */}
          <div className="relative flex items-center justify-center my-auto">
            {/* Large Optical Lens Ring Outlines */}
            <div className="absolute w-[440px] h-[440px] rounded-full border border-white/[0.08] pointer-events-none" />
            <div className="absolute w-[360px] h-[360px] rounded-full border border-amber-400/[0.12] border-dashed pointer-events-none" />
            <div className="absolute w-[260px] h-[260px] rounded-full border border-white/[0.06] pointer-events-none" />

            {/* Center Autofocus Reticle & Precision Crosshairs */}
            <div className="relative w-28 h-28 flex items-center justify-center pointer-events-none">
              {/* AF Target Box in Gold/White */}
              <div className="w-16 h-16 border border-amber-400/60 rounded-md relative flex items-center justify-center">
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-[2px] bg-amber-400" />
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-[2px] bg-amber-400" />
                <div className="absolute -left-1 top-1/2 -translate-y-1/2 h-2 w-[2px] bg-amber-400" />
                <div className="absolute -right-1 top-1/2 -translate-y-1/2 h-2 w-[2px] bg-amber-400" />
                {/* Center AF Dot */}
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                <div className="w-1.5 h-1.5 rounded-full bg-amber-300" />
              </div>

              {/* Horizontal Crosshair Hairlines */}
              <div className="absolute -left-12 top-1/2 -translate-y-1/2 w-10 h-[1px] bg-gradient-to-r from-transparent via-amber-400/50 to-white/70" />
              <div className="absolute -right-12 top-1/2 -translate-y-1/2 w-10 h-[1px] bg-gradient-to-l from-transparent via-amber-400/50 to-white/70" />
              {/* Vertical Crosshair Hairlines */}
              <div className="absolute left-1/2 -translate-x-1/2 -top-12 h-10 w-[1px] bg-gradient-to-b from-transparent via-amber-400/50 to-white/70" />
              <div className="absolute left-1/2 -translate-x-1/2 -bottom-12 h-10 w-[1px] bg-gradient-to-t from-transparent via-amber-400/50 to-white/70" />
            </div>
          </div>

          {/* Viewfinder Bottom Bar: Corner Focus Brackets & Technical Metering Data */}
          <div className="flex items-end justify-between">
            {/* Bottom-Left Corner Focus Bracket */}
            <div className="relative w-12 h-12 border-b-2 border-l-2 border-amber-400/85">
              <div className="absolute bottom-1.5 left-1.5 w-3 h-3 border-b border-l border-white/60" />
            </div>

            {/* EVF Framing & AF Mode Indicator */}
            <div className="font-mono text-[11px] tracking-widest text-slate-300/80 bg-black/60 px-3 py-1 rounded border border-white/10 backdrop-blur-sm">
              <span>AF-C [WIDE] | SPOT 100% | 14-BIT UNCOMPRESSED</span>
            </div>

            {/* Bottom-Right Corner Focus Bracket */}
            <div className="relative w-12 h-12 border-b-2 border-r-2 border-amber-400/85">
              <div className="absolute bottom-1.5 right-1.5 w-3 h-3 border-b border-r border-white/60" />
            </div>
          </div>
        </div>

        {/* Foreground Content: Editorial Headline & 4 Color-Coded Feature Cards */}
        <div className="relative w-full max-w-xl z-20 flex flex-col justify-between h-full py-2">
          
          {/* Top Pill / Badge */}
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-white/15 bg-slate-900/85 backdrop-blur-md text-xs font-semibold text-slate-200 shadow-xl">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
              <span>Studio Master Proofing Suite</span>
            </div>
            <span className="text-xs font-mono text-amber-300/90 bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 rounded-full font-bold">
              ZERO-LEAK PROTOCOL
            </span>
          </div>

          {/* Centerpiece: Headline & The Four Distinct Color-Coded Feature Cards */}
          <div className="my-auto py-6 space-y-6">
            <div>
              <span className="text-xs uppercase tracking-[0.25em] text-transparent bg-clip-text bg-gradient-to-r from-[#FF1A4B] via-[#FF5E3A] to-[#F59E0B] font-extrabold block mb-2">
                Engineered for Creative Integrity
              </span>
              <h2 className="text-3xl xl:text-4xl font-extrabold tracking-tight text-white leading-tight">
                The Anti-Piracy Photo Selection Platform for Studios.
              </h2>
              <p className="text-sm xl:text-base text-slate-200 leading-relaxed mt-2.5 font-normal">
                Empower your photography workflow with secure client proofing, real-time family selection, and zero unauthorized downloads.
              </p>
            </div>

            {/* The Four Distinct Color-Coded Feature Cards */}
            <div className="space-y-3">
              
              {/* Card 1: Emerald/Green (#10B981) - Zero-Watermark Shield */}
              <div className="p-4 rounded-2xl border border-[#10B981]/35 bg-[#061410]/85 backdrop-blur-xl flex items-start gap-4 shadow-[0_0_24px_-4px_rgba(16,185,129,0.22)] hover:border-[#10B981]/70 hover:shadow-[0_0_32px_rgba(16,185,129,0.35)] transition-all duration-300 group">
                <div className="w-11 h-11 rounded-xl bg-[#10B981]/15 border border-[#10B981]/40 flex items-center justify-center text-[#10B981] shrink-0 group-hover:scale-105 transition-transform shadow-[0_0_12px_rgba(16,185,129,0.25)]">
                  <ShieldCheck className="w-5 h-5 stroke-[2.4]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white mb-0.5 flex items-center gap-2">
                    <span className="text-white">Zero-Watermark Shield</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#10B981]/20 text-[#34d399] font-bold border border-[#10B981]/40 font-mono">
                      RAM-ONLY
                    </span>
                  </h3>
                  <p className="text-xs text-slate-200 leading-relaxed font-normal">
                    Zero ugly watermarks spoiling client appreciation. Mobile RAM rendering blocks screenshots and screen recording completely.
                  </p>
                </div>
              </div>

              {/* Card 2: Golden Amber (#F59E0B) - Collaborative Live Sync */}
              <div className="p-4 rounded-2xl border border-[#F59E0B]/35 bg-[#171106]/85 backdrop-blur-xl flex items-start gap-4 shadow-[0_0_24px_-4px_rgba(245,158,11,0.22)] hover:border-[#F59E0B]/70 hover:shadow-[0_0_32px_rgba(245,158,11,0.35)] transition-all duration-300 group">
                <div className="w-11 h-11 rounded-xl bg-[#F59E0B]/15 border border-[#F59E0B]/40 flex items-center justify-center text-[#F59E0B] shrink-0 group-hover:scale-105 transition-transform shadow-[0_0_12px_rgba(245,158,11,0.25)]">
                  <Users className="w-5 h-5 stroke-[2.4]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white mb-0.5 flex items-center gap-2">
                    <span className="text-white">Collaborative Live Sync</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#F59E0B]/20 text-[#fbbf24] font-bold border border-[#F59E0B]/40 font-mono">
                      MULTI-DEVICE
                    </span>
                  </h3>
                  <p className="text-xs text-slate-200 leading-relaxed font-normal">
                    Clients and families enter with a 6-digit PIN, review proofs, and vote on favorites simultaneously with single-submit freeze.
                  </p>
                </div>
              </div>

              {/* Card 3: Electric Cyan (#06B6D4) - Direct Camera Roll Save */}
              <div className="p-4 rounded-2xl border border-[#06B6D4]/35 bg-[#051419]/85 backdrop-blur-xl flex items-start gap-4 shadow-[0_0_24px_-4px_rgba(6,182,212,0.22)] hover:border-[#06B6D4]/70 hover:shadow-[0_0_32px_rgba(6,182,212,0.35)] transition-all duration-300 group">
                <div className="w-11 h-11 rounded-xl bg-[#06B6D4]/15 border border-[#06B6D4]/40 flex items-center justify-center text-[#06B6D4] shrink-0 group-hover:scale-105 transition-transform shadow-[0_0_12px_rgba(6,182,212,0.25)]">
                  <Download className="w-5 h-5 stroke-[2.4]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white mb-0.5 flex items-center gap-2">
                    <span className="text-white">Direct Camera Roll Save</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#06B6D4]/20 text-[#22d3ee] font-bold border border-[#06B6D4]/40 font-mono">
                      NO ZIP FILES
                    </span>
                  </h3>
                  <p className="text-xs text-slate-200 leading-relaxed font-normal">
                    Clients download finalized edited master photos straight into their mobile phone gallery without messy archives.
                  </p>
                </div>
              </div>

              {/* Card 4: Electric Indigo/Violet (#6366F1) - Universal Studio Export */}
              <div className="p-4 rounded-2xl border border-[#6366F1]/35 bg-[#0e0d1f]/85 backdrop-blur-xl flex items-start gap-4 shadow-[0_0_24px_-4px_rgba(99,102,241,0.22)] hover:border-[#6366F1]/70 hover:shadow-[0_0_32px_rgba(99,102,241,0.35)] transition-all duration-300 group">
                <div className="w-11 h-11 rounded-xl bg-[#6366F1]/15 border border-[#6366F1]/40 flex items-center justify-center text-[#6366F1] shrink-0 group-hover:scale-105 transition-transform shadow-[0_0_12px_rgba(99,102,241,0.25)]">
                  <Share2 className="w-5 h-5 stroke-[2.4]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white mb-0.5 flex items-center gap-2">
                    <span className="text-white">Universal Studio Export</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#6366F1]/20 text-[#a5b4fc] font-bold border border-[#6366F1]/40 font-mono">
                      WORKFLOW SYNC
                    </span>
                  </h3>
                  <p className="text-xs text-slate-200 leading-relaxed font-normal">
                    One-click export of client selections directly into Lightroom, CapCut, Premiere, DaVinci, and editing suites.
                  </p>
                </div>
              </div>

            </div>
          </div>

          {/* Bottom Trust Line */}
          <div className="flex items-center justify-between pt-4 border-t border-white/10 text-xs text-slate-300">
            <span>Designed for wedding, portrait, and commercial studios worldwide.</span>
            <span className="text-amber-400 font-bold font-mono tracking-wider">PhotoGuard Cloud</span>
          </div>

        </div>
      </div>

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
