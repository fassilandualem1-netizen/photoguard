package com.photoguard.client.ui

import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.MusicNote
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Send
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.Verified
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
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

/**
 * Premium Studio Information Modal Dialog:
 * Opened when user taps the Studio Logo or Studio Name in the TopBar.
 * Displays prominent full-view logo, verified status, and dynamic studio contact channels
 * (Phone, Telegram, Instagram, YouTube, TikTok) with deep linking and zero hardcoding.
 */
@Composable
fun StudioInfoDialog(
    studioName: String,
    studioLogoUrl: String?,
    brandAccent: Color = Color(0xFF3B82F6),
    contactPhone: String? = null,
    telegramUrl: String? = null,
    instagramUrl: String? = null,
    tiktokUrl: String? = null,
    youtubeUrl: String? = null,
    phoneNumber: String? = null,
    telegramUsername: String? = null,
    instagram: String? = null,
    tiktok: String? = null,
    youtube: String? = null,
    onDismiss: () -> Unit
) {
    val context = LocalContext.current
    val scrollState = rememberScrollState()

    // Resolve effective values across aliases
    val effectivePhone = contactPhone?.takeIf { it.isNotBlank() } ?: phoneNumber?.takeIf { it.isNotBlank() }
    val effectiveTelegram = telegramUrl?.takeIf { it.isNotBlank() } ?: telegramUsername?.takeIf { it.isNotBlank() }
    val effectiveInstagram = instagramUrl?.takeIf { it.isNotBlank() } ?: instagram?.takeIf { it.isNotBlank() }
    val effectiveTikTok = tiktokUrl?.takeIf { it.isNotBlank() } ?: tiktok?.takeIf { it.isNotBlank() }
    val effectiveYouTube = youtubeUrl?.takeIf { it.isNotBlank() } ?: youtube?.takeIf { it.isNotBlank() }

    val hasPhone = !effectivePhone.isNullOrBlank()
    val hasTelegram = !effectiveTelegram.isNullOrBlank()
    val hasInstagram = !effectiveInstagram.isNullOrBlank()
    val hasTikTok = !effectiveTikTok.isNullOrBlank()
    val hasYouTube = !effectiveYouTube.isNullOrBlank()
    val hasAnyContact = hasPhone || hasTelegram || hasInstagram || hasTikTok || hasYouTube

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.Black.copy(alpha = 0.75f))
                .clickable { onDismiss() }
                .padding(20.dp),
            contentAlignment = Alignment.Center
        ) {
            Surface(
                modifier = Modifier
                    .fillMaxWidth(0.92f)
                    .clickable(enabled = false) {},
                shape = RoundedCornerShape(24.dp),
                color = Color(0xFF0F172A),
                border = androidx.compose.foundation.BorderStroke(1.5.dp, Color(0xFF1E293B)),
                shadowElevation = 16.dp
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .verticalScroll(scrollState)
                        .padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    // Studio Large Brand Avatar (72dp)
                    Box(
                        modifier = Modifier
                            .size(72.dp)
                            .clip(CircleShape)
                            .border(2.5.dp, brandAccent, CircleShape)
                            .background(Color(0xFF1E293B)),
                        contentAlignment = Alignment.Center
                    ) {
                        if (!studioLogoUrl.isNullOrBlank()) {
                            AsyncImage(
                                model = studioLogoUrl,
                                contentDescription = studioName,
                                contentScale = ContentScale.Crop,
                                modifier = Modifier.fillMaxSize()
                            )
                        } else {
                            Text(
                                text = studioName.take(1).uppercase(),
                                color = brandAccent,
                                fontSize = 28.sp,
                                fontWeight = FontWeight.Black
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(14.dp))

                    // Studio Name + Verified Badge
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.Center
                    ) {
                        Text(
                            text = studioName,
                            style = MaterialTheme.typography.titleLarge.copy(
                                fontWeight = FontWeight.ExtraBold,
                                fontSize = 20.sp
                            ),
                            color = Color.White,
                            textAlign = TextAlign.Center
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Icon(
                            imageVector = Icons.Default.Verified,
                            contentDescription = "Verified Studio",
                            tint = Color(0xFFF59E0B),
                            modifier = Modifier.size(20.dp)
                        )
                    }

                    Text(
                        text = "Official Verified Studio Partner",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Medium,
                        color = Color(0xFF94A3B8),
                        modifier = Modifier.padding(top = 4.dp, bottom = 18.dp)
                    )

                    // Contact & Social Media Action Buttons (ZERO HARDCODING)
                    if (hasAnyContact) {
                        Surface(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(16.dp),
                            color = Color(0xFF1E293B),
                            border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF334155))
                        ) {
                            Column(
                                modifier = Modifier.padding(12.dp),
                                verticalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                // 1. Direct Phone Call
                                if (hasPhone) {
                                    val phoneVal = effectivePhone!!.trim()
                                    StudioContactActionRow(
                                        label = "Direct Call",
                                        value = phoneVal,
                                        actionText = "Call",
                                        icon = Icons.Default.Phone,
                                        iconTint = Color(0xFF34D399),
                                        onClick = {
                                            try {
                                                val intent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:$phoneVal"))
                                                context.startActivity(intent)
                                            } catch (e: Exception) {
                                                try {
                                                    val fallback = Intent(Intent.ACTION_VIEW, Uri.parse("tel:$phoneVal"))
                                                    context.startActivity(fallback)
                                                } catch (ex: Exception) {
                                                    Toast.makeText(context, "Phone: $phoneVal", Toast.LENGTH_SHORT).show()
                                                }
                                            }
                                        }
                                    )
                                }

                                // 2. Telegram Channel / Username
                                if (hasTelegram) {
                                    val tgVal = effectiveTelegram!!.trim()
                                    val cleanTgDomain = tgVal
                                        .removePrefix("https://t.me/")
                                        .removePrefix("http://t.me/")
                                        .removePrefix("t.me/")
                                        .removePrefix("@")
                                        .trimEnd('/')

                                    StudioContactActionRow(
                                        label = "Telegram",
                                        value = "@$cleanTgDomain",
                                        actionText = "Message",
                                        icon = Icons.Default.Send,
                                        iconTint = Color(0xFF38BDF8),
                                        onClick = {
                                            try {
                                                val appIntent = Intent(Intent.ACTION_VIEW, Uri.parse("tg://resolve?domain=$cleanTgDomain"))
                                                context.startActivity(appIntent)
                                            } catch (e: Exception) {
                                                try {
                                                    val webIntent = Intent(Intent.ACTION_VIEW, Uri.parse("https://t.me/$cleanTgDomain"))
                                                    context.startActivity(webIntent)
                                                } catch (ex: Exception) {
                                                    Toast.makeText(context, "Telegram: @$cleanTgDomain", Toast.LENGTH_SHORT).show()
                                                }
                                            }
                                        }
                                    )
                                }

                                // 3. Instagram Profile
                                if (hasInstagram) {
                                    val igVal = effectiveInstagram!!.trim()
                                    val cleanIgUser = igVal
                                        .removePrefix("https://www.instagram.com/")
                                        .removePrefix("http://www.instagram.com/")
                                        .removePrefix("https://instagram.com/")
                                        .removePrefix("http://instagram.com/")
                                        .removePrefix("instagram.com/")
                                        .removePrefix("@")
                                        .trimEnd('/')

                                    StudioContactActionRow(
                                        label = "Instagram",
                                        value = "@$cleanIgUser",
                                        actionText = "View",
                                        icon = Icons.Default.Share,
                                        iconTint = Color(0xFFF43F5E),
                                        onClick = {
                                            try {
                                                val appIntent = Intent(Intent.ACTION_VIEW, Uri.parse("http://instagram.com/_u/$cleanIgUser")).apply {
                                                    setPackage("com.instagram.android")
                                                }
                                                context.startActivity(appIntent)
                                            } catch (e: Exception) {
                                                try {
                                                    val webIntent = Intent(Intent.ACTION_VIEW, Uri.parse("https://instagram.com/$cleanIgUser"))
                                                    context.startActivity(webIntent)
                                                } catch (ex: Exception) {
                                                    Toast.makeText(context, "Instagram: @$cleanIgUser", Toast.LENGTH_SHORT).show()
                                                }
                                            }
                                        }
                                    )
                                }

                                // 4. YouTube Channel
                                if (hasYouTube) {
                                    val ytVal = effectiveYouTube!!.trim()
                                    val cleanYt = ytVal
                                        .removePrefix("https://www.youtube.com/")
                                        .removePrefix("http://www.youtube.com/")
                                        .removePrefix("https://youtube.com/")
                                        .removePrefix("http://youtube.com/")
                                        .removePrefix("youtube.com/")
                                        .trimEnd('/')
                                    val ytDisplay = if (cleanYt.startsWith("@")) cleanYt else "@$cleanYt"
                                    val ytUrl = if (cleanYt.startsWith("@") || cleanYt.startsWith("c/") || cleanYt.startsWith("channel/")) {
                                        "https://youtube.com/$cleanYt"
                                    } else {
                                        "https://youtube.com/@$cleanYt"
                                    }

                                    StudioContactActionRow(
                                        label = "YouTube",
                                        value = ytDisplay,
                                        actionText = "Watch",
                                        icon = Icons.Default.PlayArrow,
                                        iconTint = Color(0xFFEF4444),
                                        onClick = {
                                            try {
                                                val appIntent = Intent(Intent.ACTION_VIEW, Uri.parse(ytUrl)).apply {
                                                    setPackage("com.google.android.youtube")
                                                }
                                                context.startActivity(appIntent)
                                            } catch (e: Exception) {
                                                try {
                                                    val webIntent = Intent(Intent.ACTION_VIEW, Uri.parse(ytUrl))
                                                    context.startActivity(webIntent)
                                                } catch (ex: Exception) {
                                                    Toast.makeText(context, "YouTube: $ytDisplay", Toast.LENGTH_SHORT).show()
                                                }
                                            }
                                        }
                                    )
                                }

                                // 5. TikTok Profile
                                if (hasTikTok) {
                                    val ttVal = effectiveTikTok!!.trim()
                                    val cleanTt = ttVal
                                        .removePrefix("https://www.tiktok.com/")
                                        .removePrefix("http://www.tiktok.com/")
                                        .removePrefix("https://tiktok.com/")
                                        .removePrefix("http://tiktok.com/")
                                        .removePrefix("tiktok.com/")
                                        .removePrefix("@")
                                        .trimEnd('/')
                                    val ttDisplay = "@$cleanTt"
                                    val ttUrl = "https://tiktok.com/@$cleanTt"

                                    StudioContactActionRow(
                                        label = "TikTok",
                                        value = ttDisplay,
                                        actionText = "Follow",
                                        icon = Icons.Default.MusicNote,
                                        iconTint = Color(0xFF2DD4BF),
                                        onClick = {
                                            try {
                                                val appIntent = Intent(Intent.ACTION_VIEW, Uri.parse(ttUrl)).apply {
                                                    setPackage("com.zhiliaoapp.musically")
                                                }
                                                context.startActivity(appIntent)
                                            } catch (e: Exception) {
                                                try {
                                                    val webIntent = Intent(Intent.ACTION_VIEW, Uri.parse(ttUrl))
                                                    context.startActivity(webIntent)
                                                } catch (ex: Exception) {
                                                    Toast.makeText(context, "TikTok: $ttDisplay", Toast.LENGTH_SHORT).show()
                                                }
                                            }
                                        }
                                    )
                                }
                            }
                        }
                    } else {
                        Surface(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(14.dp),
                            color = Color(0xFF1E293B)
                        ) {
                            Text(
                                text = "Your photos are delivered in 4K resolution directly from $studioName with PhotoGuard anti-piracy protection.",
                                fontSize = 12.sp,
                                textAlign = TextAlign.Center,
                                color = Color(0xFFCBD5E1),
                                modifier = Modifier.padding(14.dp)
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(20.dp))

                    Button(
                        onClick = onDismiss,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = brandAccent)
                    ) {
                        Text("Close", fontWeight = FontWeight.Bold)
                    }

                    Spacer(modifier = Modifier.height(14.dp))

                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.Center
                    ) {
                        PhotoGuardLogo(size = 18.dp, showGlow = false)
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = "Protected by PhotoGuard",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Medium,
                            color = Color(0xFF64748B)
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun StudioContactActionRow(
    label: String,
    value: String,
    actionText: String,
    icon: ImageVector,
    iconTint: Color,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(Color(0xFF0F172A).copy(alpha = 0.6f))
            .border(1.dp, Color(0xFF334155).copy(alpha = 0.6f), RoundedCornerShape(12.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(34.dp)
                .clip(CircleShape)
                .background(iconTint.copy(alpha = 0.15f)),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = icon,
                contentDescription = label,
                tint = iconTint,
                modifier = Modifier.size(18.dp)
            )
        }
        Spacer(modifier = Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = label,
                fontSize = 11.sp,
                fontWeight = FontWeight.Medium,
                color = Color(0xFF94A3B8)
            )
            Text(
                text = value,
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
        Spacer(modifier = Modifier.width(8.dp))
        Box(
            modifier = Modifier
                .clip(RoundedCornerShape(8.dp))
                .background(iconTint.copy(alpha = 0.12f))
                .border(1.dp, iconTint.copy(alpha = 0.35f), RoundedCornerShape(8.dp))
                .padding(horizontal = 10.dp, vertical = 5.dp)
        ) {
            Text(
                text = actionText,
                fontSize = 11.sp,
                fontWeight = FontWeight.ExtraBold,
                color = iconTint
            )
        }
    }
}
