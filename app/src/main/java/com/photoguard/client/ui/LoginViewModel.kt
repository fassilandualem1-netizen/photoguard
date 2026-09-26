package com.photoguard.client.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.photoguard.client.data.model.AlbumDetailResponse
import com.photoguard.client.data.model.ClientVerifyRequest
import com.photoguard.client.network.ClientApi
import com.photoguard.client.network.NetworkResult
import com.photoguard.client.network.safeApiCall
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import org.json.JSONObject

sealed interface LoginUiState {
    data object Idle : LoginUiState
    data object Loading : LoginUiState
    data class Success(val album: AlbumDetailResponse) : LoginUiState
    data class Error(
        val message: String,
        val errorCode: Int? = null,
        val isRateLimit: Boolean = false,
        val lockoutSecondsRemaining: Int = 0
    ) : LoginUiState
}

class LoginViewModel(
    private val clientApi: ClientApi
) : ViewModel() {

    private val _pin = MutableStateFlow("")
    val pin: StateFlow<String> = _pin.asStateFlow()

    private val _uiState = MutableStateFlow<LoginUiState>(LoginUiState.Idle)
    val uiState: StateFlow<LoginUiState> = _uiState.asStateFlow()

    private var countdownJob: Job? = null

    fun onPinChanged(newPin: String) {
        val filtered = newPin.filter { it.isDigit() }.take(6)
        _pin.value = filtered

        val currentState = _uiState.value
        if (currentState is LoginUiState.Error && !currentState.isRateLimit) {
            _uiState.value = LoginUiState.Idle
        }

        if (filtered.length == 6 && _uiState.value !is LoginUiState.Loading) {
            val isCurrentlyLocked = (_uiState.value as? LoginUiState.Error)?.isRateLimit == true
            if (!isCurrentlyLocked) {
                verifyPin()
            }
        }
    }

    fun verifyPin() {
        val currentPin = _pin.value.trim()
        if (currentPin.length != 6) {
            _uiState.value = LoginUiState.Error(
                message = "Please enter a valid 6-digit PIN",
                errorCode = 400
            )
            return
        }

        val currentState = _uiState.value
        if (currentState is LoginUiState.Error && currentState.isRateLimit && currentState.lockoutSecondsRemaining > 0) {
            return
        }

        _uiState.value = LoginUiState.Loading

        viewModelScope.launch {
            val result = safeApiCall {
                clientApi.verifyPin(ClientVerifyRequest(pin = currentPin))
            }

            when (result) {
                is NetworkResult.Success -> {
                    countdownJob?.cancel()
                    _uiState.value = LoginUiState.Success(result.data)
                }
                is NetworkResult.Error -> {
                    handleApiError(result)
                }
                is NetworkResult.NetworkException -> {
                    _uiState.value = LoginUiState.Error(
                        message = result.message,
                        errorCode = null,
                        isRateLimit = false
                    )
                }
            }
        }
    }

    private fun handleApiError(error: NetworkResult.Error) {
        val serverDetail = error.errorBody?.let { bodyString ->
            runCatching {
                JSONObject(bodyString).optString("detail", null)
            }.getOrNull()
        }

        val errorMessage = serverDetail ?: error.message

        when (error.code) {
            429 -> {
                val seconds = extractRetrySeconds(errorMessage) ?: 900
                startLockoutCountdown(seconds, errorMessage)
            }
            403 -> {
                _uiState.value = LoginUiState.Error(
                    message = errorMessage,
                    errorCode = 403,
                    isRateLimit = false
                )
            }
            404 -> {
                _uiState.value = LoginUiState.Error(
                    message = errorMessage.ifBlank { "Invalid 6-digit PIN. Album not found." },
                    errorCode = 404,
                    isRateLimit = false
                )
            }
            else -> {
                _uiState.value = LoginUiState.Error(
                    message = errorMessage,
                    errorCode = error.code,
                    isRateLimit = false
                )
            }
        }
    }

    private fun extractRetrySeconds(message: String): Int? {
        val regex = Regex("""\b(\d+)\s*(?:seconds|second|s)\b""", RegexOption.IGNORE_CASE)
        val match = regex.find(message)
        return match?.groupValues?.get(1)?.toIntOrNull()
    }

    private fun startLockoutCountdown(totalSeconds: Int, originalMessage: String) {
        countdownJob?.cancel()
        countdownJob = viewModelScope.launch {
            var remaining = totalSeconds
            while (remaining > 0) {
                _uiState.value = LoginUiState.Error(
                    message = originalMessage,
                    errorCode = 429,
                    isRateLimit = true,
                    lockoutSecondsRemaining = remaining
                )
                delay(1000L)
                remaining--
            }
            _uiState.value = LoginUiState.Idle
        }
    }

    fun resetError() {
        val current = _uiState.value
        if (current is LoginUiState.Error && !current.isRateLimit) {
            _uiState.value = LoginUiState.Idle
        }
    }

    override fun onCleared() {
        super.onCleared()
        countdownJob?.cancel()
    }
}
