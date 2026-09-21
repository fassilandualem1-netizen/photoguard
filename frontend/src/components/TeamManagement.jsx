import React, { useState, useEffect } from "react";
import api from "../api/axios";
import {
  Users,
  UserPlus,
  Trash2,
  Key,
  Copy,
  Check,
  Shield,
  AlertCircle,
  RefreshCw,
  X,
  Sparkles,
  Lock
} from "lucide-react";

export default function TeamManagement({ isOpen = false, onClose = () => {}, user = {} }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Form states
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [lastCreatedCreds, setLastCreatedCreds] = useState(null);
  const [copied, setCopied] = useState(false);

  const isAssistant = user?.role === "assistant";
  const isStudio = user?.subscription_plan === "studio" || user?.role === "admin";

  const fetchTeamMembers = async () => {
    if (!isOpen || isAssistant || !isStudio) return;
    try {
      setLoading(true);
      setError(null);
      const res = await api.get("/api/v1/team");
      const list = Array.isArray(res?.data) ? res.data : [];
      setMembers(list);
    } catch (err) {
      const msg = err?.response?.data?.detail || "Failed to load team members.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchTeamMembers();
      setLastCreatedCreds(null);
      setSuccessMsg(null);
    }
  }, [isOpen]);

  const handleCreateMember = async (e) => {
    e?.preventDefault?.();
    if (!fullName.trim() || !email.trim()) return;

    try {
      setCreating(true);
      setError(null);
      const payload = {
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        password: password.trim() || undefined
      };
      const res = await api.post("/api/v1/team", payload);
      const newMember = res?.data || {};

      setMembers((prev) => [newMember, ...(Array.isArray(prev) ? prev : [])]);
      if (newMember?.temp_password) {
        setLastCreatedCreds({
          email: newMember.email,
          password: newMember.temp_password
        });
      }
      setFullName("");
      setEmail("");
      setPassword("");
      setSuccessMsg(`Assistant account for "${newMember.full_name || 'Assistant'}" created successfully.`);
    } catch (err) {
      const msg = err?.response?.data?.detail || "Failed to create team member.";
      setError(msg);
    } finally {
      setCreating(false);
    }
  };

  const handleRemoveMember = async (memberId, name) => {
    if (!window.confirm(`Are you sure you want to remove ${name || "this assistant"} from your team?`)) {
      return;
    }
    try {
      await api.delete(`/api/v1/team/${memberId}`);
      setMembers((prev) => (Array.isArray(prev) ? prev.filter((m) => m?.id !== memberId) : []));
      setSuccessMsg("Team member removed successfully.");
    } catch (err) {
      const msg = err?.response?.data?.detail || "Failed to remove team member.";
      setError(msg);
    }
  };

  const copyCreds = () => {
    if (!lastCreatedCreds) return;
    const text = `PhotoGuard Assistant Login:\nEmail: ${lastCreatedCreds.email}\nTemporary Password: ${lastCreatedCreds.password}`;
    navigator?.clipboard?.writeText?.(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl bg-[#111317] border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800/80 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>Studio Team Management</span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-amber-400/10 border border-amber-400/20 text-amber-300">
                  Studio Plan
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Grant assistant photographers upload & monitoring access without master deletion privileges.
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

        {/* Studio Gate */}
        {!isStudio ? (
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 text-center space-y-3">
            <Sparkles className="w-8 h-8 text-amber-400 mx-auto" />
            <h3 className="text-sm font-semibold text-white">Upgrade to Studio Tier</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Team Member accounts are an exclusive feature of the Studio Plan. Add assistant photographers, assign custom sub-logins, and protect your primary billing.
            </p>
          </div>
        ) : (
          <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-1">
            {/* Success Banner */}
            {successMsg && (
              <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
                <span>{successMsg}</span>
                <button type="button" onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Error Banner */}
            {error && (
              <div className="p-3.5 rounded-xl bg-red-950/60 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Temp Password Copy Box */}
            {lastCreatedCreds && (
              <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                    <Key className="w-4 h-4 text-amber-400" />
                    Assistant Login Credentials Generated
                  </span>
                  <button
                    type="button"
                    onClick={copyCreds}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-400 text-slate-950 text-xs font-bold hover:bg-amber-300 transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? "Copied!" : "Copy"}</span>
                  </button>
                </div>
                <div className="font-mono text-xs text-slate-300 bg-slate-950/70 p-2.5 rounded-xl border border-slate-800 select-all space-y-1">
                  <div>Email: <span className="text-white">{lastCreatedCreds.email}</span></div>
                  <div>Password: <span className="text-amber-300 font-bold">{lastCreatedCreds.password}</span></div>
                </div>
                <p className="text-[11px] text-amber-400/80">
                  Save this temporary password now. It will not be shown again in plain text.
                </p>
              </div>
            )}

            {/* Create Member Form */}
            <form onSubmit={handleCreateMember} className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800/80 space-y-3">
              <h4 className="text-xs font-semibold text-white uppercase tracking-wider font-mono">
                Add New Assistant
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Almaz Kebede"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">Assistant Email</label>
                  <input
                    type="email"
                    required
                    placeholder="assistant@studio.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Custom Password <span className="text-slate-500">(Leave empty to auto-generate)</span>
                </label>
                <input
                  type="text"
                  placeholder="Minimum 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-400 font-mono"
                />
              </div>
              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={creating}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold transition-all shadow-md shadow-amber-500/10 disabled:opacity-50"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>{creating ? "Creating Assistant..." : "Add Assistant"}</span>
                </button>
              </div>
            </form>

            {/* Member List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono">
                  Active Assistants ({members?.length || 0})
                </h4>
                <button
                  type="button"
                  onClick={fetchTeamMembers}
                  className="text-slate-400 hover:text-white text-xs p-1"
                  title="Refresh team"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>

              {loading ? (
                <div className="py-6 text-center text-xs text-slate-500">Loading team members...</div>
              ) : (members || []).length === 0 ? (
                <div className="p-6 rounded-2xl border border-slate-800/80 bg-slate-900/20 text-center text-xs text-slate-400">
                  No assistants registered yet. Add team members above to delegate proof uploads safely.
                </div>
              ) : (
                <div className="space-y-2">
                  {(members || []).map((m) => (
                    <div
                      key={m?.id || Math.random()}
                      className="p-3.5 rounded-xl bg-slate-900/50 border border-slate-800/80 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-amber-400 font-bold text-xs">
                          {(m?.full_name || "A")?.charAt(0)?.toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-white truncate">{m?.full_name || "Assistant"}</p>
                          <p className="text-[11px] text-slate-400 truncate">{m?.email || "No email"}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-300 uppercase">
                          {m?.role || "Assistant"}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(m?.id, m?.full_name)}
                          className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-red-950/40 transition-colors"
                          title="Remove Assistant"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
