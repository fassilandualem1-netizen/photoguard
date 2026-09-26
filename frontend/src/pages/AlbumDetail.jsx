import React, { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import {
  ArrowLeft,
  Upload,
  Download,
  CheckCircle2,
  Lock,
  Clock,
  AlertCircle,
  RefreshCw,
  FileText,
  ExternalLink,
  Copy,
  Check,
  Trash2,
  Loader2,
  ChevronDown,
  Sparkles,
  Sliders,
  Eye,
  KeyRound,
  CalendarPlus,
  Share2,
  Send,
  MessageCircle,
  X,
  ZoomIn,
  ChevronLeft,
  ChevronRight,
  Palette,
  Camera,
  Film,
  Scissors,
} from "lucide-react";

export default function AlbumDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [album, setAlbum] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Live Sync version tracking ref
  const lastVersionRef = useRef(null);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [uploadError, setUploadError] = useState(null);
  const fileInputRef = useRef(null);

  // Extend Expiration state (Studio plan)
  const [extending, setExtending] = useState(false);
  const [extendSuccessMsg, setExtendSuccessMsg] = useState(false);

  // Export dropdown state
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [copiedUrls, setCopiedUrls] = useState(false);
  const exportDropdownRef = useRef(null);

  // One-Click Client Share dropdown state
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const shareDropdownRef = useRef(null);

  // Uploaded batch summary feedback banner
  const [lastUploadSummary, setLastUploadSummary] = useState(null);

  // Lightbox Preview Modal state
  const [previewPhoto, setPreviewPhoto] = useState(null);

  // Studio Editor Suite state
  const [activeEditorMenuId, setActiveEditorMenuId] = useState(null);
  const [editorCopiedToast, setEditorCopiedToast] = useState("");

  const handleOpenInEditor = (toolName, photoUrl, filename) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(photoUrl).catch(() => {});
    }
    setEditorCopiedToast(`Copied proof URL for ${toolName}! Ready for ingest.`);
    setTimeout(() => setEditorCopiedToast(""), 3500);

    // Open high-fidelity proof stream in focused new tab for editing/ingest
    window.open(photoUrl, "_blank", "noopener,noreferrer");
    setActiveEditorMenuId(null);
  };

  // Close dropdowns on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target)) {
        setIsExportOpen(false);
      }
      if (shareDropdownRef.current && !shareDropdownRef.current.contains(event.target)) {
        setIsShareOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchAlbumDetail = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setError(null);
      const response = await api.get(`/api/v1/albums/${id}`);
      setAlbum(response.data);
    } catch (err) {
      const msg =
        err.response?.data?.detail || "Failed to load album details. Please try again.";
      if (showLoading) setError(msg);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchAlbumDetail(true);
    }
  }, [id]);

  // LIVE SYNC ENGINE: Smart polling every 5s using Upstash Redis version counter
  useEffect(() => {
    const pin = album?.pin || album?.client_pin;
    if (!pin) return;

    const syncInterval = setInterval(async () => {
      try {
        const syncRes = await api.get(`/api/v1/client/sync/${pin}`);
        const currentVersion = syncRes.data?.version;
        const isLocked = syncRes.data?.is_locked;

        if (lastVersionRef.current === null) {
          lastVersionRef.current = currentVersion;
        } else if (lastVersionRef.current !== currentVersion) {
          // Version updated by client selections: silently refresh state to accumulate changes
          lastVersionRef.current = currentVersion;
          await fetchAlbumDetail(false);
        } else if (isLocked && !album.is_locked) {
          // Locked by client submission or expiration: silently update album
          await fetchAlbumDetail(false);
        }
      } catch (err) {
        console.error("Live Sync polling error:", err);
      }
    }, 5000);

    return () => clearInterval(syncInterval);
  }, [album?.pin, album?.client_pin, album?.is_locked, id]);

  // Bulk Upload Handler using Promise.allSettled for concurrency & partial failure resilience
  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploading(true);
    setUploadProgress({ current: 0, total: files.length });
    setUploadError(null);

    const uploadedItems = [];
    const failedFiles = [];

    // High-performance Concurrent Worker Pool (up to 6 simultaneous uploads)
    const CONCURRENCY_LIMIT = 6;
    let completedCount = 0;
    let fileIndex = 0;

    const worker = async () => {
      while (fileIndex < files.length) {
        const currentIndex = fileIndex++;
        const file = files[currentIndex];
        const formData = new FormData();
        formData.append("file", file);

        try {
          const res = await api.post(`/api/v1/media/upload/${id}`, formData, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          uploadedItems.push(res.data);
        } catch (err) {
          failedFiles.push(file.name);
        } finally {
          completedCount++;
          setUploadProgress({ current: completedCount, total: files.length });
        }
      }
    };

    const workerCount = Math.min(CONCURRENCY_LIMIT, files.length);
    const workers = Array.from({ length: workerCount }, () => worker());
    await Promise.all(workers);

    // Refresh album state with newly uploaded media items
    if (uploadedItems.length > 0) {
      setAlbum((prev) => {
        if (!prev) return prev;
        const currentItems = prev.media_items || [];
        const combined = [...uploadedItems, ...currentItems];
        return {
          ...prev,
          media_items: combined,
          media_count: (prev.media_count || 0) + uploadedItems.length,
        };
      });

      // Calculate total original size uploaded in this batch
      const totalBatchBytes = uploadedItems.reduce((acc, curr) => {
        const sz = curr?.original_size || 0;
        return acc + sz;
      }, 0);
      const totalBatchMb = (totalBatchBytes / (1024 * 1024)).toFixed(1);

      setLastUploadSummary({
        count: uploadedItems.length,
        totalMb: totalBatchMb,
        timestamp: Date.now(),
      });
    }

    if (failedFiles.length > 0) {
      setUploadError(
        `Failed to upload ${failedFiles.length} file(s): ${failedFiles.slice(0, 3).join(", ")}${
          failedFiles.length > 3 ? "..." : ""
        }. Check file size and format.`
      );
    }

    setUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Studio Tier: Extend Expiration by 7 days
  const handleExtendExpiration = async () => {
    try {
      setExtending(true);
      const res = await api.put(`/api/v1/albums/${id}/extend`, { days: 7 });
      setAlbum(res.data);
      setExtendSuccessMsg(true);
      setTimeout(() => setExtendSuccessMsg(false), 3000);
    } catch (err) {
      const status = err.response?.status;
      if (status === 423 || status === 409) {
        setAlbum((prev) => (prev ? { ...prev, is_locked: true } : prev));
      }
      const msg =
        err.response?.data?.detail || "Failed to extend album lifespan. Please try again.";
      alert(msg);
    } finally {
      setExtending(false);
    }
  };

  const handleDeletePhoto = async (mediaId) => {
    if (!window.confirm("Are you sure you want to remove this photo from the album?")) {
      return;
    }
    try {
      await api.delete(`/api/v1/media/${mediaId}`);
      setAlbum((prev) => {
        if (!prev) return prev;
        const updatedItems = prev.media_items.filter((item) => item.id !== mediaId);
        return {
          ...prev,
          media_items: updatedItems,
          media_count: Math.max(0, (prev.media_count || updatedItems.length) - 1),
          selected_count: updatedItems.filter((i) => i.is_selected).length,
        };
      });
    } catch (err) {
      const status = err.response?.status;
      if (status === 423 || status === 409) {
        setAlbum((prev) => (prev ? { ...prev, is_locked: true } : prev));
      }
      alert(err.response?.data?.detail || "Failed to delete photo.");
    }
  };

  const calculateDaysLeft = (expiresAt) => {
    if (!expiresAt) return null;
    const diff = new Date(expiresAt).getTime() - new Date().getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 0;
  };

  // Filter selected items, or fallback to all items if none selected
  const mediaItems = album?.media_items || [];
  const media = mediaItems;
  const selectedItems = mediaItems.filter((m) => m.is_selected);
  const exportItems = selectedItems.length > 0 ? selectedItems : mediaItems;

  // ONE-CLICK CLIENT SHARE HANDLERS
  const albumPin = album?.pin || album?.client_pin || "";
  const shareText = `Your private proof gallery is ready! Access PIN: ${albumPin}. Download the PhotoGuard app here: https://photoguard.com/app`;

  const handleWhatsAppShare = () => {
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
    window.open(waUrl, "_blank", "noopener,noreferrer");
    setIsShareOpen(false);
  };

  const handleTelegramShare = () => {
    const tgUrl = `https://t.me/share/url?url=${encodeURIComponent("https://photoguard.com/app")}&text=${encodeURIComponent(shareText)}`;
    window.open(tgUrl, "_blank", "noopener,noreferrer");
    setIsShareOpen(false);
  };

  const handleCopyInviteMessage = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopiedInvite(true);
      setTimeout(() => setCopiedInvite(false), 2500);
    } catch {
      console.warn("Clipboard access failed.");
    }
    setIsShareOpen(false);
  };

  // RAW TXT MANIFEST EXPORT: Pure high-res URLs, one per line (\n). No JSON, no quotes, no commas.
  const handleExportRawManifest = () => {
    if (exportItems.length === 0) {
      alert("No photos in this gallery to export.");
      return;
    }
    // Clean raw URLs only: one URL per line separated by \n
    // STRICTLY NO JSON brackets, NO quotes, NO commas.
    const rawUrls = exportItems
      .map((item) => item.url)
      .filter((u) => Boolean(u && typeof u === "string"))
      .join("\n");

    const blob = new Blob([rawUrls], { type: "text/plain;charset=utf-8" });
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    const cleanAlbumTitle = (album?.title || "gallery").replace(/[^a-zA-Z0-9_-]/g, "_");
    link.download = `${cleanAlbumTitle}_highres_urls.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(downloadUrl);
    setIsExportOpen(false);
  };

  const handleCopyOriginalUrls = async () => {
    if (exportItems.length === 0) return;
    const rawUrls = exportItems
      .map((item) => item.url)
      .filter((u) => Boolean(u && typeof u === "string"))
      .join("\n");
    try {
      await navigator.clipboard.writeText(rawUrls);
      setCopiedUrls(true);
      setTimeout(() => setCopiedUrls(false), 2500);
    } catch {
      console.warn("Clipboard access denied. Falling back to prompt.");
    }
    setIsExportOpen(false);
  };

  const handlePrevPhoto = () => {
    if (!previewPhoto || mediaItems.length === 0) return;
    const currentIndex = mediaItems.findIndex((p) => p.id === previewPhoto.id);
    if (currentIndex === -1) return;
    const prevIndex = (currentIndex - 1 + mediaItems.length) % mediaItems.length;
    setPreviewPhoto(mediaItems[prevIndex]);
  };

  const handleNextPhoto = () => {
    if (!previewPhoto || mediaItems.length === 0) return;
    const currentIndex = mediaItems.findIndex((p) => p.id === previewPhoto.id);
    if (currentIndex === -1) return;
    const nextIndex = (currentIndex + 1) % mediaItems.length;
    setPreviewPhoto(mediaItems[nextIndex]);
  };

  // Keyboard navigation for Lightbox Photo Scanner (ArrowLeft, ArrowRight, Escape)
  useEffect(() => {
    if (!previewPhoto) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setPreviewPhoto(null);
      } else if (e.key === "ArrowLeft") {
        handlePrevPhoto();
      } else if (e.key === "ArrowRight") {
        handleNextPhoto();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [previewPhoto, mediaItems]);

  const handleDownloadManifest = () => {
    handleExportRawManifest();
  };

  if (loading) {
    return (
      <div
        id="album-detail-loading"
        className="flex flex-col items-center justify-center py-28 text-slate-400"
      >
        <div className="w-9 h-9 rounded-full border-2 border-amber-400 border-t-transparent animate-spin mb-4" />
        <p className="text-xs font-mono uppercase tracking-wider text-slate-500">
          Loading gallery details & proofs...
        </p>
      </div>
    );
  }

  if (error || !album) {
    return (
      <div
        id="album-detail-error"
        className="p-8 rounded-2xl border border-red-500/20 bg-red-950/40 text-red-300 max-w-xl mx-auto my-12 flex flex-col items-start gap-4"
      >
        <div className="flex items-center gap-3">
          <AlertCircle className="w-6 h-6 text-red-400 shrink-0" />
          <div>
            <h3 className="text-base font-semibold text-white">Failed to load gallery</h3>
            <p className="text-xs text-red-300/90 mt-1">{error || "Album not found."}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-2">
          <Link
            to="/dashboard"
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-white transition-colors"
          >
            Return to Dashboard
          </Link>
          <button
            type="button"
            onClick={() => fetchAlbumDetail(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-900/60 hover:bg-red-800/60 border border-red-700/60 text-xs font-semibold text-white transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      </div>
    );
  }

  const daysLeft = calculateDaysLeft(album.expires_at);
  const isSubmitted = album.status === "submitted" || album.is_locked;
  const isStudio = user?.subscription_plan === "studio";

  return (
    <div id="album-detail-container" className="space-y-8">
      {/* Navigation Breadcrumb & Back Action */}
      <div className="flex items-center justify-between flex-wrap gap-4 pb-2 border-b border-slate-800/60">
        <div className="flex items-center gap-3">
          <Link
            to="/dashboard"
            id="back-to-galleries-link"
            className="inline-flex items-center gap-2.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-xs sm:text-sm font-semibold text-slate-200 hover:text-white transition-all group shadow-md shadow-black/40 hover:border-amber-500/50"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform text-amber-400 shrink-0" />
            <span>Back to Galleries</span>
          </Link>
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 font-medium">
            <span>/</span>
            <span className="text-slate-300 truncate max-w-xs">{album.title}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {extendSuccessMsg && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-950/90 border border-amber-500/40 text-amber-300 text-xs animate-in fade-in">
              <Check className="w-3.5 h-3.5 text-amber-400" />
              <span>Lifespan extended by +7 days!</span>
            </div>
          )}
          {copiedUrls && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/90 border border-emerald-500/40 text-emerald-300 text-xs animate-in fade-in">
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>Original URLs copied to clipboard!</span>
            </div>
          )}
          {copiedInvite && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/90 border border-emerald-500/40 text-emerald-300 text-xs animate-in fade-in">
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>Client invitation copied to clipboard!</span>
            </div>
          )}
        </div>
      </div>

      {/* Top Header Section */}
      <div className="relative z-40 p-6 sm:p-8 rounded-3xl border border-slate-800/90 bg-gradient-to-br from-slate-900/90 via-slate-900/50 to-[#0d0f12] backdrop-blur-xl shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              {album.title}
            </h1>

            {/* Lock Status */}
            {isSubmitted ? (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-950/80 border border-amber-500/40 text-amber-300 text-xs font-medium">
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                Selection Finalized & Locked
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Client Selecting (Live Sync Active)
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-y-2 gap-x-6 text-xs text-slate-400">
            <div>
              Client: <span className="text-slate-200 font-medium">{album.client_name}</span>
            </div>
            <div>
              Total Proofs:{" "}
              <span className="text-slate-200 font-mono font-medium">
                {album.media_count || mediaItems.length}
              </span>
            </div>
            <div>
              Client Selections:{" "}
              <span className="text-amber-400 font-mono font-semibold">
                {album.selected_count ?? selectedItems.length}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>
                {daysLeft !== null
                  ? album.is_expired || daysLeft === 0
                    ? "Expired"
                    : `${daysLeft} days left`
                  : "Permanent"}
              </span>
            </div>
          </div>
        </div>

        {/* Prominent Client PIN & Action Buttons */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-4 relative z-50">
          {/* Prominent 6-Digit PIN Pill */}
          <div
            id="client-pin-banner"
            className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 shadow-lg shadow-amber-500/5"
          >
            <div className="w-8 h-8 rounded-xl bg-amber-400/20 flex items-center justify-center">
              <KeyRound className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-mono tracking-widest text-slate-400">
                Client Access PIN
              </p>
              <p className="text-xl font-mono font-extrabold tracking-widest text-amber-400">
                {albumPin}
              </p>
            </div>
          </div>

          {/* ONE-CLICK CLIENT SHARE DROPDOWN */}
          <div className="relative z-50" ref={shareDropdownRef}>
            <button
              id="share-client-dropdown-btn"
              type="button"
              onClick={() => setIsShareOpen((prev) => !prev)}
              className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-slate-950 font-semibold text-xs transition-all shadow-lg shadow-emerald-500/20 cursor-pointer"
              title="Share PIN and app download link directly with client via WhatsApp, Telegram, or message"
            >
              <Share2 className="w-4 h-4 text-slate-950" />
              <span>One-Click Share</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isShareOpen ? "rotate-180" : ""}`} />
            </button>

            {isShareOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 sm:w-88 rounded-2xl border border-slate-700/80 bg-[#12161f] p-3 shadow-2xl shadow-black/95 z-50 space-y-2 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-2 border-b border-slate-800/80">
                  <p className="text-xs font-semibold text-white flex items-center gap-1.5">
                    <Share2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Client Invitation Dispatch</span>
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                    Instantly share this private proof gallery with pre-filled PIN <span className="font-mono font-bold text-amber-400">{albumPin}</span>.
                  </p>
                </div>

                {/* WhatsApp Share Direct Anchor */}
                <a
                  id="share-whatsapp-btn"
                  href={`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setIsShareOpen(false)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-emerald-200 hover:text-white bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-500/20 hover:border-emerald-500/50 transition-all text-left group cursor-pointer relative z-10"
                >
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 group-hover:scale-105 transition-transform">
                    <MessageCircle className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-white">Share via WhatsApp</div>
                    <div className="text-[10px] text-emerald-400/80">Direct pre-filled chat invite</div>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-300 transition-colors" />
                </a>

                {/* Telegram Share Direct Anchor */}
                <a
                  id="share-telegram-btn"
                  href={`https://t.me/share/url?url=${encodeURIComponent("https://photoguard.com/app")}&text=${encodeURIComponent(shareText)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setIsShareOpen(false)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-sky-200 hover:text-white bg-sky-950/40 hover:bg-sky-900/60 border border-sky-500/20 hover:border-sky-500/50 transition-all text-left group cursor-pointer relative z-10"
                >
                  <div className="w-7 h-7 rounded-lg bg-sky-500/20 flex items-center justify-center text-sky-400 shrink-0 group-hover:scale-105 transition-transform">
                    <Send className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-white">Share via Telegram</div>
                    <div className="text-[10px] text-sky-400/80">Instant messenger broadcast</div>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-sky-300 transition-colors" />
                </a>

                <div className="my-1 border-t border-slate-800/80" />

                {/* Copy Template Text */}
                <button
                  type="button"
                  id="copy-invite-text-btn"
                  onClick={handleCopyInviteMessage}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800/70 transition-colors text-left cursor-pointer relative z-10"
                >
                  <Copy className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>Copy Full Invitation Text</span>
                </button>

                {/* Text preview box */}
                <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 text-[10px] text-slate-400 font-mono leading-relaxed select-all">
                  "{shareText}"
                </div>
              </div>
            )}
          </div>

          {/* STUDIO PLAN ONLY: Extend Expiration Button */}
          {isStudio && (
            <button
              id="extend-expiration-btn"
              type="button"
              onClick={handleExtendExpiration}
              disabled={extending}
              className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 hover:text-amber-200 font-semibold text-xs transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              title="Add 7 days to this album's lifespan (Studio plan feature)"
            >
              {extending ? (
                <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
              ) : (
                <CalendarPlus className="w-4 h-4 text-amber-400" />
              )}
              <span>{extending ? "Extending..." : "Extend Lifespan (+7 Days)"}</span>
            </button>
          )}

          {/* Export Selections Dropdown (Raw TXT Manifest & URLs) */}
          <div className="relative z-50" ref={exportDropdownRef}>
            <button
              id="export-selections-dropdown-btn"
              type="button"
              onClick={() => setIsExportOpen((prev) => !prev)}
              className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700/80 border border-slate-700/80 text-white font-semibold text-xs transition-all shadow-lg cursor-pointer"
            >
              <Sliders className="w-4 h-4 text-amber-400" />
              <span>Export Selections ({selectedItems.length})</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExportOpen ? "rotate-180" : ""}`} />
            </button>

            {isExportOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 rounded-2xl border border-slate-700/80 bg-[#12161f] p-3 shadow-2xl shadow-black/95 z-50 space-y-2 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-2 border-b border-slate-800/80">
                  <p className="text-xs font-semibold text-white flex items-center gap-1.5">
                    <Download className="w-3.5 h-3.5 text-amber-400" />
                    <span>Export Original Shoot Proofs</span>
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                    Generates clean, verified shoot proofs (.txt) ready for direct ingest into Adobe Lightroom, Photoshop, Premiere Pro, CapCut, Capture One & download managers.
                  </p>
                </div>

                <button
                  type="button"
                  id="download-raw-txt-btn"
                  onClick={handleExportRawManifest}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-amber-300 hover:text-white bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-colors text-left cursor-pointer relative z-10"
                >
                  <Download className="w-4 h-4 text-amber-400 shrink-0" />
                  <div className="flex-1">
                    <div>Export Original Shoot Proofs (.txt)</div>
                    <div className="text-[10px] text-amber-400/80 font-normal">Lightroom / Photoshop / Premiere / CapCut Ingest</div>
                  </div>
                </button>

                <button
                  type="button"
                  id="copy-raw-urls-btn"
                  onClick={handleCopyOriginalUrls}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800/70 transition-colors text-left cursor-pointer relative z-10"
                >
                  <Copy className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>Copy Shoot Proof URLs (Line Separated)</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SINGLE SUBMIT LOCK PROMINENT BANNER */}
      {isSubmitted && (
        <div
          id="single-submit-locked-banner"
          className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-amber-500/5 border border-amber-500/40 text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl shadow-amber-500/5 animate-in fade-in"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold shrink-0 shadow-lg shadow-amber-500/20">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-amber-400/20 text-amber-400 text-[10px] font-mono font-bold tracking-widest uppercase">
                  Single Submit Lock Active
                </span>
                <h3 className="text-base font-bold tracking-tight text-white uppercase">
                  SUBMITTED & LOCKED
                </h3>
              </div>
              <p className="text-xs text-amber-300/80 mt-1 max-w-xl leading-relaxed">
                The client has submitted their final selections. All collaborative modifications are permanently locked and photo proof uploads are blocked.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-black/40 border border-amber-500/30 text-xs font-mono text-amber-400 shrink-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Ready for Export Engine</span>
          </div>
        </div>
      )}

      {/* Bulk Upload Section */}
      <div
        id="bulk-upload-section"
        className="p-6 rounded-3xl border border-dashed border-slate-800 bg-slate-900/30 backdrop-blur-sm"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Upload className="w-4 h-4 text-amber-400" />
              <span>Bulk Proof Upload Engine</span>
            </h2>
            <p className="text-xs text-slate-400">
              {isSubmitted
                ? "This gallery is submitted and locked. New photo uploads are blocked."
                : "Select multiple RAW or JPEG photos. Photos are uploaded in original full-resolution quality."}
            </p>
          </div>

          <div>
            <input
              ref={fileInputRef}
              id="bulk-photo-input"
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileChange}
              disabled={uploading || isSubmitted}
              className="hidden"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || isSubmitted}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-xs transition-all shadow-lg shadow-amber-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>
                    Uploading ({uploadProgress.current}/{uploadProgress.total})...
                  </span>
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" />
                  <span>{isSubmitted ? "Album Locked" : "Select Photos to Upload"}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Upload Success Feedback Banner */}
        {lastUploadSummary && (
          <div className="mt-4 p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-950/40 text-emerald-200 text-xs flex items-center justify-between gap-2.5 animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                Successfully uploaded <strong className="text-white">{lastUploadSummary.count} photo{lastUploadSummary.count === 1 ? "" : "s"}</strong> ({lastUploadSummary.totalMb} MB total original size).
              </span>
            </div>
            <button
              type="button"
              onClick={() => setLastUploadSummary(null)}
              className="text-slate-400 hover:text-white p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Upload Error feedback */}
        {uploadError && (
          <div className="mt-4 p-3.5 rounded-xl border border-red-500/20 bg-red-950/40 text-red-300 text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{uploadError}</span>
          </div>
        )}
      </div>

      {/* Gallery Section - Masonry Grid Layout */}
      <div id="gallery-masonry-section" className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-white">Gallery Proofs</h3>
            <span className="text-xs font-mono text-slate-400">
              ({mediaItems.length} photos)
            </span>
          </div>
          <div className="text-xs text-slate-500">
            {selectedItems.length} selected by client
          </div>
        </div>

        {mediaItems.length === 0 ? (
          <div className="py-16 text-center rounded-2xl border border-slate-800/60 bg-slate-900/20">
            <p className="text-sm text-slate-400">No photos in this gallery yet.</p>
            <p className="text-xs text-slate-600 mt-1">
              Use the bulk upload section above to upload original proof images.
            </p>
          </div>
        ) : (
          <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4">
            {mediaItems.map((item) => {
              const rawSize = Number(item.original_size || 0);
              const originalMb = rawSize > 0 ? (rawSize / (1024 * 1024)).toFixed(1) : null;
              const hasValidSize = originalMb && Number(originalMb) > 0;

              return (
                <div
                  key={item.id}
                  id={`media-item-${item.id}`}
                  className="break-inside-avoid rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden group hover:border-slate-700 transition-all shadow-md relative"
                >
                  {/* Photo Container */}
                  <div
                    className="relative overflow-hidden bg-slate-950 cursor-pointer"
                    onClick={() => setPreviewPhoto(item)}
                    title="Click to view in Photo Scanner"
                  >
                    <img
                      src={item.thumbnail_url || item.url}
                      alt={item.filename}
                      loading="lazy"
                      className="w-full h-auto object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                    />

                    {/* Selection Badge if selected by client */}
                    {item.is_selected && (
                      <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-lg bg-emerald-950/90 border border-emerald-500/60 text-emerald-300 text-[11px] font-semibold flex items-center gap-1 shadow-lg backdrop-blur-md">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Selected</span>
                      </div>
                    )}

                    {/* Original Badge - only shown if actual original_size > 0 */}
                    {hasValidSize && (
                      <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md bg-black/75 border border-slate-700/60 text-[10px] font-mono text-slate-300 backdrop-blur-sm shadow-sm">
                        {originalMb} MB Original
                      </div>
                    )}

                    {/* Hover Quick Actions */}
                    <div
                      className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-[2px]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => setPreviewPhoto(item)}
                        className="p-2 rounded-xl bg-slate-900/90 border border-slate-700 text-slate-200 hover:text-white hover:bg-slate-800 transition-colors"
                        title="Preview Photo"
                      >
                        <ZoomIn className="w-4 h-4 text-amber-400" />
                      </button>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setActiveEditorMenuId(activeEditorMenuId === item.id ? null : item.id)}
                          className="p-2 rounded-xl bg-slate-900/90 border border-slate-700 text-slate-200 hover:text-white hover:bg-slate-800 transition-colors flex items-center gap-1"
                          title="Open in Photoshop / Direct Edit"
                        >
                          <Palette className="w-4 h-4 text-amber-400" />
                          <ChevronDown className="w-3 h-3 text-slate-400" />
                        </button>
                        {activeEditorMenuId === item.id && (
                          <div className="absolute right-0 top-full mt-1.5 w-60 rounded-xl border border-slate-700/80 bg-[#12161f] p-2 shadow-2xl shadow-black/95 z-50 space-y-1 animate-in fade-in zoom-in-95 duration-100 text-left">
                            <div className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-slate-500 border-b border-slate-800/80">
                              Studio Editor Suite
                            </div>
                            <button
                              type="button"
                              onClick={() => handleOpenInEditor("Photoshop", item.url, item.filename)}
                              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-200 hover:text-white hover:bg-slate-800/70 transition-colors text-left"
                            >
                              <Palette className="w-3.5 h-3.5 text-sky-400" />
                              <span>Adobe Photoshop</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenInEditor("Lightroom", item.url, item.filename)}
                              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-200 hover:text-white hover:bg-slate-800/70 transition-colors text-left"
                            >
                              <Camera className="w-3.5 h-3.5 text-amber-400" />
                              <span>Adobe Lightroom</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenInEditor("Premiere", item.url, item.filename)}
                              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-200 hover:text-white hover:bg-slate-800/70 transition-colors text-left"
                            >
                              <Film className="w-3.5 h-3.5 text-purple-400" />
                              <span>Adobe Premiere Pro</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenInEditor("CapCut", item.url, item.filename)}
                              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-200 hover:text-white hover:bg-slate-800/70 transition-colors text-left"
                            >
                              <Scissors className="w-3.5 h-3.5 text-emerald-400" />
                              <span>CapCut / Video Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenInEditor("Direct Proof", item.url, item.filename)}
                              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-amber-300 hover:text-amber-200 hover:bg-amber-500/10 transition-colors text-left border-t border-slate-800/60 mt-1 pt-1.5"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Direct Studio Proof</span>
                            </button>
                          </div>
                        )}
                      </div>
                      {!isSubmitted && (
                        <button
                          type="button"
                          onClick={() => handleDeletePhoto(item.id)}
                          className="p-2 rounded-xl bg-red-950/90 border border-red-800 text-red-300 hover:bg-red-900 transition-colors"
                          title="Delete Photo"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Card Footer Details */}
                  <div className="p-3 bg-slate-900/80 border-t border-slate-800/80 space-y-1.5">
                    <p className="text-xs font-medium text-slate-200 truncate">
                      {item.filename}
                    </p>

                    {/* Client Notes / Retouching Feedback */}
                    {item.client_notes && (
                      <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 leading-tight">
                        <span className="font-semibold text-white">Client Note: </span>
                        {item.client_notes}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Full Resolution Photo Scanner Lightbox */}
      {previewPhoto && (
        <div
          id="photo-lightbox-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md p-2 sm:p-4 animate-in fade-in select-none"
          onClick={() => setPreviewPhoto(null)}
        >
          {/* Navigation Arrows for Scanner */}
          {mediaItems.length > 1 && (
            <>
              <button
                type="button"
                id="lightbox-prev-btn"
                onClick={handlePrevPhoto}
                className="fixed left-3 sm:left-6 top-1/2 -translate-y-1/2 z-50 p-3 sm:p-3.5 rounded-full bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 text-white hover:text-amber-400 transition-all shadow-2xl backdrop-blur-md group"
                title="Previous Photo (Left Arrow)"
              >
                <ChevronLeft className="w-6 h-6 group-hover:-translate-x-0.5 transition-transform" />
              </button>
              <button
                type="button"
                id="lightbox-next-btn"
                onClick={handleNextPhoto}
                className="fixed right-3 sm:right-6 top-1/2 -translate-y-1/2 z-50 p-3 sm:p-3.5 rounded-full bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 text-white hover:text-amber-400 transition-all shadow-2xl backdrop-blur-md group"
                title="Next Photo (Right Arrow)"
              >
                <ChevronRight className="w-6 h-6 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </>
          )}

          <div
            className="relative max-w-6xl w-full max-h-[92vh] flex flex-col items-center justify-center gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Scanner Controls & Info Header */}
            <div className="w-full flex items-center justify-between px-3 py-2 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-md text-slate-300">
              <div className="flex items-center gap-3">
                <span className="text-xs sm:text-sm font-semibold text-white truncate max-w-[180px] sm:max-w-md">
                  {previewPhoto.filename}
                </span>
                {mediaItems.length > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[11px] font-mono text-slate-300">
                    {mediaItems.findIndex((p) => p.id === previewPhoto.id) + 1} / {mediaItems.length}
                  </span>
                )}
                {Number(previewPhoto.original_size || 0) > 0 && (
                  <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[11px] font-mono text-amber-400">
                    {(Number(previewPhoto.original_size) / (1024 * 1024)).toFixed(1)} MB Original
                  </span>
                )}
                {previewPhoto.is_selected && (
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-[11px] font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>Selected</span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setActiveEditorMenuId(activeEditorMenuId === "lightbox" ? null : "lightbox")}
                    className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-xs text-amber-300 hover:text-white transition-colors flex items-center gap-1.5"
                    title="Open in Photoshop / Direct Edit"
                  >
                    <Palette className="w-3.5 h-3.5 text-amber-400" />
                    <span>Open in Photoshop / Direct Edit</span>
                    <ChevronDown className="w-3 h-3 text-amber-400/80" />
                  </button>
                  {activeEditorMenuId === "lightbox" && (
                    <div className="absolute right-0 top-full mt-1.5 w-64 rounded-xl border border-slate-700/80 bg-[#12161f] p-2 shadow-2xl shadow-black/95 z-50 space-y-1 animate-in fade-in zoom-in-95 duration-100 text-left">
                      <div className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-slate-500 border-b border-slate-800/80">
                        Launch Studio Editor
                      </div>
                      <button
                        type="button"
                        onClick={() => handleOpenInEditor("Photoshop", previewPhoto.url, previewPhoto.filename)}
                        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-200 hover:text-white hover:bg-slate-800/70 transition-colors text-left"
                      >
                        <Palette className="w-3.5 h-3.5 text-sky-400" />
                        <span>Adobe Photoshop</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenInEditor("Lightroom", previewPhoto.url, previewPhoto.filename)}
                        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-200 hover:text-white hover:bg-slate-800/70 transition-colors text-left"
                      >
                        <Camera className="w-3.5 h-3.5 text-amber-400" />
                        <span>Adobe Lightroom</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenInEditor("Premiere", previewPhoto.url, previewPhoto.filename)}
                        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-200 hover:text-white hover:bg-slate-800/70 transition-colors text-left"
                      >
                        <Film className="w-3.5 h-3.5 text-purple-400" />
                        <span>Adobe Premiere Pro</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenInEditor("CapCut", previewPhoto.url, previewPhoto.filename)}
                        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-200 hover:text-white hover:bg-slate-800/70 transition-colors text-left"
                      >
                        <Scissors className="w-3.5 h-3.5 text-emerald-400" />
                        <span>CapCut / Video Suites</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenInEditor("Direct Proof", previewPhoto.url, previewPhoto.filename)}
                        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-amber-300 hover:text-amber-200 hover:bg-amber-500/10 transition-colors text-left border-t border-slate-800/60 mt-1 pt-1.5"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Direct Studio Proof</span>
                      </button>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewPhoto(null)}
                  className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-white transition-colors"
                  title="Close (Escape)"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Photo View Display */}
            <div className="relative rounded-2xl overflow-hidden border border-slate-800/80 bg-slate-950 flex items-center justify-center max-h-[75vh] w-full shadow-2xl">
              <img
                src={previewPhoto.url || previewPhoto.thumbnail_url}
                alt={previewPhoto.filename}
                className="max-h-[75vh] w-auto max-w-full object-contain rounded-xl"
              />
            </div>

            {/* Client Notes / Retouching Instructions Bar */}
            {previewPhoto.client_notes && (
              <div className="w-full p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-center gap-2">
                <span className="font-semibold text-white shrink-0">Client Selection Note:</span>
                <span className="truncate">{previewPhoto.client_notes}</span>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Floating Editor URL Ingest Toast */}
      {editorCopiedToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-amber-500 text-slate-950 font-bold text-xs shadow-2xl shadow-amber-500/30 animate-in slide-in-from-bottom-5">
          <Check className="w-4 h-4 stroke-[3]" />
          <span>{editorCopiedToast}</span>
        </div>
      )}
    </div>
  );
}
