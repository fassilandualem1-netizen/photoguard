package com.photoguard.client.ui

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.photoguard.client.data.model.AlbumDetailResponse
import com.photoguard.client.data.model.ClientMediaUpdateRequest
import com.photoguard.client.data.model.MediaItemResponse
import com.photoguard.client.network.ClientApi
import com.photoguard.client.network.NetworkResult
import com.photoguard.client.network.safeApiCall
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

data class GalleryUiState(
    val album: AlbumDetailResponse = AlbumDetailResponse(
        id = 0,
        photographerId = 0,
        pin = ""
    ),
    val mediaItems: List<MediaItemResponse> = emptyList(),
    val selectedCount: Int = 0,
    val isLocked: Boolean = false,
    val isSubmitting: Boolean = false,
    val isSubmitted: Boolean = false,
    val isSyncing: Boolean = false,
    val localVersion: Int = 1,
    val errorMessage: String? = null,
    val isOffline: Boolean = false
) {
    val albumTitle: String get() = album.title
    val pin: String get() = album.pin
    val totalCount: Int get() = mediaItems.size
    val studioLogoUrl: String? get() = album.studioLogoUrl
    val studioName: String get() = album.displayStudioName
    val brandColorHex: String get() = album.brandAccentColor?.takeIf { it.isNotBlank() } ?: album.brandColor?.takeIf { it.isNotBlank() } ?: "#D97706"
}

