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

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target)) {
        setIsExportOpen(false);
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

    try {
      const uploadPromises = files.map(async (file) => {
        const formData = new FormData();
        formData.append("file", file);
        const res = await api.post(`/api/v1/media/upload/${id}`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setUploadProgress((prev) => ({ ...prev, current: prev.current + 1 }));
        return res.data;
      });

      const results = await Promise.allSettled(uploadPromises);

      let successCount = 0;
      let failureCount = 0;
      let failureReason = "";
      let isLockedError = false;

      results.forEach((res) => {
        if (res.status === "fulfilled") {
          successCount += 1;
        } else {
          failureCount += 1;
          const status = res.reason?.response?.status;
          const detail = res.reason?.response?.data?.detail;
          if (status === 423 || status === 409) {
            isLockedError = true;
          }
          if (detail && !failureReason) {
            failureReason = detail;
          }
        }
      });

      // If locked, instantly force album.is_locked = true so the banner appears immediately
      if (isLockedError) {
        setAlbum((prev) => (prev ? { ...prev, is_locked: true } : prev));
      }

      // Display UI summary if any uploads failed
      if (failureCount > 0) {
        const reasonText = isLockedError
          ? "Album is locked"
          : failureReason || "Quota Exceeded";
        setUploadError(`${successCount} Uploaded | ${failureCount} Failed - ${reasonText}`);
      } else {
        setUploadError(null);
      }

      // Always fetch album detail so successful uploads are never discarded
      await fetchAlbumDetail(false);
    } catch (err) {
      const status = err.response?.status;
      if (status === 423 || status === 409) {
        setAlbum((prev) => (prev ? { ...prev, is_locked: true } : prev));
      }
      const msg =
        err.response?.data?.detail ||
        "Error uploading photos. Check storage quota or file sizes and retry.";
      setUploadError(msg);
      await fetchAlbumDetail(false);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
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
    if (!window.confirm("Are you sure you want to remove this photo? Cloud storage will be reclaimed.")) {
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
  const selectedItems = mediaItems.filter((m) => m.is_selected);
  const exportItems = selectedItems.length > 0 ? selectedItems : mediaItems;

  // NATIVE EXPORT ENGINES - Targets ORIGINAL URLs for lossless editing
  const handleOpenLightroom = () => {
    if (exportItems.length === 0) return;
    console.log(
      "Opening Lightroom with ORIGINAL RAW/JPEG URLs:",
      exportItems.map((item) => ({ filename: item.filename, original_url: item.url }))
    );

    // Deep link integration / placeholder batch open
    exportItems.slice(0, 5).forEach((item) => {
      window.open(item.url, "_blank");
    });
    if (exportItems.length > 5) {
      alert(
        `Opened first 5 original files. For all ${exportItems.length} photos, use 'Copy Original URLs' or 'Download Manifest' to import directly into Lightroom.`
      );
    }
    setIsExportOpen(false);
  };

  const handleOpenPhotoshop = () => {
    if (exportItems.length === 0) return;
    console.log(
      "Opening Photoshop with ORIGINAL RAW/JPEG URLs:",
      exportItems.map((item) => ({ filename: item.filename, original_url: item.url }))
    );

    // Deep link integration / placeholder batch open
    exportItems.slice(0, 5).forEach((item) => {
      window.open(item.url, "_blank");
    });
    if (exportItems.length > 5) {
      alert(
        `Opened first 5 original files. For all ${exportItems.length} photos, use 'Copy Original URLs' or 'Download Manifest' to import directly into Photoshop.`
      );
    }
    setIsExportOpen(false);
  };

  const handleCopyOriginalUrls = async () => {
    if (exportItems.length === 0) return;
    const urlsText = exportItems.map((item) => item.url).join("\n");
    try {
      await navigator.clipboard.writeText(urlsText);
      setCopiedUrls(true);
      setTimeout(() => setCopiedUrls(false), 2500);
    } catch {
      console.warn("Clipboard access denied. Falling back to prompt.");
    }
    setIsExportOpen(false);
  };

  const handleDownloadManifest = () => {
    if (exportItems.length === 0) return;
    const lines = [
      `# PhotoGuard Original Proof Export Manifest`,
      `# Album: ${album.title}`,
      `# Client: ${album.client_name}`,
      `# Date: ${new Date().toISOString()}`,
      `# Total Export Files: ${exportItems.length}`,
      "",
      ...exportItems.map((item, idx) => `${idx + 1}. ${item.filename} | ${item.url}`),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${album.title.replace(/\s+/g, "_")}_original_selections.txt`;
    link.click();
    URL.revokeObjectURL(url);
    setIsExportOpen(false);
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
      {/* Navigation Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span>Back to Proof Galleries</span>
        </Link>

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
        </div>
      </div>

      {/* Top Header Section */}
      <div className="p-6 sm:p-8 rounded-3xl border border-slate-800/90 bg-gradient-to-br from-slate-900/90 via-slate-900/50 to-[#0d0f12] backdrop-blur-xl shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-6">
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
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
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
                {album.pin || album.client_pin}
              </p>
            </div>
          </div>

          {/* STUDIO PLAN ONLY: Extend Expiration Button */}
          {isStudio && (
            <button
              id="extend-expiration-btn"
              type="button"
              onClick={handleExtendExpiration}
              disabled={extending}
              className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 hover:text-amber-200 font-semibold text-xs transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              title="Add 7 days to this album's lifespan (Studio plan feature)"
            >
              {extending ? (
                <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
              ) : (
                <CalendarPlus className="w-4 h-4 text-amber-400" />
              )}
              <span>{extending ? "Extending..." : "Extend Expiration (+7 Days)"}</span>
            </button>
          )}

          {/* Export Selections Dropdown (Targets Original URLs) */}
          <div className="relative" ref={exportDropdownRef}>
            <button
              id="export-selections-dropdown-btn"
              type="button"
              onClick={() => setIsExportOpen((prev) => !prev)}
              className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700/80 border border-slate-700/80 text-white font-semibold text-xs transition-all shadow-lg"
            >
              <Sliders className="w-4 h-4 text-amber-400" />
              <span>Export Selections ({selectedItems.length})</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExportOpen ? "rotate-180" : ""}`} />
            </button>

            {isExportOpen && (
              <div className="absolute right-0 mt-2 w-72 rounded-2xl border border-slate-800 bg-[#141820] p-2 shadow-2xl z-30 space-y-1">
                <div className="px-3 py-2 border-b border-slate-800/80">
                  <p className="text-xs font-semibold text-white">
                    Original High-Res Selections
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Targets original uncompressed URLs for professional color grading.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleOpenLightroom}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800/70 transition-colors text-left"
                >
                  <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Open with Adobe Lightroom</span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenPhotoshop}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800/70 transition-colors text-left"
                >
                  <Sliders className="w-4 h-4 text-sky-400 shrink-0" />
                  <span>Open with Adobe Photoshop</span>
                </button>

                <div className="my-1 border-t border-slate-800/80" />

                <button
                  type="button"
                  onClick={handleCopyOriginalUrls}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800/70 transition-colors text-left"
                >
                  <Copy className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>Copy Original URLs List</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadManifest}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800/70 transition-colors text-left"
                >
                  <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>Download Manifest (.txt)</span>
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
                : "Select multiple RAW or JPEG photos. Compressed WebP previews are generated automatically while preserving original URLs."}
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
              const originalMb = item.original_size
                ? (item.original_size / (1024 * 1024)).toFixed(1)
                : null;

              return (
                <div
                  key={item.id}
                  id={`media-item-${item.id}`}
                  className="break-inside-avoid rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden group hover:border-slate-700 transition-all shadow-md relative"
                >
                  {/* Photo Container */}
                  <div className="relative overflow-hidden bg-slate-950">
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

                    {/* Original Badge */}
                    {originalMb && (
                      <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md bg-black/75 border border-slate-700/60 text-[10px] font-mono text-slate-300">
                        {originalMb} MB Original
                      </div>
                    )}

                    {/* Hover Quick Actions */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-[2px]">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 rounded-xl bg-slate-900/90 border border-slate-700 text-slate-200 hover:text-white hover:bg-slate-800 transition-colors"
                        title="View Original High-Res"
                      >
                        <Eye className="w-4 h-4" />
                      </a>
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
    </div>
  );
}
