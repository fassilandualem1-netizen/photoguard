package com.example.ui

import android.graphics.BitmapFactory
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.BrokenImage
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import com.example.data.api.RetrofitClient
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.withContext

object SecureImageMemory {
    private val _clearGeneration = MutableStateFlow(0)
    val clearGeneration: StateFlow<Int> = _clearGeneration

    fun clear() {
        _clearGeneration.value += 1
    }
}

@Composable
fun SecureNetworkImage(
    token: String,
    modifier: Modifier = Modifier,
) {
    var bitmap by remember(token) { mutableStateOf<android.graphics.Bitmap?>(null) }
    var isLoading by remember(token) { mutableStateOf(true) }
    var hasError by remember(token) { mutableStateOf(false) }
    var retryCount by remember(token) { mutableStateOf(0) }
    val clearGeneration by SecureImageMemory.clearGeneration.collectAsState()

    LaunchedEffect(token, retryCount, clearGeneration) {
        bitmap = null
        isLoading = true
        hasError = false

        val streamToken = token.substringAfter("token=", token).substringBefore('&')

        repeat(3) { attempt ->
            if (bitmap != null) return@LaunchedEffect
            try {
                val response = withContext(Dispatchers.IO) {
                    RetrofitClient.api.getPhotoStream(streamToken)
                }
                if (response.isSuccessful) {
                    val bytes = withContext(Dispatchers.IO) { response.body()?.bytes() }
                    val decoded = bytes?.let { BitmapFactory.decodeByteArray(it, 0, it.size) }
                    if (decoded != null) {
                        bitmap = decoded
                        isLoading = false
                        return@LaunchedEffect
                    }
                }
            } catch (_: Exception) {
                // Retry transient stream failures without persisting media.
            }
            if (attempt < 2) delay(500L * (attempt + 1))
        }

        isLoading = false
        hasError = true
    }

    Box(
        modifier = modifier.background(androidx.compose.ui.graphics.Color(0xFF121212)),
        contentAlignment = Alignment.Center,
    ) {
        when {
            bitmap != null -> Image(
                bitmap = bitmap!!.asImageBitmap(),
                contentDescription = "Securely loaded photo",
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize(),
            )
            isLoading -> CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
            hasError -> Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(6.dp),
                modifier = Modifier
                    .fillMaxSize()
                    .clickable { retryCount++ }
                    .padding(12.dp),
            ) {
                Icon(
                    imageVector = Icons.Default.BrokenImage,
                    contentDescription = "Failed to load media",
                    tint = MaterialTheme.colorScheme.primary.copy(alpha = 0.8f),
                    modifier = Modifier.size(36.dp),
                )
                Text("Image unavailable", color = androidx.compose.ui.graphics.Color.White)
            }
        }
    }
}
