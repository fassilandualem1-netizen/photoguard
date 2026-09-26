package com.photoguard.client.ui

import android.graphics.Bitmap
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
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
import androidx.compose.foundation.lazy.staggeredgrid.items
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.ArrowForward
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.ExitToApp
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Sync
import androidx.compose.material.icons.filled.Verified
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import coil.imageLoader
import coil.request.ImageRequest
import com.photoguard.client.data.model.MediaItemResponse
import kotlinx.coroutines.launch

/**
 * Parses hex color strings safely with a standard studio gold fallback.
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
 * 2-Step Masonry Gallery Screen with Live Smart Polling (3s) and Single Submit Lock.
 *
 * Step 1: All Photos Gallery (Masonry Grid, Heart Selections, Review Button).
 * Step 2: Selected Photos Only Review (Horizontal Swipe Pager, 4K Display, Notes, Final Submit Lock).
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

    // 2-Step State: 1 = All Photos Gallery, 2 = Selected Photos Review Pager
    var currentStep by remember { mutableIntStateOf(1) }

    // Dialog States
    var showSignOutDialog by remember { mutableStateOf(false) }
    var showFinalSubmitDialog by remember { mutableStateOf(false) }

    // Dynamic Studio Brand Accent Color
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
            text = { Text("Are you sure you want to sign out and return to the PIN login screen?") },
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

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            if (currentStep == 1) {
                // Step 1: Studio Branded Top Bar with Circular Logo, Verified Badge, and Sign Out
                GalleryTopBar(
                    studioName = studioName,
                    studioLogoUrl = studioLogoUrl,
                    albumTitle = uiState.album?.title ?: "PhotoGuard Gallery",
                    brandColor = brandColor,
                    isLocked = uiState.isLocked,
                    isSyncing = uiState.isSyncing,
                    selectedCount = uiState.selectedCount,
                    totalCount = uiState.mediaItems.size,
                    onSignOutClick = { showSignOutDialog = true }
                )
            } else {
                // Step 2: Review Mode Top Bar
                ReviewTopBar(
                    selectedCount = selectedPhotos.size,
                    studioName = studioName,
                    brandColor = brandColor,
                    onBackToAllPhotos = { currentStep = 1 },
                    onSignOutClick = { showSignOutDialog = true }
                )
            }
        },
        floatingActionButton = {
            if (currentStep == 1 && !uiState.isLocked && uiState.mediaItems.isNotEmpty()) {
                // Step 1 Floating Action Button: Review Selected (12) ➔
                ExtendedFloatingActionButton(
                    onClick = {
                        if (uiState.selectedCount > 0) {
                            currentStep = 2
                        } else {
                            scope.launch {
                                snackbarHostState.showSnackbar("Tap the heart on photos to make selections first.")
                            }
                        }
                    },
                    expanded = true,
                    icon = {
                        Icon(
                            imageVector = Icons.Default.ArrowForward,
                            contentDescription = "Review Selected",
                            tint = if (uiState.selectedCount > 0) Color.Black else MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    },
                    text = {
                        Text(
                            text = "Review Selected (${uiState.selectedCount}) ➔",
                            fontWeight = FontWeight.Bold,
                            color = if (uiState.selectedCount > 0) Color.Black else MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    },
                    containerColor = if (uiState.selectedCount > 0) brandColor else MaterialTheme.colorScheme.surfaceVariant,
                    contentColor = if (uiState.selectedCount > 0) Color.Black else MaterialTheme.colorScheme.onSurfaceVariant
                )
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
                            start = 14.dp,
                            end = 14.dp,
                            top = 14.dp,
                            bottom = 96.dp // Generous space for sticky FAB
                        ),
                        horizontalItemSpacing = 12.dp,
                        verticalItemSpacing = 12.dp,
                        modifier = Modifier.fillMaxSize()
                    ) {
                        items(
                            items = uiState.mediaItems,
                            key = { it.id }
                        ) { item ->
                            MasonryPhotoCard(
                                media = item,
                                brandColor = brandColor,
                                isLocked = uiState.isLocked,
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
 * Top App Bar with circular studio logo, verified badge, studio title, and sign out button.
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
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            // Left: Circular Logo + Studio Name + Verified Badge
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.weight(1f)
            ) {
                // Circular Studio Logo Avatar
                Box(
                    modifier = Modifier
                        .size(46.dp)
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
                            style = MaterialTheme.typography.titleMedium.copy(
                                fontWeight = FontWeight.Bold,
                                fontSize = 17.sp
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
                            modifier = Modifier.size(16.dp)
                        )
                    }
                    Spacer(modifier = Modifier.height(2.dp))
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
                                modifier = Modifier.size(12.dp),
                                tint = brandColor
                            )
                        }
                    }
                }
            }

            // Right: Selected Counter + Sign Out Action Button
            Row(verticalAlignment = Alignment.CenterVertically) {
                // Counter badge
                Surface(
                    color = brandColor.copy(alpha = 0.12f),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.padding(end = 4.dp)
                ) {
                    Text(
                        text = "$selectedCount / $totalCount",
                        style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                        color = brandColor,
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                    )
                }

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
                        modifier = Modifier.size(18.dp)
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
            .clickable(enabled = !isLocked) { onToggleSelect() }
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
