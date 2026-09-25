package com.photoguard.client.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
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
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
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
import androidx.compose.material.icons.filled.Shield
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
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
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
        modifier = modifier.fillMaxSize(),
        containerColor = MaterialTheme.colorScheme.background
    ) { paddingValues ->
        BoxWithConstraints(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues),
            contentAlignment = Alignment.Center
        ) {
            val isTablet = maxWidth > 600.dp
            val containerWidth = if (isTablet) 440.dp else maxWidth

            Column(
                modifier = Modifier
                    .widthIn(max = containerWidth)
                    .fillMaxWidth()
                    .padding(horizontal = 24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                // Language Switcher
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End
                ) {
                    TextButton(onClick = { isAmharic = !isAmharic }) {
                        Text(
                            text = if (isAmharic) "English" else "አማርኛ",
                            style = MaterialTheme.typography.labelLarge,
                            color = MaterialTheme.colorScheme.primary
                        )
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))

                // Brand Emblem
                Box(
                    modifier = Modifier
                        .size(72.dp)
                        .clip(CircleShape)
                        .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.12f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Shield,
                        contentDescription = "PhotoGuard Shield",
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(40.dp)
                    )
                }

                Spacer(modifier = Modifier.height(18.dp))

                // Title & Subtitle
                Text(
                    text = "PhotoGuard",
                    style = MaterialTheme.typography.headlineMedium.copy(
                        fontWeight = FontWeight.ExtraBold,
                        letterSpacing = (-0.5).sp
                    ),
                    color = MaterialTheme.colorScheme.onBackground
                )

                Spacer(modifier = Modifier.height(6.dp))

                Text(
                    text = if (isAmharic) "ፎቶዎችን ለመምረጥ ባለ 6 አሃዝ ሚስጥር ቁጥር ያስገቡ"
                           else "Enter your 6-digit access PIN to unlock your album",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(horizontal = 12.dp)
                )

                Spacer(modifier = Modifier.height(28.dp))

                // PIN Input Component
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
                        Spacer(modifier = Modifier.height(16.dp))
                        ErrorBanner(
                            error = uiState as LoginUiState.Error,
                            isAmharic = isAmharic
                        )
                    }
                }

                Spacer(modifier = Modifier.height(24.dp))

                // Action Unlock Button
                Button(
                    onClick = { viewModel.verifyPin() },
                    enabled = !isLockedOut && pin.length == 6 && uiState !is LoginUiState.Loading,
                    shape = RoundedCornerShape(14.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.primary,
                        disabledContainerColor = MaterialTheme.colorScheme.surfaceVariant
                    ),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(52.dp)
                ) {
                    if (uiState is LoginUiState.Loading) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(24.dp),
                            color = MaterialTheme.colorScheme.onPrimary,
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
                                    fontWeight = FontWeight.SemiBold
                                )
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Verified Badge
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.Center,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Icon(
                        imageVector = Icons.Default.CheckCircle,
                        contentDescription = "Verified Secure",
                        tint = MaterialTheme.colorScheme.primary.copy(alpha = 0.85f),
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = if (isAmharic) "የተጠበቀ እና የተረጋገጠ ግንኙነት" else "Secure & Verified Access",
                        style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Medium),
                        color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.85f),
                        textAlign = TextAlign.Center
                    )
                }
            }
        }
    }
}

@Composable
private fun PinInputField(
    pin: String,
    onPinChanged: (String) -> Unit,
    enabled: Boolean,
    focusRequester: FocusRequester,
    onImeDone: () -> Unit,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier.clickable(
            interactionSource = remember { MutableInteractionSource() },
            indication = null
        ) {
            focusRequester.requestFocus()
        },
        contentAlignment = Alignment.Center
    ) {
        // Native BasicTextField correctly invoked with invisible alpha so Compose's layout and IME handle it flawlessly
        BasicTextField(
            value = pin,
            onValueChange = onPinChanged,
            enabled = enabled,
            keyboardOptions = KeyboardOptions(
                keyboardType = KeyboardType.NumberPassword,
                imeAction = ImeAction.Done
            ),
            keyboardActions = KeyboardActions(onDone = { onImeDone() }),
            modifier = Modifier
                .fillMaxWidth()
                .alpha(0f)
                .focusRequester(focusRequester),
            decorationBox = { innerTextField ->
                innerTextField()
            }
        )

        // Custom Visual 6-Digit PIN Boxes
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
            verticalAlignment = Alignment.CenterVertically
        ) {
            repeat(6) { index ->
                val isFocused = pin.length == index
                val char = pin.getOrNull(index)

                Box(
                    modifier = Modifier
                        .weight(1f)
                        .aspectRatio(1f)
                        .clip(RoundedCornerShape(12.dp))
                        .background(
                            if (char != null) MaterialTheme.colorScheme.primary.copy(alpha = 0.08f)
                            else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
                        )
                        .border(
                            width = if (isFocused) 2.dp else 1.dp,
                            color = when {
                                isFocused -> MaterialTheme.colorScheme.primary
                                char != null -> MaterialTheme.colorScheme.primary.copy(alpha = 0.5f)
                                else -> MaterialTheme.colorScheme.outline.copy(alpha = 0.3f)
                            },
                            shape = RoundedCornerShape(12.dp)
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = char?.toString() ?: "",
                        style = MaterialTheme.typography.titleLarge.copy(
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Monospace
                        ),
                        color = MaterialTheme.colorScheme.onSurface
                    )
                }
            }
        }
    }
}

@Composable
private fun ErrorBanner(
    error: LoginUiState.Error,
    isAmharic: Boolean,
    modifier: Modifier = Modifier
) {
    val is429 = error.isRateLimit
    val backgroundColor = if (is429) {
        MaterialTheme.colorScheme.errorContainer
    } else {
        MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.7f)
    }
    val contentColor = if (is429) {
        MaterialTheme.colorScheme.onErrorContainer
    } else {
        MaterialTheme.colorScheme.onErrorContainer
    }

    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = backgroundColor)
    ) {
        Row(
            modifier = Modifier.padding(14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = if (is429) Icons.Default.LockClock else Icons.Default.WarningAmber,
                contentDescription = null,
                tint = contentColor,
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
                        color = contentColor
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
