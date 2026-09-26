package com.photoguard.client.ui

import android.graphics.Bitmap
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.tween
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.staggeredgrid.LazyVerticalStaggeredGrid
import androidx.compose.foundation.lazy.staggeredgrid.StaggerGridCells
import androidx.compose.foundation.lazy.staggeredgrid.itemsIndexed
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.ArrowForward
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.ContactSupport
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.ExitToApp
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material.icons.filled.Send
import androidx.compose.material.icons.filled.Share
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
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
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
import coil.request.ImageRequest
import com.photoguard.client.data.model.MediaItemResponse
import com.photoguard.client.utils.DeepLinkUtils
import kotlinx.coroutines.launch

/**
 * Parses hex color strings safely with standard studio gold fallback.
 */
private fun parseStudioColor(hex: String?, fallback: Color = Color(0xFFF59E0B)): Color {
    if (hex.isNullOrBlank()) return fallback
    return try {
        val clean = if (hex.startsWith("#")) hex else "#$hex"
        Color(android.graphics.Color.parseColor(clean))
    } catch (_: Exception) {
        fallback
    }
}

/**
 * Extracts clean studio initials (e.g., "Eyobel Studio" -> "ES").
 */
private fun getStudioInitials(name: String): String {
    val words = name.trim().split(" ").filter { it.isNotBlank() }
    return when {
        words.size >= 2 -> "${words[0].first().uppercaseChar()}${words[1].first().uppercaseChar()}"
        words.size == 1 && words[0].length >= 2 -> words[0].take(2).uppercase()
        words.size == 1 -> words[0].take(1).uppercase()
        else -> "PG"
    }
}

/**
 * PhotoGuard Client Gallery Screen.
 *
 * Implements:
 * 1. Studio Branding with circular logo, verified badge, and dynamic accent colors.
 * 2. Dedicated Studio Contacts / Social Links with direct deep linking (Phone, Telegram, Instagram, TikTok, YouTube).
 * 3. Fullscreen Lightbox Pager with horizontal swipe across all photos (Instagram & Google Photos style),
 *    zero system back gesture conflicts, in-lightbox selection toggle, and notes.
 * 4. 2-Step Workflow: All Photos Gallery (Step 1) -> Selected Photos Review (Step 2) -> Single Submit Lock.
 */
