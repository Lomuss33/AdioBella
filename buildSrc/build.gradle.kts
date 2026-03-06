/*
 * BELOT GAME ENGINE - Root Build Configuration
 * 
 * This file defines common settings for all modules (engine, server, webclient, utilities).
 * Each module has its own build.gradle.kts for module-specific dependencies.
 * 
 * FUNDAMENTAL CONCEPT: Root build.gradle.kts = rules that apply EVERYWHERE
 */

plugins {
    // Java plugin - core language support (not applied here, applied in subprojects)
    id("java")
}

allprojects {
    // Group and version for all modules
    group = "com.belota"
    version = "1.0.0"
    
    // Repository where to download dependencies
    repositories {
        mavenCentral()  // Standard Java library repository
    }
}

/*
 * subprojects = configuration applied to all child modules (not root)
 * This avoids repetition in each module's build.gradle.kts
 */
subprojects {
    apply(plugin = "java")
    
    // Configure Java compiler for all modules
    java {
        toolchain {
            languageVersion = JavaLanguageVersion.of(21)  // Java 21
        }
    }
    
    // Common dependencies for all modules
    dependencies {
        // JUnit 5 for testing - available in all modules
        testImplementation("org.junit.jupiter:junit-jupiter:5.9.2")
    }
    
    // Configure test runner to use JUnit 5
    tasks.test {
        useJUnitPlatform()
    }
    
    // Compile settings
    tasks.compileJava {
        options.encoding = "UTF-8"
    }
}