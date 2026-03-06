/*
 * ENGINE MODULE - Pure Game Logic
 * 
 * RESPONSIBILITY: Contains Match, Game, Round, ZvanjeService, and all models.
 * NO networking, NO UI, NO external dependencies except testing.
 * This is the HEART of your game - must be testable in isolation.
 * 
 * TESTING: This module has the most tests (unit + integration tests).
 */

description = "Belot Game Engine - Pure game logic and rules"

dependencies {
    // Testing dependencies (only used during testing)
    testImplementation("org.junit.jupiter:junit-jupiter:5.9.2")
    testImplementation("org.junit.jupiter:junit-jupiter-api:5.9.2")
    testImplementation("org.junit.jupiter:junit-jupiter-engine:5.9.2")
}

/*
 * Tasks - what you can run
 */
tasks {
    // Run tests with: gradle engine:test
    test {
        useJUnitPlatform()
        testLogging {
            events("passed", "skipped", "failed")
            exceptionFormat = org.gradle.api.tasks.testing.logging.TestExceptionFormat.FULL
        }
    }
    
    // Build documentation for tests
    javadoc {
        title = "Belot Engine API Documentation"
    }
}