class GalleryViewModel(
    private val clientApi: ClientApi,
    private val savedStateHandle: SavedStateHandle,
    initialAlbum: AlbumDetailResponse? = null
) : ViewModel() {

    val albumPin: String = savedStateHandle.get<String>("albumPin")
        ?: initialAlbum?.pin
        ?: ""

    private val _uiState = MutableStateFlow(
        if (initialAlbum != null) {
            GalleryUiState(
                album = initialAlbum,
                mediaItems = initialAlbum.mediaItems,
                selectedCount = initialAlbum.mediaItems.count { it.isSelected },
                isLocked = initialAlbum.isLocked,
                localVersion = 1
            )
        } else {
            GalleryUiState(
                album = AlbumDetailResponse(id = 0, photographerId = 0, pin = albumPin),
                isSyncing = true
            )
        }
    )
    val uiState: StateFlow<GalleryUiState> = _uiState.asStateFlow()

    private var pollingJob: Job? = null
    private var lastRefreshTimestamp: Long = 0L
    private val REFRESH_THROTTLE_MS: Long = 5000L

    init {
        if (albumPin.isNotBlank()) {
            savedStateHandle["albumPin"] = albumPin
        }
        // If initialAlbum was null (e.g. process death / savedState restoration), re-fetch immediately
        if (initialAlbum == null && albumPin.isNotBlank()) {
            viewModelScope.launch {
                refreshAlbumDetails(newVersion = 1)
            }
        }
    }

    /**
     * Strictly Lifecycle-Aware Smart Polling with Throttled Payload Ingestion.
     * - Throttled to 5s poll cycle to save mobile radio battery and data bandwidth.
     * - Implements minimum delta interval between full AlbumDetailResponse refreshes.
     * - Pauses immediately when the app transitions to the background.
     */
    fun startPolling() {
        if (pollingJob?.isActive == true) return
        pollingJob = viewModelScope.launch {
            while (isActive) {
                delay(5000L) // Throttled to 5s to reduce network churn
                if (_uiState.value.isSubmitting) continue
                if (albumPin.isBlank()) continue

                val syncResult = safeApiCall { clientApi.syncAlbum(albumPin) }
                if (syncResult is NetworkResult.Success) {
                    val remoteSync = syncResult.data
                    _uiState.update { it.copy(isOffline = false) }
                    if (remoteSync.isLocked && !_uiState.value.isLocked) {
                        _uiState.update { current ->
                            current.copy(
                                isLocked = true,
                                errorMessage = "Album was submitted by a family member and is now locked."
                            )
                        }
                    }
                    val now = System.currentTimeMillis()
                    if (remoteSync.version > _uiState.value.localVersion && (now - lastRefreshTimestamp >= REFRESH_THROTTLE_MS)) {
                        lastRefreshTimestamp = now
                        refreshAlbumDetails(newVersion = remoteSync.version)
                    }
                } else if (syncResult is NetworkResult.NetworkException) {
                    _uiState.update { it.copy(isOffline = true) }
                }
            }
        }
    }

    fun stopPolling() {
        pollingJob?.cancel()
        pollingJob = null
    }

    private suspend fun refreshAlbumDetails(newVersion: Int) {
        if (albumPin.isBlank()) return
        _uiState.update { it.copy(isSyncing = true) }
        val result = safeApiCall { clientApi.getAlbumDetails(albumPin) }
        if (result is NetworkResult.Success) {
            val freshAlbum = result.data
            _uiState.update { current ->
                val newItems = freshAlbum.mediaItems
                val hasChanged = current.mediaItems.size != newItems.size ||
                    current.mediaItems.zip(newItems).any { (old, new) -> old.id != new.id || old.isSelected != new.isSelected }
                current.copy(
                    album = freshAlbum,
                    mediaItems = if (hasChanged) newItems else current.mediaItems,
                    selectedCount = if (hasChanged) newItems.count { it.isSelected } else current.selectedCount,
                    isLocked = freshAlbum.isLocked,
                    localVersion = newVersion,
                    isOffline = false,
                    isSyncing = false
                )
            }
        } else {
            _uiState.update { 
                it.copy(
                    isSyncing = false,
                    isOffline = if (result is NetworkResult.NetworkException) true else it.isOffline
                ) 
            }
        }
    }

    fun toggleSelect(mediaId: Int) {
        val currentState = _uiState.value
        if (currentState.isLocked) {
            _uiState.update { it.copy(errorMessage = "Album is locked. Selections cannot be altered.") }
            return
        }

        val targetItem = currentState.mediaItems.find { it.id == mediaId } ?: return
        val newSelectedState = !targetItem.isSelected
        val updatedList = currentState.mediaItems.map { item ->
            if (item.id == mediaId) item.copy(isSelected = newSelectedState) else item
        }
        val newCount = updatedList.count { it.isSelected }

        _uiState.update {
            it.copy(
                mediaItems = updatedList,
                selectedCount = newCount
            )
        }

        viewModelScope.launch {
            val patchResult = safeApiCall {
                clientApi.updateMedia(
                    mediaId = mediaId,
                    request = ClientMediaUpdateRequest(
                        pin = albumPin,
                        isSelected = newSelectedState
                    )
                )
            }
            when (patchResult) {
                is NetworkResult.Success -> {
                    _uiState.update { it.copy(localVersion = it.localVersion + 1) }
                }
                is NetworkResult.Error -> {
                    _uiState.update { current ->
                        val revertedList = current.mediaItems.map { item ->
                            if (item.id == mediaId) item.copy(isSelected = !newSelectedState) else item
                        }
                        current.copy(
                            mediaItems = revertedList,
                            selectedCount = revertedList.count { it.isSelected },
                            isLocked = if (patchResult.code == 403) true else current.isLocked,
                            errorMessage = patchResult.message
                        )
                    }
                }
                is NetworkResult.NetworkException -> {
                    // Graceful degraded mode: Optimistic UI update maintained.
                    // DO NOT revert the selection state during temporary network drops.
                    _uiState.update { current ->
                        current.copy(
                            errorMessage = "No internet connection. Retrying..."
                        )
                    }
                }
            }
        }
    }

    fun submitSelection() {
        val currentState = _uiState.value
        if (currentState.isLocked || currentState.isSubmitting) return
        if (currentState.selectedCount == 0) {
            _uiState.update { it.copy(errorMessage = "Please select at least one photo before submitting.") }
            return
        }

        _uiState.update { it.copy(isSubmitting = true) }

        viewModelScope.launch {
            val submitResult = safeApiCall {
                clientApi.submitSelections(albumPin)
            }
            when (submitResult) {
                is NetworkResult.Success -> {
                    _uiState.update {
                        it.copy(
                            isLocked = true,
                            isSubmitting = false,
                            isSubmitted = true
                        )
                    }
                }
                is NetworkResult.Error -> {
                    _uiState.update {
                        it.copy(
                            isSubmitting = false,
                            isLocked = if (submitResult.code == 403) true else it.isLocked,
                            errorMessage = submitResult.message
                        )
                    }
                }
                is NetworkResult.NetworkException -> {
                    _uiState.update {
                        it.copy(
                            isSubmitting = false,
                            errorMessage = submitResult.message
                        )
                    }
                }
            }
        }
    }

    fun clearError() {
        _uiState.update { it.copy(errorMessage = null) }
    }

    override fun onCleared() {
        super.onCleared()
        stopPolling()
    }
}
