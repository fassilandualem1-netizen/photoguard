package com.photoguard.client.ui

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

/**
 * Gallery UI State representing the collaborative live selection session.
 */
data class GalleryUiState(
    val album: AlbumDetailResponse? = null,
    val mediaItems: List<MediaItemResponse> = emptyList(),
    val selectedCount: Int = 0,
    val isLocked: Boolean = false,
    val isSubmitting: Boolean = false,
    val isSyncing: Boolean = false,
    val userFeedbackMessage: String? = null,
    val localVersion: Int = 1
)

/**
 * ViewModel managing the Masonry photo gallery, optimistic selection updates,
 * single-submit lock enforcement, and Smart Polling live sync (every 3 seconds).
 */
class GalleryViewModel(
    private val clientApi: ClientApi,
    initialAlbum: AlbumDetailResponse
) : ViewModel() {

    private val albumPin = initialAlbum.pin

    private val _uiState = MutableStateFlow(
        GalleryUiState(
            album = initialAlbum,
            mediaItems = initialAlbum.mediaItems,
            selectedCount = initialAlbum.mediaItems.count { it.isSelected },
            isLocked = initialAlbum.isLocked,
            localVersion = 1
        )
    )
    val uiState: StateFlow<GalleryUiState> = _uiState.asStateFlow()

    private var pollingJob: Job? = null

    init {
        startSmartPolling()
    }

    /**
     * Smart Polling Loop (Redis/Upstash backed):
     * Polls GET /api/v1/client/sync/{pin} every 3000ms.
     * WebSockets are strictly forbidden by architecture.
     * If remote version > local version, automatically re-fetches latest album state.
     * If is_locked == true, freezes UI immediately.
     */
    fun startSmartPolling() {
        if (pollingJob?.isActive == true) return

        pollingJob = viewModelScope.launch {
            while (isActive) {
                delay(3000L)

                // Skip polling if album is already finalized and locked
                if (_uiState.value.isLocked) continue

                val syncResult = safeApiCall {
                    clientApi.syncAlbum(albumPin)
                }

                if (syncResult is NetworkResult.Success) {
                    val remoteSync = syncResult.data

                    // 1. Check if another device locked/submitted the album
                    if (remoteSync.isLocked && !_uiState.value.isLocked) {
                        _uiState.update { current ->
                            current.copy(
                                isLocked = true,
                                userFeedbackMessage = "Album was submitted by a family member and is now locked."
                            )
                        }
                    }

                    // 2. Collaborative Sync: Version bumped by another device's selection
                    if (remoteSync.version > _uiState.value.localVersion) {
                        refreshAlbumDetails(newVersion = remoteSync.version)
                    }
                }
            }
        }
    }

    /**
     * Re-fetches full album state when remote version > local version.
     */
    private suspend fun refreshAlbumDetails(newVersion: Int) {
        _uiState.update { it.copy(isSyncing = true) }

        val result = safeApiCall {
            clientApi.getAlbumDetails(albumPin)
        }

        if (result is NetworkResult.Success) {
            val freshAlbum = result.data
            _uiState.update { current ->
                current.copy(
                    album = freshAlbum,
                    mediaItems = freshAlbum.mediaItems,
                    selectedCount = freshAlbum.mediaItems.count { it.isSelected },
                    isLocked = freshAlbum.isLocked,
                    localVersion = newVersion,
                    isSyncing = false
                )
            }
        } else {
            _uiState.update { it.copy(isSyncing = false) }
        }
    }

    /**
     * Toggles photo selection with Optimistic UI updates.
     * If the server rejects the change (e.g. 403 album locked), rolls back the UI state.
     */
    fun togglePhotoSelection(mediaId: Int) {
        val currentState = _uiState.value
        if (currentState.isLocked) {
            _uiState.update { it.copy(userFeedbackMessage = "Album is locked. Selections cannot be altered.") }
            return
        }

        val targetItem = currentState.mediaItems.find { it.id == mediaId } ?: return
        val newSelectedState = !targetItem.isSelected

        // 1. Optimistic UI update: Immediately reflect selection change
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

        // 2. Background PATCH dispatch
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
                    // Selection confirmed by server. Local version increments alongside Redis version.
                    _uiState.update { it.copy(localVersion = it.localVersion + 1) }
                }

                is NetworkResult.Error -> {
                    // Rollback optimistic update
                    val rolledBackList = _uiState.value.mediaItems.map { item ->
                        if (item.id == mediaId) item.copy(isSelected = targetItem.isSelected) else item
                    }
                    _uiState.update {
                        it.copy(
                            mediaItems = rolledBackList,
                            selectedCount = rolledBackList.count { m -> m.isSelected },
                            isLocked = if (patchResult.code == 403) true else it.isLocked,
                            userFeedbackMessage = patchResult.message
                        )
                    }
                }

                is NetworkResult.NetworkException -> {
                    // Rollback on network connectivity dropout
                    val rolledBackList = _uiState.value.mediaItems.map { item ->
                        if (item.id == mediaId) item.copy(isSelected = targetItem.isSelected) else item
                    }
                    _uiState.update {
                        it.copy(
                            mediaItems = rolledBackList,
                            selectedCount = rolledBackList.count { m -> m.isSelected },
                            userFeedbackMessage = "Network error. Selection was not saved."
                        )
                    }
                }
            }
        }
    }

    /**
     * Submits client photo selections. Enforces Single Submit Lock across all connected devices.
     */
    fun submitSelections(onSuccess: () -> Unit) {
        val currentState = _uiState.value
        if (currentState.isLocked || currentState.isSubmitting) return

        if (currentState.selectedCount == 0) {
            _uiState.update { it.copy(userFeedbackMessage = "Please select at least one photo before submitting.") }
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
                            userFeedbackMessage = "Selections submitted successfully! Album is now locked."
                        )
                    }
                    onSuccess()
                }

                is NetworkResult.Error -> {
                    _uiState.update {
                        it.copy(
                            isSubmitting = false,
                            isLocked = if (submitResult.code == 403) true else it.isLocked,
                            userFeedbackMessage = submitResult.message
                        )
                    }
                }

                is NetworkResult.NetworkException -> {
                    _uiState.update {
                        it.copy(
                            isSubmitting = false,
                            userFeedbackMessage = submitResult.message
                        )
                    }
                }
            }
        }
    }

    /**
     * Dismisses the active user feedback toast/message.
     */
    fun clearFeedbackMessage() {
        _uiState.update { it.copy(userFeedbackMessage = null) }
    }

    override fun onCleared() {
        super.onCleared()
        pollingJob?.cancel()
    }
}
