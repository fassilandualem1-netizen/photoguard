import React, { useState, useEffect } from "react";
import {
  Phone,
  Send,
  Instagram,
  Video,
  Youtube,
  Share2,
  Lock,
  Sparkles,
  Check,
  AlertCircle,
  Loader2,
  Save
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";

export default function SocialLinksSettings({ onUpgradeClick }) {
  const { user, refreshProfile } = useAuth();

  // Social Links Form State
  const [formData, setFormData] = useState({
    contact_phone: "",
    telegram_url: "",
    instagram_url: "",
    tiktok_url: "",
    youtube_url: ""
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const isStudio = user?.subscription_plan === "studio" || user?.role === "admin";

  // Initialize or fetch social links
  useEffect(() => {
    if (user) {
      setFormData({
        contact_phone: user.contact_phone || "",
        telegram_url: user.telegram_url || "",
        instagram_url: user.instagram_url || "",
        tiktok_url: user.tiktok_url || "",
        youtube_url: user.youtube_url || ""
      });
    }

    const fetchSocialLinks = async () => {
      try {
        setIsLoading(true);
        const res = await api.get("/api/v1/photographers/me/social-links");
        if (res.data) {
          setFormData({
            contact_phone: res.data.contact_phone || "",
            telegram_url: res.data.telegram_url || "",
            instagram_url: res.data.instagram_url || "",
            tiktok_url: res.data.tiktok_url || "",
            youtube_url: res.data.youtube_url || ""
          });
        }
      } catch (err) {
        // Fallback to user context values already populated
      } finally {
        setIsLoading(false);
      }
    };

    fetchSocialLinks();
  }, [user]);

  const handleChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value
    }));
    if (successMsg) setSuccessMsg(null);
    if (errorMsg) setErrorMsg(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isStudio) return;

    setIsSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const payload = {
        contact_phone: formData.contact_phone.trim() || null,
        telegram_url: formData.telegram_url.trim() || null,
        instagram_url: formData.instagram_url.trim() || null,
        tiktok_url: formData.tiktok_url.trim() || null,
        youtube_url: formData.youtube_url.trim() || null
      };

      const res = await api.put("/api/v1/photographers/me/social-links", payload);

      if (res.data) {
        setFormData({
          contact_phone: res.data.contact_phone || "",
          telegram_url: res.data.telegram_url || "",
          instagram_url: res.data.instagram_url || "",
          tiktok_url: res.data.tiktok_url || "",
          youtube_url: res.data.youtube_url || ""
        });
      }

      setSuccessMsg("Social & contact links updated successfully! They are now visible in your clients' mobile app.");
      if (refreshProfile) {
        await refreshProfile();
      }
    } catch (err) {
      const detail = err.response?.data?.detail || "Failed to update social links. Please try again.";
      setErrorMsg(detail);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="relative p-5 rounded-2xl bg-slate-950/70 border border-slate-800 shadow-xl overflow-hidden">
      {/* Header with Title and Tier Status Badge */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-4">
        <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs sm:text-sm">
          <Share2 className="w-4 h-4 text-amber-400" />
          <span>Social & Contact Links</span>
        </div>
        <span
          className={`text-[10px] px-2.5 py-0.5 rounded-full font-medium tracking-wide uppercase ${
            isStudio
              ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
              : "bg-slate-800 text-slate-400 border border-slate-700"
          }`}
        >
          {isStudio ? "Studio Plan Active" : "Studio Tier Only"}
        </span>
      </div>

      <p className="text-xs text-slate-400 mb-4 leading-relaxed">
        Connect your direct channels so clients can easily call, message, and follow your studio portfolio right from their delivery gallery.
      </p>

      {/* Prominent Banner for Basic Plan Tier (CRITICAL REQUIREMENT) */}
      {!isStudio && (
        <div className="mb-5 p-4 rounded-xl bg-gradient-to-r from-amber-500/15 via-amber-600/10 to-transparent border border-amber-500/30 text-amber-200 text-xs flex items-start gap-3 shadow-lg animate-in fade-in">
          <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 shrink-0 mt-0.5">
            <Lock className="w-4 h-4" />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-amber-300">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Studio Feature Locked</span>
            </div>
            <p className="text-[12px] text-amber-100/90 font-medium leading-normal">
              Upgrade to the Studio Plan to display your social links and contact info directly in your clients' mobile app!
            </p>
            {onUpgradeClick && (
              <button
                type="button"
                onClick={onUpgradeClick}
                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] transition-colors shadow-sm"
              >
                <span>Upgrade to Studio</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Feedback Messages */}
      {successMsg && (
        <div className="mb-4 p-3 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="mb-4 p-3 rounded-xl bg-red-950/80 border border-red-500/40 text-red-300 text-xs flex items-center gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Social Links Form */}
      <form onSubmit={handleSubmit} className="space-y-3.5">
        <fieldset disabled={!isStudio || isSaving} className={!isStudio ? "opacity-60 select-none cursor-not-allowed" : ""}>
          {/* 1. Contact Phone */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-slate-300 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-amber-400" />
              <span>Contact Phone Number</span>
            </label>
            <input
              type="tel"
              placeholder="+251 91 123 4567 or (555) 019-2834"
              value={formData.contact_phone}
              onChange={(e) => handleChange("contact_phone", e.target.value)}
              disabled={!isStudio || isSaving}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-xs text-white placeholder-slate-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>

          {/* 2. Telegram */}
          <div className="space-y-1 mt-3">
            <label className="text-[11px] font-medium text-slate-300 flex items-center gap-1.5">
              <Send className="w-3.5 h-3.5 text-sky-400" />
              <span>Telegram Channel or Username</span>
            </label>
            <input
              type="text"
              placeholder="https://t.me/yourstudio or @yourstudio"
              value={formData.telegram_url}
              onChange={(e) => handleChange("telegram_url", e.target.value)}
              disabled={!isStudio || isSaving}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-xs text-white placeholder-slate-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>

          {/* 3. Instagram */}
          <div className="space-y-1 mt-3">
            <label className="text-[11px] font-medium text-slate-300 flex items-center gap-1.5">
              <Instagram className="w-3.5 h-3.5 text-pink-400" />
              <span>Instagram Profile</span>
            </label>
            <input
              type="text"
              placeholder="https://instagram.com/yourstudio or @yourstudio"
              value={formData.instagram_url}
              onChange={(e) => handleChange("instagram_url", e.target.value)}
              disabled={!isStudio || isSaving}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-xs text-white placeholder-slate-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>

          {/* 4. TikTok */}
          <div className="space-y-1 mt-3">
            <label className="text-[11px] font-medium text-slate-300 flex items-center gap-1.5">
              <Video className="w-3.5 h-3.5 text-teal-400" />
              <span>TikTok Profile</span>
            </label>
            <input
              type="text"
              placeholder="https://tiktok.com/@yourstudio or @yourstudio"
              value={formData.tiktok_url}
              onChange={(e) => handleChange("tiktok_url", e.target.value)}
              disabled={!isStudio || isSaving}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-xs text-white placeholder-slate-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>

          {/* 5. YouTube */}
          <div className="space-y-1 mt-3">
            <label className="text-[11px] font-medium text-slate-300 flex items-center gap-1.5">
              <Youtube className="w-3.5 h-3.5 text-red-500" />
              <span>YouTube Channel</span>
            </label>
            <input
              type="text"
              placeholder="https://youtube.com/@yourstudio"
              value={formData.youtube_url}
              onChange={(e) => handleChange("youtube_url", e.target.value)}
              disabled={!isStudio || isSaving}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-xs text-white placeholder-slate-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>

          {/* Submit Action Button */}
          {isStudio && (
            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs transition-all shadow-md flex items-center gap-2 group"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving Links...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                    <span>Save Social Links</span>
                  </>
                )}
              </button>
            </div>
          )}
        </fieldset>
      </form>
    </div>
  );
}
