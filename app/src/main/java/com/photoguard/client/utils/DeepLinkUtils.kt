package com.photoguard.client.utils

import android.content.Context
import android.content.Intent
import android.net.Uri

/**
 * Deep Linking utilities for PhotoGuard Client Mobile Application.
 * Directs clients straight to native apps (Phone Dialer, Telegram, Instagram, TikTok, YouTube)
 * with graceful browser fallbacks.
 */
object DeepLinkUtils {

    /**
     * Cleans up handle/username strings by stripping prefixes (@, https://, domains).
     */
    fun cleanHandle(raw: String?, domainPrefixes: List<String> = emptyList()): String {
        if (raw.isNullOrBlank()) return ""
        var cleaned = raw.trim()
        domainPrefixes.forEach { prefix ->
            if (cleaned.startsWith(prefix, ignoreCase = true)) {
                cleaned = cleaned.substring(prefix.length)
            }
        }
        return cleaned.removePrefix("@").removePrefix("/").trim()
    }

    /**
     * Direct Phone Call via system dialer (tel: URI).
     */
    fun openDialer(context: Context, phoneNumber: String): Boolean {
        return try {
            val cleanPhone = phoneNumber.trim().replace(" ", "")
            val intent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:$cleanPhone")).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            context.startActivity(intent)
            true
        } catch (_: Exception) {
            false
        }
    }

    /**
     * Telegram Deep Link: Opens tg://resolve?domain=username, falls back to https://t.me/username.
     */
    fun openTelegram(context: Context, telegramValue: String): Boolean {
        val username = cleanHandle(
            telegramValue,
            listOf("https://t.me/", "http://t.me/", "t.me/")
        )
        if (username.isBlank()) return false

        // 1. Try native Telegram app deep link
        try {
            val appIntent = Intent(Intent.ACTION_VIEW, Uri.parse("tg://resolve?domain=$username")).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            context.startActivity(appIntent)
            return true
        } catch (_: Exception) {
            // Native app not found, proceed to web fallback
        }

        // 2. Web fallback
        return try {
            val webIntent = Intent(Intent.ACTION_VIEW, Uri.parse("https://t.me/$username")).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            context.startActivity(webIntent)
            true
        } catch (_: Exception) {
            false
        }
    }

    /**
     * Instagram Deep Link: Opens instagram://user?username=username, falls back to web.
     */
    fun openInstagram(context: Context, instagramValue: String): Boolean {
        val username = cleanHandle(
            instagramValue,
            listOf("https://instagram.com/", "https://www.instagram.com/", "http://instagram.com/", "instagram.com/")
        )
        if (username.isBlank()) return false

        // 1. Try native Instagram app intent
        try {
            val appIntent = Intent(Intent.ACTION_VIEW, Uri.parse("http://instagram.com/_u/$username")).apply {
                setPackage("com.instagram.android")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            context.startActivity(appIntent)
            return true
        } catch (_: Exception) {
            // Instagram app not installed
        }

        // 2. Web fallback
        return try {
            val webIntent = Intent(Intent.ACTION_VIEW, Uri.parse("https://instagram.com/$username")).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            context.startActivity(webIntent)
            true
        } catch (_: Exception) {
            false
        }
    }

    /**
     * TikTok Deep Link: Opens native TikTok profile or browser.
     */
    fun openTikTok(context: Context, tiktokValue: String): Boolean {
        val username = cleanHandle(
            tiktokValue,
            listOf("https://www.tiktok.com/@", "https://tiktok.com/@", "tiktok.com/@", "https://tiktok.com/", "tiktok.com/")
        )
        if (username.isBlank()) return false

        // 1. Try native TikTok intent
        try {
            val appIntent = Intent(Intent.ACTION_VIEW, Uri.parse("snssdk1128://user/profile/$username")).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            context.startActivity(appIntent)
            return true
        } catch (_: Exception) {
            // TikTok app not installed
        }

        // 2. Web fallback
        return try {
            val webIntent = Intent(Intent.ACTION_VIEW, Uri.parse("https://www.tiktok.com/@$username")).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            context.startActivity(webIntent)
            true
        } catch (_: Exception) {
            false
        }
    }

    /**
     * YouTube Deep Link: Opens native YouTube app or browser.
     */
    fun openYouTube(context: Context, youtubeValue: String): Boolean {
        val trimmed = youtubeValue.trim()
        val url = when {
            trimmed.startsWith("http://", ignoreCase = true) || trimmed.startsWith("https://", ignoreCase = true) -> trimmed
            trimmed.startsWith("@") -> "https://www.youtube.com/$trimmed"
            else -> "https://www.youtube.com/@$trimmed"
        }

        // 1. Try native YouTube app package
        try {
            val appIntent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
                setPackage("com.google.android.youtube")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            context.startActivity(appIntent)
            return true
        } catch (_: Exception) {
            // YouTube app not installed or package unresolvable
        }

        // 2. Web fallback
        return try {
            val webIntent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            context.startActivity(webIntent)
            true
        } catch (_: Exception) {
            false
        }
    }
}
