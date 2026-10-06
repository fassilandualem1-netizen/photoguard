import React, { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import AlbumLightbox from "../components/AlbumLightbox";
import PhotoUploader from "../components/PhotoUploader";
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

// Memory-safe, non-blocking client-side image optimizer for blazing fast uploads & quota saving
const compressImageForProofing = async (file, maxDimension = 2400, quality = 0.86) => {
  // Defensive validation: if not a valid File/Blob or not an image, return original untouched
  if (
    !file ||
    typeof window === "undefined" ||
    typeof document === "undefined" ||
    !document.createElement ||
    !file.type ||
    !file.type.startsWith("image/") ||
    file.type === "image/svg+xml" ||
    file.type === "image/gif"
  ) {
    return file;
  }

  // If already lightweight (< 900KB), keep original to avoid re-encoding
  if (file.size <= 900 * 1024) {
    return file;
  }

  return new Promise((resolve) => {
    let resolved = false;
    let objectUrl = null;

    const safeResolve = (result) => {
      if (!resolved) {
        resolved = true;
        if (objectUrl) {
          try {
            URL.revokeObjectURL(objectUrl);
          } catch (_) {}
          objectUrl = null;
        }
        resolve(result);
      }
    };

    // Hard safety timeout (6 seconds max per image) - guarantees upload never hangs
    const timeoutId = setTimeout(() => {
      safeResolve(file);
    }, 6000);

    try {
      objectUrl = URL.createObjectURL(file);
      const img = new Image();

      img.onload = () => {
        try {
          clearTimeout(timeoutId);
          let { width, height } = img;

          // If dimensions are invalid or zero, fallback immediately
          if (!width || !height || width <= 0 || height <= 0) {
            safeResolve(file);
            return;
          }

          // Calculate aspect ratio preserving dimensions with 2400px max edge
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext("2d");
          if (!ctx) {
            safeResolve(file);
            return;
          }

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              try {
                if (blob && blob.size > 0 && blob.size < file.size) {
                  const compressedFile = new File([blob], file.name, {
                    type: "image/jpeg",
                    lastModified: file.lastModified || Date.now(),
                  });
                  safeResolve(compressedFile);
                } else {
                  safeResolve(file);
                }
              } catch (fileErr) {
                console.warn("File constructor fallback:", fileErr);
                safeResolve(file);
              }
            },
            "image/jpeg",
            quality
          );
        } catch (err) {
          console.warn("Canvas processing error, using original file:", err);
          clearTimeout(timeoutId);
          safeResolve(file);
        }
      };

      img.onerror = (err) => {
        console.warn("Image load error during compression, using original file:", err);
        clearTimeout(timeoutId);
        safeResolve(file);
      };

      img.src = objectUrl;
    } catch (err) {
      console.warn("Compression initialization error, using original file:", err);
      clearTimeout(timeoutId);
      safeResolve(file);
    }
  });
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
  const [uploadError, setUploadError] = useState(null);

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

  const mediaItems = album?.media_items || [];
  const selectedItems = mediaItems.filter((m) => m.is_selected);
  const isSubmitted = Boolean(
    album?.is_submitted ||
    album?.is_locked ||
    album?.submitted_at ||
    album?.status === "submitted" ||
    album?.status === "locked"
  );

  // HIGH-SPEED CONCURRENT BULK UPLOAD (Pool of 4 parallel workers)
  const handleFileUpload = async (e) => {
    const fileList = Array.from(e.target.files || []);
    if (!fileList || fileList.length === 0) return;

    if (isSubmitted) {
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
        if (!navigator.onLine) {
          setUploadError("You appear to be offline. Please check your internet connection.");
          setUploading(false);
          return;
        }
    }

    // Direct-to-Cloud Upload Worker (High-Speed Edge Upload)
    const uploadSingleFileDirect = async (file) => {
      let attempts = 0;
      while (attempts < 2) {
        try {
          // Pre-compress in browser (safe 10x-15x bandwidth and storage savings)
          let fileToUpload = file;
          try {
            fileToUpload = await compressImageForProofing(file);
          } catch (compErr) {
            console.warn("Client compression fallback:", compErr);
            fileToUpload = file;
          }

          let highResUrl = "";
          let originalSize = fileToUpload?.size || file.size;

          if (sigConfig?.signature && sigConfig?.upload_url) {
            // DIRECT TO CLOUDINARY EDGE (Bypasses backend server completely)
            const cldFormData = new FormData();
            cldFormData.append("file", fileToUpload);
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
            fallbackData.append("file", fileToUpload);
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



  // Client Invite Text & Deep Linking
  const albumPin = album?.pin || album?.client_pin || "";
  const shareText = `Your private proof gallery is ready! Access PIN: ${albumPin}. Review proofs & mark your selections here: https://photoguard.com/app`;

  const handleCopyInviteMessage = async () => {
    try {
      await navigator.clipboard.writeText(albumPin);
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

  // Clean, Beautifully Formatted Retouching Job Sheet Generator (00_JOB_SHEET.txt)
  const generateJobSheetText = (albumObj, targetPhotos, totalCount) => {
    const albumName = albumObj?.title || "Gallery Proofs";
    const pin = albumObj?.pin || albumObj?.client_pin || "N/A";

    let out = "============================================================\n";
    out += "PHOTOGUARD - RETOUCHING JOB SHEET\n";
    out += `Album: ${albumName} | PIN: ${pin} | Total Photos: ${totalCount}\n`;
    out += "============================================================\n\n";

    targetPhotos.forEach((item, idx) => {
      const pad = String(idx + 1).padStart(2, "0");
      const name = item.downloadFilename || item.filename || `Photo_${idx + 1}.jpg`;
      out += `[${pad}] ${name}\n`;
    });

    return out;
  };

  // NATIVE FOLDER DOWNLOAD (window.showDirectoryPicker)
  // Downloads client-selected photos (or all proofs if none specifically marked)
  const handleDownloadAll = async () => {
    if (!canDownloadAll) {
      alert("No photos available to download yet.");
      return;
    }

    const rawTargetPhotos = (isSubmitted || selectedItems.length > 0) ? selectedItems : mediaItems;

    const preparedDownloads = (Array.isArray(rawTargetPhotos) ? rawTargetPhotos : []).map((item, idx) => {
      const pad = String(idx + 1).padStart(2, "0");
      const rawName = item.filename || `Photo_${idx + 1}.jpg`;
      return {
        ...item,
        downloadFilename: `${pad}_${rawName}`,
      };
    });

    const supportsDirectoryPicker = typeof window !== "undefined" && "showDirectoryPicker" in window;
    if (!supportsDirectoryPicker) {
      handleFallbackMultiDownload(preparedDownloads);
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
        total: preparedDownloads.length,
        currentFilename: "Creating 00_JOB_SHEET.txt...",
        folderName: dirHandle.name,
        completed: false,
        successCount: 0,
        failedFiles: [],
      });

      // Step 1: Write 00_JOB_SHEET.txt at the very top of the designated folder
      try {
        const jobSheetText = generateJobSheetText(album, preparedDownloads, preparedDownloads.length);
        const jobSheetHandle = await dirHandle.getFileHandle("00_JOB_SHEET.txt", { create: true });
        const jobSheetWritable = await jobSheetHandle.createWritable();
        await jobSheetWritable.write(jobSheetText);
        await jobSheetWritable.close();
      } catch (jsErr) {
        console.warn("Could not write 00_JOB_SHEET.txt:", jsErr);
      }

      let successCount = 0;
      const failedFiles = [];

      // Step 2: Stream all high-resolution photos directly into the selected folder
      for (let i = 0; i < preparedDownloads.length; i++) {
        const item = preparedDownloads[i];
        const filename = item.downloadFilename;

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

  const handleFallbackMultiDownload = async (preparedDownloads) => {
    alert("Your browser does not support direct directory write. Files and 00_JOB_SHEET.txt will be downloaded individually.");

    // First download 00_JOB_SHEET.txt
    try {
      const jobSheetText = generateJobSheetText(album, preparedDownloads, preparedDownloads.length);
      const blob = new Blob([jobSheetText], { type: "text/plain;charset=utf-8" });
      const jobSheetUrl = URL.createObjectURL(blob);
      const jsA = document.createElement("a");
      jsA.href = jobSheetUrl;
      jsA.download = "00_JOB_SHEET.txt";
      document.body.appendChild(jsA);
      jsA.click();
      document.body.removeChild(jsA);
      URL.revokeObjectURL(jobSheetUrl);
      await new Promise((r) => setTimeout(r, 200));
    } catch (err) {
      console.warn("Fallback job sheet download error:", err);
    }

    for (const item of preparedDownloads) {
      if (!item.url) continue;
      try {
        const blob = await fetchPhotoBlob(item.url, item.id);
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = item.downloadFilename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch {
        const a = document.createElement("a");
        a.href = item.url;
        a.download = item.downloadFilename;
        a.target = "_blank";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      await new Promise((r) => setTimeout(r, 250));
    }
  };

  // Lightbox navigation
  const activeList = isSubmitted
    ? selectedItems
    : (activeViewTab === "selections" ? selectedItems : mediaItems);

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



  if (loading) {
    return (
      <div id="album-detail-loading" className="flex flex-col items-center justify-center py-28 text-slate-500 dark:text-slate-400">
        <div className="w-9 h-9 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin mb-4" />
        <p className="text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Loading gallery proofs...
        </p>
      </div>
    );
  }

  if (error || !album) {
    return (
      <div id="album-detail-error" className="p-8 rounded-2xl border border-red-200 bg-red-50 text-red-700 max-w-xl mx-auto my-12 flex flex-col items-start gap-4">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-6 h-6 text-red-400 shrink-0" />
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Gallery Access Issue</h2>
        </div>
        <p className="text-xs text-red-200 leading-relaxed">
          {error || "Album not found or access denied."}
        </p>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-700 text-slate-900 dark:text-white font-semibold text-xs transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Dashboard</span>
        </Link>
      </div>
    );
  }

  const daysLeft = calculateDaysLeft(album.expires_at);
  // When album is submitted/locked, strictly filter to ONLY client-selected photos (unselected disappear)
  const displayPhotos = isSubmitted
    ? selectedItems
    : (activeViewTab === "selections" ? selectedItems : mediaItems);

  // Download All button enablement: active if client made selections OR if submitted with photos
  const canDownloadAll = selectedItems.length > 0 || (isSubmitted && mediaItems.length > 0);

  return (
    <div id="album-detail-page" className="space-y-6 max-w-7xl mx-auto pb-16">
      
      {/* Top Navigation & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300 dark:text-slate-400 hover:text-indigo-600 transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform text-indigo-600" />
          <span>Back to All Galleries</span>
        </Link>

        {/* Studio Plan Badge */}
        {isStudio && (
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-indigo-500 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span>Studio Tier Active</span>
          </div>
        )}
      </div>

      {/* Main Album Header Card (NO overflow-hidden to prevent clipping dropdowns) */}
      <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-[#0b0e14] border border-slate-200 dark:border-slate-800 shadow-md relative z-30">
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                {album.title}
              </h1>

              {/* Status Badges */}
              {isSubmitted ? (
                <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold border border-emerald-500/40 flex items-center gap-1.5 shadow-sm">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Selection Submitted & Locked</span>
                </span>
              ) : selectedItems.length > 0 ? (
                <span className="px-3 py-1 rounded-full bg-amber-500/20 text-indigo-500 text-xs font-semibold border border-amber-500/40 flex items-center gap-1.5 shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <span>{selectedItems.length} Selections In Review</span>
                </span>
              ) : (
                <span className="w-7 h-7 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center" title="Client Selecting">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
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
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
              

              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                <span>
                  {daysLeft !== null ? `${daysLeft} days remaining` : "Permanent storage"}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                <span>{mediaItems.length} total proofs uploaded</span>
              </div>

              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
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
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all border cursor-pointer ${
                album.allow_download
                  ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25 shadow-lg shadow-emerald-500/10"
                  : "bg-slate-50 dark:bg-[#111620] dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 dark:text-slate-400 hover:text-slate-900 dark:text-white hover:bg-slate-100 dark:bg-slate-800"
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
                <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
              ) : album.allow_download ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <Lock className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              )}
              <span>
                {album.allow_download ? "Allow to Download (On)" : "Allow to Download"}
              </span>
              {!isStudio && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-indigo-600 border border-amber-500/30">
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
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-slate-900 dark:text-white font-semibold text-xs transition-all shadow-sm cursor-pointer"
                  title="Share PIN directly with client via WhatsApp, Telegram, or message"
                >
                  <Share2 className="w-4 h-4 text-slate-950 stroke-[2.5]" />
                  <span>Share PIN</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isShareOpen ? "rotate-180" : ""}`} />
                </button>

                {isShareOpen && (
                  <div className="absolute right-0 top-full mt-2 w-80 sm:w-88 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0b0e14] p-3.5 shadow-2xl shadow-black/95 z-50 space-y-2.5 animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-2 py-1 border-b border-slate-200 dark:border-slate-800">
                      <p className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Share2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Share PIN with Client</span>
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                        Private PIN: <span className="font-mono font-bold text-indigo-600 text-xs">{albumPin}</span>
                      </p>
                    </div>

                    {/* WhatsApp Direct Link */}
                    <a
                      id="share-whatsapp-btn"
                      href={`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setIsShareOpen(false)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-emerald-200 hover:text-slate-900 dark:text-white bg-emerald-950/50 hover:bg-emerald-900/60 border border-emerald-500/30 hover:border-emerald-500/60 transition-all text-left group cursor-pointer"
                    >
                      <div className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-600 shrink-0 group-hover:scale-105 transition-transform">
                        <MessageCircle className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <div className="font-bold text-slate-900 dark:text-white">Share via WhatsApp</div>
                        <div className="text-[10px] text-emerald-600/80">Direct pre-filled chat invite</div>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 group-hover:text-emerald-300 transition-colors" />
                    </a>

                    {/* Telegram Direct Link */}
                    <a
                      id="share-telegram-btn"
                      href={`https://t.me/share/url?url=${encodeURIComponent("https://photoguard.com/app")}&text=${encodeURIComponent(shareText)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setIsShareOpen(false)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-sky-200 hover:text-slate-900 dark:text-white bg-sky-950/50 hover:bg-sky-900/60 border border-sky-500/30 hover:border-sky-500/60 transition-all text-left group cursor-pointer"
                    >
                      <div className="w-7 h-7 rounded-lg bg-sky-500/20 flex items-center justify-center text-sky-400 shrink-0 group-hover:scale-105 transition-transform">
                        <Send className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <div className="font-bold text-slate-900 dark:text-white">Share via Telegram</div>
                        <div className="text-[10px] text-sky-400/80">Instant messenger broadcast</div>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 group-hover:text-sky-300 transition-colors" />
                    </a>

                    <div className="border-t border-slate-200 dark:border-slate-800 pt-2 space-y-2">
                      <button
                        type="button"
                        id="copy-invite-text-btn"
                        onClick={handleCopyInviteMessage}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-indigo-500 hover:text-slate-900 dark:text-white hover:bg-amber-500/10 border border-transparent hover:border-amber-500/30 transition-colors text-left cursor-pointer"
                      >
                        <Copy className="w-4 h-4 text-indigo-600 shrink-0" />
                        <span>{copiedInvite ? "Copied to Clipboard!" : "Copy PIN"}</span>
                      </button>

                      
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
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-indigo-500 hover:text-amber-200 font-semibold text-xs transition-all shadow-md disabled:opacity-50 cursor-pointer"
                title="Extend Lifespan (+7 Days)"
              >
                {extending ? (
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                ) : (
                  <CalendarPlus className="w-4 h-4 text-indigo-600" />
                )}
                <span>{extending ? "Extending..." : "Extend Lifespan (+7 Days)"}</span>
              </button>
            )}

            {/* REVIEW SELECTIONS BUTTON */}
            <button
              id="top-review-selections-btn"
              type="button"
              onClick={() => setActiveViewTab(activeViewTab === "selections" ? "all" : "selections")}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs sm:text-sm border transition-all cursor-pointer ${
                activeViewTab === "selections"
                  ? "bg-amber-500/20 text-indigo-500 border-amber-500/40 shadow-lg shadow-amber-500/10"
                  : "bg-slate-100 dark:bg-slate-800 hover:bg-slate-700 text-slate-900 dark:text-white border-slate-200 dark:border-slate-800"
              }`}
              title={activeViewTab === "selections" ? "Show All Proofs" : "Review Client Selections"}
            >
              <CheckSquare className="w-4 h-4 text-indigo-600" />
              <span>Review Selections ({selectedItems.length})</span>
            </button>

            {/* DOWNLOAD ALL BUTTON: Active if selections exist or submitted */}
            <button
              id="download-all-btn"
              type="button"
              onClick={handleDownloadAll}
              disabled={!canDownloadAll || isDownloadingFolder}
              className={`inline-flex items-center gap-2.5 px-5 py-2 rounded-xl font-bold text-xs sm:text-sm transition-all shadow-xl ${
                canDownloadAll
                  ? "bg-gradient-to-r from-amber-500 via-amber-400 to-amber-200 text-slate-950 hover:brightness-110 active:scale-[0.98] shadow-amber-500/20 cursor-pointer"
                  : "bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 cursor-not-allowed opacity-60 shadow-none"
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
                  <FolderDown className={`w-4 h-4 stroke-[2.4] ${canDownloadAll ? "text-slate-950" : "text-slate-500 dark:text-slate-400"}`} />
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
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{deliveryToast}</span>
        </div>
      )}

      {/* Client Submitted Alert */}
      {isSubmitted && (
        <div
          id="single-submit-locked-banner"
          className="p-4 rounded-2xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-200 flex items-center gap-3 animate-in fade-in"
        >
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="text-sm font-medium">Client has submitted their selections</span>
        </div>
      )}

      {/* Upload Section: Modularized PhotoUploader */}
      <PhotoUploader
        isSubmitted={isSubmitted}
        uploading={uploading}
        uploadProgress={uploadProgress}
        lastUploadSummary={lastUploadSummary}
        fileInputRef={fileInputRef}
        onFileUpload={handleFileUpload}
      />
      {/* GALLERY WORKFLOW SECTION: View Switcher (All Proofs vs Review Selections) */}
      <div id="gallery-workflow-section" className="space-y-4">
        
        {/* Navigation Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
          
          <div className="flex items-center gap-2">
            {/* Tab 1: All Proofs (Default active tab) */}
            <button
              type="button"
              id="tab-all-photos-btn"
              onClick={() => setActiveViewTab("all")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeViewTab === "all"
                  ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-[#111620] dark:bg-[#111620] dark:bg-slate-800/50"
              }`}
            >
              <span>All Proofs</span>
              <span className="px-2 py-0.5 rounded-full bg-slate-50 dark:bg-[#111620] dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 dark:text-slate-400 text-[10px] font-mono">
                {mediaItems.length}
              </span>
            </button>

          </div>

          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <span>
              Showing {displayPhotos.length} of {mediaItems.length} photos
            </span>
            {selectedItems.length > 0 && activeViewTab === "all" && (
              <span className="text-indigo-600 font-semibold">
                ({selectedItems.length} selected by client)
              </span>
            )}
          </div>
        </div>

        {/* Gallery Grid */}
        {displayPhotos.length === 0 ? (
          <div className="py-16 text-center rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#111620] dark:bg-slate-800/50 max-w-xl mx-auto p-8 space-y-3">
            {activeViewTab === "selections" ? (
              <>
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-indigo-600 flex items-center justify-center mx-auto">
                  <CheckSquare className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">No Client Selections Yet</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Once your client enters PIN <span className="font-mono text-indigo-500 font-bold">{albumPin}</span> in the mobile app and submits their selected photos , they will appear right here.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveViewTab("all")}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-700 text-slate-900 dark:text-white text-xs font-semibold transition-colors mt-2 cursor-pointer"
                >
                  View All Uploaded Proofs
                </button>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center mx-auto">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">No Proofs Uploaded Yet</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Select and upload photos above to create this gallery's proof collection.
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-3.5 sm:gap-4">
            {(Array.isArray(displayPhotos) ? displayPhotos : []).map((item) => {
              return (
                <div
                  key={item.id}
                  id={`media-item-${item.id}`}
                  className="group relative aspect-[4/3] rounded-2xl sm:rounded-3xl overflow-hidden bg-black/60 border border-slate-200 dark:border-slate-800 hover:border-amber-400/50 transition-all duration-300 shadow-lg cursor-pointer"
                  onClick={() => setPreviewPhoto(item)}
                >
                  {/* Pure Photo */}
                  <img
                    src={getCrispThumbnailUrl(item)}
                    alt={item.filename || "Photo"}
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />

                  {/* Elegant Hover Overlay with Zoom & Delete */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-2 backdrop-blur-[1px]">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewPhoto(item);
                      }}
                      className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#111620] dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white hover:text-indigo-600 hover:bg-slate-100 dark:bg-slate-800 transition-colors shadow-xl cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="max-w-md w-full rounded-3xl bg-white dark:bg-[#0b0e14] border border-slate-200 dark:border-slate-800 p-6 sm:p-8 space-y-6 shadow-2xl relative text-center">
            
            <div className={`w-14 h-14 rounded-2xl mx-auto flex items-center justify-center shadow-lg ${
              downloadProgress.completed
                ? "bg-emerald-50 border border-emerald-200 text-emerald-600"
                : "bg-indigo-50 border border-indigo-200 text-indigo-600"
            }`}>
              {downloadProgress.completed ? (
                <FolderCheck className="w-7 h-7" />
              ) : (
                <FolderDown className="w-7 h-7 animate-bounce" />
              )}
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {downloadProgress.completed ? "Client Selections Saved to Folder!" : "Saving to Local Folder"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Folder: <span className="font-mono text-indigo-500 font-bold">{downloadProgress.folderName || "Selected Folder"}</span>
              </p>
            </div>

            {!downloadProgress.completed ? (
              <div className="space-y-3">
                <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-200"
                    style={{
                      width: `${downloadProgress.total > 0 ? (downloadProgress.current / downloadProgress.total) * 100 : 0}%`,
                    }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-mono">
                  <span className="truncate max-w-[200px]">{downloadProgress.currentFilename}</span>
                  <span>{downloadProgress.current} / {downloadProgress.total}</span>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 text-xs text-emerald-200 space-y-2 text-left">
                <div className="font-bold flex items-center gap-1.5 text-emerald-600">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Download Complete</span>
                </div>
                <p>
                  â€¢ <strong>{downloadProgress.successCount} photos</strong> saved directly to your local folder without ZIP extraction.
                </p>
                <p>
                  â€¢ <strong>00_JOB_SHEET.txt</strong> placed at the top with client retouching instructions.
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

      {/* High-Resolution Photo Lightbox Modal */}
      <AlbumLightbox
        previewPhoto={previewPhoto}
        activeList={activeList}
        onPrev={handlePrevPhoto}
        onNext={handleNextPhoto}
        onClose={() => setPreviewPhoto(null)}
      />

    </div>
  );
}






