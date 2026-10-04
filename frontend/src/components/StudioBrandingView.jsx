import React, { useState, useRef } from "react";
import {
  Image as ImageIcon,
  Check,
  AlertCircle,
  Loader2,
  Trash2,
  UploadCloud,
  Save
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";

// Expanded brand color presets
const BRAND_COLOR_PRESETS = [
  { label: "Indigo Accent", hex: "#4F46E5" },
  { label: "Emerald Luxury", hex: "#10B981" },
  { label: "Sapphire Blue", hex: "#3B82F6" },
  { label: "Royal Amethyst", hex: "#8B5CF6" },
  { label: "Velvet Rose", hex: "#E11D48" },
  { label: "Obsidian Gold", hex: "#F59E0B" },
  { label: "Ocean Cyan", hex: "#06B6D4" },
  { label: "Sunset Orange", hex: "#F97316" },
  { label: "Charcoal Black", hex: "#334155" },
];

export default function StudioBrandingView() {
  const { user, refreshProfile } = useAuth();
  
  const [studioLogoUrl, setStudioLogoUrl] = useState(user?.studio_logo_url || "");
  const [brandColor, setBrandColor] = useState(user?.brand_color || "#4F46E5");
  
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [logoUploadError, setLogoUploadError] = useState(null);
  const [isDraggingLogo, setIsDraggingLogo] = useState(false);
  const fileInputRef = useRef(null);
  
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(null);
  const [saveErrorMsg, setSaveErrorMsg] = useState(null);

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setLogoUploadError("Please select a valid image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setLogoUploadError("Logo file must be less than 5MB.");
      return;
    }

    setLogoUploadError(null);
    setIsUploadingLogo(true);
    setSaveSuccessMsg(null);

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
      
      const newUrl = response.data.studio_logo_url;
      setStudioLogoUrl(newUrl);
      if (refreshProfile) await refreshProfile();
      setSaveSuccessMsg("Studio logo updated successfully.");
    } catch (err) {
      const msg = err.response?.data?.detail || "Failed to upload logo.";
      setLogoUploadError(msg);
    } finally {
      setIsUploadingLogo(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemoveLogo = async () => {
    if (!window.confirm("Are you sure you want to remove your studio logo?")) return;
    
    setLogoUploadError(null);
    setIsUploadingLogo(true);
    setSaveSuccessMsg(null);

    try {
      await api.put("/api/auth/profile", { studio_logo_url: null });
      setStudioLogoUrl("");
      if (refreshProfile) await refreshProfile();
      setSaveSuccessMsg("Studio logo removed.");
    } catch (err) {
      setLogoUploadError("Failed to remove logo.");
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDraggingLogo(true);
  };
  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDraggingLogo(false);
  };
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDraggingLogo(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const dropEvent = { target: { files: e.dataTransfer.files } };
      handleLogoUpload(dropEvent);
    }
  };

  const handleSaveChanges = async () => {
    setIsSaving(true);
    setSaveSuccessMsg(null);
    setSaveErrorMsg(null);
    
    try {
      const payload = { brand_color: brandColor };
      await api.put("/api/auth/profile", payload);
      
      if (refreshProfile) await refreshProfile();
      setSaveSuccessMsg("Branding settings saved successfully.");
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
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Studio Branding</h2>
        <p className="text-sm text-slate-500 mt-1">Customize the client mobile application with your studio logo and brand color.</p>
      </div>

      <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 text-indigo-600 font-semibold text-sm">
            <ImageIcon className="w-4 h-4" />
            <span>Studio Identity</span>
          </div>
          {user?.subscription_plan === "studio" && (
            <span className="text-[10px] uppercase tracking-wider font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100">
              Studio Plan Active
            </span>
          )}
        </div>

        {/* Logo Section */}
        <div className="space-y-3">
          <label className="text-xs font-semibold text-slate-700">Studio Logo</label>
          
          {logoUploadError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />{logoUploadError}
            </div>
          )}

          {studioLogoUrl ? (
            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-white border border-slate-200 flex items-center justify-center p-1 shadow-sm">
                  <img src={studioLogoUrl} alt="Studio Logo" className="w-full h-full object-contain rounded" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Active Studio Logo</p>
                  <p className="text-xs text-slate-500 truncate max-w-[200px] sm:max-w-xs">{studioLogoUrl}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingLogo}
                  className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
                >
                  Replace
                </button>
                <button
                  type="button"
                  onClick={handleRemoveLogo}
                  disabled={isUploadingLogo}
                  className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors shadow-sm"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`w-full p-8 rounded-xl border-2 border-dashed flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                isDraggingLogo
                  ? "border-indigo-400 bg-indigo-50"
                  : "border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-slate-400"
              }`}
            >
              <UploadCloud className={`w-8 h-8 mb-2 ${isDraggingLogo ? "text-indigo-500" : "text-slate-400"}`} />
              <p className="text-sm font-medium text-slate-900">Click to upload or drag and drop</p>
              <p className="text-xs text-slate-500 mt-1">PNG, SVG, or JPEG (Max 5MB)</p>
            </div>
          )}
          
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleLogoUpload}
            accept="image/*"
            className="hidden"
          />
        </div>

        {/* Brand Accent Color */}
        <div className="space-y-4 pt-4 border-t border-slate-100">
          <label className="text-xs font-semibold text-slate-700 block">Brand Accent Color</label>
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg border border-slate-200 shadow-sm"
              style={{ backgroundColor: brandColor }}
            />
            <input
              type="text"
              value={brandColor}
              onChange={(e) => setBrandColor(e.target.value.toUpperCase())}
              className="flex-1 max-w-[150px] bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-mono text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-sm"
            />
          </div>

          <div className="flex flex-wrap gap-2.5 pt-2">
            {BRAND_COLOR_PRESETS.map((preset) => (
              <button
                key={preset.hex}
                type="button"
                onClick={() => setBrandColor(preset.hex)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs transition-all ${
                  brandColor === preset.hex
                    ? "border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm font-semibold"
                    : "border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-medium"
                }`}
              >
                <span className="w-3 h-3 rounded-full shadow-inner" style={{ backgroundColor: preset.hex }} />
                {preset.label}
              </button>
            ))}
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
          disabled={isSaving || isUploadingLogo}
          className="w-full sm:w-auto px-8 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-sm transition-all shadow-sm flex items-center justify-center gap-2 shrink-0"
        >
          {isSaving ? <><Loader2 className="w-4 h-4 animate-spin" />Saving...</> : <><Save className="w-4 h-4" />Save Settings</>}
        </button>
      </div>
    </div>
  );
}
