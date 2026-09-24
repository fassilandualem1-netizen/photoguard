package com.photoguard.client

import android.os.Bundle
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import coil.Coil
import coil.ImageLoader
import coil.disk.DiskCache
import coil.memory.MemoryCache

/**
 * PhotoGuard Client Application Main Activity.
 *
 * Implements strict security enforcement:
 * 1. WindowManager.LayoutParams.FLAG_SECURE to prevent screenshot capture,
 *    screen recording, and task switcher thumbnail leaks.
 * 2. In-memory RAM-only Coil configuration (DiskCache = null) to ensure client
 *    photographs are strictly held in RAM and never written to flash/disk storage.
 */
class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        // Enforce FLAG_SECURE before window rendering starts
        window.setFlags(
            WindowManager.LayoutParams.FLAG_SECURE,
            WindowManager.LayoutParams.FLAG_SECURE
        )

        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        // Configure Coil for RAM-only caching (Zero Disk Caching for protected client photos)
        setupRamOnlyImageLoader()

        setContent {
            val isDark = isSystemInDarkTheme()
            val colorScheme = if (isDark) darkColorScheme() else lightColorScheme()

            MaterialTheme(colorScheme = colorScheme) {
                Surface(color = MaterialTheme.colorScheme.background) {
                    // UI screen hierarchy will be injected in Phase 2
                }
            }
        }
    }

    /**
     * Initializes Coil with zero disk persistence and a generous RAM memory cache.
     * Guarantees zero local image retention while maintaining smooth Masonry grid performance.
     */
    private fun setupRamOnlyImageLoader() {
        val ramOnlyLoader = ImageLoader.Builder(this)
            .memoryCache {
                MemoryCache.Builder(this)
                    .maxSizePercent(0.35) // Allocate up to 35% of app memory for fast RAM rendering
                    .build()
            }
            .diskCache(null) // STRICT: Absolutely no disk caching
            .crossfade(true)
            .build()

        Coil.setImageLoader(ramOnlyLoader)
    }
}
