import React from "react";
import {
  Search,
  Mail,
  Zap,
  Users,
  Power,
  Layers,
  KeyRound,
  Sliders,
  RefreshCw,
} from "lucide-react";

export default function AdminPhotographerTable({
  filteredPhotographers = [],
  searchQuery = "",
  setSearchQuery,
  loading = false,
  actionLoadingId = null,
  handleToggleSuspend,
  handleTogglePlan,
  handleResetPassword,
  handleEditQuota,
  formatBytes,
}) {
  return (
    <section className="p-6 rounded-2xl bg-[#0e121b] border border-indigo-950/70 shadow-xl shadow-black/30">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-indigo-950/60">
        <div>
          <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
            <span>Directory</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              {filteredPhotographers.length}
            </span>
          </h2>
          <p className="text-xs text-slate-400">
            Manage accounts, quota overrides, and subscription statuses
          </p>
        </div>

        {/* Search Input */}
        <div className="w-full sm:w-72 relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search by name, email, or plan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery?.(e.target.value)}
            className="w-full bg-[#080a0f] border border-indigo-950/80 rounded-xl pl-10 pr-3.5 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40 transition-all"
          />
        </div>
      </div>

      {/* Directory Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-indigo-950/80 text-slate-400 font-mono uppercase tracking-wider">
              <th className="pb-3 px-3">Photographer</th>
              <th className="pb-3 px-3">Plan Tier</th>
              <th className="pb-3 px-3">Storage Allocation</th>
              <th className="pb-3 px-3">Albums & Media</th>
              <th className="pb-3 px-3">Status</th>
              <th className="pb-3 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-indigo-950/40">
            {filteredPhotographers.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-500">
                  {loading ? "Loading directory..." : "No photographers match the search query."}
                </td>
              </tr>
            ) : (
              filteredPhotographers.map((p) => {
                const quotaGb = (p.storage_quota_limit / (1024 * 1024 * 1024)).toFixed(1);
                const usagePercent = Math.min(
                  100,
                  Math.round((p.storage_used / (p.storage_quota_limit || 1)) * 100)
                );
                const isLoading = actionLoadingId === p.id;

                return (
                  <tr key={p.id} className="hover:bg-indigo-950/20 transition-colors">
                    {/* Name & Email */}
                    <td className="py-3.5 px-3">
                      <div className="font-semibold text-white">{p.full_name}</div>
                      <div className="text-slate-400 font-mono text-[11px] flex items-center gap-1 mt-0.5">
                        <Mail className="w-3 h-3 text-indigo-400/60" />
                        <span>{p.email}</span>
                      </div>
                    </td>

                    {/* Plan */}
                    <td className="py-3.5 px-3">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider font-mono border ${
                          p.subscription_plan === "studio"
                            ? "bg-purple-950/80 text-purple-300 border-purple-500/40 shadow-sm shadow-purple-500/10"
                            : "bg-slate-800/80 text-slate-300 border-slate-700/80 shadow-sm"
                        }`}
                      >
                        {p.subscription_plan === "studio" && (
                          <Zap className="w-3 h-3 text-purple-400" />
                        )}
                        {p.subscription_plan}
                      </span>
                    </td>

                    {/* Storage */}
                    <td className="py-3.5 px-3 min-w-[170px]">
                      <div className="flex items-center justify-between text-[11px] text-slate-300 font-mono mb-1">
                        <span>{formatBytes ? formatBytes(p.storage_used) : `${p.storage_used} B`}</span>
                        <span className="text-slate-500">/ {quotaGb} GB</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            usagePercent > 90
                              ? "bg-red-500"
                              : usagePercent > 70
                              ? "bg-amber-400"
                              : "bg-indigo-500"
                          }`}
                          style={{ width: `${usagePercent}%` }}
                        />
                      </div>
                    </td>

                    {/* Albums & Media */}
                    <td className="py-3.5 px-3">
                      <div className="text-slate-200 font-mono text-xs">
                        <strong>{p.total_albums}</strong> <span className="text-slate-400 font-sans">albums</span>
                        <span className="text-slate-600 mx-1">•</span>
                        <strong>{p.total_media}</strong> <span className="text-slate-400 font-sans">media</span>
                      </div>
                      <div className="mt-1">
                        {p.assistants_count > 0 ? (
                          <span
                            title={`Includes data aggregated from ${p.assistants_count} studio assistant(s): ${p.assistants?.map((a) => a.full_name).join(", ") || ""}`}
                            className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/25"
                          >
                            <Users className="w-3 h-3 text-amber-400" />
                            <span>Root + {p.assistants_count} Assistant{p.assistants_count > 1 ? "s" : ""}</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500 font-mono">
                            Root Solo Account
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-3">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                          p.is_active
                            ? "bg-emerald-950/80 text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-500/10"
                            : "bg-red-950/80 text-red-300 border-red-500/40 shadow-sm shadow-red-500/10"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            p.is_active ? "bg-emerald-400 animate-pulse" : "bg-red-400"
                          }`}
                        />
                        {p.is_active ? "Active" : "Suspended"}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {/* Toggle Suspend / Active */}
                        <button
                          onClick={() => handleToggleSuspend?.(p.id, p.is_active)}
                          disabled={isLoading}
                          title={
                            p.is_active
                              ? "Suspend Root Account (Cascades suspension to all assistants)"
                              : "Activate Root Account (Re-enables studio access)"
                          }
                          className={`p-2 rounded-lg text-xs font-medium border transition-all ${
                            p.is_active
                              ? "bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/30 hover:scale-105 active:scale-95"
                              : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:scale-105 active:scale-95"
                          }`}
                        >
                          <Power className="w-3.5 h-3.5" />
                        </button>

                        {/* Toggle Plan (Basic <-> Studio) */}
                        <button
                          onClick={() => handleTogglePlan?.(p.id, p.subscription_plan)}
                          disabled={isLoading}
                          title={
                            p.subscription_plan === "basic"
                              ? "Upgrade to Studio Tier (Unlocks assistants, custom branding & downloads)"
                              : "Downgrade to Basic Tier (Deactivates assistants)"
                          }
                          className="p-2 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 transition-all hover:scale-105 active:scale-95"
                        >
                          <Layers className="w-3.5 h-3.5" />
                        </button>

                        {/* Reset Password */}
                        <button
                          onClick={() => handleResetPassword?.(p.id, p.email)}
                          disabled={isLoading}
                          title="Reset Password for Root Account (Generates fresh temporary credentials)"
                          className="p-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-all hover:scale-105 active:scale-95"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                        </button>

                        {/* Edit Quota Limit Override */}
                        <button
                          onClick={() => handleEditQuota?.(p.id, p.storage_quota_limit)}
                          disabled={isLoading || actionLoadingId === p.id}
                          title="Override Storage Quota Limit (GB) (e.g. 5, 25, 50, 9999 for Unlimited)"
                          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                        >
                          {actionLoadingId === p.id ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                          ) : (
                            <Sliders className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
