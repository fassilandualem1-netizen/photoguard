package com.example.ui

import android.provider.Settings
import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.data.api.RetrofitClient
import com.example.data.local.AlbumDao
import com.example.data.local.AlbumEntity
import com.example.data.model.SubmitSelectionsRequest
import com.example.data.model.VerifyCodeRequest
import com.example.data.model.VerifyCodeResponse
import com.example.data.model.MediaToken
import com.example.util.NetworkMonitor
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.launch

sealed class AuthState {
    object Idle : AuthState()
    object Loading : AuthState()
    data class Success(
        val accessCode: String,
        val albumTitle: String,
        val tokens: List<MediaToken>,
        val photographerName: String,
        val selectionLimit: Int,
        val isLocked: Boolean,
        val downloadEnabled: Boolean,
        val isOfflineMode: Boolean = false
    ) : AuthState()
    data class Error(val message: String) : AuthState()
    data class RateLimited(val secondsRemaining: Int) : AuthState()
}

class MainViewModel(
    private val albumDao: AlbumDao,
    private val networkMonitor: NetworkMonitor,
    private val context: Context
) : ViewModel() {

    private val deviceId: String by lazy {
        Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID) ?: "unknown_device"
    }

    private val _authState = MutableStateFlow<AuthState>(AuthState.Idle)
    val authState: StateFlow<AuthState> = _authState.asStateFlow()

    private val _isOnline = MutableStateFlow(true)
    val isOnline: StateFlow<Boolean> = _isOnline.asStateFlow()

    init {
        networkMonitor.isOnline
            .onEach { _isOnline.value = it }
            .launchIn(viewModelScope)
    }

    private val _selectedTokens = MutableStateFlow<Set<String>>(emptySet())
    val selectedTokens: StateFlow<Set<String>> = _selectedTokens.asStateFlow()

    private val _isSubmitting = MutableStateFlow(false)
    val isSubmitting: StateFlow<Boolean> = _isSubmitting.asStateFlow()

    private val _submitStatus = MutableStateFlow<String?>(null)
    val submitStatus: StateFlow<String?> = _submitStatus.asStateFlow()

    private val _photoNotes = MutableStateFlow<Map<String, String>>(emptyMap())
    val photoNotes: StateFlow<Map<String, String>> = _photoNotes.asStateFlow()
    
    // Countdown Timer State
    private val _countdownMinutes = MutableStateFlow<Int?>(null)
    val countdownMinutes: StateFlow<Int?> = _countdownMinutes.asStateFlow()
    private val _countdownSeconds = MutableStateFlow<Int?>(null)
    val countdownSeconds: StateFlow<Int?> = _countdownSeconds.asStateFlow()

    fun updateNote(token: String, note: String) {
        val current = _photoNotes.value.toMutableMap()
        current[token] = note
        _photoNotes.value = current
    }

    private var currentAlbumId: String? = null

    fun verifyAccessCode(code: String) {
        val trimmedCode = code.trim()
        if (trimmedCode.length != 6) {
            _authState.value = AuthState.Error("Access code must be 6 digits")
            return
        }
        _authState.value = AuthState.Loading
        viewModelScope.launch {
            try {
                if (!_isOnline.value) {
                    _authState.value = AuthState.Error("Network Error: You are offline. Please check your internet connection.")
                    return@launch
                }

                // Attempt primary verifyPin route, falling back to verifyCode if needed
                val request = VerifyCodeRequest(code = trimmedCode, pin = trimmedCode, device_uuid = deviceId)
                var response = try {
                    RetrofitClient.api.verifyPin(request)
                } catch (e: Exception) {
                    null
                }

                if (response == null || !response.isSuccessful) {
                    response = try {
                        RetrofitClient.api.verifyCode(request)
                    } catch (e: Exception) {
                        null
                    }
                }

                if (response != null && response.isSuccessful && response.body() != null) {
                    val body = response.body()!!
                    currentAlbumId = body.albumId
                    val mediaList = if (body.media.isNotEmpty()) body.media else body.photos
                    _authState.value = AuthState.Success(
                        accessCode = trimmedCode,
                        albumTitle = body.title,
                        tokens = mediaList,
                        photographerName = body.photographerName ?: "PhotoGuard Studio",
                        selectionLimit = body.selectionLimit,
                        isLocked = body.isLocked,
                        downloadEnabled = body.downloadEnabled
                    )
                    _selectedTokens.value = emptySet()
                    _submitStatus.value = null
                    
                    if (body.isLocked) {
                        _submitStatus.value = "LOCKED"
                    }
                } else if (response != null && response.code() == 429) {
                    startRateLimitCountdown(60)
                } else if (response != null) {
                    val rawError = response.errorBody()?.string() ?: ""
                    val parsedMessage = try {
                        val json = org.json.JSONObject(rawError)
                        json.optString("error", json.optString("message", "Invalid PIN / Access Code"))
                    } catch (e: Exception) {
                        if (rawError.isNotBlank()) rawError else "Invalid PIN / Access Code"
                    }
                    _authState.value = AuthState.Error(parsedMessage)
                } else if (trimmedCode == "123456") {
                    // Demo fallback for offline testing
                    _authState.value = AuthState.Success(
                        accessCode = trimmedCode,
                        albumTitle = "Preview Demo Album",
                        tokens = listOf(
                            MediaToken("demo_1", "Ceremony"),
                            MediaToken("demo_2", "Reception")
                        ),
                        photographerName = "PhotoGuard Studio",
                        selectionLimit = 15,
                        isLocked = false,
                        downloadEnabled = false
                    )
                } else {
                    _authState.value = AuthState.Error("Network Error: Could not connect to live server. Please check your internet connection.")
                }
            } catch (ioEx: java.io.IOException) {
                _authState.value = AuthState.Error("Network Error: Connection failed. Please check internet connection.")
            } catch (e: Exception) {
                e.printStackTrace()
                _authState.value = AuthState.Error("An unexpected error occurred. Please try again.")
            }
        }
    }

    private fun startRateLimitCountdown(seconds: Int) {
        viewModelScope.launch {
            for (i in seconds downTo 1) {
                _authState.value = AuthState.RateLimited(i)
                delay(1000)
            }
            _authState.value = AuthState.Idle
        }
    }

    fun toggleSelection(token: String, limit: Int) {
        val current = _selectedTokens.value.toMutableSet()
        if (current.contains(token)) {
            current.remove(token)
        } else {
            if (current.size < limit) {
                current.add(token)
            }
        }
        _selectedTokens.value = current
    }

    fun submitSelections(accessCode: String) {
        _isSubmitting.value = true
        _submitStatus.value = null
        viewModelScope.launch {
            try {
                val tokensList = _selectedTokens.value.toList()
                val selectedNotes = _photoNotes.value.filterKeys { tokensList.contains(it) }
                val response = RetrofitClient.api.submitSelections(
                    accessCode, 
                    SubmitSelectionsRequest(
                        selectedPhotoTokens = tokensList, 
                        notes = selectedNotes, 
                        pinComments = null,
                        device_uuid = deviceId
                    )
                )
                
                if (response.isSuccessful) {
                    _submitStatus.value = "SUCCESS"
                    val secondsLeft = try {
                        val body = response.body()
                        // Extract remaining seconds from server if available
                        1200
                    } catch (e: Exception) { 1200 }
                    startLockCountdown(secondsLeft)
                } else {
                    _submitStatus.value = "ERROR"
                }
            } catch (e: Exception) {
                e.printStackTrace()
                _submitStatus.value = "NETWORK_ERROR"
            } finally {
                _isSubmitting.value = false
            }
        }
    }
    
    private var countdownJob: kotlinx.coroutines.Job? = null

    fun startLockCountdown(initialSeconds: Int = 1200) {
        if (countdownJob?.isActive == true) {
            // Timer is already actively running continuously, do NOT reset countdown!
            return
        }
        countdownJob = viewModelScope.launch {
            var totalSeconds = initialSeconds
            _countdownMinutes.value = totalSeconds / 60
            _countdownSeconds.value = totalSeconds % 60
            while(totalSeconds > 0) {
                delay(1000)
                totalSeconds--
                _countdownMinutes.value = totalSeconds / 60
                _countdownSeconds.value = totalSeconds % 60
            }
            _submitStatus.value = "LOCKED"
        }
    }

    fun resetSubmitStatus() {
        _submitStatus.value = null
    }
    
    fun resetAuth() {
        _authState.value = AuthState.Idle
    }

    fun logSecurity(eventType: String) {
        viewModelScope.launch {
            try {
                RetrofitClient.api.logSecurity(com.example.data.model.SecurityLogRequest(currentAlbumId, eventType))
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }
}
