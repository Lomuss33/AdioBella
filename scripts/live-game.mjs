import { spawn } from "node:child_process";
import process from "node:process";

const isWindows = process.platform === "win32";
const gradleCommand = isWindows ? "gradlew.bat" : "./gradlew";
const npmCommand = isWindows ? "npm.cmd" : "npm";
const serverPort = process.env.BELOT_SERVER_PORT ?? "8080";
const clientPort = process.env.BELOT_CLIENT_PORT ?? "5173";
const viteUrl = `http://localhost:${clientPort}`;

if (process.argv.includes("--help")) {
  console.log("Starts Spring Boot, continuous backend recompilation, and the Vite dev server.");
  console.log(`Backend: http://localhost:${serverPort}`);
  console.log(`Frontend: ${viteUrl}`);
  process.exit(0);
}

const children = [
  runProcess(
    "server-build",
    gradleCommand,
    [":server:classes", "--continuous", "-PliveFrontendDev=true", `-PserverPort=${serverPort}`],
    process.cwd()
  ),
  runProcess(
    "server",
    gradleCommand,
    [":server:bootRun", "-PliveFrontendDev=true", `-PserverPort=${serverPort}`],
    process.cwd()
  ),
  runProcess(
    "web",
    npmCommand,
    ["run", "dev", "--", "--host", "0.0.0.0", "--port", clientPort],
    `${process.cwd()}/webclient`,
    {
      VITE_BACKEND_PORT: serverPort
    }
  )
];

let shuttingDown = false;

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
process.on("exit", () => {
  if (!shuttingDown) {
    shutdown(0);
  }
});

console.log(`[liveGame] Frontend dev server: ${viteUrl}`);
console.log(`[liveGame] Backend API target: http://localhost:${serverPort}`);
console.log("[liveGame] Press Ctrl+C to stop both processes.");

for (const child of children) {
  child.on("exit", (code) => {
    if (shuttingDown) {
      return;
    }

    const normalizedCode = code ?? 0;
    if (normalizedCode !== 0) {
      console.error(`[liveGame] ${child.label} exited with code ${normalizedCode}.`);
      shutdown(normalizedCode);
    }
  });
}

function runProcess(label, command, args, cwd, extraEnv = {}) {
  const child = isWindows
    ? spawn("cmd.exe", ["/d", "/s", "/c", toWindowsCommand(command, args)], {
        cwd,
        env: {
          ...process.env,
          ...extraEnv
        },
        stdio: ["ignore", "pipe", "pipe"]
      })
    : spawn(command, args, {
        cwd,
        env: {
          ...process.env,
          ...extraEnv
        },
        stdio: ["ignore", "pipe", "pipe"]
      });

  child.label = label;
  child.stdout.on("data", (chunk) => writePrefixed(label, chunk));
  child.stderr.on("data", (chunk) => writePrefixed(label, chunk));
  child.on("error", (error) => {
    if (!shuttingDown) {
      console.error(`[liveGame] Failed to start ${label}: ${error.message}`);
      shutdown(1);
    }
  });
  return child;
}

function toWindowsCommand(command, args) {
  return [command, ...args].map(quoteForCmd).join(" ");
}

function quoteForCmd(value) {
  if (value.length === 0) {
    return "\"\"";
  }

  if (!/[ \t"&()<>^|]/.test(value)) {
    return value;
  }

  return `"${value.replace(/"/g, "\"\"")}"`;
}

function writePrefixed(label, chunk) {
  const text = chunk.toString();
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (line.length > 0) {
      console.log(`[${label}] ${line}`);
    }
  }
}

function shutdown(exitCode) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  const killers = children.map((child) => killProcessTree(child.pid));
  Promise.allSettled(killers).finally(() => {
    process.exit(exitCode);
  });
}

function killProcessTree(pid) {
  if (!pid) {
    return Promise.resolve();
  }

  if (isWindows) {
    return new Promise((resolve) => {
      const killer = spawn("taskkill", ["/pid", String(pid), "/t", "/f"], {
        stdio: "ignore"
      });
      killer.on("exit", () => resolve());
      killer.on("error", () => resolve());
    });
  }

  return new Promise((resolve) => {
    try {
      process.kill(-pid, "SIGTERM");
    } catch {
      try {
        process.kill(pid, "SIGTERM");
      } catch {
      }
    }
    resolve();
  });
}
