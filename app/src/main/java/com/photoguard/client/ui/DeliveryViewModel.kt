package com.photoguard.client.ui

import android.content.Context
import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.photoguard.client.data.model.AlbumDetailResponse
import com.photoguard.client.data.model.SocialLinksResponse
import com.photoguard.client.network.ClientApi
import com.photoguard.client.network.NetworkResult
import com.photoguard.client.network.safeApiCall
import com.photoguard.client.utils.DownloadUtils
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * UI State for the post-submit Delivery & Celebration Screen.
 */
data class DeliveryUiState(
    val albumTitle: String = "PhotoGuard Album",
    val clientName: String = "Valued Client",
    val pin: String = "",
    val allowDownload: Boolean = false,
    val selectedCount: Int = 0,
    val photographerName: String? = null,
    val socialLinks: SocialLinksResponse? = null,
    val contactPhone: String? = null,
    val telegramUrl: String? = null,
    val instagramUrl: String? = null,
    val tiktokUrl: String? = null,
    val youtubeUrl: String? = null,
    val studioLogoUrl: String? = null,
    val brandColor: String? = null,
    val isFetchingDownloads: Boolean = false,
    val downloadUrls: List<String> = emptyList(),
    val feedbackMessage: String? = null,
    val downloadSuccessCount: Int? = null
)

/**
 * ViewModel managing the post-submit Delivery Screen,
 * Studio plan social link exposures, and high-res gallery downloads.
 */
class DeliveryViewModel(
    private val clientApi: ClientApi,
    val album: AlbumDetailResponse
) : ViewModel() {

    private val _uiState = MutableStateFlow(
        DeliveryUiState(
            albumTitle = album.title,
            clientName = album.clientName,
            pin = album.pin,
            allowDownload = album.allowDownload,
            selectedCount = album.selectedCount.takeIf { it > 0 } ?: album.mediaItems.count { it.isSelected },
            photographerName = album.photographerName,
            socialLinks = album.socialLinks,
            contactPhone = album.contactPhone ?: album.socialLinks?.contactPhone,
            telegramUrl = album.telegramUrl ?: album.socialLinks?.telegramUrl,
            instagramUrl = album.instagramUrl ?: album.socialLinks?.instagramUrl,
            tiktokUrl = album.tiktokUrl ?: album.socialLinks?.tiktokUrl,
            youtubeUrl = album.youtubeUrl ?: album.socialLinks?.youtubeUrl,
            studioLogoUrl = album.studioLogoUrl,
            brandColor = album.brandColor
        )
    )
    val uiState: StateFlow<DeliveryUiState> = _uiState.asStateFlow()

    /**
     * Sanitizes and verifies that a URL string is non-blank and starts with a valid http/https scheme.
     */
    private fun isValidHttpUrl(url: String?): Boolean {
        if (url.isNullOrBlank()) return false
        val trimmed = url.trim()
        val uri = runCatching { Uri.parse(trimmed) }.getOrNull() ?: return false
        val scheme = uri.scheme?.lowercase()
        return (scheme == "http" || scheme == "https") && !uri.host.isNullOrBlank()
    }

    /**
     * Fetches high-resolution download URLs from GET /api/v1/client/{pin}/download
     * and triggers batch download via native Android DownloadManager.
     */
    fun startGalleryDownload(context: Context) {
        val currentState = _uiState.value
        if (!currentState.allowDownload) {
            _uiState.update { it.copy(feedbackMessage = "Downloads are disabled for this album.") }
            return
        }

        if (currentState.isFetchingDownloads) return

        _uiState.update { it.copy(isFetchingDownloads = true, feedbackMessage = "Preparing high-resolution downloads...") }

        viewModelScope.launch {
            val result = safeApiCall {
                clientApi.getDownloadUrls(currentState.pin)
            }

            when (result) {
                is NetworkResult.Success -> {
                    val response = result.data
                    
                    // Secure fallback resolution:
                    // 1. Check if backend returned download_urls
                    // 2. If empty, securely fall back to client-selected photos
                    // 3. If no selections recorded, fallback to all album media items
                    val rawCandidateUrls: List<String> = if (response.downloadUrls.isNotEmpty()) {
                        response.downloadUrls
                    } else {
                        val selectedUrls = album.mediaItems.filter { it.isSelected }.map { it.url }
                        selectedUrls.ifEmpty {
                            album.mediaItems.map { it.url }
                        }
                    }

                    // Strict URI validation: Strip whitespaces and filter only valid HTTP/HTTPS schemes
                    val validUrls = rawCandidateUrls
                        .map { it.trim() }
                        .filter { isValidHttpUrl(it) }

                    if (validUrls.isEmpty()) {
                        _uiState.update {
                            it.copy(
                                isFetchingDownloads = false,
                                feedbackMessage = "No valid high-resolution photos available for download."
                            )
                        }
                        return@launch
                    }

                    // Native DownloadManager dispatch
                    val queued = DownloadUtils.enqueueBatchDownloads(
                        context = context.applicationContext,
                        urls = validUrls,
                        albumTitle = currentState.albumTitle
                    )

                    _uiState.update {
                        it.copy(
                            isFetchingDownloads = false,
                            downloadUrls = validUrls,
                            downloadSuccessCount = queued,
                            feedbackMessage = "Enqueued $queued high-res photos to Pictures/PhotoGuard"
                        )
                    }
                }

                is NetworkResult.Error -> {
                    _uiState.update {
                        it.copy(
                            isFetchingDownloads = false,
                            feedbackMessage = result.message
                        )
                    }
                }

                is NetworkResult.NetworkException -> {
                    _uiState.update {
                        it.copy(
                            isFetchingDownloads = false,
                            feedbackMessage = result.message
                        )
                    }
                }
            }
        }
    }

    /**
     * Clears user-visible notification message.
     */
    fun clearFeedbackMessage() {
        _uiState.update { it.copy(feedbackMessage = null) }
    }
}
