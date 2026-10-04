import React, { useState, useEffect } from "react";
import {
  Users,
  UserPlus,
  Trash2,
  Lock,
  Copy,
  Check,
  AlertCircle,
  Loader2,
  KeyRound,
  ShieldCheck,
  Mail,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";

export default function StudioAssistantsView() {
  const { user, isAdmin } = useAuth();

  // Assistant management state
  const [assistants, setAssistants] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // Form state
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [errorMsg, setErrorMsg] = useState(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState(null);

  // Temporary password alert after successful creation
  const [createdAssistant, setCreatedAssistant] = useState(null);
  const [hasCopiedPassword, setHasCopiedPassword] = useState(false);

  // Determine if user has access to Studio Assistants
  const userPlan = String(user?.subscription_plan || user?.plan || "").toLowerCase();
  const hasStudioAccess = userPlan === "studio" || Boolean(isAdmin);

  const fetchAssistants = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const response = await api.get("/api/v1/team/");
      setAssistants(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error("Failed to load studio assistants:", err);
      const detail = err.response?.data?.detail || "Failed to fetch studio team members.";
      setErrorMsg(detail);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (hasStudioAccess) {
      fetchAssistants();
    }
  }, [hasStudioAccess]);

  const handleAddAssistant = async (e) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim()) {
      setErrorMsg("Please enter both the assistant's full name and email.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    setActionSuccessMsg(null);
    setCreatedAssistant(null);
    setHasCopiedPassword(false);

    try {
      const payload = {
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
      };

      const response = await api.post("/api/v1/team/", payload);
      const createdData = response.data;

      setCreatedAssistant(createdData);
      setActionSuccessMsg(`Assistant '${createdData.full_name}' was added successfully.`);
      setFullName("");
      setEmail("");
      fetchAssistants();
    } catch (err) {
      console.error("Failed to add assistant:", err);
      const detail =
        err.response?.data?.detail ||
        (err.response?.status === 403
          ? "Studio Assistants is exclusive to the Studio Plan."
          : "Failed to create assistant account.");
      setErrorMsg(detail);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAssistant = async (id, name) => {
    const isConfirmed = window.confirm(
      `Are you sure you want to remove ${name || "this assistant"} from your studio team? They will immediately lose access.`
    );
    if (!isConfirmed) return;

    setDeletingId(id);
    setErrorMsg(null);
    setActionSuccessMsg(null);

    try {
      await api.delete(`/api/v1/team/${id}`);
      setActionSuccessMsg(`Assistant '${name}' was removed from your team.`);
      if (createdAssistant?.id === id) {
        setCreatedAssistant(null);
      }
      setAssistants((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      console.error("Failed to delete assistant:", err);
      const detail = err.response?.data?.detail || "Failed to remove assistant.";
      setErrorMsg(detail);
    } finally {
      setDeletingId(null);
    }
  };

  const handleCopyPassword = () => {
    if (!createdAssistant?.temporary_password) return;
    navigator.clipboard.writeText(createdAssistant.temporary_password);
    setHasCopiedPassword(true);
    setTimeout(() => setHasCopiedPassword(false), 3000);
  };

  return (
    <div id="studio-assistants-view" className="space-y-6 max-w-5xl">
      {/* Title Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Studio Assistants & Staff
            </h1>
            {hasStudioAccess ? (
              <span className="px-2.5 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20 text-xs font-semibold uppercase tracking-wider">
                Studio Tier
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 text-xs font-mono uppercase tracking-wider">
                Upgrade Required
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Delegate proof gallery management and photo uploads to your team without sharing master credentials.
          </p>
        </div>

        {hasStudioAccess && (
          <button
            type="button"
            onClick={fetchAssistants}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-medium transition-all cursor-pointer self-start sm:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-orange-400" : ""}`} />
            <span>Refresh Staff</span>
          </button>
        )}
      </div>

      {/* Locked State for Non-Studio Users */}
      {!hasStudioAccess ? (
        <div className="p-8 sm:p-12 text-center rounded-2xl border border-slate-800 bg-[#151a23] space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
            <Lock className="w-7 h-7" />
          </div>
          <div className="max-w-md mx-auto space-y-2">
            <h2 className="text-lg font-bold text-white">
              Studio Plan Required
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Studio Assistants is an exclusive feature of the PhotoGuard Studio Plan. Upgrade your account to invite team members, assign upload permissions, and collaborate with staff.
            </p>
          </div>
          <div className="pt-2">
            <a
              href="https://t.me/fassilandualem"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-slate-950 font-semibold text-xs transition-all shadow-md shadow-orange-500/20"
            >
              <Sparkles className="w-4 h-4 stroke-[2.5]" />
              <span>Contact Admin to Upgrade to Studio</span>
            </a>
          </div>
        </div>
      ) : (
        <>
          {/* Status Messages */}
          {errorMsg && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center gap-3">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {actionSuccessMsg && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-3">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{actionSuccessMsg}</span>
            </div>
          )}

          {/* Temporary Password Alert Ribbon */}
          {createdAssistant?.temporary_password && (
            <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 space-y-3 shadow-lg">
              <div className="flex items-center gap-2 font-semibold text-xs text-amber-300">
                <KeyRound className="w-4 h-4 text-amber-400" />
                <span>Temporary Credentials Generated (Copy Now)</span>
              </div>
              <p className="text-xs text-amber-200/90 leading-relaxed">
                A temporary password was generated for <strong className="text-white">{createdAssistant.full_name}</strong> ({createdAssistant.email}).
                For security reasons, this password will not be displayed again. Please copy and provide it to your assistant.
              </p>
              <div className="flex items-center gap-3 pt-1">
                <div className="px-3.5 py-2 rounded-xl bg-black/40 border border-amber-500/30 font-mono text-xs font-bold text-amber-300 select-all tracking-wider">
                  {createdAssistant.temporary_password}
                </div>
                <button
                  type="button"
                  onClick={handleCopyPassword}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-xs transition-colors cursor-pointer shadow-sm"
                >
                  {hasCopiedPassword ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Password</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Invite Assistant Card */}
          <div className="p-6 rounded-2xl bg-[#151a23] border border-slate-800 space-y-4">
            <div className="flex items-center gap-2.5">
              <UserPlus className="w-4 h-4 text-orange-400" />
              <h2 className="text-sm font-semibold text-white">Add Studio Assistant</h2>
            </div>

            <form onSubmit={handleAddAssistant} className="grid grid-cols-1 sm:grid-cols-5 gap-3 pt-1">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Sarah Jenkins"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-orange-500/60 transition-colors"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="assistant@studio.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-orange-500/60 transition-colors"
                />
              </div>

              <div className="sm:col-span-1 flex items-end">
                <button
                  type="submit"
                  disabled={isSubmitting || !fullName.trim() || !email.trim()}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-slate-950 font-semibold text-xs tracking-wide shadow-md shadow-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Adding...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Add</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Active Assistants Table */}
          <div className="p-6 rounded-2xl bg-[#151a23] border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Users className="w-4 h-4 text-orange-400" />
                <h2 className="text-sm font-semibold text-white">Active Studio Assistants</h2>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                {assistants.length} Members
              </span>
            </div>

            {isLoading && assistants.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-500">
                <Loader2 className="w-6 h-6 animate-spin text-orange-400 mb-2" />
                <span className="text-xs">Loading assistant staff...</span>
              </div>
            ) : assistants.length === 0 ? (
              <div className="py-10 text-center rounded-xl border border-slate-800/80 bg-slate-900/30 text-slate-400 text-xs">
                No assistants registered yet. Use the form above to invite your first assistant.
              </div>
            ) : (
              <div className="divide-y divide-slate-800/80 border border-slate-800/80 rounded-xl overflow-hidden bg-slate-900/20">
                {assistants.map((assistant) => (
                  <div
                    key={assistant.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-900/40 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center font-bold text-sm shrink-0">
                        {(assistant.full_name || "A").charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-white truncate">
                            {assistant.full_name || "Studio Assistant"}
                          </span>
                          <span className="text-[10px] font-medium text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700">
                            Assistant
                          </span>
                          {assistant.is_active !== false && (
                            <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                              Active
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                          <Mail className="w-3 h-3 text-slate-500" />
                          <span className="truncate">{assistant.email}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <button
                        type="button"
                        onClick={() => handleDeleteAssistant(assistant.id, assistant.full_name)}
                        disabled={deletingId === assistant.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 hover:border-red-500/30 text-xs font-medium transition-colors disabled:opacity-50 cursor-pointer"
                        title="Remove Assistant"
                      >
                        {deletingId === assistant.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                        <span>Remove</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
