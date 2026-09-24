package com.photoguard.client.network

import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import retrofit2.HttpException
import java.io.IOException

/**
 * Robust network result wrapper to enforce crash-free operations across all network calls.
 * Prevents fatal crashes on server errors, connectivity drops, and rate-limits (HTTP 429).
 */
sealed interface NetworkResult<out T> {
    /** Successful API response carrying deserialized data */
    data class Success<out T>(val data: T) : NetworkResult<T>

    /** HTTP Error (4xx, 5xx), including status code and server error body or fallback message */
    data class Error(
        val code: Int,
        val message: String,
        val errorBody: String? = null
    ) : NetworkResult<Nothing> {
        val isRateLimit: Boolean get() = code == 429
        val isUnauthorized: Boolean get() = code == 401 || code == 403
        val isNotFound: Boolean get() = code == 404
        val isServerError: Boolean get() = code in 500..599
    }

    /** Connectivity failure, timeout, or DNS resolution failure */
    data class NetworkException(
        val throwable: Throwable,
        val message: String = "No internet connection or network timeout"
    ) : NetworkResult<Nothing>
}

/**
 * Bulletproof network wrapper using Kotlin's runCatching.
 *
 * Guarantees that no unhandled HttpException, IOException, or serialization
 * exception bubbles up to cause an application crash.
 *
 * @param dispatcher CoroutineDispatcher (defaults to Dispatchers.IO)
 * @param apiCall The suspending Retrofit API block
 * @return NetworkResult<T> (Success, Error, or NetworkException)
 */
suspend fun <T> safeApiCall(
    dispatcher: CoroutineDispatcher = Dispatchers.IO,
    apiCall: suspend () -> T
): NetworkResult<T> {
    return withContext(dispatcher) {
        runCatching {
            apiCall()
        }.fold(
            onSuccess = { response ->
                NetworkResult.Success(response)
            },
            onFailure = { throwable ->
                when (throwable) {
                    is IOException -> {
                        // Network drop, timeout, offline state
                        NetworkResult.NetworkException(
                            throwable = throwable,
                            message = throwable.localizedMessage ?: "Network connectivity unavailable. Please check your connection."
                        )
                    }
                    is HttpException -> {
                        val statusCode = throwable.code()
                        val errorBody = runCatching {
                            throwable.response()?.errorBody()?.string()
                        }.getOrNull()

                        val parsedMessage = when (statusCode) {
                            429 -> "Rate limit reached. Please wait a moment before trying again."
                            401 -> "Invalid credentials or session expired."
                            403 -> "Access restricted."
                            404 -> "Requested resource not found."
                            in 500..599 -> "PhotoGuard server error. Please try again shortly."
                            else -> "Unexpected server response ($statusCode)."
                        }

                        NetworkResult.Error(
                            code = statusCode,
                            message = parsedMessage,
                            errorBody = errorBody
                        )
                    }
                    else -> {
                        // Catch-all for unexpected serialization or runtime issues
                        NetworkResult.NetworkException(
                            throwable = throwable,
                            message = throwable.localizedMessage ?: "An unexpected error occurred during request execution."
                        )
                    }
                }
            }
        )
    }
}
