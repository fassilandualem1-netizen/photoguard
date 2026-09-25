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
import coil.request.CachePolicy
import coil.request.ImageRequest
import coil.size.Precision
import com.photoguard.client.data.model.MediaItemResponse

@Composable
fun GalleryScreen(
    viewModel: GalleryViewModel,
    onSubmitComplete: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }
    var showConfirmDialog by remember { mutableStateOf(false) }
    var activeEditingMedia by remember { mutableStateOf<MediaItemResponse?>(null) }
    var fullScreenMedia by remember { mutableStateOf<MediaItemResponse?>(null) }

    LaunchedEffect(uiState.isSubmitted) {
        if (uiState.isSubmitted) {
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
            GalleryTopBar(
                albumTitle = uiState.albumTitle,
                pin = uiState.pin,
                selectedCount = uiState.selectedCount,
                totalCount = uiState.totalCount,
                isLocked = uiState.isLocked,
                isSyncing = uiState.isSyncing
            )
        },
        floatingActionButton = {
            if (!uiState.isLocked) {
                ExtendedFloatingActionButton(
                    onClick = { showConfirmDialog = true },
                    icon = {
                        if (uiState.isSubmitting) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(20.dp),
                                color = MaterialTheme.colorScheme.onPrimary,
                                strokeWidth = 2.dp
                            )
                        } else {
                            Icon(Icons.Default.Check, contentDescription = "Submit Selection")
                        }
                    },
                    text = {
                        Text(
                            text = if (uiState.isSubmitting) "Submitting..." else "Submit Selections (${uiState.selectedCount})",
                            fontWeight = FontWeight.Bold
                        )
                    },
                    containerColor = MaterialTheme.colorScheme.primary,
                    contentColor = MaterialTheme.colorScheme.onPrimary
                )
            }
        }
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .background(Color(0xFF0F172A))
        ) {
            if (uiState.mediaItems.isEmpty()) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "No proofs uploaded yet.",
                        color = Color(0xFF94A3B8),
                        fontSize = 14.sp
                    )
                }
            } else {
                LazyVerticalStaggeredGrid(
                    columns = StaggeredGridCells.Fixed(2),
                    contentPadding = PaddingValues(8.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalItemSpacing = 8.dp,
                    modifier = Modifier.fillMaxSize()
                ) {
                    items(
                        items = uiState.mediaItems,
                        key = { it.id }
                    ) { media ->
                        GalleryItem(
                            media = media,
                            isLocked = uiState.isLocked,
                            onToggleSelect = { viewModel.toggleSelect(media.id) },
                            onEditNote = { activeEditingMedia = media },
                            onOpenFullScreen = { fullScreenMedia = media }
                        )
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

    // Full Screen Lightbox (Instagram / Pinterest Full Resolution Viewer)
    fullScreenMedia?.let { media ->
        Dialog(
            onDismissRequest = { fullScreenMedia = null },
            properties = DialogProperties(
                usePlatformDefaultWidth = false,
                dismissOnBackPress = true,
                dismissOnClickOutside = true
            )
        ) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color.Black)
            ) {
                val context = LocalContext.current
                val fullRequest = remember(media.url) {
                    ImageRequest.Builder(context)
                        .data(media.url)
                        .crossfade(true)
                        .precision(Precision.EXACT)
                        .diskCachePolicy(CachePolicy.DISABLED)
                        .memoryCachePolicy(CachePolicy.ENABLED)
                        .build()
                }

                AsyncImage(
                    model = fullRequest,
                    contentDescription = media.filename,
                    contentScale = ContentScale.Fit,
                    imageLoader = context.imageLoader,
                    modifier = Modifier
                        .fillMaxSize()
                        .clickable { fullScreenMedia = null }
                )

                // Top control bar
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .align(Alignment.TopCenter)
                        .background(
                            Brush.verticalGradient(
                                colors = listOf(Color(0xCC000000), Color.Transparent)
                            )
                        )
                        .padding(horizontal = 16.dp, vertical = 24.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    IconButton(
                        onClick = { fullScreenMedia = null },
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

                    Text(
                        text = media.filename,
                        color = Color.White,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Medium,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f, fill = false).padding(horizontal = 12.dp)
                    )

                    // Toggle selection directly from full screen view
                    IconButton(
                        onClick = {
                            viewModel.toggleSelect(media.id)
                            // Keep full screen item updated
                            fullScreenMedia = media.copy(is_selected = !media.is_selected)
                        },
                        modifier = Modifier
                            .size(40.dp)
                            .background(
                                if (media.is_selected) Color(0xE6E11D48) else Color(0x66000000),
                                CircleShape
                            )
                    ) {
                        Icon(
                            imageVector = if (media.is_selected) Icons.Default.Favorite else Icons.Default.FavoriteBorder,
                            contentDescription = "Favorite",
                            tint = Color.White
                        )
                    }
                }

                // Bottom notes overlay
                if (!media.client_notes.isNullOrBlank()) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .align(Alignment.BottomCenter)
                            .background(
                                Brush.verticalGradient(
                                    colors = listOf(Color.Transparent, Color(0xEE000000))
                                )
                            )
                            .padding(horizontal = 20.dp, vertical = 24.dp)
                    ) {
                        Column {
                            Text(
                                text = "Retouching Instruction:",
                                color = Color(0xFF94A3B8),
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = media.client_notes,
                                color = Color(0xFFF1F5F9),
                                fontSize = 13.sp,
                                lineHeight = 18.sp
                            )
                        }
                    }
                }
            }
        }
    }

    // Retouch Note Editor Dialog
    activeEditingMedia?.let { media ->
        NoteEditorDialog(
            initialNote = media.client_notes ?: "",
            onDismiss = { activeEditingMedia = null },
            onSave = { note ->
                viewModel.updateClientNotes(media.id, note)
                activeEditingMedia = null
            }
        )
    }

    // Submit Confirmation Dialog
    if (showConfirmDialog) {
        AlertDialog(
            onDismissRequest = { showConfirmDialog = false },
            icon = { Icon(Icons.Default.LockClock, contentDescription = null, tint = MaterialTheme.colorScheme.primary) },
            title = { Text("Finalize Album Selections?") },
            text = {
                Text(
                    "You have selected ${uiState.selectedCount} of ${uiState.totalCount} proofs.\n\n" +
                    "Once submitted, your album will be locked for the photographer to begin editing. " +
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
                    Text("Cancel")
                }
            }
        )
    }
}

