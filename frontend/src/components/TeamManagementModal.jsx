import React, { useState, useEffect } from "react";
import {
  X,
  Users,
  UserPlus,
  Trash2,
  Lock,
  Copy,
  Check,
  AlertCircle,
  Loader2,
  Sparkles,
  KeyRound
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";

export default function TeamManagementModal({ isOpen, onClose }) {
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

  // Fetch team members when modal opens and user has access
  useEffect(() => {
    if (isOpen && hasStudioAccess) {
      fetchAssistants();
      setErrorMsg(null);
      setActionSuccessMsg(null);
      setCreatedAssistant(null);
      setHasCopiedPassword(false);
    }
  }, [isOpen, hasStudioAccess]);

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

      // Store created assistant data including temporary_password
      setCreatedAssistant(createdData);
      setActionSuccessMsg(`Assistant '${createdData.full_name}' was added successfully.`);
      setFullName("");
      setEmail("");

      // Refresh team list
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
      // If the currently viewed temp password belongs to the deleted user, clear it
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

  if (!isOpen) return null;

  return (
    <div
      id="team-management-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div
        id="team-management-modal"
        className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-400/10 border border-amber-400/20 text-amber-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                Studio Assistants & Staff
                {hasStudioAccess && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-400 border border-amber-400/20">
                    Studio Tier
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400">
                Manage assistant accounts to help upload photos and manage client albums.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Locked State for Non-Studio Users */}
          {!hasStudioAccess ? (
            <div className="py-8 px-6 text-center space-y-4 rounded-xl border border-amber-400/20 bg-amber-400/5">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-400 shadow-inner">
                <Lock className="w-7 h-7" />
              </div>
              <div className="max-w-md mx-auto space-y-2">
                <h3 className="text-lg font-bold text-slate-100">
                  Studio Assistants is a Studio Exclusive
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Delegate client communication, album management, and high-speed uploads to your team members without sharing your master credentials. Assistants consume your studio quota automatically.
                </p>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full sm:w-auto px-4 py-2 text-xs font-medium rounded-lg text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
                >
                  Close
                </button>
                <a
                  href="#upgrade"
                  onClick={(e) => {
                    e.preventDefault();
                    onClose();
                    const upgradeBtn = document.getElementById("upgrade-to-studio-btn");
                    if (upgradeBtn) upgradeBtn.click();
                  }}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2 text-xs font-semibold rounded-lg bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 hover:from-amber-300 hover:to-amber-400 shadow-md shadow-amber-500/20 transition-all"
                >
                  <Sparkles className="w-4 h-4 text-slate-950" />
                  Upgrade to Studio Plan
                </a>
              </div>
            </div>
          ) : (
            <>
              {/* Feedback Alerts */}
              {errorMsg && (
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {actionSuccessMsg && (
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs">
                  <Check className="w-4 h-4 flex-shrink-0 text-emerald-400" />
                  <span>{actionSuccessMsg}</span>
                </div>
              )}

              {/* CRITICAL: Temporary Password Display Alert Box */}
              {createdAssistant && (
                <div
                  id="temporary-password-alert"
                  className="relative p-4 rounded-xl border border-amber-400/40 bg-gradient-to-br from-amber-400/10 via-amber-400/5 to-transparent text-slate-100 space-y-3 shadow-lg shadow-amber-500/5 animate-in slide-in-from-top-2 duration-300"
                >
                  <div className="flex items-start gap-2.5">
                    <KeyRound className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-bold text-amber-400 flex items-center gap-1.5">
                        New Assistant Credentials Generated!
                      </h4>
                      <p className="text-xs text-slate-300 mt-0.5">
                        Please copy and share this temporary password with <strong className="text-white">{createdAssistant.full_name}</strong> ({createdAssistant.email}). It will <span className="text-amber-300 font-semibold underline">not be shown again</span>.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 bg-slate-950/80 border border-amber-400/30 rounded-lg p-2.5 pl-3">
                    <code className="flex-1 font-mono text-base font-bold text-amber-300 tracking-wider select-all">
                      {createdAssistant.temporary_password}
                    </code>
                    <button
                      type="button"
                      onClick={handleCopyPassword}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-400 text-slate-950 font-semibold text-xs hover:bg-amber-300 transition-colors shadow-sm"
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

              {/* Add Assistant Form */}
              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-amber-400" />
                    Add New Assistant
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    {assistants.length} of 5 slots used
                  </span>
                </div>

                <form onSubmit={handleAddAssistant} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">
                        Full Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Sara Jenkins"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        disabled={isSubmitting || assistants.length >= 5}
                        required
                        className="w-full px-3 py-2 text-xs rounded-lg bg-slate-900 border border-slate-700/80 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400 transition-colors disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">
                        Email Address
                      </label>
                      <input
                        type="email"
                        placeholder="sara@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={isSubmitting || assistants.length >= 5}
                        required
                        className="w-full px-3 py-2 text-xs rounded-lg bg-slate-900 border border-slate-700/80 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400 transition-colors disabled:opacity-50"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <p className="text-[11px] text-slate-500">
                      An 8-character password will be auto-generated and hashed securely.
                    </p>
                    <button
                      type="submit"
                      disabled={isSubmitting || assistants.length >= 5}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-xs shadow-md shadow-amber-400/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Adding...</span>
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>Add Assistant</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>

              {/* Assistants List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                    Current Staff ({assistants.length})
                  </h3>
                  {isLoading && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                      <span>Loading...</span>
                    </div>
                  )}
                </div>

                {assistants.length === 0 && !isLoading ? (
                  <div className="p-6 text-center rounded-xl bg-slate-900/50 border border-slate-800/60 text-slate-500 text-xs">
                    No studio assistants added yet. Add up to 5 staff members above.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {assistants.map((asst) => (
                      <div
                        key={asst.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-slate-800/30 border border-slate-800 hover:border-slate-700/80 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-700/60 border border-slate-600 flex items-center justify-center font-bold text-amber-400 text-xs uppercase">
                            {asst.full_name?.charAt(0) || "A"}
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-slate-200 flex items-center gap-2">
                              <span>{asst.full_name}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                                Staff
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              {asst.email}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteAssistant(asst.id, asst.full_name)}
                          disabled={deletingId === asst.id}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                          title="Remove Assistant"
                        >
                          {deletingId === asst.id ? (
                            <Loader2 className="w-4 h-4 animate-spin text-red-400" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-800/80 bg-slate-900/90 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium rounded-lg text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
