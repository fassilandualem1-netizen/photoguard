package com.photoguard.client.ui

import androidx.compose.ui.graphics.Color
import com.photoguard.client.data.model.AlbumDetailResponse

val DefaultBrandAccentColor: Color = Color(0xFFD97706)

fun parseBrandAccentColor(hexString: String?): Color {
    if (hexString.isNullOrBlank()) return DefaultBrandAccentColor
    return try {
        val trimmed = hexString.trim()
        val formatted = if (trimmed.startsWith("#")) trimmed else "#$trimmed"
        Color(android.graphics.Color.parseColor(formatted))
    } catch (_: Exception) {
        DefaultBrandAccentColor
    }
}
