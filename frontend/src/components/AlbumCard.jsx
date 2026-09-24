import React from "react";
import { Link } from "react-router-dom";
import {
  Image as ImageIcon,
  Clock,
  Lock,
  ExternalLink,
  Crown,
  UserCheck,
  CheckCircle2,
  Trash2,
} from "lucide-react";

export default function AlbumCard({
  album,
  onDelete,
  isDeleting = false,
}) {
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

  // Creator Tracking Badge Logic:
  // - Root Owner: Subtle "👑 Owner" badge
  // - Assistant: Brightly colored "👤 Ast: [creator_name]" badge (vibrant cyan/emerald tint)
  const role = String(album.creator_role || "photographer").toLowerCase().trim();
  const isAssistant = role === "assistant";
  const creatorName = album.creator_name || (isAssistant ? "Studio Assistant" : "Owner");

  return (
    <div
      id={`album-card-${album.id}`}
      className="group rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-sm overflow-hidden hover:border-slate-700 hover:bg-slate-900/60 transition-all flex flex-col justify-between shadow-sm hover:shadow-md relative"
    >
      <Link
        to={`/dashboard/albums/${album.id}`}
        className="flex-1 flex flex-col justify-between"
      >
        {/* Cover Preview & Top Badges */}
        <div className="h-44 bg-gradient-to-tr from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center relative p-4 border-b border-slate-800/60">
          <ImageIcon className="w-10 h-10 text-slate-700 group-hover:text-amber-400/80 transition-colors" />

          {/* Top Left: 6-Digit PIN Pill */}
          {pinCode && (
            <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-black/75 backdrop-blur-md border border-slate-700/60 text-xs font-mono font-semibold text-amber-400 tracking-wider shadow-sm">
              PIN: {pinCode}
            </div>
          )}

          {/* Top Right: Status Badge */}
          <div className="absolute top-3 right-3 flex items-center gap-1.5">
            {isSubmitted ? (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-950/80 border border-amber-500/40 text-[10px] font-medium text-amber-300 backdrop-blur-md">
                <Lock className="w-3 h-3 text-amber-400" />
                Submitted
              </span>
            ) : isExpired ? (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-950/80 border border-red-500/40 text-[10px] font-medium text-red-300 backdrop-blur-md">
                <Clock className="w-3 h-3 text-red-400" />
                Expired
              </span>
            ) : (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/80 border border-emerald-500/40 text-[10px] font-medium text-emerald-300 backdrop-blur-md">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Selecting
              </span>
            )}
          </div>
        </div>

        {/* Details Body */}
        <div className="p-5 space-y-3 flex-1 flex flex-col justify-between">
          <div>
            {/* Title & Creator Tracking Badge */}
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <h3 className="text-sm font-semibold text-white group-hover:text-amber-400 transition-colors truncate">
                {album.title || "Untitled Album"}
              </h3>

              {/* Creator Tracking Visual Badge */}
              {isAssistant ? (
                <span
                  title={`Created by Studio Assistant: ${creatorName}`}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide uppercase shrink-0 bg-cyan-950/80 text-cyan-300 border border-cyan-400/50 shadow-sm shadow-cyan-500/20"
                >
                  <UserCheck className="w-3 h-3 text-cyan-400 shrink-0" />
                  <span className="truncate max-w-[120px]">👤 Ast: {creatorName}</span>
                </span>
              ) : (
                <span
                  title="Created by Studio Root Owner"
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold shrink-0 bg-slate-800/90 text-amber-300/90 border border-amber-500/20"
                >
                  <Crown className="w-3 h-3 text-amber-400 shrink-0" />
                  <span>👑 Owner</span>
                </span>
              )}
            </div>

            {/* Client Name & Selected Counter */}
            <div className="flex items-center justify-between text-xs text-slate-400 truncate">
              <p className="truncate">
                Client: <span className="text-slate-300 font-medium">{album.client_name || "Unassigned"}</span>
              </p>
              {selectedCount > 0 && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-full shrink-0">
                  <CheckCircle2 className="w-3 h-3" />
                  {selectedCount} Selected
                </span>
              )}
            </div>
          </div>

          {/* Footer Meta */}
          <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center gap-1 text-[11px]">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              {daysLeft !== null
                ? isExpired
                  ? "Expired"
                  : `${daysLeft} days left`
                : "Permanent"}
            </span>

            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-slate-400">
                {photoCount} {photoCount === 1 ? "Photo" : "Photos"}
              </span>

              <ExternalLink className="w-3.5 h-3.5 text-slate-600 group-hover:text-amber-400 transition-colors" />
            </div>
          </div>
        </div>
      </Link>

      {/* Optional Delete Action Trigger */}
      {onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete(e, album.id, album.title);
          }}
          disabled={isDeleting}
          title="Delete Album"
          className="absolute bottom-3.5 right-2.5 p-1 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-950/40 transition-colors"
        >
          {isDeleting ? (
            <div className="w-3.5 h-3.5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <Trash2 className="w-3.5 h-3.5" />
          )}
        </button>
      )}
    </div>
  );
}
