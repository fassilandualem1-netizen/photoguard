package com.example

import android.os.Bundle
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.animation.Crossfade
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.lifecycle.viewmodel.compose.viewModel
import com.example.ui.CoilImageCacheManager
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import com.example.data.local.AppDatabase
import com.example.ui.AlbumScreen
import com.example.ui.AuthScreen
import com.example.ui.AuthState
import com.example.ui.MainViewModel
import com.example.ui.theme.My_applicationTheme
import com.example.util.NetworkMonitor

import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.background
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.Modifier
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.annotation.RequiresApi

@RequiresApi(34)
object ScreenCaptureHelper {
    private var callback: android.app.Activity.ScreenCaptureCallback? = null

    fun register(activity: ComponentActivity, onCapture: () -> Unit) {
        try {
            if (callback == null) {
                callback = android.app.Activity.ScreenCaptureCallback {
                    onCapture()
                }
            }
            callback?.let { activity.registerScreenCaptureCallback(activity.mainExecutor, it) }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    fun unregister(activity: ComponentActivity) {
        try {
            callback?.let { activity.unregisterScreenCaptureCallback(it) }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }
}

class MainActivity : ComponentActivity() {

    private var viewModelInstance: MainViewModel? = null
    private val captureBlocked = mutableStateOf(false)
    
    override fun onStart() {
        super.onStart()
        captureBlocked.value = false
        try {
            if (android.os.Build.VERSION.SDK_INT >= 34) {
                ScreenCaptureHelper.register(this) {
                    captureBlocked.value = true
                    viewModelInstance?.logSecurity("Screenshot Attempt Blocked")
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    override fun onStop() {
        super.onStop()
        try {
            if (android.os.Build.VERSION.SDK_INT >= 34) {
                ScreenCaptureHelper.unregister(this)
            }
            CoilImageCacheManager.clearSensitiveMedia(this)
            captureBlocked.value = false
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        try {
            // CRITICAL SECURITY REQUIREMENT:
            // Prevent screen capture, screenshots, and screen recording on client device
            window.setFlags(
                WindowManager.LayoutParams.FLAG_SECURE,
                WindowManager.LayoutParams.FLAG_SECURE
            )
        } catch (e: Exception) {
            e.printStackTrace()
        }
        
        enableEdgeToEdge()
        setContent {
            My_applicationTheme {
                val context = androidx.compose.ui.platform.LocalContext.current
                val factory = remember {
                    object : ViewModelProvider.Factory {
                        override fun <T : ViewModel> create(modelClass: Class<T>): T {
                            val database = AppDatabase.getDatabase(context)
                            val networkMonitor = NetworkMonitor(context)
                            return MainViewModel(database.albumDao(), networkMonitor, context) as T
                        }
                    }
                }
                val viewModel: MainViewModel = viewModel(factory = factory)
                viewModelInstance = viewModel
                val authState by viewModel.authState.collectAsState()

                val lifecycleOwner = LocalLifecycleOwner.current
                var isForeground by remember { mutableStateOf(true) }

                DisposableEffect(lifecycleOwner) {
                    val observer = LifecycleEventObserver { _, event ->
                        when (event) {
                            Lifecycle.Event.ON_START, Lifecycle.Event.ON_RESUME -> {
                                isForeground = true
                            }
                            Lifecycle.Event.ON_PAUSE, Lifecycle.Event.ON_STOP -> {
                                isForeground = false
                                try {
                                    viewModel.logSecurity("App moved to background / Focus lost")
                                } catch (e: Exception) {
                                    // Log quietly if failed
                                }
                            }
                            else -> {}
                        }
                    }
                    lifecycleOwner.lifecycle.addObserver(observer)
                    onDispose {
                        lifecycleOwner.lifecycle.removeObserver(observer)
                    }
                }

                Box(modifier = Modifier.fillMaxSize()) {
                    Crossfade(targetState = authState, label = "AuthTransition") { state ->
                        when (state) {
                            is AuthState.Success -> {
                                AlbumScreen(
                                    state = state,
                                    viewModel = viewModel,
                                    onBack = { viewModel.resetAuth() }
                                )
                            }
                            else -> {
                                AuthScreen(
                                    authState = state,
                                    onVerifyCode = { code -> viewModel.verifyAccessCode(code) }
                                )
                            }
                        }
                    }
                    
                    if (!isForeground || captureBlocked.value) {
                        Box(
                            modifier = Modifier
                                .fillMaxSize()
                                .background(Color.Black.copy(alpha = 0.95f))
                        )
                    }
                }
            }
        }
    }
}
