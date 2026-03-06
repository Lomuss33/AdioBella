/*
 * SERVER MODULE - Multiplayer Game Server
 * 
 * RESPONSIBILITY: Manage multiple games, player connections, networking.
 * DEPENDS ON: engine (uses game rules and logic)
 * 
 * EXAMPLE DEPENDENCIES:
 * - WebSocket library for real-time communication
 * - Database for storing game history
 * - Session management
 */

description = "Belot Game Server - Multiplayer support and networking"

dependencies {
    // Use the engine module (game logic)
    implementation(project(":engine"))
    
    // Future: Add server libraries
    // implementation("io.netty:netty-all:4.1.100.Final")  // For networking
    // implementation("org.postgresql:postgresql:42.5.0")  // For database
    
    testImplementation("org.junit.jupiter:junit-jupiter:5.9.2")
}

tasks.test {
    useJUnitPlatform()
}