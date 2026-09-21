import React, { useMemo } from "react";
import {
  BarChart3,
  Eye,
  CheckCircle2,
  Lock,
  Clock,
  TrendingUp,
  X,
  Sparkles
} from "lucide-react";

export default function StudioAnalyticsModal({
  isOpen = false,
  onClose = () => {},
  albums = [],
  user = {}
}) {
  const safeAlbums = Array.isArray(albums) ? albums : [];

  const metrics = useMemo(() => {
    let totalViews = 0;
    let totalPhotos = 0;
    let totalSelected = 0;
    let submittedCount = 0;
    let activeCount = 0;

    safeAlbums.forEach((a) => {
      if (!a) return;
      totalViews += Number(a.view_count || 0);
      totalPhotos += Number(a.photo_count || a.media_count || 0);
      totalSelected += Number(a.selected_count || 0);
      if (a.is_locked || a.status === "submitted") {
        submittedCount += 1;
      } else {
        activeCount += 1;
      }
    });

    const completionRate = safeAlbums.length > 0
      ? Math.round((submittedCount / safeAlbums.length) * 100)
      : 0;

    return {
      totalGalleries: safeAlbums.length,
      totalViews,
      totalPhotos,
      totalSelected,
      submittedCount,
      activeCount,
      completionRate
    };
  }, [safeAlbums]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl bg-[#111317] border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800/80 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>Studio Client Analytics</span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-amber-400/10 border border-amber-400/20 text-amber-300">
                  Studio Plan
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Track client engagement, proof selection velocity, and delivery completion.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Analytics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80">
            <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
              <Eye className="w-3.5 h-3.5 text-amber-400" />
              <span>Total Views</span>
            </div>
            <p className="text-xl font-bold font-mono text-white">{metrics.totalViews}</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80">
            <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Selected</span>
            </div>
            <p className="text-xl font-bold font-mono text-white">{metrics.totalSelected}</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80">
            <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
              <Lock className="w-3.5 h-3.5 text-sky-400" />
              <span>Submitted</span>
            </div>
            <p className="text-xl font-bold font-mono text-white">{metrics.submittedCount}</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80">
            <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
              <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
              <span>Completion</span>
            </div>
            <p className="text-xl font-bold font-mono text-white">{metrics.completionRate}%</p>
          </div>
        </div>

        {/* Gallery Performance Breakdown */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono">
            Active Gallery Engagement
          </h4>

          {safeAlbums.length === 0 ? (
            <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/30 text-center text-xs text-slate-400">
              No gallery data available yet.
            </div>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {safeAlbums.slice(0, 8).map((a) => (
                <div
                  key={a?.id || Math.random()}
                  className="p-3 rounded-xl bg-slate-900/40 border border-slate-800/70 flex items-center justify-between text-xs"
                >
                  <div className="min-w-0 pr-3">
                    <p className="font-semibold text-white truncate">{a?.title || "Untitled"}</p>
                    <p className="text-[11px] text-slate-400 truncate">{a?.client_name || "Client"}</p>
                  </div>
                  <div className="flex items-center gap-3 font-mono text-[11px] shrink-0">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Eye className="w-3 h-3 text-amber-400" />
                      {a?.view_count || 0}
                    </span>
                    <span className="text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      {a?.selected_count || 0}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
