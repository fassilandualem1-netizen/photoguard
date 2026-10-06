package com.photoguard.client

import android.app.Application
import android.graphics.Bitmap
import android.util.Log
import coil.ImageLoader
import coil.ImageLoaderFactory
import coil.memory.MemoryCache

class PhotoGuardApp : Application(), ImageLoaderFactory {

    override fun onCreate() {
        super.onCreate()
        setupGlobalExceptionHandler()
    }

    private fun setupGlobalExceptionHandler() {
        val defaultHandler = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            Log.e(
                "PhotoGuardFatal",
                "Uncaught exception on thread [${thread.name}]: ${throwable.localizedMessage}",
                throwable
            )
            defaultHandler?.uncaughtException(thread, throwable)
        }
    }

    override fun newImageLoader(): ImageLoader {
        return ImageLoader.Builder(this)
            .memoryCache {
                MemoryCache.Builder(this)
                    .maxSizePercent(0.40)
                    .build()
            }
            .diskCache(null) // STRICT: RAM-only, zero disk retention
            .bitmapConfig(Bitmap.Config.HARDWARE)
            .allowHardware(true)
            .crossfade(true)
            .build()
    }
}
