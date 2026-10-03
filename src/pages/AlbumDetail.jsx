import React, { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../api/axios";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import {
  ArrowLeft,
  UploadCloud,
  CheckCircle2,
  Lock,
  Unlock,
  Calendar,
  Sparkles,
  Download,
  Share2,
  Trash2,
  FolderPlus,
  AlertCircle,
  Copy,
  ChevronDown,
  CalendarPlus,
  Loader2,
  MessageCircle,
  Send,
  ZoomIn,
  ChevronLeft,
  ChevronRight,
  X,
  FolderDown,
  MessageSquare,
  Check,
  CheckSquare,
  FolderCheck,
  ExternalLink,
  ShieldCheck
} from "lucide-react";

// Upgrade Cloudinary/CDN URLs to pristine crisp high-res retina grid thumbnails
const getCrispThumbnailUrl = (item) => {
  if (!item) return "";
  const rawUrl = item.thumbnail_url || item.url || "";
  if (!rawUrl) return "";

  // If already an optimized Cloudinary URL, ensure crisp w_1000,dpr_2.0,q_auto:best,f_avif
  if (rawUrl.includes("res.cloudinary.com") && rawUrl.includes("/upload/")) {
    // Replace any legacy transformation or standard /upload/ with high-res parameters
    return rawUrl.replace(
      /\/upload\/(?:[a-zA-Z0-9_:,.-]+\/)?/,
      "/upload/f_avif,q_auto:best,dpr_2.0,w_1000,c_limit/"
    );
  }
  return rawUrl;
};

