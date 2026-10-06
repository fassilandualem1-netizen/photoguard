package com.photoguard.client.ui

import androidx.compose.runtime.DisposableEffect
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.calculatePan
import androidx.compose.foundation.gestures.calculateZoom
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.staggeredgrid.LazyVerticalStaggeredGrid
import androidx.compose.foundation.lazy.staggeredgrid.StaggeredGridCells
import androidx.compose.foundation.lazy.staggeredgrid.itemsIndexed
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.ArrowForward
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.DeleteOutline
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.ExitToApp
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.LockClock
import androidx.compose.material.icons.filled.Sync
import androidx.compose.material.icons.filled.Verified
import androidx.compose.material.icons.filled.ZoomIn
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import kotlinx.coroutines.launch
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import coil.compose.AsyncImage
import coil.imageLoader
import coil.request.CachePolicy
import coil.request.ImageRequest
import coil.size.Precision
import com.photoguard.client.data.model.MediaItemResponse

/**
 * Parse studio brand color with safe fallback
 */
/**
 * Clean Unwatermarked URL Formatter for Android.
 * Android client is secured via FLAG_SECURE (no screenshots/screen recording),
 * so we eradicate all watermarks to deliver crisp, pristine photography.
 */
fun getCleanUnwatermarkedUrl(url: String?, rawUrl: String? = null): String {
    if (!rawUrl.isNullOrBlank()) return rawUrl
    if (url.isNullOrBlank()) return ""

    var result = url
    // Strip Cloudinary watermarks
    if (result.contains("res.cloudinary.com") && result.contains("/upload/")) {
        result = result.replace(
            Regex("/upload/(?:s--[^/]+--/)?(?:[a-zA-Z0-9_:,.-]*,)?l_text:[^/]+/"),
            "/upload/"
        )
        result = result.replace(
            Regex("/upload/(?:s--[^/]+--/)?(?:[a-zA-Z0-9_:,.-]*,)?l_[^/]+/"),
            "/upload/"
        )
    }
    // Strip ImageKit watermarks
    if (result.contains("ik.imagekit.io")) {
        result = result.replace(Regex("([?&])tr=[^&]*l-text[^&]*(&)?")) { match ->
            if (match.groupValues[1] == "?" && match.groupValues[2] == "&") "?" else ""
        }
        result = result.replace(Regex("/tr:[^/]*l-text[^/]*/"), "/")
        result = result.trimEnd('?', '&')
    }
    return result
}

fun getCrispAndroidThumbnailUrl(media: MediaItemResponse): String {
    val clean = getCleanUnwatermarkedUrl(media.url, media.rawUrl)
    if (clean.isBlank()) return ""
    return if (clean.contains("res.cloudinary.com") && clean.contains("/upload/")) {
        clean.replace(
            Regex("/upload/(?:[a-zA-Z0-9_:,.-]+/)?"),
            "/upload/w_1000,q_auto:best,c_limit/"
        )
    } else {
        clean
    }
}



