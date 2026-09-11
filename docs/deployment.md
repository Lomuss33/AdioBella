# Deployment

[Documentation index](README.md) · [Development](development.md) · [Maintainer guide](../MAINTAINER.md)

## GitHub Pages

The repository's [deployment workflow](../.github/workflows/deploy-pages.yml) runs on pushes to `main` and manual dispatch. It installs dependencies with `npm ci`, builds the browser client, uploads `webclient/dist`, and deploys that artifact to Pages.

| Setting | Repository value |
| --- | --- |
| Build command, from `webclient/` | `npm run build:pages` |
| Output | `webclient/dist/` |
| URL | <https://lomuss33.github.io/AdioBella/> |
| Base path | `/AdioBella/` in [vite.config.ts](../webclient/vite.config.ts) |
| Runtime | `VITE_GAME_RUNTIME=browser` in [.env.pages](../webclient/.env.pages) |
| Node version | 20 in the workflow |

Pages serves static files; it does not run the Java backend. The build workflow does not run application tests. Complete the [applicable validation](development.md#validation) before merging.

To publish, merge the reviewed change to `main` or manually run **Deploy Belot to GitHub Pages** from Actions. After the workflow succeeds, open the published URL and check setup and gameplay. Repository Pages settings should use GitHub Actions as the publishing source.

If the repository name or hosting path changes, update the Vite base path and documentation links together.

## Preview the Pages artifact

From the repository root:

```powershell
cd webclient
npm ci
npm run build:pages
npx vite preview --host 127.0.0.1 --port 4173
```

Open <http://localhost:4173/AdioBella/>. Confirm that play works without a backend and that the browser makes no session API requests. Stop with Ctrl+C.

## Local server packaging

`runGame` builds and serves the normal frontend through Spring Boot. To create the executable server package:

```powershell
.\gradlew.bat :server:bootJar
```

On macOS/Linux use `./gradlew :server:bootJar`. The executable JAR is produced under `server/build/libs/`. The server build copies the normal frontend output into its static resources; it does not require manually copying files.

The server defaults to port 8080. Packaged execution supports `SERVER_PORT` through [application.properties](../server/src/main/resources/application.properties). For local Gradle launch commands and ports, see [Development](development.md).

## Troubleshooting

**Blank page or missing assets:** inspect the deployment result and browser console/network panel. Confirm the URL and Vite base path agree, and that the uploaded artifact came from `build:pages`.

**Pages attempts API requests:** verify the Pages build mode and `.env.pages`. A normal `npm run build` selects the server runtime.

**Old content after deployment:** confirm that the successful workflow built the intended commit, then reload the site.

**Game disappears after reload:** expected for the browser runtime. Neither deployment mode provides durable saved games.
