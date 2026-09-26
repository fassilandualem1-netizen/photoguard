package com.photoguard.client.ui

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
import androidx.compose.foundation.lazy.staggeredgrid.LazyVerticalStaggeredGrid
import androidx.compose.foundation.lazy.staggeredgrid.StaggerGridCells
import androidx.compose.foundation.lazy.staggeredgrid.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.LockClock
import androidx.compose.material.icons.filled.Sync
import androidx.compose.material3.Badge
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.Icon
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
import androidx.compose.runtime.remember
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
import android.graphics.Bitmap
import coil.compose.AsyncImage
import coil.imageLoader
import coil.request.ImageRequest
import com.photoguard.client.data.model.MediaItemResponse

/**
 * Masonry Gallery Screen with Live Smart Polling (3s) and Single Submit Lock.
 * Adaptable to phones (2 columns) and tablets (4+ columns).
 * Fully enforces RAM-only Coil image loading without disk persistence.
 */
@Composable
fun GalleryScreen(
    viewModel: GalleryViewModel,
    onSubmitComplete: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    val uiState by viewModel.uiState.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(uiState.userFeedbackMessage) {
        uiState.userFeedbackMessage?.let { msg ->
            snackbarHostState.showSnackbar(msg)
            viewModel.clearFeedbackMessage()
        }
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            GalleryTopBar(
                albumTitle = uiState.album?.title ?: "PhotoGuard Gallery",
                isLocked = uiState.isLocked,
                isSyncing = uiState.isSyncing,
                selectedCount = uiState.selectedCount,
                totalCount = uiState.mediaItems.size
            )
        },
        floatingActionButton = {
            // Sticky "Submit Selections" FAB
            AnimatedVisibility(
                visible = !uiState.isLocked && uiState.mediaItems.isNotEmpty(),
                enter = scaleIn() + fadeIn(),
                exit = scaleOut() + fadeOut()
            ) {
                ExtendedFloatingActionButton(
                    onClick = { viewModel.submitSelections(onSuccess = onSubmitComplete) },
                    expanded = true,
                    icon = {
                        if (uiState.isSubmitting) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(20.dp),
                                color = MaterialTheme.colorScheme.onPrimary,
                                strokeWidth = 2.dp
                            )
                        } else {
                            Icon(
                                imageVector = Icons.Default.Check,
                                contentDescription = "Submit Selections"
                            )
                        }
                    },
                    text = {
                        Text(
                            text = if (uiState.isSubmitting) "Locking..."
                            else "Submit (${uiState.selectedCount})",
                            fontWeight = FontWeight.Bold
                        )
                    },
                    containerColor = if (uiState.selectedCount > 0) MaterialTheme.colorScheme.primary
                    else MaterialTheme.colorScheme.surfaceVariant,
                    contentColor = if (uiState.selectedCount > 0) MaterialTheme.colorScheme.onPrimary
                    else MaterialTheme.colorScheme.onSurfaceVariant
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

            Column(modifier = Modifier.fillMaxSize()) {
                // Single Submit Lock Banner
                AnimatedVisibility(visible = uiState.isLocked) {
                    LockedBanner()
                }

                // Masonry Staggered Grid
                LazyVerticalStaggeredGrid(
                    columns = gridColumns,
                    contentPadding = PaddingValues(
                        start = 12.dp,
                        end = 12.dp,
                        top = 12.dp,
                        bottom = 88.dp // Space for sticky FAB
                    ),
                    horizontalItemSpacing = 10.dp,
                    verticalItemSpacing = 10.dp,
                    modifier = Modifier.fillMaxSize()
                ) {
                    items(
                        items = uiState.mediaItems,
                        key = { it.id }
                    ) { item ->
                        MasonryPhotoCard(
                            media = item,
                            isLocked = uiState.isLocked,
                            onToggleSelect = { viewModel.togglePhotoSelection(item.id) }
                        )
                    }
                }
            }
        }
    }
}

/**
 * Top App Bar with live collaborative indicator and selection counter.
 */