export default function AlbumDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const isStudio = user?.plan_tier === "studio";

  const [album, setAlbum] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Tab View state: "all" (All Proofs) | "selections" (Review Selections)
  // Default is "all" so photographer immediately sees all uploaded photos
  const [activeViewTab, setActiveViewTab] = useState("all");

  // Bulk Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const fileInputRef = useRef(null);

  // Extend Expiration state (Studio plan)
  const [extending, setExtending] = useState(false);
  const [extendSuccessMsg, setExtendSuccessMsg] = useState(false);

  // Studio Allow Client Download state
  const [togglingDownload, setTogglingDownload] = useState(false);
  const [deliveryToast, setDeliveryToast] = useState(null);

  // Native Folder Download state (File System Access API)
  const [isDownloadingFolder, setIsDownloadingFolder] = useState(false);
  const [downloadModalOpen, setDownloadModalOpen] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState({
    current: 0,
    total: 0,
    currentFilename: "",
    folderName: "",
    completed: false,
    successCount: 0,
    failedFiles: [],
  });

  // Share PIN dropdown state
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const shareDropdownRef = useRef(null);

  // Uploaded batch summary feedback banner
  const [lastUploadSummary, setLastUploadSummary] = useState(null);

  // Lightbox Preview Modal state
  const [previewPhoto, setPreviewPhoto] = useState(null);

  // Close dropdowns on click outside
  useEffect(() => {
    function handleClickOutside(event) {
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
      console.error("Failed to fetch album details:", err);
      setError(err.response?.data?.detail || "Failed to load album.");
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchAlbumDetail(true);
    }
  }, [id]);

  // HIGH-SPEED CONCURRENT BULK UPLOAD (Pool of 4 parallel workers)
  const handleFileUpload = async (e) => {
    const fileList = Array.from(e.target.files || []);
    if (!fileList || fileList.length === 0) return;

    if (album?.is_submitted) {
      alert("This gallery is submitted & locked by the client. Proof uploads are permanently disabled.");
      return;
    }

    setUploading(true);
    setLastUploadSummary(null);
    setUploadProgress({ current: 0, total: fileList.length });

    const totalBatchFiles = fileList.length;
    let currentIndex = 0;
    let completedCount = 0;
    let successfulUploads = 0;
    let failedUploads = 0;
    const failureReasons = [];

    // Step 1: Request presigned Cloudinary upload signature from backend
    let sigConfig = null;
    try {
      const sigRes = await api.get(`/api/v1/media/upload-signature?album_id=${id}`);
      sigConfig = sigRes.data;
    } catch (err) {
      console.warn("Direct-to-cloud signature unavailable, fallback to backend proxy.", err);
    }

    // Direct-to-Cloud Upload Worker (High-Speed Edge Upload)
    const uploadSingleFileDirect = async (file) => {
      let attempts = 0;
      while (attempts < 2) {
        try {
          let highResUrl = "";
          let originalSize = file.size;

          if (sigConfig?.signature && sigConfig?.upload_url) {
            // DIRECT TO CLOUDINARY EDGE (Bypasses backend server completely)
            const cldFormData = new FormData();
            cldFormData.append("file", file);
            cldFormData.append("api_key", sigConfig.api_key);
            cldFormData.append("timestamp", sigConfig.timestamp);
            cldFormData.append("signature", sigConfig.signature);
            cldFormData.append("folder", sigConfig.folder);

            const cldRes = await axios.post(sigConfig.upload_url, cldFormData, {
              headers: { "Content-Type": "multipart/form-data" },
            });
            highResUrl = cldRes.data.secure_url;
          } else {
            // Fallback to backend multipart upload if signature absent
            const fallbackData = new FormData();
            fallbackData.append("file", file);
            const fbRes = await api.post(`/api/v1/media/upload/${id}`, fallbackData, {
              headers: { "Content-Type": "multipart/form-data" },
            });
            highResUrl = fbRes.data.url;
          }

          if (highResUrl && sigConfig?.signature) {
            // Instantly register photo metadata into PostgreSQL
            await api.post(`/api/v1/media/save-url`, {
              album_id: parseInt(id, 10),
              filename: file.name,
              url: highResUrl,
              original_size: originalSize,
            });
          }

          successfulUploads++;
          break;
        } catch (err) {
          attempts++;
          if (attempts >= 2) {
            failedUploads++;
            const detail = err.response?.data?.error?.message || err.response?.data?.detail || err.message || "Upload error";
            failureReasons.push(`${file.name} (${detail})`);
          } else {
            await new Promise((r) => setTimeout(r, 300));
          }
        }
      }
      completedCount++;
      setUploadProgress({
        current: completedCount,
        total: totalBatchFiles,
      });
    };

    // Concurrency limit = 6 parallel direct-to-cloud streams for blazing speed
    const concurrency = Math.min(6, fileList.length);
    const workers = [];

    for (let i = 0; i < concurrency; i++) {
      workers.push(
        (async () => {
          while (currentIndex < fileList.length) {
            const file = fileList[currentIndex++];
            await uploadSingleFileDirect(file);
          }
        })()
      );
    }
    await Promise.all(workers);

    setUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    setLastUploadSummary({
      total: totalBatchFiles,
      success: successfulUploads,
      failed: failedUploads,
      reasons: failureReasons,
    });

    // Stay on "all" tab so newly uploaded photos appear immediately
    fetchAlbumDetail(false);
  };

  // Studio Allow Client Download Permission Toggle
  const handleToggleClientDownload = async () => {
    if (!isStudio) {
      alert("Direct Client Gallery Download is an exclusive Studio Plan feature. Please upgrade to Studio to enable client downloads.");
      return;
    }

    try {
      setTogglingDownload(true);
      const res = await api.post(`/api/v1/albums/${id}/toggle-download`);
      const newAllowed = res.data.allow_download;
      setAlbum((prev) => ({
        ...prev,
        allow_download: newAllowed,
      }));

      setDeliveryToast(
        newAllowed
          ? "Client Delivery Active: Clients can now download high-resolution photos in the mobile app."
          : "Client Delivery Disabled: Gallery is currently restricted to watermarked proofing."
      );
      setTimeout(() => setDeliveryToast(null), 4000);
    } catch (err) {
      console.error("Failed to toggle download permission:", err);
      alert(err.response?.data?.detail || "Failed to update download permissions.");
    } finally {
      setTogglingDownload(false);
    }
  };

  // Extend lifespan handler (Studio plan only)
  const handleExtendExpiration = async () => {
    if (!isStudio) return;
    try {
      setExtending(true);
      setExtendSuccessMsg(false);
      const response = await api.post(`/api/v1/albums/${id}/extend-expiration`);
      setAlbum((prev) => ({
        ...prev,
        expires_at: response.data.expires_at,
        days_remaining: response.data.days_remaining,
      }));
      setExtendSuccessMsg(true);
      setTimeout(() => setExtendSuccessMsg(false), 4000);
    } catch (err) {
      console.error("Failed to extend album lifespan:", err);
      alert(err.response?.data?.detail || "Failed to extend gallery lifespan.");
    } finally {
      setExtending(false);
    }
  };

  const handleDeletePhoto = async (photoId) => {
    if (album?.is_submitted) {
      alert("This gallery is submitted & locked by the client. Photos cannot be deleted.");
      return;
    }

    const confirmed = window.confirm("Are you sure you want to remove this photo from the gallery?");
    if (!confirmed) return;

    try {
      await api.delete(`/api/v1/media/${photoId}`);
      if (previewPhoto && previewPhoto.id === photoId) {
        setPreviewPhoto(null);
      }
      fetchAlbumDetail(false);
    } catch (err) {
      console.error("Failed to delete photo:", err);
      alert(err.response?.data?.detail || "Failed to delete photo.");
    }
  };

  const calculateDaysLeft = (expiresAt) => {
    if (!expiresAt) return null;
    const diff = new Date(expiresAt).getTime() - new Date().getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 0;
  };

  const mediaItems = album?.media_items || [];
  const selectedItems = mediaItems.filter((m) => m.is_selected);
  const isSubmitted = Boolean(
    album?.is_submitted ||
    album?.is_locked ||
    album?.submitted_at ||
    album?.status === "submitted" ||
    album?.status === "locked"
  );

  // Client Invite Text & Deep Linking
  const albumPin = album?.pin || album?.client_pin || "";
  const shareText = `Your private proof gallery is ready! Access PIN: ${albumPin}. Review proofs & mark your selections here: https://photoguard.com/app`;

  const handleCopyInviteMessage = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopiedInvite(true);
      setTimeout(() => setCopiedInvite(false), 2500);
    } catch {
      console.warn("Clipboard access failed.");
    }
  };

  // Helper to fetch blob with proxy fallback
  const fetchPhotoBlob = async (url, mediaId) => {
    try {
      const res = await fetch(url, { mode: "cors" });
      if (res.ok) return await res.blob();
    } catch (corsErr) {
      console.warn("Direct image fetch blocked, using studio download route:", corsErr);
    }
    const proxyRes = await api.get(`/api/v1/media/${mediaId}/download`, { responseType: "blob" });
    return proxyRes.data;
  };

  // Automated Job Sheet text generator (saved in folder upon download)
  const generateJobSheetText = (albumObj, photosList) => {
    const dateStr = new Date().toLocaleString("en-US", { dateStyle: "full", timeStyle: "medium" });
    const selectedCount = photosList.filter((p) => p.is_selected).length;
    const pin = albumObj?.pin || albumObj?.client_pin || "N/A";
    const albumTitle = albumObj?.title || "Gallery Proofs";

    let out = "========================================================================\n";
    out += "                 PHOTOGUARD STUDIO — CLIENT SELECTIONS SHEET            \n";
    out += "========================================================================\n\n";
    out += `GALLERY ALBUM : ${albumTitle}\n`;
    out += `GENERATED ON  : ${dateStr}\n`;
    out += `CLIENT PIN    : ${pin}\n`;
    out += `TOTAL PHOTOS  : ${photosList.length} (${selectedCount} client-selected)\n`;
    out += `LOCK STATUS   : ${albumObj?.is_submitted ? "CLIENT SELECTION SUBMITTED & LOCKED" : "IN REVIEW / DRAFT"}\n\n`;
    out += "========================================================================\n";
    out += "  PHOTO FILENAME                  | CLIENT RETOUCHING / SELECTION NOTE   \n";
    out += "========================================================================\n";

    photosList.forEach((photo, idx) => {
      const fn = (photo.filename || `Photo_${idx + 1}.jpg`).padEnd(32, " ");
      const note = photo.client_notes || photo.client_note || "[Standard edit / color grade]";
      out += `${fn} | ${note}\n`;
    });

    out += "========================================================================\n";
    out += "Generated automatically by PhotoGuard Studio Suite.\n";
    return out;
  };

  // NATIVE FOLDER DOWNLOAD (window.showDirectoryPicker)
  // Downloads client-selected photos (or all proofs if none specifically marked)
  const handleDownloadAll = async () => {
    if (!canDownloadAll) {
      alert("No photos available to download yet.");
      return;
    }

    const targetPhotos = selectedItems.length > 0 ? selectedItems : mediaItems;
    const supportsDirectoryPicker = typeof window !== "undefined" && "showDirectoryPicker" in window;

    if (!supportsDirectoryPicker) {
      handleFallbackMultiDownload(targetPhotos);
      return;
    }

    try {
      const dirHandle = await window.showDirectoryPicker({
        id: "photoguard_studio_downloads",
        mode: "readwrite",
        startIn: "downloads",
      });

      setIsDownloadingFolder(true);
      setDownloadModalOpen(true);
      setDownloadProgress({
        current: 0,
        total: targetPhotos.length,
        currentFilename: "Preparing local folder stream...",
        folderName: dirHandle.name,
        completed: false,
        successCount: 0,
        failedFiles: [],
      });

      let successCount = 0;
      const failedFiles = [];

      for (let i = 0; i < targetPhotos.length; i++) {
        const item = targetPhotos[i];
        const filename = item.filename || `Photo_${i + 1}.jpg`;

        setDownloadProgress((prev) => ({
          ...prev,
          current: i + 1,
          currentFilename: filename,
        }));

        try {
          const blob = await fetchPhotoBlob(item.url, item.id);
          const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(blob);
          await writable.close();
          successCount++;
        } catch (fileErr) {
          console.error(`Failed to write ${filename}:`, fileErr);
          failedFiles.push(filename);
        }
      }

      // Automatically save Job_Sheet.txt in the same local folder
      try {
        const jobSheetText = generateJobSheetText(album, targetPhotos);
        const jobSheetHandle = await dirHandle.getFileHandle("Job_Sheet.txt", { create: true });
        const jobSheetWritable = await jobSheetHandle.createWritable();
        await jobSheetWritable.write(jobSheetText);
        await jobSheetWritable.close();
      } catch (jsErr) {
        console.warn("Could not write Job_Sheet.txt:", jsErr);
      }

      setDownloadProgress((prev) => ({
        ...prev,
        completed: true,
        successCount,
        failedFiles,
      }));
    } catch (err) {
      if (err.name === "AbortError") {
        console.log("Folder selection cancelled by photographer.");
      } else {
        console.error("Native folder download error:", err);
        alert(`Folder download error: ${err.message || "Unknown error"}`);
      }
      setDownloadModalOpen(false);
    } finally {
      setIsDownloadingFolder(false);
    }
  };

  const handleFallbackMultiDownload = async (targetPhotos) => {
    alert("Your browser does not support direct directory write. Files will be downloaded individually.");

    for (const item of targetPhotos) {
      const a = document.createElement("a");
      a.href = item.url;
      a.download = item.filename || "photo.jpg";
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      await new Promise((r) => setTimeout(r, 250));
    }
  };

  // Lightbox navigation
  const activeList = activeViewTab === "selections" ? selectedItems : mediaItems;

  const handlePrevPhoto = () => {
    if (!previewPhoto || activeList.length === 0) return;
    const currentIndex = activeList.findIndex((p) => p.id === previewPhoto.id);
    if (currentIndex === -1) return;
    const prevIndex = (currentIndex - 1 + activeList.length) % activeList.length;
    setPreviewPhoto(activeList[prevIndex]);
  };

  const handleNextPhoto = () => {
    if (!previewPhoto || activeList.length === 0) return;
    const currentIndex = activeList.findIndex((p) => p.id === previewPhoto.id);
    if (currentIndex === -1) return;
    const nextIndex = (currentIndex + 1) % activeList.length;
    setPreviewPhoto(activeList[nextIndex]);
  };

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
  }, [previewPhoto, activeList]);

  if (loading) {
    return (
      <div id="album-detail-loading" className="flex flex-col items-center justify-center py-28 text-slate-400">
        <div className="w-9 h-9 rounded-full border-2 border-amber-400 border-t-transparent animate-spin mb-4" />
        <p className="text-xs font-mono uppercase tracking-wider text-slate-500">
          Loading gallery proofs...
        </p>
      </div>
    );
  }

  if (error || !album) {
    return (
      <div id="album-detail-error" className="p-8 rounded-2xl border border-red-500/20 bg-red-950/40 text-red-300 max-w-xl mx-auto my-12 flex flex-col items-start gap-4">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-6 h-6 text-red-400 shrink-0" />
          <h2 className="text-base font-bold text-white">Gallery Access Issue</h2>
        </div>
        <p className="text-xs text-red-200 leading-relaxed">
          {error || "Album not found or access denied."}
        </p>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Dashboard</span>
        </Link>
      </div>
    );
  }

  const daysLeft = calculateDaysLeft(album.expires_at);
  const displayPhotos = activeViewTab === "selections" ? selectedItems : mediaItems;

  // Download All button enablement: active if client made selections OR if submitted with photos
  const canDownloadAll = selectedItems.length > 0 || (isSubmitted && mediaItems.length > 0);

  return (
    <div id="album-detail-page" className="space-y-6 max-w-7xl mx-auto pb-16">
      
      {/* Top Navigation & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform text-amber-400" />
          <span>Back to All Galleries</span>
        </Link>

        {/* Studio Plan Badge */}
        {isStudio && (
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Studio Tier Active</span>
          </div>
        )}
      </div>

      {/* Main Album Header Card (NO overflow-hidden to prevent clipping dropdowns) */}
      <div className="p-6 sm:p-8 rounded-3xl bg-[#0e121a]/95 border border-slate-800/90 shadow-2xl backdrop-blur-xl relative z-30">
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {album.title}
              </h1>

              {/* Status Badges */}
              {isSubmitted ? (
                <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-semibold border border-amber-500/40 flex items-center gap-1.5 shadow-sm">
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Selection Submitted & Locked</span>
                </span>
              ) : selectedItems.length > 0 ? (
                <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold border border-emerald-500/40 flex items-center gap-1.5 shadow-sm">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{selectedItems.length} Selections Ready</span>
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-300 text-xs font-semibold border border-emerald-500/30 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Client In Review</span>
                </span>
              )}

              {/* Client Delivery Download Status Badge */}
              {album.allow_download && (
                <span className="px-3 py-1 rounded-full bg-sky-500/15 text-sky-300 text-xs font-semibold border border-sky-500/30 flex items-center gap-1.5">
                  <Unlock className="w-3.5 h-3.5 text-sky-400" />
                  <span>Client Delivery Active</span>
                </span>
              )}
            </div>

            {/* Gallery Meta Info */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-medium">Access PIN:</span>
                <span className="font-mono font-bold text-amber-400 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 tracking-wider text-sm shadow-inner">
                  {albumPin}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span>
                  {daysLeft !== null ? `${daysLeft} days remaining` : "Permanent storage"}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                <span>{mediaItems.length} total proofs uploaded</span>
              </div>

              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="font-semibold text-emerald-300">
                  {selectedItems.length} client selections
                </span>
              </div>
            </div>
          </div>

          {/* Header Action Buttons: Allow Client Download Toggle, Share PIN & Download All */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            
            {/* STUDIO EXCLUSIVE: Allow Client Download (Direct Gallery Delivery) Toggle */}
            <button
              type="button"
              id="toggle-client-download-btn"
              onClick={handleToggleClientDownload}
              disabled={togglingDownload}
              className={`inline-flex items-center gap-2 px-3.5 py-3 rounded-2xl text-xs font-semibold transition-all border cursor-pointer ${
                album.allow_download
                  ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25 shadow-lg shadow-emerald-500/10"
                  : "bg-slate-850/80 border-slate-700/80 text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
              title={
                isStudio
                  ? album.allow_download
                    ? "Client Delivery is ACTIVE: Clients can download high-resolution photos in mobile app. Click to disable."
                    : "Client Delivery is DISABLED: Click to allow clients to download final edited photos."
                  : "Client Gallery Delivery is a Studio Plan exclusive feature."
              }
            >
              {togglingDownload ? (
                <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
              ) : album.allow_download ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <Lock className="w-4 h-4 text-slate-500" />
              )}
              <span>
                {album.allow_download ? "Allow to Download (On)" : "Allow to Download"}
              </span>
              {!isStudio && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  Studio
                </span>
              )}
            </button>

            {/* ONE-CLICK SHARE PIN DROPDOWN: Hidden when client has submitted */}
            {!isSubmitted && (
              <div className="relative z-50" ref={shareDropdownRef}>
                <button
                  type="button"
                  id="share-pin-dropdown-btn"
                  onClick={() => setIsShareOpen(!isShareOpen)}
                  className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-slate-950 font-bold text-xs transition-all shadow-lg shadow-emerald-500/20 cursor-pointer"
                  title="Share PIN directly with client via WhatsApp, Telegram, or message"
                >
                  <Share2 className="w-4 h-4 text-slate-950 stroke-[2.5]" />
                  <span>Share PIN</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isShareOpen ? "rotate-180" : ""}`} />
                </button>

                {isShareOpen && (
                  <div className="absolute right-0 top-full mt-2 w-80 sm:w-88 rounded-2xl border border-slate-700/90 bg-[#12161f] p-3.5 shadow-2xl shadow-black/95 z-50 space-y-2.5 animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-2 py-1 border-b border-slate-800/80">
                      <p className="text-xs font-semibold text-white flex items-center gap-1.5">
                        <Share2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Share PIN with Client</span>
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                        Private PIN: <span className="font-mono font-bold text-amber-400 text-xs">{albumPin}</span>
                      </p>
                    </div>

                    {/* WhatsApp Direct Link */}
                    <a
                      id="share-whatsapp-btn"
                      href={`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setIsShareOpen(false)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-emerald-200 hover:text-white bg-emerald-950/50 hover:bg-emerald-900/60 border border-emerald-500/30 hover:border-emerald-500/60 transition-all text-left group cursor-pointer"
                    >
                      <div className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 group-hover:scale-105 transition-transform">
                        <MessageCircle className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <div className="font-bold text-white">Share via WhatsApp</div>
                        <div className="text-[10px] text-emerald-400/80">Direct pre-filled chat invite</div>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-300 transition-colors" />
                    </a>

                    {/* Telegram Direct Link */}
                    <a
                      id="share-telegram-btn"
                      href={`https://t.me/share/url?url=${encodeURIComponent("https://photoguard.com/app")}&text=${encodeURIComponent(shareText)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setIsShareOpen(false)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-sky-200 hover:text-white bg-sky-950/50 hover:bg-sky-900/60 border border-sky-500/30 hover:border-sky-500/60 transition-all text-left group cursor-pointer"
                    >
                      <div className="w-7 h-7 rounded-lg bg-sky-500/20 flex items-center justify-center text-sky-400 shrink-0 group-hover:scale-105 transition-transform">
                        <Send className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <div className="font-bold text-white">Share via Telegram</div>
                        <div className="text-[10px] text-sky-400/80">Instant messenger broadcast</div>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-sky-300 transition-colors" />
                    </a>

                    <div className="border-t border-slate-800/80 pt-2 space-y-2">
                      <button
                        type="button"
                        id="copy-invite-text-btn"
                        onClick={handleCopyInviteMessage}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-amber-300 hover:text-white hover:bg-amber-500/10 border border-transparent hover:border-amber-500/30 transition-colors text-left cursor-pointer"
                      >
                        <Copy className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>{copiedInvite ? "Copied to Clipboard!" : "Copy Invitation Message"}</span>
                      </button>

                      <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80 text-[10px] text-slate-400 font-mono leading-relaxed select-all">
                        "{shareText}"
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Studio Plan Lifespan Extension */}
            {isStudio && (
              <button
                id="extend-expiration-btn"
                type="button"
                onClick={handleExtendExpiration}
                disabled={extending}
                className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 hover:text-amber-200 font-semibold text-xs transition-all shadow-md disabled:opacity-50 cursor-pointer"
                title="Extend Lifespan (+7 Days)"
              >
                {extending ? (
                  <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                ) : (
                  <CalendarPlus className="w-4 h-4 text-amber-400" />
                )}
                <span>{extending ? "Extending..." : "Extend Lifespan (+7 Days)"}</span>
              </button>
            )}

            {/* REVIEW SELECTIONS BUTTON */}
            <button
              id="top-review-selections-btn"
              type="button"
              onClick={() => setActiveViewTab(activeViewTab === "selections" ? "all" : "selections")}
              className={`inline-flex items-center gap-2 px-4 py-3 rounded-2xl font-bold text-xs sm:text-sm border transition-all cursor-pointer ${
                activeViewTab === "selections"
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-lg shadow-amber-500/10"
                  : "bg-slate-800/80 hover:bg-slate-700 text-white border-slate-700"
              }`}
              title={activeViewTab === "selections" ? "Show All Proofs" : "Review Client Selections"}
            >
              <CheckSquare className="w-4 h-4 text-amber-400" />
              <span>Review Selections ({selectedItems.length})</span>
            </button>

            {/* DOWNLOAD ALL BUTTON: Active if selections exist or submitted */}
            <button
              id="download-all-btn"
              type="button"
              onClick={handleDownloadAll}
              disabled={!canDownloadAll || isDownloadingFolder}
              className={`inline-flex items-center gap-2.5 px-5 py-3 rounded-2xl font-bold text-xs sm:text-sm transition-all shadow-xl ${
                canDownloadAll
                  ? "bg-gradient-to-r from-amber-500 via-amber-400 to-amber-200 text-slate-950 hover:brightness-110 active:scale-[0.98] shadow-amber-500/20 cursor-pointer"
                  : "bg-slate-800/70 border border-slate-700/60 text-slate-500 cursor-not-allowed opacity-60 shadow-none"
              }`}
              title={
                canDownloadAll
                  ? `Download ${selectedItems.length > 0 ? `${selectedItems.length} client-selected photos` : `all ${mediaItems.length} photos`} to your local folder`
                  : "Download All activates when the client marks selections or submits the album"
              }
            >
              {isDownloadingFolder ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                  <span>Downloading ({downloadProgress.current}/{downloadProgress.total})...</span>
                </>
              ) : (
                <>
                  <FolderDown className={`w-4 h-4 stroke-[2.4] ${canDownloadAll ? "text-slate-950" : "text-slate-500"}`} />
                  <span>Download All {selectedItems.length > 0 ? `(${selectedItems.length})` : mediaItems.length > 0 ? `(${mediaItems.length})` : ""}</span>
                </>
              )}
            </button>

          </div>
        </div>
      </div>

      {/* Floating Delivery Status Toast */}
      {deliveryToast && (
        <div className="p-4 rounded-2xl bg-emerald-950/90 border border-emerald-500/50 text-emerald-200 text-xs font-semibold shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{deliveryToast}</span>
        </div>
      )}

      {/* Client Submitted Alert */}
      {isSubmitted && (
        <div
          id="single-submit-locked-banner"
          className="p-4 rounded-2xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-200 flex items-center gap-3 animate-in fade-in"
        >
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-sm font-medium">Client has submitted their selections</span>
        </div>
      )}

      {/* Upload Section: Streamlined, End-to-End Encrypted Copy */}
      {!isSubmitted && (
        <div
          id="bulk-upload-section"
          className="p-6 rounded-3xl border border-dashed border-slate-800 bg-slate-900/30 backdrop-blur-sm"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <UploadCloud className="w-4 h-4 text-amber-400" />
                <span>Upload Photos</span>
              </h2>
              <p className="text-xs text-slate-400">
                Drag and drop photos here, or browse files.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileUpload}
                disabled={uploading}
                className="hidden"
                id="photo-upload-input"
              />
              <label
                htmlFor="photo-upload-input"
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700/90 border border-slate-700 text-white font-semibold text-xs transition-colors cursor-pointer ${
                  uploading ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                <FolderPlus className="w-4 h-4 text-amber-400" />
                <span>{uploading ? `Uploading (${uploadProgress.current}/${uploadProgress.total})...` : "Select Photos"}</span>
              </label>
            </div>
          </div>

          {/* High-Speed Upload Progress Bar */}
          {uploading && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                <span className="flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                  <span>Uploading {uploadProgress.current} of {uploadProgress.total} photos...</span>
                </span>
                <span>
                  {uploadProgress.current} / {uploadProgress.total} (
                  {Math.round((uploadProgress.current / uploadProgress.total) * 100)}%)
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-200"
                  style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Upload Summary Feedback */}
          {lastUploadSummary && (
            <div className="mt-4 p-4 rounded-xl border border-slate-800 bg-slate-900/60 text-xs space-y-1.5">
              <div className="flex items-center gap-2 font-semibold text-white">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>
                  Batch Complete: {lastUploadSummary.success} uploaded successfully
                  {lastUploadSummary.failed > 0 && `, ${lastUploadSummary.failed} failed`}
                </span>
              </div>
              {lastUploadSummary.reasons?.length > 0 && (
                <div className="text-red-400 space-y-0.5 pt-1">
                  {lastUploadSummary.reasons.map((r, i) => (
                    <div key={i}>• {r}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* GALLERY WORKFLOW SECTION: View Switcher (All Proofs vs Review Selections) */}
      <div id="gallery-workflow-section" className="space-y-4">
        
        {/* Navigation Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          
          <div className="flex items-center gap-2">
            {/* Tab 1: All Proofs (Default active tab) */}
            <button
              type="button"
              id="tab-all-photos-btn"
              onClick={() => setActiveViewTab("all")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeViewTab === "all"
                  ? "bg-slate-800 text-white border border-slate-700 shadow-sm"
                  : "text-slate-400 hover:text-white hover:bg-slate-900/50"
              }`}
            >
              <span>All Proofs</span>
              <span className="px-2 py-0.5 rounded-full bg-slate-900 text-slate-300 text-[10px] font-mono">
                {mediaItems.length}
              </span>
            </button>

          </div>

          <div className="text-xs text-slate-400 flex items-center gap-2">
            <span>
              Showing {displayPhotos.length} of {mediaItems.length} photos
            </span>
            {selectedItems.length > 0 && activeViewTab === "all" && (
              <span className="text-amber-400 font-semibold">
                ({selectedItems.length} selected by client)
              </span>
            )}
          </div>
        </div>

        {/* Gallery Grid */}
        {displayPhotos.length === 0 ? (
          <div className="py-16 text-center rounded-3xl border border-slate-800/60 bg-slate-900/20 max-w-xl mx-auto p-8 space-y-3">
            {activeViewTab === "selections" ? (
              <>
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
                  <CheckSquare className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-white">No Client Selections Yet</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Once your client enters PIN <span className="font-mono text-amber-300 font-bold">{albumPin}</span> in the mobile app and submits their selected photos and retouching notes, they will appear right here.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveViewTab("all")}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-colors mt-2 cursor-pointer"
                >
                  View All Uploaded Proofs
                </button>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-white">No Proofs Uploaded Yet</h3>
                <p className="text-xs text-slate-400">
                  Select and upload photos above to create this gallery's proof collection.
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-3.5 sm:gap-4">
            {displayPhotos.map((item) => {
              const hasCustomNote = Boolean(item.client_notes || item.client_note);

              return (
                <div
                  key={item.id}
                  id={`media-item-${item.id}`}
                  className="group relative aspect-[4/3] rounded-2xl sm:rounded-3xl overflow-hidden bg-black/60 border border-slate-800/80 hover:border-amber-400/50 transition-all duration-300 shadow-lg cursor-pointer"
                  onClick={() => setPreviewPhoto(item)}
                >
                  {/* Pure Photo */}
                  <img
                    src={getCrispThumbnailUrl(item)}
                    alt={item.filename || "Photo"}
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />

                  {/* Subtle Client Custom Retouching Note Indicator */}
                  {hasCustomNote && (
                    <div
                      className="absolute bottom-2.5 left-2.5 p-1.5 rounded-lg bg-black/80 border border-amber-500/40 text-amber-300 backdrop-blur-md shadow-md"
                      title={`Client Request: "${item.client_notes || item.client_note}"`}
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                    </div>
                  )}

                  {/* Elegant Hover Overlay with Zoom & Delete */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-2 backdrop-blur-[1px]">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewPhoto(item);
                      }}
                      className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-white hover:text-amber-400 hover:bg-slate-800 transition-colors shadow-xl cursor-pointer"
                      title="Fullscreen Preview"
                    >
                      <ZoomIn className="w-4 h-4" />
                    </button>

                    {!isSubmitted && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePhoto(item.id);
                        }}
                        className="p-2.5 rounded-xl bg-red-950/90 border border-red-800 text-red-300 hover:bg-red-900 transition-colors shadow-xl cursor-pointer"
                        title="Delete Photo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* =========================================================================
          NATIVE FOLDER DOWNLOAD PROGRESS MODAL
          ========================================================================= */}
      {downloadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in">
          <div className="max-w-md w-full rounded-3xl bg-[#0e121a] border border-amber-500/30 p-6 sm:p-8 space-y-6 shadow-2xl relative text-center">
            
            <div className={`w-14 h-14 rounded-2xl mx-auto flex items-center justify-center shadow-lg ${
              downloadProgress.completed
                ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-400"
                : "bg-amber-500/20 border border-amber-500/40 text-amber-400"
            }`}>
              {downloadProgress.completed ? (
                <FolderCheck className="w-7 h-7" />
              ) : (
                <FolderDown className="w-7 h-7 animate-bounce" />
              )}
            </div>

            <div>
              <h3 className="text-lg font-bold text-white">
                {downloadProgress.completed ? "Client Selections Saved to Folder!" : "Saving to Local Folder"}
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Folder: <span className="font-mono text-amber-300 font-bold">{downloadProgress.folderName || "Selected Folder"}</span>
              </p>
            </div>

            {!downloadProgress.completed ? (
              <div className="space-y-3">
                <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-200"
                    style={{
                      width: `${downloadProgress.total > 0 ? (downloadProgress.current / downloadProgress.total) * 100 : 0}%`,
                    }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                  <span className="truncate max-w-[200px]">{downloadProgress.currentFilename}</span>
                  <span>{downloadProgress.current} / {downloadProgress.total}</span>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 text-xs text-emerald-200 space-y-2 text-left">
                <div className="font-bold flex items-center gap-1.5 text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Download Complete</span>
                </div>
                <p>
                  • <strong>{downloadProgress.successCount} photos</strong> saved directly to your local folder without ZIP extraction.
                </p>
                <p>
                  • <strong>Job_Sheet.txt</strong> included with client retouching instructions.
                </p>
              </div>
            )}

            <div>
              <button
                type="button"
                onClick={() => setDownloadModalOpen(false)}
                disabled={!downloadProgress.completed}
                className="w-full py-3 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {downloadProgress.completed ? "Done" : "Downloading..."}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* =========================================================================
          HIGH RESOLUTION PHOTO LIGHTBOX
          ========================================================================= */}
      {previewPhoto && (
        <div
          id="photo-lightbox-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md p-2 sm:p-4 animate-in fade-in select-none"
          onClick={() => setPreviewPhoto(null)}
        >
          {activeList.length > 1 && (
            <>
              <button
                type="button"
                id="lightbox-prev-btn"
                onClick={handlePrevPhoto}
                className="fixed left-3 sm:left-6 top-1/2 -translate-y-1/2 z-50 p-3 sm:p-3.5 rounded-full bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 text-white hover:text-amber-400 transition-all shadow-2xl backdrop-blur-md group cursor-pointer"
                title="Previous Photo (Left Arrow)"
              >
                <ChevronLeft className="w-6 h-6 group-hover:-translate-x-0.5 transition-transform" />
              </button>
              <button
                type="button"
                id="lightbox-next-btn"
                onClick={handleNextPhoto}
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
                  {activeList.findIndex((p) => p.id === previewPhoto.id) + 1} / {activeList.length}
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
                  onClick={() => setPreviewPhoto(null)}
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
      )}

    </div>
  );
}
