plugins {
    id("com.android.application")
    // Firebase: apply the Google services plugin (reads app/google-services.json)
    id("com.google.gms.google-services")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

android {
    namespace = "com.try1second.try1second"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        // TODO: Specify your own unique Application ID (https://developer.android.com/studio/build/application-id.html).
        applicationId = "com.try1second.try1second"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        // Uses the version code from pubspec.yaml. When using split APKs, 1000 * ABI_VERSION
        // is added automatically by Flutter. (https://developer.android.com/studio/build/configure-apk-splits#configure-APK-versions)
        // You can force using the value of versionCode by specifying the `-P force-version-code-ignoring-abi=true`
        // flag during build.
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        // Committed shared keystore so every build machine produces the SAME
        // SHA-1 that is registered in Firebase (D1:12:D9...AE:5A). Without this,
        // each machine generates its own ~/.android/debug.keystore and Google
        // login breaks with a fingerprint mismatch.
        create("shared") {
            storeFile = file("try1second.keystore")
            storePassword = "android"
            keyAlias = "androiddebugkey"
            keyPassword = "android"
        }

        // Release keystore (25 Oct): Play Console rejected the AAB because it
        // was signed with the debug alias above ("signed in debug mode").
        // This is the PERMANENT Play-Store signing key — same key must sign
        // every future update; back it up (keystore + passwords) alongside
        // the repo. SHA-1/SHA-256 must be re-registered in Firebase/Google
        // consoles if login uses them (debug key D1:12:D9...AE:5A stays for
        // debug builds).
        create("release") {
            storeFile = file("try1second-release.keystore")
            storePassword = "T1sRelease#2026#K3ystore"
            keyAlias = "try1second"
            keyPassword = "T1sRelease#2026#K3ystore"
        }
    }

    buildTypes {
        debug {
            signingConfig = signingConfigs.getByName("shared")
        }
        release {
            // Play Store release signing (debug-signing rejected by Play Console).
            signingConfig = signingConfigs.getByName("release")
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}

dependencies {
    // Firebase BoM (owner 21 Oct, try1second-66273 console instructions)
    implementation(platform("com.google.firebase:firebase-bom:35.0.2"))
    implementation("com.google.firebase:firebase-analytics")
}
