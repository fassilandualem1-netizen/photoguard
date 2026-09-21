import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import {
  BarChart3,
  Eye,
  BellRing,
  Clock,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Send,
  X,
  ExternalLink,
  Sparkles,
  Lock,
} from "lucide-react";

export default function StudioAnalyticsModal({ isOpen, onClose, defaultTab = "analytics" }) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [albums, setAlbums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [remindingAlbumId, setRemindingAlbumId] = useState(null);
  const [reminderFeedback, setReminderFeedback] = useState({});

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  const fetchAlbums = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get("/api/v1/albums");
      setAlbums(res.data || []);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to load studio albums.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchAlbums();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Aggregate stats
  const totalAlbums = albums.length;
  const totalViews = albums.reduce((acc, a) => acc + (a.view_count || 0), 0);
  const totalPhotos = albums.reduce((acc, a) => acc + (a.media_count || 0), 0);
  const totalSelections = albums.reduce((acc, a) => acc + (a.selected_count || 0), 0);
  const submittedAlbums = albums.filter((a) => a.is_locked || a.status === "submitted").length;
  const pendingAlbums = albums.filter((a) => !a.is_locked && a.status !== "submitted");

  const handleSendReminder = async (albumId, clientName) => {
    try {
      setRemindingAlbumId(albumId);
      const res = await api.post(`/api/v1/albums/${albumId}/remind`);
      setReminderFeedback((prev) => ({
        ...prev,
        [albumId]: { success: true, message: `Reminder sent to ${clientName}!` },
      }));
      // Update album in state
      setAlbums((prev) =>
        prev.map((alb) =>
          alb.id === albumId ? { ...alb, reminder_sent_at: res.data?.reminder_sent_at || new Date().toISOString() } : alb
        )
      );
    } catch (err) {
      setReminderFeedback((prev) => ({
        ...prev,
        [albumId]: { success: false, message: err.response?.data?.detail || "Failed to send reminder." },
      }));
    } finally {
      setRemindingAlbumId(null);
    }
  };

  return (
    <div
      id="studio-analytics-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in"
      onClick={onClose}
    >
      <div
        id="studio-analytics-modal-dialog"
        className="w-full max-w-3xl rounded-3xl border border-slate-800 bg-[#10141d] shadow-2xl shadow-black/90 p-6 sm:p-8 space-y-6 animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-500/5">
              {activeTab === "reminders" ? <BellRing className="w-5 h-5" /> : <BarChart3 className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  {activeTab === "reminders" ? "Automated Client Reminders" : "Studio Performance & Analytics"}
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-semibold uppercase tracking-wider">
                  Studio Plan
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Real-time engagement metrics, client view tracking, and automated reminder broadcasts.
              </p>
            </div>
          </div>
          <button
            id="close-studio-analytics-btn"
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Toggle */}
        <div className="flex items-center gap-2 p-1 rounded-2xl bg-slate-900/80 border border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab("analytics")}
            className={`flex-1 py-2 px-4 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
              activeTab === "analytics"
                ? "bg-amber-400 text-slate-950 shadow-md shadow-amber-500/10"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Studio Analytics</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("reminders")}
            className={`flex-1 py-2 px-4 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
              activeTab === "reminders"
                ? "bg-amber-400 text-slate-950 shadow-md shadow-amber-500/10"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <BellRing className="w-4 h-4" />
            <span>Automated Reminders ({pendingAlbums.length})</span>
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-500 text-xs flex flex-col items-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
            <span>Aggregating studio telemetry...</span>
          </div>
        ) : error ? (
          <div className="p-4 rounded-2xl bg-red-950/60 border border-red-500/40 text-red-300 text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <span>{error}</span>
          </div>
        ) : activeTab === "analytics" ? (
          /* Studio Analytics Dashboard */
          <div className="space-y-6">
            {/* Overview Stat Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
                <p className="text-[11px] text-slate-400">Total Galleries</p>
                <p className="text-2xl font-bold font-mono text-white mt-1">{totalAlbums}</p>
                <p className="text-[10px] text-slate-500 mt-1">{submittedAlbums} finalized</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
                <p className="text-[11px] text-slate-400">Total Client Views</p>
                <p className="text-2xl font-bold font-mono text-sky-400 mt-1">{totalViews}</p>
                <p className="text-[10px] text-slate-500 mt-1">Verified sessions</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
                <p className="text-[11px] text-slate-400">Client Selections</p>
                <p className="text-2xl font-bold font-mono text-amber-400 mt-1">{totalSelections}</p>
                <p className="text-[10px] text-slate-500 mt-1">From {totalPhotos} proofs</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
                <p className="text-[11px] text-slate-400">Pending Selection</p>
                <p className="text-2xl font-bold font-mono text-emerald-400 mt-1">{pendingAlbums.length}</p>
                <p className="text-[10px] text-slate-500 mt-1">Galleries in review</p>
              </div>
            </div>

            {/* Gallery Performance Breakdown */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Gallery Engagement Breakdown
              </h3>
              <div className="space-y-2">
                {albums.map((album) => {
                  const mediaCount = album.media_count || 0;
                  const selectedCount = album.selected_count || 0;
                  const pct = mediaCount > 0 ? Math.round((selectedCount / mediaCount) * 100) : 0;
                  return (
                    <div
                      key={album.id}
                      className="p-3.5 rounded-2xl bg-slate-900/50 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-white truncate">{album.title}</p>
                          <span className="font-mono text-[11px] text-amber-400">PIN: {album.pin}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Client: <span className="text-slate-300 font-medium">{album.client_name}</span>
                        </p>
                      </div>

                      <div className="flex items-center gap-4 text-xs font-mono text-slate-400 shrink-0">
                        <span className="flex items-center gap-1">
                          <Eye className="w-3.5 h-3.5 text-sky-400" />
                          <strong className="text-white">{album.view_count || 0}</strong> views
                        </span>
                        <span className="flex items-center gap-1">
                          <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                          <strong className="text-white">{selectedCount}/{mediaCount}</strong> ({pct}%)
                        </span>
                        <Link
                          to={`/dashboard/albums/${album.id}`}
                          onClick={onClose}
                          className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                          title="Open Gallery"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          /* Automated Reminders View */
          <div className="space-y-4">
            <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 text-xs text-slate-300 flex items-start gap-3">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Send 1-click reminders to clients who have not yet submitted their photo selections.
                Reminders dispatch notifications via configured Telegram bots and record reminder timestamps on the album.
              </p>
            </div>

            <div className="space-y-2">
              {pendingAlbums.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs rounded-2xl bg-slate-900/30 border border-slate-800">
                  All client galleries are currently finalized and locked. No pending selections!
                </div>
              ) : (
                pendingAlbums.map((album) => {
                  const fb = reminderFeedback[album.id];
                  const isReminding = remindingAlbumId === album.id;
                  const lastReminder = album.reminder_sent_at
                    ? new Date(album.reminder_sent_at).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "Never";

                  return (
                    <div
                      key={album.id}
                      className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-bold text-white">{album.title}</p>
                            <span className="font-mono text-[11px] text-amber-400">PIN: {album.pin}</span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Client: <span className="text-slate-300 font-medium">{album.client_name}</span> • Selected:{" "}
                            <span className="text-amber-400 font-mono font-semibold">
                              {album.selected_count || 0}
                            </span>{" "}
                            of {album.media_count || 0}
                          </p>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            Last Reminder: <span className="text-slate-400">{lastReminder}</span> • Views:{" "}
                            <span className="text-slate-400">{album.view_count || 0}</span>
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleSendReminder(album.id, album.client_name)}
                          disabled={isReminding}
                          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 font-semibold text-xs transition-all shadow-md shadow-amber-500/10 cursor-pointer shrink-0"
                        >
                          {isReminding ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Send className="w-3.5 h-3.5" />
                          )}
                          <span>{isReminding ? "Sending..." : "Send Reminder"}</span>
                        </button>
                      </div>

                      {fb && (
                        <div
                          className={`p-2 rounded-xl text-xs flex items-center gap-2 ${
                            fb.success
                              ? "bg-emerald-950/60 text-emerald-300 border border-emerald-500/30"
                              : "bg-red-950/60 text-red-300 border border-red-500/30"
                          }`}
                        >
                          {fb.success ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                          )}
                          <span>{fb.message}</span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
