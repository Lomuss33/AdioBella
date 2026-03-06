/*
 * WEBCLIENT MODULE - Browser-Based Frontend
 * 
 * RESPONSIBILITY: Web UI for playing Belot in a browser.
 * STATUS: Placeholder (React/Vue will go here later)
 * DEPENDS ON: server (connects to game server via WebSocket)
 * 
 * This will be separate from your Java game engine.
 * For now, keep it minimal and let the backend mature first.
 */

description = "Belot Web Client - Browser frontend (future)"

dependencies {
    // Leave empty until you start web development
    // implementation("com.google.code.gson:gson:2.8.9")  // For JSON parsing
    
    testImplementation("org.junit.jupiter:junit-jupiter:5.9.2")
}

tasks.test {
    useJUnitPlatform()
}