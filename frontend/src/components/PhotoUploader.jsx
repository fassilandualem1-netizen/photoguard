import React, { useState } from "react";
import { UploadCloud, FolderPlus, Loader2, CheckCircle2, AlertCircle, XCircle } from "lucide-react";

export default function PhotoUploader({
  isSubmitted = false,
  uploading = false,
  uploadProgress = { current: 0, total: 0 },
  lastUploadSummary = null,
  fileInputRef,
  onFileUpload,
  uploadError = null,
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
          ? "border-indigo-400 bg-indigo-50 scale-[1.005]"
          : "border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#111620] dark:bg-slate-800/50"
      } backdrop-blur-sm`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <UploadCloud className="w-4 h-4 text-indigo-600" />
            <span>Upload Photos</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {isDragging ? "Release files to start upload" : "Drag and drop photos here, or browse files."}
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
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 border border-indigo-700 text-white shadow-sm font-semibold text-xs transition-colors cursor-pointer ${
              uploading ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            <FolderPlus className="w-4 h-4 text-white" />
            <span>
              {uploading
                ? `Uploading (${uploadProgress.current}/${uploadProgress.total})...`
                : "Select Photos"}
            </span>
          </label>
        </div>
      </div>

      {/* Network / Upload Error Banner */}
      {uploadError && !uploading && (
        <div className="mt-4 p-3.5 rounded-xl border border-red-200 bg-red-50 flex items-start gap-3 text-xs text-red-700">
          <XCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
          <div>
            <p className="font-semibold mb-0.5">Upload failed</p>
            <p>{uploadError}</p>
          </div>
        </div>
      )}

      {/* High-Speed Upload Progress Bar */}
      {uploading && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-mono">
            <span className="flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
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
          <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 transition-all duration-200"
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
        <div className="mt-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0b0e14] shadow-sm text-xs space-y-1.5">
          <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
            {lastUploadSummary.failed > 0 ? (
              <AlertCircle className="w-4 h-4 text-amber-500" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            )}
            <span>
              Batch Complete: {lastUploadSummary.success} uploaded successfully
              {lastUploadSummary.failed > 0 && `, ${lastUploadSummary.failed} failed`}
            </span>
          </div>
          {lastUploadSummary.reasons?.length > 0 && (
            <div className="text-red-500 space-y-0.5 pt-1">
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
