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

data class GalleryUiState(
    val album: AlbumDetailResponse? = null,
    val mediaItems: List<MediaItemResponse> = emptyList(),
    val selectedCount: Int = 0,
    val isLocked: Boolean = false,
    val isSyncing: Boolean = false,
    val isSubmitting: Boolean = false,
    val localVersion: Int = 1,
    val userFeedbackMessage: String? = null
)

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

    private fun startSmartPolling() {
        pollingJob?.cancel()
        pollingJob = viewModelScope.launch {
            while (isActive) {
                delay(3000L)
                if (_uiState.value.isSubmitting) continue

                val syncResult = safeApiCall { clientApi.syncAlbum(albumPin) }
                if (syncResult is NetworkResult.Success) {
                    val remoteSync = syncResult.data

                    if (remoteSync.isLocked && !_uiState.value.isLocked) {
                        _uiState.update { current ->
                            current.copy(
                                isLocked = true,
                                userFeedbackMessage = "Album was submitted by a family member and is now locked."
                            )
                        }
                    }

                    if (remoteSync.version > _uiState.value.localVersion) {
                        refreshAlbumDetails(newVersion = remoteSync.version)
                    }
                }
            }
        }
    }

    private suspend fun refreshAlbumDetails(newVersion: Int) {
        _uiState.update { it.copy(isSyncing = true) }
        val result = safeApiCall { clientApi.getAlbumDetails(albumPin) }
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

    fun togglePhotoSelection(mediaId: Int) {
        val currentState = _uiState.value
        if (currentState.isLocked) {
            _uiState.update { it.copy(userFeedbackMessage = "Album is locked. Selections cannot be altered.") }
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
                            userFeedbackMessage = patchResult.message
                        )
                    }
                }
                is NetworkResult.NetworkException -> {
                    _uiState.update { current ->
                        val revertedList = current.mediaItems.map { item ->
                            if (item.id == mediaId) item.copy(isSelected = !newSelectedState) else item
                        }
                        current.copy(
                            mediaItems = revertedList,
                            selectedCount = revertedList.count { it.isSelected },
                            userFeedbackMessage = "Network connection failed. Selection was not saved."
                        )
                    }
                }
            }
        }
    }

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

    fun updatePhotoNote(mediaId: Int, note: String) {
        val currentState = _uiState.value
        if (currentState.isLocked) {
            _uiState.update { it.copy(userFeedbackMessage = "Album is locked. Notes cannot be added.") }
            return
        }

        val updatedList = currentState.mediaItems.map { item ->
            if (item.id == mediaId) item.copy(clientNotes = note) else item
        }

        _uiState.update { it.copy(mediaItems = updatedList) }

        viewModelScope.launch {
            val result = safeApiCall {
                clientApi.updateMedia(
                    mediaId = mediaId,
                    request = ClientMediaUpdateRequest(
                        pin = albumPin,
                        clientNotes = note
                    )
                )
            }

            if (result !is NetworkResult.Success) {
                _uiState.update { current ->
                    current.copy(
                        mediaItems = currentState.mediaItems,
                        userFeedbackMessage = "Failed to save note. Please check connection."
                    )
                }
            }
        }
    }

    fun clearFeedbackMessage() {
        _uiState.update { it.copy(userFeedbackMessage = null) }
    }

    override fun onCleared() {
        super.onCleared()
        pollingJob?.cancel()
    }
}
