import React, { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  FolderLock,
  Users,
  Image as ImageIcon,
  CheckCircle2,
  Clock,
  HardDrive,
  Plus,
  ArrowRight,
  Sparkles,
  ExternalLink,
  Shield,
  Activity,
  Layers,
  Lock,
  ChevronRight,
  Copy,
  Check,
} from "lucide-react";

export default function DashboardOverview({
  albums = [],
  loading = false,
  onCreateAlbum = () => {},
  onNavigateTab = () => {},
}) {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();

  // Metrics computation
  const totalAlbums = albums.length;

  const totalPhotos = useMemo(() => {
    return albums.reduce((acc, a) => acc + (a.photo_count || a.media_count || 0), 0);
  }, [albums]);

  const totalSelections = useMemo(() => {
    return albums.reduce((acc, a) => acc + (a.selected_count || 0), 0);
  }, [albums]);

  const submittedGalleries = useMemo(() => {
    return albums.filter((a) => a.status === "submitted" || a.is_locked).length;
  }, [albums]);

  const activeSelectingCount = useMemo(() => {
    return albums.filter((a) => a.status !== "submitted" && !a.is_locked && !a.is_expired).length;
  }, [albums]);

  // Storage telemetry
  const storageUsed = Number(user?.storage_used) || 0;
  const storageQuota = Number(user?.storage_quota_limit) > 0 ? Number(user.storage_quota_limit) : 5368709120;
  const storagePercentage = Math.min(100, Math.max(0, Math.round((storageUsed / storageQuota) * 100)));

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return "0 GB";
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(1)} GB`;
  };

  const userPlan = String(user?.subscription_plan || "").toLowerCase();
  const isStudio = userPlan === "studio" || Boolean(isAdmin);

  // Recent 4 albums for preview
  const recentAlbums = useMemo(() => {
    return [...albums].slice(0, 4);
  }, [albums]);

  // Clients summary count
  const uniqueClientsCount = useMemo(() => {
    const set = new Set();
    albums.forEach((a) => {
      const name = (a.client_name || "").trim();
      if (name) set.add(name);
    });
    return set.size;
  }, [albums]);

  if (loading) {
    return (
      <div id="dashboard-overview-loading" className="flex flex-col items-center justify-center py-24 text-slate-400">
        <div className="w-8 h-8 rounded-full border-2 border-orange-500 border-t-transparent animate-spin mb-3" />
        <p className="text-xs font-mono uppercase tracking-wider text-slate-400">
          Loading studio overview...
        </p>
      </div>
    );
  }

  return (
    <div id="dashboard-overview-container" className="space-y-8 max-w-7xl">
      {/* 1. Executive Studio Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#131926] via-[#10141f] to-[#0c0f17] border border-slate-800 p-6 sm:p-8 shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20 uppercase tracking-wider">
                {isStudio ? "Studio Master Console" : "Pro Photographer Console"}
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Proofing Engine
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Welcome back, {user?.full_name || "Photographer"}
            </h1>

            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl leading-relaxed">
              Monitor active proofing galleries, review client photo selections, distribute access PINs, and track studio storage telemetry in real time.
            </p>
          </div>

          {/* Quick Action Launchpad */}
          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={onCreateAlbum}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-slate-950 font-semibold text-xs tracking-wide shadow-md shadow-orange-500/20 hover:shadow-lg hover:shadow-orange-500/30 transition-all duration-200 cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Create New Album</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigateTab("albums")}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-xs font-semibold text-slate-200 hover:text-white transition-all cursor-pointer"
            >
              <span>Manage Albums</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. High-Level Metrics Ribbon (4 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Active Galleries */}
        <div
          onClick={() => onNavigateTab("albums")}
          className="p-5 rounded-2xl bg-[#151a23] border border-slate-800 hover:border-slate-700 transition-all cursor-pointer group shadow-sm"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-400">Total Galleries</span>
            <div className="p-2 rounded-xl bg-orange-500/10 text-orange-400 border border-orange-500/20 group-hover:scale-105 transition-transform">
              <FolderLock className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white font-mono">{totalAlbums}</span>
            <span className="text-[11px] text-slate-400">
              ({activeSelectingCount} active)
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-3 pt-3 border-t border-slate-800/80">
            <span>Explore all collections</span>
            <ArrowRight className="w-3 h-3 text-orange-400 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Card 2: Total Photos Delivered */}
        <div className="p-5 rounded-2xl bg-[#151a23] border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-400">Delivered Photos</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <ImageIcon className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white font-mono">{totalPhotos}</span>
            <span className="text-[11px] text-slate-400">high-res items</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-3 pt-3 border-t border-slate-800/80">
            Across {totalAlbums} client galleries
          </div>
        </div>

        {/* Card 3: Client Selections & Submissions */}
        <div
          onClick={() => onNavigateTab("clients")}
          className="p-5 rounded-2xl bg-[#151a23] border border-slate-800 hover:border-slate-700 transition-all cursor-pointer group shadow-sm"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-400">Client Proof Selections</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 group-hover:scale-105 transition-transform">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-400 font-mono">{totalSelections}</span>
            <span className="text-[11px] text-slate-400">
              ({submittedGalleries} submitted)
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-3 pt-3 border-t border-slate-800/80">
            <span>View client CRM ({uniqueClientsCount} clients)</span>
            <ArrowRight className="w-3 h-3 text-emerald-400 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Card 4: Cloud Storage */}
        <div
          onClick={() => onNavigateTab("settings")}
          className="p-5 rounded-2xl bg-[#151a23] border border-slate-800 hover:border-slate-700 transition-all cursor-pointer group shadow-sm"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-400">Storage Used</span>
            <div className="p-2 rounded-xl bg-orange-500/10 text-orange-400 border border-orange-500/20 group-hover:scale-105 transition-transform">
              <HardDrive className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white font-mono">{formatBytes(storageUsed)}</span>
            <span className="text-[11px] text-slate-400">of {formatBytes(storageQuota)}</span>
          </div>
          {/* Progress bar */}
          <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden mt-3">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500"
              style={{ width: `${storagePercentage}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1.5">
            <span>{storagePercentage}% utilized</span>
            <span className="text-orange-400 font-medium">Manage quota</span>
          </div>
        </div>
      </div>

      {/* 3. Two-Column Layout: Recent Galleries Preview + Studio Shortcuts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Recent Galleries Preview */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-[#151a23] border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <FolderLock className="w-4 h-4 text-orange-400" />
              <h2 className="text-sm font-semibold text-white">Recent Active Collections</h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab("albums")}
              className="text-xs text-orange-400 hover:text-orange-300 font-medium inline-flex items-center gap-1 hover:underline cursor-pointer"
            >
              <span>View All ({albums.length})</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentAlbums.length === 0 ? (
            <div className="py-12 text-center rounded-xl border border-slate-800/80 bg-slate-900/30 text-slate-400 text-xs">
              No galleries created yet. Click "+ Create New Album" above to upload your first proofing gallery.
            </div>
          ) : (
            <div className="divide-y divide-slate-800/80">
              {recentAlbums.map((album) => {
                const isSubmitted = album.status === "submitted" || album.is_locked;
                const photoCount = album.photo_count ?? album.media_count ?? 0;
                const pinCode = album.pin || album.client_pin;

                return (
                  <div
                    key={album.id}
                    onClick={() => navigate(`/dashboard/albums/${album.id}`)}
                    className="py-3.5 flex items-center justify-between gap-4 hover:bg-slate-900/40 px-2 rounded-xl transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700/60 overflow-hidden flex items-center justify-center shrink-0">
                        {album.cover_photo_url ? (
                          <img src={album.cover_photo_url} alt={album.title} className="w-full h-full object-cover" />
                        ) : (
                          <span className="font-bold text-xs text-orange-400">
                            {(album.title || "G").charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>

                      <div className="min-w-0">
                        <h3 className="text-xs font-semibold text-white group-hover:text-orange-400 transition-colors truncate">
                          {album.title || "Untitled Gallery"}
                        </h3>
                        <p className="text-[11px] text-slate-400 truncate">
                          Client: {album.client_name || "Unassigned"} • {photoCount} Photos
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {pinCode && (
                        <span className="hidden sm:inline-block px-2 py-0.5 rounded bg-orange-500/10 text-orange-400 font-mono text-[10px] font-semibold border border-orange-500/20">
                          PIN {pinCode}
                        </span>
                      )}

                      {isSubmitted ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-medium">
                          Submitted
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20 text-[10px] font-medium">
                          Selecting
                        </span>
                      )}

                      <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-orange-400 transition-colors" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right 1 Col: Quick Studio Shortcuts */}
        <div className="space-y-4">
          {/* Shortcut 1: Client Directory */}
          <div
            onClick={() => onNavigateTab("clients")}
            className="p-5 rounded-2xl bg-[#151a23] border border-slate-800 hover:border-slate-700 transition-all cursor-pointer group shadow-sm"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-xl bg-orange-500/10 text-orange-400 border border-orange-500/20 group-hover:scale-105 transition-transform">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-white">Client Directory CRM</h3>
                <p className="text-[11px] text-slate-400">View client PINs & access codes</p>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-orange-400 font-medium pt-2">
              <span>{uniqueClientsCount} Registered Clients</span>
              <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Shortcut 2: Studio Branding */}
          <div
            onClick={() => onNavigateTab("profile")}
            className="p-5 rounded-2xl bg-[#151a23] border border-slate-800 hover:border-slate-700 transition-all cursor-pointer group shadow-sm"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 group-hover:scale-105 transition-transform">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-white">Custom Studio Branding</h3>
                <p className="text-[11px] text-slate-400">Upload watermark logo & palette</p>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-amber-400 font-medium pt-2">
              <span>White-label settings</span>
              <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Shortcut 3: Studio Assistants */}
          <div
            onClick={() => onNavigateTab("assistants")}
            className="p-5 rounded-2xl bg-[#151a23] border border-slate-800 hover:border-slate-700 transition-all cursor-pointer group shadow-sm"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20 group-hover:scale-105 transition-transform">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-white">Studio Assistants</h3>
                <p className="text-[11px] text-slate-400">Team upload & management</p>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-sky-400 font-medium pt-2">
              <span>Manage staff members</span>
              <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
