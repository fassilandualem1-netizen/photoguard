import React, { useState, useEffect } from "react";
import {
  X,
  Palette,
  Send,
  ExternalLink,
  Check,
  AlertCircle,
  Loader2,
  Lock,
  RefreshCw,
  Unlink,
  Sparkles,
  ShieldCheck
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";

// Standard brand color presets for studio photographers
const BRAND_COLOR_PRESETS = [
  { label: "PhotoGuard Amber", hex: "#F59E0B" },
  { label: "Emerald Luxury", hex: "#10B981" },
  { label: "Sapphire Blue", hex: "#3B82F6" },
  { label: "Royal Amethyst", hex: "#8B5CF6" },
  { label: "Velvet Rose", hex: "#EC4899" },
  { label: "Obsidian Gold", hex: "#D97706" }
];

export default function ProfileSettingsModal({ isOpen, onClose }) {
  const { user, refreshProfile } = useAuth();

  // Studio Tier White-Label Custom Branding State
  const [studioLogoUrl, setStudioLogoUrl] = useState("");
  const [brandColor, setBrandColor] = useState("#F59E0B");
  const [isSavingBranding, setIsSavingBranding] = useState(false);
  const [brandingSuccessMsg, setBrandingSuccessMsg] = useState(null);
  const [brandingErrorMsg, setBrandingErrorMsg] = useState(null);

  // Telegram Deep-Linking State
  const [isCheckingConnection, setIsCheckingConnection] = useState(false);
  const [isDisconnectingTelegram, setIsDisconnectingTelegram] = useState(false);
  const [telegramStatusMsg, setTelegramStatusMsg] = useState(null);
  const [telegramErrorMsg, setTelegramErrorMsg] = useState(null);

  // Populate form fields from current user on open or update
  useEffect(() => {
    if (user) {
      setStudioLogoUrl(user.studio_logo_url || "");
      setBrandColor(user.brand_color || "#F59E0B");
    }
  }, [user, isOpen]);

  if (!isOpen) return null;

  const isStudio = user?.subscription_plan === "studio" || user?.role === "admin";
  const botUsername = "Photoguard_alert_bot";
  const telegramDeepLink = `https://t.me/${botUsername}?start=${user?.id || ""}`;

  // ==========================================
  // SECTION 1: SAVE CUSTOM STUDIO BRANDING
  // ==========================================
  const handleSaveBranding = async (e) => {
    e.preventDefault();
    setIsSavingBranding(true);
    setBrandingSuccessMsg(null);
    setBrandingErrorMsg(null);

    try {
      const trimmedLogo = studioLogoUrl.trim();
      const trimmedColor = brandColor.trim();

      await api.put("/api/auth/profile", {
        studio_logo_url: trimmedLogo || null,
        brand_color: trimmedColor || null
      });

      if (refreshProfile) {
        await refreshProfile();
      }

      setBrandingSuccessMsg("Custom studio branding updated! Your mobile client app theme is now customized.");
    } catch (err) {
      const detail = err?.response?.data?.detail || "Failed to update studio branding settings.";
      setBrandingErrorMsg(detail);
    } finally {
      setIsSavingBranding(false);
    }
  };

  // ==========================================
  // SECTION 2: TELEGRAM DEEP LINK & SYNC
  // ==========================================
  const handleCheckConnection = async () => {
    setIsCheckingConnection(true);
    setTelegramStatusMsg(null);
    setTelegramErrorMsg(null);

    try {
      if (refreshProfile) {
        const updatedUser = await refreshProfile();
        if (updatedUser?.telegram_chat_id) {
          setTelegramStatusMsg("Connected! Your Telegram account is actively linked to PhotoGuard.");
        } else {
          setTelegramStatusMsg("Waiting for connection... Click the link above, tap 'Start' in Telegram, then check again.");
        }
      }
    } catch (err) {
      setTelegramErrorMsg("Failed to check connection. Please try again.");
    } finally {
      setIsCheckingConnection(false);
    }
  };

  const handleDisconnectTelegram = async () => {
    if (!window.confirm("Are you sure you want to disconnect Telegram alerts? You will no longer receive real-time push alerts on client submissions.")) {
      return;
    }

    setIsDisconnectingTelegram(true);
    setTelegramStatusMsg(null);
    setTelegramErrorMsg(null);

    try {
      await api.put("/api/auth/profile", {
        telegram_chat_id: null
      });

      if (refreshProfile) {
        await refreshProfile();
      }
      setTelegramStatusMsg("Telegram account disconnected.");
    } catch (err) {
      setTelegramErrorMsg("Failed to disconnect Telegram. Please try again.");
    } finally {
      setIsDisconnectingTelegram(false);
    }
  };

  return (
    <div
      id="profile-settings-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in"
    >
      <div
        id="profile-settings-modal"
        className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-6 space-y-6 max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Studio Profile & Settings</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Manage custom white-labeling and automated Telegram submission alerts.
            </p>
          </div>
          <button
            id="close-settings-modal-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-6">
          {/* ========================================================= */}
          {/* SECTION 1: CUSTOM STUDIO WHITE-LABELING (DEDICATED FORM) */}
          {/* ========================================================= */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
              <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs">
                <Palette className="w-4 h-4" />
                <span>Custom Studio White-Labeling</span>
              </div>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                  isStudio
                    ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                    : "bg-slate-800 text-slate-400 border border-slate-700"
                }`}
              >
                {isStudio ? "Studio Plan Active" : "Studio Tier Only"}
              </span>
            </div>

            {isStudio ? (
              <form onSubmit={handleSaveBranding} className="space-y-4">
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  White-label the client mobile application with your photography studio logo and brand accent color.
                </p>

                {/* Studio Logo URL */}
                <div>
                  <label htmlFor="studio-logo-url-input" className="text-[11px] font-medium text-slate-300 block mb-1">
                    Studio Logo URL (PNG/SVG with transparent background)
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        id="studio-logo-url-input"
                        type="url"
                        value={studioLogoUrl}
                        onChange={(e) => setStudioLogoUrl(e.target.value)}
                        placeholder="https://your-domain.com/logo.png"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all font-mono"
                      />
                    </div>
                    {studioLogoUrl && (
                      <div className="w-9 h-9 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center overflow-hidden p-1 shrink-0">
                        <img
                          src={studioLogoUrl}
                          alt="Logo Preview"
                          className="max-w-full max-h-full object-contain"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Brand Accent Color */}
                <div>
                  <label htmlFor="brand-color-input" className="text-[11px] font-medium text-slate-300 block mb-1">
                    Brand Accent Color (Client Mobile App Theme)
                  </label>
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      id="brand-color-picker"
                      type="color"
                      value={brandColor}
                      onChange={(e) => setBrandColor(e.target.value)}
                      className="w-9 h-9 rounded-lg border border-slate-700 bg-transparent cursor-pointer p-0 shrink-0"
                    />
                    <input
                      id="brand-color-input"
                      type="text"
                      value={brandColor}
                      onChange={(e) => setBrandColor(e.target.value)}
                      placeholder="#F59E0B"
                      className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500 uppercase"
                    />
                  </div>

                  {/* Color Preset Chips */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {BRAND_COLOR_PRESETS.map((preset) => (
                      <button
                        key={preset.hex}
                        type="button"
                        onClick={() => setBrandColor(preset.hex)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-medium border transition-all ${
                          brandColor.toLowerCase() === preset.hex.toLowerCase()
                            ? "bg-slate-800 border-amber-500/80 text-white"
                            : "bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: preset.hex }}
                        />
                        <span>{preset.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Feedback Alerts */}
                {brandingSuccessMsg && (
                  <div className="p-2.5 rounded-lg bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-[11px] flex items-center gap-2 animate-in fade-in">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>{brandingSuccessMsg}</span>
                  </div>
                )}

                {brandingErrorMsg && (
                  <div className="p-2.5 rounded-lg bg-red-950/80 border border-red-500/40 text-red-300 text-[11px] flex items-center gap-2 animate-in fade-in">
                    <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                    <span>{brandingErrorMsg}</span>
                  </div>
                )}

                {/* Distinct Submit Button for Section 1 */}
                <button
                  id="save-studio-branding-btn"
                  type="submit"
                  disabled={isSavingBranding}
                  className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-semibold text-xs transition-all shadow-md flex items-center justify-center gap-1.5"
                >
                  {isSavingBranding ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving Studio Branding...</span>
                    </>
                  ) : (
                    <>
                      <Palette className="w-3.5 h-3.5" />
                      <span>Save Custom Studio Branding</span>
                    </>
                  )}
                </button>
              </form>
            ) : (
              <div className="space-y-2 text-slate-400 pt-1">
                <p className="text-[11px] leading-relaxed">
                  Display your photography studio logo and brand accent color in the client mobile app.
                  Upgrade to the <b>Studio Plan</b> to unlock complete white-label branding.
                </p>
                <div className="flex items-center gap-1.5 text-[11px] text-amber-400 font-medium">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Available on Studio Tier</span>
                </div>
              </div>
            )}
          </div>

          {/* ========================================================= */}
          {/* SECTION 2: TELEGRAM INTEGRATION (DEEP-LINKING WORKFLOW)   */}
          {/* ========================================================= */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-sky-500/30 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
              <div className="flex items-center gap-2 text-sky-400 font-semibold text-xs">
                <Send className="w-4 h-4" />
                <span>Telegram Instant Submission Alerts</span>
              </div>
              {user?.telegram_chat_id ? (
                <span className="inline-flex items-center gap-1.5 text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Connected & Active
                </span>
              ) : (
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 font-medium">
                  Not Connected
                </span>
              )}
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              Never miss a client selection! Connect with one click via Telegram deep-linking to receive real-time push alerts the moment a client finalizes and locks their album.
            </p>

            {user?.telegram_chat_id ? (
              /* Already Connected State */
              <div className="p-3 rounded-xl bg-slate-900 border border-emerald-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Linked to Telegram Chat ID</span>
                  </div>
                  <span className="font-mono text-[11px] text-slate-300 px-2 py-0.5 bg-slate-800 rounded-md border border-slate-700">
                    {user.telegram_chat_id}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Real-time alerts are operational. When a client submits their selections, PhotoGuard will automatically notify your Telegram.
                </p>
                <div className="flex gap-2 pt-1">
                  <button
                    id="disconnect-telegram-btn"
                    type="button"
                    onClick={handleDisconnectTelegram}
                    disabled={isDisconnectingTelegram}
                    className="w-full py-2 rounded-xl bg-slate-800 hover:bg-red-950/60 hover:text-red-300 hover:border-red-500/40 border border-slate-700 text-xs font-medium text-slate-300 transition-all flex items-center justify-center gap-1.5"
                  >
                    {isDisconnectingTelegram ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Unlink className="w-3.5 h-3.5" />
                    )}
                    <span>Disconnect Telegram</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Deep-Linking Connect State (No manual Chat ID!) */
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-sky-950/20 border border-sky-500/20 space-y-2">
                  <div className="text-[11px] font-semibold text-sky-300 flex items-center gap-1.5">
                    <span>1-Click Telegram Deep Link</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Click the button below to open Telegram, then tap <b>Start</b>. PhotoGuard will automatically detect your account and link your alerts in seconds.
                  </p>
                </div>

                {/* Step 1: Open Telegram Deep Link */}
                <a
                  id="connect-telegram-deep-link"
                  href={telegramDeepLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs transition-all shadow-md flex items-center justify-center gap-2 group"
                >
                  <Send className="w-3.5 h-3.5 fill-current" />
                  <span>Connect Telegram (@{botUsername})</span>
                  <ExternalLink className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </a>

                {/* Step 2: Check Connection */}
                <button
                  id="check-telegram-connection-btn"
                  type="button"
                  onClick={handleCheckConnection}
                  disabled={isCheckingConnection}
                  className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white font-semibold text-xs border border-slate-700 transition-all flex items-center justify-center gap-2"
                >
                  {isCheckingConnection ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400" />
                      <span>Checking Connection Status...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 text-sky-400" />
                      <span>Check Connection</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Telegram Status / Feedback Message */}
            {telegramStatusMsg && (
              <div
                className={`p-2.5 rounded-lg text-[11px] flex items-center gap-2 animate-in fade-in ${
                  user?.telegram_chat_id
                    ? "bg-emerald-950/80 border border-emerald-500/40 text-emerald-300"
                    : "bg-sky-950/80 border border-sky-500/40 text-sky-300"
                }`}
              >
                {user?.telegram_chat_id ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5 text-sky-400 shrink-0 animate-spin" />
                )}
                <span>{telegramStatusMsg}</span>
              </div>
            )}

            {telegramErrorMsg && (
              <div className="p-2.5 rounded-lg bg-red-950/80 border border-red-500/40 text-red-300 text-[11px] flex items-center gap-2 animate-in fade-in">
                <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                <span>{telegramErrorMsg}</span>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer Close */}
        <div className="pt-2">
          <button
            id="close-profile-modal-footer-btn"
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
