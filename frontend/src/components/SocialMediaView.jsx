import React, { useState } from "react";
import {
  Share2,
  Check,
  AlertCircle,
  Loader2,
  Phone,
  Instagram,
  Video,
  Youtube,
  Send,
  Save
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";

export default function SocialMediaView() {
  const { user, refreshProfile } = useAuth();
  
  const [contactPhone, setContactPhone] = useState(user?.contact_phone || "");
  const [telegramUrl, setTelegramUrl] = useState(user?.telegram_url || "");
  const [instagramUrl, setInstagramUrl] = useState(user?.instagram_url || "");
  const [tiktokUrl, setTiktokUrl] = useState(user?.tiktok_url || "");
  const [youtubeUrl, setYoutubeUrl] = useState(user?.youtube_url || "");
  
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(null);
  const [saveErrorMsg, setSaveErrorMsg] = useState(null);

  const handleSaveChanges = async () => {
    setIsSaving(true);
    setSaveSuccessMsg(null);
    setSaveErrorMsg(null);
    
    try {
      const payload = {
        contact_phone: contactPhone,
        telegram_url: telegramUrl,
        instagram_url: instagramUrl,
        tiktok_url: tiktokUrl,
        youtube_url: youtubeUrl
      };
      
      // Update core user profile
      await api.put("/api/auth/profile", payload);
      
      // Attempt to sync with public photographer profile if it exists
      try {
        await api.put("/api/v1/photographers/me/social-links", payload);
      } catch (socialErr) {
        // Silently ignore if they haven't set up their public profile yet
      }
      
      if (refreshProfile) await refreshProfile();
      setSaveSuccessMsg("Contact & social media settings saved successfully.");
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    } catch (err) {
      const msg = err.response?.data?.detail || "Failed to save settings.";
      setSaveErrorMsg(msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl w-full mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Header section */}
      <div className="pb-5 border-b border-slate-200">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Contact & Social Media</h2>
        <p className="text-sm text-slate-500 mt-1">Connect your direct studio channels so clients can easily call, message, and view your portfolio.</p>
      </div>

      <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-5">
        <div className="flex items-center gap-2 text-indigo-600 font-semibold text-sm border-b border-slate-100 pb-3">
          <Share2 className="w-4 h-4" />
          <span>Public Links</span>
        </div>
        
        <div className="space-y-4 pt-1">
          <div>
            <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 mb-1.5">
              <Phone className="w-4 h-4 text-slate-400" />Phone Number
            </label>
            <input
              type="tel"
              placeholder="+251 91 123 4567"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-sm"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 mb-1.5">
              <Send className="w-4 h-4 text-sky-500" />Telegram Username/URL
            </label>
            <input
              type="text"
              placeholder="@yourstudio or https://t.me/yourstudio"
              value={telegramUrl}
              onChange={(e) => setTelegramUrl(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-sm"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 mb-1.5">
              <Instagram className="w-4 h-4 text-pink-500" />Instagram URL
            </label>
            <input
              type="url"
              placeholder="https://instagram.com/..."
              value={instagramUrl}
              onChange={(e) => setInstagramUrl(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-sm"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 mb-1.5">
              <Video className="w-4 h-4 text-slate-800" />TikTok URL
            </label>
            <input
              type="url"
              placeholder="https://tiktok.com/..."
              value={tiktokUrl}
              onChange={(e) => setTiktokUrl(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-sm"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 mb-1.5">
              <Youtube className="w-4 h-4 text-red-500" />YouTube URL
            </label>
            <input
              type="url"
              placeholder="https://youtube.com/..."
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-sm"
            />
          </div>
        </div>
      </div>

      {/* Save Action Footer */}
      <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="w-full sm:w-auto flex-1">
          {saveSuccessMsg && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm flex items-center gap-2 max-w-md shadow-sm">
              <Check className="w-5 h-5 shrink-0 text-emerald-500" />
              <span className="font-medium">{saveSuccessMsg}</span>
            </div>
          )}
          {saveErrorMsg && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2 max-w-md shadow-sm">
              <AlertCircle className="w-5 h-5 shrink-0 text-red-500" />
              <span>{saveErrorMsg}</span>
            </div>
          )}
        </div>
        <button
          onClick={handleSaveChanges}
          disabled={isSaving}
          className="w-full sm:w-auto px-8 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-sm transition-all shadow-sm flex items-center justify-center gap-2 shrink-0"
        >
          {isSaving ? <><Loader2 className="w-4 h-4 animate-spin" />Saving...</> : <><Save className="w-4 h-4" />Save Settings</>}
        </button>
      </div>
    </div>
  );
}
