import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AdminDashboard from "./AdminDashboard";
import CreateAlbumModal from "../components/CreateAlbumModal";
import AlbumCard from "../components/AlbumCard";
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
  Crown,
  LayoutGrid,
  List,
} from "lucide-react";
import ProfileBrandingView from "../components/ProfileBrandingView";

// Placeholder for views we haven't migrated yet
const PlaceholderView = ({ title }) => (
  <div className="flex flex-col items-center justify-center py-20 text-slate-500">
    <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center mb-4">
      <Clock className="w-6 h-6 text-slate-400" />
    </div>
    <h2 className="text-lg font-semibold text-slate-900 mb-2">{title} View</h2>
    <p className="text-sm">This view is currently being migrated to inline.</p>
  </div>
);

export default function DashboardHome() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentTab = searchParams.get("tab") || "albums";

  const [albums, setAlbums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [viewMode, setViewMode] = useState("list"); // 'list' | 'grid'
  
  // We keep modal state for now if needed, but we try to move away
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const [viewAsPhotographer, setViewAsPhotographer] = useState(false);

  const fetchAlbums = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get("/api/v1/albums");
      setAlbums(response.data || []);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to load client albums. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin || viewAsPhotographer) {
      if (currentTab === "albums") {
        fetchAlbums();
      }
    }
  }, [isAdmin, viewAsPhotographer, currentTab]);

  if (isAdmin && !viewAsPhotographer) {
    return <AdminDashboard onSwitchToGalleries={() => setViewAsPhotographer(true)} />;
  }

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
    if (!window.confirm(`Are you sure you want to delete "${albumTitle || "Untitled Album"}"?`)) {
      return;
    }
    try {
      setDeletingId(albumId);
      await api.delete(`/api/v1/albums/${albumId}`);
      setAlbums((prev) => (Array.isArray(prev) ? prev.filter((a) => a?.id !== albumId) : []));
    } catch (err) {
      alert("Failed to delete album.");
    } finally {
      setDeletingId(null);
    }
  };

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

  // Route inline views based on currentTab
  if (currentTab === "profile") return <ProfileBrandingView />;
  if (currentTab === "assistants") return <PlaceholderView title="Team Management" />;
  if (currentTab === "password") return <PlaceholderView title="Change Password" />;
  if (currentTab === "new-album") return <PlaceholderView title="Create New Album" />;
  if (currentTab === "clients") return <PlaceholderView title="Clients Directory" />;

  // Albums View (Default)
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-500">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin mb-3" />
        <p className="text-xs font-medium tracking-wide">Loading albums...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-red-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          <span className="text-sm font-medium">{error}</span>
        </div>
        <button
          onClick={fetchAlbums}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-red-200 text-sm font-medium hover:bg-red-50 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Client Albums</h1>
          <p className="text-sm text-slate-500 mt-1">Manage and deliver high-resolution galleries.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchAlbums}
            className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => navigate('/dashboard?tab=new-album')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm transition-colors shadow-sm shadow-indigo-600/20"
          >
            <Plus className="w-4 h-4" />
            New Album
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      {albums.length > 0 && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search albums..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-sm"
            />
          </div>
          <div className="flex items-center p-1 rounded-xl bg-slate-100 border border-slate-200">
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded-lg transition-all ${viewMode === "list" ? "bg-white text-indigo-600 shadow-sm font-medium" : "text-slate-500 hover:text-slate-900"}`}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-lg transition-all ${viewMode === "grid" ? "bg-white text-indigo-600 shadow-sm font-medium" : "text-slate-500 hover:text-slate-900"}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Albums List */}
      {albums.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center max-w-xl mx-auto mt-12 shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mx-auto mb-6">
            <FolderPlus className="w-8 h-8 text-indigo-600" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">No Albums Yet</h3>
          <p className="text-sm text-slate-500 mb-8">Create your first album to start delivering photos.</p>
          <button
            onClick={() => navigate('/dashboard?tab=new-album')}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm transition-colors mx-auto"
          >
            <Plus className="w-4 h-4" />
            Create Album
          </button>
        </div>
      ) : filteredAlbums.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-slate-200 bg-white text-slate-500 text-sm">
          No albums match "{searchQuery}".
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Note: AlbumCard needs its own Light Theme update later */}
          {filteredAlbums.map((album) => (
            <AlbumCard
              key={album.id}
              album={album}
              onDelete={handleDeleteAlbum}
              isDeleting={deletingId === album.id}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredAlbums.map((album) => {
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
                onClick={() => navigate(`/dashboard/albums/${album.id}`)}
                className="group p-4 rounded-xl border border-slate-200 bg-white hover:border-indigo-200 hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  {pinCode ? (
                    <div className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 font-mono text-sm font-bold tracking-widest shrink-0">
                      {pinCode}
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
                      <ImageIcon className="w-5 h-5 text-slate-400" />
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
                        {album.title}
                      </h3>
                      {selectedCount > 0 && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full shrink-0">
                          <CheckCircle2 className="w-3 h-3" />
                          {selectedCount} Selected
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5" />
                      {album.client_name || "Unassigned"}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <span className="text-xs font-medium text-slate-500 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200">
                    {photoCount} {photoCount === 1 ? "Photo" : "Photos"}
                  </span>
                  
                  {isSubmitted ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Submitted
                    </span>
                  ) : isExpired ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded-md">
                      <Clock className="w-3.5 h-3.5" /> Expired
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                      Selecting
                    </span>
                  )}

                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => handleDeleteAlbum(e, album.id, album.title)}
                      disabled={isDeleting}
                      className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    >
                      {isDeleting ? <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                    <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
