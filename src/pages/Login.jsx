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
  Camera, 
  Users,
  Download,
  Share2
} from "lucide-react";

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
              className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm transition-all"
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
    <div id="login-container" className="min-h-screen w-full flex bg-[#07090c] text-slate-100 selection:bg-amber-500/20 selection:text-amber-200">
      {/* Left Column: Pure, High-End Studio Authentication Console */}
      <div className="w-full lg:w-[460px] xl:w-[500px] flex flex-col justify-between p-8 sm:p-12 lg:p-14 relative z-10 bg-[#0b0e13]/95 border-r border-slate-800/80 backdrop-blur-2xl shrink-0">
        <div>
          {/* Studio Brand Header */}
          <div className="flex items-center gap-3.5 mb-12">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500 via-amber-400 to-amber-200 flex items-center justify-center shadow-xl shadow-amber-500/20 ring-1 ring-amber-400/30">
              <Camera className="w-5 h-5 text-slate-950 stroke-[2.4]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-xl tracking-tight text-white">PhotoGuard</span>
                <span className="text-[10px] uppercase tracking-widest px-2.5 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-300 font-semibold">
                  Studio Suite
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">Professional Proofing & Client Selection</p>
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
            <div id="login-error-alert" className="mb-6 p-4 rounded-xl border border-red-500/30 bg-red-950/50 text-red-300 flex items-start gap-3 text-sm animate-in fade-in duration-200">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <span>{typeof error === "string" ? error : String(error?.msg || error?.message || "Authentication error")}</span>
            </div>
          )}

          {/* Clean Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Studio Email</label>
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
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Password</label>
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
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              id="submit-login-btn"
              type="submit"
              disabled={loading}
              className="w-full mt-3 group relative overflow-hidden rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-300 p-[1px] font-medium text-slate-950 transition-all hover:shadow-xl hover:shadow-amber-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center justify-center gap-2 rounded-[11px] bg-amber-400 px-5 py-3.5 font-bold text-slate-950 transition-all group-hover:bg-amber-300">
                <span>{loading ? "Authenticating..." : "Access Studio Console"}</span>
                {!loading && <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />}
              </div>
            </button>
          </form>
        </div>

        {/* Clean Single Footer */}
        <div className="pt-8 border-t border-slate-800/80 mt-12 text-xs text-slate-500 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>End-to-End Studio Protection</span>
          </div>
          <span className="font-mono text-[11px] text-slate-600">v7.0 SaaS</span>
        </div>
      </div>

      {/* Right Column: World-Class Editorial Showcase with 4 Refined Micro-Badges */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden bg-black items-center justify-center p-12 xl:p-16">
        {/* Background Fine-Art Wedding Photography */}
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-30 scale-105 transition-transform duration-1000 ease-out"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=1800&auto=format&fit=crop')`,
          }}
        />
        
        {/* Deep Studio Vignette Overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#07090c] via-[#07090c]/75 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0b0e13] via-transparent to-[#07090c]/85" />

        {/* Anti-Piracy Diagonal Mesh Pattern */}
        <div 
          className="absolute inset-0 pointer-events-none opacity-[0.03] mix-blend-overlay"
          style={{
            backgroundImage: `repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 0, transparent 40px)`,
          }}
        />

        {/* Showcase Content Container */}
        <div className="relative w-full max-w-xl z-10 flex flex-col justify-between h-full py-4">
          
          {/* Top Elegant Studio Pill */}
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-white/10 bg-slate-900/60 backdrop-blur-md text-xs font-medium text-slate-300 shadow-xl">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>PhotoGuard Studio Architecture</span>
            </div>
            <span className="text-xs text-slate-500 font-medium">Anti-Theft Proofing</span>
          </div>

          {/* Centerpiece: Headline & 4 Distinct Colored Micro-Badges */}
          <div className="my-auto py-8 space-y-7">
            <div>
              <span className="text-xs uppercase tracking-[0.25em] text-amber-400 font-bold block mb-2.5">
                Engineered for Creative Integrity
              </span>
              <h2 className="text-3xl xl:text-4xl font-extrabold tracking-tight text-white leading-tight">
                The Anti-Piracy Photo Selection Platform for Studios.
              </h2>
              <p className="text-sm xl:text-base text-slate-300/90 leading-relaxed mt-3">
                Empower your photography workflow with secure client proofing, real-time family selection, and zero unauthorized downloads.
              </p>
            </div>

            {/* 4 Colored Luxury Value Badges */}
            <div className="space-y-3">
              {/* Badge 1: Emerald Green (Zero-Watermark Shield) */}
              <div className="p-4 rounded-2xl border border-emerald-500/20 bg-slate-900/60 backdrop-blur-md flex items-start gap-4 shadow-lg hover:border-emerald-500/40 transition-all group">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 group-hover:scale-105 transition-transform">
                  <ShieldCheck className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white mb-0.5 flex items-center gap-2">
                    <span>Zero-Watermark Shield</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-semibold border border-emerald-500/30">
                      RAM-Only
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Zero ugly watermarks spoiling client appreciation. Mobile RAM rendering blocks screenshots and screen recording completely.
                  </p>
                </div>
              </div>

              {/* Badge 2: Golden Amber (Collaborative Live Sync) */}
              <div className="p-4 rounded-2xl border border-amber-500/20 bg-slate-900/60 backdrop-blur-md flex items-start gap-4 shadow-lg hover:border-amber-500/40 transition-all group">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 group-hover:scale-105 transition-transform">
                  <Users className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white mb-0.5 flex items-center gap-2">
                    <span>Collaborative Live Sync</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 font-semibold border border-amber-500/30">
                      Multi-Device
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Clients and families enter with a 6-digit PIN, review proofs, and vote on favorites simultaneously with single-submit freeze.
                  </p>
                </div>
              </div>

              {/* Badge 3: Sky Blue (Direct Camera Roll Save) */}
              <div className="p-4 rounded-2xl border border-sky-500/20 bg-slate-900/60 backdrop-blur-md flex items-start gap-4 shadow-lg hover:border-sky-500/40 transition-all group">
                <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0 group-hover:scale-105 transition-transform">
                  <Download className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white mb-0.5 flex items-center gap-2">
                    <span>Direct Camera Roll Save</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 font-semibold border border-sky-500/30">
                      No ZIP Files
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Clients download finalized edited master photos straight into their mobile phone gallery without messy archives.
                  </p>
                </div>
              </div>

              {/* Badge 4: Violet Purple (Universal Studio Export) */}
              <div className="p-4 rounded-2xl border border-violet-500/20 bg-slate-900/60 backdrop-blur-md flex items-start gap-4 shadow-lg hover:border-violet-500/40 transition-all group">
                <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/30 flex items-center justify-center text-violet-400 shrink-0 group-hover:scale-105 transition-transform">
                  <Share2 className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white mb-0.5 flex items-center gap-2">
                    <span>Universal Studio Export</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-300 font-semibold border border-violet-500/30">
                      Workflow Sync
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    One-click export of client selections directly into Lightroom, CapCut, Premiere, DaVinci, and editing suites.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Trust Line */}
          <div className="flex items-center justify-between pt-4 border-t border-white/10 text-xs text-slate-400">
            <span>Designed for wedding, portrait, and commercial studios worldwide.</span>
            <span className="text-slate-300 font-medium">PhotoGuard Cloud</span>
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
