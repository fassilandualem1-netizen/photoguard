import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import CreateAlbumModal from "./CreateAlbumModal";
import AlbumCard from "./AlbumCard";
import {
  Plus,
  Image as ImageIcon,
  Clock,
  Lock,
  AlertCircle,
  RefreshCw,
  FolderPlus,
  ExternalLink,
  HardDrive,
  FolderLock,
  ShieldCheck,
} from "lucide-react";

export default function PhotographerDashboard() {
  const { user } = useAuth();
  const [albums, setAlbums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const fetchAlbums = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get("/api/v1/albums");
      setAlbums(response.data || []);
    } catch (err) {
      const rawDetail = err.response?.data?.detail;
      let msg = "Failed to load client albums. Please try again.";
      if (typeof rawDetail === "string" && rawDetail.trim()) {
        msg = rawDetail;
      } else if (Array.isArray(rawDetail) && rawDetail.length > 0) {
        msg = rawDetail.map((d) => (typeof d === "object" ? d.msg || JSON.stringify(d) : String(d))).join("; ");
      } else if (err.response?.status) {
        msg = `Server Error (${err.response.status}): ${err.response.statusText || "Failed to fetch albums"}`;
      } else if (err.message) {
        msg = err.message;
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlbums();
  }, []);

  const handleCreateAlbum = () => {
    setIsCreateModalOpen(true);
  };

  const handleAlbumCreated = () => {
    fetchAlbums();
  };

  const calculateDaysLeft = (expiresAt) => {
    if (!expiresAt) return null;
    const diff = new Date(expiresAt).getTime() - new Date().getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 0;
  };

  if (loading) {
    return (
      <div
        id="photographer-dashboard-loading"
        className="flex flex-col items-center justify-center py-20 text-slate-400"
      >
        <div className="w-8 h-8 rounded-full border-2 border-amber-400 border-t-transparent animate-spin mb-3" />
        <p className="text-xs font-mono uppercase tracking-wider text-slate-500">
          Loading client galleries...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        id="photographer-dashboard-error"
        className="p-6 rounded-2xl border border-red-500/20 bg-red-950/40 text-red-300 flex flex-col items-start gap-4"
      >
        <div className="flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <span className="text-sm font-medium">{error}</span>
        </div>
        <button
          type="button"
          onClick={fetchAlbums}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-900/60 hover:bg-red-800/60 border border-red-700/60 text-xs font-semibold text-white transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  const isAssistant = user?.role === "assistant" || Boolean(user?.parent_id);

  const formatGb = (bytes) => {
    if (!bytes || bytes <= 0) return "0.0";
    return (bytes / (1024 * 1024 * 1024)).toFixed(1);
  };

  const storageUsedBytes = Number(user?.storage_used) || 0;
  const storageLimitBytes = Number(user?.storage_quota_limit) > 0 ? Number(user.storage_quota_limit) : 5368709120;
  const storageUsagePercent = Math.min(100, Math.round((storageUsedBytes / storageLimitBytes) * 100));

  return (
    <div id="photographer-dashboard-container" className="space-y-8">
      {/* Top Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              {isAssistant ? "My Uploads" : "Client Proof Galleries"}
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-xs font-mono">
              {albums.length} {isAssistant ? "My Galleries" : "Total Galleries"}
            </span>
            {isAssistant && (
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-medium font-mono">
                Assistant Role
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {isAssistant
              ? "You are viewing your personal client proof galleries. New albums automatically upload under your studio's unified storage."
              : "Manage high-resolution collections, track live collaborative selections, and generate secure client PINs."}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={fetchAlbums}
            className="p-2.5 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800/80 text-slate-400 hover:text-white transition-colors"
            aria-label="Refresh albums"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            id="create-new-album-btn"
            type="button"
            onClick={handleCreateAlbum}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-xs transition-all shadow-lg shadow-amber-500/10"
          >
            <Plus className="w-4 h-4" />
            <span>+ Create New Album</span>
          </button>
        </div>
      </div>

      {/* Dynamic Unified Studio Stats Cards vs Assistant Isolated Workspace */}
      {!isAssistant ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800/90 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider font-mono">
                Unified Studio Albums
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-white">
                  {albums.length}
                </span>
                <span className="text-xs text-amber-400 font-medium">galleries</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Aggregated (Root + Studio Assistants)
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
              <FolderLock className="w-5 h-5" />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800/90 shadow-sm">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider font-mono">
                Studio Storage Quota
              </span>
              <span className="text-xs font-mono font-bold text-slate-200">
                {formatGb(storageUsedBytes)} / {formatGb(storageLimitBytes)} GB
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden mb-1.5">
              <div
                className={`h-full rounded-full transition-all ${
                  storageUsagePercent > 90
                    ? "bg-red-500"
                    : storageUsagePercent > 70
                    ? "bg-amber-400"
                    : "bg-amber-500"
                }`}
                style={{ width: `${storageUsagePercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span>{storageUsagePercent}% utilized</span>
              <span className="text-amber-400/80 font-mono">Unified Studio Storage</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800/90 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider font-mono">
                Plan Tier
              </span>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-base font-bold font-mono text-white uppercase">
                  {user?.subscription_plan || "Basic"} Tier
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  Active
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {user?.subscription_plan === "studio"
                  ? "Multi-assistant collaboration & custom branding active"
                  : "Standard photographer storage & client proofing"}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
              <HardDrive className="w-5 h-5" />
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl bg-slate-900/50 border border-amber-500/30 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider font-mono">
                My Uploaded Galleries
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-white">
                  {albums.length}
                </span>
                <span className="text-xs text-amber-400 font-medium">albums created by me</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Restricted to your personal uploads (Isolated workspace)
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <FolderLock className="w-5 h-5" />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800/90 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider font-mono">
                Assistant Role Privacy
              </span>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-200">
                  Staff Operator Mode
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  Secured
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Studio-wide billing and parent owner analytics are kept private
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400 shrink-0">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            </div>
          </div>
        </div>
      )}

      {/* Album Grid or Empty State */}
      {albums.length === 0 ? (
        <div
          id="empty-albums-state"
          className="rounded-3xl border border-slate-800/80 bg-slate-900/30 backdrop-blur-md p-12 sm:p-16 flex flex-col items-center justify-center text-center max-w-xl mx-auto my-12"
        >
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-amber-500/20 to-amber-400/5 border border-amber-500/30 flex items-center justify-center mb-6 shadow-xl shadow-amber-500/5">
            <FolderPlus className="w-8 h-8 text-amber-400 stroke-[1.8]" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">No Galleries Created Yet</h3>
          <p className="text-xs sm:text-sm text-slate-400 max-w-md mb-8 leading-relaxed">
            Upload your first photo collection to generate a 6-digit access PIN for your clients, complete with live collaborative selection.
          </p>
          <button
            id="empty-create-album-btn"
            type="button"
            onClick={handleCreateAlbum}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-xs transition-all shadow-lg shadow-amber-500/15"
          >
            <Plus className="w-4 h-4" />
            <span>Create Your First Album</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {albums.map((album) => (
            <AlbumCard key={album.id} album={album} />
          ))}

          {/* New Album Quick Trigger Tile */}
          <button
            type="button"
            onClick={handleCreateAlbum}
            className="rounded-2xl border-2 border-dashed border-slate-800/90 hover:border-amber-500/50 hover:bg-slate-900/20 p-8 flex flex-col items-center justify-center gap-3 text-slate-400 hover:text-white transition-all min-h-[220px]"
          >
            <div className="w-11 h-11 rounded-2xl bg-slate-800/60 flex items-center justify-center">
              <Plus className="w-5 h-5 text-slate-300" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-white">Create New Album</p>
              <p className="text-xs text-slate-500 mt-0.5">Bulk upload proofs & generate PIN</p>
            </div>
          </button>
        </div>
      )}

      {/* Create Album Modal */}
      <CreateAlbumModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onAlbumCreated={handleAlbumCreated}
      />
    </div>
  );
}
