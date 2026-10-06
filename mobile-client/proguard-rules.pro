# ========================================================
# Kotlin Generic Signatures & Reflection Preservation
# (PREVENTS ParameterizedType & ClassCastException)
# ========================================================
-keepattributes Signature, InnerClasses, EnclosingMethod, *Annotation*, Exceptions
-keepattributes SourceFile, LineNumberTable

# ========================================================
# Retrofit 2 & OkHttp 3 / Okio
# ========================================================
-dontwarn okhttp3.**
-dontwarn retrofit2.**
-dontwarn okio.**
-keep class retrofit2.** { *; }
-keepclasseswithmembers interface * {
    @retrofit2.http.* <methods>;
}
-keep interface retrofit2.Call
-keep interface retrofit2.Callback

# ========================================================
# JakeWharton & kotlinx.serialization converter
# ========================================================
-dontwarn com.jakewharton.retrofit2.converter.kotlinx.serialization.**
-keep class com.jakewharton.retrofit2.converter.kotlinx.serialization.** { *; }

# kotlinx.serialization core & runtime reflection
-keepattributes *Annotation*, EnclosingMethod
-keepclassmembers class * {
    @kotlinx.serialization.SerialName <fields>;
}
-keepclassmembers class * {
    *** Companion;
}
-keepclasseswithmembers class * {
    kotlinx.serialization.KSerializer serializer(...);
}
-keepclassmembers class * extends kotlinx.serialization.internal.GeneratedSerializer {
    <init>(...);
}
-keep,allowobfuscation,allowshrinking class * {
    kotlinx.serialization.KSerializer $serializer;
}

# PhotoGuard Data Transfer Models (Strictly Keep All Members & Serializers)
-keep class com.photoguard.client.data.model.** { *; }
-keepclassmembers class com.photoguard.client.data.model.** { *; }
-keepclassmembers class com.photoguard.client.data.model.**$* { *; }
-keep interface com.photoguard.client.data.model.** { *; }

# PhotoGuard Network Layer
-keep class com.photoguard.client.network.** { *; }
-keepclassmembers class com.photoguard.client.network.** { *; }

# ========================================================
# Android Jetpack Compose & Navigation
# ========================================================
-keep class androidx.compose.** { *; }
-dontwarn androidx.compose.**

-keep class androidx.navigation.** { *; }
-dontwarn androidx.navigation.**

# Preserve ViewModels & Lifecycle
-keep class androidx.lifecycle.** { *; }
-keep class com.photoguard.client.ui.**ViewModel { *; }
-keepclassmembers class com.photoguard.client.ui.**ViewModel { *; }

# Preserve Activities & Entry Points
-keep public class com.photoguard.client.MainActivity
-keep public class * extends android.app.Activity
-keep public class * extends android.app.Application

# ========================================================
# Coil Image Loader (RAM-only pipeline)
# ========================================================
-keep class coil.** { *; }
-dontwarn coil.**
-keep class coil.compose.** { *; }
-dontwarn coil.compose.**

# ========================================================
# Kotlin Coroutines
# ========================================================
-keepnames class kotlinx.coroutines.internal.MainDispatcherFactory {}
-keepnames class kotlinx.coroutines.CoroutineExceptionHandler {}
-keepclassmembernames class kotlinx.coroutines.** {
    volatile <fields>;
}
-dontwarn kotlinx.coroutines.**