@OptIn(ExperimentalFoundationApi::class)
@Composable
fun GalleryScreen(
    viewModel: GalleryViewModel,
    onSubmitComplete: () -> Unit,
    onSignOut: () -> Unit = {}
) {
    val uiState by viewModel.uiState.collectAsState()
    val isSubmitted = uiState.isSubmitted || uiState.album.isSubmitted || uiState.isLocked || uiState.album.isLocked
    val effectiveMediaItems = remember(uiState.mediaItems, isSubmitted) {
        if (isSubmitted) {
            val selected = uiState.mediaItems.filter { it.isSelected }
            if (selected.isNotEmpty()) selected else uiState.mediaItems
        } else {
            uiState.mediaItems
        }
    }
    val snackbarHostState = remember { SnackbarHostState() }

    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_START) {
                viewModel.startPolling()
            } else if (event == Lifecycle.Event.ON_STOP) {
                viewModel.stopPolling()
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose {
            lifecycleOwner.lifecycle.removeObserver(observer)
            viewModel.stopPolling()
        }
    }

    // Step state: 1 = All Proofs, 2 = Review Selected Only
    var currentStep by remember { mutableIntStateOf(1) }

    var showConfirmDialog by remember { mutableStateOf(false) }
    var showSignOutDialog by remember { mutableStateOf(false) }
    var showStudioInfoDialog by remember { mutableStateOf(false) }

    // Full screen horizontal pager index (-1 means lightbox is closed)
    var fullScreenInitialIndex by remember { mutableIntStateOf(-1) }

    val brandAccent = remember(uiState.brandColorHex) {
        parseBrandAccentColor(uiState.brandColorHex)
    }

    LaunchedEffect(isSubmitted) {
        if (isSubmitted) {
            currentStep = 1
        }
    }

    LaunchedEffect(uiState.album.allowDownload) {
        if (uiState.album.allowDownload) {
            onSubmitComplete()
        }
    }

    LaunchedEffect(uiState.errorMessage) {
        uiState.errorMessage?.let { msg ->
            snackbarHostState.showSnackbar(msg)
            viewModel.clearError()
        }
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            Column {
                StudioBrandedTopBar(
                    studioName = uiState.studioName,
                    studioLogoUrl = uiState.studioLogoUrl,
                    brandAccent = brandAccent,
                    currentStep = currentStep,
                    selectedCount = uiState.selectedCount,
                    totalCount = uiState.totalCount,
                    isSubmitted = isSubmitted,
                    onBackToStep1 = { currentStep = 1 },
                    onStudioClick = { showStudioInfoDialog = true },
                    onSignOutClick = { showSignOutDialog = true }
                )
                if (uiState.isOffline) {
                    OfflineBanner()
                }
            }
        },
        bottomBar = {
            if (!uiState.isLocked) {
                Surface(
                    color = Color(0xFF0B132B),
                    border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF1E293B)),
                    shadowElevation = 8.dp
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 12.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        if (currentStep == 1) {
                            Column {
                                Text(
                                    text = "${uiState.selectedCount} of ${uiState.totalCount} selected",
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Color.White
                                )
                                Text(
                                    text = "Tap hearts or swipe to pick proofs",
                                    fontSize = 10.sp,
                                    color = Color(0xFF94A3B8)
                                )
                            }

                            Button(
                                onClick = { currentStep = 2 },
                                enabled = uiState.selectedCount > 0,
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = brandAccent,
                                    disabledContainerColor = Color(0xFF1E293B)
                                ),
                                shape = RoundedCornerShape(12.dp),
                                contentPadding = PaddingValues(horizontal = 18.dp, vertical = 10.dp)
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text(
                                        text = "Review Selected (${uiState.selectedCount})",
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 13.sp
                                    )
                                }
                            }
                        } else {
                            // Step 2: In Review Selected Only Mode
                            OutlinedButton(
                                onClick = { currentStep = 1 },
                                shape = RoundedCornerShape(12.dp),
                                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF475569)),
                                contentPadding = PaddingValues(horizontal = 14.dp, vertical = 10.dp)
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text(
                                        text = "Add More",
                                        color = Color.White,
                                        fontSize = 12.sp
                                    )
                                }
                            }

                            Button(
                                onClick = { showConfirmDialog = true },
                                enabled = uiState.selectedCount > 0 && !uiState.isSubmitting,
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = Color(0xFF10B981) // Emerald Confirm
                                ),
                                shape = RoundedCornerShape(12.dp),
                                contentPadding = PaddingValues(horizontal = 18.dp, vertical = 10.dp)
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    if (uiState.isSubmitting) {
                                        CircularProgressIndicator(
                                            modifier = Modifier.size(16.dp),
                                            color = Color.White,
                                            strokeWidth = 2.dp
                                        )
                                        Spacer(modifier = Modifier.width(6.dp))
                                        Text("Submitting...")
                                    } else {
                                        Icon(
                                            Icons.Default.Check,
                                            contentDescription = null,
                                            modifier = Modifier.size(16.dp)
                                        )
                                        Spacer(modifier = Modifier.width(6.dp))
                                        Text(
                                            text = "Final Submit to Studio",
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 13.sp
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .background(Color(0xFF0F172A))
        ) {
            // STEP 1: All Shoot Proofs Grid / Post-Submit Delivered View
            if (currentStep == 1) {
                Column(modifier = Modifier.fillMaxSize()) {
                    if (isSubmitted) {
                        Surface(
                            color = Color(0xFF1E293B),
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 10.dp, vertical = 8.dp),
                            shape = RoundedCornerShape(12.dp),
                            border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF334155))
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(horizontal = 14.dp, vertical = 12.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(
                                        Icons.Default.Lock,
                                        contentDescription = null,
                                        tint = brandAccent,
                                        modifier = Modifier.size(20.dp)
                                    )
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Column {
                                        Text(
                                            text = "Delivered Photos (${effectiveMediaItems.size})",
                                            style = MaterialTheme.typography.titleMedium.copy(
                                                fontWeight = FontWeight.ExtraBold,
                                                fontSize = 15.sp
                                            ),
                                            color = Color.White
                                        )
                                        Text(
                                            text = "Selections submitted to ${uiState.studioName}",
                                            fontSize = 11.sp,
                                            color = Color(0xFF94A3B8)
                                        )
                                    }
                                }
                                Surface(
                                    color = brandAccent.copy(alpha = 0.2f),
                                    shape = RoundedCornerShape(6.dp)
                                ) {
                                    Text(
                                        text = "Delivered",
                                        color = brandAccent,
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Bold,
                                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                                    )
                                }
                            }
                        }
                    }

                    if (effectiveMediaItems.isEmpty()) {
                        Box(
                            modifier = Modifier.fillMaxSize(),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = if (isSubmitted) "No selected photos submitted." else "No proofs uploaded yet.",
                                color = Color(0xFF94A3B8),
                                fontSize = 14.sp
                            )
                        }
                    } else {
                        LazyVerticalStaggeredGrid(
                            columns = StaggeredGridCells.Adaptive(minSize = 160.dp),
                            contentPadding = PaddingValues(8.dp),
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            verticalItemSpacing = 8.dp,
                            modifier = Modifier.fillMaxSize()
                        ) {
                            itemsIndexed(
                                items = effectiveMediaItems,
                                key = { _, item -> item.id }
                            ) { index, media ->
                                GalleryItem(
                                    media = media,
                                    brandAccent = brandAccent,
                                    isLocked = uiState.isLocked,
                                    onToggleSelect = { viewModel.toggleSelect(media.id) },
                                    onOpenFullScreen = { fullScreenInitialIndex = index }
                                )
                            }
                        }
                    }
                }
            } else {
                // STEP 2: Dedicated "Review Selected Only" Page
                val selectedItems = remember(uiState.mediaItems) {
                    uiState.mediaItems.filter { it.isSelected }
                }

                if (selectedItems.isEmpty()) {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(
                                text = "No photos selected yet.",
                                color = Color(0xFF94A3B8),
                                fontSize = 14.sp
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            Button(
                                onClick = { currentStep = 1 },
                                colors = ButtonDefaults.buttonColors(containerColor = brandAccent)
                            ) {
                                Text("Back to All Proofs")
                            }
                        }
                    }
                } else {
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(8.dp)
                    ) {
                        // Informational banner
                        Surface(
                            color = Color(0xFF1E293B),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(bottom = 8.dp)
                        ) {
                            Row(
                                modifier = Modifier.padding(12.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = "Reviewing ${selectedItems.size} chosen photos before locking album.",
                                    fontSize = 11.sp,
                                    color = Color(0xFF38BDF8),
                                    fontWeight = FontWeight.Medium
                                )
                            }
                        }

                        LazyVerticalStaggeredGrid(
                            columns = StaggeredGridCells.Adaptive(minSize = 160.dp),
                            contentPadding = PaddingValues(bottom = 16.dp),
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            verticalItemSpacing = 8.dp,
                            modifier = Modifier.fillMaxSize()
                        ) {
                            itemsIndexed(
                                items = selectedItems,
                                key = { _, item -> item.id }
                            ) { index, media ->
                                ReviewItemCard(
                                    media = media,
                                    brandAccent = brandAccent,
                                    onRemove = { viewModel.toggleSelect(media.id) },
                                        onOpenFullScreen = {
                                        // Find index in main list to swipe through seamlessly
                                        val mainIdx = uiState.mediaItems.indexOfFirst { it.id == media.id }
                                        fullScreenInitialIndex = if (mainIdx != -1) mainIdx else index
                                    }
                                )
                            }
                        }
                    }
                }
            }

            // Syncing indicator
            AnimatedVisibility(
                visible = uiState.isSyncing,
                enter = fadeIn(),
                exit = fadeOut(),
                modifier = Modifier
                    .align(Alignment.TopCenter)
                    .padding(top = 8.dp)
            ) {
                Surface(
                    shape = RoundedCornerShape(16.dp),
                    color = Color(0xCC1E293B),
                    contentColor = Color(0xFF38BDF8),
                    shadowElevation = 4.dp
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Sync,
                            contentDescription = "Syncing",
                            modifier = Modifier.size(14.dp)
                        )
                        Text(
                            text = "Syncing with studio...",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Medium
                        )
                    }
                }
            }

            // Locked banner
            if (uiState.isLocked) {
                Surface(
                    color = Color(0xE67F1D1D),
                    modifier = Modifier
                        .fillMaxWidth()
                        .align(Alignment.BottomCenter)
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.Center
                    ) {
                        Icon(
                            Icons.Default.Lock,
                            contentDescription = "Locked",
                            tint = Color(0xFFFCA5A5),
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "Album is locked. Selections submitted to photographer.",
                            color = Color(0xFFFEE2E2),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                }
            }
        }
    }

    // FULL SCREEN HORIZONTAL PAGER LIGHTBOX (Instagram / Google Photos Swipe Experience)
    if (fullScreenInitialIndex in effectiveMediaItems.indices) {
        key(fullScreenInitialIndex) {
            val pagerState = rememberPagerState(
                initialPage = fullScreenInitialIndex,
                pageCount = { effectiveMediaItems.size }
            )
            val coroutineScope = rememberCoroutineScope()
            var isCurrentPageZoomed by remember { mutableStateOf(false) }

            Dialog(
                onDismissRequest = { fullScreenInitialIndex = -1 },
                properties = DialogProperties(
                    usePlatformDefaultWidth = false,
                    dismissOnBackPress = true,
                    dismissOnClickOutside = false
                )
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(Color.Black)
                ) {
                    val currentMedia = effectiveMediaItems.getOrNull(pagerState.currentPage)

                    // The Horizontal Pager allows effortless left/right swiping without exiting
                    HorizontalPager(
                        state = pagerState,
                        modifier = Modifier.fillMaxSize(),
                        userScrollEnabled = !isCurrentPageZoomed,
                        key = { page -> effectiveMediaItems.getOrNull(page)?.id ?: page }
                    ) { page ->
                        val media = effectiveMediaItems[page]
                        val context = LocalContext.current
                        val cleanFullUrl = remember(media.rawUrl, media.url) {
                            getCleanUnwatermarkedUrl(media.url, media.rawUrl)
                        }
                        val fullRequest = remember(cleanFullUrl) {
                            ImageRequest.Builder(context)
                                .data(cleanFullUrl)
                                .crossfade(true)
                                .precision(Precision.EXACT)
                                .diskCachePolicy(CachePolicy.DISABLED)
                                .memoryCachePolicy(CachePolicy.ENABLED)
                                .build()
                        }
                        var scale by remember(page) { mutableFloatStateOf(1f) }
                        var offset by remember(page) { mutableStateOf(Offset.Zero) }

                        // Reset zoom & pan when navigating to another photo
                        LaunchedEffect(pagerState.currentPage) {
                            if (pagerState.currentPage != page) {
                                scale = 1f
                                offset = Offset.Zero
                            } else {
                                isCurrentPageZoomed = (scale > 1.05f)
                            }
                        }

                        LaunchedEffect(scale) {
                            if (pagerState.currentPage == page) {
                                isCurrentPageZoomed = (scale > 1.05f)
                            }
                        }

                        val imageGestureModifier = if (scale > 1.05f) {
                            Modifier
                                .pointerInput(page) {
                                    detectTransformGestures { _, pan, zoom, _ ->
                                        val newScale = (scale * zoom).coerceIn(1f, 5f)
                                        scale = newScale
                                        if (newScale > 1.05f) {
                                            offset = Offset(offset.x + pan.x, offset.y + pan.y)
                                        } else {
                                            scale = 1f
                                            offset = Offset.Zero
                                        }
                                    }
                                }
                                .pointerInput(page) {
                                    detectTapGestures(
                                        onDoubleTap = {
                                            scale = 1f
                                            offset = Offset.Zero
                                        }
                                    )
                                }
                        } else {
                            // Unzoomed: Single-finger horizontal swipes are NEVER consumed so HorizontalPager swipes freely!
                            Modifier.pointerInput(page) {
                                var lastTapTime = 0L
                                awaitEachGesture {
                                    val down = awaitFirstDown(requireUnconsumed = false)
                                    val startTime = System.currentTimeMillis()
                                    var moved = false
                                    var isPinching = false

                                    do {
                                        val event = awaitPointerEvent()
                                        if (event.changes.size >= 2) {
                                            isPinching = true
                                            val zoom = event.calculateZoom()
                                            val newScale = (scale * zoom).coerceIn(1f, 5f)
                                            if (newScale > 1.05f) {
                                                scale = newScale
                                                val pan = event.calculatePan()
                                                offset = Offset(pan.x, pan.y)
                                                event.changes.forEach { it.consume() }
                                            }
                                        } else if (!isPinching) {
                                            val current = event.changes.firstOrNull()
                                            if (current != null) {
                                                val dx = current.position.x - down.position.x
                                                val dy = current.position.y - down.position.y
                                                if (dx * dx + dy * dy > 200f) {
                                                    moved = true
                                                    // Do not consume: Let HorizontalPager swipe freely!
                                                }
                                            }
                                        }
                                    } while (event.changes.any { it.pressed })

                                    val duration = System.currentTimeMillis() - startTime
                                    if (!moved && !isPinching && duration < 300) {
                                        val now = System.currentTimeMillis()
                                        if (now - lastTapTime < 350) {
                                            scale = 2.5f
                                            lastTapTime = 0L
                                        } else {
                                            lastTapTime = now
                                        }
                                    }
                                }
                            }
                        }

                        Box(
                            modifier = Modifier
                                .fillMaxSize()
                                .then(imageGestureModifier),
                            contentAlignment = Alignment.Center
                        ) {
                            AsyncImage(
                                model = fullRequest,
                                contentDescription = media.filename,
                                contentScale = ContentScale.Fit,
                                imageLoader = context.imageLoader,
                                modifier = Modifier
                                    .fillMaxSize()
                                    .graphicsLayer(
                                        scaleX = scale,
                                        scaleY = scale,
                                        translationX = offset.x,
                                        translationY = offset.y
                                    )
                            )
                        }
                    }



                    // Top control bar showing Position Counter ("5 of 45")
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .align(Alignment.TopCenter)
                            .background(
                                Brush.verticalGradient(
                                    colors = listOf(Color(0xEE000000), Color.Transparent)
                                )
                            )
                            .padding(horizontal = 16.dp, vertical = 24.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        IconButton(
                            onClick = { fullScreenInitialIndex = -1 },
                            modifier = Modifier
                                .size(40.dp)
                                .background(Color(0x66000000), CircleShape)
                        ) {
                            Icon(
                                Icons.Default.Close,
                                contentDescription = "Close",
                                tint = Color.White
                            )
                        }

                        // Elegant Position Counter & Filename
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(
                                text = "${pagerState.currentPage + 1} of ${effectiveMediaItems.size}",
                                color = Color.White,
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold
                            )
                            currentMedia?.filename?.let { fname ->
                                Text(
                                    text = fname,
                                    color = Color(0xFF94A3B8),
                                    fontSize = 10.sp,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                            }
                        }

                        // Toggle selection directly from full screen swipe view
                        if (currentMedia != null) {
                            IconButton(
                                onClick = {
                                    if (!isSubmitted) viewModel.toggleSelect(currentMedia.id)
                                },
                                modifier = Modifier
                                    .size(40.dp)
                                    .background(
                                        if (currentMedia.isSelected) brandAccent else Color(0x66000000),
                                        CircleShape
                                    )
                            ) {
                                Icon(
                                    imageVector = if (currentMedia.isSelected) Icons.Default.Favorite else Icons.Default.FavoriteBorder,
                                    contentDescription = "Favorite",
                                    tint = Color.White
                                )
                            }
                        } else {
                            Spacer(modifier = Modifier.size(40.dp))
                        }
                    }

                    // Subtle bottom gradient shadow for immersive viewing
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(80.dp)
                            .align(Alignment.BottomCenter)
                            .background(
                                Brush.verticalGradient(
                                    colors = listOf(Color.Transparent, Color(0xCC000000))
                                )
                            )
                    )

                    // Prominent Bottom Selection Toggle / FAB in Full-Screen
                    if (currentMedia != null && !isSubmitted) {
                        Surface(
                            onClick = { viewModel.toggleSelect(currentMedia.id) },
                            shape = CircleShape,
                            color = if (currentMedia.isSelected) brandAccent else Color(0xDD1E293B),
                            border = androidx.compose.foundation.BorderStroke(
                                1.5.dp,
                                if (currentMedia.isSelected) Color.White.copy(alpha = 0.9f) else Color(0x66FFFFFF)
                            ),
                            shadowElevation = 8.dp,
                            modifier = Modifier
                                .align(Alignment.BottomCenter)
                                .padding(bottom = 28.dp)
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier.padding(horizontal = 20.dp, vertical = 10.dp)
                            ) {
                                Icon(
                                    imageVector = if (currentMedia.isSelected) Icons.Default.Favorite else Icons.Default.FavoriteBorder,
                                    contentDescription = if (currentMedia.isSelected) "Selected" else "Select Photo",
                                    tint = if (currentMedia.isSelected) Color.White else Color(0xFFCBD5E1),
                                    modifier = Modifier.size(18.dp)
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = if (currentMedia.isSelected) "Selected" else "Select Photo",
                                    color = if (currentMedia.isSelected) Color.White else Color(0xFFCBD5E1),
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    }
                }
            }
        }
    }



    // Sign Out / Switch PIN Confirmation Dialog
    if (showSignOutDialog) {
        AlertDialog(
            onDismissRequest = { showSignOutDialog = false },
            icon = { Icon(Icons.Default.ExitToApp, contentDescription = null, tint = brandAccent) },
            title = { Text("Sign Out of Album?") },
            text = { Text("You will return to the PIN login screen. Your saved selections will remain intact.") },
            confirmButton = {
                TextButton(
                    onClick = {
                        showSignOutDialog = false
                        onSignOut()
                    }
                ) {
                    Text("Sign Out", fontWeight = FontWeight.Bold, color = Color(0xFFEF4444))
                }
            },
            dismissButton = {
                TextButton(onClick = { showSignOutDialog = false }) {
                    Text("Stay")
                }
            }
        )
    }

    // Submit Confirmation Dialog
    if (showConfirmDialog) {
        AlertDialog(
            onDismissRequest = { showConfirmDialog = false },
            icon = { Icon(Icons.Default.LockClock, contentDescription = null, tint = brandAccent) },
            title = { Text("Lock & Submit ${uiState.selectedCount} Selections?") },
            text = {
                Text(
                    "You have reviewed and approved ${uiState.selectedCount} proofs.\n\n" +
                    "Once submitted, your gallery will be locked for the studio to begin retouching. " +
                    "This action cannot be undone."
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        showConfirmDialog = false
                        viewModel.submitSelection()
                    }
                ) {
                    Text("Confirm & Submit", fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showConfirmDialog = false }) {
                    Text("Review Again")
                }
            }
        )
    }

    if (showStudioInfoDialog) {
        StudioInfoDialog(
            studioName = uiState.studioName,
            studioLogoUrl = uiState.studioLogoUrl,
            brandAccent = brandAccent,
            contactPhone = uiState.album.resolvedPhone,
            telegramUrl = uiState.album.resolvedTelegram,
            instagramUrl = uiState.album.resolvedInstagram,
            tiktokUrl = uiState.album.resolvedTikTok,
            youtubeUrl = uiState.album.resolvedYouTube,
            onDismiss = { showStudioInfoDialog = false }
        )
    }
}

