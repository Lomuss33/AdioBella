import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const webclientDir = path.join(repoRoot, "webclient");
const viteCli = path.join(webclientDir, "node_modules", "vite", "bin", "vite.js");
const host = "127.0.0.1";
const port = Number(process.env.VITE_DEV_PORT || 5174);
const isHook = process.argv.includes("--hook");

function isPortOpen(targetPort, targetHost = host, timeoutMs = 350) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;
    const finish = (open) => {
      if (!settled) {
        settled = true;
        socket.destroy();
        resolve(open);
      }
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
    socket.connect(targetPort, targetHost);
  });
}

async function ensureServer() {
  if (await isPortOpen(port)) {
    return true;
  }

  const child = spawn(
    process.execPath,
    [viteCli, "--mode", "browser", "--host", host, "--port", String(port), "--strictPort"],
    {
      cwd: webclientDir,
      detached: true,
      stdio: "ignore",
      windowsHide: true
    }
  );
  child.unref();

  for (let attempt = 0; attempt < 15; attempt += 1) {
    await new Promise((r) => setTimeout(r, 200));
    if (await isPortOpen(port)) {
      return true;
    }
  }
  return false;
}

const ready = await ensureServer();
const url = `http://localhost:${port}/`;

if (isHook) {
  process.stdout.write(
    JSON.stringify({
      injectSteps: [
        {
          systemMessage: {
            systemMessage: ready
              ? `Live Belot preview is running in instant browser mode at ${url}`
              : `Live Belot preview was triggered at ${url} (starting in background).`
          }
        }
      ]
    })
  );
} else {
  console.log(`[live-preview] ${ready ? "Ready" : "Starting"} at ${url}`);
}
