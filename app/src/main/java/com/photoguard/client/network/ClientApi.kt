package com.photoguard.client.network

import com.photoguard.client.data.model.AlbumDetailResponse
import com.photoguard.client.data.model.ClientDownloadResponse
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

interface ClientApi {
    @POST("/api/v1/client/verify")
    suspend fun verifyPin(
        @Body request: ClientVerifyRequest
    ): AlbumDetailResponse

    @GET("/api/v1/client/album/{pin}")
    suspend fun getAlbumDetails(
        @Path("pin") pin: String
    ): AlbumDetailResponse

    @GET("/api/v1/client/sync/{pin}")
    suspend fun syncAlbum(
        @Path("pin") pin: String
    ): ClientSyncResponse

    @PATCH("/api/v1/client/media/{media_id}")
    suspend fun updateMedia(
        @Path("media_id") mediaId: Int,
        @Body request: ClientMediaUpdateRequest
    ): MediaItemResponse

    @POST("/api/v1/client/submit/{pin}")
    suspend fun submitSelections(
        @Path("pin") pin: String
    ): ClientSubmitResponse

    @GET("/api/v1/client/{pin}/download")
    suspend fun getDownloadUrls(
        @Path("pin") pin: String
    ): ClientDownloadResponse
}
