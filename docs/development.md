# Development

[Documentation index](README.md) · [Architecture](architecture.md) · [AI guidance](ai-development.md)

## Prerequisites

- JDK 21: both Java modules select a Java 21 toolchain.
- Node.js and npm: Node 20 is the version configured in the Pages workflow.
- Git and the repository's Gradle wrapper; no separate Gradle installation is needed.
- Network access for the initial Gradle and npm dependency downloads.

Commands below run from the repository root unless a block changes directory. Gradle examples use PowerShell; on macOS/Linux replace `.\gradlew.bat` with `./gradlew`.

## Choose a runtime

### Quick live UI development

From the repository root, install frontend dependencies once, then start the watcher:

```powershell
npm run setup
npm run dev
```

Open the local URL printed by Vite, normally <http://localhost:5174/>. This uses the browser game engine through `webclient/.env.browser`, so Java is not required. Vite watches source files and applies UI changes as you save. Some module changes may reload the page and reset the in-memory browser game. Stop with Ctrl+C.

For another port, use `npm run dev -- --port 5175`. The existing Vite host setting also permits access from a phone on the same network through the printed Network URL, subject to the machine's firewall.

`npx serve .` serves static files; it does not compile this React/TypeScript source or provide the project's live development workflow.

The root npm shortcuts were added without running tests, builds, or launching servers.

### Full application

```powershell
.\gradlew.bat runGame
```

Open <http://localhost:8080>. This builds the frontend, copies its output into the server resources, and starts Spring Boot.

To use another port:

```powershell
.\gradlew.bat runGame -PserverPort=28081
```

Open <http://localhost:28081>.

### Live full-stack development

Install frontend dependencies once before starting the live launcher:

```powershell
cd webclient
npm ci
cd ..
.\gradlew.bat liveGame
```

Open <http://localhost:5174>. The launcher runs Vite, Spring Boot, and continuous Java compilation. Vite proxies `/api` to the backend; Spring DevTools handles backend restarts. Stop the launcher with Ctrl+C.

The same live launcher is available from the project root as `npm run dev:full`. It requires JDK 21 and installed frontend dependencies (`npm run setup`).

Custom ports:

```powershell
.\gradlew.bat liveGame -PserverPort=28081 -PclientPort=5175
```

Open <http://localhost:5175>. See [scripts/live-game.mjs](../scripts/live-game.mjs) for orchestration.

### Browser-only development

```powershell
cd webclient
npm ci
npm run dev -- --mode pages
```

Open <http://localhost:5174/AdioBella/>. Pages mode loads [the browser runtime setting](../webclient/.env.pages) and uses the repository base path. No Java server is needed.

## Change workflow

1. Inspect `git status` and create a focused branch, for example `git switch -c docs/improve-guides`.
2. Read the relevant [architecture entry points](architecture.md). For rules or session behavior, inspect both runtimes.
3. Make the change and add or update behavior tests where appropriate.
4. Run the checks below for the affected layers. Review `git diff --check` and the final diff.
5. Open a pull request with the problem, resulting behavior, and validation results. Mention any checks that could not run.

To bring current main into an existing branch, use `git fetch origin` followed by `git merge origin/main` with your work committed or safely stashed. Resolve conflicts and repeat affected checks. Do not use hard resets or force pushes as routine synchronization.

## Validation

| Change | Checks from repository root |
| --- | --- |
| Java rules | `.\gradlew.bat :engine:test` |
| Server sessions or API | `.\gradlew.bat :server:test` |
| Browser rules or React UI | `npm --prefix webclient test` and `npm --prefix webclient run build` |
| Shared gameplay or contract | Both Java test tasks, frontend tests, and both frontend builds |
| Pages configuration | `npm --prefix webclient run build:pages` and a browser-only smoke check |
| Documentation only | Check relative links, paths, commands against their source, and `git diff --check` |

For a complete build and all existing test suites:

```powershell
.\gradlew.bat build
npm --prefix webclient test
npm --prefix webclient run build:pages
```

Gradle builds the normal frontend bundle and runs Java tests. It does **not** run Vitest; run `npm test` separately. Frontend builds include TypeScript checking. The Gradle frontend task uses `npm install`, so review any lockfile changes it produces.

For gameplay changes, exercise setup, trump selection, melds, card play, Bela when available, scores, and the affected end-of-game behavior in both runtimes. For UI changes, also inspect narrow and wide layouts, card labels, hidden hands, animations, and the event log.

Tests live under [engine/src/test](../engine/src/test), [server/src/test](../server/src/test), and alongside frontend modules in [webclient/src](../webclient/src).

## Troubleshooting

**Port occupied:** use the custom-port commands above. On Windows, `netstat -ano | findstr :8080` identifies the PID; `Get-Process -Id <PID>` identifies the process before you decide whether to stop it.

**Missing frontend dependencies in live mode:** run `npm ci` in `webclient/`. The live launcher does not install them.

**Stale session after a backend restart:** reload, or remove only `belot-session-id` from local storage for the local site and reload. Sessions are not durable.

**Frontend calls the wrong backend:** check `VITE_BACKEND_PORT` and `VITE_DEV_PORT` in [Vite configuration](../webclient/vite.config.ts). The live launcher sets the backend proxy port from `-PserverPort`.

**Java or wrapper startup fails:** inspect `java -version`, `JAVA_HOME`, and `.\gradlew.bat --version`. Check the pinned distribution in [gradle-wrapper.properties](../gradle/wrapper/gradle-wrapper.properties) and dependency download access before changing build versions.

**Static assets seem stale:** `runGame` packages the frontend automatically; rebuild and restart it. For immediate UI updates, use `liveGame`. Pages-specific issues are covered in [Deployment](deployment.md).
