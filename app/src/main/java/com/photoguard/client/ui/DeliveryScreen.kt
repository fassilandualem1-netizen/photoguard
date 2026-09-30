package com.photoguard.client.ui

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.calculatePan
import androidx.compose.foundation.gestures.calculateZoom
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
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
import androidx.compose.foundation.lazy.staggeredgrid.StaggeredGridItemSpan
import androidx.compose.foundation.lazy.staggeredgrid.itemsIndexed
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ExitToApp
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.ArrowForward
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.Verified
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
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
import kotlinx.coroutines.launch




/**
 * Clean Unwatermarked URL Resolver for Android (Protected by FLAG_SECURE)
 */
fun getCleanUnwatermarkedDeliveryUrl(url: String?, rawUrl: String? = null): String {
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

fun getCrispAndroidDeliveryThumbnailUrl(media: MediaItemResponse): String {
    val clean = getCleanUnwatermarkedDeliveryUrl(media.url, media.rawUrl)
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

@Composable
fun DeliveryScreen(
    viewModel: DeliveryViewModel,
    onSignOut: () -> Unit,
    modifier: Modifier = Modifier
) {
    val uiState by viewModel.uiState.collectAsState()
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val snackbarHostState = remember { SnackbarHostState() }
    val dynamicAccentColor = remember(uiState.brandAccentColorHex) {
        parseBrandAccentColor(uiState.brandAccentColorHex)
    }
    var activePreviewIndex by remember { mutableIntStateOf(-1) }
    var showStudioInfoDialog by remember { mutableStateOf(false) }
    val studioDisplayName = remember(uiState.studioName, uiState.photographerName) {
        uiState.studioName.takeIf { it.isNotBlank() }
            ?: uiState.photographerName?.takeIf { it.isNotBlank() }
            ?: "Fasil Studio"
    }
    val deliveredPhotos = remember(uiState.mediaItems) {
        val selected = uiState.mediaItems.filter { it.isSelected }
        if (selected.isNotEmpty()) selected else uiState.mediaItems
    }
    val deliveredCount = deliveredPhotos.size
    val totalPhotos = deliveredCount

    LaunchedEffect(uiState.errorMessage) {
        uiState.errorMessage?.let { error ->
            snackbarHostState.showSnackbar(error)
            viewModel.clearErrorMessage()
        }
    }

    LaunchedEffect(uiState.downloadProgressText) {
        uiState.downloadProgressText?.let { progress ->
            snackbarHostState.showSnackbar(progress)
        }
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            // TALL STUDIO-BRANDED TOPBAR WITH STATUS BAR NOTCH CLEARANCE
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

                    // Clickable Studio Logo & Bold Name Layout (YouTube-style prominent branding)
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(12.dp))
                            .clickable { showStudioInfoDialog = true }
                            .padding(horizontal = 4.dp, vertical = 2.dp)
                    ) {
                        if (!uiState.studioLogoUrl.isNullOrBlank()) {
                            AsyncImage(
                                model = uiState.studioLogoUrl,
                                contentDescription = studioDisplayName,
                                contentScale = ContentScale.Crop,
                                modifier = Modifier
                                    .size(52.dp)
                                    .clip(CircleShape)
                                    .border(2.5.dp, dynamicAccentColor, CircleShape)
                                    .background(Color(0xFF1E293B))
                            )
                        } else {
                            Box(
                                modifier = Modifier
                                    .size(52.dp)
                                    .clip(CircleShape)
                                    .border(2.5.dp, dynamicAccentColor, CircleShape)
                                    .background(Color(0xFF1E293B)),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = studioDisplayName.take(1).uppercase(),
                                    color = dynamicAccentColor,
                                    fontSize = 22.sp,
                                    fontWeight = FontWeight.Black
                                )
                            }
                        }

                        Spacer(modifier = Modifier.width(12.dp))

                        Column {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(
                                    text = studioDisplayName,
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
                                    imageVector = Icons.Default.Verified,
                                    contentDescription = "Verified Studio",
                                    tint = Color(0xFFF59E0B),
                                    modifier = Modifier.size(18.dp)
                                )
                            }
                            Text(
                                text = "Premium Client Gallery",
                                style = MaterialTheme.typography.bodySmall.copy(
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Medium
                                ),
                                color = Color(0xFF94A3B8)
                            )
                        }
                    }

                    // Exit / Sign Out Button
                    IconButton(
                        onClick = onSignOut,
                        modifier = Modifier
                            .size(38.dp)
                            .clip(CircleShape)
                            .background(Color(0xFF1E293B))
                    ) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ExitToApp,
                            contentDescription = "Sign Out",
                            tint = Color(0xFFE2E8F0),
                            modifier = Modifier.size(18.dp)
                        )
                    }
                }
            }
        },
        modifier = modifier.fillMaxSize(),
        containerColor = Color(0xFF090D16)
    ) { paddingValues ->
        LazyVerticalStaggeredGrid(
            columns = StaggeredGridCells.Fixed(2),
            contentPadding = PaddingValues(
                start = 12.dp,
                end = 12.dp,
                top = paddingValues.calculateTopPadding() + 12.dp,
                bottom = paddingValues.calculateBottomPadding() + 24.dp
            ),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalItemSpacing = 10.dp,
            modifier = Modifier.fillMaxSize()
        ) {
            // ACTION CARD: SIMPLIFIED TEXT & ONE-CLICK DOWNLOAD BUTTON
            item(span = StaggeredGridItemSpan.FullLine) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 12.dp)
                ) {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(18.dp),
                        colors = CardDefaults.cardColors(
                            containerColor = if (uiState.allowDownload) Color(0xFF131D2E) else Color(0xFF1E1720)
                        ),
                        border = androidx.compose.foundation.BorderStroke(
                            width = 1.dp,
                            color = if (uiState.allowDownload) Color(0xFF2563EB).copy(alpha = 0.5f) else Color(0xFF7F1D1D).copy(alpha = 0.5f)
                        )
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(18.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            if (uiState.allowDownload) {
                                // EXACT USER REQUIRED TEXT
                                Text(
                                    text = "Ready for gallery download. All finalized photos are available for gallery.",
                                    style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Medium),
                                    textAlign = TextAlign.Center,
                                    color = Color(0xFFE2E8F0)
                                )
                                Spacer(modifier = Modifier.height(14.dp))

                                // EXACT USER REQUIRED BUTTON TEXT
                                Button(
                                    onClick = { viewModel.downloadAllPhotos(context) },
                                    enabled = !uiState.isFetchingDownloads && totalPhotos > 0,
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .height(52.dp),
                                    shape = RoundedCornerShape(14.dp),
                                    colors = ButtonDefaults.buttonColors(
                                        containerColor = dynamicAccentColor,
                                        contentColor = Color.White
                                    )
                                ) {
                                    if (uiState.isFetchingDownloads) {
                                        CircularProgressIndicator(
                                            modifier = Modifier.size(20.dp),
                                            color = Color.White,
                                            strokeWidth = 2.dp
                                        )
                                    } else {
                                        Row(verticalAlignment = Alignment.CenterVertically) {
                                            Icon(
                                                imageVector = Icons.Default.Download,
                                                contentDescription = null,
                                                modifier = Modifier.size(20.dp)
                                            )
                                            Spacer(modifier = Modifier.width(8.dp))
                                            Text(
                                                text = "Download all to gallery ($totalPhotos)",
                                                fontSize = 15.sp,
                                                fontWeight = FontWeight.Bold
                                            )
                                        }
                                    }
                                }
                            } else {
                                Icon(
                                    imageVector = Icons.Default.Lock,
                                    contentDescription = "Downloads Restricted",
                                    tint = Color(0xFFF87171),
                                    modifier = Modifier.size(28.dp)
                                )
                                Spacer(modifier = Modifier.height(6.dp))
                                Text(
                                    text = "Downloads Restricted",
                                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                                    color = Color(0xFFFCA5A5)
                                )
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(
                                    text = "Your photographer has not enabled direct downloads for this album yet.",
                                    style = MaterialTheme.typography.bodySmall,
                                    textAlign = TextAlign.Center,
                                    color = Color(0xFF94A3B8)
                                )
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(start = 4.dp, end = 4.dp, bottom = 6.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = "Delivered Photos ($deliveredCount)",
                            fontSize = 15.sp,
                            fontWeight = FontWeight.ExtraBold,
                            color = Color(0xFFF1F5F9),
                            letterSpacing = 0.3.sp
                        )
                        Surface(
                            color = dynamicAccentColor.copy(alpha = 0.15f),
                            shape = RoundedCornerShape(6.dp)
                        ) {
                            Text(
                                text = "Selected by Client",
                                color = dynamicAccentColor,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                            )
                        }
                    }
                }
            }

            // PURE PHOTO GRID: NO CHECKBOXES, NO HEARTS, CRISP 4K RENDERING
            itemsIndexed(
                items = deliveredPhotos,
                key = { _, item -> item.id }
            ) { index, media ->
                DeliveryPhotoItem(
                    media = media,
                    onClick = { activePreviewIndex = index }
                )
            }

            // STUDIO CONTACT DETAILS (Full Span Bottom Card)
            val hasStudioBranding = uiState.isStudioTier || !uiState.contactPhone.isNullOrBlank() || !uiState.instagramUrl.isNullOrBlank() || !uiState.telegramUrl.isNullOrBlank()
            if (hasStudioBranding) {
                item(span = StaggeredGridItemSpan.FullLine) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 24.dp)
                    ) {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(16.dp),
                            colors = CardDefaults.cardColors(containerColor = Color(0xFF131D2E)),
                            border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF1E293B))
                        ) {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(16.dp)
                            ) {
                                Text(
                                    text = "Studio & Contact",
                                    style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                                    color = Color(0xFFE2E8F0)
                                )
                                Spacer(modifier = Modifier.height(10.dp))

                                uiState.contactPhone?.takeIf { it.isNotBlank() }?.let { phone ->
                                    SocialLinkRow(
                                        label = "Phone / Call",
                                        value = phone,
                                        icon = Icons.Default.Phone,
                                        onClick = {
                                            runCatching {
                                                val intent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:$phone"))
                                                context.startActivity(intent)
                                            }
                                        }
                                    )
                                }

                                uiState.telegramUrl?.takeIf { it.isNotBlank() }?.let { tg ->
                                    SocialLinkRow(
                                        label = "Telegram",
                                        value = tg.removePrefix("https://t.me/"),
                                        icon = Icons.Default.Share,
                                        onClick = {
                                            runCatching {
                                                val url = if (tg.startsWith("http")) tg else "https://t.me/$tg"
                                                context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                                            }
                                        }
                                    )
                                }

                                uiState.instagramUrl?.takeIf { it.isNotBlank() }?.let { ig ->
                                    SocialLinkRow(
                                        label = "Instagram",
                                        value = ig.removePrefix("https://instagram.com/"),
                                        icon = Icons.Default.Share,
                                        onClick = {
                                            runCatching {
                                                val url = if (ig.startsWith("http")) ig else "https://instagram.com/$ig"
                                                context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                                            }
                                        }
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // FULL-SCREEN HORIZONTAL PAGER LIGHTBOX (SMOOTH SWIPING RESTORATION)
    if (activePreviewIndex in deliveredPhotos.indices) {
        key(activePreviewIndex) {
            val pagerState = rememberPagerState(
                initialPage = activePreviewIndex,
                pageCount = { deliveredPhotos.size }
            )
            var isCurrentPageZoomed by remember { mutableStateOf(false) }

            Dialog(
                onDismissRequest = { activePreviewIndex = -1 },
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
                    val currentMedia = deliveredPhotos.getOrNull(pagerState.currentPage)

                    // The Horizontal Pager allows effortless left/right swiping across all delivered photos
                    HorizontalPager(
                        state = pagerState,
                        modifier = Modifier.fillMaxSize(),
                        userScrollEnabled = !isCurrentPageZoomed,
                        key = { page -> deliveredPhotos.getOrNull(page)?.id ?: page }
                    ) { page ->
                        val media = deliveredPhotos[page]
                        val cleanFullUrl = remember(media.rawUrl, media.url) {
                            getCleanUnwatermarkedDeliveryUrl(media.url, media.rawUrl)
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
                                contentDescription = media.filename ?: "Photo",
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



                    // Top control bar showing Position Counter ("5 of 45") & Close Button
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .align(Alignment.TopCenter)
                            .background(
                                Brush.verticalGradient(
                                    colors = listOf(Color(0xEE000000), Color.Transparent)
                                )
                            )
                            .statusBarsPadding()
                            .padding(horizontal = 16.dp, vertical = 16.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        IconButton(
                            onClick = { activePreviewIndex = -1 },
                            modifier = Modifier
                                .size(42.dp)
                                .clip(CircleShape)
                                .background(Color.Black.copy(alpha = 0.6f))
                        ) {
                            Icon(
                                imageVector = Icons.Default.Close,
                                contentDescription = "Close Lightbox",
                                tint = Color.White
                            )
                        }

                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(
                                text = "${pagerState.currentPage + 1} of ${deliveredPhotos.size}",
                                color = Color.White,
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold
                            )
                            currentMedia?.filename?.let { fname ->
                                Text(
                                    text = fname,
                                    color = Color(0xFF94A3B8),
                                    fontSize = 11.sp,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                            }
                        }

                        Spacer(modifier = Modifier.size(42.dp))
                    }
                }
            }
        }
    }

    if (showStudioInfoDialog) {
        StudioInfoDialog(
            studioName = studioDisplayName,
            studioLogoUrl = uiState.studioLogoUrl,
            brandAccent = dynamicAccentColor,
            contactPhone = uiState.contactPhone,
            telegramUrl = uiState.telegramUrl,
            instagramUrl = uiState.instagramUrl,
            onDismiss = { showStudioInfoDialog = false }
        )
    }
}

/**
 * Pure Photo Item for Delivery Mode:
 * STRICT ENFORCEMENT:
 * - NO CHECKBOXES
 * - NO HEART ICONS
 * - ONLY PURE, CRISP HIGH-RESOLUTION RENDERING
 */
@Composable
private fun DeliveryPhotoItem(
    media: MediaItemResponse,
    onClick: () -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(Color(0xFF1E293B))
            .clickable { onClick() }
    ) {
        AsyncImage(
            model = remember(media.rawUrl, media.thumbnailUrl, media.url) {
                getCrispAndroidDeliveryThumbnailUrl(media)
            },
            contentDescription = media.filename ?: "Delivered Photo",
            contentScale = ContentScale.Crop,
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(1f)
        )
    }
}

@Composable
private fun SocialLinkRow(
    label: String,
    value: String,
    icon: ImageVector,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .clickable { onClick() }
            .padding(horizontal = 8.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(
                imageVector = icon,
                contentDescription = label,
                tint = Color(0xFF60A5FA),
                modifier = Modifier.size(16.dp)
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = label,
                style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Medium),
                color = Color(0xFFE2E8F0)
            )
        }
        Text(
            text = value,
            style = MaterialTheme.typography.bodySmall,
            color = Color(0xFF93C5FD)
        )
    }
}
