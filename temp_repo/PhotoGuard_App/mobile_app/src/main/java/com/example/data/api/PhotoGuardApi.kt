package com.example.data.api

import com.example.data.model.VerifyCodeRequest
import com.example.data.model.VerifyCodeResponse
import com.example.data.model.SecurityLogRequest
import okhttp3.ResponseBody
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Query
import retrofit2.Response

interface PhotoGuardApi {
    @POST("api/verify-pin")
    suspend fun verifyPin(@Body request: VerifyCodeRequest): Response<VerifyCodeResponse>

    @POST("api/albums/verify-code")
    suspend fun verifyCode(@Body request: VerifyCodeRequest): Response<VerifyCodeResponse>

    @GET("api/photos/stream")
    suspend fun getPhotoStream(
        @Query("token") token: String,
        @Query("format") format: String = "webp",
        @Query("resolution") resolution: String = "1080p"
    ): Response<ResponseBody>

    @POST("api/gallery/{code}/submit")
    suspend fun submitSelections(
        @retrofit2.http.Path("code") code: String,
        @Body request: com.example.data.model.SubmitSelectionsRequest
    ): Response<Unit>

    @POST("api/security/log")
    suspend fun logSecurity(@Body request: SecurityLogRequest): Response<Unit>
}
