package com.photoguard.client

import android.graphics.Bitmap
import android.os.Bundle
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import coil.Coil
import coil.ImageLoader
import coil.disk.DiskCache
import coil.memory.MemoryCache
import com.photoguard.client.data.model.AlbumDetailResponse
import com.photoguard.client.network.RetrofitClient
import com.photoguard.client.ui.DeliveryScreen
import com.photoguard.client.ui.DeliveryViewModel
import com.photoguard.client.ui.GalleryScreen
import com.photoguard.client.ui.GalleryViewModel
import com.photoguard.client.ui.LoginScreen
import com.photoguard.client.ui.LoginViewModel

/**
 * PhotoGuard Client Application Main Activity.
 *
 * Implements strict security enforcement:
 * 1. WindowManager.LayoutParams.FLAG_SECURE to prevent screenshot capture,
 *    screen recording, and task switcher thumbnail leaks.
 * 2. In-memory RAM-only Coil configuration (DiskCache = null) to ensure client
 *    photographs are strictly held in RAM and never written to flash/disk storage.
 * 3. Dynamic navigation between 6-Digit PIN Login, 2-Step Masonry Selection,
 *    and Post-Submission Delivery screens.
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

        // Configure Coil for RAM-only caching with GPU Hardware Acceleration (4K Display)
        setupRamOnlyImageLoader()

        setContent {
            val isDark = isSystemInDarkTheme()
            val colorScheme = if (isDark) darkColorScheme() else lightColorScheme()

            var activeAlbum by remember { mutableStateOf<AlbumDetailResponse?>(null) }
            var isSubmittedToDelivery by remember { mutableStateOf(false) }

            MaterialTheme(colorScheme = colorScheme) {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    when {
                        activeAlbum == null -> {
                            val loginViewModel = remember { LoginViewModel(RetrofitClient.api) }
                            LoginScreen(
                                viewModel = loginViewModel,
                                onLoginSuccess = { album ->
                                    activeAlbum = album
                                    isSubmittedToDelivery = album.isLocked
                                }
                            )
                        }
                        isSubmittedToDelivery || activeAlbum?.isLocked == true -> {
                            val deliveryViewModel = remember(activeAlbum?.pin) {
                                DeliveryViewModel(RetrofitClient.api, activeAlbum!!)
                            }
                            DeliveryScreen(
                                viewModel = deliveryViewModel,
                                onSignOut = {
                                    activeAlbum = null
                                    isSubmittedToDelivery = false
                                }
                            )
                        }
                        else -> {
                            val galleryViewModel = remember(activeAlbum?.pin) {
                                GalleryViewModel(RetrofitClient.api, activeAlbum!!)
                            }
                            GalleryScreen(
                                viewModel = galleryViewModel,
                                onSignOut = {
                                    activeAlbum = null
                                    isSubmittedToDelivery = false
                                },
                                onSubmitComplete = {
                                    isSubmittedToDelivery = true
                                }
                            )
                        }
                    }
                }
            }
        }
    }

    /**
     * Initializes Coil with zero disk persistence, GPU Hardware Acceleration, and RAM caching.
     * Guarantees zero local image retention while maintaining stutter-free 4K display.
     */
    private fun setupRamOnlyImageLoader() {
        val ramOnlyLoader = ImageLoader.Builder(this)
            .memoryCache {
                MemoryCache.Builder(this)
                    .maxSizePercent(0.40) // Allocate up to 40% of app memory for fast RAM rendering
                    .build()
            }
            .diskCache(null) // STRICT: Absolutely no disk caching (RAM-Only rendering)
            .bitmapConfig(Bitmap.Config.HARDWARE) // GPU Hardware Acceleration for ultra-sharp 4K display
            .allowHardware(true)
            .crossfade(true)
            .build()
        Coil.setImageLoader(ramOnlyLoader)
    }
}
