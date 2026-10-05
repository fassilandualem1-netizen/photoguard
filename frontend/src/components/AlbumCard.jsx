import React from "react";
import { Link } from "react-router-dom";
import {
  Image as ImageIcon,
  Clock,
  CheckCircle2,
  Trash2,
  Crown,
  UserCheck,
} from "lucide-react";

export default function AlbumCard({ album, onDelete, isDeleting = false }) {
  if (!album) return null;

  const calculateDaysLeft = (expiresAt) => {
    if (!expiresAt) return null;
    const diff = new Date(expiresAt).getTime() - new Date().getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 0;
  };

  const daysLeft = calculateDaysLeft(album.expires_at);
  const isSubmitted = album.status === "submitted" || album.is_locked;
  const isExpired = album.is_expired || daysLeft === 0;
  const photoCount = album.photo_count ?? album.media_count ?? 0;
  const selectedCount = album.selected_count ?? 0;
  const pinCode = album.pin || album.client_pin;

  const role = String(album.creator_role || "photographer").toLowerCase().trim();
  const isAssistant = role === "assistant";
  const creatorName = album.creator_name || (isAssistant ? "Studio Assistant" : "Owner");

  return (
    <div
      id={`album-card-${album.id}`}
      className="group rounded-2xl border border-slate-200 bg-white overflow-hidden hover:border-indigo-200 hover:shadow-md transition-all flex flex-col justify-between shadow-sm relative"
    >
      <Link to={`/dashboard/albums/${album.id}`} className="flex-1 flex flex-col justify-between">
        {/* Cover Preview */}
        <div className="h-40 bg-gradient-to-br from-slate-50 via-indigo-50/40 to-slate-100 flex items-center justify-center relative border-b border-slate-100">
          <ImageIcon className="w-10 h-10 text-slate-300 group-hover:text-indigo-400 transition-colors" />

          {/* PIN Pill */}
          {pinCode && (
            <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-mono font-semibold text-slate-700 tracking-wider shadow-sm">
              {pinCode}
            </div>
          )}

          {/* Status Badge */}
          <div className="absolute top-3 right-3">
            {isSubmitted ? (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-[10px] font-semibold text-emerald-700">
                <CheckCircle2 className="w-3 h-3" />Submitted
              </span>
            ) : isExpired ? (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-50 border border-red-200 text-[10px] font-semibold text-red-700">
                <Clock className="w-3 h-3" />Expired
              </span>
            ) : (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-[10px] font-semibold text-indigo-700">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                Selecting
              </span>
            )}
          </div>
        </div>

        {/* Details */}
        <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <h3 className="text-sm font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors truncate">
                {album.title || "Untitled Album"}
              </h3>
              {isAssistant ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold shrink-0 bg-cyan-50 text-cyan-700 border border-cyan-200">
                  <UserCheck className="w-3 h-3 shrink-0" />
                  <span className="truncate max-w-[80px]">Ast</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold shrink-0 bg-amber-50 text-amber-700 border border-amber-200">
                  <Crown className="w-3 h-3 shrink-0" />Owner
                </span>
              )}
            </div>

            <p className="text-xs text-slate-500 truncate">
              Client: <span className="text-slate-700 font-medium">{album.client_name || "Unassigned"}</span>
              {selectedCount > 0 && (
                <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3 h-3" />{selectedCount} Selected
                </span>
              )}
            </p>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {daysLeft !== null ? (isExpired ? "Expired" : `${daysLeft}d left`) : "Permanent"}
            </span>
            <span className="font-mono text-slate-500">
              {photoCount} {photoCount === 1 ? "Photo" : "Photos"}
            </span>
          </div>
        </div>
      </Link>

      {onDelete && (
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(e, album.id, album.title); }}
          disabled={isDeleting}
          title="Delete Album"
          className="absolute bottom-3.5 right-3 p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
        >
          {isDeleting ? (
            <div className="w-3.5 h-3.5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
          ) : (
            <Trash2 className="w-3.5 h-3.5" />
          )}
        </button>
      )}
    </div>
  );
}
