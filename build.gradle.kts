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