@Composable
fun GalleryTopBar(
    albumTitle: String,
    pin: String,
    selectedCount: Int,
    totalCount: Int,
    isLocked: Boolean,
    isSyncing: Boolean
) {
    Surface(
        color = Color(0xFF1E293B),
        shadowElevation = 6.dp
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = albumTitle.ifEmpty { "Photo Shoot Proofs" },
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFFF8FAFC),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Spacer(modifier = Modifier.height(2.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = "PIN: $pin",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Medium,
                        color = Color(0xFF94A3B8)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "• $selectedCount of $totalCount selected",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = Color(0xFF38BDF8)
                    )
                }
            }

            Surface(
                shape = RoundedCornerShape(8.dp),
                color = if (isLocked) Color(0x33EF4444) else Color(0x3310B981),
                border = androidx.compose.foundation.BorderStroke(
                    1.dp,
                    if (isLocked) Color(0x80EF4444) else Color(0x8010B981)
                )
            ) {
                Text(
                    text = if (isLocked) "LOCKED" else "OPEN",
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    color = if (isLocked) Color(0xFFF87171) else Color(0xFF34D399),
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                )
            }
        }
    }
}

@Composable
fun GalleryItem(
    media: MediaItemResponse,
    isLocked: Boolean,
    onToggleSelect: () -> Unit,
    onEditNote: () -> Unit,
    onOpenFullScreen: () -> Unit
) {
    val heartColor by animateColorAsState(
        targetValue = if (media.is_selected) Color(0xFFE11D48) else Color.White,
        label = "heartColor"
    )

    Card(
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .border(
                width = if (media.is_selected) 2.dp else 1.dp,
                color = if (media.is_selected) Color(0xFFE11D48) else Color(0xFF334155),
                shape = RoundedCornerShape(14.dp)
            )
            .clickable {
                onOpenFullScreen()
            }
    ) {
        Column {
            BoxWithConstraints(modifier = Modifier.fillMaxWidth()) {
                val context = LocalContext.current
                val imageRequest = remember(media.thumbnail_url ?: media.url) {
                    ImageRequest.Builder(context)
                        .data(media.thumbnail_url ?: media.url)
                        .crossfade(true)
                        .precision(Precision.INEXACT)
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
                        .fillMaxWidth()
                        .aspectRatio(0.85f)
                )

                // Top right selection heart button
                IconButton(
                    onClick = {
                        if (!isLocked) onToggleSelect()
                    },
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(6.dp)
                        .size(36.dp)
                        .background(Color(0x80000000), CircleShape)
                ) {
                    Icon(
                        imageVector = if (media.is_selected) Icons.Default.Favorite else Icons.Default.FavoriteBorder,
                        contentDescription = "Select Photo",
                        tint = heartColor,
                        modifier = Modifier.size(20.dp)
                    )
                }

                // Top left full screen tap indicator
                IconButton(
                    onClick = onOpenFullScreen,
                    modifier = Modifier
                        .align(Alignment.TopStart)
                        .padding(6.dp)
                        .size(30.dp)
                        .background(Color(0x80000000), CircleShape)
                ) {
                    Icon(
                        imageVector = Icons.Default.ZoomIn,
                        contentDescription = "Zoom",
                        tint = Color.White,
                        modifier = Modifier.size(16.dp)
                    )
                }

                // Bottom left note indicator badge
                if (!media.client_notes.isNullOrBlank()) {
                    Surface(
                        shape = RoundedCornerShape(4.dp),
                        color = Color(0xCC059669),
                        modifier = Modifier
                            .align(Alignment.BottomStart)
                            .padding(6.dp)
                    ) {
                        Text(
                            text = "NOTE",
                            fontSize = 8.sp,
                            fontWeight = FontWeight.ExtraBold,
                            color = Color.White,
                            modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp)
                        )
                    }
                }
            }

            // Note action bar
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 8.dp, vertical = 6.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = if (media.client_notes.isNullOrBlank()) "No instruction" else media.client_notes,
                    fontSize = 10.sp,
                    color = if (media.client_notes.isNullOrBlank()) Color(0xFF64748B) else Color(0xFFF1F5F9),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f)
                )

                if (!isLocked) {
                    IconButton(
                        onClick = onEditNote,
                        modifier = Modifier.size(24.dp)
                    ) {
                        Icon(
                            Icons.Default.Edit,
                            contentDescription = "Edit note",
                            tint = Color(0xFF94A3B8),
                            modifier = Modifier.size(14.dp)
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun NoteEditorDialog(
    initialNote: String,
    onDismiss: () -> Unit,
    onSave: (String) -> Unit
) {
    var noteText by remember { mutableStateOf(initialNote) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Retouching Instruction") },
        text = {
            Column {
                Text(
                    "Add instructions for the photographer (e.g., soften lighting, remove background reflection, crop):",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.height(12.dp))
                OutlinedTextField(
                    value = noteText,
                    onValueChange = { noteText = it },
                    placeholder = { Text("Type instruction here...") },
                    modifier = Modifier.fillMaxWidth(),
                    maxLines = 4
                )
            }
        },
        confirmButton = {
            TextButton(onClick = { onSave(noteText) }) {
                Text("Save", fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        }
    )
}