@Composable
fun GalleryScreen(
    viewModel: GalleryViewModel,
    onSignOut: () -> Unit = {},
    onSubmitComplete: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    val uiState by viewModel.uiState.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()

    // 2-Step Navigation: 1 = All Photos Gallery, 2 = Selected Photos Review Pager
    var currentStep by remember { mutableIntStateOf(1) }

    // Fullscreen Lightbox Pager Index (null = closed, Int = current open photo index)
    var fullscreenLightboxIndex by remember { mutableStateOf<Int?>(null) }

    // Dialog States
    var showSignOutDialog by remember { mutableStateOf(false) }
    var showFinalSubmitDialog by remember { mutableStateOf(false) }
    var showContactsDialog by remember { mutableStateOf(false) }

    // Dynamic Studio Accent Color
    val brandColor = remember(uiState.album?.brandColor) {
        parseStudioColor(uiState.album?.brandColor)
    }

    val studioName = uiState.album?.photographerName ?: uiState.album?.creatorName ?: "Photo Studio"
    val studioLogoUrl = uiState.album?.studioLogoUrl
    val selectedPhotos = remember(uiState.mediaItems) {
        uiState.mediaItems.filter { it.isSelected }
    }

    LaunchedEffect(uiState.userFeedbackMessage) {
        uiState.userFeedbackMessage?.let { msg ->
            snackbarHostState.showSnackbar(msg)
            viewModel.clearFeedbackMessage()
        }
    }

    // Sign Out Confirmation Dialog
    if (showSignOutDialog) {
        AlertDialog(
            onDismissRequest = { showSignOutDialog = false },
            title = { Text("Sign Out of Gallery", fontWeight = FontWeight.Bold) },
            text = { Text("Are you sure you want to exit and return to the PIN login screen?") },
            confirmButton = {
                Button(
                    onClick = {
                        showSignOutDialog = false
                        onSignOut()
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
                ) {
                    Text("Sign Out", fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showSignOutDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }

    // Final Submit Lock Confirmation Dialog
    if (showFinalSubmitDialog) {
        AlertDialog(
            onDismissRequest = { showFinalSubmitDialog = false },
            title = {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Default.Lock,
                        contentDescription = "Lock",
                        tint = brandColor,
                        modifier = Modifier.size(24.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Final Submit to Studio?", fontWeight = FontWeight.Bold)
                }
            },
            text = {
                Text(
                    "You are submitting ${selectedPhotos.size} selected photos to $studioName. Once submitted, selections are permanently locked for all devices.",
                    style = MaterialTheme.typography.bodyMedium
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        showFinalSubmitDialog = false
                        viewModel.submitSelections(onSuccess = onSubmitComplete)
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = brandColor)
                ) {
                    Text("Confirm & Lock 🔒", fontWeight = FontWeight.Bold, color = Color.Black)
                }
            },
            dismissButton = {
                TextButton(onClick = { showFinalSubmitDialog = false }) {
                    Text("Review More")
                }
            }
        )
    }

    // Dedicated Studio Contacts & Social Links Dialog
    if (showContactsDialog) {
        StudioContactsDialog(
            studioName = studioName,
            studioLogoUrl = studioLogoUrl,
            brandColor = brandColor,
            phone = uiState.album?.contactPhone,
            telegram = uiState.album?.telegramUrl,
            instagram = uiState.album?.instagramUrl,
            tiktok = uiState.album?.tiktokUrl,
            youtube = uiState.album?.youtubeUrl,
            onDismiss = { showContactsDialog = false },
            onError = { msg -> scope.launch { snackbarHostState.showSnackbar(msg) } }
        )
    }

    // Fullscreen Lightbox Pager Modal (Horizontal Swipe across all photos)
    if (fullscreenLightboxIndex != null && uiState.mediaItems.isNotEmpty()) {
        FullscreenLightboxModal(
            allPhotos = uiState.mediaItems,
            initialIndex = fullscreenLightboxIndex!!.coerceIn(0, uiState.mediaItems.lastIndex),
            brandColor = brandColor,
            isLocked = uiState.isLocked,
            onDismiss = { fullscreenLightboxIndex = null },
            onToggleSelect = { mediaId -> viewModel.togglePhotoSelection(mediaId) },
            onUpdateNotes = { mediaId, notes -> viewModel.updateClientNotes(mediaId, notes) }
        )
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            if (currentStep == 1) {
                // Step 1: Studio Branded Top Bar with Circular Logo, Verified Badge, Contacts Icon, and Sign Out
                GalleryTopBar(
                    studioName = studioName,
                    studioLogoUrl = studioLogoUrl,
                    albumTitle = uiState.album?.title ?: "PhotoGuard Gallery",
                    brandColor = brandColor,
                    isLocked = uiState.isLocked,
                    isSyncing = uiState.isSyncing,
                    selectedCount = uiState.selectedCount,
                    totalCount = uiState.mediaItems.size,
                    onContactsClick = { showContactsDialog = true },
                    onSignOutClick = { showSignOutDialog = true }
                )
            } else {
                // Step 2: Review Mode Top Bar
                ReviewTopBar(
                    selectedCount = selectedPhotos.size,
                    studioName = studioName,
                    brandColor = brandColor,
                    onContactsClick = { showContactsDialog = true },
                    onBackToAllPhotos = { currentStep = 1 },
                    onSignOutClick = { showSignOutDialog = true }
                )
            }
        },
        bottomBar = {
            if (currentStep == 1 && !uiState.isLocked && uiState.mediaItems.isNotEmpty()) {
                // Bottom Dual-Action Bar: [ 📞 Studio Contacts ]  [ Review Selected (12) ➔ ]
                Surface(
                    color = MaterialTheme.colorScheme.surface,
                    tonalElevation = 6.dp,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 14.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        // Studio Contacts Button (Quick access to call, telegram, instagram, etc.)
                        OutlinedButton(
                            onClick = { showContactsDialog = true },
                            shape = RoundedCornerShape(14.dp),
                            modifier = Modifier
                                .weight(0.42f)
                                .height(50.dp),
                            colors = ButtonDefaults.outlinedButtonColors(
                                contentColor = MaterialTheme.colorScheme.onSurface
                            ),
                            border = ButtonDefaults.outlinedButtonBorder.copy(
                                brush = Brush.linearGradient(listOf(brandColor.copy(alpha = 0.6f), brandColor))
                            )
                        ) {
                            Icon(
                                imageVector = Icons.Default.Phone,
                                contentDescription = "Studio Contacts",
                                tint = brandColor,
                                modifier = Modifier.size(16.dp)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = "Contacts",
                                style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold),
                                maxLines = 1
                            )
                        }

                        // Review Selected FAB / Button
                        Button(
                            onClick = {
                                if (uiState.selectedCount > 0) {
                                    currentStep = 2
                                } else {
                                    scope.launch {
                                        snackbarHostState.showSnackbar("Tap the heart on photos to select favorites first.")
                                    }
                                }
                            },
                            enabled = !uiState.isLocked,
                            shape = RoundedCornerShape(14.dp),
                            modifier = Modifier
                                .weight(0.58f)
                                .height(50.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = if (uiState.selectedCount > 0) brandColor else MaterialTheme.colorScheme.surfaceVariant,
                                contentColor = if (uiState.selectedCount > 0) Color.Black else MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        ) {
                            Text(
                                text = "Review (${uiState.selectedCount}) ➔",
                                style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                                maxLines = 1
                            )
                        }
                    }
                }
            }
        },
        modifier = modifier.fillMaxSize(),
        containerColor = MaterialTheme.colorScheme.background
    ) { paddingValues ->
        BoxWithConstraints(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            val isTablet = maxWidth > 600.dp
            val gridColumns = if (isTablet) StaggerGridCells.Fixed(4) else StaggerGridCells.Fixed(2)

            if (currentStep == 1) {
                // ==========================================
                // STEP 1: ALL PHOTOS MASONRY GALLERY
                // ==========================================
                Column(modifier = Modifier.fillMaxSize()) {
                    AnimatedVisibility(visible = uiState.isLocked) {
                        LockedBanner()
                    }

                    LazyVerticalStaggeredGrid(
                        columns = gridColumns,
                        contentPadding = PaddingValues(
                            start = 12.dp,
                            end = 12.dp,
                            top = 12.dp,
                            bottom = 20.dp
                        ),
                        horizontalItemSpacing = 10.dp,
                        verticalItemSpacing = 10.dp,
                        modifier = Modifier.fillMaxSize()
                    ) {
                        itemsIndexed(
                            items = uiState.mediaItems,
                            key = { _, it -> it.id }
                        ) { index, item ->
                            MasonryPhotoCard(
                                media = item,
                                brandColor = brandColor,
                                isLocked = uiState.isLocked,
                                onCardClick = { fullscreenLightboxIndex = index },
                                onToggleSelect = { viewModel.togglePhotoSelection(item.id) }
                            )
                        }
                    }
                }
            } else {
                // ==========================================
                // STEP 2: SELECTED PHOTOS REVIEW & SUBMIT
                // ==========================================
                SelectedPhotosReviewView(
                    selectedPhotos = selectedPhotos,
                    brandColor = brandColor,
                    isLocked = uiState.isLocked,
                    isSubmitting = uiState.isSubmitting,
                    onToggleSelect = { mediaId ->
                        viewModel.togglePhotoSelection(mediaId)
                        if (selectedPhotos.size <= 1) {
                            currentStep = 1
                        }
                    },
                    onUpdateNotes = { mediaId, note ->
                        viewModel.updateClientNotes(mediaId, note)
                    },
                    onFinalSubmit = {
                        showFinalSubmitDialog = true
                    }
                )
            }
        }
    }
}

/**
 * Top App Bar with circular studio logo, verified badge, contacts shortcut, and exit action.
 */
@Composable
private fun GalleryTopBar(
    studioName: String,
    studioLogoUrl: String?,
    albumTitle: String,
    brandColor: Color,
    isLocked: Boolean,
    isSyncing: Boolean,
    selectedCount: Int,
    totalCount: Int,
    onContactsClick: () -> Unit,
    onSignOutClick: () -> Unit
) {
    val context = LocalContext.current
    Surface(
        color = MaterialTheme.colorScheme.surface,
        tonalElevation = 3.dp,
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 14.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            // Left: Circular Logo + Studio Name + Verified Badge (Clickable to open Contacts)
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(12.dp))
                    .clickable { onContactsClick() }
                    .padding(vertical = 2.dp)
            ) {
                // Circular Studio Logo Avatar
                Box(
                    modifier = Modifier
                        .size(44.dp)
                        .clip(CircleShape)
                        .border(2.dp, brandColor, CircleShape)
                        .background(brandColor.copy(alpha = 0.15f)),
                    contentAlignment = Alignment.Center
                ) {
                    if (!studioLogoUrl.isNullOrBlank()) {
                        AsyncImage(
                            model = ImageRequest.Builder(context)
                                .data(studioLogoUrl)
                                .crossfade(true)
                                .bitmapConfig(Bitmap.Config.HARDWARE)
                                .build(),
                            contentDescription = studioName,
                            contentScale = ContentScale.Crop,
                            modifier = Modifier.fillMaxSize()
                        )
                    } else {
                        Text(
                            text = getStudioInitials(studioName),
                            style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Black),
                            color = brandColor
                        )
                    }
                }

                Spacer(modifier = Modifier.width(10.dp))

                Column {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = studioName,
                            style = MaterialTheme.typography.titleMedium.copy(
                                fontWeight = FontWeight.Bold,
                                fontSize = 16.sp
                            ),
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Icon(
                            imageVector = Icons.Default.Verified,
                            contentDescription = "Verified Studio",
                            tint = brandColor,
                            modifier = Modifier.size(15.dp)
                        )
                    }
                    Spacer(modifier = Modifier.height(1.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = albumTitle,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                        if (isSyncing) {
                            Spacer(modifier = Modifier.width(6.dp))
                            Icon(
                                imageVector = Icons.Default.Sync,
                                contentDescription = "Live Syncing",
                                modifier = Modifier.size(11.dp),
                                tint = brandColor
                            )
                        }
                    }
                }
            }

            // Right: Selected Counter + Contacts Shortcut + Sign Out Action
            Row(verticalAlignment = Alignment.CenterVertically) {
                // Counter badge
                Surface(
                    color = brandColor.copy(alpha = 0.15f),
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier.padding(end = 6.dp)
                ) {
                    Text(
                        text = "$selectedCount / $totalCount",
                        style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                        color = brandColor,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 5.dp)
                    )
                }

                // Studio Contacts Icon Button
                IconButton(
                    onClick = onContactsClick,
                    modifier = Modifier
                        .size(36.dp)
                        .clip(CircleShape)
                        .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.6f))
                ) {
                    Icon(
                        imageVector = Icons.Default.Phone,
                        contentDescription = "Studio Contacts",
                        tint = brandColor,
                        modifier = Modifier.size(17.dp)
                    )
                }

                Spacer(modifier = Modifier.width(6.dp))

                // Sign Out Button (X / Exit)
                IconButton(
                    onClick = onSignOutClick,
                    modifier = Modifier
                        .size(36.dp)
                        .clip(CircleShape)
                        .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.6f))
                ) {
                    Icon(
                        imageVector = Icons.Default.ExitToApp,
                        contentDescription = "Sign Out",
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.size(17.dp)
                    )
                }
            }
        }
    }
}

