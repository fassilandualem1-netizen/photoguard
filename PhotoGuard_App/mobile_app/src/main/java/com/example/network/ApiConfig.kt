package com.example.network

import com.example.BuildConfig

object ApiConfig {
    // Dynamically pull from BuildConfig (.env via Secrets Gradle Plugin)
    // Fallback to the live Render endpoint if not set
    val BASE_URL = try {
        BuildConfig.API_BASE_URL
    } catch (e: Exception) {
        "https://photoguard.onrender.com/"
    }

    fun sanitizeUrl(rawUrl: String?): String? {
        if (rawUrl.isNullOrBlank()) return null
        var sanitized = rawUrl.trim()
        val targetBase = BASE_URL.trimEnd('/')

        if (sanitized.startsWith("http://") || sanitized.startsWith("https://")) {
            if (sanitized.startsWith("http://")) {
                sanitized = "https://" + sanitized.substring(7)
            }
            
            val loopbackHosts = listOf(
                "127.0.0.1:5000", "localhost:5000", "10.0.2.2:5000",
                "127.0.0.1", "localhost", "10.0.2.2"
            )
            
            for (host in loopbackHosts) {
                if (sanitized.contains(host)) {
                    sanitized = sanitized
                        .replace("https://$host", targetBase)
                        .replace("http://$host", targetBase)
                }
            }
            return sanitized
        }
        
        return if (sanitized.startsWith("/")) {
            "$targetBase$sanitized"
        } else {
            "$targetBase/$sanitized"
        }
    }
}
