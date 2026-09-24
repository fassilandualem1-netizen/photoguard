package com.photoguard.client.network

import com.photoguard.client.data.model.AlbumDetailResponse
import com.photoguard.client.data.model.ClientVerifyRequest
import retrofit2.http.Body
import retrofit2.http.POST

/**
 * Retrofit network interface for the PhotoGuard Client Mobile Application.
 * Communicates with the FastAPI backend hosted on Render.
 */
interface ClientApi {

    /**
     * Verifies the client's 6-digit PIN.
     * Returns full album details and media items for RAM-only rendering.
     * Enforces Redis rate limits (HTTP 429) and single-submit lock (HTTP 403).
     */
    @POST("/api/v1/client/verify")
    suspend fun verifyPin(
        @Body request: ClientVerifyRequest
    ): AlbumDetailResponse
}