/**
 * Top Bar showcasing Studio Logo, Studio Name, Verified Badge, Step Toggle & Sign Out
 */
@Composable
fun StudioBrandedTopBar(
    studioName: String,
    studioLogoUrl: String?,
    brandAccent: Color,
    currentStep: Int,
    selectedCount: Int,
    totalCount: Int,
    isSubmitted: Boolean = false,
    onBackToStep1: () -> Unit,
    onStudioClick: () -> Unit,
    onSignOutClick: () -> Unit
) {
    Surface(
        color = Color(0xFF0F172A),
        border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF1E293B)),
        shadowElevation = 8.dp,
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .statusBarsPadding()
                .padding(horizontal = 14.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Left corner: Studio Logo + Studio Name + Verified Badge
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.weight(1f)
            ) {
                // If on Step 2, show Back Arrow
                if (currentStep == 2) {
                    IconButton(
                        onClick = onBackToStep1,
                        modifier = Modifier
                            .padding(end = 6.dp)
                            .size(36.dp)
                            .background(Color(0xFF1E293B), CircleShape)
                    ) {
                        Icon(
                            Icons.Default.ArrowBack,
                            contentDescription = "Back to all proofs",
                            tint = Color.White,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                }

                // Clickable Studio Logo + Bold Name layout (YouTube-style prominent branding)
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier
                        .clip(RoundedCornerShape(12.dp))
                        .clickable { onStudioClick() }
                        .padding(horizontal = 4.dp, vertical = 2.dp)
                ) {
                    // Studio prominent circular avatar/logo (46dp)
                    Box(
                        modifier = Modifier
                            .size(52.dp)
                            .clip(CircleShape)
                            .border(2.5.dp, brandAccent, CircleShape)
                            .background(Color(0xFF1E293B)),
                        contentAlignment = Alignment.Center
                    ) {
                        if (!studioLogoUrl.isNullOrBlank()) {
                            AsyncImage(
                                model = studioLogoUrl,
                                contentDescription = studioName,
                                contentScale = ContentScale.Crop,
                                modifier = Modifier.fillMaxSize()
                            )
                        } else {
                            // Elegant Initial
                            Text(
                                text = studioName.take(1).uppercase(),
                                color = brandAccent,
                                fontSize = 22.sp,
                                fontWeight = FontWeight.Black
                            )
                        }
                    }

                    Spacer(modifier = Modifier.width(12.dp))

                    Column {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                text = studioName,
                                style = MaterialTheme.typography.titleMedium.copy(
                                    fontWeight = FontWeight.ExtraBold,
                                    fontSize = 17.sp,
                                    letterSpacing = 0.4.sp
                                ),
                                color = Color.White,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                            Spacer(modifier = Modifier.width(5.dp))
                            Icon(
                                Icons.Default.Verified,
                                contentDescription = "Verified Studio",
                                tint = Color(0xFFF59E0B),
                                modifier = Modifier.size(18.dp)
                            )
                        }
                        Text(
                            text = if (isSubmitted) {
                                "Delivered Photos ($selectedCount) • Locked"
                            } else if (currentStep == 1) {
                                "Premium Client Gallery • $totalCount Proofs"
                            } else {
                                "Premium Client Gallery • $selectedCount Chosen"
                            },
                            style = MaterialTheme.typography.bodySmall.copy(
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Medium
                            ),
                            color = Color(0xFF94A3B8)
                        )
                    }
                }
            }

            // Right side: Sign Out (Exit) Button
            IconButton(
                onClick = onSignOutClick,
                modifier = Modifier
                    .size(38.dp)
                    .background(Color(0xFF1E293B), CircleShape)
            ) {
                Icon(
                    Icons.Default.ExitToApp,
                    contentDescription = "Sign Out / Exit",
                    tint = Color(0xFFCBD5E1),
                    modifier = Modifier.size(18.dp)
                )
            }
        }
    }
}

