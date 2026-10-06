package com.photoguard.client.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class ClientVerifyRequest(
    @SerialName("pin")
    val pin: String
)

@Serializable
data class ClientSyncResponse(
    @SerialName("pin")
    val pin: String = "",
    @SerialName("version")
    val version: Int = 1,
    @SerialName("is_locked")
    val isLocked: Boolean = false
)

@Serializable
data class ClientMediaUpdateRequest(
    @SerialName("pin")
    val pin: String,
    @SerialName("is_selected")
    val isSelected: Boolean? = null,
    @SerialName("client_notes")
    val clientNotes: String? = null
)

@Serializable
data class ClientSubmitResponse(
    @SerialName("message")
    val message: String = "",
    @SerialName("pin")
    val pin: String = "",
    @SerialName("is_locked")
    val isLocked: Boolean = true
)

@Serializable
data class ClientDownloadResponse(
    @SerialName("pin")
    val pin: String = "",
    @SerialName("allow_download")
    val allowDownload: Boolean = false,
    @SerialName("download_urls")
    val downloadUrls: List<String> = emptyList()
)

@Serializable
data class SocialLinksResponse(
    @SerialName("contact_phone")
    val contactPhone: String? = null,
    @SerialName("phone_number")
    val phoneNumber: String? = null,
    @SerialName("tiktok_url")
    val tiktokUrl: String? = null,
    @SerialName("tiktok")
    val tiktok: String? = null,
    @SerialName("instagram_url")
    val instagramUrl: String? = null,
    @SerialName("instagram")
    val instagram: String? = null,
    @SerialName("telegram_url")
    val telegramUrl: String? = null,
    @SerialName("telegram_username")
    val telegramUsername: String? = null,
    @SerialName("youtube_url")
    val youtubeUrl: String? = null,
    @SerialName("youtube")
    val youtube: String? = null
) {
    val resolvedPhone: String?
        get() = contactPhone?.takeIf { it.isNotBlank() } ?: phoneNumber?.takeIf { it.isNotBlank() }

    val resolvedTelegram: String?
        get() = telegramUrl?.takeIf { it.isNotBlank() } ?: telegramUsername?.takeIf { it.isNotBlank() }

    val resolvedInstagram: String?
        get() = instagramUrl?.takeIf { it.isNotBlank() } ?: instagram?.takeIf { it.isNotBlank() }

    val resolvedTikTok: String?
        get() = tiktokUrl?.takeIf { it.isNotBlank() } ?: tiktok?.takeIf { it.isNotBlank() }

    val resolvedYouTube: String?
        get() = youtubeUrl?.takeIf { it.isNotBlank() } ?: youtube?.takeIf { it.isNotBlank() }
}

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
    @SerialName("raw_url")
    val rawUrl: String? = null,
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
    @SerialName("is_submitted")
    val isSubmitted: Boolean = false,
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
    @SerialName("phone_number")
    val phoneNumber: String? = null,
    @SerialName("tiktok_url")
    val tiktokUrl: String? = null,
    @SerialName("tiktok")
    val tiktok: String? = null,
    @SerialName("instagram_url")
    val instagramUrl: String? = null,
    @SerialName("instagram")
    val instagram: String? = null,
    @SerialName("telegram_url")
    val telegramUrl: String? = null,
    @SerialName("telegram_username")
    val telegramUsername: String? = null,
    @SerialName("youtube_url")
    val youtubeUrl: String? = null,
    @SerialName("youtube")
    val youtube: String? = null,
    @SerialName("studio_logo_url")
    val studioLogoUrl: String? = null,
    @SerialName("brand_color")
    val brandColor: String? = null,
    @SerialName("brand_accent_color")
    val brandAccentColor: String? = null,
    @SerialName("studio_name")
    val studioName: String? = null,
    @SerialName("photographer_name")
    val photographerName: String? = null,
    @SerialName("subscription_plan")
    val subscriptionPlan: String? = "basic"
) {
    val displayStudioName: String
        get() = studioName?.takeIf { it.isNotBlank() }
            ?: photographerName?.takeIf { it.isNotBlank() }
            ?: creatorName?.takeIf { it.isNotBlank() && it != "Studio Owner" }
            ?: "Fasil Studio"

    val resolvedPhone: String?
        get() = contactPhone?.takeIf { it.isNotBlank() }
            ?: phoneNumber?.takeIf { it.isNotBlank() }
            ?: socialLinks?.resolvedPhone

    val resolvedTelegram: String?
        get() = telegramUrl?.takeIf { it.isNotBlank() }
            ?: telegramUsername?.takeIf { it.isNotBlank() }
            ?: socialLinks?.resolvedTelegram

    val resolvedInstagram: String?
        get() = instagramUrl?.takeIf { it.isNotBlank() }
            ?: instagram?.takeIf { it.isNotBlank() }
            ?: socialLinks?.resolvedInstagram

    val resolvedTikTok: String?
        get() = tiktokUrl?.takeIf { it.isNotBlank() }
            ?: tiktok?.takeIf { it.isNotBlank() }
            ?: socialLinks?.resolvedTikTok

    val resolvedYouTube: String?
        get() = youtubeUrl?.takeIf { it.isNotBlank() }
            ?: youtube?.takeIf { it.isNotBlank() }
            ?: socialLinks?.resolvedYouTube
}
