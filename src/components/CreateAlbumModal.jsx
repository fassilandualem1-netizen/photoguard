import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import { X, FolderPlus, AlertCircle, Loader2 } from "lucide-react";

export default function CreateAlbumModal({ isOpen, onClose, onAlbumCreated }) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [allowDownload, setAllowDownload] = useState(false);
  const [expiresInDays, setExpiresInDays] = useState("30");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

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
      if (isNaN(days) || days < 1 || days > 365) {
        setError("Lifespan must be between 1 and 365 days.");
        return;
      }
      payload.expires_in_days = days;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await api.post("/api/v1/albums", payload);

      setTitle("");
      setClientName("");
      setAllowDownload(false);
      setExpiresInDays("30");

      if (onAlbumCreated) {
        onAlbumCreated(response.data);
      }
      onClose();
    } catch (err) {
      const msg =
        err.response?.data?.detail ||
        "Failed to create album. Please verify your details and try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      id="create-album-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-[#12161d] p-6 sm:p-8 shadow-2xl shadow-black/80 relative text-left">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6 pb-4 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
              <FolderPlus className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Create Client Gallery</h2>
              <p className="text-xs text-slate-400">
                Set up a secure collection and generate a 6-digit access PIN.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div
            id="create-album-error"
            className="mb-5 p-3.5 rounded-xl border border-red-500/20 bg-red-950/40 text-red-300 flex items-start gap-2.5 text-xs"
          >
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Album Title <span className="text-amber-400">*</span>
            </label>
            <input
              id="album-title-input"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Liam & Emma Wedding Reception"
              required
              className="w-full bg-slate-900/80 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/80 transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Client Name <span className="text-amber-400">*</span>
            </label>
            <input
              id="client-name-input"
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="e.g., Emma Johnson"
              required
              className="w-full bg-slate-900/80 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/80 transition-all"
            />
          </div>

          {/* Conditional Expiration for Studio Tier */}
          {isStudio && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium uppercase tracking-wider text-slate-400">
                  Gallery Lifespan (Days)
                </label>
                <span className="text-[11px] font-mono text-amber-400/90">Studio Tier</span>
              </div>
              <input
                id="expires-in-days-input"
                type="number"
                min="1"
                max="365"
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(e.target.value)}
                className="w-full bg-slate-900/80 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/80 transition-all"
              />
              <p className="text-[11px] text-slate-500">
                Number of days before client selection expires (defaults to 30 days).
              </p>
            </div>
          )}

          {/* Download Permission Checkbox */}
          <div className="pt-2">
            <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-800/80 bg-slate-900/40 hover:bg-slate-900/70 cursor-pointer transition-colors">
              <input
                id="allow-download-checkbox"
                type="checkbox"
                checked={allowDownload}
                onChange={(e) => setAllowDownload(e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-amber-500 focus:ring-amber-500/30 focus:ring-offset-0 transition-colors"
              />
              <span className="text-xs font-medium text-slate-300 select-none">
                Allow Photo Download
              </span>
            </label>
          </div>

          {/* Actions */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800/80 mt-6">
            <button
              id="cancel-create-album-btn"
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800/80 text-xs font-semibold text-slate-300 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              id="submit-create-album-btn"
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-xs transition-all shadow-lg shadow-amber-500/15 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{loading ? "Creating Gallery..." : "Create Album"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
