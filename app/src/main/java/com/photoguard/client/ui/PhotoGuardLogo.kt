package com.photoguard.client.ui

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Fill
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import kotlin.math.cos
import kotlin.math.sin

/**
 * PhotoGuard Premium Brand Logo
 * 
 * An iconic fusion of camera aperture optics and impenetrable vault security.
 * Rendered with precision mathematical geometry in Compose Canvas.
 */
@Composable
fun PhotoGuardLogo(
    modifier: Modifier = Modifier,
    size: Dp = 92.dp,
    showGlow: Boolean = true
) {
    // Subtle ambient breathing glow animation
    val infiniteTransition = rememberInfiniteTransition(label = "logoGlowTransition")
    val pulseAlpha by infiniteTransition.animateFloat(
        initialValue = 0.22f,
        targetValue = 0.42f,
        animationSpec = infiniteRepeatable(
            animation = tween(2200, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "pulseAlpha"
    )

    Box(
        modifier = modifier.size(size),
        contentAlignment = Alignment.Center
    ) {
        Canvas(modifier = Modifier.size(size)) {
            val w = this.size.width
            val h = this.size.height

            // 1. Ambient Golden Halo Glow
            if (showGlow) {
                drawCircle(
                    brush = Brush.radialGradient(
                        colors = listOf(
                            Color(0xFFF59E0B).copy(alpha = pulseAlpha),
                            Color(0xFFD97706).copy(alpha = pulseAlpha * 0.4f),
                            Color.Transparent
                        ),
                        center = Offset(w * 0.5f, h * 0.48f),
                        radius = w * 0.55f
                    ),
                    radius = w * 0.55f,
                    center = Offset(w * 0.5f, h * 0.48f)
                )
            }

            // 2. Shield Geometry Path
            val shieldPath = Path().apply {
                moveTo(w * 0.5f, h * 0.08f)
                cubicTo(w * 0.72f, h * 0.08f, w * 0.88f, h * 0.16f, w * 0.90f, h * 0.28f)
                cubicTo(w * 0.90f, h * 0.54f, w * 0.72f, h * 0.76f, w * 0.5f, h * 0.92f)
                cubicTo(w * 0.28f, h * 0.76f, w * 0.10f, h * 0.54f, w * 0.10f, h * 0.28f)
                cubicTo(w * 0.12f, h * 0.16f, w * 0.28f, h * 0.08f, w * 0.5f, h * 0.08f)
                close()
            }

            // Shield Dark Metallic Obsidian Fill
            drawPath(
                path = shieldPath,
                brush = Brush.verticalGradient(
                    colors = listOf(
                        Color(0xFF1E293B),
                        Color(0xFF0F172A),
                        Color(0xFF020617)
                    ),
                    startY = 0f,
                    endY = h
                ),
                style = Fill
            )

            // Shield Outer Beveled Gold Stroke
            drawPath(
                path = shieldPath,
                brush = Brush.linearGradient(
                    colors = listOf(
                        Color(0xFFFDE68A),
                        Color(0xFFF59E0B),
                        Color(0xFFD97706),
                        Color(0xFF92400E)
                    ),
                    start = Offset(0f, 0f),
                    end = Offset(w, h)
                ),
                style = Stroke(
                    width = w * 0.035f,
                    cap = StrokeCap.Round,
                    join = StrokeJoin.Round
                )
            )

            // 3. Inner Shield Subtle Contour Inset
            val innerShieldPath = Path().apply {
                moveTo(w * 0.5f, h * 0.14f)
                cubicTo(w * 0.68f, h * 0.14f, w * 0.82f, h * 0.21f, w * 0.84f, h * 0.31f)
                cubicTo(w * 0.84f, h * 0.52f, w * 0.68f, h * 0.71f, w * 0.5f, h * 0.85f)
                cubicTo(w * 0.32f, h * 0.71f, w * 0.16f, h * 0.52f, w * 0.16f, h * 0.31f)
                cubicTo(w * 0.18f, h * 0.21f, w * 0.32f, h * 0.14f, w * 0.5f, h * 0.14f)
                close()
            }
            drawPath(
                path = innerShieldPath,
                color = Color(0xFF334155).copy(alpha = 0.45f),
                style = Stroke(width = w * 0.015f)
            )

            // 4. Optical Camera Aperture Mechanism
            val lensCenter = Offset(w * 0.5f, h * 0.46f)
            val outerLensRadius = w * 0.23f
            val innerLensRadius = outerLensRadius * 0.42f

            // Lens Outer Bezel
            drawCircle(
                color = Color(0xFF1E293B),
                radius = outerLensRadius,
                center = lensCenter,
                style = Fill
            )
            drawCircle(
                brush = Brush.sweepGradient(
                    colors = listOf(
                        Color(0xFFF59E0B),
                        Color(0xFFFBBF24),
                        Color(0xFFB45309),
                        Color(0xFFF59E0B)
                    ),
                    center = lensCenter
                ),
                radius = outerLensRadius,
                center = lensCenter,
                style = Stroke(width = w * 0.024f)
            )

            // 6 Precision Camera Aperture Blades
            val bladeCount = 6
            for (i in 0 until bladeCount) {
                val angleDeg = i * (360f / bladeCount)
                val angleRad = Math.toRadians(angleDeg.toDouble())
                val nextAngleRad = Math.toRadians((angleDeg + 48.0))

                val startX = lensCenter.x + (outerLensRadius * cos(angleRad)).toFloat()
                val startY = lensCenter.y + (outerLensRadius * sin(angleRad)).toFloat()

                val endX = lensCenter.x + (innerLensRadius * cos(nextAngleRad)).toFloat()
                val endY = lensCenter.y + (innerLensRadius * sin(nextAngleRad)).toFloat()

                drawLine(
                    color = Color(0xFFD97706),
                    start = Offset(startX, startY),
                    end = Offset(endX, endY),
                    strokeWidth = w * 0.018f,
                    cap = StrokeCap.Round
                )
            }

            // 5. Central Optical Element (Camera Glass)
            drawCircle(
                brush = Brush.radialGradient(
                    colors = listOf(
                        Color(0xFF0F172A),
                        Color(0xFF020617)
                    ),
                    center = lensCenter,
                    radius = innerLensRadius
                ),
                radius = innerLensRadius,
                center = lensCenter,
                style = Fill
            )

            // Radiant Core Focus Dot
            drawCircle(
                color = Color(0xFFFBBF24),
                radius = innerLensRadius * 0.40f,
                center = lensCenter,
                style = Fill
            )

            // Specular Reflection (Glass Coating Glare)
            val glareRadius = innerLensRadius * 0.78f
            val glarePath = Path().apply {
                arcTo(
                    rect = Rect(
                        left = lensCenter.x - glareRadius,
                        top = lensCenter.y - glareRadius,
                        right = lensCenter.x + glareRadius,
                        bottom = lensCenter.y + glareRadius
                    ),
                    startAngleDegrees = 200f,
                    sweepAngleDegrees = 85f,
                    forceMoveTo = true
                )
            }
            drawPath(
                path = glarePath,
                color = Color.White.copy(alpha = 0.85f),
                style = Stroke(width = w * 0.022f, cap = StrokeCap.Round)
            )

            // 6. Lower Shield Security Chevron Accent
            val chevronY = h * 0.74f
            val chevronW = w * 0.16f
            val chevronPath = Path().apply {
                moveTo(w * 0.5f - chevronW, chevronY)
                lineTo(w * 0.5f, chevronY + h * 0.06f)
                lineTo(w * 0.5f + chevronW, chevronY)
            }
            drawPath(
                path = chevronPath,
                brush = Brush.horizontalGradient(
                    colors = listOf(
                        Color(0xFFD97706),
                        Color(0xFFFBBF24),
                        Color(0xFFD97706)
                    )
                ),
                style = Stroke(
                    width = w * 0.025f,
                    cap = StrokeCap.Round,
                    join = StrokeJoin.Round
                )
            )
        }
    }
}
