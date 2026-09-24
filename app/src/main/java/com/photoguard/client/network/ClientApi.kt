package com.photoguard.client.network

import com.photoguard.client.data.model.AlbumDetailResponse
import com.photoguard.client.data.model.ClientMediaUpdateRequest
import com.photoguard.client.data.model.ClientSubmitResponse
import com.photoguard.client.data.model.ClientSyncResponse
import com.photoguard.client.data.model.ClientVerifyRequest
import com.photoguard.client.data.model.MediaItemResponse
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path

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

    /**
     * Re-fetches the latest album state and media list via PIN.
     */
    @GET("/api/v1/client/album/{pin}")
    suspend fun getAlbumDetails(
        @Path("pin") pin: String
    ): AlbumDetailResponse

    /**
     * Lightweight Smart Polling endpoint (3-second interval).
     * Retrieves current album version and lock state without WebSocket overhead.
     */
    @GET("/api/v1/client/sync/{pin}")
    suspend fun syncAlbum(
        @Path("pin") pin: String
    ): ClientSyncResponse

    /**
     * Updates photo selection status (is_selected) and client notes.
     * Rejects modification if the album is locked or expired (HTTP 403).
     */
    @PATCH("/api/v1/client/media/{media_id}")
    suspend fun updateMedia(
        @Path("media_id") mediaId: Int,
        @Body request: ClientMediaUpdateRequest
    ): MediaItemResponse

    /**
     * Submits selections and activates Single-Submit Lock across all client devices.
     */
    @POST("/api/v1/client/submit/{pin}")
    suspend fun submitSelections(
        @Path("pin") pin: String
    ): ClientSubmitResponse

    /**
     * Fetches high-resolution download URLs for the client gallery.
     * Enforces Studio tier & allow_download permissions (HTTP 403 if disallowed).
     */
    @GET("/api/v1/client/{pin}/download")
    suspend fun getDownloadUrls(
        @Path("pin") pin: String
    ): com.photoguard.client.data.model.ClientDownloadResponse
}
