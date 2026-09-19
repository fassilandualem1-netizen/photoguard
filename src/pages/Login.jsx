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
  Sparkles, 
  CheckCircle2, 
  Layers 
} from "lucide-react";

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
    <div id="login-container" className="min-h-screen w-full flex bg-[#090b0e] text-slate-100 selection:bg-amber-500/20 selection:text-amber-200">
      {/* Left Column: Studio Authentication Console */}
      <div className="w-full lg:w-[480px] xl:w-[520px] flex flex-col justify-between p-8 sm:p-12 lg:p-14 relative z-10 bg-[#0c0e12]/95 border-r border-slate-800/60 backdrop-blur-xl">
        <div>
          {/* Studio Brand Header */}
          <div className="flex items-center justify-between mb-12">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-amber-400 to-amber-200 flex items-center justify-center shadow-lg shadow-amber-500/15">
                <Camera className="w-5 h-5 text-slate-950 stroke-[2.3]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-lg tracking-tight text-white">PhotoGuard</span>
                  <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-300 font-semibold">
                    Studio Suite
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">Elite Proofing & Selection</p>
              </div>
            </div>
          </div>

          {/* Welcome Text */}
          <div className="mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-2">Welcome back</h1>
            <p className="text-sm text-slate-400 leading-relaxed">
              Sign in to manage your client galleries, track live selections, and deliver high-resolution proofs securely.
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div id="login-error-alert" className="mb-6 p-4 rounded-xl border border-red-500/20 bg-red-950/40 text-red-300 flex items-start gap-3 text-sm animate-in fade-in duration-200">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wider text-slate-400">Studio Email</label>
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
                  className="w-full bg-slate-900/70 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/80 transition-all shadow-inner"
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
                  className="w-full bg-slate-900/70 border border-slate-800 rounded-xl pl-10 pr-11 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/80 transition-all shadow-inner"
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
              className="w-full mt-2 group relative overflow-hidden rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-300 p-[1px] font-medium text-slate-950 transition-all hover:shadow-lg hover:shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center justify-center gap-2 rounded-[11px] bg-amber-400 px-5 py-3.5 font-semibold text-slate-950 transition-all group-hover:bg-amber-300">
                <span>{loading ? "Authenticating..." : "Access Studio"}</span>
                {!loading && <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />}
              </div>
            </button>
          </form>

          {/* Quick Plan Info */}
          <div className="mt-8 p-3.5 rounded-xl border border-slate-800/80 bg-slate-900/40 text-xs text-slate-400 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Basic (5GB) & Studio (Unlimited)</span>
            </div>
            <span className="text-[11px] text-amber-400/90 font-medium">Auto-Sync Enabled</span>
          </div>
        </div>

        {/* Footer Info */}
        <div className="pt-8 border-t border-slate-800/80 mt-8 text-xs text-slate-500 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400/80" />
            <span>Anti-Piracy Protected Proofing</span>
          </div>
          <span>v7.0 SaaS</span>
        </div>
      </div>

      {/* Right Column: Apple / Pixieset Cinematic Photography Showcase */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden bg-black items-center justify-center p-12 xl:p-16">
        {/* Background Image: High-Fashion / Fine-Art Photography with Dark Cinematic Vignette */}
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-40 scale-105 transition-transform duration-1000 ease-out"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=1600&auto=format&fit=crop')`,
          }}
        />
        
        {/* Multi-layered Vignette & Dark Studio Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#090b0e] via-[#090b0e]/70 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0c0e12] via-transparent to-[#090b0e]/80" />
        
        {/* Anti-Piracy Watermark Diagonal Grid Texture */}
        <div 
          className="absolute inset-0 pointer-events-none opacity-[0.035] mix-blend-overlay"
          style={{
            backgroundImage: `repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 0, transparent 40px)`,
          }}
        />

        {/* Cinematic Content Hero Box */}
        <div className="relative w-full max-w-2xl z-10 flex flex-col justify-between h-full py-6">
          {/* Top Pill / Badge */}
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-amber-400/20 bg-black/60 backdrop-blur-md text-xs font-medium text-amber-300 shadow-xl">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span>Next-Generation Studio Proofing</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              <span>Lightroom & Photoshop Ready</span>
            </div>
          </div>

          {/* Centerpiece: Headline & Floating Studio Proof Preview Card */}
          <div className="space-y-8 my-auto py-10">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-amber-400 font-semibold mb-3">
                Crafted for Professional Photographers
              </p>
              <h2 className="text-3xl xl:text-4xl font-extrabold tracking-tight text-white leading-[1.2]">
                Protecting Creative Masterpieces for Elite Studios.
              </h2>
              <p className="text-base text-slate-300/90 leading-relaxed mt-4 max-w-xl">
                Deliver breathtaking client proofing galleries with dynamic watermark protection, real-time family selection, and seamless one-click delivery.
              </p>
            </div>

            {/* Floating Glassmorphic Proof Preview Card */}
            <div className="p-5 rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-md shadow-2xl space-y-4 max-w-lg">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-slate-200 font-medium">
                  <Camera className="w-4 h-4 text-amber-400" />
                  <span>Gallery Proof #204 • Editorial Wedding</span>
                </div>
                <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-semibold">
                  Protected Proofing Active
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3 pt-2 text-left border-t border-white/5">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Protection</span>
                  <span className="text-xs font-medium text-white flex items-center gap-1 mt-0.5">
                    <CheckCircle2 className="w-3 h-3 text-amber-400" /> Dynamic Watermark
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Client Review</span>
                  <span className="text-xs font-medium text-white flex items-center gap-1 mt-0.5">
                    <CheckCircle2 className="w-3 h-3 text-amber-400" /> Collaborative
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Master Output</span>
                  <span className="text-xs font-medium text-white flex items-center gap-1 mt-0.5">
                    <CheckCircle2 className="w-3 h-3 text-amber-400" /> Lossless Originals
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Trust & Plan Statement */}
          <div className="flex items-center justify-between pt-6 border-t border-white/10 text-xs text-slate-400">
            <span>Built for high-end wedding, portrait, and commercial photographers.</span>
            <span className="text-slate-300 font-medium">PhotoGuard Cloud</span>
          </div>
        </div>
      </div>
    </div>
  );
}

Login.defaultProps = {
  onLoginSuccess: undefined,
};

