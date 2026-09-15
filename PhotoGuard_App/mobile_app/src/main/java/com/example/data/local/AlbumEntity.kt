package com.example.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "albums")
data class AlbumEntity(
    @PrimaryKey
    val accessCode: String,
    val albumTitle: String,
    val photographerName: String,
    val tokensJson: String, // Storing tokens as comma-separated string for simplicity
    val cachedAt: Long = System.currentTimeMillis()
)
