import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import CreateAlbumModal from "./CreateAlbumModal";
import {
  Plus,
  Image as ImageIcon,
  Clock,
  Lock,
  AlertCircle,
  RefreshCw,
  FolderPlus,
  ExternalLink,
} from "lucide-react";

export default function PhotographerDashboard() {
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
      const msg =
        err.response?.data?.detail ||
        "Failed to load client albums. Please try again.";
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

  return (
    <div id="photographer-dashboard-container" className="space-y-8">
      {/* Top Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            Client Proof Galleries
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage high-resolution collections, track live collaborative selections, and generate secure client PINs.
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
          {albums.map((album) => {
            const daysLeft = calculateDaysLeft(album.expires_at);
            const isSubmitted = album.status === "submitted" || album.is_locked;
            const photoCount = album.photo_count ?? album.media_count ?? 0;
            const pinCode = album.pin || album.client_pin;

            return (
              <Link
                to={`/dashboard/albums/${album.id}`}
                key={album.id}
                id={`album-card-${album.id}`}
                className="group rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-sm overflow-hidden hover:border-slate-700 hover:bg-slate-900/60 transition-all flex flex-col justify-between cursor-pointer"
              >
                {/* Visual Header / Cover Preview */}
                <div className="h-44 bg-gradient-to-tr from-slate-950 to-slate-900 flex items-center justify-center relative p-4 border-b border-slate-800/60">
                  <ImageIcon className="w-10 h-10 text-slate-700 group-hover:text-amber-400/80 transition-colors" />

                  {/* 6-Digit PIN Pill */}
                  {pinCode && (
                    <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur-md border border-slate-700/60 text-xs font-mono font-semibold text-amber-400 tracking-wider">
                      PIN: {pinCode}
                    </div>
                  )}

                  {/* Status Indicator */}
                  <div className="absolute top-3 right-3 flex items-center gap-1.5">
                    {isSubmitted ? (
                      <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-950/80 border border-amber-500/40 text-[10px] font-medium text-amber-300">
                        <Lock className="w-3 h-3 text-amber-400" />
                        Submitted
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/80 border border-emerald-500/40 text-[10px] font-medium text-emerald-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Selecting
                      </span>
                    )}
                  </div>
                </div>

                {/* Details Body */}
                <div className="p-5 space-y-3 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-white group-hover:text-amber-400 transition-colors truncate">
                        {album.title}
                      </h3>
                      <span className="text-[11px] text-slate-400 font-mono shrink-0">
                        {photoCount} Photos
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 truncate">
                      Client: <span className="text-slate-300">{album.client_name || "Unassigned"}</span>
                    </p>
                  </div>

                  {/* Footer Meta */}
                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
                    <span className="flex items-center gap-1 text-[11px]">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      {daysLeft !== null
                        ? album.is_expired || daysLeft === 0
                          ? "Expired"
                          : `${daysLeft} days left`
                        : "Permanent"}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-amber-400/90 font-medium text-[11px]">
                        {album.selected_count ?? 0} Selected
                      </span>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-600 group-hover:text-amber-400 transition-colors" />
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}

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
