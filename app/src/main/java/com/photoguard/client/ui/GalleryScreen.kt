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
import androidx.compose.foundation.lazy.staggeredgrid.StaggeredGridCells
import androidx.compose.foundation.lazy.staggeredgrid.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.LockClock
import androidx.compose.material.icons.filled.Sync
import androidx.compose.material.icons.filled.ZoomIn
import androidx.compose.material3.AlertDialog
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
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
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
import coil.request.ImageRequest
import com.photoguard.client.data.model.MediaItemResponse

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

    var selectedMediaForNote by remember { mutableStateOf<MediaItemResponse?>(null) }
    var tempNoteText by remember { mutableStateOf("") }
    var fullScreenPhoto by remember { mutableStateOf<MediaItemResponse?>(null) }

    // Dialog for adding notes to photo
    if (selectedMediaForNote != null) {
        AlertDialog(
            onDismissRequest = { selectedMediaForNote = null },
            title = { Text(text = "Add Retouching Note") },
            text = {
                OutlinedTextField(
                    value = tempNoteText,
                    onValueChange = { tempNoteText = it },
                    label = { Text("Your instructions or feedback") },
                    placeholder = { Text("e.g. Please soften lighting or fix skin") },
                    modifier = Modifier.fillMaxWidth(),
                    maxLines = 3
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.updatePhotoNote(selectedMediaForNote!!.id, tempNoteText)
                    selectedMediaForNote = null
                }) {
                    Text("Save Note")
                }
            },
            dismissButton = {
                TextButton(onClick = { selectedMediaForNote = null }) {
                    Text("Cancel")
                }
            }
        )
    }

    // Instagram/Pinterest style Full-Screen Lightbox View
    if (fullScreenPhoto != null) {
        val currentPhoto = uiState.mediaItems.find { it.id == fullScreenPhoto!!.id } ?: fullScreenPhoto!!
        val context = LocalContext.current

        Dialog(
            onDismissRequest = { fullScreenPhoto = null },
            properties = DialogProperties(usePlatformDefaultWidth = false)
        ) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color.Black)
            ) {
                // High-resolution image (RAM-only pipeline)
                AsyncImage(
                    model = ImageRequest.Builder(context)
                        .data(currentPhoto.url)
                        .crossfade(true)
                        .build(),
                    imageLoader = context.imageLoader,
                    contentDescription = currentPhoto.filename,
                    contentScale = ContentScale.Fit,
                    modifier = Modifier
                        .fillMaxSize()
                        .clickable { fullScreenPhoto = null }
                )

                // Top Controls Bar (Close, Filename)
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp)
                        .align(Alignment.TopCenter),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    IconButton(
                        onClick = { fullScreenPhoto = null },
                        modifier = Modifier
                            .size(42.dp)
                            .clip(CircleShape)
                            .background(Color.Black.copy(alpha = 0.6f))
                    ) {
                        Icon(
                            imageVector = Icons.Default.Close,
                            contentDescription = "Close full view",
                            tint = Color.White
                        )
                    }

                    Text(
                        text = currentPhoto.filename ?: "Photo",
                        style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                        color = Color.White
                    )

                    Spacer(modifier = Modifier.size(42.dp))
                }

                // Bottom Action Bar (Select Heart, Add Note)
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .align(Alignment.BottomCenter)
                        .background(
                            Brush.verticalGradient(
                                colors = listOf(Color.Transparent, Color.Black.copy(alpha = 0.85f))
                            )
                        )
                        .padding(20.dp)
                ) {
                    Column(modifier = Modifier.fillMaxWidth()) {
                        if (!currentPhoto.clientNotes.isNullOrBlank()) {
                            Text(
                                text = "📝 Note: ${currentPhoto.clientNotes}",
                                style = MaterialTheme.typography.bodyMedium,
                                color = Color(0xFF81C784),
                                modifier = Modifier
                                    .padding(bottom = 12.dp)
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(Color.Black.copy(alpha = 0.7f))
                                    .padding(horizontal = 10.dp, vertical = 6.dp)
                            )
                        }

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            // Note Button
                            ExtendedFloatingActionButton(
                                onClick = {
                                    tempNoteText = currentPhoto.clientNotes ?: ""
                                    selectedMediaForNote = currentPhoto
                                },
                                icon = {
                                    Icon(
                                        imageVector = Icons.Default.Edit,
                                        contentDescription = "Edit Note"
                                    )
                                },
                                text = {
                                    Text(if (currentPhoto.clientNotes.isNullOrBlank()) "Add Note" else "Edit Note")
                                },
                                containerColor = Color.DarkGray.copy(alpha = 0.8f),
                                contentColor = Color.White
                            )

                            // Heart Selection Button
                            ExtendedFloatingActionButton(
                                onClick = {
                                    viewModel.togglePhotoSelection(currentPhoto.id)
                                },
                                icon = {
                                    Icon(
                                        imageVector = if (currentPhoto.isSelected) Icons.Default.Favorite else Icons.Default.FavoriteBorder,
                                        contentDescription = "Heart Select"
                                    )
                                },
                                text = {
                                    Text(if (currentPhoto.isSelected) "Selected" else "Select")
                                },
                                containerColor = if (currentPhoto.isSelected) Color(0xFFE53935) else MaterialTheme.colorScheme.primary,
                                contentColor = Color.White
                            )
                        }
                    }
                }
            }
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
            val gridColumns = if (isTablet) StaggeredGridCells.Fixed(4) else StaggeredGridCells.Fixed(2)

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
                        bottom = 88.dp
                    ),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
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
                            onPhotoClick = { fullScreenPhoto = item },
                            onToggleSelect = { viewModel.togglePhotoSelection(item.id) },
                            onEditNote = {
                                tempNoteText = item.clientNotes ?: ""
                                selectedMediaForNote = item
                            }
                        )
                    }
                }
            }
        }
    }
}

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
        shadowElevation = 2.dp,
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Column {
                Text(
                    text = albumTitle,
                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
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

@Composable
private fun MasonryPhotoCard(
    media: MediaItemResponse,
    isLocked: Boolean,
    onPhotoClick: () -> Unit,
    onToggleSelect: () -> Unit,
    onEditNote: () -> Unit
) {
    val context = LocalContext.current
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
            .clickable { onPhotoClick() }
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
            // RAM-only loaded thumbnail
            AsyncImage(
                model = ImageRequest.Builder(context)
                    .data(media.thumbnailUrl ?: media.url)
                    .crossfade(true)
                    .build(),
                imageLoader = context.imageLoader,
                contentDescription = media.filename,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize()
            )

            // Bottom Gradient for readability
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

            // Top-left: Dedicated Retouching Note Badge & Button
            Box(
                modifier = Modifier
                    .align(Alignment.TopStart)
                    .padding(8.dp)
                    .size(34.dp)
                    .clip(CircleShape)
                    .background(Color.Black.copy(alpha = 0.5f))
                    .clickable(enabled = !isLocked) { onEditNote() },
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.Edit,
                    contentDescription = "Add Note",
                    tint = if (!media.clientNotes.isNullOrBlank()) Color(0xFF4CAF50) else Color.White.copy(alpha = 0.85f),
                    modifier = Modifier.size(16.dp)
                )
            }

            // Top-right: Heart selection button
            Box(
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .padding(8.dp)
                    .size(34.dp)
                    .clip(CircleShape)
                    .background(Color.Black.copy(alpha = 0.5f))
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

            // Bottom: Notes indicator if client typed instructions
            if (!media.clientNotes.isNullOrBlank()) {
                Text(
                    text = "📝 " + media.clientNotes,
                    style = MaterialTheme.typography.labelSmall,
                    color = Color.White,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier
                        .align(Alignment.BottomEnd)
                        .padding(end = 8.dp, bottom = 6.dp)
                        .background(Color.Black.copy(alpha = 0.6f), RoundedCornerShape(4.dp))
                        .padding(horizontal = 4.dp, vertical = 2.dp)
                )
            }

            // Bottom-left: Filename
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
