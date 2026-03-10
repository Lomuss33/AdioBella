plugins {
    id("org.springframework.boot") version "3.4.0"
    id("io.spring.dependency-management") version "1.1.6"
    java
}

description = "Belot web server"

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}

dependencies {
    implementation(project(":engine"))
    implementation("org.springframework.boot:spring-boot-starter-web")

    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

val buildWebClient by tasks.registering {
    dependsOn(":webclient:buildWebApp")
}

tasks.processResources {
    dependsOn(buildWebClient)
    from(project(":webclient").layout.projectDirectory.dir("dist")) {
        into("static")
    }
}

tasks.bootRun {
    val serverPort = providers.gradleProperty("serverPort").orNull
    if (!serverPort.isNullOrBlank()) {
        systemProperty("server.port", serverPort)
    }
}

tasks.test {
    useJUnitPlatform()
}
