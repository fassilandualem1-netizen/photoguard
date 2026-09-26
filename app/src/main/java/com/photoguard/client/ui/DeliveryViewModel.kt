package com.photoguard.client.ui

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.photoguard.client.data.model.AlbumDetailResponse
import com.photoguard.client.network.ClientApi
import com.photoguard.client.network.NetworkResult
import com.photoguard.client.network.safeApiCall
import com.photoguard.client.utils.DownloadUtils
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class DeliveryUiState(
    val albumTitle: String = "PhotoGuard Album",
    val allowDownload: Boolean = false,
    val isStudioTier: Boolean = false,
    val downloadUrls: List<String> = emptyList(),
    val isFetchingDownloads: Boolean = false,
    val downloadProgressText: String? = null,
    val photographerName: String? = null,
    val studioLogoUrl: String? = null,
    val contactPhone: String? = null,
    val telegramUrl: String? = null,
    val instagramUrl: String? = null,
    val tiktokUrl: String? = null,
    val youtubeUrl: String? = null,
    val errorMessage: String? = null
)

class DeliveryViewModel(
    private val clientApi: ClientApi,
    private val album: AlbumDetailResponse
) : ViewModel() {

    private val _uiState = MutableStateFlow(
        DeliveryUiState(
            albumTitle = album.title,
            allowDownload = album.allowDownload,
            isStudioTier = album.subscriptionPlan.equals("studio", ignoreCase = true),
            photographerName = album.creatorName ?: album.photographerName,
            studioLogoUrl = album.studioLogoUrl,
            contactPhone = album.contactPhone ?: album.socialLinks?.contactPhone,
            telegramUrl = album.telegramUrl ?: album.socialLinks?.telegramUrl,
            instagramUrl = album.instagramUrl ?: album.socialLinks?.instagramUrl,
            tiktokUrl = album.tiktokUrl ?: album.socialLinks?.tiktokUrl,
            youtubeUrl = album.youtubeUrl ?: album.socialLinks?.youtubeUrl
        )
    )
    val uiState: StateFlow<DeliveryUiState> = _uiState.asStateFlow()

    init {
        if (album.allowDownload) {
            fetchHighResDownloadUrls()
        }
    }

    private fun fetchHighResDownloadUrls() {
        _uiState.update { it.copy(isFetchingDownloads = true) }
        viewModelScope.launch {
            val result = safeApiCall { clientApi.getDownloadUrls(album.pin) }
            when (result) {
                is NetworkResult.Success -> {
                    _uiState.update {
                        it.copy(
                            isFetchingDownloads = false,
                            downloadUrls = result.data.downloadUrls,
                            allowDownload = result.data.allowDownload
                        )
                    }
                }
                is NetworkResult.Error -> {
                    _uiState.update {
                        it.copy(
                            isFetchingDownloads = false,
                            errorMessage = result.message
                        )
                    }
                }
                is NetworkResult.NetworkException -> {
                    _uiState.update {
                        it.copy(
                            isFetchingDownloads = false,
                            errorMessage = result.message
                        )
                    }
                }
            }
        }
    }

    fun downloadAllPhotos(context: Context) {
        val urls = _uiState.value.downloadUrls
        if (urls.isEmpty()) {
            _uiState.update { it.copy(errorMessage = "No downloadable photos found for this album.") }
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(downloadProgressText = "Starting download of ${urls.size} photos...") }

            urls.forEachIndexed { index, url ->
                val filename = "Photo_${index + 1}.jpg"
                DownloadUtils.downloadImage(
                    context = context,
                    url = url,
                    albumTitle = _uiState.value.albumTitle,
                    filename = filename
                )
            }

            _uiState.update {
                it.copy(downloadProgressText = "All ${urls.size} photos enqueued in notification tray.")
            }
        }
    }

    fun clearErrorMessage() {
        _uiState.update { it.copy(errorMessage = null) }
    }
}
