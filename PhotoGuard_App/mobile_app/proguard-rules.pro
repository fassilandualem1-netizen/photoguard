# Optimizations & Size Reduction Settings
-optimizationpasses 5
-dontusemixedcaseclassnames
-dontskipnonpubliclibraryclasses
-verbose

# Basic ProGuard rules for Compose and Coroutines
-keep class kotlin.coroutines.jvm.internal.** { *; }
-keepnames class kotlinx.coroutines.internal.MainDispatcherFactory { *; }
-keepnames class kotlinx.coroutines.CoroutineExceptionHandler { *; }
-keepclassmembernames class kotlinx.** {
    volatile <fields>;
}

# Keep Media3 / ExoPlayer safe from aggressive shrinking
-keep class androidx.media3.** { *; }
-dontwarn androidx.media3.**

# Retrofit, OkHttp & Moshi Data Models
-keepattributes Signature
-keepattributes *Annotation*
-keep class retrofit2.** { *; }
-keepclasseswithmembers class * {
    @retrofit2.http.* <methods>;
}
-keep class com.squareup.moshi.** { *; }
-keepclassmembers class * {
    @com.squareup.moshi.Json *;
}
-keep class com.example.data.model.** { *; }

# Room Database
-keep class * extends androidx.room.RoomDatabase
-keep class com.example.data.local.** { *; }

# General optimizations and safety
-keepattributes SourceFile,LineNumberTable
