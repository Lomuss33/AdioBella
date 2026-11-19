# Deployment

[Documentation index](README.md) · [Development](development.md) · [Maintainer guide](../MAINTAINER.md)

## GitHub Pages

The repository's [deployment workflow](../.github/workflows/deploy-pages.yml) runs on pushes to `main` and manual dispatch. It checks Java and frontend code, builds the browser client, uploads `webclient/dist`, and deploys that artifact to Pages.

| Setting | Repository value |
| --- | --- |
| Build command, from `webclient/` | `npm run build:pages` |
| Output | `webclient/dist/` |
| URL | <https://lomuss33.github.io/AdioBella/> |
| Base path | `/AdioBella/` in [vite.config.ts](../webclient/vite.config.ts) |
| Runtime | browser-only, set in the workflow |
| Node version | 24 in the workflow |

Pages serves static files; it does not run the Java backend. The Pages artifact exposes singleplayer only. Multiplayer UI and server code remain in the repository and are available in normal/server builds.

For a separate browser frontend connected to a homelab backend, see [Multiplayer deployment](multiplayer.md#free-static-frontend-plus-homelab-backend).

## Homelab Docker

This project can run its bundled frontend and multiplayer server on one homelab machine. Docker Compose, Java 21, and Node.js 24 are required on the machine where the executable is built. The container uses a Java runtime, listens internally on port `8080`, and stores room files in a persistent Docker volume. The host port defaults to `1111`.

From the repository root, build the executable and start the service:

```powershell
.\gradlew.bat :server:bootJar
docker compose up -d --build
```

Open `http://localhost:1111` on the homelab or `http://<homelab-lan-address>:1111` from another device on the same network. Stop the service with `docker compose down`; the `room-data` volume remains. To remove saved rooms too, run `docker compose down --volumes`.

To change the host port or room limit, set `BELOT_HOST_PORT` or `BELOT_ROOMS_MAX_ROOMS` before `docker compose up`. The service is not exposed to the public internet automatically. Public play needs a network path and HTTPS; do not forward the port directly from your router without secure access. This setup has no cloud account or usage-based hosting bill; the homelab still uses your electricity and internet connection.

GitHub Pages continues to publish its singleplayer-only static version. Use the homelab URL for rooms until a separate live multiplayer frontend/server deployment is configured.

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

**Game disappears after reload:** browser-only solo games require available local storage and the same browser/site address to resume. Clearing site data, unavailable/full storage, or an incompatible save can prevent restoration. Legacy Java solo sessions disappear when the server restarts. Multiplayer rooms require both their server-side room files and the browser's saved member token.
