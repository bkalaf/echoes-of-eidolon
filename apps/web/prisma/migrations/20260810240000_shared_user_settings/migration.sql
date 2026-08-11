CREATE TABLE "UserSettings" (
    "userId" TEXT NOT NULL,
    "theme" TEXT NOT NULL DEFAULT 'DARK',
    "textSize" TEXT NOT NULL DEFAULT 'DEFAULT',
    "reducedMotion" BOOLEAN NOT NULL DEFAULT false,
    "highContrast" BOOLEAN NOT NULL DEFAULT false,
    "captions" BOOLEAN NOT NULL DEFAULT true,
    "musicEnabled" BOOLEAN NOT NULL DEFAULT true,
    "musicVolume" INTEGER NOT NULL DEFAULT 70,
    "soundEnabled" BOOLEAN NOT NULL DEFAULT true,
    "soundVolume" INTEGER NOT NULL DEFAULT 80,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("userId"),
    CONSTRAINT "UserSettings_theme_check" CHECK ("theme" = 'DARK'),
    CONSTRAINT "UserSettings_textSize_check" CHECK ("textSize" = 'DEFAULT'),
    CONSTRAINT "UserSettings_musicVolume_check" CHECK ("musicVolume" BETWEEN 0 AND 100),
    CONSTRAINT "UserSettings_soundVolume_check" CHECK ("soundVolume" BETWEEN 0 AND 100),
    CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
