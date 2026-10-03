import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useDashboardSearch } from "../layouts/DashboardLayout";
import AdminDashboard from "./AdminDashboard";
import CreateAlbumModal from "../components/CreateAlbumModal";
import AlbumCard from "../components/AlbumCard";
import api from "../api/axios";
import {
  Plus,
  Image as ImageIcon,
  Clock,
  AlertCircle,
  RefreshCw,
  FolderPlus,
  ShieldCheck,
  Trash2,
  ChevronRight,
  Search,
  CheckCircle2,
  LayoutGrid,
  List,
  Copy,
  Check,
} from "lucide-react";

export default function DashboardHome() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { searchQuery, setSearchQuery } = useDashboardSearch();
  const [albums, setAlbums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [viewMode, setViewMode] = useState("list"); // 'list' | 'grid'
  const [copiedPinId, setCopiedPinId] = useState(null);

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

  const handleCopyPin = (e, albumId, pinCode) => {
    e.stopPropagation();
    if (pinCode) {
      navigator.clipboard.writeText(pinCode);
      setCopiedPinId(albumId);
      setTimeout(() => setCopiedPinId(null), 2000);
    }
  };

  // Filter albums by search query (title, client name, or PIN)
  const filteredAlbums = useMemo(() => {
    const safeAlbums = Array.isArray(albums) ? albums : [];
    if (!searchQuery || !searchQuery.trim()) return safeAlbums;
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
        className="flex flex-col items-center justify-center py-24 text-slate-400"
      >
        <div className="w-8 h-8 rounded-full border-2 border-orange-500 border-t-transparent animate-spin mb-3" />
        <p className="text-xs font-mono uppercase tracking-wider text-slate-400">
          Loading client galleries...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        id="photographer-dashboard-error"
        className="p-6 rounded-2xl border border-red-500/20 bg-red-950/40 text-red-300 flex flex-col items-start gap-4 max-w-xl mx-auto my-12"
      >
        <div className="flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <span className="text-sm font-medium">{error}</span>
        </div>
        <button
          type="button"
          onClick={fetchAlbums}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-900/60 hover:bg-red-800/60 border border-red-700/60 text-xs font-semibold text-white transition-all duration-200 cursor-pointer shadow-sm"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  return (
    <div id="photographer-dashboard-container" className="space-y-6">
      {/* 1 & 3. Title Section & Refined Primary Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Client Proof Galleries
            </h1>
            {/* Soft bg-slate-800 text-slate-300 rounded badge */}
            <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 text-xs font-semibold uppercase tracking-wider">
              {albums.length} TOTAL
            </span>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setViewAsPhotographer(false)}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 hover:text-white text-xs font-semibold transition-all duration-200 cursor-pointer"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                <span>Return to Admin Center</span>
              </button>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Manage high-resolution collections, monitor client proofs, and distribute secure 6-digit access PINs.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Action Icon: Refresh button with visible gray and distinct hover */}
          <button
            type="button"
            onClick={fetchAlbums}
            className="p-2.5 rounded-xl border border-slate-700/80 bg-slate-800/40 text-gray-400 hover:text-white hover:bg-slate-800 hover:border-slate-600 transition-all duration-200 cursor-pointer shadow-sm"
            aria-label="Refresh albums"
            title="Refresh galleries"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* 1. "+ Create New Album" Button: Fixed typo, refined orange gradient, better padding, subtle glow */}
          <button
            id="create-new-album-btn"
            type="button"
            onClick={handleCreateAlbum}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-slate-950 font-semibold text-xs tracking-wide shadow-md shadow-orange-500/20 hover:shadow-lg hover:shadow-orange-500/30 hover:brightness-105 active:scale-[0.98] transition-all duration-200 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Create New Album</span>
          </button>
        </div>
      </div>

      {/* Secondary Toolbar: Search/filter input + Grid/List view toggle icons */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by title, client name, or 6-digit PIN..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[#151a23] border border-slate-800 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/20 transition-all duration-200"
          />
        </div>

        <div className="flex items-center gap-3 self-end sm:self-auto">
          {searchQuery && (
            <span className="text-xs text-slate-400 font-mono hidden md:inline">
              Found {filteredAlbums.length} of {albums.length}
            </span>
          )}

          {/* Grid / List view toggle icons */}
          <div className="flex items-center p-1 rounded-xl bg-slate-900/90 border border-slate-800">
            <button
              type="button"
              id="view-mode-list-btn"
              onClick={() => setViewMode("list")}
              title="List View"
              className={`p-2 rounded-lg transition-all duration-200 cursor-pointer ${
                viewMode === "list"
                  ? "bg-orange-500 text-slate-950 font-bold shadow-sm"
                  : "text-gray-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              type="button"
              id="view-mode-grid-btn"
              onClick={() => setViewMode("grid")}
              title="Grid View"
              className={`p-2 rounded-lg transition-all duration-200 cursor-pointer ${
                viewMode === "grid"
                  ? "bg-orange-500 text-slate-950 font-bold shadow-sm"
                  : "text-gray-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {albums.length === 0 ? (
        <div
          id="empty-albums-state"
          className="rounded-3xl border border-slate-800 bg-[#151a23]/60 backdrop-blur-md p-12 sm:p-16 flex flex-col items-center justify-center text-center max-w-xl mx-auto my-12"
        >
          <div className="w-16 h-16 rounded-3xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mb-6 shadow-xl shadow-orange-500/5">
            <FolderPlus className="w-8 h-8 text-orange-400 stroke-[1.8]" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">No Galleries Created Yet</h3>
          <p className="text-xs sm:text-sm text-slate-400 max-w-md mb-8 leading-relaxed">
            Upload your first photo collection to generate a 6-digit access PIN for your clients, complete with live collaborative selection.
          </p>
          <button
            id="empty-create-album-btn"
            type="button"
            onClick={handleCreateAlbum}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-slate-950 font-semibold text-xs tracking-wide shadow-md shadow-orange-500/20 hover:shadow-lg hover:shadow-orange-500/30 transition-all duration-200 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Create Your First Album</span>
          </button>
        </div>
      ) : filteredAlbums.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-slate-800 bg-[#151a23] text-slate-400 text-xs">
          No albums match "{searchQuery}". Try a different keyword or PIN.
        </div>
      ) : viewMode === "grid" ? (
        /* Responsive CSS Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" id="grid-album-list">
          {filteredAlbums.map((album) => {
            if (!album || !album.id) return null;
            return (
              <AlbumCard
                key={album.id}
                album={album}
                onDelete={handleDeleteAlbum}
                isDeleting={deletingId === album.id}
              />
            );
          })}
        </div>
      ) : (
        /* 5. Redesign Table to Cards: Stacked list of distinct, rounded cards with perfect vertical alignment & breathing space */
        <div className="space-y-3" id="compact-album-list">
          {filteredAlbums.map((album) => {
            if (!album || !album.id) return null;
            const daysLeft = calculateDaysLeft(album.expires_at);
            const isSubmitted = album.status === "submitted" || album.is_locked;
            const isExpired = album.is_expired || (daysLeft !== null && daysLeft === 0);
            const photoCount = album.photo_count ?? album.media_count ?? 0;
            const pinCode = album.pin || album.client_pin;
            const isDeleting = deletingId === album.id;
            const ownerName = album.creator_name || album.client_name || user?.full_name || "Studio Owner";

            return (
              <div
                key={album.id}
                id={`album-row-${album.id}`}
                onClick={() => navigate(`/dashboard/albums/${album.id}`)}
                className="group bg-[#151a23] border border-slate-800/80 hover:border-slate-700 rounded-xl p-4 mb-3 hover:bg-[#181e29] transition-all duration-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 md:gap-6 cursor-pointer shadow-sm relative overflow-hidden"
              >
                {/* Column 1 (Left): Avatar + Copy-to-Clipboard PIN + Title & Owner */}
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  {/* Avatar image */}
                  <div className="w-10 h-10 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center font-bold text-xs text-orange-400 shrink-0 overflow-hidden shadow-inner">
                    {album.cover_photo_url ? (
                      <img
                        src={album.cover_photo_url}
                        alt={album.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    ) : (
                      <span className="uppercase font-mono">
                        {(album.title || "G").charAt(0)}
                      </span>
                    )}
                  </div>

                  {/* 6. PIN Display: Styled as a sleek "copy-to-clipboard" pill with subtle copy icon */}
                  {pinCode ? (
                    <div
                      onClick={(e) => handleCopyPin(e, album.id, pinCode)}
                      title="Click to copy 6-digit access PIN"
                      className="group/pin flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-orange-500/10 text-orange-400 font-mono text-xs font-semibold hover:bg-orange-500/20 transition-all duration-200 cursor-pointer select-none"
                    >
                      <span className="text-[10px] uppercase font-sans text-orange-400/70 font-semibold tracking-wider">PIN</span>
                      <span>{pinCode}</span>
                      {copiedPinId === album.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400 animate-in fade-in zoom-in-50 duration-150" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 opacity-40 group-hover/pin:opacity-100 transition-opacity" />
                      )}
                    </div>
                  ) : (
                    <div className="w-7 h-7 rounded-md bg-slate-800 flex items-center justify-center shrink-0">
                      <ImageIcon className="w-3.5 h-3.5 text-slate-500" />
                    </div>
                  )}

                  {/* Gallery Title & Owner Name */}
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-white group-hover:text-orange-400 transition-colors duration-200 truncate">
                      {album.title || "Untitled Album"}
                    </h3>
                    <p className="text-xs text-slate-400 truncate mt-0.5">
                      {ownerName}
                    </p>
                  </div>
                </div>

                {/* Column 2 (Middle): Photo count pill (bg-slate-800) + 3. Soft Status Badges */}
                <div className="flex items-center gap-3 shrink-0">
                  {/* Photo count pill */}
                  <span className="bg-slate-800 text-slate-300 text-xs font-mono px-2.5 py-1 rounded-lg border border-slate-700/60 shrink-0">
                    {photoCount} {photoCount === 1 ? "Photo" : "Photos"}
                  </span>

                  {/* 3. Soft Status Badges: low-opacity background for high contrast & readability */}
                  <div className="shrink-0">
                    {isSubmitted ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 text-xs font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                        <span>Submitted</span>
                      </span>
                    ) : isExpired ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-medium">
                        <Clock className="w-3.5 h-3.5 text-red-400" />
                        <span>Expired</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20 text-xs font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
                        <span>Selecting</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Column 3 (Right): 4 & 5. Time remaining + Visible Trash icon + Right Arrow icon with hover */}
                <div className="flex items-center gap-3 sm:gap-4 shrink-0">
                  {/* Time remaining */}
                  <div className="flex items-center gap-1.5 text-xs text-gray-400 font-mono">
                    <Clock className="w-3.5 h-3.5 text-gray-400" />
                    <span>
                      {daysLeft !== null ? (isExpired ? "0d left" : `${daysLeft}d left`) : "14d left"}
                    </span>
                  </div>

                  {/* 4. Action Icon: Subtle Trash icon with text-gray-400 and distinct hover effect */}
                  <button
                    type="button"
                    id={`delete-album-btn-${album.id}`}
                    onClick={(e) => handleDeleteAlbum(e, album.id, album.title)}
                    disabled={isDeleting}
                    title="Delete Album"
                    className="p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/15 hover:border hover:border-red-500/30 transition-all duration-200 cursor-pointer"
                  >
                    {isDeleting ? (
                      <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>

                  {/* 4. Action Icon: Right Arrow with visible gray, hover:text-orange-400 and hover:bg-slate-800 */}
                  <div className="p-2 rounded-lg text-gray-400 group-hover:text-orange-400 group-hover:bg-slate-800/80 transition-all duration-200 flex items-center justify-center">
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform duration-200" />
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
