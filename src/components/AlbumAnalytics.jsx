import React, { useState } from "react";
import api from "../api/axios";
import {
  Eye,
  Clock,
  Send,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Calendar
} from "lucide-react";

export default function AlbumAnalytics({ album = {}, user = {}, onReminderSent = () => {} }) {
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const isStudio = user?.subscription_plan === "studio" || user?.role === "admin";
  const viewCount = Number(album?.view_count || 0);
  const lastViewedAt = album?.last_viewed_at;
  const reminderSentAt = album?.reminder_sent_at;

  const handleSendReminder = async () => {
    if (!album?.id) return;
    try {
      setSending(true);
      setFeedback(null);
      const res = await api.post(`/api/v1/albums/${album.id}/send-reminder`);
      setFeedback({ type: "success", message: res?.data?.message || "Reminder sent to client!" });
      onReminderSent();
    } catch (err) {
      const msg = err?.response?.data?.detail || "Failed to send selection reminder.";
      setFeedback({ type: "error", message: msg });
    } finally {
      setSending(false);
    }
  };

  const formatDate = (isoStr) => {
    if (!isoStr) return "Never";
    try {
      return new Date(isoStr).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return "Unknown";
    }
  };

  return (
    <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800/90 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-white uppercase tracking-wider font-mono flex items-center gap-2">
          <Eye className="w-3.5 h-3.5 text-amber-400" />
          <span>Client Engagement Analytics</span>
        </h4>
        {isStudio && (
          <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-amber-400/10 border border-amber-400/20 text-amber-300">
            Studio
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
          <span className="text-[11px] text-slate-400 block mb-0.5">Total Client Views</span>
          <span className="text-base font-bold font-mono text-white">{viewCount}</span>
        </div>

        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
          <span className="text-[11px] text-slate-400 block mb-0.5">Last Viewed</span>
          <span className="text-xs font-medium text-slate-200">{formatDate(lastViewedAt)}</span>
        </div>

        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 col-span-2 sm:col-span-1">
          <span className="text-[11px] text-slate-400 block mb-0.5">Last Reminder Sent</span>
          <span className="text-xs font-medium text-slate-200">{formatDate(reminderSentAt)}</span>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-2.5 rounded-xl text-xs flex items-center gap-2 ${
            feedback.type === "success"
              ? "bg-emerald-950/60 border border-emerald-500/30 text-emerald-300"
              : "bg-red-950/60 border border-red-500/30 text-red-300"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {isStudio && !album?.is_locked && (
        <div className="pt-1 flex justify-end">
          <button
            type="button"
            onClick={handleSendReminder}
            disabled={sending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold transition-all shadow-md shadow-amber-500/10 disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{sending ? "Sending..." : "Send Selection Reminder"}</span>
          </button>
        </div>
      )}
    </div>
  );
}
