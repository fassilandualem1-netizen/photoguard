import React, { useState } from "react";
import { UploadCloud, ShieldCheck, FolderPlus, Loader2, CheckCircle2 } from "lucide-react";

export default function PhotoUploader({
  isSubmitted = false,
  uploading = false,
  uploadProgress = { current: 0, total: 0 },
  lastUploadSummary = null,
  fileInputRef,
  onFileUpload,
}) {
  const [isDragging, setIsDragging] = useState(false);

  if (isSubmitted) return null;

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!uploading) setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (uploading) return;

    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      onFileUpload?.({ target: { files: e.dataTransfer.files } });
    }
  };

  return (
    <div
      id="bulk-upload-section"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`p-6 rounded-3xl border transition-all duration-200 ${
        isDragging
          ? "border-amber-400 bg-amber-500/10 scale-[1.005]"
          : "border-dashed border-slate-800 bg-slate-900/30"
      } backdrop-blur-sm`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <UploadCloud className="w-4 h-4 text-amber-400" />
            <span>Upload Client Proofs</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-mono">
              <ShieldCheck className="w-3 h-3" />
              <span>End-to-End Encrypted</span>
            </span>
          </h2>
          <p className="text-xs text-slate-400">
            End-to-end encrypted proof delivery. Photos are watermarked and protected from unauthorized downloads.
            {isDragging ? " Release files to start upload!" : " Drag & drop photos anywhere here, or browse files."}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            onChange={onFileUpload}
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
            <span>
              {uploading
                ? `Uploading (${uploadProgress.current}/${uploadProgress.total})...`
                : "Select Photos"}
            </span>
          </label>
        </div>
      </div>

      {/* High-Speed Upload Progress Bar */}
      {uploading && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
            <span className="flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
              <span>
                Uploading {uploadProgress.current} of {uploadProgress.total} photos...
              </span>
            </span>
            <span>
              {uploadProgress.current} / {uploadProgress.total} (
              {uploadProgress.total > 0
                ? Math.round((uploadProgress.current / uploadProgress.total) * 100)
                : 0}
              %)
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-200"
              style={{
                width: `${
                  uploadProgress.total > 0
                    ? (uploadProgress.current / uploadProgress.total) * 100
                    : 0
                }%`,
              }}
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
  );
}
