import React, { useEffect } from "react";
import { ChevronLeft, ChevronRight, CheckCircle2, X, MessageSquare } from "lucide-react";

export default function AlbumLightbox({
  previewPhoto,
  activeList = [],
  onPrev,
  onNext,
  onClose,
}) {
  useEffect(() => {
    if (!previewPhoto) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose?.();
      } else if (e.key === "ArrowLeft") {
        onPrev?.();
      } else if (e.key === "ArrowRight") {
        onNext?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [previewPhoto, onPrev, onNext, onClose]);

  if (!previewPhoto) return null;

  const currentIndex = activeList.findIndex((p) => p.id === previewPhoto.id);

  return (
    <div
      id="photo-lightbox-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md p-2 sm:p-4 animate-in fade-in select-none"
      onClick={onClose}
    >
      {activeList.length > 1 && (
        <>
          <button
            type="button"
            id="lightbox-prev-btn"
            onClick={(e) => {
              e.stopPropagation();
              onPrev?.();
            }}
            className="fixed left-3 sm:left-6 top-1/2 -translate-y-1/2 z-50 p-3 sm:p-3.5 rounded-full bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 text-white hover:text-amber-400 transition-all shadow-2xl backdrop-blur-md group cursor-pointer"
            title="Previous Photo (Left Arrow)"
          >
            <ChevronLeft className="w-6 h-6 group-hover:-translate-x-0.5 transition-transform" />
          </button>
          <button
            type="button"
            id="lightbox-next-btn"
            onClick={(e) => {
              e.stopPropagation();
              onNext?.();
            }}
            className="fixed right-3 sm:right-6 top-1/2 -translate-y-1/2 z-50 p-3 sm:p-3.5 rounded-full bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 text-white hover:text-amber-400 transition-all shadow-2xl backdrop-blur-md group cursor-pointer"
            title="Next Photo (Right Arrow)"
          >
            <ChevronRight className="w-6 h-6 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </>
      )}

      <div
        className="relative max-w-6xl w-full max-h-[92vh] flex flex-col items-center justify-center gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-full flex items-center justify-between px-4 py-2.5 rounded-2xl bg-slate-900/90 border border-slate-800 backdrop-blur-md text-slate-300">
          <div className="flex items-center gap-3">
            <span className="text-xs sm:text-sm font-semibold text-white truncate max-w-[180px] sm:max-w-md">
              {previewPhoto.filename}
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[11px] font-mono text-slate-300">
              {currentIndex >= 0 ? currentIndex + 1 : 1} / {activeList.length}
            </span>
            {previewPhoto.is_selected && (
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-[11px] font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span>Client Pick</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="relative max-h-[72vh] flex items-center justify-center overflow-hidden rounded-2xl bg-black/60 border border-slate-800/80">
          <img
            src={previewPhoto.url}
            alt={previewPhoto.filename}
            className="max-h-[72vh] w-auto object-contain"
          />
        </div>

        {(previewPhoto.client_notes || previewPhoto.client_note) && (
          <div className="w-full p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 flex items-start gap-3 backdrop-blur-md">
            <MessageSquare className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs">
              <span className="font-bold text-amber-300">Client Retouching Note: </span>
              <span className="text-white">{previewPhoto.client_notes || previewPhoto.client_note}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
