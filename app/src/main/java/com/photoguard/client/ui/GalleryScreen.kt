package com.photoguard.client.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
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
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.staggeredgrid.LazyVerticalStaggeredGrid
import androidx.compose.foundation.lazy.staggeredgrid.StaggeredGridCells
import androidx.compose.foundation.lazy.staggeredgrid.items
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
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
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
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
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

/**
 * Parse studio brand color with safe fallback
 */
fun parseBrandAccentColor(hexColor: String?): Color {
    if (hexColor.isNullOrBlank()) return Color(0xFF3B82F6) // Default Electric Indigo
    return try {
        val cleanHex = hexColor.trim().removePrefix("#")
        when (cleanHex.length) {
            6 -> Color(android.graphics.Color.parseColor("#$cleanHex"))
            8 -> Color(android.graphics.Color.parseColor("#$cleanHex"))
            else -> Color(0xFF3B82F6)
        }
    } catch (_: Exception) {
        Color(0xFF3B82F6)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GalleryScreen(
    viewModel: GalleryViewModel,
    onSubmitComplete: () -> Unit,
    onSignOut: () -> Unit = {}
) {
    val uiState by viewModel.uiState.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }

    // Step state: 1 = All Proofs, 2 = Review Selected Only
    var currentStep by remember { mutableStateOf(1) }

    var showConfirmDialog by remember { mutableStateOf(false) }
    var showSignOutDialog by remember { mutableStateOf(false) }
    var activeEditingMedia by remember { mutableStateOf<MediaItemResponse?>(null) }
    var fullScreenMedia by remember { mutableStateOf<MediaItemResponse?>(null) }

    val brandAccent = remember(uiState.brandColorHex) {
        parseBrandAccentColor(uiState.brandColorHex)
    }

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
            StudioBrandedTopBar(
                studioName = uiState.studioName,
                studioLogoUrl = uiState.studioLogoUrl,
                brandAccent = brandAccent,
                currentStep = currentStep,
                selectedCount = uiState.selectedCount,
                totalCount = uiState.totalCount,
                isLocked = uiState.isLocked,
                isSyncing = uiState.isSyncing,
                onBackToStep1 = { currentStep = 1 },
                onSignOutClick = { showSignOutDialog = true }
            )
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
                                    text = "Tap hearts to choose your proofs",
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
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Icon(
                                        Icons.Default.ArrowForward,
                                        contentDescription = null,
                                        modifier = Modifier.size(16.dp)
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
                                    Icon(
                                        Icons.Default.ArrowBack,
                                        contentDescription = null,
                                        tint = Color.White,
                                        modifier = Modifier.size(16.dp)
                                    )
                                    Spacer(modifier = Modifier.width(4.dp))
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
                                            text = "Final Submit to Studio 🔒",
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
            // STEP 1: All Shoot Proofs Grid
            if (currentStep == 1) {
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
                                brandAccent = brandAccent,
                                isLocked = uiState.isLocked,
                                onToggleSelect = { viewModel.toggleSelect(media.id) },
                                onEditNote = { activeEditingMedia = media },
                                onOpenFullScreen = { fullScreenMedia = media }
                            )
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
                                    text = "🔍 Reviewing ${selectedItems.size} chosen photos before locking album.",
                                    fontSize = 11.sp,
                                    color = Color(0xFF38BDF8),
                                    fontWeight = FontWeight.Medium
                                )
                            }
                        }

                        LazyVerticalStaggeredGrid(
                            columns = StaggeredGridCells.Fixed(2),
                            contentPadding = PaddingValues(bottom = 16.dp),
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            verticalItemSpacing = 8.dp,
                            modifier = Modifier.fillMaxSize()
                        ) {
                            items(
                                items = selectedItems,
                                key = { it.id }
                            ) { media ->
                                ReviewItemCard(
                                    media = media,
                                    brandAccent = brandAccent,
                                    onRemove = { viewModel.toggleSelect(media.id) },
                                    onEditNote = { activeEditingMedia = media },
                                    onOpenFullScreen = { fullScreenMedia = media }
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
                        text = media.filename ?: "Photo",
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
                            fullScreenMedia = media.copy(isSelected = !media.isSelected)
                        },
                        modifier = Modifier
                            .size(40.dp)
                            .background(
                                if (media.isSelected) brandAccent else Color(0x66000000),
                                CircleShape
                            )
                    ) {
                        Icon(
                            imageVector = if (media.isSelected) Icons.Default.Favorite else Icons.Default.FavoriteBorder,
                            contentDescription = "Favorite",
                            tint = Color.White
                        )
                    }
                }

                // Bottom notes overlay
                if (!media.clientNotes.isNullOrBlank()) {
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
                                text = media.clientNotes,
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
            initialNote = media.clientNotes ?: "",
            onDismiss = { activeEditingMedia = null },
            onSave = { note ->
                viewModel.updateClientNotes(media.id, note)
                activeEditingMedia = null
            }
        )
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
                    Text("Confirm & Submit 🔒", fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showConfirmDialog = false }) {
                    Text("Review Again")
                }
            }
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
    isLocked: Boolean,
    isSyncing: Boolean,
    onBackToStep1: () -> Unit,
    onSignOutClick: () -> Unit
) {
    Surface(
        color = Color(0xFF0F172A),
        border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF1E293B)),
        shadowElevation = 6.dp
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 14.dp, vertical = 10.dp),
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
                            .size(32.dp)
                    ) {
                        Icon(
                            Icons.Default.ArrowBack,
                            contentDescription = "Back to all proofs",
                            tint = Color.White
                        )
                    }
                }

                // Studio circular avatar/logo
                Box(
                    modifier = Modifier
                        .size(38.dp)
                        .clip(CircleShape)
                        .border(1.5.dp, brandAccent, CircleShape)
                        .background(Color(0xFF1E293B)),
                    contentAlignment = Alignment.Center
                ) {
                    if (!studioLogoUrl.isNullOrBlank()) {
                        val context = LocalContext.current
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
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Black
                        )
                    }
                }

                Spacer(modifier = Modifier.width(10.dp))

                Column {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = studioName,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Icon(
                            Icons.Default.Verified,
                            contentDescription = "Verified Studio",
                            tint = brandAccent,
                            modifier = Modifier.size(14.dp)
                        )
                    }
                    Text(
                        text = if (currentStep == 1) "Proofs ($totalCount)" else "Selected ($selectedCount)",
                        fontSize = 11.sp,
                        color = Color(0xFF94A3B8)
                    )
                }
            }

            // Right side: Sign Out (Exit) Button
            IconButton(
                onClick = onSignOutClick,
                modifier = Modifier
                    .size(36.dp)
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
 * Gallery item in Step 1 (All proofs)
 */
@Composable
fun GalleryItem(
    media: MediaItemResponse,
    brandAccent: Color,
    isLocked: Boolean,
    onToggleSelect: () -> Unit,
    onEditNote: () -> Unit,
    onOpenFullScreen: () -> Unit
) {
    val heartColor by animateColorAsState(
        targetValue = if (media.isSelected) brandAccent else Color.White,
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
                width = if (media.isSelected) 2.dp else 1.dp,
                color = if (media.isSelected) brandAccent else Color(0xFF334155),
                shape = RoundedCornerShape(14.dp)
            )
            .clickable { onOpenFullScreen() }
    ) {
        Column {
            BoxWithConstraints(modifier = Modifier.fillMaxWidth()) {
                val context = LocalContext.current
                val imageRequest = remember(media.thumbnailUrl ?: media.url) {
                    ImageRequest.Builder(context)
                        .data(media.thumbnailUrl ?: media.url)
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
                        imageVector = if (media.isSelected) Icons.Default.Favorite else Icons.Default.FavoriteBorder,
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
                if (!media.clientNotes.isNullOrBlank()) {
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
                    text = if (media.clientNotes.isNullOrBlank()) "No instruction" else media.clientNotes,
                    fontSize = 10.sp,
                    color = if (media.clientNotes.isNullOrBlank()) Color(0xFF64748B) else Color(0xFFF1F5F9),
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

/**
 * Dedicated Review Card in Step 2 (Selected Photos Only)
 */
@Composable
fun ReviewItemCard(
    media: MediaItemResponse,
    brandAccent: Color,
    onRemove: () -> Unit,
    onEditNote: () -> Unit,
    onOpenFullScreen: () -> Unit
) {
    Card(
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
        elevation = CardDefaults.cardElevation(defaultElevation = 3.dp),
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .border(1.5.dp, brandAccent, RoundedCornerShape(14.dp))
    ) {
        Column {
            Box(modifier = Modifier.fillMaxWidth()) {
                val context = LocalContext.current
                AsyncImage(
                    model = media.thumbnailUrl ?: media.url,
                    contentDescription = media.filename,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier
                        .fillMaxWidth()
                        .aspectRatio(0.9f)
                        .clickable { onOpenFullScreen() }
                )

                // Remove from selection button (Trash/Minus icon)
                IconButton(
                    onClick = onRemove,
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(6.dp)
                        .size(32.dp)
                        .background(Color(0xCCEF4444), CircleShape)
                ) {
                    Icon(
                        Icons.Default.DeleteOutline,
                        contentDescription = "Remove",
                        tint = Color.White,
                        modifier = Modifier.size(18.dp)
                    )
                }
            }

            // Note section in Step 2
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(8.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Retouching Note:",
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF94A3B8)
                    )
                    IconButton(
                        onClick = onEditNote,
                        modifier = Modifier.size(20.dp)
                    ) {
                        Icon(
                            Icons.Default.Edit,
                            contentDescription = "Edit",
                            tint = brandAccent,
                            modifier = Modifier.size(13.dp)
                        )
                    }
                }

                Text(
                    text = if (media.clientNotes.isNullOrBlank()) "None (Tap edit to add note)" else media.clientNotes,
                    fontSize = 11.sp,
                    color = if (media.clientNotes.isNullOrBlank()) Color(0xFF64748B) else Color(0xFFF1F5F9),
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
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
