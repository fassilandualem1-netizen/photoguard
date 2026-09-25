package com.photoguard.client

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
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import coil.Coil
import coil.ImageLoader
import coil.memory.MemoryCache
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

        // Global crash guard to prevent dropping to phone's home screen
        val previousHandler = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            Log.e("PhotoGuard", "Intercepted uncaught exception: ", throwable)
            runOnUiThread {
                Toast.makeText(
                    applicationContext,
                    "PhotoGuard Warning: ${throwable.localizedMessage ?: "Unexpected error"}",
                    Toast.LENGTH_LONG
                ).show()
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

    private fun setupRamOnlyImageLoader() {
        val ramOnlyLoader = ImageLoader.Builder(this)
            .memoryCache {
                MemoryCache.Builder(this)
                    .maxSizePercent(0.35)
                    .build()
            }
            .diskCache(null)
            .crossfade(true)
            .build()
        Coil.setImageLoader(ramOnlyLoader)
    }
}

// Global holder to guarantee album state survives any navigation or recomposition
object ActiveAlbumHolder {
    var album: AlbumDetailResponse? = null
}

@Composable
fun PhotoGuardNavHost() {
    val navController = rememberNavController()
    val clientApi = RetrofitClient.api
    var currentAlbum by remember { mutableStateOf<AlbumDetailResponse?>(ActiveAlbumHolder.album) }

    NavHost(
        navController = navController,
        startDestination = if (currentAlbum != null) "gallery" else "login",
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
                    ActiveAlbumHolder.album = verifiedAlbum
                    currentAlbum = verifiedAlbum
                    navController.navigate("gallery") {
                        popUpTo("login") { inclusive = true }
                    }
                }
            )
        }

        composable("gallery") {
            val albumToDisplay = currentAlbum ?: ActiveAlbumHolder.album
            if (albumToDisplay != null) {
                val galleryViewModel: GalleryViewModel = viewModel(
                    key = "gallery_${albumToDisplay.pin}",
                    factory = GalleryViewModelFactory(clientApi, albumToDisplay)
                )
                GalleryScreen(
                    viewModel = galleryViewModel,
                    onSubmitComplete = {
                        navController.navigate("delivery")
                    }
                )
            } else {
                // Safe fallback if album was cleared
                LaunchedEffect(Unit) {
                    navController.navigate("login") {
                        popUpTo(0) { inclusive = true }
                    }
                }
            }
        }

        composable("delivery") {
            val albumToDisplay = currentAlbum ?: ActiveAlbumHolder.album
            if (albumToDisplay != null) {
                val deliveryViewModel: DeliveryViewModel = viewModel(
                    key = "delivery_${albumToDisplay.pin}",
                    factory = DeliveryViewModelFactory(clientApi, albumToDisplay)
                )
                DeliveryScreen(
                    viewModel = deliveryViewModel,
                    onSignOut = {
                        ActiveAlbumHolder.album = null
                        currentAlbum = null
                        navController.navigate("login") {
                            popUpTo(0) { inclusive = true }
                        }
                    }
                )
            } else {
                LaunchedEffect(Unit) {
                    navController.navigate("login") {
                        popUpTo(0) { inclusive = true }
                    }
                }
            }
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
    private val album: AlbumDetailResponse
) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        return GalleryViewModel(api, album) as T
    }
}

class DeliveryViewModelFactory(
    private val api: ClientApi,
    private val album: AlbumDetailResponse
) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        return DeliveryViewModel(api, album) as T
    }
}
