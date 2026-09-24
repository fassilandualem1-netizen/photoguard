package com.photoguard.client.utils

import android.app.DownloadManager
import android.content.Context
import android.net.Uri
import android.os.Environment
import android.webkit.URLUtil

/**
 * Lightweight native download utility using Android's system DownloadManager.
 * Enforces zero third-party library overhead (<5MB app footprint) and downloads
 * final delivered high-resolution photos directly to Environment.DIRECTORY_PICTURES.
 */
object DownloadUtils {

    /**
     * Enqueues a high-resolution photo URL with Android's system DownloadManager.
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
        return runCatching {
            val downloadManager = context.getSystemService(Context.DOWNLOAD_SERVICE) as? DownloadManager
                ?: return -1L

            val uri = Uri.parse(fileUrl)
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
        }.getOrDefault(-1L)
    }

    /**
     * Batch enqueues multiple high-res photo URLs.
     * Returns the count of successfully queued downloads.
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