@Composable
private fun GalleryTopBar(
    albumTitle: String,
    isLocked: Boolean,
    isSyncing: Boolean,
    selectedCount: Int,
    totalCount: Int
) {
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
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = albumTitle,
                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    color = MaterialTheme.colorScheme.onSurface
                )
                Spacer(modifier = Modifier.height(2.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = "$selectedCount of $totalCount selected",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    if (isSyncing) {
                        Spacer(modifier = Modifier.width(6.dp))
                        Icon(
                            imageVector = Icons.Default.Sync,
                            contentDescription = "Syncing",
                            modifier = Modifier.size(12.dp),
                            tint = MaterialTheme.colorScheme.primary
                        )
                    }
                }
            }

            if (isLocked) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .background(MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.5f))
                        .padding(horizontal = 8.dp, vertical = 4.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Lock,
                        contentDescription = "Locked",
                        modifier = Modifier.size(14.dp),
                        tint = MaterialTheme.colorScheme.onErrorContainer
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = "Submitted",
                        style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                        color = MaterialTheme.colorScheme.onErrorContainer
                    )
                }
            }
        }
    }
}

/**
 * Individual Masonry Card with RAM-only Coil AsyncImage and Heart select overlay.
 */
@Composable
private fun MasonryPhotoCard(
    media: MediaItemResponse,
    isLocked: Boolean,
    onToggleSelect: () -> Unit
) {
    val context = LocalContext.current
    // Alternating aesthetic aspect ratio for realistic masonry flow
    val ratio = if (media.id % 3 == 0) 0.75f else if (media.id % 2 == 0) 1.25f else 1.0f

    val heartColor by animateColorAsState(
        targetValue = if (media.isSelected) Color(0xFFE53935) else Color.White.copy(alpha = 0.85f),
        animationSpec = tween(durationMillis = 200),
        label = "heartColor"
    )

    Card(
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .clickable(enabled = !isLocked) { onToggleSelect() }
            .then(
                if (media.isSelected) {
                    Modifier.border(2.5.dp, MaterialTheme.colorScheme.primary, RoundedCornerShape(12.dp))
                } else Modifier
            )
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(ratio)
        ) {
            // RAM-Only Image loading: Coil imageLoader is configured with diskCache(null)
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

            // Bottom gradient overlay for readability
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(48.dp)
                    .align(Alignment.BottomCenter)
                    .background(
                        Brush.verticalGradient(
                            colors = listOf(Color.Transparent, Color.Black.copy(alpha = 0.6f))
                        )
                    )
            )

            // Selectable Heart Overlay
            Box(
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .padding(8.dp)
                    .size(34.dp)
                    .clip(CircleShape)
                    .background(Color.Black.copy(alpha = 0.45f))
                    .clickable(enabled = !isLocked) { onToggleSelect() },
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = if (media.isSelected) Icons.Default.Favorite else Icons.Default.FavoriteBorder,
                    contentDescription = if (media.isSelected) "Deselect" else "Select",
                    tint = heartColor,
                    modifier = Modifier.size(18.dp)
                )
            }

            // Filename badge (bottom left)
            Text(
                text = media.filename ?: "Photo",
                style = MaterialTheme.typography.labelSmall,
                color = Color.White.copy(alpha = 0.9f),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier
                    .align(Alignment.BottomStart)
                    .padding(start = 8.dp, bottom = 6.dp)
            )
        }
    }
}

/**
 * Notice banner displayed once an album is finalized and locked.
 */
@Composable
private fun LockedBanner() {
    Surface(
        color = MaterialTheme.colorScheme.errorContainer,
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = Icons.Default.LockClock,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onErrorContainer,
                modifier = Modifier.size(20.dp)
            )
            Spacer(modifier = Modifier.width(10.dp))
            Column {
                Text(
                    text = "Album Selections Finalized",
                    style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold),
                    color = MaterialTheme.colorScheme.onErrorContainer
                )
                Text(
                    text = "This album has been submitted. Selections are locked for editing.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onErrorContainer.copy(alpha = 0.85f)
                )
            }
        }
    }
}