/**
 * Gallery item in Step 1 (All proofs) - Apple / Google Photos Native Style
 */
@Composable
fun GalleryItem(
    media: MediaItemResponse,
    brandAccent: Color,
    isLocked: Boolean,
    onToggleSelect: () -> Unit,
    onOpenFullScreen: () -> Unit
) {
    Card(
        shape = RoundedCornerShape(8.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
        modifier = Modifier
            .fillMaxWidth()
            .aspectRatio(1f)
            .clip(RoundedCornerShape(8.dp))
            .border(
                width = if (media.isSelected) 2.dp else 0.5.dp,
                color = if (media.isSelected) brandAccent else Color(0x22FFFFFF),
                shape = RoundedCornerShape(8.dp)
            )
            .clickable { onOpenFullScreen() }
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .aspectRatio(1f)
        ) {
            val context = LocalContext.current
            val crispUrl = remember(media.rawUrl, media.thumbnailUrl, media.url) {
                getCrispAndroidThumbnailUrl(media)
            }
            val imageRequest = remember(crispUrl) {
                ImageRequest.Builder(context)
                    .data(crispUrl)
                    .crossfade(true)
                    .precision(Precision.EXACT)
                    .diskCachePolicy(CachePolicy.DISABLED)
                    .memoryCachePolicy(CachePolicy.ENABLED)
                    .build()
            }
            AsyncImage(
                model = imageRequest,
                contentDescription = media.filename,
                contentScale = ContentScale.Crop,
                imageLoader = context.imageLoader,
                modifier = Modifier
                    .fillMaxSize()
                    .aspectRatio(1f)
            )

            // Minimalist Premium Selection Indicator (Apple / Google Photos Style)
            // If selected: tiny solid brand-colored circle with a clear checkmark strictly in TOP-RIGHT
            // If NOT selected: show ABSOLUTELY NOTHING on the thumbnail. 100% clean and unobstructed.
            if (media.isSelected) {
                Box(
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(6.dp)
                        .size(22.dp)
                        .clip(CircleShape)
                        .background(brandAccent)
                        .border(1.5.dp, Color.White, CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Check,
                        contentDescription = "Selected",
                        tint = Color.White,
                        modifier = Modifier.size(13.dp)
                    )
                }
            }
        }
    }
}

