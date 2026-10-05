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
  KeyRound
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

  useEffect(() => {
    if (hasStudioAccess) {
      fetchAssistants();
      setErrorMsg(null);
      setActionSuccessMsg(null);
      setCreatedAssistant(null);
      setHasCopiedPassword(false);
    }
  }, [hasStudioAccess]);

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

  const handleCopyPassword = async () => {
    if (!createdAssistant?.temporary_password) return;
    try {
      await navigator.clipboard.writeText(createdAssistant.temporary_password);
      setHasCopiedPassword(true);
      setTimeout(() => setHasCopiedPassword(false), 3000);
    } catch (err) {
      console.error("Clipboard error:", err);
      setErrorMsg("Failed to copy password to clipboard. Please select and copy it manually.");
    }
  };

  return (
    <div className="max-w-4xl w-full mx-auto space-y-6">
      {/* Header */}
      <div className="pb-5 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              Studio Assistants & Staff
              {hasStudioAccess && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100">
                  Studio Tier
                </span>
              )}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Manage assistant accounts to help upload photos and manage client albums.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {!hasStudioAccess ? (
          <div className="py-12 px-6 text-center space-y-4 rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="w-12 h-12 mx-auto rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400">
              <Lock className="w-5 h-5" />
            </div>
            <div className="max-w-md mx-auto space-y-1">
              <h3 className="text-base font-semibold text-slate-900">
                Studio Plan Required
              </h3>
              <p className="text-sm text-slate-500">
                Upgrade to the Studio Plan to invite team members and manage assistant accounts.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Left Column: Form & Alerts */}
            <div className="space-y-6">
              
              {/* Feedback Alerts */}
              {errorMsg && (
                <div className="flex items-start gap-2.5 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm shadow-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {actionSuccessMsg && (
                <div className="flex items-start gap-2.5 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm shadow-sm">
                  <Check className="w-4 h-4 flex-shrink-0 text-emerald-500 mt-0.5" />
                  <span>{actionSuccessMsg}</span>
                </div>
              )}

              {/* CRITICAL: Temporary Password Display Alert Box */}
              {createdAssistant && (
                <div className="relative p-5 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 space-y-3 shadow-sm">
                  <div className="flex items-start gap-3">
                    <KeyRound className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-bold text-amber-800 flex items-center gap-1.5">
                        New Assistant Credentials Generated!
                      </h4>
                      <p className="text-xs text-amber-700 mt-1">
                        Please copy and share this temporary password with <strong className="font-semibold">{createdAssistant.full_name}</strong> ({createdAssistant.email}). It will <span className="font-bold underline">not be shown again</span>.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 bg-white border border-amber-200 rounded-lg p-2.5 pl-3">
                    <code className="flex-1 font-mono text-base font-bold text-slate-900 tracking-wider select-all">
                      {createdAssistant.temporary_password}
                    </code>
                    <button
                      type="button"
                      onClick={handleCopyPassword}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-500 text-white font-semibold text-xs hover:bg-amber-600 transition-colors shadow-sm"
                    >
                      {hasCopiedPassword ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Add Assistant Form */}
              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-bold text-indigo-600 tracking-tight flex items-center gap-2">
                    <UserPlus className="w-4 h-4" />
                    Add New Assistant
                  </h3>
                  <span className="text-xs text-slate-500 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200">
                    {assistants.length} of 3 slots used
                  </span>
                </div>

                <form onSubmit={handleAddAssistant} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Full Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Abeba Zeleke"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      disabled={isSubmitting || assistants.length >= 3}
                      required
                      className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-white border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-sm disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Email Address
                    </label>
                    <input
                      type="email"
                      placeholder="abeba@gmail.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isSubmitting || assistants.length >= 3}
                      required
                      className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-white border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-sm disabled:opacity-50"
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isSubmitting || assistants.length >= 3}
                      className="w-full inline-flex justify-center items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Adding Assistant...</span>
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-4 h-4" />
                          <span>Add Assistant</span>
                        </>
                      )}
                    </button>
                    <p className="text-[11px] text-slate-500 text-center mt-3">
                      An 8-character password will be auto-generated securely.
                    </p>
                  </div>
                </form>
              </div>
            </div>

            {/* Right Column: Assistants List */}
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col h-full">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <h3 className="text-sm font-bold text-slate-800 tracking-tight">
                  Current Staff ({assistants.length})
                </h3>
                {isLoading && (
                  <div className="flex items-center gap-1.5 text-xs text-indigo-600">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Loading...</span>
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto min-h-[200px]">
                {assistants.length === 0 && !isLoading ? (
                  <div className="h-full flex flex-col items-center justify-center p-6 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
                    <Users className="w-8 h-8 text-slate-300 mb-2" />
                    <p className="text-sm font-medium text-slate-600">No studio assistants</p>
                    <p className="text-xs text-slate-500 mt-1">Add up to 3 staff members using the form.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {assistants.map((asst) => (
                      <div
                        key={asst.id}
                        className="flex items-center justify-between p-3.5 rounded-xl bg-white border border-slate-200 shadow-sm hover:border-indigo-200 hover:shadow-md transition-all group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 shrink-0 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center font-bold text-indigo-600 text-sm uppercase">
                            {asst.full_name?.charAt(0) || "A"}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-900 flex items-center gap-2 truncate">
                              <span className="truncate">{asst.full_name}</span>
                              <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                Staff
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 truncate mt-0.5">
                              {asst.email}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteAssistant(asst.id, asst.full_name)}
                          disabled={deletingId === asst.id}
                          className="shrink-0 p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 opacity-0 group-hover:opacity-100 focus:opacity-100"
                          title="Remove Assistant"
                        >
                          {deletingId === asst.id ? (
                            <Loader2 className="w-4 h-4 animate-spin text-red-500" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}