/**
 * Top App Bar for Step 2: Selected Photos Review.
 */
@Composable
private fun ReviewTopBar(
    selectedCount: Int,
    studioName: String,
    brandColor: Color,
    onContactsClick: () -> Unit,
    onBackToAllPhotos: () -> Unit,
    onSignOutClick: () -> Unit
) {
    Surface(
        color = MaterialTheme.colorScheme.surface,
        tonalElevation = 3.dp,
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onBackToAllPhotos) {
                    Icon(
                        imageVector = Icons.Default.ArrowBack,
                        contentDescription = "Back to Gallery",
                        tint = MaterialTheme.colorScheme.onSurface
                    )
                }
                Spacer(modifier = Modifier.width(4.dp))
                Column {
                    Text(
                        text = "Review Selections ($selectedCount)",
                        style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    Text(
                        text = studioName,
                        style = MaterialTheme.typography.bodySmall,
                        color = brandColor
                    )
                }
            }

            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onContactsClick) {
                    Icon(
                        imageVector = Icons.Default.Phone,
                        contentDescription = "Studio Contacts",
                        tint = brandColor
                    )
                }
                IconButton(onClick = onSignOutClick) {
                    Icon(
                        imageVector = Icons.Default.Close,
                        contentDescription = "Sign Out",
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }
}

