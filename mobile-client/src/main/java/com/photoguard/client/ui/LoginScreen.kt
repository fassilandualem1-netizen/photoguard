package com.photoguard.client.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.LockClock
import androidx.compose.material.icons.filled.WarningAmber
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
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
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.photoguard.client.data.model.AlbumDetailResponse

@Composable
fun LoginScreen(
    viewModel: LoginViewModel,
    onLoginSuccess: (AlbumDetailResponse) -> Unit,
    modifier: Modifier = Modifier
) {
    val pin by viewModel.pin.collectAsState()
    val uiState by viewModel.uiState.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }
    val focusRequester = remember { FocusRequester() }
    var isAmharic by remember { mutableStateOf(false) }

    LaunchedEffect(uiState) {
        if (uiState is LoginUiState.Success) {
            onLoginSuccess((uiState as LoginUiState.Success).album)
        }
    }

    LaunchedEffect(Unit) {
        try {
            focusRequester.requestFocus()
        } catch (_: Exception) {}
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        modifier = modifier
            .fillMaxSize()
            .imePadding(),
        containerColor = Color(0xFF0B0F17)
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            // Pinned Top Bar: Language Switcher and Security Badge
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .statusBarsPadding()
                    .padding(horizontal = 24.dp, vertical = 14.dp)
                    .align(Alignment.TopCenter),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Encryption status pill
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier
                        .clip(RoundedCornerShape(20.dp))
                        .background(Color(0xFF161E2E))
                        .border(1.dp, Color(0xFF334155).copy(alpha = 0.5f), RoundedCornerShape(20.dp))
                        .padding(horizontal = 10.dp, vertical = 5.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .size(7.dp)
                            .clip(CircleShape)
                            .background(Color(0xFF10B981))
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = if (isAmharic) "የተመሰጠረ ግንኙነት" else "End-to-End Encrypted",
                        style = MaterialTheme.typography.labelSmall.copy(
                            fontWeight = FontWeight.Medium,
                            fontSize = 11.sp
                        ),
                        color = Color(0xFF94A3B8)
                    )
                }

                // Language toggle
                TextButton(
                    onClick = { isAmharic = !isAmharic },
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.textButtonColors(
                        contentColor = Color(0xFFF59E0B)
                    )
                ) {
                    Text(
                        text = if (isAmharic) "English" else "አማርኛ",
                        style = MaterialTheme.typography.labelLarge.copy(
                            fontWeight = FontWeight.Bold,
                            fontSize = 13.sp
                        )
                    )
                }
            }

            // Main Content Area: Perfectly Centered Vertically & Horizontally
            // Slightly upward-biased using weighted spacers so soft keyboard never covers the PIN boxes
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 24.dp),
                contentAlignment = Alignment.Center
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .widthIn(max = 440.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    // Top Spacer
                    Spacer(modifier = Modifier.weight(1.0f))

                    // Brand New Premium PhotoGuard Logo
                    PhotoGuardLogo(
                        size = 96.dp,
                        showGlow = true
                    )

                    Spacer(modifier = Modifier.height(20.dp))

                    // Title
                    Text(
                        text = "PhotoGuard",
                        style = MaterialTheme.typography.headlineMedium.copy(
                            fontWeight = FontWeight.Black,
                            letterSpacing = (-0.5).sp,
                            fontSize = 28.sp
                        ),
                        color = Color.White
                    )

                    Spacer(modifier = Modifier.height(6.dp))

                    // Subtitle
                    Text(
                        text = if (isAmharic) "ፎቶዎችን ለመምረጥ ባለ 6 አሃዝ ሚስጥር ቁጥር ያስገቡ"
                               else "Enter your 6-digit access PIN to unlock your album",
                        style = MaterialTheme.typography.bodyMedium.copy(
                            fontSize = 14.sp,
                            lineHeight = 20.sp
                        ),
                        color = Color(0xFF94A3B8),
                        textAlign = TextAlign.Center,
                        modifier = Modifier.padding(horizontal = 16.dp)
                    )

                    Spacer(modifier = Modifier.height(30.dp))

                    // Highly Interactive 6-Digit PIN Boxes
                    val isLockedOut = (uiState as? LoginUiState.Error)?.isRateLimit == true
                    PinInputField(
                        pin = pin,
                        onPinChanged = { viewModel.onPinChanged(it) },
                        enabled = !isLockedOut && uiState !is LoginUiState.Loading,
                        focusRequester = focusRequester,
                        onImeDone = { viewModel.verifyPin() },
                        modifier = Modifier.fillMaxWidth()
                    )

                    // Error / Lockout Display
                    AnimatedVisibility(
                        visible = uiState is LoginUiState.Error,
                        enter = fadeIn(),
                        exit = fadeOut()
                    ) {
                        if (uiState is LoginUiState.Error) {
                            Column {
                                Spacer(modifier = Modifier.height(18.dp))
                                ErrorBanner(
                                    error = uiState as LoginUiState.Error,
                                    isAmharic = isAmharic
                                )
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(26.dp))

                    // Action Unlock Button
                    Button(
                        onClick = { viewModel.verifyPin() },
                        enabled = !isLockedOut && pin.length == 6 && uiState !is LoginUiState.Loading,
                        shape = RoundedCornerShape(16.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Color(0xFFF59E0B),
                            contentColor = Color(0xFF090D14),
                            disabledContainerColor = Color(0xFF1E293B),
                            disabledContentColor = Color(0xFF64748B)
                        ),
                        elevation = ButtonDefaults.buttonElevation(
                            defaultElevation = if (pin.length == 6) 6.dp else 0.dp,
                            pressedElevation = 2.dp
                        ),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(54.dp)
                    ) {
                        if (uiState is LoginUiState.Loading) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(24.dp),
                                color = Color(0xFF090D14),
                                strokeWidth = 2.5.dp
                            )
                        } else {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.Center
                            ) {
                                Icon(
                                    imageVector = if (isLockedOut) Icons.Default.LockClock else Icons.Default.Lock,
                                    contentDescription = null,
                                    modifier = Modifier.size(18.dp)
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = if (isAmharic) "አልበም ክፈት" else "Unlock Album",
                                    style = MaterialTheme.typography.titleMedium.copy(
                                        fontWeight = FontWeight.Bold,
                                        letterSpacing = 0.3.sp
                                    )
                                )
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(18.dp))

                    // Verified Badge
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.Center,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Icon(
                            imageVector = Icons.Default.CheckCircle,
                            contentDescription = "Verified Secure",
                            tint = Color(0xFF10B981),
                            modifier = Modifier.size(15.dp)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = if (isAmharic) "የተጠበቀ እና የተረጋገጠ ግንኙነት" else "Secure & Verified Access",
                            style = MaterialTheme.typography.labelMedium.copy(
                                fontWeight = FontWeight.Medium,
                                fontSize = 12.sp
                            ),
                            color = Color(0xFF64748B),
                            textAlign = TextAlign.Center
                        )
                    }

                    // Bottom Spacer: Greater weight shifts content gracefully above center for keyboard clearance
                    Spacer(modifier = Modifier.weight(1.45f))
                }
            }
        }
    }
}

