import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AdminDashboard from "../components/AdminDashboard";
import CreateAlbumModal from "../components/CreateAlbumModal";
import api from "../api/axios";
import {
  Plus,
  Image as ImageIcon,
  Clock,
  Lock,
  AlertCircle,
  RefreshCw,
  FolderPlus,
  ShieldCheck,
  Trash2,
  ChevronRight,
  Search,
  User,
  CheckCircle2,
  HardDrive,
  FolderLock,
} from "lucide-react";

export default function DashboardHome() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [albums, setAlbums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  // If user is Admin and NOT explicitly toggled to view galleries, render AdminDashboard
  const [viewAsPhotographer, setViewAsPhotographer] = useState(false);

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
    if (!isAdmin || viewAsPhotographer) {
      fetchAlbums();
    }
  }, [isAdmin, viewAsPhotographer]);

  if (isAdmin && !viewAsPhotographer) {
    return <AdminDashboard onSwitchToGalleries={() => setViewAsPhotographer(true)} />;
  }

  const handleCreateAlbum = () => {
    setIsCreateModalOpen(true);
  };

  const handleAlbumCreated = () => {
    fetchAlbums();
  };

  const calculateDaysLeft = (expiresAt) => {
    if (!expiresAt) return null;
    const expiryTime = new Date(expiresAt).getTime();
    if (isNaN(expiryTime)) return null;
    const diff = expiryTime - new Date().getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 0;
  };

  const handleDeleteAlbum = async (e, albumId, albumTitle) => {
    if (e && typeof e.preventDefault === "function") {
      e.preventDefault();
      e.stopPropagation();
    }

    if (
      !window.confirm(
        `Are you sure you want to delete "${albumTitle || "Untitled Album"}"? All photos in this gallery will be permanently deleted.`
      )
    ) {
      return;
    }

    try {
      setDeletingId(albumId);
      await api.delete(`/api/v1/albums/${albumId}`);
      // Remove instantly from UI
      setAlbums((prev) => (Array.isArray(prev) ? prev.filter((a) => a?.id !== albumId) : []));
    } catch (err) {
      const msg = err.response?.data?.detail || "Failed to delete album. Please try again.";
      alert(msg);
    } finally {
      setDeletingId(null);
    }
  };

  // Filter albums by search query (title, client name, or PIN)
  const filteredAlbums = useMemo(() => {
    const safeAlbums = Array.isArray(albums) ? albums : [];
    if (!searchQuery.trim()) return safeAlbums;
    const q = searchQuery.toLowerCase().trim();
    return safeAlbums.filter((a) => {
      if (!a) return false;
      const title = (a.title || "").toLowerCase();
      const client = (a.client_name || "").toLowerCase();
      const pin = (a.pin || a.client_pin || "").toLowerCase();
      return title.includes(q) || client.includes(q) || pin.includes(q);
    });
  }, [albums, searchQuery]);

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
    <div id="photographer-dashboard-container" className="space-y-6">
      {/* Top Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800/80">
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
            {isAdmin && (
              <button
                type="button"
                onClick={() => setViewAsPhotographer(false)}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 hover:text-white text-xs font-semibold transition-all"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                <span>Return to Admin Center</span>
              </button>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {isAssistant
              ? "You are viewing your personal client proof galleries. New albums automatically upload under your studio's unified storage."
              : "Manage high-resolution collections, track live client selections, and monitor unified studio storage across your team."}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={fetchAlbums}
            className="p-2.5 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800/80 text-slate-400 hover:text-white transition-colors"
            aria-label="Refresh albums"
            title="Refresh galleries"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            id="create-new-album-btn"
            type="button"
            onClick={handleCreateAlbum}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-xs transition-all shadow-lg shadow-amber-500/10"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Create New Album</span>
          </button>
        </div>
      </div>

      {/* Dynamic Unified Studio Stats Cards vs Assistant Isolated Workspace */}
      {!isAssistant ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Card 1: Unified Studio Albums */}
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

          {/* Card 2: Aggregated Studio Storage Used */}
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

          {/* Card 3: Subscription Tier & AI Features */}
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
        /* Studio Assistant Isolated Workspace: Strict Privacy (Parent's financial & global studio stats hidden) */
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Card 1: My Uploads */}
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

          {/* Card 2: Assistant Role Privacy Protection */}
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

      {/* Fast Filter Bar (Scalable for 20+ albums) */}
      {albums.length > 0 && (
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by title, client name, or 6-digit PIN..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-400/60 transition-colors"
            />
          </div>
          {searchQuery && (
            <span className="text-xs text-slate-400 font-mono">
              Found {filteredAlbums.length} of {albums.length}
            </span>
          )}
        </div>
      )}

      {/* Empty State */}
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
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Create Your First Album</span>
          </button>
        </div>
      ) : filteredAlbums.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-slate-800 bg-slate-900/30 text-slate-400 text-xs">
          No albums match "{searchQuery}". Try a different keyword or PIN.
        </div>
      ) : (
        /* Sleek, Dense Horizontal List View (Scalable for 20+ Albums) */
        <div className="space-y-2.5" id="compact-album-list">
          {filteredAlbums.map((album) => {
            if (!album || !album.id) return null;
            const daysLeft = calculateDaysLeft(album.expires_at);
            const isSubmitted = album.status === "submitted" || album.is_locked;
            const isExpired = album.is_expired || daysLeft === 0;
            const photoCount = album.photo_count ?? album.media_count ?? 0;
            const selectedCount = album.selected_count ?? 0;
            const pinCode = album.pin || album.client_pin;
            const isDeleting = deletingId === album.id;

            return (
              <div
                key={album.id}
                id={`album-row-${album.id}`}
                onClick={() => navigate(`/dashboard/albums/${album.id}`)}
                className="group px-4 py-3.5 rounded-xl border border-slate-800/90 bg-slate-900/40 hover:bg-slate-900/90 hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer shadow-sm relative overflow-hidden"
              >
                {/* Left Section: PIN + Title + Client Name */}
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  {/* 6-Digit PIN Badge */}
                  {pinCode ? (
                    <div
                      title="Client 6-Digit Access PIN"
                      className="px-2.5 py-1 rounded-lg bg-amber-950/60 border border-amber-500/40 text-amber-400 font-mono text-xs font-bold tracking-wider shrink-0 flex items-center gap-1 shadow-sm"
                    >
                      <span className="text-[10px] text-amber-500/70 font-sans font-medium uppercase">PIN</span>
                      <span>{pinCode}</span>
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
                      <ImageIcon className="w-4 h-4 text-slate-500" />
                    </div>
                  )}

                  {/* Title & Client Name */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-white group-hover:text-amber-400 transition-colors truncate">
                        {album.title}
                      </h3>

                      {/* Creator Tracking Badge */}
                      {String(album.creator_role || "photographer").toLowerCase().trim() === "assistant" ? (
                        <span
                          title={`Created by Studio Assistant: ${album.creator_name || "Assistant"}`}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 bg-cyan-950/80 text-cyan-300 border border-cyan-400/50 shadow-sm shadow-cyan-500/20"
                        >
                          👤 Ast: {album.creator_name || "Assistant"}
                        </span>
                      ) : (
                        <span
                          title="Created by Studio Root Owner"
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 bg-slate-800/90 text-amber-300/90 border border-amber-500/20"
                        >
                          👑 Owner
                        </span>
                      )}

                      {selectedCount > 0 && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.2 rounded-full shrink-0">
                          <CheckCircle2 className="w-3 h-3" />
                          {selectedCount} Selected
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5 truncate">
                      <span className="flex items-center gap-1 truncate text-slate-400">
                        <User className="w-3 h-3 text-slate-500 shrink-0" />
                        <span className="truncate">{album.client_name || "Unassigned Client"}</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right Section: Status Badge, Photo Count, Expiry, Delete Button */}
                <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/60">
                  {/* Photo Count */}
                  <span className="text-xs font-mono text-slate-300 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 shrink-0">
                    {photoCount} {photoCount === 1 ? "Photo" : "Photos"}
                  </span>

                  {/* Status Badge */}
                  <div className="shrink-0">
                    {isSubmitted ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-950/80 border border-amber-500/40 text-[10px] font-medium text-amber-300">
                        <Lock className="w-3 h-3 text-amber-400" />
                        <span>Submitted</span>
                      </span>
                    ) : isExpired ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-950/80 border border-red-500/40 text-[10px] font-medium text-red-300">
                        <Clock className="w-3 h-3 text-red-400" />
                        <span>Expired</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/80 border border-emerald-500/40 text-[10px] font-medium text-emerald-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span>Selecting</span>
                      </span>
                    )}
                  </div>

                  {/* Lifespan Indicator */}
                  <span className="hidden md:flex items-center gap-1 text-[11px] text-slate-400 font-mono shrink-0">
                    <Clock className="w-3 h-3 text-slate-500" />
                    {daysLeft !== null ? (isExpired ? "0d" : `${daysLeft}d left`) : "Permanent"}
                  </span>

                  {/* Action Buttons: Delete & Open */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      id={`delete-album-btn-${album.id}`}
                      onClick={(e) => handleDeleteAlbum(e, album.id, album.title)}
                      disabled={isDeleting}
                      title="Delete Album"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-950/50 border border-transparent hover:border-red-800/60 transition-colors"
                    >
                      {isDeleting ? (
                        <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>

                    <span className="text-slate-600 group-hover:text-amber-400 transition-colors p-1">
                      <ChevronRight className="w-4 h-4" />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
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