/**
 * Dedicated Review Card in Step 2 (Selected Photos Only)
 */
@Composable
fun ReviewItemCard(
    media: MediaItemResponse,
    brandAccent: Color,
    onRemove: () -> Unit,
    onOpenFullScreen: () -> Unit
) {
    Card(
        shape = RoundedCornerShape(8.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        modifier = Modifier
            .fillMaxWidth()
            .aspectRatio(1f)
            .clip(RoundedCornerShape(8.dp))
            .border(1.5.dp, brandAccent, RoundedCornerShape(8.dp))
            .clickable { onOpenFullScreen() }
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .aspectRatio(1f)
        ) {
            val context = LocalContext.current
            val crispUrl = remember(media.rawUrl, media.thumbnailUrl, media.url) {
                getCrispAndroidThumbnailUrl(media)
            }
            val imageRequest = remember(crispUrl) {
                ImageRequest.Builder(context)
                    .data(crispUrl)
                    .crossfade(true)
                    .precision(Precision.EXACT)
                    .diskCachePolicy(CachePolicy.DISABLED)
                    .memoryCachePolicy(CachePolicy.ENABLED)
                    .build()
            }
            AsyncImage(
                model = imageRequest,
                contentDescription = media.filename,
                contentScale = ContentScale.Crop,
                imageLoader = context.imageLoader,
                modifier = Modifier
                    .fillMaxSize()
                    .aspectRatio(1f)
            )

            // Remove from selection button (Trash icon)
            IconButton(
                onClick = onRemove,
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .padding(6.dp)
                    .size(26.dp)
                    .background(Color(0xCCEF4444), CircleShape)
            ) {
                Icon(
                    Icons.Default.DeleteOutline,
                    contentDescription = "Remove",
                    tint = Color.White,
                    modifier = Modifier.size(15.dp)
                )
            }
        }
    }
}

@Composable
fun OfflineBanner() {
    androidx.compose.foundation.layout.Box(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color(0xFFB91C1C))
            .padding(vertical = 4.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = "Offline / Reconnecting...",
            color = Color.White,
            style = MaterialTheme.typography.labelMedium,
            fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold
        )
    }
}
