import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import {
  FolderPlus,
  AlertCircle,
  Loader2,
  Check,
} from "lucide-react";

export default function CreateAlbumView() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [allowDownload, setAllowDownload] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !clientName.trim()) {
      setError("Please fill in both the album title and client name.");
      return;
    }

    const payload = {
      title: title.trim(),
      client_name: clientName.trim(),
      allow_download: Boolean(allowDownload),
    };

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const response = await api.post("/api/v1/albums", payload);

      setSuccess(`Album "${response.data?.title || title}" created successfully.`);

      // Brief pause, then navigate to albums tab to show the new entry
      setTimeout(() => {
        navigate("/dashboard?tab=albums");
      }, 1200);

    } catch (err) {
      const msg =
        err.response?.data?.detail ||
        "Failed to create album. Please verify your details and try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setTitle("");
    setClientName("");
    setAllowDownload(false);
    setError(null);
    setSuccess(null);
  };

  return (
    <div className="max-w-xl w-full mx-auto space-y-6">
      {/* Header */}
      <div className="pb-5 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600">
            <FolderPlus className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Create New Album
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Set up a new client delivery gallery.
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 rounded-2xl bg-white dark:bg-[#0b0e14] border border-slate-200 dark:border-slate-800 shadow-sm">
        {/* Error Alert */}
        {error && (
          <div className="mb-5 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2.5 shadow-sm">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Success Alert */}
        {success && (
          <div className="mb-5 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm flex items-center gap-2.5 shadow-sm">
            <Check className="w-5 h-5 text-emerald-500 shrink-0" />
            <span className="font-medium">{success} Redirecting to albums...</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Album Title */}
          <div>
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200 dark:text-slate-300 block mb-1.5">
              Album Title <span className="text-red-500">*</span>
            </label>
            <input
              id="album-title-input"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Abeba & Zeleke Wedding"
              required
              disabled={loading}
              className="w-full bg-white dark:bg-[#0b0e14] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-sm disabled:opacity-50"
            />
          </div>

          {/* Client Name */}
          <div>
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200 dark:text-slate-300 block mb-1.5">
              Client Name <span className="text-red-500">*</span>
            </label>
            <input
              id="client-name-input"
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="e.g. Abeba"
              required
              disabled={loading}
              className="w-full bg-white dark:bg-[#0b0e14] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-sm disabled:opacity-50"
            />
          </div>

          {/* Download Permission Toggle */}
          <div className="pt-1">
            <label className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#111620] hover:bg-slate-100 dark:hover:bg-slate-800/60 cursor-pointer transition-colors shadow-sm">
              <input
                id="allow-download-checkbox"
                type="checkbox"
                checked={allowDownload}
                onChange={(e) => setAllowDownload(e.target.checked)}
                disabled={loading}
                className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 transition-colors cursor-pointer"
              />
              <div>
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 block select-none">
                  Allow Photo Download
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 block mt-0.5 select-none">
                  Enable clients to download high-resolution photos in the mobile app.
                </span>
              </div>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={handleClear}
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-white dark:bg-[#0b0e14] border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-[#111620] dark:bg-[#111620] dark:bg-slate-800/50 text-sm font-semibold text-slate-700 dark:text-slate-200 dark:text-slate-300 transition-colors disabled:opacity-50"
            >
              Clear
            </button>
            <button
              id="submit-create-album-btn"
              type="submit"
              disabled={loading}
              className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Creating Album...</span>
                </>
              ) : (
                <span>Create Album</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


