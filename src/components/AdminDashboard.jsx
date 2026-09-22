import React, { useState, useEffect } from "react";
import api from "../api/axios";
import { Users, FolderArchive, HardDrive, Image as ImageIcon, AlertCircle, RefreshCw, ShieldCheck, Megaphone, CheckCircle } from "lucide-react";

export default function AdminDashboard({ onSwitchToGalleries = null }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Broadcast System state
  const [currentBroadcast, setCurrentBroadcast] = useState(null);
  const [broadcastForm, setBroadcastForm] = useState({
    title: "",
    message: "",
    type: "info",
  });
  const [isPublishingBroadcast, setIsPublishingBroadcast] = useState(false);
  const [broadcastSuccessMsg, setBroadcastSuccessMsg] = useState("");

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const [statsRes, broadcastRes] = await Promise.all([
        api.get("/api/v1/admin/stats"),
        api.get("/api/v1/broadcasts/active").catch(() => ({ data: null })),
      ]);
      setStats(statsRes.data);
      setCurrentBroadcast(broadcastRes.data || null);
    } catch (err) {
      const msg =
        err.response?.data?.detail ||
        "Failed to load administrative platform statistics.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handlePublishBroadcast = async (e) => {
    e.preventDefault();
    if (!broadcastForm.title.trim() || !broadcastForm.message.trim()) return;

    try {
      setIsPublishingBroadcast(true);
      const res = await api.post("/api/v1/admin/broadcasts", {
        title: broadcastForm.title.trim(),
        message: broadcastForm.message.trim(),
        type: broadcastForm.type,
      });
      setCurrentBroadcast(res.data);
      setBroadcastForm({ title: "", message: "", type: "info" });
      setBroadcastSuccessMsg("Global broadcast announcement published successfully!");
      setTimeout(() => setBroadcastSuccessMsg(""), 4000);
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to publish broadcast.");
    } finally {
      setIsPublishingBroadcast(false);
    }
  };

  const handleDeactivateBroadcast = async (broadcastId) => {
    try {
      await api.put(`/api/v1/admin/broadcasts/${broadcastId}/deactivate`);
      setCurrentBroadcast(null);
      setBroadcastSuccessMsg("Broadcast announcement deactivated.");
      setTimeout(() => setBroadcastSuccessMsg(""), 4000);
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to deactivate broadcast.");
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const formatBytesToGB = (bytes) => {
    if (!bytes || bytes === 0) return "0.0";
    return (bytes / (1024 * 1024 * 1024)).toFixed(1);
  };

  if (loading) {
    return (
      <div id="admin-dashboard-loading" className="flex flex-col items-center justify-center py-20 text-slate-400">
        <div className="w-8 h-8 rounded-full border-2 border-amber-400 border-t-transparent animate-spin mb-3" />
        <p className="text-xs font-mono uppercase tracking-wider text-slate-500">
          Loading platform metrics...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div id="admin-dashboard-error" className="p-6 rounded-2xl border border-red-500/20 bg-red-950/40 text-red-300 flex flex-col items-start gap-4">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <span className="text-sm font-medium">{error}</span>
        </div>
        <button
          type="button"
          onClick={fetchStats}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-900/60 hover:bg-red-800/60 border border-red-700/60 text-xs font-semibold text-white transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  const metricCards = [
    {
      id: "stat-total-photographers",
      title: "Total Photographers",
      value: stats?.total_photographers ?? 0,
      icon: Users,
      color: "text-amber-400",
      bgGradient: "from-amber-500/10 to-transparent",
      borderColor: "border-amber-500/20",
      subtext: "Verified studio & solo accounts",
    },
    {
      id: "stat-total-albums",
      title: "Total Client Albums",
      value: stats?.total_albums ?? 0,
      icon: FolderArchive,
      color: "text-blue-400",
      bgGradient: "from-blue-500/10 to-transparent",
      borderColor: "border-blue-500/20",
      subtext: "Active & finalized proof sessions",
    },
    {
      id: "stat-total-storage",
      title: "Total Storage Used",
      value: `${stats?.total_storage_used_gb != null ? stats.total_storage_used_gb : formatBytesToGB(stats?.total_storage_used_bytes || stats?.total_storage_used)} GB`,
      icon: HardDrive,
      color: "text-emerald-400",
      bgGradient: "from-emerald-500/10 to-transparent",
      borderColor: "border-emerald-500/20",
      subtext: "Allocated high-resolution proof storage",
    },
    {
      id: "stat-total-photos",
      title: "Total Proof Assets",
      value: stats?.total_photos ?? 0,
      icon: ImageIcon,
      color: "text-purple-400",
      bgGradient: "from-purple-500/10 to-transparent",
      borderColor: "border-purple-500/20",
      subtext: "Protected gallery proof assets",
    },
  ];

  return (
    <div id="admin-dashboard-container" className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Platform Overview</h1>
            <span className="text-[11px] px-2 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-300 font-mono">
              Root Authority
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Real-time infrastructure health, global quota consumption, and photographer management.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {typeof onSwitchToGalleries === "function" && (
            <button
              id="admin-switch-to-galleries-btn"
              type="button"
              onClick={onSwitchToGalleries}
              className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl border border-amber-500/30 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 hover:text-white text-xs font-semibold transition-all shadow-sm"
            >
              <FolderArchive className="w-3.5 h-3.5 text-amber-400" />
              <span>Switch to Client Proofs</span>
            </button>
          )}

          <button
            type="button"
            onClick={fetchStats}
            className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800/80 text-slate-300 hover:text-white text-xs font-medium transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Stats</span>
          </button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {metricCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.id}
              id={card.id}
              className={`relative overflow-hidden rounded-2xl border ${card.borderColor} bg-slate-900/50 backdrop-blur-md p-6 flex flex-col justify-between hover:border-slate-700 transition-all`}
            >
              <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl ${card.bgGradient} pointer-events-none`} />

              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
                  {card.title}
                </span>
                <div className="w-9 h-9 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center">
                  <Icon className={`w-4 h-4 ${card.color}`} />
                </div>
              </div>

              <div>
                <div className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-1">
                  {card.value}
                </div>
                <p className="text-[11px] text-slate-500">{card.subtext}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Global Broadcast Announcement Manager */}
      <div id="admin-broadcast-section" className="p-6 rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-md space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
              <Megaphone className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Global Dashboard Broadcast</h3>
              <p className="text-xs text-slate-400">
                Push live announcement banners to all photographers' workspaces in real-time.
              </p>
            </div>
          </div>

          {currentBroadcast && currentBroadcast.is_active && (
            <span className="px-3 py-1 rounded-full text-xs font-mono font-medium bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Live Banner Active
            </span>
          )}
        </div>

        {broadcastSuccessMsg && (
          <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 flex items-center gap-2.5 text-xs font-medium">
            <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{broadcastSuccessMsg}</span>
          </div>
        )}

        {currentBroadcast && currentBroadcast.is_active ? (
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold ${
                    currentBroadcast.type === "warning"
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                      : currentBroadcast.type === "promo"
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      : "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                  }`}
                >
                  {currentBroadcast.type}
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  Active Banner
                </span>
              </div>
              <h4 className="text-sm font-semibold text-white">
                {currentBroadcast.title}
              </h4>
              <p className="text-xs text-slate-300 max-w-2xl">
                {currentBroadcast.message}
              </p>
            </div>

            <button
              type="button"
              onClick={() => handleDeactivateBroadcast(currentBroadcast.id)}
              className="px-3.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-semibold transition-colors flex-shrink-0"
            >
              Turn Off Banner
            </button>
          </div>
        ) : (
          <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800/80 text-slate-500 text-xs text-center">
            No active broadcast banner currently displayed. Post an announcement below.
          </div>
        )}

        <form onSubmit={handlePublishBroadcast} className="space-y-4 pt-1">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-8 space-y-1.5">
              <label className="text-xs font-medium text-slate-300">
                Announcement Title
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Scheduled Maintenance Notice"
                value={broadcastForm.title}
                onChange={(e) =>
                  setBroadcastForm({ ...broadcastForm, title: e.target.value })
                }
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-400 transition-colors"
              />
            </div>

            <div className="sm:col-span-4 space-y-1.5">
              <label className="text-xs font-medium text-slate-300">
                Banner Style
              </label>
              <select
                value={broadcastForm.type}
                onChange={(e) =>
                  setBroadcastForm({ ...broadcastForm, type: e.target.value })
                }
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400 transition-colors"
              >
                <option value="info">Info (Sky Blue)</option>
                <option value="warning">Warning (Amber Yellow)</option>
                <option value="promo">Promo (Emerald Green)</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">
              Message Content
            </label>
            <textarea
              required
              rows={2}
              placeholder="Announcement text displayed to all photographers..."
              value={broadcastForm.message}
              onChange={(e) =>
                setBroadcastForm({ ...broadcastForm, message: e.target.value })
              }
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-400 transition-colors resize-none"
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-slate-500">
              Publishing replaces and deactivates any existing banner.
            </span>
            <button
              type="submit"
              disabled={isPublishingBroadcast}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {isPublishingBroadcast ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-950" />
              ) : (
                <>
                  <Megaphone className="w-3.5 h-3.5 text-slate-950" />
                  <span>Publish Broadcast</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Enterprise System Status Notice */}
      <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/30 backdrop-blur-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Cloud Storage & Real-Time Sync Operational</h3>
            <p className="text-xs text-slate-400">
              High-resolution proof delivery and collaborative client selection sync are running with 100% reliability.
            </p>
          </div>
        </div>
        <span className="px-3 py-1 rounded-full border border-emerald-500/30 bg-emerald-950/40 text-emerald-300 text-[11px] font-mono whitespace-nowrap">
          Live Sync Active
        </span>
      </div>
    </div>
  );
}
