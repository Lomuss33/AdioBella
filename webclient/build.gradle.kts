import org.gradle.internal.os.OperatingSystem

plugins {
    base
}

description = "Belot React frontend"

val npmCommand = if (OperatingSystem.current().isWindows) "npm.cmd" else "npm"

tasks.register<Exec>("npmInstall") {
    commandLine(npmCommand, "install")
    workingDir(projectDir)
}

val syncFavicon by tasks.registering(Sync::class) {
    from(rootProject.file("favicon.ico"))
    into(layout.projectDirectory.dir("public"))
}

tasks.register<Exec>("buildWebApp") {
    dependsOn("npmInstall", syncFavicon)
    commandLine(npmCommand, "run", "build")
    workingDir(projectDir)
}

tasks.named("assemble") {
    dependsOn("buildWebApp")
}
