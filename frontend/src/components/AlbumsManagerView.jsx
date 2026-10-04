import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  FolderLock,
  Plus,
  Search,
  Image as ImageIcon,
  Clock,
  CheckCircle2,
  Trash2,
  ExternalLink,
  HardDrive,
  Copy,
  Check,
  Filter,
} from "lucide-react";
import CreateAlbumModal from "./CreateAlbumModal";

export default function AlbumsManagerView({
  albums = [],
  loading = false,
  onRefresh = () => {},
  onDeleteAlbum = () => {},
  deletingId = null,
}) {
  const navigate = useNavigate();
  const [filterTab, setFilterTab] = useState("all"); // 'all' | 'selecting' | 'submitted' | 'expired'
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [copiedPinId, setCopiedPinId] = useState(null);

  const calculateDaysLeft = (expiresAt) => {
    if (!expiresAt) return null;
    const diff = new Date(expiresAt).getTime() - new Date().getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 0;
  };

  const handleCopyPin = (e, albumId, pinCode) => {
    e.stopPropagation();
    if (pinCode) {
      navigator.clipboard.writeText(pinCode);
      setCopiedPinId(albumId);
      setTimeout(() => setCopiedPinId(null), 2000);
    }
  };

  // Metrics computation
  const totalPhotos = useMemo(() => {
    return albums.reduce((acc, a) => acc + (a.photo_count || a.media_count || 0), 0);
  }, [albums]);

  const activeProofsCount = useMemo(() => {
    return albums.filter((a) => a.status !== "submitted" && !a.is_locked && !a.is_expired).length;
  }, [albums]);

  const submittedCount = useMemo(() => {
    return albums.filter((a) => a.status === "submitted" || a.is_locked).length;
  }, [albums]);

  // Filtered albums
  const filteredAlbums = useMemo(() => {
    return albums.filter((album) => {
      const daysLeft = calculateDaysLeft(album.expires_at);
      const isSubmitted = album.status === "submitted" || album.is_locked;
      const isExpired = album.is_expired || (daysLeft !== null && daysLeft === 0);

      // Filter by tab
      if (filterTab === "selecting" && (isSubmitted || isExpired)) return false;
      if (filterTab === "submitted" && !isSubmitted) return false;
      if (filterTab === "expired" && !isExpired) return false;

      // Filter by search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const title = (album.title || "").toLowerCase();
        const client = (album.client_name || "").toLowerCase();
        const pin = (album.pin || album.client_pin || "").toLowerCase();
        if (!title.includes(q) && !client.includes(q) && !pin.includes(q)) return false;
      }

      return true;
    });
  }, [albums, filterTab, searchQuery]);

  return (
    <div id="albums-manager-view" className="space-y-6">
      {/* Title Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Albums & Archive Manager
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 text-xs font-semibold uppercase tracking-wider">
              {albums.length} Total Collections
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Organize gallery collections, monitor photo allocations, and manage permanent client delivery archives.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsCreateModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-slate-950 font-semibold text-xs tracking-wide shadow-md shadow-orange-500/20 hover:shadow-lg hover:shadow-orange-500/30 transition-all duration-200 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Create New Album</span>
        </button>
      </div>

      {/* Metrics Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl bg-[#151a23] border border-slate-800">
          <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
            <FolderLock className="w-4 h-4 text-orange-400" />
            <span>Total Albums</span>
          </div>
          <p className="text-xl font-bold text-white font-mono">{albums.length}</p>
        </div>

        <div className="p-4 rounded-xl bg-[#151a23] border border-slate-800">
          <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
            <ImageIcon className="w-4 h-4 text-amber-400" />
            <span>Total Photos</span>
          </div>
          <p className="text-xl font-bold text-white font-mono">{totalPhotos}</p>
        </div>

        <div className="p-4 rounded-xl bg-[#151a23] border border-slate-800">
          <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
            <Clock className="w-4 h-4 text-orange-400" />
            <span>Active Proofing</span>
          </div>
          <p className="text-xl font-bold text-orange-400 font-mono">{activeProofsCount}</p>
        </div>

        <div className="p-4 rounded-xl bg-[#151a23] border border-slate-800">
          <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
            <CheckCircle2 className="w-4 h-4 text-green-400" />
            <span>Submitted Orders</span>
          </div>
          <p className="text-xl font-bold text-green-400 font-mono">{submittedCount}</p>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Category Filter Tabs */}
        <div className="flex items-center p-1 rounded-xl bg-[#151a23] border border-slate-800 self-start sm:self-auto overflow-x-auto max-w-full">
          {[
            { id: "all", label: "All Collections" },
            { id: "selecting", label: "Active Proofs" },
            { id: "submitted", label: "Submitted" },
            { id: "expired", label: "Archived" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 cursor-pointer whitespace-nowrap ${
                filterTab === tab.id
                  ? "bg-orange-500 text-slate-950 font-bold shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search albums by title or PIN..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#151a23] border border-slate-800 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-orange-500/60 transition-all duration-200"
          />
        </div>
      </div>

      {/* Albums Grid */}
      {filteredAlbums.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-slate-800 bg-[#151a23] text-slate-400 text-xs">
          No albums found matching the selected filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAlbums.map((album) => {
            const daysLeft = calculateDaysLeft(album.expires_at);
            const isSubmitted = album.status === "submitted" || album.is_locked;
            const isExpired = album.is_expired || (daysLeft !== null && daysLeft === 0);
            const photoCount = album.photo_count ?? album.media_count ?? 0;
            const pinCode = album.pin || album.client_pin;
            const isDeleting = deletingId === album.id;

            return (
              <div
                key={album.id}
                onClick={() => navigate(`/dashboard/albums/${album.id}`)}
                className="group bg-[#151a23] border border-slate-800/80 hover:border-slate-700 rounded-xl overflow-hidden hover:bg-[#181e29] transition-all duration-200 cursor-pointer shadow-sm flex flex-col justify-between"
              >
                {/* Image Preview & PIN */}
                <div className="h-40 bg-gradient-to-tr from-[#0b0f19] via-[#111726] to-[#0b0f19] relative flex items-center justify-center border-b border-slate-800/80">
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
                    <ImageIcon className="w-10 h-10 text-slate-700 group-hover:text-orange-400/80 transition-colors" />
                  )}

                  {/* PIN Pill */}
                  {pinCode && (
                    <div
                      onClick={(e) => handleCopyPin(e, album.id, pinCode)}
                      title="Click to copy PIN"
                      className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-black/80 backdrop-blur-md text-orange-400 font-mono text-xs font-bold shadow-sm"
                    >
                      <span className="text-[10px] uppercase font-sans text-orange-400/70">PIN</span>
                      <span>{pinCode}</span>
                      {copiedPinId === album.id ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3 opacity-40 hover:opacity-100" />
                      )}
                    </div>
                  )}

                  {/* Status Pill */}
                  <div className="absolute top-3 right-3">
                    {isSubmitted ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-[10px] font-medium text-green-400 backdrop-blur-md">
                        <CheckCircle2 className="w-3 h-3 text-green-400" />
                        Submitted
                      </span>
                    ) : isExpired ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-[10px] font-medium text-red-400 backdrop-blur-md">
                        <Clock className="w-3 h-3 text-red-400" />
                        Expired
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-[10px] font-medium text-orange-400 backdrop-blur-md">
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
                        Selecting
                      </span>
                    )}
                  </div>
                </div>

                {/* Details Body */}
                <div className="p-4 space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold text-white group-hover:text-orange-400 transition-colors truncate">
                      {album.title || "Untitled Album"}
                    </h3>
                    <p className="text-xs text-slate-400 truncate mt-0.5">
                      Client: {album.client_name || "Unassigned"}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
                    <span className="font-mono text-slate-300">
                      {photoCount} {photoCount === 1 ? "Photo" : "Photos"}
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteAlbum(e, album.id, album.title);
                        }}
                        disabled={isDeleting}
                        title="Delete Album"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/15 transition-all duration-200"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      <div className="p-1.5 rounded-lg text-gray-400 group-hover:text-orange-400 group-hover:bg-slate-800 transition-all duration-200">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      <CreateAlbumModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onAlbumCreated={onRefresh}
      />
    </div>
  );
}
