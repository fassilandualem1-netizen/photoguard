import React, { useState, useEffect, useMemo, Component } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AdminDashboard from "../components/AdminDashboard";
import CreateAlbumModal from "../components/CreateAlbumModal";
import TeamManagement from "../components/TeamManagement";
import StudioAnalyticsModal from "../components/StudioAnalyticsModal";
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
  Users,
  BarChart3,
  Sparkles,
} from "lucide-react";

// Safe In-Component Error Boundary to permanently prevent React White Screen
class DashboardErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[PhotoGuard Dashboard Error Boundary Caught]:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 my-8 rounded-3xl border border-red-500/30 bg-red-950/40 text-red-300 max-w-xl mx-auto text-center space-y-4">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto stroke-[1.5]" />
          <h2 className="text-base font-bold text-white">Dashboard Encountered a Display Issue</h2>
          <p className="text-xs text-red-300/90 leading-relaxed">
            A temporary component state discrepancy was safely intercepted. Click below to reload your galleries safely.
          </p>
          <button
            type="button"
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-800/80 hover:bg-red-700 text-white text-xs font-semibold transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reload Dashboard</span>
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function DashboardHomeContent() {
  const { user = {}, isAdmin = false } = useAuth() || {};
  const navigate = useNavigate();

  // Safe user property evaluation
  const safeUser = user || {};
  const userRole = String(safeUser?.role || "photographer").toLowerCase();
  const subscriptionPlan = String(safeUser?.subscription_plan || safeUser?.plan || "basic").toLowerCase();
  const isAssistant = userRole === "assistant";
  const isStudio = subscriptionPlan === "studio" || userRole === "admin";

  const [albums, setAlbums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [isAnalyticsModalOpen, setIsAnalyticsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  // If user is Admin and NOT explicitly toggled to view galleries, render AdminDashboard
  const [viewAsPhotographer, setViewAsPhotographer] = useState(false);

  const fetchAlbums = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get("/api/v1/albums");
      const data = response?.data;
      // Guarantee array data structure
      if (Array.isArray(data)) {
        setAlbums(data);
      } else if (data && Array.isArray(data.albums)) {
        setAlbums(data.albums);
      } else {
        setAlbums([]);
      }
    } catch (err) {
      const rawDetail = err?.response?.data?.detail;
      let msg = "Failed to load client albums. Please try again.";
      if (typeof rawDetail === "string" && rawDetail.trim()) {
        msg = rawDetail;
      } else if (Array.isArray(rawDetail) && rawDetail.length > 0) {
        msg = rawDetail.map((d) => (typeof d === "object" ? d?.msg || JSON.stringify(d) : String(d))).join("; ");
      } else if (err?.response?.status) {
        msg = `Server Error (${err.response.status}): ${err.response.statusText || "Failed to fetch albums"}`;
      } else if (err?.message) {
        msg = err.message;
      }
      setError(msg);
      setAlbums([]);
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
    try {
      const diff = new Date(expiresAt).getTime() - new Date().getTime();
      const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
      return days > 0 ? days : 0;
    } catch {
      return null;
    }
  };

  const handleDeleteAlbum = async (e, albumId, albumTitle) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();

    // RBAC Rule: Assistants are strictly forbidden from deleting albums
    if (isAssistant) {
      alert("Permission Denied: Assistant accounts are not authorized to delete client albums.");
      return;
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
      // Remove safely from state
      setAlbums((prev) => (Array.isArray(prev) ? prev.filter((a) => a?.id !== albumId) : []));
    } catch (err) {
      const msg = err?.response?.data?.detail || "Failed to delete album. Please try again.";
      alert(msg);
    } finally {
      setDeletingId(null);
    }
  };

  // Safe data filtering with defensive array checks
  const safeAlbumsList = Array.isArray(albums) ? albums : [];

  const filteredAlbums = useMemo(() => {
    if (!searchQuery.trim()) return safeAlbumsList;
    const q = searchQuery.toLowerCase().trim();
    return safeAlbumsList.filter((a) => {
      if (!a) return false;
      const title = String(a.title || "").toLowerCase();
      const client = String(a.client_name || "").toLowerCase();
      const pin = String(a.pin || a.client_pin || "").toLowerCase();
      return title.includes(q) || client.includes(q) || pin.includes(q);
    });
  }, [safeAlbumsList, searchQuery]);

  if (loading) {
    return (
      <div
        id="photographer-dashboard-loading"
        className="flex flex-col items-center justify-center py-20 text-slate-400"
      >
        <div className="w-8 h-8 rounded-full border-2 border-amber-400 border-t-transparent animate-spin mb-3" />
        <p className="text-xs font-mono uppercase tracking-wider text-slate-500">
          Loading client proof galleries...
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
    <div id="photographer-dashboard-container" className="space-y-6">
      {/* Top Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Client Proof Galleries
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-xs font-mono">
              {(safeAlbumsList || []).length} Total
            </span>
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
            Manage high-resolution collections, track live client selections, and generate secure 6-digit access PINs.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Studio Quick Action: Team Management (Owners only) */}
          {!isAssistant && isStudio && (
            <button
              type="button"
              onClick={() => setIsTeamModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800/80 text-slate-300 hover:text-white text-xs font-semibold transition-colors"
              title="Manage Assistants"
            >
              <Users className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden md:inline">Team</span>
            </button>
          )}

          {/* Studio Quick Action: Client Analytics */}
          {isStudio && (
            <button
              type="button"
              onClick={() => setIsAnalyticsModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800/80 text-slate-300 hover:text-white text-xs font-semibold transition-colors"
              title="View Client Analytics"
            >
              <BarChart3 className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden md:inline">Analytics</span>
            </button>
          )}

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

      {/* Fast Filter Bar (Scalable for 20+ albums) */}
      {(safeAlbumsList || []).length > 0 && (
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
              Found {(filteredAlbums || []).length} of {(safeAlbumsList || []).length}
            </span>
          )}
        </div>
      )}

      {/* Empty State */}
      {(safeAlbumsList || []).length === 0 ? (
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
      ) : (filteredAlbums || []).length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-slate-800 bg-slate-900/30 text-slate-400 text-xs">
          No albums match "{searchQuery}". Try a different keyword or PIN.
        </div>
      ) : (
        /* Sleek, Dense Horizontal List View (Scalable for 20+ Albums) */
        <div className="space-y-2.5" id="compact-album-list">
          {(filteredAlbums || []).map((album) => {
            if (!album) return null;
            const daysLeft = calculateDaysLeft(album.expires_at);
            const isSubmitted = album.status === "submitted" || album.is_locked;
            const isExpired = album.is_expired || daysLeft === 0;
            const photoCount = Number(album.photo_count ?? album.media_count ?? 0);
            const selectedCount = Number(album.selected_count ?? 0);
            const pinCode = album.pin || album.client_pin;
            const isDeleting = deletingId === album.id;

            return (
              <div
                key={album.id || Math.random()}
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
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-white group-hover:text-amber-400 transition-colors truncate">
                        {album.title || "Untitled Album"}
                      </h3>
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
                    {/* RBAC: Assistants cannot delete albums */}
                    {!isAssistant && (
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
                    )}

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

      {/* Studio Team Management Modal */}
      <TeamManagement
        isOpen={isTeamModalOpen}
        onClose={() => setIsTeamModalOpen(false)}
        user={safeUser}
      />

      {/* Studio Client Analytics Modal */}
      <StudioAnalyticsModal
        isOpen={isAnalyticsModalOpen}
        onClose={() => setIsAnalyticsModalOpen(false)}
        albums={safeAlbumsList}
        user={safeUser}
      />
    </div>
  );
}

export default function DashboardHome() {
  return (
    <DashboardErrorBoundary>
      <DashboardHomeContent />
    </DashboardErrorBoundary>
  );
}
