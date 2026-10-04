import React, { useState, useEffect, useRef } from "react";
import {
  Palette,
  Send,
  ExternalLink,
  Check,
  AlertCircle,
  Loader2,
  Lock,
  RefreshCw,
  Unlink,
  ShieldCheck,
  UploadCloud,
  Trash2,
  Phone,
  Instagram,
  Video,
  Youtube,
  Share2,
  Save
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";

// Standard brand color presets for studio photographers
const BRAND_COLOR_PRESETS = [
  { label: "Indigo Accent", hex: "#4F46E5" },
  { label: "Emerald Luxury", hex: "#10B981" },
  { label: "Sapphire Blue", hex: "#3B82F6" },
  { label: "Royal Amethyst", hex: "#8B5CF6" },
  { label: "Velvet Rose", hex: "#EC4899" },
  { label: "Obsidian Gold", hex: "#F59E0B" }
];

export default function ProfileBrandingView() {
  const { user, refreshProfile } = useAuth();

  // Studio Tier White-Label Custom Branding State
  const [studioLogoUrl, setStudioLogoUrl] = useState("");
  const [brandColor, setBrandColor] = useState("#4F46E5");
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [logoUploadError, setLogoUploadError] = useState(null);
  const [brandingSuccessMsg, setBrandingSuccessMsg] = useState(null);
  const [brandingErrorMsg, setBrandingErrorMsg] = useState(null);
  const [isDraggingLogo, setIsDraggingLogo] = useState(false);

  const fileInputRef = useRef(null);

  // Consolidated Save State
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(null);
  const [saveErrorMsg, setSaveErrorMsg] = useState(null);

  // Telegram Deep-Linking State
  const [isCheckingConnection, setIsCheckingConnection] = useState(false);
  const [isDisconnectingTelegram, setIsDisconnectingTelegram] = useState(false);
  const [telegramStatusMsg, setTelegramStatusMsg] = useState(null);
  const [telegramErrorMsg, setTelegramErrorMsg] = useState(null);

  // Studio Contact & Social Channels State
  const [contactPhone, setContactPhone] = useState("");
  const [telegramUrl, setTelegramUrl] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [tiktokUrl, setTiktokUrl] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");

  // Populate form fields from current user on open or update
  useEffect(() => {
    if (user) {
      setStudioLogoUrl(user.studio_logo_url || "");
      setBrandColor(user.brand_color || "#4F46E5");
      setContactPhone(user.contact_phone || user.phone_number || "");
      setTelegramUrl(user.telegram_url || user.telegram_username || "");
      setInstagramUrl(user.instagram_url || user.instagram || "");
      setTiktokUrl(user.tiktok_url || user.tiktok || "");
      setYoutubeUrl(user.youtube_url || user.youtube || "");
    }

    api.get("/api/v1/photographers/me/social-links")
      .then((res) => {
        if (res.data) {
          if (res.data.contact_phone || res.data.phone_number) {
            setContactPhone(res.data.contact_phone || res.data.phone_number);
          }
          if (res.data.telegram_url || res.data.telegram_username) {
            setTelegramUrl(res.data.telegram_url || res.data.telegram_username);
          }
          if (res.data.instagram_url || res.data.instagram) {
            setInstagramUrl(res.data.instagram_url || res.data.instagram);
          }
          if (res.data.tiktok_url || res.data.tiktok) {
            setTiktokUrl(res.data.tiktok_url || res.data.tiktok);
          }
          if (res.data.youtube_url || res.data.youtube) {
            setYoutubeUrl(res.data.youtube_url || res.data.youtube);
          }
        }
      })
      .catch(() => {});
  }, [user]);

  const isStudio = user?.subscription_plan === "studio" || user?.role === "admin";
  const botUsername = "Photoguard_alert_bot";
  const telegramDeepLink = `https://t.me/${botUsername}?start=${user?.id || ""}`;

  // ==========================================
  // SECTION 1: LOGO FILE UPLOAD HANDLER
  // ==========================================
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
        setBrandingSuccessMsg("Logo uploaded and saved to permanent cloud storage!");
      } else {
        throw new Error("No URL returned from upload endpoint");
      }
    } catch (err) {
      setLogoUploadError(err?.response?.data?.detail || err?.message || "Failed to upload logo image.");
    } finally {
      setIsUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) handleLogoUpload(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingLogo(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingLogo(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingLogo(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleLogoUpload(file);
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

  // ==========================================
  // CONSOLIDATED SAVE CHANGES HANDLER
  // ==========================================
  const handleSaveChanges = async (e) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    setSaveSuccessMsg(null);
    setSaveErrorMsg(null);

    const payload = {
      contact_phone: contactPhone ? contactPhone.trim() : null,
      telegram_url: telegramUrl ? telegramUrl.trim() : null,
      instagram_url: instagramUrl ? instagramUrl.trim() : null,
      tiktok_url: tiktokUrl ? tiktokUrl.trim() : null,
      youtube_url: youtubeUrl ? youtubeUrl.trim() : null,
      phone_number: contactPhone ? contactPhone.trim() : null,
      telegram_username: telegramUrl ? telegramUrl.trim() : null,
      instagram: instagramUrl ? instagramUrl.trim() : null,
      tiktok: tiktokUrl ? tiktokUrl.trim() : null,
      youtube: youtubeUrl ? youtubeUrl.trim() : null
    };

    if (isStudio) {
      payload.studio_logo_url = studioLogoUrl ? studioLogoUrl.trim() : null;
      payload.brand_color = brandColor ? brandColor.trim() : "#4F46E5";
    }

    try {
      await api.put("/api/auth/profile", payload);
      try {
        await api.put("/api/v1/photographers/me/social-links", payload);
      } catch (socialErr) {
        // Fallback endpoint handled silently
      }

      if (refreshProfile) await refreshProfile();
      setSaveSuccessMsg("Settings updated successfully.");
    } catch (err) {
      setSaveErrorMsg(err?.response?.data?.detail || "Failed to update settings.");
    } finally {
      setIsSaving(false);
    }
  };

  // ==========================================
  // SECTION 3: TELEGRAM DEEP LINK & SYNC
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
    if (!window.confirm("Are you sure you want to disconnect Telegram alerts?")) {
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

  return (
    <div className="max-w-4xl w-full mx-auto space-y-6">
      
      {/* Header */}
      <div className="pb-5 border-b border-slate-200">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Studio Profile & Branding</h2>
        <p className="text-sm text-slate-500 mt-1">Manage custom white-labeling and automated Telegram alerts.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Branding & Telegram */}
        <div className="space-y-6">
          {/* Branding Section */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-indigo-600 font-semibold text-sm">
                <Palette className="w-4 h-4" />
                <span>Studio Branding</span>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${isStudio ? "bg-indigo-50 text-indigo-700 border border-indigo-100" : "bg-slate-100 text-slate-500 border border-slate-200"}`}>
                {isStudio ? "Studio Plan Active" : "Studio Tier Only"}
              </span>
            </div>

            {isStudio ? (
              <div className="space-y-5">
                <p className="text-xs text-slate-500 leading-relaxed">Customize the client mobile application with your studio logo and brand color.</p>
                
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-2">Studio Logo</label>
                  {studioLogoUrl && (
                    <div className="mb-3 p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-12 h-12 rounded-lg bg-white border border-slate-200 flex items-center justify-center p-1.5 overflow-hidden shrink-0">
                          <img src={studioLogoUrl} alt="Logo Preview" className="max-w-full max-h-full object-contain" onError={(e) => e.currentTarget.style.display = "none"} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-900 truncate">Active Studio Logo</p>
                          <p className="text-[10px] text-slate-500 truncate max-w-[150px] font-mono">{studioLogoUrl}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploadingLogo} className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-[11px] font-medium text-slate-700 border border-slate-200 transition-colors">Replace</button>
                        <button type="button" onClick={handleRemoveLogo} disabled={isUploadingLogo} className="p-1.5 rounded-lg bg-white hover:bg-red-50 hover:text-red-600 text-slate-400 border border-slate-200 transition-colors" title="Remove logo"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  )}

                  <input ref={fileInputRef} type="file" accept="image/png, image/jpeg, image/svg+xml, image/webp" className="hidden" onChange={handleFileChange} disabled={isUploadingLogo} />
                  
                  <div
                    onClick={() => !isUploadingLogo && fileInputRef.current?.click()}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${isDraggingLogo ? "border-indigo-400 bg-indigo-50 text-indigo-700" : "border-slate-200 hover:border-indigo-300 bg-slate-50 hover:bg-slate-100 text-slate-500"}`}
                  >
                    {isUploadingLogo ? (
                      <><Loader2 className="w-6 h-6 text-indigo-600 animate-spin" /><span className="text-xs font-medium text-indigo-600">Uploading logo...</span></>
                    ) : (
                      <><div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center shadow-sm"><UploadCloud className="w-4 h-4 text-indigo-600" /></div><div><p className="text-xs font-medium text-slate-700">Click to upload or drag and drop</p><p className="text-[10px] text-slate-500 mt-0.5">PNG, SVG, or JPEG (Max 5MB)</p></div></>
                    )}
                  </div>
                  {logoUploadError && <p className="text-xs text-red-600 mt-2 flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5" />{logoUploadError}</p>}
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-2">Brand Accent Color</label>
                  <div className="flex items-center gap-3 mb-3">
                    <input type="color" value={brandColor} onChange={(e) => setBrandColor(e.target.value)} className="w-10 h-10 rounded-lg border border-slate-200 bg-white cursor-pointer p-0.5 shrink-0" />
                    <input type="text" value={brandColor} onChange={(e) => setBrandColor(e.target.value)} placeholder="#4F46E5" className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 font-mono focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 uppercase transition-all shadow-sm" />
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {BRAND_COLOR_PRESETS.map((preset) => (
                      <button key={preset.hex} type="button" onClick={() => setBrandColor(preset.hex)} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-all ${brandColor.toLowerCase() === preset.hex.toLowerCase() ? "bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                        <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: preset.hex }} />
                        <span>{preset.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {brandingSuccessMsg && <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2"><Check className="w-4 h-4" />{brandingSuccessMsg}</div>}
                {brandingErrorMsg && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2"><AlertCircle className="w-4 h-4" />{brandingErrorMsg}</div>}
              </div>
            ) : (
              <div className="text-slate-500 pt-2 space-y-2">
                <p className="text-xs leading-relaxed">Upgrade to the <b>Studio Plan</b> to customize your studio logo and mobile app brand color.</p>
                <div className="flex items-center gap-1.5 text-xs text-indigo-600 font-medium"><Lock className="w-4 h-4" />Available on Studio Tier</div>
              </div>
            )}
          </div>

          {/* Telegram Section */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-sky-600 font-semibold text-sm">
                <Send className="w-4 h-4" />
                <span>Telegram Alerts</span>
              </div>
              {user?.telegram_chat_id ? (
                <span className="inline-flex items-center gap-1.5 text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />Connected
                </span>
              ) : (
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200 font-medium">Not Connected</span>
              )}
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">Never miss a client selection! Receive real-time push alerts the moment a client finalizes their album.</p>

            {user?.telegram_chat_id ? (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-600 text-xs font-semibold"><ShieldCheck className="w-4 h-4" /><span>Linked to Telegram</span></div>
                  <span className="font-mono text-[11px] text-slate-600 px-2 py-0.5 bg-white rounded-md border border-slate-200 shadow-sm">{user.telegram_chat_id}</span>
                </div>
                <button type="button" onClick={handleDisconnectTelegram} disabled={isDisconnectingTelegram} className="w-full py-2 rounded-xl bg-white hover:bg-red-50 hover:text-red-600 hover:border-red-200 border border-slate-200 text-xs font-medium text-slate-600 transition-all flex items-center justify-center gap-1.5 shadow-sm">
                  {isDisconnectingTelegram ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unlink className="w-3.5 h-3.5" />}
                  <span>Disconnect Telegram</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-sky-50 border border-sky-100 space-y-2">
                  <div className="text-xs font-semibold text-sky-700 flex items-center gap-1.5">1-Click Deep Link</div>
                  <p className="text-xs text-sky-600 leading-relaxed">Click below to open Telegram and tap <b>Start</b>. We will automatically link your alerts.</p>
                </div>
                <a href={telegramDeepLink} target="_blank" rel="noopener noreferrer" className="w-full py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-semibold text-sm transition-all shadow-sm flex items-center justify-center gap-2 group">
                  <Send className="w-4 h-4 fill-current" />
                  <span>Connect Telegram</span>
                  <ExternalLink className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </a>
                <button type="button" onClick={handleCheckConnection} disabled={isCheckingConnection} className="w-full py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold text-sm transition-all shadow-sm flex items-center justify-center gap-2">
                  {isCheckingConnection ? <><Loader2 className="w-4 h-4 animate-spin text-sky-500" /><span>Checking...</span></> : <><RefreshCw className="w-4 h-4 text-sky-500" /><span>Check Connection</span></>}
                </button>
              </div>
            )}

            {telegramStatusMsg && <div className={`p-3 rounded-lg text-xs flex items-center gap-2 ${user?.telegram_chat_id ? "bg-emerald-50 border border-emerald-200 text-emerald-700" : "bg-sky-50 border border-sky-200 text-sky-700"}`}>{user?.telegram_chat_id ? <Check className="w-4 h-4" /> : <RefreshCw className="w-4 h-4 animate-spin" />}{telegramStatusMsg}</div>}
            {telegramErrorMsg && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2"><AlertCircle className="w-4 h-4" />{telegramErrorMsg}</div>}
          </div>
        </div>

        {/* Right Column: Social & Contact */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2 text-indigo-600 font-semibold text-sm">
              <Share2 className="w-4 h-4" />
              <span>Contact & Social Media</span>
            </div>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">Connect your direct studio channels so clients can easily call, message, and view your portfolio.</p>
          
          <div className="space-y-4 pt-1">
            <div>
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 mb-1.5"><Phone className="w-3.5 h-3.5 text-slate-400" />Phone Number</label>
              <input type="tel" placeholder="+251 91 123 4567" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 mb-1.5"><Send className="w-3.5 h-3.5 text-sky-500" />Telegram Username/URL</label>
              <input type="text" placeholder="@yourstudio" value={telegramUrl} onChange={(e) => setTelegramUrl(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 mb-1.5"><Instagram className="w-3.5 h-3.5 text-pink-500" />Instagram URL</label>
              <input type="text" placeholder="https://instagram.com/..." value={instagramUrl} onChange={(e) => setInstagramUrl(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 mb-1.5"><Video className="w-3.5 h-3.5 text-slate-800" />TikTok URL</label>
              <input type="text" placeholder="https://tiktok.com/..." value={tiktokUrl} onChange={(e) => setTiktokUrl(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 mb-1.5"><Youtube className="w-3.5 h-3.5 text-red-500" />YouTube URL</label>
              <input type="text" placeholder="https://youtube.com/..." value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-sm" />
            </div>
          </div>
        </div>
      </div>

      {/* Save Action Footer */}
      <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="w-full sm:w-auto flex-1">
          {saveSuccessMsg && <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2 max-w-md"><Check className="w-4 h-4 shrink-0" />{saveSuccessMsg}</div>}
          {saveErrorMsg && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2 max-w-md"><AlertCircle className="w-4 h-4 shrink-0" />{saveErrorMsg}</div>}
        </div>
        <button
          onClick={handleSaveChanges}
          disabled={isSaving || isUploadingLogo}
          className="w-full sm:w-auto px-8 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-sm transition-all shadow-sm flex items-center justify-center gap-2 shrink-0"
        >
          {isSaving ? <><Loader2 className="w-4 h-4 animate-spin" />Saving...</> : <><Save className="w-4 h-4" />Save All Settings</>}
        </button>
      </div>

    </div>
  );
}
