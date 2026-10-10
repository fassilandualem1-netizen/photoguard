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
  Trash2,
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
  handleDeletePhotographer,
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
    <section className="p-6 rounded-2xl bg-white dark:bg-[#0e1320] border border-slate-200 dark:border-slate-800/80 shadow-sm dark:shadow-xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-200 dark:border-slate-800/80">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <span>Directory</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-indigo-50 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700/50">
              {filteredPhotographers.length}
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Manage accounts, quota overrides, and subscription statuses
          </p>
        </div>

        {/* Search Input & Action Button */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          <div className="w-full sm:w-80 relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder="Search by name, email, or plan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery?.(e.target.value)}
              className="w-full bg-slate-50 dark:bg-[#131826] border border-slate-200 dark:border-slate-800 rounded-xl pl-10 pr-3.5 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all"
            />
          </div>

          {onOpenRegisterModal && (
            <button
              type="button"
              id="open-register-photographer-btn"
              onClick={onOpenRegisterModal}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-medium text-xs transition-all shadow-md shadow-indigo-600/30 shrink-0 cursor-pointer active:scale-95"
            >
              <UserPlus className="w-4 h-4" />
              <span>+ Add New Photographer</span>
            </button>
          )}
        </div>
      </div>

      {/* Directory Table */}
      <div className="overflow-x-auto min-h-[360px] pb-48">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800/80 text-slate-500 dark:text-slate-400 font-mono text-[11px] uppercase tracking-wider">
              <th className="py-3.5 px-4">Photographer</th>
              <th className="py-3.5 px-4">Plan Tier</th>
              <th className="py-3.5 px-4">Storage Allocation</th>
              <th className="py-3.5 px-4">Albums & Media</th>
              <th className="py-3.5 px-4">Status</th>
              <th className="py-3.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
            {filteredPhotographers.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-500 dark:text-slate-400">
                  {loading ? "Loading directory..." : "No photographers match the search query."}
                </td>
              </tr>
            ) : (
              filteredPhotographers.map((p, index) => {
                const isBottomRow =
                  filteredPhotographers.length > 5 &&
                  index >= filteredPhotographers.length - 2 &&
                  index >= 3;
                const quotaGb = (p.storage_quota_limit / (1024 * 1024 * 1024)).toFixed(1);
                const usagePercent = Math.min(
                  100,
                  Math.round((p.storage_used / (p.storage_quota_limit || 1)) * 100)
                );
                const isLoading = actionLoadingId === p.id;

                return (
                  <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                    {/* Name & Email */}
                    <td className="py-5 px-4">
                      <div className="font-semibold text-slate-900 dark:text-white">{p.full_name}</div>
                      <div className="text-slate-500 dark:text-slate-400 font-mono text-[11px] flex items-center gap-1.5 mt-0.5">
                        <Mail className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                        <span>{p.email}</span>
                      </div>
                    </td>

                    {/* Plan */}
                    <td className="py-5 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider font-mono border ${
                          p.subscription_plan === "studio"
                            ? "bg-purple-50 dark:bg-[#28133b] text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/60 shadow-sm shadow-purple-500/10"
                            : "bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700/80 shadow-sm"
                        }`}
                      >
                        {p.subscription_plan === "studio" ? (
                          <Zap className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                        ) : (
                          <Layers className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                        )}
                        <span>{p.subscription_plan}</span>
                      </span>
                    </td>

                    {/* Storage */}
                    <td className="py-5 px-4 min-w-[170px]">
                      <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300 font-mono mb-1.5">
                        <span className="font-semibold text-slate-900 dark:text-white">{formatBytes ? formatBytes(p.storage_used) : `${p.storage_used} B`}</span>
                        <span className="text-slate-400 dark:text-slate-500">/ {quotaGb} GB</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
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
                      <div className="text-slate-900 dark:text-white font-mono text-xs">
                        <span>{p.total_albums} albums</span>
                        <span className="text-slate-300 dark:text-slate-600 mx-1.5">•</span>
                        <span>{p.total_media} media</span>
                      </div>
                      <div className="mt-1">
                        {p.assistants_count > 0 ? (
                          <span
                            title={`Includes data from ${p.assistants_count} studio assistant(s): ${p.assistants?.map((a) => a.full_name).join(", ") || ""}`}
                            className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/25"
                          >
                            <Users className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                            <span>Root + {p.assistants_count} Assistant{p.assistants_count > 1 ? "s" : ""}</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                            Root Solo Account
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-5 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
                          p.is_active
                            ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50 shadow-sm shadow-emerald-500/10"
                            : "bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800/50 shadow-sm shadow-red-500/10"
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${
                            p.is_active ? "bg-emerald-500" : "bg-red-500"
                          }`}
                        />
                        <span>{p.is_active ? "Active" : "Suspended"}</span>
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-5 px-4 text-right">
                      <div
                        className="relative inline-block text-left"
                        ref={openDropdownId === p.id ? dropdownRef : null}
                      >
                        {/* Single More Options Button */}
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
                          className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors cursor-pointer"
                        >
                          {isLoading ? (
                            <RefreshCw className="w-4 h-4 animate-spin text-amber-500" />
                          ) : (
                            <MoreVertical className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                          )}
                        </button>

                        {/* Dropdown Menu Popover */}
                        {openDropdownId === p.id && (
                          <div
                            id={`actions-dropdown-menu-${p.id}`}
                            role="menu"
                            className={`absolute right-0 w-64 rounded-xl bg-white dark:bg-[#0f1422] border border-slate-200 dark:border-slate-700/80 shadow-2xl shadow-slate-300/60 dark:shadow-black/90 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 ${
                              isBottomRow ? "bottom-full mb-1.5" : "top-full mt-1.5"
                            }`}
                          >
                            {/* 1. Edit Account details (Plan & Quota) */}
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setOpenDropdownId(null);
                                handleEditQuota?.(p.id, p.storage_quota_limit);
                              }}
                              className="flex items-center gap-2.5 w-full px-4 py-2.5 text-xs text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left cursor-pointer"
                            >
                              <Sliders className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
                              <span className="font-medium">Edit Account details (Plan & Quota)</span>
                            </button>

                            {/* 2. Switch to Basic Tier */}
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setOpenDropdownId(null);
                                if (p.subscription_plan !== "basic") {
                                   handleTogglePlan?.(p.id, p.subscription_plan);
                                }
                              }}
                              className={`flex items-center justify-between w-full px-4 py-2.5 text-xs transition-colors text-left cursor-pointer ${
                                p.subscription_plan === "basic"
                                  ? "text-slate-900 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/50 font-medium"
                                  : "text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <Layers className="w-4 h-4 text-indigo-500 dark:text-indigo-400 shrink-0" />
                                <span>Switch to Basic Tier</span>
                              </div>
                              {p.subscription_plan === "basic" && (
                                <span className="text-[10px] text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-700/50 px-2 py-0.5 rounded font-mono">
                                  Current
                                </span>
                              )}
                            </button>

                            {/* 3. Switch to Studio Tier */}
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setOpenDropdownId(null);
                                if (p.subscription_plan !== "studio") {
                                  handleTogglePlan?.(p.id, p.subscription_plan);
                                }
                              }}
                              className={`flex items-center justify-between w-full px-4 py-2.5 text-xs transition-colors text-left cursor-pointer ${
                                p.subscription_plan === "studio"
                                  ? "text-purple-900 dark:text-purple-200 bg-purple-50 dark:bg-purple-950/40 font-medium"
                                  : "text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <Zap className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                                <span>Switch to Studio Tier</span>
                              </div>
                              {p.subscription_plan === "studio" && (
                                <span className="text-[10px] text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/80 border border-purple-200 dark:border-purple-700/50 px-2 py-0.5 rounded font-mono">
                                  Current
                                </span>
                              )}
                            </button>

                            <div className="my-1 border-t border-slate-200 dark:border-slate-700/60" />

                            {/* 4. Reset Password */}
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setOpenDropdownId(null);
                                handleResetPassword?.(p.id, p.email);
                              }}
                              className="flex items-center gap-2.5 w-full px-4 py-2.5 text-xs text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-left"
                            >
                              <KeyRound className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0" />
                              <span>Reset Password</span>
                            </button>

                            <div className="my-1 border-t border-slate-200 dark:border-slate-700/60" />

                            {/* 5. Suspend Account (Red text/icon) */}
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setOpenDropdownId(null);
                                handleToggleSuspend?.(p.id, p.is_active);
                              }}
                              className="flex items-center gap-2.5 w-full px-4 py-2.5 text-xs text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors cursor-pointer text-left font-medium"
                            >
                              <Power className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0" />
                              <span>
                                {p.is_active ? "Suspend Account" : "Activate Account"}
                              </span>
                            </button>

                            <div className="my-1 border-t border-slate-200 dark:border-slate-700/60" />

                            {/* 6. Delete Photographer (Permanent) */}
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setOpenDropdownId(null);
                                handleDeletePhotographer?.(p.id, p.full_name || p.email);
                              }}
                              className="flex items-center gap-2.5 w-full px-4 py-2.5 text-xs text-rose-600 dark:text-rose-500 hover:text-rose-700 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/15 transition-colors cursor-pointer text-left font-semibold"
                            >
                              <Trash2 className="w-4 h-4 text-rose-600 dark:text-rose-500 shrink-0" />
                              <span>Delete Photographer</span>
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
