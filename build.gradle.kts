import org.gradle.internal.os.OperatingSystem

plugins {
    base
}

allprojects {
    group = "com.belot"
    version = "1.0.0"

    repositories {
        mavenCentral()
    }
}

tasks.register("runGame") {
    group = "application"
    description = "Builds the React client, packages it into the Spring Boot app, and runs the game."
    dependsOn(":server:bootRun")
}

val nodeCommand = if (OperatingSystem.current().isWindows) "node.exe" else "node"

tasks.register<Exec>("liveGame") {
    group = "application"
    description = "Runs the backend with continuous recompilation and the Vite dev server for live frontend testing."
    workingDir(rootDir)
    environment("BELOT_SERVER_PORT", providers.gradleProperty("serverPort").orNull ?: "8080")
    environment("BELOT_CLIENT_PORT", providers.gradleProperty("clientPort").orNull ?: "5173")
    commandLine(nodeCommand, "scripts/live-game.mjs")
}