/**
 * Fullscreen Lightbox Modal with Instagram/Google Photos style Horizontal Pager swipe,
 * 4K Hardware-Accelerated display, in-lightbox selection toggle, and retouching notes.
 */
@Composable
private fun FullscreenLightboxModal(
    allPhotos: List<MediaItemResponse>,
    initialIndex: Int,
    brandColor: Color,
    isLocked: Boolean,
    onDismiss: () -> Unit,
    onToggleSelect: (Int) -> Unit,
    onUpdateNotes: (Int, String) -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val pagerState = rememberPagerState(initialPage = initialIndex, pageCount = { allPhotos.size })
    val currentPhoto = allPhotos.getOrNull(pagerState.currentPage)

    var showNotesDialog by remember { mutableStateOf(false) }
    var noteInputText by remember { mutableStateOf("") }

    // Dialog for editing retouching notes while inside Lightbox
    if (showNotesDialog && currentPhoto != null) {
        AlertDialog(
            onDismissRequest = { showNotesDialog = false },
            title = { Text("Retouching Notes", fontWeight = FontWeight.Bold) },
            text = {
                Column {
                    Text(
                        text = "Specific instructions for ${currentPhoto.filename}:",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Spacer(modifier = Modifier.height(10.dp))
                    OutlinedTextField(
                        value = noteInputText,
                        onValueChange = { noteInputText = it },
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = { Text("e.g. Smooth facial skin, adjust warmth, crop...") },
                        maxLines = 4
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        onUpdateNotes(currentPhoto.id, noteInputText)
                        showNotesDialog = false
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = brandColor)
                ) {
                    Text("Save Note", color = Color.Black, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showNotesDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }

    Dialog(
        onDismissRequest = onDismiss,
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
            // Horizontal Pager (Consumes horizontal gestures, preventing back conflicts)
            HorizontalPager(
                state = pagerState,
                modifier = Modifier.fillMaxSize()
            ) { page ->
                val photo = allPhotos[page]
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    AsyncImage(
                        model = ImageRequest.Builder(context)
                            .data(photo.url)
                            .crossfade(true)
                            .bitmapConfig(Bitmap.Config.HARDWARE)
                            .allowHardware(true)
                            .build(),
                        contentDescription = photo.filename,
                        contentScale = ContentScale.Fit,
                        modifier = Modifier.fillMaxSize()
                    )
                }
            }

            // Top Floating Controls Bar
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .align(Alignment.TopCenter)
                    .background(
                        Brush.verticalGradient(
                            colors = listOf(Color.Black.copy(alpha = 0.85f), Color.Transparent)
                        )
                    )
                    .padding(horizontal = 14.dp, vertical = 12.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    // Close X Button
                    IconButton(
                        onClick = onDismiss,
                        modifier = Modifier
                            .size(38.dp)
                            .clip(CircleShape)
                            .background(Color.Black.copy(alpha = 0.5f))
                    ) {
                        Icon(
                            imageVector = Icons.Default.Close,
                            contentDescription = "Close Lightbox",
                            tint = Color.White
                        )
                    }

                    // Counter Pill (e.g., "5 of 45")
                    Surface(
                        color = Color.Black.copy(alpha = 0.6f),
                        shape = RoundedCornerShape(14.dp),
                        border = ButtonDefaults.outlinedButtonBorder.copy(
                            brush = Brush.linearGradient(listOf(brandColor.copy(alpha = 0.4f), brandColor))
                        )
                    ) {
                        Text(
                            text = "${pagerState.currentPage + 1} of ${allPhotos.size}",
                            style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                            color = Color.White,
                            modifier = Modifier.padding(horizontal = 14.dp, vertical = 6.dp)
                        )
                    }

                    // Right Actions: Heart Toggle & Note Icon
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        currentPhoto?.let { photo ->
                            val isHeartSelected = photo.isSelected
                            val heartColor by animateColorAsState(
                                targetValue = if (isHeartSelected) brandColor else Color.White.copy(alpha = 0.85f),
                                animationSpec = tween(durationMillis = 180),
                                label = "lightboxHeart"
                            )

                            // Heart Select / Deselect Button
                            IconButton(
                                onClick = { if (!isLocked) onToggleSelect(photo.id) },
                                modifier = Modifier
                                    .size(38.dp)
                                    .clip(CircleShape)
                                    .background(Color.Black.copy(alpha = 0.5f))
                            ) {
                                Icon(
                                    imageVector = if (isHeartSelected) Icons.Default.Favorite else Icons.Default.FavoriteBorder,
                                    contentDescription = "Toggle Selection",
                                    tint = heartColor,
                                    modifier = Modifier.size(22.dp)
                                )
                            }

                            Spacer(modifier = Modifier.width(8.dp))

                            // Retouching Note Shortcut
                            IconButton(
                                onClick = {
                                    noteInputText = photo.clientNotes ?: ""
                                    showNotesDialog = true
                                },
                                modifier = Modifier
                                    .size(38.dp)
                                    .clip(CircleShape)
                                    .background(Color.Black.copy(alpha = 0.5f))
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Edit,
                                    contentDescription = "Edit Note",
                                    tint = if (!photo.clientNotes.isNullOrBlank()) brandColor else Color.White,
                                    modifier = Modifier.size(18.dp)
                                )
                            }
                        }
                    }
                }
            }

            // Bottom Floating Bar: Retouching Notes Strip + Mini Thumbnails Carousel
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .align(Alignment.BottomCenter)
                    .background(
                        Brush.verticalGradient(
                            colors = listOf(Color.Transparent, Color.Black.copy(alpha = 0.90f))
                        )
                    )
                    .padding(bottom = 16.dp, top = 8.dp)
            ) {
                Column(modifier = Modifier.fillMaxWidth()) {
                    // Notes display pill
                    currentPhoto?.let { photo ->
                        Surface(
                            color = Color.Black.copy(alpha = 0.65f),
                            shape = RoundedCornerShape(12.dp),
                            border = ButtonDefaults.outlinedButtonBorder.copy(
                                brush = Brush.linearGradient(listOf(Color.White.copy(alpha = 0.2f), Color.White.copy(alpha = 0.1f)))
                            ),
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp, vertical = 6.dp)
                                .clickable {
                                    noteInputText = photo.clientNotes ?: ""
                                    showNotesDialog = true
                                }
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    modifier = Modifier.weight(1f)
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.Edit,
                                        contentDescription = null,
                                        tint = brandColor,
                                        modifier = Modifier.size(15.dp)
                                    )
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text(
                                        text = if (!photo.clientNotes.isNullOrBlank()) "Note: ${photo.clientNotes}" else "Tap to add retouching instructions...",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = if (!photo.clientNotes.isNullOrBlank()) Color.White else Color.White.copy(alpha = 0.6f),
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                }
                                Text(
                                    text = if (!photo.clientNotes.isNullOrBlank()) "Edit" else "+ Add",
                                    style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                                    color = brandColor
                                )
                            }
                        }
                    }

                    // Mini Thumbnails Strip for instant jumping
                    LazyRow(
                        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 6.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        itemsIndexed(allPhotos) { index, item ->
                            val isCurrent = index == pagerState.currentPage
                            Box(
                                modifier = Modifier
                                    .size(44.dp)
                                    .clip(RoundedCornerShape(8.dp))
                                    .border(
                                        width = if (isCurrent) 2.dp else 1.dp,
                                        color = if (isCurrent) brandColor else Color.White.copy(alpha = 0.25f),
                                        shape = RoundedCornerShape(8.dp)
                                    )
                                    .clickable {
                                        scope.launch { pagerState.animateScrollToPage(index) }
                                    }
                            ) {
                                AsyncImage(
                                    model = ImageRequest.Builder(context)
                                        .data(item.thumbnailUrl ?: item.url)
                                        .crossfade(true)
                                        .bitmapConfig(Bitmap.Config.HARDWARE)
                                        .build(),
                                    contentDescription = null,
                                    contentScale = ContentScale.Crop,
                                    modifier = Modifier.fillMaxSize()
                                )

                                // Heart badge on thumbnail if selected
                                if (item.isSelected) {
                                    Box(
                                        modifier = Modifier
                                            .align(Alignment.TopEnd)
                                            .padding(2.dp)
                                            .size(12.dp)
                                            .clip(CircleShape)
                                            .background(brandColor)
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

/**
 * Dedicated Studio Contacts & Social Links Dialog.
 * Direct Deep Linking to Phone Dialer, Telegram, Instagram, TikTok, and YouTube.
 * Only populated contact items are displayed; unpopulated channels are completely hidden.
 */
@Composable
private fun StudioContactsDialog(
    studioName: String,
    studioLogoUrl: String?,
    brandColor: Color,
    phone: String?,
    telegram: String?,
    instagram: String?,
    tiktok: String?,
    youtube: String?,
    onDismiss: () -> Unit,
    onError: (String) -> Unit
) {
    val context = LocalContext.current
    val hasAnyContact = !phone.isNullOrBlank() ||
            !telegram.isNullOrBlank() ||
            !instagram.isNullOrBlank() ||
            !tiktok.isNullOrBlank() ||
            !youtube.isNullOrBlank()

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth()
            ) {
                Box(
                    modifier = Modifier
                        .size(42.dp)
                        .clip(CircleShape)
                        .border(2.dp, brandColor, CircleShape)
                        .background(brandColor.copy(alpha = 0.15f)),
                    contentAlignment = Alignment.Center
                ) {
                    if (!studioLogoUrl.isNullOrBlank()) {
                        AsyncImage(
                            model = ImageRequest.Builder(context)
                                .data(studioLogoUrl)
                                .crossfade(true)
                                .bitmapConfig(Bitmap.Config.HARDWARE)
                                .build(),
                            contentDescription = studioName,
                            contentScale = ContentScale.Crop,
                            modifier = Modifier.fillMaxSize()
                        )
                    } else {
                        Text(
                            text = getStudioInitials(studioName),
                            style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Black),
                            color = brandColor
                        )
                    }
                }

                Spacer(modifier = Modifier.width(12.dp))

                Column {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = studioName,
                            style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Icon(
                            imageVector = Icons.Default.Verified,
                            contentDescription = "Verified Studio",
                            tint = brandColor,
                            modifier = Modifier.size(16.dp)
                        )
                    }
                    Text(
                        text = "Official Studio Contacts",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                if (!hasAnyContact) {
                    Text(
                        text = "The studio has not listed public contact links for this proofing album.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                } else {
                    // 1. Direct Phone Call
                    phone?.takeIf { it.isNotBlank() }?.let { phoneNum ->
                        ContactItemRow(
                            label = "Direct Call / SMS",
                            value = phoneNum,
                            icon = Icons.Default.Phone,
                            brandColor = brandColor,
                            onClick = {
                                if (!DeepLinkUtils.openDialer(context, phoneNum)) {
                                    onError("Unable to launch phone dialer application.")
                                }
                            }
                        )
                    }

                    // 2. Telegram Direct Chat / Channel
                    telegram?.takeIf { it.isNotBlank() }?.let { tg ->
                        val clean = DeepLinkUtils.cleanHandle(tg, listOf("https://t.me/", "http://t.me/", "t.me/"))
                        ContactItemRow(
                            label = "Telegram (Direct Chat)",
                            value = "@$clean",
                            icon = Icons.Default.Send,
                            brandColor = brandColor,
                            onClick = {
                                if (!DeepLinkUtils.openTelegram(context, tg)) {
                                    onError("Unable to open Telegram.")
                                }
                            }
                        )
                    }

                    // 3. Instagram Profile
                    instagram?.takeIf { it.isNotBlank() }?.let { insta ->
                        val clean = DeepLinkUtils.cleanHandle(insta, listOf("https://instagram.com/", "https://www.instagram.com/", "http://instagram.com/", "instagram.com/"))
                        ContactItemRow(
                            label = "Instagram (Profile)",
                            value = "@$clean",
                            icon = Icons.Default.Share,
                            brandColor = brandColor,
                            onClick = {
                                if (!DeepLinkUtils.openInstagram(context, insta)) {
                                    onError("Unable to open Instagram.")
                                }
                            }
                        )
                    }

                    // 4. TikTok Studio Profile
                    tiktok?.takeIf { it.isNotBlank() }?.let { tiktokHandle ->
                        val clean = DeepLinkUtils.cleanHandle(tiktokHandle, listOf("https://www.tiktok.com/@", "https://tiktok.com/@", "tiktok.com/@"))
                        ContactItemRow(
                            label = "TikTok (Studio)",
                            value = "@$clean",
                            icon = Icons.Default.Share,
                            brandColor = brandColor,
                            onClick = {
                                if (!DeepLinkUtils.openTikTok(context, tiktokHandle)) {
                                    onError("Unable to open TikTok.")
                                }
                            }
                        )
                    }

                    // 5. YouTube Channel
                    youtube?.takeIf { it.isNotBlank() }?.let { yt ->
                        ContactItemRow(
                            label = "YouTube (Channel)",
                            value = "Visit Channel",
                            icon = Icons.Default.Share,
                            brandColor = brandColor,
                            onClick = {
                                if (!DeepLinkUtils.openYouTube(context, yt)) {
                                    onError("Unable to open YouTube.")
                                }
                            }
                        )
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text("Close", fontWeight = FontWeight.Bold)
            }
        }
    )
}

/**
 * Clickable row element inside the Studio Contacts Dialog.
 */
@Composable
private fun ContactItemRow(
    label: String,
    value: String,
    icon: ImageVector,
    brandColor: Color,
    onClick: () -> Unit
) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .clickable { onClick() }
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 14.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = icon,
                    contentDescription = label,
                    tint = brandColor,
                    modifier = Modifier.size(18.dp)
                )
                Spacer(modifier = Modifier.width(10.dp))
                Text(
                    text = label,
                    style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Medium),
                    color = MaterialTheme.colorScheme.onSurface
                )
            }
            Text(
                text = value,
                style = MaterialTheme.typography.bodySmall.copy(fontWeight = FontWeight.SemiBold),
                color = brandColor,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}

/**
 * Step 2 View: Horizontal Swipe Pager displaying selected photos with 4K clarity,
 * retouching notes editing, and final submission.
 */
@Composable
private fun SelectedPhotosReviewView(
    selectedPhotos: List<MediaItemResponse>,
    brandColor: Color,
    isLocked: Boolean,
    isSubmitting: Boolean,
    onToggleSelect: (Int) -> Unit,
    onUpdateNotes: (Int, String) -> Unit,
    onFinalSubmit: () -> Unit
) {
    val context = LocalContext.current

    if (selectedPhotos.isEmpty()) {
        Box(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = "No photos selected yet.",
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
        return
    }

    val pagerState = rememberPagerState(pageCount = { selectedPhotos.size })
    val currentPhoto = selectedPhotos.getOrNull(pagerState.currentPage)

    var editingNotesDialogForPhoto by remember { mutableStateOf<MediaItemResponse?>(null) }
    var currentNoteText by remember { mutableStateOf("") }

    // Notes editing dialog
    if (editingNotesDialogForPhoto != null) {
        val target = editingNotesDialogForPhoto!!
        AlertDialog(
            onDismissRequest = { editingNotesDialogForPhoto = null },
            title = { Text("Retouching Notes", fontWeight = FontWeight.Bold) },
            text = {
                Column {
                    Text(
                        text = "Leave specific editing or retouching feedback for ${target.filename}:",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    OutlinedTextField(
                        value = currentNoteText,
                        onValueChange = { currentNoteText = it },
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = { Text("e.g., Soften facial skin, make black & white...") },
                        maxLines = 4
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        onUpdateNotes(target.id, currentNoteText)
                        editingNotesDialogForPhoto = null
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = brandColor)
                ) {
                    Text("Save Note", color = Color.Black, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { editingNotesDialogForPhoto = null }) {
                    Text("Cancel")
                }
            }
        )
    }

    Column(modifier = Modifier.fillMaxSize()) {
        // Page index counter pill
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Surface(
                color = MaterialTheme.colorScheme.surfaceVariant,
                shape = RoundedCornerShape(12.dp)
            ) {
                Text(
                    text = "Photo ${pagerState.currentPage + 1} of ${selectedPhotos.size}",
                    style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold),
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)
                )
            }

            // Quick Unselect Button
            currentPhoto?.let { photo ->
                TextButton(
                    onClick = { onToggleSelect(photo.id) },
                    colors = ButtonDefaults.textButtonColors(contentColor = MaterialTheme.colorScheme.error)
                ) {
                    Icon(
                        imageVector = Icons.Default.Close,
                        contentDescription = "Remove",
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Remove from Selection", style = MaterialTheme.typography.labelSmall)
                }
            }
        }

        // Horizontal Swipe Pager: Full-screen 4K Perceptual Lossless display
        HorizontalPager(
            state = pagerState,
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f)
        ) { page ->
            val photo = selectedPhotos[page]
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 16.dp, vertical = 4.dp),
                contentAlignment = Alignment.Center
            ) {
                Card(
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.Black),
                    modifier = Modifier.fillMaxSize()
                ) {
                    Box(modifier = Modifier.fillMaxSize()) {
                        AsyncImage(
                            model = ImageRequest.Builder(context)
                                .data(photo.url)
                                .crossfade(true)
                                .bitmapConfig(Bitmap.Config.HARDWARE)
                                .allowHardware(true)
                                .build(),
                            contentDescription = photo.filename,
                            contentScale = ContentScale.Fit,
                            modifier = Modifier.fillMaxSize()
                        )

                        // Bottom gradient with filename
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(56.dp)
                                .align(Alignment.BottomCenter)
                                .background(
                                    Brush.verticalGradient(
                                        colors = listOf(Color.Transparent, Color.Black.copy(alpha = 0.85f))
                                    )
                                )
                                .padding(horizontal = 16.dp, vertical = 8.dp),
                            contentAlignment = Alignment.BottomStart
                        ) {
                            Text(
                                text = photo.filename ?: "Selected Photo",
                                style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold),
                                color = Color.White,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                        }
                    }
                }
            }
        }

        // Retouching Notes Section for currently focused photo
        currentPhoto?.let { photo ->
            Surface(
                color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 6.dp)
                    .clickable {
                        currentNoteText = photo.clientNotes ?: ""
                        editingNotesDialogForPhoto = photo
                    }
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.weight(1f)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Edit,
                            contentDescription = "Edit Notes",
                            tint = brandColor,
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = if (!photo.clientNotes.isNullOrBlank()) "Note: ${photo.clientNotes}" else "Add retouching note for studio...",
                            style = MaterialTheme.typography.bodySmall,
                            color = if (!photo.clientNotes.isNullOrBlank()) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurfaceVariant,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                    Text(
                        text = if (!photo.clientNotes.isNullOrBlank()) "Edit" else "+ Add",
                        style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                        color = brandColor
                    )
                }
            }
        }

        // Mini Thumbnail Strip to quickly jump to any selected photo
        if (selectedPhotos.size > 1) {
            val scope = rememberCoroutineScope()
            LazyRow(
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 6.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                itemsIndexed(selectedPhotos) { index, item ->
                    val isCurrent = index == pagerState.currentPage
                    Box(
                        modifier = Modifier
                            .size(48.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .border(
                                width = if (isCurrent) 2.5.dp else 1.dp,
                                color = if (isCurrent) brandColor else Color.Transparent,
                                shape = RoundedCornerShape(8.dp)
                            )
                            .clickable {
                                scope.launch { pagerState.animateScrollToPage(index) }
                            }
                    ) {
                        AsyncImage(
                            model = ImageRequest.Builder(context)
                                .data(item.thumbnailUrl ?: item.url)
                                .crossfade(true)
                                .bitmapConfig(Bitmap.Config.HARDWARE)
                                .build(),
                            contentDescription = null,
                            contentScale = ContentScale.Crop,
                            modifier = Modifier.fillMaxSize()
                        )
                    }
                }
            }
        }

        // Bottom Submission Bar: Final Submit to Studio 🔒
        Surface(
            color = MaterialTheme.colorScheme.surface,
            tonalElevation = 6.dp,
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 12.dp)
            ) {
                Text(
                    text = "🔒 Single Submit Lock: Finalizing locks this album for all devices.",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth()
                )
                Spacer(modifier = Modifier.height(8.dp))
                Button(
                    onClick = onFinalSubmit,
                    enabled = !isLocked && !isSubmitting && selectedPhotos.isNotEmpty(),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = brandColor,
                        contentColor = Color.Black
                    ),
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(52.dp)
                ) {
                    if (isSubmitting) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(20.dp),
                            color = Color.Black,
                            strokeWidth = 2.dp
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Submitting & Locking...", fontWeight = FontWeight.Bold)
                    } else {
                        Icon(
                            imageVector = Icons.Default.Lock,
                            contentDescription = "Lock",
                            tint = Color.Black
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "Final Submit to Studio 🔒",
                            style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold)
                        )
                    }
                }
            }
        }
    }
}

