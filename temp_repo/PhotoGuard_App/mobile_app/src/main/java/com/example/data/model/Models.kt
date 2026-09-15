package com.example.data.model

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class VerifyCodeRequest(
    @Json(name = "code") val code: String? = null,
    @Json(name = "pin") val pin: String? = null,
    @Json(name = "device_uuid") val device_uuid: String
)

@JsonClass(generateAdapter = true)
data class MediaToken(
    @Json(name = "token") val token: String,
    @Json(name = "category") val category: String = "Uncategorized",
    @Json(name = "thumbnail_url") val thumbnail_url: String? = null,
    @Json(name = "preview_url") val preview_url: String? = null,
    @Json(name = "url") val url: String? = null,
    @Json(name = "master_url") val master_url: String? = null,
    @Json(name = "file_url") val file_url: String? = null,
    @Json(name = "stream_url") val stream_url: String? = null,
    @Json(name = "media_type") val media_type: String? = "image"
) {
    val isVideo: Boolean
        get() {
            val type = (media_type ?: "").lowercase()
            if (type == "video") return true
            val checkUrl = (url ?: preview_url ?: thumbnail_url ?: file_url ?: token).lowercase()
            return checkUrl.contains(".mp4") || checkUrl.contains(".mov") || checkUrl.contains(".avi") || checkUrl.contains(".webm") || checkUrl.contains(".mkv") || token.startsWith("demo_vid")
        }

    val gridThumbnailUrl: String
        get() = (stream_url ?: thumbnail_url ?: preview_url ?: file_url ?: url ?: master_url ?: token).trim()

    val fullScreenUrl: String
        get() = (stream_url ?: master_url ?: url ?: file_url ?: preview_url ?: thumbnail_url ?: token).trim()
}

@JsonClass(generateAdapter = true)
data class VerifyCodeResponse(
    @Json(name = "albumId") val albumId: String = "",
    @Json(name = "title") val title: String = "",
    @Json(name = "media") val media: List<MediaToken> = emptyList(),
    @Json(name = "photos") val photos: List<MediaToken> = emptyList(),
    @Json(name = "photographerName") val photographerName: String? = "PhotoGuard Studio",
    @Json(name = "selectionLimit") val selectionLimit: Int = 50,
    @Json(name = "isLocked") val isLocked: Boolean = false,
    @Json(name = "downloadEnabled") val downloadEnabled: Boolean = false,
    @Json(name = "graceSecondsRemaining") val graceSecondsRemaining: Int? = 0,
    @Json(name = "status") val status: String? = null,
    @Json(name = "error") val error: String? = null,
    @Json(name = "message") val message: String? = null
)

@JsonClass(generateAdapter = true)
data class PinCommentModel(
    val token: String,
    val text: String,
    val xPercent: Float,
    val yPercent: Float
)

@JsonClass(generateAdapter = true)
data class SubmitSelectionsRequest(
    val selectedPhotoTokens: List<String>,
    val notes: Map<String, String>? = null,
    val pinComments: List<PinCommentModel>? = null,
    val device_uuid: String
)

@JsonClass(generateAdapter = true)
data class SecurityLogRequest(
    val album_id: String?,
    val event_type: String
)
