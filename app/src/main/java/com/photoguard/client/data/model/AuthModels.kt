package com.photoguard.client.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Request payload for 6-digit client PIN verification.
 */
@Serializable
data class ClientVerifyRequest(
    @SerialName("pin")
    val pin: String
)

/**
 * Lightweight polling response for collaborative Smart Polling without WebSockets.
 * Returned by GET /api/v1/client/sync/{pin}.
 */
@Serializable
data class ClientSyncResponse(
    @SerialName("pin")
    val pin: String = "",
    @SerialName("version")
    val version: Int = 1,
    @SerialName("is_locked")
    val isLocked: Boolean = false
)

/**
 * Client photo selection and retouching notes payload.
 * Submitted to PATCH /api/v1/client/media/{media_id}.
 */
@Serializable
data class ClientMediaUpdateRequest(
    @SerialName("pin")
    val pin: String,
    @SerialName("is_selected")
    val isSelected: Boolean? = null,
    @SerialName("client_notes")
    val clientNotes: String? = null
)

/**
 * Final submission confirmation response.
 * Returned by POST /api/v1/client/submit/{pin}.
 */
@Serializable
data class ClientSubmitResponse(
    @SerialName("message")
    val message: String = "",
    @SerialName("pin")
    val pin: String = "",
    @SerialName("is_locked")
    val isLocked: Boolean = true
)

/**
 * Direct gallery high-res download response.
 * Returned by GET /api/v1/client/{pin}/download.
 */
@Serializable
data class ClientDownloadResponse(
    @SerialName("pin")
    val pin: String = "",
    @SerialName("allow_download")
    val allowDownload: Boolean = false,
    @SerialName("download_urls")
    val downloadUrls: List<String> = emptyList()
)

/**
 * Social links and Studio tier branding for client visibility (Studio Plan only).
 */
@Serializable
data class SocialLinksResponse(
    @SerialName("contact_phone")
    val contactPhone: String? = null,
    @SerialName("tiktok_url")
    val tiktokUrl: String? = null,
    @SerialName("instagram_url")
    val instagramUrl: String? = null,
    @SerialName("telegram_url")
    val telegramUrl: String? = null,
    @SerialName("youtube_url")
    val youtubeUrl: String? = null
)

/**
 * Individual media item representation within an album.
 */
@Serializable
data class MediaItemResponse(
    @SerialName("id")
    val id: Int,
    @SerialName("album_id")
    val albumId: Int,
    @SerialName("filename")
    val filename: String? = "photo.jpg",
    @SerialName("url")
    val url: String,
    @SerialName("thumbnail_url")
    val thumbnailUrl: String? = null,
    @SerialName("original_size")
    val originalSize: Long? = 0L,
    @SerialName("compressed_size")
    val compressedSize: Long? = 0L,
    @SerialName("is_selected")
    val isSelected: Boolean = false,
    @SerialName("client_notes")
    val clientNotes: String? = null,
    @SerialName("created_at")
    val createdAt: String? = null
)

/**
 * Comprehensive album detail response matching FastAPI backend schema.
 * Supports both Basic and Studio subscription plan configurations.
 */
@Serializable
data class AlbumDetailResponse(
    @SerialName("id")
    val id: Int,
    @SerialName("title")
    val title: String = "Untitled Album",
    @SerialName("client_name")
    val clientName: String = "Valued Client",
    @SerialName("pin")
    val pin: String = "",
    @SerialName("photographer_id")
    val photographerId: Int,
    @SerialName("is_locked")
    val isLocked: Boolean = false,
    @SerialName("allow_download")
    val allowDownload: Boolean = false,
    @SerialName("view_count")
    val viewCount: Int = 0,
    @SerialName("last_viewed_at")
    val lastViewedAt: String? = null,
    @SerialName("reminder_sent_at")
    val reminderSentAt: String? = null,
    @SerialName("created_at")
    val createdAt: String? = null,
    @SerialName("expires_at")
    val expiresAt: String? = null,
    @SerialName("is_expired")
    val isExpired: Boolean = false,
    @SerialName("submitted_at")
    val submittedAt: String? = null,
    @SerialName("media_count")
    val mediaCount: Int = 0,
    @SerialName("selected_count")
    val selectedCount: Int = 0,
    @SerialName("creator_name")
    val creatorName: String? = "Studio Owner",
    @SerialName("creator_role")
    val creatorRole: String? = "photographer",
    @SerialName("media_items")
    val mediaItems: List<MediaItemResponse> = emptyList(),
    @SerialName("social_links")
    val socialLinks: SocialLinksResponse? = null,
    @SerialName("contact_phone")
    val contactPhone: String? = null,
    @SerialName("tiktok_url")
    val tiktokUrl: String? = null,
    @SerialName("instagram_url")
    val instagramUrl: String? = null,
    @SerialName("telegram_url")
    val telegramUrl: String? = null,
    @SerialName("youtube_url")
    val youtubeUrl: String? = null,
    @SerialName("studio_logo_url")
    val studioLogoUrl: String? = null,
    @SerialName("brand_color")
    val brandColor: String? = null,
    @SerialName("photographer_name")
    val photographerName: String? = null,
    @SerialName("subscription_plan")
    val subscriptionPlan: String? = "basic"
)