/**
 * Individual Masonry Card with RAM-only Coil AsyncImage and Dynamic Brand Color Heart select overlay.
 */
@Composable
private fun MasonryPhotoCard(
    media: MediaItemResponse,
    brandColor: Color,
    isLocked: Boolean,
    onCardClick: () -> Unit,
    onToggleSelect: () -> Unit
) {
    val context = LocalContext.current
    val ratio = if (media.id % 3 == 0) 0.75f else if (media.id % 2 == 0) 1.25f else 1.0f

    val heartColor by animateColorAsState(
        targetValue = if (media.isSelected) brandColor else Color.White.copy(alpha = 0.85f),
        animationSpec = tween(durationMillis = 200),
        label = "heartColor"
    )

    Card(
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .clickable(onClick = onCardClick)
            .then(
                if (media.isSelected) {
                    Modifier.border(2.5.dp, brandColor, RoundedCornerShape(14.dp))
                } else Modifier
            )
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(ratio)
        ) {
            // RAM-Only Hardware-Accelerated 4K Image loading
            AsyncImage(
                model = ImageRequest.Builder(context)
                    .data(media.thumbnailUrl ?: media.url)
                    .crossfade(true)
                    .bitmapConfig(Bitmap.Config.HARDWARE)
                    .allowHardware(true)
                    .build(),
                imageLoader = context.imageLoader,
                contentDescription = media.filename,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize()
            )

            // Bottom gradient overlay
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(48.dp)
                    .align(Alignment.BottomCenter)
                    .background(
                        Brush.verticalGradient(
                            colors = listOf(Color.Transparent, Color.Black.copy(alpha = 0.65f))
                        )
                    )
            )

            // Selectable Heart Overlay (Dynamic Studio Brand Accent)
            Box(
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .padding(8.dp)
                    .size(36.dp)
                    .clip(CircleShape)
                    .background(Color.Black.copy(alpha = 0.50f))
                    .clickable(enabled = !isLocked) { onToggleSelect() },
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = if (media.isSelected) Icons.Default.Favorite else Icons.Default.FavoriteBorder,
                    contentDescription = if (media.isSelected) "Deselect" else "Select",
                    tint = heartColor,
                    modifier = Modifier.size(20.dp)
                )
            }

            // Filename badge (bottom left)
            Text(
                text = media.filename ?: "Photo",
                style = MaterialTheme.typography.labelSmall.copy(fontSize = 10.sp),
                color = Color.White.copy(alpha = 0.9f),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier
                    .align(Alignment.BottomStart)
                    .padding(horizontal = 8.dp, vertical = 6.dp)
            )

            // Client Retouching Note indicator badge if note is present
            if (!media.clientNotes.isNullOrBlank()) {
                Surface(
                    color = brandColor,
                    shape = RoundedCornerShape(6.dp),
                    modifier = Modifier
                        .align(Alignment.TopStart)
                        .padding(8.dp)
                ) {
                    Text(
                        text = "Note",
                        style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold, fontSize = 9.sp),
                        color = Color.Black,
                        modifier = Modifier.padding(horizontal = 5.dp, vertical = 2.dp)
                    )
                }
            }
        }
    }
}

/**
 * Single Submit Lock Banner shown when selections have been locked.
 */
@Composable
private fun LockedBanner() {
    Surface(
        color = MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.85f),
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp)
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = Icons.Default.Lock,
                contentDescription = "Album Locked",
                tint = MaterialTheme.colorScheme.onErrorContainer,
                modifier = Modifier.size(20.dp)
            )
            Spacer(modifier = Modifier.width(12.dp))
            Column {
                Text(
                    text = "Selections Locked",
                    style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold),
                    color = MaterialTheme.colorScheme.onErrorContainer
                )
                Text(
                    text = "This album was submitted and locked. Selections can no longer be modified.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onErrorContainer
                )
            }
        }
    }
}
