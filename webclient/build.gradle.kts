import org.gradle.internal.os.OperatingSystem

plugins {
    base
}

description = "Belot React frontend"

val npmCommand = if (OperatingSystem.current().isWindows) "npm.cmd" else "npm"

tasks.register<Exec>("npmCi") {
    inputs.file(layout.projectDirectory.file("package.json"))
    inputs.file(layout.projectDirectory.file("package-lock.json"))
    outputs.dir(layout.projectDirectory.dir("node_modules"))
    commandLine(npmCommand, "ci")
    workingDir(projectDir)
}

val syncFavicon by tasks.registering(Sync::class) {
    from(rootProject.file("favicon.ico"))
    into(layout.projectDirectory.dir("public"))
}

tasks.register<Exec>("buildWebApp") {
    dependsOn("npmCi", syncFavicon)
    commandLine(npmCommand, "run", "build")
    workingDir(projectDir)
}

tasks.named("assemble") {
    dependsOn("buildWebApp")
}
