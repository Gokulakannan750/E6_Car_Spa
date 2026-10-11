import java.io.FileInputStream
import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

val keystoreProperties = Properties()
val ignoreReleaseSigningCredentials =
    providers.gradleProperty("e6.ignoreReleaseSigningCredentials").orNull == "true"
val keystorePropertiesFile = rootProject.file("key.properties")
if (!ignoreReleaseSigningCredentials && keystorePropertiesFile.exists()) {
    keystoreProperties.load(FileInputStream(keystorePropertiesFile))
}

android {
    namespace = "com.carspapro.management"
    compileSdk = 37
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_17.toString()
    }

    defaultConfig {
        applicationId = "com.carspapro.management"
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        create("release") {
            if (!ignoreReleaseSigningCredentials) {
                val keyAliasProp = keystoreProperties.getProperty("keyAlias") ?: System.getenv("KEY_ALIAS")
                val keyPasswordProp = keystoreProperties.getProperty("keyPassword") ?: System.getenv("KEY_PASSWORD")
                val storeFileProp = keystoreProperties.getProperty("storeFile") ?: System.getenv("STORE_FILE")
                val storePasswordProp = keystoreProperties.getProperty("storePassword") ?: System.getenv("STORE_PASSWORD")

                if (!storeFileProp.isNullOrBlank()) {
                    val configuredFile = file(storeFileProp)
                    storeFile = if (configuredFile.isAbsolute || configuredFile.exists()) {
                        configuredFile
                    } else {
                        rootProject.file(storeFileProp)
                    }
                }
                if (!keyAliasProp.isNullOrBlank()) keyAlias = keyAliasProp
                if (!keyPasswordProp.isNullOrBlank()) keyPassword = keyPasswordProp
                if (!storePasswordProp.isNullOrBlank()) storePassword = storePasswordProp
            }
        }
    }

    buildTypes {
        release {
            signingConfig = signingConfigs.getByName("release")
        }
    }
}

gradle.taskGraph.whenReady {
    val releaseRequested = allTasks.any { task ->
        val taskName = task.name.lowercase()
        taskName.contains("release") &&
            (taskName.startsWith("assemble") || taskName.startsWith("bundle"))
    }

    if (releaseRequested) {
        val missing = mutableListOf<String>()
        val keyAliasProp = if (ignoreReleaseSigningCredentials) null else
            keystoreProperties.getProperty("keyAlias") ?: System.getenv("KEY_ALIAS")
        val keyPasswordProp = if (ignoreReleaseSigningCredentials) null else
            keystoreProperties.getProperty("keyPassword") ?: System.getenv("KEY_PASSWORD")
        val storeFileProp = if (ignoreReleaseSigningCredentials) null else
            keystoreProperties.getProperty("storeFile") ?: System.getenv("STORE_FILE")
        val storePasswordProp = if (ignoreReleaseSigningCredentials) null else
            keystoreProperties.getProperty("storePassword") ?: System.getenv("STORE_PASSWORD")

        val resolvedStoreFile = storeFileProp?.takeIf { it.isNotBlank() }?.let { configuredPath ->
            val configuredFile = file(configuredPath)
            if (configuredFile.isAbsolute || configuredFile.exists()) configuredFile
            else rootProject.file(configuredPath)
        }

        if (storeFileProp.isNullOrBlank()) {
            missing.add("storeFile (key.properties: storeFile or STORE_FILE)")
        } else if (resolvedStoreFile == null || !resolvedStoreFile.exists() || !resolvedStoreFile.isFile || !resolvedStoreFile.canRead()) {
            missing.add("storeFile does not exist or is not readable")
        }
        if (keyAliasProp.isNullOrBlank()) missing.add("keyAlias (key.properties: keyAlias or KEY_ALIAS)")
        if (storePasswordProp.isNullOrBlank()) missing.add("storePassword (key.properties: storePassword or STORE_PASSWORD)")
        if (keyPasswordProp.isNullOrBlank()) missing.add("keyPassword (key.properties: keyPassword or KEY_PASSWORD)")

        if (missing.isNotEmpty()) {
            throw GradleException(
                "Release build failed: Missing required release signing credentials: ${missing.joinToString(", ")}. " +
                    "Configure the release keystore and credentials; release builds never use the debug key."
            )
        }
    }
}

flutter {
    source = "../.."
}
