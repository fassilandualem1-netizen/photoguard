import React, { useState, useEffect, useRef } from "react";
import {
  Palette,
  UploadCloud,
  Check,
  AlertCircle,
  Loader2,
  Trash2,
  Phone,
  Send,
  ExternalLink,
  Instagram,
  Video,
  Youtube,
  Save,
  ShieldCheck,
  Sparkles,
  Cpu,
  Unlink,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";

const BRAND_COLOR_PRESETS = [
  { label: "PhotoGuard Amber", hex: "#F59E0B" },
  { label: "Emerald Luxury", hex: "#10B981" },
  { label: "Sapphire Blue", hex: "#3B82F6" },
  { label: "Royal Amethyst", hex: "#8B5CF6" },
  { label: "Velvet Rose", hex: "#EC4899" },
  { label: "Obsidian Gold", hex: "#D97706" }
];

export default function ProfileBrandingView() {
  const { user, refreshProfile } = useAuth();

  // Branding State
  const [studioLogoUrl, setStudioLogoUrl] = useState("");
  const [brandColor, setBrandColor] = useState("#F59E0B");
  const [isSavingBranding, setIsSavingBranding] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [logoUploadError, setLogoUploadError] = useState(null);
  const [brandingSuccessMsg, setBrandingSuccessMsg] = useState(null);
  const [brandingErrorMsg, setBrandingErrorMsg] = useState(null);
  const [isDraggingLogo, setIsDraggingLogo] = useState(false);
  const fileInputRef = useRef(null);

  // Telegram Deep-Linking State
  const [isCheckingConnection, setIsCheckingConnection] = useState(false);
  const [isDisconnectingTelegram, setIsDisconnectingTelegram] = useState(false);
  const [telegramStatusMsg, setTelegramStatusMsg] = useState(null);
  const [telegramErrorMsg, setTelegramErrorMsg] = useState(null);

  // Social & Contact State
  const [contactPhone, setContactPhone] = useState("");
  const [telegramUrl, setTelegramUrl] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [tiktokUrl, setTiktokUrl] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [isSavingSocial, setIsSavingSocial] = useState(false);
  const [socialSuccessMsg, setSocialSuccessMsg] = useState(null);
  const [socialErrorMsg, setSocialErrorMsg] = useState(null);

  const botUsername = "Photoguard_alert_bot";
  const telegramDeepLink = `https://t.me/${botUsername}?start=${user?.id || ""}`;

  useEffect(() => {
    if (user) {
      setStudioLogoUrl(user.studio_logo_url || "");
      setBrandColor(user.brand_color || "#F59E0B");
      setContactPhone(user.contact_phone || user.phone_number || "");
      setTelegramUrl(user.telegram_url || user.telegram_username || "");
      setInstagramUrl(user.instagram_url || user.instagram || "");
      setTiktokUrl(user.tiktok_url || user.tiktok || "");
      setYoutubeUrl(user.youtube_url || user.youtube || "");
    }

    api.get("/api/v1/photographers/me/social-links")
      .then((res) => {
        if (res.data) {
          if (res.data.contact_phone || res.data.phone_number) setContactPhone(res.data.contact_phone || res.data.phone_number);
          if (res.data.telegram_url || res.data.telegram_username) setTelegramUrl(res.data.telegram_url || res.data.telegram_username);
          if (res.data.instagram_url || res.data.instagram) setInstagramUrl(res.data.instagram_url || res.data.instagram);
          if (res.data.tiktok_url || res.data.tiktok) setTiktokUrl(res.data.tiktok_url || res.data.tiktok);
          if (res.data.youtube_url || res.data.youtube) setYoutubeUrl(res.data.youtube_url || res.data.youtube);
        }
      })
      .catch(() => {});
  }, [user]);

  // --- Logo Upload ---
  const handleLogoUpload = async (file) => {
    if (!file) return;
    const validMimes = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml", "image/webp"];
    if (!validMimes.includes(file.type)) {
      setLogoUploadError("Please upload a PNG, SVG, or JPEG image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setLogoUploadError("Logo file must be under 5MB.");
      return;
    }
    setIsUploadingLogo(true);
    setLogoUploadError(null);
    setBrandingSuccessMsg(null);
    setBrandingErrorMsg(null);
    const formData = new FormData();
    formData.append("file", file);
    try {
      let response;
      try {
        response = await api.post("/api/v1/users/upload-logo", formData, {
          headers: { "Content-Type": "multipart/form-data" }
        });
      } catch (postErr) {
        response = await api.post("/api/auth/upload-logo", formData, {
          headers: { "Content-Type": "multipart/form-data" }
        });
      }
      const uploadedUrl = response.data?.url;
      if (uploadedUrl) {
        setStudioLogoUrl(uploadedUrl);
        if (refreshProfile) await refreshProfile();
        setBrandingSuccessMsg("Logo uploaded and saved to permanent storage!");
      }
    } catch (err) {
      setLogoUploadError(err?.response?.data?.detail || err?.message || "Failed to upload logo image.");
    } finally {
      setIsUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveLogo = async () => {
    setStudioLogoUrl("");
    try {
      await api.put("/api/auth/profile", { studio_logo_url: null });
      if (refreshProfile) await refreshProfile();
      setBrandingSuccessMsg("Studio logo removed.");
    } catch (err) {
      setBrandingErrorMsg(err?.response?.data?.detail || "Failed to clear logo.");
    }
  };

  const handleSaveBranding = async (e) => {
    e.preventDefault();
    setIsSavingBranding(true);
    setBrandingSuccessMsg(null);
    setBrandingErrorMsg(null);
    try {
      await api.put("/api/auth/profile", {
        studio_logo_url: studioLogoUrl.trim() || null,
        brand_color: brandColor.trim() || "#F59E0B"
      });
      if (refreshProfile) await refreshProfile();
      setBrandingSuccessMsg("Custom studio branding updated successfully!");
    } catch (err) {
      setBrandingErrorMsg(err?.response?.data?.detail || "Failed to update studio branding.");
    } finally {
      setIsSavingBranding(false);
    }
  };

  // --- Telegram Deep-Linking ---
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
    if (!window.confirm("Disconnect Telegram alerts? You will no longer receive real-time push alerts on client submissions.")) {
      return;
    }
    setIsDisconnectingTelegram(true);
    setTelegramStatusMsg(null);
    setTelegramErrorMsg(null);
    try {
      await api.put("/api/auth/profile", { telegram_chat_id: null });
      if (refreshProfile) await refreshProfile();
      setTelegramStatusMsg("Telegram account disconnected.");
    } catch (err) {
      setTelegramErrorMsg("Failed to disconnect Telegram. Please try again.");
    } finally {
      setIsDisconnectingTelegram(false);
    }
  };

  // --- Social Links Save ---
  const handleSaveSocial = async (e) => {
    e.preventDefault();
    setIsSavingSocial(true);
    setSocialSuccessMsg(null);
    setSocialErrorMsg(null);
    const payload = {
      contact_phone: contactPhone.trim() || null,
      telegram_url: telegramUrl.trim() || null,
      instagram_url: instagramUrl.trim() || null,
      tiktok_url: tiktokUrl.trim() || null,
      youtube_url: youtubeUrl.trim() || null,
      phone_number: contactPhone.trim() || null,
      telegram_username: telegramUrl.trim() || null,
      instagram: instagramUrl.trim() || null,
      tiktok: tiktokUrl.trim() || null,
      youtube: youtubeUrl.trim() || null,
    };
    try {
      await api.put("/api/v1/photographers/me/social-links", payload);
      await api.put("/api/auth/profile", payload);
      if (refreshProfile) await refreshProfile();
      setSocialSuccessMsg("Client contact and social channels updated!");
    } catch (err) {
      setSocialErrorMsg(err?.response?.data?.detail || "Failed to save social links.");
    } finally {
      setIsSavingSocial(false);
    }
  };

  return (
    <div id="profile-branding-view" className="space-y-6 max-w-4xl">
      {/* Title */}
      <div className="pb-2">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Studio Profile & Custom Branding
          </h1>
          <span className="px-2.5 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20 text-xs font-semibold uppercase tracking-wider">
            White-Label
          </span>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Customize your studio identity, upload your client watermark logo, configure brand accent colors, and manage contact channels.
        </p>
      </div>

      {/* Section 1: Custom Studio Logo */}
      <div className="p-6 rounded-2xl bg-[#151a23] border border-slate-800 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-orange-400" />
            <h2 className="text-sm font-semibold text-white">Custom Studio Logo</h2>
          </div>
          <span className="text-[11px] text-slate-400">PNG, SVG or JPEG up to 5MB</span>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-5">
          <div className="w-24 h-24 rounded-2xl bg-slate-900 border border-slate-700/80 flex items-center justify-center p-2 overflow-hidden shrink-0 shadow-inner">
            {studioLogoUrl ? (
              <img src={studioLogoUrl} alt="Studio Logo" className="w-full h-full object-contain" />
            ) : (
              <span className="text-xs text-slate-500 font-mono text-center">No Logo Uploaded</span>
            )}
          </div>

          <div
            onDragOver={(e) => { e.preventDefault(); setIsDraggingLogo(true); }}
            onDragLeave={(e) => { e.preventDefault(); setIsDraggingLogo(false); }}
            onDrop={(e) => {
              e.preventDefault();
              setIsDraggingLogo(false);
              const file = e.dataTransfer.files?.[0];
              if (file) handleLogoUpload(file);
            }}
            className={`flex-1 w-full border-2 border-dashed rounded-xl p-5 text-center transition-all ${
              isDraggingLogo ? "border-orange-500 bg-orange-500/10" : "border-slate-700 hover:border-slate-600 bg-slate-900/40"
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleLogoUpload(file);
              }}
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              className="hidden"
            />
            <div className="flex flex-col items-center gap-2">
              {isUploadingLogo ? (
                <Loader2 className="w-6 h-6 text-orange-400 animate-spin" />
              ) : (
                <UploadCloud className="w-6 h-6 text-slate-400" />
              )}
              <p className="text-xs text-slate-300">
                Drag and drop your studio logo, or{" "}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-orange-400 hover:underline font-semibold cursor-pointer"
                >
                  browse files
                </button>
              </p>
            </div>
          </div>
        </div>

        {logoUploadError && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{logoUploadError}</span>
          </div>
        )}

        {studioLogoUrl && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleRemoveLogo}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs font-medium transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Remove Logo</span>
            </button>
          </div>
        )}
      </div>

      {/* Section 2: Brand Accent Color */}
      <div className="p-6 rounded-2xl bg-[#151a23] border border-slate-800 space-y-5">
        <div className="flex items-center gap-2.5">
          <Cpu className="w-4 h-4 text-orange-400" />
          <h2 className="text-sm font-semibold text-white">Brand Accent Color</h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {BRAND_COLOR_PRESETS.map((preset) => (
            <button
              key={preset.hex}
              type="button"
              onClick={() => setBrandColor(preset.hex)}
              className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all cursor-pointer ${
                brandColor.toLowerCase() === preset.hex.toLowerCase()
                  ? "border-white/40 bg-white/5 shadow-md"
                  : "border-slate-800 hover:border-slate-700 bg-slate-900/40"
              }`}
            >
              <span
                className="w-6 h-6 rounded-full border border-black/40 shadow-sm"
                style={{ backgroundColor: preset.hex }}
              />
              <span className="text-[10px] text-slate-300 font-medium text-center truncate w-full">
                {preset.label}
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 max-w-xs">
          <input
            type="color"
            value={brandColor}
            onChange={(e) => setBrandColor(e.target.value)}
            className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-700 cursor-pointer p-0.5"
          />
          <input
            type="text"
            value={brandColor}
            onChange={(e) => setBrandColor(e.target.value)}
            placeholder="#F59E0B"
            className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-slate-200 uppercase focus:outline-none focus:border-orange-500/60"
          />
        </div>

        {brandingSuccessMsg && (
          <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-xs flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>{brandingSuccessMsg}</span>
          </div>
        )}

        {brandingErrorMsg && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{brandingErrorMsg}</span>
          </div>
        )}

        <button
          type="button"
          onClick={handleSaveBranding}
          disabled={isSavingBranding}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-slate-950 font-semibold text-xs transition-all duration-200 shadow-md shadow-orange-500/20 cursor-pointer"
        >
          {isSavingBranding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          <span>Save Branding</span>
        </button>
      </div>

      {/* Section 3: Telegram Instant Alerts */}
      <div className="p-6 rounded-2xl bg-[#151a23] border border-sky-500/20 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Send className="w-4 h-4 text-sky-400" />
            <h2 className="text-sm font-semibold text-white">Telegram Instant Submission Alerts</h2>
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

        <p className="text-xs text-slate-400 leading-relaxed">
          Never miss a client selection. Connect once via Telegram deep-linking to receive real-time push alerts the moment a client finalizes their album.
        </p>

        {user?.telegram_chat_id ? (
          <div className="p-4 rounded-xl bg-slate-900 border border-emerald-500/20 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold">
                <ShieldCheck className="w-4 h-4" />
                <span>Linked to Telegram Chat ID</span>
              </div>
              <span className="font-mono text-[11px] text-slate-300 px-2 py-0.5 bg-slate-800 rounded-md border border-slate-700">
                {user.telegram_chat_id}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Real-time alerts are operational. PhotoGuard will notify your Telegram automatically on every client submission.
            </p>
            <button
              type="button"
              onClick={handleDisconnectTelegram}
              disabled={isDisconnectingTelegram}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-red-950/60 hover:text-red-300 hover:border-red-500/40 border border-slate-700 text-xs font-medium text-slate-300 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {isDisconnectingTelegram ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Unlink className="w-3.5 h-3.5" />
              )}
              <span>Disconnect Telegram</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-sky-950/20 border border-sky-500/20 space-y-1.5">
              <p className="text-xs font-semibold text-sky-300">1-Click Deep Link</p>
              <p className="text-xs text-slate-400 leading-relaxed">
                Click below to open Telegram, then tap <b>Start</b>. PhotoGuard will automatically detect and link your account in seconds.
              </p>
            </div>

            <a
              href={telegramDeepLink}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs transition-all shadow-md flex items-center justify-center gap-2 group"
            >
              <Send className="w-3.5 h-3.5 fill-current" />
              <span>Connect Telegram (@{botUsername})</span>
              <ExternalLink className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </a>

            <button
              type="button"
              onClick={handleCheckConnection}
              disabled={isCheckingConnection}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white font-semibold text-xs border border-slate-700 transition-all flex items-center justify-center gap-2 cursor-pointer"
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

        {telegramStatusMsg && (
          <div
            className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
              user?.telegram_chat_id
                ? "bg-emerald-950/80 border border-emerald-500/40 text-emerald-300"
                : "bg-sky-950/80 border border-sky-500/40 text-sky-300"
            }`}
          >
            {user?.telegram_chat_id ? (
              <Check className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5 shrink-0" />
            )}
            <span>{telegramStatusMsg}</span>
          </div>
        )}

        {telegramErrorMsg && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{telegramErrorMsg}</span>
          </div>
        )}
      </div>

      {/* Section 4: Client Contact & Social Channels */}
      <div className="p-6 rounded-2xl bg-[#151a23] border border-slate-800 space-y-5">
        <div className="flex items-center gap-2.5">
          <Phone className="w-4 h-4 text-orange-400" />
          <h2 className="text-sm font-semibold text-white">Client Contact & Social Links</h2>
        </div>

        <form onSubmit={handleSaveSocial} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Phone / WhatsApp
              </label>
              <input
                type="text"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="+1 555-0199"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-orange-500/60"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Telegram Handle / Bot Channel
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={telegramUrl}
                  onChange={(e) => setTelegramUrl(e.target.value)}
                  placeholder="@yourstudio"
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-orange-500/60"
                />
                <a
                  href={telegramDeepLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-300 hover:text-white text-xs font-medium transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Connect</span>
                </a>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Instagram Profile
              </label>
              <input
                type="text"
                value={instagramUrl}
                onChange={(e) => setInstagramUrl(e.target.value)}
                placeholder="https://instagram.com/studio"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-orange-500/60"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                TikTok Handle
              </label>
              <input
                type="text"
                value={tiktokUrl}
                onChange={(e) => setTiktokUrl(e.target.value)}
                placeholder="@studio_photography"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-orange-500/60"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                YouTube Channel
              </label>
              <input
                type="text"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="https://youtube.com/@yourstudio"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-orange-500/60"
              />
            </div>
          </div>

          {socialSuccessMsg && (
            <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-xs flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>{socialSuccessMsg}</span>
            </div>
          )}

          {socialErrorMsg && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{socialErrorMsg}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSavingSocial}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-slate-950 font-semibold text-xs transition-all duration-200 shadow-md shadow-orange-500/20 cursor-pointer"
          >
            {isSavingSocial ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>Save Contact Channels</span>
          </button>
        </form>
      </div>
    </div>
  );
}
