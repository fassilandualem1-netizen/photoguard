package com.photoguard.client.utils

import android.Manifest
import android.app.DownloadManager
import android.content.Context
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.webkit.URLUtil
import androidx.core.content.ContextCompat

/**
 * Lightweight native download utility using Android's system DownloadManager.
 * Enforces zero third-party library overhead (<5MB app footprint) and downloads
 * final delivered high-resolution photos directly to Environment.DIRECTORY_PICTURES.
 *
 * Full compatibility across Android versions:
 * - API <= 28 (Android 9 & below): Gracefully checks WRITE_EXTERNAL_STORAGE permission
 * - API >= 29 (Android 10+): Leverages Scoped Storage & native DownloadManager
 */
object DownloadUtils {

    /**
     * Checks whether the application currently holds permission to write to public storage
     * on Android 9 (API 28) and below. On Android 10+ (API 29+), Scoped Storage does not require
     * WRITE_EXTERNAL_STORAGE for public media downloads via DownloadManager.
     */
    fun hasStoragePermission(context: Context): Boolean {
        return if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.P) {
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.WRITE_EXTERNAL_STORAGE
            ) == PackageManager.PERMISSION_GRANTED
        } else {
            true
        }
    }

    /**
     * Enqueues a high-resolution photo URL with Android's system DownloadManager.
     * Elegantly handles missing permissions, invalid URLs, and disabled system download services
     * without throwing fatal exceptions, returning -1L on failure.
     *
     * @param context Application/Activity Context
     * @param fileUrl Direct HTTPS URL of the photo (Cloudinary / TiDrive / ImageKit CDN)
     * @param albumTitle Name of album to create a dedicated subfolder in Pictures/
     * @param index Order index for fallback naming
     * @return DownloadManager enqueued task ID or -1L on failure
     */
    fun enqueuePhotoDownload(
        context: Context,
        fileUrl: String,
        albumTitle: String = "PhotoGuard",
        index: Int = 1
    ): Long {
        if (fileUrl.isBlank()) return -1L

        // Verify storage permission on Android 9 and below
        if (!hasStoragePermission(context)) {
            return -1L
        }

        return runCatching {
            val downloadManager = context.getSystemService(Context.DOWNLOAD_SERVICE) as? DownloadManager
                ?: return -1L

            val uri = Uri.parse(fileUrl)
            val scheme = uri.scheme?.lowercase()
            if (scheme != "http" && scheme != "https") {
                return -1L
            }

            val rawFileName = URLUtil.guessFileName(fileUrl, null, "image/jpeg")
            val sanitizedAlbumFolder = albumTitle.replace(Regex("[^a-zA-Z0-9._-]"), "_")
            val finalFileName = if (rawFileName.isNotBlank() && rawFileName != "downloadfile") {
                rawFileName
            } else {
                "Photo_${index}_${System.currentTimeMillis()}.jpg"
            }

            val subPath = "PhotoGuard/$sanitizedAlbumFolder/$finalFileName"

            val request = DownloadManager.Request(uri).apply {
                setTitle(finalFileName)
                setDescription("Downloading high-resolution photo from $albumTitle")
                setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                setDestinationInExternalPublicDir(Environment.DIRECTORY_PICTURES, subPath)
                setAllowedOverMetered(true)
                setAllowedOverRoaming(true)
            }

            downloadManager.enqueue(request)
        }.getOrElse {
            // Intercept SecurityException, IllegalArgumentException, or IllegalStateException safely
            -1L
        }
    }

    /**
     * Batch enqueues multiple high-res photo URLs.
     * Returns the count of successfully queued downloads without interrupting on single item failures.
     */
    fun enqueueBatchDownloads(
        context: Context,
        urls: List<String>,
        albumTitle: String = "PhotoGuard"
    ): Int {
        var queuedCount = 0
        urls.forEachIndexed { idx, url ->
            val id = enqueuePhotoDownload(context, url, albumTitle, idx + 1)
            if (id != -1L) {
                queuedCount++
            }
        }
        return queuedCount
    }
}
