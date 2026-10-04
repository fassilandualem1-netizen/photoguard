import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import { FolderPlus, AlertCircle, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function CreateAlbumView() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [title, setTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [allowDownload, setAllowDownload] = useState(false);
  const [expiresInDays, setExpiresInDays] = useState(15);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const isStudio = user?.subscription_plan === "studio";

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !clientName.trim()) {
      setError("Please fill in both the album title and client name.");
      return;
    }

    const payload = {
      title: title.trim(),
      client_name: clientName.trim(),
      allow_download: allowDownload,
    };

    if (isStudio && expiresInDays) {
      const days = parseInt(expiresInDays, 10);
      if (isNaN(days) || days < 1 || days > 15) {
        setError("Lifespan must be between 1 and 15 days.");
        return;
      }
      payload.expires_in_days = days;
    }

    try {
      setLoading(true);
      setError(null);
      await api.post("/api/v1/albums", payload);

      // On successful creation, navigate back to the main albums tab
      navigate("/dashboard?tab=albums");
      
    } catch (err) {
      const msg =
        err.response?.data?.detail ||
        "Failed to create album. Please verify your details and try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate("/dashboard?tab=albums");
  };

  return (
    <div className="max-w-2xl w-full mx-auto space-y-6">
      {/* Header */}
      <div className="pb-5 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 shrink-0">
            <FolderPlus className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Create New Gallery</h2>
            <p className="text-sm text-slate-500 mt-1">
              Set up a new client gallery, define lifespans, and generate secure access PINs.
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm">
        {/* Error Alert */}
        {error && (
          <div className="mb-5 p-4 rounded-xl border border-red-200 bg-red-50 text-red-700 flex items-start gap-2.5 text-sm shadow-sm">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">
              Album Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Sara & John Wedding"
              required
              disabled={loading}
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-sm disabled:opacity-50"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">
              Client Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="e.g. Sara Jenkins"
              required
              disabled={loading}
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-sm disabled:opacity-50"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-slate-700">
                Access PIN
              </label>
              <span className="text-[11px] font-mono font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                Auto-Generated
              </span>
            </div>
            <input
              type="text"
              value="Will be generated upon creation"
              readOnly
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-500 cursor-not-allowed select-none focus:outline-none shadow-inner"
            />
          </div>

          {/* Conditional Expiration for Studio Tier */}
          {isStudio && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-slate-700">
                  Gallery Lifespan (Days)
                </label>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100">
                  Studio Tier
                </span>
              </div>
              <input
                type="number"
                min="1"
                max="15"
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(e.target.value)}
                disabled={loading}
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-sm disabled:opacity-50"
              />
              <p className="text-xs text-slate-500 mt-1">
                Number of days before client selection expires (max 15 days).
              </p>
            </div>
          )}

          {/* Download Permission Checkbox */}
          <div className="pt-2">
            <label className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 cursor-pointer transition-colors shadow-sm">
              <input
                type="checkbox"
                checked={allowDownload}
                onChange={(e) => setAllowDownload(e.target.checked)}
                disabled={loading}
                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 transition-colors cursor-pointer"
              />
              <span className="text-sm font-semibold text-slate-800 select-none">
                Allow Photo Download
              </span>
            </label>
          </div>

          {/* Actions */}
          <div className="pt-5 flex items-center justify-end gap-3 border-t border-slate-100 mt-6">
            <button
              type="button"
              onClick={handleCancel}
              disabled={loading}
              className="px-6 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-sm font-semibold text-slate-700 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{loading ? "Creating Gallery..." : "Create Gallery"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
