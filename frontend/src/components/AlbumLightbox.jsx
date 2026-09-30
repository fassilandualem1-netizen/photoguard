import React, { useState, useEffect, useRef, Component } from "react";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  X,
  AlertTriangle,
} from "lucide-react";

// Local Component Error Boundary to isolate any unexpected rendering crashes
class LightboxErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("AlbumLightbox error trapped by local boundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4 select-none">
          <div className="p-6 rounded-2xl bg-slate-900 border border-red-500/30 text-center max-w-md space-y-4">
            <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto" />
            <h3 className="text-white text-sm font-bold">Lightbox Display Error</h3>
            <p className="text-xs text-slate-400">
              An error occurred while displaying this photo preview.
            </p>
            <button
              type="button"
              onClick={this.props.onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 text-white text-xs font-semibold hover:bg-slate-700"
            >
              Close Preview
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function AlbumLightboxContent({
  previewPhoto,
  activeList = [],
  onPrev,
  onNext,
  onClose,
}) {
  const [imageError, setImageError] = useState(false);

  // Touch Swipe tracking for smooth Instagram-style photo transitions
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const touchStartY = useRef(0);
  const touchEndY = useRef(0);
  const minSwipeDistance = 45;

  const handleTouchStart = (e) => {
    if (e.targetTouches && e.targetTouches.length > 0) {
      touchStartX.current = e.targetTouches[0].clientX;
      touchEndX.current = e.targetTouches[0].clientX;
      touchStartY.current = e.targetTouches[0].clientY;
      touchEndY.current = e.targetTouches[0].clientY;
    }
  };

  const handleTouchMove = (e) => {
    if (e.targetTouches && e.targetTouches.length > 0) {
      touchEndX.current = e.targetTouches[0].clientX;
      touchEndY.current = e.targetTouches[0].clientY;
    }
  };

  const handleTouchEnd = () => {
    const deltaX = touchStartX.current - touchEndX.current;
    const deltaY = Math.abs(touchStartY.current - touchEndY.current);
    // Only trigger if horizontal swipe is prominent
    if (Math.abs(deltaX) > minSwipeDistance && Math.abs(deltaX) > deltaY) {
      if (deltaX > 0) {
        // Swiped Left -> Next Photo
        onNext?.();
      } else {
        // Swiped Right -> Previous Photo
        onPrev?.();
      }
    }
  };

  // Reset imageError whenever previewPhoto changes
  useEffect(() => {
    setImageError(false);
  }, [previewPhoto?.id, previewPhoto?.url]);

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

        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="relative max-h-[72vh] flex items-center justify-center overflow-hidden rounded-2xl bg-black/60 border border-slate-800/80 min-h-[240px] w-full touch-pan-y"
        >
          {imageError ? (
            <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-3">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-white">
                High-Resolution Preview Unavailable
              </p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                The image could not be loaded from the CDN storage. The file may be restricted or processing.
              </p>
            </div>
          ) : (
            <img
              src={previewPhoto.url}
              alt={previewPhoto.filename}
              onError={() => setImageError(true)}
              className="max-h-[72vh] w-auto object-contain pointer-events-none"
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default function AlbumLightbox(props) {
  return (
    <LightboxErrorBoundary onClose={props.onClose}>
      <AlbumLightboxContent {...props} />
    </LightboxErrorBoundary>
  );
}
