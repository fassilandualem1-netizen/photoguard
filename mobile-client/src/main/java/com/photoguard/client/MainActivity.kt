package com.photoguard.client

import android.content.Context
import android.graphics.Bitmap
import android.os.Bundle
import android.util.Log
import android.view.WindowManager
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import coil.Coil
import coil.ImageLoader
import coil.memory.MemoryCache
import coil.size.Precision
import com.photoguard.client.data.model.AlbumDetailResponse
import com.photoguard.client.network.ClientApi
import com.photoguard.client.network.RetrofitClient
import com.photoguard.client.ui.DeliveryScreen
import com.photoguard.client.ui.DeliveryViewModel
import com.photoguard.client.ui.GalleryScreen
import com.photoguard.client.ui.GalleryViewModel
import com.photoguard.client.ui.LoginScreen
import com.photoguard.client.ui.LoginViewModel

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        // Anti-piracy FLAG_SECURE prevents screen recording & screenshots
        window.setFlags(
            WindowManager.LayoutParams.FLAG_SECURE,
            WindowManager.LayoutParams.FLAG_SECURE
        )

        // Global crash guard with persistent diagnostics logging
        val previousHandler = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            val trace = Log.getStackTraceString(throwable)
            val crashDetails = "Thread [${thread.name}] crash: ${throwable.message} - $trace"
            Log.e("PhotoGuard", crashDetails)
            try {
                val prefs = applicationContext.getSharedPreferences("photoguard_crash_logs", Context.MODE_PRIVATE)
                prefs.edit()
                    .putString("last_crash_reason", throwable.localizedMessage ?: "Unexpected fatal crash")
                    .putString("last_crash_trace", trace)
                    .putLong("last_crash_timestamp", System.currentTimeMillis())
                    .commit() // Synchronous disk commit before process termination
            } catch (prefEx: Exception) {
                Log.e("PhotoGuard", "Failed to persist crash log to SharedPreferences", prefEx)
            }
            previousHandler?.uncaughtException(thread, throwable)
        }

        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setupRamOnlyImageLoader()

        setContent {
            val isDark = isSystemInDarkTheme()
            val colorScheme = if (isDark) darkColorScheme() else lightColorScheme()
            MaterialTheme(colorScheme = colorScheme) {
                Surface(color = MaterialTheme.colorScheme.background) {
                    PhotoGuardNavHost()
                }
            }
        }
    }

    /**
     * RAM-Only Image Loader with Perceptual Lossless 4K Rendering
     * - Bitmap.Config.HARDWARE: Direct GPU rendering, zero RAM memory bloat, pin-sharp vector/text fidelity
     * - Precision.INEXACT: Fast sub-sampling without glitching or moiré patterns
     * - crossfade(250): Smooth visual transition without flicker
     * - allowRgb565(false): Enforces 32-bit true-color depth
     * - diskCache(null): Strict anti-piracy guarantee (no traces saved to flash storage)
     */
    private fun setupRamOnlyImageLoader() {
        val ramOnlyLoader = ImageLoader.Builder(this)
            .memoryCache {
                MemoryCache.Builder(this)
                    .maxSizePercent(0.20)
                    .build()
            }
            .diskCache(null)
            .bitmapConfig(Bitmap.Config.ARGB_8888)
            .allowRgb565(false)
            .precision(Precision.INEXACT)
            .crossfade(250)
            .build()
        Coil.setImageLoader(ramOnlyLoader)
    }
}

@Composable
fun PhotoGuardNavHost() {
    val navController = rememberNavController()
    val clientApi = RetrofitClient.api

    NavHost(
        navController = navController,
        startDestination = "login",
        enterTransition = { fadeIn(animationSpec = tween(300)) },
        exitTransition = { fadeOut(animationSpec = tween(300)) }
    ) {
        composable("login") {
            val loginViewModel: LoginViewModel = viewModel(
                factory = ViewModelFactory(clientApi)
            )
            LoginScreen(
                viewModel = loginViewModel,
                onLoginSuccess = { verifiedAlbum ->
                    val pin = verifiedAlbum.pin
                    // Strict Routing Logic Enforcement:
                    // IF allow_download == true: Completely BYPASS GalleryScreen. Route directly to DeliveryScreen.
                    // IF allow_download == false AND is_submitted == false: Route to GalleryScreen (Standard Proofing Mode).
                    // IF allow_download == false AND (is_submitted == true OR is_locked == true): Route to DeliveryScreen.
                    val destination = if (verifiedAlbum.allowDownload) {
                        "delivery/$pin"
                    } else if (verifiedAlbum.isSubmitted || verifiedAlbum.isLocked) {
                        "delivery/$pin"
                    } else {
                        "gallery/$pin"
                    }
                    navController.navigate(destination) {
                        popUpTo("login") { inclusive = true }
                    }
                }
            )
        }

        composable(
            route = "gallery/{albumPin}",
            arguments = listOf(
                navArgument("albumPin") {
                    type = NavType.StringType
                    defaultValue = ""
                }
            )
        ) { backStackEntry ->
            val pin = backStackEntry.arguments?.getString("albumPin") ?: ""
            if (pin.isNotBlank()) {
                backStackEntry.savedStateHandle["albumPin"] = pin
            }

            val galleryViewModel: GalleryViewModel = viewModel(
                key = "gallery_$pin",
                factory = GalleryViewModelFactory(
                    api = clientApi,
                    savedStateHandle = backStackEntry.savedStateHandle,
                    initialAlbum = null
                )
            )

            GalleryScreen(
                viewModel = galleryViewModel,
                onSubmitComplete = {
                    navController.navigate("delivery/$pin") {
                        popUpTo("gallery/$pin") { inclusive = true }
                    }
                },
                onSignOut = {
                    navController.navigate("login") {
                        popUpTo(0) { inclusive = true }
                    }
                }
            )
        }

        composable(
            route = "delivery/{albumPin}",
            arguments = listOf(
                navArgument("albumPin") {
                    type = NavType.StringType
                    defaultValue = ""
                }
            )
        ) { backStackEntry ->
            val pin = backStackEntry.arguments?.getString("albumPin") ?: ""
            if (pin.isNotBlank()) {
                backStackEntry.savedStateHandle["albumPin"] = pin
            }

            val deliveryViewModel: DeliveryViewModel = viewModel(
                key = "delivery_$pin",
                factory = DeliveryViewModelFactory(
                    api = clientApi,
                    savedStateHandle = backStackEntry.savedStateHandle,
                    initialAlbum = null
                )
            )

            DeliveryScreen(
                viewModel = deliveryViewModel,
                onSignOut = {
                    navController.navigate("login") {
                        popUpTo(0) { inclusive = true }
                    }
                }
            )
        }
    }
}

class ViewModelFactory(private val api: ClientApi) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        return LoginViewModel(api) as T
    }
}

class GalleryViewModelFactory(
    private val api: ClientApi,
    private val savedStateHandle: SavedStateHandle,
    private val initialAlbum: AlbumDetailResponse? = null
) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        return GalleryViewModel(api, savedStateHandle, initialAlbum) as T
    }
}

class DeliveryViewModelFactory(
    private val api: ClientApi,
    private val savedStateHandle: SavedStateHandle,
    private val initialAlbum: AlbumDetailResponse? = null
) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        return DeliveryViewModel(api, savedStateHandle, initialAlbum) as T
    }
}
