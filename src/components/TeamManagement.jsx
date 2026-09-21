import React, { useState, useEffect } from "react";
import api from "../api/axios";
import {
  Users,
  UserPlus,
  Trash2,
  Copy,
  Check,
  Shield,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Loader2,
  X,
  Lock,
  Mail,
  User,
  Sparkles,
  Info,
} from "lucide-react";

export default function TeamManagement({ isOpen, onClose, currentUser }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [createdCredentials, setCreatedCredentials] = useState(null);
  const [copiedCreds, setCopiedCreds] = useState(false);

  // Form State
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const isStudio =
    currentUser?.subscription_plan === "studio" ||
    currentUser?.plan === "studio" ||
    currentUser?.role === "admin";

  const fetchMembers = async () => {
    if (!isStudio) return;
    try {
      setLoading(true);
      setError(null);
      const res = await api.get("/api/v1/team");
      setMembers(res.data || []);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to load team members.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && isStudio) {
      fetchMembers();
    }
  }, [isOpen, isStudio]);

  if (!isOpen) return null;

  const handleAddMember = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setCreatedCredentials(null);

    if (!fullName.trim() || !email.trim()) {
      setError("Please provide both full name and email address.");
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        full_name: fullName.trim(),
        email: email.trim(),
        password: password.trim() || undefined,
      };
      const res = await api.post("/api/v1/team", payload);
      setSuccessMsg(`Assistant account for "${res.data.full_name}" created successfully!`);
      if (res.data.temp_password) {
        setCreatedCredentials({
          email: res.data.email,
          password: res.data.temp_password,
        });
      }
      setFullName("");
      setEmail("");
      setPassword("");
      fetchMembers();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to create assistant account.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveMember = async (memberId, memberName) => {
    if (!window.confirm(`Are you sure you want to remove assistant "${memberName}"?`)) {
      return;
    }
    try {
      await api.delete(`/api/v1/team/${memberId}`);
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
      setSuccessMsg(`Assistant "${memberName}" was removed from your team.`);
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to remove team member.");
    }
  };

  const handleCopyCredentials = async () => {
    if (!createdCredentials) return;
    const text = `PhotoGuard Assistant Credentials:\nLogin: ${createdCredentials.email}\nPassword: ${createdCredentials.password}\nLogin URL: ${window.location.origin}/login`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCreds(true);
      setTimeout(() => setCopiedCreds(false), 2500);
    } catch {
      console.warn("Clipboard failed");
    }
  };

  return (
    <div
      id="team-management-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in"
      onClick={onClose}
    >
      <div
        id="team-management-modal-dialog"
        className="w-full max-w-2xl rounded-3xl border border-slate-800 bg-[#10141d] shadow-2xl shadow-black/90 p-6 sm:p-8 space-y-6 animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-500/5">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  Studio Team Management
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-semibold uppercase tracking-wider">
                  Studio Plan
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Grant dedicated assistant access for photo uploads and client proof reviews.
              </p>
            </div>
          </div>
          <button
            id="close-team-modal-btn"
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!isStudio ? (
          /* Non-Studio Upgrade Notice */
          <div className="p-8 rounded-2xl border border-amber-500/30 bg-gradient-to-b from-amber-500/10 to-transparent text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-400/20 border border-amber-400/40 text-amber-400 flex items-center justify-center mx-auto">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Studio Plan Feature</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto mt-1 leading-relaxed">
                Team Role-Based Access Control (RBAC) allows you to delegate proof uploading and selection reviews to assistants while keeping deletion controls and billing completely secure.
              </p>
            </div>
            <div className="pt-2">
              <a
                href="https://t.me/fassilandualem"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold transition-all shadow-lg shadow-amber-500/20"
              >
                <span>Upgrade to Studio Plan</span>
              </a>
            </div>
          </div>
        ) : (
          <>
            {/* RBAC Rules Callout */}
            <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 text-xs text-slate-300 flex items-start gap-3">
              <Shield className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-white">Role-Based Security Enforcement (RBAC):</p>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Assistants can upload raw photo proofs, monitor client selections, and upload final edited deliverables. Assistants are strictly barred from deleting albums, deleting photos, or altering studio ownership settings.
                </p>
              </div>
            </div>

            {/* Success & Error Feedback */}
            {successMsg && (
              <div className="p-3.5 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2.5 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {error && (
              <div className="p-3.5 rounded-2xl bg-red-950/60 border border-red-500/40 text-red-300 text-xs flex items-center gap-2.5 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Instant Credentials Banner */}
            {createdCredentials && (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 space-y-2.5 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-white">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>New Assistant Credentials Generated</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyCredentials}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-400 text-slate-950 text-xs font-semibold hover:bg-amber-300 transition-colors cursor-pointer"
                  >
                    {copiedCreds ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCreds ? "Copied!" : "Copy Login Info"}</span>
                  </button>
                </div>
                <div className="p-3 rounded-xl bg-black/50 border border-amber-500/20 font-mono text-xs space-y-1 text-slate-300">
                  <p>
                    <span className="text-slate-500">Email:</span>{" "}
                    <span className="text-white font-semibold">{createdCredentials.email}</span>
                  </p>
                  <p>
                    <span className="text-slate-500">Temporary Password:</span>{" "}
                    <span className="text-amber-400 font-bold">{createdCredentials.password}</span>
                  </p>
                </div>
                <p className="text-[11px] text-amber-300/80">
                  Share these credentials with your assistant. They can log in directly at the standard PhotoGuard login page.
                </p>
              </div>
            )}

            {/* Add Assistant Form */}
            <form onSubmit={handleAddMember} className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-amber-400" />
                <span>Add New Assistant</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-400">Full Name</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="e.g. Dawit Tadesse"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-400">Email Address</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      placeholder="assistant@studio.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-400">
                  Password <span className="text-slate-600 font-normal">(Leave empty to auto-generate secure PIN)</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Optional initial password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  id="create-assistant-submit-btn"
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 text-xs font-bold transition-all shadow-md shadow-amber-500/10"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <UserPlus className="w-4 h-4" />
                  )}
                  <span>{submitting ? "Creating Assistant..." : "Add Assistant"}</span>
                </button>
              </div>
            </form>

            {/* Existing Assistants List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Active Team Members ({members.length})
                </h3>
              </div>

              {loading ? (
                <div className="py-8 text-center text-slate-500 text-xs flex flex-col items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
                  <span>Loading team members...</span>
                </div>
              ) : members.length === 0 ? (
                <div className="p-6 rounded-2xl bg-slate-900/30 border border-slate-800 text-center text-slate-500 text-xs">
                  No assistants added yet. Add an assistant above to give team members restricted proofing access.
                </div>
              ) : (
                <div className="space-y-2">
                  {members.map((member) => (
                    <div
                      key={member.id}
                      className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center justify-between gap-3 hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300 font-semibold text-xs uppercase">
                          {member.full_name?.slice(0, 2) || "AS"}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-semibold text-white">{member.full_name}</p>
                            <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[10px] text-slate-300 capitalize">
                              {member.role}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500">{member.email}</p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveMember(member.id, member.full_name)}
                        className="p-2 rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-950/40 border border-transparent hover:border-red-800/60 transition-all"
                        title="Remove Assistant"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
