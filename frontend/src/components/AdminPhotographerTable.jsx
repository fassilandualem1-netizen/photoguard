import React, { useState, useEffect, useRef } from "react";
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
  UserPlus,
  MoreVertical,
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
  onOpenRegisterModal,
}) {
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const dropdownRef = useRef(null);

  // Close dropdown on click outside or Escape key
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpenDropdownId(null);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setOpenDropdownId(null);
      }
    };
    if (openDropdownId !== null) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openDropdownId]);
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
            Manage photographer accounts and billing.
          </p>
        </div>

        {/* Search Input & Action Button */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
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

          {onOpenRegisterModal && (
            <button
              type="button"
              id="open-register-photographer-btn"
              onClick={onOpenRegisterModal}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-all shadow-md shadow-indigo-600/30 shrink-0 cursor-pointer active:scale-95"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add Photographer</span>
            </button>
          )}
        </div>
      </div>

      {/* Directory Table */}
      <div className="overflow-x-auto min-h-[260px] pb-10">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-indigo-950/80 text-slate-400 font-mono uppercase tracking-wider">
              <th className="py-3.5 px-4">Photographer</th>
              <th className="py-3.5 px-4">Plan Tier</th>
              <th className="py-3.5 px-4">Storage Allocation</th>
              <th className="py-3.5 px-4">Albums & Media</th>
              <th className="py-3.5 px-4">Status</th>
              <th className="py-3.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-indigo-950/60">
            {filteredPhotographers.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-500">
                  {loading ? "Loading directory..." : "No photographers match the search query."}
                </td>
              </tr>
            ) : (
              filteredPhotographers.map((p, index) => {
                const isBottomRow =
                  index >= filteredPhotographers.length - 2 && filteredPhotographers.length > 2;
                const quotaGb = (p.storage_quota_limit / (1024 * 1024 * 1024)).toFixed(1);
                const usagePercent = Math.min(
                  100,
                  Math.round((p.storage_used / (p.storage_quota_limit || 1)) * 100)
                );
                const isLoading = actionLoadingId === p.id;

                return (
                  <tr key={p.id} className="hover:bg-indigo-950/20 transition-colors">
                    {/* Name & Email */}
                    <td className="py-5 px-4">
                      <div className="font-semibold text-white">{p.full_name}</div>
                      <div className="text-slate-400 font-mono text-[11px] flex items-center gap-1 mt-0.5">
                        <Mail className="w-3 h-3 text-indigo-400/60" />
                        <span>{p.email}</span>
                      </div>
                    </td>

                    {/* Plan */}
                    <td className="py-5 px-4">
                      <button
                        type="button"
                        onClick={() => handleTogglePlan?.(p.id, p.subscription_plan)}
                        title={`Click to switch plan (Current: ${p.subscription_plan.toUpperCase()})`}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider font-mono border transition-all hover:scale-105 active:scale-95 cursor-pointer ${
                          p.subscription_plan === "studio"
                            ? "bg-purple-950/80 text-purple-300 border-purple-500/40 hover:border-purple-400 shadow-sm shadow-purple-500/10"
                            : "bg-slate-800/80 text-slate-300 border-slate-700/80 hover:border-slate-500 shadow-sm"
                        }`}
                      >
                        {p.subscription_plan === "studio" && (
                          <Zap className="w-3 h-3 text-purple-400" />
                        )}
                        {p.subscription_plan}
                      </button>
                    </td>

                    {/* Storage */}
                    <td
                      className="py-5 px-4 min-w-[170px] cursor-pointer group"
                      onClick={() => handleEditQuota?.(p.id, p.storage_quota_limit)}
                      title="Click to edit storage allocation"
                    >
                      <div className="flex items-center justify-between text-[11px] text-slate-300 font-mono mb-1">
                        <span>{formatBytes ? formatBytes(p.storage_used) : `${p.storage_used} B`}</span>
                        <span className="text-slate-500 group-hover:text-indigo-400 transition-colors">/ {quotaGb} GB</span>
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
                    <td className="py-5 px-4">
                      <div className="text-slate-200 font-mono text-xs">
                        <strong>{p.total_albums}</strong> <span className="text-slate-400 font-sans">albums</span>
                        <span className="text-slate-600 mx-1">•</span>
                        <strong>{p.total_media}</strong> <span className="text-slate-400 font-sans">media</span>
                      </div>
                      <div className="mt-1">
                        {p.assistants_count > 0 ? (
                          <span
                            title={`Includes data from ${p.assistants_count} studio assistant(s): ${p.assistants?.map((a) => a.full_name).join(", ") || ""}`}
                            className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/25"
                          >
                            <Users className="w-3 h-3 text-amber-400" />
                            <span>Root + {p.assistants_count} Assistant{p.assistants_count > 1 ? "s" : ""}</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500 font-mono">
                            Solo Account
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-5 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                          p.is_active
                            ? "bg-emerald-950/80 text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-500/10"
                            : "bg-red-950/80 text-red-300 border-red-500/40 shadow-sm shadow-red-500/10"
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${
                            p.is_active ? "bg-emerald-500" : "bg-red-500"
                          }`}
                        />
                        {p.is_active ? "Active" : "Suspended"}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-5 px-4 text-right">
                      <div
                        className="relative inline-block text-left"
                        ref={openDropdownId === p.id ? dropdownRef : null}
                      >
                        {/* More Options Button */}
                        <button
                          type="button"
                          id={`photographer-actions-btn-${p.id}`}
                          onClick={() =>
                            setOpenDropdownId(openDropdownId === p.id ? null : p.id)
                          }
                          disabled={isLoading}
                          title="More Options"
                          aria-label="More Options"
                          aria-haspopup="true"
                          aria-expanded={openDropdownId === p.id}
                          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 border border-transparent hover:border-slate-700 transition-colors cursor-pointer"
                        >
                          {isLoading ? (
                            <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                          ) : (
                            <MoreVertical className="w-4 h-4" />
                          )}
                        </button>

                        {/* Dropdown Menu Popover */}
                        {openDropdownId === p.id && (
                          <div
                            id={`actions-dropdown-menu-${p.id}`}
                            role="menu"
                            className={`absolute right-0 w-52 rounded-xl bg-slate-800 border border-slate-700 shadow-2xl shadow-black/80 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 ${
                              isBottomRow ? "bottom-full mb-1.5" : "top-full mt-1.5"
                            }`}
                          >
                            {/* Switch to Basic Tier */}
                            <button
                              type="button"
                              role="menuitem"
                              disabled={p.subscription_plan === "basic"}
                              onClick={() => {
                                setOpenDropdownId(null);
                                if (p.subscription_plan !== "basic") {
                                  handleTogglePlan?.(p.id, p.subscription_plan);
                                }
                              }}
                              className={`flex items-center justify-between w-full px-3.5 py-2 text-xs transition-colors text-left ${
                                p.subscription_plan === "basic"
                                  ? "text-slate-500 cursor-not-allowed bg-slate-800/40"
                                  : "text-slate-200 hover:text-white hover:bg-slate-700/70 cursor-pointer"
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <Layers
                                  className={`w-3.5 h-3.5 shrink-0 ${
                                    p.subscription_plan === "basic"
                                      ? "text-slate-600"
                                      : "text-indigo-400"
                                  }`}
                                />
                                <span>Switch to Basic Tier</span>
                              </div>
                              {p.subscription_plan === "basic" && (
                                <span className="text-[10px] text-slate-500 font-mono">
                                  Current
                                </span>
                              )}
                            </button>

                            {/* Switch to Studio Tier */}
                            <button
                              type="button"
                              role="menuitem"
                              disabled={p.subscription_plan === "studio"}
                              onClick={() => {
                                setOpenDropdownId(null);
                                if (p.subscription_plan !== "studio") {
                                  handleTogglePlan?.(p.id, p.subscription_plan);
                                }
                              }}
                              className={`flex items-center justify-between w-full px-3.5 py-2 text-xs transition-colors text-left ${
                                p.subscription_plan === "studio"
                                  ? "text-slate-500 cursor-not-allowed bg-slate-800/40"
                                  : "text-purple-300 hover:text-purple-200 hover:bg-purple-950/40 cursor-pointer"
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <Zap
                                  className={`w-3.5 h-3.5 shrink-0 ${
                                    p.subscription_plan === "studio"
                                      ? "text-slate-600"
                                      : "text-purple-400"
                                  }`}
                                />
                                <span>Switch to Studio Tier</span>
                              </div>
                              {p.subscription_plan === "studio" && (
                                <span className="text-[10px] text-purple-400/70 font-mono">
                                  Current
                                </span>
                              )}
                            </button>

                            <div className="my-1 border-t border-slate-700/60" />

                            {/* Reset Password */}
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setOpenDropdownId(null);
                                handleResetPassword?.(p.id, p.email);
                              }}
                              className="flex items-center gap-2.5 w-full px-3.5 py-2 text-xs text-slate-200 hover:text-white hover:bg-slate-700/70 transition-colors cursor-pointer text-left"
                            >
                              <KeyRound className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              <span>Reset Password</span>
                            </button>

                            <div className="my-1 border-t border-slate-700/60" />

                            {/* Suspend Account (Power icon, make the text/icon red to indicate danger) */}
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setOpenDropdownId(null);
                                handleToggleSuspend?.(p.id, p.is_active);
                              }}
                              className={`flex items-center gap-2.5 w-full px-3.5 py-2 text-xs transition-colors cursor-pointer text-left font-medium ${
                                p.is_active
                                  ? "text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                  : "text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                              }`}
                            >
                              <Power
                                className={`w-3.5 h-3.5 shrink-0 ${
                                  p.is_active ? "text-red-400" : "text-emerald-400"
                                }`}
                              />
                              <span>
                                {p.is_active ? "Suspend Account" : "Activate Account"}
                              </span>
                            </button>
                          </div>
                        )}
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
