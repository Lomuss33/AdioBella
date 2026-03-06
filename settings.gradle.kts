/*
 * SETTINGS.GRADLE.KTS - Module Definitions
 * 
 * FUNDAMENTAL CONCEPT: This file tells Gradle which directories are modules.
 * When you add "include(\"moduleName\")", Gradle looks for moduleName/build.gradle.kts
 * 
 * Structure:
 * - engine: Pure game logic (no UI, no networking)
 * - server: Game server, multiplayer logic
 * - webclient: Browser-based frontend (future)
 * - utilities: Shared helper code
 */

 plugins {
    id("org.gradle.toolchains.foojay-resolver-convention") version "0.8.0"
}

rootProject.name = "AdioBella"

include("engine")
include("server")
include("webclient")
include("utilities")