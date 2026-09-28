package com.photoguard.client.utils

import android.app.DownloadManager
import android.content.Context
import android.net.Uri
import android.os.Environment

object DownloadUtils {
    fun downloadImage(
        context: Context,
        url: String,
        albumTitle: String,
        filename: String
    ): Long {
        val downloadManager = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
        val sanitizedTitle = albumTitle.replace(Regex("[^a-zA-Z0-9_]"), "_")
        val sanitizedFile = if (filename.endsWith(".jpg") || filename.endsWith(".png") || filename.endsWith(".webp")) {
            filename
        } else {
            "$filename.jpg"
        }

        val request = DownloadManager.Request(Uri.parse(url))
            .setTitle(sanitizedFile)
            .setDescription("Downloading high-resolution photo from PhotoGuard")
            .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            .setDestinationInExternalPublicDir(
                Environment.DIRECTORY_PICTURES,
                "PhotoGuard/$sanitizedTitle/$sanitizedFile"
            )
            .setAllowedOverMetered(true)
            .setAllowedOverRoaming(true)

        return downloadManager.enqueue(request)
    }
}
