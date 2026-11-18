// Летописец — лаунчер: поднимает локальный веб-сервер и сам открывает браузер.
// Запуск: двойной клик по start.bat (Windows) / start.command (macOS) / start.sh (Linux).
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);

function freePort(start) {
  return new Promise((resolve) => {
    const tryPort = (p) => {
      const s = net.createServer();
      s.once("error", () => tryPort(p + 1));
      s.once("listening", () => s.close(() => resolve(p)));
      s.listen(p, "127.0.0.1");
    };
    tryPort(start);
  });
}

function openBrowser(url) {
  const cmd = process.platform === "win32" ? ["cmd", ["/c", "start", "", url]] : process.platform === "darwin" ? ["open", [url]] : ["xdg-open", [url]];
  try {
    spawn(cmd[0], cmd[1], { detached: true, stdio: "ignore" }).unref();
  } catch {
    console.log("Откройте в браузере:", url);
  }
}

async function waitHealthy(url, tries = 120) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url + "/api/health");
      if (r.ok) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const flag = path.join(root, "data", ".db-ready");
fs.mkdirSync(path.join(root, "data", "images"), { recursive: true });
fs.mkdirSync(path.join(root, "data", "generated"), { recursive: true });

if (!fs.existsSync(flag)) {
  console.log("Первый запуск: создаю таблицы базы данных…");
  const r = spawnSync(npx, ["drizzle-kit", "push", "--force"], { stdio: "inherit", shell: process.platform === "win32" });
  if (r.status === 0) fs.writeFileSync(flag, new Date().toISOString());
  else console.log("Не удалось подготовить базу. Проверьте, что PostgreSQL запущен (DATABASE_URL в файле .env).");
}

if (!fs.existsSync(path.join(root, ".next"))) {
  console.log("Первая сборка приложения (1–2 минуты)…");
  spawnSync(npx, ["next", "build"], { stdio: "inherit", shell: process.platform === "win32" });
}

const port = await freePort(Number(process.env.PORT) || 3000);
const url = `http://127.0.0.1:${port}`;
const server = spawn(npx, ["next", "start", "-p", String(port), "-H", "127.0.0.1"], { stdio: "inherit", shell: process.platform === "win32", env: { ...process.env, NODE_ENV: "production" } });
server.on("exit", (code) => process.exit(code ?? 0));
process.on("SIGINT", () => server.kill());
process.on("SIGTERM", () => server.kill());

if (await waitHealthy(url)) {
  console.log(`\nЛетописец запущен: ${url}\nНе закрывайте это окно, пока играете.`);
  openBrowser(url);
} else {
  console.log("Сервер не ответил вовремя. Смотрите сообщения выше.");
}
