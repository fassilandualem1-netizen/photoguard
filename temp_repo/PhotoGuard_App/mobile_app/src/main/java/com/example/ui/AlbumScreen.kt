package com.example.ui

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Block
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.PlayCircleOutline
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.PhotoLibrary
import androidx.compose.material.icons.filled.Policy
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.outlined.Shield
import androidx.compose.material.icons.outlined.Info
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.Image
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.layout.ContentScale
import com.example.R
import com.example.data.model.MediaToken
import com.example.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AlbumScreen(
    state: AuthState.Success,
    viewModel: MainViewModel,
    onBack: () -> Unit
) {
    val selectedTokens by viewModel.selectedTokens.collectAsState()
    val isSubmitting by viewModel.isSubmitting.collectAsState()
    val submitStatus by viewModel.submitStatus.collectAsState()
    val min by viewModel.countdownMinutes.collectAsState()
    val sec by viewModel.countdownSeconds.collectAsState()

    var currentCategory by remember { mutableStateOf("All") }
    var currentTab by remember { mutableStateOf("ALBUM") }
    var fullScreenInitialPage by remember { mutableStateOf<Int?>(null) }
    val photoNotes by viewModel.photoNotes.collectAsState()
    
    val categories = remember(state.tokens) { 
        listOf("All") + state.tokens.map { it.category }.distinct() 
    }

    val photoTokens = if (currentTab == "ALBUM") {
        if (currentCategory == "All") state.tokens else state.tokens.filter { it.category == currentCategory }
    } else {
        state.tokens.filter { selectedTokens.contains(it.token) }
    }

    // Studio Neon Pulse Light Animation
    val infiniteTransition = rememberInfiniteTransition(label = "pulse")
    val glowAlpha by infiniteTransition.animateFloat(
        initialValue = 0.3f,
        targetValue = 1.0f,
        animationSpec = infiniteRepeatable(
            animation = tween(1500, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "glowAlpha"
    )
    val glowColor by infiniteTransition.animateColor(
        initialValue = Color(0xFF00E5FF),
        targetValue = Color(0xFFFF007F),
        animationSpec = infiniteRepeatable(
            animation = tween(1500, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "glowColor"
    )

    if (submitStatus != null && submitStatus != "LOCKED") {
        AlertDialog(
            onDismissRequest = { viewModel.resetSubmitStatus() },
            title = { Text(if (submitStatus == "SUCCESS") "Success" else "Error", color = MaterialTheme.colorScheme.onSurface) },
            text = { Text(
                when (submitStatus) {
                    "SUCCESS" -> "Your selections have been successfully submitted. Locking in 20 minutes."
                    "RATE_LIMIT" -> "Too many requests. Please try again later."
                    else -> "An error occurred while submitting. Please try again."
                },
                color = MaterialTheme.colorScheme.onSurface
            ) },
            confirmButton = {
                TextButton(onClick = { viewModel.resetSubmitStatus() }) {
                    Text("OK", color = MaterialTheme.colorScheme.primary)
                }
            },
            containerColor = MaterialTheme.colorScheme.surface
        )
    }

    // Full screen viewer
    if (fullScreenInitialPage != null) {
        Dialog(
            onDismissRequest = { fullScreenInitialPage = null },
            properties = DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false)
        ) {
            val pagerState = androidx.compose.foundation.pager.rememberPagerState(
                initialPage = fullScreenInitialPage!!,
                pageCount = { photoTokens.size }
            )
            
            Box(modifier = Modifier.fillMaxSize().background(Color.Black)) {
                androidx.compose.foundation.pager.HorizontalPager(
                    state = pagerState,
                    modifier = Modifier.fillMaxSize()
                ) { page ->
                    val mediaToken = photoTokens[page]
                    val token = mediaToken.token
                    val imageSource = mediaToken.fullScreenUrl
                    val isSelected = selectedTokens.contains(token)
                    var showHeartAnimation by remember { mutableStateOf(false) }
                    
                    LaunchedEffect(showHeartAnimation) {
                        if (showHeartAnimation) {
                            kotlinx.coroutines.delay(500)
                            showHeartAnimation = false
                        }
                    }
                    
                    Box(modifier = Modifier.fillMaxSize()) {
                        if (mediaToken.isVideo) {
                            val videoStreamUrl = mediaToken.stream_url ?: mediaToken.fullScreenUrl
                            SecureVideoPlayer(
                                token = videoStreamUrl,
                                modifier = Modifier.fillMaxSize()
                            )
                        } else {
                            SecureNetworkImage(
                                token = imageSource, 
                                modifier = Modifier
                                    .fillMaxSize()
                                    .pointerInput(Unit) {
                                        detectTapGestures(
                                            onDoubleTap = { 
                                                if (!state.isLocked && submitStatus != "LOCKED") {
                                                    viewModel.toggleSelection(token, state.selectionLimit) 
                                                    showHeartAnimation = true
                                                }
                                            }
                                        )
                                    }
                            )
                        }
                        
                        AnimatedVisibility(
                            visible = showHeartAnimation,
                            enter = scaleIn(initialScale = 0.5f) + fadeIn(),
                            exit = scaleOut(targetScale = 1.5f) + fadeOut(),
                            modifier = Modifier.align(Alignment.Center)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Favorite,
                                contentDescription = null,
                                tint = Color.Red.copy(alpha = 0.8f),
                                modifier = Modifier.size(100.dp)
                            )
                        }
                    }
                }
                
                val currentMediaToken = photoTokens.getOrNull(pagerState.currentPage)
                val currentToken = currentMediaToken?.token
                
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .statusBarsPadding()
                        .padding(16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    IconButton(
                        onClick = { fullScreenInitialPage = null },
                        modifier = Modifier.background(Color.Black.copy(alpha = 0.5f), CircleShape)
                    ) {
                        Icon(Icons.Default.Close, contentDescription = "Close", tint = Color.White)
                    }

                    Row {
                        if (state.downloadEnabled) {
                            val context = androidx.compose.ui.platform.LocalContext.current
                            Button(
                                onClick = {
                                    // Direct Phone Gallery Download (No Zip file!)
                                    try {
                                        if (currentToken != null) {
                                            val downloadManager = context.getSystemService(android.content.Context.DOWNLOAD_SERVICE) as android.app.DownloadManager
                                            val uri = android.net.Uri.parse("${com.example.network.ApiConfig.BASE_URL}/api/photos/stream?token=$currentToken")
                                            val request = android.app.DownloadManager.Request(uri)
                                                .setTitle("PhotoGuard Photo Download")
                                                .setDescription("Saving high-resolution photo directly to gallery...")
                                                .setNotificationVisibility(android.app.DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                                                .setDestinationInExternalPublicDir(android.os.Environment.DIRECTORY_PICTURES, "PhotoGuard_${currentToken}.jpg")
                                            downloadManager.enqueue(request)
                                            android.widget.Toast.makeText(context, "Directly downloading photo to your Phone Gallery...", android.widget.Toast.LENGTH_SHORT).show()
                                        }
                                    } catch (e: Exception) {
                                        android.widget.Toast.makeText(context, "Downloading photo...", android.widget.Toast.LENGTH_SHORT).show()
                                    }
                                },
                                colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary),
                                shape = RoundedCornerShape(20.dp),
                                modifier = Modifier.padding(end = 8.dp)
                            ) {
                                Icon(Icons.Default.Image, contentDescription = null, modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("Save to Phone Gallery", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            }
                        }

                        if (currentToken != null && !state.isLocked && submitStatus != "LOCKED") {
                            IconButton(
                                onClick = { viewModel.toggleSelection(currentToken, state.selectionLimit) },
                                modifier = Modifier.background(Color.Black.copy(alpha = 0.5f), CircleShape)
                            ) {
                                val isSelected = selectedTokens.contains(currentToken)
                                Icon(
                                    imageVector = if (isSelected) Icons.Default.Favorite else Icons.Default.FavoriteBorder,
                                    contentDescription = "Toggle Selection",
                                    tint = if (isSelected) Color.Red else Color.White
                                )
                            }
                        }
                    }
                }
                
                if (currentToken != null && !state.isLocked && submitStatus != "LOCKED") {
                    val currentNote = photoNotes[currentToken] ?: ""
                    var isEditingNote by remember { mutableStateOf(false) }

                    Box(
                        modifier = Modifier
                            .align(Alignment.BottomEnd)
                            .padding(bottom = 32.dp, end = 24.dp)
                            .navigationBarsPadding()
                    ) {
                        ExtendedFloatingActionButton(
                            onClick = { isEditingNote = true },
                            containerColor = MaterialTheme.colorScheme.primary,
                            contentColor = Color.White,
                            icon = { Icon(Icons.Default.FavoriteBorder, contentDescription = null) },
                            text = { 
                                Text(
                                    if (currentNote.isNotBlank()) "Edit Note: \"${currentNote.take(15)}...\"" else "Add Edit Request / Note",
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.SemiBold
                                )
                            },
                            shape = RoundedCornerShape(24.dp)
                        )
                    }

                    if (isEditingNote) {
                        Dialog(
                            onDismissRequest = { isEditingNote = false },
                            properties = DialogProperties(usePlatformDefaultWidth = true)
                        ) {
                            Card(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(16.dp)
                                    .imePadding(),
                                shape = RoundedCornerShape(24.dp),
                                colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B))
                            ) {
                                Column(
                                    modifier = Modifier
                                        .padding(20.dp)
                                        .fillMaxWidth()
                                ) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text(
                                            text = "Add Edit Request for Photographer",
                                            style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                                            color = Color.White
                                        )
                                        IconButton(onClick = { isEditingNote = false }) {
                                            Icon(Icons.Default.Close, contentDescription = null, tint = Color.Gray)
                                        }
                                    }

                                    Spacer(modifier = Modifier.height(12.dp))

                                    OutlinedTextField(
                                        value = currentNote,
                                        onValueChange = { viewModel.updateNote(currentToken, it) },
                                        placeholder = { Text("e.g. Please retouch lighting or fix background on this photo...", color = Color.Gray) },
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .heightIn(min = 100.dp),
                                        colors = OutlinedTextFieldDefaults.colors(
                                            focusedBorderColor = MaterialTheme.colorScheme.primary,
                                            unfocusedBorderColor = Color.Gray.copy(alpha = 0.5f),
                                            focusedTextColor = Color.White,
                                            unfocusedTextColor = Color.White
                                        ),
                                        shape = RoundedCornerShape(16.dp),
                                        maxLines = 4
                                    )

                                    Spacer(modifier = Modifier.height(16.dp))

                                    Button(
                                        onClick = { isEditingNote = false },
                                        modifier = Modifier.fillMaxWidth(),
                                        shape = RoundedCornerShape(14.dp),
                                        colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary)
                                    ) {
                                        Text("Save Edit Note", color = Color.White, fontWeight = FontWeight.Bold)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }


    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        // TopAppBar with Studio Spotlight Beam Illumination
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(
                    Brush.verticalGradient(
                        colors = listOf(
                            Color(0xFF00E5FF).copy(alpha = 0.45f),
                            Color(0xFF06B6D4).copy(alpha = 0.20f),
                            Color.Transparent
                        )
                    )
                )
        ) {
            // Steady Studio Spotlight Lamp Icon Beam shining down
            Box(
                modifier = Modifier
                    .align(Alignment.TopCenter)
                    .width(160.dp)
                    .height(80.dp)
                    .background(
                        Brush.verticalGradient(
                            colors = listOf(
                                Color(0xFF00E5FF).copy(alpha = 0.35f),
                                Color.Transparent
                            )
                        )
                    )
            )

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .statusBarsPadding()
                    .padding(horizontal = 16.dp, vertical = 12.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    IconButton(
                        onClick = onBack,
                        modifier = Modifier
                            .padding(end = 8.dp)
                            .size(36.dp)
                            .clip(CircleShape)
                            .background(Color.Black.copy(alpha = 0.6f))
                            .border(1.dp, Color(0xFF00E5FF).copy(alpha = 0.6f), CircleShape)
                    ) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Exit / Change Album PIN",
                            tint = Color(0xFF00E5FF),
                            modifier = Modifier.size(18.dp)
                        )
                    }

                    Box(
                        contentAlignment = Alignment.Center,
                        modifier = Modifier
                            .size(38.dp)
                            .clip(CircleShape)
                            .background(Color.Black.copy(alpha = 0.6f), CircleShape)
                            .border(width = 2.dp, color = Color(0xFF00E5FF), shape = CircleShape)
                            .shadow(elevation = 12.dp, shape = CircleShape, spotColor = Color(0xFF00E5FF))
                    ) {
                        Image(
                            painter = painterResource(id = R.drawable.photoguard_app_icon),
                            contentDescription = "PhotoGuard Studio Logo",
                            contentScale = ContentScale.Crop,
                            modifier = Modifier.fillMaxSize()
                        )
                    }
                    Spacer(modifier = Modifier.width(8.dp))
                    Column {
                        Text(
                            text = state.photographerName.uppercase(),
                            style = MaterialTheme.typography.titleMedium.copy(
                                fontWeight = FontWeight.ExtraBold,
                                letterSpacing = 1.5.sp,
                                fontSize = 13.sp
                            ),
                            color = Color.White
                        )
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier
                                .background(Color(0xFF00E5FF).copy(alpha = 0.15f), RoundedCornerShape(4.dp))
                                .border(1.dp, Color(0xFF00E5FF).copy(alpha = 0.6f), RoundedCornerShape(4.dp))
                                .padding(horizontal = 6.dp, vertical = 2.dp)
                        ) {
                            Box(modifier = Modifier.size(6.dp).background(Color(0xFF00E5FF), CircleShape))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                text = "STUDIO PROOF",
                                color = Color(0xFF00E5FF),
                                style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold, fontSize = 8.sp)
                            )
                        }
                    }
                }
                
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    if (min != null && sec != null) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier
                                .background(Color.Red.copy(alpha = 0.25f), RoundedCornerShape(8.dp))
                                .border(1.dp, Color.Red, RoundedCornerShape(8.dp))
                                .padding(horizontal = 8.dp, vertical = 4.dp)
                        ) {
                            Icon(Icons.Default.Lock, contentDescription = null, tint = Color.Red, modifier = Modifier.size(14.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                text = "${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}",
                                color = Color.Red,
                                style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold)
                            )
                        }
                    }

                    Button(
                        onClick = onBack,
                        colors = ButtonDefaults.buttonColors(containerColor = Color.Red.copy(alpha = 0.2f)),
                        border = androidx.compose.foundation.BorderStroke(1.dp, Color.Red.copy(alpha = 0.6f)),
                        shape = RoundedCornerShape(8.dp),
                        contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp),
                        modifier = Modifier.height(30.dp)
                    ) {
                        Text(
                            text = "Exit PIN",
                            color = Color.Red,
                            style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold, fontSize = 10.sp)
                        )
                    }
                }
            }
        }

        // Title and Meta
        Column(modifier = Modifier.padding(horizontal = 24.dp, vertical = 8.dp)) {
            Text(
                text = state.albumTitle,
                style = MaterialTheme.typography.headlineMedium.copy(fontWeight = FontWeight.Light),
                color = Color.White
            )
        }

        // AI Face Avatar Filter Tags Row
        Column(modifier = Modifier.padding(horizontal = 24.dp, vertical = 4.dp)) {
            Text(
                text = "AI Face Grouping & Category Filters",
                style = MaterialTheme.typography.labelSmall.copy(color = Color.White.copy(alpha = 0.6f), fontWeight = FontWeight.Bold),
                modifier = Modifier.padding(bottom = 6.dp)
            )
            val aiFaceTags = remember { listOf("All", "👰 Bride & Groom", "👨‍👩‍👧 Family", "👤 Portraits", "🎉 Guests") }
            ScrollableTabRow(
                selectedTabIndex = aiFaceTags.indexOf(currentCategory).coerceAtLeast(0),
                containerColor = Color.Transparent,
                edgePadding = 0.dp,
                indicator = {},
                divider = {}
            ) {
                aiFaceTags.forEach { category ->
                    val selected = currentCategory == category
                    Tab(
                        selected = selected,
                        onClick = { currentCategory = category },
                        modifier = Modifier.padding(end = 8.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .background(if (selected) MaterialTheme.colorScheme.primary else Color(0xFF1E293B), RoundedCornerShape(20.dp))
                                .border(1.dp, if (selected) Color(0xFF00E5FF) else BorderDark, RoundedCornerShape(20.dp))
                                .padding(horizontal = 14.dp, vertical = 6.dp)
                        ) {
                            Text(
                                text = category,
                                color = if (selected) Color.White else Color.White.copy(alpha = 0.7f),
                                style = MaterialTheme.typography.labelMedium.copy(fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal)
                            )
                        }
                    }
                }
            }
        }
        Spacer(modifier = Modifier.height(12.dp))


        if (currentTab == "SELECTIONS") {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 24.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = "${selectedTokens.size} / ${state.selectionLimit} Selected",
                    style = MaterialTheme.typography.labelLarge.copy(color = MaterialTheme.colorScheme.onBackground)
                )
                if (state.isLocked || submitStatus == "LOCKED") {
                    Text("LOCKED", color = Color.Red, fontWeight = FontWeight.Bold)
                } else {
                    Button(
                        onClick = { viewModel.submitSelections(state.accessCode) },
                        enabled = selectedTokens.isNotEmpty() && !isSubmitting,
                        colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary)
                    ) {
                        Text("Submit Final")
                    }
                }
            }
        }

        // Grid
        LazyVerticalGrid(
            columns = GridCells.Fixed(2),
            modifier = Modifier.weight(1f).padding(horizontal = 24.dp),
            horizontalArrangement = Arrangement.spacedBy(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
            contentPadding = PaddingValues(bottom = 24.dp, top = 8.dp)
        ) {
            items(photoTokens.size) { index ->
                val mediaToken = photoTokens[index]
                val token = mediaToken.token
                val imageSource = mediaToken.gridThumbnailUrl
                val isSelected = selectedTokens.contains(token)
                
                Box(
                    modifier = Modifier
                        .aspectRatio(3f / 4f)
                        .clip(RoundedCornerShape(24.dp))
                        .background(MaterialTheme.colorScheme.surfaceVariant)
                        .border(2.dp, if (isSelected) MaterialTheme.colorScheme.primary else BorderDark, RoundedCornerShape(24.dp))
                        .clickable { fullScreenInitialPage = index }
                ) {
                    SecureNetworkImage(token = imageSource, modifier = Modifier.fillMaxSize())
                    
                    if (mediaToken.isVideo) {
                        Box(
                            modifier = Modifier
                                .fillMaxSize()
                                .background(Color.Black.copy(alpha = 0.35f)),
                            contentAlignment = Alignment.Center
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(44.dp)
                                    .background(Color.Black.copy(alpha = 0.65f), CircleShape)
                                    .border(1.dp, Color.White.copy(alpha = 0.8f), CircleShape),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = Icons.Default.PlayCircleOutline,
                                    contentDescription = "Play Video",
                                    tint = Color.White,
                                    modifier = Modifier.size(30.dp)
                                )
                            }
                        }
                    }
                    
                    if (!state.isLocked && submitStatus != "LOCKED") {
                        IconButton(
                            onClick = { viewModel.toggleSelection(token, state.selectionLimit) },
                            modifier = Modifier
                                .align(Alignment.TopEnd)
                                .padding(8.dp)
                                .size(32.dp)
                                .background(Color.Black.copy(alpha = 0.4f), CircleShape)
                        ) {
                            Icon(
                                imageVector = if (isSelected) Icons.Default.Favorite else Icons.Default.FavoriteBorder,
                                contentDescription = "Select",
                                tint = if (isSelected) Color.Red else Color.White,
                                modifier = Modifier.size(18.dp)
                            )
                        }
                    }
                }
            }
        }

        // Bottom Nav
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(MaterialTheme.colorScheme.surface)
                .navigationBarsPadding()
                .padding(horizontal = 32.dp, vertical = 16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.clickable { currentTab = "ALBUM" }
            ) {
                Icon(
                    Icons.Default.PhotoLibrary,
                    contentDescription = null,
                    tint = if (currentTab == "ALBUM") MaterialTheme.colorScheme.primary else Color.White.copy(0.6f)
                )
                Text("ALBUM", color = if (currentTab == "ALBUM") MaterialTheme.colorScheme.primary else Color.White.copy(0.6f), fontSize = 10.sp)
            }
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.clickable { currentTab = "SELECTIONS" }
            ) {
                Icon(
                    Icons.Default.CheckCircle,
                    contentDescription = null,
                    tint = if (currentTab == "SELECTIONS") MaterialTheme.colorScheme.primary else Color.White.copy(0.6f)
                )
                Text("SELECTIONS", color = if (currentTab == "SELECTIONS") MaterialTheme.colorScheme.primary else Color.White.copy(0.6f), fontSize = 10.sp)
            }
        }
    }
}
