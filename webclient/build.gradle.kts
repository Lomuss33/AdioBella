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

tasks.register<Exec>("buildWebApp") {
    dependsOn("npmInstall")
    commandLine(npmCommand, "run", "build")
    workingDir(projectDir)
}

tasks.named("assemble") {
    dependsOn("buildWebApp")
}
