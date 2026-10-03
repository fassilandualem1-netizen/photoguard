import React from "react";
import { Link } from "react-router-dom";
import {
  Image as ImageIcon,
  Clock,
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
  const isExpired = album.is_expired || (daysLeft !== null && daysLeft === 0);
  const photoCount = album.photo_count ?? album.media_count ?? 0;
  const selectedCount = album.selected_count ?? 0;
  const pinCode = album.pin || album.client_pin;

  const role = String(album.creator_role || "photographer").toLowerCase().trim();
  const isAssistant = role === "assistant";
  const creatorName = album.creator_name || (isAssistant ? "Studio Assistant" : "Owner");

  return (
    <div
      id={`album-card-${album.id}`}
      className="group rounded-xl border border-slate-800 bg-[#151a23] overflow-hidden hover:border-slate-700 transition-all flex flex-col justify-between shadow-sm hover:shadow-md relative"
    >
      <Link
        to={`/dashboard/albums/${album.id}`}
        className="flex-1 flex flex-col justify-between"
      >
        {/* Cover Preview & Top Badges */}
        <div className="h-44 bg-gradient-to-tr from-[#0b0f19] via-[#111726] to-[#0b0f19] flex items-center justify-center relative p-4 border-b border-slate-800/80">
          {album.cover_photo_url ? (
            <img
              src={album.cover_photo_url}
              alt={album.title}
              className="w-full h-full object-cover absolute inset-0"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <ImageIcon className="w-10 h-10 text-slate-700 group-hover:text-orange-400/80 transition-colors" />
          )}

          {/* Top Left: 6-Digit PIN Pill without harsh button border */}
          {pinCode && (
            <div className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-orange-500/15 backdrop-blur-md text-xs font-mono font-bold text-orange-400 tracking-wider shadow-sm">
              PIN {pinCode}
            </div>
          )}

          {/* Top Right: Status Badge */}
          <div className="absolute top-3 right-3 flex items-center gap-1.5">
            {isSubmitted ? (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-[10px] font-medium text-green-400 backdrop-blur-md">
                <CheckCircle2 className="w-3 h-3 text-green-400" />
                Submitted
              </span>
            ) : isExpired ? (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-[10px] font-medium text-red-400 backdrop-blur-md">
                <Clock className="w-3 h-3 text-red-400" />
                Expired
              </span>
            ) : (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-[10px] font-medium text-orange-400 backdrop-blur-md">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
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
              <h3 className="text-sm font-semibold text-white group-hover:text-orange-400 transition-colors truncate">
                {album.title || "Untitled Album"}
              </h3>

              {isAssistant ? (
                <span
                  title={`Created by Studio Assistant: ${creatorName}`}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide uppercase shrink-0 bg-cyan-950/80 text-cyan-300 border border-cyan-400/50 shadow-sm shadow-cyan-500/20"
                >
                  <UserCheck className="w-3 h-3 text-cyan-400 shrink-0" />
                  <span className="truncate max-w-[120px]">Ast: {creatorName}</span>
                </span>
              ) : (
                <span
                  title="Created by Studio Root Owner"
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold shrink-0 bg-slate-800/90 text-orange-300/90 border border-orange-500/20"
                >
                  <Crown className="w-3 h-3 text-orange-400 shrink-0" />
                  <span>Owner</span>
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
            <span className="flex items-center gap-1 text-[11px] font-mono">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              {daysLeft !== null
                ? isExpired
                  ? "Expired"
                  : `${daysLeft}d left`
                : "14d left"}
            </span>

            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-slate-300 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/60">
                {photoCount} {photoCount === 1 ? "Photo" : "Photos"}
              </span>

              <ExternalLink className="w-3.5 h-3.5 text-slate-500 group-hover:text-orange-400 transition-colors" />
            </div>
          </div>
        </div>
      </Link>

      {/* Delete Action Trigger */}
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
          className="absolute bottom-3 right-2.5 p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/15 hover:border hover:border-red-500/30 transition-all duration-200 cursor-pointer"
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