/**
 * Interactive 6-Digit PIN Boxes
 * 
 * Features individual luxury rounded-corner digit cards with dynamic focus states,
 * amber brand glow elevations, and animated active blinking cursors.
 */
@Composable
private fun PinInputField(
    pin: String,
    onPinChanged: (String) -> Unit,
    enabled: Boolean,
    focusRequester: FocusRequester,
    onImeDone: () -> Unit,
    modifier: Modifier = Modifier
) {
    var isTextFieldFocused by remember { mutableStateOf(false) }

    // Smooth cursor pulsing animation for active focused cell
    val infiniteTransition = rememberInfiniteTransition(label = "pinCursorAnim")
    val cursorAlpha by infiniteTransition.animateFloat(
        initialValue = 1f,
        targetValue = 0f,
        animationSpec = infiniteRepeatable(
            animation = tween(550, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "pinCursorAlpha"
    )

    BasicTextField(
        value = pin,
        onValueChange = { newValue ->
            if (newValue.length <= 6 && newValue.all { it.isDigit() }) {
                onPinChanged(newValue)
            }
        },
        enabled = enabled,
        keyboardOptions = KeyboardOptions(
            keyboardType = KeyboardType.NumberPassword,
            imeAction = ImeAction.Done
        ),
        keyboardActions = KeyboardActions(onDone = { onImeDone() }),
        modifier = modifier
            .focusRequester(focusRequester)
            .onFocusChanged { isTextFieldFocused = it.isFocused },
        decorationBox = {
            BoxWithConstraints(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable(
                        interactionSource = remember { MutableInteractionSource() },
                        indication = null
                    ) {
                        try {
                            focusRequester.requestFocus()
                        } catch (_: Exception) {}
                    },
                contentAlignment = Alignment.Center
            ) {
                val totalSpacing = 40.dp
                val availableWidth = maxWidth - totalSpacing
                val cellWidth = minOf(48.dp, availableWidth / 6)
                val cellHeight = cellWidth * 1.25f // 60dp height on standard screens
                val spacing = if (maxWidth < 360.dp) 6.dp else 8.dp

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    repeat(6) { index ->
                        val isCurrentBox = pin.length == index
                        val isFocused = isTextFieldFocused && isCurrentBox
                        val char = pin.getOrNull(index)
                        val isFilled = char != null

                        val borderColor = when {
                            isFocused -> Color(0xFFF59E0B) // Amber brand accent
                            isFilled -> Color(0xFFF59E0B).copy(alpha = 0.55f)
                            else -> Color(0xFF334155).copy(alpha = 0.45f)
                        }

                        val borderWidth = if (isFocused) 2.dp else 1.dp
                        val elevation = if (isFocused) 8.dp else if (isFilled) 2.dp else 0.dp
                        val shape = RoundedCornerShape(14.dp)

                        Box(
                            modifier = Modifier
                                .width(cellWidth)
                                .height(cellHeight)
                                .shadow(
                                    elevation = elevation,
                                    shape = shape,
                                    ambientColor = if (isFocused) Color(0xFFF59E0B) else Color.Transparent,
                                    spotColor = if (isFocused) Color(0xFFF59E0B) else Color.Transparent
                                )
                                .clip(shape)
                                .background(
                                    when {
                                        isFocused -> Color(0xFF1E2638)
                                        isFilled -> Color(0xFF161E2E)
                                        else -> Color(0xFF0F1522)
                                    }
                                )
                                .border(width = borderWidth, color = borderColor, shape = shape),
                            contentAlignment = Alignment.Center
                        ) {
                            when {
                                isFilled -> {
                                    Text(
                                        text = char.toString(),
                                        style = MaterialTheme.typography.titleLarge.copy(
                                            fontWeight = FontWeight.ExtraBold,
                                            fontFamily = FontFamily.Monospace,
                                            fontSize = 24.sp
                                        ),
                                        color = Color(0xFFF8FAFC)
                                    )
                                }
                                isFocused -> {
                                    // Animated active cursor indicator
                                    Box(
                                        modifier = Modifier
                                            .width(2.dp)
                                            .height(24.dp)
                                            .alpha(cursorAlpha)
                                            .background(Color(0xFFF59E0B), RoundedCornerShape(1.dp))
                                    )
                                }
                                else -> {
                                    // Subtle placeholder dot
                                    Box(
                                        modifier = Modifier
                                            .size(6.dp)
                                            .clip(CircleShape)
                                            .background(Color(0xFF334155).copy(alpha = 0.6f))
                                    )
                                }
                            }
                        }

                        if (index < 5) {
                            Spacer(modifier = Modifier.width(spacing))
                        }
                    }
                }
            }
        }
    )
}

@Composable
private fun ErrorBanner(
    error: LoginUiState.Error,
    isAmharic: Boolean,
    modifier: Modifier = Modifier
) {
    val is429 = error.isRateLimit
    val backgroundColor = if (is429) {
        Color(0xFF450A0A).copy(alpha = 0.85f)
    } else {
        Color(0xFF3B0712).copy(alpha = 0.80f)
    }
    val contentColor = Color(0xFFFCA5A5)
    val borderColor = if (is429) Color(0xFFEF4444).copy(alpha = 0.6f) else Color(0xFFF43F5E).copy(alpha = 0.45f)

    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = backgroundColor),
        border = BorderStroke(1.dp, borderColor)
    ) {
        Row(
            modifier = Modifier.padding(14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = if (is429) Icons.Default.LockClock else Icons.Default.WarningAmber,
                contentDescription = null,
                tint = if (is429) Color(0xFFF87171) else Color(0xFFFB7185),
                modifier = Modifier.size(24.dp)
            )
            Spacer(modifier = Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                if (is429) {
                    val minutes = error.lockoutSecondsRemaining / 60
                    val seconds = error.lockoutSecondsRemaining % 60
                    val formattedTime = String.format("%02d:%02d", minutes, seconds)
                    Text(
                        text = if (isAmharic) "የደህንነት እገዳ ተጥሏል" else "Security Lockout Active",
                        style = MaterialTheme.typography.labelLarge.copy(fontWeight = FontWeight.Bold),
                        color = contentColor
                    )
                    Spacer(modifier = Modifier.height(2.dp))
                    Text(
                        text = if (isAmharic) "እባክዎን ከ $formattedTime በኋላ እንደገና ይሞክሩ"
                               else "Too many failed attempts. Try again in $formattedTime",
                        style = MaterialTheme.typography.bodySmall,
                        color = contentColor.copy(alpha = 0.85f)
                    )
                } else {
                    val userFriendlyMsg = when {
                        error.errorCode == 404 || error.message.contains("not found", ignoreCase = true) || error.message.contains("Invalid", ignoreCase = true) ->
                            if (isAmharic) "ያስገቡት ፒን አልበሙ አልተገኘም (Active PINs: 136081, 469676)" else "Invalid PIN. Album not found. (Available: 136081, 469676)"
                        error.errorCode == 403 || error.message.contains("locked", ignoreCase = true) || error.message.contains("submitted", ignoreCase = true) ->
                            if (isAmharic) "ይህ አልበም አስቀድሞ ተመርጦ ተቆልፏል" else "This album has already been submitted and locked."
                        error.message.contains("timeout", ignoreCase = true) || error.message.contains("connect", ignoreCase = true) ->
                            if (isAmharic) "የኢንተርኔት ግንኙነትዎን ይፈትሹ" else "Connection error. Please check your internet."
                        else ->
                            if (isAmharic) "ስህተት ተፈጥሯል፤ እባክዎ እንደገና ይሞክሩ" else error.message
                    }

                    Text(
                        text = userFriendlyMsg,
                        style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Medium),
                        color = contentColor
                    )
                }
            }
        }
    }
}
