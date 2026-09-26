package com.photoguard.client.ui

import android.content.Intent
import android.net.Uri
import com.photoguard.client.utils.DeepLinkUtils
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ExitToApp
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material.icons.filled.Send
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage

/**
 * Post-Submission Celebration and Delivery Screen.
 *
 * Displays:
 * 1. Submission celebration & single-submit lock status.
 * 2. Photographer branding and social links (Strict Studio Tier enforcement - hidden if null).
 * 3. High-resolution gallery download button (Visible only if allow_download == true).
 * 4. Sign Out / Exit action to clear credentials and return to PIN login.
 */
@Composable
fun DeliveryScreen(
    viewModel: DeliveryViewModel,
    onSignOut: () -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val scope = androidx.compose.runtime.rememberCoroutineScope()
    val uiState by viewModel.uiState.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }
    val scrollState = rememberScrollState()

    LaunchedEffect(uiState.feedbackMessage) {
        uiState.feedbackMessage?.let { msg ->
            snackbarHostState.showSnackbar(msg)
            viewModel.clearFeedbackMessage()
        }
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
            val containerWidth = if (isTablet) 520.dp else maxWidth

            Column(
                modifier = Modifier
                    .widthIn(max = containerWidth)
                    .fillMaxSize()
                    .verticalScroll(scrollState)
                    .padding(horizontal = 24.dp, vertical = 20.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Top
            ) {
                Spacer(modifier = Modifier.height(16.dp))

                // Celebration Badge
                Box(
                    modifier = Modifier
                        .size(80.dp)
                        .clip(CircleShape)
                        .background(MaterialTheme.colorScheme.primaryContainer),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.CheckCircle,
                        contentDescription = "Success",
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(46.dp)
                    )
                }

                Spacer(modifier = Modifier.height(20.dp))

                // Celebration Header
                Text(
                    text = "Selections Submitted!",
                    style = MaterialTheme.typography.headlineMedium.copy(
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 0.5.sp
                    ),
                    textAlign = TextAlign.Center,
                    color = MaterialTheme.colorScheme.onBackground
                )

                Spacer(modifier = Modifier.height(8.dp))

                Text(
                    text = "Thank you, ${uiState.clientName}. Your photographer has been notified and the album is now locked for editing.",
                    style = MaterialTheme.typography.bodyMedium,
                    textAlign = TextAlign.Center,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                Spacer(modifier = Modifier.height(24.dp))

                // Summary Card
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.6f))
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "Album",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Text(
                                text = uiState.albumTitle,
                                style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold),
                                color = MaterialTheme.colorScheme.onSurface
                            )
                        }

                        Spacer(modifier = Modifier.height(8.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "Selected Photos",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Text(
                                text = "${uiState.selectedCount} Photos",
                                style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold),
                                color = MaterialTheme.colorScheme.primary
                            )
                        }

                        Spacer(modifier = Modifier.height(8.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "Status",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(
                                    imageVector = Icons.Default.Lock,
                                    contentDescription = null,
                                    modifier = Modifier.size(14.dp),
                                    tint = MaterialTheme.colorScheme.error
                                )
                                Spacer(modifier = Modifier.width(4.dp))
                                Text(
                                    text = "Locked & Archived",
                                    style = MaterialTheme.typography.bodySmall.copy(fontWeight = FontWeight.Medium),
                                    color = MaterialTheme.colorScheme.error
                                )
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(24.dp))

                // High-Resolution Direct Download Section (Visible strictly when allow_download == true)
                AnimatedVisibility(visible = uiState.allowDownload) {
                    Column(modifier = Modifier.fillMaxWidth()) {
                        Button(
                            onClick = { viewModel.startGalleryDownload(context) },
                            enabled = !uiState.isFetchingDownloads,
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(52.dp),
                            shape = RoundedCornerShape(14.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = MaterialTheme.colorScheme.primary
                            )
                        ) {
                            if (uiState.isFetchingDownloads) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(22.dp),
                                    color = MaterialTheme.colorScheme.onPrimary,
                                    strokeWidth = 2.dp
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("Preparing Downloads...")
                            } else {
                                Icon(
                                    imageVector = Icons.Default.Download,
                                    contentDescription = "Download Photos"
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = "Download Final Photos",
                                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold)
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(6.dp))

                        Text(
                            text = "Direct delivery to Pictures/PhotoGuard. No ZIP extraction required.",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.fillMaxWidth()
                        )

                        Spacer(modifier = Modifier.height(24.dp))
                    }
                }

                // Studio Tier: Social Links & Contact Section (Strict conditional display)
                val hasSocialLinks = !uiState.contactPhone.isNullOrBlank() ||
                        !uiState.telegramUrl.isNullOrBlank() ||
                        !uiState.instagramUrl.isNullOrBlank() ||
                        !uiState.tiktokUrl.isNullOrBlank() ||
                        !uiState.youtubeUrl.isNullOrBlank()

                if (hasSocialLinks) {
                    Text(
                        text = "Connect with ${uiState.photographerName ?: "Your Studio"}",
                        style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                        color = MaterialTheme.colorScheme.onSurface,
                        modifier = Modifier.fillMaxWidth()
                    )
                    Spacer(modifier = Modifier.height(12.dp))

                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(14.dp),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(12.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            // 1. Direct Phone Call (Deep link to system dialer)
                            uiState.contactPhone?.takeIf { it.isNotBlank() }?.let { phone ->
                                SocialLinkRow(
                                    label = "Direct Call / SMS",
                                    value = phone,
                                    icon = Icons.Default.Phone,
                                    onClick = {
                                        if (!DeepLinkUtils.openDialer(context, phone)) {
                                            scope.launch { snackbarHostState.showSnackbar("Unable to open phone dialer.") }
                                        }
                                    }
                                )
                            }

                            // 2. Telegram (Deep link to Telegram app or web)
                            uiState.telegramUrl?.takeIf { it.isNotBlank() }?.let { tg ->
                                val cleanTg = DeepLinkUtils.cleanHandle(tg, listOf("https://t.me/", "http://t.me/", "t.me/"))
                                SocialLinkRow(
                                    label = "Telegram (Direct Chat)",
                                    value = "@$cleanTg",
                                    icon = Icons.Default.Send,
                                    onClick = {
                                        if (!DeepLinkUtils.openTelegram(context, tg)) {
                                            scope.launch { snackbarHostState.showSnackbar("Unable to open Telegram.") }
                                        }
                                    }
                                )
                            }

                            // 3. Instagram (Deep link to Instagram app or web)
                            uiState.instagramUrl?.takeIf { it.isNotBlank() }?.let { insta ->
                                val cleanInsta = DeepLinkUtils.cleanHandle(insta, listOf("https://instagram.com/", "https://www.instagram.com/", "http://instagram.com/", "instagram.com/"))
                                SocialLinkRow(
                                    label = "Instagram (Profile)",
                                    value = "@$cleanInsta",
                                    icon = Icons.Default.Share,
                                    onClick = {
                                        if (!DeepLinkUtils.openInstagram(context, insta)) {
                                            scope.launch { snackbarHostState.showSnackbar("Unable to open Instagram.") }
                                        }
                                    }
                                )
                            }

                            // 4. TikTok (Deep link to TikTok app or web)
                            uiState.tiktokUrl?.takeIf { it.isNotBlank() }?.let { tiktok ->
                                val cleanTiktok = DeepLinkUtils.cleanHandle(tiktok, listOf("https://www.tiktok.com/@", "https://tiktok.com/@", "tiktok.com/@"))
                                SocialLinkRow(
                                    label = "TikTok (Studio)",
                                    value = "@$cleanTiktok",
                                    icon = Icons.Default.Share,
                                    onClick = {
                                        if (!DeepLinkUtils.openTikTok(context, tiktok)) {
                                            scope.launch { snackbarHostState.showSnackbar("Unable to open TikTok.") }
                                        }
                                    }
                                )
                            }

                            // 5. YouTube (Deep link to YouTube app or web)
                            uiState.youtubeUrl?.takeIf { it.isNotBlank() }?.let { yt ->
                                SocialLinkRow(
                                    label = "YouTube (Channel)",
                                    value = "Visit Channel",
                                    icon = Icons.Default.Share,
                                    onClick = {
                                        if (!DeepLinkUtils.openYouTube(context, yt)) {
                                            scope.launch { snackbarHostState.showSnackbar("Unable to open YouTube.") }
                                        }
                                    }
                                )
                            }
                        }
                    }
                    Spacer(modifier = Modifier.height(24.dp))
                }

                // Sign Out / Exit Action
                OutlinedButton(
                    onClick = onSignOut,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(50.dp),
                    shape = RoundedCornerShape(14.dp)
                ) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.ExitToApp,
                        contentDescription = "Sign Out"
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Sign Out / Exit",
                        style = MaterialTheme.typography.titleMedium
                    )
                }

                Spacer(modifier = Modifier.height(20.dp))
            }
        }
    }
}

/**
 * Clickable row element for photographer contact & social links.
 */
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
                tint = MaterialTheme.colorScheme.primary,
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
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.primary
        )
    }
}
