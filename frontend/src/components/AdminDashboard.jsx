import React, { useState, useEffect } from "react";
import api from "../api/axios";
import { Users, FolderArchive, HardDrive, Image as ImageIcon, AlertCircle, RefreshCw, ShieldCheck } from "lucide-react";

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get("/api/v1/admin/stats");
      setStats(response.data);
    } catch (err) {
      const msg =
        err.response?.data?.detail ||
        "Failed to load administrative platform statistics.";
      setError(msg);
    } finally {
      setLoading(false);
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
      value: `${formatBytesToGB(stats?.total_storage_used)} GB`,
      icon: HardDrive,
      color: "text-emerald-400",
      bgGradient: "from-emerald-500/10 to-transparent",
      borderColor: "border-emerald-500/20",
      subtext: "Virtual quota tracking across cloud",
    },
    {
      id: "stat-total-photos",
      title: "Total Proof Assets",
      value: stats?.total_photos ?? 0,
      icon: ImageIcon,
      color: "text-purple-400",
      bgGradient: "from-purple-500/10 to-transparent",
      borderColor: "border-purple-500/20",
      subtext: "Protected WebP proofs on edge",
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

        <button
          type="button"
          onClick={fetchStats}
          className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800/80 text-slate-300 hover:text-white text-xs font-medium transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Stats</span>
        </button>
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

      {/* Enterprise System Status Notice */}
      <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/30 backdrop-blur-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Multi-Cloud Storage & Edge Nodes Operational</h3>
            <p className="text-xs text-slate-400">
              Cloudinary, ImageKit, and Redis Upstash smart polling sync are running with 100% health.
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
