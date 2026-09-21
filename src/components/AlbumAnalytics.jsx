import React, { useState } from "react";
import api from "../api/axios";
import {
  BarChart3,
  Eye,
  Clock,
  Calendar,
  BellRing,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  Send,
  X,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";

export default function AlbumAnalytics({
  isOpen,
  onClose,
  album,
  onReminderSent,
  onExtendExpiration,
  isStudio = false,
}) {
  const [reminding, setReminding] = useState(false);
  const [reminderMessage, setReminderMessage] = useState(null);
  const [reminderError, setReminderError] = useState(null);

  if (!isOpen || !album) return null;

  const viewCount = album.view_count || 0;
  const lastViewed = album.last_viewed_at
    ? new Date(album.last_viewed_at).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Never viewed yet";

  const lastReminder = album.reminder_sent_at
    ? new Date(album.reminder_sent_at).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "No reminder sent yet";

  const totalPhotos = album.media_count || album.photo_count || (album.media_items?.length || 0);
  const selectedPhotos = album.selected_count || 0;
  const selectionPercentage =
    totalPhotos > 0 ? Math.min(100, Math.round((selectedPhotos / totalPhotos) * 100)) : 0;

  const calculateDaysLeft = (expiresAt) => {
    if (!expiresAt) return null;
    const diff = new Date(expiresAt).getTime() - new Date().getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 0;
  };

  const daysLeft = calculateDaysLeft(album.expires_at);
  const isExpired = album.is_expired || (daysLeft !== null && daysLeft === 0);
  const isSubmitted = album.is_locked || album.status === "submitted";

  const handleSendReminder = async () => {
    try {
      setReminding(true);
      setReminderMessage(null);
      setReminderError(null);
      const res = await api.post(`/api/v1/albums/${album.id}/remind`);
      setReminderMessage(res.data?.message || "Reminder sent to client successfully!");
      if (typeof onReminderSent === "function") {
        onReminderSent(res.data?.reminder_sent_at || new Date().toISOString());
      }
    } catch (err) {
      const msg = err.response?.data?.detail || "Failed to dispatch reminder. Please try again.";
      setReminderError(msg);
    } finally {
      setReminding(false);
    }
  };

  return (
    <div
      id="album-analytics-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in"
      onClick={onClose}
    >
      <div
        id="album-analytics-modal-dialog"
        className="w-full max-w-2xl rounded-3xl border border-slate-800 bg-[#10141d] shadow-2xl shadow-black/90 p-6 sm:p-8 space-y-6 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-500/5">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                Gallery Analytics & Activity Tracker
              </h2>
              <p className="text-xs text-slate-400">
                Live metrics for <span className="text-slate-200 font-semibold">{album.title}</span> ({album.client_name})
              </p>
            </div>
          </div>
          <button
            id="close-analytics-btn"
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback Alert for Reminders */}
        {reminderMessage && (
          <div className="p-3.5 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2.5 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{reminderMessage}</span>
          </div>
        )}

        {reminderError && (
          <div className="p-3.5 rounded-2xl bg-red-950/60 border border-red-500/40 text-red-300 text-xs flex items-center gap-2.5 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{reminderError}</span>
          </div>
        )}

        {/* Metric Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* View Count Card */}
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 shrink-0">
              <Eye className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400">Total Client Views</p>
              <p className="text-2xl font-bold font-mono text-white mt-0.5">
                {viewCount}{" "}
                <span className="text-xs font-normal text-slate-500">
                  {viewCount === 1 ? "session" : "sessions"}
                </span>
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Last viewed: <span className="text-slate-400">{lastViewed}</span>
              </p>
            </div>
          </div>

          {/* Selection Progress Card */}
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
                <TrendingUp className="w-4 h-4 text-amber-400" />
                <span>Selection Progress</span>
              </div>
              <span className="text-xs font-mono font-bold text-amber-400">
                {selectionPercentage}%
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden mb-2">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-500"
                style={{ width: `${selectionPercentage}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>
                <strong className="text-white font-mono">{selectedPhotos}</strong> of{" "}
                <strong className="text-white font-mono">{totalPhotos}</strong> selected
              </span>
              <span
                className={`font-semibold ${
                  isSubmitted ? "text-amber-400" : "text-emerald-400"
                }`}
              >
                {isSubmitted ? "Finalized" : "In Review"}
              </span>
            </div>
          </div>

          {/* Expiration Countdown Card */}
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
              <Clock className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium text-slate-400">Lifespan & Expiration</p>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-xl font-bold font-mono text-white">
                  {daysLeft !== null ? (isExpired ? "Expired" : `${daysLeft} Days`) : "Permanent"}
                </span>
                {daysLeft !== null && !isExpired && (
                  <span className="text-xs text-purple-400 font-medium">remaining</span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Expires on:{" "}
                <span className="text-slate-400">
                  {album.expires_at
                    ? new Date(album.expires_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "Never"}
                </span>
              </p>
            </div>
          </div>

          {/* Reminder Status Card */}
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
              <BellRing className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400">Automated Client Reminders</p>
              <p className="text-sm font-semibold text-white mt-1">
                {album.reminder_sent_at ? "Reminder Dispatched" : "Pending Client Action"}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Last sent: <span className="text-slate-400">{lastReminder}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-0.5 text-left w-full sm:w-auto">
            <p className="text-xs font-semibold text-white flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Direct Client Notification Engine</span>
            </p>
            <p className="text-[11px] text-slate-400">
              Dispatches an instant selection reminder via connected Telegram/WhatsApp channels.
            </p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            {isStudio && typeof onExtendExpiration === "function" && (
              <button
                type="button"
                onClick={onExtendExpiration}
                className="px-4 py-2.5 rounded-xl border border-amber-500/30 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 font-semibold text-xs transition-all"
              >
                +7 Days Lifespan
              </button>
            )}

            <button
              id="analytics-send-reminder-btn"
              type="button"
              onClick={handleSendReminder}
              disabled={reminding || isSubmitted}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed text-slate-950 font-semibold text-xs transition-all shadow-md shadow-amber-500/10"
            >
              {reminding ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              <span>{reminding ? "Dispatching..." : "Send Client Reminder"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
