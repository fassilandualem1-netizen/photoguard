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
  Layers,
  ScanFace,
  Palette,
  Sliders,
  Clock,
  Smartphone,
  Users,
  Download,
  X,
  HelpCircle
} from "lucide-react";

export default function Login({ onLoginSuccess }) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Active showcase plan tab: 'studio' | 'basic'
  const [activePlanTab, setActivePlanTab] = useState("studio");
  
  // Full Plan Comparison Modal state
  const [showComparisonModal, setShowComparisonModal] = useState(false);

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
    <div id="login-container" className="min-h-screen w-full flex bg-[#080a0d] text-slate-100 selection:bg-amber-500/20 selection:text-amber-200">
      {/* Left Column: Studio Authentication Console */}
      <div className="w-full lg:w-[480px] xl:w-[520px] flex flex-col justify-between p-8 sm:p-12 lg:p-14 relative z-10 bg-[#0c0e12]/95 border-r border-slate-800/70 backdrop-blur-xl shrink-0">
        <div>
          {/* Studio Brand Header */}
          <div className="flex items-center justify-between mb-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-amber-400 to-amber-200 flex items-center justify-center shadow-lg shadow-amber-500/20">
                <Camera className="w-5 h-5 text-slate-950 stroke-[2.3]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-lg tracking-tight text-white">PhotoGuard</span>
                  <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-300 font-semibold">
                    Studio Suite
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">Elite Proofing & Selection SaaS</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowComparisonModal(true)}
              className="text-xs text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1 font-medium px-2.5 py-1 rounded-lg hover:bg-amber-500/10 border border-transparent hover:border-amber-500/20"
            >
              <span>Plans</span>
              <HelpCircle className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Welcome Text */}
          <div className="mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-2">Welcome back</h1>
            <p className="text-sm text-slate-400 leading-relaxed">
              Sign in to manage client galleries, track live photo selections, and export approved proofs.
            </p>
          </div>

          {/* Error Message */}
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
                  className="w-full bg-slate-900/80 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/80 transition-all shadow-inner"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium uppercase tracking-wider text-slate-400">Password</label>
                <span className="text-xs text-slate-500 hover:text-slate-400 cursor-default">
                  Assigned by Admin
                </span>
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
                  className="w-full bg-slate-900/80 border border-slate-800 rounded-xl pl-10 pr-11 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/80 transition-all shadow-inner"
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
              className="w-full mt-2 group relative overflow-hidden rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-300 p-[1px] font-medium text-slate-950 transition-all hover:shadow-lg hover:shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center justify-center gap-2 rounded-[11px] bg-amber-400 px-5 py-3.5 font-semibold text-slate-950 transition-all group-hover:bg-amber-300">
                <span>{loading ? "Authenticating..." : "Access Studio Console"}</span>
                {!loading && <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />}
              </div>
            </button>
          </form>

          {/* Interactive Tier Quick Switcher on Mobile/Left */}
          <div className="mt-8 p-3.5 rounded-xl border border-slate-800 bg-slate-900/40 text-xs text-slate-400">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-slate-300">Studio Tiers:</span>
              <button 
                type="button" 
                onClick={() => setShowComparisonModal(true)}
                className="text-amber-400 hover:underline font-medium text-[11px]"
              >
                View Full Table
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800/80">
                <span className="font-semibold text-slate-200 block">Basic Plan</span>
                <span className="text-slate-400 text-[10px]">Proofing & Live Selection</span>
              </div>
              <div className="p-2 rounded-lg bg-amber-500/5 border border-amber-500/20">
                <span className="font-semibold text-amber-300 block">Studio Pro</span>
                <span className="text-slate-400 text-[10px]">AI Face Search & Custom Logo</span>
              </div>
            </div>
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

      {/* Right Column: World-Class Editorial Studio Showcase with Dynamic Plan Explorer */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden bg-black items-center justify-center p-10 xl:p-14">
        {/* Background Image: High-End Fashion / Fine-Art Wedding Photography */}
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-35 scale-105 transition-transform duration-1000 ease-out"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=1800&auto=format&fit=crop')`,
          }}
        />
        
        {/* Deep Vignette Gradient Overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#080a0d] via-[#080a0d]/75 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0c0e12] via-transparent to-[#080a0d]/85" />

        {/* Showcase Content Container */}
        <div className="relative w-full max-w-2xl z-10 flex flex-col justify-between h-full py-4">
          
          {/* Top Bar: Plan Explorer Toggle */}
          <div className="flex items-center justify-between">
            <div className="inline-flex p-1 rounded-xl bg-slate-950/80 border border-slate-800 backdrop-blur-md shadow-2xl">
              <button
                type="button"
                onClick={() => setActivePlanTab("studio")}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activePlanTab === "studio"
                    ? "bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 shadow-md shadow-amber-500/20"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Studio Pro Plan (AI Suite)
              </button>
              <button
                type="button"
                onClick={() => setActivePlanTab("basic")}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activePlanTab === "basic"
                    ? "bg-slate-800 text-white shadow-md"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Basic Plan
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowComparisonModal(true)}
              className="text-xs text-amber-400/90 hover:text-amber-300 font-medium flex items-center gap-1.5 bg-black/40 px-3 py-1.5 rounded-lg border border-white/5 hover:border-amber-500/30 transition-all"
            >
              <span>Full Comparison</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Center Stage: Dynamic Showcase Based on Selected Plan */}
          <div className="my-auto py-6 space-y-6">
            <div>
              <span className="text-[11px] uppercase tracking-[0.25em] text-amber-400 font-bold block mb-2">
                {activePlanTab === "studio" ? "Studio Pro Tier • Built for High-Volume Studios" : "Basic Studio Tier • Essential Selection"}
              </span>
              <h2 className="text-3xl xl:text-4xl font-extrabold tracking-tight text-white leading-tight">
                {activePlanTab === "studio" 
                  ? "AI Face Search & Custom Branding for Modern Studios."
                  : "Clean Anti-Piracy Proofing & Collaborative Selection."}
              </h2>
              <p className="text-sm xl:text-base text-slate-300/90 leading-relaxed mt-3 max-w-xl">
                {activePlanTab === "studio"
                  ? "Elevate your photography brand. Clients scan a quick selfie to instantly locate their pictures, enjoy custom studio branding, and receive edited masters seamlessly."
                  : "Share high-resolution proofs protected by zero-leak RAM-only mobile security. Clients select favorites collaboratively without image degradation."}
              </p>
            </div>

            {/* Dynamic Feature Bento Grid */}
            {activePlanTab === "studio" ? (
              <div className="grid grid-cols-2 gap-3.5">
                {/* Feature 1: AI Face Search */}
                <div className="p-4 rounded-2xl border border-amber-500/25 bg-slate-900/60 backdrop-blur-md shadow-xl hover:border-amber-500/40 transition-all group">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-3 group-hover:scale-105 transition-transform">
                    <ScanFace className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-semibold text-white mb-1">AI Face Search</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Clients scan their face with their phone camera to instantly filter and find every photo they appear in.
                  </p>
                </div>

                {/* Feature 2: Custom Studio Branding */}
                <div className="p-4 rounded-2xl border border-white/10 bg-slate-900/50 backdrop-blur-md shadow-xl hover:border-amber-500/30 transition-all group">
                  <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-amber-400 mb-3 group-hover:scale-105 transition-transform">
                    <Palette className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-semibold text-white mb-1">Custom Studio Branding</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Showcase your studio's official logo, brand colors, and custom cover banners on every client delivery gallery.
                  </p>
                </div>

                {/* Feature 3: AI Auto-Enhance */}
                <div className="p-4 rounded-2xl border border-white/10 bg-slate-900/50 backdrop-blur-md shadow-xl hover:border-amber-500/30 transition-all group">
                  <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-amber-400 mb-3 group-hover:scale-105 transition-transform">
                    <Sliders className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-semibold text-white mb-1">AI Auto-Enhance</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    One-click intelligent tonal balance and color correction for rapid client proof generation.
                  </p>
                </div>

                {/* Feature 4: 30-Day Retention & Unlimited Albums */}
                <div className="p-4 rounded-2xl border border-white/10 bg-slate-900/50 backdrop-blur-md shadow-xl hover:border-amber-500/30 transition-all group">
                  <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-amber-400 mb-3 group-hover:scale-105 transition-transform">
                    <Clock className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-semibold text-white mb-1">30-Day Cloud Retention</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Extended client selection window with automated scheduled delivery clean-up to optimize storage.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3.5">
                {/* Basic Feature 1: Clean Anti-Piracy */}
                <div className="p-4 rounded-2xl border border-slate-700/50 bg-slate-900/60 backdrop-blur-md shadow-xl group">
                  <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-amber-400 mb-3 group-hover:scale-105 transition-transform">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-semibold text-white mb-1">Zero-Watermark Shield</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    No ugly watermarks ruining your photos. Secure RAM-only mobile rendering blocks screenshots and screen recording.
                  </p>
                </div>

                {/* Basic Feature 2: Collaborative Selection */}
                <div className="p-4 rounded-2xl border border-slate-700/50 bg-slate-900/60 backdrop-blur-md shadow-xl group">
                  <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-amber-400 mb-3 group-hover:scale-105 transition-transform">
                    <Users className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-semibold text-white mb-1">Collaborative Family Sync</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Family members enter with a 6-digit PIN and vote/select photos together in real time.
                  </p>
                </div>

                {/* Basic Feature 3: Single-Submit Lock */}
                <div className="p-4 rounded-2xl border border-slate-700/50 bg-slate-900/60 backdrop-blur-md shadow-xl group">
                  <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-amber-400 mb-3 group-hover:scale-105 transition-transform">
                    <Lock className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-semibold text-white mb-1">Single-Submit Lock</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Once the primary client locks their choices, selections freeze across all devices to prevent confusion.
                  </p>
                </div>

                {/* Basic Feature 4: Direct Gallery Download */}
                <div className="p-4 rounded-2xl border border-slate-700/50 bg-slate-900/60 backdrop-blur-md shadow-xl group">
                  <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-amber-400 mb-3 group-hover:scale-105 transition-transform">
                    <Download className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-semibold text-white mb-1">Direct Gallery Download</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Clients download their finalized master photos straight to their phone camera roll with zero cumbersome ZIP files.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Bar */}
          <div className="flex items-center justify-between pt-4 border-t border-white/10 text-xs text-slate-400">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-amber-400" />
              <span>Universal Export • Compatible with Lightroom, Photoshop, CapCut & Premiere</span>
            </span>
            <span className="text-slate-300 font-medium">PhotoGuard Cloud</span>
          </div>
        </div>
      </div>

      {/* Full Plan Comparison Modal */}
      {showComparisonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-3xl rounded-3xl bg-[#0e1117] border border-slate-800 p-6 sm:p-8 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-5 border-b border-slate-800">
              <div>
                <span className="text-xs uppercase tracking-wider text-amber-400 font-bold block mb-1">
                  Subscription Plans
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-white">
                  PhotoGuard Studio Tiers Comparison
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowComparisonModal(false)}
                className="w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Comparison Table */}
            <div className="overflow-y-auto py-5 flex-1 pr-1 space-y-4">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase tracking-wider">
                    <th className="pb-3 font-semibold">Features & Capabilities</th>
                    <th className="pb-3 font-semibold text-center w-36">Basic Plan</th>
                    <th className="pb-3 font-semibold text-center w-44 text-amber-400">Studio Pro Plan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  <tr>
                    <td className="py-3 font-medium text-white">Clean Anti-Piracy Protection (Zero Watermark, RAM-Only)</td>
                    <td className="py-3 text-center"><CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" /></td>
                    <td className="py-3 text-center"><CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" /></td>
                  </tr>
                  <tr>
                    <td className="py-3 font-medium text-white">6-Digit PIN Collaborative Family Selection</td>
                    <td className="py-3 text-center"><CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" /></td>
                    <td className="py-3 text-center"><CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" /></td>
                  </tr>
                  <tr>
                    <td className="py-3 font-medium text-white">Single-Submit Selection Freeze & Lock</td>
                    <td className="py-3 text-center"><CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" /></td>
                    <td className="py-3 text-center"><CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" /></td>
                  </tr>
                  <tr>
                    <td className="py-3 font-medium text-white">Direct Gallery Download to Camera Roll (No ZIP files)</td>
                    <td className="py-3 text-center"><CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" /></td>
                    <td className="py-3 text-center"><CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" /></td>
                  </tr>
                  <tr>
                    <td className="py-3 font-medium text-white">Universal Export (Lightroom, CapCut, Premiere)</td>
                    <td className="py-3 text-center"><CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" /></td>
                    <td className="py-3 text-center"><CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" /></td>
                  </tr>
                  <tr className="bg-amber-500/[0.03]">
                    <td className="py-3 font-medium text-white flex items-center gap-2">
                      <ScanFace className="w-4 h-4 text-amber-400" />
                      <span>AI Face Search (Biometric Guest Facial Recognition)</span>
                    </td>
                    <td className="py-3 text-center text-slate-500">—</td>
                    <td className="py-3 text-center"><CheckCircle2 className="w-4 h-4 text-amber-400 mx-auto" /></td>
                  </tr>
                  <tr className="bg-amber-500/[0.03]">
                    <td className="py-3 font-medium text-white flex items-center gap-2">
                      <Palette className="w-4 h-4 text-amber-400" />
                      <span>Custom Studio Branding (Logo, Brand Colors, Custom Links)</span>
                    </td>
                    <td className="py-3 text-center text-slate-500">—</td>
                    <td className="py-3 text-center"><CheckCircle2 className="w-4 h-4 text-amber-400 mx-auto" /></td>
                  </tr>
                  <tr className="bg-amber-500/[0.03]">
                    <td className="py-3 font-medium text-white flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-amber-400" />
                      <span>AI Auto-Enhance (1-Click Intelligent Exposure & Polish)</span>
                    </td>
                    <td className="py-3 text-center text-slate-500">—</td>
                    <td className="py-3 text-center"><CheckCircle2 className="w-4 h-4 text-amber-400 mx-auto" /></td>
                  </tr>
                  <tr>
                    <td className="py-3 font-medium text-white">Cloud Gallery Retention Period</td>
                    <td className="py-3 text-center text-xs text-slate-400">7 Days Auto-Clean</td>
                    <td className="py-3 text-center text-xs font-semibold text-amber-300">30 Days Auto-Clean</td>
                  </tr>
                </tbody>
              </table>

              {/* Upgrade Info Note */}
              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 text-xs text-slate-400 flex items-start gap-3 mt-4">
                <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-semibold text-white block">Managed Account Provisioning</span>
                  <p>
                    Accounts and plan tier upgrades are managed directly by your studio administrator. Manual payment verification via Telebirr or CBE receipt is supported.
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-4 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setShowComparisonModal(false)}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-colors"
              >
                Close Comparison
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

Login.defaultProps = {
  onLoginSuccess: undefined,
};
